import { pgTable, serial, text, real, integer, jsonb, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  confidence: real("confidence").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  outcome: text("outcome"),
  analysisId: integer("analysis_id"),
  marketState: text("market_state"),
  indicators: jsonb("indicators").notNull().default({}),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
  expiresAt: bigint("expires_at", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
