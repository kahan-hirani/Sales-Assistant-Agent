/**
 * SequelizeMemoryStore
 * PostgreSQL implementation of IMemoryStore using Sequelize ORM
 */

const IMemoryStore = require('./IMemoryStore');
const { Conversation, MemoryFact } = require('../db/models');
const logger = require('../config/logger');

class SequelizeMemoryStore extends IMemoryStore {
  /**
   * Save a conversation message/turn
   */
  async saveMessage({ userId, sessionId, role, content, toolsCalled = [] }) {
    try {
      const message = await Conversation.create({
        userId,
        sessionId,
        role,
        content,
        toolsCalled
      });
      logger.debug(`Saved ${role} message for user ${userId}`);
      return message;
    } catch (error) {
      logger.error('Failed to save message:', error.message);
      throw error;
    }
  }

  /**
   * Get all conversation history for a user across all sessions
   */
  async getHistory(userId) {
    try {
      const messages = await Conversation.findAll({
        where: { userId },
        order: [['createdAt', 'ASC']],
        raw: true
      });
      return messages.map(msg => ({
        id: msg.id,
        userId: msg.userId,
        sessionId: msg.sessionId,
        role: msg.role,
        content: msg.content,
        toolsCalled: msg.toolsCalled || [],
        createdAt: msg.createdAt
      }));
    } catch (error) {
      logger.error('Failed to get history:', error.message);
      throw error;
    }
  }

  /**
   * Get recent conversation context for a user
   * Returns last N turns, ordered by createdAt DESC then reversed for chronological order
   */
  async getRecentContext(userId, limit = 10) {
    try {
      const messages = await Conversation.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        raw: true
      });
      
      // Reverse to get chronological order
      return messages.reverse().map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } catch (error) {
      logger.error('Failed to get recent context:', error.message);
      throw error;
    }
  }

  /**
   * Save an extracted memory fact about a user
   */
  async saveFact(userId, fact, sourceSessionId) {
    try {
      const savedFact = await MemoryFact.create({
        userId,
        fact,
        sourceSessionId
      });
      logger.debug(`Saved fact for user ${userId}: ${fact.substring(0, 50)}...`);
      return savedFact;
    } catch (error) {
      logger.error('Failed to save fact:', error.message);
      throw error;
    }
  }

  /**
   * Get all facts about a user
   */
  async getFacts(userId) {
    try {
      const facts = await MemoryFact.findAll({
        where: { userId },
        order: [['createdAt', 'ASC']],
        raw: true
      });
      return facts.map(f => ({
        id: f.id,
        fact: f.fact,
        sourceSessionId: f.sourceSessionId,
        createdAt: f.createdAt
      }));
    } catch (error) {
      logger.error('Failed to get facts:', error.message);
      throw error;
    }
  }

  /**
   * Delete all memory for a user (GDPR compliance)
   * Deletes all Conversations and MemoryFacts for the user
   */
  async deleteUserMemory(userId) {
    try {
      await Promise.all([
        Conversation.destroy({ where: { userId } }),
        MemoryFact.destroy({ where: { userId } })
      ]);
      logger.info(`Deleted all memory for user ${userId}`);
    } catch (error) {
      logger.error('Failed to delete user memory:', error.message);
      throw error;
    }
  }
}

module.exports = SequelizeMemoryStore;
