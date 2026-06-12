import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
}

// Map internal symbols to TradingView-compatible symbols
const symbolMap: Record<string, string> = {
  "R_100": "OTC:R_100",
  "R_50": "OTC:R_50",
  "R_25": "OTC:R_25",
  "R_10": "OTC:R_10",
  "R_75": "OTC:R_75",
  "BTC-100": "BTCUSD",
  "BTC-75": "BTCUSD",
  "BTC-50": "BTCUSD",
  "ETH-100": "ETHUSD",
  "ETH-50": "ETHUSD",
};

// Default fallback for unknown symbols
const getTradingViewSymbol = (sym: string): string => {
  return symbolMap[sym] || `OTC:${sym}`;
};

export default function TradingViewChart({ symbol }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tradingViewSymbol = getTradingViewSymbol(symbol);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    // Create the TradingView widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";

    widgetContainer.appendChild(widgetDiv);
    containerRef.current.appendChild(widgetContainer);

    // Load the TradingView script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tradingViewSymbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(15, 23, 42, 1)",
      gridColor: "rgba(51, 65, 85, 0.5)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    widgetContainer.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, tradingViewSymbol]);

  return (
    <div className="w-full" style={{ height: "500px" }}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
