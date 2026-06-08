import { useAppStore } from "../store";
import {
  useGetLatestAnalysis,
  getGetLatestAnalysisQueryKey,
  useGenerateAnalysis,
  useGetAiStatus,
  getGetAiStatusQueryKey,
  useGetSignalAnalysis,
  getGetSignalAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BrainCircuit,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Minus,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

const MARKET_STATE_COLORS: Record<string, string> = {
  "Strong Bullish": "text-green-400 bg-green-400/10 border-green-400/30",
  "Weak Bullish": "text-green-300 bg-green-300/10 border-green-300/30",
  "Strong Bearish": "text-red-400 bg-red-400/10 border-red-400/30",
  "Weak Bearish": "text-red-300 bg-red-300/10 border-red-300/30",
  Ranging: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  Volatile: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  "Spike Risk": "text-red-500 bg-red-500/10 border-red-500/30",
  "Reversal Watch": "text-purple-400 bg-purple-400/10 border-purple-400/30",
  Uncertain: "text-muted-foreground bg-muted/30 border-border",
};

const RISK_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-orange-400",
  Extreme: "text-red-500",
};

function MarketStateIcon({ state }: { state: string }) {
  if (state.includes("Bullish")) return <TrendingUp className="h-4 w-4" />;
  if (state.includes("Bearish")) return <TrendingDown className="h-4 w-4" />;
  if (state === "Spike Risk") return <Zap className="h-4 w-4" />;
  if (state === "Reversal Watch") return <ShieldAlert className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

export default function Analysis() {
  const { selectedSymbol, granularity } = useAppStore();
  const queryClient = useQueryClient();

  const { data: aiStatus } = useGetAiStatus({
    query: { queryKey: getGetAiStatusQueryKey(), refetchInterval: 30000 },
  });

  const { data: signals, isLoading: isLoadingSignals } = useGetSignalAnalysis(
    { symbol: selectedSymbol, granularity },
    {
      query: {
        enabled: !!selectedSymbol,
        queryKey: getGetSignalAnalysisQueryKey({ symbol: selectedSymbol, granularity }),
        refetchInterval: 15000,
      },
    }
  );

  const { data: analysis, isLoading, isRefetching } = useGetLatestAnalysis(
    { symbol: selectedSymbol },
    {
      query: {
        enabled: !!selectedSymbol,
        queryKey: getGetLatestAnalysisQueryKey({ symbol: selectedSymbol }),
        refetchInterval: 60000,
      },
    }
  );

  const generateMutation = useGenerateAnalysis();

  const handleGenerate = () => {
    generateMutation.mutate(
      { data: { symbol: selectedSymbol, forceRefresh: true } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetLatestAnalysisQueryKey({ symbol: selectedSymbol }),
          });
          queryClient.invalidateQueries({
            queryKey: getGetSignalAnalysisQueryKey({ symbol: selectedSymbol, granularity }),
          });
        },
      }
    );
  };

  const marketState = signals?.marketState ?? analysis?.marketState ?? null;
  const riskLevel = signals?.riskLevel ?? analysis?.riskLevel ?? null;
  const noTradeZone = signals?.noTradeZone ?? analysis?.noTradeZone ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Analysis Panel</h1>
          <p className="text-sm text-muted-foreground">
            Signal intelligence for {selectedSymbol}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {aiStatus && (
            <Badge
              variant="outline"
              className={aiStatus.online ? "text-green-400 border-green-400/40" : "text-muted-foreground"}
            >
              {aiStatus.online ? `AI: ${aiStatus.model ?? "Online"}` : "Rule-Based Mode"}
            </Badge>
          )}
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {generateMutation.isPending ? "Generating..." : "Generate Analysis"}
          </Button>
        </div>
      </div>

      {/* Signal Merge Engine Panel */}
      <Card className={noTradeZone ? "border-orange-500/30 bg-orange-500/5" : "border-border"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-primary" />
              Signal Merge Engine
            </CardTitle>
            {marketState && (
              <Badge
                variant="outline"
                className={`gap-1.5 font-medium ${MARKET_STATE_COLORS[marketState] ?? "text-muted-foreground"}`}
              >
                <MarketStateIcon state={marketState} />
                {marketState}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSignals ? (
            <Skeleton className="h-24 w-full" />
          ) : signals ? (
            <>
              {noTradeZone && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm">
                  <ShieldAlert className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-orange-400">No-Trade Zone</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Conflicting signals — avoid directional predictions until conditions clarify
                    </p>
                  </div>
                </div>
              )}

              {/* Score bars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-green-400 font-medium">Bullish</span>
                    <span className="font-mono text-green-400">{signals.bullishScore}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${signals.bullishScore}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-red-400 font-medium">Bearish</span>
                    <span className="font-mono text-red-400">{signals.bearishScore}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${signals.bearishScore}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Confidence</span>
                    <span className="font-mono">{signals.confidence}%</span>
                  </div>
                  <Progress value={signals.confidence} className="h-2" />
                </div>
              </div>

              {/* Risk level + signals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                    Supporting Signals
                  </p>
                  <div className="space-y-1">
                    {(signals?.supportingSignals ?? []).slice(0, 4).map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-slate-300">{s}</span>
                      </div>
                    ))}
                    {signals.supportingSignals.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No clear supporting signals</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                    Conflicting Signals
                  </p>
                  <div className="space-y-1">
                    {signals.conflictingSignals.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <XCircle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                        <span className="text-slate-400">{s}</span>
                      </div>
                    ))}
                    {signals.conflictingSignals.length === 0 && (
                      <span className="text-xs text-green-500/70 italic">No conflicting signals</span>
                    )}
                  </div>
                </div>
              </div>

              {riskLevel && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">Risk Level</span>
                  <span className={`text-sm font-bold ${RISK_COLORS[riskLevel] ?? ""}`}>
                    {riskLevel}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Loading signal engine...</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reasoning Panel */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-blue-500" />
                AI Reasoning
              </CardTitle>
              {analysis?.createdAt && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(analysis.createdAt * 1000), "HH:mm:ss")}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoading || generateMutation.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            ) : analysis ? (
              <div className="space-y-3">
                {analysis.reasoning.split("\n").map((paragraph, i) =>
                  paragraph.trim() ? (
                    <p
                      key={i}
                      className={`text-sm leading-relaxed ${
                        paragraph.startsWith("Overall") ||
                        paragraph.startsWith("Confidence") ||
                        paragraph.startsWith("Risk") ||
                        paragraph.startsWith("Market")
                          ? "font-semibold text-foreground"
                          : "text-slate-300"
                      }`}
                    >
                      {paragraph}
                    </p>
                  ) : null
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <BrainCircuit className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>No analysis available. Click Generate Analysis to create one.</p>
                <p className="text-xs mt-2 opacity-70">
                  Works with or without a local AI model.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rise / Fall Probability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading || generateMutation.isPending ? (
                <Skeleton className="h-32 w-full" />
              ) : analysis ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-green-500">Rise {analysis.riseProbability}%</span>
                      <span className="text-destructive">Fall {analysis.fallProbability}%</span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="bg-green-500 transition-all duration-500"
                        style={{ width: `${analysis.riseProbability}%` }}
                      />
                      <div
                        className="bg-destructive transition-all duration-500"
                        style={{ width: `${analysis.fallProbability}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Model Confidence</span>
                      <span className="font-bold">{analysis.confidence}%</span>
                    </div>
                    <Progress value={analysis.confidence} className="h-2" />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Key Signals & Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || generateMutation.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : analysis ? (
                <div className="flex flex-col gap-2">
                  {analysis.marketCondition && (
                    <Badge
                      variant="outline"
                      className="w-fit text-xs px-2 py-1 uppercase tracking-wider mb-1"
                    >
                      {analysis.marketCondition}
                    </Badge>
                  )}
                  {analysis.signals.slice(0, 5).map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-muted-foreground">{signal}</span>
                    </div>
                  ))}

                  {analysis.warnings && analysis.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {analysis.warnings.map((warning, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-orange-400">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
