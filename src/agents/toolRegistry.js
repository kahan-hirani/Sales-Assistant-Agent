/**
 * Tool Registry
 * Maps tool names to handler functions and Groq tool definitions
 * Keeps salesAgent.js clean by centralizing tool imports
 */

const { searchCatalog, SEARCH_CATALOG_DEF } = require('../tools/searchCatalog.tool');
const { getUserMemory, GET_USER_MEMORY_DEF } = require('../tools/getUserMemory.tool');
const { flagForHuman, FLAG_FOR_HUMAN_DEF } = require('../tools/flagForHuman.tool');

/**
 * Tool Definitions for Groq API
 * Array of tool schema objects passed to the API call
 */
const TOOL_DEFINITIONS = [
  SEARCH_CATALOG_DEF,
  GET_USER_MEMORY_DEF,
  FLAG_FOR_HUMAN_DEF
];

/**
 * Tool Handlers
 * Plain object mapping tool name to async function
 */
const TOOL_HANDLERS = {
  'search_catalog': searchCatalog,
  'get_user_memory': getUserMemory,
  'flag_for_human': flagForHuman
};

module.exports = {
  TOOL_DEFINITIONS,
  TOOL_HANDLERS
};
