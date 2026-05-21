import { pgTable, serial, text, real, integer, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketDataTable = pgTable("market_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  epoch: bigint("epoch", { mode: "number" }).notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  granularity: integer("granularity").notNull().default(60),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ticksTable = pgTable("ticks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  epoch: bigint("epoch", { mode: "number" }).notNull(),
  price: real("price").notNull(),
  bid: real("bid"),
  ask: real("ask"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketDataSchema = createInsertSchema(marketDataTable).omit({ id: true, createdAt: true });
export const insertTickSchema = createInsertSchema(ticksTable).omit({ id: true, createdAt: true });
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketData = typeof marketDataTable.$inferSelect;
export type InsertTick = z.infer<typeof insertTickSchema>;
export type Tick = typeof ticksTable.$inferSelect;
