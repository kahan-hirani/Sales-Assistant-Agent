/**
 * Chat Service Tests
 * Tests for chat.service.js business logic
 */

const chatService = require('../src/services/chat.service');
const { runAgent } = require('../src/agents/salesAgent');
const { generateAndSaveEval } = require('../src/services/eval.service');
const memoryStore = require('../src/memory');
const { EvalLog } = require('../src/db/models');

// Mock dependencies
jest.mock('../src/agents/salesAgent', () => ({
  runAgent: jest.fn()
}));

jest.mock('../src/services/eval.service', () => ({
  generateAndSaveEval: jest.fn()
}));

jest.mock('../src/memory', () => ({
  saveMessage: jest.fn(),
  getHistory: jest.fn(),
  deleteUserMemory: jest.fn()
}));

jest.mock('../src/db/models', () => ({
  EvalLog: {
    destroy: jest.fn()
  }
}));

describe('Chat Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    test('should orchestrate full message flow', async () => {
      // Setup mocks
      const mockAgentResponse = {
        response: 'Here is our Enterprise pricing...',
        toolsCalled: ['get_user_memory', 'search_catalog'],
        sessionId: 'test-session-123'
      };
      
      const mockEvalResult = {
        groundedness: 0.95,
        relevance: 0.98,
        confidence: 0.96,
        flagged: false,
        reasoning: 'Good response'
      };

      memoryStore.saveMessage.mockResolvedValue({ id: 'msg-1' });
      runAgent.mockResolvedValue(mockAgentResponse);
      generateAndSaveEval.mockResolvedValue(mockEvalResult);

      // Execute
      const result = await chatService.sendMessage('user_123', 'What is Enterprise pricing?');

      // Verify flow
      expect(memoryStore.saveMessage).toHaveBeenNthCalledWith(1, {
        userId: 'user_123',
        sessionId: expect.any(String),
        role: 'user',
        content: 'What is Enterprise pricing?',
        toolsCalled: []
      });

      expect(runAgent).toHaveBeenCalledWith(
        'user_123',
        'What is Enterprise pricing?',
        expect.any(String)
      );

      expect(memoryStore.saveMessage).toHaveBeenNthCalledWith(2, {
        userId: 'user_123',
        sessionId: expect.any(String),
        role: 'assistant',
        content: 'Here is our Enterprise pricing...',
        toolsCalled: ['get_user_memory', 'search_catalog']
      });

      expect(generateAndSaveEval).toHaveBeenCalledWith({
        userId: 'user_123',
        sessionId: expect.any(String),
        userMessage: 'What is Enterprise pricing?',
        agentResponse: 'Here is our Enterprise pricing...',
        toolsCalled: ['get_user_memory', 'search_catalog']
      });

      // Verify response structure
      expect(result).toEqual({
        response: 'Here is our Enterprise pricing...',
        eval: mockEvalResult,
        tools_called: ['get_user_memory', 'search_catalog'],
        session_id: expect.any(String)
      });
    });

    test('should generate unique session IDs per call', async () => {
      memoryStore.saveMessage.mockResolvedValue({});
      runAgent.mockResolvedValue({
        response: 'Test',
        toolsCalled: [],
        sessionId: 'session-1'
      });
      generateAndSaveEval.mockResolvedValue({
        groundedness: 0.8,
        relevance: 0.8,
        confidence: 0.8,
        flagged: false,
        reasoning: 'OK'
      });

      const result1 = await chatService.sendMessage('user_123', 'Hello');
      const result2 = await chatService.sendMessage('user_123', 'Hi');

      expect(result1.session_id).not.toBe(result2.session_id);
    });
  });

  describe('getHistory', () => {
    test('should return formatted conversation history', async () => {
      const mockHistory = [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'user',
          content: 'Hello',
          toolsCalled: [],
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          id: 'msg-2',
          sessionId: 'session-1',
          role: 'assistant',
          content: 'Hi there!',
          toolsCalled: ['search_catalog'],
          createdAt: '2024-01-01T10:00:05Z'
        }
      ];

      memoryStore.getHistory.mockResolvedValue(mockHistory);

      const result = await chatService.getHistory('user_123');

      expect(result).toEqual({
        user_id: 'user_123',
        turns: [
          {
            id: 'msg-1',
            session_id: 'session-1',
            role: 'user',
            content: 'Hello',
            tools_called: [],
            created_at: '2024-01-01T10:00:00Z'
          },
          {
            id: 'msg-2',
            session_id: 'session-1',
            role: 'assistant',
            content: 'Hi there!',
            tools_called: ['search_catalog'],
            created_at: '2024-01-01T10:00:05Z'
          }
        ],
        total: 2
      });
    });

    test('should handle empty history', async () => {
      memoryStore.getHistory.mockResolvedValue([]);

      const result = await chatService.getHistory('new_user');

      expect(result.turns).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('deleteMemory', () => {
    test('should delete all user data including evals', async () => {
      memoryStore.deleteUserMemory.mockResolvedValue();
      EvalLog.destroy.mockResolvedValue(5);

      const result = await chatService.deleteMemory('user_123');

      expect(memoryStore.deleteUserMemory).toHaveBeenCalledWith('user_123');
      expect(EvalLog.destroy).toHaveBeenCalledWith({ where: { userId: 'user_123' } });
      expect(result).toEqual({
        success: true,
        message: 'Memory wiped for user user_123'
      });
    });
  });
});
