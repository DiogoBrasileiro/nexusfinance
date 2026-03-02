import { create } from 'zustand';
import { Asset, Timeframe, TickerData, CandleData, DataFreshness } from '../types';
import { fetchTicker, fetchCandles } from '../services/binanceService';
import { useLogStore } from './useLogStore';
import { useSettingsStore } from './useSettingsStore';

interface DataState {
  tickers: Record<Asset, TickerData | null>;
  freshness: Record<Asset, DataFreshness | null>;
  candles: Record<Asset, Record<Timeframe, CandleData[]>>;
  
  refreshTicker: (asset: Asset) => Promise<void>;
  refreshCandles: (asset: Asset, timeframe: Timeframe) => Promise<void>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

let tickerInterval: number | null = null;
let candleInterval: number | null = null;

export const useDataStore = create<DataState>((set, get) => ({
  tickers: { BTCUSDT: null, ETHUSDT: null, SOLUSDT: null },
  freshness: { BTCUSDT: null, ETHUSDT: null, SOLUSDT: null },
  candles: {
    BTCUSDT: { '15m': [], '1h': [], '4h': [], '1d': [] },
    ETHUSDT: { '15m': [], '1h': [], '4h': [], '1d': [] },
    SOLUSDT: { '15m': [], '1h': [], '4h': [], '1d': [] },
  },

  refreshTicker: async (asset) => {
    const { ticker, freshness } = await fetchTicker(asset);
    set((state) => ({
      tickers: { ...state.tickers, [asset]: ticker },
      freshness: { ...state.freshness, [asset]: freshness }
    }));
    
    useLogStore.getState().addLog(
      'REFRESH', 
      `Ticker ${asset} atualizado`, 
      { latency: freshness.latency, age: freshness.age, status: freshness.status }
    );
  },

  refreshCandles: async (asset, timeframe) => {
    const data = await fetchCandles(asset, timeframe);
    set((state) => ({
      candles: {
        ...state.candles,
        [asset]: {
          ...state.candles[asset],
          [timeframe]: data
        }
      }
    }));
  },

  startAutoRefresh: () => {
    const { refreshTicker, refreshCandles } = get();
    const assets: Asset[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const timeframes: Timeframe[] = ['15m', '1h', '4h', '1d'];

    // Initial fetch
    assets.forEach(a => {
      refreshTicker(a);
      timeframes.forEach(tf => refreshCandles(a, tf));
    });

    // Ticker loop (10s)
    if (!tickerInterval) {
      tickerInterval = window.setInterval(() => {
        if (useSettingsStore.getState().autoRefresh) {
          assets.forEach(a => refreshTicker(a));
        }
      }, 10000);
    }

    // Candle loop (60s)
    if (!candleInterval) {
      candleInterval = window.setInterval(() => {
        if (useSettingsStore.getState().autoRefresh) {
          assets.forEach(a => {
            timeframes.forEach(tf => refreshCandles(a, tf));
          });
        }
      }, 60000);
    }
  },

  stopAutoRefresh: () => {
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }
    if (candleInterval) {
      clearInterval(candleInterval);
      candleInterval = null;
    }
  }
}));
