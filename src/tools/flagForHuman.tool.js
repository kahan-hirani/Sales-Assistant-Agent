/**
 * flagForHuman Tool
 * Escalates conversation to human review
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { EvalLog } = require('../db/models');

/**
 * Flag conversation for human review
 * @param {Object} params
 * @param {string} params.user_id - The user ID
 * @param {string} params.reason - Reason for escalation
 * @param {number} params.confidence_score - Confidence score (0-1)
 * @returns {Object} Escalation result
 */
async function flagForHuman({ user_id, reason, confidence_score }) {
  const ticketId = uuidv4();
  
  // Log to winston
  logger.warn('FLAGGED_FOR_HUMAN', {
    userId: user_id,
    reason,
    confidenceScore: confidence_score,
    ticketId
  });
  
  // Write to EvalLog
  await EvalLog.create({
    userId: user_id,
    sessionId: 'flagged-' + ticketId,
    groundedness: 0,
    relevance: 0,
    confidence: confidence_score,
    flagged: true,
    reasoning: reason,
    toolsCalled: ['flag_for_human']
  });
  
  return {
    flagged: true,
    ticketId,
    message: `Escalated to human review. Ticket: ${ticketId}`
  };
}

/**
 * Groq Tool Definition for flag_for_human
 */
const FLAG_FOR_HUMAN_DEF = {
  type: 'function',
  function: {
    name: 'flag_for_human',
    description: 'Escalate this conversation to a human reviewer when you are unsure or confidence is low.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The user ID to flag'
        },
        reason: {
          type: 'string',
          description: 'Reason for escalation'
        },
        confidence_score: {
          type: 'number',
          description: 'Confidence score between 0 and 1'
        }
      },
      required: ['user_id', 'reason', 'confidence_score']
    }
  }
};

module.exports = {
  flagForHuman,
  FLAG_FOR_HUMAN_DEF
};
