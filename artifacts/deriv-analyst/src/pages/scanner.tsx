import { useState, useCallback } from "react";
import {
  useGetScannerResults,
  getGetScannerResultsQueryKey,
} from "@workspace/api-client-react";
import type { SymbolScanResult } from "@workspace/api-client-react";
import {
  ScanSearch,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  SkullIcon,
  Leaf,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw,
  Star,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "../store";
import { Check } from "lucide-react";

// ─── Priority styling ────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dotColor: string }
> = {
  "Elite Opportunity": {
    label: "Elite",
    bg: "bg-yellow-400/10",
    text: "text-yellow-300",
    border: "border-yellow-400/40",
    dotColor: "bg-yellow-400",
  },
  "High Confidence": {
    label: "High",
    bg: "bg-green-400/10",
    text: "text-green-400",
    border: "border-green-400/30",
    dotColor: "bg-green-400",
  },
  "Moderate Setup": {
    label: "Moderate",
    bg: "bg-blue-400/10",
    text: "text-blue-400",
    border: "border-blue-400/30",
    dotColor: "bg-blue-400",
  },
  "Watchlist Only": {
    label: "Watchlist",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-600/30",
    dotColor: "bg-slate-500",
  },
  Dangerous: {
    label: "Dangerous",
    bg: "bg-orange-400/10",
    text: "text-orange-400",
    border: "border-orange-400/30",
    dotColor: "bg-orange-400",
  },
  "Avoid Market": {
    label: "Avoid",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    dotColor: "bg-red-500",
  },
};

const PRIORITY_ORDER = [
  "Elite Opportunity",
  "High Confidence",
  "Moderate Setup",
  "Watchlist Only",
  "Dangerous",
  "Avoid Market",
];

function priorityCfg(p: string) {
  return PRIORITY_CONFIG[p] ?? PRIORITY_CONFIG["Watchlist Only"];
}

function cleanlinessColor(c: string) {
  if (c === "clean") return "text-green-400";
  if (c === "trending") return "text-blue-400";
  if (c === "choppy") return "text-yellow-400";
  return "text-red-400";
}

function alertTypeStyle(a: string) {
  if (a.toLowerCase().includes("bullish") || a.toLowerCase().includes("breakout"))
    return "text-green-300 bg-green-500/10 border-green-500/30";
  if (a.toLowerCase().includes("bearish") || a.toLowerCase().includes("breakdown"))
    return "text-red-300 bg-red-500/10 border-red-500/30";
  if (a.toLowerCase().includes("spike"))
    return "text-orange-300 bg-orange-500/10 border-orange-500/30";
  if (a.toLowerCase().includes("no") || a.toLowerCase().includes("avoid"))
    return "text-slate-400 bg-slate-500/10 border-slate-600/30";
  return "text-yellow-300 bg-yellow-500/10 border-yellow-500/30";
}

function rarityStars(r: string) {
  const map: Record<string, number> = { common: 1, moderate: 2, rare: 3, exceptional: 4 };
  const n = map[r] ?? 1;
  return Array.from({ length: 4 }).map((_, i) => (
    <Star
      key={i}
      className={cn("w-2.5 h-2.5", i < n ? "text-yellow-400 fill-yellow-400" : "text-slate-700")}
    />
  ));
}

function ScoreBar({
  value,
  max = 100,
  colorClass,
}: {
  value: number;
  max?: number;
  colorClass: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function scoreColor(v: number) {
  if (v >= 75) return "bg-green-500";
  if (v >= 55) return "bg-blue-500";
  if (v >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function riskColor(v: number) {
  if (v >= 75) return "text-red-400";
  if (v >= 55) return "text-orange-400";
  if (v >= 35) return "text-yellow-400";
  return "text-green-400";
}

// ─── Opportunity Summary Cards ────────────────────────────────────────────────

type ScannerKey = "topOpportunity" | "bestBullish" | "bestBearish" | "cleanest" | "safest" | "mostDangerous";

type CardDef = {
  key: ScannerKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  emptyLabel: string;
};

const CARDS: CardDef[] = [
  { key: "topOpportunity", label: "Top Opportunity", Icon: Zap, accent: "text-yellow-400", emptyLabel: "None found" },
  { key: "bestBullish", label: "Best Bullish", Icon: TrendingUp, accent: "text-green-400", emptyLabel: "No bullish setup" },
  { key: "bestBearish", label: "Best Bearish", Icon: TrendingDown, accent: "text-red-400", emptyLabel: "No bearish setup" },
  { key: "cleanest", label: "Cleanest Market", Icon: Leaf, accent: "text-emerald-400", emptyLabel: "No clean market" },
  { key: "safest", label: "Safest Setup", Icon: ShieldCheck, accent: "text-blue-400", emptyLabel: "No safe setup" },
  { key: "mostDangerous", label: "Most Dangerous", Icon: SkullIcon, accent: "text-red-500", emptyLabel: "No dangerous market" },
];

function OpportunityCard({
  def,
  result,
}: {
  def: CardDef;
  result: SymbolScanResult | null | undefined;
}) {
  const cfg = result ? priorityCfg(result.priorityLevel) : null;
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-2",
        result ? `${cfg!.bg} ${cfg!.border}` : "border-slate-800 bg-slate-900/40"
      )}
    >
      <div className="flex items-center gap-2">
        <def.Icon className={cn("w-4 h-4", def.accent)} />
        <span className="text-xs font-medium text-slate-400">{def.label}</span>
      </div>
      {result ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-white leading-tight">{result.displayName}</div>
              <div className="text-xs text-slate-500 mt-0.5">{result.symbol}</div>
            </div>
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0",
                cfg!.bg,
                cfg!.text,
                cfg!.border
              )}
            >
              {cfg!.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Quality</span>
                <span className="font-mono">{result.cleanSignalScore}</span>
              </div>
              <ScoreBar value={result.cleanSignalScore} colorClass={scoreColor(result.cleanSignalScore)} />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Conf</div>
              <div className="text-sm font-bold text-slate-200">{result.confidence}%</div>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded border font-medium",
                alertTypeStyle(result.alertType)
              )}
            >
              {result.alertType}
            </span>
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-600 mt-1">{def.emptyLabel}</div>
      )}
    </div>
  );
}

// ─── Sort helper ─────────────────────────────────────────────────────────────

type SortKey =
  | "displayName"
  | "cleanSignalScore"
  | "confidence"
  | "riskScore"
  | "indicatorAlignment"
  | "volatilityCompatibility"
  | "historicalSuccessRate"
  | "priorityLevel";

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: "asc" | "desc" }) {
  if (col !== active) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />;
  return dir === "asc" ? (
    <ChevronUp className="w-3 h-3 text-slate-300" />
  ) : (
    <ChevronDown className="w-3 h-3 text-slate-300" />
  );
}

// ─── Market Matrix Table ──────────────────────────────────────────────────────

function MarketMatrix({ results }: { results: SymbolScanResult[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("cleanSignalScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const filtered = results.filter(
    (r) => filterPriority === "all" || r.priorityLevel === filterPriority
  );

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = a[sortKey] as string | number;
    let bv: string | number = b[sortKey] as string | number;
    if (sortKey === "priorityLevel") {
      av = PRIORITY_ORDER.indexOf(a.priorityLevel);
      bv = PRIORITY_ORDER.indexOf(b.priorityLevel);
    }
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = Number(av);
    const bn = Number(bv);
    return sortDir === "asc" ? an - bn : bn - an;
  });

  const colHdr = (label: string, key: SortKey, extraClass = "") => (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap hover:text-slate-300 transition-colors",
        extraClass
      )}
      onClick={() => toggleSort(key)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={key} active={sortKey} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          className={cn(
            "text-xs px-3 py-1 rounded-full border transition-all",
            filterPriority === "all"
              ? "bg-slate-600 border-slate-500 text-white"
              : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
          )}
          onClick={() => setFilterPriority("all")}
        >
          All ({results.length})
        </button>
        {PRIORITY_ORDER.map((p) => {
          const count = results.filter((r) => r.priorityLevel === p).length;
          if (count === 0) return null;
          const cfg = priorityCfg(p);
          return (
            <button
              key={p}
              className={cn(
                "text-xs px-3 py-1 rounded-full border transition-all",
                filterPriority === p
                  ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                  : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
              )}
              onClick={() => setFilterPriority(p)}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                {colHdr("Symbol", "displayName")}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                  State
                </th>
                {colHdr("Quality", "cleanSignalScore")}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                  Bias
                </th>
                {colHdr("Conf %", "confidence")}
                {colHdr("Risk", "riskScore")}
                {colHdr("Vol Compat", "volatilityCompatibility")}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                  Rarity
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                  Alert
                </th>
                {colHdr("Hist %", "historicalSuccessRate")}
                {colHdr("Priority", "priorityLevel")}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.map((r) => {
                const cfg = priorityCfg(r.priorityLevel);
                const isBull = r.bullishScore > r.bearishScore;
                return (
                  <tr
                    key={r.symbol}
                    className={cn(
                      "transition-colors hover:bg-slate-800/40",
                      r.priorityLevel === "Elite Opportunity" && "bg-yellow-400/5",
                      r.priorityLevel === "High Confidence" && "bg-green-400/5"
                    )}
                  >
                    {/* Symbol */}
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-200 text-sm leading-tight">
                        {r.displayName}
                      </div>
                      <div className="text-xs text-slate-600 font-mono">{r.symbol}</div>
                    </td>

                    {/* Market state */}
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded border whitespace-nowrap",
                          r.marketState === "Bullish"
                            ? "text-green-400 bg-green-500/10 border-green-500/30"
                            : r.marketState === "Bearish"
                            ? "text-red-400 bg-red-500/10 border-red-500/30"
                            : r.marketState === "Spike Risk"
                            ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                            : r.marketState === "No-Trade Zone"
                            ? "text-slate-400 bg-slate-500/10 border-slate-600/30"
                            : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                        )}
                      >
                        {r.marketState}
                      </span>
                    </td>

                    {/* Quality score */}
                    <td className="px-3 py-3 min-w-[110px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-200 w-6 text-right text-xs">
                          {r.cleanSignalScore}
                        </span>
                        <div className="flex-1 min-w-[50px]">
                          <ScoreBar
                            value={r.cleanSignalScore}
                            colorClass={scoreColor(r.cleanSignalScore)}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Bull/Bear bias */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {isBull ? (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span
                          className={cn(
                            "text-xs font-mono",
                            isBull ? "text-green-400" : "text-red-400"
                          )}
                        >
                          {isBull ? r.bullishScore : r.bearishScore}
                        </span>
                      </div>
                    </td>

                    {/* Confidence */}
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "font-mono text-xs",
                          r.confidence >= 68
                            ? "text-green-400"
                            : r.confidence >= 50
                            ? "text-yellow-400"
                            : "text-slate-500"
                        )}
                      >
                        {r.confidence}%
                      </span>
                    </td>

                    {/* Risk score */}
                    <td className="px-3 py-3">
                      <span
                        className={cn("font-mono text-xs font-medium", riskColor(r.riskScore))}
                      >
                        {r.riskScore}
                      </span>
                    </td>

                    {/* Volatility compatibility */}
                    <td className="px-3 py-3 min-w-[90px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 text-xs w-6 text-right">
                          {r.volatilityCompatibility}
                        </span>
                        <div className="flex-1 min-w-[40px]">
                          <ScoreBar
                            value={r.volatilityCompatibility}
                            colorClass={
                              r.volatilityCompatibility >= 70
                                ? "bg-green-500"
                                : r.volatilityCompatibility >= 40
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }
                          />
                        </div>
                      </div>
                    </td>

                    {/* Rarity */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5">{rarityStars(r.setupRarity)}</div>
                    </td>

                    {/* Alert type */}
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded border whitespace-nowrap",
                          alertTypeStyle(r.alertType)
                        )}
                      >
                        {r.alertType}
                      </span>
                    </td>

                    {/* Historical success */}
                    <td className="px-3 py-3">
                      {r.historicalTrades > 0 ? (
                        <div className="text-xs">
                          <span
                            className={cn(
                              "font-mono font-medium",
                              r.historicalSuccessRate >= 65
                                ? "text-green-400"
                                : r.historicalSuccessRate >= 50
                                ? "text-yellow-400"
                                : "text-slate-500"
                            )}
                          >
                            {r.historicalSuccessRate.toFixed(0)}%
                          </span>
                          <span className="text-slate-600 ml-1">/{r.historicalTrades}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-700">—</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap",
                          cfg.bg,
                          cfg.text,
                          cfg.border
                        )}
                      >
                        <span
                          className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotColor)}
                        />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Scanner() {
  const { granularity } = useAppStore();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isTickInterval = granularity.endsWith('t');
  const numericGranularity = isTickInterval ? 60 : parseInt(granularity, 10);

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useGetScannerResults(
    { granularity: numericGranularity },
    {
      query: {
        queryKey: getGetScannerResultsQueryKey({ granularity: numericGranularity }),
        refetchInterval: autoRefresh ? 25000 : false,
        staleTime: 10000,
      },
    }
  );

  const eliteResults = data?.results.filter((r) => r.priorityLevel === "Elite Opportunity") ?? [];
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <ScanSearch className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Market Scanner</h1>
            {isFetching && (
              <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Scanning…
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">
            Multi-market intelligence scanner — ranking all Deriv markets by opportunity quality
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-600">Last scan: {lastUpdated}</span>
          )}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-lg border transition-all",
              autoRefresh
                ? "border-blue-500/40 text-blue-400 bg-blue-400/10"
                : "border-slate-700 text-slate-500 hover:border-slate-500"
            )}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all disabled:opacity-40"
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Scan Now
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Markets Scanned", value: data.totalSymbols, color: "text-slate-200" },
            {
              label: "Elite Opportunities",
              value: data.eliteCount,
              color: data.eliteCount > 0 ? "text-yellow-400" : "text-slate-500",
            },
            {
              label: "High Confidence",
              value: data.highConfidenceCount,
              color: data.highConfidenceCount > 0 ? "text-green-400" : "text-slate-500",
            },
            {
              label: "Dangerous Markets",
              value: data.results.filter(
                (r) => r.priorityLevel === "Dangerous" || r.priorityLevel === "Avoid Market"
              ).length,
              color: "text-red-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <div className="text-xs text-slate-500 mb-1">{s.label}</div>
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Elite Opportunity Banner ── */}
      {eliteResults.length > 0 && (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
            <span className="font-semibold text-yellow-300 text-sm">
              {eliteResults.length} Elite Opportunit{eliteResults.length > 1 ? "ies" : "y"} Detected
            </span>
            <span className="text-xs text-yellow-600 ml-1">— All quality gates passed</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {eliteResults.map((r) => (
              <div
                key={r.symbol}
                className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <div>
                  <div className="text-sm font-bold text-yellow-200">{r.displayName}</div>
                  <div className="flex items-center gap-2 text-xs text-yellow-600 mt-0.5">
                    <span>Q: {r.cleanSignalScore}</span>
                    <span>·</span>
                    <span>Conf: {r.confidence}%</span>
                    <span>·</span>
                    <span>{r.alertType}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="rounded-xl border border-slate-800 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <div className="text-slate-400 text-sm">Scanning all markets simultaneously…</div>
          <div className="text-slate-600 text-xs mt-1">
            Fetching candles, calculating indicators, and ranking opportunities
          </div>
        </div>
      )}

      {data && (
        <>
          {/* ── Opportunity summary cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {CARDS.map((def) => (
              <OpportunityCard
                key={def.key}
                def={def}
                result={data[def.key] as SymbolScanResult | null | undefined}
              />
            ))}
          </div>

          {/* ── Warning if no good setups ── */}
          {data.eliteCount === 0 && data.highConfidenceCount === 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-400">No clean setups right now</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Scanner is actively filtering — markets are noisy, volatile, or in conflict. Waiting for favorable conditions.
                </div>
              </div>
            </div>
          )}

          {/* ── Full market matrix ── */}
          <div>
            <h2 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <ScanSearch className="w-4 h-4 text-slate-500" />
              Full Market Matrix
              <span className="text-xs text-slate-600 font-normal ml-1">
                — {data.results.length} markets · sortable & filterable
              </span>
            </h2>
            <MarketMatrix results={data.results} />
          </div>
        </>
      )}
    </div>
  );
}
