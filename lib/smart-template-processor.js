// ============================================
// IE7 SMART TEMPLATE PROCESSOR V2
// ============================================
// Section-level semantic matching + intelligent content generation
// WHY THIS WORKS: Matches headings to data, generates appropriate blocks, not just placeholder replacement

const OpenAI = require('openai');
const SOPParser = require('./sop-parser');
const CompletenessChecker = require('./completeness-checker');
const SectionPrioritizer = require('./section-prioritizer');
const StakeholderOptimizer = require('./stakeholder-optimizer');
// ConflictDetector REMOVED - adds opinions ("budget too low"), IE7 team makes those calls

class SmartTemplateProcessor {
  constructor(mcpClient, templateFetcher, options = {}) {
    this.mcpClient = mcpClient;
    this.templateFetcher = templateFetcher;
    this.sopParser = new SOPParser();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = options.model || 'gpt-5';
    
    // PHASE 2: Advanced Reasoning Modules
    this.completenessChecker = new CompletenessChecker(mcpClient);
    this.sectionPrioritizer = new SectionPrioritizer();
    this.stakeholderOptimizer = new StakeholderOptimizer();
    // this.conflictDetector REMOVED - no opinion-based conflict detection
  }

  /**
   * Intelligently process template based on brief data
   * WHY THIS WORKS: Detects complexity, fetches right template, generates content intelligently
   * 
   * @param {string} databaseId - Notion database ID
   * @param {object} briefData - Brief data from n8n
   * @param {string} providedComplexity - Complexity level (from intelligent processor)
   * @param {array} preDetectedConflicts - Conflicts from Phase 3 intelligent processor (optional)
   */
  async processTemplate(databaseId, briefData, providedComplexity = null, preDetectedConflicts = []) {
    console.log('🧠 Starting intelligent template processing...');
    
    // Step 1: Use provided complexity (already validated by intelligent processor)
    let complexityLevel = providedComplexity;
    
    if (!complexityLevel) {
      console.log('🔍 No complexity level provided - detecting semantically...');
      complexityLevel = await this.detectComplexity(briefData);
      console.log(`✅ Detected complexity: ${complexityLevel}`);
    } else {
      console.log(`✅ Using validated complexity: ${complexityLevel}`);
    }
    
    // Step 2: Fetch the appropriate template
    console.log(`📄 Fetching template for complexity: ${complexityLevel}...`);
    const template = await this.templateFetcher.fetchTemplate(
      databaseId,
      null,
      complexityLevel
    );
    
    console.log(`✅ Template fetched: ${template.blockCount} blocks`);
    
    // Check if using LLM-only mode (no Notion template)
    if (template.isLLMOnly) {
      console.log('🤖 LLM-ONLY MODE DETECTED: Generating complete page structure from GPT-5');
      return await this.generateCompletePageFromLLM(briefData, complexityLevel, template, preDetectedConflicts);
    }
    
    // Step 3: Extract structured data from brief using LLM (Template mode)
    console.log('📊 Extracting structured data from brief...');
    const extractedData = await this.extractStructuredData(briefData, complexityLevel, template);
    
    console.log(`✅ Extracted ${Object.keys(extractedData).length} data fields`);
    console.log(`   - Urgency detected: ${extractedData.urgency_detected ? 'YES' : 'NO'}`);
    
    // ==== PHASE 2 & 3: ADVANCED REASONING ====
    
    // Step 3a: Use conflicts from Phase 3 intelligent processor (if provided)
    let conflicts = preDetectedConflicts || [];
    
    if (conflicts.length > 0) {
      console.log(`✅ Using ${conflicts.length} pre-detected conflicts from intelligent processor`);
      extractedData.conflicts = conflicts;
    } else {
      // NO FALLBACK CONFLICT DETECTION
      // The old ConflictDetector adds opinions ("budget too low", "timeline tight")
      // IE7 team makes those decisions themselves
      // Only factual contradictions (from intelligent-processor) should show
      conflicts = [];
      extractedData.conflicts = conflicts;
      console.log('✅ No pre-detected conflicts from intelligent processor');
    }
    
    // Step 3b: Completeness Assessment
    console.log('📋 Phase 2: Assessing brief completeness...');
    const completenessAssessment = await this.completenessChecker.assessCompleteness(
      { ...briefData, ...extractedData },
      complexityLevel,
      'content_request'
    );
    extractedData.completenessAssessment = completenessAssessment;
    
    if (completenessAssessment.softFlags.length > 0) {
      console.log(`   ⚠️ ${completenessAssessment.softFlags.length} soft flags identified`);
    }
    
    // Step 3c: Identify Novel Sections (content types not in template)
    const templateSectionNames = template.blocks
      .filter(b => b.type === 'heading_2')
      .map(b => b.heading_2.rich_text[0]?.plain_text || b.heading_2.rich_text[0]?.text?.content || '');
    
    const novelSections = this.sectionPrioritizer.identifyNovelSections(
      { ...briefData, ...extractedData },
      templateSectionNames
    );
    extractedData.novelSections = novelSections;
    
    console.log('✅ Phase 2: Advanced reasoning complete');
    
    // Step 4: Process template with section-level content generation
    console.log('📄 Processing template with section-level content generation...');
    const processedBlocks = await this.processTemplateWithContentGeneration(
      template.blocks,
      extractedData,
      briefData, // Pass original for fallback
      complexityLevel
    );
    
    console.log(`✅ Intelligent processing complete: ${processedBlocks.length} blocks created`);
    
    return processedBlocks;
  }

  /**
   * Detect complexity level semantically
   */
  async detectComplexity(briefData) {
    const prompt = `You are an intelligent content request complexity analyzer for IE7.

BRIEF DATA:
${JSON.stringify(briefData, null, 2)}

YOUR TASK:
Analyze this brief and determine its complexity level. Use **semantic understanding**, NOT hard rules.

COMPLEXITY LEVELS:
1. **Cup of Tea** - Simple, quick request
   - Minimal information needed
   - Straightforward execution
   - Examples: Social media post, quick edit, single platform

2. **Pizza** - Medium complexity
   - Moderate detail required
   - Some technical specs
   - Examples: Multi-platform content, branded video, moderate production

3. **3-Course Meal** - High complexity
   - Comprehensive planning needed
   - Multiple stakeholders
   - Detailed production logistics
   - Examples: Campaign content, full photoshoots, multi-deliverable projects

Return ONLY the complexity level name (exactly as written above).`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a complexity detection expert. Return only the complexity level name.' },
          { role: 'user', content: prompt }
        ],
        reasoning_effort: 'low',
        max_completion_tokens: 50
      });
      
      const complexity = response.choices[0].message.content.trim();
      const validLevels = ['Cup of Tea', 'Pizza', '3-Course Meal'];
      
      return validLevels.includes(complexity) ? complexity : 'Pizza';
      
    } catch (error) {
      console.error('❌ Complexity detection failed:', error.message);
      return 'Pizza';
    }
  }

  /**
   * Extract structured data from brief with complexity-aware prompting
   */
  async extractStructuredData(briefData, complexityLevel, template) {
    const prompt = `You are an intelligent data extractor for IE7 content operations.

BRIEF DATA:
${JSON.stringify(briefData, null, 2)}

DETECTED COMPLEXITY LEVEL: ${complexityLevel}

YOUR TASK:
Extract structured information following these rules:

1. **ADAPTIVE MODE**: Only extract fields that have actual data. Return null for missing information.

2. **MULTI-SIGNAL URGENCY DETECTION** (CRITICAL - ALWAYS CALCULATE):
   **IMPORTANT**: You MUST evaluate urgency for EVERY brief using ALL signals below.
   Return urgency object even if score is low. Never skip this step.
   
   Evaluate ALL these signals simultaneously and calculate weighted score:
   
   **Temporal Signals (0-10):**
   - "today"/"now"/"immediately" = 10
   - "tomorrow"/"by EOD"/"24 hours" = 9
   - "this week"/"2-3 days" = 7
   - "next week" = 5
   - "next month"/"Q1" = 2
   - Date math: If due date within 2 days of today = 9, within week = 7
   
   **Linguistic Intensity (0-10):**
   - ALL CAPS keywords ("URGENT", "ASAP") = 8
   - Repeated emphasis ("really really important") = 7
   - Imperative language ("must have", "need this") = 6
   - Consequence language ("or we'll lose", "critical for") = 8
   - Polite requests ("would be nice", "when possible") = 2
   
   **Business Context (0-10):**
   - "client-facing"/"external"/"public launch" = 7
   - "internal"/"test"/"exploratory" = 3
   - VIP mentions ("Idris needs", "CEO wants", "Daniel requires") = 9
   - Financial stakes mentioned ("£50k campaign", "major client") = 7
   - Named deadlines ("for tomorrow's meeting", "launch event") = 8
   
   **Calculate urgency_score** = (temporal × 0.4) + (linguistic × 0.3) + (business_context × 0.3)
   
   **Output (ALWAYS INCLUDE):**
   - urgency_detected: true if score ≥ 7, false otherwise
   - urgency_score: number (0-10, rounded to 1 decimal)
   - urgency_summary: FACTUAL statement for IE7 team (NOT your opinion/assessment)
     * Good: "Due November 28, 2025 (in 2 days)"
     * Good: "Needed for client meeting tomorrow"
     * Good: "Required for Q4 campaign launch next week"
     * BAD: "This timeline is tight" (opinion)
     * BAD: "Consider adjusting scope" (opinion)
   - urgency_level: "CRITICAL" (9-10), "HIGH" (7-8.9), "MEDIUM" (4-6.9), "LOW" (<4)
   
   **Example:**
   Brief received Oct 26: "URGENT: Need TODAY for meeting with Idris. £50k campaign at RISK."
   - Output: {
       "urgency_detected": true, 
       "urgency_score": 8.8, 
       "urgency_level": "HIGH", 
       "urgency_summary": "Needed today for meeting with Idris - £50k campaign"
     }
   
   **You MUST return an urgency object for every brief. Do not skip this.**

3. **PRESERVE STRUCTURE**: If data comes in structured (nested objects/arrays), preserve that structure.

4. **FIELD EXTRACTION** (Keep original structure + add semantic aliases):
   - Extract ALL fields from briefData
   - If you see "Raw Brief" → also add as "user_brain_dump"
   - If you see "Brief Details" → also add as "brief_details"
   - If you see nested structures, keep them nested
   - Add common semantic aliases for matching

5. **SEMANTIC INTELLIGENCE**:
   - Don't duplicate - if "Raw Brief" exists, don't need "user_brain_dump" separately
   - Consolidate intelligently
   - Keep original field names from brief

6. **CONTENT SYNTHESIS** (Like Notion AI):
   If information is scattered across the brief, AGGREGATE it:
   - Example: "vertical for Instagram" (paragraph 1) + "30-45 seconds" (paragraph 3) + "MP4 format" (paragraph 5)
     → Synthesize into one "Video Component" object with all specs together
   - Scan ENTIRE brief for relevant content, don't just look at field names
   - Group related information logically (duration, format, music, technical specs)
   
7. **IMPLIED KNOWLEDGE EXPANSION**:
   Add standard platform/technical specs when mentioned but not detailed:
   - "Instagram video" → Add: 9:16 aspect ratio, 1080x1920px, <60s duration (if not specified)
   - "Instagram carousel" → Add: 1080x1080px, up to 10 slides, JPG/PNG
   - Mark implied specs with confidence: {"value": "1080x1920px", "confidence": "implied_standard"}

8. **CONFLICT DETECTION**:
   Check for contradictions and flag them:
   - Timeline vs Scope: "need tomorrow" + "large multi-asset campaign" = CONFLICT
   - Budget vs Deliverables: "£500 budget" + "photoshoot + editing + animations" = CONFLICT
   - Multiple different values: "30 seconds" in one place, "60 seconds" elsewhere = AMBIGUITY
   - Output conflicts array: [{"type": "timeline_scope", "description": "...", "severity": "high"}]

Return ONLY valid JSON. Use null for missing fields. NO markdown, NO explanations.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a semantic data extraction expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'medium',
        max_completion_tokens: 4000
      });
      
      let responseText = response.choices[0].message.content.trim();
      
      if (responseText.includes('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const extracted = JSON.parse(responseText);
      
      // Remove null/empty fields
      const cleanedData = {};
      for (const [key, value] of Object.entries(extracted)) {
        if (value !== null && value !== undefined && value !== '') {
          cleanedData[key] = value;
        }
      }
      
      // PARSE NAN'S PRE-FORMATTED BRIEF_DETAILS if present
      // Check for both snake_case and camelCase versions
      const briefDetailsField = cleanedData.brief_details || cleanedData.briefDetails || cleanedData['brief_details'];
      
      if (briefDetailsField) {
        const parsedSections = this.parseBriefDetails(briefDetailsField);
        
        if (parsedSections) {
          console.log(`✨ Detected Nan-formatted brief_details - parsing into ${Object.keys(parsedSections).length} sections`);
          
          // Add each parsed section to cleanedData with descriptive keys
          for (const [sectionName, sectionContent] of Object.entries(parsedSections)) {
            // Transform section name to a usable key
            const sectionKey = sectionName.toLowerCase().replace(/\s+/g, '_');
            cleanedData[sectionKey] = sectionContent;
            console.log(`   ✅ Extracted section: "${sectionName}"`);
          }
          
          // Remove the original brief_details blob now that we've parsed it
          delete cleanedData.brief_details;
          delete cleanedData.briefDetails;
        }
      }
      
      return cleanedData;
      
    } catch (error) {
      console.error('❌ LLM extraction failed:', error.message);
      
      // Fallback: Basic extraction without debug text
      const dueDate = briefData['Due Dates'] || briefData['Due Date'] || briefData['Deadline'];
      let urgencySummary = null;
      
      // If there's a due date, show it (factual)
      if (dueDate && typeof dueDate === 'string') {
        urgencySummary = `Deadline: ${dueDate.replace('PUBLISH BY:', '').trim()}`;
      }
      
      return {
        ...briefData,
        urgency_detected: this.simpleUrgencyCheck(briefData),
        urgency_summary: urgencySummary // null if no deadline, factual if present
      };
    }
  }

  /**
   * Simple urgency check (fallback if LLM fails)
   */
  simpleUrgencyCheck(briefData) {
    const urgentKeywords = ['urgent', 'asap', '24-hour', 'rush', 'emergency', 'jamie needs', 'idris asking'];
    const dataString = JSON.stringify(briefData).toLowerCase();
    
    return urgentKeywords.some(keyword => dataString.includes(keyword));
  }

  /**
   * Process template with section-level content generation
   * WHY THIS WORKS: Matches headings to data, generates content blocks, not placeholder replacement
   */
  async processTemplateWithContentGeneration(templateBlocks, extractedData, originalBriefData, complexityLevel) {
    const finalBlocks = [];
    let currentSection = null;
    let sectionInstructions = null;
    let skipCurrentSection = false;
    
    // CRITICAL FIX FOR DUPLICATION: Remove brief_details from originalBriefData at the start
    // (brief_details was already parsed into individual sections in extractedData)
    const cleanOriginalData = {...originalBriefData};
    delete cleanOriginalData.brief_details;
    delete cleanOriginalData.briefDetails;
    delete cleanOriginalData['brief_details'];
    
    // Track which data fields were matched to sections
    const matchedDataFields = new Set();
    
    for (let i = 0; i < templateBlocks.length; i++) {
      const block = templateBlocks[i];
      const blockType = block.type;
      
      // HEADING = New section starts
      if (blockType.includes('heading')) {
        // IMPORTANT: Generate content for PREVIOUS section before starting new one
        if (!skipCurrentSection && currentSection && currentSection.data) {
          console.log(`📦 Generating content for section "${currentSection.heading}" (triggered by new heading)...`);
          console.log(`📊 Data type: ${Array.isArray(currentSection.data) ? 'Array' : typeof currentSection.data}`);
          if (typeof currentSection.data === 'object' && !Array.isArray(currentSection.data)) {
            console.log(`📊 Object keys: ${Object.keys(currentSection.data).join(', ')}`);
          }
          
          const contentBlocks = await this.generateContentBlocksForSection(
            currentSection.data,
            sectionInstructions,
            currentSection.heading
          );
          
          console.log(`✅ Generated ${contentBlocks.length} blocks for "${currentSection.heading}"`);
          finalBlocks.push(...contentBlocks);
        }
        
        const headingText = this.extractTextFromBlock(block);
        
        // Semantic match: does this heading have data?
        const matchResult = this.findMatchingDataForSectionWithTracking(headingText, extractedData, cleanOriginalData);
        
        if (!matchResult || !matchResult.data) {
          console.log(`⏭️  Skipping section: "${headingText}" (no data)`);
          skipCurrentSection = true;
          currentSection = { heading: headingText, skip: true, data: null };
          continue;
        }
        
        // Track which data field was matched
        if (matchResult.matchedKey) {
          matchedDataFields.add(matchResult.matchedKey);
        }
        
        // We have data for this section!
        console.log(`✅ Including section: "${headingText}" (data found)`);
        skipCurrentSection = false;
        currentSection = { 
          heading: headingText, 
          skip: false, 
          data: matchResult.data,
          headingBlock: block
        };
        sectionInstructions = null; // Reset for new section
        
        // Add heading
        finalBlocks.push(block);
        continue;
      }
      
      // TOGGLE = Section-specific instructions (MCP only, not displayed)
      if (blockType === 'toggle') {
        if (skipCurrentSection) continue;
        
        const toggleText = this.extractTextFromBlock(block);
        console.log(`📋 Reading toggle: "${toggleText}"`);
        
        const toggleInstructions = await this.readToggleInstructions(block);
        sectionInstructions = {
          toggleText,
          instructions: toggleInstructions,
          section: currentSection?.heading
        };
        
        // DON'T add toggle to final output - it's for MCP only
        continue;
      }
      
      // DIVIDER = Section boundary - generate content for previous section
      if (blockType === 'divider') {
        if (!skipCurrentSection && currentSection && currentSection.data) {
          // DEBUG: Log what data we're expanding
          console.log(`📦 Generating content for section "${currentSection.heading}"...`);
          console.log(`📊 Data type: ${Array.isArray(currentSection.data) ? 'Array' : typeof currentSection.data}`);
          if (typeof currentSection.data === 'object' && !Array.isArray(currentSection.data)) {
            console.log(`📊 Object keys: ${Object.keys(currentSection.data).join(', ')}`);
          }
          
          // Generate content blocks for this section before the divider
          const contentBlocks = await this.generateContentBlocksForSection(
            currentSection.data,
            sectionInstructions,
            currentSection.heading
          );
          
          console.log(`✅ Generated ${contentBlocks.length} blocks for "${currentSection.heading}"`);
          finalBlocks.push(...contentBlocks);
        }
        
        if (!skipCurrentSection) {
          finalBlocks.push(block);
        }
        
        // Reset section context
        currentSection = null;
        sectionInstructions = null;
        skipCurrentSection = false;
        continue;
      }
      
      // REGULAR CONTENT BLOCK - skip if we're in a section with data (we'll generate instead)
      if (skipCurrentSection) continue;
      
      // If this section has data, we'll generate content at the divider
      // For now, skip template content blocks
      if (currentSection && currentSection.data) {
        continue; // We'll generate content blocks at divider
      }
      
      // If no data for section but not skipping, keep template blocks as-is
      if (this.blockHasContent(block)) {
        finalBlocks.push(block);
      }
    }
    
    // Handle last section if no divider at end
    if (!skipCurrentSection && currentSection && currentSection.data) {
      const contentBlocks = await this.generateContentBlocksForSection(
        currentSection.data,
        sectionInstructions,
        currentSection.heading
      );
      finalBlocks.push(...contentBlocks);
    }
    
    // ADDITIONAL INFORMATION: Collect any unmatched data fields
    const allDataFields = {...extractedData, ...cleanOriginalData};
    const unmatchedFields = {};
    
      // Skip system fields, internal data, and debug info (not client-facing)
      // IE7 TEAM FILTER: Only include data that helps them execute the work
      // Remove ALL internal metadata, property duplicates, and already-processed content
      const systemFields = [
        // Urgency metadata (shown as callouts, not in content)
        'urgency_detected', 'urgency_summary', 'urgency_score', 'urgency_level', 'urgency',
        
        // Conflict metadata (shown as callouts, not in content)
        'conflicts',
        
        // Completeness metadata (PHASE 2 - internal workflow only)
        'completenessAssessment', 'softFlags', 'criticalMissing', 'normalTBDs',
        'complexityAppropriate', 'complete',
        
        // Novel sections metadata (PHASE 2 - template matching debug info)
        'novelSections',
        
        // Intent/confidence scores (internal AI metrics)
        'intent_rating', 'confidence', 'semantic_score',
        
        // Smart defaults metadata (PHASE 3)
        'editing_style', // Applied silently, not shown
        'quality_level', // Inferred quality standard
        
        // Complexity metadata (should be in properties, not content)
        'complexity level', 'complexityLevel', 'complexity_level',
        
        // Duplicate content
        'user_brain_dump', // Duplicate of Raw Brief
        'Raw Brief', 'raw_brief', 'rawBrief', // Will be in its own section
        'Project Name', 'project_name', 'projectName', // In properties
        
        // Property data (ALREADY in page database properties - don't repeat in content)
        'Client Name', 'client_name', 'clientName',
        'Company Name', 'company_name', 'companyName',
        'USER ID', 'user_id', 'userId', 'User_Number', 'User Number',
        'Contact Email', 'contact_email', 'contactEmail', 'Client Email',
        'Category', 'category',
        'Asset Type', 'asset_type', 'assetType',
        'Desired Date', 'desired_date', 'Due Dates', 'due_date', 'dueDate',
        'interaction notes', 'interactionNotes', 'interaction_notes',
        'Requested Priority', 'requested_priority',
        'Freelancer Needed?', 'freelancer_needed',
        'Freelancer Allocated', 'freelancer_allocated',
        'Accept Brief?', 'accept_brief',
        'Media Link', 'media_link',
        
        // Parsed content (already processed into sections)
        'brief_details', 'briefDetails'
      ];
    
    for (const [key, value] of Object.entries(allDataFields)) {
      if (!matchedDataFields.has(key) && !systemFields.includes(key) && value) {
        unmatchedFields[key] = value;
      }
    }
    
    // If there's unmatched data, create "Additional Information" section with BEAUTIFUL formatting
    if (Object.keys(unmatchedFields).length > 0) {
      console.log(`📦 Creating "Additional Information" section with ${Object.keys(unmatchedFields).length} unmatched fields`);
      console.log(`📊 Unmatched fields: ${Object.keys(unmatchedFields).join(', ')}`);
      
      // Add divider before Additional Information
      finalBlocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
      
      // Add main heading
      finalBlocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{
            type: 'text',
            text: { content: '📋 Additional Information' },
            annotations: { bold: true }
          }]
        }
      });
      
      // Generate content for EACH unmatched field with its own beautiful header
      for (const [key, value] of Object.entries(unmatchedFields)) {
        // Skip if value is null/undefined/empty
        if (!value) continue;
        
        // Create human-readable sub-header for this field
        const humanHeader = this.humanizeKey(key);
        
        finalBlocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{
              type: 'text',
              text: { content: humanHeader },
              annotations: { bold: true }
            }]
          }
        });
        
        // Generate beautifully formatted content blocks for this field
        const fieldBlocks = await this.generateContentBlocksForSection(
          value,
          null,
          humanHeader,
          0 // Start at depth 0 for clean formatting
        );
        
        finalBlocks.push(...fieldBlocks);
      }
      
      console.log(`✅ Added beautifully formatted "Additional Information" section`);
    }
    
    // Add urgency callout at the VERY TOP if genuinely urgent
    // CLIENT-FACING PRINCIPLE: Simple, action-oriented, no technical scores
    const urgencyData = extractedData.urgency || extractedData;
    const urgencyDetected = urgencyData.urgency_detected || extractedData.urgency_detected;
    
    if (urgencyDetected) {
      const urgencyLevel = urgencyData.urgency_level || extractedData.urgency_level || 'HIGH';
      const urgencyMessage = urgencyData.urgency_summary || extractedData.urgency_summary || 'This request requires immediate attention';
      
      // Select color and emoji based on urgency level
      const urgencyConfig = {
        'CRITICAL': { emoji: '🚨', color: 'red_background', prefix: 'CRITICAL DEADLINE' },
        'HIGH': { emoji: '⚠️', color: 'orange_background', prefix: 'URGENT DEADLINE' },
        'MEDIUM': { emoji: '⏰', color: 'yellow_background', prefix: 'TIME-SENSITIVE' }
      };
      
      const config = urgencyConfig[urgencyLevel] || urgencyConfig['HIGH'];
      
      // Clean, professional callout (no scores, no "detected via" language)
      finalBlocks.unshift({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{
            type: 'text',
            text: { content: `**${config.prefix}:** ${urgencyMessage}` },
            annotations: { bold: false }
          }],
          icon: { type: 'emoji', emoji: config.emoji },
          color: config.color
        }
      });
      
      console.log(`${config.emoji} ${urgencyLevel} urgency callout added`);
    }
    
    // Add conflict/risk callouts if detected (Phase 3: Natural Language Format)
    // Handles both intelligent processor format (emoji, title, message) and legacy format
    if (extractedData.conflicts && Array.isArray(extractedData.conflicts) && extractedData.conflicts.length > 0) {
      for (const conflict of extractedData.conflicts) {
        // Check if this is the new natural language format from intelligent processor
        if (conflict.emoji && conflict.title && conflict.message) {
          // Phase 3: Natural language format (client-friendly)
          const calloutText = `**${conflict.title}**\n\n${conflict.message}`;
          
          finalBlocks.unshift({
            object: 'block',
            type: 'callout',
            callout: {
              rich_text: [{
                type: 'text',
                text: { content: calloutText },
                annotations: { bold: false }
              }],
              icon: { type: 'emoji', emoji: conflict.emoji },
              color: 'orange_background' // Professional neutral color
            }
          });
          
          console.log(`${conflict.emoji} Conflict callout added: ${conflict.title}`);
        } else {
          // Legacy format from ConflictDetector (fallback)
          const severityConfig = {
            'high': { emoji: '⚠️', color: 'red_background' },
            'medium': { emoji: '⚠️', color: 'orange_background' },
            'low': { emoji: '💡', color: 'yellow_background' }
          };
          
          const config = severityConfig[conflict.severity] || severityConfig['medium'];
          
          // Create conflict callout with recommendation
          const calloutText = conflict.recommendation 
            ? `${conflict.type.toUpperCase().replace(/_/g, ' ')}: ${conflict.description}\n\n💡 ${conflict.recommendation}`
            : `${conflict.type.toUpperCase().replace(/_/g, ' ')}: ${conflict.description}`;
          
          finalBlocks.unshift({
            object: 'block',
            type: 'callout',
            callout: {
              rich_text: [{
                type: 'text',
                text: { content: calloutText },
                annotations: { bold: true }
              }],
              icon: { type: 'emoji', emoji: config.emoji },
              color: config.color
            }
          });
          
          console.log(`⚠️ Conflict callout added: ${conflict.type} (${conflict.severity})`);
        }
      }
    }
    
    // CLIENT-FACING PRINCIPLE: Completeness and novel sections are internal workflow
    // They help US manage the project, not the client execute it
    // Therefore, we don't show these as callouts on the client-facing page
    
    return finalBlocks;
  }

  /**
   * Find matching data for a section heading (semantic)
   * WHY THIS WORKS: Flexible matching handles varied field names
   */
  /**
   * Find matching data WITH TRACKING - returns {data, matchedKey}
   * ENHANCED: Smart section mapping with priority sections
   */
  findMatchingDataForSectionWithTracking(headingText, extractedData, originalBriefData) {
    const cleanHeading = headingText.replace(/[^\w\s]/g, '').trim();
    const normalize = (str) => str.toLowerCase().replace(/[_\s-]/g, '');
    const normalizedHeading = normalize(cleanHeading);
    
    // PRIORITY SECTIONS: Always fill these with smart data aggregation
    // WHY THIS WORKS: These sections should appear in every brief, filled intelligently
    
    if (normalizedHeading.includes('keydetails') || normalizedHeading.includes('key details')) {
      // Key Details = dates, priority, client info, complexity
      const keyDetailsData = {
        dates: originalBriefData['Due Dates'] || originalBriefData['dates'] || extractedData.dates,
        client: originalBriefData['Client Name'] || extractedData.client_name,
        email: originalBriefData['Client Email'] || originalBriefData['Contact Email'],
        company: originalBriefData['Company Name'] || extractedData.company_name,
        priority: extractedData.priority || extractedData.urgency_level,
        complexity: extractedData.complexity_level,
        userId: originalBriefData['User_Number'] || originalBriefData['USER ID']
      };
      
      // Remove undefined values
      Object.keys(keyDetailsData).forEach(k => keyDetailsData[k] === undefined && delete keyDetailsData[k]);
      
      if (Object.keys(keyDetailsData).length > 0) {
        console.log(`🎯 SMART MAPPING: "Key Details" ← dates, client, priority`);
        return { data: keyDetailsData, matchedKey: '_smart_key_details' };
      }
    }
    
    if (normalizedHeading.includes('reference') || normalizedHeading.includes('embed')) {
      // References = any URLs found in the brief
      const allData = {...originalBriefData, ...extractedData};
      const urls = [];
      
      for (const [key, value] of Object.entries(allData)) {
        if (typeof value === 'string') {
          const urlMatches = value.match(/https?:\/\/[^\s]+/g);
          if (urlMatches) {
            urls.push(...urlMatches);
          }
        }
      }
      
      if (urls.length > 0) {
        console.log(`🎯 SMART MAPPING: "References" ← ${urls.length} URLs detected`);
        return { data: { urls: [...new Set(urls)] }, matchedKey: '_smart_references' };
      }
    }
    
    if (normalizedHeading.includes('notes') || normalizedHeading.includes('considerations') || normalizedHeading.includes('context')) {
      // Notes = interaction notes, everything_else, additional context
      const notesData = {
        interaction_notes: originalBriefData['interaction notes'] || originalBriefData['Interaction Notes'],
        additional_context: originalBriefData['everything_else'] || originalBriefData['Everything_else'],
        conversation_summary: extractedData.conversation_summary
      };
      
      Object.keys(notesData).forEach(k => notesData[k] === undefined && delete notesData[k]);
      
      if (Object.keys(notesData).length > 0) {
        console.log(`🎯 SMART MAPPING: "Notes" ← interaction notes, context`);
        return { data: notesData, matchedKey: '_smart_notes' };
      }
    }
    
    if (normalizedHeading.includes('rawbrief') || normalizedHeading.includes('raw brief')) {
      // Raw Brief = the original request text
      const rawBrief = originalBriefData['Raw Brief'] || originalBriefData['raw_brief'] || originalBriefData['rawBrief'];
      if (rawBrief) {
        console.log(`🎯 SMART MAPPING: "Raw Brief" ← Raw Brief field`);
        return { data: rawBrief, matchedKey: 'Raw Brief' };
      }
    }
    
    if (normalizedHeading.includes('briefdetails') || normalizedHeading.includes('brief details') || normalizedHeading.includes('details')) {
      // Brief Details = the structured brief_details field
      const briefDetails = originalBriefData['brief_details'] || originalBriefData['Brief Details'];
      if (briefDetails) {
        console.log(`🎯 SMART MAPPING: "Brief Details" ← brief_details field`);
        return { data: briefDetails, matchedKey: 'brief_details' };
      }
    }
    
    // STANDARD MATCHING (existing logic)
    
    // Try exact match
    if (extractedData[cleanHeading]) return { data: extractedData[cleanHeading], matchedKey: cleanHeading };
    if (originalBriefData[cleanHeading]) return { data: originalBriefData[cleanHeading], matchedKey: cleanHeading };
    
    // Try normalized exact match
    for (const [key, value] of Object.entries({...extractedData, ...originalBriefData})) {
      if (normalize(key) === normalizedHeading) {
        return { data: value, matchedKey: key };
      }
    }
    
    // Try substring contains
    for (const [key, value] of Object.entries({...extractedData, ...originalBriefData})) {
      const normKey = normalize(key);
      if ((normKey.includes(normalizedHeading) || normalizedHeading.includes(normKey)) && normKey.length > 3) {
        return { data: value, matchedKey: key };
      }
    }
    
    // Try semantic matching
    const result = this.semanticMatchWithKey(cleanHeading, extractedData, originalBriefData);
    return result;
  }

  /**
   * SEMANTIC SECTION MATCHING
   * Uses LLM to intelligently match template sections to data fields
   * WHY THIS WORKS: Understands meaning, not just string comparison
   */
  findMatchingDataForSection(headingText, extractedData, originalBriefData) {
    // Clean heading text (remove emojis, extra spaces)
    const cleanHeading = headingText.replace(/[^\w\s]/g, '').trim();
    
    // Quick optimization: Try direct key matches first (fast path)
    const normalize = (str) => str.toLowerCase().replace(/[_\s-]/g, '');
    const normalizedHeading = normalize(cleanHeading);
    
    // Fast path 1: Exact match
    if (extractedData[cleanHeading]) return extractedData[cleanHeading];
    if (originalBriefData[cleanHeading]) return originalBriefData[cleanHeading];
    
    // Fast path 2: Normalized exact match
    for (const [key, value] of Object.entries({...extractedData, ...originalBriefData})) {
      if (normalize(key) === normalizedHeading) {
        return value;
      }
    }
    
    // Fast path 3: Substring contains
    for (const [key, value] of Object.entries({...extractedData, ...originalBriefData})) {
      const normKey = normalize(key);
      const normHeading = normalizedHeading;
      if ((normKey.includes(normHeading) || normHeading.includes(normKey)) && normKey.length > 3) {
        return value;
      }
    }
    
    // SEMANTIC MATCHING: Use fuzzy matching for intelligent section detection
    // This handles cases like "📋 Brief Details" matching to "Brief Details" or "brief_details"
    return this.semanticMatch(cleanHeading, extractedData, originalBriefData);
  }
  
  /**
   * Semantic match WITH KEY tracking - returns {data, matchedKey}
   */
  semanticMatchWithKey(sectionHeading, extractedData, originalBriefData) {
    const allData = {...extractedData, ...originalBriefData};
    const dataKeys = Object.keys(allData);
    
    if (dataKeys.length === 0) return null;
    
    const headingLower = sectionHeading.toLowerCase();
    
    const semanticMappings = {
      'details': ['brief details', 'key details', 'overview', 'summary', 'description', 'project details', 'scope', 'requirements'],
      'production': ['video component', 'shoot requirements', 'production logistics', 'filming', 'recording', 'video details', 'video requirements'],
      'logistics': ['production', 'shoot', 'video component', 'delivery', 'timeline', 'schedule', 'workflow'],
      'budget': ['budget allocation', 'cost', 'pricing', 'financial', 'money', 'budget conflict', 'scope issue'],
      'technical': ['specifications', 'tech specs', 'format', 'resolution', 'video component', 'video details', 'technical requirements'],
      'creative': ['creative direction', 'visual style', 'aesthetic', 'design', 'branding', 'mood', 'look', 'feel'],
      'approval': ['approval workflow', 'review process', 'sign-off', 'timeline'],
      'attachments': ['files', 'documents', 'assets', 'materials', 'resources', 'references'],
      'notes': ['notes', 'considerations', 'important', 'additional info', 'scope issue', 'conflict']
    };
    
    // Check semantic mappings
    for (const [concept, keywords] of Object.entries(semanticMappings)) {
      if (headingLower.includes(concept)) {
        for (const key of dataKeys) {
          const keyLower = key.toLowerCase();
          for (const keyword of keywords) {
            if (keyLower.includes(keyword)) {
              console.log(`🔗 Semantic match: "${sectionHeading}" → "${key}"`);
              return { data: allData[key], matchedKey: key };
            }
          }
        }
      }
    }
    
    // String similarity matching
    for (const key of dataKeys) {
      const keyLower = key.toLowerCase().replace(/[_\s-]/g, '');
      const headingNorm = headingLower.replace(/[_\s-]/g, '');
      
      if (this.stringSimilarity(keyLower, headingNorm) > 0.7) {
        return { data: allData[key], matchedKey: key };
      }
    }
    
    // Word matching
    const headingWords = headingLower.split(/\s+/).filter(w => w.length > 3);
    for (const key of dataKeys) {
      const keyLower = key.toLowerCase();
      const matchCount = headingWords.filter(word => keyLower.includes(word)).length;
      if (matchCount >= Math.min(2, headingWords.length)) {
        return { data: allData[key], matchedKey: key };
      }
    }
    
    return null;
  }

  /**
   * Semantic match using intelligent reasoning
   * Returns best matching data for a section heading
   */
  semanticMatch(sectionHeading, extractedData, originalBriefData) {
    // Combine all available data
    const allData = {...extractedData, ...originalBriefData};
    const dataKeys = Object.keys(allData);
    
    // If no data, return null
    if (dataKeys.length === 0) return null;
    
    // Simple heuristic matching for common cases (no LLM needed)
    const headingLower = sectionHeading.toLowerCase();
    
    // SMART SEMANTIC MAPPINGS - understand meaning, not just text
    const semanticMappings = {
      'details': ['brief details', 'key details', 'overview', 'summary', 'description', 'project details', 'scope', 'requirements'],
      'production': ['video component', 'shoot requirements', 'production logistics', 'filming', 'recording', 'video details', 'video requirements'],
      'logistics': ['production', 'shoot', 'video component', 'delivery', 'timeline', 'schedule', 'workflow'],
      'budget': ['budget allocation', 'cost', 'pricing', 'financial', 'money', 'budget conflict', 'scope issue'],
      'technical': ['specifications', 'tech specs', 'format', 'resolution', 'video component', 'video details', 'technical requirements'],
      'creative': ['creative direction', 'visual style', 'aesthetic', 'design', 'branding', 'mood', 'look', 'feel'],
      'approval': ['approval workflow', 'review process', 'sign-off', 'timeline'],
      'attachments': ['files', 'documents', 'assets', 'materials', 'resources', 'references'],
      'notes': ['notes', 'considerations', 'important', 'additional info', 'scope issue', 'conflict']
    };
    
    // Check semantic mappings first
    for (const [concept, keywords] of Object.entries(semanticMappings)) {
      if (headingLower.includes(concept)) {
        for (const key of dataKeys) {
          const keyLower = key.toLowerCase();
          for (const keyword of keywords) {
            if (keyLower.includes(keyword)) {
              console.log(`🔗 Semantic match: "${sectionHeading}" → "${key}"`);
              return allData[key];
            }
          }
        }
      }
    }
    
    // Check for obvious matches
    for (const key of dataKeys) {
      const keyLower = key.toLowerCase().replace(/[_\s-]/g, '');
      const headingNorm = headingLower.replace(/[_\s-]/g, '');
      
      // If 70%+ similarity in characters (lowered from 80%)
      if (this.stringSimilarity(keyLower, headingNorm) > 0.7) {
        return allData[key];
      }
    }
    
    // Check if any data field contains the heading words
    const headingWords = headingLower.split(/\s+/).filter(w => w.length > 3);
    for (const key of dataKeys) {
      const keyLower = key.toLowerCase();
      const matchCount = headingWords.filter(word => keyLower.includes(word)).length;
      if (matchCount >= Math.min(2, headingWords.length)) {
        return allData[key];
      }
    }
    
    return null;
  }
  
  /**
   * Calculate string similarity (0-1)
   */
  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Levenshtein distance for fuzzy matching
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
   * SMART FILE HANDLING
   * Detects URLs and creates appropriate visual blocks
   * WHY THIS WORKS: Makes pages more visual and engaging
   */
  async extractAndCreateMediaBlocks(content) {
    const blocks = [];
    
    // Detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex) || [];
    
    if (urls.length === 0) return blocks;
    
    for (const url of urls) {
      // Image URLs - create image block
      if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url)) {
        blocks.push({
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: url.trim() }
          }
        });
      }
      // Video URLs (YouTube, Vimeo, etc) - create embed
      else if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/i.test(url)) {
        blocks.push({
          object: 'block',
          type: 'embed',
          embed: { url: url.trim() }
        });
      }
      // Google Drive links - create bookmark
      else if (/drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com/i.test(url)) {
        blocks.push({
          object: 'block',
          type: 'bookmark',
          bookmark: { url: url.trim() }
        });
      }
      // Other URLs - create link block
      else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: '🔗 ', link: null }
            }, {
              type: 'text',
              text: { content: url, link: { url } },
              annotations: { underline: true, color: 'blue' }
            }]
          }
        });
      }
    }
    
    return blocks;
  }

  /**
   * Intelligent content splitting at natural break points
   * WHY THIS WORKS: Splits at paragraphs/sentences, not arbitrary character counts
   */
  intelligentSplit(content, maxChars) {
    const chunks = [];
    
    // First try to split by double newlines (paragraphs)
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    
    for (const para of paragraphs) {
      // If adding this paragraph would exceed limit, save current chunk and start new one
      if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    
    // Add remaining chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // If any chunk is still too long, split by sentences
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxChars) {
        finalChunks.push(chunk);
      } else {
        // Split by sentences
        const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length > maxChars && sentenceChunk.length > 0) {
            finalChunks.push(sentenceChunk.trim());
            sentenceChunk = sentence;
          } else {
            sentenceChunk += sentence;
          }
        }
        
        if (sentenceChunk.trim()) {
          finalChunks.push(sentenceChunk.trim());
        }
      }
    }
    
    return finalChunks.length > 0 ? finalChunks : [content.substring(0, maxChars)];
  }

  /**
   * Smart content summarization (ONLY used when Notion blocks content)
   * WHY THIS WORKS: Preserves important details while managing length
   */
  async smartSummarize(content, currentLength) {
    // Don't summarize if under 3000 characters
    if (currentLength < 3000) return content;
    
    let targetPercentage;
    if (currentLength < 5000) {
      targetPercentage = 75; // Keep 75%
    } else if (currentLength < 10000) {
      targetPercentage = 60; // Keep 60%
    } else {
      targetPercentage = 50; // Keep 50%
    }
    
    const targetLength = Math.floor(currentLength * (targetPercentage / 100));
    
    try {
      const prompt = `Condense the following content to approximately ${targetPercentage}% of its length while preserving ALL key information.

CURRENT LENGTH: ${currentLength} characters
TARGET LENGTH: ~${targetLength} characters

CONTENT:
${content}

RULES:
- Keep all important details, dates, numbers, names
- Remove redundancy and unnecessary elaboration
- Maintain clarity and readability
- Don't lose critical information

Return ONLY the condensed content, no explanations.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an expert at concise summarization while preserving key details.' },
          { role: 'user', content: prompt }
        ],
        reasoning_effort: 'low',
        max_completion_tokens: Math.floor(targetLength / 3)
      });
      
      const summarized = response.choices[0].message.content.trim();
      return `${summarized}\n\n_*(Content intelligently condensed from ${currentLength} to ${summarized.length} characters while preserving key details)*_`;
      
    } catch (error) {
      console.warn('⚠️ Summarization failed, using original:', error.message);
      return content;
    }
  }

  /**
   * Parse n8n's pre-formatted brief_details into structured sections (FLEXIBLE)
   * WHY THIS WORKS: n8n might output ANY headers - we detect and parse dynamically
   * 
   * IMPORTANT: This is NOT rigid. We detect ANY section headers (lines ending with :)
   * We don't assume specific header names. Headers can be anything n8n outputs.
   */
  parseBriefDetails(briefDetailsText) {
    if (typeof briefDetailsText !== 'string' || briefDetailsText.trim().length === 0) return null;
    
    const sections = {};
    const lines = briefDetailsText.split('\n');
    let currentSection = null;
    let currentContent = [];
    let foundAnyHeader = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect section header: line ends with colon, not a bullet point, has reasonable length
      const isHeader = trimmed.endsWith(':') && 
                       !trimmed.startsWith('*') && 
                       !trimmed.startsWith('-') &&
                       trimmed.length > 2 && 
                       trimmed.length < 100; // Headers shouldn't be super long
      
      if (isHeader) {
        foundAnyHeader = true;
        
        // Save previous section if exists
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        
        // Start new section (remove the trailing colon)
        currentSection = trimmed.slice(0, -1).trim();
        currentContent = [];
      } else if (currentSection && trimmed.length > 0) {
        // Add content to current section
        currentContent.push(line);
      } else if (!currentSection && trimmed.length > 0 && !foundAnyHeader) {
        // Content before any headers - save to "Introduction" or skip
        if (!sections['Introduction']) {
          sections['Introduction'] = [];
        }
        if (Array.isArray(sections['Introduction'])) {
          sections['Introduction'].push(line);
        }
      }
    }
    
    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }
    
    // Finalize Introduction if it exists
    if (Array.isArray(sections['Introduction'])) {
      sections['Introduction'] = sections['Introduction'].join('\n').trim();
    }
    
    // If we found headers, return parsed sections
    if (foundAnyHeader && Object.keys(sections).length > 0) {
      console.log(`✨ Detected structured brief_details with ${Object.keys(sections).length} sections:`);
      console.log(`   📋 Sections: ${Object.keys(sections).join(', ')}`);
      return sections;
    }
    
    // No headers found - return null (semantic matching will handle it as one blob)
    console.log(`📝 No section headers detected in brief_details - will process as single block`);
    return null;
  }

  /**
   * Convert markdown-style bullets to proper content
   */
  parseMarkdownBullets(text) {
    if (typeof text !== 'string') return text;
    
    const lines = text.split('\n');
    const items = [];
    let currentParagraph = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if line is a bullet (starts with * or -)
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        // Save any accumulated paragraph
        if (currentParagraph.length > 0) {
          items.push({ type: 'paragraph', content: currentParagraph.join(' ').trim() });
          currentParagraph = [];
        }
        
        // Add bullet item (remove the * or - prefix)
        const bulletContent = trimmed.replace(/^[\*\-]\s*/, '').trim();
        if (bulletContent.length > 0) {
          items.push({ type: 'bullet', content: bulletContent });
        }
      } else if (trimmed.length > 0) {
        // Regular line - add to current paragraph
        currentParagraph.push(trimmed);
      } else if (currentParagraph.length > 0) {
        // Empty line - end current paragraph
        items.push({ type: 'paragraph', content: currentParagraph.join(' ').trim() });
        currentParagraph = [];
      }
    }
    
    // Save any remaining paragraph
    if (currentParagraph.length > 0) {
      items.push({ type: 'paragraph', content: currentParagraph.join(' ').trim() });
    }
    
    return items;
  }

  /**
   * Transform technical keys into beautiful, human-readable headers
   * WHY THIS WORKS: Client-facing pages need professional formatting, not debug keys
   */
  humanizeKey(key) {
    // Special mappings for known technical terms
    const specialMappings = {
      'video_component': '🎥 Video Component',
      'user_id': 'User ID',
      'USER ID': 'User ID',
      'project_name': 'Project Name',
      'raw_brief': 'Raw Brief',
      'budget_conflict': '💰 Budget & Scope Notes',
      'scope_issue': '⚠️ Scope Considerations',
      'platforms': '📱 Platforms',
      'contact': '📧 Contact Information',
      'video_details': '🎥 Video Requirements',
      'video_requirements': '🎥 Video Requirements',
      'audio_requirements': '🎵 Audio Requirements',
      'creative_direction': '🎨 Creative Direction',
      'technical_specs': '⚙️ Technical Specifications',
      'deliverables': '📦 Deliverables',
      'timeline': '📅 Timeline',
      'budget': '💰 Budget'
    };
    
    const lowerKey = key.toLowerCase();
    
    // Check special mappings first
    if (specialMappings[lowerKey]) {
      return specialMappings[lowerKey];
    }
    
    // Transform snake_case or camelCase to Title Case
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1') // Split camelCase
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * FIX 3: Parse markdown (bold **text**) to Notion rich_text annotations
   * WHY THIS WORKS: Converts **Budget:** to proper bold rendering in Notion
   */
  parseMarkdownToRichText(text, forceItalic = false) {
    const richText = [];
    
    // Split by **bold** markdown
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    for (const part of parts) {
      if (!part) continue;
      
      // Check if this part is bold (**text**)
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2); // Remove ** markers
        richText.push({
          type: 'text',
          text: { content: boldText },
          annotations: forceItalic ? { bold: true, italic: true } : { bold: true }
        });
      } else {
        // Regular text (or italic if forceItalic)
        richText.push({
          type: 'text',
          text: { content: part },
          annotations: forceItalic ? { italic: true } : {}
        });
      }
    }
    
    // If no markdown found, return simple rich_text
    if (richText.length === 0) {
      return [{
        type: 'text',
        text: { content: text },
        annotations: forceItalic ? { italic: true } : {}
      }];
    }
    
    return richText;
  }

  /**
   * Add confidence marker to text if data includes confidence level
   * WHY THIS WORKS: Signals to users when we're making educated guesses
   */
  addConfidenceMarker(text, dataItem) {
    // Check if data is an object with confidence field
    if (typeof dataItem === 'object' && dataItem !== null && dataItem.confidence) {
      const markers = {
        'implied_standard': '*(industry standard - confirm if needed)*',
        'inferred': '*(inferred from context - please verify)*',
        'estimated': '*(estimated - confirm with client)*',
        'suggested': '*(suggested default - adjust as needed)*'
      };
      
      const marker = markers[dataItem.confidence] || '*(please confirm)*';
      return `${dataItem.value || text} ${marker}`;
    }
    
    return text;
  }

  /**
   * SEMANTIC CONTENT ORGANIZER (Phase 3 Enhancement)
   * Uses LLM to organize complex data with proper hierarchy and client-friendly presentation
   * WHY THIS WORKS: Transforms mechanical dumps into professional, organized content
   */
  async organizeContentWithLLM(data, sectionHeading) {
    // Only use LLM organization for complex objects with multiple fields
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null; // Fall back to mechanical generation
    }
    
    const fieldCount = Object.keys(data).length;
    if (fieldCount < 3) {
      return null; // Too simple for LLM organization
    }
    
    try {
      const prompt = `You are organizing a brief for the IE7 internal creative team (or trusted freelancers). They need this information to execute the work.

SECTION: ${sectionHeading || 'Information'}

DATA:
${JSON.stringify(data, null, 2)}

YOUR TASK:
Organize this data semantically - group related information by MEANING, not by field name.

**IE7 TEAM FILTER:** For EVERY piece of data, ask: "Does the IE7 team need this to execute the work?"
- ✅ Include: What to create, when, where, how, who to contact, budget, specs
- ❌ Exclude: System metadata, scores, internal processing info, data already in properties

**ADAPTIVE STRUCTURE:** Match sections to content type:
- Event (gala, launch, etc.) → "📅 Event Schedule & Logistics", "📸 Capture Requirements", "💼 Production Details"
- Video shoot/edit → "🎥 Video Requirements", "🎬 Edit Specifications", "💼 Production Details"
- Photography → "📸 Photography Requirements", "🎯 Shot List", "💼 Production Details"
- Graphic design → "🎨 Design Requirements", "📐 Specifications", "💼 Production Details"

**SEMANTIC GROUPING EXAMPLES:**
- Event date + venue + timeline + capacity = "📅 Event Schedule & Logistics"
- What to capture + creative direction + exclusions = "📸 Photography Requirements"
- Budget + contact + delivery = "💼 Production Details"

**FORMATTING RULES:**
1. Use H2 (heading_2) for major sections with emojis
2. Use H3 (heading_3) for subsections within major sections
3. Use **bold:** for key-value pairs (e.g., "**Budget:** £2,500")
4. Use bullets for lists
5. Add dividers between major sections
6. NO asterisks (**)  - use bold_prefix for proper rendering

**OUTPUT FORMAT:**
Return JSON with "blocks" array:
{
  "blocks": [
    {"type": "heading_2", "content": "📅 Event Schedule & Logistics"},
    {"type": "paragraph", "content": "£2,500", "bold_prefix": "Budget:"},
    {"type": "bulleted_list", "items": ["Item 1", "Item 2"]},
    {"type": "divider"}
  ]
}

CRITICAL: Return ONLY valid JSON. No explanations. No markdown in content.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an expert at organizing information for professional briefs. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'medium',
        max_completion_tokens: 2000
      });
      
      let responseText = response.choices[0].message.content.trim();
      
      // Clean up response
      if (responseText.includes('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      // Parse response - expect {blocks: [...]} or direct array
      const parsed = JSON.parse(responseText);
      const organizedBlocks = parsed.blocks || parsed;
      
      if (!Array.isArray(organizedBlocks) || organizedBlocks.length === 0) {
        console.log('⚠️ LLM organization returned invalid structure, falling back');
        return null;
      }
      
      console.log(`✨ Semantically organized ${fieldCount} fields into ${organizedBlocks.length} blocks`);
      return organizedBlocks;
      
    } catch (error) {
      console.warn(`⚠️ LLM organization failed: ${error.message}, falling back to mechanical generation`);
      return null;
    }
  }
  
  /**
   * Convert LLM-organized structure to Notion blocks
   */
  convertOrganizedToNotionBlocks(organizedBlocks) {
    const notionBlocks = [];
    
    for (const block of organizedBlocks) {
      switch (block.type) {
        case 'heading_2':
          notionBlocks.push({
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{
                type: 'text',
                text: { content: block.content }
              }]
            }
          });
          break;
          
        case 'heading_3':
          notionBlocks.push({
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [{
                type: 'text',
                text: { content: block.content }
              }]
            }
          });
          break;
          
        case 'paragraph':
          const richText = [];
          if (block.bold_prefix) {
            richText.push({
              type: 'text',
              text: { content: block.bold_prefix + ' ' },
              annotations: { bold: true }
            });
            richText.push({
              type: 'text',
              text: { content: block.content.replace(block.bold_prefix, '').trim() }
            });
          } else {
            richText.push({
              type: 'text',
              text: { content: block.content }
            });
          }
          
          notionBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: richText }
          });
          break;
          
        case 'bulleted_list':
          if (block.items && Array.isArray(block.items)) {
            for (const item of block.items) {
              notionBlocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [{
                    type: 'text',
                    text: { content: String(item) }
                  }]
                }
              });
            }
          }
          break;
          
        case 'divider':
          notionBlocks.push({
            object: 'block',
            type: 'divider',
            divider: {}
          });
          break;
      }
    }
    
    return notionBlocks;
  }

  /**
   * Generate RICH content blocks with toggles, bullets, and full expansion
   * WHY THIS WORKS: Every piece of data gets added to the page, beautifully formatted
   * PHASE 3 ENHANCEMENT: Uses LLM organization for complex objects
   */
  async generateContentBlocksForSection(data, sectionInstructions = null, sectionHeading = null, depth = 0) {
    const blocks = [];
    
    // SPECIAL HANDLING: References section with URLs
    if (sectionHeading && (sectionHeading.toLowerCase().includes('reference') || sectionHeading.toLowerCase().includes('embed'))) {
      if (data && data.urls && Array.isArray(data.urls)) {
        console.log(`🔗 Processing ${data.urls.length} URLs for embedding...`);
        
        for (const url of data.urls) {
          // Detect URL type and create appropriate block
          if (/youtube\.com|youtu\.be/i.test(url)) {
            console.log(`  📺 YouTube embed: ${url.substring(0, 50)}...`);
            blocks.push({
              object: 'block',
              type: 'embed',
              embed: { url: url.trim() }
            });
          } else if (/vimeo\.com/i.test(url)) {
            console.log(`  🎬 Vimeo embed: ${url.substring(0, 50)}...`);
            blocks.push({
              object: 'block',
              type: 'embed',
              embed: { url: url.trim() }
            });
          } else if (/loom\.com/i.test(url)) {
            console.log(`  📹 Loom embed: ${url.substring(0, 50)}...`);
            blocks.push({
              object: 'block',
              type: 'embed',
              embed: { url: url.trim() }
            });
          } else if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url)) {
            console.log(`  🖼️ Image: ${url.substring(0, 50)}...`);
            blocks.push({
              object: 'block',
              type: 'image',
              image: {
                type: 'external',
                external: { url: url.trim() }
              }
            });
          } else {
            console.log(`  🔖 Bookmark: ${url.substring(0, 50)}...`);
            blocks.push({
              object: 'block',
              type: 'bookmark',
              bookmark: { url: url.trim() }
            });
          }
        }
        
        if (blocks.length > 0) {
          console.log(`✅ Created ${blocks.length} embed/bookmark blocks for References`);
          return blocks;
        }
      }
    }
    
    // PHASE 3: Try LLM-powered semantic organization for complex objects (depth 0 only)
    if (depth === 0 && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const organized = await this.organizeContentWithLLM(data, sectionHeading);
      if (organized) {
        const notionBlocks = this.convertOrganizedToNotionBlocks(organized);
        if (notionBlocks.length > 0) {
          console.log(`✅ Using semantic organization for "${sectionHeading}"`);
          return notionBlocks;
        }
      }
      // If LLM organization fails or returns nothing, fall through to mechanical generation
      console.log(`📋 Using mechanical generation for "${sectionHeading}"`);
    }
    
    // Check if this is the Raw Brief section (should be italic)
    const isRawBrief = sectionHeading && 
                      (sectionHeading.toLowerCase().includes('raw brief') || 
                       sectionHeading.toLowerCase().includes('rawbrief'));
    
    // STRING: Parse markdown bullets if present, otherwise add as-is
    if (typeof data === 'string') {
      // FIX 3: Clean up HTML tags and prepare text
      let cleanedData = data.replace(/<br\s*\/?>/gi, '\n'); // Replace <br> with \n
      cleanedData = cleanedData.replace(/<\/?[^>]+(>|$)/g, ''); // Remove other HTML tags
      
      const mediaBlocks = await this.extractAndCreateMediaBlocks(cleanedData);
      
      // Check if data contains markdown bullets (* or -)
      const hasMarkdownBullets = cleanedData.includes('\n*') || cleanedData.includes('\n-') || cleanedData.startsWith('*') || cleanedData.startsWith('-');
      
      if (hasMarkdownBullets) {
        // Parse markdown bullets and create proper Notion blocks
        const parsedItems = this.parseMarkdownBullets(cleanedData);
        
        for (const item of parsedItems) {
          if (item.type === 'bullet') {
            // FIX 3: Parse markdown bold in bullets
            const richText = this.parseMarkdownToRichText(item.content, isRawBrief);
            blocks.push({
              object: 'block',
              type: 'bulleted_list_item',
              bulleted_list_item: {
                rich_text: richText
              }
            });
          } else if (item.type === 'paragraph') {
            // FIX 3: Parse markdown bold in paragraphs
            const richText = this.parseMarkdownToRichText(item.content, isRawBrief);
            blocks.push({
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: richText
              }
            });
          }
        }
      } else {
        // No markdown bullets - handle as regular text
        const maxCharsPerBlock = 1900;
        
        if (cleanedData.length <= maxCharsPerBlock) {
          // FIX 3: Parse markdown bold
          const richText = this.parseMarkdownToRichText(cleanedData, isRawBrief);
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: richText
            }
          });
        } else {
          const chunks = this.intelligentSplit(cleanedData, maxCharsPerBlock);
          for (const chunk of chunks) {
            // FIX 3: Parse markdown bold in each chunk
            const richText = this.parseMarkdownToRichText(chunk, isRawBrief);
            blocks.push({
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: richText
              }
            });
          }
        }
      }
      
      if (mediaBlocks.length > 0) {
        blocks.push(...mediaBlocks);
      }
    }
    
    // ARRAY: Bulleted list with rich expansion
    else if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string' || typeof item === 'number') {
          blocks.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{
                type: 'text',
                text: { content: String(item) }
              }]
            }
          });
        } else if (typeof item === 'object' && item !== null) {
          // Complex object in array - expand it fully
          const formatted = this.formatObjectAsParagraph(item);
          blocks.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{
                type: 'text',
                text: { content: formatted }
              }]
            }
          });
        }
      }
    }
    
    // OBJECT: Full recursive expansion with toggles for nested sections
    else if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        
        // Simple value - show as bold key: value (with confidence markers if present)
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          const displayValue = this.addConfidenceMarker(String(value), value);
          
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: `${key}: ` },
                  annotations: { bold: true }
                },
                {
                  type: 'text',
                  text: { content: displayValue }
                }
              ]
            }
          });
        } 
        
        // Array value - show key + bullets
        else if (Array.isArray(value)) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: `${key}:` },
                annotations: { bold: true }
              }]
            }
          });
          
          for (const item of value) {
            if (typeof item === 'string' || typeof item === 'number') {
              blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [{
                    type: 'text',
                    text: { content: String(item) }
                  }]
                }
              });
            } else if (typeof item === 'object' && item !== null) {
              // Object in array - format inline
              const formatted = this.formatObjectAsParagraph(item);
              blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [{
                    type: 'text',
                    text: { content: formatted }
                  }]
                }
              });
            }
          }
        } 
        
        // Nested object - use TOGGLE for collapsible rich content (max 2 levels deep)
        else if (typeof value === 'object' && value !== null) {
          // Count how many items in nested object
          const nestedKeys = Object.keys(value);
          
          if (nestedKeys.length > 0) {
            // If we're already at depth 2+, flatten to paragraph to avoid Notion's nesting limit
            if (depth >= 2) {
              const formatted = this.formatObjectAsParagraph(value);
              blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      type: 'text',
                      text: { content: `${key}: ` },
                      annotations: { bold: true }
                    },
                    {
                      type: 'text',
                      text: { content: formatted }
                    }
                  ]
                }
              });
            } else {
              // Still within safe depth (0 or 1), use toggle
              const toggleBlock = {
                object: 'block',
                type: 'toggle',
                toggle: {
                  rich_text: [{
                    type: 'text',
                    text: { content: `${key}` },
                    annotations: { bold: true }
                  }],
                  children: []
                }
              };
              
              // Recursively generate nested content
              const nestedBlocks = await this.generateContentBlocksForSection(value, sectionInstructions, sectionHeading, depth + 1);
              
              // Add nested blocks as children of toggle (max 100 children per block in Notion)
              if (nestedBlocks.length > 0) {
                toggleBlock.toggle.children = nestedBlocks.slice(0, 100);
                blocks.push(toggleBlock);
                
                // If more than 100, add remaining blocks after toggle
                if (nestedBlocks.length > 100) {
                  blocks.push(...nestedBlocks.slice(100));
                }
              }
            }
          }
        }
      }
    }
    
    return blocks;
  }

  /**
   * Format object as rich inline string with ALL data
   */
  formatObjectAsParagraph(obj) {
    const parts = [];
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        parts.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        parts.push(`${key}: [${value.join(', ')}]`);
      } else if (typeof value === 'object' && value !== null) {
        // Nested object - format recursively
        const nested = this.formatObjectAsParagraph(value);
        parts.push(`${key}: {${nested}}`);
      }
    }
    return parts.join(' | ');
  }

  /**
   * Read toggle block children to get section instructions
   */
  async readToggleInstructions(toggleBlock) {
    try {
      const toggleChildren = await this.mcpClient.callTool('API-get-block-children', {
        block_id: toggleBlock.id,
        page_size: 50
      });
      
      return this.extractTextFromBlocks(toggleChildren.results || []);
      
    } catch (error) {
      console.warn(`⚠️  Could not read toggle instructions: ${error.message}`);
      return '';
    }
  }

  /**
   * Check if block has actual content
   */
  blockHasContent(block) {
    if (!block) return false;
    
    const blockType = block.type;
    const blockData = block[blockType];
    
    if (!blockData || !blockData.rich_text) {
      return blockType === 'divider';
    }
    
    const text = blockData.rich_text.map(rt => rt.plain_text || '').join('').trim();
    return text.length > 0;
  }

  /**
   * Extract text from a single block
   */
  extractTextFromBlock(block) {
    const blockType = block.type;
    const blockData = block[blockType];
    
    if (!blockData || !blockData.rich_text) {
      return '';
    }
    
    return blockData.rich_text.map(rt => rt.plain_text || '').join('');
  }

  /**
   * Extract text from multiple blocks
   */
  extractTextFromBlocks(blocks) {
    return blocks.map(block => this.extractTextFromBlock(block)).join('\n');
  }

  /**
   * Generate complete Notion page from LLM (no template)
   * WHY THIS WORKS: GPT-5 generates entire structure based on comprehensive prompt
   * Used when TEMPLATE_MODE=llm_only or as fallback in hybrid mode
   */
  async generateCompletePageFromLLM(briefData, complexityLevel, template, preDetectedConflicts = []) {
    console.log('🎨 Generating complete page structure using GPT-5...');
    
    try {
      // Build comprehensive prompt with structured instructions
      const systemPrompt = template.structuredPrompt;
      
      // Prepare brief data for GPT-5
      const briefDataString = JSON.stringify(briefData, null, 2);
      
      // Add conflict information if present
      const conflictsInfo = preDetectedConflicts.length > 0
        ? `\n\n⚠️ DETECTED CONFLICTS:\n${preDetectedConflicts.map(c => `- ${c}`).join('\n')}\n\nInclude these as warning callouts in the page.`
        : '';
      
      const userPrompt = `
# BRIEF DATA TO PROCESS:

${briefDataString}

${conflictsInfo}

# YOUR TASK:

Generate a complete, well-structured Notion page following the instructions in the system prompt.

IMPORTANT REMINDERS:
1. Check dates and create urgency callouts if needed (within 7 days = urgent)
2. Italicize the entire raw brief section
3. Embed YouTube/Vimeo/Loom links (don't just link them)
4. Use toggles for long content (>200 words or >5 bullets)
5. Bold client names and key terms
6. Use appropriate callout colors (red=urgent, blue=info, gray=notes)

Return ONLY a valid JSON array of Notion blocks. No markdown code blocks, no explanations, just the JSON array.
`;

      console.log('📤 Sending request to GPT-5 for complete page generation...');
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        response_format: { type: 'json_object' }
        // Note: GPT-5 doesn't support temperature parameter
      });
      
      const responseContent = response.choices[0].message.content;
      console.log(`✅ GPT-5 response received (${responseContent.length} chars)`);
      
      // Debug: Save response to file for inspection
      if (process.env.NODE_ENV === 'development') {
        const fs = require('fs');
        fs.writeFileSync('/tmp/gpt5-response-debug.json', responseContent);
        console.log('📝 Saved GPT-5 response to /tmp/gpt5-response-debug.json');
      }
      
      // Parse the response
      let generatedBlocks;
      try {
        const parsed = JSON.parse(responseContent);
        console.log(`🔍 Parsed JSON structure keys:`, Object.keys(parsed));
        
        // Handle different JSON structures GPT-5 might return
        if (Array.isArray(parsed)) {
          generatedBlocks = parsed;
        } else {
          // Try all possible keys GPT-5 might use
          const possibleKeys = ['blocks', 'results', 'page_content', 'array', 'content', 'notion_blocks'];
          generatedBlocks = null;
          
          for (const key of possibleKeys) {
            if (parsed[key] && Array.isArray(parsed[key])) {
              console.log(`✅ Found blocks in key: "${key}"`);
              generatedBlocks = parsed[key];
              break;
            }
          }
          
          if (!generatedBlocks) {
            // If no known key, try first array property
            for (const key of Object.keys(parsed)) {
              if (Array.isArray(parsed[key])) {
                console.log(`✅ Using first array property: "${key}"`);
                generatedBlocks = parsed[key];
                break;
              }
            }
          }
          
          generatedBlocks = generatedBlocks || [];
        }
        
        // Debug: Show first block structure if available
        if (generatedBlocks.length > 0) {
          console.log(`🔍 First block keys:`, Object.keys(generatedBlocks[0]));
          console.log(`🔍 First block type:`, generatedBlocks[0].type);
        } else {
          console.warn(`⚠️  Extracted array is empty. Full parsed structure:`, JSON.stringify(parsed).substring(0, 300));
        }
      } catch (parseError) {
        console.error('❌ Failed to parse GPT-5 response as JSON:', parseError.message);
        console.error('Response content (first 500 chars):', responseContent.substring(0, 500));
        throw new Error('GPT-5 returned invalid JSON structure');
      }
      
      console.log(`✅ Generated ${generatedBlocks.length} blocks from LLM`);
      
      // Validate that blocks have proper Notion structure
      const validBlocks = generatedBlocks.filter(block => {
        return block && block.object === 'block' && block.type && block[block.type];
      });
      
      if (validBlocks.length === 0) {
        console.warn('⚠️ No valid Notion blocks generated, creating minimal fallback');
        return this.createMinimalFallbackBlocks(briefData);
      }
      
      console.log(`✅ ${validBlocks.length} valid Notion blocks ready for insertion`);
      
      return validBlocks;
      
    } catch (error) {
      console.error('❌ LLM page generation failed:', error.message);
      
      // Fallback: Create basic blocks manually
      console.log('🔄 Falling back to basic manual block generation');
      return this.createMinimalFallbackBlocks(briefData);
    }
  }

  /**
   * Create minimal fallback blocks when LLM generation fails
   * WHY THIS WORKS: System never completely fails, always creates something useful
   */
  createMinimalFallbackBlocks(briefData) {
    const blocks = [];
    
    // Add raw brief if present
    if (briefData['Raw Brief'] || briefData.rawBrief) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '📝 Raw Brief' } }]
        }
      });
      
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: briefData['Raw Brief'] || briefData.rawBrief || '' },
            annotations: { italic: true }
          }]
        }
      });
    }
    
    // Add brief details if present
    if (briefData.brief_details || briefData['Brief Details']) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '📋 Details' } }]
        }
      });
      
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: briefData.brief_details || briefData['Brief Details'] || '' }
          }]
        }
      });
    }
    
    // Add fallback message
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{
          type: 'text',
          text: { content: '⚠️ This page was created with minimal formatting due to a processing issue. Please review and organize manually.' }
        }],
        icon: { emoji: '⚠️' },
        color: 'yellow_background'
      }
    });
    
    return blocks;
  }
}

module.exports = SmartTemplateProcessor;
