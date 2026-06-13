export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IndicatorSet {
  symbol: string;
  calculatedAt: number;
  rsi: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  sma20: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  atr: number | null;
  atr20Avg: number | null;      // NEW: 20-period average ATR for adaptive spike detection
  atrHistory: number[] | null;   // NEW: ATR history for per-symbol normalization
  stochasticK: number | null;
  stochasticD: number | null;
  trendStrength: number | null;
}

function ema(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

export function calcRSI(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const closes = candles.map((c) => c.close);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

export function calcMACD(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9
): { line: number | null; signalLine: number | null; histogram: number | null } {
  const closes = candles.map((c) => c.close);
  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);
  if (fastEMA.length === 0 || slowEMA.length === 0) {
    return { line: null, signalLine: null, histogram: null };
  }
  const diff = slowEMA.length - fastEMA.length;
  const macdLine = fastEMA.slice(diff).map((v, i) => v - slowEMA[i]);
  const signalLine = ema(macdLine, signal);
  if (signalLine.length === 0) {
    return { line: null, signalLine: null, histogram: null };
  }
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    line: parseFloat(lastMacd.toFixed(5)),
    signalLine: parseFloat(lastSignal.toFixed(5)),
    histogram: parseFloat((lastMacd - lastSignal).toFixed(5)),
  };
}

export function calcEMA(candles: Candle[], period: number): number | null {
  const closes = candles.map((c) => c.close);
  const result = ema(closes, period);
  if (result.length === 0) return null;
  return parseFloat(result[result.length - 1].toFixed(5));
}

export function calcSMA(candles: Candle[], period: number): number | null {
  const closes = candles.map((c) => c.close);
  const result = sma(closes, period);
  if (result.length === 0) return null;
  return parseFloat(result[result.length - 1].toFixed(5));
}

export function calcBollingerBands(
  candles: Candle[],
  period = 20,
  stdDev = 2
): { upper: number | null; middle: number | null; lower: number | null } {
  const closes = candles.map((c) => c.close);
  const smaValues = sma(closes, period);
  if (smaValues.length === 0) return { upper: null, middle: null, lower: null };
  const middle = smaValues[smaValues.length - 1];
  const slice = closes.slice(closes.length - period);
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: parseFloat((middle + stdDev * sd).toFixed(5)),
    middle: parseFloat(middle.toFixed(5)),
    lower: parseFloat((middle - stdDev * sd).toFixed(5)),
  };
}

export function calcATR(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  const initial = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let atr = initial;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return parseFloat(atr.toFixed(5));
}

export function calcATRHistory(candles: Candle[], period = 14, lookback = 20): number[] {
  // Returns rolling ATR values for the last `lookback` periods
  // Used for adaptive spike detection (avgATR20 calculation)
  if (candles.length < period + lookback) {
    // If not enough data, return smaller history
    lookback = Math.max(5, candles.length - period);
  }
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  if (trueRanges.length < period) return [];
  
  // Calculate initial ATR
  const results: number[] = [];
  const initial = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let atr = initial;
  results.push(atr);
  
  // Calculate rolling ATR values
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    results.push(atr);
  }
  
  // Return last `lookback` ATR values
  const start = Math.max(0, results.length - lookback);
  return results.slice(start).map(v => parseFloat(v.toFixed(5)));
}

export function getAvgATR20(candles: Candle[], period = 14): number | null {
  // Calculate 20-period average ATR for adaptive spike detection
  const atrHistory = calcATRHistory(candles, period, 20);
  if (atrHistory.length < 10) return null;  // Need at least 10 ATR values
  
  const sum = atrHistory.reduce((a, b) => a + b, 0);
  return parseFloat((sum / atrHistory.length).toFixed(5));
}

export type VolatilityState = "Normal" | "Elevated" | "High" | "Spike Risk";

export function calculateSpikeRatio(currentATR: number | null, avgATR20: number | null): {
  spikeRatio: number | null;
  volatilityState: VolatilityState;
} {
  // Adaptive spike detection based on per-symbol volatility normalization
  // Returns spikeRatio and volatilityState based on classification rules
  if (currentATR === null || avgATR20 === null || avgATR20 === 0) {
    return { spikeRatio: null, volatilityState: "Normal" };
  }
  
  const ratio = currentATR / avgATR20;
  let state: VolatilityState;
  
  if (ratio < 1.2) {
    state = "Normal";
  } else if (ratio < 1.5) {
    state = "Elevated";
  } else if (ratio < 2.0) {
    state = "High";
  } else {
    state = "Spike Risk";
  }
  
  return {
    spikeRatio: parseFloat(ratio.toFixed(2)),
    volatilityState: state
  };
}

export function calcStochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): { k: number | null; d: number | null } {
  if (candles.length < kPeriod) return { k: null, d: null };
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const close = slice[slice.length - 1].close;
    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    kValues.push(k);
  }
  const dValues = sma(kValues, dPeriod);
  return {
    k: kValues.length > 0 ? parseFloat(kValues[kValues.length - 1].toFixed(2)) : null,
    d: dValues.length > 0 ? parseFloat(dValues[dValues.length - 1].toFixed(2)) : null,
  };
}

export function calcTrendStrength(candles: Candle[]): number | null {
  if (candles.length < 50) return null;
  const closes = candles.map((c) => c.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  if (ema20.length === 0 || ema50.length === 0) return null;
  const lastEma20 = ema20[ema20.length - 1];
  const lastEma50 = ema50[ema50.length - 1];
  const priceDiff = Math.abs(lastEma20 - lastEma50) / lastEma50;
  const strength = Math.min(priceDiff * 1000, 100);
  return parseFloat(strength.toFixed(2));
}

export function detectMarketCondition(indicators: IndicatorSet): {
  trend: string;
  volatility: string;
  volatilityValue: number;
  momentum: string;
  marketCondition: string;
  spikeDetected: boolean;
  volatilityState: VolatilityState;
  spikeRatio: number | null;
  currentATR: number | null;
  avgATR20: number | null;
  reversalWarning: boolean;
} {
  const { rsi, macdLine, macdSignal, ema9, ema21, ema50, atr, atr20Avg, trendStrength } = indicators;

  let trend = "neutral";
  if (ema9 && ema21 && ema50) {
    if (ema9 > ema21 && ema21 > ema50) trend = "bullish";
    else if (ema9 < ema21 && ema21 < ema50) trend = "bearish";
    else trend = "ranging";
  }

  const atrVal = atr ?? 0;
  let volatility = "medium";
  let volatilityValue = atrVal;
  if (atrVal < 0.0003) { volatility = "low"; }
  else if (atrVal < 0.001) { volatility = "medium"; }
  else if (atrVal < 0.003) { volatility = "high"; }
  else { volatility = "extreme"; }

  let momentum = "flat";
  if (rsi !== null) {
    if (rsi > 70) momentum = "strong_up";
    else if (rsi > 55) momentum = "up";
    else if (rsi < 30) momentum = "strong_down";
    else if (rsi < 45) momentum = "down";
    else momentum = "flat";
  }

  let marketCondition = "uncertain";
  const strength = trendStrength ?? 0;
  if (strength > 30) marketCondition = "trending";
  else if (strength > 10) marketCondition = "ranging";
  else if (rsi !== null && (rsi > 75 || rsi < 25)) marketCondition = "reversing";
  else marketCondition = "uncertain";

  // Use adaptive spike detection based on per-symbol volatility normalization
  const { spikeRatio, volatilityState } = calculateSpikeRatio(atr, atr20Avg);
  const spikeDetected = volatilityState === "Spike Risk";
  
  const reversalWarning =
    (rsi !== null && (rsi > 80 || rsi < 20)) ||
    (macdLine !== null && macdSignal !== null && Math.abs(macdLine - macdSignal) > atrVal * 2);

  return { 
    trend, 
    volatility, 
    volatilityValue, 
    momentum, 
    marketCondition, 
    spikeDetected, 
    volatilityState,
    spikeRatio,
    currentATR: atr,
    avgATR20: atr20Avg,
    reversalWarning 
  };
}

export function calculateAllIndicators(symbol: string, candles: Candle[]): IndicatorSet {
  const rsi = calcRSI(candles);
  const { line: macdLine, signalLine: macdSignal, histogram: macdHistogram } = calcMACD(candles);
  const ema9 = calcEMA(candles, 9);
  const ema21 = calcEMA(candles, 21);
  const ema50 = calcEMA(candles, 50);
  const sma20 = calcSMA(candles, 20);
  const { upper: bollingerUpper, middle: bollingerMiddle, lower: bollingerLower } = calcBollingerBands(candles);
  const atr = calcATR(candles);
  const atr20Avg = getAvgATR20(candles);
  const atrHistory = calcATRHistory(candles, 14, 20);
  const { k: stochasticK, d: stochasticD } = calcStochastic(candles);
  const trendStrength = calcTrendStrength(candles);

  return {
    symbol,
    calculatedAt: Math.floor(Date.now() / 1000),
    rsi,
    macdLine,
    macdSignal,
    macdHistogram,
    ema9,
    ema21,
    ema50,
    sma20,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    atr,
    atr20Avg,
    atrHistory: atrHistory.length > 0 ? atrHistory : null,
    stochasticK,
    stochasticD,
    trendStrength,
  };
}
