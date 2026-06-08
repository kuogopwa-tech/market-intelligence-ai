import { useState } from "react";
import { useAnalyticsHeatmap, useAnalyticsOverview, useSymbols } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";
import { Skeleton } from "@/components/ui/States";

export default function MarketIntelligencePage() {
  const symbols = useSymbols();
  const [symbol, setSymbol] = useState("R_100");
  const overview = useAnalyticsOverview();
  const heatmap = useAnalyticsHeatmap(symbol);

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Market Intelligence</h2>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            {(symbols.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
          </select>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-2 text-sm text-slate-300">Market Heatmap ({symbol})</div>
          {heatmap.isLoading ? <Skeleton className="h-64" /> : (
            <div className="grid grid-cols-6 gap-2 text-xs">
              {(heatmap.data?.slots ?? []).map((s: any) => (
                <div key={s.hour} className="rounded-lg border border-white/10 p-2 text-center">
                  <div className="text-slate-400">{s.hour}:00</div>
                  <div className="font-semibold text-cyan-300">Q{s.avgQuality}</div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-2 text-sm text-slate-300">Intelligence Profiles</div>
          <div className="space-y-2">
            {(overview.data?.profiles ?? []).slice(0, 8).map((p: any) => (
              <div key={p.symbol} className="rounded-lg border border-white/10 p-2 text-sm">
                <div className="font-medium">{p.symbol} · {p.personality}</div>
                <div className="text-xs text-slate-400">Predictability: {p.predictabilityScore} · Stability: {p.stabilityScore}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
