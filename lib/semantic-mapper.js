// ============================================
// IE7 SEMANTIC PROPERTY MAPPER
// ============================================
// Uses LLM reasoning to intelligently map brief data to Notion properties
// WHY THIS WORKS: Semantic understanding instead of rigid whitelists

const OpenAI = require('openai');

class SemanticPropertyMapper {
  constructor(options = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // WHY THIS WORKS: GPT-5 provides superior reasoning and structured output reliability
    // Better at following strict JSON schemas and complex instructions than o3-mini
    this.model = options.model || 'gpt-5';
    this.reasoningEffort = options.reasoningEffort || 'medium';
  }

  /**
   * Semantically map brief data to database properties
   * WHY THIS WORKS: LLM understands semantic meaning of field names
   * 
   * @param {object} briefData - Completed brief from n8n agents
   * @param {object} databaseSchema - Notion database schema
   * @param {object} parsedTemplate - Parsed DCMS template with SOPs
   * @param {object} sopGuidelines - Additional SOP guidelines from IE7 system page
   * @param {array} workspaceUsers - List of Notion workspace users for people field resolution
   * @returns {Promise<object>} Semantic mapping with reasoning
   */
  async mapProperties(briefData, databaseSchema, parsedTemplate, sopGuidelines = {}, workspaceUsers = []) {
    console.log('🧠 Starting semantic property mapping...');
    
    try {
      const prompt = this.buildMappingPrompt(briefData, databaseSchema, parsedTemplate, sopGuidelines, workspaceUsers);
      
      // WHY THIS WORKS: o3-mini uses reasoning to understand context
      // response_format forces valid JSON output
      // reasoning_effort = medium balances speed and accuracy
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a semantic property mapping expert for IE7 content operations. You understand field types, constraints, and can output Notion-ready values. Return only valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: this.reasoningEffort,
        max_completion_tokens: 4000
      });
      
      let responseText = completion.choices[0].message.content.trim();
      
      // Strip markdown code blocks if present
      if (responseText.includes('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (responseText.includes('```')) {
        responseText = responseText.replace(/```\n?/g, '');
      }
      
      let mapping;
      try {
        mapping = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON parse error. Response text:');
        console.error(responseText.substring(0, 500)); // Show first 500 chars
        
        // Try to recover: extract JSON between first { and last }
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const extracted = responseText.substring(firstBrace, lastBrace + 1);
            mapping = JSON.parse(extracted);
            console.log('✅ Recovered from JSON parse error');
          } catch (recoveryError) {
            console.error('❌ Recovery failed. Falling back to basic mapping.');
            // Fallback to basic mapping
            return this.createBasicFallbackMapping(briefData, databaseSchema);
          }
        } else {
          console.error('❌ Could not recover JSON. Falling back to basic mapping.');
          return this.createBasicFallbackMapping(briefData, databaseSchema);
        }
      }
      
      console.log(`✅ Semantic mapping complete:`);
      console.log(`   - Properties to populate: ${Object.keys(mapping.populate || {}).length}`);
      console.log(`   - Properties to skip: ${Object.keys(mapping.skip || {}).length}`);
      console.log(`   - Uncertain properties: ${Object.keys(mapping.uncertain || {}).length}`);
      
      return {
        success: true,
        mapping,
        model: this.model,
        tokensUsed: completion.usage?.total_tokens || 0
      };
      
    } catch (error) {
      console.error('❌ Semantic mapping failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create basic fallback mapping when LLM fails
   * WHY THIS EXISTS: System should still work even if LLM produces bad JSON
   */
  createBasicFallbackMapping(briefData, databaseSchema) {
    console.log('🔧 Creating basic fallback mapping...');
    
    const mapping = {
      populate: {},
      skip: {},
      uncertain: {}
    };
    
    // Map obvious fields
    const simpleFieldMappings = {
      'USER ID': briefData.User_Number || briefData['USER ID'] || briefData.user_id,
      'Project name': briefData['Project Name'] || briefData.project_name,
      'Client Name': briefData['Client Name'] || briefData.client_name || briefData['Company Name'],
      'Contact Email': briefData['Client Email'] || briefData.email || briefData.contact,
      'Brief for AI': briefData.brief_details || briefData.Raw_Brief || briefData['Raw Brief']
    };
    
    for (const [propName, value] of Object.entries(simpleFieldMappings)) {
      if (value && databaseSchema.properties[propName]) {
        mapping.populate[propName] = { value, confidence: 0.7, reason: 'Fallback mapping' };
      }
    }
    
    // Add default assignee
    const defaultAssignee = process.env.DEFAULT_ASSIGNEE_ID || '6c6d356a-61d2-455e-9ddd-bfb3cf43da4e';
    if (databaseSchema.properties['Assignee']) {
      mapping.populate['Assignee'] = { value: defaultAssignee, confidence: 1.0, reason: 'System default' };
    }
    
    console.log(`✅ Fallback mapping: ${Object.keys(mapping.populate).length} properties`);
    
    return {
      success: true,
      mapping,
      model: 'fallback',
      tokensUsed: 0
    };
  }

  /**
   * Build semantic mapping prompt
   * WHY THIS WORKS: Clear instructions + examples guide the LLM
   */
  buildMappingPrompt(briefData, databaseSchema, parsedTemplate, sopGuidelines, workspaceUsers = []) {
    return `# SYSTEM PROMPT: IE7 Semantic Property Mapper

You are an intelligent property mapper for IE7 content operations. You receive completed brief data from conversational AI agents (Agent 1 & Agent 2) and must determine which Notion database properties to populate.

## YOUR TASK

Analyze the brief data and database schema below. Use **semantic intelligence** to determine:
1. Which properties should be populated from the brief (intake data)
2. Which properties should be left empty (post-intake workflow)
3. Which properties you're uncertain about (flag for review)

**IMPORTANT**: Output Notion-ready values that match the field types and constraints below.

## BRIEF DATA (From Conversational Agents)

\`\`\`json
${JSON.stringify(briefData, null, 2)}
\`\`\`

## TARGET DATABASE SCHEMA

${this.buildSchemaDescription(databaseSchema, workspaceUsers)}

## DCMS TEMPLATE CONTEXT

**Note**: SOPs are extracted from toggle blocks in the DCMS_TEMPLATE page. Toggle blocks contain process instructions that guide how to populate each section.

${parsedTemplate ? this.buildTemplateContext(parsedTemplate) : 'No template context available'}

## IE7 SYSTEM SOPs

${this.buildSOPContext(sopGuidelines)}

## SEMANTIC REASONING GUIDELINES

### ✅ POPULATE if:

1. **Information exists in brief** - The brief contains this data from the conversation
2. **Intake-appropriate** - This is information captured during request submission
3. **User-provided data** - Name, contact, project details, dates, descriptions, platform
4. **Request metadata** - Priority, category, complexity, budget (if in brief)
5. **Semantic clarity** - Field name clearly indicates intake data

**Examples**:
- "Project name" → ✅ POPULATE (user provided in conversation)
- "Requested By" → ✅ POPULATE (captured from user)
- "Due Date" → ✅ POPULATE (user specified deadline)
- "Platform" → ✅ POPULATE (user mentioned Instagram/TikTok/etc.)
- "Description" → ✅ POPULATE (from conversation summary)

### ❌ SKIP if:

1. **Post-intake workflow** - Requires action AFTER submission
2. **Internal tracking** - System fields for automation, status tracking
3. **Team assignment** - Assignee, Allocated to, Responsible Person (EXCEPT when SOP specifies default)
4. **Output/Result fields** - Media Link, Final Deliverable, Response, Approval
5. **Semantic indicators**:
   - Contains: "allocated", "assigned", "approval", "accept", "response", "update"
   - Implies future: "upload", "link", "final", "result", "outcome"
   - Requires decision: "needed?", "required?", "approve?", "accept?"

**Examples**:
- "Freelancer Allocated" → ❌ SKIP (assignment happens during fulfillment)
- "Media Link" → ❌ SKIP (content hasn't been created yet)
- "Accept Brief?" → ❌ SKIP (internal approval workflow)
- "Freelancer Needed?" → ❌ SKIP (Estas decides during triage)
- "AI Response - Send Brief" → ❌ SKIP (internal automation field)

### ⚠️ UNCERTAIN if:

1. **Ambiguous naming** - Field name doesn't clearly indicate intake vs workflow
2. **Missing context** - Not sure if this data was captured in conversation
3. **Requires clarification** - Better to flag than guess wrong

### 🎯 SPECIAL RULES (From IE7 SOPs)

${this.buildSpecialRules(sopGuidelines)}

## OUTPUT JSON SCHEMA

Return ONLY valid JSON with this structure:

\`\`\`json
{
  "populate": {
    "Property Name": {
      "value": "mapped value from brief (use appropriate type)",
      "notionType": "title|rich_text|select|date|number|checkbox|relation|people",
      "confidence": 0.95,
      "reason": "Why this field should be populated",
      "sourceField": "which field in briefData this came from"
    }
  },
  "skip": {
    "Property Name": {
      "reason": "Why this field should be skipped (be specific about workflow stage)"
    }
  },
  "uncertain": {
    "Property Name": {
      "reason": "Why uncertain - needs manual review",
      "suggestedValue": "possible value if user decides to populate"
    }
  },
  "metadata": {
    "totalPropertiesAnalyzed": 0,
    "decisionsSummary": "brief summary of mapping logic used"
  }
}
\`\`\`

## CRITICAL INSTRUCTIONS

1. **Use semantic understanding** - Don't just match keywords, understand meaning
2. **Explain reasoning** - Be specific about WHY each decision was made
3. **When uncertain, flag** - Better to ask than populate incorrectly
4. **Follow SOPs** - If SOP says "Assignee always = Daniel Fayomi", populate that
5. **Respect Notion types** - Match value format to property type (date format, select options, etc.)
6. **Check select options** - If property is select/multi_select, ensure value matches available options

Return ONLY the JSON, no other text.`;
  }

  /**
   * Build schema description for prompt
   */
  buildSchemaDescription(databaseSchema, workspaceUsers = []) {
    const lines = [];
    
    lines.push('**Available Properties and their Constraints:**\n');
    
    for (const [propName, propDef] of Object.entries(databaseSchema.properties || {})) {
      const propType = propDef.type;
      let description = `- **${propName}** (${propType})`;
      
      // Add type-specific constraints and requirements (escape quotes for JSON safety)
      if (propType === 'select' && propDef.select?.options) {
        const options = propDef.select.options.map(opt => opt.name.replace(/"/g, '\\"')).join(', ');
        description += `\n  → MUST match ONE of: [${options}]`;
        description += `\n  → Example: {"value": "Option Name"}`;
      }
      
      if (propType === 'multi_select' && propDef.multi_select?.options) {
        const options = propDef.multi_select.options.map(opt => opt.name.replace(/"/g, '\\"')).join(', ');
        description += `\n  → MUST match from: [${options}]`;
        description += `\n  → Example: {"value": ["Option1", "Option2"]}`;
      }
      
      if (propType === 'people') {
        description += `\n  → MUST be valid user ID (UUID), NOT a name`;
        description += `\n  → Example: {"value": "6c6d356a-61d2-455e-9ddd-bfb3cf43da4e"}`;
      }
      
      if (propType === 'date') {
        description += `\n  → Format: ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)`;
        description += `\n  → Example: {"value": "2025-12-25"}`;
      }
      
      if (propType === 'number') {
        description += `\n  → MUST be numeric value`;
        description += `\n  → Example: {"value": 42}`;
      }
      
      if (propType === 'checkbox') {
        description += `\n  → MUST be boolean (true/false)`;
        description += `\n  → Example: {"value": true}`;
      }
      
      if (propType === 'url') {
        description += `\n  → MUST be valid URL`;
        description += `\n  → Example: {"value": "https://example.com"}`;
      }
      
      if (propType === 'email') {
        description += `\n  → MUST be valid email address`;
        description += `\n  → Example: {"value": "user@example.com"}`;
      }
      
      // Add property description if available
      if (propDef.description) {
        description += `\n  → Description: ${propDef.description}`;
      }
      
      lines.push(description);
    }
    
    // Add workspace users list if people fields exist
    const hasPeopleFields = Object.values(databaseSchema.properties || {}).some(p => p.type === 'people');
    if (hasPeopleFields && workspaceUsers.length > 0) {
      lines.push('\n**Available Workspace Users (for people fields):**\n');
      workspaceUsers.forEach(user => {
        const email = user.person?.email || 'no email';
        lines.push(`- ${user.name} → ID: ${user.id} (${email})`);
      });
      lines.push('\n**For people fields, you MUST output the user ID, not the name.**');
    }
    
    return lines.join('\n');
  }

  /**
   * Build template context for prompt
   */
  buildTemplateContext(parsedTemplate) {
    const lines = [];
    
    lines.push('**Template Variables:**');
    const variables = parsedTemplate.sections
      .flatMap(s => s.variables)
      .concat(parsedTemplate.sections.flatMap(s => s.content.flatMap(c => c.variables)));
    
    const uniqueVars = [...new Set(variables)];
    lines.push(uniqueVars.map(v => `- {{${v}}}`).join('\n'));
    
    lines.push('\n**Template SOPs:**');
    const sops = parsedTemplate.sections
      .flatMap(s => s.sops)
      .concat(parsedTemplate.sections.flatMap(s => s.content.flatMap(c => c.sops)));
    
    sops.forEach((sop, idx) => {
      lines.push(`${idx + 1}. ${sop}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Build SOP context for prompt
   */
  buildSOPContext(sopGuidelines) {
    if (!sopGuidelines || Object.keys(sopGuidelines).length === 0) {
      return 'No additional SOP guidelines provided.';
    }
    
    const lines = [];
    
    if (sopGuidelines.defaultAssignee) {
      lines.push(`**Default Assignee**: ${sopGuidelines.defaultAssignee.name} (${sopGuidelines.defaultAssignee.email})`);
    }
    
    if (sopGuidelines.decisionRules) {
      lines.push('\n**Decision Rules:**');
      sopGuidelines.decisionRules.forEach(rule => {
        lines.push(`- ${rule}`);
      });
    }
    
    if (sopGuidelines.qualityStandards) {
      lines.push('\n**Quality Standards:**');
      sopGuidelines.qualityStandards.forEach(standard => {
        lines.push(`- ${standard}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Build special rules from SOPs
   */
  buildSpecialRules(sopGuidelines) {
    const rules = [];
    
    // Default assignee rule (from user's SOPs)
    if (sopGuidelines.defaultAssignee) {
      rules.push(`1. **Assignee Field**: Always populate with "${sopGuidelines.defaultAssignee.name}" (this is a SYSTEM RULE, not workflow assignment)`);
    }
    
    // Add other special rules from SOPs
    if (sopGuidelines.specialRules && Array.isArray(sopGuidelines.specialRules)) {
      sopGuidelines.specialRules.forEach((rule, idx) => {
        rules.push(`${idx + 2}. ${rule}`);
      });
    }
    
    return rules.length > 0 ? rules.join('\n') : 'No special rules defined.';
  }

  /**
   * Convert semantic mapping to Notion property format
   * WHY THIS WORKS: Transforms LLM output into Notion API format
   * 
   * @param {object} mapping - Output from mapProperties()
   * @param {object} databaseSchema - Notion database schema
   * @returns {object} Notion-formatted properties
   */
  convertToNotionFormat(mapping, databaseSchema) {
    const notionProperties = {};
    
    for (const [propName, propData] of Object.entries(mapping.populate || {})) {
      const propDef = databaseSchema.properties[propName];
      if (!propDef) {
        console.warn(`⚠️ Property "${propName}" not found in schema, skipping`);
        continue;
      }
      
      const propType = propDef.type;
      const value = propData.value;
      
      // Convert based on property type
      try {
        notionProperties[propName] = this.formatPropertyValue(value, propType, propDef);
      } catch (error) {
        console.error(`❌ Failed to format property "${propName}":`, error.message);
      }
    }
    
    return notionProperties;
  }

  /**
   * Format value for Notion property type
   * WHY THIS WORKS: Each Notion property type has specific format requirements
   */
  formatPropertyValue(value, propType, propDef) {
    switch (propType) {
      case 'title':
        return { title: [{ text: { content: String(value) } }] };
      
      case 'rich_text':
        return { rich_text: [{ text: { content: String(value) } }] };
      
      case 'number':
        return { number: Number(value) };
      
      case 'select':
        return { select: { name: String(value) } };
      
      case 'multi_select':
        const values = Array.isArray(value) ? value : [value];
        return { multi_select: values.map(v => ({ name: String(v) })) };
      
      case 'date':
        // Handle date strings and objects
        if (typeof value === 'string') {
          return { date: { start: value } };
        } else if (value.start) {
          return { date: value };
        }
        return { date: { start: new Date(value).toISOString().split('T')[0] } };
      
      case 'checkbox':
        return { checkbox: Boolean(value) };
      
      case 'url':
        return { url: String(value) };
      
      case 'email':
        return { email: String(value) };
      
      case 'phone_number':
        return { phone_number: String(value) };
      
      case 'people':
        // Handle people property (requires user IDs)
        // This is tricky - might need to be handled specially
        if (Array.isArray(value)) {
          return { people: value.map(id => ({ id })) };
        }
        return { people: [{ id: value }] };
      
      case 'relation':
        // Handle relation property (requires page IDs)
        if (Array.isArray(value)) {
          return { relation: value.map(id => ({ id })) };
        }
        return { relation: [{ id: value }] };
      
      default:
        console.warn(`⚠️ Unknown property type: ${propType}, using rich_text`);
        return { rich_text: [{ text: { content: String(value) } }] };
    }
  }
}

module.exports = SemanticPropertyMapper;

