/**
 * Tool Tests
 * Tests for searchCatalog, getUserMemory, and flagForHuman tools
 */

const { searchCatalog, SEARCH_CATALOG_DEF } = require('../src/tools/searchCatalog.tool');
const { getUserMemory, GET_USER_MEMORY_DEF } = require('../src/tools/getUserMemory.tool');
const { flagForHuman, FLAG_FOR_HUMAN_DEF } = require('../src/tools/flagForHuman.tool');

// Mock memory store
jest.mock('../src/memory', () => ({
  getFacts: jest.fn(),
  getRecentContext: jest.fn()
}));

const memoryStore = require('../src/memory');

describe('searchCatalog Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return all products for empty query', () => {
    const result = searchCatalog({ query: '' });
    
    expect(result.products).toHaveLength(3);
    expect(result.query).toBe('');
  });

  test('should search by plan name', () => {
    const result = searchCatalog({ query: 'Enterprise' });
    
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].name).toBe('Enterprise');
  });

  test('should search by features', () => {
    const result = searchCatalog({ query: 'SSO audit logs' });
    
    expect(result.products[0].name).toBe('Enterprise');
    expect(result.products[0].features).toContain('SSO');
    expect(result.products[0].features).toContain('audit logs');
  });

  test('should search by pricing', () => {
    const result = searchCatalog({ query: '$199 monthly' });
    
    const growthPlan = result.products.find(p => p.name === 'Growth');
    expect(growthPlan).toBeDefined();
    expect(growthPlan.price).toBe('$199/mo');
  });

  test('should return top 3 products sorted by relevance', () => {
    const result = searchCatalog({ query: 'unlimited users storage' });
    
    expect(result.products.length).toBeLessThanOrEqual(3);
  });

  test('should include matched FAQ items', () => {
    const result = searchCatalog({ query: 'free trial' });
    
    expect(result.faq.length).toBeGreaterThan(0);
    expect(result.faq[0].q.toLowerCase()).toContain('trial');
  });

  test('should filter out stopwords', () => {
    const result1 = searchCatalog({ query: 'the enterprise plan' });
    const result2 = searchCatalog({ query: 'enterprise plan' });
    
    // Should produce similar results despite "the" being a stopword
    expect(result1.products.length).toBeGreaterThan(0);
    expect(result2.products.length).toBeGreaterThan(0);
  });
});

describe('Tool Definitions', () => {
  test('SEARCH_CATALOG_DEF has correct structure', () => {
    expect(SEARCH_CATALOG_DEF.type).toBe('function');
    expect(SEARCH_CATALOG_DEF.function.name).toBe('search_catalog');
    expect(SEARCH_CATALOG_DEF.function.parameters.required).toContain('query');
  });

  test('GET_USER_MEMORY_DEF has correct structure', () => {
    expect(GET_USER_MEMORY_DEF.type).toBe('function');
    expect(GET_USER_MEMORY_DEF.function.name).toBe('get_user_memory');
    expect(GET_USER_MEMORY_DEF.function.parameters.required).toContain('user_id');
  });

  test('FLAG_FOR_HUMAN_DEF has correct structure', () => {
    expect(FLAG_FOR_HUMAN_DEF.type).toBe('function');
    expect(FLAG_FOR_HUMAN_DEF.function.name).toBe('flag_for_human');
    expect(FLAG_FOR_HUMAN_DEF.function.parameters.required).toContain('user_id');
    expect(FLAG_FOR_HUMAN_DEF.function.parameters.required).toContain('reason');
    expect(FLAG_FOR_HUMAN_DEF.function.parameters.required).toContain('confidence_score');
  });
});

describe('getUserMemory Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return user facts and context', async () => {
    const mockFacts = [
      { fact: 'Interested in Enterprise plan' },
      { fact: 'Team of 50 people' }
    ];
    const mockContext = [
      { role: 'user', content: 'Tell me about pricing' },
      { role: 'assistant', content: 'Here are our plans...' }
    ];

    memoryStore.getFacts.mockResolvedValue(mockFacts);
    memoryStore.getRecentContext.mockResolvedValue(mockContext);

    const result = await getUserMemory({ user_id: 'user_123' });

    expect(result.userId).toBe('user_123');
    expect(result.facts).toEqual(['Interested in Enterprise plan', 'Team of 50 people']);
    expect(result.recentContext).toHaveLength(2);
    expect(memoryStore.getFacts).toHaveBeenCalledWith('user_123');
    expect(memoryStore.getRecentContext).toHaveBeenCalledWith('user_123', 6);
  });

  test('should handle empty memory', async () => {
    memoryStore.getFacts.mockResolvedValue([]);
    memoryStore.getRecentContext.mockResolvedValue([]);

    const result = await getUserMemory({ user_id: 'new_user' });

    expect(result.userId).toBe('new_user');
    expect(result.facts).toEqual([]);
    expect(result.recentContext).toEqual([]);
  });
});

describe('flagForHuman Tool', () => {
  test('should create flag entry', async () => {
    const result = await flagForHuman({
      user_id: 'user_123',
      reason: 'Low confidence response',
      confidence_score: 0.45
    });

    expect(result.flagged).toBe(true);
    expect(result.ticketId).toBeDefined();
    expect(result.message).toContain('Escalated to human review');
    expect(result.message).toContain(result.ticketId);
  });
});
