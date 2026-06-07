/**
 * Memory Summarizer Service
 * Automatically compresses old conversation history into concise summaries
 * 
 * WHY THIS IS USEFUL:
 * - After 20+ messages, the context becomes bloated with old details
 * - LLM token limits and costs increase with full history
 * - Old conversations lose relevance over time
 * - Summaries retain key facts (interests, decisions, objections) without noise
 * 
 * STRATEGY:
 * - Trigger after every 20 messages
 * - Compress oldest 15 messages into 1 summary
 * - Delete the 15 detailed messages
 * - Keep recent 5 messages in full detail for immediate context
 * - Save summary as MemoryFact for long-term retention
 * 
 * TIMELINE:
 * Day 1-3: Full detail preserved (first 20 messages)
 * Day 4+: Automatic compression of old conversations
 * Result: After months, you have summaries + recent context, not thousands of messages
 */

const { Groq } = require('groq-sdk');
const config = require('../config/env');
const memoryStore = require('../memory');
const logger = require('../config/logger');

const groq = new Groq({ apiKey: config.groqApiKey });

const SUMMARY_THRESHOLD = 20; // Trigger after 20 messages
const MESSAGES_TO_KEEP = 5; // Keep last 5 messages in detail
const MESSAGES_TO_SUMMARIZE = 15; // Compress oldest 15 into 1 summary

const SUMMARY_PROMPT = `You are a conversation summarizer for a sales AI assistant.

TASK: Summarize the following conversation history into 2-3 concise sentences.
Focus on:
1. What plans/products the user showed interest in
2. Key features they asked about
3. Any decisions, objections, or preferences expressed
4. Important context for future conversations

RULES:
- Be specific (mention plan names like "Enterprise", "Growth", etc.)
- Include pricing discussions if mentioned
- Note any timeline or purchase intent
- Keep it under 100 words
- Write in third person about "the user"

CONVERSATION HISTORY TO SUMMARIZE:`;

/**
 * Check if summarization is needed and perform it
 * @param {string} userId - User ID
 * @param {string} sessionId - Current session ID (for source tracking)
 * @returns {Promise<Object>} Summary result
 */
async function summarizeOldMemory(userId, sessionId) {
  logger.info(`Checking if memory summarization needed for user ${userId}`);
  
  try {
    // Get all conversation history
    const history = await memoryStore.getHistory(userId);
    
    // Check if we have enough messages to warrant summarization
    if (history.length < SUMMARY_THRESHOLD) {
      logger.debug(`Only ${history.length} messages, no summarization needed yet`);
      return {
        summarized: false,
        reason: `Only ${history.length} messages (threshold: ${SUMMARY_THRESHOLD})`,
        messagesKept: history.length,
        messagesCompressed: 0
      };
    }
    
    // Identify messages to summarize (oldest ones, excluding most recent 5)
    const messagesToSummarize = history.slice(0, -MESSAGES_TO_KEEP);
    const messagesToKeep = history.slice(-MESSAGES_TO_KEEP);
    
    logger.info(`Will summarize ${messagesToSummarize.length} messages, keeping ${messagesToKeep.length} recent`);
    
    // Format conversation for LLM
    const conversationText = messagesToSummarize
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`)
      .join('\n\n');
    
    // Generate summary using LLM
    logger.info('Calling LLM to generate summary');
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: conversationText }
      ],
      max_tokens: 200,
      temperature: 0.3 // Low temperature for consistent, factual summaries
    });
    
    const summary = completion.choices[0]?.message?.content?.trim();
    
    if (!summary) {
      throw new Error('LLM returned empty summary');
    }
    
    logger.info(`Generated summary: ${summary.substring(0, 100)}...`);
    
    // Save summary as MemoryFact
    const summaryFact = `Past conversation summary: ${summary}`;
    await memoryStore.saveFact(userId, summaryFact, sessionId);
    logger.info('Saved summary as MemoryFact');
    
    // Delete the old detailed messages to save space
    // Note: We keep MemoryFacts but delete raw conversation turns
    const messageIdsToDelete = messagesToSummarize.map(msg => msg.id);
    
    // Use the sequelize model directly to delete specific messages
    const { Conversation } = require('../db/models');
    await Conversation.destroy({
      where: {
        id: messageIdsToDelete
      }
    });
    
    logger.info(`Deleted ${messageIdsToDelete.length} old detailed messages`);
    
    return {
      summarized: true,
      summary: summary,
      messagesCompressed: messagesToSummarize.length,
      messagesKept: messagesToKeep.length,
      deletedMessageIds: messageIdsToDelete,
      summaryFact: summaryFact
    };
    
  } catch (error) {
    logger.error('Memory summarization failed:', error.message);
    
    // Fail silently - don't break the chat flow
    return {
      summarized: false,
      reason: 'Error during summarization',
      error: error.message
    };
  }
}

/**
 * Force summarization regardless of threshold
 * Useful for manual triggering via API
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Summary result
 */
async function forceSummarize(userId) {
  logger.info(`Force summarization triggered for user ${userId}`);
  
  const history = await memoryStore.getHistory(userId);
  
  if (history.length === 0) {
    return {
      summarized: false,
      reason: 'No conversation history to summarize'
    };
  }
  
  if (history.length <= MESSAGES_TO_KEEP) {
    return {
      summarized: false,
      reason: `Only ${history.length} messages, not enough to summarize (minimum: ${MESSAGES_TO_KEEP + 1})`
    };
  }
  
  // Temporarily lower threshold
  const tempThreshold = MESSAGES_TO_KEEP + 1;
  
  // We'll use a fake session ID since this is manual
  const { v4: uuidv4 } = require('uuid');
  const sessionId = uuidv4();
  
  // Call main summarization logic
  return await summarizeOldMemory(userId, sessionId);
}

/**
 * Get summarization status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Status information
 */
async function getSummarizationStatus(userId) {
  try {
    const history = await memoryStore.getHistory(userId);
    const facts = await memoryStore.getFacts(userId);
    
    // Count existing summaries
    const summaryFacts = facts.filter(f => 
      f.fact.includes('Past conversation summary:')
    );
    
    return {
      userId,
      totalMessages: history.length,
      threshold: SUMMARY_THRESHOLD,
      messagesUntilSummarization: Math.max(0, SUMMARY_THRESHOLD - history.length),
      willSummarize: history.length >= SUMMARY_THRESHOLD,
      existingSummaries: summaryFacts.length,
      recentSummaries: summaryFacts.slice(-3).map(s => ({
        summary: s.fact.replace('Past conversation summary: ', ''),
        createdAt: s.createdAt
      }))
    };
    
  } catch (error) {
    logger.error('Failed to get summarization status:', error.message);
    throw error;
  }
}

module.exports = {
  summarizeOldMemory,
  forceSummarize,
  getSummarizationStatus,
  SUMMARY_THRESHOLD,
  MESSAGES_TO_KEEP,
  MESSAGES_TO_SUMMARIZE
};
