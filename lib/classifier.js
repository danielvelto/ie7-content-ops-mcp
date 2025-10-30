// ============================================
// VELTO REQUEST CLASSIFIER
// ============================================
// Uses OpenAI to classify client requests with Notion context

const OpenAI = require('openai');
const { validateClassification, sanitizeClassification } = require('./validators');

class RequestClassifier {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Retrieve Notion context for classification
   * WHY THIS WORKS: Uses exact MCP tools from research
   */
  async getNotionContext(clientId) {
    console.log(`📚 Retrieving enhanced Notion context for client: ${clientId}`);
    
    const context = {
      clientPage: null,
      clientPageId: null,
      clientPageUrl: null,
      clientPageContent: '',
      clientProjects: [],
      scopeDocuments: [],
      rateCards: [],
      similarRequests: []
    };

    try {
      // Step 1: Find the actual client page (in Clients DB)
      // WHY THIS WORKS: Search for the client name, not just submission
      const clientSearch = await this.mcpClient.callTool('API-post-search', {
        query: `${clientId} client`,
        filter: { value: 'page', property: 'object' },
        page_size: 10
      });

      // Find the actual client page (look for one with "Client ID" or in Clients DB)
      let actualClientPage = null;
      if (clientSearch.results && clientSearch.results.length > 0) {
        // Try to find the page with Client ID property or "Land Development" in name
        for (const page of clientSearch.results) {
          const pageDetails = await this.mcpClient.callTool('API-retrieve-a-page', {
            page_id: page.id
          });
          
          // Check if this page has "Client ID" property or "Projects" relation
          if (pageDetails.properties && 
              (pageDetails.properties['Client ID'] || 
               pageDetails.properties['Projects'] ||
               pageDetails.properties['Default Rate (£/h)'])) {
            actualClientPage = pageDetails;
            context.clientPageId = pageDetails.id;
            context.clientPageUrl = pageDetails.url;
            break;
          }
        }
        
        // Fallback to first result if no client page found
        if (!actualClientPage && clientSearch.results[0]) {
          actualClientPage = await this.mcpClient.callTool('API-retrieve-a-page', {
            page_id: clientSearch.results[0].id
          });
          context.clientPageId = actualClientPage.id;
          context.clientPageUrl = actualClientPage.url;
        }
      }

      if (actualClientPage) {
        context.clientPage = actualClientPage;
        
        // Step 2: Get page content blocks (scope, contracts, definitions)
        // WHY THIS WORKS: RAG - retrieve full context from client page
        const blocks = await this.mcpClient.callTool('API-get-block-children', {
          block_id: actualClientPage.id,
          page_size: 100
        });
        context.clientPageContent = this.extractTextFromBlocks(blocks.results || []);
        
        // Step 3: Get related projects from the client page
        // WHY THIS WORKS: Client page has Projects relation
        if (actualClientPage.properties?.Projects?.relation) {
          const projectRelations = actualClientPage.properties.Projects.relation;
          for (const projectRel of projectRelations.slice(0, 5)) {
            try {
              const projectPage = await this.mcpClient.callTool('API-retrieve-a-page', {
                page_id: projectRel.id
              });
              
              // Get project content too
              const projectBlocks = await this.mcpClient.callTool('API-get-block-children', {
                block_id: projectRel.id,
                page_size: 50
              });
              
              context.clientProjects.push({
                id: projectPage.id,
                url: projectPage.url,
                name: projectPage.properties?.['Project Name']?.title?.[0]?.plain_text || 
                      projectPage.properties?.Name?.title?.[0]?.plain_text || 'Unnamed Project',
                content: this.extractTextFromBlocks(projectBlocks.results || [])
              });
            } catch (err) {
              console.warn(`Could not fetch project ${projectRel.id}:`, err.message);
            }
          }
        }
        
        // Step 4: Search for scope and contract documents
        // WHY THIS WORKS: Semantic search finds relevant agreements
        const scopeSearch = await this.mcpClient.callTool('API-post-search', {
          query: `${clientId} scope of work agreement contract retainer`,
          page_size: 5
        });
        context.scopeDocuments = scopeSearch.results || [];
      }

      // Step 4: Search for Rate Cards
      // WHY THIS WORKS: Uses database_id from env.example
      if (process.env.RATE_CARDS_DB_ID) {
        try {
          const rateCards = await this.mcpClient.callTool('API-post-database-query', {
            database_id: process.env.RATE_CARDS_DB_ID,
            filter: {
              and: [
                {
                  property: 'Client',
                  rich_text: {
                    contains: clientId
                  }
                },
                {
                  property: 'Active?',
                  checkbox: {
                    equals: true
                  }
                }
              ]
            },
            page_size: 20
          });
          context.rateCards = rateCards.results || [];
        } catch (error) {
          console.warn('Could not fetch rate cards:', error.message);
        }
      }

      // Step 5: Search for similar past requests
      const requestsSearch = await this.mcpClient.callTool('API-post-search', {
        query: `${clientId} request`,
        filter: { value: 'page', property: 'object' },
        page_size: 5
      });
      context.similarRequests = requestsSearch.results || [];

      console.log('✅ Enhanced context retrieved:', {
        clientPageFound: !!context.clientPage,
        clientPageId: context.clientPageId,
        projectsFound: context.clientProjects.length,
        scopeDocumentsFound: context.scopeDocuments.length,
        rateCardsFound: context.rateCards.length,
        similarRequestsFound: context.similarRequests.length
      });

      return context;
    } catch (error) {
      console.error('Error retrieving Notion context:', error);
      throw error;
    }
  }

  /**
   * Extract plain text from Notion blocks
   * WHY THIS WORKS: Notion blocks have rich_text arrays with text content
   */
  extractTextFromBlocks(blocks) {
    let text = '';
    
    for (const block of blocks) {
      // Different block types store text in different places
      const blockType = block.type;
      const blockData = block[blockType];
      
      if (blockData && blockData.rich_text) {
        const blockText = blockData.rich_text
          .map(rt => rt.plain_text || rt.text?.content || '')
          .join('');
        text += blockText + '\n';
      }
    }
    
    return text.trim();
  }

  /**
   * Build classification prompt for OpenAI
   * WHY THIS WORKS: Uses your exact classification rules from requirements
   */
  buildClassificationPrompt(request, context) {
    return `# SYSTEM PROMPT: Velto Request Classification Agent

You are an expert technical project manager for **Velto**, a software consultancy. You analyze client requests submitted via their portal and classify them into structured data for billing, project management, and scope control.

## YOUR TASK

Classify the following client message into structured request data that will be written to Velto's **Requests DB** in Notion.

## CLIENT REQUEST

**Client ID:** ${request.clientId}
**Message:** ${request.message}
**Submitted By:** ${request.submittedBy || 'Unknown'}
**Submitted At:** ${request.submittedAt || new Date().toISOString()}

## NOTION CONTEXT (Retrieved via RAG/Semantic Search)

### Client Information
${context.clientPage ? `**Client Page URL:** ${context.clientPageUrl}
**Client Page ID:** ${context.clientPageId}
**Default Rate:** £${context.clientPage.properties?.['Default Rate (£/h)']?.number || 'N/A'}/h

**Client Page Content (Scope, Contracts, Definitions):**
${context.clientPageContent || 'No content available'}` : 'Client page not found'}

### Client Projects (Retrieved from Relations)
${context.clientProjects.length > 0 ? context.clientProjects.map((proj, i) => {
  return `${i + 1}. **${proj.name}**
   - Project ID: ${proj.id}
   - URL: ${proj.url}
   - Content: ${proj.content.substring(0, 500)}${proj.content.length > 500 ? '...' : ''}`;
}).join('\n\n') : 'No projects found'}

### Scope Documents & Contracts (via Semantic Search)
${context.scopeDocuments.length > 0 ? context.scopeDocuments.map((doc, i) => {
  return `${i + 1}. ${doc.properties?.Name?.title?.[0]?.plain_text || doc.properties?.Title?.title?.[0]?.plain_text || 'Document'} (${doc.url})`;
}).join('\n') : 'No scope documents found'}

### Rate Cards
${context.rateCards.length > 0 ? context.rateCards.map((rc, i) => {
  const props = rc.properties || {};
  return `${i + 1}. Work Type: ${props['Work Type']?.select?.name || 'N/A'}, Rate: £${props['Rate (£/h)']?.number || 'N/A'}/h`;
}).join('\n') : 'No rate cards found'}

### Similar Past Requests
${context.similarRequests.length > 0 ? context.similarRequests.slice(0, 3).map((req, i) => {
  return `${i + 1}. ${req.properties?.Title?.title?.[0]?.plain_text || req.properties?.Name?.title?.[0]?.plain_text || 'Untitled'}`;
}).join('\n') : 'No similar requests found'}

## VELTO'S EXACT ENUM VALUES

### Type (required)
- "In-Scope" — Work covered by retainer or existing agreement
- "Out-of-Scope" — Additional work not in original scope (billable)
- "Bug" — Defect or error in existing functionality
- "Support" — Questions, guidance, or help (not a change)
- "Billing" — Invoice, payment, or billing-related inquiry

### Work Type (required)
- "Design" — UI/UX, visual design, branding
- "Engineering" — Development, coding, technical implementation
- "Consulting" — Strategy, planning, advice
- "Support" — Help desk, troubleshooting, guidance
- "Emergency" — Urgent production issues (P0/P1 only)

### Priority (required)
- "P0" — Critical/Emergency: Production down, blocking business operations
- "P1" — High: Urgent request, client expects this week
- "P2" — Normal: Standard priority, can be scheduled

### Billing Method (required)
- "Included" — Covered by retainer/agreement (In-Scope or Bug fixes)
- "T&M" — Time & Materials (Out-of-Scope, billed hourly)
- "Fixed Quote" — Fixed-price quote for specific deliverable

### Status (set on creation)
- "New" — Just submitted (use this for most)
- "Quoted" — Use if billable and estimate provided (awaiting client approval)
- "Triage" — Only if ambiguous and needs internal review first

## CLASSIFICATION LOGIC (CITE DOCUMENTS!)

### Type Determination (MUST cite scope documents)
1. **Bug** if: mentions "not working", "error", "broken", "issue with existing feature"
   - Check client page content for bug definitions
   - **CITE** which document says bugs are covered/not covered
2. **Support** if: asks "how to", "help with", "question about", no changes requested
3. **Billing** if: mentions "invoice", "payment", "billing"
4. **In-Scope** if: clearly covered by client's scope document
   - **CITE** the specific clause or document that covers this work
5. **Out-of-Scope** if: new features, changes outside original scope
   - **CITE** why it's not in the original scope

### Project Identification (REQUIRED)
- **Identify which project** this request relates to from the Client Projects list
- Match based on keywords in request vs project names/content
- Return the **Project ID** and **Project Name**
- **CITE** why you matched this project (e.g., "mentions login, SAO Voice Agent handles authentication")

### Work Type
- Code/technical changes = Engineering
- Visual/UI changes = Design
- Questions/guidance = Support
- Production issues = Emergency (if P0/P1)
- Strategy/planning = Consulting

### Priority
- Production down or blocking business = P0
- Client says "urgent", "this week", "ASAP" = P1
- Everything else = P2

### Billing Method (MUST cite documents)
- In-Scope or Bug = Included
  - **CITE** the retainer clause or bug definition that covers this
- Out-of-Scope = T&M or Fixed Quote (T&M if uncertain)
  - **CITE** why this is billable

### Acceptance Criteria (REQUIRED - Generate from request)
Generate 3-5 specific, testable criteria based on the request:
- **Format**: Clear checklist items (e.g., "Login button works on mobile Safari", "No errors in console")
- Make them specific to THIS request, not generic

### Evidence (REQUIRED - Document the submission)
Create a summary of:
- Who submitted it (name, email)
- When it was submitted
- Original message reference
- Any portal/ticket IDs

## OUTPUT JSON SCHEMA (STRICT)

Return ONLY valid JSON with the following structure:

\`\`\`json
{
  "title": "Clear, specific title (under 100 chars)",
  "clientId": "${request.clientId}",
  "clientPageId": "${context.clientPageId || null}",
  "clientPageUrl": "${context.clientPageUrl || null}",
  
  "relatedProjectId": "Project UUID from Client Projects list",
  "relatedProjectName": "Name of the project this relates to",
  
  "type": "In-Scope|Out-of-Scope|Bug|Support|Billing",
  "workType": "Design|Engineering|Consulting|Support|Emergency",
  "priority": "P0|P1|P2",
  "billingMethod": "Included|T&M|Fixed Quote",
  
  "hourlyRate": 85.0,
  
  "status": "New|Quoted|Triage",
  
  "acceptanceCriteria": [
    "Specific testable criterion 1",
    "Specific testable criterion 2",
    "Specific testable criterion 3"
  ],
  
  "evidence": "Submitted by [name] ([email]) on [date]. Original message: '[first 100 chars]'",
  
  "requestedDeadline": "YYYY-MM-DD or null",
  
  "reasoning": {
    "typeReason": "Why this Type was chosen, CITING specific clause from scope document",
    "workTypeReason": "Why this Work Type was chosen",
    "priorityReason": "Why this Priority",
    "projectReason": "Why this project was identified (cite keywords, project content match)",
    "billingReason": "Why this billing method, CITING retainer clause or scope document",
    "rateSourceReason": "Rate Card matched OR Client default fallback",
    "documentsReferenced": [
      "Document/Section 1 that was used for decision",
      "Document/Section 2 that was used for decision"
    ]
  }
}
\`\`\`

**CRITICAL**: 
- ALWAYS cite specific documents/clauses in your reasoning
- ALWAYS identify the related project from the Projects list
- ALWAYS generate specific acceptance criteria from the request details
- ALWAYS populate the evidence field with submission info
- Return ONLY the JSON, no other text.`;
  }

  /**
   * Classify request using OpenAI o3-mini
   * WHY THIS WORKS: o3-mini is designed for reasoning and structured outputs
   */
  async classify(request) {
    console.log(`🤖 Classifying request from client: ${request.clientId}`);
    
    try {
      // Step 1: Get Notion context
      const context = await this.getNotionContext(request.clientId);
      
      // Step 2: Build prompt
      const prompt = this.buildClassificationPrompt(request, context);
      
      // Step 3: Call OpenAI o3-mini
      // WHY THIS WORKS: o3-mini uses reasoning for accurate classification
      const completion = await this.openai.chat.completions.create({
        model: 'o3-mini',
        messages: [
          { role: 'system', content: 'You are a request classification expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }, // Force valid JSON output
        reasoning_effort: 'medium', // Balances speed and accuracy for classification
        max_completion_tokens: 4000 // Increased for longer responses with reasoning
      });
      
      let responseText = completion.choices[0].message.content.trim();
      
      // Step 4: Parse JSON response
      // WHY THIS WORKS: o3-mini returns clean JSON when instructed
      console.log('📄 Raw LLM response (first 500 chars):', responseText.substring(0, 500));
      
      // Strip markdown code blocks if present
      if (responseText.includes('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        console.log('🔧 Stripped markdown code blocks');
      } else if (responseText.includes('```')) {
        responseText = responseText.replace(/```\n?/g, '');
        console.log('🔧 Stripped generic code blocks');
      }
      
      let classification;
      try {
        classification = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON parse failed. Raw response:', responseText);
        throw new Error(`Failed to parse LLM response: ${parseError.message}`);
      }
      
      // Step 5: Sanitize output (fix common LLM issues)
      // WHY THIS WORKS: LLMs sometimes return "engineering" instead of "Engineering"
      classification = sanitizeClassification(classification);
      
      // Step 6: Apply rate matching logic
      // WHY THIS WORKS (Your Requirements): Rate Card → Client Default → null
      classification = await this.applyRateMatching(classification, context);
      
      // Step 7: Validate against Notion enums
      // WHY THIS WORKS: Catches invalid values before sending to n8n/Notion
      const validation = validateClassification(classification);
      if (!validation.isValid) {
        console.error('❌ Validation errors:', validation.errors);
        return {
          success: false,
          error: 'Classification validation failed',
          validationErrors: validation.errors
        };
      }
      
      console.log('✅ Classification complete:', {
        type: classification.type,
        workType: classification.workType,
        priority: classification.priority,
        hourlyRate: classification.hourlyRate
      });
      
      return {
        success: true,
        classification,
        contextUsed: {
          clientPageFound: !!context.clientPage,
          rateCardsFound: context.rateCards.length,
          similarRequestsFound: context.similarRequests.length
        }
      };
      
    } catch (error) {
      console.error('❌ Classification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Apply rate matching logic
   * WHY THIS WORKS (Your Requirements):
   * 1. Try Rate Card (Client + Work Type + Active)
   * 2. Fallback to Client Default Rate
   * 3. Fallback to null + flag
   */
  async applyRateMatching(classification, context) {
    console.log('💰 Applying rate matching logic...');
    
    const result = { ...classification };
    
    // Step 1: Try to find matching Rate Card
    // WHY THIS WORKS: Filters by Client, Work Type, and Active status
    if (context.rateCards && context.rateCards.length > 0) {
      const matchingCard = context.rateCards.find(card => {
        const props = card.properties || {};
        const cardWorkType = props['Work Type']?.select?.name;
        const isActive = props['Active?']?.checkbox;
        
        return cardWorkType === classification.workType && isActive;
      });
      
      if (matchingCard) {
        const props = matchingCard.properties || {};
        const rate = props['Rate (£/h)']?.number;
        const effectiveFrom = props['Effective From']?.date?.start;
        
        if (rate) {
          result.hourlyRate = rate;
          result.rateCardUrl = matchingCard.url;
          result.reasoning = result.reasoning || {};
          result.reasoning.rateSourceReason = `Matched Rate Card: ${classification.workType} at £${rate}/h (Effective: ${effectiveFrom || 'N/A'})`;
          
          console.log(`✅ Rate Card matched: £${rate}/h`);
          return result;
        }
      }
    }
    
    // Step 2: Fallback to Client Default Rate
    // WHY THIS WORKS: Every client has a "Default Rate (£/h)" property
    if (context.clientPage && context.clientPage.properties) {
      const defaultRate = context.clientPage.properties['Default Rate (£/h)']?.number;
      
      if (defaultRate) {
        result.hourlyRate = defaultRate;
        result.rateCardUrl = null;
        result.reasoning = result.reasoning || {};
        result.reasoning.rateSourceReason = `Client Default Rate: £${defaultRate}/h (no specific Rate Card found for ${classification.workType})`;
        
        console.log(`✅ Using client default rate: £${defaultRate}/h`);
        return result;
      }
    }
    
    // Step 3: No rate found - flag for manual review
    // WHY THIS WORKS: Better to return null than guess wrong
    result.hourlyRate = null;
    result.rateCardUrl = null;
    result.reasoning = result.reasoning || {};
    result.reasoning.rateSourceReason = '⚠️ No Rate Card or Default Rate found - REQUIRES MANUAL REVIEW';
    
    console.warn('⚠️ No rate found - requires manual review');
    return result;
  }
}

module.exports = RequestClassifier;

