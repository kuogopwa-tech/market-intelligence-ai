# Gemini Integration - Quick Start

## 5-Minute Setup

### 1️⃣ Get API Key (2 minutes)
- Go to https://aistudio.google.com/app/apikeys
- Click **"Create API Key"**
- Copy your key

### 2️⃣ Configure Backend (1 minute)

In `artifacts/api-server/.env`:
```env
GEMINI_API_KEY=AIza...your_key_here...
AI_MODEL=gemini-2.5-flash
DATABASE_URL=postgresql://user:pass@localhost:5432/market_intelligence
```

### 3️⃣ Install & Start (2 minutes)

From workspace root:
```bash
pnpm install              # Install new SDK
pnpm --filter @workspace/api-server dev
```

### ✅ Verify It Works

```bash
curl http://localhost:3000/api/ai/status
```

Expected:
```json
{ "online": true, "model": "gemini-2.5-flash", "provider": "gemini", ... }
```

## What Changed?

| Aspect | Before | After |
|--------|--------|-------|
| AI Provider | Local Ollama | Google Gemini |
| API Key | None | Required |
| Endpoint | http://localhost:11434 | Cloud (Gemini) |
| Dependency | None | `@google/generative-ai` |
| Timeout | 25s | 25s (same) |
| Fallback | Rule-based | Rule-based (same) |

## What Stayed The Same?

✅ All existing features  
✅ Database & learning systems  
✅ Frontend endpoints  
✅ Signal analysis engine  
✅ Technical indicators  
✅ Cache logic  

## Testing

1. **Health Check**: `curl http://localhost:3000/api/ai/status`
2. **Analysis Request**: Use frontend (any symbol)
3. **Logs**: Monitor terminal for Gemini request logs
4. **Fallback**: Works automatically if API unavailable

---

For detailed documentation, see [GEMINI_INTEGRATION.md](./GEMINI_INTEGRATION.md)
