import { create } from 'zustand';

interface AppState {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  granularity: number;
  setGranularity: (granularity: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSymbol: "R_100",
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  granularity: 60,
  setGranularity: (granularity) => set({ granularity }),
}));
