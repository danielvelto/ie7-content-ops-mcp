// ============================================
// IE7 TEMPLATE FETCHER
// ============================================
// Fetches DCMS_TEMPLATE reference pages from Notion with 15-minute caching
// WHY THIS WORKS: Templates live in Notion, not code - team can update without deployment

const NodeCache = require('node-cache');

class TemplateFetcher {
  constructor(mcpClient, options = {}) {
    this.mcpClient = mcpClient;
    
    // WHY THIS WORKS (Caching Pattern):
    // TTL = Time To Live - how long cached data stays valid
    // 15 minutes (900 seconds) balances freshness vs. performance
    // checkperiod = how often to check for expired items (120s = 2 minutes)
    this.cache = new NodeCache({
      stdTTL: options.cacheTTL || 900, // Default: 15 minutes
      checkperiod: 120, // Check for expired items every 2 minutes
      useClones: false // Don't clone objects (performance optimization)
    });
    
    console.log(`✅ Template cache initialized with TTL: ${this.cache.options.stdTTL}s`);
  }

  /**
   * Fetch DCMS_TEMPLATE reference page for a specific database
   * WHY THIS WORKS: Queries central templates database by Template Type + optional Complexity Level
   * 
   * @param {string} databaseId - Notion database ID
   * @param {string} templateType - Template type to fetch (e.g., 'Content Request', 'Publishing')
   * @param {string} complexityLevel - Optional: 'Cup of Tea', 'Pizza', or '3-Course Meal'
   * @returns {Promise<object>} Template structure with blocks and metadata
   */
  async fetchTemplate(databaseId, templateType = null, complexityLevel = null) {
    const cacheKey = complexityLevel 
      ? `template_${databaseId}_${complexityLevel.replace(/\s+/g, '_')}`
      : `template_${databaseId}`;
    
    // Step 1: Check cache first
    // WHY THIS WORKS: Reduces Notion API calls from ~240/hour to ~16/hour per database
    const cachedTemplate = this.cache.get(cacheKey);
    if (cachedTemplate) {
      console.log(`✅ Template cache HIT for database: ${databaseId.substring(0, 8)}...`);
      return cachedTemplate;
    }
    
    console.log(`⚠️ Template cache MISS for database: ${databaseId.substring(0, 8)}... Fetching from Notion...`);
    
    try {
      // Step 2: Query central templates database
      // WHY THIS WORKS: Templates stored centrally, queried by type AND complexity
      const templatesDbId = process.env.TEMPLATES_DATABASE_ID;
      
      if (!templatesDbId) {
        throw new Error(
          `TEMPLATES_DATABASE_ID not configured in .env. ` +
          `Create a DCMS Templates Database and add its ID to .env`
        );
      }
      
      // Step 3: Determine template type based on database
      // WHY THIS WORKS: Maps database IDs to template types
      if (!templateType) {
        templateType = this.getTemplateTypeForDatabase(databaseId);
      }
      
      const queryDescription = complexityLevel 
        ? `type: "${templateType}" + complexity: "${complexityLevel}"`
        : `type: "${templateType}"`;
      
      console.log(`🔍 Querying templates database for ${queryDescription}`);
      
      // Step 4: Build query filter
      // WHY THIS WORKS: Filter by Template Type (required) + Complexity Level (optional)
      const filterConditions = [
        {
          property: 'Template Type',
          select: { equals: templateType }
        }
      ];
      
      if (complexityLevel) {
        filterConditions.push({
          property: 'Complexity Level',
          select: { equals: complexityLevel }
        });
      }
      
      filterConditions.push({
        property: 'Status',
        select: { equals: 'Active' }
      });
      
      // Step 5: Query for matching template
      let templatePage = null;
      const templateQuery = await this.mcpClient.callTool('API-post-database-query', {
        database_id: templatesDbId,
        filter: {
          and: filterConditions
        },
        page_size: 1
      });
      
      if (!templateQuery.results || templateQuery.results.length === 0) {
        // Try without Status filter (in case Status property doesn't exist)
        console.warn(`⚠️ No active template found, trying without Status filter...`);
        
        const fallbackConditions = filterConditions.filter(c => c.property !== 'Status');
        
        const fallbackQuery = await this.mcpClient.callTool('API-post-database-query', {
          database_id: templatesDbId,
          filter: fallbackConditions.length > 1 
            ? { and: fallbackConditions }
            : fallbackConditions[0],
          page_size: 1
        });
        
        if (!fallbackQuery.results || fallbackQuery.results.length === 0) {
          throw new Error(
            `Template not found for ${queryDescription}. ` +
            `Create a record in DCMS Templates Database with these properties.`
          );
        }
        
        templatePage = fallbackQuery.results[0];
      } else {
        templatePage = templateQuery.results[0];
      }
      
      console.log(`✅ Found template: ${templatePage.id}`)
      
      // Step 5: Fetch the template page's block structure
      // WHY THIS WORKS: Database records ARE pages - fetch their content blocks
      const blocks = await this.mcpClient.callTool('API-get-block-children', {
        block_id: templatePage.id,
        page_size: 100 // Most templates won't exceed 100 blocks
      });
      
      // Step 6: If template has more than 100 blocks, fetch remaining pages
      // WHY THIS WORKS: Notion API paginates large responses
      let allBlocks = blocks.results || [];
      let hasMore = blocks.has_more;
      let nextCursor = blocks.next_cursor;
      
      while (hasMore) {
        const nextPage = await this.mcpClient.callTool('API-get-block-children', {
          block_id: templatePage.id,
          page_size: 100,
          start_cursor: nextCursor
        });
        
        allBlocks = allBlocks.concat(nextPage.results || []);
        hasMore = nextPage.has_more;
        nextCursor = nextPage.next_cursor;
      }
      
      console.log(`✅ Fetched ${allBlocks.length} blocks from template "${templateType}"${complexityLevel ? ` (${complexityLevel})` : ''}`);
      
      // Step 7: Build template object
      // WHY THIS WORKS: Metadata helps processor understand what template it's working with
      const template = {
        pageId: templatePage.id,
        pageUrl: templatePage.url,
        templateType: templateType,
        complexityLevel: complexityLevel || null,
        databaseId: databaseId,
        blocks: allBlocks,
        fetchedAt: new Date().toISOString(),
        blockCount: allBlocks.length,
        properties: templatePage.properties || {} // Include page properties for complexity level extraction
      };
      
      // Step 8: Cache the template
      // WHY THIS WORKS: Next 15 minutes of requests will use cached version
      this.cache.set(cacheKey, template);
      console.log(`✅ Template cached for ${this.cache.options.stdTTL}s`);
      
      return template;
      
    } catch (error) {
      console.error(`❌ Failed to fetch DCMS_TEMPLATE for database ${databaseId}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch ALL complexity level templates for a given Template Type
   * WHY THIS WORKS: Allows processor to understand all three styles (Cup of Tea, Pizza, 3-Course Meal)
   * 
   * @param {string} databaseId - Notion database ID
   * @param {string} templateType - Template type to fetch (e.g., 'Content Request')
   * @returns {Promise<object>} Object with templates for each complexity level
   */
  async fetchAllComplexityTemplates(databaseId, templateType = null) {
    console.log('🔍 Fetching all complexity level templates for intelligent comparison...');
    
    if (!templateType) {
      templateType = this.getTemplateTypeForDatabase(databaseId);
    }
    
    const complexityLevels = ['Cup of Tea', 'Pizza', '3-Course Meal'];
    const templates = {};
    
    for (const level of complexityLevels) {
      try {
        const template = await this.fetchTemplate(databaseId, templateType, level);
        templates[level] = template;
        console.log(`✅ Fetched "${level}" template`);
      } catch (error) {
        console.warn(`⚠️ Could not fetch "${level}" template: ${error.message}`);
        templates[level] = null;
      }
    }
    
    const fetchedCount = Object.values(templates).filter(t => t !== null).length;
    console.log(`✅ Fetched ${fetchedCount} of 3 complexity templates`);
    
    return templates;
  }

  /**
   * Clear template cache (manual cache bust)
   * WHY THIS WORKS: Allows immediate propagation of template updates
   * Used by /clear-cache endpoint
   */
  clearCache(databaseId = null) {
    if (databaseId) {
      // Clear specific database template
      const cacheKey = `template_${databaseId}`;
      this.cache.del(cacheKey);
      console.log(`✅ Cleared template cache for database: ${databaseId.substring(0, 8)}...`);
    } else {
      // Clear all templates
      const keys = this.cache.keys();
      this.cache.flushAll();
      console.log(`✅ Cleared all template cache (${keys.length} templates)`);
    }
  }

  /**
   * Get cache statistics
   * WHY THIS WORKS: Monitoring - helps you understand cache performance
   */
  getCacheStats() {
    return {
      keys: this.cache.keys(),
      stats: this.cache.getStats()
    };
  }

  /**
   * Check if template is cached
   * WHY THIS WORKS: Useful for debugging and monitoring
   */
  isCached(databaseId) {
    const cacheKey = `template_${databaseId}`;
    return this.cache.has(cacheKey);
  }

  /**
   * Map database ID to template type
   * WHY THIS WORKS: Each database has a corresponding template type
   */
  getTemplateTypeForDatabase(databaseId) {
    // Remove dashes from database ID for comparison
    const normalizedId = databaseId.replace(/-/g, '');
    
    // Map database IDs to template types
    const CONTENT_REQUEST_ID = (process.env.CONTENT_REQUEST_DB_ID || '').replace(/-/g, '');
    const PUBLISHING_REQUEST_ID = (process.env.PUBLISHING_REQUEST_DB_ID || '').replace(/-/g, '');
    const GENERAL_INQUIRY_ID = (process.env.GENERAL_INQUIRY_DB_ID || '').replace(/-/g, '');
    
    if (normalizedId === CONTENT_REQUEST_ID || normalizedId === GENERAL_INQUIRY_ID) {
      return 'Content Request';
    }
    
    if (normalizedId === PUBLISHING_REQUEST_ID) {
      return 'Publishing';
    }
    
    // Default fallback
    return 'Content Request';
  }
}

module.exports = TemplateFetcher;

