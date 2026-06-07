const express = require('express');
const router = express.Router();
const evalService = require('../../services/eval.service');
const logger = require('../../config/logger');

/**
 * GET /evals/:userId
 * Get detailed evaluation summary for a user
 */
router.get('/evals/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    logger.info(`Detailed evals request received for user ${userId}`);
    
    const result = await evalService.getEvalSummary(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /evals/global/stats
 * Get global evaluation statistics across all users
 */
router.get('/evals/global/stats', async (req, res, next) => {
  try {
    logger.info('Global eval stats request received');
    
    const { EvalLog } = require('../../db/models');
    const { Sequelize } = require('sequelize');
    
    const stats = await EvalLog.findAll({
      attributes: [
        [Sequelize.fn('AVG', Sequelize.col('confidence')), 'avgConfidence'],
        [Sequelize.fn('AVG', Sequelize.col('groundedness')), 'avgGroundedness'],
        [Sequelize.fn('AVG', Sequelize.col('relevance')), 'avgRelevance'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalEvals'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN flagged = true THEN 1 ELSE 0 END')), 'flaggedCount']
      ],
      raw: true
    });
    
    const result = stats[0];
    const totalEvals = parseInt(result.totalEvals, 10) || 0;
    const flaggedCount = parseInt(result.flaggedCount, 10) || 0;
    
    res.json({
      success: true,
      data: {
        summary: {
          totalEvals,
          avgConfidence: parseFloat(result.avgConfidence) || 0,
          avgGroundedness: parseFloat(result.avgGroundedness) || 0,
          avgRelevance: parseFloat(result.avgRelevance) || 0,
          flaggedCount,
          flaggedPercentage: totalEvals > 0 ? (flaggedCount / totalEvals) * 100 : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
