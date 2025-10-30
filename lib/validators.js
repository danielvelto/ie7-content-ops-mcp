// ============================================
// VALIDATORS - Enum Validation & Input Checking
// ============================================
// WHY THIS WORKS: Your Notion DB has exact enum values
// These MUST match or Notion API will reject the request

// WHY THESE VALUES (From Your Requirements):
// "VELTO'S EXACT ENUM VALUES (from Notion Requests DB)"
const VALID_TYPES = ['In-Scope', 'Out-of-Scope', 'Bug', 'Support', 'Billing'];
const VALID_WORK_TYPES = ['Design', 'Engineering', 'Consulting', 'Support', 'Emergency'];
const VALID_PRIORITIES = ['P0', 'P1', 'P2'];
const VALID_BILLING_METHODS = ['Included', 'T&M', 'Fixed Quote'];
const VALID_STATUSES = ['New', 'Triage', 'Quoted', 'Approved', 'In Progress', 'Done', 'Billed', 'Rejected'];

/**
 * Validate classification output from LLM
 * WHY THIS WORKS: Catches invalid enums before they reach Notion API
 * SAFETY: Prevents 400 errors from Notion
 */
function validateClassification(classification) {
  const errors = [];
  
  // Validate required fields
  if (!classification.title) {
    errors.push('Missing required field: title');
  }
  
  if (!classification.clientId) {
    errors.push('Missing required field: clientId');
  }
  
  // Validate Type enum
  if (!VALID_TYPES.includes(classification.type)) {
    errors.push(`Invalid type: "${classification.type}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  
  // Validate Work Type enum
  if (!VALID_WORK_TYPES.includes(classification.workType)) {
    errors.push(`Invalid workType: "${classification.workType}". Must be one of: ${VALID_WORK_TYPES.join(', ')}`);
  }
  
  // Validate Priority enum
  if (!VALID_PRIORITIES.includes(classification.priority)) {
    errors.push(`Invalid priority: "${classification.priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  
  // Validate Billing Method enum
  if (!VALID_BILLING_METHODS.includes(classification.billingMethod)) {
    errors.push(`Invalid billingMethod: "${classification.billingMethod}". Must be one of: ${VALID_BILLING_METHODS.join(', ')}`);
  }
  
  // Validate Status enum (if provided)
  if (classification.status && !VALID_STATUSES.includes(classification.status)) {
    errors.push(`Invalid status: "${classification.status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  
  // Validate numeric fields
  if (classification.estimateHours !== null && classification.estimateHours !== undefined) {
    if (typeof classification.estimateHours !== 'number' || classification.estimateHours < 0) {
      errors.push('estimateHours must be a positive number');
    }
  }
  
  if (classification.hourlyRate !== null && classification.hourlyRate !== undefined) {
    if (typeof classification.hourlyRate !== 'number' || classification.hourlyRate < 0) {
      errors.push('hourlyRate must be a positive number');
    }
  }
  
  // Validate acceptance criteria structure (new format: array of strings)
  if (classification.acceptanceCriteria) {
    if (!Array.isArray(classification.acceptanceCriteria)) {
      errors.push('acceptanceCriteria must be an array');
    } else {
      // Check that all items are strings
      const invalidItems = classification.acceptanceCriteria.filter(item => typeof item !== 'string');
      if (invalidItems.length > 0) {
        errors.push('All acceptanceCriteria items must be strings');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate incoming request from n8n
 * WHY THIS WORKS: Fail fast with clear error messages
 */
function validateIncomingRequest(request) {
  const errors = [];
  
  if (!request.clientId || typeof request.clientId !== 'string') {
    errors.push('clientId is required and must be a string');
  }
  
  if (!request.message || typeof request.message !== 'string') {
    errors.push('message is required and must be a string');
  }
  
  if (request.message && request.message.length > 10000) {
    errors.push('message is too long (max 10,000 characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize LLM output (fix common issues)
 * WHY THIS WORKS: LLMs sometimes return close-but-not-exact enum values
 * EFFICIENCY: Auto-fix instead of rejecting
 */
function sanitizeClassification(classification) {
  const sanitized = { ...classification };
  
  // Trim whitespace from string fields
  if (sanitized.title) sanitized.title = sanitized.title.trim();
  if (sanitized.type) sanitized.type = sanitized.type.trim();
  if (sanitized.workType) sanitized.workType = sanitized.workType.trim();
  if (sanitized.priority) sanitized.priority = sanitized.priority.trim();
  if (sanitized.billingMethod) sanitized.billingMethod = sanitized.billingMethod.trim();
  if (sanitized.status) sanitized.status = sanitized.status.trim();
  
  // Fix common LLM mistakes
  // WHY THIS WORKS: LLMs sometimes add "Priority: " prefix or similar
  if (sanitized.priority && sanitized.priority.startsWith('Priority: ')) {
    sanitized.priority = sanitized.priority.replace('Priority: ', '');
  }
  
  // Normalize case for some fields (if needed)
  // Example: "engineering" → "Engineering"
  const workTypeMap = {
    'engineering': 'Engineering',
    'design': 'Design',
    'consulting': 'Consulting',
    'support': 'Support',
    'emergency': 'Emergency'
  };
  
  if (sanitized.workType && workTypeMap[sanitized.workType.toLowerCase()]) {
    sanitized.workType = workTypeMap[sanitized.workType.toLowerCase()];
  }
  
  return sanitized;
}

module.exports = {
  VALID_TYPES,
  VALID_WORK_TYPES,
  VALID_PRIORITIES,
  VALID_BILLING_METHODS,
  VALID_STATUSES,
  validateClassification,
  validateIncomingRequest,
  sanitizeClassification
};

