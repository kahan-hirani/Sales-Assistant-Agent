/**
 * Swagger Path Definitions
 * Detailed API endpoint documentation
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health Check
 *     description: |
 *       Check API health status and database connectivity.
 *       Returns system status, timestamp, version, and database connection state.
 *     tags: [🚀 Getting Started]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               success: true
 *               data:
 *                 status: ok
 *                 timestamp: "2024-01-15T10:35:00.000Z"
 *                 version: "1.0.0"
 *                 db: connected
 *                 environment: development
 *       503:
 *         description: Service degraded (database disconnected)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ErrorResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: degraded
 *                         db:
 *                           type: string
 *                           example: disconnected
 */

/**
 * @swagger
 * /catalog:
 *   get:
 *     summary: Get Product Catalog
 *     description: |
 *       Retrieve the complete product catalog including all plans, addons, and FAQ.
 *       This data is used by the AI agent to answer pricing and feature questions.
 *     tags: [📚 Catalog]
 *     responses:
 *       200:
 *         description: Catalog retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Catalog'
 *             example:
 *               success: true
 *               data:
 *                 products:
 *                   - name: "Enterprise"
 *                     price: "$499/mo"
 *                     annual_price: "$4,790/yr"
 *                     features:
 *                       - "unlimited users"
 *                       - "SSO"
 *                       - "audit logs"
 *                     ideal_for: "Large organizations"
 *                 addons:
 *                   - name: "Extra Storage"
 *                     price: "$10/mo per 10GB"
 *                 faq:
 *                   - q: "Is there a free trial?"
 *                     a: "Yes, 14-day free trial"
 */

/**
 * @swagger
 * /chat/{userId}:
 *   post:
 *     summary: Send Chat Message
 *     description: |
 *       Send a message to the AI sales agent and receive a response.
 *       
 *       The agent will:
 *       1. Retrieve the user's conversation history
 *       2. Search the product catalog for relevant information
 *       3. Generate a personalized response
 *       4. Self-evaluate the response quality
 *       
 *       **Note**: The userId can be any unique string. Use the same userId to maintain
 *       conversation continuity across sessions.
 *     tags: [💬 Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique user identifier (can be any string)
 *         example: demo_user_123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatMessageRequest'
 *           examples:
 *             enterprise_pricing:
 *               summary: Ask about Enterprise pricing
 *               value:
 *                 message: "What does the Enterprise plan cost and what features does it include?"
 *             plan_comparison:
 *               summary: Compare plans
 *               value:
 *                 message: "What's the difference between Starter and Growth plans?"
 *             follow_up:
 *               summary: Follow-up question (tests memory)
 *               value:
 *                 message: "Does the plan we talked about include SSO?"
 *     responses:
 *       200:
 *         description: Message processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ChatMessageResponse'
 *             example:
 *               success: true
 *               data:
 *                 response: "The Enterprise plan costs $499/month ($4,790/year) and includes unlimited users, SSO, audit logs, SLA 99.9%, dedicated support, unlimited storage, and custom contracts."
 *                 eval:
 *                   groundedness: 0.95
 *                   relevance: 0.98
 *                   confidence: 0.96
 *                   flagged: false
 *                   reasoning: "Response accurately cited all Enterprise plan details from catalog"
 *                 tools_called:
 *                   - "get_user_memory"
 *                   - "search_catalog"
 *                 session_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *       400:
 *         description: Validation error (empty message or too long)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 message: "Validation failed"
 *                 code: "VALIDATION_ERROR"
 *                 details:
 *                   - field: "message"
 *                     message: "Message cannot be empty"
 */

/**
 * @swagger
 * /chat/{userId}/history:
 *   get:
 *     summary: Get Conversation History
 *     description: |
 *       Retrieve all conversation turns for a specific user across all sessions.
 *       Returns messages in chronological order (oldest first).
 *     tags: [💬 Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *         example: demo_user_123
 *     responses:
 *       200:
 *         description: History retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ConversationHistoryResponse'
 *             example:
 *               success: true
 *               data:
 *                 user_id: "demo_user_123"
 *                 turns:
 *                   - id: "uuid-1"
 *                     session_id: "session-1"
 *                     role: "user"
 *                     content: "What is Enterprise pricing?"
 *                     tools_called: []
 *                     created_at: "2024-01-15T10:30:00.000Z"
 *                   - id: "uuid-2"
 *                     session_id: "session-1"
 *                     role: "assistant"
 *                     content: "Enterprise is $499/month..."
 *                     tools_called: ["get_user_memory", "search_catalog"]
 *                     created_at: "2024-01-15T10:30:02.000Z"
 *                 total: 2
 */

/**
 * @swagger
 * /chat/{userId}/evals:
 *   get:
 *     summary: Get User Evaluation Summary
 *     description: |
 *       Retrieve quality evaluation statistics and detailed scores for a specific user.
 *       Includes average scores, flagged count, and individual evaluation records.
 *     tags: [📊 Analytics]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *         example: demo_user_123
 *     responses:
 *       200:
 *         description: Evaluation data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           $ref: '#/components/schemas/EvalSummary'
 *                         evals:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/EvalLogEntry'
 *             example:
 *               success: true
 *               data:
 *                 summary:
 *                   totalResponses: 5
 *                   avgConfidence: 0.92
 *                   avgGroundedness: 0.91
 *                   avgRelevance: 0.94
 *                   flaggedCount: 0
 *                   flaggedPercentage: 0
 *                 evals:
 *                   - id: "eval-uuid"
 *                     sessionId: "session-1"
 *                     groundedness: 0.95
 *                     relevance: 0.98
 *                     confidence: 0.96
 *                     flagged: false
 *                     reasoning: "Accurate response"
 *                     toolsCalled: ["search_catalog"]
 *                     createdAt: "2024-01-15T10:30:03.000Z"
 */

/**
 * @swagger
 * /chat/{userId}/memory:
 *   delete:
 *     summary: Delete User Memory (GDPR)
 *     description: |
 *       **⚠️ WARNING: This action is irreversible!**
 *       
 *       Delete all data associated with a user including:
 *       - All conversation history
 *       - All extracted memory facts
 *       - All evaluation logs
 *       
 *       This endpoint supports GDPR compliance and user data deletion requests.
 *     tags: [💬 Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier whose data should be deleted
 *         example: demo_user_123
 *     responses:
 *       200:
 *         description: Memory deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         success:
 *                           type: boolean
 *                         message:
 *                           type: string
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *                 message: "Memory wiped for user demo_user_123"
 */

/**
 * @swagger
 * /evals/global/stats:
 *   get:
 *     summary: Get Global Evaluation Statistics
 *     description: |
 *       Retrieve aggregated evaluation statistics across all users.
 *       Useful for monitoring overall system quality and performance.
 *     tags: [📊 Analytics]
 *     responses:
 *       200:
 *         description: Global statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: object
 *                           properties:
 *                             totalEvals:
 *                               type: integer
 *                             avgConfidence:
 *                               type: number
 *                             avgGroundedness:
 *                               type: number
 *                             avgRelevance:
 *                               type: number
 *                             flaggedCount:
 *                               type: integer
 *                             flaggedPercentage:
 *                               type: number
 *             example:
 *               success: true
 *               data:
 *                 summary:
 *                   totalEvals: 100
 *                   avgConfidence: 0.91
 *                   avgGroundedness: 0.89
 *                   avgRelevance: 0.93
 *                   flaggedCount: 5
 *                   flaggedPercentage: 5
 */

// Export empty object - this file is for JSDoc annotations only
module.exports = {};
