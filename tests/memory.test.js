/**
 * Memory Store Tests
 * Tests for IMemoryStore abstraction and Sequelize implementation
 */

const IMemoryStore = require('../src/memory/IMemoryStore');
const SequelizeMemoryStore = require('../src/memory/sequelizeMemory');

// Mock the models
jest.mock('../src/db/models', () => ({
  Conversation: {
    create: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn()
  },
  MemoryFact: {
    create: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn()
  }
}));

const { Conversation, MemoryFact } = require('../src/db/models');

describe('IMemoryStore Interface', () => {
  let store;

  beforeEach(() => {
    store = new IMemoryStore();
  });

  test('saveMessage should throw Not implemented', async () => {
    await expect(store.saveMessage({})).rejects.toThrow('Not implemented');
  });

  test('getHistory should throw Not implemented', async () => {
    await expect(store.getHistory('user_123')).rejects.toThrow('Not implemented');
  });

  test('getRecentContext should throw Not implemented', async () => {
    await expect(store.getRecentContext('user_123')).rejects.toThrow('Not implemented');
  });

  test('saveFact should throw Not implemented', async () => {
    await expect(store.saveFact('user_123', 'fact', 'session_1')).rejects.toThrow('Not implemented');
  });

  test('getFacts should throw Not implemented', async () => {
    await expect(store.getFacts('user_123')).rejects.toThrow('Not implemented');
  });

  test('deleteUserMemory should throw Not implemented', async () => {
    await expect(store.deleteUserMemory('user_123')).rejects.toThrow('Not implemented');
  });
});

describe('SequelizeMemoryStore', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new SequelizeMemoryStore();
  });

  describe('saveMessage', () => {
    test('should create conversation record', async () => {
      const mockRecord = { id: 'uuid-1', role: 'user' };
      Conversation.create.mockResolvedValue(mockRecord);

      const result = await store.saveMessage({
        userId: 'user_123',
        sessionId: 'session_1',
        role: 'user',
        content: 'Hello',
        toolsCalled: []
      });

      expect(Conversation.create).toHaveBeenCalledWith({
        userId: 'user_123',
        sessionId: 'session_1',
        role: 'user',
        content: 'Hello',
        toolsCalled: []
      });
      expect(result).toEqual(mockRecord);
    });
  });

  describe('getHistory', () => {
    test('should return all messages for user ordered by createdAt', async () => {
      const mockMessages = [
        { id: '1', userId: 'user_123', role: 'user', content: 'Hi', toolsCalled: [], createdAt: '2024-01-01' },
        { id: '2', userId: 'user_123', role: 'assistant', content: 'Hello', toolsCalled: ['tool1'], createdAt: '2024-01-02' }
      ];
      Conversation.findAll.mockResolvedValue(mockMessages);

      const result = await store.getHistory('user_123');

      expect(Conversation.findAll).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        order: [['createdAt', 'ASC']],
        raw: true
      });
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    test('should handle null toolsCalled', async () => {
      const mockMessages = [
        { id: '1', userId: 'user_123', role: 'user', content: 'Hi', toolsCalled: null, createdAt: '2024-01-01' }
      ];
      Conversation.findAll.mockResolvedValue(mockMessages);

      const result = await store.getHistory('user_123');

      expect(result[0].toolsCalled).toEqual([]);
    });
  });

  describe('getRecentContext', () => {
    test('should return recent messages in chronological order', async () => {
      const mockMessages = [
        { role: 'assistant', content: 'Last response' },
        { role: 'user', content: 'Last question' }
      ];
      Conversation.findAll.mockResolvedValue(mockMessages);

      const result = await store.getRecentContext('user_123', 2);

      expect(Conversation.findAll).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        order: [['createdAt', 'DESC']],
        limit: 2,
        raw: true
      });
      expect(result).toHaveLength(2);
      // Should be reversed to chronological order
      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('user');
    });
  });

  describe('saveFact', () => {
    test('should create memory fact', async () => {
      const mockFact = { id: 'fact-1', userId: 'user_123', fact: 'Likes Enterprise' };
      MemoryFact.create.mockResolvedValue(mockFact);

      const result = await store.saveFact('user_123', 'Likes Enterprise', 'session_1');

      expect(MemoryFact.create).toHaveBeenCalledWith({
        userId: 'user_123',
        fact: 'Likes Enterprise',
        sourceSessionId: 'session_1'
      });
      expect(result).toEqual(mockFact);
    });
  });

  describe('getFacts', () => {
    test('should return all facts for user', async () => {
      const mockFacts = [
        { id: '1', userId: 'user_123', fact: 'Fact 1', sourceSessionId: 's1', createdAt: '2024-01-01' },
        { id: '2', userId: 'user_123', fact: 'Fact 2', sourceSessionId: 's2', createdAt: '2024-01-02' }
      ];
      MemoryFact.findAll.mockResolvedValue(mockFacts);

      const result = await store.getFacts('user_123');

      expect(MemoryFact.findAll).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        order: [['createdAt', 'ASC']],
        raw: true
      });
      expect(result).toHaveLength(2);
      expect(result[0].fact).toBe('Fact 1');
    });
  });

  describe('deleteUserMemory', () => {
    test('should delete all conversations and facts for user', async () => {
      Conversation.destroy.mockResolvedValue(5);
      MemoryFact.destroy.mockResolvedValue(3);

      await store.deleteUserMemory('user_123');

      expect(Conversation.destroy).toHaveBeenCalledWith({ where: { userId: 'user_123' } });
      expect(MemoryFact.destroy).toHaveBeenCalledWith({ where: { userId: 'user_123' } });
    });
  });
});
