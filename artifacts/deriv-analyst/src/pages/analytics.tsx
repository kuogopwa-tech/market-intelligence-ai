import { useState } from "react";
import {
  useGetAnalyticsOverview,
  getGetAnalyticsOverviewQueryKey,
  useGetSymbolTimeline,
  getGetSymbolTimelineQueryKey,
  useGetSymbolHeatmap,
  getGetSymbolHeatmapQueryKey,
} from "@workspace/api-client-react";
import type { SymbolProfile, TimelineEntry, HeatmapSlot } from "@workspace/api-client-react";
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Zap,
  ShieldAlert,
  Activity,
  BarChart3,
  Clock,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { useGetScannerResults, getGetScannerResultsQueryKey } from "@workspace/api-client-react";

// ─── Priority colours ─────────────────────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  "Elite Opportunity": "bg-yellow-400",
  "High Confidence": "bg-green-400",
  "Moderate Setup": "bg-blue-400",
  "Watchlist Only": "bg-slate-500",
  Dangerous: "bg-orange-400",
  "Avoid Market": "bg-red-500",
};

function priorityDot(p: string) {
  return PRIORITY_DOT[p] ?? "bg-slate-600";
}

// ─── Personality config ───────────────────────────────────────────────────────
const PERSONALITY_CFG: Record<
  string,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  "Spike-Prone": {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
  },
  "Clean Mover": {
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/30",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  "Reversal Heavy": {
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/30",
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  "Trend Follower": {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  "Range-Bound": {
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-600/30",
    icon: <TrendingDown className="w-3.5 h-3.5" />,
  },
  "Frequently Volatile": {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  "Mixed Behavior": {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
};

function personalityCfg(p: string) {
  return PERSONALITY_CFG[p] ?? PERSONALITY_CFG["Mixed Behavior"];
}

function scoreColor(v: number) {
  if (v >= 70) return "text-green-400";
  if (v >= 50) return "text-yellow-400";
  if (v >= 30) return "text-orange-400";
  return "text-red-400";
}

function MiniBar({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full", colorClass)}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// ─── Evolution mini-display (recent priority dots) ────────────────────────────
function EvolutionDots({ states }: { states: string[] }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {states.map((s, i) => (
        <span
          key={i}
          className={cn(
            "w-2 h-2 rounded-full inline-block shrink-0",
            priorityDot(s)
          )}
          title={s}
        />
      ))}
    </div>
  );
}

// ─── Symbol Personality Card ──────────────────────────────────────────────────
function ProfileCard({
  profile,
  isSelected,
  onClick,
}: {
  profile: SymbolProfile;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = personalityCfg(profile.personality);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all hover:border-slate-600",
        isSelected
          ? "border-blue-500/50 bg-blue-500/5"
          : "border-slate-800 bg-slate-900/40"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-bold text-white leading-tight">
            {profile.displayName}
          </div>
          <div className="text-xs text-slate-600 font-mono mt-0.5">
            {profile.symbol}
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0",
            cfg.color,
            cfg.bg,
            cfg.border
          )}
        >
          {cfg.icon}
          {profile.personality}
        </span>
      </div>

      {/* Metric bars */}
      <div className="space-y-1.5 mb-3">
        {[
          { label: "Quality", value: profile.avgCleanSignalScore },
          { label: "Clean %", value: profile.cleanSetupFrequency },
          { label: "Trend", value: profile.trendReliability },
          { label: "Stability", value: profile.stabilityScore },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-14 shrink-0">{m.label}</span>
            <div className="flex-1">
              <MiniBar
                value={m.value}
                colorClass={
                  m.value >= 60 ? "bg-green-500" : m.value >= 35 ? "bg-yellow-500" : "bg-red-500"
                }
              />
            </div>
            <span className="text-xs font-mono text-slate-400 w-6 text-right shrink-0">
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Predictability + samples */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-500">Predictability</span>
        <span className={cn("font-mono font-medium", scoreColor(profile.predictabilityScore))}>
          {profile.predictabilityScore}
        </span>
      </div>

      {/* Recent evolution dots */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 shrink-0">Recent</span>
        <EvolutionDots states={profile.recentEvolution} />
      </div>

      <div className="text-xs text-slate-700 mt-2">
        {profile.samplesAnalyzed} sample{profile.samplesAnalyzed !== 1 ? "s" : ""}
      </div>
    </button>
  );
}

// ─── Opportunity Evolution Tracker ───────────────────────────────────────────

const PRIORITY_LABEL_SHORT: Record<string, string> = {
  "Elite Opportunity": "Elite",
  "High Confidence": "High",
  "Moderate Setup": "Mod",
  "Watchlist Only": "Watch",
  Dangerous: "Danger",
  "Avoid Market": "Avoid",
};

function EvolutionTracker({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0)
    return (
      <div className="text-center py-8 text-slate-600 text-sm">
        No timeline data yet — run the scanner to begin recording history.
      </div>
    );

  const ordered = [...entries].reverse().slice(-25);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {ordered.map((e, i) => {
          const dot = priorityDot(e.priorityLevel);
          const short = PRIORITY_LABEL_SHORT[e.priorityLevel] ?? e.priorityLevel;
          const time = new Date(e.snapshotAt * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div key={e.id} className="flex items-center gap-1">
              <div className="group relative">
                <div
                  className={cn(
                    "flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs cursor-default transition-all",
                    dot === "bg-yellow-400"
                      ? "border-yellow-400/30 bg-yellow-400/10"
                      : dot === "bg-green-400"
                      ? "border-green-400/20 bg-green-400/5"
                      : dot === "bg-orange-400"
                      ? "border-orange-400/30 bg-orange-400/10"
                      : dot === "bg-red-500"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-slate-700 bg-slate-800/60"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      dot === "bg-yellow-400"
                        ? "text-yellow-300"
                        : dot === "bg-green-400"
                        ? "text-green-400"
                        : dot === "bg-orange-400"
                        ? "text-orange-400"
                        : dot === "bg-red-500"
                        ? "text-red-400"
                        : "text-slate-400"
                    )}
                  >
                    {short}
                  </span>
                  <span className="text-slate-600" style={{ fontSize: "9px" }}>
                    {time}
                  </span>
                </div>
              </div>
              {i < ordered.length - 1 && (
                <ChevronRight className="w-2.5 h-2.5 text-slate-700 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          {
            label: "Avg Quality",
            value: Math.round(entries.reduce((s, e) => s + e.cleanSignalScore, 0) / entries.length),
            unit: "",
          },
          {
            label: "Avg Confidence",
            value: Math.round(entries.reduce((s, e) => s + e.confidence, 0) / entries.length),
            unit: "%",
          },
          {
            label: "Elite States",
            value: entries.filter((e) => e.priorityLevel === "Elite Opportunity").length,
            unit: "",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-center">
            <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
            <div className={cn("text-lg font-bold", scoreColor(s.value))}>{s.value}{s.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quality Timeline Chart ───────────────────────────────────────────────────

function TimelineChart({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;

  const data = [...entries]
    .reverse()
    .slice(-40)
    .map((e, i) => ({
      i,
      quality: e.cleanSignalScore,
      confidence: e.confidence,
      risk: e.riskScore,
      time: new Date(e.snapshotAt * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#475569" }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#475569" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Area
            type="monotone"
            dataKey="quality"
            stroke="#3b82f6"
            strokeWidth={1.5}
            fill="url(#qualityGrad)"
            name="Quality"
          />
          <Area
            type="monotone"
            dataKey="confidence"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="url(#confGrad)"
            name="Confidence"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 24-Hour Heatmap ──────────────────────────────────────────────────────────

function HeatmapGrid({ symbol }: { symbol: string }) {
  const { data, isLoading } = useGetSymbolHeatmap(symbol, {
    query: {
      queryKey: getGetSymbolHeatmapQueryKey(symbol),
      staleTime: 60000,
    },
  });

  if (isLoading)
    return (
      <div className="h-32 flex items-center justify-center text-slate-600 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading heatmap…
      </div>
    );

  if (!data || !data.hasData)
    return (
      <div className="rounded-xl border border-slate-800 p-6 text-center text-slate-600 text-sm">
        <Clock className="w-5 h-5 mx-auto mb-2 text-slate-700" />
        Not enough history yet — heatmap builds over time as you use the scanner.
      </div>
    );

  const maxQ = Math.max(...data.slots.map((s) => s.avgQuality), 1);

  function slotColor(slot: HeatmapSlot) {
    if (slot.sampleCount === 0) return "bg-slate-800/60 border-slate-800";
    if (slot.dangerousCount > slot.eliteCount + slot.cleanCount)
      return "bg-red-500/30 border-red-500/40 text-red-300";
    const intensity = slot.avgQuality / maxQ;
    if (intensity >= 0.8) return "bg-green-500/40 border-green-500/40 text-green-300";
    if (intensity >= 0.55) return "bg-blue-500/30 border-blue-500/30 text-blue-300";
    if (intensity >= 0.35) return "bg-yellow-500/20 border-yellow-500/30 text-yellow-300";
    return "bg-slate-700/30 border-slate-700 text-slate-500";
  }

  function fmt(h: number) {
    return `${h.toString().padStart(2, "0")}:00`;
  }

  return (
    <div className="space-y-2">
      {data.bestHour !== null && data.bestHour !== undefined && (
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-400 font-medium">
            ✓ Best window: {fmt(data.bestHour)} UTC
          </span>
          {data.worstHour !== null && data.worstHour !== undefined && (
            <span className="text-red-400">⚠ Riskiest: {fmt(data.worstHour)} UTC</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-6 gap-1">
        {data.slots.map((slot) => (
          <div
            key={slot.hour}
            className={cn(
              "rounded border text-center py-1.5 px-1 transition-all cursor-default",
              slotColor(slot)
            )}
            title={
              slot.sampleCount > 0
                ? `${fmt(slot.hour)} UTC — Quality: ${slot.avgQuality} | Samples: ${slot.sampleCount} | Elite: ${slot.eliteCount}`
                : `${fmt(slot.hour)} UTC — No data`
            }
          >
            <div style={{ fontSize: "9px" }} className="text-slate-500 mb-0.5">
              {fmt(slot.hour)}
            </div>
            <div className="text-xs font-mono font-bold">
              {slot.sampleCount > 0 ? slot.avgQuality : "–"}
            </div>
            {slot.sampleCount > 0 && (
              <div style={{ fontSize: "8px" }} className="text-slate-600">
                {slot.sampleCount}s
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-green-500/40 inline-block" /> High quality
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500/30 inline-block" /> Dangerous
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-slate-800 inline-block" /> No data
        </span>
      </div>
    </div>
  );
}

// ─── Rhythm Bar Chart ─────────────────────────────────────────────────────────
function RhythmChart({ profiles }: { profiles: SymbolProfile[] }) {
  if (profiles.length === 0) return null;
  const data = profiles.slice(0, 10).map((p) => ({
    name: p.symbol.replace("1HZ", "1s-").replace("frx", ""),
    rhythm: p.rhythmScore,
    stability: p.stabilityScore,
    predictability: p.predictabilityScore,
  }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 16, left: -20 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#475569" }} angle={-25} textAnchor="end" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#475569" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              fontSize: "11px",
            }}
          />
          <Bar dataKey="rhythm" name="Rhythm" fill="#3b82f6" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${210 + i * 5}, 70%, 55%)`} />
            ))}
          </Bar>
          <Bar dataKey="stability" name="Stability" fill="#22c55e" radius={[3, 3, 0, 0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("R_100");
  const [activeTab, setActiveTab] = useState<"profiles" | "evolution" | "heatmap" | "rhythm">("profiles");

  const { data: overview, isLoading: overviewLoading, isFetching, refetch } = useGetAnalyticsOverview({
    query: {
      queryKey: getGetAnalyticsOverviewQueryKey(),
      refetchInterval: 60000,
      staleTime: 30000,
    },
  });

  const { data: timeline, isLoading: timelineLoading } = useGetSymbolTimeline(selectedSymbol, {
    query: {
      queryKey: getGetSymbolTimelineQueryKey(selectedSymbol),
      enabled: activeTab === "evolution",
      staleTime: 15000,
    },
  });

  // Also trigger a scan if no data yet
  const { refetch: runScan, isFetching: isScanning } = useGetScannerResults(
    { granularity: 60 },
    {
      query: {
        queryKey: getGetScannerResultsQueryKey({ granularity: 60 }),
        enabled: false,
      },
    }
  );

  const hasData = (overview?.totalSnapshots ?? 0) > 0;
  const selectedProfile = overview?.profiles.find((p) => p.symbol === selectedSymbol);

  const tabs = [
    { id: "profiles" as const, label: "Symbol Profiles", icon: BrainCircuit },
    { id: "evolution" as const, label: "Opportunity Evolution", icon: Activity },
    { id: "heatmap" as const, label: "Timing Heatmap", icon: Clock },
    { id: "rhythm" as const, label: "Market Rhythm", icon: BarChart3 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <BrainCircuit className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Behavioral Analytics</h1>
            {isFetching && (
              <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Updating…
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">
            Symbol personality profiling, timing intelligence, and opportunity evolution tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overview && (
            <span className="text-xs text-slate-600">
              {overview.totalSnapshots.toLocaleString()} snapshots · {overview.symbolsProfiled} symbols
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all"
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── No data state ── */}
      {!overviewLoading && !hasData && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-8 text-center">
          <BrainCircuit className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-slate-300 font-semibold mb-1">No behavioral data yet</div>
          <div className="text-slate-500 text-sm mb-4 max-w-md mx-auto">
            The analytics engine learns from scanner history. Each time you run the Market Scanner,
            it records a snapshot of all 13 markets — building personality profiles, timing patterns,
            and rhythm scores over time.
          </div>
          <button
            onClick={() => void runScan()}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isScanning && "animate-spin")} />
            {isScanning ? "Scanning markets…" : "Run first scan to start learning"}
          </button>
        </div>
      )}

      {hasData && (
        <>
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Snapshots Recorded",
                value: overview!.totalSnapshots.toLocaleString(),
                sub: "across all markets",
                color: "text-slate-200",
              },
              {
                label: "Symbols Profiled",
                value: overview!.symbolsProfiled,
                sub: "with behavior data",
                color: "text-blue-400",
              },
              {
                label: "Most Predictable",
                value:
                  overview!.profiles.sort((a, b) => b.predictabilityScore - a.predictabilityScore)[0]
                    ?.symbol ?? "—",
                sub: `score: ${overview!.profiles[0]?.predictabilityScore ?? 0}`,
                color: "text-green-400",
              },
              {
                label: "Cleanest Mover",
                value:
                  overview!.profiles
                    .filter((p) => p.personality === "Clean Mover")[0]?.symbol ??
                  overview!.profiles.sort((a, b) => b.cleanSetupFrequency - a.cleanSetupFrequency)[0]
                    ?.symbol ??
                  "—",
                sub: `clean: ${overview!.profiles.sort((a, b) => b.cleanSetupFrequency - a.cleanSetupFrequency)[0]?.cleanSetupFrequency ?? 0}%`,
                color: "text-emerald-400",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
              >
                <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
                <div className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</div>
                <div className="text-xs text-slate-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  activeTab === tab.id
                    ? "border-purple-500 text-purple-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Symbol Profiles ── */}
          {activeTab === "profiles" && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {overview!.profiles.map((p) => (
                  <ProfileCard
                    key={p.symbol}
                    profile={p}
                    isSelected={selectedSymbol === p.symbol}
                    onClick={() => setSelectedSymbol(p.symbol)}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                <Info className="w-3 h-3" />
                Click a card to select a symbol for deeper analysis in the other tabs.
              </div>
            </div>
          )}

          {/* ── Tab: Opportunity Evolution ── */}
          {activeTab === "evolution" && (
            <div className="space-y-4">
              {/* Symbol selector */}
              <div className="flex flex-wrap gap-1.5">
                {overview!.profiles.map((p) => {
                  const cfg = personalityCfg(p.personality);
                  return (
                    <button
                      key={p.symbol}
                      onClick={() => setSelectedSymbol(p.symbol)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-all",
                        selectedSymbol === p.symbol
                          ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                          : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                      )}
                    >
                      {p.symbol}
                    </button>
                  );
                })}
              </div>

              {selectedProfile && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200">
                        {selectedProfile.displayName}
                      </h3>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border",
                          personalityCfg(selectedProfile.personality).color,
                          personalityCfg(selectedProfile.personality).bg,
                          personalityCfg(selectedProfile.personality).border
                        )}
                      >
                        {selectedProfile.personality}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600">
                      Dominant: {selectedProfile.dominantState}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Priority progression — most recent 25 states (oldest → newest →)
                  </p>
                  {timelineLoading ? (
                    <div className="flex items-center gap-2 text-slate-600 text-sm py-4">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading timeline…
                    </div>
                  ) : (
                    <EvolutionTracker entries={timeline?.entries ?? []} />
                  )}
                </div>
              )}

              {/* Quality/confidence area chart */}
              {!timelineLoading && (timeline?.entries ?? []).length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    Quality & Confidence Evolution
                    <span className="text-xs text-slate-600 font-normal ml-2">
                      — last 40 snapshots
                    </span>
                  </h3>
                  <TimelineChart entries={timeline!.entries} />
                  <div className="flex gap-4 mt-2 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-blue-400 inline-block" /> Quality
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-green-400 inline-block" /> Confidence
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Timing Heatmap ── */}
          {activeTab === "heatmap" && (
            <div className="space-y-4">
              {/* Symbol selector */}
              <div className="flex flex-wrap gap-1.5">
                {overview!.profiles.map((p) => (
                  <button
                    key={p.symbol}
                    onClick={() => setSelectedSymbol(p.symbol)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all",
                      selectedSymbol === p.symbol
                        ? "border-purple-500/50 text-purple-300 bg-purple-500/10"
                        : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                    )}
                  >
                    {p.symbol}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200">
                    24-Hour Quality Heatmap — {selectedSymbol}
                  </h3>
                  <span className="text-xs text-slate-600">UTC hours</span>
                </div>
                <HeatmapGrid symbol={selectedSymbol} />
              </div>

              {selectedProfile && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    Behavioral Fingerprint — {selectedProfile.displayName}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Elite Frequency",
                        value: `${selectedProfile.eliteFrequency}%`,
                        color:
                          selectedProfile.eliteFrequency >= 10 ? "text-yellow-400" : "text-slate-500",
                      },
                      {
                        label: "Dangerous Freq",
                        value: `${selectedProfile.dangerousFrequency}%`,
                        color:
                          selectedProfile.dangerousFrequency >= 50 ? "text-red-400" : "text-orange-400",
                      },
                      {
                        label: "Spike Tendency",
                        value: `${selectedProfile.volatilityScore}%`,
                        color:
                          selectedProfile.volatilityScore >= 50 ? "text-red-400" : "text-slate-400",
                      },
                      {
                        label: "Reversal Rate",
                        value: `${selectedProfile.reversalFrequency}%`,
                        color: "text-purple-400",
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-center"
                      >
                        <div className="text-xs text-slate-500 mb-0.5">{m.label}</div>
                        <div className={cn("text-lg font-bold font-mono", m.color)}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Market Rhythm ── */}
          {activeTab === "rhythm" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Rhythm & Stability Scores
                  <span className="text-xs text-slate-600 font-normal ml-2">
                    — across all profiled symbols
                  </span>
                </h3>
                <RhythmChart profiles={overview!.profiles} />
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      {[
                        "Symbol",
                        "Personality",
                        "Rhythm",
                        "Stability",
                        "Predictability",
                        "Clean %",
                        "Elite %",
                        "Dominant Alert",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {overview!.profiles.map((p) => {
                      const cfg = personalityCfg(p.personality);
                      return (
                        <tr
                          key={p.symbol}
                          className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedSymbol(p.symbol)}
                        >
                          <td className="px-3 py-2.5">
                            <div className="text-sm font-medium text-slate-200">
                              {p.displayName}
                            </div>
                            <div className="text-xs text-slate-600 font-mono">{p.symbol}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full border",
                                cfg.color,
                                cfg.bg,
                                cfg.border
                              )}
                            >
                              {p.personality}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("font-mono text-xs font-medium", scoreColor(p.rhythmScore))}>
                              {p.rhythmScore}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("font-mono text-xs font-medium", scoreColor(p.stabilityScore))}>
                              {p.stabilityScore}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("font-mono text-xs font-medium", scoreColor(p.predictabilityScore))}>
                              {p.predictabilityScore}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("font-mono text-xs", p.cleanSetupFrequency >= 20 ? "text-green-400" : "text-slate-500")}>
                              {p.cleanSetupFrequency}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("font-mono text-xs", p.eliteFrequency >= 10 ? "text-yellow-400" : "text-slate-600")}>
                              {p.eliteFrequency}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-slate-400">{p.dominantAlertType}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
