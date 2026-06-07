const { runEvaluation } = require('../agents/evalLogic');
const { EvalLog } = require('../db/models');
const { flagForHuman } = require('../tools/flagForHuman.tool');
const { catalog } = require('../tools/searchCatalog.tool');
const memoryStore = require('../memory');
const logger = require('../config/logger');

/**
 * Generate evaluation and save to database
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.sessionId - Session ID
 * @param {string} params.userMessage - Original user message
 * @param {string} params.agentResponse - Agent's response
 * @param {string[]} params.toolsCalled - Tools called during the interaction
 * @returns {Object} Evaluation result
 */
async function generateAndSaveEval({ userId, sessionId, userMessage, agentResponse, toolsCalled }) {
  logger.info(`Generating evaluation for session ${sessionId}`);
  
  try {
    // Get user memory for context
    const facts = await memoryStore.getFacts(userId);
    
    // Run evaluation
    const evalResult = await runEvaluation({
      userMessage,
      agentResponse,
      catalogContext: catalog,
      userMemory: { facts: facts.map(f => f.fact) }
    });
    
    // Save to EvalLog
    await EvalLog.create({
      userId,
      sessionId,
      groundedness: evalResult.groundedness,
      relevance: evalResult.relevance,
      confidence: evalResult.confidence,
      flagged: evalResult.flagged,
      reasoning: evalResult.reasoning,
      toolsCalled
    });
    
    logger.info(`Evaluation saved for session ${sessionId}`, {
      confidence: evalResult.confidence,
      flagged: evalResult.flagged
    });
    
    // If flagged, escalate to human
    if (evalResult.flagged) {
      logger.warn(`Response flagged for human review: ${evalResult.reasoning}`);
      await flagForHuman({
        user_id: userId,
        reason: `Low quality response: ${evalResult.reasoning}`,
        confidence_score: evalResult.confidence
      });
    }
    
    return evalResult;
    
  } catch (error) {
    logger.error('Failed to generate/save evaluation:', error.message);
    
    // Create fallback eval and save it
    const fallbackEval = {
      groundedness: 0.5,
      relevance: 0.5,
      confidence: 0.5,
      flagged: true,
      reasoning: `Evaluation service error: ${error.message}`
    };
    
    await EvalLog.create({
      userId,
      sessionId,
      ...fallbackEval,
      toolsCalled
    });
    
    return fallbackEval;
  }
}

/**
 * Get evaluation summary for a user
 * @param {string} userId - User ID
 * @returns {Object} Summary statistics and raw evals
 */
async function getEvalSummary(userId) {
  logger.info(`Getting eval summary for user ${userId}`);
  
  try {
    const evals = await EvalLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      raw: true
    });
    
    if (evals.length === 0) {
      return {
        summary: {
          totalResponses: 0,
          avgConfidence: 0,
          avgGroundedness: 0,
          avgRelevance: 0,
          flaggedCount: 0,
          flaggedPercentage: 0
        },
        evals: []
      };
    }
    
    const totalResponses = evals.length;
    const flaggedCount = evals.filter(e => e.flagged).length;
    
    const summary = {
      totalResponses,
      avgConfidence: evals.reduce((sum, e) => sum + e.confidence, 0) / totalResponses,
      avgGroundedness: evals.reduce((sum, e) => sum + e.groundedness, 0) / totalResponses,
      avgRelevance: evals.reduce((sum, e) => sum + e.relevance, 0) / totalResponses,
      flaggedCount,
      flaggedPercentage: (flaggedCount / totalResponses) * 100
    };
    
    return {
      summary,
      evals: evals.map(e => ({
        id: e.id,
        sessionId: e.sessionId,
        groundedness: e.groundedness,
        relevance: e.relevance,
        confidence: e.confidence,
        flagged: e.flagged,
        reasoning: e.reasoning,
        toolsCalled: e.toolsCalled,
        createdAt: e.createdAt
      }))
    };
    
  } catch (error) {
    logger.error('Failed to get eval summary:', error.message);
    throw error;
  }
}

module.exports = {
  generateAndSaveEval,
  getEvalSummary
};
