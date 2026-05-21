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
import {
  Check,
  X,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

export default function Predictions() {
  const { selectedSymbol } = useAppStore();
  const queryClient = useQueryClient();
  const [autoResult, setAutoResult] = useState<{ generated: boolean; reason: string } | null>(null);

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

  const handleAutoPrediction = () => {
    autoPredictionMutation.mutate(
      { data: { symbol: selectedSymbol } },
      {
        onSuccess: (result) => {
          setAutoResult({ generated: result.generated, reason: result.reason });
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

  const accuracyPct = symbolStats
    ? symbolStats.accuracy.toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Predictions & Accuracy</h1>
          <p className="text-sm text-muted-foreground">
            Performance tracking for {selectedSymbol}
          </p>
        </div>
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

      {/* Auto-prediction result banner */}
      {autoResult && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
            autoResult.generated
              ? "bg-green-500/10 border-green-500/20"
              : "bg-orange-500/10 border-orange-500/20"
          }`}
        >
          {autoResult.generated ? (
            <Check className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`font-medium ${autoResult.generated ? "text-green-400" : "text-orange-400"}`}>
              {autoResult.generated ? "Prediction Generated" : "No-Trade Signal"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">{autoResult.reason}</p>
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
              <span className="text-3xl font-bold text-green-500">
                {symbolStats?.correct || 0}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-1">
              <span className="text-sm text-muted-foreground">Pending Calls</span>
              <span className="text-3xl font-bold text-yellow-500">
                {symbolStats?.pending || 0}
              </span>
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
                      <TableCell className="font-mono text-xs">
                        {pred.entryPrice.toFixed(4)}
                      </TableCell>
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
                              className="h-7 text-xs border-green-500/50 hover:bg-green-500/10 text-green-500"
                              onClick={() => handleUpdateOutcome(pred.id, "correct")}
                            >
                              Win
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-destructive/50 hover:bg-destructive/10 text-destructive"
                              onClick={() => handleUpdateOutcome(pred.id, "incorrect")}
                            >
                              Loss
                            </Button>
                          </div>
                        )}
                        {pred.outcome && pred.resolvedAt && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(pred.resolvedAt * 1000), "HH:mm")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>No predictions recorded yet.</p>
              <p className="text-xs mt-1 opacity-70">
                Click "Auto-Generate Prediction" to let the signal engine create one.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
