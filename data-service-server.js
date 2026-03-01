// ================================================================
// NEXUS FINANCE — BTC DATA SERVICE v1.0
// Deploy: Cloud Run | Railway | Render | Fly.io
// ================================================================
'use strict';

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 8080;
const VERSION = '1.0.0';

// ── CORS — permite qualquer origem (ajuste em produção) ──
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET'],
}));
app.use(express.json());

// ================================================================
// CACHE ENGINE — TTL por tipo (spec A2)
// ================================================================
const CACHE = {
  ticker:    { ttl: 5_000,    data: null, ts: 0 },   // 5s  — preço real-time
  candles1m: { ttl: 20_000,   data: null, ts: 0 },   // 20s
  candles15m:{ ttl: 60_000,   data: null, ts: 0 },   // 60s
  candles1h: { ttl: 60_000,   data: null, ts: 0 },   // 60s
  candles4h: { ttl: 60_000,   data: null, ts: 0 },   // 60s
  candles1d: { ttl: 300_000,  data: null, ts: 0 },   // 5min
  macro:     { ttl: 900_000,  data: null, ts: 0 },   // 15min
  dominance: { ttl: 300_000,  data: null, ts: 0 },   // 5min
};

function cacheGet(key) {
  const c = CACHE[key];
  if (!c) return null;
  if (Date.now() - c.ts < c.ttl) return c.data;
  return null;
}

function cacheSet(key, data) {
  const c = CACHE[key];
  if (!c) return;
  c.data = data;
  c.ts   = Date.now();
}

function cacheAge(key) {
  const c = CACHE[key];
  if (!c || !c.ts) return null;
  return Math.round((Date.now() - c.ts) / 1000);
}

// ================================================================
// BINANCE FETCHERS
// ================================================================
const BINANCE = 'https://api.binance.com/api/v3';

async function fetchTicker() {
  const cached = cacheGet('ticker');
  if (cached) return { data: cached, stale: false };
  try {
    const t0 = Date.now();
    const r = await fetch(`${BINANCE}/ticker/24hr?symbol=BTCUSDT`, { timeout: 5000 });
    if (!r.ok) throw new Error('Binance ticker HTTP ' + r.status);
    const d = await r.json();
    const data = {
      symbol:       'BTCUSDT',
      last:         parseFloat(d.lastPrice),
      chg24h_pct:   parseFloat(d.priceChangePercent),
      vol24h:       parseFloat(d.volume),
      high24h:      parseFloat(d.highPrice),
      low24h:       parseFloat(d.lowPrice),
      open24h:      parseFloat(d.openPrice),
      trades24h:    parseInt(d.count),
      bid:          parseFloat(d.bidPrice),
      ask:          parseFloat(d.askPrice),
      source:       'binance_spot',
      latency_ms:   Date.now() - t0,
      fetched_at:   new Date().toISOString(),
    };
    cacheSet('ticker', data);
    return { data, stale: false };
  } catch (e) {
    const stale = cacheGet('ticker');
    if (stale) return { data: stale, stale: true, error: e.message };
    return { data: null, stale: true, error: e.message };
  }
}

async function fetchCandles(tf, limit) {
  limit = Math.min(limit || 50, 200);
  const TF_MAP = { '1m':'1m','15m':'15m','1h':'1h','4h':'4h','1d':'1d' };
  const interval = TF_MAP[tf] || '1h';
  const cacheKey = 'candles' + interval.replace('m','m').replace('h','h').replace('d','d');
  const cached = cacheGet(cacheKey);
  if (cached) return { data: cached, stale: false };
  try {
    const t0 = Date.now();
    const r = await fetch(`${BINANCE}/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`, { timeout: 8000 });
    if (!r.ok) throw new Error('Binance klines HTTP ' + r.status);
    const raw = await r.json();
    const data = raw.map(k => ({
      ts:        k[0],
      open:      parseFloat(k[1]),
      high:      parseFloat(k[2]),
      low:       parseFloat(k[3]),
      close:     parseFloat(k[4]),
      volume:    parseFloat(k[5]),
      close_ts:  k[6],
      quote_vol: parseFloat(k[7]),
      trades:    parseInt(k[8]),
    }));
    cacheSet(cacheKey, data);
    return { data, stale: false, latency_ms: Date.now() - t0 };
  } catch (e) {
    const stale = cacheGet(cacheKey);
    if (stale) return { data: stale, stale: true, error: e.message };
    return { data: [], stale: true, error: e.message };
  }
}

// ================================================================
// MACRO FETCHERS (BCB + CoinGecko)
// ================================================================
async function fetchMacro() {
  const cached = cacheGet('macro');
  if (cached) return { data: cached, stale: false };
  const macro = { source: 'BCB+ExchangeRate', fetched_at: new Date().toISOString() };
  const notes = [];

  // Selic BCB
  try {
    const r = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados/ultimos/1?formato=json', { timeout: 6000 });
    const d = await r.json();
    macro.selic = d && d[0] ? parseFloat(d[0].valor) : null;
  } catch { macro.selic = null; notes.push('selic_stale'); }

  // PTAX BCB
  try {
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
    const r = await fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@c)?@c='${hoje}'&$format=json&$select=cotacaoCompra,cotacaoVenda`, { timeout: 6000 });
    const d = await r.json();
    const row = d.value && d.value[0];
    macro.ptax_compra = row ? row.cotacaoCompra : null;
    macro.ptax_venda  = row ? row.cotacaoVenda  : null;
  } catch { macro.ptax_compra = null; macro.ptax_venda = null; notes.push('ptax_stale'); }

  // USD/BRL ExchangeRate
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 5000 });
    const d = await r.json();
    macro.usdbrl_er = d.rates && d.rates.BRL ? d.rates.BRL : null;
  } catch { macro.usdbrl_er = null; notes.push('fx_stale'); }

  macro._notes = notes;
  cacheSet('macro', macro);
  return { data: macro, stale: false };
}

async function fetchDominance() {
  const cached = cacheGet('dominance');
  if (cached) return { data: cached, stale: false };
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/global', { timeout: 6000 });
    const d = await r.json();
    const dom = d.data?.market_cap_percentage?.btc;
    const data = { btc_dominance: dom ? parseFloat(dom.toFixed(1)) : null, fetched_at: new Date().toISOString() };
    cacheSet('dominance', data);
    return { data, stale: false };
  } catch (e) {
    const stale = cacheGet('dominance');
    return { data: stale || { btc_dominance: null }, stale: true, error: e.message };
  }
}

// ================================================================
// GET /health
// ================================================================
app.get('/health', (req, res) => {
  res.json({
    ok:      true,
    ts:      new Date().toISOString(),
    version: VERSION,
    cache:   {
      ticker:     { age_s: cacheAge('ticker'),     has_data: !!CACHE.ticker.data },
      candles1m:  { age_s: cacheAge('candles1m'),  has_data: !!CACHE.candles1m.data },
      candles1h:  { age_s: cacheAge('candles1h'),  has_data: !!CACHE.candles1h.data },
      candles4h:  { age_s: cacheAge('candles4h'),  has_data: !!CACHE.candles4h.data },
      macro:      { age_s: cacheAge('macro'),      has_data: !!CACHE.macro.data },
    },
    // D: Placeholder para WebSocket futuro
    websocket_ready: false,
    polling_mode:    true,
  });
});

// ================================================================
// GET /snapshot — resposta unificada (spec A1)
// ================================================================
app.get('/snapshot', async (req, res) => {
  const t0 = Date.now();
  const symbols   = (req.query.symbols || 'BTCUSDT').split(',');
  const include   = (req.query.include || 'macro').split(',');
  const tfs       = (req.query.tf      || '1h,4h').split(',');
  const limit     = parseInt(req.query.limit) || 50;

  const notes    = [];
  let   partial  = false;

  // ── Ticker ──
  const tickerRes  = await fetchTicker();
  if (tickerRes.stale) { partial = true; notes.push('ticker_stale: ' + (tickerRes.error || '')); }

  // ── Candles para cada TF solicitado ──
  const ohlcv = {};
  const candlesTs = {};
  for (const tf of tfs) {
    const cr = await fetchCandles(tf, limit);
    ohlcv[tf]     = cr.data || [];
    candlesTs[tf] = cr.stale ? (CACHE['candles' + tf]?.ts ? new Date(CACHE['candles' + tf].ts).toISOString() : null) : new Date().toISOString();
    if (cr.stale) { partial = true; notes.push('candles_' + tf + '_stale'); }
  }

  // ── Macro (se incluído) ──
  let macroData = null;
  if (include.includes('macro')) {
    const mr = await fetchMacro();
    macroData = mr.data;
    if (mr.stale) { partial = true; notes.push('macro_stale'); }
    if (macroData && macroData._notes) notes.push(...macroData._notes);
  }

  // ── Dominância ──
  const domRes = await fetchDominance();
  if (domRes.stale) notes.push('dominance_stale');

  // ── Montar resposta no formato spec A1 ──
  const btc = tickerRes.data;
  const priceTs = btc ? btc.fetched_at : null;

  const response = {
    ts_server: new Date().toISOString(),
    latency_ms: Date.now() - t0,
    source: {
      provider: 'binance',
      market:   'spot',
      symbol:   'BTCUSDT',
      endpoint: `${BINANCE}/ticker/24hr`,
    },
    realtime: {
      price_ts:   priceTs,
      candles_ts: candlesTs,
    },
    prices: {
      BTCUSDT: btc ? {
        last:        btc.last,
        chg24h_pct:  btc.chg24h_pct,
        vol24h:      btc.vol24h,
        high24h:     btc.high24h,
        low24h:      btc.low24h,
        open24h:     btc.open24h,
        bid:         btc.bid,
        ask:         btc.ask,
        trades24h:   btc.trades24h,
        source_ts:   btc.fetched_at,
        latency_ms:  btc.latency_ms,
      } : null,
      BTC_DOM: domRes.data?.btc_dominance != null ? {
        last:    domRes.data.btc_dominance,
        symbol:  'BTC_DOM',
        unit:    '%',
      } : null,
    },
    ohlcv,
    macro: macroData ? {
      selic:       macroData.selic,
      ptax_compra: macroData.ptax_compra,
      ptax_venda:  macroData.ptax_venda,
      usdbrl:      macroData.usdbrl_er,
      fetched_at:  macroData.fetched_at,
    } : null,
    quality: {
      partial,
      notes: notes.filter(Boolean),
      assets_found: btc ? 1 : 0,
      fetched_at: new Date().toLocaleTimeString('pt-BR'),
    },
    // D: WebSocket placeholder
    _ws_placeholder: {
      ready: false,
      note: 'WebSocket mode not yet implemented. Use polling.',
    },
  };

  // Cache-Control: no-store para dados financeiros
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('X-Data-Age-Ms', btc ? String(Date.now() - new Date(btc.fetched_at).getTime()) : 'null');
  res.json(response);
});

// ================================================================
// GET /candles — endpoint dedicado de candles (spec E)
// ================================================================
app.get('/candles', async (req, res) => {
  const tf    = req.query.tf     || '1h';
  const limit = parseInt(req.query.limit) || 50;
  const t0    = Date.now();
  const r     = await fetchCandles(tf, limit);
  res.set('Cache-Control', 'no-store');
  res.json({
    symbol:     'BTCUSDT',
    tf,
    limit,
    count:      r.data.length,
    stale:      r.stale,
    latency_ms: Date.now() - t0,
    candles:    r.data,
    ts_server:  new Date().toISOString(),
  });
});

// ================================================================
// GET /ticker — preço isolado (polling rápido 5s)
// ================================================================
app.get('/ticker', async (req, res) => {
  const t0 = Date.now();
  const r  = await fetchTicker();
  res.set('Cache-Control', 'no-store');
  res.json({
    symbol:     'BTCUSDT',
    stale:      r.stale,
    latency_ms: Date.now() - t0,
    ts_server:  new Date().toISOString(),
    data:       r.data,
  });
});

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================
process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT received, shutting down');  process.exit(0); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus Finance Data Service v${VERSION} listening on :${PORT}`);
  console.log('Endpoints: /health  /snapshot  /candles  /ticker');
});
