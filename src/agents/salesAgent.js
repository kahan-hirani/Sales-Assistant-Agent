/**
 * Sales Agent
 * Main agent loop with explicit tool execution (no complex loop)
 */

const { Groq } = require('groq-sdk');
const config = require('../config/env');
const { TOOL_HANDLERS } = require('./toolRegistry');
const memoryStore = require('../memory');
const logger = require('../config/logger');
const { catalog } = require('../tools/searchCatalog.tool');

const groq = new Groq({ apiKey: config.groqApiKey });

const SYSTEM_PROMPT = `You are an expert, friendly sales assistant for TechCorp Solutions. Help prospects understand our product plans and pricing.

Instructions:
1. Use the provided context about the user and products to answer questions
2. Be concise and specific with prices and features
3. If you don't have enough information, say so honestly
4. Reference previous conversation context when available`;

/**
 * Generate a fallback response when LLM fails
 */
function generateFallbackResponse(userMessage) {
  const products = catalog.products;
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes('enterprise')) {
    const enterprise = products.find(p => p.name.toLowerCase() === 'enterprise');
    if (enterprise) {
      return `The Enterprise plan costs ${enterprise.price} (${enterprise.annual_price}) and includes: ${enterprise.features.join(', ')}. It's ideal for ${enterprise.ideal_for}.`;
    }
  }
  
  if (lowerMsg.includes('growth')) {
    const growth = products.find(p => p.name.toLowerCase() === 'growth');
    if (growth) {
      return `The Growth plan costs ${growth.price} (${growth.annual_price}) and includes: ${growth.features.join(', ')}. It's ideal for ${growth.ideal_for}.`;
    }
  }
  
  if (lowerMsg.includes('starter')) {
    const starter = products.find(p => p.name.toLowerCase() === 'starter');
    if (starter) {
      return `The Starter plan costs ${starter.price} (${starter.annual_price}) and includes: ${starter.features.join(', ')}. It's ideal for ${starter.ideal_for}.`;
    }
  }
  
  if (lowerMsg.includes('pricing') || lowerMsg.includes('cost') || lowerMsg.includes('price')) {
    return `We offer three plans:\n\n• Starter: $49/month ($470/year) - Best for freelancers\n• Growth: $199/month ($1,900/year) - Best for growing teams\n• Enterprise: $499/month ($4,790/year) - Best for large organizations\n\nWhich plan interests you?`;
  }
  
  return `I'd be happy to help you with our sales plans. We offer Starter, Growth, and Enterprise options. What would you like to know about them?`;
}

/**
 * Extract facts from a response
 */
function extractFacts(response) {
  const facts = [];
  
  const planPattern = /\b(Starter|Growth|Enterprise)\b/gi;
  const plans = response.match(planPattern);
  if (plans) {
    const uniquePlans = [...new Set(plans.map(p => p.toLowerCase()))];
    uniquePlans.forEach(plan => {
      facts.push(`User showed interest in ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`);
    });
  }
  
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
  
  return [...new Set(facts)];
}

/**
 * Run the sales agent
 */
async function runAgent(userId, userMessage, sessionId) {
  logger.info(`Running agent for user ${userId}`);
  
  const toolsCalled = [];
  let finalResponse = '';
  
  try {
    // Step 1: Get user memory
    logger.info('Step 1: Fetching user memory');
    let userMemory = { facts: [], recentContext: [] };
    try {
      userMemory = await TOOL_HANDLERS['get_user_memory']({ user_id: userId });
      toolsCalled.push('get_user_memory');
      logger.info(`Found ${userMemory.facts.length} facts`);
    } catch (error) {
      logger.warn('Failed to get user memory:', error.message);
    }
    
    // Step 2: Search catalog
    logger.info('Step 2: Searching catalog');
    let catalogResults = { products: catalog.products, addons: catalog.addons, faq: catalog.faq };
    try {
      catalogResults = await TOOL_HANDLERS['search_catalog']({ query: userMessage });
      toolsCalled.push('search_catalog');
      logger.info(`Catalog search returned ${catalogResults.products.length} products`);
    } catch (error) {
      logger.warn('Failed to search catalog:', error.message);
    }
    
    // Step 3: Build the prompt with context
    const memorySection = userMemory.facts.length > 0 
      ? `Known facts about this user:\n${userMemory.facts.map(f => `- ${f}`).join('\n')}\n\n`
      : '';
    
    const historySection = userMemory.recentContext.length > 0
      ? `Recent conversation:\n${userMemory.recentContext.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 100)}...`).join('\n')}\n\n`
      : '';
    
    const catalogSection = `Product Information:\n${JSON.stringify(catalogResults.products, null, 2)}\n\nFAQ:\n${JSON.stringify(catalogResults.faq, null, 2)}`;
    
    const fullPrompt = `${memorySection}${historySection}${catalogSection}\n\nUser asks: "${userMessage}"\n\nProvide a helpful, accurate response based on the product information above. Be concise and friendly.`;
    
    // Step 4: Call Groq API
    logger.info('Step 3: Calling Groq API');
    
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: fullPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7
      });
    } catch (groqError) {
      logger.error('Groq API call failed:', groqError.message);
      // Use fallback
      finalResponse = generateFallbackResponse(userMessage);
      logger.info('Used fallback response');
    }
    
    // Process successful response
    if (!finalResponse && completion) {
      logger.debug('Groq response structure:', JSON.stringify(Object.keys(completion)));
      
      if (completion.choices && Array.isArray(completion.choices) && completion.choices.length > 0) {
        const choice = completion.choices[0];
        if (choice.message && choice.message.content) {
          finalResponse = choice.message.content;
          logger.info('Successfully generated response from Groq');
        } else {
          logger.error('No content in message:', choice);
          finalResponse = generateFallbackResponse(userMessage);
        }
      } else {
        logger.error('Unexpected response structure:', JSON.stringify(completion));
        finalResponse = generateFallbackResponse(userMessage);
      }
    }
    
    // Step 5: Extract and save facts
    if (finalResponse) {
      const facts = extractFacts(finalResponse);
      for (const fact of facts) {
        try {
          await memoryStore.saveFact(userId, fact, sessionId);
          logger.debug(`Saved fact: ${fact}`);
        } catch (error) {
          logger.error('Failed to save fact:', error.message);
        }
      }
    }
    
    logger.info(`Agent completed. Tools: ${toolsCalled.join(', ') || 'none'}`);
    
    return {
      response: finalResponse || generateFallbackResponse(userMessage),
      toolsCalled,
      sessionId
    };
    
  } catch (error) {
    logger.error('Unexpected agent error:', error.message);
    logger.error('Stack:', error.stack);
    
    return {
      response: generateFallbackResponse(userMessage),
      toolsCalled,
      sessionId
    };
  }
}

module.exports = {
  runAgent,
  extractFacts
};
