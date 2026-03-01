// ================================================================
// NEXUS FINANCE — BINANCE ACCOUNT MODULE v2.0
// Assinatura HMAC-SHA256 server-side (seguro)
// Suporta: Spot + Futures USDT-M
// ================================================================
'use strict';

const crypto = require('crypto');
const fetch  = require('node-fetch');

const SPOT_BASE    = 'https://api.binance.com';
const FUT_BASE     = 'https://fapi.binance.com';

// ── HMAC-SHA256 signature (obrigatório para endpoints privados) ──
function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

// ── Monta query string com timestamp + signature ──
function buildSignedQuery(params, secret) {
  params.timestamp = Date.now();
  params.recvWindow = 5000;
  const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const sig = sign(qs, secret);
  return `${qs}&signature=${sig}`;
}

// ── Request autenticado ──
async function binanceRequest(baseUrl, path, method, params, apiKey, secret) {
  method = method || 'GET';
  const qs = buildSignedQuery(params || {}, secret);
  const url = method === 'GET'
    ? `${baseUrl}${path}?${qs}`
    : `${baseUrl}${path}`;
  const opts = {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  };
  if (method !== 'GET') opts.body = qs;
  const r = await fetch(url, opts);
  const data = await r.json();
  if (!r.ok) {
    const msg = data.msg || ('HTTP ' + r.status);
    throw Object.assign(new Error(msg), { code: data.code, status: r.status });
  }
  return data;
}

// ── Request público (sem assinatura) ──
async function binancePublic(baseUrl, path, params) {
  const qs = params ? '?' + Object.entries(params).map(([k,v])=>`${k}=${v}`).join('&') : '';
  const r = await fetch(`${baseUrl}${path}${qs}`, { timeout: 8000 });
  const data = await r.json();
  if (!r.ok) throw new Error(data.msg || 'HTTP ' + r.status);
  return data;
}

// ================================================================
// SPOT ACCOUNT
// ================================================================

// Saldo spot (todos os assets com balance > 0)
async function getSpotBalances(apiKey, secret) {
  const data = await binanceRequest(SPOT_BASE, '/api/v3/account', 'GET', {}, apiKey, secret);
  return {
    makerCommission:  data.makerCommission,
    takerCommission:  data.takerCommission,
    canTrade:         data.canTrade,
    canWithdraw:      data.canWithdraw,
    canDeposit:       data.canDeposit,
    accountType:      data.accountType,
    balances: (data.balances || [])
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset:  b.asset,
        free:   parseFloat(b.free),
        locked: parseFloat(b.locked),
        total:  parseFloat(b.free) + parseFloat(b.locked),
      }))
      .sort((a, b) => b.total - a.total),
  };
}

// Ordens abertas spot
async function getSpotOpenOrders(apiKey, secret, symbol) {
  const params = symbol ? { symbol } : {};
  const data = await binanceRequest(SPOT_BASE, '/api/v3/openOrders', 'GET', params, apiKey, secret);
  return data.map(o => ({
    orderId:       o.orderId,
    symbol:        o.symbol,
    side:          o.side,
    type:          o.type,
    origQty:       parseFloat(o.origQty),
    executedQty:   parseFloat(o.executedQty),
    price:         parseFloat(o.price),
    stopPrice:     parseFloat(o.stopPrice),
    status:        o.status,
    timeInForce:   o.timeInForce,
    time:          o.time,
    updateTime:    o.updateTime,
  }));
}

// Histórico de trades spot
async function getSpotTrades(apiKey, secret, symbol, limit) {
  symbol = symbol || 'BTCUSDT';
  limit  = Math.min(limit || 20, 500);
  const data = await binanceRequest(SPOT_BASE, '/api/v3/myTrades', 'GET', { symbol, limit }, apiKey, secret);
  return data.map(t => ({
    id:         t.id,
    orderId:    t.orderId,
    symbol:     t.symbol,
    side:       t.isBuyer ? 'BUY' : 'SELL',
    price:      parseFloat(t.price),
    qty:        parseFloat(t.qty),
    quoteQty:   parseFloat(t.quoteQty),
    commission: parseFloat(t.commission),
    commAsset:  t.commissionAsset,
    time:       t.time,
    isMaker:    t.isMaker,
  }));
}

// Criar ordem spot (LIMIT ou MARKET)
async function createSpotOrder(apiKey, secret, params) {
  // params: { symbol, side, type, quantity, price?, timeInForce? }
  const orderParams = {
    symbol:      params.symbol,
    side:        params.side,       // BUY | SELL
    type:        params.type,       // MARKET | LIMIT | STOP_LOSS_LIMIT
    quantity:    params.quantity,
  };
  if (params.type === 'LIMIT' || params.type === 'STOP_LOSS_LIMIT') {
    orderParams.price        = params.price;
    orderParams.timeInForce  = params.timeInForce || 'GTC';
  }
  if (params.stopPrice) orderParams.stopPrice = params.stopPrice;
  const data = await binanceRequest(SPOT_BASE, '/api/v3/order', 'POST', orderParams, apiKey, secret);
  return {
    orderId:     data.orderId,
    symbol:      data.symbol,
    side:        data.side,
    type:        data.type,
    status:      data.status,
    price:       parseFloat(data.price),
    origQty:     parseFloat(data.origQty),
    executedQty: parseFloat(data.executedQty),
    transactTime:data.transactTime,
  };
}

// Cancelar ordem spot
async function cancelSpotOrder(apiKey, secret, symbol, orderId) {
  const data = await binanceRequest(SPOT_BASE, '/api/v3/order', 'DELETE', { symbol, orderId }, apiKey, secret);
  return { orderId: data.orderId, symbol: data.symbol, status: data.status };
}

// ================================================================
// FUTURES USDT-M
// ================================================================

// Saldo futures
async function getFuturesBalances(apiKey, secret) {
  const data = await binanceRequest(FUT_BASE, '/fapi/v2/account', 'GET', {}, apiKey, secret);
  return {
    totalWalletBalance:     parseFloat(data.totalWalletBalance),
    totalUnrealizedProfit:  parseFloat(data.totalUnrealizedProfit),
    totalMarginBalance:     parseFloat(data.totalMarginBalance),
    totalPositionInitialMargin: parseFloat(data.totalPositionInitialMargin),
    availableBalance:       parseFloat(data.availableBalance),
    assets: (data.assets || [])
      .filter(a => parseFloat(a.walletBalance) > 0)
      .map(a => ({
        asset:           a.asset,
        walletBalance:   parseFloat(a.walletBalance),
        unrealizedProfit:parseFloat(a.unrealizedProfit),
        marginBalance:   parseFloat(a.marginBalance),
        availableBalance:parseFloat(a.availableBalance),
      })),
  };
}

// Posições abertas futures
async function getFuturesPositions(apiKey, secret, symbol) {
  const params = symbol ? { symbol } : {};
  const data = await binanceRequest(FUT_BASE, '/fapi/v2/positionRisk', 'GET', params, apiKey, secret);
  return data
    .filter(p => parseFloat(p.positionAmt) !== 0)
    .map(p => ({
      symbol:           p.symbol,
      positionAmt:      parseFloat(p.positionAmt),
      entryPrice:       parseFloat(p.entryPrice),
      markPrice:        parseFloat(p.markPrice),
      unrealizedProfit: parseFloat(p.unRealizedProfit),
      liquidationPrice: parseFloat(p.liquidationPrice),
      leverage:         parseFloat(p.leverage),
      marginType:       p.marginType,
      positionSide:     p.positionSide,
      pnlPct: p.entryPrice && parseFloat(p.entryPrice) !== 0
        ? ((parseFloat(p.markPrice) - parseFloat(p.entryPrice)) / parseFloat(p.entryPrice) * 100 * (parseFloat(p.positionAmt) > 0 ? 1 : -1)).toFixed(2)
        : '0.00',
    }));
}

// Ordens abertas futures
async function getFuturesOpenOrders(apiKey, secret, symbol) {
  const params = symbol ? { symbol } : {};
  const data = await binanceRequest(FUT_BASE, '/fapi/v1/openOrders', 'GET', params, apiKey, secret);
  return data.map(o => ({
    orderId:     o.orderId,
    symbol:      o.symbol,
    side:        o.side,
    type:        o.type,
    origQty:     parseFloat(o.origQty),
    executedQty: parseFloat(o.executedQty),
    price:       parseFloat(o.price),
    stopPrice:   parseFloat(o.stopPrice),
    status:      o.status,
    time:        o.time,
  }));
}

// Histórico de trades futures
async function getFuturesTrades(apiKey, secret, symbol, limit) {
  symbol = symbol || 'BTCUSDT';
  limit  = Math.min(limit || 20, 500);
  const data = await binanceRequest(FUT_BASE, '/fapi/v1/userTrades', 'GET', { symbol, limit }, apiKey, secret);
  return data.map(t => ({
    id:         t.id,
    orderId:    t.orderId,
    symbol:     t.symbol,
    side:       t.side,
    price:      parseFloat(t.price),
    qty:        parseFloat(t.qty),
    quoteQty:   parseFloat(t.quoteQty),
    realizedPnl:parseFloat(t.realizedPnl),
    commission: parseFloat(t.commission),
    commAsset:  t.commissionAsset,
    time:       t.time,
    isMaker:    t.maker,
  }));
}

// Criar ordem futures
async function createFuturesOrder(apiKey, secret, params) {
  const orderParams = {
    symbol:     params.symbol,
    side:       params.side,
    type:       params.type,
    quantity:   params.quantity,
  };
  if (params.type === 'LIMIT') {
    orderParams.price       = params.price;
    orderParams.timeInForce = params.timeInForce || 'GTC';
  }
  if (params.stopPrice)    orderParams.stopPrice    = params.stopPrice;
  if (params.positionSide) orderParams.positionSide = params.positionSide;
  if (params.reduceOnly)   orderParams.reduceOnly   = params.reduceOnly;
  const data = await binanceRequest(FUT_BASE, '/fapi/v1/order', 'POST', orderParams, apiKey, secret);
  return {
    orderId:     data.orderId,
    symbol:      data.symbol,
    side:        data.side,
    type:        data.type,
    status:      data.status,
    price:       parseFloat(data.price),
    origQty:     parseFloat(data.origQty),
    executedQty: parseFloat(data.executedQty),
    updateTime:  data.updateTime,
  };
}

// Cancelar ordem futures
async function cancelFuturesOrder(apiKey, secret, symbol, orderId) {
  const data = await binanceRequest(FUT_BASE, '/fapi/v1/order', 'DELETE', { symbol, orderId }, apiKey, secret);
  return { orderId: data.orderId, symbol: data.symbol, status: data.status };
}

// ================================================================
// INCOME / PNL HISTORY (futures)
// ================================================================
async function getFuturesIncome(apiKey, secret, limit) {
  limit = Math.min(limit || 20, 200);
  const data = await binanceRequest(FUT_BASE, '/fapi/v1/income', 'GET', { incomeType: 'REALIZED_PNL', limit }, apiKey, secret);
  return data.map(i => ({
    symbol:     i.symbol,
    incomeType: i.incomeType,
    income:     parseFloat(i.income),
    asset:      i.asset,
    time:       i.time,
    tradeId:    i.tradeId,
  }));
}

// ================================================================
// EXCHANGE INFO (preço atual + lotsize rules)
// ================================================================
async function getExchangeFilters(symbol, market) {
  const base = market === 'futures' ? FUT_BASE : SPOT_BASE;
  const path = market === 'futures' ? '/fapi/v1/exchangeInfo' : '/api/v3/exchangeInfo';
  const data = await binancePublic(base, path, { symbol });
  const sym  = (data.symbols || []).find(s => s.symbol === symbol);
  if (!sym) return null;
  const lotFilter  = (sym.filters || []).find(f => f.filterType === 'LOT_SIZE')        || {};
  const priceFilter= (sym.filters || []).find(f => f.filterType === 'PRICE_FILTER')    || {};
  const notional   = (sym.filters || []).find(f => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL') || {};
  return {
    symbol,
    market,
    baseAsset:   sym.baseAsset,
    quoteAsset:  sym.quoteAsset,
    status:      sym.status,
    minQty:      parseFloat(lotFilter.minQty  || 0),
    maxQty:      parseFloat(lotFilter.maxQty  || 99999),
    stepSize:    parseFloat(lotFilter.stepSize|| 0.001),
    tickSize:    parseFloat(priceFilter.tickSize || 0.01),
    minNotional: parseFloat(notional.minNotional || notional.notional || 10),
  };
}

module.exports = {
  getSpotBalances, getSpotOpenOrders, getSpotTrades, createSpotOrder, cancelSpotOrder,
  getFuturesBalances, getFuturesPositions, getFuturesOpenOrders, getFuturesTrades,
  createFuturesOrder, cancelFuturesOrder, getFuturesIncome, getExchangeFilters,
};
