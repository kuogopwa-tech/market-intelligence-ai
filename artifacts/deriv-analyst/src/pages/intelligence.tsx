import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import {
  Cpu,
  Activity,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Database,
  BarChart3,
  Shield,
  Timer,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanRunSummary {
  id: number;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  symbolsScanned: number;
  symbolsSucceeded: number;
  symbolsFailed: number;
  error: string | null;
}

interface IntelligenceStatus {
  running: boolean;
  isScanning: boolean;
  lastScanAt: number | null;
  nextScanAt: number | null;
  totalScans: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  intervalMs: number;
  uptimeSeconds: number;
  historicalDepthHours: number;
  historicalDepthDays: number;
  symbolsTracked: number;
  totalSymbols: number;
  recentRuns: ScanRunSummary[];
}

interface HourlyWindow {
  hour: number;
  avgQuality: number;
  avgConfidence: number;
  avgRisk: number;
  sampleCount: number;
  eliteCount: number;
  dangerousCount: number;
  label: string;
}

interface TimingModelResponse {
  symbol: string;
  windows: HourlyWindow[];
  bestWindows: HourlyWindow[];
  worstWindows: HourlyWindow[];
  hasData: boolean;
}

interface EvolutionEvent {
  id: number;
  detectedAt: number;
  type: string;
  severity: string;
  description: string;
}

interface AggregatedSymbolEntry {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function timeUntil(epochSeconds: number): string {
  const diff = epochSeconds - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h`;
}

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function scoreColor(v: number) {
  if (v >= 70) return "text-green-400";
  if (v >= 50) return "text-yellow-400";
  if (v >= 30) return "text-orange-400";
  return "text-red-400";
}

function severityStyle(severity: string) {
  switch (severity) {
    case "alert": return { icon: <XCircle className="w-3.5 h-3.5 text-red-400" />, text: "text-red-300", border: "border-red-500/30 bg-red-500/5" };
    case "warning": return { icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />, text: "text-orange-300", border: "border-orange-500/30 bg-orange-500/5" };
    default: return { icon: <Info className="w-3.5 h-3.5 text-blue-400" />, text: "text-blue-300", border: "border-blue-500/20 bg-blue-500/5" };
  }
}

// ─── Countdown timer component ────────────────────────────────────────────────

function Countdown({ nextScanAt }: { nextScanAt: number | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  if (!nextScanAt) return <span className="text-slate-500">—</span>;
  const diff = nextScanAt - Math.floor(Date.now() / 1000);
  if (diff <= 0) return <span className="text-yellow-400 animate-pulse">Scanning…</span>;
  return <span className="font-mono text-cyan-400">{timeUntil(nextScanAt)}</span>;
}

// ─── Status Card ──────────────────────────────────────────────────────────────

function StatusCard({ status }: { status: IntelligenceStatus | null }) {
  if (!status) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-slate-800 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const isHealthy = status.running && !status.lastError;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">Background Intelligence Engine</h2>
          {status.isScanning ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              <RefreshCw className="w-3 h-3 animate-spin" /> Scanning…
            </span>
          ) : isHealthy ? (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-500/40 bg-green-500/10 text-green-300">
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-300">
              <XCircle className="w-3 h-3" /> Error
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600">
          Interval: {Math.round(status.intervalMs / 60000)}m
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: "Next Scan",
            value: <Countdown nextScanAt={status.nextScanAt} />,
            icon: <Timer className="w-4 h-4 text-cyan-500" />,
          },
          {
            label: "Last Scan",
            value: status.lastScanAt ? (
              <span className="font-mono text-slate-300">{timeAgo(status.lastScanAt)}</span>
            ) : <span className="text-slate-500">—</span>,
            icon: <Clock className="w-4 h-4 text-slate-500" />,
          },
          {
            label: "Total Scans",
            value: <span className="font-mono font-bold text-white">{status.totalScans}</span>,
            icon: <Activity className="w-4 h-4 text-blue-400" />,
          },
          {
            label: "Latency",
            value: status.lastLatencyMs ? (
              <span className={cn("font-mono font-bold", status.lastLatencyMs < 30000 ? "text-green-400" : status.lastLatencyMs < 60000 ? "text-yellow-400" : "text-red-400")}>
                {(status.lastLatencyMs / 1000).toFixed(1)}s
              </span>
            ) : <span className="text-slate-500">—</span>,
            icon: <Zap className="w-4 h-4 text-yellow-400" />,
          },
          {
            label: "Symbols",
            value: <span className="font-mono font-bold text-white">{status.symbolsTracked}/{status.totalSymbols}</span>,
            icon: <Layers className="w-4 h-4 text-purple-400" />,
          },
          {
            label: "History",
            value: (
              <span className="font-mono font-bold text-white">
                {status.historicalDepthDays > 0
                  ? `${status.historicalDepthDays}d`
                  : `${status.historicalDepthHours}h`}
              </span>
            ),
            icon: <Database className="w-4 h-4 text-emerald-400" />,
          },
          {
            label: "Uptime",
            value: <span className="font-mono text-slate-300">{formatUptime(status.uptimeSeconds)}</span>,
            icon: <Shield className="w-4 h-4 text-green-500" />,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              {item.icon}
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
            <div className="text-sm">{item.value}</div>
          </div>
        ))}
      </div>

      {status.lastError && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          <span className="font-medium">Last error:</span> {status.lastError}
        </div>
      )}
    </div>
  );
}

// ─── Scan History Table ───────────────────────────────────────────────────────

function ScanHistory({
  runs,
  expanded,
  onToggle,
}: {
  runs: ScanRunSummary[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Recent Scan Runs
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {["Run", "Started", "Duration", "Scanned", "✓ OK", "✗ Fail", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-slate-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2 font-mono text-slate-500">#{run.id}</td>
                  <td className="px-4 py-2 text-slate-400">{timeAgo(run.startedAt)}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">
                    {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-400">{run.symbolsScanned}</td>
                  <td className="px-4 py-2 font-mono text-green-400">{run.symbolsSucceeded}</td>
                  <td className="px-4 py-2 font-mono text-red-400">{run.symbolsFailed}</td>
                  <td className="px-4 py-2">
                    {run.error ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Error
                      </span>
                    ) : run.completedAt ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    ) : (
                      <span className="text-yellow-400">Running</span>
                    )}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-600">
                    No scan runs yet — the first scan starts 10 seconds after server boot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Timing Model Chart ───────────────────────────────────────────────────────

function TimingChart({ model }: { model: TimingModelResponse | null }) {
  if (!model) return <div className="h-48 flex items-center justify-center text-slate-600 text-sm animate-pulse">Loading…</div>;

  if (!model.hasData) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
        <BarChart3 className="w-6 h-6 text-slate-700 mx-auto mb-2" />
        <div className="text-slate-500 text-sm">Timing model builds automatically as scans accumulate.</div>
        <div className="text-slate-700 text-xs mt-1">Check back after a few scan cycles.</div>
      </div>
    );
  }

  const maxQ = Math.max(...model.windows.map((w) => w.avgQuality), 1);

  function barColor(w: HourlyWindow) {
    if (w.sampleCount === 0) return "#1e293b";
    if (w.dangerousCount > w.eliteCount) return "#ef4444";
    const rel = w.avgQuality / maxQ;
    if (rel >= 0.8) return "#22c55e";
    if (rel >= 0.55) return "#3b82f6";
    if (rel >= 0.35) return "#eab308";
    return "#475569";
  }

  return (
    <div className="space-y-3">
      {model.bestWindows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500">Best windows:</span>
          {model.bestWindows.map((w) => (
            <span key={w.hour} className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-300 font-mono">
              {w.label} · Q{w.avgQuality}
            </span>
          ))}
          {model.worstWindows.length > 0 && (
            <>
              <span className="text-slate-500 ml-2">Riskiest:</span>
              {model.worstWindows.map((w) => (
                <span key={w.hour} className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 font-mono">
                  {w.label}
                </span>
              ))}
            </>
          )}
        </div>
      )}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={model.windows}
            margin={{ top: 4, right: 4, bottom: 16, left: -20 }}
          >
            <XAxis
              dataKey="hour"
              tickFormatter={(h) => `${h}h`}
              tick={{ fontSize: 9, fill: "#475569" }}
              interval={3}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#475569" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "11px" }}
              formatter={(val: number, name: string) => [val, name]}
              labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 UTC`}
            />
            <ReferenceLine y={50} stroke="#334155" strokeDasharray="3 3" />
            <Bar dataKey="avgQuality" name="Avg Quality" radius={[3, 3, 0, 0]}>
              {model.windows.map((w, i) => (
                <Cell key={i} fill={barColor(w)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> High quality</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Moderate</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Dangerous</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-800 inline-block" /> No data</span>
      </div>
    </div>
  );
}

// ─── Evolution Events ─────────────────────────────────────────────────────────

function EvolutionLog({ events }: { events: EvolutionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-slate-600 text-sm">
        No regime shifts detected yet — evolution tracking requires at least 48h of history.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((event) => {
        const style = severityStyle(event.severity);
        return (
          <div key={event.id} className={cn("rounded-lg border px-3 py-2.5 flex items-start gap-2.5", style.border)}>
            <div className="shrink-0 mt-0.5">{style.icon}</div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-sm font-medium leading-snug", style.text)}>{event.description}</div>
              <div className="text-xs text-slate-600 mt-0.5">{timeAgo(event.detectedAt)}</div>
            </div>
            <span className="shrink-0 text-xs text-slate-700 font-mono">{event.type.replace(/_/g, " ")}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ entries }: { entries: AggregatedSymbolEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-slate-600 text-sm">
        Leaderboard populates after the first full scan cycle.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            {["#", "Market", "Avg Quality", "Avg Conf", "Avg Risk", "Elite Cnt", "Danger Cnt", "Samples", "Days"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-slate-600 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.symbol} className="border-b border-slate-800/40 hover:bg-slate-800/20">
              <td className="px-3 py-2 text-slate-600 font-mono">{i + 1}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-200 leading-tight">{entry.displayName}</div>
                <div className="text-slate-600 font-mono text-xs">{entry.symbol}</div>
              </td>
              <td className="px-3 py-2">
                <span className={cn("font-mono font-bold", scoreColor(entry.avgQuality))}>{entry.avgQuality}</span>
              </td>
              <td className="px-3 py-2 font-mono text-slate-300">{entry.avgConfidence}%</td>
              <td className="px-3 py-2">
                <span className={cn("font-mono", entry.avgRisk >= 70 ? "text-red-400" : entry.avgRisk >= 45 ? "text-yellow-400" : "text-green-400")}>
                  {entry.avgRisk}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-yellow-300">{entry.eliteCount}</td>
              <td className="px-3 py-2 font-mono text-red-400">{entry.dangerousCount}</td>
              <td className="px-3 py-2 font-mono text-slate-400">{entry.totalSamples.toLocaleString()}</td>
              <td className="px-3 py-2 font-mono text-slate-500">{entry.daysTracked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Daily Quality Line Chart ─────────────────────────────────────────────────

interface DailySummaryEntry {
  date: string;
  avgQuality: number;
  avgConfidence: number;
  avgRisk: number;
  sampleCount: number;
}

function DailyQualityChart({ dailySummaries }: { dailySummaries: DailySummaryEntry[] }) {
  if (!dailySummaries || dailySummaries.length === 0) {
    return <div className="text-center py-4 text-slate-600 text-sm">No daily summaries yet.</div>;
  }
  const data = [...dailySummaries].reverse().slice(-14).map((d) => ({
    date: d.date.slice(5),
    quality: d.avgQuality,
    confidence: d.avgConfidence,
    risk: d.avgRisk,
    samples: d.sampleCount,
  }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#475569" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#475569" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "11px" }}
          />
          <Line type="monotone" dataKey="quality" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Quality" />
          <Line type="monotone" dataKey="confidence" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Confidence" />
          <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={1} dot={false} name="Risk" strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Intelligence() {
  const { selectedSymbol } = useAppStore();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [status, setStatus] = useState<IntelligenceStatus | null>(null);
  const [timingModel, setTimingModel] = useState<TimingModelResponse | null>(null);
  const [evolutionEvents, setEvolutionEvents] = useState<EvolutionEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<AggregatedSymbolEntry[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"timing" | "evolution" | "leaderboard" | "daily">("timing");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [statusRes, timingRes, evolutionRes, leaderboardRes, dailyRes] = await Promise.allSettled([
          fetch(`${BASE}/api/intelligence/status`).then((r) => r.json()),
          fetch(`${BASE}/api/intelligence/hourly/${selectedSymbol}`).then((r) => r.json()),
          fetch(`${BASE}/api/intelligence/evolution/${selectedSymbol}`).then((r) => r.json()),
          fetch(`${BASE}/api/intelligence/aggregated`).then((r) => r.json()),
          fetch(`${BASE}/api/intelligence/daily/${selectedSymbol}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (statusRes.status === "fulfilled") setStatus(statusRes.value as IntelligenceStatus);
        if (timingRes.status === "fulfilled") setTimingModel(timingRes.value as TimingModelResponse);
        if (evolutionRes.status === "fulfilled") setEvolutionEvents((evolutionRes.value as { events: EvolutionEvent[] }).events ?? []);
        if (leaderboardRes.status === "fulfilled") setLeaderboard((leaderboardRes.value as { leaderboard: AggregatedSymbolEntry[] }).leaderboard ?? []);
        if (dailyRes.status === "fulfilled") setDailySummaries((dailyRes.value as { dailySummaries: DailySummaryEntry[] }).dailySummaries ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    void fetchAll();
    // Poll status every 10s, other data every 30s
    const statusInterval = setInterval(() => {
      fetch(`${BASE}/api/intelligence/status`)
        .then((r) => r.json())
        .then((d) => !cancelled && setStatus(d as IntelligenceStatus))
        .catch(() => {});
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(statusInterval);
    };
  }, [selectedSymbol, refreshKey, BASE]);

  const tabs = [
    { id: "timing" as const, label: "Adaptive Timing", icon: Clock },
    { id: "evolution" as const, label: "Evolution Log", icon: Activity },
    { id: "leaderboard" as const, label: "7-Day Leaderboard", icon: TrendingUp },
    { id: "daily" as const, label: "Daily History", icon: BarChart3 },
  ];

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Intelligence Hub</h1>
            {!loading && (
              <span className="text-xs text-slate-600">
                · {selectedSymbol}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">
            Autonomous market intelligence — continuously collecting, aggregating, and learning
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Scanner Status */}
      <StatusCard status={status} />

      {/* Scan History */}
      <ScanHistory
        runs={status?.recentRuns ?? []}
        expanded={historyExpanded}
        onToggle={() => setHistoryExpanded((v) => !v)}
      />

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
                activeTab === tab.id
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        {activeTab === "timing" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Adaptive Timing Windows — {selectedSymbol}</h3>
              <span className="text-xs text-slate-600">Historical best/worst UTC hours</span>
            </div>
            <TimingChart model={timingModel} />
          </>
        )}

        {activeTab === "evolution" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Regime-Shift Events — {selectedSymbol}</h3>
              <span className="text-xs text-slate-600">Detected behavioral changes</span>
            </div>
            <EvolutionLog events={evolutionEvents} />
          </>
        )}

        {activeTab === "leaderboard" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">7-Day Intelligence Leaderboard</h3>
              <span className="text-xs text-slate-600">Cross-symbol aggregated ranking</span>
            </div>
            <Leaderboard entries={leaderboard} />
          </>
        )}

        {activeTab === "daily" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Daily Quality History — {selectedSymbol}</h3>
              <span className="text-xs text-slate-600">Last 14 days</span>
            </div>
            <DailyQualityChart dailySummaries={dailySummaries} />
            {dailySummaries.length > 0 && (
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Quality</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Confidence</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Risk</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* System info footer */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
        <span className="flex items-center gap-1.5">
          <Shield className="w-3 h-3" />
          Single-run lock · Exponential backoff · Heap guard ({process.env.NODE_ENV !== "production" ? "dev" : "prod"})
        </span>
        <span>·</span>
        <span>Hourly retention: 90 days</span>
        <span>·</span>
        <span>Daily retention: 365 days</span>
        <span>·</span>
        <span>Evolution detection: ≥15pt quality shift</span>
      </div>
    </div>
  );
}
