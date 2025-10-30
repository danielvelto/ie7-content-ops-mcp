# Deployment Guide - Render.com

## Prerequisites

- GitHub account
- Render.com account (free tier works!)
- Notion integration token
- OpenAI API key

---

## Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
# Initialize git repository (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Velto Notion Classifier"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/your-username/velto-classifier.git

# Push to main branch
git push -u origin main
```

---

### Step 2: Create Render Service

1. **Log in to Render:** https://dashboard.render.com

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repo you just pushed

3. **Configure Service:**
   - **Name:** `velto-notion-classifier`
   - **Region:** Choose closest to you (e.g., Frankfurt, Oregon)
   - **Branch:** `main`
   - **Root Directory:** Leave blank (or set if in subdirectory)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or Starter for production)

4. **Click "Create Web Service"**

---

### Step 3: Add Environment Variables

1. **Navigate to "Environment" tab** in your Render service

2. **Add these variables:**

```
NOTION_TOKEN = ntn_your_token_here
OPENAI_API_KEY = sk-your_key_here
NODE_ENV = production
CLIENTS_DB_ID = 2844900fe66a80b4b5ebcb6d677aec59
REQUESTS_DB_ID = 2844900fe66a80ee89d1f02b42548c81
RATE_CARDS_DB_ID = 2844900fe66a80a484ddc0f8b34edff4
```

3. **Click "Save Changes"**

**IMPORTANT:** Never commit tokens to Git! Always use environment variables.

---

### Step 4: Wait for Build & Deploy

Render will automatically:
1. Clone your repo
2. Run `npm install`
3. Start with `node server.js`
4. Ping `/health` to verify it's running

**Build time:** 2-5 minutes

**Watch the logs:**
- Look for: `✅ Server listening on port 10000`
- Look for: `✅ MCP client connected successfully`

---

### Step 5: Test Your Deployment

**Get your service URL:**
- Format: `https://velto-notion-classifier.onrender.com`
- Find in Render dashboard (top of service page)

**Test health check:**
```bash
curl https://your-service-url.onrender.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "childPid": 12345,
  "uptime": 120.5,
  "timestamp": "2025-10-22T19:00:00.000Z"
}
```

**Test classification:**
```bash
curl -X POST https://your-service-url.onrender.com/classify-request \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "OAS001",
    "message": "Test request",
    "submittedBy": "test@example.com"
  }'
```

---

## Auto-Deploy Configuration

**render.yaml is already configured for auto-deploy!**

Every time you push to `main`:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render will automatically:
1. Detect the push
2. Build new version
3. Deploy with zero downtime
4. Rollback if health check fails

---

## Monitoring & Logs

### View Logs

1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. See real-time logs (with emoji indicators!)

**Look for:**
- ✅ `MCP client connected successfully`
- 📥 `Incoming classification request`
- ✅ `Classification complete`
- ❌ Any errors

### Health Check Status

Render pings `/health` every 30 seconds.

If health check fails 3 times:
- Render automatically restarts your service
- You get email notification

### Metrics

**Free tier provides:**
- CPU usage
- Memory usage
- Request count
- Response times

**View:** Dashboard → Service → Metrics tab

---

## Troubleshooting Deployment

### Build fails: "Cannot find module"

**Solution:**
```bash
# Ensure package.json has all dependencies
npm install --save @modelcontextprotocol/sdk express dotenv openai

# Commit and push
git add package.json package-lock.json
git commit -m "Fix dependencies"
git push
```

### Health check fails

**Check logs for:**
1. `NOTION_TOKEN` not set → Add in Environment tab
2. `OPENAI_API_KEY` not set → Add in Environment tab
3. MCP connection timeout → Check Notion token is valid
4. Port binding error → We use `process.env.PORT` (correct)

### Service keeps crashing

**Check logs for:**
1. Child process errors (MCP server)
2. Memory limit exceeded (upgrade plan)
3. Unhandled promise rejections (code bug)

**Solution:**
```bash
# View recent logs
render logs -s velto-notion-classifier -n 100

# Check for crash loop
# "Process exited after 1500ms" = spinning, needs fix
```

### Slow cold starts (free tier)

**Free tier spins down after 15 min inactivity**

**Cold start time:** 30-60 seconds

**Solutions:**
1. Upgrade to Starter plan ($7/month, no spin-down)
2. Use cron job to ping every 10 minutes
3. Accept cold starts for low-traffic apps

---

## Cost Optimization

### Free Tier

**Included:**
- 750 hours/month (enough for 1 service 24/7)
- Spins down after 15 min inactivity
- 512 MB RAM
- 0.5 CPU

**Good for:** Development, testing, low-traffic apps

### Starter Plan ($7/month)

**Included:**
- Always on (no spin-down)
- 512 MB RAM
- 0.5 CPU
- Custom domain support

**Good for:** Production apps with consistent traffic

### Standard Plan ($25/month)

**Included:**
- 2 GB RAM
- 1 CPU
- Higher throughput

**Good for:** High-traffic production apps

---

## Environment-Specific Configuration

### Development (.env.local)

```bash
PORT=3000
NODE_ENV=development
NOTION_TOKEN=ntn_dev_token
OPENAI_API_KEY=sk_dev_key
```

### Production (Render Environment Variables)

```bash
# Render sets PORT automatically
NODE_ENV=production
NOTION_TOKEN=ntn_prod_token
OPENAI_API_KEY=sk_prod_key
```

---

## Security Best Practices

✅ **DO:**
- Store secrets in Render Environment Variables
- Use read-only Notion tokens when possible
- Implement rate limiting on endpoints
- Monitor logs for suspicious activity
- Use HTTPS (Render provides automatically)

❌ **DON'T:**
- Commit `.env` files to Git
- Hardcode tokens in code
- Expose tokens in client-side code
- Allow arbitrary tool calls from untrusted users

---

## Scaling Considerations

### When to Scale Up

**Upgrade plan when:**
- Response time > 10 seconds consistently
- Memory usage > 80% regularly
- CPU usage > 80% regularly
- Cold starts are affecting users

### Horizontal Scaling

**Multiple instances:**
1. Render dashboard → Service → Settings
2. Change "Number of Instances" to 2+
3. Render automatically load balances

**Note:** Each instance spawns its own MCP server child process.

---

## Backup & Disaster Recovery

### Database Backups

**Notion is your source of truth:**
- Client pages
- Rate cards
- Requests

**No backup needed for this service** (it's stateless).

### Service Recovery

**If service fails:**
1. Check Render status page: https://status.render.com
2. View logs for errors
3. Rollback to previous deploy:
   - Dashboard → Service → Deploys
   - Click "Rollback" on last working deploy

---

## Success Checklist

Before marking deployment complete:

- [ ] Service is running (green status in Render)
- [ ] Health check returns 200 OK
- [ ] `/classify-request` endpoint returns valid JSON
- [ ] Logs show MCP client connected
- [ ] No errors in recent logs
- [ ] n8n can reach the service
- [ ] Test classification returns correct enums
- [ ] Rate matching finds hourly rates
- [ ] Environment variables are all set
- [ ] Auto-deploy is configured
- [ ] Monitoring is set up

---

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Render Community:** https://community.render.com
- **Notion API Docs:** https://developers.notion.com
- **OpenAI Docs:** https://platform.openai.com/docs

---

You're ready to deploy! 🚀

If you run into issues, check the logs first, then consult TESTING.md for troubleshooting tips.



