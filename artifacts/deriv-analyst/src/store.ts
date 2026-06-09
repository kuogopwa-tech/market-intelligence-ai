import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertLevel = 'bullish' | 'bearish' | 'reversal' | 'spike' | 'noTrade' | 'info';

export interface AlertFeedEntry {
  id: string;
  timestamp: number;
  alertType: string;
  level: AlertLevel;
  symbol: string;
  confidence: number;
  cleanSignalScore: number;
  marketState: string;
  riskLevel: string;
  topSignal: string;
  setupRarity: string;
  expiresAt: number;
}

interface AppState {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  granularity: string;
  setGranularity: (granularity: string) => void;
  chartType: string;
  setChartType: (chartType: string) => void;
  timeframe: string;
  setTimeframe: (timeframe: string) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  alertFeed: AlertFeedEntry[];
  addAlert: (entry: AlertFeedEntry) => void;
  clearAlerts: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedSymbol: "R_100",
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      granularity: "60",
      setGranularity: (granularity) => set({ granularity }),
      chartType: "candlestick",
      setChartType: (chartType) => set({ chartType }),
      timeframe: "1h",
      setTimeframe: (timeframe) => set({ timeframe }),
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      alertFeed: [],
      addAlert: (entry) =>
        set((state) => ({
          alertFeed: [entry, ...state.alertFeed].slice(0, 20),
        })),
      clearAlerts: () => set({ alertFeed: [] }),
    }),
    {
      name: 'deriv-analyst-preferences',
      partialize: (state) => ({
        selectedSymbol: state.selectedSymbol,
        granularity: state.granularity,
        chartType: state.chartType,
        timeframe: state.timeframe,
        theme: state.theme,
      }),
    }
  )
);
