import { useState } from "react";
import { useAccuracy, useAutoPredict, usePredictions, useSymbols } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";
import { toast } from "sonner";

export default function AiPredictionsPage() {
  const symbols = useSymbols();
  const [symbol, setSymbol] = useState("R_100");
  const predictions = usePredictions(symbol);
  const accuracy = useAccuracy();
  const autoPredict = useAutoPredict();

  const runAuto = async () => {
    try {
      const res = await autoPredict.mutateAsync(symbol);
      toast.success(res.generated ? "Auto prediction generated" : "No trade generated");
      predictions.refetch();
      accuracy.refetch();
    } catch {
      toast.error("Auto prediction failed");
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">AI Predictions</h2>
          <div className="flex gap-2">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              {(symbols.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
            </select>
            <button onClick={runAuto} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950">Auto Predict</button>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="text-sm text-slate-300">Recent Predictions ({symbol})</div>
          <div className="mt-3 space-y-2">
            {predictions.isLoading ? <p className="text-sm text-slate-400">Loading predictions...</p> : null}
            {predictions.isError ? <p className="text-sm text-rose-300">Failed to load predictions.</p> : null}
            {!predictions.isLoading && !predictions.isError && (predictions.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-300">No predictions available yet.</p>
            ) : null}
            {(predictions.data ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border border-white/10 p-3 text-sm">
                <div className="font-medium">#{p.id} · {p.direction.toUpperCase()} · {p.confidence}%</div>
                <div className="text-xs text-slate-400">Entry: {p.entryPrice} · Outcome: {p.outcome ?? "pending"}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="text-sm text-slate-300">Accuracy History</div>
          <div className="mt-3 space-y-2">
            {accuracy.isLoading ? <p className="text-sm text-slate-400">Loading accuracy history...</p> : null}
            {accuracy.isError ? <p className="text-sm text-rose-300">Failed to load accuracy history.</p> : null}
            {!accuracy.isLoading && !accuracy.isError && (accuracy.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-300">No accuracy history available yet.</p>
            ) : null}
            {(accuracy.data ?? []).map((a) => (
              <div key={a.symbol} className="rounded-lg border border-white/10 p-3 text-sm">
                <div className="font-medium">{a.symbol}</div>
                <div className="text-xs text-slate-400">Accuracy: {a.accuracy}% · Total: {a.total} · Pending: {a.pending}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
