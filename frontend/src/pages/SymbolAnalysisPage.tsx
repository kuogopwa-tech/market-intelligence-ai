import { useState } from "react";
import { useCandles, useGenerateAnalysis, useLatestAnalysis, useSymbols } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";
import { ErrorState, Skeleton } from "@/components/ui/States";
import MarketChart from "@/components/charts/MarketChart";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const GRANULARITY_OPTIONS = [
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 900, label: "15m" },
  { value: 3600, label: "1h" },
  { value: 14400, label: "4h" },
  { value: 86400, label: "1D" },
];

export default function SymbolAnalysisPage() {
  const symbols = useSymbols();
  const [symbol, setSymbol] = useState("R_100");
  const [granularity, setGranularity] = useState(60);
  const latest = useLatestAnalysis(symbol);
  const generate = useGenerateAnalysis();
  const candles = useCandles(symbol, granularity);

  const onGenerate = async () => {
    try {
      await generate.mutateAsync({ symbol, forceRefresh: true });
      toast.success("Analysis refreshed");
      latest.refetch();
    } catch {
      toast.error("Failed to refresh analysis");
    }
  };

  const isNoAnalysisYet = latest.isError && (latest.error as { response?: { status?: number } } | null)?.response?.status === 404;

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Symbol Analysis</h2>
          <div className="flex flex-wrap gap-2">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              {(symbols.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
            </select>
            <button onClick={onGenerate} disabled={generate.isPending} className="flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
              <RefreshCw size={14} className={generate.isPending ? "animate-spin" : ""} />
              Generate
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Live Chart Section */}
      <GlassCard>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">Live Price Chart ({symbol})</div>
          <div className="flex gap-1">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  granularity === opt.value
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {candles.isLoading ? (
          <Skeleton className="h-72" />
        ) : candles.isError ? (
          <ErrorState message="Unable to load chart data" />
        ) : candles.data && candles.data.length > 0 ? (
          <MarketChart data={candles.data} />
        ) : (
          <div className="flex h-72 items-center justify-center text-slate-400">No chart data available</div>
        )}
        <div className="mt-2 text-xs text-slate-500">
          Auto-refreshing every 10 seconds • {candles.data?.length ?? 0} candles loaded
        </div>
      </GlassCard>

      <GlassCard>
        <div className="text-sm text-slate-300">Latest Analysis</div>
        {latest.isLoading ? (
          <p className="mt-3 text-sm text-slate-400">Loading latest analysis...</p>
        ) : isNoAnalysisYet ? (
          <p className="mt-3 text-sm text-slate-300">No analysis available yet.</p>
        ) : latest.isError ? (
          <p className="mt-3 text-sm text-rose-300">Failed to load analysis.</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <div>Rise: {latest.data?.riseProbability ?? 0}%</div>
              <div>Fall: {latest.data?.fallProbability ?? 0}%</div>
              <div>Confidence: {latest.data?.confidence ?? 0}%</div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{latest.data?.reasoning ?? "No analysis yet"}</p>
          </>
        )}
      </GlassCard>
    </div>
  );
}
