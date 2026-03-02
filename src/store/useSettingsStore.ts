import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Asset, Timeframe } from '../types';

interface SettingsState {
  targetPct: number;
  stopPct: number;
  capital: number | null;
  riskProfile: 'conservador' | 'moderado' | 'agressivo';
  timeframes: Timeframe[];
  forceDataService: boolean;
  dataServiceUrl: string;
  autoRefresh: boolean;
  pipelineMode: 'rapido' | 'completo';
  
  setTargetPct: (val: number) => void;
  setStopPct: (val: number) => void;
  setCapital: (val: number | null) => void;
  setRiskProfile: (val: 'conservador' | 'moderado' | 'agressivo') => void;
  toggleTimeframe: (tf: Timeframe) => void;
  setForceDataService: (val: boolean) => void;
  setDataServiceUrl: (url: string) => void;
  setAutoRefresh: (val: boolean) => void;
  setPipelineMode: (val: 'rapido' | 'completo') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      targetPct: 5.0,
      stopPct: 2.0,
      capital: null,
      riskProfile: 'moderado',
      timeframes: ['1h', '4h'],
      forceDataService: false,
      dataServiceUrl: '',
      autoRefresh: true,
      pipelineMode: 'rapido',

      setTargetPct: (val) => set({ targetPct: val }),
      setStopPct: (val) => set({ stopPct: val }),
      setCapital: (val) => set({ capital: val }),
      setRiskProfile: (val) => set({ riskProfile: val }),
      toggleTimeframe: (tf) => set((state) => ({
        timeframes: state.timeframes.includes(tf)
          ? state.timeframes.filter((t) => t !== tf)
          : [...state.timeframes, tf]
      })),
      setForceDataService: (val) => set({ forceDataService: val }),
      setDataServiceUrl: (val) => set({ dataServiceUrl: val }),
      setAutoRefresh: (val) => set({ autoRefresh: val }),
      setPipelineMode: (val) => set({ pipelineMode: val }),
    }),
    { name: 'nexus-crypto-settings' }
  )
);
