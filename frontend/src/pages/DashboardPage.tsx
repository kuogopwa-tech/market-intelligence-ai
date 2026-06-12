import { useState } from "react";
import { GlassCard, MetricCard } from "@/components/ui/Cards";
import { ErrorState, Skeleton } from "@/components/ui/States";
import MarketChart from "@/components/charts/MarketChart";
import TradingViewChart from "@/components/charts/TradingViewChart";
import {
  useAccuracy,
  useAiStatus,
  useCandles,
  useIntelligenceStatus,
  useLatestAnalysis,
  useMarketSummary,
  useScanner,
} from "@/api/hooks";

// Available symbols for the dropdown
const SYMBOLS = ["R_100", "R_50", "R_25", "R_10", "R_75", "BTC-100", "ETH-100"];

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("R_100");
  const summary = useMarketSummary(selectedSymbol);
  const candles = useCandles(selectedSymbol);
  const scanner = useScanner();
  const latestAnalysis = useLatestAnalysis(selectedSymbol);
  const aiStatus = useAiStatus();
  const accuracy = useAccuracy();
  const intelStatus = useIntelligenceStatus();

  const avgAccuracy = accuracy.data?.length
    ? (accuracy.data.reduce((s, r) => s + r.accuracy, 0) / accuracy.data.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="AI Confidence Score" value={`${latestAnalysis.data?.confidence ?? 0}%`} sub={latestAnalysis.data?.marketCondition ?? "Unknown"} />
        <MetricCard title="Current Market Trend" value={summary.data?.trend ?? "--"} sub={`Momentum: ${summary.data?.momentum ?? "--"}`} />
        <MetricCard title="Volatility Meter" value={summary.data?.volatility ?? "--"} sub={`Value: ${summary.data?.volatilityValue ?? 0}`} />
        <MetricCard title="Prediction Accuracy" value={`${avgAccuracy}%`} sub={`AI: ${aiStatus.data?.online ? "Online" : "Offline"}`} />
      </div>

      {/* Symbol Selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="symbol-select" className="text-sm text-slate-300">Select Symbol:</label>
        <select
          id="symbol-select"
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          {SYMBOLS.map((sym) => (
            <option key={sym} value={sym}>{sym}</option>
          ))}
        </select>
      </div>

      {/* TradingView Chart */}
      <GlassCard>
        <div className="mb-3 text-sm text-slate-300">TradingView Chart ({selectedSymbol})</div>
        <TradingViewChart symbol={selectedSymbol} />
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <div className="mb-3 text-sm text-slate-300">Candle Data ({selectedSymbol})</div>
          {candles.isLoading ? <Skeleton className="h-72" /> : candles.data ? <MarketChart data={candles.data} /> : <ErrorState message="Unable to load chart" />}
        </GlassCard>

        <GlassCard>
          <div className="text-sm text-slate-300">Scanner Top Opportunities</div>
          <div className="mt-3 space-y-2">
            {scanner.isLoading && <Skeleton className="h-44" />}
            {scanner.data?.results.slice(0, 5).map((r) => (
              <div key={r.symbol} className="rounded-lg border border-white/10 p-2 text-sm">
                <div className="font-medium">{r.symbol} · {r.priorityLevel}</div>
                <div className="text-xs text-slate-400">Clean: {Math.round(r.cleanSignalScore)} · Conf: {Math.round(r.confidence)}%</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="text-sm text-slate-300">Latest AI Analysis</div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{latestAnalysis.data?.reasoning ?? "No analysis available"}</p>
        </GlassCard>
        <GlassCard>
          <div className="text-sm text-slate-300">Intelligence Summary</div>
          <div className="mt-3 space-y-2 text-sm">
            <div>Total scans: {intelStatus.data?.totalScans ?? 0}</div>
            <div>Symbols tracked: {intelStatus.data?.symbolsTracked ?? 0}</div>
            <div>Running: {intelStatus.data?.running ? "Yes" : "No"}</div>
            <div>Last latency: {intelStatus.data?.lastLatencyMs ?? 0} ms</div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
