/**
 * Sales Agent
 * Main agent loop with Groq tool use
 */

const { Groq } = require('groq-sdk');
const config = require('../config/env');
const { TOOL_DEFINITIONS, TOOL_HANDLERS } = require('./toolRegistry');
const memoryStore = require('../memory');
const logger = require('../config/logger');

const groq = new Groq({ apiKey: config.groqApiKey });

const SYSTEM_PROMPT = `You are an expert, friendly sales assistant for TechCorp Solutions. Your job is to help prospects understand our product plans and pricing.

RULES YOU MUST FOLLOW:
1. ALWAYS call get_user_memory at the very start to check what this user has discussed before.
2. ALWAYS call search_catalog before answering ANY question about pricing, features, or plans.
3. Never answer product questions from your own training knowledge — only from catalog search results.
4. Be concise, helpful, and reference specific plan names and prices from the catalog.
5. If you are uncertain or the question is outside your knowledge, call flag_for_human.

CONVERSATION STYLE:
- Be warm and professional
- Reference previous conversations if available
- Ask clarifying questions if needed
- Highlight relevant features based on user's stated needs`;

const MAX_ITERATIONS = 10;

/**
 * Extract facts from a response
 * @param {string} response - The agent's response
 * @returns {string[]} Extracted facts
 */
function extractFacts(response) {
  const facts = [];
  
  // Plan mentions
  const planPattern = /\b(Starter|Growth|Enterprise)\b/gi;
  const plans = response.match(planPattern);
  if (plans) {
    const uniquePlans = [...new Set(plans.map(p => p.toLowerCase()))];
    uniquePlans.forEach(plan => {
      facts.push(`User showed interest in ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`);
    });
  }
  
  // Feature mentions (SSO, audit logs, etc.)
  const featurePatterns = [
    { pattern: /\b(sso|single.sign.on)\b/i, fact: 'User needs SSO' },
    { pattern: /\baudit\s*(logs?)?\b/i, fact: 'User interested in audit logs' },
    { pattern: /\btrial\b/i, fact: 'User asking about free trial' },
    { pattern: /\bunlimited\s*users?\b/i, fact: 'User needs unlimited users' },
    { pattern: /\bcustom\s*(integration|contract)\b/i, fact: 'User interested in custom solutions' }
  ];
  
  featurePatterns.forEach(({ pattern, fact }) => {
    if (pattern.test(response)) {
      facts.push(fact);
    }
  });
  
  // Budget mentions
  const budgetPattern = /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(per\s*month|\/mo|monthly)/i;
  const budgetMatch = response.match(budgetPattern);
  if (budgetMatch) {
    facts.push(`User mentioned budget around $${budgetMatch[1]}/month`);
  }
  
  return [...new Set(facts)]; // Remove duplicates
}

/**
 * Run the sales agent
 * @param {string} userId - The user ID
 * @param {string} userMessage - The user's message
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Agent response
 */
async function runAgent(userId, userMessage, sessionId) {
  logger.info(`Running agent for user ${userId}, session ${sessionId}`);
  
  // Step 1: Build initial messages array
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];
  
  // Step 2: Track tools called
  const toolsCalled = [];
  
  // Step 3: Agent loop with max iteration guard
  let iterations = 0;
  let finalResponse = '';
  
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    logger.debug(`Agent iteration ${iterations}`);
    
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        max_tokens: 1024,
        temperature: 0.7
      });
      
      const message = completion.choices[0].message;
      
      // Step 4: Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Append assistant message
        messages.push(message);
        
        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          logger.info(`Tool called: ${toolName}`);
          
          let toolArgs;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            logger.error(`Failed to parse tool arguments for ${toolName}:`, parseError.message);
            toolArgs = {};
          }
          
          // Execute the tool
          const handler = TOOL_HANDLERS[toolName];
          let toolResult;
          
          if (handler) {
            try {
              toolResult = await handler(toolArgs);
              toolsCalled.push(toolName);
            } catch (toolError) {
              logger.error(`Tool ${toolName} failed:`, toolError.message);
              toolResult = { error: toolError.message };
            }
          } else {
            logger.error(`Unknown tool: ${toolName}`);
            toolResult = { error: `Unknown tool: ${toolName}` };
          }
          
          // Append tool result
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        
        // Continue loop for next iteration
        continue;
      }
      
      // Step 5: No tool calls, we have the final response
      finalResponse = message.content || 'I apologize, but I could not generate a response.';
      break;
      
    } catch (error) {
      logger.error('Groq API error:', error.message);
      throw error;
    }
  }
  
  if (iterations >= MAX_ITERATIONS && !finalResponse) {
    logger.warn('Agent reached max iterations without response');
    finalResponse = 'I apologize, but I am having trouble processing your request. Let me escalate this to our team.';
  }
  
  // Step 6: Extract and save facts
  const facts = extractFacts(finalResponse);
  for (const fact of facts) {
    try {
      await memoryStore.saveFact(userId, fact, sessionId);
      logger.debug(`Saved fact: ${fact}`);
    } catch (error) {
      logger.error('Failed to save fact:', error.message);
    }
  }
  
  logger.info(`Agent completed for user ${userId}, tools called: ${toolsCalled.join(', ') || 'none'}`);
  
  // Step 7: Return response
  return {
    response: finalResponse,
    toolsCalled,
    sessionId
  };
}

module.exports = {
  runAgent,
  extractFacts
};
