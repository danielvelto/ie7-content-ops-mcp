# IE7 Content Operations MCP

**Intelligent Notion MCP bridge for IE7 content operations** - Routes completed briefs from WhatsApp conversational agents to Notion databases with semantic property mapping and DCMS template formatting.

## Architecture

```
WhatsApp User
    ↓
Agent 1 (Triage) - Identifies request type, complexity, budget
    ↓
Agent 2 (Briefing) - Asks detailed questions, collects files
    ↓ Builds complete structured brief in n8n
N8N WEBHOOK
    ↓ HTTP POST /create-request
IE7 MCP SERVER (Render.com)
    ├─ Express API
    ├─ MCP Client (StdioClientTransport)
    │   ↓ spawns child process
    ├─ Notion MCP Server (npx @notionhq/notion-mcp-server)
    │   ↓ Notion API
    │   ├─ Fetch database schema
    │   ├─ Fetch DCMS_TEMPLATE reference page
    │   └─ Create page with properties
    └─ OpenAI o3-mini (semantic property mapping)
    ↓
Returns success + Notion page URL to n8n
    ↓
Fulfillment Team sees formatted brief in Notion
```

## Features

- ✅ **Semantic Property Mapping**: Uses LLM reasoning to determine which fields to populate from brief data
- ✅ **DCMS Template Application**: Fetches reference templates from Notion with embedded SOPs
- ✅ **Multi-Database Routing**: Automatically routes to correct database (Content Request, Publishing, etc.)
- ✅ **Template Caching**: 15-minute cache for performance with manual cache-bust endpoint
- ✅ **Adaptive Formatting**: Only creates page sections for data that exists in the brief
- ✅ **SOP-Guided Intelligence**: Follows process guidelines embedded in Notion templates

## Key Differences from Traditional Integrations

### ❌ What This System DOESN'T Do:
- **No hardcoded field whitelists** - Uses semantic understanding instead
- **No rigid property mappings** - Adapts to schema changes automatically  
- **No brittle configuration** - Templates and SOPs live in Notion, not code

### ✅ What Makes This Intelligent:
- **Semantic reasoning** - LLM determines which fields are intake vs. workflow
- **Template-driven** - Team updates templates in Notion, MCP adapts automatically
- **SOP-guided** - Process intelligence embedded in reference pages
- **Confidence scoring** - Returns reasoning for each property mapping decision

## Tech Stack

- **Node.js 18+** with Express
- **Notion MCP Server** (spawned as child process via npx)
- **@modelcontextprotocol/sdk** (StdioClientTransport)
- **OpenAI o3-mini** (semantic property mapping - matches Agent 2 config)
- **node-cache** (template caching)
- **Deployed on Render.com**

## Setup Instructions

### 1. Prerequisites

- Node.js 18 or higher
- Notion integration token (with read/write access to IE7 databases)
- OpenAI API key (o3-mini access)

### 2. Get Notion Integration Token

1. Go to https://www.notion.so/profile/integrations
2. Create new integration: "IE7 Content Operations MCP"
3. Copy the integration token (format: `ntn_****`)
4. Configure capabilities: "Read content" + "Update content" + "Insert content"
5. Share your IE7 databases with the integration:
   - Open each database (Content Request, Publishing, etc.)
   - Click "..." menu → "Connections"
   - Add your integration

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

```bash
cp env.example .env
```

Edit `.env` and add:
- `NOTION_TOKEN` - Your Notion integration token
- `OPENAI_API_KEY` - Your OpenAI API key
- Database IDs for each Notion database (Content Request, Publishing, etc.)

**To find database IDs**:
1. Open database in Notion
2. Copy link (Share → Copy link)
3. Extract 32-character ID from URL: `https://notion.so/{workspace}/{view}?db={DATABASE_ID}`

### 5. Create DCMS_TEMPLATE Reference Pages

For each database, create a reference page named `DCMS_TEMPLATE - DO NOT DELETE`:

1. Open the database in Notion
2. Create new page with title: `DCMS_TEMPLATE - DO NOT DELETE`
3. Structure the page as you want all briefs formatted
4. Add SOPs as **toggle blocks** under each section (collapsed by default for clean UX)
5. Use placeholders for variables: `{{project_name}}`, `{{due_date}}`, etc.

**Example template structure**:
```
# {{project_name}}

## 📋 Overview
▶ Process Instruction (toggle block)
  Summarize in 2-3 sentences focusing on WHAT, WHY, WHEN.
  If related to campaign/event, mention that context first.

## 🎯 Key Details
▶ Process Instruction (toggle block)
  Always include: Requested By, Due Date, Platform, Budget, Complexity.
  If any are missing from the brief, flag with ⚠️ for team follow-up.

**Requested By:** {{requested_by}}
**Due Date:** {{due_date}}
**Platform:** {{platform}}

## 📝 Full Description
▶ Process Instruction (toggle block)
  Include complete description from conversation.
  If requester mentioned specific examples or references, highlight in bold.

{{full_description}}

## ✅ Deliverables
▶ Process Instruction (toggle block)
  Be specific about format, duration, quantity.
  Example: "3x Instagram Reels (9:16, 30 seconds each, with captions)"

{{deliverables}}

## 📎 Attachments (if applicable)
▶ Process Instruction (toggle block)
  Include all files, links, mood boards, or references.
  Use bookmark blocks for URLs, file blocks for uploads.

{{attachments}}
```

**Toggle Block Benefits:**
- ✅ Collapsed by default - keeps template clean
- ✅ SOPs available when needed
- ✅ No special [SOP: ...] syntax needed
- ✅ Native Notion UX

### 6. Run Locally

```bash
npm start
```

Server starts on http://localhost:3000

### 7. Test Health Check

```bash
curl http://localhost:3000/health
```

Should return: `{"status":"healthy","uptime":...}`

## API Endpoints

### POST /create-request

**Input from n8n:**
```json
{
  "requestType": "content_request",
  "briefData": {
    "projectName": "Instagram Reel for Luther S6 Launch",
    "requestedBy": "Sarah (Marketing Team)",
    "dueDate": "2025-11-01",
    "budget": "£2,500",
    "platform": "Instagram",
    "complexity": "Medium",
    "description": "Create 30-second reel highlighting S6 key moments",
    "conversationSummary": "User wants fast-paced editing with dramatic music...",
    "attachments": ["https://...", "https://..."]
  }
}
```

**Output to n8n:**
```json
{
  "success": true,
  "notionPageUrl": "https://notion.so/...",
  "notionPageId": "...",
  "databaseUsed": "Content Request DB",
  "propertiesMapped": {
    "populate": ["Project name", "Requested By", "Due Date", "Budget"],
    "skip": ["Freelancer Allocated", "Media Link"],
    "reasoning": "..."
  },
  "templateApplied": "DCMS_TEMPLATE"
}
```

### POST /clear-cache

**What**: Manually clears template cache for immediate updates

**When to use**: After updating DCMS_TEMPLATE in Notion and need changes to propagate immediately (instead of waiting 15 minutes)

```bash
curl -X POST http://localhost:3000/clear-cache
```

**Response:**
```json
{
  "success": true,
  "message": "Template cache cleared",
  "cacheStats": {
    "keys": 0,
    "hits": 123,
    "misses": 5
  }
}
```

### GET /health

Health check endpoint (used by Render)

## How It Works

### 1. Request Received from n8n

n8n sends completed brief data with `requestType` and `briefData` object.

### 2. Database Routing

Brief Router determines target database based on `requestType`:
- `content_request` → Content Request DB
- `publishing_request` → Publishing Request DB
- `general_inquiry` → General Inquiries DB

### 3. Fetch DCMS Template (Cached)

- Search for `DCMS_TEMPLATE - DO NOT DELETE` in target database
- Parse template structure and embedded SOPs
- Cache for 15 minutes to reduce API calls

### 4. Fetch Database Schema

- Retrieve database properties via MCP
- Understand field types (title, select, date, person, etc.)
- Build schema context for semantic mapper

### 5. Semantic Property Mapping (LLM)

OpenAI o3-mini analyzes:
- Brief data (what information exists)
- Database schema (what fields are available)
- Template SOPs (process guidance)

Returns intelligent mapping:
```json
{
  "populate": {
    "Project name": { "value": "...", "confidence": 0.95, "reason": "..." }
  },
  "skip": {
    "Freelancer Allocated": { "reason": "Post-intake workflow field" }
  }
}
```

### 6. Create Notion Page

- Build property values based on semantic mapping
- Apply decision rules (e.g., Assignee = Daniel Fayomi)
- Create page in target database

### 7. Apply DCMS Template

- Use template structure from reference page
- Populate sections with brief data
- Only create sections for data that exists
- Follow SOP instructions for formatting

### 8. Return Success

Structured response returned to n8n with page URL and mapping details.

## Deployment to Render

### Via Dashboard

1. Push code to GitHub
2. Create new "Web Service" on Render
3. Connect GitHub repository
4. Set build command: `npm install`
5. Set start command: `node server.js`
6. Add environment variables (NOTION_TOKEN, OPENAI_API_KEY, DATABASE_IDs)
7. Deploy

### Via render.yaml (Infrastructure as Code)

See `render.yaml` for automated deployment configuration.

## System Philosophy: Semantic Intelligence

This system follows the same philosophy as IE7's Agent 1 & Agent 2:

**❌ NOT Rigid Rules:**
- "Fill these exact fields, ignore these exact fields"
- Hardcoded mappings that break when schemas change
- Whitelist approaches that need reprogramming

**✅ Semantic Intelligence:**
- "Understand what fields mean, then decide"
- Adaptive to schema changes
- Reasoning with confidence scores
- SOP-guided decision making

**Why This Matters:**
- Scales as you add databases
- Adapts when schemas change
- Aligns with rest of IE7 system
- Non-technical team can update templates

## SOP Documentation

Comprehensive SOPs are maintained in Notion under **IE7 Agent - MCP System** page, including:

- System context and purpose
- Semantic intelligence guidelines
- Decision-making authority
- Error handling procedures
- Quality standards
- Template usage instructions
- Model configuration
- Success metrics

## Troubleshooting

### "Connection timeout"

- Verify `NOTION_TOKEN` is set correctly
- Check logs for child process errors
- Test manually: `npx @notionhq/notion-mcp-server`

### "API token is invalid"

- Verify token format: `ntn_****` (not `secret_****`)
- Check token hasn't been revoked
- Verify integration has access to all databases

### "Could not find DCMS_TEMPLATE"

- Verify template page exists in target database
- Check naming: Must be exactly `DCMS_TEMPLATE - DO NOT DELETE`
- Ensure integration has access to read the template page

### "Template cache outdated"

- Call `/clear-cache` endpoint to force refresh
- Or wait 15 minutes for automatic cache expiration

## Development

```bash
# Run in development mode
npm run dev

# Test create-request endpoint
curl -X POST http://localhost:3000/create-request \
  -H "Content-Type: application/json" \
  -d '{"requestType":"content_request","briefData":{"projectName":"Test"}}'

# Clear template cache
curl -X POST http://localhost:3000/clear-cache
```

## License

MIT

## Support

For issues or questions, contact the IE7 development team.
