import { useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { 
  useGetMarketSummary, 
  getGetMarketSummaryQueryKey,
  useGetCandles,
  getGetCandlesQueryKey,
  useGetRecentTicks,
  getGetRecentTicksQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Zap, Minus, Target } from "lucide-react";
import { createChart, ColorType, CandlestickSeries, IChartApi, ISeriesApi } from "lightweight-charts";
import { AlertCenter } from "@/components/AlertCenter";

export default function Dashboard() {
  const { selectedSymbol, granularity } = useAppStore();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const isTickInterval = granularity.endsWith('t');
  const tickCount = isTickInterval ? parseInt(granularity.replace('t', ''), 10) : 0;
  const numericGranularity = isTickInterval ? 60 : parseInt(granularity, 10);

  const { data: summary, isLoading: isLoadingSummary } = useGetMarketSummary(
    { symbol: selectedSymbol },
    { 
      query: { 
        enabled: !!selectedSymbol, 
        queryKey: getGetMarketSummaryQueryKey({ symbol: selectedSymbol }),
        refetchInterval: 5000 
      } 
    }
  );

  const { data: candles } = useGetCandles(
    { symbol: selectedSymbol, granularity: numericGranularity, count: 100 },
    {
      query: {
        enabled: !!selectedSymbol && !isTickInterval,
        queryKey: getGetCandlesQueryKey({ symbol: selectedSymbol, granularity: numericGranularity, count: 100 }),
        refetchInterval: 60000
      }
    }
  );

  const { data: recentTicks } = useGetRecentTicks(
    { symbol: selectedSymbol, count: 100 },
    {
      query: {
        enabled: !!selectedSymbol && isTickInterval,
        queryKey: getGetRecentTicksQueryKey({ symbol: selectedSymbol, count: 100 }),
        refetchInterval: 2000
      }
    }
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: isTickInterval,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      autoSize: true,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    return () => {
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;

    if (isTickInterval) {
      if (!recentTicks || recentTicks.length === 0) return;
      
      const formattedData = recentTicks.map((t: any) => ({
        time: t.epoch as any,
        open: t.price,
        high: t.price,
        low: t.price,
        close: t.price,
      }));
      seriesRef.current.setData(formattedData);
      chartRef.current?.timeScale().fitContent();
      return;
    }

    const candleRows = Array.isArray(candles)
      ? candles
      : Array.isArray((candles as any)?.data)
        ? (candles as any).data
        : Array.isArray((candles as any)?.candles)
          ? (candles as any).candles
          : [];

    if (candleRows.length === 0) return;

    const formattedData = candleRows.map((c: any) => ({
      time: c.epoch as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(formattedData);
    chartRef.current?.timeScale().fitContent();
  }, [candles, recentTicks, isTickInterval]);

  const renderTrendIcon = (trend?: string) => {
    if (trend === 'bullish') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'bearish') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const getVolatilityColor = (volatility?: string) => {
    switch(volatility) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'extreme': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Market Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time intelligence for {selectedSymbol}</p>
        </div>
      </div>

      {/* Market stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Price</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono">{summary?.currentPrice?.toFixed(4)}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-mono ${(summary?.priceChange || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {(summary?.priceChange || 0) > 0 ? '+' : ''}{summary?.priceChange?.toFixed(4)} ({(summary?.priceChangePct || 0) > 0 ? '+' : ''}{summary?.priceChangePct?.toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trend & Condition</CardTitle>
            {renderTrendIcon(summary?.trend)}
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold capitalize">{summary?.trend}</span>
                </div>
                <Badge variant="outline" className="w-fit capitalize">{summary?.marketCondition}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volatility</CardTitle>
            <Zap className={`h-4 w-4 ${getVolatilityColor(summary?.volatility)}`} />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex flex-col gap-1">
                <span className={`text-lg font-bold capitalize ${getVolatilityColor(summary?.volatility)}`}>{summary?.volatility}</span>
                <span className="text-xs text-muted-foreground font-mono">Val: {summary?.volatilityValue?.toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Key Levels</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex flex-col gap-2 text-sm font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Res:</span>
                  <span className="text-destructive">{summary?.resistanceLevel ? summary.resistanceLevel.toFixed(4) : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sup:</span>
                  <span className="text-green-500">{summary?.supportLevel ? summary.supportLevel.toFixed(4) : 'N/A'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spike / reversal banners */}
      {(summary?.spikeDetected || summary?.reversalWarning) && (
        <div className="flex gap-4 flex-wrap">
          {summary?.spikeDetected && (
            <div className="flex-1 min-w-[260px] bg-destructive/20 border border-destructive/50 px-4 py-3 rounded-lg flex items-center gap-3">
              <Zap className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <span className="font-bold text-sm text-destructive block">Spike Detected</span>
                <span className="text-xs opacity-90">Unusual price action registered in the recent ticks.</span>
              </div>
            </div>
          )}
          {summary?.reversalWarning && (
            <div className="flex-1 min-w-[260px] bg-orange-500/20 border border-orange-500/50 text-orange-200 px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <span className="font-bold text-sm text-orange-500 block">Reversal Warning</span>
                <span className="text-xs opacity-90">Momentum slowing near key levels. Prepare for possible reversal.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Intelligence Alert Center ─────────────────────── */}
      <AlertCenter />

      {/* Price chart */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle>Price Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={chartContainerRef} className="w-full h-[500px]" />
        </CardContent>
      </Card>
    </div>
  );
}
