import { GlassCard, MetricCard } from "@/components/ui/Cards";
import { ErrorState, Skeleton } from "@/components/ui/States";
import MarketChart from "@/components/charts/MarketChart";
import {
  useAccuracy,
  useAiStatus,
  useCandles,
  useIntelligenceStatus,
  useLatestAnalysis,
  useMarketSummary,
  useScanner,
} from "@/api/hooks";

const symbol = "R_100";

export default function DashboardPage() {
  const summary = useMarketSummary(symbol);
  const candles = useCandles(symbol);
  const scanner = useScanner();
  const latestAnalysis = useLatestAnalysis(symbol);
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

      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <div className="mb-3 text-sm text-slate-300">Live Market Chart ({symbol})</div>
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
