// ============================================
// IE7 TEMPLATE APPLIER
// ============================================
// Applies DCMS template structure to Notion pages and populates with brief data
// WHY THIS WORKS: Transforms template blocks + brief data into formatted page content

class TemplateApplier {
  constructor() {
    // Pattern for replacing variables
    this.variablePattern = /\{\{(.*?)\}\}/g;
  }

  /**
   * Apply DCMS template to Notion page
   * WHY THIS WORKS: Uses template structure as blueprint, fills with brief data
   * 
   * @param {object} parsedTemplate - Parsed template from SOPParser
   * @param {object} briefData - Brief data from n8n
   * @param {object} semanticMapping - Mapping from SemanticPropertyMapper
   * @returns {Array} Notion block objects ready to append to page
   */
  applyTemplate(parsedTemplate, briefData, semanticMapping) {
    console.log('📄 Applying DCMS template...');
    
    const blocks = [];
    
    for (const section of parsedTemplate.sections) {
      // Skip conditional sections if their data doesn't exist
      // WHY THIS WORKS: Prevents empty/irrelevant sections
      if (section.isConditional && !this.sectionHasData(section, briefData)) {
        console.log(`⏭️ Skipping conditional section: ${section.title} (no data)`);
        continue;
      }
      
      // Add section heading
      if (section.level && section.title) {
        blocks.push(this.createHeadingBlock(section.level, section.title, briefData));
      }
      
      // Add section content blocks
      for (const contentBlock of section.content) {
        // Skip conditional content if data doesn't exist
        if (contentBlock.isConditional && !this.contentHasData(contentBlock, briefData)) {
          console.log(`⏭️ Skipping conditional content: ${contentBlock.blockType}`);
          continue;
        }
        
        // Create block based on type
        const block = this.createContentBlock(contentBlock, briefData);
        if (block) {
          blocks.push(block);
        }
      }
    }
    
    console.log(`✅ Template applied: ${blocks.length} blocks created`);
    
    return blocks;
  }

  /**
   * Check if section has data in brief
   * WHY THIS WORKS: Prevents creating empty sections
   */
  sectionHasData(section, briefData) {
    // Check if any variables in this section have data
    const sectionVars = section.variables.concat(
      section.content.flatMap(c => c.variables)
    );
    
    return sectionVars.some(varName => {
      const value = this.getValueFromBrief(varName, briefData);
      return value !== null && value !== undefined && value !== '';
    });
  }

  /**
   * Check if content block has data
   */
  contentHasData(contentBlock, briefData) {
    if (contentBlock.variables.length === 0) {
      return true; // Static content, always include
    }
    
    return contentBlock.variables.some(varName => {
      const value = this.getValueFromBrief(varName, briefData);
      return value !== null && value !== undefined && value !== '';
    });
  }

  /**
   * Get value from brief data by variable name
   * WHY THIS WORKS: AGGRESSIVE matching - tries MANY variations to find the data
   */
  getValueFromBrief(varName, briefData) {
    // Normalize the variable name for comparison
    const normalizeForComparison = (str) => {
      return str
        .toLowerCase()
        .replace(/[_\s-]/g, '')  // Remove underscores, spaces, dashes
        .replace(/[^a-z0-9]/g, ''); // Remove special chars
    };
    
    const normalizedVar = normalizeForComparison(varName);
    
    // Try exact match first
    if (briefData[varName] !== undefined) {
      return briefData[varName];
    }
    
    // Try common variations of the variable name
    const variations = [
      varName,
      varName.replace(/_/g, ' '),  // project_name → "project name"
      varName.replace(/_/g, ''),   // project_name → projectname
      varName.replace(/_([a-z])/g, (g) => g[1].toUpperCase()), // camelCase
      varName.replace(/([A-Z])/g, '_$1').toLowerCase(), // snake_case
      varName.charAt(0).toUpperCase() + varName.slice(1).replace(/_([a-z])/g, (g) => ' ' + g[1].toUpperCase()), // Title Case
    ];
    
    // Try each variation as exact match
    for (const variation of variations) {
      if (briefData[variation] !== undefined) {
        return briefData[variation];
      }
    }
    
    // Aggressive fuzzy match - compare normalized versions
    for (const [key, value] of Object.entries(briefData)) {
      const normalizedKey = normalizeForComparison(key);
      
      if (normalizedKey === normalizedVar) {
        return value;
      }
      
      // Also try semantic matches
      // project_name matches: "Project Name", "project-name", "ProjectName", etc.
      if (normalizedKey.includes(normalizedVar) || normalizedVar.includes(normalizedKey)) {
        // Only match if it's a close semantic match
        const similarity = this.calculateSimilarity(normalizedKey, normalizedVar);
        if (similarity > 0.7) {
          return value;
        }
      }
    }
    
    // Special case mappings (semantic understanding)
    const semanticMappings = {
      'description': ['brief_details', 'raw_brief', 'details', 'overview', 'brief'],
      'project_name': ['project name', 'projectname', 'title'],
      'due_date': ['due dates', 'deadline', 'duedate', 'publish by'],
      'requested_by': ['client name', 'requester', 'requested by name'],
      'platform': ['asset type', 'channel'],
      'client_email': ['contact email', 'email'],
    };
    
    const normalizedVarForSemantic = varName.toLowerCase().replace(/[_\s-]/g, '');
    
    for (const [canonical, aliases] of Object.entries(semanticMappings)) {
      if (normalizedVarForSemantic === canonical.replace(/[_\s-]/g, '')) {
        // This variable matches a canonical form, check if any alias exists in briefData
        for (const alias of aliases) {
          for (const [key, value] of Object.entries(briefData)) {
            if (normalizeForComparison(key) === normalizeForComparison(alias)) {
              return value;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Calculate string similarity (0-1)
   * WHY THIS WORKS: Helps fuzzy matching without false positives
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance between strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Create heading block
   * WHY THIS WORKS: Notion uses heading_1, heading_2, heading_3
   */
  createHeadingBlock(level, title, briefData) {
    // Replace variables in title
    const processedTitle = this.replaceVariables(title, briefData);
    
    return {
      object: 'block',
      type: level,
      [level]: {
        rich_text: [{
          type: 'text',
          text: { content: processedTitle }
        }]
      }
    };
  }

  /**
   * Create content block based on block type
   * WHY THIS WORKS: Different block types have different structures
   */
  createContentBlock(contentBlock, briefData) {
    const blockType = contentBlock.blockType;
    let content = contentBlock.content;
    
    // Replace variables in content
    content = this.replaceVariables(content, briefData);
    
    // Remove SOP markers (they're for the LLM, not the final page)
    content = this.removeSOPMarkers(content);
    
    // Handle different block types
    switch (blockType) {
      case 'paragraph':
        return this.createParagraph(content);
      
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        return this.createHeading(blockType, content);
      
      case 'callout':
        return this.createCallout(content, contentBlock.originalBlock);
      
      case 'quote':
        return this.createQuote(content);
      
      case 'bulleted_list_item':
        return this.createBulletedListItem(content);
      
      case 'numbered_list_item':
        return this.createNumberedListItem(content);
      
      case 'toggle':
        return this.createToggle(content, briefData);
      
      case 'divider':
        return { object: 'block', type: 'divider', divider: {} };
      
      default:
        // Fallback to paragraph for unknown types
        console.warn(`⚠️ Unknown block type: ${blockType}, using paragraph`);
        return this.createParagraph(content);
    }
  }

  /**
   * Replace variables in text
   * WHY THIS WORKS: {{variable_name}} → actual value from brief
   */
  replaceVariables(text, briefData) {
    return text.replace(this.variablePattern, (match, varName) => {
      const value = this.getValueFromBrief(varName.trim(), briefData);
      
      if (value === null || value === undefined) {
        console.warn(`⚠️ Variable {{${varName}}} not found in brief data`);
        return `[${varName}]`; // Show as [variable_name] if not found
      }
      
      // Handle arrays and objects
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      
      return String(value);
    });
  }

  /**
   * Remove SOP markers from content
   * WHY THIS WORKS: [SOP: ...] is for LLM guidance, not page content
   */
  removeSOPMarkers(text) {
    return text.replace(/\[SOP:.*?\]/gs, '').trim();
  }

  /**
   * Create paragraph block
   */
  createParagraph(content) {
    if (!content || content.trim() === '') {
      return null; // Skip empty paragraphs
    }
    
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    };
  }

  /**
   * Create heading block
   */
  createHeading(level, content) {
    return {
      object: 'block',
      type: level,
      [level]: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    };
  }

  /**
   * Create callout block (with icon and color)
   */
  createCallout(content, originalBlock) {
    const calloutData = originalBlock?.callout || {};
    
    return {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{
          type: 'text',
          text: { content }
        }],
        icon: calloutData.icon || { type: 'emoji', emoji: '📋' },
        color: calloutData.color || 'blue_background'
      }
    };
  }

  /**
   * Create quote block
   */
  createQuote(content) {
    return {
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    };
  }

  /**
   * Create bulleted list item
   */
  createBulletedListItem(content) {
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    };
  }

  /**
   * Create numbered list item
   */
  createNumberedListItem(content) {
    return {
      object: 'block',
      type: 'numbered_list_item',
      numbered_list_item: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    };
  }

  /**
   * Create toggle block (collapsible section)
   * WHY THIS WORKS: Good for conversation logs - keeps page clean
   */
  createToggle(content, briefData) {
    return {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    };
  }

  /**
   * Add attachments section if attachments exist
   * WHY THIS WORKS: Bookmarks are clickable links in Notion
   */
  addAttachmentsSection(briefData) {
    const blocks = [];
    
    if (briefData.attachments && Array.isArray(briefData.attachments) && briefData.attachments.length > 0) {
      // Add heading
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{
            type: 'text',
            text: { content: '📎 Attachments' }
          }]
        }
      });
      
      // Add each attachment as bookmark
      for (const attachment of briefData.attachments) {
        if (typeof attachment === 'string' && attachment.startsWith('http')) {
          blocks.push({
            object: 'block',
            type: 'bookmark',
            bookmark: {
              url: attachment
            }
          });
        } else if (attachment.url) {
          blocks.push({
            object: 'block',
            type: 'bookmark',
            bookmark: {
              url: attachment.url,
              caption: attachment.caption ? [{
                type: 'text',
                text: { content: attachment.caption }
              }] : []
            }
          });
        }
      }
    }
    
    return blocks;
  }

  /**
   * Add conversation summary in toggle block
   * WHY THIS WORKS: Keeps full context available but collapsed by default
   */
  addConversationSummary(briefData) {
    const blocks = [];
    
    if (briefData.conversationSummary || briefData.conversationTranscript) {
      const content = briefData.conversationSummary || briefData.conversationTranscript;
      
      blocks.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [{
            type: 'text',
            text: { content: '💬 Full Conversation Log (click to expand)' },
            annotations: { bold: true }
          }]
        },
        children: [
          {
            object: 'block',
            type: 'quote',
            quote: {
              rich_text: [{
                type: 'text',
                text: { content: String(content) }
              }]
            }
          }
        ]
      });
    }
    
    return blocks;
  }
}

module.exports = TemplateApplier;

