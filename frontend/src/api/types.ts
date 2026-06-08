export interface HealthzResponse { status: "ok" }

export interface MarketSymbol {
  symbol: string;
  displayName: string;
  market: string;
  pip: number;
}

export interface Candle { epoch: number; open: number; high: number; low: number; close: number }
export interface Tick { epoch: number; price: number; symbol: string }

export interface MarketSummary {
  symbol: string;
  currentPrice: number;
  priceChange: number;
  priceChangePct: number;
  trend: string;
  volatility: string;
  volatilityValue: number;
  momentum: string;
  marketCondition: string;
  supportLevel: number | null;
  resistanceLevel: number | null;
  spikeDetected: boolean;
  reversalWarning: boolean;
  lastUpdated: number;
}

export interface AnalysisResult {
  id: number;
  symbol: string;
  reasoning: string;
  riseProbability: number;
  fallProbability: number;
  confidence: number;
  marketCondition: string;
  marketState: string | null;
  riskLevel: string | null;
  bullishScore: number | null;
  bearishScore: number | null;
  noTradeZone: boolean;
  signals: string[];
  warnings: string[];
  aiModel: string;
  cached: boolean;
  createdAt: number;
}

export interface ScannerResult {
  symbol: string;
  displayName: string;
  market: string;
  bullishScore: number;
  bearishScore: number;
  confidence: number;
  marketState: string;
  riskLevel: string;
  noTradeZone: boolean;
  supportingSignals: string[];
  conflictingSignals: string[];
  cleanSignalScore: number;
  riskScore: number;
  confidenceWeight: number;
  indicatorAlignment: number;
  momentumConfirmation: number;
  volatilityCompatibility: number;
  marketCleanliness: string;
  setupRarity: string;
  alertType: string;
  expirySeconds: number;
  historicalBoost: number;
  patternName: string;
  historicalSuccessRate: number;
  historicalTrades: number;
  priorityLevel: string;
}

export interface ScannerResponse {
  scannedAt: number;
  totalSymbols: number;
  eliteCount: number;
  highConfidenceCount: number;
  results: ScannerResult[];
  topOpportunity: ScannerResult | null;
  bestBullish: ScannerResult | null;
  bestBearish: ScannerResult | null;
  cleanest: ScannerResult | null;
  safest: ScannerResult | null;
  mostDangerous: ScannerResult | null;
}

export interface Prediction {
  id: number;
  symbol: string;
  direction: "rise" | "fall";
  confidence: number;
  entryPrice: number;
  exitPrice: number | null;
  outcome: "correct" | "incorrect" | null;
  analysisId: number | null;
  marketState: string | null;
  indicators: Record<string, unknown>;
  resolvedAt: number | null;
  expiresAt: number | null;
  createdAt: number;
}

export interface AccuracyRow {
  symbol: string;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracy: number;
}

export interface MemoryEntry {
  id: number;
  symbol: string;
  patternType: string;
  patternData: Record<string, unknown>;
  outcome: string;
  accuracy: number | null;
  createdAt: number;
}

export interface MemorySummary {
  totalPatterns: number;
  avgAccuracy: number;
  topPatterns: string[];
  recentLessons: string[];
}

export interface AiStatus { online: boolean; provider: string; model: string }
