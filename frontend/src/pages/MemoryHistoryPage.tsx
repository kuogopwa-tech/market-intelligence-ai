import { useState } from "react";
import { useMemory, useMemorySummary, useSymbols } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";

export default function MemoryHistoryPage() {
  const symbols = useSymbols();
  const [symbol, setSymbol] = useState("R_100");
  const memory = useMemory(symbol);
  const summary = useMemorySummary(symbol);

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Memory / History</h2>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            {(symbols.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
          </select>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-1">
          <div className="text-sm text-slate-300">Summary</div>
          <div className="mt-3 space-y-2 text-sm">
            <div>Total patterns: {summary.data?.totalPatterns ?? 0}</div>
            <div>Avg accuracy: {summary.data?.avgAccuracy ?? 0}%</div>
            <div className="text-slate-400">Top patterns:</div>
            {(summary.data?.topPatterns ?? []).map((p) => <div key={p}>{p}</div>)}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="text-sm text-slate-300">Memory Entries</div>
          <div className="mt-3 space-y-2">
            {(memory.data ?? []).map((m) => (
              <div key={m.id} className="rounded-lg border border-white/10 p-3 text-sm">
                <div className="font-medium">{m.patternType}</div>
                <div className="text-xs text-slate-400">Outcome: {m.outcome} · Accuracy: {m.accuracy ?? "n/a"}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
