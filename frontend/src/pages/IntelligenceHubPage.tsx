import { useState } from "react";
import { useIntelligenceAggregated, useIntelligenceStatus, useSymbols } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";

interface AggregatedLeaderboardRow {
  symbol: string;
  displayName: string;
  avgQuality: number;
  avgConfidence: number;
  avgRisk: number;
  totalSamples: number;
  eliteCount: number;
  dangerousCount: number;
  daysTracked: number;
}

interface IntelligenceAggregatedResponse {
  leaderboard: AggregatedLeaderboardRow[];
  since: string;
  generatedAt: number;
}

interface EvolutionEvent {
  id: number;
  detectedAt: number;
  type: string;
  severity: string;
  description: string;
}

interface EvolutionResponse {
  symbol: string;
  events: EvolutionEvent[];
  total: number;
}

export default function IntelligenceHubPage() {
  const symbols = useSymbols();
  const [symbol, setSymbol] = useState("R_100");
  const status = useIntelligenceStatus();
  const aggregated = useIntelligenceAggregated();

  // read-only fetch for evolution empty-state visibility without adding new hook API
  const [evolution, setEvolution] = useState<EvolutionResponse | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);

  useState(() => {
    void (async () => {
      try {
        setEvolutionLoading(true);
        setEvolutionError(null);
        const res = await fetch(`/api/intelligence/evolution/${symbol}?limit=20`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as EvolutionResponse;
        setEvolution(data);
      } catch (err) {
        setEvolutionError(err instanceof Error ? err.message : "Failed to load evolution");
      } finally {
        setEvolutionLoading(false);
      }
    })();
  });

  const leaderboard = ((aggregated.data as IntelligenceAggregatedResponse | undefined)?.leaderboard ?? []);

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Intelligence Hub</h2>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            {(symbols.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
          </select>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard>
          <div className="text-sm text-slate-300">System Status</div>
          <div className="mt-3 space-y-2 text-sm">
            <div>Running: {status.data?.running ? "Yes" : "No"}</div>
            <div>Scanning: {status.data?.isScanning ? "Yes" : "No"}</div>
            <div>Total scans: {status.data?.totalScans ?? 0}</div>
            <div>Last latency: {status.data?.lastLatencyMs ?? 0} ms</div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="text-sm text-slate-300">Aggregated Leaderboard</div>
          <div className="mt-3 space-y-2">
            {leaderboard.length === 0 ? <p className="text-sm text-slate-300">No aggregated leaderboard data yet.</p> : null}
            {leaderboard.map((r) => (
              <div key={r.symbol} className="rounded-lg border border-white/10 p-3 text-sm">
                <div className="font-medium">{r.symbol} · Avg Quality {r.avgQuality}</div>
                <div className="text-xs text-slate-400">Confidence: {r.avgConfidence} · Risk: {r.avgRisk}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="text-sm text-slate-300">Evolution Events ({symbol})</div>
        <div className="mt-3 space-y-2 text-sm">
          {evolutionLoading ? <p className="text-slate-400">Loading evolution events...</p> : null}
          {evolutionError ? <p className="text-rose-300">Failed to load evolution events: {evolutionError}</p> : null}
          {!evolutionLoading && !evolutionError && (evolution?.events?.length ?? 0) === 0 ? (
            <p className="text-slate-300">No evolution events available yet.</p>
          ) : null}
          {(evolution?.events ?? []).map((ev) => (
            <div key={ev.id} className="rounded-lg border border-white/10 p-3">
              <div className="font-medium">{ev.type} · {ev.severity}</div>
              <div className="text-xs text-slate-400">{ev.description}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
