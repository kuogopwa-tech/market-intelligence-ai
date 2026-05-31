import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const scanRunsTable = pgTable(
  "scan_runs",
  {
    id: serial("id").primaryKey(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    symbolsScanned: integer("symbols_scanned").default(0).notNull(),
    symbolsSucceeded: integer("symbols_succeeded").default(0).notNull(),
    symbolsFailed: integer("symbols_failed").default(0).notNull(),
    triggeredBy: text("triggered_by").default("scheduler").notNull(),
    error: text("error"),
  },
  (t) => [
    index("sr_started_at_idx").on(t.startedAt),
  ]
);

export const intelligenceSnapshotsTable = pgTable(
  "intelligence_snapshots",
  {
    id: serial("id").primaryKey(),
    scanRunId: integer("scan_run_id"),
    symbol: text("symbol").notNull(),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
    hour: integer("hour").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    cleanSignalScore: integer("clean_signal_score").notNull(),
    riskScore: integer("risk_score").notNull(),
    confidence: integer("confidence").notNull(),
    marketState: text("market_state").notNull(),
    riskLevel: text("risk_level").notNull(),
    priorityLevel: text("priority_level").notNull(),
    alertType: text("alert_type").notNull(),
    marketCleanliness: text("market_cleanliness").notNull(),
    setupRarity: text("setup_rarity").notNull(),
    volatilityCompatibility: integer("volatility_compatibility").notNull(),
    indicatorAlignment: integer("indicator_alignment").notNull(),
    momentumConfirmation: integer("momentum_confirmation").notNull(),
    bullishScore: integer("bullish_score").notNull(),
    bearishScore: integer("bearish_score").notNull(),
    noTradeZone: boolean("no_trade_zone").notNull(),
    patternName: text("pattern_name").notNull(),
  },
  (t) => [
    index("is_symbol_idx").on(t.symbol),
    index("is_snapshot_at_idx").on(t.snapshotAt),
    index("is_symbol_hour_idx").on(t.symbol, t.hour),
    index("is_scan_run_id_idx").on(t.scanRunId),
  ]
);

export const hourlySummariesTable = pgTable(
  "hourly_summaries",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    hour: integer("hour").notNull(),
    avgQuality: real("avg_quality").notNull(),
    avgConfidence: real("avg_confidence").notNull(),
    avgRisk: real("avg_risk").notNull(),
    avgVolatilityCompat: real("avg_volatility_compat").notNull(),
    sampleCount: integer("sample_count").notNull(),
    eliteCount: integer("elite_count").notNull().default(0),
    dangerousCount: integer("dangerous_count").notNull().default(0),
    noTradeCount: integer("no_trade_count").notNull().default(0),
    dominantState: text("dominant_state").notNull(),
    dominantPattern: text("dominant_pattern").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("hs_symbol_date_hour_idx").on(t.symbol, t.date, t.hour),
    index("hs_symbol_idx").on(t.symbol),
    index("hs_date_idx").on(t.date),
  ]
);

export const dailySummariesTable = pgTable(
  "daily_summaries",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    avgQuality: real("avg_quality").notNull(),
    avgConfidence: real("avg_confidence").notNull(),
    avgRisk: real("avg_risk").notNull(),
    sampleCount: integer("sample_count").notNull(),
    eliteCount: integer("elite_count").notNull().default(0),
    dangerousCount: integer("dangerous_count").notNull().default(0),
    peakQualityHour: integer("peak_quality_hour"),
    worstQualityHour: integer("worst_quality_hour"),
    dominantState: text("dominant_state").notNull(),
    dominantPersonality: text("dominant_personality").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ds_symbol_date_idx").on(t.symbol, t.date),
    index("ds_symbol_idx").on(t.symbol),
    index("ds_date_idx").on(t.date),
  ]
);
