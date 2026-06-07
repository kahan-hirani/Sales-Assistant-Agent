/**
 * IMemoryStore - Abstract Base Class
 * Defines the contract for all memory store implementations.
 * Any future backend (Redis, Mem0, Mongo) must extend this class.
 */

class IMemoryStore {
  /**
   * Save a conversation message/turn
   * @param {Object} params
   * @param {string} params.userId - The user ID
   * @param {string} params.sessionId - The session ID
   * @param {string} params.role - 'user' or 'assistant'
   * @param {string} params.content - The message content
   * @param {string[]} params.toolsCalled - Tools called during this turn
   * @returns {Promise<Object>} The saved message record
   */
  async saveMessage({ userId, sessionId, role, content, toolsCalled = [] }) {
    throw new Error('Not implemented');
  }

  /**
   * Get all conversation history for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} All conversation turns ordered by createdAt ASC
   */
  async getHistory(userId) {
    throw new Error('Not implemented');
  }

  /**
   * Get recent conversation context for a user
   * @param {string} userId - The user ID
   * @param {number} limit - Number of recent turns to retrieve
   * @returns {Promise<Array>} Recent conversation turns
   */
  async getRecentContext(userId, limit = 10) {
    throw new Error('Not implemented');
  }

  /**
   * Save an extracted memory fact about a user
   * @param {string} userId - The user ID
   * @param {string} fact - The extracted fact
   * @param {string} sourceSessionId - The session ID where this fact was extracted
   * @returns {Promise<Object>} The saved fact record
   */
  async saveFact(userId, fact, sourceSessionId) {
    throw new Error('Not implemented');
  }

  /**
   * Get all facts about a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} All facts for the user
   */
  async getFacts(userId) {
    throw new Error('Not implemented');
  }

  /**
   * Delete all memory for a user (GDPR compliance)
   * @param {string} userId - The user ID
   * @returns {Promise<void>}
   */
  async deleteUserMemory(userId) {
    throw new Error('Not implemented');
  }
}

module.exports = IMemoryStore;
