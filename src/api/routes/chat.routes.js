/**
 * Chat Routes
 * Handles chat interactions, history, and memory management
 */

const express = require('express');
const router = express.Router();
const chatService = require('../../services/chat.service');
const evalService = require('../../services/eval.service');
const { validate, schemas } = require('../middlewares/validate');
const logger = require('../../config/logger');

/**
 * POST /chat/:userId
 * Send a message and get AI response
 */
router.post('/chat/:userId', validate(schemas.chatMessage), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;
    
    logger.info(`Chat request received for user ${userId}`);
    
    const result = await chatService.sendMessage(userId, message);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /chat/:userId/history
 * Get conversation history for a user
 */
router.get('/chat/:userId/history', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    logger.info(`History request received for user ${userId}`);
    
    const result = await chatService.getHistory(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /chat/:userId/memory
 * Delete all memory for a user (GDPR compliance)
 */
router.delete('/chat/:userId/memory', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    logger.info(`Delete memory request received for user ${userId}`);
    
    const result = await chatService.deleteMemory(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /chat/:userId/evals
 * Get evaluation summary for a user (Bonus endpoint)
 */
router.get('/chat/:userId/evals', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    logger.info(`Eval summary request received for user ${userId}`);
    
    const result = await evalService.getEvalSummary(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
