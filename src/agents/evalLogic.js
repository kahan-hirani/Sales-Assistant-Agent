const { Groq } = require('groq-sdk');
const config = require('../config/env');
const logger = require('../config/logger');

const groq = new Groq({ apiKey: config.groqApiKey });

const EVAL_SYSTEM_PROMPT = `You are a strict quality evaluator for a sales AI assistant.
Evaluate the response below and return ONLY a valid JSON object — no markdown, no explanation, no code fences.

JSON format:
{
  "groundedness": <number 0.0-1.0, did response use actual catalog data?>,
  "relevance": <number 0.0-1.0, did it answer what was asked?>,
  "confidence": <number 0.0-1.0, overall quality and accuracy>,
  "flagged": <boolean, true if confidence < 0.70 or groundedness < 0.60>,
  "reasoning": "<one sentence explaining the scores>"
}

Scoring guidelines:
- Groundedness: Check if claims match catalog data. Penalize hallucinations heavily.
- Relevance: Did it directly address the user's question?
- Confidence: Overall trustworthiness considering tone, specificity, and completeness.`;

/**
 * Run evaluation on an agent response
 * @param {Object} params
 * @param {string} params.userMessage - Original user question
 * @param {string} params.agentResponse - Agent's response
 * @param {Object} params.catalogContext - Catalog data available
 * @param {Object} params.userMemory - User's memory context
 * @returns {Object} Evaluation scores
 */
async function runEvaluation({ userMessage, agentResponse, catalogContext, userMemory }) {
  logger.debug('Running evaluation');
  
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: EVAL_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `USER QUESTION: ${userMessage}

CATALOG DATA AVAILABLE: ${JSON.stringify(catalogContext, null, 2)}

AGENT RESPONSE: ${agentResponse}

Evaluate this response now. Return only valid JSON.`
        }
      ],
      max_tokens: 300,
      temperature: 0.1
    });
    
    const evalContent = completion.choices[0].message.content.trim();
    logger.debug(`Raw eval response: ${evalContent.substring(0, 200)}...`);
    
    // Parse the JSON response
    let evalResult;
    try {
      // Try to extract JSON if wrapped in code fences
      const jsonMatch = evalContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : evalContent;
      evalResult = JSON.parse(jsonStr);
    } catch (parseError) {
      logger.error('Failed to parse eval JSON:', parseError.message);
      return createFallbackEval('Eval parse failed');
    }
    
    // Validate the eval result
    const validated = validateEvalResult(evalResult);
    return validated;
    
  } catch (error) {
    logger.error('Evaluation failed:', error.message);
    return createFallbackEval('Eval API call failed');
  }
}

/**
 * Validate evaluation result structure and values
 * @param {Object} result - Raw eval result
 * @returns {Object} Validated result
 */
function validateEvalResult(result) {
  const validated = {
    groundedness: clamp(parseFloat(result.groundedness) || 0.5, 0, 1),
    relevance: clamp(parseFloat(result.relevance) || 0.5, 0, 1),
    confidence: clamp(parseFloat(result.confidence) || 0.5, 0, 1),
    flagged: Boolean(result.flagged),
    reasoning: String(result.reasoning || 'No reasoning provided')
  };
  
  // Auto-flag based on thresholds if not already flagged
  if (!validated.flagged) {
    if (validated.confidence < 0.70 || validated.groundedness < 0.60) {
      validated.flagged = true;
    }
  }
  
  return validated;
}

/**
 * Create fallback eval object when parsing fails
 * @param {string} reason - Reason for fallback
 * @returns {Object} Fallback eval
 */
function createFallbackEval(reason) {
  return {
    groundedness: 0.5,
    relevance: 0.5,
    confidence: 0.5,
    flagged: true,
    reasoning: `Eval parse failed: ${reason}`
  };
}

/**
 * Clamp a number between min and max
 * @param {number} val - Value to clamp
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {number} Clamped value
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

module.exports = {
  runEvaluation,
  validateEvalResult,
  createFallbackEval
};
