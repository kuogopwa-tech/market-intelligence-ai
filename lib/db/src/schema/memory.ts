import { pgTable, serial, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const learningMemoryTable = pgTable("learning_memory", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  patternType: text("pattern_type").notNull(),
  patternData: jsonb("pattern_data").notNull().default({}),
  outcome: text("outcome").notNull(),
  accuracy: real("accuracy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const indicatorsHistoryTable = pgTable("indicators_history", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  granularity: text("granularity").notNull().default("60"),
  rsi: real("rsi"),
  macdLine: real("macd_line"),
  macdSignal: real("macd_signal"),
  macdHistogram: real("macd_histogram"),
  ema9: real("ema9"),
  ema21: real("ema21"),
  ema50: real("ema50"),
  sma20: real("sma20"),
  bollingerUpper: real("bollinger_upper"),
  bollingerMiddle: real("bollinger_middle"),
  bollingerLower: real("bollinger_lower"),
  atr: real("atr"),
  stochasticK: real("stochastic_k"),
  stochasticD: real("stochastic_d"),
  trendStrength: real("trend_strength"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemorySchema = createInsertSchema(learningMemoryTable).omit({ id: true, createdAt: true });
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type MemoryEntry = typeof learningMemoryTable.$inferSelect;
