import { useAppStore } from "../store";
import {
  useGetPredictions,
  getGetPredictionsQueryKey,
  useGetPredictionAccuracy,
  useUpdatePredictionOutcome,
  useAutoPrediction,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Check, X, Clock, ArrowUpRight, ArrowDownRight, Zap, ShieldAlert, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Predictions() {
  const { selectedSymbol } = useAppStore();
  const queryClient = useQueryClient();

  const [autoResult, setAutoResult] = useState<{ generated: boolean; reason: string; prediction?: any } | null>(null);
  const [autoRefreshOn, setAutoRefreshOn] = useState(false);
  const [lastPredictionTime, setLastPredictionTime] = useState<Record<string, number>>({});
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: predictions, isLoading: isLoadingPredictions, refetch: refetchPredictions } = useGetPredictions(
    { symbol: selectedSymbol, limit: 50 },
    { query: { queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }) } }
  );

  const { data: stats, refetch: refetchStats } = useGetPredictionAccuracy({
    query: { queryKey: ["getPredictionAccuracy"] },
  });

  const updateOutcomeMutation = useUpdatePredictionOutcome();
  const autoPredictionMutation = useAutoPrediction();

  const symbolStats = stats?.find((s) => s.symbol === selectedSymbol);

  // Deduplicate predictions by timestamp and direction
  const uniquePredictions = predictions?.filter((pred, index, self) => 
    index === self.findIndex(p => 
      p.createdAt === pred.createdAt && 
      p.direction === pred.direction &&
      Math.abs(p.entryPrice - pred.entryPrice) < 0.01
    )
  ) || [];

  // Get unique predictions count (for stats)
  const uniqueTotal = uniquePredictions.length;
  const uniqueCorrect = uniquePredictions.filter(p => p.outcome === "correct").length;
  const uniquePending = uniquePredictions.filter(p => !p.outcome).length;
  const uniqueAccuracy = uniqueTotal > 0 ? (uniqueCorrect / uniqueTotal) * 100 : 0;

  const handleUpdateOutcome = useCallback((id: number, outcome: "correct" | "incorrect") => {
    updateOutcomeMutation.mutate(
      { id, data: { outcome, exitPrice: 0 } },
      {
        onSuccess: () => {
          refetchPredictions();
          refetchStats();
          queryClient.invalidateQueries({ queryKey: ["getPredictionAccuracy"] });
        },
      }
    );
  }, [updateOutcomeMutation, refetchPredictions, refetchStats, queryClient]);

  // Auto refresh with deduplication and rate limiting
  useEffect(() => {
    if (autoRefreshOn) {
      refreshIntervalRef.current = setInterval(() => {
        refetchPredictions();
        refetchStats();
      }, 5000);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefreshOn, refetchPredictions, refetchStats]);

  // Auto-hide banner after 6 seconds
  useEffect(() => {
    if (autoResult) {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = setTimeout(() => setAutoResult(null), 6000);
    }
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [autoResult]);

  const handleAutoPrediction = useCallback(() => {
    const now = Date.now();
    const lastTime = lastPredictionTime[selectedSymbol] || 0;
    
    // Rate limit: prevent more than 1 prediction per 30 seconds per symbol
    if (now - lastTime < 30000) {
      setAutoResult({
        generated: false,
        reason: `Please wait ${Math.ceil((30000 - (now - lastTime)) / 1000)} seconds before generating another prediction.`
      });
      return;
    }

    autoPredictionMutation.mutate(
      { data: { symbol: selectedSymbol } },
      {
        onSuccess: (result) => {
          setLastPredictionTime(prev => ({ ...prev, [selectedSymbol]: Date.now() }));
        setAutoResult({ 
  generated: result.generated, 
  reason: result.reason,
  prediction: result.prediction 
});
          setTimeout(() => {
            refetchPredictions();
            refetchStats();
          }, 500);
        },
        onError: (error: any) => {
          setAutoResult({
            generated: false,
            reason: error?.message || "Failed to generate prediction. Please try again."
          });
        }
      }
    );
  }, [autoPredictionMutation, selectedSymbol, lastPredictionTime, refetchPredictions, refetchStats]);

  const renderOutcomeBadge = (outcome?: string | null) => {
    if (outcome === "correct") {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1">
          <Check className="h-3 w-3" /> Correct
        </Badge>
      );
    }
    if (outcome === "incorrect") {
      return (
        <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/50 gap-1">
          <X className="h-3 w-3" /> Incorrect
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 gap-1">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "text-green-500";
    if (confidence >= 50) return "text-yellow-500";
    return "text-orange-500";
  };

  const accuracyPct = symbolStats ? symbolStats.accuracy.toFixed(1) : uniqueAccuracy.toFixed(1);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Predictions & Accuracy
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Performance tracking for <span className="font-mono font-medium">{selectedSymbol}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setAutoRefreshOn(v => !v)}
                  variant={autoRefreshOn ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${autoRefreshOn ? "animate-spin" : ""}`} />
                  {autoRefreshOn ? "Live" : "Auto Refresh"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Auto-refresh predictions every 5 seconds</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleAutoPrediction}
                  disabled={autoPredictionMutation.isPending}
                  className="gap-2 shadow-lg hover:shadow-xl transition-all"
                >
                  <Zap className={`h-4 w-4 ${autoPredictionMutation.isPending ? "animate-pulse" : ""}`} />
                  {autoPredictionMutation.isPending ? "Analyzing Market..." : "Generate Prediction"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI-powered market analysis + prediction</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Auto-prediction Result Banner */}
        {autoResult && (
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              autoResult.generated 
                ? "bg-gradient-to-r from-green-500/15 to-emerald-500/10 border-green-500/30" 
                : "bg-gradient-to-r from-amber-500/15 to-orange-500/10 border-amber-500/30"
            } animate-in slide-in-from-top-2 duration-300`}
          >
            {autoResult.generated ? (
              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-400" />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
            )}
            <div className="flex-1">
              <p className={`font-semibold ${autoResult.generated ? "text-green-400" : "text-amber-400"}`}>
                {autoResult.generated ? "âœ“ Prediction Created" : "â›” No-Trade Signal"}
              </p>
              <p className="text-muted-foreground text-sm mt-0.5">{autoResult.reason}</p>
            </div>
          </div>
        )}

        {/* Stats Cards - Using unique prediction counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <span className="text-sm text-muted-foreground">Total Predictions</span>
                <span className="text-4xl font-bold">{symbolStats?.total || uniqueTotal}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <span className="text-sm text-muted-foreground">Accuracy Rate</span>
                <div className="relative">
                  <span className="text-4xl font-bold text-primary">{accuracyPct}%</span>
                  <div className="absolute -top-1 -right-6">
                    {parseFloat(accuracyPct) >= 60 ? <TrendingUp className="h-4 w-4 text-green-500" /> : 
                     parseFloat(accuracyPct) >= 40 ? <TrendingDown className="h-4 w-4 text-yellow-500" /> :
                     <TrendingDown className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <span className="text-sm text-muted-foreground">Correct Calls</span>
                <span className="text-4xl font-bold text-green-500">{symbolStats?.correct || uniqueCorrect}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <span className="text-sm text-muted-foreground">Pending Calls</span>
                <span className="text-4xl font-bold text-yellow-500">{symbolStats?.pending || uniquePending}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Predictions Table */}
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="flex items-center justify-between">
              <span>Prediction History</span>
              <Badge variant="outline" className="font-mono text-xs">
                {uniquePredictions.length} records
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoadingPredictions ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : uniquePredictions.length > 0 ? (
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/30">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Direction</TableHead>
                      <TableHead className="font-semibold">Entry</TableHead>
                      <TableHead className="font-semibold">Confidence</TableHead>
                      <TableHead className="font-semibold">Market State</TableHead>
                      <TableHead className="font-semibold">Outcome</TableHead>
                      <TableHead className="text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniquePredictions.slice(0, 25).map((pred) => (
                      <TableRow key={pred.id} className="border-border hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(pred.createdAt * 1000), "dd MMM HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div
                            className={`flex items-center gap-1.5 font-semibold ${
                              pred.direction === "rise" ? "text-green-500" : "text-destructive"
                            }`}
                          >
                            {pred.direction === "rise" ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                            <span className="capitalize">{pred.direction}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {pred.entryPrice.toFixed(4)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${getConfidenceColor(pred.confidence).replace("text-", "bg-")}`}
                                style={{ width: `${pred.confidence}%` }}
                              />
                            </div>
                            <span className={`font-mono text-sm font-medium ${getConfidenceColor(pred.confidence)}`}>
                              {pred.confidence.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pred.marketState ? (
                            <Badge variant="secondary" className="text-xs font-normal">
                              {pred.marketState}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">â€”</span>
                          )}
                        </TableCell>
                        <TableCell>{renderOutcomeBadge(pred.outcome)}</TableCell>
                        <TableCell className="text-right">
                          {!pred.outcome && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                onClick={() => handleUpdateOutcome(pred.id, "correct")}
                                disabled={updateOutcomeMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                onClick={() => handleUpdateOutcome(pred.id, "incorrect")}
                                disabled={updateOutcomeMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {pred.outcome && <span className="text-muted-foreground text-xs">â€”</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/30 mb-4">
                  <Clock className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground">No predictions available for {selectedSymbol}</p>
                <Button 
                  variant="link" 
                  onClick={handleAutoPrediction}
                  className="mt-2"
                >
                  Generate first prediction â†’
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}