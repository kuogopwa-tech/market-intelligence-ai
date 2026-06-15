import type { IndicatorSet } from "./indicators.js";
import { detectMarketCondition, type VolatilityState } from "./indicators.js";

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
  finalDirection: "Bullish" | "Bearish" | "Volatile";
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function volatilityPenaltyForConfidence(volatilityState: VolatilityState): number {
  switch (volatilityState) {
    case "Spike Risk":
      return 22;
    case "High":
      return 12;
    case "Elevated":
      return 6;
    case "Normal":
    default:
      return 0;
  }
}

function volatilityPenaltyForRisk(volatilityState: VolatilityState): number {
  // Keep spike risk from dominating; capped later in riskScore.
  switch (volatilityState) {
    case "Spike Risk":
      return 14;
    case "High":
      return 10;
    case "Elevated":
      return 6;
    case "Normal":
    default:
      return 0;
  }
}

function volatilityPointsForRisk(volatilityState: VolatilityState): number {
  // Spike contribution max 10 points only (requirement #4)
  switch (volatilityState) {
    case "Spike Risk":
      return 10;
    case "High":
      return 7;
    case "Elevated":
      return 4;
    case "Normal":
    default:
      return 0;
  }
}

function volatilityCompatibilityScore(volatilityState: VolatilityState): number {
  switch (volatilityState) {
    case "Normal":
      return 85;
    case "Elevated":
      return 100;
    case "High":
      return 45;
    case "Spike Risk":
      return 10;
    default:
      return 70;
  }
}

function resolveFinalDirectionFromEMA(params: {
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
}): "Bullish" | "Bearish" | "Volatile" {
  const { ema9, ema21, ema50 } = params;
  if (ema9 === null || ema21 === null || ema50 === null) return "Volatile";
  if (ema9 > ema21 && ema21 > ema50) return "Bullish";
  if (ema9 < ema21 && ema21 < ema50) return "Bearish";
  return "Volatile";
}

function stateForDirection(params: {
  bullishScore: number;
  bearishScore: number;
  confidence: number;
  marketCondition: string;
  trendStrength: number | null;
}): Exclude<MarketState, "Spike Risk" | "Reversal Watch" | "Volatile"> {
  const { bullishScore, bearishScore, confidence, marketCondition, trendStrength } = params;

  if (bullishScore >= 70 && confidence >= 55) return "Strong Bullish";
  if (bullishScore >= 57) return "Weak Bullish";
  if (bearishScore >= 70 && confidence >= 55) return "Strong Bearish";
  if (bearishScore >= 57) return "Weak Bearish";

  if (marketCondition === "ranging" || (trendStrength !== null && trendStrength < 15)) return "Ranging";

  return "Uncertain";
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
    stochasticK,
    stochasticD,
    trendStrength,
  } = indicators;

  // HARD LOCK: finalDirection must be derived ONLY from EMA structure.
  const finalDirection = resolveFinalDirectionFromEMA({ ema9, ema21, ema50 });

  const cond = detectMarketCondition(indicators);
  const volatilityState = cond.volatilityState;
  const spikeRatio = cond.spikeRatio;

  const supportingSignals: string[] = [];
  const conflictingSignals: string[] = [];

  let bullishPoints = 0;
  let bearishPoints = 0;

  // RSI — weight 20
  if (rsi !== null) {
    if (rsi > 75) {
      bearishPoints += 20;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} — strongly overbought, reversal pressure`);
    } else if (rsi > 60) {
      bullishPoints += 15;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} — bullish momentum`);
    } else if (rsi > 50) {
      bullishPoints += 8;
    } else if (rsi < 25) {
      bullishPoints += 20;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} — strongly oversold, bounce potential`);
    } else if (rsi < 40) {
      bearishPoints += 15;
      supportingSignals.push(`RSI ${rsi.toFixed(1)} — bearish pressure`);
    } else if (rsi < 50) {
      bearishPoints += 8;
    } else {
      bullishPoints += 4;
      bearishPoints += 4;
    }
  }

  // MACD — weight 20
  if (macdLine !== null && macdSignal !== null && macdHistogram !== null) {
    if (macdLine > macdSignal && macdHistogram > 0) {
      bullishPoints += 20;
      supportingSignals.push("MACD above signal line — bullish momentum confirmed");
    } else if (macdLine < macdSignal && macdHistogram < 0) {
      bearishPoints += 20;
      supportingSignals.push("MACD below signal line — bearish momentum confirmed");
    } else if (macdLine > macdSignal && macdHistogram < 0) {
      bullishPoints += 10;
      bearishPoints += 5;
      conflictingSignals.push("MACD bullish but histogram shrinking — momentum uncertain");
    } else {
      bearishPoints += 10;
      bullishPoints += 5;
      conflictingSignals.push("MACD bearish cross forming — watch for continuation");
    }
  }

  // EMA alignment — weight 25
  if (ema9 !== null && ema21 !== null && ema50 !== null) {
    if (ema9 > ema21 && ema21 > ema50) {
      bullishPoints += 25;
      supportingSignals.push("EMA 9 > 21 > 50 — strong bullish alignment");
    } else if (ema9 < ema21 && ema21 < ema50) {
      bearishPoints += 25;
      supportingSignals.push("EMA 9 < 21 < 50 — strong bearish alignment");
    } else if (ema9 > ema21 && ema9 > ema50 && ema21 < ema50) {
      bullishPoints += 12;
      bearishPoints += 6;
      conflictingSignals.push("EMA mixed — short-term bullish vs long-term bearish structure");
    } else {
      bearishPoints += 12;
      bullishPoints += 6;
      conflictingSignals.push("EMA mixed — short-term bearish vs long-term bullish structure");
    }
  }

  // Stochastic — weight 15
  if (stochasticK !== null && stochasticD !== null) {
    if (stochasticK > 80 && stochasticK > stochasticD) {
      bearishPoints += 15;
      supportingSignals.push(`Stochastic ${stochasticK.toFixed(0)} — overbought and falling`);
    } else if (stochasticK > 80) {
      bearishPoints += 10;
      conflictingSignals.push(`Stochastic ${stochasticK.toFixed(0)} — overbought zone`);
    } else if (stochasticK < 20 && stochasticK < stochasticD) {
      bullishPoints += 15;
      supportingSignals.push(`Stochastic ${stochasticK.toFixed(0)} — oversold and rising`);
    } else if (stochasticK < 20) {
      bullishPoints += 10;
      conflictingSignals.push(`Stochastic ${stochasticK.toFixed(0)} — oversold zone`);
    } else if (stochasticK > stochasticD) {
      bullishPoints += 8;
    } else {
      bearishPoints += 8;
    }
  }

  // Volatility (non-spike) — weight 10
  // IMPORTANT: do NOT infer spike from ATR here. Only use cond.volatilityState.
  const volatilityNonSpike = volatilityState === "Spike Risk" ? null : volatilityState;
  if (volatilityNonSpike !== null) {
    // Convert volatilityState into earlier buckets for weighting.
    if (volatilityNonSpike === "High") {
      bearishPoints += 6;
    } else if (volatilityNonSpike === "Elevated") {
      bearishPoints += 3;
      bullishPoints += 3;
    } else {
      bullishPoints += 5;
    }
  }

  // Trend Strength — weight 10
  if (trendStrength !== null) {
    if (trendStrength > 50 && cond.trend === "bullish") {
      bullishPoints += 10;
      supportingSignals.push(`Trend strength ${trendStrength.toFixed(0)}% — strong bullish trend`);
    } else if (trendStrength > 50 && cond.trend === "bearish") {
      bearishPoints += 10;
      supportingSignals.push(`Trend strength ${trendStrength.toFixed(0)}% — strong bearish trend`);
    } else if (trendStrength < 15) {
      bullishPoints += 3;
      bearishPoints += 3;
      conflictingSignals.push(`Trend strength ${trendStrength.toFixed(0)}% — weak trend, ranging market`);
    }
  }

  // Reversal warning stays (requirement only targets spikeDetected / ATR inference)
  if (cond.reversalWarning) conflictingSignals.push("Reversal conditions present — trend change possible");

  // Normalize scores
  const total = bullishPoints + bearishPoints;
  const bullishScore = total > 0 ? Math.round((bullishPoints / total) * 100) : 50;
  const bearishScore = 100 - bullishScore;
  const neutralScore = Math.min(Math.round(conflictingSignals.length * 20), 60);

  // Confidence (ONLY volatilityState + conflicts; no spikeDetected usage)
  const signalDominance = Math.abs(bullishScore - bearishScore);
  const baseConfidence = signalDominance * 0.7 + 20;
  const penaltyConflicts = conflictingSignals.length * 8;
  const penaltyVolatility = volatilityPenaltyForConfidence(volatilityState);
  const confidence = clamp(Math.round(baseConfidence - penaltyConflicts - penaltyVolatility), 15, 88);

  // Market state (does not affect finalDirection hard lock)
  let marketState: MarketState;
  if (volatilityState === "Spike Risk") {
    marketState = "Spike Risk";
  } else if (cond.reversalWarning) {
    marketState = "Reversal Watch";
  } else if (cond.volatility === "extreme") {
    marketState = "Volatile";
  } else {
    marketState = stateForDirection({
      bullishScore,
      bearishScore,
      confidence,
      marketCondition: cond.marketCondition,
      trendStrength,
    });
  }

  // Risk level
  // Spike risk drives Extreme, but spike contribution is capped for riskScore below.
  let riskLevel: RiskLevel;
  if (volatilityState === "Spike Risk") {
    riskLevel = "Extreme";
  } else if (cond.volatility === "extreme") {
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

  // Debug output
  // eslint-disable-next-line no-console
  console.debug("[signalEngine] mergeSignals", {
    volatilityState,
    spikeRatio,
    finalMarketState: marketState,
    finalConfidence: confidence,
  });

  return {
    bullishScore,
    bearishScore,
    neutralScore,
    finalDirection,
    confidence,
    riskLevel,
    marketState,
    supportingSignals,
    conflictingSignals,
    noTradeZone,
  };
}

interface PatternHistoryEntry {
  successRate: number;
  totalTrades: number;
}

export function computeSignalQuality(
  signals: SignalResult,
  indicators: IndicatorSet,
  patternHistory?: PatternHistoryEntry
): SignalQuality {
  const {
    rsi,
    macdLine,
    macdSignal,
    macdHistogram,
    ema9,
    ema21,
    ema50,
    stochasticK,
    trendStrength,
  } = indicators;

  const cond = detectMarketCondition(indicators);
  const volatilityState = cond.volatilityState;

  const isBullishDominant = signals.bullishScore > signals.bearishScore;

  // Indicator Alignment Score (0–100)
  let alignmentPoints = 0;

  // RSI alignment
  if (rsi !== null) {
    if (isBullishDominant && rsi > 52) alignmentPoints += 25;
    else if (!isBullishDominant && rsi < 48) alignmentPoints += 25;
    else if (Math.abs(rsi - 50) < 5) alignmentPoints += 8;
    else alignmentPoints += 12;
  } else {
    alignmentPoints += 12;
  }

  // MACD alignment
  if (macdLine !== null && macdSignal !== null && macdHistogram !== null) {
    const macdBullish = macdLine > macdSignal && macdHistogram > 0;
    const macdBearish = macdLine < macdSignal && macdHistogram < 0;
    if (isBullishDominant && macdBullish) alignmentPoints += 25;
    else if (!isBullishDominant && macdBearish) alignmentPoints += 25;
    else if (macdBullish || macdBearish) alignmentPoints += 10;
    else alignmentPoints += 5;
  } else {
    alignmentPoints += 12;
  }

  // EMA alignment
  if (ema9 !== null && ema21 !== null && ema50 !== null) {
    const emaFullBull = ema9 > ema21 && ema21 > ema50;
    const emaFullBear = ema9 < ema21 && ema21 < ema50;
    if (isBullishDominant && emaFullBull) alignmentPoints += 25;
    else if (!isBullishDominant && emaFullBear) alignmentPoints += 25;
    else alignmentPoints += 5;
  } else {
    alignmentPoints += 12;
  }

  // Stochastic alignment
  if (stochasticK !== null) {
    if (isBullishDominant && stochasticK > 50 && stochasticK < 80) alignmentPoints += 25;
    else if (!isBullishDominant && stochasticK < 50 && stochasticK > 20) alignmentPoints += 25;
    else if (stochasticK >= 80 || stochasticK <= 20) alignmentPoints += 5;
    else alignmentPoints += 12;
  } else {
    alignmentPoints += 12;
  }

  const indicatorAlignment = Math.min(100, alignmentPoints);

  // Momentum Confirmation Score (0–100)
  let momentumScore = 0;

  if (macdHistogram !== null) {
    const histStrength = Math.min(Math.abs(macdHistogram) * 10000, 30);
    momentumScore += histStrength;
  }

  if (trendStrength !== null) {
    if (trendStrength > 60) momentumScore += 40;
    else if (trendStrength > 35) momentumScore += 25;
    else if (trendStrength > 15) momentumScore += 10;
    else momentumScore += 0;
  }

  if (rsi !== null) {
    const rsiMomentum = Math.min(Math.abs(rsi - 50) * 0.6, 30);
    momentumScore += rsiMomentum;
  }

  const momentumConfirmation = Math.min(100, Math.round(momentumScore));

  // Volatility Compatibility Score (0–100)
  const volatilityCompatibility = volatilityCompatibilityScore(volatilityState);

  // Conflict Penalty
  const conflictPenalty = signals.conflictingSignals.length * 12;

  // Historical Boost
  let historicalBoost = 0;
  if (patternHistory && patternHistory.totalTrades >= 3) {
    if (patternHistory.successRate >= 70) historicalBoost = 12;
    else if (patternHistory.successRate >= 60) historicalBoost = 6;
    else if (patternHistory.successRate <= 35) historicalBoost = -10;
  }

  // Clean Signal Score (0–100)
  const rawClean =
    indicatorAlignment * 0.4 +
    momentumConfirmation * 0.3 +
    volatilityCompatibility * 0.2 +
    Math.max(0, 10 - conflictPenalty) * 1.0;

  const cleanSignalScore = Math.max(0, Math.min(100, Math.round(rawClean + historicalBoost)));

  // Risk Score (0–100)
  // Ensure volatility does not dominate classification; spike contribution capped at 10 points.
  const spikeContribution = volatilityPointsForRisk(volatilityState);
  const otherVolPenalty = volatilityPenaltyForRisk(volatilityState);

  const baseRisk = 100 - cleanSignalScore + conflictPenalty * 0.5;
  const riskScore = clamp(Math.round(baseRisk + otherVolPenalty - (10 - spikeContribution) * 0), 0, 100);
  // NOTE: spikeContribution is already capped; further capped by clamp.

  // Confidence Weight
  const confidenceWeight = clamp(Math.round(signals.confidence + historicalBoost), 15, 95);

  // Market Cleanliness
  let marketCleanliness: MarketCleanliness;
  if (cleanSignalScore >= 72 && signals.conflictingSignals.length === 0) {
    marketCleanliness = "clean";
  } else if (signals.marketState.includes("Bullish") || signals.marketState.includes("Bearish")) {
    marketCleanliness = "trending";
  } else if (cond.volatility === "high" || cond.volatility === "extreme" || volatilityState === "Spike Risk") {
    marketCleanliness = "volatile";
  } else {
    marketCleanliness = "choppy";
  }

  // Setup Rarity
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

  // Alert Type
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
    volatilityState !== "Spike Risk" &&
    signals.marketState !== "Ranging"
  ) {
    alertType = "High Confidence Bullish";
  } else if (
    cleanSignalScore >= 65 &&
    confidenceWeight >= 62 &&
    signals.bearishScore >= 58 &&
    signals.conflictingSignals.length <= 1 &&
    volatilityState !== "Spike Risk" &&
    signals.marketState !== "Ranging"
  ) {
    alertType = "High Confidence Bearish";
  }

  // Expiry Seconds
  const expirySeconds =
    alertType === "Spike Risk Warning" ? 120 :
    alertType === "No-Trade Warning" ? 300 :
    cleanSignalScore >= 80 ? 600 :
    cleanSignalScore >= 65 ? 420 :
    300;

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

