import { useAnalyticsOverview } from "@/api/hooks";
import { GlassCard } from "@/components/ui/Cards";

interface AnalyticsProfile {
  symbol: string;
  displayName: string;
  market: string;
  samplesAnalyzed: number;
  personality: string;
  avgCleanSignalScore: number;
  avgConfidence: number;
  volatilityScore: number;
  trendReliability: number;
  reversalFrequency: number;
  cleanSetupFrequency: number;
  eliteFrequency: number;
  dangerousFrequency: number;
  dominantState: string;
  dominantAlertType: string;
  predictabilityScore: number;
  stabilityScore: number;
  rhythmScore: number;
  recentVol: number;
  recentEvolution: string[];
}

interface AnalyticsOverviewResponse {
  profiles: AnalyticsProfile[];
  totalSnapshots: number;
  symbolsProfiled: number;
  lastUpdated: number;
}

export default function AnalyticsPage() {
  const overview = useAnalyticsOverview();
  const profiles = ((overview.data as AnalyticsOverviewResponse | undefined)?.profiles ?? []);

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-lg font-semibold">Behavioral Analytics</h2>
      </GlassCard>

      <GlassCard>
        <div className="text-sm text-slate-300">Profiles</div>
        {overview.isLoading ? <p className="mt-3 text-sm text-slate-400">Loading profiles...</p> : null}
        {overview.isError ? <p className="mt-3 text-sm text-rose-300">Failed to load analytics profiles.</p> : null}
        {!overview.isLoading && !overview.isError && profiles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">No analytics profiles available yet.</p>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((p) => (
            <div key={p.symbol} className="rounded-xl border border-white/10 p-3 text-sm">
              <div className="font-medium">{p.symbol}</div>
              <div className="text-xs text-slate-400">{p.personality}</div>
              <div className="mt-2 text-xs">Predictability: {p.predictabilityScore}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
