import { useAppStore } from "../store";
import { 
  useGetMemorySummary, 
  getGetMemorySummaryQueryKey,
  useGetMemoryEntries,
  getGetMemoryEntriesQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit, BookOpen, Target, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function Memory() {
  const { selectedSymbol } = useAppStore();

  const { data: summary, isLoading: isLoadingSummary } = useGetMemorySummary(
    { symbol: selectedSymbol },
    { query: { queryKey: getGetMemorySummaryQueryKey({ symbol: selectedSymbol }) } }
  );

  const { data: entries, isLoading: isLoadingEntries } = useGetMemoryEntries(
    { symbol: selectedSymbol, limit: 10 },
    { query: { queryKey: getGetMemoryEntriesQueryKey({ symbol: selectedSymbol, limit: 10 }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Learning Memory</h1>
          <p className="text-sm text-muted-foreground">AI self-correction and pattern recognition logic</p>
        </div>
      </div>

      {isLoadingSummary ? (
        <Skeleton className="h-48 w-full" />
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <BookOpen className="h-5 w-5" />
                Recent AI Lessons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {summary.recentLessons.map((lesson, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-slate-300">{lesson}</span>
                  </li>
                ))}
                {summary.recentLessons.length === 0 && (
                  <li className="text-muted-foreground italic">No recent lessons recorded.</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Top Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.topPatterns.map((pattern, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1">
                    {pattern}
                  </Badge>
                ))}
                {summary.topPatterns.length === 0 && (
                  <span className="text-sm text-muted-foreground italic">Gathering data...</span>
                )}
              </div>
              <div className="mt-8 pt-4 border-t border-border flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Patterns Tracked</span>
                <span className="font-bold font-mono text-lg">{summary.totalPatterns}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BrainCircuit className="h-5 w-5" />
          Raw Memory Entries
        </h2>
        
        {isLoadingEntries ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map((entry) => (
              <Card key={entry.id} className="bg-card/50">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">{entry.patternType}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">
                      {format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm")}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="capitalize">{entry.outcome}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="bg-black/40 rounded p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(entry.patternData, null, 2)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border border-border border-dashed rounded-lg">
            No detailed memory entries found for this symbol.
          </div>
        )}
      </div>
    </div>
  );
}