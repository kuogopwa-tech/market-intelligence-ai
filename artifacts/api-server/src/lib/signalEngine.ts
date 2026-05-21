import type { IndicatorSet } from "./indicators";
import { detectMarketCondition } from "./indicators";

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

  // ATR / Volatility — weight 10
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

  // Support/Resistance reactions
  if (cond.spikeDetected) {
    conflictingSignals.push("Volatility spike detected — price action unreliable");
  }
  if (cond.reversalWarning) {
    conflictingSignals.push("Reversal conditions present — trend change possible");
  }

  // Normalize scores
  const total = bullishPoints + bearishPoints;
  const bullishScore = total > 0 ? Math.round((bullishPoints / total) * 100) : 50;
  const bearishScore = 100 - bullishScore;
  const neutralScore = Math.min(Math.round(conflictingSignals.length * 20), 60);

  // Confidence calculation
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

  // Market state classification
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
