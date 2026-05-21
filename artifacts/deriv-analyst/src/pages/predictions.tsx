import { useAppStore } from "../store";
import { 
  useGetPredictions, 
  getGetPredictionsQueryKey,
  useGetPredictionAccuracy,
  useUpdatePredictionOutcome
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Check, X, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function Predictions() {
  const { selectedSymbol } = useAppStore();
  const queryClient = useQueryClient();

  const { data: predictions, isLoading: isLoadingPredictions } = useGetPredictions(
    { symbol: selectedSymbol, limit: 50 },
    { query: { queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }) } }
  );

  const { data: stats, isLoading: isLoadingStats } = useGetPredictionAccuracy(
    undefined,
    { query: { queryKey: ['getPredictionAccuracy'] } }
  );

  const updateOutcomeMutation = useUpdatePredictionOutcome();

  const symbolStats = stats?.find(s => s.symbol === selectedSymbol);

  const handleUpdateOutcome = (id: number, outcome: 'correct' | 'incorrect') => {
    updateOutcomeMutation.mutate({ id, data: { outcome, exitPrice: 0 } }, { // Sending 0 as dummy exit price if not tracked
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPredictionsQueryKey({ symbol: selectedSymbol, limit: 50 }) });
        queryClient.invalidateQueries({ queryKey: ['getPredictionAccuracy'] });
      }
    });
  };

  const renderOutcomeBadge = (outcome?: string | null) => {
    if (outcome === 'correct') {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1"><Check className="h-3 w-3"/> Correct</Badge>;
    }
    if (outcome === 'incorrect') {
      return <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/50 gap-1"><X className="h-3 w-3"/> Incorrect</Badge>;
    }
    return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 gap-1"><Clock className="h-3 w-3"/> Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Predictions & Accuracy</h1>
          <p className="text-sm text-muted-foreground">Historical performance and pending calls for {selectedSymbol}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <span className="text-3xl font-bold text-primary">
                {symbolStats ? (symbolStats.accuracy * 100).toFixed(1) : "0.0"}%
              </span>
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
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((pred) => (
                    <TableRow key={pred.id} className="border-border">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(pred.createdAt), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 font-medium ${pred.direction === 'rise' ? 'text-green-500' : 'text-destructive'}`}>
                          {pred.direction === 'rise' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          <span className="capitalize">{pred.direction}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{pred.entryPrice.toFixed(4)}</TableCell>
                      <TableCell>{pred.confidence}%</TableCell>
                      <TableCell>{renderOutcomeBadge(pred.outcome)}</TableCell>
                      <TableCell className="text-right">
                        {!pred.outcome && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/50 hover:bg-green-500/10 text-green-500" onClick={() => handleUpdateOutcome(pred.id, 'correct')}>Win</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/50 hover:bg-destructive/10 text-destructive" onClick={() => handleUpdateOutcome(pred.id, 'incorrect')}>Loss</Button>
                          </div>
                        )}
                        {pred.outcome && pred.resolvedAt && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(pred.resolvedAt), "HH:mm")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No predictions recorded for this symbol yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}