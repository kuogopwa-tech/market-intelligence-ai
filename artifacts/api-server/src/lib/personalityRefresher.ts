/**
 * personalityRefresher.ts
 *
 * Derives and persists a behavioral personality label for a symbol based on its
 * most recent scan result. Called once per symbol at the end of every background
 * scan run. Stored in learning_memory as patternType = 'personality_snapshot' so
 * the AI service and analytics query can reference persisted classifications.
 */
import { db } from "@workspace/db";
import { learningMemoryTable } from "@workspace/db";
import type { SymbolScanResult } from "./backgroundScanner";
import { logger } from "./logger";

type PersonalityLabel =
  | "Clean Mover"
  | "Spike-Prone"
  | "Reversal Heavy"
  | "Trend Follower"
  | "Range-Bound"
  | "Frequently Volatile"
  | "Mixed Behavior";

function derivePersonality(result: SymbolScanResult): PersonalityLabel {
  const { marketState, alertType, riskScore, cleanSignalScore, marketCleanliness, noTradeZone } = result;

  if (marketState === "Spike Risk" || alertType === "Spike Detected") return "Spike-Prone";
  if (noTradeZone && riskScore >= 70) return "Frequently Volatile";
  if (marketCleanliness === "Clean" && cleanSignalScore >= 70) return "Clean Mover";
  if (marketState === "Bullish" || marketState === "Bearish") return "Trend Follower";
  if (marketState === "Reversal Likely") return "Reversal Heavy";
  if (marketState === "Ranging" || (cleanSignalScore < 50 && riskScore < 40)) return "Range-Bound";
  return "Mixed Behavior";
}

/**
 * Called for each symbol at the end of a scan run.
 * Inserts a lightweight personality snapshot into learning_memory.
 * Does NOT upsert — history accumulates intentionally for trend analysis.
 */
export async function refreshSymbolPersonality(
  result: SymbolScanResult,
  scanRunId: number
): Promise<void> {
  const personality = derivePersonality(result);
  try {
    await db.insert(learningMemoryTable).values({
      symbol: result.symbol,
      patternType: "personality_snapshot",
      patternData: {
        personality,
        scanRunId,
        marketState: result.marketState,
        cleanSignalScore: Math.round(result.cleanSignalScore),
        riskScore: Math.round(result.riskScore),
        confidence: Math.round(result.confidence),
        patternName: result.patternName,
        priorityLevel: result.priorityLevel,
        snapshotAt: new Date().toISOString(),
      },
      outcome: personality === "Clean Mover" || personality === "Trend Follower" ? "correct" : "incorrect",
      accuracy:
        personality === "Clean Mover"
          ? 80
          : personality === "Spike-Prone" || personality === "Frequently Volatile"
          ? 20
          : 50,
    });
  } catch (err) {
    // Non-fatal — log and continue
    logger.error({ err, symbol: result.symbol }, "Failed to persist personality snapshot");
  }
}
