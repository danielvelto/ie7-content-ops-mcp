/**
 * Intelligent Completeness Assessment
 * WHY THIS EXISTS: Checks if briefs have expected info based on complexity/type
 * Uses heuristics to understand what's normal vs problematic
 * 
 * NOTE: Will be enhanced with dynamic RAG in future iteration
 */

class CompletenessChecker {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Assess completeness of a brief based on complexity and type
   */
  async assessCompleteness(briefData, complexity, requestType = null) {
    console.log(`🔍 Completeness check for ${complexity} ${requestType || 'request'}...`);

    const assessment = {
      complete: true,
      normalTBDs: [],
      softFlags: [],
      criticalMissing: [],
      complexityAppropriate: true
    };

    // Basic completeness check - can be enhanced with dynamic RAG later
    const coreFields = ['project_name', 'deliverables', 'timeline'];
    
    for (const field of coreFields) {
      const value = this.findFieldValue(briefData, field);
      
      if (!value || (typeof value === 'string' && value.toLowerCase() === 'tbd')) {
        assessment.softFlags.push({
          field: this.humanizeKey(field),
          severity: 'medium',
          recommendation: `Recommended: Confirm ${this.humanizeKey(field)} before proceeding`
        });
        assessment.complete = false;
      }
    }

    console.log(`✅ Completeness: ${assessment.complete ? '✓ Complete' : '⚠️ Has gaps'}`);
    if (assessment.softFlags.length > 0) {
      console.log(`   📌 ${assessment.softFlags.length} soft flags`);
    }
    
    return assessment;
  }

  /**
   * Transform technical key to human-readable label
   */
  humanizeKey(key) {
    const specialMappings = {
      'user_id': 'User ID',
      'project_name': 'Project Name',
      'raw_footage': 'Raw Footage',
      'color_grading': 'Color Grading',
      'music_preference': 'Music Preference',
      'branding_elements': 'Branding Elements',
      'shot_list': 'Shot List',
      'budget_breakdown': 'Budget Breakdown'
    };

    const lowerKey = key.toLowerCase().replace(/_/g, ' ');
    
    if (specialMappings[key.toLowerCase()]) {
      return specialMappings[key.toLowerCase()];
    }
    
    return lowerKey
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Find field value by checking multiple possible keys
   */
  findFieldValue(briefData, fieldKey) {
    // Check various naming conventions
    const possibleKeys = [
      fieldKey,
      fieldKey.toLowerCase(),
      fieldKey.replace(/_/g, ' '),
      fieldKey.replace(/_/g, '').toLowerCase()
    ];

    for (const key of possibleKeys) {
      if (briefData[key]) return briefData[key];
    }

    // Check in nested objects
    for (const value of Object.values(briefData)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedValue = this.findFieldValue(value, fieldKey);
        if (nestedValue) return nestedValue;
      }
    }

    return null;
  }

}

module.exports = CompletenessChecker;

