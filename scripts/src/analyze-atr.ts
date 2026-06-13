// @ts-ignore
import { getCandles, SUPPORTED_SYMBOLS } from "../../artifacts/api-server/src/lib/derivWs.js";
// @ts-ignore
import { calcATR } from "../../artifacts/api-server/src/lib/indicators.js";

interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ATRStats {
  symbol: string;
  avgATR: number;
  maxATR: number;
  minATR: number;
  currentATR: number;
  spikeCountFixed: number;
  spikePctFixed: number;
  spikeCount2x: number;
  spikeCount2_5x: number;
  spikeCount3x: number;
}

async function analyzeATR(): Promise<void> {
  console.log("=== ATR Analysis Per Symbol ===\n");
  console.log("Fetching candles for all symbols...\n");

  const results: ATRStats[] = [];

  for (const sym of SUPPORTED_SYMBOLS) {
    try {
      const candles = await getCandles(sym.symbol, 60, 150);
      if (candles.length < 25) {
        console.log(`SKIP ${sym.symbol}: insufficient data`);
        continue;
      }

      // Calculate ATR for each candle window (using 20-period)
      const atrValues: number[] = [];
      for (let i = 20; i < candles.length; i++) {
        const window = candles.slice(i - 20, i) as Candle[];
        const atr = calcATR(window, 14);
        if (atr !== null) atrValues.push(atr);
      }

      if (atrValues.length === 0) continue;

      const avgATR = atrValues.reduce((a, b) => a + b, 0) / atrValues.length;
      const maxATR = Math.max(...atrValues);
      const minATR = Math.min(...atrValues);
      const currentATR = atrValues[atrValues.length - 1];

      // Count spikes with fixed threshold (0.002)
      const spikeCountFixed = atrValues.filter(v => v > 0.002).length;
      const spikePctFixed = (spikeCountFixed / atrValues.length) * 100;

      // Adaptive thresholds based on average ATR
      const spikeCount2x = atrValues.filter(v => v > avgATR * 2).length;
      const spikeCount2_5x = atrValues.filter(v => v > avgATR * 2.5).length;
      const spikeCount3x = atrValues.filter(v => v > avgATR * 3).length;

      results.push({
        symbol: sym.symbol,
        avgATR: parseFloat(avgATR.toFixed(6)),
        maxATR: parseFloat(maxATR.toFixed(6)),
        minATR: parseFloat(minATR.toFixed(6)),
        currentATR: parseFloat(currentATR.toFixed(6)),
        spikeCountFixed,
        spikePctFixed: parseFloat(spikePctFixed.toFixed(1)),
        spikeCount2x,
        spikeCount2_5x,
        spikeCount3x,
      });

      console.log(`${sym.symbol}: avg=${avgATR.toFixed(6)}, max=${maxATR.toFixed(6)}, current=${currentATR.toFixed(6)}`);
    } catch (err) {
      console.log(`ERROR ${sym.symbol}: ${err}`);
    }
  }

  // Summary table
  console.log("\n=== Summary: Average ATR Per Symbol ===\n");
  console.log("Symbol       | Avg ATR    | Max ATR    | Current   | Spike% @0.002 | 2x    | 2.5x  | 3x");
  console.log("------------|-----------|-----------|----------|--------------|-------|-------|-----");
  
  for (const r of results) {
    console.log(`${r.symbol.padEnd(12)}| ${r.avgATR.toFixed(6)} | ${r.maxATR.toFixed(6)} | ${r.currentATR.toFixed(6)} | ${r.spikePctFixed.toString().padEnd(12)} | ${r.spikeCount2x}    | ${r.spikeCount2_5x}    | ${r.spikeCount3x}`);
  }

  // Determine if fixed thresholds are suitable
  const overallAvg = results.reduce((s, r) => s + r.avgATR, 0) / results.length;
  const overallMax = Math.max(...results.map(r => r.maxATR));
  const avgSpikePctFixed = results.reduce((s, r) => s + r.spikePctFixed, 0) / results.length;
  const totalFixedSpikes = results.reduce((s, r) => s + r.spikeCountFixed, 0);
  const total2xSpikes = results.reduce((s, r) => s + r.spikeCount2x, 0);
  const total2_5xSpikes = results.reduce((s, r) => s + r.spikeCount2_5x, 0);
  const total3xSpikes = results.reduce((s, r) => s + r.spikeCount3x, 0);

  console.log("\n=== Aggregate Analysis ===\n");
  console.log(`Overall Average ATR: ${overallAvg.toFixed(6)}`);
  console.log(`Overall Maximum ATR: ${overallMax.toFixed(6)}`);
  console.log(`Average Spike % (fixed 0.002): ${avgSpikePctFixed.toFixed(1)}%`);
  console.log(`Total spikes @ fixed 0.002: ${totalFixedSpikes}`);
  console.log(`Total spikes @ 2x avg: ${total2xSpikes}`);
  console.log(`Total spikes @ 2.5x avg: ${total2_5xSpikes}`);
  console.log(`Total spikes @ 3x avg: ${total3xSpikes}`);

  // Recommendation
  console.log("\n=== Suitability Assessment ===\n");
  if (avgSpikePctFixed > 60) {
    console.log("FIXED THRESHOLD NOT SUITABLE: Current 0.002 triggers spike in >60% of observations.");
    console.log("Rationale: A threshold that triggers over 60% of the time is not a 'spike' - it's normal volatility.");
  } else if (avgSpikePctFixed > 40) {
    console.log("FIXED THRESHOLD MARGINALLY SUITABLE: Triggers 40-60% of time.");
  } else {
    console.log("FIXED THRESHOLD APPROPRIATE: Triggers <40% of time.");
  }

  // Best adaptive multiplier
  console.log("\n=== Adaptive Threshold Recommendation ===\n");
  console.log("Using adaptive formula: spikeDetected = currentATR > avgATR20 * multiplier\n");
  
  if (avgSpikePctFixed > 60) {
    console.log("Given avgSpikePctFixed > 60%, current fixed threshold is too aggressive.");
    console.log("Recommended: 2.5x or 3x multiplier to reduce spike frequency below 25%.");
  }

  return;
}

analyzeATR().catch(console.error);
