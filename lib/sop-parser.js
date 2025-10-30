// ============================================
// IE7 SOP PARSER
// ============================================
// Extracts SOPs and structure from DCMS_TEMPLATE reference pages
// WHY THIS WORKS: SOPs embedded in toggle blocks guide semantic intelligence

class SOPParser {
  constructor() {
    // Pattern matching for SOPs and placeholders
    // WHY THIS WORKS: Regex enables flexible SOP formatting
    this.sopPattern = /\[SOP:(.*?)\]/gs; // Matches [SOP: instructions]
    this.placeholderPattern = /\{\{(.*?)\}\}/g; // Matches {{variable_name}}
  }

  /**
   * Parse template blocks and extract structure + SOPs
   * WHY THIS WORKS: Converts Notion blocks into semantic structure the LLM can understand
   * 
   * @param {Array} blocks - Notion block objects from template
   * @returns {object} Parsed template with sections, SOPs, and variables
   */
  parseTemplate(blocks) {
    const sections = [];
    let currentSection = null;
    
    for (const block of blocks) {
      const blockType = block.type;
      const blockContent = this.extractTextFromBlock(block);
      
      // Skip empty blocks
      if (!blockContent || blockContent.trim() === '') {
        continue;
      }
      
      // WHY THIS WORKS: Headings define major sections
      // heading_1 = Main title, heading_2 = Sections, heading_3 = Subsections
      if (blockType === 'heading_1' || blockType === 'heading_2' || blockType === 'heading_3') {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          type: 'section',
          level: blockType, // heading_1, heading_2, heading_3
          title: blockContent,
          originalBlock: block,
          sops: [],
          variables: this.extractVariables(blockContent),
          content: [],
          isConditional: this.isConditional(blockContent)
        };
      }
      // WHY THIS WORKS: Toggle blocks contain SOPs (IE7 approach)
      // Toggle blocks are collapsed by default in Notion - clean UX
      else if (blockType === 'toggle') {
        // The toggle block content itself is the SOP instruction
        // WHY THIS WORKS: Toggle blocks in IE7 templates ARE the SOPs
        // No [SOP: ...] markers needed - the whole toggle is the instruction
        const sopInstruction = blockContent.trim();
        
        if (sopInstruction && sopInstruction !== '') {
          // Check if this contains [SOP: ...] marker (legacy format)
          const explicitSOP = this.extractSOP(blockContent);
          const sop = explicitSOP || sopInstruction; // Use marker if present, otherwise whole content
          
          if (currentSection) {
            currentSection.sops.push(sop);
          } else {
            // SOP before any section - create implicit section
            currentSection = {
              type: 'sop_block',
              level: 'instruction',
              title: 'Process Instruction',
              originalBlock: block,
              sops: [sop],
              variables: [],
              content: [],
              isConditional: false
            };
          }
        }
      }
      // WHY THIS WORKS: Regular content blocks (paragraph, callout, quote, etc.)
      // These define the template structure
      else {
        // Extract any embedded SOPs in the content
        const sops = this.extractAllSOPs(blockContent);
        const variables = this.extractVariables(blockContent);
        
        const contentBlock = {
          blockType,
          originalBlock: block,
          content: blockContent,
          sops,
          variables,
          isConditional: this.isConditional(blockContent)
        };
        
        if (currentSection) {
          currentSection.content.push(contentBlock);
        } else {
          // Content before any section - create implicit section
          currentSection = {
            type: 'content',
            level: 'root',
            title: 'Template Content',
            originalBlock: block,
            sops: [],
            variables: [],
            content: [contentBlock],
            isConditional: false
          };
        }
      }
    }
    
    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    console.log(`✅ Parsed ${sections.length} sections from template`);
    
    return {
      sections,
      totalSections: sections.length,
      totalSOPs: this.countTotalSOPs(sections),
      totalVariables: this.countTotalVariables(sections),
      conditionalSections: sections.filter(s => s.isConditional).length
    };
  }

  /**
   * Extract text content from a Notion block
   * WHY THIS WORKS: Notion blocks store text in rich_text arrays
   * Different block types have different structures
   */
  extractTextFromBlock(block) {
    const blockType = block.type;
    const blockData = block[blockType];
    
    if (!blockData) return '';
    
    // WHY THIS WORKS: Most blocks use rich_text array
    if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
      return blockData.rich_text
        .map(rt => rt.plain_text || rt.text?.content || '')
        .join('');
    }
    
    // WHY THIS WORKS: Some blocks use text property directly
    if (blockData.text && typeof blockData.text === 'string') {
      return blockData.text;
    }
    
    return '';
  }

  /**
   * Extract SOP from text (first occurrence)
   * WHY THIS WORKS: SOPs use [SOP: ...] format
   */
  extractSOP(text) {
    const match = text.match(this.sopPattern);
    if (match && match[0]) {
      // Extract content between [SOP: and ]
      const sopContent = match[0].replace(/\[SOP:\s*/i, '').replace(/\]$/, '').trim();
      return sopContent;
    }
    return null;
  }

  /**
   * Extract all SOPs from text (multiple occurrences)
   * WHY THIS WORKS: Some blocks might have multiple SOPs
   */
  extractAllSOPs(text) {
    const matches = text.matchAll(this.sopPattern);
    const sops = [];
    
    for (const match of matches) {
      const sopContent = match[0].replace(/\[SOP:\s*/i, '').replace(/\]$/, '').trim();
      sops.push(sopContent);
    }
    
    return sops;
  }

  /**
   * Extract variable placeholders from text
   * WHY THIS WORKS: Variables use {{variable_name}} format
   */
  extractVariables(text) {
    const matches = text.matchAll(this.placeholderPattern);
    const variables = [];
    
    for (const match of matches) {
      // Extract variable name without braces
      const varName = match[1].trim();
      variables.push(varName);
    }
    
    return variables;
  }

  /**
   * Check if section is conditional
   * WHY THIS WORKS: Conditional sections use "(if applicable)" or "if exists"
   */
  isConditional(text) {
    const conditionalPatterns = [
      /\(if applicable\)/i,
      /\(if exists\)/i,
      /\(optional\)/i,
      /\(if available\)/i,
      /\(if provided\)/i,
      /\(conditional\)/i
    ];
    
    return conditionalPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Count total SOPs across all sections
   */
  countTotalSOPs(sections) {
    let count = 0;
    for (const section of sections) {
      count += section.sops.length;
      for (const contentBlock of section.content) {
        count += contentBlock.sops.length;
      }
    }
    return count;
  }

  /**
   * Count total variables across all sections
   */
  countTotalVariables(sections) {
    let count = 0;
    const uniqueVars = new Set();
    
    for (const section of sections) {
      section.variables.forEach(v => uniqueVars.add(v));
      for (const contentBlock of section.content) {
        contentBlock.variables.forEach(v => uniqueVars.add(v));
      }
    }
    
    return uniqueVars.size;
  }

  /**
   * Build LLM-friendly template description
   * WHY THIS WORKS: Converts parsed structure into prompt format
   * 
   * @param {object} parsedTemplate - Output from parseTemplate()
   * @returns {string} Human-readable template description for LLM
   */
  buildTemplateDescription(parsedTemplate) {
    const lines = [];
    
    lines.push('## DCMS TEMPLATE STRUCTURE\n');
    lines.push(`Total Sections: ${parsedTemplate.totalSections}`);
    lines.push(`Total SOPs: ${parsedTemplate.totalSOPs}`);
    lines.push(`Total Variables: ${parsedTemplate.totalVariables}`);
    lines.push(`Conditional Sections: ${parsedTemplate.conditionalSections}\n`);
    
    for (const section of parsedTemplate.sections) {
      // Section header
      const conditionalTag = section.isConditional ? ' (CONDITIONAL)' : '';
      lines.push(`### ${section.title}${conditionalTag}`);
      lines.push(`- Level: ${section.level}`);
      
      // Section SOPs
      if (section.sops.length > 0) {
        lines.push(`- SOPs:`);
        section.sops.forEach(sop => {
          lines.push(`  • ${sop}`);
        });
      }
      
      // Section variables
      if (section.variables.length > 0) {
        lines.push(`- Variables: ${section.variables.join(', ')}`);
      }
      
      // Content blocks
      if (section.content.length > 0) {
        lines.push(`- Content Blocks: ${section.content.length}`);
        section.content.forEach((block, idx) => {
          const blockConditional = block.isConditional ? ' (CONDITIONAL)' : '';
          lines.push(`  ${idx + 1}. ${block.blockType}${blockConditional}`);
          
          if (block.sops.length > 0) {
            lines.push(`     SOPs: ${block.sops.join(' | ')}`);
          }
          
          if (block.variables.length > 0) {
            lines.push(`     Variables: ${block.variables.join(', ')}`);
          }
        });
      }
      
      lines.push(''); // Empty line between sections
    }
    
    return lines.join('\n');
  }

  /**
   * Get all unique variables across template
   * WHY THIS WORKS: Helps validate that brief data contains all required variables
   */
  getAllVariables(parsedTemplate) {
    const variables = new Set();
    
    for (const section of parsedTemplate.sections) {
      section.variables.forEach(v => variables.add(v));
      for (const contentBlock of section.content) {
        contentBlock.variables.forEach(v => variables.add(v));
      }
    }
    
    return Array.from(variables);
  }

  /**
   * Get all SOPs across template
   * WHY THIS WORKS: Helps build comprehensive guidance for LLM
   */
  getAllSOPs(parsedTemplate) {
    const sops = [];
    
    for (const section of parsedTemplate.sections) {
      sops.push(...section.sops.map(sop => ({
        section: section.title,
        instruction: sop
      })));
      
      for (const contentBlock of section.content) {
        sops.push(...contentBlock.sops.map(sop => ({
          section: section.title,
          blockType: contentBlock.blockType,
          instruction: sop
        })));
      }
    }
    
    return sops;
  }
}

module.exports = SOPParser;

