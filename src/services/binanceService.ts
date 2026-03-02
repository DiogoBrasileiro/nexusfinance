import { Asset, Timeframe, TickerData, CandleData, DataFreshness } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

export async function fetchTicker(asset: Asset): Promise<{ ticker: TickerData, freshness: DataFreshness }> {
  const { forceDataService, dataServiceUrl } = useSettingsStore.getState();
  const startTs = Date.now();

  try {
    if (forceDataService && dataServiceUrl) {
      // Fetch from Data Service
      const res = await fetch(`${dataServiceUrl}/ticker?symbol=${asset}`);
      if (!res.ok) throw new Error('DS Error');
      const data = await res.json();
      
      const endTs = Date.now();
      const latency = endTs - startTs;
      const age = Math.floor((endTs - data.ts) / 1000);
      
      return {
        ticker: data,
        freshness: {
          source: 'Data Service',
          ts_server: data.ts,
          price_ts: data.ts,
          age,
          latency,
          status: age > 30 ? 'STALE' : (data.quality?.partial ? 'PARCIAL' : 'OK')
        }
      };
    } else {
      // Fetch from Binance Direct
      if (forceDataService) {
         throw new Error('Data Service is forced but URL is missing');
      }

      const res = await fetch(`${BINANCE_API_URL}/ticker/24hr?symbol=${asset}`);
      if (!res.ok) throw new Error('Binance Error');
      const data = await res.json();
      
      const endTs = Date.now();
      const latency = endTs - startTs;
      const price_ts = data.closeTime;
      const age = Math.floor((endTs - price_ts) / 1000);

      return {
        ticker: {
          symbol: data.symbol,
          last: parseFloat(data.lastPrice),
          chg24h_pct: parseFloat(data.priceChangePercent),
          vol24h: parseFloat(data.volume),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          ts: price_ts
        },
        freshness: {
          source: 'Binance Direct',
          ts_server: endTs,
          price_ts,
          age,
          latency,
          status: age > 30 ? 'STALE' : 'OK'
        }
      };
    }
  } catch (error) {
    const endTs = Date.now();
    return {
      ticker: { symbol: asset, last: 0, chg24h_pct: 0, vol24h: 0, high24h: 0, low24h: 0, ts: 0 },
      freshness: {
        source: forceDataService ? 'Data Service' : 'Binance Direct',
        ts_server: endTs,
        price_ts: 0,
        age: 999,
        latency: endTs - startTs,
        status: 'OFFLINE'
      }
    };
  }
}

export async function fetchCandles(asset: Asset, timeframe: Timeframe): Promise<CandleData[]> {
  const { forceDataService, dataServiceUrl } = useSettingsStore.getState();
  
  try {
    if (forceDataService && dataServiceUrl) {
      const res = await fetch(`${dataServiceUrl}/candles?symbol=${asset}&interval=${timeframe}&limit=50`);
      if (!res.ok) throw new Error('DS Error');
      return await res.json();
    } else {
      const res = await fetch(`${BINANCE_API_URL}/klines?symbol=${asset}&interval=${timeframe}&limit=50`);
      if (!res.ok) throw new Error('Binance Error');
      const data = await res.json();
      
      return data.map((d: any) => ({
        openTime: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));
    }
  } catch (error) {
    return [];
  }
}
