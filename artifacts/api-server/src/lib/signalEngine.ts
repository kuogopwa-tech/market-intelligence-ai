import type { IndicatorSet } from "./indicators.js";
import { detectMarketCondition } from "./indicators.js";

export type MarketState =
  | "Strong Bullish"
  | "Weak Bullish"
  | "Strong Bearish"
  | "Weak Bearish"
  | "Ranging"
  | "Volatile"
  | "Spike Risk"
  | "Reversal Watch"
  | "Uncertain";

export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";

export type AlertType =
  | "High Confidence Bullish"
  | "High Confidence Bearish"
  | "Reversal Watch"
  | "Spike Risk Warning"
  | "No-Trade Warning"
  | "none";

export type SetupRarity = "common" | "moderate" | "rare" | "exceptional";
export type MarketCleanliness = "clean" | "choppy" | "trending" | "volatile";

export interface SignalResult {
  bullishScore: number;
  bearishScore: number;
  neutralScore: number;
  confidence: number;
  riskLevel: RiskLevel;
  marketState: MarketState;
  supportingSignals: string[];
  conflictingSignals: string[];
  noTradeZone: boolean;
}

export interface SignalQuality {
  cleanSignalScore: number;
  riskScore: number;
  confidenceWeight: number;
  indicatorAlignment: number;
  momentumConfirmation: number;
  volatilityCompatibility: number;
  marketCleanliness: MarketCleanliness;
  setupRarity: SetupRarity;
  alertType: AlertType;
  expirySeconds: number;
  historicalBoost: number;
}

export function mergeSignals(indicators: IndicatorSet): SignalResult {
  const {
    rsi,
    macdLine,
    macdSignal,
    macdHistogram,
    ema9,
    ema21,
    ema50,
    atr,
    stochasticK,
    stochasticD,
    trendStrength,
  } = indicators;

  const cond = detectMarketCondition(indicators);
  const supportingSignals: string[] = [];
  const conflictingSignals: string[] = [];

  let bullishPoints = 0;
  let bearishPoints = 0;

  // RSI â€” weight 20
  if (rsi !== null) {
    if (rsi > 75) {
      bearishPoints += 20;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} â€” strongly overbought, reversal pressure`);
    } else if (rsi > 60) {
      bullishPoints += 15;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} â€” bullish momentum`);
    } else if (rsi > 50) {
      bullishPoints += 8;
    } else if (rsi < 25) {
      bullishPoints += 20;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} â€” strongly oversold, bounce potential`);
    } else if (rsi < 40) {
      bearishPoints += 15;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} â€” bearish pressure`);
    } else if (rsi < 50) {
      bearishPoints += 8;
    } else {
      bullishPoints += 4;
      bearishPoints += 4;
    }
  }

  // MACD â€” weight 20
  if (macdLine !== null && macdSignal !== null && macdHistogram !== null) {
    if (macdLine > macdSignal && macdHistogram > 0) {
      bullishPoints += 20;
      supportingSignals.push("MACD above signal line â€” bullish momentum confirmed");
    } else if (macdLine < macdSignal && macdHistogram < 0) {
      bearishPoints += 20;
      supportingSignals.push("MACD below signal line â€” bearish momentum confirmed");
    } else if (macdLine > macdSignal && macdHistogram < 0) {
      bullishPoints += 10;
      bearishPoints += 5;
      conflictingSignals.push("MACD bullish but histogram shrinking â€” momentum uncertain");
    } else {
      bearishPoints += 10;
      bullishPoints += 5;
      conflictingSignals.push("MACD bearish cross forming â€” watch for continuation");
    }
  }

  // EMA alignment â€” weight 25
  if (ema9 !== null && ema21 !== null && ema50 !== null) {
    if (ema9 > ema21 && ema21 > ema50) {
      bullishPoints += 25;
      supportingSignals.push("EMA 9 > 21 > 50 â€” strong bullish alignment");
    } else if (ema9 < ema21 && ema21 < ema50) {
      bearishPoints += 25;
      supportingSignals.push("EMA 9 < 21 < 50 â€” strong bearish alignment");
    } else if (ema9 > ema21 && ema9 > ema50 && ema21 < ema50) {
      bullishPoints += 12;
      bearishPoints += 6;
      conflictingSignals.push("EMA mixed â€” short-term bullish vs long-term bearish structure");
    } else {
      bearishPoints += 12;
      bullishPoints += 6;
      conflictingSignals.push("EMA mixed â€” short-term bearish vs long-term bullish structure");
    }
  }

  // Stochastic â€” weight 15
  if (stochasticK !== null && stochasticD !== null) {
    if (stochasticK > 80 && stochasticK > stochasticD) {
      bearishPoints += 15;
      supportingSignals.push(`Stochastic ${stochasticK.toFixed(0)} â€” overbought and falling`);
    } else if (stochasticK > 80) {
      bearishPoints += 10;
      conflictingSignals.push(`Stochastic ${stochasticK.toFixed(0)} â€” overbought zone`);
    } else if (stochasticK < 20 && stochasticK < stochasticD) {
      bullishPoints += 15;
      supportingSignals.push(`Stochastic ${stochasticK.toFixed(0)} â€” oversold and rising`);
    } else if (stochasticK < 20) {
      bullishPoints += 10;
      conflictingSignals.push(`Stochastic ${stochasticK.toFixed(0)} â€” oversold zone`);
    } else if (stochasticK > stochasticD) {
      bullishPoints += 8;
    } else {
      bearishPoints += 8;
    }
  }

  // ATR / Volatility â€” weight 10
  if (atr !== null) {
    if (cond.volatility === "extreme") {
      bearishPoints += 6;
    } else if (cond.volatility === "high") {
      bearishPoints += 3;
      bullishPoints += 3;
    } else if (cond.volatility === "low") {
      bullishPoints += 5;
    } else {
      bullishPoints += 4;
      bearishPoints += 3;
    }
  }

  // Trend Strength â€” weight 10
  if (trendStrength !== null) {
    if (trendStrength > 50 && cond.trend === "bullish") {
      bullishPoints += 10;
      supportingSignals.push(`Trend strength ${trendStrength.toFixed(0)}% â€” strong bullish trend`);
    } else if (trendStrength > 50 && cond.trend === "bearish") {
      bearishPoints += 10;
      supportingSignals.push(`Trend strength ${trendStrength.toFixed(0)}% â€” strong bearish trend`);
    } else if (trendStrength < 15) {
      bullishPoints += 3;
      bearishPoints += 3;
      conflictingSignals.push(`Trend strength ${trendStrength.toFixed(0)}% â€” weak trend, ranging market`);
    }
  }

  if (cond.spikeDetected) {
    conflictingSignals.push("Volatility spike detected â€” price action unreliable");
  }
  if (cond.reversalWarning) {
    conflictingSignals.push("Reversal conditions present â€” trend change possible");
  }

  // Normalize scores
  const total = bullishPoints + bearishPoints;
  const bullishScore = total > 0 ? Math.round((bullishPoints / total) * 100) : 50;
  const bearishScore = 100 - bullishScore;
  const neutralScore = Math.min(Math.round(conflictingSignals.length * 20), 60);

  // Confidence
  const signalDominance = Math.abs(bullishScore - bearishScore);
  const baseConfidence = signalDominance * 0.7 + 20;
  const penaltyConflicts = conflictingSignals.length * 8;
  const penaltyVolatility =
    cond.volatility === "extreme" ? 18 : cond.volatility === "high" ? 10 : 0;
  const penaltySpike = cond.spikeDetected ? 15 : 0;
  const confidence = Math.max(
    15,
    Math.min(88, Math.round(baseConfidence - penaltyConflicts - penaltyVolatility - penaltySpike))
  );

  // Market state
  let marketState: MarketState;
  if (cond.spikeDetected) {
    marketState = "Spike Risk";
  } else if (cond.reversalWarning) {
    marketState = "Reversal Watch";
  } else if (cond.volatility === "extreme") {
    marketState = "Volatile";
  } else if (bullishScore >= 70 && confidence >= 55) {
    marketState = "Strong Bullish";
  } else if (bullishScore >= 57) {
    marketState = "Weak Bullish";
  } else if (bearishScore >= 70 && confidence >= 55) {
    marketState = "Strong Bearish";
  } else if (bearishScore >= 57) {
    marketState = "Weak Bearish";
  } else if (
    cond.marketCondition === "ranging" ||
    (trendStrength !== null && trendStrength < 15)
  ) {
    marketState = "Ranging";
  } else {
    marketState = "Uncertain";
  }

  // Risk level
  let riskLevel: RiskLevel;
  if (cond.volatility === "extreme" || cond.spikeDetected) {
    riskLevel = "Extreme";
  } else if (cond.volatility === "high" || conflictingSignals.length >= 2 || confidence < 40) {
    riskLevel = "High";
  } else if (cond.volatility === "medium" || conflictingSignals.length === 1) {
    riskLevel = "Medium";
  } else {
    riskLevel = "Low";
  }

  const noTradeZone =
    confidence < 38 ||
    marketState === "Spike Risk" ||
    marketState === "Uncertain" ||
    conflictingSignals.length >= 3;

  return {
    bullishScore,
    bearishScore,
    neutralScore,
    confidence,
    riskLevel,
    marketState,
    supportingSignals,
    conflictingSignals,
    noTradeZone,
  };
}

// â”€â”€â”€ Signal Quality Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PatternHistoryEntry {
  successRate: number;
  totalTrades: number;
}

export function computeSignalQuality(
  signals: SignalResult,
  indicators: IndicatorSet,
  patternHistory?: PatternHistoryEntry
): SignalQuality {
  const { rsi, macdLine, macdSignal, macdHistogram, ema9, ema21, ema50, stochasticK, trendStrength } = indicators;
  const cond = detectMarketCondition(indicators);
  const isBullishDominant = signals.bullishScore > signals.bearishScore;

  // â”€â”€ Indicator Alignment Score (0â€“100) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Each of 4 indicators gets 25 points if it agrees with the dominant direction
  let alignmentPoints = 0;

  // RSI alignment
  if (rsi !== null) {
    if (isBullishDominant && rsi > 52) alignmentPoints += 25;
    else if (!isBullishDominant && rsi < 48) alignmentPoints += 25;
    else if (Math.abs(rsi - 50) < 5) alignmentPoints += 8; // neutral, partial credit
    else alignmentPoints += 12; // slight opposite â€” conflict penalty
  } else {
    alignmentPoints += 12;
  }

  // MACD alignment
  if (macdLine !== null && macdSignal !== null && macdHistogram !== null) {
    const macdBullish = macdLine > macdSignal && macdHistogram > 0;
    const macdBearish = macdLine < macdSignal && macdHistogram < 0;
    if (isBullishDominant && macdBullish) alignmentPoints += 25;
    else if (!isBullishDominant && macdBearish) alignmentPoints += 25;
    else if (macdBullish || macdBearish) alignmentPoints += 10; // partial
    else alignmentPoints += 5; // conflicting
  } else {
    alignmentPoints += 12;
  }

  // EMA alignment
  if (ema9 !== null && ema21 !== null && ema50 !== null) {
    const emaFullBull = ema9 > ema21 && ema21 > ema50;
    const emaFullBear = ema9 < ema21 && ema21 < ema50;
    if (isBullishDominant && emaFullBull) alignmentPoints += 25;
    else if (!isBullishDominant && emaFullBear) alignmentPoints += 25;
    else alignmentPoints += 5; // mixed
  } else {
    alignmentPoints += 12;
  }

  // Stochastic alignment
  if (stochasticK !== null) {
    if (isBullishDominant && stochasticK > 50 && stochasticK < 80) alignmentPoints += 25;
    else if (!isBullishDominant && stochasticK < 50 && stochasticK > 20) alignmentPoints += 25;
    else if (stochasticK >= 80 || stochasticK <= 20) alignmentPoints += 5; // extreme zones reduce quality
    else alignmentPoints += 12;
  } else {
    alignmentPoints += 12;
  }

  const indicatorAlignment = Math.min(100, alignmentPoints);

  // â”€â”€ Momentum Confirmation Score (0â€“100) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let momentumScore = 0;

  // MACD histogram strength
  if (macdHistogram !== null) {
    const histStrength = Math.min(Math.abs(macdHistogram) * 10000, 30);
    momentumScore += histStrength;
  }

  // Trend strength
  if (trendStrength !== null) {
    if (trendStrength > 60) momentumScore += 40;
    else if (trendStrength > 35) momentumScore += 25;
    else if (trendStrength > 15) momentumScore += 10;
    else momentumScore += 0; // weak trend hurts
  }

  // RSI distance from 50 (momentum)
  if (rsi !== null) {
    const rsiMomentum = Math.min(Math.abs(rsi - 50) * 0.6, 30);
    momentumScore += rsiMomentum;
  }

  const momentumConfirmation = Math.min(100, Math.round(momentumScore));

  // â”€â”€ Volatility Compatibility Score (0â€“100) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let volatilityScore: number;
  switch (cond.volatility) {
    case "low":    volatilityScore = 85; break; // low vol = clean trending
    case "medium": volatilityScore = 100; break; // ideal for directional trades
    case "high":   volatilityScore = 45; break;
    case "extreme":volatilityScore = 10; break;
    default:       volatilityScore = 70;
  }
  if (cond.spikeDetected) volatilityScore = Math.min(volatilityScore, 15);
  const volatilityCompatibility = volatilityScore;

  // â”€â”€ Conflict Penalty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const conflictPenalty = signals.conflictingSignals.length * 12;

  // â”€â”€ Historical Boost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let historicalBoost = 0;
  if (patternHistory && patternHistory.totalTrades >= 3) {
    if (patternHistory.successRate >= 70) historicalBoost = 12;
    else if (patternHistory.successRate >= 60) historicalBoost = 6;
    else if (patternHistory.successRate <= 35) historicalBoost = -10;
  }

  // â”€â”€ Clean Signal Score (0â€“100) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const rawClean =
    indicatorAlignment * 0.40 +
    momentumConfirmation * 0.30 +
    volatilityCompatibility * 0.20 +
    Math.max(0, 10 - conflictPenalty) * 1.0; // 10 bonus for no conflicts, scaled

  const cleanSignalScore = Math.max(0, Math.min(100, Math.round(rawClean + historicalBoost)));

  // â”€â”€ Risk Score (0â€“100, higher = riskier) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const riskScore = Math.max(0, Math.min(100, Math.round(
    100 - cleanSignalScore + conflictPenalty * 0.5
  )));

  // â”€â”€ Confidence Weight (adjusted with history) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const confidenceWeight = Math.min(
    95,
    Math.max(15, signals.confidence + historicalBoost)
  );

  // â”€â”€ Market Cleanliness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let marketCleanliness: MarketCleanliness;
  if (cleanSignalScore >= 72 && signals.conflictingSignals.length === 0) {
    marketCleanliness = "clean";
  } else if (
    signals.marketState.includes("Bullish") ||
    signals.marketState.includes("Bearish")
  ) {
    marketCleanliness = "trending";
  } else if (cond.volatility === "high" || cond.volatility === "extreme" || cond.spikeDetected) {
    marketCleanliness = "volatile";
  } else {
    marketCleanliness = "choppy";
  }

  // â”€â”€ Setup Rarity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let setupRarity: SetupRarity;
  const allAligned = indicatorAlignment >= 90;
  if (cleanSignalScore >= 85 && allAligned && historicalBoost > 0) {
    setupRarity = "exceptional";
  } else if (cleanSignalScore >= 72 && indicatorAlignment >= 75) {
    setupRarity = "rare";
  } else if (cleanSignalScore >= 55) {
    setupRarity = "moderate";
  } else {
    setupRarity = "common";
  }

  // â”€â”€ Alert Type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let alertType: AlertType = "none";

  if (signals.marketState === "Spike Risk") {
    alertType = "Spike Risk Warning";
  } else if (signals.noTradeZone && signals.conflictingSignals.length >= 2) {
    alertType = "No-Trade Warning";
  } else if (signals.marketState === "Reversal Watch") {
    alertType = "Reversal Watch";
  } else if (
    cleanSignalScore >= 65 &&
    confidenceWeight >= 62 &&
    signals.bullishScore >= 58 &&
    signals.conflictingSignals.length <= 1 &&
    !cond.spikeDetected &&
    signals.marketState !== "Ranging"
  ) {
    alertType = "High Confidence Bullish";
  } else if (
    cleanSignalScore >= 65 &&
    confidenceWeight >= 62 &&
    signals.bearishScore >= 58 &&
    signals.conflictingSignals.length <= 1 &&
    !cond.spikeDetected &&
    signals.marketState !== "Ranging"
  ) {
    alertType = "High Confidence Bearish";
  }

  // â”€â”€ Expiry Seconds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Higher quality = signal valid longer; spike risk = expires fast
  const expirySeconds =
    alertType === "Spike Risk Warning" ? 120
    : alertType === "No-Trade Warning" ? 300
    : cleanSignalScore >= 80 ? 600
    : cleanSignalScore >= 65 ? 420
    : 300;

  return {
    cleanSignalScore,
    riskScore,
    confidenceWeight,
    indicatorAlignment,
    momentumConfirmation,
    volatilityCompatibility,
    marketCleanliness,
    setupRarity,
    alertType,
    expirySeconds,
    historicalBoost,
  };
}
