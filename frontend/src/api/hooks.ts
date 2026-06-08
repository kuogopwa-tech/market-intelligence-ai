import { useMutation, useQuery } from "@tanstack/react-query";
import {
  aiApi,
  analysisApi,
  analyticsApi,
  healthApi,
  intelligenceApi,
  marketApi,
  memoryApi,
  predictionApi,
  scannerApi,
} from "./services";

export const useHealth = () => useQuery({ queryKey: ["health"], queryFn: healthApi.get, refetchInterval: 30_000 });
export const useSymbols = () => useQuery({ queryKey: ["symbols"], queryFn: marketApi.symbols, refetchInterval: 60_000 });
export const useMarketSummary = (symbol: string) => useQuery({ queryKey: ["market-summary", symbol], queryFn: () => marketApi.summary(symbol), refetchInterval: 10_000 });
export const useCandles = (symbol: string) => useQuery({ queryKey: ["candles", symbol], queryFn: () => marketApi.candles(symbol), refetchInterval: 10_000 });
export const useTicks = (symbol: string) => useQuery({ queryKey: ["ticks", symbol], queryFn: () => marketApi.ticks(symbol), refetchInterval: 6_000 });
export const useScanner = () => useQuery({ queryKey: ["scanner"], queryFn: () => scannerApi.scan(60), refetchInterval: 30_000 });
export const useAiStatus = () => useQuery({ queryKey: ["ai-status"], queryFn: aiApi.status, refetchInterval: 20_000 });
export const useLatestAnalysis = (symbol: string) => useQuery({ queryKey: ["analysis-latest", symbol], queryFn: () => analysisApi.latest(symbol), refetchInterval: 30_000 });
export const useAnalysisHistory = (symbol: string) => useQuery({ queryKey: ["analysis-history", symbol], queryFn: () => analysisApi.history(symbol, 20) });
export const useGenerateAnalysis = () => useMutation({ mutationFn: ({ symbol, forceRefresh }: { symbol: string; forceRefresh?: boolean }) => analysisApi.generate(symbol, !!forceRefresh) });
export const usePredictions = (symbol?: string) => useQuery({ queryKey: ["predictions", symbol], queryFn: () => predictionApi.list(symbol, 30), refetchInterval: 30_000 });
export const useAccuracy = () => useQuery({ queryKey: ["accuracy"], queryFn: predictionApi.accuracy, refetchInterval: 30_000 });
export const useAutoPredict = () => useMutation({ mutationFn: (symbol: string) => predictionApi.auto(symbol) });
export const useMemory = (symbol?: string) => useQuery({ queryKey: ["memory", symbol], queryFn: () => memoryApi.list(symbol, 50), refetchInterval: 45_000 });
export const useMemorySummary = (symbol?: string) => useQuery({ queryKey: ["memory-summary", symbol], queryFn: () => memoryApi.summary(symbol), refetchInterval: 45_000 });
export const useAnalyticsOverview = () => useQuery({ queryKey: ["analytics-overview"], queryFn: analyticsApi.overview, refetchInterval: 60_000 });
export const useAnalyticsHeatmap = (symbol: string) => useQuery({ queryKey: ["analytics-heatmap", symbol], queryFn: () => analyticsApi.heatmap(symbol), refetchInterval: 60_000 });
export const useIntelligenceStatus = () => useQuery({ queryKey: ["intelligence-status"], queryFn: intelligenceApi.status, refetchInterval: 20_000 });
export const useIntelligenceAggregated = () => useQuery({ queryKey: ["intelligence-aggregated"], queryFn: intelligenceApi.aggregated, refetchInterval: 60_000 });
