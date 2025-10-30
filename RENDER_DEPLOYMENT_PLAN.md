# Render Deployment Plan for Velto Notion Classifier

## 🎯 **Deployment Overview**

We'll deploy your working server to Render as a **Web Service** that:
- ✅ Runs 24/7 (no need for ngrok)
- ✅ Has a permanent public URL (e.g., `https://velto-classifier.onrender.com`)
- ✅ Auto-restarts if it crashes
- ✅ Free tier available (or $7/month for always-on)

---

## 📋 **Pre-Deployment Checklist**

### Files We Already Have ✅
- [x] `server.js` - Main application (working)
- [x] `lib/classifier.js` - Classification logic
- [x] `lib/mcp-client.js` - Notion MCP connection
- [x] `lib/validators.js` - Validation
- [x] `package.json` - Dependencies
- [x] `.env` - Environment variables (local only, not deployed)

### Files We Need to Create 📝
- [ ] `render.yaml` - Render configuration (optional but recommended)
- [ ] `.env.example` - Template for required environment variables
- [ ] Update `.gitignore` to exclude `.env` (should already be there)

---

## 🔧 **Step-by-Step Deployment Plan**

### **Step 1: Prepare Repository (5 min)**

1. **Create `render.yaml`** (Render's config file)
   - Defines build/start commands
   - Specifies Node version
   - Sets health check endpoint

2. **Create `.env.example`**
   - Shows what environment variables are needed
   - Does NOT contain actual secrets

3. **Verify `.gitignore`**
   - Ensure `.env` is excluded
   - Ensure `node_modules` is excluded

4. **Optional: Create `README.md`** with deployment instructions

### **Step 2: Push to GitHub (2 min)**

- Commit all files
- Push to your repository
- Render will pull from this repo

### **Step 3: Create Render Web Service (5 min)**

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure settings:
   - **Name:** `velto-notion-classifier`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or Individual $7/month for zero downtime)

### **Step 4: Set Environment Variables on Render (3 min)**

Add these in Render dashboard → Environment:
- `NOTION_TOKEN` = Your Notion integration token
- `OPENAI_API_KEY` = Your OpenAI API key
- `REQUESTS_DB_ID` = Your Notion Requests database ID
- `NODE_ENV` = `production`
- `PORT` = (Render sets this automatically)

### **Step 5: Deploy (5 min)**

- Render automatically builds and deploys
- Wait for "Live" status
- Get your public URL: `https://velto-notion-classifier.onrender.com`

### **Step 6: Update n8n Webhook (2 min)**

Update n8n HTTP Request node:
- **OLD URL:** `http://localhost:3000/classify-request` (via ngrok)
- **NEW URL:** `https://velto-notion-classifier.onrender.com/classify-request`

### **Step 7: Test End-to-End (5 min)**

- Submit test form via Tally
- Verify n8n receives response
- Verify Notion page created
- Check Render logs for errors

---

## 📁 **Files to Create**

### 1. `render.yaml`

```yaml
services:
  - type: web
    name: velto-notion-classifier
    env: node
    buildCommand: npm install
    startCommand: node server.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: NOTION_TOKEN
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: REQUESTS_DB_ID
        sync: false
```

### 2. `.env.example`

```bash
# Notion Integration Token
# Get from: https://www.notion.so/my-integrations
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenAI API Key
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Notion Requests Database ID
# Extract from database URL: https://notion.so/{workspace}/{THIS_PART}?v=...
REQUESTS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Node Environment
NODE_ENV=development

# Port (Render sets this automatically in production)
PORT=3000
```

### 3. Update `.gitignore` (if needed)

```
# Environment variables
.env
.env.local

# Dependencies
node_modules/

# Logs
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Testing files
test_*.ps1
test_*.json
get_db_schema.js

# Documentation (optional)
*_PLAN.md
IMPLEMENTATION_*.md
```

---

## ⚙️ **Render Configuration Settings**

| Setting | Value | Notes |
|---------|-------|-------|
| **Name** | `velto-notion-classifier` | Your choice |
| **Region** | Oregon (US West) | Closest to you |
| **Branch** | `main` or `master` | Your default branch |
| **Root Directory** | `notion_agent` | If in subdirectory |
| **Environment** | Node | Auto-detected |
| **Build Command** | `npm install` | Installs dependencies |
| **Start Command** | `node server.js` | Starts the server |
| **Health Check Path** | `/health` | We already have this! |
| **Auto-Deploy** | Yes | Deploy on git push |

---

## 💰 **Render Pricing Options**

### Free Tier
- ✅ $0/month
- ⚠️ Spins down after 15 min of inactivity
- ⚠️ Cold start: 30-60 seconds
- ⚠️ 750 hours/month limit

**Good for:** Testing, low-traffic

### Individual Plan ($7/month)
- ✅ Always on (no spin down)
- ✅ Instant response
- ✅ Unlimited hours
- ✅ Better performance

**Good for:** Production with real clients

**RECOMMENDATION:** Start with Free tier, upgrade if n8n timeouts occur.

---

## 🚨 **Potential Issues & Solutions**

### Issue 1: Free Tier Cold Starts
**Problem:** First request after 15 min takes 30-60s  
**Solution:** 
- Option A: Upgrade to $7/month plan
- Option B: Set n8n timeout to 90 seconds
- Option C: Add a cron job to ping `/health` every 10 min

### Issue 2: Build Fails
**Problem:** Missing dependencies or wrong Node version  
**Solution:** 
- Check `package.json` has all dependencies
- Specify Node version in `render.yaml`: `node: 18`

### Issue 3: Environment Variables Not Set
**Problem:** Server crashes with "NOTION_TOKEN is undefined"  
**Solution:** 
- Add all env vars in Render dashboard
- Redeploy after adding env vars

### Issue 4: MCP Connection Fails
**Problem:** Notion MCP server can't spawn on Render  
**Solution:** 
- We use `npx -y @notionhq/notion-mcp-server` which works on Render
- Ensure `@notionhq/notion-mcp-server` is in `package.json` dependencies (or uses npx)

### Issue 5: Logs Show "Request timeout"
**Problem:** OpenAI or Notion API taking too long  
**Solution:**
- Already handled with 30s timeout in `mcp-client.js`
- n8n should have 60s timeout

---

## 🔍 **Monitoring & Debugging**

### Render Logs
- View in real-time: Render Dashboard → Logs tab
- See all requests, errors, and debug messages
- Persists for 7 days

### Health Check
- Test: `https://your-app.onrender.com/health`
- Returns: `{ "status": "healthy", "uptime": 123 }`

### Manual Test
```bash
curl -X POST https://your-app.onrender.com/classify-request \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "Oasis",
    "message": "Test from production",
    "submittedBy": "test@example.com",
    "submittedAt": "2025-10-23T12:00:00Z"
  }'
```

---

## 📊 **Deployment Workflow**

```
┌─────────────────────────────────────────────────────────┐
│ 1. Prepare files (render.yaml, .env.example)           │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Push to GitHub                                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Create Render Web Service                           │
│    - Connect GitHub repo                               │
│    - Configure build/start commands                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Add Environment Variables in Render                 │
│    - NOTION_TOKEN                                       │
│    - OPENAI_API_KEY                                     │
│    - REQUESTS_DB_ID                                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Deploy (automatic)                                   │
│    - Render builds: npm install                        │
│    - Render starts: node server.js                     │
│    - Health check: GET /health                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Get Public URL                                       │
│    https://velto-notion-classifier.onrender.com         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Update n8n HTTP Request Node                        │
│    URL: https://velto-notion-classifier.onrender.com... │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 8. Test with Real Tally Form                           │
│    ✅ End-to-end working!                              │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ **What I'll Do When You Approve**

1. **Create `render.yaml`** with optimal Render configuration
2. **Create `.env.example`** as a template
3. **Verify/update `.gitignore`** to exclude secrets
4. **Check `package.json`** has all dependencies listed
5. **Provide step-by-step instructions** for Render dashboard setup
6. **Test curl command** you can use to verify production deployment

---

## ⏱️ **Estimated Time**

- **File preparation:** 5 minutes
- **Render setup:** 10 minutes
- **First deployment:** 5 minutes (build time)
- **Testing:** 5 minutes
- **Total:** ~25 minutes

---

## ❓ **Questions Before We Start**

1. **Do you have a Render account?** (Free signup at https://render.com)
2. **Is this repo already on GitHub?** (Or do we need to push it first?)
3. **Which plan?** Free tier to start, or Individual ($7/month) for always-on?
4. **Root directory:** Is `notion_agent` inside a parent repo, or is it the root?

---

## 🚀 **Ready to Deploy?**

Say **"approved"** and I'll:
1. Create the deployment files
2. Guide you through Render dashboard setup
3. Help you test the production endpoint
4. Update your n8n workflow URL

Let's get this live! 🎉

