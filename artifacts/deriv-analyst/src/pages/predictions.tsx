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
import { Check, X, Clock, ArrowUpRight, ArrowDownRight, Zap, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

export default function Predictions() {
  const { selectedSymbol } = useAppStore();
  const queryClient = useQueryClient();

  const [autoResult, setAutoResult] = useState<{ generated: boolean; reason: string } | null>(null);
  const [buttonNudge, setButtonNudge] = useState(false);
  const [autoRefreshOn, setAutoRefreshOn] = useState(false);
  const [bannerShift, setBannerShift] = useState(false);

  const { data: predictions, isLoading: isLoadingPredictions } = useGetPredictions(
    { symbol: selectedSymbol, limit: 50 },
    { query: { queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }) } }
  );

  const { data: stats } = useGetPredictionAccuracy({
    query: { queryKey: ["getPredictionAccuracy"] },
  });

  const updateOutcomeMutation = useUpdatePredictionOutcome();
  const autoPredictionMutation = useAutoPrediction();

  const symbolStats = stats?.find((s) => s.symbol === selectedSymbol);

  const handleUpdateOutcome = (id: number, outcome: "correct" | "incorrect") => {
    updateOutcomeMutation.mutate(
      { id, data: { outcome, exitPrice: 0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }),
          });
          queryClient.invalidateQueries({ queryKey: ["getPredictionAccuracy"] });
        },
      }
    );
  };

  // Auto refresh: keep prediction history + accuracy updated in real time.
  useEffect(() => {
    if (!autoRefreshOn) return;

    const interval = window.setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }),
      });
      queryClient.invalidateQueries({ queryKey: ["getPredictionAccuracy"] });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [autoRefreshOn, queryClient, selectedSymbol]);

  useEffect(() => {
    if (!autoResult) {
      setBannerShift(false);
      return;
    }
    // Show first, then slide left to create space for the header buttons.
    setBannerShift(true);
    const t = window.setTimeout(() => setBannerShift(false), 3500);
    return () => window.clearTimeout(t);
  }, [autoResult]);

  const handleAutoPrediction = () => {
    autoPredictionMutation.mutate(
      { data: { symbol: selectedSymbol } },
      {
        onSuccess: (result) => {
          setAutoResult({ generated: result.generated, reason: result.reason });
          setButtonNudge(true);
          // Bounce down to ensure any toast/popup doesn't intercept clicks; then restore.
          window.setTimeout(() => setButtonNudge(false), 2500);
          queryClient.invalidateQueries({
            queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }),
          });
          queryClient.invalidateQueries({ queryKey: ["getPredictionAccuracy"] });
          setTimeout(() => setAutoResult(null), 8000);
        },
      }
    );
  };

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
        <Badge
          variant="destructive"
          className="bg-destructive/20 text-destructive border-destructive/50 gap-1"
        >
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

  const accuracyPct = symbolStats ? symbolStats.accuracy.toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Predictions & Accuracy</h1>
          <p className="text-sm text-muted-foreground">Performance tracking for {selectedSymbol}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setAutoRefreshOn((v) => !v)}
            variant={autoRefreshOn ? "default" : "outline"}
            disabled={autoPredictionMutation.isPending}
            className="gap-2"
          >
            <Clock className={`h-4 w-4 ${autoRefreshOn ? "animate-pulse" : ""}`} />
            {autoRefreshOn ? "Auto Refresh: ON" : "Auto Refresh"}
          </Button>

          <div
            className={`transition-transform duration-500 ease-out ${
              buttonNudge ? "translate-y-4 animate-bounce" : "translate-y-0"
            }`}
          >
            <Button
              onClick={handleAutoPrediction}
              disabled={autoPredictionMutation.isPending}
              className="gap-2"
              variant="default"
            >
              <Zap className={`h-4 w-4 ${autoPredictionMutation.isPending ? "animate-pulse" : ""}`} />
              {autoPredictionMutation.isPending ? "Analyzing..." : "Auto-Generate Prediction"}
            </Button>
          </div>
        </div>
      </div>

      {/* Auto-prediction result banner */}
      {autoResult && (
        <div
          className={`flex items-start gap-2 p-2 rounded-lg border text-xs transition-transform duration-500 ease-out ${
            autoResult.generated ? "bg-green-500/10 border-green-500/20" : "bg-orange-500/10 border-orange-500/20"
          } ${bannerShift ? "-translate-x-32" : "translate-x-0"}`}
        >
          {autoResult.generated ? (
            <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`font-medium ${
                autoResult.generated ? "text-green-400" : "text-orange-400"
              }`}
            >
              {autoResult.generated ? "Prediction Generated" : "No-Trade Signal"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">{autoResult.reason}</p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-1">
              <span className="text-sm text-muted-foreground">Total Predictions</span>
              <span className="text-3xl font-bold">{symbolStats?.total || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-1">
              <span className="text-sm text-muted-foreground">Accuracy Rate</span>
              <span className="text-3xl font-bold text-primary">{accuracyPct}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-1">
              <span className="text-sm text-muted-foreground">Correct Calls</span>
              <span className="text-3xl font-bold text-green-500">{symbolStats?.correct || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-1">
              <span className="text-sm text-muted-foreground">Pending Calls</span>
              <span className="text-3xl font-bold text-yellow-500">{symbolStats?.pending || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prediction History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPredictions ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : predictions && predictions.length > 0 ? (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Market State</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((pred) => (
                    <TableRow key={pred.id} className="border-border">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(pred.createdAt * 1000), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div
                          className={`flex items-center gap-1 font-medium ${
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
                      <TableCell className="font-mono text-xs">{pred.entryPrice.toFixed(4)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{pred.confidence.toFixed(0)}%</span>
                      </TableCell>
                      <TableCell>
                        {pred.marketState ? (
                          <Badge variant="outline" className="text-xs">
                            {pred.marketState}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>{renderOutcomeBadge(pred.outcome)}</TableCell>
                      <TableCell className="text-right">
                        {!pred.outcome && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500/40 text-green-400 hover:bg-green-500/10"
                              onClick={() => handleUpdateOutcome(pred.id, "correct")}
                              disabled={updateOutcomeMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => handleUpdateOutcome(pred.id, "incorrect")}
                              disabled={updateOutcomeMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {pred.outcome && <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No predictions available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
