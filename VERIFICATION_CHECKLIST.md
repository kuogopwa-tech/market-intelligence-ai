# Gemini Integration - Verification Checklist

Complete this checklist after following the setup guide.

## Pre-Setup Checklist

- [ ] Have Google Gemini API key (from https://aistudio.google.com/app/apikeys)
- [ ] Node.js 18+ installed
- [ ] PNPM installed
- [ ] Database running and `DATABASE_URL` configured

## Installation Checklist

- [ ] Cloned/have access to Market-Intelligence-AI workspace
- [ ] Read GEMINI_QUICK_START.md
- [ ] Created `.env` file in `artifacts/api-server/`
- [ ] Added `GEMINI_API_KEY` to `.env`
- [ ] Run `pnpm install` from workspace root
- [ ] No installation errors in terminal

## Configuration Checklist

**In `artifacts/api-server/.env`:**
- [ ] `GEMINI_API_KEY=AIza...` (actual key, not placeholder)
- [ ] `AI_MODEL=gemini-2.5-flash` (or alternate model)
- [ ] `DATABASE_URL` is set
- [ ] `PORT=3000` (or your preferred port)
- [ ] `NODE_ENV=development`

## Runtime Startup Checklist

Run backend:
```bash
cd artifacts/api-server
pnpm dev
```

Expected output:
- [ ] No error about missing GEMINI_API_KEY
- [ ] No TypeScript compilation errors
- [ ] Server starts on port 3000
- [ ] Log output shows "listening" or similar

## Endpoint Verification Checklist

### Test 1: Health Check
```bash
curl http://localhost:3000/api/ai/status
```

Response should contain:
- [ ] `"online": true`
- [ ] `"provider": "gemini"`
- [ ] `"model": "gemini-2.5-flash"`
- [ ] `"error": null`

### Test 2: Analysis Request
```bash
curl -X POST http://localhost:3000/api/analysis \
  -H "Content-Type: application/json" \
  -d '{"symbol":"EURUSD","forceRefresh":true}'
```

Response should contain:
- [ ] `"aiModel": "gemini-2.5-flash"`
- [ ] `"reasoning"` with text (not empty)
- [ ] `"riseProbability"` as number 0-100
- [ ] `"fallProbability"` as number 0-100
- [ ] `"confidence"` as number 0-100

### Test 3: Backend Logs
In terminal running `pnpm dev`, look for:
- [ ] `"Gemini request succeeded"` (or retry attempts)
- [ ] `"latencyMs": <number>` (response time)
- [ ] `"provider": "gemini"`
- [ ] No "GEMINI_API_KEY" error messages

## Frontend Integration Checklist

1. Start frontend in another terminal:
```bash
pnpm --filter @workspace/deriv-analyst dev
```

2. Open frontend in browser (usually http://localhost:5173 or similar)

3. In frontend:
   - [ ] Analysis page loads without errors
   - [ ] Can navigate to Intelligence Hub
   - [ ] Can select a market symbol
   - [ ] Can trigger analysis
   - [ ] Analysis result displays (with Gemini-generated reasoning)
   - [ ] No "AI Offline" warnings

## Fallback Behavior Checklist

Test fallback to rule-based analysis:

1. Stop backend (`Ctrl+C`)
2. In terminal, unset GEMINI_API_KEY:
   ```bash
   $env:GEMINI_API_KEY = ""  # PowerShell
   # or
   unset GEMINI_API_KEY      # Bash
   ```
3. Restart backend: `pnpm dev`
4. Request analysis from frontend or curl
5. Verify:
   - [ ] Request completes (doesn't error)
   - [ ] Result includes reasoning (rule-based)
   - [ ] Log shows fallback message
   - [ ] No "GEMINI_API_KEY required" errors

## Performance Baseline Checklist

Track these metrics:

- [ ] First request latency: _____ ms (typical: 800-1500ms)
- [ ] Cache hit response: _____ ms (should be <50ms)
- [ ] Retry attempt latency: _____ ms (if tested)
- [ ] Timeout handling: _____ ms (if tested)

## Database Integration Checklist

- [ ] Analysis results saved to database
- [ ] Can query `/api/analysis/history` endpoint
- [ ] Learning memory system logs patterns
- [ ] No database errors in logs

## Production Readiness Checklist

- [ ] API key in environment variables (not .env)
- [ ] Error logs are informative
- [ ] Retry logic tested and working
- [ ] Timeout handling tested
- [ ] Fallback analysis tested
- [ ] Multiple models tested (if changing AI_MODEL)
- [ ] Rate limiting behavior understood
- [ ] Cost per request acceptable

## Common Issues Checklist

If tests fail, verify:

- [ ] GEMINI_API_KEY is valid (test in https://aistudio.google.com/)
- [ ] Internet connection is stable
- [ ] Port 3000 is not in use: `netstat -ano | findstr :3000` (Windows)
- [ ] Dependencies installed: `pnpm install`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] Database is accessible
- [ ] Environment variables properly exported

## Sign-Off

- [ ] All tests passing
- [ ] Frontend and backend communicating
- [ ] Logging is informative
- [ ] Ready for development/production use

**Date Verified**: _____________

**Verified By**: _____________

**Notes**:
```



```

---

## Quick Reference: Common Commands

```bash
# Install dependencies
pnpm install

# Start backend (from workspace root)
pnpm --filter @workspace/api-server dev

# Start backend (from artifacts/api-server/)
pnpm dev

# Start frontend (from workspace root)
pnpm --filter @workspace/deriv-analyst dev

# Type check
pnpm --filter @workspace/api-server typecheck

# Test health endpoint
curl http://localhost:3000/api/ai/status

# Test analysis endpoint
curl -X POST http://localhost:3000/api/analysis \
  -H "Content-Type: application/json" \
  -d '{"symbol":"EURUSD","forceRefresh":true}'
```

---

**Need help?** See GEMINI_INTEGRATION.md for troubleshooting guide.
