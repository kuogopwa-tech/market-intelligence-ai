import { useRef } from "react";
import { useAppStore } from "../store";
import { 
  useGetLatestAnalysis, 
  getGetLatestAnalysisQueryKey,
  useGenerateAnalysis,
  useGetAiStatus,
  getGetAiStatusQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BrainCircuit, AlertTriangle, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function Analysis() {
  const { selectedSymbol } = useAppStore();
  const queryClient = useQueryClient();

  const { data: aiStatus } = useGetAiStatus({
    query: { queryKey: getGetAiStatusQueryKey(), refetchInterval: 30000 }
  });

  const { data: analysis, isLoading, isRefetching } = useGetLatestAnalysis(
    { symbol: selectedSymbol },
    {
      query: {
        enabled: !!selectedSymbol && !!aiStatus?.online,
        queryKey: getGetLatestAnalysisQueryKey({ symbol: selectedSymbol }),
      }
    }
  );

  const generateMutation = useGenerateAnalysis();

  const handleGenerate = () => {
    generateMutation.mutate({ data: { symbol: selectedSymbol, forceRefresh: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLatestAnalysisQueryKey({ symbol: selectedSymbol }) });
      }
    });
  };

  if (aiStatus && !aiStatus.online) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">AI Engine Offline</h2>
        <p className="text-muted-foreground max-w-md">
          The AI analysis engine is currently unavailable. Please check your connection or AI provider settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Analysis Panel</h1>
          <p className="text-sm text-muted-foreground">Deep learning insights for {selectedSymbol}</p>
        </div>
        <Button 
          onClick={handleGenerate} 
          disabled={generateMutation.isPending || isRefetching || !aiStatus?.online}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
          {generateMutation.isPending ? 'Generating...' : 'Generate New Analysis'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reasoning Panel */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-blue-500" />
                AI Reasoning
              </CardTitle>
              {analysis?.createdAt && (
                <span className="text-xs text-muted-foreground">
                  Updated: {format(new Date(analysis.createdAt), "HH:mm:ss")}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoading || generateMutation.isPending ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[80%]" />
              </div>
            ) : analysis ? (
              <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300">
                {analysis.reasoning.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No analysis available for this symbol. Click Generate to create one.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Probability & Confidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      <div className="bg-green-500" style={{ width: `${analysis.riseProbability}%` }} />
                      <div className="bg-destructive" style={{ width: `${analysis.fallProbability}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border">
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
              <CardTitle className="text-sm">Key Signals</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || generateMutation.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : analysis ? (
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="w-fit text-xs px-2 py-1 uppercase tracking-wider mb-2">
                    {analysis.marketCondition}
                  </Badge>
                  {analysis.signals.map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-muted-foreground">{signal}</span>
                    </div>
                  ))}
                  
                  {analysis.warnings && analysis.warnings.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      {analysis.warnings.map((warning, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-orange-400">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
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