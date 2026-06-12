# TODO - Production Fixes for Vercel Deployment

## 🔴 HIGH PRIORITY - CRITICAL FIXES

- [x] Fix signalEngine.ts syntax error - RE-READ SHOWS IT'S CORRECT (balanced parens)
- [ ] Add missing DB schema exports (hourlySummariesTable, dailySummariesTable)
- [ ] Fix missing database schema files - Create summaries schema

## 🟡 MEDIUM PRIORITY - MISSING ROUTES

- [ ] Implement /intelligence/status route
- [ ] Implement /intelligence/hourly/:symbol route
- [ ] Implement /intelligence/daily/:symbol route
- [ ] Implement /intelligence/evolution/:symbol route
- [ ] Implement /intelligence/aggregated route
- [ ] Implement /analytics/timeline/:symbol route
- [ ] Implement /analytics/heatmap/:symbol route

## 🟢 LOW PRIORITY - CLEANUP

- [ ] Clean up dead code in admin.ts
- [ ] Remove duplicate reset endpoint in dev.ts (or consolidate)
