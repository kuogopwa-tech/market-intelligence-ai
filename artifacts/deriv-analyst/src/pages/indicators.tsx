import { useAppStore } from "../store";
import { 
  useGetSymbolIndicators, 
  getGetSymbolIndicatorsQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function Indicators() {
  const { selectedSymbol, granularity } = useAppStore();

  const isTickInterval = granularity.endsWith('t');
  const numericGranularity = isTickInterval ? 60 : parseInt(granularity, 10);

  const { data: indicators, isLoading } = useGetSymbolIndicators(
    { symbol: selectedSymbol, granularity: numericGranularity },
    {
      query: {
        enabled: !!selectedSymbol,
        queryKey: getGetSymbolIndicatorsQueryKey({ symbol: selectedSymbol, granularity: numericGranularity }),
        refetchInterval: 5000
      }
    }
  );

  const renderRsiGauge = (rsi?: number | null) => {
    if (rsi === null || rsi === undefined) return <Skeleton className="h-4 w-full" />;
    
    let colorClass = "bg-primary";
    if (rsi > 70) colorClass = "bg-destructive";
    if (rsi < 30) colorClass = "bg-green-500";

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>0</span>
          <span className="text-green-500">30</span>
          <span>50</span>
          <span className="text-destructive">70</span>
          <span>100</span>
        </div>
        <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
          <div 
            className={`absolute top-0 bottom-0 left-0 ${colorClass} transition-all duration-500`} 
            style={{ width: `${rsi}%` }} 
          />
          {/* Overbought line */}
          <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-background z-10" />
          {/* Oversold line */}
          <div className="absolute top-0 bottom-0 left-[30%] w-0.5 bg-background z-10" />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Current: {rsi.toFixed(2)}</span>
          <span className="text-xs font-bold uppercase">
            {rsi > 70 ? <span className="text-destructive">Overbought</span> : rsi < 30 ? <span className="text-green-500">Oversold</span> : <span className="text-muted-foreground">Neutral</span>}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Technical Indicators</h1>
          <p className="text-sm text-muted-foreground">Real-time indicator values for {selectedSymbol}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RSI */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Relative Strength Index (RSI)</CardTitle>
          </CardHeader>
          <CardContent>
            {renderRsiGauge(indicators?.rsi)}
          </CardContent>
        </Card>

        {/* MACD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MACD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-full"/></div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">MACD Line</span>
                  <span className={indicators?.macdLine && indicators.macdLine > 0 ? "text-green-500" : "text-destructive"}>
                    {indicators?.macdLine?.toFixed(4) || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Signal Line</span>
                  <span className="text-blue-500">{indicators?.macdSignal?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-muted-foreground">Histogram</span>
                  <span className={indicators?.macdHistogram && indicators.macdHistogram > 0 ? "text-green-500" : "text-destructive"}>
                    {indicators?.macdHistogram?.toFixed(4) || "N/A"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* EMAs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Moving Averages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
             {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-full"/></div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">EMA 9</span>
                  <span>{indicators?.ema9?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">EMA 21</span>
                  <span>{indicators?.ema21?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">EMA 50</span>
                  <span>{indicators?.ema50?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SMA 20</span>
                  <span>{indicators?.sma20?.toFixed(4) || "N/A"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bollinger Bands & Others */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Volatility & Momentum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-full"/></div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">BB Upper</span>
                  <span className="text-green-500">{indicators?.bollingerUpper?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">BB Lower</span>
                  <span className="text-destructive">{indicators?.bollingerLower?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="text-muted-foreground">ATR</span>
                  <span>{indicators?.atr?.toFixed(4) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stochastic K/D</span>
                  <span>{indicators?.stochasticK?.toFixed(2) || "-"} / {indicators?.stochasticD?.toFixed(2) || "-"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}