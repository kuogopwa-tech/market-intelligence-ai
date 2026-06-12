# Market Intelligence AI - Full Project Architecture Diagram

## Overview
This is a comprehensive market intelligence and AI-prediction trading platform with a React frontend and Express backend. The project is structured as a monorepo using pnpm workspaces.

---

## 1. Project Structure (High-Level)

```
Market-Intelligence-AI/
├── api/                          # Vercel API routes wrapper
├── artifacts/                    # Main source code
│   ├── api-server/              # Express.js backend server
│   ├── deriv-analyst/          # Additional React app (experimental)
│   └── mockup-sandbox/         # Mockup experimental module
├── frontend/                    # React + Vite frontend application
├── lib/                        # Shared libraries
│   ├── api-client-react/      # React API client
│   ├── api-spec/             # OpenAPI specifications
│   ├── api-zod/              # Zod schemas & types
│   └── db/                   # Database schemas (Drizzle ORM)
├── scripts/                    # Build/dev scripts
└── package.json              # Root workspace config
```

---

## 2. Frontend Architecture (React + Vite)

### 2.1 Pages (Routes)
```
Routes:
├── /login              → LoginPage.tsx
│
└── Protected Routes (AppShell layout):
    ├── /                  → Redirects to /dashboard
    ├── /dashboard        → DashboardPage.tsx
    ├── /market-intelligence → MarketIntelligencePage.tsx
    ├── /ai-predictions  → AiPredictionsPage.tsx
    ├── /symbol-analysis → SymbolAnalysisPage.tsx
    ├── /memory-history  → MemoryHistoryPage.tsx
    ├── /intelligence-hub → IntelligenceHubPage.tsx
    ├── /analytics      → AnalyticsPage.tsx
    └── /settings        → SettingsPage.tsx
```

### 2.2 Components Structure
```
frontend/src/components/
├── charts/
│   └── MarketChart.tsx          # Market data chart visualization
│
├── error/
│   └── RouteErrorBoundary.tsx   # Error boundary for routes
│
├── layout/
│   └── AppShell.tsx             # Main layout with sidebar navigation
│
├── shared/
│   ├── AnimatedCounter.tsx     # Animated number display
│   ├── GlowingCard.tsx          # Glowing card component
│   └── MarketTicker.tsx         # Scrolling market ticker
│
└── ui/
    ├── Cards.tsx                # Reusable card components
    └── States.tsx               # UI state components
```

### 2.3 API Integration
```
frontend/src/api/
├── client.ts     # Axios API client configuration
├── hooks.ts     # React Query hooks
├── services.ts  # API service functions
└── types.ts    # TypeScript type definitions
```

### 2.4 Frontend Dependencies
- **React 19** + **React Router DOM 7**
- **TanStack React Query** for data fetching
- **Recharts** for charting
- **Framer Motion** for animations
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Sonner** for toasts
- **Axios** for HTTP requests

---

## 3. Backend Architecture (Express API Server)

### 3.1 API Routes
```
Routes (all under /api prefix):
├── /health         → health.ts        # Health check endpoint
├── /market         → market.ts       # Market data (candles, ticks, summary)
├── /indicators     → indicators.ts  # Technical indicators
├── /analysis       → analysis.ts    # Market analysis
├── /predictions    → predictions.ts  # AI predictions (CRUD + auto-generate)
├── /memory         → memory.ts        # Learning memory storage
├── /ai             → ai.ts           # AI service endpoints
├── /scanner         → scanner.ts      # Market scanner
├── /analytics      → analytics.ts    # Analytics data
├── /intelligence   → intelligence.ts # Aggregated intelligence
├── /dev            → dev.ts          # Development endpoints
└── /auth           → auth.ts         # Authentication
```

### 3.2 Core Libraries (lib/)
```
artifacts/api-server/src/lib/
├── aggregationEngine.ts      # Data aggregation engine
├── aiService.ts             # AI/GenAI service integration
├── backgroundScanner.ts     # Background market scanner
├── config.ts                # Configuration
├── derivWs.ts               # Deriv WebSocket connection
├── evolutionEngine.ts       # Evolution tracking
├── indicators.ts            # Technical indicators calculation
├── logger.ts               # Logging (Pino)
├── patternEngine.ts         # Pattern detection
├── personalityRefresher.ts  # AI personality refresher
├── signalEngine.ts          # Signal merging & generation
├── timingModel.ts           # Timing model
└── middleware/
    └── auth.ts              # Authentication middleware
```

### 3.3 Database Schemas (Drizzle ORM)
```
lib/db/src/schema/
├── aiAnalysis.ts        # AI analysis records
├── intelligence.ts   # Intelligence snapshots
├── marketData.ts       # Market data storage
├── memory.ts          # Learning memory
├── predictions.ts     # Predictions records
├── symbolTimeline.ts  # Symbol timeline
├── users.ts           # User accounts
└── index.ts           # Schema exports
```

### 3.4 Backend Dependencies
- **Express 5**
- **Drizzle ORM** + PostgreSQL
- **Google Generative AI** (Gemini)
- **JWT** + **BcryptJS** for auth
- **WebSocket** (ws) for real-time data
- **Pino** for logging
- **CORS**, **Cookie Parser**
- **@workspace/api-zod** (shared types)
- **@workspace/db** (shared database)

---

## 4. Shared Libraries (lib/)

### 4.1 api-zod
- Zod schemas for all API request/response types
- Auto-generated TypeScript types
- 80+ type definitions for market data, predictions, analytics

### 4.2 api-client-react
- React hook-based API client
- Type-safe API calls to backend

### 4.3 db
- Drizzle ORM schema definitions
- PostgreSQL database configuration

---

## 5. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                              │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────────┐    │
│  │ Pages   │───▶│ Hooks     │───▶│ Client  │───▶│ TanStack    │    │
│  │         │    │ (Query)  │    │ (Axios) │    │ Query Cache │    │
│  └─────────┘    └──────────┘    └─────────┘    └────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP/HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express API)                             │
│  ┌──────────┐    ┌──────────┐    ┌─────────────┐                  │
│  │ Routes  │───▶│ Services  │───▶│ Database    │                  │
│  │ REST    │    │ Logic     │    │ (Drizzle)   │                  │
│  └──────────┘    └──────────┘    └─────────────┘                  │
│         │                                    │                     │
│         ▼                                    ▼                     │
│  ┌──────────┐                       ┌─────────────────┐            │
│  │ WebSocket│◀──────────────────────│ PostgreSQL DB    │            │
│  │ (Deriv)  │   Real-time Data      │                 │            │
│  └──────────┘                       └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Key Features & Endpoints

### 6.1 Market Data
| Endpoint | Description |
|----------|-------------|
| `GET /api/market/symbols` | List supported trading symbols |
| `GET /api/market/candles` | Get OHLCV candle data |
| `GET /api/market/ticks` | Get recent price ticks |
| `GET /api/market/summary` | Get market summary with indicators |

### 6.2 Technical Indicators
| Endpoint | Description |
|----------|-------------|
| `GET /api/indicators` | Calculate technical indicators (RSI, MACD, EMA, etc.) |
| `GET /api/indicators/heatmap` | Get market heatmap data |

### 6.3 AI Predictions
| Endpoint | Description |
|----------|-------------|
| `GET /api/predictions` | List predictions |
| `POST /api/predictions` | Create manual prediction |
| `POST /api/predictions/auto` | Auto-generate AI prediction |
| `PATCH /api/predictions/:id/outcome` | Update prediction outcome |
| `GET /api/predictions/accuracy` | Get prediction accuracy stats |

### 6.4 Analysis & Intelligence
| Endpoint | Description |
|----------|-------------|
| `GET /api/analysis/history` | Get analysis history |
| `GET /api/analysis/latest` | Get latest analysis |
| `GET /api/intelligence` | Aggregated intelligence |
| `GET /api/scanner` | Scan market opportunities |

### 6.5 Memory & Learning
| Endpoint | Description |
|----------|-------------|
| `GET /api/memory` | Get memory entries |
| `GET /api/memory/summary` | Get memory summary |
| `GET /api/memory/lessons` | Get learned lessons |

### 6.6 Analytics
| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/overview` | Get analytics overview |
| `GET /api/analytics/daily` | Get daily summary |

### 6.7 Authentication
| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | User login |
| `POST /api/auth/register` | User registration |
| `GET /api/auth/me` | Get current user |

---

## 7. Frontend Pages Detail

### 7.1 LoginPage.tsx
- User authentication page
- Login form with email/password

### 7.2 DashboardPage.tsx
- Main dashboard with overview cards
- Quick stats and market summary

### 7.3 MarketIntelligencePage.tsx
- Real-time market intelligence
- Market conditions and signals

### 7.4 AiPredictionsPage.tsx
- AI-generated predictions
- Prediction cards with confidence scores
- Auto-generation controls

### 7.5 SymbolAnalysisPage.tsx
- Individual symbol deep analysis
- Technical indicators charts
- Pattern detection display

### 7.6 MemoryHistoryPage.tsx
- Learning memory history
- Past predictions and outcomes
- Lessons learned

### 7.7 IntelligenceHubPage.tsx
- Central intelligence hub
- Aggregated market intelligence
- Signal quality metrics

### 7.8 AnalyticsPage.tsx
- Analytics and statistics
- Accuracy charts
- Performance metrics

### 7.9 SettingsPage.tsx
- User settings
- API configuration

---

## 8. Technology Stack Summary

### Frontend
- **Runtime**: Node.js, React 19, React DOM 19
- **Build**: Vite 7
- **Routing**: React Router DOM 7
- **State**: TanStack React Query 5
- **UI**: Tailwind CSS 3, Lucide React, Framer Motion 11
- **Charts**: Recharts 3

### Backend
- **Runtime**: Node.js, Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT, BcryptJS
- **AI**: Google Generative AI (Gemini)
- **Logging**: Pino

### DevOps
- **Package Manager**: pnpm (workspace)
- **Deployment**: Vercel
- **TypeScript**: 5.9

---

## 9. Navigation Structure (AppShell)

```
┌────────────────────────────────────────────────────────────────────┐
│                        DERIV AI PRO                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ NAVIGATION SIDEBAR (w-72)                                      │ │
│  │                                                                │ │
│  │ 🏠 Dashboard                → /dashboard                       │ │
│  │ 🧠 Market Intelligence     → /market-intelligence           │ │
│  │ ✨ AI Predictions           → /ai-predictions                  │ │
│  │ 📈 Symbol Analysis         → /symbol-analysis                 │ │
│  │ 📜 Memory / History        → /memory-history                 │ │
│  │ 📊 Intelligence Hub       → /intelligence-hub               │ │
│  │ 📉 Analytics               → /analytics                     │ │
│  │ ⚙️ Settings                → /settings                      │ │
│  │                                                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ HEADER: "Premium Intelligence Dashboard" | Live Status      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ MAIN CONTENT ARE                                              │ │
│  │ (Page content renders here via Outlet)                       │ │
│  │                                                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. Build & Deployment

### Workspace Scripts
```json
{
  "build": "pnpm typecheck && pnpm -w build",
  "typecheck": "Global TypeScript check",
  "dev": "Start development server",
  "create:admin": "Create admin user"
}
```

### Deployment Targets
- **Frontend**: Vercel (frontend/)
- **Backend**: Vercel Serverless Functions (api/)
- **Database**: Neon (PostgreSQL)

---

*Generated: Market Intelligence AI Architecture Audit*
*Project Version: 0.0.0*
