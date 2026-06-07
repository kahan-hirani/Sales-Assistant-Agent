/**
 * getUserMemory Tool
 * Retrieves user conversation history and extracted facts from memory
 */

const memoryStore = require('../memory');

/**
 * Get user's memory (facts and recent context)
 * @param {Object} params
 * @param {string} params.user_id - The user ID to look up
 * @returns {Object} User memory data
 */
async function getUserMemory({ user_id }) {
  // Get facts about the user
  const facts = await memoryStore.getFacts(user_id);
  
  // Get recent conversation context (last 6 turns)
  const recentContext = await memoryStore.getRecentContext(user_id, 6);
  
  return {
    facts: facts.map(f => f.fact),
    recentContext: recentContext.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    userId: user_id
  };
}

/**
 * Groq Tool Definition for get_user_memory
 * Compatible with Groq function calling API
 */
const GET_USER_MEMORY_DEF = {
  type: 'function',
  function: {
    name: 'get_user_memory',
    description: 'Retrieves what this user has previously discussed and any known facts about them. Always call this tool at the very start of every conversation to check conversation history.',
    parameters: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The unique user ID identifier to look up memory for'
        }
      },
      required: ['user_id']
    }
  }
};

module.exports = {
  getUserMemory,
  GET_USER_MEMORY_DEF
};
