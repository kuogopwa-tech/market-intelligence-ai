# TODO - Adaptive Spike Detection Refactor

## GOAL
Eliminate incorrect "Spike Risk" classification caused by global ATR threshold (0.002) and replace with adaptive per-symbol volatility normalization.

## TASKS

### Phase 1: indicators.ts - Core Changes
- [ ] 1. Add `calcATRHistory()` function to calculate rolling ATR series
- [ ] 2. Add `getAvgATR20()` function to calculate 20-period average ATR
- [ ] 3. Add `detectVolatilityState()` function with classification rules:
  - spikeRatio < 1.2: "Normal"
  - spikeRatio >= 1.2 && < 1.5: "Elevated"
  - spikeRatio >= 1.5 && < 2.0: "High"
  - spikeRatio >= 2.0: "Spike Risk"
- [ ] 4. Update `detectMarketCondition()` to use adaptive spike detection
- [ ] 5. Add debug output fields to return: currentATR, avgATR20, spikeRatio, volatilityState

### Phase 2: signalEngine.ts - Logic Updates
- [ ] 6. Update marketState logic: only set "Spike Risk" when volatilityState === "Spike Risk"
- [ ] 7. Reduce spike penalty impact (max 10-15 points instead of dominating)
- [ ] 8. Update riskScore calculation to reduce spike dominance

### Phase 3: scanner.ts - Integration
- [ ] 9. Pass ATR debug data through to scan results (optional)

### Phase 4: Testing
- [ ] 10. Verify web runner works after changes
- [ ] 11. Test adaptive spike detection across different symbol types

## CLASSIFICATION RULES (Final)
```
spikeRatio = currentATR / avgATR20

if spikeRatio < 1.2:       volatilityState = "Normal"
if spikeRatio >= 1.2 && < 1.5: volatilityState = "Elevated"
if spikeRatio >= 1.5 && < 2.0: volatilityState = "High"
if spikeRatio >= 2.0:        volatilityState = "Spike Risk"
```

## OUTPUT FILES
- indicators.ts
- signalEngine.ts
- scanner.ts (if affected)
