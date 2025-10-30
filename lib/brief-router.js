// ============================================
// IE7 BRIEF ROUTER
// ============================================
// Routes completed briefs to appropriate Notion databases
// WHY THIS WORKS: Centralizes database routing logic - easy to add new databases

class BriefRouter {
  constructor() {
    // WHY THIS WORKS: Database mapping from env vars
    // Adding new databases = add env var + mapping entry
    this.databaseMap = {
      'content_request': {
        id: process.env.CONTENT_REQUEST_DB_ID,
        name: 'Content Request',
        description: 'Primary intake for content briefs (videos, social posts, etc.)'
      },
      'publishing_request': {
        id: process.env.PUBLISHING_REQUEST_DB_ID,
        name: 'Publishing Request',
        description: 'Requests for publishing/posting existing content'
      },
      'general_inquiry': {
        id: process.env.GENERAL_INQUIRY_DB_ID,
        name: 'General Inquiries',
        description: 'Questions, support requests, non-content inquiries'
      },
      'photoshoot': {
        id: process.env.PHOTOSHOOT_DB_ID,
        name: 'Photoshoot Request',
        description: 'Photography and photoshoot requests'
      },
      'event_request': {
        id: process.env.EVENT_REQUEST_DB_ID,
        name: 'Event Request',
        description: 'Event coverage and production requests'
      }
    };
  }

  /**
   * Route brief to appropriate database
   * WHY THIS WORKS: Simple lookup by request type
   * 
   * @param {string} requestType - Type from n8n (e.g., 'content_request')
   * @returns {object} Database info { id, name, description }
   */
  route(requestType) {
    console.log(`🧭 Routing request type: ${requestType}`);
    
    // Normalize request type (handle case variations, spaces, etc.)
    const normalizedType = this.normalizeRequestType(requestType);
    
    // Look up database
    const database = this.databaseMap[normalizedType];
    
    if (!database) {
      throw new Error(
        `Unknown request type: "${requestType}". ` +
        `Valid types: ${Object.keys(this.databaseMap).join(', ')}`
      );
    }
    
    if (!database.id) {
      throw new Error(
        `Database ID not configured for request type: "${requestType}". ` +
        `Set environment variable: ${this.getEnvVarName(normalizedType)}`
      );
    }
    
    console.log(`✅ Routed to: ${database.name} (${database.id.substring(0, 8)}...)`);
    
    return {
      databaseId: database.id,
      databaseName: database.name,
      databaseDescription: database.description,
      requestType: normalizedType
    };
  }

  /**
   * Normalize request type
   * WHY THIS WORKS: Handles variations in naming (ContentRequest, content-request, etc.)
   */
  normalizeRequestType(requestType) {
    if (!requestType) {
      throw new Error('Request type is required');
    }
    
    // Convert to lowercase and replace spaces/dashes with underscores
    return requestType
      .toLowerCase()
      .replace(/[\s-]/g, '_')
      .replace(/[^a-z0-9_]/g, ''); // Remove special chars
  }

  /**
   * Get env var name for database type
   * WHY THIS WORKS: Helps generate helpful error messages
   */
  getEnvVarName(normalizedType) {
    return normalizedType.toUpperCase() + '_DB_ID';
  }

  /**
   * Get all configured databases
   * WHY THIS WORKS: Useful for debugging and API endpoints
   */
  getAvailableDatabases() {
    const databases = [];
    
    for (const [type, db] of Object.entries(this.databaseMap)) {
      databases.push({
        type,
        name: db.name,
        description: db.description,
        configured: !!db.id,
        envVar: this.getEnvVarName(type)
      });
    }
    
    return databases;
  }

  /**
   * Validate that required databases are configured
   * WHY THIS WORKS: Fail fast on startup if critical databases are missing
   */
  validateConfiguration(requiredTypes = ['content_request']) {
    const missing = [];
    
    for (const type of requiredTypes) {
      const normalizedType = this.normalizeRequestType(type);
      const database = this.databaseMap[normalizedType];
      
      if (!database || !database.id) {
        missing.push({
          type: normalizedType,
          envVar: this.getEnvVarName(normalizedType)
        });
      }
    }
    
    if (missing.length > 0) {
      const missingList = missing.map(m => `${m.type} (${m.envVar})`).join(', ');
      throw new Error(
        `Missing required database configuration: ${missingList}. ` +
        `Add these environment variables to your .env file.`
      );
    }
    
    console.log(`✅ Database configuration validated: ${requiredTypes.length} databases configured`);
    return true;
  }

  /**
   * Add custom database mapping (for dynamic configuration)
   * WHY THIS WORKS: Allows runtime addition of databases without code changes
   */
  addDatabase(type, databaseId, name, description) {
    const normalizedType = this.normalizeRequestType(type);
    
    this.databaseMap[normalizedType] = {
      id: databaseId,
      name: name || type,
      description: description || `Custom database for ${type}`
    };
    
    console.log(`✅ Added custom database: ${name} (${type})`);
  }

  /**
   * Check if request type is supported
   * WHY THIS WORKS: Useful for validation before processing
   */
  isSupported(requestType) {
    try {
      const normalizedType = this.normalizeRequestType(requestType);
      return !!this.databaseMap[normalizedType];
    } catch (error) {
      return false;
    }
  }

  /**
   * Get database info without throwing error
   * WHY THIS WORKS: Safe lookup for optional databases
   */
  getDatabaseInfo(requestType) {
    try {
      return this.route(requestType);
    } catch (error) {
      return null;
    }
  }
}

module.exports = BriefRouter;

