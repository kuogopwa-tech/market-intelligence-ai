import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const symbolTimelineTable = pgTable(
  "symbol_timeline",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
    hour: integer("hour").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    cleanSignalScore: integer("clean_signal_score").notNull(),
    riskScore: integer("risk_score").notNull(),
    confidence: integer("confidence").notNull(),
    marketState: text("market_state").notNull(),
    riskLevel: text("risk_level").notNull(),
    volatilityCompatibility: integer("volatility_compatibility").notNull(),
    indicatorAlignment: integer("indicator_alignment").notNull(),
    momentumConfirmation: integer("momentum_confirmation").notNull(),
    alertType: text("alert_type").notNull(),
    priorityLevel: text("priority_level").notNull(),
    marketCleanliness: text("market_cleanliness").notNull(),
    setupRarity: text("setup_rarity").notNull(),
    bullishScore: integer("bullish_score").notNull(),
    bearishScore: integer("bearish_score").notNull(),
    noTradeZone: boolean("no_trade_zone").notNull(),
    patternName: text("pattern_name").notNull(),
  },
  (t) => [
    index("st_symbol_idx").on(t.symbol),
    index("st_snapshot_at_idx").on(t.snapshotAt),
    index("st_symbol_hour_idx").on(t.symbol, t.hour),
  ]
);
