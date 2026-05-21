import { create } from 'zustand';

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
  granularity: number;
  setGranularity: (granularity: number) => void;
  alertFeed: AlertFeedEntry[];
  addAlert: (entry: AlertFeedEntry) => void;
  clearAlerts: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSymbol: "R_100",
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  granularity: 60,
  setGranularity: (granularity) => set({ granularity }),
  alertFeed: [],
  addAlert: (entry) =>
    set((state) => ({
      alertFeed: [entry, ...state.alertFeed].slice(0, 20),
    })),
  clearAlerts: () => set({ alertFeed: [] }),
}));
