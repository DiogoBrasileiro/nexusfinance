import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BinanceState {
  accountId: string | null;
  isConnected: boolean;
  setConnection: (accountId: string) => void;
  disconnect: () => void;
}

export const useBinanceStore = create<BinanceState>()(
  persist(
    (set) => ({
      accountId: null,
      isConnected: false,
      setConnection: (accountId) => set({ accountId, isConnected: true }),
      disconnect: () => set({ accountId: null, isConnected: false }),
    }),
    { name: 'nexus-binance-connection' }
  )
);
