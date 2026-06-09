import { ReactNode } from "react";
import { useAppStore } from "../store";
import { useGetSignalQuality, getGetSignalQualityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, Zap, ShieldAlert, Minus, Bell, BellOff,
  Star, Clock, ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// ── Helpers ────────────────────────────────────────────────────────────────

const ALERT_STYLES: Record<string, { border: string; bg: string; icon: ReactNode; badge: string }> = {
  "High Confidence Bullish": {
    border: "border-green-500/40",
    bg: "bg-green-500/5",
    icon: <TrendingUp className="h-5 w-5 text-green-400" />,
    badge: "text-green-400 border-green-400/30",
  },
  "High Confidence Bearish": {
    border: "border-red-500/40",
    bg: "bg-red-500/5",
    icon: <TrendingDown className="h-5 w-5 text-red-400" />,
    badge: "text-red-400 border-red-400/30",
  },
  "Reversal Watch": {
    border: "border-purple-500/40",
    bg: "bg-purple-500/5",
    icon: <ShieldAlert className="h-5 w-5 text-purple-400" />,
    badge: "text-purple-400 border-purple-400/30",
  },
  "Spike Risk Warning": {
    border: "border-orange-500/40",
    bg: "bg-orange-500/5",
    icon: <Zap className="h-5 w-5 text-orange-400" />,
    badge: "text-orange-400 border-orange-400/30",
  },
  "No-Trade Warning": {
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/5",
    icon: <ShieldAlert className="h-5 w-5 text-yellow-400" />,
    badge: "text-yellow-400 border-yellow-400/30",
  },
  none: {
    border: "border-border",
    bg: "bg-transparent",
    icon: <Minus className="h-5 w-5 text-muted-foreground" />,
    badge: "text-muted-foreground",
  },
};

const RARITY_STARS: Record<string, number> = {
  common: 1,
  moderate: 2,
  rare: 3,
  exceptional: 4,
};

const CLEANLINESS_COLORS: Record<string, string> = {
  clean: "text-green-400",
  trending: "text-blue-400",
  choppy: "text-yellow-400",
  volatile: "text-orange-400",
};

const CLEANLINESS_BG: Record<string, string> = {
  clean: "bg-green-500",
  trending: "bg-blue-500",
  choppy: "bg-yellow-500",
  volatile: "bg-orange-500",
};

function RarityStars({ rarity }: { rarity: string }) {
  const count = RARITY_STARS[rarity] ?? 1;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < count ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1 capitalize">{rarity}</span>
    </div>
  );
}

function ExpiryCountdown({ expiresAt }: { expiresAt: number }) {
  const remaining = Math.max(0, expiresAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (remaining === 0) {
    return <span className="text-xs text-muted-foreground/50">Expired</span>;
  }

  return (
    <span className="text-xs font-mono text-muted-foreground">
      <Clock className="h-3 w-3 inline mr-1" />
      {minutes > 0 ? `${minutes}m ` : ""}{seconds}s
    </span>
  );
}

function ScoreBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AlertCenter() {
  const { selectedSymbol, granularity, alertFeed, clearAlerts } = useAppStore();
  const [, navigate] = useLocation();

  const intervalValue = granularity || "60";
  const isTickInterval = intervalValue.endsWith('t');
  const numericGranularity = isTickInterval ? 60 : parseInt(intervalValue, 10);

  const { data: quality, isLoading } = useGetSignalQuality(
    { symbol: selectedSymbol, granularity: numericGranularity },
    {
      query: {
        queryKey: getGetSignalQualityQueryKey({ symbol: selectedSymbol, granularity: numericGranularity }),
        refetchInterval: 15_000,
        enabled: !!selectedSymbol,
      },
    }
  );

  const alertType = quality?.alertType ?? "none";
  const style = ALERT_STYLES[alertType] ?? ALERT_STYLES.none;
  const hasActiveAlert = alertType !== "none";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Strongest Setup Card ─────────────────────────── */}
      <Card className={`lg:col-span-2 transition-all duration-500 ${style.border} ${style.bg}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {style.icon}
              Current Market Opportunity
            </CardTitle>
            {quality && (
              <div className="flex items-center gap-2 flex-wrap">
                <RarityStars rarity={quality.setupRarity} />
                {hasActiveAlert && (
                  <Badge variant="outline" className={`text-xs font-medium ${style.badge}`}>
                    {alertType}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : quality ? (
            <>
              {/* Signal Quality Scores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ScoreBar
                  label="Clean Signal Score"
                  value={quality.cleanSignalScore}
                  colorClass={
                    quality.cleanSignalScore >= 72 ? "bg-green-500" :
                    quality.cleanSignalScore >= 55 ? "bg-yellow-500" : "bg-red-500"
                  }
                />
                <ScoreBar
                  label="Indicator Alignment"
                  value={quality.indicatorAlignment}
                  colorClass="bg-blue-500"
                />
                <ScoreBar
                  label="Momentum"
                  value={quality.momentumConfirmation}
                  colorClass="bg-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ScoreBar
                  label="Volatility Compat."
                  value={quality.volatilityCompatibility}
                  colorClass={
                    quality.volatilityCompatibility >= 70 ? "bg-green-500" :
                    quality.volatilityCompatibility >= 40 ? "bg-yellow-500" : "bg-red-500"
                  }
                />
                <ScoreBar
                  label="Confidence Weight"
                  value={quality.confidenceWeight}
                  colorClass="bg-primary"
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Risk Score</span>
                    <span className={`font-mono font-medium ${
                      quality.riskScore < 35 ? "text-green-400" :
                      quality.riskScore < 60 ? "text-yellow-400" : "text-red-400"
                    }`}>{quality.riskScore}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        quality.riskScore < 35 ? "bg-green-500" :
                        quality.riskScore < 60 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${quality.riskScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Market Cleanliness + Expiry */}
              <div className="flex items-center justify-between pt-2 border-t border-border flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Market Cleanliness</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${CLEANLINESS_BG[quality.marketCleanliness] ?? "bg-muted"}`} />
                    <span className={`text-xs font-semibold capitalize ${CLEANLINESS_COLORS[quality.marketCleanliness] ?? ""}`}>
                      {quality.marketCleanliness}
                    </span>
                  </div>
                </div>
                {quality.historicalBoost !== 0 && (
                  <Badge variant="outline" className={`text-xs ${quality.historicalBoost > 0 ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
                    {quality.historicalBoost > 0 ? "+" : ""}{quality.historicalBoost}% historical edge
                  </Badge>
                )}
                {hasActiveAlert && (
                  <ExpiryCountdown expiresAt={Date.now() + quality.expirySeconds * 1000} />
                )}
              </div>

              {/* No active alert placeholder */}
              {!hasActiveAlert && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <BellOff className="h-4 w-4 shrink-0" />
                  <span>No high-quality setup detected — engine filtering for clean conditions</span>
                </div>
              )}

              {/* Active alert CTA */}
              {hasActiveAlert && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full gap-2 ${style.badge}`}
                  onClick={() => navigate("/analysis")}
                >
                  View Full Analysis
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Loading signal quality engine...</p>
          )}
        </CardContent>
      </Card>

      {/* ── Live Alert Feed ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4 text-primary" />
              Live Alert Feed
            </CardTitle>
            {alertFeed.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAlerts}>
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {alertFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground/40">
              <Bell className="h-6 w-6" />
              <p className="text-xs text-center">
                Alerts appear here when high-quality setups are detected
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {alertFeed.map((entry) => {
                const s = ALERT_STYLES[entry.alertType] ?? ALERT_STYLES.none;
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-3 ${s.border} ${s.bg} space-y-1`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {s.icon}
                        <span className={`text-xs font-semibold ${s.badge.split(" ")[0]}`}>
                          {entry.alertType}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{entry.symbol}</span>
                      <span className="text-xs">·</span>
                      <span className="text-xs font-medium">{entry.confidence}% conf</span>
                      <span className="text-xs">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{entry.setupRarity}</span>
                    </div>
                    {entry.topSignal && (
                      <p className="text-xs text-muted-foreground/70 truncate" title={entry.topSignal}>
                        ↳ {entry.topSignal}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
