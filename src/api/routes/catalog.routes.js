const express = require('express');
const router = express.Router();
const { catalog } = require('../../tools/searchCatalog.tool');
const logger = require('../../config/logger');

/**
 * GET /catalog
 * Return catalog.json contents
 */
router.get('/catalog', (req, res) => {
  logger.info('Catalog request received');
  
  res.json({
    success: true,
    data: catalog
  });
});

module.exports = router;
