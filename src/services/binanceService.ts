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
    // Mock data for GitHub Pages demo if fetch fails (CORS or offline)
    return {
      ticker: {
        symbol: asset,
        last: asset === 'BTCUSDT' ? 65000 + Math.random() * 100 : asset === 'ETHUSDT' ? 3500 + Math.random() * 10 : 150 + Math.random() * 5,
        chg24h_pct: 2.5,
        vol24h: 1000000,
        high24h: asset === 'BTCUSDT' ? 66000 : 3600,
        low24h: asset === 'BTCUSDT' ? 64000 : 3400,
        ts: endTs
      },
      freshness: {
        source: 'Mock (Demo)',
        ts_server: endTs,
        price_ts: endTs,
        age: 0,
        latency: 0,
        status: 'OK'
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
    // Mock candles for demo
    const now = Date.now();
    const candles: CandleData[] = [];
    let price = asset === 'BTCUSDT' ? 65000 : asset === 'ETHUSDT' ? 3500 : 150;
    for (let i = 0; i < 50; i++) {
      const open = price;
      const close = price * (1 + (Math.random() - 0.5) * 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      candles.push({
        openTime: now - (50 - i) * 60000 * (timeframe === '1h' ? 60 : 15),
        open,
        high,
        low,
        close,
        volume: 100 + Math.random() * 100
      });
      price = close;
    }
    return candles;
  }
}
