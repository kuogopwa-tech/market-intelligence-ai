import { useState } from "react";
import { useGenerateAnalysis, useLatestAnalysis, useSymbols } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";
import { toast } from "sonner";

export default function SymbolAnalysisPage() {
  const symbols = useSymbols();
  const [symbol, setSymbol] = useState("R_100");
  const latest = useLatestAnalysis(symbol);
  const generate = useGenerateAnalysis();

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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Symbol Analysis</h2>
          <div className="flex gap-2">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              {(symbols.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
            </select>
            <button onClick={onGenerate} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950">Generate</button>
          </div>
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
