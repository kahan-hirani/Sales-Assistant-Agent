/**
 * searchCatalog Tool
 * Keyword search over the product catalog
 */

const fs = require('fs');
const path = require('path');

// Load catalog once at module initialization
const catalogPath = path.join(__dirname, '../config/catalog.json');
let catalog;

try {
  const catalogData = fs.readFileSync(catalogPath, 'utf8');
  catalog = JSON.parse(catalogData);
} catch (error) {
  throw new Error(`Failed to load catalog.json: ${error.message}`);
}

// Common stopwords to filter out
const STOPWORDS = new Set([
  'the', 'is', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'among', 'what', 'does',
  'do', 'can', 'will', 'would', 'should', 'could', 'how', 'when', 'where',
  'why', 'who', 'which', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'their'
]);

/**
 * Tokenize query into lowercase words, removing stopwords
 * @param {string} query - The search query
 * @returns {string[]} Array of tokens
 */
function tokenize(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * Calculate score for a product based on token matches
 * @param {Object} product - Product object
 * @param {Set} tokens - Query tokens
 * @returns {number} Match score
 */
function scoreProduct(product, tokens) {
  let score = 0;
  const textFields = [
    product.name || '',
    product.ideal_for || ''
  ];
  
  // Add features array to text fields
  if (product.features) {
    textFields.push(...product.features);
  }
  
  // Check price fields
  const priceText = `${product.price || ''} ${product.annual_price || ''}`;
  textFields.push(priceText);
  
  for (const field of textFields) {
    const fieldTokens = tokenize(field);
    for (const token of tokens) {
      for (const fieldToken of fieldTokens) {
        if (fieldToken.includes(token) || token.includes(fieldToken)) {
          score++;
        }
      }
    }
  }
  
  return score;
}

/**
 * Search the catalog for products, addons, and FAQs matching the query
 * @param {Object} params
 * @param {string} params.query - The search query
 * @returns {Object} Search results
 */
function searchCatalog({ query }) {
  const tokens = new Set(tokenize(query));
  
  if (tokens.size === 0) {
    return {
      products: catalog.products,
      addons: catalog.addons,
      faq: catalog.faq,
      query
    };
  }
  
  // Score and sort products
  const scoredProducts = catalog.products.map(product => ({
    product,
    score: scoreProduct(product, tokens)
  }));
  
  scoredProducts.sort((a, b) => b.score - a.score);
  const topProducts = scoredProducts.slice(0, 3).filter(p => p.score > 0).map(p => p.product);
  
  // Score addons
  const scoredAddons = catalog.addons.map(addon => ({
    addon,
    score: scoreProduct(addon, tokens)
  }));
  scoredAddons.sort((a, b) => b.score - a.score);
  const topAddons = scoredAddons.filter(a => a.score > 0).slice(0, 2).map(a => a.addon);
  
  // Score FAQ
  const scoredFaq = catalog.faq.map(item => ({
    item,
    qScore: scoreProduct({ name: item.q, ideal_for: '' }, tokens),
    aScore: scoreProduct({ name: '', ideal_for: item.a }, tokens)
  }));
  scoredFaq.sort((a, b) => (b.qScore + b.aScore) - (a.qScore + a.aScore));
  const topFaq = scoredFaq.filter(f => f.qScore > 0 || f.aScore > 0).slice(0, 2).map(f => f.item);
  
  // If no specific results, return full catalog as fallback
  const results = {
    products: topProducts.length > 0 ? topProducts : catalog.products,
    addons: topAddons.length > 0 ? topAddons : [],
    faq: topFaq.length > 0 ? topFaq : catalog.faq,
    query
  };
  
  return results;
}

/**
 * Groq Tool Definition for search_catalog
 * Compatible with Groq function calling API
 */
const SEARCH_CATALOG_DEF = {
  type: 'function',
  function: {
    name: 'search_catalog',
    description: 'Search the product catalog for pricing, features, and plan information. You MUST call this tool before answering ANY question about products, pricing, features, or plans. Extract keywords from the user question and pass them as the query parameter.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords extracted from the user question. Include relevant terms like plan names, features, or pricing. Example: "enterprise pricing sso" or "growth plan features"'
        }
      },
      required: ['query']
    }
  }
};

module.exports = {
  searchCatalog,
  SEARCH_CATALOG_DEF,
  catalog
};
