import { pgTable, serial, text, real, integer, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";

export const aiAnalysisTable = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  symbol: text("symbol").notNull(),
  reasoning: text("reasoning").notNull(),
  riseProbability: real("rise_probability").notNull(),
  fallProbability: real("fall_probability").notNull(),
  confidence: real("confidence").notNull(),
  marketCondition: text("market_condition").notNull(),
  marketState: text("market_state"),
  riskLevel: text("risk_level"),
  bullishScore: real("bullish_score"),
  bearishScore: real("bearish_score"),
  noTradeZone: integer("no_trade_zone").notNull().default(0),
  signals: jsonb("signals").notNull().default([]),
  warnings: jsonb("warnings").notNull().default([]),
  aiModel: text("ai_model"),
  cached: integer("cached").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiAnalysisSchema = createInsertSchema(aiAnalysisTable).omit({ id: true, createdAt: true });
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;
export type AiAnalysis = typeof aiAnalysisTable.$inferSelect;
