import { useAppStore } from "../store";
import {
  useGetMemorySummary,
  getGetMemorySummaryQueryKey,
  useGetMemoryEntries,
  getGetMemoryEntriesQueryKey,
  useGetPatternStats,
  getGetPatternStatsQueryKey,
  useGetMemoryLessons,
  getGetMemoryLessonsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BrainCircuit,
  BookOpen,
  Target,
  CheckCircle2,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";

const LESSON_ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />,
  info: <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />,
};

const LESSON_COLORS = {
  success: "text-green-400",
  warning: "text-orange-400",
  info: "text-blue-400",
};

export default function Memory() {
  const { selectedSymbol } = useAppStore();

  const { data: summary, isLoading: isLoadingSummary } = useGetMemorySummary(
    { symbol: selectedSymbol },
    { query: { queryKey: getGetMemorySummaryQueryKey({ symbol: selectedSymbol }) } }
  );

  const { data: lessons, isLoading: isLoadingLessons } = useGetMemoryLessons(
    { symbol: selectedSymbol },
    { query: { queryKey: getGetMemoryLessonsQueryKey({ symbol: selectedSymbol }) } }
  );

  const { data: patterns, isLoading: isLoadingPatterns } = useGetPatternStats(
    { symbol: selectedSymbol },
    { query: { queryKey: getGetPatternStatsQueryKey({ symbol: selectedSymbol }) } }
  );

  const { data: entries, isLoading: isLoadingEntries } = useGetMemoryEntries(
    { symbol: selectedSymbol, limit: 10 },
    {
      query: {
        queryKey: getGetMemoryEntriesQueryKey({ symbol: selectedSymbol, limit: 10 }),
      },
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Learning Memory</h1>
          <p className="text-sm text-muted-foreground">
            Adaptive pattern recognition and AI lesson system
          </p>
        </div>
        {summary && (
          <div className="text-right">
            <p className="text-2xl font-bold">{summary.totalPatterns}</p>
            <p className="text-xs text-muted-foreground">patterns tracked</p>
          </div>
        )}
      </div>

      {/* Summary row */}
      {isLoadingSummary ? (
        <Skeleton className="h-20 w-full" />
      ) : summary && summary.totalPatterns > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Total Patterns</p>
              <p className="text-2xl font-bold">{summary.totalPatterns}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Avg Accuracy</p>
              <p className="text-2xl font-bold text-primary">{summary.avgAccuracy.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-2">Top Pattern Types</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.topPatterns.slice(0, 4).map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs px-2">
                    {p}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* AI Lessons */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <BookOpen className="h-5 w-5" />
            AI Learned Lessons
          </CardTitle>
          <CardDescription>
            Insights derived from historical prediction outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLessons ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : lessons && lessons.lessons.length > 0 ? (
            <ul className="space-y-3">
              {lessons.lessons.map((lesson, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm">
                  {LESSON_ICONS[lesson.type]}
                  <div>
                    <span className={`font-medium ${LESSON_COLORS[lesson.type]}`}>
                      {lesson.pattern !== "general" ? lesson.pattern + " — " : ""}
                    </span>
                    <span className="text-slate-300">{lesson.lesson}</span>
                    {lesson.successRate > 0 && (
                      <div className="mt-1">
                        <Progress value={lesson.successRate} className="h-1 w-32" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No lessons yet — start tracking predictions to build adaptive memory.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pattern Statistics */}
      {patterns && patterns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Pattern Recognition Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patterns.map((pattern, i) => (
              <Card key={i} className="bg-card/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium">{pattern.pattern}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          pattern.dominantDirection === "rise"
                            ? "text-green-400 border-green-400/30"
                            : "text-red-400 border-red-400/30"
                        }`}
                      >
                        {pattern.dominantDirection === "rise" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {pattern.dominantDirection}
                      </Badge>
                      <span
                        className={`text-sm font-bold ${
                          pattern.successRate >= 60
                            ? "text-green-400"
                            : pattern.successRate <= 40
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {pattern.successRate}%
                      </span>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">{pattern.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="bg-green-500"
                        style={{ width: `${(pattern.wins / pattern.totalTrades) * 100}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${(pattern.losses / pattern.totalTrades) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pattern.wins}W / {pattern.losses}L ({pattern.totalTrades} total)</span>
                      <span>Avg conf: {pattern.avgConfidence.toFixed(0)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Raw Memory Entries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BrainCircuit className="h-5 w-5" />
          Recent Memory Entries
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
                    <CardTitle className="text-sm font-medium">{entry.patternType}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">
                      {format(new Date(entry.createdAt * 1000), "dd MMM yyyy, HH:mm")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={`capitalize text-xs ${
                        entry.outcome === "correct"
                          ? "text-green-400 border-green-400/30"
                          : "text-red-400 border-red-400/30"
                      }`}
                    >
                      {entry.outcome}
                    </Badge>
                    {entry.accuracy != null && (
                      <span className="text-xs text-muted-foreground">
                        {(entry.accuracy as number).toFixed(0)}% acc
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-black/40 rounded p-3 text-xs font-mono text-muted-foreground overflow-x-auto max-h-24">
                    {JSON.stringify(
                      { direction: (entry.patternData as Record<string, unknown>).direction,
                        marketState: (entry.patternData as Record<string, unknown>).marketState,
                        confidence: (entry.patternData as Record<string, unknown>).confidence },
                      null,
                      2
                    )}
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
