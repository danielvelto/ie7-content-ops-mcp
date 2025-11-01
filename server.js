// ============================================
// IE7 CONTENT OPERATIONS MCP - MAIN SERVER
// ============================================
// Intelligent Notion MCP bridge for IE7 content operations
// Routes completed briefs to Notion databases with semantic intelligence

require('dotenv').config();
const express = require('express');
const MCPClient = require('./lib/mcp-client');
const TemplateFetcher = require('./lib/template-fetcher');
const SOPParser = require('./lib/sop-parser');
const SemanticPropertyMapper = require('./lib/semantic-mapper');
const SmartTemplateProcessor = require('./lib/smart-template-processor');
const BriefRouter = require('./lib/brief-router');
const IntelligentProcessor = require('./lib/intelligent-processor');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// INITIALIZE COMPONENTS
// ============================================

// WHY THIS WORKS: MCP client spawns Notion server as child process
const mcpClient = new MCPClient({
  command: 'npx',
  args: ['-y', '@notionhq/notion-mcp-server'],
  env: {
    NOTION_TOKEN: process.env.NOTION_TOKEN
  },
  maxRestarts: 5,
  restartDelay: 2000
});

// WHY THIS WORKS: Template caching reduces API calls by 90%+
const templateFetcher = new TemplateFetcher(mcpClient, {
  cacheTTL: parseInt(process.env.TEMPLATE_CACHE_TTL) || 900 // 15 minutes
});

const sopParser = new SOPParser();
const semanticMapper = new SemanticPropertyMapper();
const briefRouter = new BriefRouter();
const intelligentProcessor = new IntelligentProcessor(); // Phase 3: Meta-cognitive layer

// ============================================
// JOB QUEUE FOR CONCURRENT REQUEST PROCESSING
// ============================================
// WHY THIS WORKS: Prevents rate limit issues, controls resource usage
const requestQueue = [];
let currentlyProcessing = 0;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 3;

console.log(`✅ Request queue initialized (Max concurrent: ${MAX_CONCURRENT})`);

/**
 * Add request to queue and process if slots available
 */
function enqueueRequest(payload) {
  requestQueue.push(payload);
  console.log(`📥 Request queued (Queue size: ${requestQueue.length}, Processing: ${currentlyProcessing}/${MAX_CONCURRENT})`);
  processNextIfAvailable();
}

/**
 * Process next request from queue if under concurrency limit
 */
function processNextIfAvailable() {
  if (currentlyProcessing >= MAX_CONCURRENT) {
    console.log(`⏸️  Queue paused: ${currentlyProcessing} requests processing (max ${MAX_CONCURRENT})`);
    return;
  }
  
  if (requestQueue.length === 0) {
    if (currentlyProcessing === 0) {
      console.log('✅ Queue empty, all requests processed');
    }
    return;
  }
  
  currentlyProcessing++;
  const payload = requestQueue.shift();
  
  console.log(`🔄 Starting request (Processing: ${currentlyProcessing}/${MAX_CONCURRENT}, Queue: ${requestQueue.length})`);
  
  // Process asynchronously
  processRequestAsync(payload)
    .catch(err => console.error('❌ Request processing failed:', err))
    .finally(() => {
      currentlyProcessing--;
      console.log(`✅ Request slot freed (Processing: ${currentlyProcessing}/${MAX_CONCURRENT}, Queue: ${requestQueue.length})`);
      processNextIfAvailable(); // Process next in queue
    });
}

app.use(express.json());

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/health', (req, res) => {
  const cacheStats = templateFetcher.getCacheStats();
  
  res.json({
    status: mcpClient.isRunning() ? 'healthy' : 'degraded',
    service: 'IE7 Content Operations MCP',
    childPid: mcpClient.getProcessPid(),
    uptime: process.uptime(),
    templateCache: {
      cachedDatabases: cacheStats.keys.length,
      cacheHits: cacheStats.stats.hits,
      cacheMisses: cacheStats.stats.misses
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MAIN ENDPOINT: CREATE REQUEST FROM BRIEF
// ============================================

app.post('/create-request', async (req, res) => {
  // Quick validation and immediate response
  console.log('\n' + '='.repeat(80));
  console.log('📥 INCOMING WEBHOOK REQUEST');
  console.log('='.repeat(80));
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📊 Request body type:', typeof req.body);
  console.log('📊 Is array?', Array.isArray(req.body));
  console.log('📊 Body keys:', Object.keys(req.body || {}));
  console.log('📄 Full payload (first 500 chars):', JSON.stringify(req.body, null, 2).substring(0, 500));
  console.log('='.repeat(80));
  
  // Basic validation before accepting
  let payload = req.body;
  if (Array.isArray(payload) && payload.length > 0) {
    payload = payload[0];
  }
  
  const hasData = payload && (payload.body || payload.briefData || payload['Project Name'] || payload['Asset Type']);
  
  if (!hasData) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload: No brief data found'
    });
  }
  
  // RESPOND IMMEDIATELY - Don't make n8n wait!
  res.status(202).json({
    success: true,
    message: 'Request accepted and processing',
    timestamp: new Date().toISOString()
  });
  
  console.log('✅ Responded 202 to webhook, adding to queue...');
  
  // Add to queue (don't process directly)
  enqueueRequest(req.body);
});

/**
 * Async request processing function
 * WHY THIS WORKS: Processes after webhook response, calls error webhook only on failure
 */
async function processRequestAsync(originalPayload) {
  const startTime = Date.now();
  
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔄 ASYNC PROCESSING STARTED');
    console.log('='.repeat(80));
    
    // Step 0: Normalize n8n webhook format
    // WHY THIS WORKS: n8n sends array wrapper with body object
    let payload = originalPayload;
    
    // If n8n sends array, extract first element
    if (Array.isArray(payload) && payload.length > 0) {
      console.log('✅ Detected n8n array format, extracting first element');
      console.log('📊 Array length:', payload.length);
      payload = payload[0];
      console.log('📊 Extracted payload keys:', Object.keys(payload || {}));
    }
    
    console.log('🔍 Checking normalization conditions:');
    console.log('   - payload.body exists?', !!payload.body);
    console.log('   - payload.requestType exists?', !!payload.requestType);
    console.log('   - payload["Asset Type"] exists?', !!payload['Asset Type']);
    
    // CASE 1: n8n format with body wrapper (array was already extracted)
    if (payload.body && !payload.requestType) {
      console.log('✅ CASE 1: n8n format with body wrapper');
      
      console.log('📊 Body field keys:', Object.keys(payload.body || {}));
      console.log('📊 Body["Asset Type"]:', payload.body['Asset Type']);
      
      // Extract Asset Type from n8n body (case-insensitive)
      const assetType = payload.body['Asset Type'] || 
                        payload.body['asset_type'] || 
                        payload.body['assetType'] || 
                        'Content Request';
      
      console.log(`📋 Asset Type from brief: "${assetType}"`);
      
      const requestType = briefRouter.normalizeRequestType(assetType);
      console.log(`🔄 Normalized to: "${requestType}"`);
      
      payload = {
        requestType: requestType,
        briefData: payload.body
      };
      
      console.log('✅ Normalization complete (CASE 1)');
    }
    // CASE 2: n8n sending fields directly at root (no body wrapper)
    else if (!payload.requestType && (payload['Asset Type'] || payload['Project Name'])) {
      console.log('✅ CASE 2: n8n format with fields at root level');
      
      console.log('📊 Root level keys:', Object.keys(payload));
      console.log('📊 payload["Asset Type"]:', payload['Asset Type']);
      
      // Extract Asset Type from root level
      const assetType = payload['Asset Type'] || 
                        payload['asset_type'] || 
                        payload['assetType'] || 
                        'Content Request';
      
      console.log(`📋 Asset Type from brief: "${assetType}"`);
      
      const requestType = briefRouter.normalizeRequestType(assetType);
      console.log(`🔄 Normalized to: "${requestType}"`);
      
      // Entire payload IS the briefData
      const briefData = { ...payload };
      
      payload = {
        requestType: requestType,
        briefData: briefData
      };
      
      console.log('✅ Normalization complete (CASE 2)');
    } else {
      console.log('⚠️ Normalization NOT triggered');
      console.log('   Payload structure:', JSON.stringify(payload, null, 2).substring(0, 300));
    }
    
    console.log('📊 Final payload keys:', Object.keys(payload));
    
    const { requestType, briefData } = payload;
    
    // Step 1: Validate input
    if (!requestType) {
      return res.status(400).json({
        success: false,
        error: 'requestType is required',
        example: { requestType: 'content_request', briefData: {} },
        hint: 'If using n8n, data should be in body field'
      });
    }
    
    if (!briefData || typeof briefData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'briefData is required and must be an object'
      });
    }
    
    console.log(`\n📥 Incoming request: ${requestType}`);
    console.log(`📊 Brief data fields: ${Object.keys(briefData).join(', ')}`);
    
    // Step 2: Route to correct database
    // WHY THIS WORKS: Centralized routing logic
    let databaseInfo;
    try {
      databaseInfo = briefRouter.route(requestType);
    } catch (routingError) {
      return res.status(400).json({
        success: false,
        error: routingError.message,
        availableDatabases: briefRouter.getAvailableDatabases()
      });
    }
    
    console.log(`✅ Routed to: ${databaseInfo.databaseName}`);
    
    // Step 3: Fetch database schema
    // WHY THIS WORKS: Dynamic schema fetching adapts to changes
    console.log('📚 Fetching database schema...');
    const database = await mcpClient.callTool('API-retrieve-a-database', {
      database_id: databaseInfo.databaseId
    });
    
    const databaseSchema = {
      databaseId: databaseInfo.databaseId,
      title: database.title?.[0]?.plain_text || databaseInfo.databaseName,
      properties: database.properties || {}
    };
    
    console.log(`✅ Schema fetched: ${Object.keys(databaseSchema.properties).length} properties`);
    
    // Step 4: Quick template fetch for SOP parsing (for property mapping)
    // WHY THIS WORKS: Property mapper needs SOPs, but template will be re-fetched by processor
    console.log('📄 Fetching template for SOP parsing...');
    const template = await templateFetcher.fetchTemplate(databaseInfo.databaseId);
    
    // Step 5: Parse template and extract SOPs
    // WHY THIS WORKS: SOPs guide semantic property mapping
    console.log('🔍 Parsing template and SOPs...');
    const parsedTemplate = sopParser.parseTemplate(template.blocks);
    
    console.log(`✅ Template parsed: ${parsedTemplate.totalSections} sections, ${parsedTemplate.totalSOPs} SOPs`);
    
    // Step 6: Fetch workspace users for intelligent mapping
    // WHY THIS WORKS: Provides user context to LLM for people field resolution
    console.log('👥 Fetching workspace users...');
    let workspaceUsers = [];
    try {
      const usersResult = await mcpClient.callTool('API-get-users');
      workspaceUsers = usersResult.results || [];
      console.log(`✅ Fetched ${workspaceUsers.length} workspace users`);
    } catch (error) {
      console.warn(`⚠️ Could not fetch workspace users: ${error.message}`);
    }
    
    // Step 7: Semantic property mapping with full schema intelligence (LLM)
    // WHY THIS WORKS: LLM sees full schema including field types, constraints, select options, and available users
    // This makes it truly dynamic - adapts to any schema changes automatically
    console.log('🧠 Performing intelligent semantic property mapping...');
    
    const sopGuidelines = {
      defaultAssignee: {
        name: process.env.DEFAULT_ASSIGNEE_NAME || 'Daniel Fayomi',
        email: process.env.DEFAULT_ASSIGNEE_EMAIL || 'daniel@velto.co.uk'
      },
      decisionRules: [
        'Assignee field always populated with default assignee (system rule)',
        'Skip fields with "allocated", "assigned", "approval", "accept" in name (post-intake)',
        'Skip output fields like "Media Link", "Final Deliverable" (content not created yet)',
        'Populate user-provided data: name, contact, dates, platform, description, budget'
      ]
    };
    
    const mappingResult = await semanticMapper.mapProperties(
      briefData,
      databaseSchema,
      parsedTemplate,
      sopGuidelines,
      workspaceUsers
    );
    
    if (!mappingResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Semantic mapping failed',
        details: mappingResult.error
      });
    }
    
    console.log(`✅ Mapping complete: ${Object.keys(mappingResult.mapping.populate || {}).length} properties mapped`);
    
    // Step 8: Convert to Notion property format
    // WHY THIS WORKS: LLM outputs semantic values, converter handles Notion API format
    // Values are already validated against schema constraints by the LLM
    const notionProperties = semanticMapper.convertToNotionFormat(
      mappingResult.mapping,
      databaseSchema
    );
    
    console.log(`✅ Properties formatted for Notion API`);
    
    // Step 9: Create Notion page with validation & self-correction
    // WHY THIS WORKS: Retries with LLM corrections if validation fails
    console.log('📝 Creating Notion page...');
    
    let createdPage;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        createdPage = await mcpClient.callTool('API-post-page', {
          parent: { database_id: databaseInfo.databaseId },
          properties: notionProperties
        });
        
        // Check if successful
        if (createdPage && createdPage.id && createdPage.object !== 'error') {
          console.log(`✅ Page created: ${createdPage.url}`);
          break;
        }
        
        // If error response, try to self-correct
        if (createdPage && createdPage.object === 'error') {
          throw new Error(createdPage.message || 'Validation error');
        }
        
      } catch (error) {
        console.warn(`⚠️ Attempt ${retryCount + 1} failed: ${error.message}`);
        
        if (retryCount < maxRetries) {
          console.log('🔄 Attempting self-correction...');
          
          // Use LLM to fix the validation error
          try {
            const correctionPrompt = `A Notion API call failed with this error:
            
ERROR: ${error.message}

SCHEMA: ${JSON.stringify(databaseSchema.properties, null, 2)}

PROPERTIES WE TRIED: ${JSON.stringify(notionProperties, null, 2)}

Based on the error and schema, fix the properties to match Notion's requirements. Return corrected properties as JSON.`;

            const response = await semanticMapper.openai.chat.completions.create({
              model: 'o3-mini',
              messages: [
                { role: 'system', content: 'You are a Notion API expert. Fix validation errors by correcting property formats.' },
                { role: 'user', content: correctionPrompt }
              ],
              response_format: { type: 'json_object' },
              reasoning_effort: 'low',
              max_completion_tokens: 2000
            });
            
            notionProperties = JSON.parse(response.choices[0].message.content.trim());
            console.log('✅ Properties corrected via LLM');
            
          } catch (correctionError) {
            console.error('❌ Self-correction failed:', correctionError.message);
            break;
          }
        }
        
        retryCount++;
      }
    }
    
    // Final validation check
    if (!createdPage || !createdPage.id || createdPage.object === 'error') {
      const errorMsg = createdPage?.message || 'Unknown error creating page after retries';
      console.error('❌ Page creation failed after all attempts:', errorMsg);
      return res.status(500).json({
        success: false,
        error: 'Failed to create Notion page',
        details: errorMsg,
        attempts: retryCount + 1
      });
    }
    
    // Step 10: Intelligent Pre-Flight Analysis (Phase 3: Meta-Cognitive Layer)
    // WHY THIS WORKS: Smart backend checks, complexity re-classification, silent defaults
    console.log('🧠 Running intelligent pre-flight analysis...');
    
    // Extract complexity level from brief if provided
    const providedComplexity = briefData['Complexity Level'] || briefData['complexity_level'] || briefData['ComplexityLevel'] || null;
    
    if (providedComplexity) {
      console.log(`   Initial complexity: ${providedComplexity}`);
    } else {
      console.log('   No complexity level provided - will detect from content');
    }
    
    // Run intelligent analysis
    const analysis = await intelligentProcessor.analyze(briefData, providedComplexity);
    
    // Apply smart defaults to brief data (silent - no markers)
    const enhancedBriefData = { ...briefData, ...analysis.smartDefaults };
    
    // Use detected/corrected complexity
    const finalComplexity = analysis.useComplexity;
    
    // Step 11: Apply DCMS template with intelligent processing
    // WHY THIS WORKS: Uses corrected complexity, enhanced data with smart defaults
    console.log('📄 Applying DCMS template...');
    
    const smartProcessor = new SmartTemplateProcessor(mcpClient, templateFetcher);
    const templateBlocks = await smartProcessor.processTemplate(
      databaseInfo.databaseId,
      enhancedBriefData,
      finalComplexity,
      analysis.conflicts // Pass conflicts for natural language callouts
    );
    
    if (templateBlocks.length > 0) {
      try {
        // WHY THIS WORKS: API-patch-block-children adds blocks to page
        // Notion API limits: 100 blocks per request
        const BATCH_SIZE = 100;
        
        for (let i = 0; i < templateBlocks.length; i += BATCH_SIZE) {
          const batch = templateBlocks.slice(i, i + BATCH_SIZE);
          
          console.log(`📦 Adding blocks ${i + 1}-${Math.min(i + BATCH_SIZE, templateBlocks.length)} to page: ${createdPage.id}`);
          
        await mcpClient.callTool('API-patch-block-children', {
          block_id: createdPage.id,
            children: batch
          });
          
          console.log(`✅ Added blocks ${i + 1}-${Math.min(i + BATCH_SIZE, templateBlocks.length)} of ${templateBlocks.length}`);
        }
        
        console.log(`✅ Template applied: ${templateBlocks.length} blocks added`);
      } catch (blockError) {
        console.warn('⚠️ Failed to add template blocks:', blockError.message);
        // Don't fail the whole request if block creation fails
      }
    }
    
    // Step 11: Return success response
    console.log('✅ Request created successfully');
    
    res.json({
        success: true,
        message: 'Request created successfully in Notion',
        notionPageUrl: createdPage.url,
        notionPageId: createdPage.id,
      databaseUsed: databaseInfo.databaseName,
      propertiesMapped: {
        populated: Object.keys(mappingResult.mapping.populate || {}),
        skipped: Object.keys(mappingResult.mapping.skip || {}),
        uncertain: Object.keys(mappingResult.mapping.uncertain || {})
      },
      templateApplied: {
        sectionsCreated: parsedTemplate.totalSections,
        blocksAdded: templateBlocks.length,
        sopsApplied: parsedTemplate.totalSOPs
      },
      reasoning: mappingResult.mapping.metadata
    });
    
    // SUCCESS - Log completion
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Async processing completed successfully in ${duration}s`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Async processing failed:', error);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ Processing failed after ${duration}s`);
    console.log('='.repeat(80));
    
    // Call error webhook if configured
    const errorWebhookUrl = process.env.ERROR_WEBHOOK_URL;
    
    if (errorWebhookUrl) {
      console.log('🚨 Sending error notification to webhook...');
      
      try {
        const axios = require('axios');
        
        await axios.post(errorWebhookUrl, {
          success: false,
          error: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
          processingDuration: duration + 's',
          originalPayload: originalPayload,
          briefData: payload?.briefData || null,
          requestType: payload?.requestType || null
        }, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ Error webhook called successfully');
      } catch (webhookError) {
        console.error('❌ Failed to call error webhook:', webhookError.message);
      }
    } else {
      console.log('⚠️ No ERROR_WEBHOOK_URL configured, skipping error notification');
    }
  }
}


// ============================================
// CACHE MANAGEMENT ENDPOINTS
// ============================================

app.post('/clear-cache', (req, res) => {
  const { databaseId } = req.body;
  
  try {
    templateFetcher.clearCache(databaseId);
    const stats = templateFetcher.getCacheStats();
    
    res.json({
      success: true,
      message: databaseId ? 'Database template cache cleared' : 'All template cache cleared',
      cacheStats: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/cache-stats', (req, res) => {
  const stats = templateFetcher.getCacheStats();
  
  res.json({
    success: true,
    cacheStats: stats
  });
});

// ============================================
// UTILITY ENDPOINTS
// ============================================

app.get('/databases', (req, res) => {
  const databases = briefRouter.getAvailableDatabases();
  
  res.json({
    success: true,
    databases,
    totalConfigured: databases.filter(db => db.configured).length,
    totalAvailable: databases.length
  });
});

app.get('/api/notion/tools', async (req, res) => {
  try {
    const tools = await mcpClient.listTools();
    res.json({ success: true, tools });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  await mcpClient.cleanup();
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, async () => {
  console.log(`✅ IE7 Content Operations MCP listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    // Connect MCP client
    await mcpClient.connect();
    console.log('✅ MCP client connected successfully');
    
    // Validate required databases
    briefRouter.validateConfiguration(['content_request']);
    console.log('✅ Database configuration validated');
    
    console.log('');
    console.log('🚀 Server ready! Available endpoints:');
    console.log('   POST /create-request       - Main endpoint: create Notion page from brief');
    console.log('   POST /clear-cache          - Clear template cache');
    console.log('   GET  /cache-stats          - Get cache statistics');
    console.log('   GET  /databases            - List configured databases');
    console.log('   GET  /health               - Health check');
    console.log('   GET  /api/notion/tools     - List available Notion MCP tools');
    console.log('');
    console.log('📚 Documentation: See README.md');
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check NOTION_TOKEN is set in .env');
    console.error('   2. Verify integration has access to databases');
    console.error('   3. Ensure CONTENT_REQUEST_DB_ID is configured');
    console.error('   4. Run: npx @notionhq/notion-mcp-server (test connection)');
    process.exit(1);
  }
});
