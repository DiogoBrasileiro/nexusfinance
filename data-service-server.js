// ================================================================
// NEXUS FINANCE — DATA SERVICE v2.0
// Inclui: BTC real-time + Binance Account (Spot + Futures)
// Deploy: Cloud Run | Railway | Render
// ================================================================
'use strict';

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const bnAcc   = require('./binance-account');

const app  = express();
const PORT = process.env.PORT || 8080;
const VERSION = '2.0.0';

// ── CORS ──
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET','POST','DELETE'],
}));
app.use(express.json());

// ================================================================
// CACHE ENGINE (mantido do v1)
// ================================================================
const CACHE = {
  ticker:    { ttl: 5_000,   data: null, ts: 0 },
  candles1m: { ttl: 20_000,  data: null, ts: 0 },
  candles15m:{ ttl: 60_000,  data: null, ts: 0 },
  candles1h: { ttl: 60_000,  data: null, ts: 0 },
  candles4h: { ttl: 60_000,  data: null, ts: 0 },
  candles1d: { ttl: 300_000, data: null, ts: 0 },
  macro:     { ttl: 900_000, data: null, ts: 0 },
  dominance: { ttl: 300_000, data: null, ts: 0 },
  // Account caches — TTL curto para refletir trades
  spot_balances:    { ttl: 8_000,  data: null, ts: 0 },
  spot_open_orders: { ttl: 5_000,  data: null, ts: 0 },
  fut_balances:     { ttl: 8_000,  data: null, ts: 0 },
  fut_positions:    { ttl: 5_000,  data: null, ts: 0 },
  fut_open_orders:  { ttl: 5_000,  data: null, ts: 0 },
};

function cacheGet(key) {
  const c = CACHE[key];
  if (!c || !c.data) return null;
  return Date.now() - c.ts < c.ttl ? c.data : null;
}
function cacheSet(key, data) {
  const c = CACHE[key];
  if (!c) return;
  c.data = data; c.ts = Date.now();
}
function cacheAge(key) {
  const c = CACHE[key];
  if (!c || !c.ts) return null;
  return Math.round((Date.now() - c.ts) / 1000);
}
function cacheInvalidate(...keys) {
  keys.forEach(k => { if (CACHE[k]) { CACHE[k].data = null; CACHE[k].ts = 0; } });
}

// ================================================================
// MIDDLEWARE: extrair API Keys do header
// ================================================================
function getKeys(req) {
  const apiKey = req.headers['x-binance-apikey'] || '';
  const secret = req.headers['x-binance-secret'] || '';
  return { apiKey, secret };
}

function requireKeys(req, res, next) {
  const { apiKey, secret } = getKeys(req);
  if (!apiKey || !secret) {
    return res.status(401).json({ error: 'Chaves Binance não fornecidas. Envie X-Binance-ApiKey e X-Binance-Secret.' });
  }
  req.bnApiKey = apiKey;
  req.bnSecret = secret;
  next();
}

// ── Rate limit simples por IP ──
const RL = {};
function rateLimit(req, res, next) {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  if (!RL[ip]) RL[ip] = { count: 0, reset: now + 60_000 };
  if (now > RL[ip].reset) { RL[ip].count = 0; RL[ip].reset = now + 60_000; }
  RL[ip].count++;
  if (RL[ip].count > 120) {
    return res.status(429).json({ error: 'Rate limit excedido. Máximo 120 req/min.' });
  }
  next();
}
app.use(rateLimit);

// ================================================================
// PUBLIC MARKET DATA (mantido do v1)
// ================================================================
const BINANCE = 'https://api.binance.com/api/v3';
const FUT_BASE = 'https://fapi.binance.com';

async function fetchTicker() {
  const cached = cacheGet('ticker');
  if (cached) return { data: cached, stale: false };
  try {
    const t0 = Date.now();
    const r = await fetch(`${BINANCE}/ticker/24hr?symbol=BTCUSDT`, { timeout: 5000 });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const data = {
      symbol: 'BTCUSDT', last: parseFloat(d.lastPrice),
      chg24h_pct: parseFloat(d.priceChangePercent), vol24h: parseFloat(d.volume),
      high24h: parseFloat(d.highPrice), low24h: parseFloat(d.lowPrice),
      open24h: parseFloat(d.openPrice), trades24h: parseInt(d.count),
      bid: parseFloat(d.bidPrice), ask: parseFloat(d.askPrice),
      source: 'binance_spot', latency_ms: Date.now() - t0, fetched_at: new Date().toISOString(),
    };
    cacheSet('ticker', data);
    return { data, stale: false };
  } catch(e) {
    const stale = cacheGet('ticker') || CACHE.ticker.data;
    return { data: stale, stale: true, error: e.message };
  }
}

async function fetchCandles(tf, limit) {
  limit = Math.min(limit || 50, 200);
  const TF_MAP = {'1m':'1m','15m':'15m','1h':'1h','4h':'4h','1d':'1d'};
  const interval = TF_MAP[tf] || '1h';
  const key = 'candles' + interval;
  const cached = cacheGet(key);
  if (cached) return { data: cached, stale: false };
  try {
    const t0 = Date.now();
    const r = await fetch(`${BINANCE}/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`, { timeout: 8000 });
    const raw = await r.json();
    const data = raw.map(k => ({
      ts: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
      close_ts: k[6], trades: parseInt(k[8]),
    }));
    cacheSet(key, data);
    return { data, stale: false, latency_ms: Date.now() - t0 };
  } catch(e) {
    const stale = CACHE[key].data;
    return { data: stale || [], stale: true, error: e.message };
  }
}

async function fetchMacro() {
  const cached = cacheGet('macro');
  if (cached) return { data: cached, stale: false };
  const macro = { fetched_at: new Date().toISOString() };
  const notes = [];
  try {
    const r = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados/ultimos/1?formato=json', { timeout: 6000 });
    const d = await r.json();
    macro.selic = d && d[0] ? parseFloat(d[0].valor) : null;
  } catch { macro.selic = null; notes.push('selic_stale'); }
  try {
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
    const r = await fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@c)?@c='${hoje}'&$format=json&$select=cotacaoCompra,cotacaoVenda`, { timeout: 6000 });
    const d = await r.json();
    const row = d.value && d.value[0];
    macro.ptax_compra = row ? row.cotacaoCompra : null;
    macro.ptax_venda  = row ? row.cotacaoVenda  : null;
  } catch { macro.ptax_compra = null; macro.ptax_venda = null; notes.push('ptax_stale'); }
  macro._notes = notes;
  cacheSet('macro', macro);
  return { data: macro, stale: false };
}

// ================================================================
// GET /health
// ================================================================
app.get('/health', (req, res) => {
  res.json({
    ok: true, ts: new Date().toISOString(), version: VERSION,
    features: { market_data: true, spot_account: true, futures_account: true, websocket: false },
    cache: {
      ticker:     { age_s: cacheAge('ticker'),     has_data: !!CACHE.ticker.data },
      candles1h:  { age_s: cacheAge('candles1h'),  has_data: !!CACHE.candles1h.data },
      spot_bal:   { age_s: cacheAge('spot_balances'), has_data: !!CACHE.spot_balances.data },
      fut_pos:    { age_s: cacheAge('fut_positions'), has_data: !!CACHE.fut_positions.data },
    },
  });
});

// ================================================================
// GET /snapshot (mantido do v1)
// ================================================================
app.get('/snapshot', async (req, res) => {
  const t0 = Date.now();
  const tfs   = (req.query.tf || '1h,4h').split(',');
  const incl  = (req.query.include || 'macro').split(',');
  const limit = parseInt(req.query.limit) || 50;
  const notes = []; let partial = false;
  const tickerRes = await fetchTicker();
  if (tickerRes.stale) { partial = true; notes.push('ticker_stale'); }
  const ohlcv = {}; const candlesTs = {};
  for (const tf of tfs) {
    const cr = await fetchCandles(tf, limit);
    ohlcv[tf] = cr.data || [];
    candlesTs[tf] = new Date().toISOString();
    if (cr.stale) { partial = true; notes.push('candles_' + tf + '_stale'); }
  }
  let macroData = null;
  if (incl.includes('macro')) {
    const mr = await fetchMacro();
    macroData = mr.data;
    if (mr.stale) { partial = true; notes.push('macro_stale'); }
    if (macroData && macroData._notes) notes.push(...macroData._notes);
  }
  const btc = tickerRes.data;
  res.set('Cache-Control', 'no-store');
  res.json({
    ts_server: new Date().toISOString(), latency_ms: Date.now() - t0,
    source: { provider: 'binance', market: 'spot', symbol: 'BTCUSDT' },
    realtime: { price_ts: btc ? btc.fetched_at : null, candles_ts: candlesTs },
    prices: { BTCUSDT: btc ? { last: btc.last, chg24h_pct: btc.chg24h_pct, vol24h: btc.vol24h,
      high24h: btc.high24h, low24h: btc.low24h, bid: btc.bid, ask: btc.ask, source_ts: btc.fetched_at } : null },
    ohlcv, macro: macroData ? { selic: macroData.selic, ptax_compra: macroData.ptax_compra, ptax_venda: macroData.ptax_venda } : null,
    quality: { partial, notes, fetched_at: new Date().toLocaleTimeString('pt-BR') },
  });
});

app.get('/ticker', async (req, res) => {
  const t0 = Date.now(); const r = await fetchTicker();
  res.set('Cache-Control', 'no-store');
  res.json({ symbol: 'BTCUSDT', stale: r.stale, latency_ms: Date.now()-t0, ts_server: new Date().toISOString(), data: r.data });
});

app.get('/candles', async (req, res) => {
  const tf = req.query.tf || '1h'; const limit = parseInt(req.query.limit) || 50;
  const t0 = Date.now(); const r = await fetchCandles(tf, limit);
  res.set('Cache-Control', 'no-store');
  res.json({ symbol: 'BTCUSDT', tf, count: r.data.length, stale: r.stale, latency_ms: Date.now()-t0, candles: r.data, ts_server: new Date().toISOString() });
});

// ================================================================
// SPOT ACCOUNT ENDPOINTS
// ================================================================

// GET /account/spot/balances
app.get('/account/spot/balances', requireKeys, async (req, res) => {
  try {
    const cached = cacheGet('spot_balances');
    if (cached) return res.json({ data: cached, stale: false, from_cache: true });
    const data = await bnAcc.getSpotBalances(req.bnApiKey, req.bnSecret);
    cacheSet('spot_balances', data);
    res.json({ data, stale: false, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/spot/orders?symbol=BTCUSDT
app.get('/account/spot/orders', requireKeys, async (req, res) => {
  try {
    const cached = cacheGet('spot_open_orders');
    if (cached) return res.json({ data: cached, stale: false, from_cache: true });
    const data = await bnAcc.getSpotOpenOrders(req.bnApiKey, req.bnSecret, req.query.symbol);
    cacheSet('spot_open_orders', data);
    res.json({ data, count: data.length, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/spot/trades?symbol=BTCUSDT&limit=20
app.get('/account/spot/trades', requireKeys, async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const limit  = parseInt(req.query.limit) || 20;
    const data = await bnAcc.getSpotTrades(req.bnApiKey, req.bnSecret, symbol, limit);
    res.json({ data, count: data.length, symbol, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// POST /account/spot/order — criar ordem
app.post('/account/spot/order', requireKeys, async (req, res) => {
  try {
    const p = req.body;
    if (!p.symbol || !p.side || !p.type || !p.quantity) {
      return res.status(400).json({ error: 'Campos obrigatórios: symbol, side, type, quantity' });
    }
    if (!['BUY','SELL'].includes(p.side)) return res.status(400).json({ error: 'side deve ser BUY ou SELL' });
    if (!['MARKET','LIMIT','STOP_LOSS_LIMIT'].includes(p.type)) return res.status(400).json({ error: 'type inválido' });
    if (p.type !== 'MARKET' && !p.price) return res.status(400).json({ error: 'price obrigatório para ordens LIMIT' });
    const data = await bnAcc.createSpotOrder(req.bnApiKey, req.bnSecret, p);
    cacheInvalidate('spot_balances', 'spot_open_orders');
    res.json({ ok: true, order: data, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// DELETE /account/spot/order?symbol=BTCUSDT&orderId=123
app.delete('/account/spot/order', requireKeys, async (req, res) => {
  try {
    const { symbol, orderId } = req.query;
    if (!symbol || !orderId) return res.status(400).json({ error: 'symbol e orderId obrigatórios' });
    const data = await bnAcc.cancelSpotOrder(req.bnApiKey, req.bnSecret, symbol, orderId);
    cacheInvalidate('spot_open_orders');
    res.json({ ok: true, cancelled: data, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// ================================================================
// FUTURES ENDPOINTS
// ================================================================

// GET /account/futures/balances
app.get('/account/futures/balances', requireKeys, async (req, res) => {
  try {
    const cached = cacheGet('fut_balances');
    if (cached) return res.json({ data: cached, stale: false, from_cache: true });
    const data = await bnAcc.getFuturesBalances(req.bnApiKey, req.bnSecret);
    cacheSet('fut_balances', data);
    res.json({ data, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/futures/positions?symbol=BTCUSDT
app.get('/account/futures/positions', requireKeys, async (req, res) => {
  try {
    const cached = cacheGet('fut_positions');
    if (cached) return res.json({ data: cached, stale: false, from_cache: true });
    const data = await bnAcc.getFuturesPositions(req.bnApiKey, req.bnSecret, req.query.symbol);
    cacheSet('fut_positions', data);
    res.json({ data, count: data.length, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/futures/orders
app.get('/account/futures/orders', requireKeys, async (req, res) => {
  try {
    const cached = cacheGet('fut_open_orders');
    if (cached) return res.json({ data: cached, stale: false, from_cache: true });
    const data = await bnAcc.getFuturesOpenOrders(req.bnApiKey, req.bnSecret, req.query.symbol);
    cacheSet('fut_open_orders', data);
    res.json({ data, count: data.length, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/futures/trades?symbol=BTCUSDT&limit=20
app.get('/account/futures/trades', requireKeys, async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const limit  = parseInt(req.query.limit) || 20;
    const data = await bnAcc.getFuturesTrades(req.bnApiKey, req.bnSecret, symbol, limit);
    res.json({ data, count: data.length, symbol, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/futures/income?limit=20
app.get('/account/futures/income', requireKeys, async (req, res) => {
  try {
    const data = await bnAcc.getFuturesIncome(req.bnApiKey, req.bnSecret, parseInt(req.query.limit) || 20);
    res.json({ data, count: data.length, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// POST /account/futures/order
app.post('/account/futures/order', requireKeys, async (req, res) => {
  try {
    const p = req.body;
    if (!p.symbol || !p.side || !p.type || !p.quantity) {
      return res.status(400).json({ error: 'Campos obrigatórios: symbol, side, type, quantity' });
    }
    if (!['BUY','SELL'].includes(p.side)) return res.status(400).json({ error: 'side deve ser BUY ou SELL' });
    const data = await bnAcc.createFuturesOrder(req.bnApiKey, req.bnSecret, p);
    cacheInvalidate('fut_balances', 'fut_positions', 'fut_open_orders');
    res.json({ ok: true, order: data, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// DELETE /account/futures/order?symbol=BTCUSDT&orderId=123
app.delete('/account/futures/order', requireKeys, async (req, res) => {
  try {
    const { symbol, orderId } = req.query;
    if (!symbol || !orderId) return res.status(400).json({ error: 'symbol e orderId obrigatórios' });
    const data = await bnAcc.cancelFuturesOrder(req.bnApiKey, req.bnSecret, symbol, orderId);
    cacheInvalidate('fut_open_orders');
    res.json({ ok: true, cancelled: data, ts: new Date().toISOString() });
  } catch(e) {
    res.status(e.status || 400).json({ error: e.message, code: e.code });
  }
});

// GET /account/filters?symbol=BTCUSDT&market=spot
app.get('/account/filters', async (req, res) => {
  try {
    const data = await bnAcc.getExchangeFilters(req.query.symbol || 'BTCUSDT', req.query.market || 'spot');
    res.json({ data, ts: new Date().toISOString() });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================
process.on('SIGTERM', () => { console.log('SIGTERM'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT');  process.exit(0); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus Finance Data Service v${VERSION} :${PORT}`);
  console.log('Market: /health /snapshot /ticker /candles');
  console.log('Account: /account/spot/* /account/futures/*');
});
