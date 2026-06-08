import { api } from "./client";
import type {
  AccuracyRow,
  AiStatus,
  AnalysisResult,
  Candle,
  HealthzResponse,
  MarketSummary,
  MarketSymbol,
  MemoryEntry,
  MemorySummary,
  Prediction,
  ScannerResponse,
  Tick,
} from "./types";

export const healthApi = {
  get: async () => (await api.get<HealthzResponse>("/healthz")).data,
};

export const marketApi = {
  symbols: async () => (await api.get<MarketSymbol[]>("/market/symbols")).data,
  candles: async (symbol: string, granularity = 60, count = 100) =>
    (await api.get<Candle[]>("/market/candles", { params: { symbol, granularity, count } })).data,
  ticks: async (symbol: string, count = 50) =>
    (await api.get<Tick[]>("/market/ticks", { params: { symbol, count } })).data,
  summary: async (symbol: string) =>
    (await api.get<MarketSummary>("/market/summary", { params: { symbol } })).data,
};

export const analysisApi = {
  generate: async (symbol: string, forceRefresh = false) =>
    (await api.post<AnalysisResult>("/analysis/generate", { symbol, forceRefresh })).data,
  latest: async (symbol: string) =>
    (await api.get<AnalysisResult>("/analysis/latest", { params: { symbol } })).data,
  history: async (symbol: string, limit = 20) =>
    (await api.get<AnalysisResult[]>("/analysis/history", { params: { symbol, limit } })).data,
  quality: async (symbol: string, granularity = 60) =>
    (await api.get("/analysis/quality", { params: { symbol, granularity } })).data,
  signals: async (symbol: string, granularity = 60) =>
    (await api.get("/analysis/signals", { params: { symbol, granularity } })).data,
};

export const scannerApi = {
  scan: async (granularity = 60) =>
    (await api.get<ScannerResponse>("/scanner/scan", { params: { granularity } })).data,
};

export const predictionApi = {
  list: async (symbol?: string, limit = 20) =>
    (await api.get<Prediction[]>("/predictions", { params: { symbol, limit } })).data,
  accuracy: async () => (await api.get<AccuracyRow[]>("/predictions/accuracy")).data,
  auto: async (symbol: string) => (await api.post("/predictions/auto", { symbol })).data,
};

export const memoryApi = {
  list: async (symbol?: string, limit = 20) =>
    (await api.get<MemoryEntry[]>("/memory", { params: { symbol, limit } })).data,
  summary: async (symbol?: string) =>
    (await api.get<MemorySummary>("/memory/summary", { params: { symbol } })).data,
  patterns: async (symbol?: string) => (await api.get("/memory/patterns", { params: { symbol } })).data,
  lessons: async (symbol?: string) => (await api.get("/memory/lessons", { params: { symbol } })).data,
};

export const aiApi = {
  status: async () => (await api.get<AiStatus>("/ai/status")).data,
};

export const intelligenceApi = {
  status: async () => (await api.get("/intelligence/status")).data,
  snapshots: async (symbol: string, limit = 200) =>
    (await api.get(`/intelligence/snapshots/${symbol}`, { params: { limit } })).data,
  hourly: async (symbol: string) => (await api.get(`/intelligence/hourly/${symbol}`)).data,
  daily: async (symbol: string) => (await api.get(`/intelligence/daily/${symbol}`)).data,
  evolution: async (symbol: string, limit = 50) =>
    (await api.get(`/intelligence/evolution/${symbol}`, { params: { limit } })).data,
  aggregated: async () => (await api.get("/intelligence/aggregated")).data,
};

export const analyticsApi = {
  overview: async () => (await api.get("/analytics/overview")).data,
  timeline: async (symbol: string, limit = 60) =>
    (await api.get(`/analytics/timeline/${symbol}`, { params: { limit } })).data,
  heatmap: async (symbol: string) => (await api.get(`/analytics/heatmap/${symbol}`)).data,
};
