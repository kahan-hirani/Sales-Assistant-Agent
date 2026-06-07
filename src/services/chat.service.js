/**
 * Chat Service
 * Orchestrates agent → memory → eval → response
 */

const { v4: uuidv4 } = require('uuid');
const { runAgent } = require('../agents/salesAgent');
const { generateAndSaveEval } = require('./eval.service');
const memoryStore = require('../memory');
const { EvalLog } = require('../db/models');
const logger = require('../config/logger');

/**
 * Send a message and get AI response
 * @param {string} userId - User ID
 * @param {string} message - User message
 * @returns {Object} Response with eval and metadata
 */
async function sendMessage(userId, message) {
  logger.info(`Sending message for user ${userId}`);
  
  // Step 1: Generate fresh session ID
  const sessionId = uuidv4();
  
  // Step 2: Run agent first (don't save user message yet)
  // This ensures we don't have orphaned user messages if agent fails
  const { response, toolsCalled } = await runAgent(userId, message, sessionId);
  
  // Step 3: Now save both messages together (transaction-like)
  try {
    // Save user message
    await memoryStore.saveMessage({
      userId,
      sessionId,
      role: 'user',
      content: message,
      toolsCalled: []
    });
    
    // Save assistant response
    await memoryStore.saveMessage({
      userId,
      sessionId,
      role: 'assistant',
      content: response,
      toolsCalled
    });
  } catch (saveError) {
    logger.error('Failed to save conversation:', saveError.message);
    // Even if save fails, we still return the response to the user
    // But log the error for investigation
  }
  
  // Step 4: Generate and save evaluation
  const evalResult = await generateAndSaveEval({
    userId,
    sessionId,
    userMessage: message,
    agentResponse: response,
    toolsCalled
  });
  
  logger.info(`Message processed for user ${userId}, session ${sessionId}`);
  
  return {
    response,
    eval: evalResult,
    tools_called: toolsCalled,
    session_id: sessionId
  };
}

/**
 * Get conversation history for a user
 * @param {string} userId - User ID
 * @returns {Object} History data
 */
async function getHistory(userId) {
  logger.info(`Getting history for user ${userId}`);
  
  const turns = await memoryStore.getHistory(userId);
  
  return {
    user_id: userId,
    turns: turns.map(t => ({
      id: t.id,
      session_id: t.sessionId,
      role: t.role,
      content: t.content,
      tools_called: t.toolsCalled || [],
      created_at: t.createdAt
    })),
    total: turns.length
  };
}

/**
 * Delete all memory for a user (GDPR compliance)
 * @param {string} userId - User ID
 * @returns {Object} Success message
 */
async function deleteMemory(userId) {
  logger.info(`Deleting memory for user ${userId}`);
  
  // Delete conversations and memory facts
  await memoryStore.deleteUserMemory(userId);
  
  // Also delete eval logs
  await EvalLog.destroy({ where: { userId } });
  
  logger.info(`Memory wiped for user ${userId}`);
  
  return {
    success: true,
    message: `Memory wiped for user ${userId}`
  };
}

module.exports = {
  sendMessage,
  getHistory,
  deleteMemory
};
