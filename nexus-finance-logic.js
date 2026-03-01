// ================================================================
// NEXUS FINANCE v3.0 - MESA DE OPERAÇÕES
// ================================================================
var APP_VERSION = '3.0.0';

// ================================================================
// PERFIS DE RISCO
// ================================================================
var RISK_PROFILES = {
  CONSERVADOR: {
    label: 'Conservador', color: '#32d74b', short: 'C',
    allowed: ['Renda Fixa','Tesouro','LCI/LCA','CDB'],
    blocked: ['Cripto','Alavancagem','Acoes especulativas'],
    max_risk: 'baixo', min_conf: 'alta', mode: 'ESPERAR',
    desc: 'Prioridade: nao perder dinheiro. So entra em ativo seguro.'
  },
  SEGURO: {
    label: 'Moderado', color: '#ffd60a', short: 'M',
    allowed: ['Renda Fixa','FIIs','Acoes grandes','Dolar'],
    blocked: ['Cripto','Alavancagem'],
    max_risk: 'medio', min_conf: 'media', mode: 'MONITORAR',
    desc: 'Equilibrio entre segurança e crescimento.'
  },
  ARROJADO: {
    label: 'Arrojado', color: '#ff453a', short: 'A',
    allowed: ['Acoes','FIIs','Cripto','Dolar','Commodities'],
    blocked: [],
    max_risk: 'alto', min_conf: 'baixa', mode: 'OPERAR',
    desc: 'Busca retorno alto. Aceita volatilidade com disciplina.'
  }
};

// FACT_CHECKER é obrigatório no final de ambos os pipelines (spec C1/C2)
var DAILY_PIPELINE = ['MACRO_ORACLE','RISK_SHIELD','DERIVATIVES_HEDGE','ORCHESTRATOR_CIO','FACT_CHECKER'];
var DEEP_PIPELINE = ['MACRO_ORACLE','BRASIL_ANALYST','QUANT_SIGNAL','EQUITY_STOCK_MASTER',
  'REAL_ASSETS_CREDIT','RISK_SHIELD','DERIVATIVES_HEDGE','EXECUTION_DESK',
  'LEGAL_TAX_OPTIMIZER','ORCHESTRATOR_CIO','FACT_CHECKER'];

// Modelos free-tier permitidos (spec A2)
var FREE_TIER_MODELS = ['gemini-2.0-flash','gemini-2.0-flash-lite','gemini-1.5-flash','gemini-1.5-flash-8b'];
var GEMINI_DEFAULT_FREE = 'gemini-2.0-flash';

var AGENTS = {
  MACRO_ORACLE:       { desc: 'Analisa o cenário global — juros, dólar, commodities.',          styles: ['Druckenmiller','Dalio','Soros'],           pipeline: ['daily','deep'] },
  BRASIL_ANALYST:     { desc: 'Analisa Selic, inflação e economia brasileira.',                  styles: ['Fraga','Arida','Resende'],                  pipeline: ['deep'] },
  QUANT_SIGNAL:       { desc: 'Sinais matemáticos: tendência, força, volatilidade.',             styles: ['Simons','Asness','Lopez de Prado'],          pipeline: ['deep'] },
  EQUITY_STOCK_MASTER:{ desc: 'Analisa setores da bolsa — onde há oportunidade.',               styles: ['Lynch','Fisher','Smith'],                   pipeline: ['deep'] },
  REAL_ASSETS_CREDIT: { desc: 'FIIs, imóveis, crédito privado, CRI e CRA.',                     styles: ['Zell','Schwarzman','Flatt'],                pipeline: ['deep'] },
  RISK_SHIELD:        { desc: 'Chefe de risco: aponta o que pode dar errado.',                   styles: ['Howard Marks','Aaron Brown','Bookstaber'],   pipeline: ['daily','deep'] },
  DERIVATIVES_HEDGE:  { desc: 'Estratégias de proteção para sua carteira.',                      styles: ['Taleb','Spitznagel','Weinstein'],            pipeline: ['daily','deep'] },
  EXECUTION_DESK:     { desc: 'Como executar ordens: timing, tamanho, custo.',                   styles: ['Citadel','Virtu','Jane Street'],             pipeline: ['deep'] },
  LEGAL_TAX_OPTIMIZER:{ desc: 'Impostos e regulação. Não substitui advogado.',                   styles: ['Big4','Baker McKenzie','Withers'],           pipeline: ['deep'] },
  ORCHESTRATOR_CIO:   { desc: 'Diretor Geral: sintetiza tudo e entrega o plano do dia.',         styles: ['Dalio','Paul Tudor Jones','Soros'],          pipeline: ['daily','deep'] },
  FACT_CHECKER:       { desc: '🔍 Valida anti-alucinação: cruza outputs com snapshot real. Obrigatório.', styles: ['Nate Silver','Philip Tetlock'], pipeline: ['daily','deep','btc'] },
  CRYPTO_TRADER:      { desc: '₿ Leitura de candles, estrutura, tendência, confirmação, níveis. Especialista BTC swing.', styles: ['Price Action Pro','Wyckoff','Linda Raschke'], pipeline: ['btc'] }
};

// Pipeline dedicado BTC Trading Desk (spec Parte 3 C)
var BTC_PIPELINE = ['MACRO_ORACLE','CRYPTO_TRADER','QUANT_SIGNAL','RISK_SHIELD','EXECUTION_DESK','ORCHESTRATOR_CIO','FACT_CHECKER'];

// ================================================================
// STATE
// ================================================================
var ST = {
  page: 'dashboard',
  logged: false,
  user: null,
  riskProfile: 'SEGURO',
  pipeline: 'daily',
  brief: null,
  generating: false,
  progress: [],
  agentOutputs: {},
  snapshot: null,
  snapshotLoading: false,
  portfolio: storeGet('cio_portfolio', { 'Renda Fixa': 40, 'Acoes': 25, 'FIIs': 20, 'Dolar': 10, 'Cripto': 5 }),
  logs: [],
  config: storeGet('cio_config', { dsUrl: '', horizon: 'medio' }),
  sbCfg: storeGet('cio_sb', { url: '', anonKey: '', enabled: false }),
  aiCfg: storeGet('cio_ai_cfg', { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }),
  dbStatus: null,
  sbClient: null,
  keyInput: '',
  showKey: false,
  sbBriefs: [],
  sbTab: 'config',
  histSelected: null,
  eventsFilter: 'Todos',
  factCheckerResult: null,      // D3: resultado do FACT_CHECKER
  factCheckerTs: null,           // G1: timestamp última validação
  freeTierActive: true,          // A4: status free-tier
  factCheckerEnabled: true,      // G2: toggle validação
  // BTC Trading Desk state
  btcParams: storeGet('cio_btc_params', { alvo: 5.0, stop: 2.0, capital: null, modo: 'SEGURO', timeframes: ['1h','4h'] }),
  btcGenerating: false,
  btcBrief: null,
  btcProgress: [],
  btcAgentOutputs: {},
  btcFactChecker: null,
  btcFactTs: null
};

function setState(partial) { Object.assign(ST, partial); render(); }
function stateSet(partial) { Object.assign(ST, partial); }

// ================================================================
// STORAGE
// ================================================================
function storeGet(k, def) { try { var v=localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e) { return def; } }
function storeSet(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
function storeGetStr(k, def) { try { return localStorage.getItem(k) || def || ''; } catch(e) { return def || ''; } }
function storeSetStr(k, v)   { try { localStorage.setItem(k, v); } catch(e) {} }

// ================================================================
// AI KEY
// ================================================================
var AIKEY = {
  get: function()  { return storeGetStr('cio_ai_key', ''); },
  set: function(k) { storeSetStr('cio_ai_key', k); },
  clear: function(){ try { localStorage.removeItem('cio_ai_key'); } catch(e) {} }
};

// ================================================================
// MARKET DATA — FONTES REAIS PUBLICAS
// ================================================================

// Tabela de labels amigaveis para leigos
var ASSET_LABELS = {
  BTCUSDT:  { name: 'Bitcoin (BTC)',      icon: '₿',   cat: 'Cripto',      unit: 'USD' },
  ETHUSDT:  { name: 'Ethereum (ETH)',     icon: '⟠',   cat: 'Cripto',      unit: 'USD' },
  BNBUSDT:  { name: 'BNB Binance',        icon: '🟡',  cat: 'Cripto',      unit: 'USD' },
  SOLUSDT:  { name: 'Solana (SOL)',       icon: '◎',   cat: 'Cripto',      unit: 'USD' },
  XRPUSDT:  { name: 'XRP (Ripple)',       icon: '💧',  cat: 'Cripto',      unit: 'USD' },
  USDBRL:   { name: 'Dólar Americano',   icon: '💵',  cat: 'Câmbio',      unit: 'BRL' },
  EURBRL:   { name: 'Euro',              icon: '💶',  cat: 'Câmbio',      unit: 'BRL' },
  XAUUSD:   { name: 'Ouro (por oz)',     icon: '🥇',  cat: 'Commodity',   unit: 'USD' },
  XAGUSD:   { name: 'Prata (por oz)',    icon: '🥈',  cat: 'Commodity',   unit: 'USD' },
  CLUSD:    { name: 'Petróleo WTI',     icon: '🛢️',  cat: 'Commodity',   unit: 'USD' },
  IBOV:     { name: 'Ibovespa',          icon: '🇧🇷', cat: 'Bolsa BR',    unit: 'pts' },
  SPX:      { name: 'S&P 500 (EUA)',     icon: '🇺🇸', cat: 'Bolsa EUA',   unit: 'USD' },
  NDX:      { name: 'Nasdaq (Techs)',    icon: '💻',  cat: 'Bolsa EUA',   unit: 'USD' },
  DXY:      { name: 'Índice do Dólar',  icon: '📊',  cat: 'Macro',       unit: 'pts' },
  BTC_DOM:  { name: 'Dominância BTC',    icon: '📈',  cat: 'Cripto',      unit: '%'   }
};

// Fetch cotações Binance (cripto em tempo real)
function fetchBinance() {
  var symbols = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT'];
  var queries = symbols.map(function(s) {
    return fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=' + s)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        return {
          symbol: s,
          last: parseFloat(d.lastPrice),
          chg24h_pct: parseFloat(d.priceChangePercent),
          volume: parseFloat(d.quoteVolume),
          high: parseFloat(d.highPrice),
          low: parseFloat(d.lowPrice)
        };
      }).catch(function() { return null; });
  });
  return Promise.all(queries);
}

// Fetch cambio via ExchangeRate-API (gratuita, sem auth)
function fetchCambio() {
  return fetch('https://api.exchangerate-api.com/v4/latest/USD')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var brl = d.rates && d.rates.BRL ? d.rates.BRL : null;
      var eur = d.rates && d.rates.EUR ? d.rates.EUR : null;
      var results = [];
      if (brl) results.push({ symbol: 'USDBRL', last: brl, chg24h_pct: null, source: 'exchangerate' });
      if (brl && eur) results.push({ symbol: 'EURBRL', last: brl / eur, chg24h_pct: null, source: 'exchangerate' });
      return results;
    }).catch(function() { return []; });
}

// Fetch metais e commodities via Metals-API (fallback: dados estimados com timestamp)
function fetchMetals() {
  // Usando frankfurter para EUR/USD como proxy, e GoldAPI para metais
  return fetch('https://api.metals.live/v1/spot/gold,silver')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var results = [];
      if (d && d.price && d[0]) {
        // metals.live retorna array
        d.forEach(function(m) {
          if (m.gold) results.push({ symbol: 'XAUUSD', last: m.gold, chg24h_pct: null, source: 'metals.live' });
          if (m.silver) results.push({ symbol: 'XAGUSD', last: m.silver, chg24h_pct: null, source: 'metals.live' });
        });
      }
      return results;
    }).catch(function() {
      // fallback: fetch gold price via alternative
      return fetch('https://api.gold-api.com/price/XAU')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var results = [];
          if (d && d.price) results.push({ symbol: 'XAUUSD', last: d.price, chg24h_pct: d.chp || null, source: 'gold-api' });
          return results;
        }).catch(function() { return []; });
    });
}

// Macro BR via BCB PTAX (oficial)
function fetchMacroBR() {
  var hoje = new Date();
  var d2 = hoje.toLocaleDateString('pt-BR').replace(/\//g, '-');
  // PTAX dólar
  var ptaxUrl = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=' + "'" + d2 + "'" + '&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao';
  return fetch(ptaxUrl)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var row = d.value && d.value[0];
      if (!row) return null;
      return {
        ptax_compra: row.cotacaoCompra,
        ptax_venda: row.cotacaoVenda,
        ptax_ts: row.dataHoraCotacao,
        source: 'BCB PTAX'
      };
    }).catch(function() { return null; });
}

// Selic meta via BCB
function fetchSelic() {
  return fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados/ultimos/1?formato=json')
    .then(function(r) { return r.json(); })
    .then(function(d) { return d && d[0] ? parseFloat(d[0].valor) : null; })
    .catch(function() { return null; });
}

// Fetch CoinGecko dominance BTC
function fetchDominance() {
  return fetch('https://api.coingecko.com/api/v3/global')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var dom = d.data && d.data.market_cap_percentage && d.data.market_cap_percentage.btc;
      return dom ? { symbol: 'BTC_DOM', last: parseFloat(dom.toFixed(1)), chg24h_pct: null, source: 'CoinGecko' } : null;
    }).catch(function() { return null; });
}

// Cotacao do boi gordo via CEPEA (HTMLparse nao possivel via CORS, usa proxy publico ou fallback)
// Usamos IBGE/CONAB como fallback para commodities agro

// Busca candles do BTC via Binance (klines)
function fetchBTCCandles(tf, limit) {
  tf = tf || '1h'; limit = limit || 50;
  // Map timeframe to Binance interval
  var TF_MAP = { '15m':'15m', '1h':'1h', '4h':'4h', '1d':'1d' };
  var interval = TF_MAP[tf] || '1h';
  var url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=' + interval + '&limit=' + limit;
  return fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(function(k) {
        return {
          ts: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
          low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5])
        };
      });
    }).catch(function() { return []; });
}

// MASTER FETCH — busca tudo em paralelo
function fetchAllMarketData() {
  stateSet({ snapshotLoading: true });

  return Promise.all([
    fetchBinance(),
    fetchCambio(),
    fetchMetals(),
    fetchMacroBR(),
    fetchSelic(),
    fetchDominance()
  ]).then(function(results) {
    var binance   = results[0] || [];
    var cambio    = results[1] || [];
    var metals    = results[2] || [];
    var macroBR   = results[3];
    var selic     = results[4];
    var dominance = results[5];

    var prices = {};
    var sources = [];

    // Cripto Binance
    binance.forEach(function(b) {
      if (b) { prices[b.symbol] = b; sources.push('Binance'); }
    });

    // Cambio
    cambio.forEach(function(c) {
      if (!prices[c.symbol]) { prices[c.symbol] = c; sources.push('ExchangeRate'); }
    });

    // Metais
    metals.forEach(function(m) {
      if (m) { prices[m.symbol] = m; sources.push(m.source || 'Metals'); }
    });

    // Dominancia
    if (dominance) { prices['BTC_DOM'] = dominance; sources.push('CoinGecko'); }

    // PTAX como cotacao do dolar se Exchange rate nao pegou
    if (macroBR && macroBR.ptax_venda && !prices['USDBRL']) {
      prices['USDBRL'] = { symbol: 'USDBRL', last: macroBR.ptax_venda, chg24h_pct: null, source: 'BCB PTAX' };
    }

    // Contar fontes bem sucedidas
    var successCount = Object.keys(prices).length;
    var uniqueSources = sources.filter(function(s, i, a) { return a.indexOf(s) === i; });

    var snap = {
      ts: new Date().toISOString(),
      prices: prices,
      macro_br: {
        selic: selic,
        ptax_compra: macroBR ? macroBR.ptax_compra : null,
        ptax_venda: macroBR ? macroBR.ptax_venda : null,
        source_ptax: macroBR ? macroBR.source : null
      },
      events: [],
      news: [],
      quality: {
        source: uniqueSources.join(', ') || 'cache',
        partial: successCount < 3,
        assets_found: successCount,
        fetched_at: new Date().toLocaleTimeString('pt-BR')
      }
    };

    stateSet({ snapshot: snap, snapshotLoading: false });
    return snap;
  }).catch(function(e) {
    stateSet({ snapshotLoading: false });
    // Retorna snapshot com precos em cache / zerados para nao quebrar
    return {
      ts: new Date().toISOString(),
      prices: {},
      macro_br: {},
      events: [],
      news: [],
      quality: { source: 'erro:' + e.message, partial: true, assets_found: 0 }
    };
  });
}

// ================================================================
// A1-A4: GEMINI FREE-TIER ENFORCEMENT — ÚNICA FUNÇÃO DE IA
// ================================================================

// A2: Modelos free-tier permitidos
var FREE_TIER_MODELS = [
  'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-lite',
  'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash-latest'
];
var GEMINI_DEFAULT   = 'gemini-2.0-flash';

// A3: Verificar se modelo é free-tier
function assertFreeTierModel(modelName) {
  var m = (modelName || '').toLowerCase();
  var isOk = FREE_TIER_MODELS.some(function(ok) { return m.indexOf(ok.toLowerCase()) >= 0; });
  stateSet({ freeTierActive: isOk });
  if (!isOk) {
    addLog('FREE_TIER_CHECK', 'fail', 'Modelo pago detectado: ' + modelName);
    throw new Error('MODELO_PAGO:' + modelName);
  }
  addLog('FREE_TIER_CHECK', 'ok', 'Gemini Free-Tier: ' + modelName);
  return true;
}

// A4: Boot assert — chamado na inicialização
function bootAssertFreeTier() {
  var cfg = ST.aiCfg || {};
  // Forçar para Gemini se provider não for gemini
  if (cfg.provider !== 'gemini') {
    var nc = { provider: 'gemini', model: GEMINI_DEFAULT };
    stateSet({ aiCfg: nc });
    storeSet('cio_ai_cfg', nc);
    addLog('BOOT_ENFORCE', 'ok', 'Forçado para Gemini Free-Tier');
  }
  var model = (ST.aiCfg || {}).model || GEMINI_DEFAULT;
  try {
    assertFreeTierModel(model);
  } catch(e) {
    var nc2 = { provider: 'gemini', model: GEMINI_DEFAULT };
    stateSet({ aiCfg: nc2, freeTierActive: true });
    storeSet('cio_ai_cfg', nc2);
    addLog('BOOT_ENFORCE', 'ok', 'Revertido para ' + GEMINI_DEFAULT);
  }
}

// A1: ÚNICA função de chamada de IA — apenas Gemini Free
function runGemini(systemPrompt, userPrompt, maxTokens) {
  maxTokens = maxTokens || 1600;
  var key = AIKEY.get();
  if (!key) return Promise.reject(new Error('CHAVE_API_NAO_CONFIGURADA'));

  // A3: enforce free-tier (auto-corrige para default)
  var cfg = ST.aiCfg || {};
  var model = cfg.model || GEMINI_DEFAULT;
  var isFree = FREE_TIER_MODELS.some(function(ok) { return model.toLowerCase().indexOf(ok.toLowerCase()) >= 0; });
  if (!isFree) {
    model = GEMINI_DEFAULT;
    var nc = { provider: 'gemini', model: model };
    stateSet({ aiCfg: nc, freeTierActive: false });
    storeSet('cio_ai_cfg', nc);
    addLog('FREE_TIER_CHECK', 'warn', 'Auto-corrigido para ' + GEMINI_DEFAULT);
  }

  // F3: limite de prompt (B) — bloquear prompts > 8k chars
  var combined = systemPrompt + ' ' + userPrompt;
  if (combined.length > 8000) {
    addLog('PROMPT_SIZE', 'warn', 'Prompt truncado: ' + combined.length + ' chars');
    userPrompt = userPrompt.slice(0, 5500);
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  var t0 = Date.now();
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.25, topK: 40, topP: 0.9 }
    })
  }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) {
      var msg = e.error && e.error.message ? e.error.message : 'HTTP ' + r.status;
      throw new Error(msg);
    });
    return r.json();
  }).then(function(d) {
    var elapsed = Date.now() - t0;
    var t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts
      ? d.candidates[0].content.parts.map(function(pp) { return pp.text || ''; }).join('') : '';
    var promptLen = combined.length;
    var respLen   = t.length;
    addLog('GEMINI_CALL', 'ok', model + ' | prompt:' + promptLen + ' resp:' + respLen + ' ' + elapsed + 'ms');
    try { return JSON.parse(t.replace(/```json|```/g, '').trim()); }
    catch(e) { return { raw: t, parse_error: true }; }
  });
}

// Alias para retrocompatibilidade (não usado mais diretamente)
function callAI(system, userMsg, maxTokens) {
  return runGemini(system, userMsg, maxTokens);
}

// ================================================================
// SUPABASE
// ================================================================
function createSB(url, anonKey) {
  if (!url || !anonKey) return null;
  var h = { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey };
  function rpc(path, method, body) {
    method = method || 'GET';
    var headers = Object.assign({}, h, { 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' });
    return fetch(url + '/rest/v1' + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function(r) {
        if (!r.ok) return r.text().then(function(e) { throw new Error('SB ' + r.status + ': ' + e); });
        return r.text().then(function(t) { return t ? JSON.parse(t) : null; });
      });
  }
  return {
    saveBrief:    function(d) { return rpc('/morning_briefs', 'POST', d); },
    getBriefs:    function(n) { return rpc('/morning_briefs?order=created_at.desc&limit=' + (n||20)); },
    savePortfolio:function(d) { return rpc('/portfolio_snapshots', 'POST', d); },
    saveLog:      function(d) { return rpc('/audit_logs', 'POST', d); },
    getLogs:      function(n) { return rpc('/audit_logs?order=created_at.desc&limit=' + (n||80)); },
    upsertConfig: function(k, v) {
      return rpc('/app_config?key=eq.' + k).then(function(ex) {
        if (ex && ex.length) return rpc('/app_config?key=eq.' + k, 'PATCH', { value: JSON.stringify(v) });
        return rpc('/app_config', 'POST', { key: k, value: JSON.stringify(v) });
      });
    },
    ping: function() { return rpc('/morning_briefs?limit=1'); }
  };
}

function initSupabase() {
  var cfg = ST.sbCfg;
  if (!cfg.enabled || !cfg.url || !cfg.anonKey) { stateSet({ sbClient: null, dbStatus: null }); return Promise.resolve(); }
  var client = createSB(cfg.url, cfg.anonKey);
  stateSet({ sbClient: client, dbStatus: 'syncing' });
  return client.ping().then(function() {
    stateSet({ dbStatus: 'ok' });
  }).catch(function() { stateSet({ dbStatus: 'error' }); });
}

function addLog(action, status, notes) {
  var entry = { id: Date.now(), ts: new Date().toISOString(), user: ST.user ? ST.user.username : 'sys', action: action, status: status, notes: notes || '' };
  ST.logs = [entry].concat(ST.logs.slice(0, 99));
  if (ST.sbClient) ST.sbClient.saveLog({ username: entry.user, action: action, status: status, notes: notes || '' }).catch(function() {});
}

// ================================================================
// RISK POLICY ENGINE
// ================================================================
function applyPolicy(opps, profile) {
  var cfg = RISK_PROFILES[profile];
  if (!opps || !opps.length) return [];
  return opps.filter(function(o) {
    if (cfg.blocked.some(function(b) { return (o.classe||'').indexOf(b)>=0; })) return false;
    if (cfg.max_risk === 'baixo' && (o.risco_nivel === 'alto' || o.risco_nivel === 'medio')) return false;
    if (cfg.min_conf === 'alta' && o.confianca !== 'alta') return false;
    if (cfg.min_conf === 'media' && o.confianca === 'baixa') return false;
    return true;
  }).map(function(o) { return Object.assign({}, o, { acao: o.acao || cfg.mode }); });
}

// ================================================================
// BUILD PROMPTS — ULTRA CLAROS PARA LEIGOS
// ================================================================
function buildPrompt(agentId, snap, profile, horizon, prev) {
  var base = 'Voce e um assessor financeiro especialista respondendo a um investidor leigo brasileiro. Retorne SOMENTE JSON valido. Sem markdown, sem explicacoes fora do JSON. Use linguagem simples e direta.';

  // Formata precos para incluir no prompt
  var precosStr = '';
  var priceKeys = Object.keys(snap.prices || {});
  priceKeys.forEach(function(k) {
    var p = snap.prices[k];
    var lbl = ASSET_LABELS[k] ? ASSET_LABELS[k].name : k;
    var chgStr = p.chg24h_pct != null ? ' (' + (p.chg24h_pct >= 0 ? '+' : '') + p.chg24h_pct.toFixed(2) + '% 24h)' : '';
    precosStr += lbl + ': ' + (p.last || 0).toLocaleString('pt-BR') + chgStr + ' | ';
  });
  if (snap.macro_br && snap.macro_br.selic) precosStr += 'Selic: ' + snap.macro_br.selic + '% | ';
  if (snap.macro_br && snap.macro_br.ptax_venda) precosStr += 'PTAX BCB: ' + snap.macro_br.ptax_venda + ' BRL/USD | ';

  var inp = 'PRECOS_ATUAIS: ' + precosStr + ' PERFIL: ' + profile + ' HORIZONTE: ' + horizon;

  // D3: Schema FACT_CHECKER
  var FACT_SCHEMA = '{"agent":"FACT_CHECKER","status":"validated|partial|failed","critical_issues":[{"type":"unsupported_claim|contradiction|out_of_snapshot|math_error","message":"","where":""}],"non_critical_notes":[""],"fix_suggestions":[""],"missing_data":[""],"confidence":"baixa|media|alta","numbers_verified":[{"claim":"","snapshot_field":"","snapshot_value":0,"status":"ok|not_found|mismatch"}]}';

  var ORCH_SCHEMA = '{"agent":"ORCHESTRATOR_CIO","morning_brief":{"resumo_executivo":"Em 2-3 frases simples explique o cenario de hoje para um leigo","semaforo":"verde|amarelo|vermelho","semaforo_motivo":"Por que este semaforo?","acoes_imediatas":[{"ativo":"Nome do ativo claro ex: Bitcoin, Dolar, Ibovespa","acao":"COMPRAR|VENDER|ESPERAR|PROTEGER","urgencia":"AGORA|ESTA_SEMANA|PROXIMO_MES","motivo_simples":"1 frase clara explicando POR QUE para leigo","quanto_risco":"baixo|medio|alto","para_quem":"todos|moderado|arrojado"}],"nao_faca_hoje":["Lista do que EVITAR hoje com motivo simples"],"mercado_cripto":{"btc_sinal":"COMPRAR|VENDER|ESPERAR","btc_motivo":"","eth_sinal":"COMPRAR|VENDER|ESPERAR","outros":""},"mercado_cambio":{"dolar_sinal":"COMPRAR|VENDER|ESPERAR","dolar_motivo":"","ouro_sinal":"COMPRAR|VENDER|ESPERAR","ouro_motivo":""},"mercado_br":{"bolsa_sinal":"COMPRAR|VENDER|ESPERAR","bolsa_motivo":"","renda_fixa_sinal":"MANTER|AUMENTAR|REDUZIR","renda_fixa_motivo":""},"resumo_leigo":"Escreva como se fosse uma mensagem de texto para um amigo que nao entende de financas. Direto, claro, sem jargao. Max 3 frases.","opportunities_cards":[{"classe":"","tese":"Uma frase simples: POR QUE este ativo esta interessante","gatilho":"O que precisa acontecer para entrar","invalidacao":"O que significa que errou","riscos":[""],"confianca":"alta|media|baixa","risco_nivel":"baixo|medio|alto","acao":"COMPRAR|VENDER|ESPERAR|PROTEGER"}],"risks_top5":["Risco 1 em linguagem simples","Risco 2","Risco 3","Risco 4","Risco 5"],"checklist":{"fazer":["Acao concreta 1","Acao concreta 2","Acao concreta 3"],"evitar":["O que nao fazer 1","O que nao fazer 2","O que nao fazer 3"]}},"disclaimer":"Este conteudo e educacional e nao constitui recomendacao individual."}';

  var MACRO_SCHEMA = '{"agent":"MACRO_ORACLE","regime":"risk-on|risk-off|transicao|incerto","thesis":["frase simples 1","frase simples 2"],"alerts":["alerta 1","alerta 2"],"by_class":{"renda_fixa":[""],"acoes":[""],"cripto":[""],"cambio":[""],"numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Conteudo educacional."}}';

  var prompts = {
    MACRO_ORACLE: {
      sys: base + ' Foco: cenario global e impacto no Brasil.',
      usr: inp + ' Analise o cenario macro e retorne: ' + MACRO_SCHEMA
    },
    BRASIL_ANALYST: {
      sys: base + ' Foco: economia brasileira, Selic, inflacao, real.',
      usr: inp + ' Analise economia BR e retorne: {"agent":"BRASIL_ANALYST","thesis":["",""],"alerts":["",""],"selic_outlook":"alta|estavel|queda","impacto_renda_fixa":"positivo|neutro|negativo","impacto_acoes":"positivo|neutro|negativo","numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Conteudo educacional."}}'
    },
    QUANT_SIGNAL: {
      sys: base + ' Foco: sinais tecnicos e quantitativos.',
      usr: inp + ' Retorne sinais: {"agent":"QUANT_SIGNAL","tendencia_geral":"alta|baixa|lateral","volatilidade":"baixa|media|alta","sinais":[{"ativo":"","sinal":"COMPRAR|VENDER|ESPERAR","forca":0,"motivo":""}],"guardrails":[""]}'
    },
    EQUITY_STOCK_MASTER: {
      sys: base + ' Foco: bolsa brasileira e acoes.',
      usr: inp + ' Retorne: {"agent":"EQUITY_STOCK_MASTER","bolsa_tendencia":"alta|baixa|lateral","setores_bons":[""],"setores_ruins":[""],"thesis":["","",""],"alerts":["",""]}'
    },
    REAL_ASSETS_CREDIT: {
      sys: base + ' Foco: FIIs, imoveis e credito privado.',
      usr: inp + ' Retorne: {"agent":"REAL_ASSETS_CREDIT","fiis_outlook":"positivo|neutro|negativo","thesis":["","",""],"alerts":["",""]}'
    },
    RISK_SHIELD: {
      sys: base + ' Foco: riscos. Seja conservador. Em duvida, diga que ha risco.',
      usr: inp + ' Aponte riscos: {"agent":"RISK_SHIELD","nivel_risco_geral":"baixo|medio|alto|critico","thesis":["",""],"risks":[{"risco":"","prob":"baixa|media|alta","o_que_fazer":""}],"go_no_go":"go|cautela|no_go","numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Conteudo educacional."}}'
    },
    DERIVATIVES_HEDGE: {
      sys: base + ' Foco: como proteger a carteira.',
      usr: inp + ' Retorne: {"agent":"DERIVATIVES_HEDGE","thesis":["","",""],"protecoes_sugeridas":[{"tipo":"","motivo":"","para_quem":"todos|moderado|arrojado"}],"anti_ruin_rules":[""]}'
    },
    EXECUTION_DESK: {
      sys: base + ' Foco: como e quando executar operacoes.',
      usr: inp + ' Retorne: {"agent":"EXECUTION_DESK","thesis":["","",""],"quando_operar":"manha|tarde|qualquer","timing_cripto":"24h","conselhos_execucao":[""]}'
    },
    LEGAL_TAX_OPTIMIZER: {
      sys: base + ' Foco: impostos e compliance. Alerte sobre IR e declaracao.',
      usr: inp + ' Retorne: {"agent":"LEGAL_TAX_OPTIMIZER","alertas_ir":[""],"checklist_compliance":[""],"observacao":"Nao substitui contador."}'
    },
    ORCHESTRATOR_CIO: {
      sys: base + ' Voce e o CIO. Sintetize TUDO em linguagem que qualquer pessoa entende. Seja DIRETO: diga COMPRAR, VENDER ou ESPERAR. Explique POR QUE em 1 frase. PROIBIDO inventar numeros fora do snapshot. Use apenas dados em PRECOS_ATUAIS.',
      usr: 'BUNDLE_RESUMIDO:' + JSON.stringify(buildCompactBundle(prev)) + ' ' + inp + ' RETORNE:' + ORCH_SCHEMA
    },
    FACT_CHECKER: {
      sys: 'Voce e um auditor financeiro rigoroso. Analise o output do ORCHESTRATOR_CIO e valide CADA afirmação numerica contra os PRECOS_ATUAIS fornecidos. Retorne SOMENTE JSON valido. Sem markdown. NUNCA invente dados. Se uma afirmacao não tiver respaldo no snapshot, marque como unsupported_claim.',
      usr: 'PRECOS_ATUAIS:' + precosStr + ' OUTPUT_CIO:' + JSON.stringify(prev['ORCHESTRATOR_CIO'] ? (prev['ORCHESTRATOR_CIO'].morning_brief || prev['ORCHESTRATOR_CIO']) : {}) + ' Retorne: ' + FACT_SCHEMA
    },
    CRYPTO_TRADER: {
      sys: base + ' Voce e um trader especialista em Bitcoin e criptomoedas. Leia estrutura de mercado, tendencia e candles. Use SOMENTE dados do snapshot. Proibido inventar precos. Se dados insuficientes, retorne null e liste em data_needed.',
      usr: (function() {
        var btc = (snap.prices||{})['BTCUSDT'] || {};
        var btcStr = 'BTC_LAST:' + (btc.last||'null') + ' BTC_CHG24H:' + (btc.chg24h_pct!=null?btc.chg24h_pct.toFixed(2)+'%':'null') + ' BTC_VOL:' + (btc.volume||'null') + ' BTC_HIGH:' + (btc.high||'null') + ' BTC_LOW:' + (btc.low||'null');
        var extra = prev._btcExtra || {};
        var pStr = 'ALVO:' + (extra.alvo||5) + '% STOP:' + (extra.stop||2) + '% TFs:' + (extra.timeframes||['1h','4h']).join(',');
        var CRYPTO_SCHEMA = '{"agent":"CRYPTO_TRADER","thesis":["","",""],"market_structure":"alta|baixa|lateral|indefinida","candle_reading":[""],"levels":{"support":null,"resistance":null},"setup_quality":"baixa|media|alta","alerts":[""],"numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[""],"confidence":"baixa|media|alta","disclaimer":"Conteudo educacional. Nao e recomendacao individual."}';
        return btcStr + ' ' + pStr + ' ' + inp + ' Retorne: ' + CRYPTO_SCHEMA;
      })()
    }
  };

  var p = prompts[agentId];
  if (!p) return { sys: base, usr: agentId + ' analise e retorne JSON. Nao invente numeros. ' + inp };
  return p;
}

// ================================================================
// BTC TRADING DESK PIPELINE RUNNER
// ================================================================
function runBtcPipeline() {
  if (!AIKEY.get()) { setState({ page: 'ai_key' }); return; }
  var params = ST.btcParams || { alvo: 5.0, stop: 2.0, modo: 'SEGURO', timeframes: ['1h','4h'] };
  stateSet({ btcGenerating: true, btcBrief: null, btcAgentOutputs: {}, btcProgress: [], btcFactChecker: null });
  render();

  var progress = [{ label: '🌐 Buscando dados BTC em tempo real...', status: 'running' }];
  stateSet({ btcProgress: progress.slice() }); render();

  // Fetch snapshot + BTC candles in parallel
  var tf1 = (params.timeframes || ['1h'])[0] || '1h';
  Promise.all([
    ST.snapshot ? Promise.resolve(ST.snapshot) : fetchAllMarketData(),
    fetchBTCCandles(tf1, 50)
  ]).then(function(results) {
    var snap = results[0];
    var candles = results[1] || [];
    stateSet({ snapshot: snap });
    progress[0] = { label: '✓ BTC snapshot + candles recebidos (' + candles.length + ' velas)', status: 'done' };

    // Attach candles to snap for agents
    if (!snap.btcCandles) snap.btcCandles = {};
    snap.btcCandles[tf1] = candles;

    var pipeline = BTC_PIPELINE.slice();
    var bundle = {};
    var idx = 0;
    var btcFactRetry = 0;

    function finalizeBtc() {
      var cio = bundle['ORCHESTRATOR_CIO'];
      var fc  = bundle['FACT_CHECKER'];
      var brief = cio && cio.morning_brief ? cio.morning_brief : (cio || { _error: true });
      if (brief.opportunities_cards) brief.opportunities_cards = applyPolicy(brief.opportunities_cards, params.modo || ST.riskProfile);
      brief._factChecker = fc;
      brief._btcParams   = params;
      brief._candles     = candles.slice(-20);
      var fcStatus = fc ? (fc.status || 'unknown') : 'skipped';
      addLog('BTC_PIPELINE', fcStatus === 'validated' ? 'ok' : 'warn', 'tf:' + tf1 + ' alvo:' + params.alvo + '% stop:' + params.stop + '% fc:' + fcStatus);
      setState({ btcGenerating: false, btcBrief: brief, btcFactChecker: fc, btcFactTs: new Date().toISOString() });
    }

    function handleBtcFact(fc) {
      bundle['FACT_CHECKER'] = fc;
      ST.btcAgentOutputs['FACT_CHECKER'] = fc;
      var status = fc ? fc.status : 'skipped';
      progress[progress.length-1] = { label: '✓ FACT_CHECKER: ' + status.toUpperCase(), status: 'done' };
      stateSet({ btcProgress: progress.slice() }); render();

      if (status === 'failed' && btcFactRetry < 1 && (fc.critical_issues||[]).length > 0) {
        btcFactRetry++;
        progress.push({ label: '🔄 Revisando CIO (issues detectadas)...', status: 'running' });
        stateSet({ btcProgress: progress.slice() }); render();
        var issues = JSON.stringify((fc.critical_issues||[]).map(function(i){return i.message;}));
        var revP = buildBtcPrompt('ORCHESTRATOR_CIO', snap, params, bundle);
        var revSys = revP.sys + ' REVISAO: Remova afirmacoes sem dados. Issues: ' + issues;
        runGemini(revSys, revP.usr, 1600).then(function(revised) {
          bundle['ORCHESTRATOR_CIO'] = revised; ST.btcAgentOutputs['ORCHESTRATOR_CIO'] = revised;
          progress[progress.length-1] = { label: '✓ CIO revisado', status: 'done' };
          progress.push({ label: '🔍 Revalidando...', status: 'running' });
          stateSet({ btcProgress: progress.slice() }); render();
          var fcP2 = buildBtcPrompt('FACT_CHECKER', snap, params, bundle);
          runGemini(fcP2.sys, fcP2.usr, 800).then(function(fc2) {
            bundle['FACT_CHECKER'] = fc2; ST.btcAgentOutputs['FACT_CHECKER'] = fc2;
            progress[progress.length-1] = { label: '✓ Revalidado: ' + (fc2.status||'?').toUpperCase(), status: 'done' };
            stateSet({ btcProgress: progress.slice() });
            finalizeBtc();
          }).catch(function() { finalizeBtc(); });
        }).catch(function() { finalizeBtc(); });
      } else {
        finalizeBtc();
      }
    }

    function btcNext() {
      if (idx >= pipeline.length) { finalizeBtc(); return; }
      var agId = pipeline[idx];
      var t0 = Date.now();
      progress.push({ label: '⚙️ ' + agId + ' analisando BTC...', status: 'running' });
      stateSet({ btcProgress: progress.slice() }); render();

      var prev = {};
      if (agId === 'ORCHESTRATOR_CIO' || agId === 'FACT_CHECKER') {
        prev = bundle;
      } else {
        Object.keys(bundle).forEach(function(k) {
          var ag = bundle[k] || {};
          prev[k] = { thesis: (ag.thesis||[]).slice(0,2), alerts: (ag.alerts||[]).slice(0,1), market_structure: ag.market_structure };
        });
      }
      prev._btcExtra = params;

      var prompt = buildBtcPrompt(agId, snap, params, prev);
      var maxTok = agId === 'FACT_CHECKER' ? 900 : agId === 'ORCHESTRATOR_CIO' ? 1800 : 1400;

      runGemini(prompt.sys, prompt.usr, maxTok).then(function(result) {
        bundle[agId] = result; ST.btcAgentOutputs[agId] = result;
        var elapsed = Date.now() - t0;
        addLog('BTC_AGENT_' + agId, result.parse_error ? 'warn' : 'ok', elapsed + 'ms');
        progress[progress.length-1] = { label: '✓ ' + agId + ' (' + elapsed + 'ms)', status: 'done' };
        stateSet({ btcProgress: progress.slice() });
        if (agId === 'FACT_CHECKER') { handleBtcFact(result); }
        else { idx++; setTimeout(btcNext, 100); }
      }).catch(function(e) {
        bundle[agId] = { agent: agId, error: e.message };
        addLog('BTC_AGENT_' + agId, 'fail', e.message.slice(0,100));
        progress[progress.length-1] = { label: '✗ ' + agId + ': ' + e.message.slice(0,40), status: 'done' };
        stateSet({ btcProgress: progress.slice() }); idx++;
        setTimeout(btcNext, 100);
      });
    }

    btcNext();
  }).catch(function(e) {
    addLog('BTC_PIPELINE', 'fail', e.message);
    setState({ btcGenerating: false, btcBrief: { _error: true, _msg: e.message } });
  });
}

// BTC-specific prompt builder
function buildBtcPrompt(agentId, snap, params, prev) {
  var base = 'Voce e um especialista em Bitcoin e cripto. Retorne SOMENTE JSON valido. Sem markdown. Use linguagem simples. Nao invente numeros. Se dado nao existir no snapshot, retorne null e liste em data_needed.';
  var btc = (snap && snap.prices && snap.prices['BTCUSDT']) || {};
  var btcStr = 'BTC_LAST:' + (btc.last||'null') + ' CHG24H:' + (btc.chg24h_pct!=null?btc.chg24h_pct.toFixed(2)+'%':'null') + ' HIGH:' + (btc.high||'null') + ' LOW:' + (btc.low||'null') + ' VOL:' + (btc.volume||'null');
  var macroStr = '';
  if (snap && snap.macro_br) macroStr = ' SELIC:' + (snap.macro_br.selic||'null') + ' PTAX:' + (snap.macro_br.ptax_venda||'null');
  var pStr = 'ALVO:' + (params.alvo||5) + '% STOP:' + (params.stop||2) + '% MODO:' + (params.modo||'SEGURO') + ' TFs:' + ((params.timeframes||['1h']).join(','));
  var entryRef = btc.last || null;
  var targetPrice = entryRef ? (entryRef * (1 + (params.alvo||5)/100)).toFixed(2) : null;
  var stopPrice   = entryRef ? (entryRef * (1 - (params.stop||2)/100)).toFixed(2) : null;
  var calcStr = ' ENTRY_REF:' + entryRef + ' TARGET:' + targetPrice + ' STOP_PRICE:' + stopPrice;
  var inp = btcStr + macroStr + ' ' + pStr + calcStr;

  var FACT_SCHEMA_BTC = '{"agent":"FACT_CHECKER","status":"validated|partial|failed","critical_issues":[{"type":"unsupported_claim|contradiction|out_of_snapshot|math_error","message":"","where":""}],"non_critical_notes":[""],"missing_data":[""],"confidence":"baixa|media|alta","numbers_verified":[{"claim":"","snapshot_field":"","snapshot_value":0,"status":"ok|not_found|mismatch"}]}';

  var BTC_ORCH_SCHEMA = '{"agent":"ORCHESTRATOR_CIO","morning_brief":{"resumo_executivo":"2-3 frases em linguagem simples sobre BTC agora","semaforo":"verde|amarelo|vermelho","semaforo_motivo":"","postura":"ESPERAR|BUSCAR_ENTRADA|REDUZIR_RISCO","postura_motivo":"","condicoes_entrada":["Condicao 1 para considerar entrada","Condicao 2"],"condicoes_saida":["Condicao de saida 1"],"gestao_risco":["Regra de risco 1","Regra 2"],"entry_reference":0,"target_price":0,"stop_price":0,"resumo_leigo":"Mensagem direta e simples sobre BTC para leigo. Sem garantias. Max 2 frases.","risks_top3":["Risco 1","Risco 2","Risco 3"],"checklist":{"fazer":["Acao 1","Acao 2"],"evitar":["Evitar 1","Evitar 2"]}},"numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"disclaimer":"Conteudo educacional. Cripto tem alta volatilidade. Nao e recomendacao individual."}';

  var prompts = {
    MACRO_ORACLE: {
      sys: base + ' Foco: impacto macro global em Bitcoin agora.',
      usr: inp + ' Analise macro e impacto cripto: {"agent":"MACRO_ORACLE","regime":"risk-on|risk-off|transicao|incerto","thesis":["",""],"alerts":[""],"impacto_cripto":"positivo|neutro|negativo","motivo_cripto":"","numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Educacional."}'
    },
    CRYPTO_TRADER: {
      sys: base + ' Voce e Price Action Pro e Wyckoff trader. Leia candles e estrutura BTC. Sem dados = null.',
      usr: inp + ' Retorne: {"agent":"CRYPTO_TRADER","thesis":["","",""],"market_structure":"alta|baixa|lateral|indefinida","candle_reading":[""],"levels":{"support":null,"resistance":null},"setup_quality":"baixa|media|alta","alerts":[""],"numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[""],"confidence":"baixa|media|alta","disclaimer":"Educacional."}'
    },
    QUANT_SIGNAL: {
      sys: base + ' Foco: sinais quantitativos e tecnicos para BTC curto prazo.',
      usr: inp + ' Sinais BTC: {"agent":"QUANT_SIGNAL","tendencia_curto":"alta|baixa|lateral","tendencia_medio":"alta|baixa|lateral","volatilidade":"baixa|media|alta","sinais":[{"sinal":"BUSCAR_ENTRADA|ESPERAR|REDUZIR","forca":0,"motivo":""}],"numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Educacional."}'
    },
    RISK_SHIELD: {
      sys: base + ' Foco: riscos de operar BTC agora. Seja conservador.',
      usr: inp + ' Riscos BTC: {"agent":"RISK_SHIELD","nivel_risco":"baixo|medio|alto|critico","risks":[{"risco":"","prob":"baixa|media|alta","o_que_fazer":""}],"go_no_go":"go|cautela|no_go","numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Educacional."}'
    },
    EXECUTION_DESK: {
      sys: base + ' Foco: timing, tamanho de posicao e execucao para BTC swing.',
      usr: inp + ' Execucao BTC: {"agent":"EXECUTION_DESK","timing":"agora|aguardar|evitar","tamanho_sugerido":"%" ,"slippage_aviso":"","conselhos":[""],"numbers_used":[{"field":"snapshot.prices.BTCUSDT.last","value":0}],"data_needed":[],"confidence":"baixa|media|alta","disclaimer":"Educacional."}'
    },
    ORCHESTRATOR_CIO: {
      sys: base + ' Voce e o CIO. Sintetize o plano BTC para leigo. Diga claramente: ESPERAR, BUSCAR ENTRADA ou REDUZIR RISCO. Sem garantias. Sem inventar numeros.',
      usr: 'BUNDLE:' + JSON.stringify(buildCompactBundle(prev)) + ' ' + inp + ' RETORNE: ' + BTC_ORCH_SCHEMA
    },
    FACT_CHECKER: {
      sys: 'Voce e auditor. Valide CADA numero do OUTPUT_CIO contra BTC_DATA. Retorne JSON. Marque como unsupported_claim qualquer numero sem base no snapshot.',
      usr: 'BTC_DATA:' + inp + ' OUTPUT_CIO:' + JSON.stringify(prev['ORCHESTRATOR_CIO'] ? (prev['ORCHESTRATOR_CIO'].morning_brief || {}) : {}) + ' Retorne: ' + FACT_SCHEMA_BTC
    }
  };

  var p = prompts[agentId];
  if (!p) return { sys: base, usr: agentId + ' analise BTC. ' + inp };
  return p;
}

// C: reduzir contexto para max 1000 chars por agente (spec C)
function buildCompactBundle(bundle) {
  var compact = {};
  Object.keys(bundle).forEach(function(k) {
    var ag = bundle[k] || {};
    var txt = JSON.stringify({
      thesis: (ag.thesis || []).slice(0, 2),
      alerts: (ag.alerts || []).slice(0, 2),
      regime: ag.regime,
      go_no_go: ag.go_no_go
    });
    compact[k] = txt.slice(0, 1000);
  });
  return compact;
}

// ================================================================
// PIPELINE RUNNER
// ================================================================
function runPipeline() {
  if (!AIKEY.get()) { setState({ page: 'ai_key' }); return; }
  stateSet({ generating: true, brief: null, agentOutputs: {}, progress: [] });
  render();

  var pipeline = ST.pipeline === 'daily' ? DAILY_PIPELINE : DEEP_PIPELINE;

  // Sempre busca dados de mercado atuais
  var step0 = [{ label: '🌐 Buscando dados de mercado em tempo real...', status: 'running' }];
  stateSet({ progress: step0 }); render();

  fetchAllMarketData().then(function(snap) {
    stateSet({ snapshot: snap });
    var prog = [{ label: '✓ Dados de mercado recebidos (' + (snap.quality.assets_found || 0) + ' ativos de ' + (snap.quality.source || 'cache') + ')', status: 'done' }];
    addLog('FETCH_MARKET', 'ok', snap.quality.source);

    var bundle = {};
    var idx = 0;

    var factRetryCount = 0;

    function finalizeBrief(bundle, snap) {
      var cio = bundle['ORCHESTRATOR_CIO'];
      var fc  = bundle['FACT_CHECKER'];
      var brief = null;
      if (cio && cio.morning_brief) {
        brief = cio.morning_brief;
        if (brief.opportunities_cards) {
          brief.opportunities_cards = applyPolicy(brief.opportunities_cards, ST.riskProfile);
        }
        // Anexar resultado do FACT_CHECKER ao brief
        brief._factChecker = fc || null;
        if (ST.sbClient) {
          ST.sbClient.saveBrief({
            risk_profile: ST.riskProfile, pipeline_mode: ST.pipeline,
            brief_json: brief, snapshot_json: snap, agent_bundle: bundle,
            username: ST.user ? ST.user.username : 'admin'
          }).catch(function() {});
        }
      } else {
        brief = { _error: true, _raw: cio };
      }
      var fcStatus = fc ? (fc.status || 'unknown') : 'skipped';
      addLog('GENERATE_BRIEF', 'ok', 'mode:' + ST.pipeline + ' fc:' + fcStatus + ' profile:' + ST.riskProfile);
      addLog('FACT_CHECKER', fcStatus === 'validated' ? 'ok' : (fcStatus === 'partial' ? 'warn' : 'fail'),
        fc ? JSON.stringify((fc.critical_issues||[]).slice(0,3)) : 'sem resultado');
      setState({
        generating: false, brief: brief,
        factCheckerResult: fc || null,
        factCheckerTs: new Date().toISOString()
      });
    }

    // D4: Se FACT_CHECKER retornar "failed", tenta revisão do ORCHESTRATOR_CIO uma vez
    function handleFactResult(bundle, snap, prog, fc) {
      bundle['FACT_CHECKER'] = fc;
      ST.agentOutputs['FACT_CHECKER'] = fc;
      var status = fc ? fc.status : 'skipped';
      prog[prog.length-1] = { label: '✓ FACT_CHECKER: ' + status.toUpperCase(), status: 'done' };
      stateSet({ progress: prog.slice() }); render();

      if (status === 'failed' && factRetryCount < 1 && (fc.critical_issues||[]).length > 0) {
        factRetryCount++;
        // Revisar ORCHESTRATOR_CIO com os issues
        prog.push({ label: '🔄 Revisando CIO com issues do FACT_CHECKER...', status: 'running' });
        stateSet({ progress: prog.slice() }); render();
        var issuesTxt = JSON.stringify((fc.critical_issues||[]).map(function(i){return i.message;}));
        var revPrompt = buildPrompt('ORCHESTRATOR_CIO', snap, ST.riskProfile, ST.config.horizon||'medio', bundle);
        var revSys = revPrompt.sys + ' REVISAO OBRIGATORIA: Remova/ajuste afirmacoes nao suportadas. Problemas: ' + issuesTxt + '. Nao invente numeros. Mantenha didatico.';
        runGemini(revSys, revPrompt.usr, 1600).then(function(revised) {
          bundle['ORCHESTRATOR_CIO'] = revised;
          ST.agentOutputs['ORCHESTRATOR_CIO'] = revised;
          prog[prog.length-1] = { label: '✓ CIO revisado', status: 'done' };
          prog.push({ label: '🔍 Re-validando com FACT_CHECKER...', status: 'running' });
          stateSet({ progress: prog.slice() }); render();
          var fcPrompt2 = buildPrompt('FACT_CHECKER', snap, ST.riskProfile, ST.config.horizon||'medio', bundle);
          runGemini(fcPrompt2.sys, fcPrompt2.usr, 800).then(function(fc2) {
            bundle['FACT_CHECKER'] = fc2;
            ST.agentOutputs['FACT_CHECKER'] = fc2;
            prog[prog.length-1] = { label: '✓ Validação final: ' + (fc2.status||'?').toUpperCase(), status: 'done' };
            stateSet({ progress: prog.slice() });
            finalizeBrief(bundle, snap);
          }).catch(function() { finalizeBrief(bundle, snap); });
        }).catch(function() { finalizeBrief(bundle, snap); });
      } else {
        finalizeBrief(bundle, snap);
      }
    }

    function runNext() {
      if (idx >= pipeline.length) {
        finalizeBrief(bundle, snap);
        return;
      }

      var agId = pipeline[idx];
      var t0Agent = Date.now();
      prog.push({ label: '⚙️ ' + agId + ' analisando...', status: 'running' });
      stateSet({ progress: prog.slice() }); render();

      // C: contexto compacto para cada agente (max ~1000 chars/agente)
      var prev = {};
      if (agId === 'ORCHESTRATOR_CIO' || agId === 'FACT_CHECKER') {
        prev = bundle; // recebe bundle completo
      } else {
        Object.keys(bundle).forEach(function(k) {
          var ag = bundle[k] || {};
          prev[k] = { thesis: (ag.thesis||[]).slice(0,2), alerts: (ag.alerts||[]).slice(0,1), regime: ag.regime };
        });
      }

      var prompt = buildPrompt(agId, snap, ST.riskProfile, ST.config.horizon || 'medio', prev);
      var maxTok = agId === 'FACT_CHECKER' ? 900 : agId === 'ORCHESTRATOR_CIO' ? 1800 : 1400;

      // A1: TODA chamada via runGemini
      runGemini(prompt.sys, prompt.usr, maxTok).then(function(result) {
        bundle[agId] = result;
        ST.agentOutputs[agId] = result;
        var elapsed = Date.now() - t0Agent;
        var fcStatus = result.parse_error ? 'warn' : 'ok';
        addLog('AGENT_' + agId, fcStatus, elapsed + 'ms');
        prog[prog.length - 1] = { label: '✓ ' + agId + ' (' + elapsed + 'ms)', status: 'done' };
        stateSet({ progress: prog.slice() });
        // D4: FACT_CHECKER tem tratamento especial
        if (agId === 'FACT_CHECKER') {
          handleFactResult(bundle, snap, prog, result);
        } else {
          idx++;
          setTimeout(runNext, 100);
        }
      }).catch(function(e) {
        bundle[agId] = { agent: agId, error: e.message };
        addLog('AGENT_' + agId, 'fail', e.message.slice(0,120));
        prog[prog.length - 1] = { label: '✗ ' + agId + ': ' + e.message.slice(0,50), status: 'done' };
        stateSet({ progress: prog.slice() }); idx++;
        setTimeout(runNext, 100);
      });
    }

    runNext();
  });
}

// ================================================================
// DOM HELPERS
// ================================================================
function el(tag, attrs, children) {
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function(k) {
    var v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class' || k === 'className') { e.className = v; return; }
    if (k === 'style' && typeof v === 'object') { Object.assign(e.style, v); return; }
    if (k.slice(0,2) === 'on') { e.addEventListener(k.slice(2).toLowerCase(), v); return; }
    if (k === 'disabled' && v) { e.disabled = true; return; }
    e.setAttribute(k, v);
  });
  if (children !== undefined && children !== null) {
    if (typeof children === 'string') { e.textContent = children; }
    else if (Array.isArray(children)) {
      children.forEach(function(c) {
        if (c === null || c === undefined) return;
        if (typeof c === 'string') { e.appendChild(document.createTextNode(c)); return; }
        e.appendChild(c);
      });
    } else if (typeof children === 'object' && children.nodeType) { e.appendChild(children); }
  }
  return e;
}
function div(cls, children, style) {
  var attrs = {};
  if (cls) attrs['class'] = cls;
  if (style) attrs['style'] = style;
  return el('div', attrs, children);
}
function p(cls, text) { return el('p', cls ? { 'class': cls } : {}, text); }
function span(cls, text) { return el('span', cls ? { 'class': cls } : {}, text); }
function btn(cls, text, onClick, disabled) {
  var attrs = { 'class': 'btn ' + (cls || '') };
  if (onClick) attrs['onClick'] = onClick;
  if (disabled) attrs['disabled'] = true;
  return el('button', attrs, text);
}
function append(parent) {
  var args = Array.prototype.slice.call(arguments, 1);
  args.forEach(function(c) { if (c) parent.appendChild(c); });
  return parent;
}
function setHTML(e, html) { e.innerHTML = html; return e; }

// ================================================================
// RENDER ENGINE
// ================================================================
function render() {
  var root = document.getElementById('app');
  root.innerHTML = '';
  if (!ST.logged) { root.appendChild(renderLogin()); return; }

  var sidebar = renderSidebar();
  var overlay = div('sidebar-overlay');
  overlay.addEventListener('click', function() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });

  var hamburger = div('hamburger');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  hamburger.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });

  var mainEl = div('main', [renderPage()]);
  var mobileNav = renderMobileNav();
  var app = div('app', [overlay, sidebar, mainEl]);
  root.appendChild(app);
  root.appendChild(hamburger);
  root.appendChild(mobileNav);
}

function renderMobileNav() {
  var items = [
    { id: 'dashboard',  icon: '⚡', label: 'Brief' },
    { id: 'mercado',    icon: '📊', label: 'Mercado' },
    { id: 'btc',        icon: '₿',  label: 'BTC' },
    { id: 'portfolio',  icon: '💼', label: 'Carteira' },
    { id: 'ai_key',     icon: '🔑', label: 'IA' }
  ];
  var nav = div('mobile-nav');
  items.forEach(function(item) {
    var mi = div('mnav-item' + (ST.page === item.id ? ' active' : ''));
    mi.innerHTML = '<span class="mnav-icon">' + item.icon + '</span><span class="mnav-label">' + item.label + '</span>';
    mi.addEventListener('click', function() { setState({ page: item.id }); });
    nav.appendChild(mi);
  });
  return nav;
}

// ================================================================
// LOGIN
// ================================================================
function renderLogin() {
  var uVal = '', pVal = '';
  var wrap = div('login-wrap');
  var card = div('login-card');

  var logo = div('login-logo');
  logo.innerHTML = '<div class="login-name">NEXUS</div><div class="login-sub-brand">FINANCE</div><div class="login-line"></div><div class="login-sub">Mesa de Operações · IA + Dados Reais</div>';

  var errEl = div('login-err', '');

  var uInput = el('input', { type:'text', class:'input', autocomplete:'username',
    oninput: function(e) { uVal = e.target.value; },
    onkeydown: function(e) { if (e.key==='Enter') loginBtn.click(); }
  });
  var pInput = el('input', { type:'password', class:'input', autocomplete:'current-password',
    oninput: function(e) { pVal = e.target.value; },
    onkeydown: function(e) { if (e.key==='Enter') loginBtn.click(); }
  });

  var loginBtn = el('button', { class:'login-btn', onclick: function() {
    loginBtn.disabled = true; loginBtn.textContent = 'Entrando...';
    setTimeout(function() {
      if (uVal === 'diogobrasileiro' && pVal === 'dbsa1981') {
        stateSet({ logged: true, user: { username: uVal, role: 'admin' } });
        initSupabase().then(function() {
          // Auto-fetch market on login
          fetchAllMarketData().then(function() { render(); });
        });
      } else {
        errEl.textContent = 'Usuário ou senha incorretos.';
        loginBtn.disabled = false; loginBtn.textContent = 'Entrar';
      }
    }, 400);
  }}, 'Entrar');

  var uf = div('login-fg', [el('label',{},'Usuario'), uInput]);
  var pf = div('login-fg', [el('label',{},'Senha'), pInput]);
  var note = div('login-note');
  note.textContent = 'Dados ao vivo: Binance, BCB, Gold-API. Conteudo educacional — não constitui recomendação individual.';

  append(card, logo, uf, pf, loginBtn, errEl, note);
  append(wrap, card);
  return wrap;
}

// ================================================================
// SIDEBAR
// ================================================================
function renderSidebar() {
  var hasKey = !!AIKEY.get();

  var logo = div('sb-logo');
  var nameEl = div('sb-name', 'NEXUS FINANCE');
  var verEl = div('sb-ver', 'v' + APP_VERSION + ' • IA + Dados Reais');
  var aiDot = div('sb-aistat', [
    el('span', { class:'ai-dot ' + (hasKey ? 'on' : 'off') }),
    el('span', { class:'ai-label' }, hasKey ? 'IA Ativa — ' + (ST.aiCfg.provider === 'gemini' ? 'Gemini Free' : ST.aiCfg.provider === 'openai' ? 'OpenAI' : 'Anthropic') : 'IA nao configurada')
  ]);
  append(logo, nameEl, verEl, aiDot);

  if (ST.sbClient) {
    var dbStat = ST.dbStatus;
    logo.appendChild(div('sb-aistat', [
      el('span', { class:'ai-dot ' + (dbStat==='ok' ? 'on' : 'off') }),
      el('span', { class:'ai-label' }, dbStat==='ok' ? 'Supabase Online' : 'DB Offline')
    ]));
  }

  var NAV_SECTIONS = [
    { title: 'Painel', items: [
      { id:'dashboard',      icon:'⚡', label:'Morning Brief' },
      { id:'mercado',        icon:'📊', label:'Cotações ao Vivo' },
      { id:'opportunities',  icon:'🎯', label:'O que Fazer Agora' },
      { id:'portfolio',      icon:'💼', label:'Minha Carteira' }
    ]},
    { title: 'Análise', items: [
      { id:'btc',            icon:'₿',  label:'BTC Trading Desk' },
      { id:'agents',         icon:'🤖', label:'Agentes IA' },
      { id:'agent_outputs',  icon:'🧠', label:'Outputs IA' }
    ]},
    { title: 'Configurar', items: [
      { id:'ai_key',         icon:'🔑', label:'IA & Chave API' },
      { id:'profiles',       icon:'🛡️', label:'Meu Perfil' },
      { id:'supabase',       icon:'🗄️', label:'Banco de Dados' },
      { id:'ai_costs',       icon:'💡', label:'Pipeline & IA' }
    ]},
    { title: 'Sistema', items: [
      { id:'logs',           icon:'📋', label:'Histórico' },
      { id:'settings',       icon:'⚙️', label:'Ajustes' }
    ]}
  ];

  var nav = div('sb-nav');
  NAV_SECTIONS.forEach(function(sec) {
    var secEl = div('nav-section');
    secEl.appendChild(div('nav-title', sec.title));
    sec.items.forEach(function(item) {
      var ni = div('nav-item' + (ST.page === item.id ? ' active' : ''));
      ni.innerHTML = '<span class="nav-icon">' + item.icon + '</span>' + item.label;
      ni.addEventListener('click', function() { setState({ page: item.id }); });
      secEl.appendChild(ni);
    });
    nav.appendChild(secEl);
  });

  var bottom = div('sb-bottom');
  if (!hasKey) {
    var nokey = div('nokey-badge');
    nokey.appendChild(div('nokey-title', '🔑 Configure sua IA'));
    nokey.appendChild(div('nokey-sub', 'Gemini é gratuito — clique aqui'));
    nokey.addEventListener('click', function() { setState({ page:'ai_key' }); });
    bottom.appendChild(nokey);
  } else {
    var keyok = div('key-ok-badge');
    keyok.innerHTML = '<span class="ai-dot on"></span><span class="ai-label">IA Pronta</span>';
    bottom.appendChild(keyok);
  }

  var userArea = div('user-area');
  var av = div('user-av', ST.user ? ST.user.username[0].toUpperCase() : 'A');
  var info = div('');
  info.appendChild(div('user-name', ST.user ? ST.user.username : ''));
  info.appendChild(div('user-role', 'ADMINISTRADOR'));
  append(userArea, av, info);
  bottom.appendChild(userArea);
  bottom.appendChild(el('button', { class:'btn-logout', onclick: function() {
    setState({ logged:false, user:null, brief:null, snapshot:null, sbClient:null, dbStatus:null, page:'dashboard' });
  }}, 'Sair'));

  var sb = div('sidebar');
  append(sb, logo, nav, bottom);
  return sb;
}

// ================================================================
// PAGE ROUTER
// ================================================================
function renderPage() {
  var pages = {
    dashboard:      renderDashboard,
    mercado:        renderMercado,
    opportunities:  renderOpportunities,
    portfolio:      renderPortfolio,
    btc:            renderBtcDesk, // BTC Trading Desk
    agents:         renderAgents,
    agent_outputs:  renderAgentOutputs,
    ai_key:         renderAIKey,
    profiles:       renderProfiles,
    supabase:       renderSupabase,
    ai_costs:       renderAICosts,
    logs:           renderLogs,
    settings:       renderSettings
  };
  var fn = pages[ST.page] || renderDashboard;
  return fn();
}

// ================================================================
// G1: FACT_CHECKER SEAL RENDER
// ================================================================
function renderFactCheckerSeal(fc, ts) {
  var status = fc ? (fc.status || 'skipped') : 'skipped';
  var configs = {
    validated: {
      icon: '✅', label: 'Validado por dados',
      style: 'background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:var(--green);',
      subStyle: 'color:rgba(16,185,129,.75)'
    },
    partial: {
      icon: '🟡', label: 'Dados parciais',
      style: 'background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.28);color:var(--amber);',
      subStyle: 'color:rgba(245,158,11,.75)'
    },
    failed: {
      icon: '❌', label: 'Falhou validação — revisar dados',
      style: 'background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.28);color:var(--red);',
      subStyle: 'color:rgba(244,63,94,.75)'
    },
    skipped: {
      icon: '⏭️', label: 'FACT_CHECKER não executado',
      style: 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--t3);',
      subStyle: 'color:var(--t3)'
    }
  };
  var cfg = configs[status] || configs['skipped'];
  var wrap = div('');
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 18px;border-radius:14px;' + cfg.style;

  var left = div('');
  left.style.cssText = 'display:flex;align-items:center;gap:10px';
  var iconEl = span(''); iconEl.style.cssText = 'font-size:18px'; iconEl.textContent = cfg.icon;
  var labelEl = span(''); labelEl.style.cssText = 'font-size:13px;font-weight:800;letter-spacing:.3px'; labelEl.textContent = cfg.label;
  append(left, iconEl, labelEl);

  // Issues summary
  if (fc && (fc.critical_issues||[]).length) {
    var issues = fc.critical_issues.slice(0, 3);
    var issueWrap = div('');
    issueWrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px';
    issues.forEach(function(iss) {
      var chip = span('');
      chip.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(244,63,94,.12);color:var(--red);border:1px solid rgba(244,63,94,.22)';
      chip.textContent = iss.type + ': ' + (iss.message||'').slice(0,40);
      issueWrap.appendChild(chip);
    });
    left.appendChild(issueWrap);
  }

  // Confidence + timestamp
  var right = div('');
  right.style.cssText = 'text-align:right';
  if (fc && fc.confidence) {
    var conf = span(''); conf.style.cssText = 'font-size:10px;font-weight:800;' + cfg.subStyle;
    conf.textContent = 'Confiança: ' + fc.confidence.toUpperCase();
    right.appendChild(conf);
  }
  if (ts) {
    var tsEl = p(''); tsEl.style.cssText = 'font-size:10px;' + cfg.subStyle + ';margin-top:2px';
    tsEl.textContent = 'Última validação: ' + new Date(ts).toLocaleTimeString('pt-BR');
    right.appendChild(tsEl);
  }

  append(wrap, left, right);
  return wrap;
}

// ================================================================
// DASHBOARD (Morning Brief)
// ================================================================
function renderDashboard() {
  var hasKey = !!AIKEY.get();
  var wrap = div('');
  var today = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });

  var hdr = div('page-header');
  var titleSide = div('');
  titleSide.appendChild(div('page-title', '⚡ PLANO DO DIA'));
  titleSide.appendChild(div('page-sub', today + ' · Perfil: ' + RISK_PROFILES[ST.riskProfile].label));

  var ctrlSide = div('', null, { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'10px' });

  var profRow = div('profile-row');
  ['CONSERVADOR','SEGURO','ARROJADO'].forEach(function(k) {
    var pb = el('button', { class:'pbtn ' + RISK_PROFILES[k].short + (ST.riskProfile===k ? ' on':''),
      onclick: function() { setState({ riskProfile:k }); }
    }, RISK_PROFILES[k].label);
    profRow.appendChild(pb);
  });
  ctrlSide.appendChild(profRow);

  var pipeToggle = div('pipe-toggle');
  append(pipeToggle,
    el('button', { class:'pipe-btn'+(ST.pipeline==='daily'?' on':''), onclick:function(){setState({pipeline:'daily'});} }, '⚡ Rápido (5 agentes)'),
    el('button', { class:'pipe-btn'+(ST.pipeline==='deep'?' on':''), onclick:function(){setState({pipeline:'deep'});} }, '🔬 Completo (11 agentes)')
  );
  ctrlSide.appendChild(pipeToggle);

  var actRow = div('', null, { display:'flex', gap:'8px', flexWrap:'wrap' });
  if (ST.brief && !ST.brief._error) {
    actRow.appendChild(btn('btn-secondary', '📡 Atualizar Cotacoes', function() {
      fetchAllMarketData().then(function() { render(); });
    }));
    actRow.appendChild(btn('btn-secondary', '⬇ Exportar', function() {
      var blob = new Blob([JSON.stringify({ brief:ST.brief, snapshot:ST.snapshot, ts:new Date().toISOString() }, null, 2)], { type:'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'cio-brief-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
    }));
  }
  actRow.appendChild(btn('btn-primary', ST.generating ? '⚙️ Analisando...' : '⚡ Gerar Plano do Dia', function() {
    if (!ST.generating) runPipeline();
  }, ST.generating));
  ctrlSide.appendChild(actRow);
  append(hdr, titleSide, ctrlSide);
  wrap.appendChild(hdr);

  if (!hasKey) {
    var kb = div('banner banner-err'); kb.style.cursor='pointer';
    kb.textContent = '🔑 Configure sua API Key de IA para gerar o plano. Gemini e GRATUITO!';
    kb.addEventListener('click', function(){ setState({page:'ai_key'}); });
    wrap.appendChild(kb);
  }

  // Snapshot ao vivo
  var snap = ST.snapshot;
  if (snap) wrap.appendChild(renderSnapshotBar(snap));
  else {
    var fetchBtn = div('banner banner-warn', null, { cursor:'pointer' });
    fetchBtn.innerHTML = ST.snapshotLoading ? '🌐 Buscando cotacoes em tempo real...' : '📡 Clique para carregar cotacoes ao vivo';
    fetchBtn.style.cursor = 'pointer';
    if (!ST.snapshotLoading) fetchBtn.addEventListener('click', function() {
      stateSet({ snapshotLoading: true }); render();
      fetchAllMarketData().then(function() { render(); });
    });
    wrap.appendChild(fetchBtn);
  }

  if (ST.generating) {
    var sw = div('spinner-wrap');
    sw.appendChild(div('spinner'));
    var progTitle = p(''); progTitle.style.cssText = 'font-size:16px;color:var(--t2);margin-bottom:18px;font-weight:500';
    progTitle.textContent = 'Agentes IA analisando o mercado...';
    sw.appendChild(progTitle);
    var pl = div('');
    ST.progress.forEach(function(prog) {
      sw.appendChild(div('prog-item ' + prog.status, prog.label));
    });
    sw.appendChild(pl);
    wrap.appendChild(sw);
    return wrap;
  }

  if (!ST.brief) {
    var em = div('empty-state');
    em.innerHTML = '<div class="empty-icon">⚡</div><div class="empty-title">Pronto para analisar</div><div class="empty-sub">Selecione seu perfil acima e clique em "Gerar Plano do Dia" para receber instruções claras: o que comprar, vender ou esperar hoje.</div>';
    wrap.appendChild(em);
    wrap.appendChild(renderDisclaimer());
    return wrap;
  }

  if (ST.brief._error) {
    wrap.appendChild(div('banner banner-err', '⚠ Erro ao processar resposta da IA. Tente novamente ou veja "Outputs IA".'));
    wrap.appendChild(renderDisclaimer());
    return wrap;
  }

  var mb = ST.brief;
  var grid = div('grid2');

  // G1: FACT_CHECKER SEAL — validação de dados
  var fc = ST.factCheckerResult || (mb._factChecker) || null;
  if (fc || ST.factCheckerTs) {
    var fcCard = div('');
    fcCard.style.cssText = 'margin-bottom:16px';
    fcCard.appendChild(renderFactCheckerSeal(fc, ST.factCheckerTs));
    wrap.appendChild(fcCard);
  }

  // ---- BLOCO PRINCIPAL: O QUE FAZER AGORA ----
  var acoes = mb.acoes_imediatas || [];
  var b0 = div('card card-blue col2');
  var b0title = div('card-title'); b0title.innerHTML = '🎯 O QUE FAZER AGORA';
  b0.appendChild(b0title);

  // Resumo leigo — destaque principal
  if (mb.resumo_leigo) {
    var rl = div('');
    rl.style.cssText = 'background:rgba(59,159,255,.07);border:1px solid rgba(59,159,255,.2);border-radius:14px;padding:18px 22px;margin-bottom:20px;position:relative;overflow:hidden';
    var rlIcon = span(''); rlIcon.style.cssText = 'font-size:28px;display:block;margin-bottom:8px';
    rlIcon.textContent = getSemaforoEmoji(mb.semaforo);
    var rlText = p('');
    rlText.style.cssText = 'font-size:17px;line-height:1.7;color:var(--t1);font-weight:400';
    rlText.textContent = mb.resumo_leigo;
    append(rl, rlIcon, rlText);
    b0.appendChild(rl);
  }

  // Acoes imediatas — cards grandes e coloridos
  if (acoes.length) {
    var acGrid = div('');
    acGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-bottom:4px';
    acoes.forEach(function(ac) {
      var acCard = renderAcaoCard(ac);
      acGrid.appendChild(acCard);
    });
    b0.appendChild(acGrid);
  }
  grid.appendChild(b0);

  // ---- SEMAFORO ----
  var semaCard = div('card card-gold');
  var semTitle = div('card-title'); semTitle.innerHTML = '🚦 SEMAFORO DO DIA';
  semaCard.appendChild(semTitle);

  var semColor = { verde: 'var(--green)', amarelo: 'var(--amber)', vermelho: 'var(--red)' };
  var semEmoji = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' };
  var semLabel = { verde: 'TUDO BEM — Bom momento para operar', amarelo: 'ATENCAO — Opere com cautela', vermelho: 'PERIGO — Reduza exposicao' };
  var semVal = mb.semaforo || 'amarelo';

  var semCircle = div('');
  semCircle.style.cssText = 'text-align:center;padding:20px 0';
  var semEmojiEl = p(''); semEmojiEl.style.cssText = 'font-size:52px;line-height:1;margin-bottom:10px';
  semEmojiEl.textContent = semEmoji[semVal] || '🟡';
  var semLabelEl = p(''); semLabelEl.style.cssText = 'font-size:15px;font-weight:700;color:' + (semColor[semVal] || 'var(--amber)');
  semLabelEl.textContent = semLabel[semVal] || semVal.toUpperCase();
  var semMotivo = p(''); semMotivo.style.cssText = 'font-size:13px;color:var(--t2);margin-top:8px;line-height:1.5';
  semMotivo.textContent = mb.semaforo_motivo || '';
  append(semCircle, semEmojiEl, semLabelEl, semMotivo);
  semaCard.appendChild(semCircle);
  grid.appendChild(semaCard);

  // ---- RESUMO EXECUTIVO ----
  var b1 = div('card card-blue');
  b1.appendChild(div('card-title', '📋 RESUMO DO CENARIO'));
  var resumoEl = p('');
  resumoEl.style.cssText = 'font-size:15px;line-height:1.75;color:var(--t1)';
  resumoEl.textContent = mb.resumo_executivo || '—';
  b1.appendChild(resumoEl);
  grid.appendChild(b1);

  // ---- CRIPTO ----
  var cripto = mb.mercado_cripto || {};
  if (Object.keys(cripto).length) {
    var cCard = div('card card-purple');
    cCard.appendChild(div('card-title', '₿ CRIPTO'));
    cCard.appendChild(renderSinalMercado('Bitcoin (BTC)', cripto.btc_sinal, cripto.btc_motivo));
    cCard.appendChild(renderSinalMercado('Ethereum (ETH)', cripto.eth_sinal, cripto.eth_motivo));
    if (cripto.outros) {
      var outrosEl = p(''); outrosEl.style.cssText = 'font-size:13px;color:var(--t3);margin-top:8px';
      outrosEl.textContent = cripto.outros;
      cCard.appendChild(outrosEl);
    }
    grid.appendChild(cCard);
  }

  // ---- CAMBIO E METAIS ----
  var cambio = mb.mercado_cambio || {};
  if (Object.keys(cambio).length) {
    var camCard = div('card card-gold');
    camCard.appendChild(div('card-title', '💵 DOLAR E OURO'));
    camCard.appendChild(renderSinalMercado('Dolar (USD/BRL)', cambio.dolar_sinal, cambio.dolar_motivo));
    camCard.appendChild(renderSinalMercado('Ouro', cambio.ouro_sinal, cambio.ouro_motivo));
    grid.appendChild(camCard);
  }

  // ---- MERCADO BRASILEIRO ----
  var mbr = mb.mercado_br || {};
  if (Object.keys(mbr).length) {
    var mbrCard = div('card card-green');
    mbrCard.appendChild(div('card-title', '🇧🇷 BOLSA E RENDA FIXA'));
    mbrCard.appendChild(renderSinalMercado('Bolsa Brasileira (IBOV)', mbr.bolsa_sinal, mbr.bolsa_motivo));
    mbrCard.appendChild(renderSinalMercado('Renda Fixa (CDB/Tesouro)', mbr.renda_fixa_sinal, mbr.renda_fixa_motivo));
    grid.appendChild(mbrCard);
  }

  // ---- NAO FACA HOJE ----
  var naoFaca = mb.nao_faca_hoje || [];
  if (naoFaca.length) {
    var nfCard = div('card card-red col2');
    nfCard.appendChild(div('card-title', '⛔ NAO FACA HOJE'));
    naoFaca.forEach(function(item) {
      var r = div('');
      r.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;color:var(--t2)';
      var ic = span(''); ic.style.cssText = 'color:var(--red);flex-shrink:0;font-size:16px';
      ic.textContent = '✗';
      var tx = document.createTextNode(' ' + item);
      append(r, ic, tx);
      nfCard.appendChild(r);
    });
    grid.appendChild(nfCard);
  }

  // ---- OPORTUNIDADES ----
  var opps = mb.opportunities_cards || [];
  if (opps.length) {
    var oppCard = div('card card-green col2');
    oppCard.appendChild(div('card-title', '🎯 OPORTUNIDADES — PERFIL: ' + RISK_PROFILES[ST.riskProfile].label.toUpperCase()));
    opps.forEach(function(o) { oppCard.appendChild(renderOppCard(o)); });
    grid.appendChild(oppCard);
  }

  // ---- RISCOS ----
  var risks = mb.risks_top5 || [];
  if (risks.length) {
    var riskCard = div('card card-red');
    riskCard.appendChild(div('card-title', '⚠️ RISCOS DO DIA'));
    risks.forEach(function(r, i) {
      var row = div('');
      row.style.cssText = 'display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:14px;color:var(--t2)';
      var num = span(''); num.style.cssText = 'color:var(--red);font-size:11px;font-family:JetBrains Mono,monospace;flex-shrink:0;padding-top:2px';
      num.textContent = (i+1) + '.';
      var tx = document.createTextNode(r);
      append(row, num, tx);
      riskCard.appendChild(row);
    });
    grid.appendChild(riskCard);
  }

  // ---- CHECKLIST ----
  var cl = mb.checklist || {};
  if ((cl.fazer && cl.fazer.length) || (cl.evitar && cl.evitar.length)) {
    var clCard = div('card card-blue col2');
    clCard.appendChild(div('card-title', '✅ CHECKLIST DO DIA'));
    var clGrid = div('check-grid');
    var fazCol = div('');
    fazCol.appendChild(div('check-title', '✅ FAZER'));
    (cl.fazer||[]).forEach(function(item) {
      var ci = div('check-item');
      var mk = span(''); mk.style.color='var(--green)'; mk.textContent='›';
      append(ci, mk, document.createTextNode(' ' + item));
      fazCol.appendChild(ci);
    });
    var evCol = div('');
    evCol.appendChild(div('check-title', '⛔ EVITAR'));
    (cl.evitar||[]).forEach(function(item) {
      var ci = div('check-item');
      var mk = span(''); mk.style.color='var(--red)'; mk.textContent='›';
      append(ci, mk, document.createTextNode(' ' + item));
      evCol.appendChild(ci);
    });
    append(clGrid, fazCol, evCol);
    clCard.appendChild(clGrid);
    grid.appendChild(clCard);
  }

  wrap.appendChild(grid);
  wrap.appendChild(renderDisclaimer());
  return wrap;
}

function getSemaforoEmoji(s) {
  if (s === 'verde') return '🟢';
  if (s === 'vermelho') return '🔴';
  return '🟡';
}

// Card de acao (COMPRAR/VENDER/ESPERAR)
function renderAcaoCard(ac) {
  var acao = (ac.acao || 'ESPERAR').toUpperCase();
  var colors = {
    COMPRAR: { bg: 'rgba(50,215,75,.1)', border: 'rgba(50,215,75,.3)', color: 'var(--green)', icon: '📈 COMPRAR' },
    VENDER:  { bg: 'rgba(255,69,58,.1)',  border: 'rgba(255,69,58,.3)',  color: 'var(--red)',   icon: '📉 VENDER' },
    ESPERAR: { bg: 'rgba(255,255,255,.05)', border: 'rgba(255,255,255,.12)', color: 'var(--t2)', icon: '⏸ ESPERAR' },
    PROTEGER:{ bg: 'rgba(255,214,10,.08)', border: 'rgba(255,214,10,.25)', color: 'var(--amber)', icon: '🛡 PROTEGER' }
  };
  var style = colors[acao] || colors['ESPERAR'];

  var card = div('');
  card.style.cssText = 'background:' + style.bg + ';border:2px solid ' + style.border + ';border-radius:16px;padding:18px;transition:all .2s';

  var topRow = div('');
  topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  var acaoLabel = span('');
  acaoLabel.style.cssText = 'font-size:12px;font-weight:800;color:' + style.color + ';letter-spacing:1px';
  acaoLabel.textContent = style.icon;

  var urgIcon = span('');
  var urgColors = { AGORA:'var(--red)', ESTA_SEMANA:'var(--amber)', PROXIMO_MES:'var(--t3)' };
  var urgText = { AGORA:'🔥 AGORA', ESTA_SEMANA:'📅 ESTA SEMANA', PROXIMO_MES:'📆 PROXIMO MES' };
  urgIcon.style.cssText = 'font-size:10px;font-weight:700;color:' + (urgColors[ac.urgencia] || 'var(--t3)');
  urgIcon.textContent = urgText[ac.urgencia] || '';
  append(topRow, acaoLabel, urgIcon);
  card.appendChild(topRow);

  var ativoEl = p('');
  ativoEl.style.cssText = 'font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px;line-height:1.3';
  ativoEl.textContent = ac.ativo || '';
  card.appendChild(ativoEl);

  var motivoEl = p('');
  motivoEl.style.cssText = 'font-size:13px;color:var(--t2);line-height:1.55';
  motivoEl.textContent = ac.motivo_simples || '';
  card.appendChild(motivoEl);

  var risco = (ac.quanto_risco || '').toLowerCase();
  var riscoColors = { baixo:'var(--green)', medio:'var(--amber)', alto:'var(--red)' };
  if (risco) {
    var riscoEl = span('');
    riscoEl.style.cssText = 'font-size:10px;font-weight:700;color:' + (riscoColors[risco]||'var(--t3)') + ';display:inline-block;margin-top:8px';
    riscoEl.textContent = '• Risco: ' + risco.toUpperCase();
    card.appendChild(riscoEl);
  }
  return card;
}

// Card de sinal de mercado (linha compacta)
function renderSinalMercado(nome, sinal, motivo) {
  var s = (sinal||'ESPERAR').toUpperCase();
  var sColors = { COMPRAR:'var(--green)', VENDER:'var(--red)', ESPERAR:'var(--t3)', MANTER:'var(--t2)', AUMENTAR:'var(--green)', REDUZIR:'var(--red)' };
  var sIcons  = { COMPRAR:'📈', VENDER:'📉', ESPERAR:'⏸', MANTER:'⏸', AUMENTAR:'⬆', REDUZIR:'⬇' };

  var row = div('');
  row.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)';
  row.style.flexWrap = 'nowrap';

  var sinalBadge = span('');
  sinalBadge.style.cssText = 'min-width:90px;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:800;text-align:center;flex-shrink:0;background:' +
    (s==='COMPRAR'||s==='AUMENTAR' ? 'rgba(50,215,75,.12)' : s==='VENDER'||s==='REDUZIR' ? 'rgba(255,69,58,.12)' : 'rgba(255,255,255,.05)') +
    ';color:' + (sColors[s]||'var(--t3)') + ';border:1px solid ' +
    (s==='COMPRAR'||s==='AUMENTAR' ? 'rgba(50,215,75,.3)' : s==='VENDER'||s==='REDUZIR' ? 'rgba(255,69,58,.3)' : 'var(--border)');
  sinalBadge.textContent = (sIcons[s]||'') + ' ' + s;

  var info = div('');
  var nomeEl = p(''); nomeEl.style.cssText = 'font-size:14px;font-weight:600;color:var(--t1);margin-bottom:3px';
  nomeEl.textContent = nome;
  var motivoEl = p(''); motivoEl.style.cssText = 'font-size:12px;color:var(--t2);line-height:1.5';
  motivoEl.textContent = motivo || '';
  append(info, nomeEl, motivoEl);
  append(row, sinalBadge, info);
  return row;
}

// ================================================================
// MERCADO AO VIVO
// ================================================================
function renderMercado() {
  var wrap = div('');
  var hdr = div('page-header');
  var titleSide = div('');
  titleSide.appendChild(div('page-title', '📊 COTAÇÕES AO VIVO'));
  var sub = div('page-sub');
  sub.textContent = ST.snapshot ? 'Atualizado: ' + (ST.snapshot.quality.fetched_at || '') + ' • Fontes: ' + (ST.snapshot.quality.source || '') : 'Não carregado';
  titleSide.appendChild(sub);
  hdr.appendChild(titleSide);
  var refreshBtn = btn('btn-primary', ST.snapshotLoading ? '⚙️ Buscando...' : '🔄 Atualizar Agora', function() {
    if (!ST.snapshotLoading) { stateSet({ snapshotLoading: true }); render(); fetchAllMarketData().then(function() { render(); }); }
  }, ST.snapshotLoading);
  hdr.appendChild(refreshBtn);
  wrap.appendChild(hdr);

  if (!ST.snapshot || !Object.keys(ST.snapshot.prices || {}).length) {
    var em = div('empty-state');
    em.innerHTML = '<div class="empty-icon">📡</div><div class="empty-title">Nenhum dado carregado</div><div class="empty-sub">Clique em "Atualizar Agora" para buscar cotações da Binance, BCB e outras fontes.</div>';
    wrap.appendChild(em);
    return wrap;
  }

  var snap = ST.snapshot;
  var pricesByCategory = {};

  Object.keys(snap.prices).forEach(function(sym) {
    var info = ASSET_LABELS[sym] || { name: sym, icon: '•', cat: 'Outros', unit: '' };
    if (!pricesByCategory[info.cat]) pricesByCategory[info.cat] = [];
    pricesByCategory[info.cat].push({ sym: sym, info: info, data: snap.prices[sym] });
  });

  var catIcons = { 'Cripto':'₿', 'Câmbio':'💵', 'Commodity':'🥇', 'Bolsa BR':'🇧🇷', 'Bolsa EUA':'🇺🇸', 'Macro':'📊', 'Outros':'•' };
  var catOrder = ['Cripto','Câmbio','Commodity','Bolsa BR','Bolsa EUA','Macro','Outros'];

  catOrder.forEach(function(cat) {
    if (!pricesByCategory[cat]) return;
    var catCard = div('card card-blue');
    var catTitle = div('card-title');
    catTitle.innerHTML = '<span>' + (catIcons[cat]||'•') + '</span> ' + cat.toUpperCase();
    catCard.appendChild(catTitle);
    var grid = div('');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px';

    pricesByCategory[cat].forEach(function(item) {
      var d = item.data;
      var info = item.info;
      var chg = d.chg24h_pct;
      var iUp = chg != null && chg > 0;
      var isDn = chg != null && chg < 0;

      var card = div('');
      card.style.cssText = 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px;position:relative;overflow:hidden';

      // Topo com icone e nome
      var topR = div('');
      topR.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px';
      var iconEl = span(''); iconEl.style.cssText = 'font-size:20px'; iconEl.textContent = info.icon;
      var nameEl = p(''); nameEl.style.cssText = 'font-size:12px;font-weight:600;color:var(--t2);line-height:1.3';
      nameEl.textContent = info.name;
      append(topR, iconEl, nameEl);
      card.appendChild(topR);

      // Preco principal
      var priceEl = p('');
      priceEl.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:20px;font-weight:700;color:var(--t1);margin-bottom:5px;line-height:1';
      var val = d.last;
      if (info.unit === 'BRL') priceEl.textContent = 'R$ ' + (val||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:4 });
      else if (info.unit === 'USD') priceEl.textContent = '$ ' + (val||0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
      else if (info.unit === '%') priceEl.textContent = (val||0).toFixed(1) + '%';
      else priceEl.textContent = (val||0).toLocaleString('pt-BR');
      card.appendChild(priceEl);

      // Variacao 24h
      if (chg != null) {
        var chgEl = span('');
        chgEl.style.cssText = 'font-size:13px;font-weight:700;font-family:JetBrains Mono,monospace;color:' + (iUp?'var(--green)':isDn?'var(--red)':'var(--t3)');
        chgEl.textContent = (iUp?'▲ +':isDn?'▼ ':' ') + chg.toFixed(2) + '% hoje';
        card.appendChild(chgEl);
      }

      // Mini sinal visual
      var sinalSimples = getSinalSimples(chg, cat);
      if (sinalSimples) {
        var ss = span('');
        ss.style.cssText = 'font-size:10px;font-weight:700;display:block;margin-top:7px;padding:3px 8px;border-radius:20px;width:fit-content;' + sinalSimples.style;
        ss.textContent = sinalSimples.text;
        card.appendChild(ss);
      }

      // Source
      if (d.source) {
        var srcEl = span('');
        srcEl.style.cssText = 'font-size:9px;color:var(--t3);position:absolute;top:10px;right:12px';
        srcEl.textContent = d.source;
        card.appendChild(srcEl);
      }

      grid.appendChild(card);
    });

    catCard.appendChild(grid);
    wrap.appendChild(catCard);
  });

  // Macro BCB
  if (snap.macro_br) {
    var macroCard = div('card card-green');
    macroCard.appendChild(div('card-title', '🏛️ DADOS MACRO BRASIL (BCB)'));
    var macro = snap.macro_br;
    var macroGrid = div('');
    macroGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px';
    var macroItems = [
      { label:'SELIC Meta', value: macro.selic ? macro.selic + '%' : 'N/D', desc:'Taxa basica de juros BR' },
      { label:'PTAX Venda (BCB)', value: macro.ptax_venda ? 'R$ ' + macro.ptax_venda.toFixed(4) : 'N/D', desc:'Cotacao oficial do BCB' },
      { label:'PTAX Compra (BCB)', value: macro.ptax_compra ? 'R$ ' + macro.ptax_compra.toFixed(4) : 'N/D', desc:'Cotacao oficial do BCB' }
    ];
    macroItems.forEach(function(mi) {
      var mc = div('');
      mc.style.cssText = 'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px';
      var lb = p(''); lb.style.cssText = 'font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;font-weight:700';
      lb.textContent = mi.label;
      var vl = p(''); vl.style.cssText = 'font-size:20px;font-weight:700;color:var(--t1);font-family:JetBrains Mono,monospace;margin-bottom:3px';
      vl.textContent = mi.value;
      var dc = p(''); dc.style.cssText = 'font-size:11px;color:var(--t3)';
      dc.textContent = mi.desc;
      append(mc, lb, vl, dc);
      macroGrid.appendChild(mc);
    });
    macroCard.appendChild(macroGrid);
    wrap.appendChild(macroCard);
  }

  wrap.appendChild(renderDisclaimer());
  return wrap;
}

// Gera sinal simples baseado em variacao do dia
function getSinalSimples(chg, cat) {
  if (chg == null) return null;
  if (chg > 3) return { text:'🔥 Alta forte', style:'background:rgba(50,215,75,.12);color:var(--green);border:1px solid rgba(50,215,75,.25)' };
  if (chg > 1) return { text:'📈 Subindo', style:'background:rgba(50,215,75,.08);color:var(--green);border:1px solid rgba(50,215,75,.15)' };
  if (chg < -3) return { text:'🔻 Queda forte', style:'background:rgba(255,69,58,.12);color:var(--red);border:1px solid rgba(255,69,58,.25)' };
  if (chg < -1) return { text:'📉 Caindo', style:'background:rgba(255,69,58,.08);color:var(--red);border:1px solid rgba(255,69,58,.15)' };
  return { text:'➡ Estavel', style:'background:rgba(255,255,255,.04);color:var(--t3);border:1px solid rgba(255,255,255,.08)' };
}

// ================================================================
// SNAPSHOT BAR (dashboard compacto)
// ================================================================
function renderSnapshotBar(snap) {
  var bar = div('snap-bar');
  var hdr = div('snap-header');
  hdr.appendChild(span('snap-lbl', '📡 MERCADO AO VIVO'));
  var quality = div('');
  quality.style.cssText = 'display:flex;align-items:center;gap:8px';
  var qualBadge = span('tag');
  qualBadge.style.color = snap.quality.partial ? 'var(--amber)' : 'var(--green)';
  qualBadge.textContent = (snap.quality.partial ? '⚠ Parcial' : '✓ Completo') + ' — ' + (snap.quality.fetched_at || '');
  quality.appendChild(qualBadge);
  var refreshMini = btn('btn-secondary', '🔄', function() {
    fetchAllMarketData().then(function() { render(); });
  });
  refreshMini.style.cssText = 'padding:4px 10px;font-size:12px;min-width:unset';
  quality.appendChild(refreshMini);
  hdr.appendChild(quality);
  bar.appendChild(hdr);

  var grid = div('snap-grid');
  // Mostra os principais
  var priority = ['BTCUSDT','ETHUSDT','USDBRL','XAUUSD','IBOV','SPX'];
  var shown = [];
  priority.forEach(function(sym) { if (snap.prices[sym]) shown.push(sym); });
  Object.keys(snap.prices).forEach(function(sym) { if (shown.indexOf(sym) < 0) shown.push(sym); });

  shown.slice(0, 10).forEach(function(sym) {
    var d = snap.prices[sym];
    if (!d) return;
    var info = ASSET_LABELS[sym] || { name: sym, icon: '•', unit: '' };
    var item = div('snap-item');
    var symEl = div('snap-sym'); symEl.textContent = info.icon + ' ' + sym.replace('USDT','');
    var valEl = div('snap-val');
    var val = d.last || 0;
    if (info.unit === 'BRL') valEl.textContent = 'R$' + val.toLocaleString('pt-BR', { maximumFractionDigits:2 });
    else if (info.unit === 'USD') valEl.textContent = '$' + val.toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
    else if (info.unit === '%') valEl.textContent = val.toFixed(1) + '%';
    else valEl.textContent = val.toLocaleString('pt-BR');

    item.appendChild(symEl);
    item.appendChild(valEl);

    if (d.chg24h_pct != null) {
      var chgEl = div('snap-chg ' + (d.chg24h_pct >= 0 ? 'pos' : 'neg'));
      chgEl.textContent = (d.chg24h_pct >= 0 ? '+' : '') + d.chg24h_pct.toFixed(2) + '%';
      item.appendChild(chgEl);
    }
    grid.appendChild(item);
  });
  bar.appendChild(grid);
  return bar;
}

// ================================================================
// OPPORTUNITIES
// ================================================================
function renderOpportunities() {
  var opps = ST.brief ? (ST.brief.opportunities_cards || []) : [];
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '🎯 O QUE FAZER AGORA'));
  t.appendChild(div('page-sub', 'Acoes recomendadas — Perfil: ' + RISK_PROFILES[ST.riskProfile].label));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  // Acoes imediatas (destaque)
  var acoes = ST.brief ? (ST.brief.acoes_imediatas || []) : [];
  if (acoes.length) {
    var acCard = div('card card-blue');
    acCard.appendChild(div('card-title', '⚡ ACOES IMEDIATAS'));
    var acGrid = div('');
    acGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px';
    acoes.forEach(function(ac) { acGrid.appendChild(renderAcaoCard(ac)); });
    acCard.appendChild(acGrid);
    wrap.appendChild(acCard);
  }

  if (!opps.length) {
    var em = div('empty-state');
    em.innerHTML = '<div class="empty-icon">🎯</div><div class="empty-title">Gere o Plano do Dia primeiro</div><div class="empty-sub">Vá em "Morning Brief" e clique em "Gerar Plano do Dia" para receber instruções personalizadas.</div>';
    wrap.appendChild(em);
  } else {
    var oppTitle = div('card-title');
    oppTitle.innerHTML = '📋 OPORTUNIDADES FILTRADAS — ' + RISK_PROFILES[ST.riskProfile].label.toUpperCase();
    oppTitle.style.marginBottom = '14px';
    wrap.appendChild(oppTitle);
    opps.forEach(function(o) { wrap.appendChild(renderOppCard(o)); });
  }
  wrap.appendChild(renderDisclaimer());
  return wrap;
}

// ================================================================
// OPP CARD
// ================================================================
function renderOppCard(o) {
  var acao = (o.acao || 'ESPERAR').toUpperCase();
  var acColors = {
    COMPRAR:'rgba(50,215,75,.12)', VENDER:'rgba(255,69,58,.12)',
    ESPERAR:'rgba(255,255,255,.04)', PROTEGER:'rgba(255,214,10,.08)'
  };
  var card = div('opp-card');
  card.style.background = acColors[acao] || acColors['ESPERAR'];

  var top = div('opp-top');
  top.appendChild(span('opp-cls', o.classe || ''));
  var actEl = span('opp-act ' + (acao==='COMPRAR'?'act-sim':acao==='VENDER'?'act-mon':'act-mon'));
  actEl.textContent = acao;
  top.appendChild(actEl);
  card.appendChild(top);
  card.appendChild(div('opp-thesis', o.tese || o.thesis || ''));

  if (o.gatilho) {
    var gd = div('opp-detail');
    gd.innerHTML = '<strong>QUANDO ENTRAR</strong>';
    gd.appendChild(document.createTextNode(o.gatilho));
    card.appendChild(gd);
  }
  if (o.invalidacao) {
    var id2 = div('opp-detail');
    id2.innerHTML = '<strong>QUANDO SAIR / SE ERROU</strong>';
    id2.appendChild(document.createTextNode(o.invalidacao));
    card.appendChild(id2);
  }
  if (o.riscos && o.riscos.length) {
    var rr = div('opp-risks');
    o.riscos.forEach(function(r) { rr.appendChild(span('risk-tag', r)); });
    card.appendChild(rr);
  }
  var confCls = o.confianca==='alta' ? 'conf-high' : o.confianca==='media' ? 'conf-med' : 'conf-low';
  card.appendChild(span('conf-badge ' + confCls, (o.confianca||'').toUpperCase() + ' CONFIANCA'));
  return card;
}

function renderDisclaimer() {
  var d = div('disclaimer');
  d.innerHTML = '⚠️ <strong>Conteúdo educacional.</strong> Não constitui recomendação individual. Todo investimento tem risco. Decisões são de exclusiva responsabilidade do investidor.';
  return d;
}

// ================================================================
// PORTFOLIO
// ================================================================
function renderPortfolio() {
  var total = Object.values(ST.portfolio).reduce(function(a,b){return a+b;},0);
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '💼 MINHA CARTEIRA'));
  t.appendChild(div('page-sub', 'Alocacao atual — Soma: ' + total + '%'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var card = div('card card-blue');
  card.appendChild(div('card-title', 'AJUSTE SUA ALOCACAO (%)'));
  var hint = p(''); hint.style.cssText = 'font-size:14px;color:var(--t2);margin-bottom:18px';
  hint.textContent = 'Arraste os controles para ajustar quanto deseja em cada tipo de ativo:';
  card.appendChild(hint);

  Object.keys(ST.portfolio).forEach(function(cls) {
    var row = div('slider-row');
    var lbl = el('label', {}, cls);
    var slider = el('input', { type:'range', min:'0', max:'100' });
    slider.value = String(ST.portfolio[cls]);
    var valEl = div('slider-val', ST.portfolio[cls] + '%');
    slider.addEventListener('input', function(e) {
      var newPct = parseInt(e.target.value);
      ST.portfolio[cls] = newPct;
      valEl.textContent = newPct + '%';
      storeSet('cio_portfolio', ST.portfolio);
    });
    append(row, lbl, slider, valEl);
    card.appendChild(row);
  });

  if (total !== 100) {
    var warn = p(''); warn.style.cssText = 'font-size:13px;color:var(--amber);margin-top:8px;font-weight:500';
    warn.textContent = '⚠️ Total: ' + total + '% (ideal: 100%)';
    card.appendChild(warn);
  }
  wrap.appendChild(card);

  var allocGrid = div('alloc-grid');
  Object.keys(ST.portfolio).forEach(function(cls) {
    var v = ST.portfolio[cls];
    var ac = div('alloc-card');
    ac.appendChild(div('alloc-cls', cls));
    ac.appendChild(div('alloc-pct', v + '%'));
    var bar = div('alloc-bar');
    var fill = div('alloc-fill'); fill.style.width = v + '%';
    bar.appendChild(fill);
    ac.appendChild(bar);
    allocGrid.appendChild(ac);
  });
  wrap.appendChild(allocGrid);
  return wrap;
}

// ================================================================
// AGENTS
// ================================================================
function renderAgents() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '🤖 AGENTES IA'));
  t.appendChild(div('page-sub', Object.keys(AGENTS).length + ' especialistas financeiros'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var grid = div('agent-grid');
  Object.keys(AGENTS).forEach(function(id) {
    var ag = AGENTS[id];
    var card = div('agent-card');
    card.appendChild(div('agent-name', id));
    card.appendChild(div('agent-ver', 'v3.0'));
    card.appendChild(div('agent-desc', ag.desc));
    var stylesWrap = div(''); stylesWrap.style.marginBottom = '8px';
    ag.styles.forEach(function(s) { stylesWrap.appendChild(span('agent-style', s)); });
    card.appendChild(stylesWrap);
    var pipesWrap = div(''); pipesWrap.style.marginBottom = '12px';
    if (ag.pipeline.indexOf('daily')>=0) pipesWrap.appendChild(span('ptag ptag-d', '⚡ Rapido'));
    if (ag.pipeline.indexOf('deep')>=0) pipesWrap.appendChild(span('ptag ptag-dd', '🔬 Completo'));
    card.appendChild(pipesWrap);
    var resultEl = div('');
    var testBtn = btn('btn-secondary', '▶ Testar', function() {
      if (!AIKEY.get()) { alert('Configure a API Key primeiro.'); return; }
      testBtn.disabled = true; testBtn.textContent = 'Analisando...';
      var snap = ST.snapshot || { prices: {}, macro_br: {}, events: [], news: [], quality: { source:'test' } };
      var prompt = buildPrompt(id, snap, ST.riskProfile, ST.config.horizon || 'medio', {});
      callAI(prompt.sys, prompt.usr, 500).then(function(result) {
        resultEl.className = 'agent-result';
        var preview = result.thesis ? result.thesis.slice(0,2).join(' | ') : JSON.stringify(result).slice(0,200);
        resultEl.textContent = preview + '...';
        addLog('TEST_' + id, 'ok', '');
      }).catch(function(e) {
        resultEl.className = 'agent-result';
        resultEl.style.color = 'var(--red)';
        resultEl.textContent = 'Erro: ' + e.message;
      }).then(function() { testBtn.disabled = false; testBtn.textContent = '▶ Testar'; });
    });
    append(card, resultEl, testBtn);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

// ================================================================
// AGENT OUTPUTS
// ================================================================
function renderAgentOutputs() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '🧠 OUTPUTS IA'));
  t.appendChild(div('page-sub', 'Resultado bruto do ultimo pipeline'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var outputs = ST.agentOutputs;
  if (!Object.keys(outputs).length) {
    var em = div('empty-state');
    em.innerHTML = '<div class="empty-icon">🧠</div><div class="empty-title">Nada ainda</div><div class="empty-sub">Gere um Plano do Dia para ver os outputs de cada agente.</div>';
    wrap.appendChild(em);
    return wrap;
  }

  var pipeline = ST.pipeline === 'daily' ? DAILY_PIPELINE : DEEP_PIPELINE;
  var grid = div('agent-grid');
  pipeline.filter(function(id) { return outputs[id]; }).forEach(function(id) {
    var out = outputs[id];
    var expanded = false;
    var detailEl = div('');
    var card = div('');
    card.style.cssText = 'background:var(--glass-1);border:1px solid var(--border);border-radius:16px;padding:18px;cursor:pointer;transition:all .2s';
    var topRow = div('');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
    var nameEl = span(''); nameEl.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:13px;color:var(--blue);font-weight:600';
    nameEl.textContent = id;
    var stEl = span(''); stEl.style.cssText = 'font-size:10px;font-weight:700;color:' + (out.parse_error ? 'var(--red)' : 'var(--green)');
    stEl.textContent = out.parse_error ? '⚠ ERRO' : '✓ OK';
    append(topRow, nameEl, stEl);
    card.appendChild(topRow);
    (out.thesis || []).slice(0,2).forEach(function(th) {
      var tp = p(''); tp.style.cssText = 'font-size:13px;color:var(--t2);line-height:1.5;padding:2px 0';
      tp.textContent = '› ' + th;
      card.appendChild(tp);
    });
    card.appendChild(detailEl);
    card.addEventListener('click', function() {
      expanded = !expanded; detailEl.innerHTML = '';
      if (expanded) {
        var pre = el('pre', { style:{ background:'rgba(0,0,0,.4)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px', fontSize:'11px', color:'var(--t2)', lineHeight:'1.6', overflow:'auto', maxHeight:'220px', marginTop:'12px', whiteSpace:'pre-wrap' } });
        pre.textContent = JSON.stringify(out, null, 2);
        detailEl.appendChild(pre);
      }
    });
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

// ================================================================
// AI KEY
// ================================================================
function renderAIKey() {
  var hasKey = !!AIKEY.get();
  var existingKey = AIKEY.get();
  var wrap = div('');

  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '🔑 IA & CHAVE API'));
  t.appendChild(div('page-sub', 'Configure o cérebro de IA — Gemini é GRATUITO'));
  hdr.appendChild(t);
  if (hasKey) {
    var badge = div('', null, { display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', background:'var(--glow-green)', border:'1px solid rgba(50,215,75,.25)', borderRadius:'10px' });
    badge.innerHTML = '<span class="ai-dot on"></span><span style="font-size:13px;color:var(--green);font-weight:600">IA Ativa — ' + (ST.aiCfg.provider === 'gemini' ? 'Gemini Free' : ST.aiCfg.provider === 'openai' ? 'OpenAI' : 'Anthropic') + '</span>';
    hdr.appendChild(badge);
  }
  wrap.appendChild(hdr);

  var hero = div('key-hero');
  hero.innerHTML = '<div class="key-hero-icon">🔑</div><div class="key-hero-title">Conecte sua IA</div><div class="key-hero-sub">Este app usa <strong>exclusivamente Gemini Free-Tier</strong>. Cole sua chave gratuita do Google AI Studio para ativar os 5 agentes de análise.</div>';
  wrap.appendChild(hero);

  var PROVIDERS = {
    anthropic: { name:'Anthropic Claude', icon:'🧠', desc:'Alta qualidade para análise. Pago.', link:'https://console.anthropic.com/', models:[{id:'claude-sonnet-4-20250514',label:'Claude Sonnet 4 (recomendado)'},{id:'claude-haiku-4-5-20251001',label:'Claude Haiku 4.5 (economico)'}] },
    openai:    { name:'OpenAI GPT', icon:'⚡', desc:'GPT-4o muito capaz. Pago.', link:'https://platform.openai.com/api-keys', models:[{id:'gpt-4o',label:'GPT-4o (recomendado)'},{id:'gpt-4o-mini',label:'GPT-4o mini (economico)'}] },
    gemini:    { name:'Google Gemini ⭐ GRATIS', icon:'♊', desc:'Gemini 2.0 Flash — GRATUITO. Sem cartão. Perfeito para começar.', link:'https://aistudio.google.com/app/apikey', models:[{id:'gemini-2.0-flash',label:'Gemini 2.0 Flash (gratis - recomendado)'},{id:'gemini-2.0-flash-lite',label:'Gemini 2.0 Flash Lite (mais leve)'},{id:'gemini-1.5-pro',label:'Gemini 1.5 Pro (pago)'}] }
  };

  var provCard = div('card card-blue');
  provCard.appendChild(div('card-title', '1 — ESCOLHA O PROVEDOR'));

  var provGrid = div('prov-grid');
  provGrid.style.gridTemplateColumns = 'repeat(3,1fr)';
  ['anthropic','openai','gemini'].forEach(function(pid) {
    var info = PROVIDERS[pid];
    var pc = div('prov-card' + (ST.aiCfg.provider===pid ? ' on':''));
    if (pid === 'gemini') pc.style.borderColor = ST.aiCfg.provider==='gemini' ? 'var(--blue)' : 'rgba(50,215,75,.3)';
    pc.innerHTML = '<div class="prov-logo">' + info.icon + '</div><div class="prov-name">' + info.name + '</div><div class="prov-desc">' + info.desc + '</div>';
    var lnk = el('a', { class:'ks-link', href:info.link, target:'_blank', rel:'noopener' }, '→ Obter chave gratis');
    pc.appendChild(lnk);
    pc.addEventListener('click', function() {
      var nc = { provider:pid, model:info.models[0].id };
      stateSet({ aiCfg:nc }); storeSet('cio_ai_cfg', nc); render();
    });
    provGrid.appendChild(pc);
  });
  provCard.appendChild(provGrid);

  var modelFg = div('fg');
  modelFg.appendChild(el('label', {}, 'MODELO'));
  var modelSel = el('select', { class:'select', onchange:function(e) {
    var nc = Object.assign({}, ST.aiCfg, { model:e.target.value });
    stateSet({ aiCfg:nc }); storeSet('cio_ai_cfg', nc);
  }});
  var models = PROVIDERS[ST.aiCfg.provider] ? PROVIDERS[ST.aiCfg.provider].models : PROVIDERS.gemini.models;
  models.forEach(function(m) {
    var opt = el('option', { value:m.id }, m.label);
    if (m.id === ST.aiCfg.model) opt.selected = true;
    modelSel.appendChild(opt);
  });
  modelFg.appendChild(modelSel);
  provCard.appendChild(modelFg);
  wrap.appendChild(provCard);

  // Steps simplificados
  var stepsCard = div('card card-blue');
  stepsCard.appendChild(div('card-title', '2 — COMO PEGAR A CHAVE GEMINI GRATIS (2 minutos)'));
  var steps = div('key-steps');
  [
    ['01','Abra o Google AI Studio','Acesse aistudio.google.com/app/apikey com sua conta Google.'],
    ['02','Clique em Create API Key','Escolha qualquer projeto ou crie um novo. É gratuito.'],
    ['03','Copie a chave','A chave começa com AIza... Copie ela inteira.'],
    ['04','Cole aqui e salve','Cole no campo abaixo, clique Testar e depois Salvar.']
  ].forEach(function(s) {
    var ks = div('key-step');
    ks.appendChild(div('ks-num', s[0]));
    ks.appendChild(div('ks-title', s[1]));
    ks.appendChild(div('ks-desc', s[2]));
    steps.appendChild(ks);
  });
  stepsCard.appendChild(steps);
  wrap.appendChild(stepsCard);

  // Input da chave
  var inputCard = div('card card-blue');
  inputCard.appendChild(div('card-title', '3 — COLE SUA CHAVE AQUI'));
  if (existingKey && !ST.keyInput) {
    var activeBanner = div('banner banner-ok');
    activeBanner.innerHTML = '✓ Chave ativa: <span style="font-family:monospace;font-size:12px">' + existingKey.slice(0,12) + '••••••••••' + existingKey.slice(-4) + '</span>';
    activeBanner.style.marginBottom = '14px';
    inputCard.appendChild(activeBanner);
  }

  var msgEl = div('banner banner-ok'); msgEl.style.display='none';
  var keyFg = div('fg');
  keyFg.appendChild(el('label', {}, 'API KEY'));
  var keyWrap = div('key-input-wrap');
  var keyInput = el('input', { type:ST.showKey?'text':'password', class:'input',
    placeholder: existingKey ? 'Deixe em branco para manter atual' : 'AIza... (Gemini) ou sk-ant-... (Anthropic)',
    oninput: function(e) { ST.keyInput = e.target.value; }
  });
  if (ST.keyInput) keyInput.value = ST.keyInput;
  var eyeBtn = el('button', { class:'key-eye', onclick:function() {
    ST.showKey = !ST.showKey; keyInput.type = ST.showKey?'text':'password'; eyeBtn.textContent = ST.showKey?'🙈':'👁️';
  }}, ST.showKey?'🙈':'👁️');
  append(keyWrap, keyInput, eyeBtn);
  append(keyFg, keyWrap);
  inputCard.appendChild(keyFg);

  var actRow = div('', null, { display:'flex', gap:'10px', flexWrap:'wrap' });
  var testBtn = btn('btn-primary', '▶ Testar Conexão', function() {
    var key = ST.keyInput || existingKey;
    if (!key) { msgEl.className='banner banner-err'; msgEl.textContent='Cole uma chave primeiro.'; msgEl.style.display='flex'; return; }
    testBtn.disabled=true; testBtn.textContent='⚙️ Testando...';
    var prevKey = AIKEY.get(); AIKEY.set(key);
    callAI('Responda apenas com JSON valido.', '{"ping":true}', 50).then(function() {
      msgEl.className='banner banner-ok'; msgEl.textContent='✓ Chave válida! IA conectada com ' + (ST.aiCfg.provider==='gemini'?'Gemini Free':ST.aiCfg.provider==='openai'?'OpenAI':'Anthropic');
    }).catch(function(e) {
      AIKEY.set(prevKey); msgEl.className='banner banner-err'; msgEl.textContent='✗ Erro: ' + e.message;
    }).then(function() { msgEl.style.display='flex'; testBtn.disabled=false; testBtn.textContent='▶ Testar Conexão'; });
  });
  var saveBtn = btn('btn-green btn', '💾 Salvar Chave', function() {
    var key = ST.keyInput || existingKey;
    if (!key) { msgEl.className='banner banner-err'; msgEl.textContent='Nenhuma chave para salvar.'; msgEl.style.display='flex'; return; }
    AIKEY.set(key); ST.keyInput = '';
    msgEl.className='banner banner-ok'; msgEl.textContent='✓ Chave salva! Pronto para gerar o Plano do Dia.';
    msgEl.style.display='flex'; render();
  });
  actRow.appendChild(testBtn); actRow.appendChild(saveBtn);
  if (existingKey) {
    actRow.appendChild(btn('btn-secondary', '🗑 Remover', function() {
      AIKEY.clear(); ST.keyInput=''; render();
    }));
  }
  append(inputCard, actRow, msgEl);
  wrap.appendChild(inputCard);
  return wrap;
}

// ================================================================
// PROFILES
// ================================================================
function renderProfiles() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '🛡️ MEU PERFIL'));
  t.appendChild(div('page-sub', 'Escolha o perfil que representa seu apetite por risco'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var cards = div('profile-cards');
  ['CONSERVADOR','SEGURO','ARROJADO'].forEach(function(k) {
    var cfg = RISK_PROFILES[k];
    var pc = div('profile-card');
    pc.style.borderColor = ST.riskProfile===k ? cfg.color : 'var(--border)';
    pc.style.background = ST.riskProfile===k ? 'rgba(255,255,255,.06)' : 'var(--glass-1)';

    var nameEl = p(''); nameEl.style.cssText = 'font-size:24px;font-weight:700;color:' + cfg.color + ';margin-bottom:8px';
    nameEl.textContent = cfg.label;
    pc.appendChild(nameEl);
    var descEl = p(''); descEl.style.cssText = 'font-size:14px;color:var(--t2);line-height:1.6;margin-bottom:16px';
    descEl.textContent = cfg.desc;
    pc.appendChild(descEl);

    var allowedTitle = p(''); allowedTitle.style.cssText = 'font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:700';
    allowedTitle.textContent = 'Pode investir em:';
    pc.appendChild(allowedTitle);
    var allowedWrap = div(''); allowedWrap.style.marginBottom='12px';
    cfg.allowed.forEach(function(c) {
      var tg = span('tag', c);
      tg.style.cssText = 'margin-right:4px;margin-bottom:4px;display:inline-block;border-color:' + cfg.color + '44;color:' + cfg.color;
      allowedWrap.appendChild(tg);
    });
    pc.appendChild(allowedWrap);

    if (cfg.blocked.length) {
      var blockedTitle = p(''); blockedTitle.style.cssText = 'font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:700';
      blockedTitle.textContent = 'Evita:';
      pc.appendChild(blockedTitle);
      var blockedWrap = div('');
      cfg.blocked.forEach(function(c) {
        var tg = span('tag', c);
        tg.style.cssText = 'margin-right:4px;margin-bottom:4px;display:inline-block;border-color:rgba(255,69,58,.3);color:var(--red)';
        blockedWrap.appendChild(tg);
      });
      pc.appendChild(blockedWrap);
    }

    if (ST.riskProfile===k) {
      var activeLbl = p(''); activeLbl.style.cssText = 'font-size:12px;color:' + cfg.color + ';font-weight:700;margin-top:12px';
      activeLbl.textContent = '✓ PERFIL ATIVO';
      pc.appendChild(activeLbl);
    } else {
      var selBtn = btn('btn-secondary', 'Selecionar este perfil', function() { setState({ riskProfile:k }); });
      selBtn.style.marginTop = '12px';
      pc.appendChild(selBtn);
    }
    pc.addEventListener('click', function() { setState({ riskProfile:k }); });
    cards.appendChild(pc);
  });
  wrap.appendChild(cards);
  return wrap;
}

// ================================================================
// SUPABASE
// ================================================================
var SUPABASE_SQL = [
'-- NEXUS FINANCE v3.0 Schema',
'CREATE TABLE IF NOT EXISTS morning_briefs (',
'  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
'  created_at TIMESTAMPTZ DEFAULT NOW(),',
'  risk_profile TEXT, pipeline_mode TEXT,',
'  brief_json JSONB, snapshot_json JSONB,',
'  agent_bundle JSONB, username TEXT);',
'',
'CREATE TABLE IF NOT EXISTS portfolio_snapshots (',
'  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
'  created_at TIMESTAMPTZ DEFAULT NOW(),',
'  allocations JSONB NOT NULL, username TEXT);',
'',
'CREATE TABLE IF NOT EXISTS audit_logs (',
'  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
'  created_at TIMESTAMPTZ DEFAULT NOW(),',
'  username TEXT, action TEXT NOT NULL,',
'  status TEXT NOT NULL, notes TEXT);',
'',
'CREATE TABLE IF NOT EXISTS app_config (',
'  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
'  updated_at TIMESTAMPTZ DEFAULT NOW(),',
'  key TEXT UNIQUE NOT NULL, value TEXT NOT NULL);'
].join('\n');

function renderSupabase() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '🗄️ BANCO DE DADOS'));
  t.appendChild(div('page-sub', 'Supabase — Salvar historico de briefs'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var dbSt = ST.dbStatus;
  var statusEl = div('db-status ' + (ST.sbClient ? (dbSt==='ok'?'db-ok':'db-err') : 'db-off'));
  statusEl.textContent = ST.sbClient ? (dbSt==='ok'?'● Conectado':'✗ Erro') : '○ Nao configurado';
  wrap.appendChild(statusEl);

  var tabBar = div('tab-bar');
  [['config','⚙ Config'],['schema','🗃 SQL'],['history','📂 Histórico']].forEach(function(tab) {
    var tb = el('button', { class:'tab-btn'+(ST.sbTab===tab[0]?' on':''), onclick:function() {
      stateSet({ sbTab:tab[0] });
      if (tab[0]==='history' && ST.sbClient) ST.sbClient.getBriefs(20).then(function(b) { setState({ sbBriefs:b||[] }); }).catch(render);
      else render();
    }}, tab[1]);
    tabBar.appendChild(tb);
  });
  wrap.appendChild(tabBar);

  if (ST.sbTab === 'config') {
    var localCfg = Object.assign({}, ST.sbCfg);
    var msgEl = div('banner banner-ok'); msgEl.style.display='none';
    var cfgCard = div('card card-blue');
    cfgCard.appendChild(div('card-title', 'CREDENCIAIS SUPABASE'));
    var desc = p(''); desc.style.cssText='font-size:13px;color:var(--t3);margin-bottom:16px;line-height:1.7';
    desc.textContent = 'Opcional — salva histórico dos planos gerados. Acesse app.supabase.com → projeto → Settings → API.';
    cfgCard.appendChild(desc);
    var urlFg = div('fg'); urlFg.appendChild(el('label',{},'URL do Projeto'));
    var urlIn = el('input',{class:'input',type:'text',placeholder:'https://xxx.supabase.co',value:localCfg.url||'',oninput:function(e){localCfg.url=e.target.value;}});
    urlFg.appendChild(urlIn); cfgCard.appendChild(urlFg);
    var keyFg = div('fg'); keyFg.appendChild(el('label',{},'Anon Key'));
    var keyIn = el('input',{class:'input',type:'password',placeholder:'eyJhbGci...',value:localCfg.anonKey||'',oninput:function(e){localCfg.anonKey=e.target.value;}});
    keyFg.appendChild(keyIn); cfgCard.appendChild(keyFg);
    var btns = div('',null,{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'14px'});
    var testBtn = btn('btn-primary','▶ Testar',function() {
      if (!localCfg.url||!localCfg.anonKey) {msgEl.className='banner banner-err';msgEl.textContent='Preencha URL e Key.';msgEl.style.display='flex';return;}
      testBtn.disabled=true;testBtn.textContent='Testando...';
      createSB(localCfg.url,localCfg.anonKey).ping().then(function(){
        msgEl.className='banner banner-ok';msgEl.textContent='✓ Conectado!';
      }).catch(function(e){
        msgEl.className='banner banner-err';msgEl.textContent='✗ Erro: '+e.message;
      }).then(function(){msgEl.style.display='flex';testBtn.disabled=false;testBtn.textContent='▶ Testar';});
    });
    var saveBtn = btn('btn-green btn','💾 Salvar',function() {
      var nc = Object.assign({},localCfg,{enabled:true});
      storeSet('cio_sb',nc);stateSet({sbCfg:nc});
      initSupabase().then(function(){msgEl.className='banner banner-ok';msgEl.textContent='✓ Salvo!';msgEl.style.display='flex';setTimeout(render,600);});
    });
    append(btns,testBtn,saveBtn);
    if (ST.sbClient) {
      btns.appendChild(btn('btn-secondary','Desabilitar',function(){
        var nc=Object.assign({},localCfg,{enabled:false});
        storeSet('cio_sb',nc);setState({sbCfg:nc,sbClient:null,dbStatus:null});
      }));
    }
    append(cfgCard,btns,msgEl);
    wrap.appendChild(cfgCard);
  }

  if (ST.sbTab === 'schema') {
    var schCard = div('card card-blue');
    var schHdr = div('',null,{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'});
    schHdr.appendChild(div('card-title','SQL SCHEMA'));
    var cpBtn = el('button',{class:'copy-btn',onclick:function(){
      navigator.clipboard.writeText(SUPABASE_SQL).then(function(){cpBtn.textContent='✓ Copiado!';setTimeout(function(){cpBtn.textContent='Copiar SQL';},2000);});
    }},'Copiar SQL');
    schHdr.appendChild(cpBtn);
    schCard.appendChild(schHdr);
    schCard.appendChild(el('pre',{class:'sql-block'},SUPABASE_SQL));
    wrap.appendChild(schCard);
  }

  if (ST.sbTab === 'history') {
    var histCard = div('card card-blue');
    var histHdr = div('',null,{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'});
    histHdr.appendChild(div('card-title','HISTORICO DE BRIEFS'));
    histHdr.appendChild(btn('btn-primary','↺ Atualizar',function(){
      if(!ST.sbClient){alert('Conecte o Supabase.');return;}
      ST.sbClient.getBriefs(20).then(function(b){setState({sbBriefs:b||[]});}).catch(function(e){alert(e.message);});
    }));
    histCard.appendChild(histHdr);
    if (!ST.sbClient) histCard.appendChild(div('banner banner-warn','Conecte o Supabase para ver historico.'));
    else if (!ST.sbBriefs.length) histCard.appendChild(div('empty-state','<div class="empty-icon">📂</div><div class="empty-title">Sem historico</div><div class="empty-sub">Gere um brief para comecar.</div>'));
    else {
      var tbl = el('table',{class:'data-table'});
      var thead = el('thead',{},el('tr',{},[el('th',{},'Data'),el('th',{},'Perfil'),el('th',{},'Modo'),el('th',{},'JSON')]));
      var tbody = el('tbody');
      ST.sbBriefs.forEach(function(b) {
        var tr = el('tr'); tr.style.cursor='pointer';
        tr.appendChild(el('td',{style:{fontSize:'12px'}},new Date(b.created_at).toLocaleString('pt-BR')));
        var ptd = el('td'); ptd.style.cssText='font-weight:700;font-size:12px;color:'+(b.risk_profile==='CONSERVADOR'?'var(--green)':b.risk_profile==='SEGURO'?'var(--amber)':'var(--red)');
        ptd.textContent=b.risk_profile; tr.appendChild(ptd);
        tr.appendChild(el('td',{style:{fontSize:'12px'}},b.pipeline_mode));
        var cpTd=el('td'); var cpB=el('button',{class:'copy-btn',onclick:function(e){e.stopPropagation();navigator.clipboard.writeText(JSON.stringify(b.brief_json,null,2));}},'>Copy');
        cpTd.appendChild(cpB); tr.appendChild(cpTd);
        tr.addEventListener('click',function(){setState({histSelected:ST.histSelected&&ST.histSelected.id===b.id?null:b});});
        tbody.appendChild(tr);
      });
      tbl.appendChild(thead);tbl.appendChild(tbody);histCard.appendChild(tbl);
      if (ST.histSelected) {
        var det=div('',null,{marginTop:'16px'});
        var pre=el('pre',{style:{background:'rgba(0,0,0,.4)',border:'1px solid var(--border)',borderRadius:'10px',padding:'14px',fontSize:'11px',color:'var(--t2)',lineHeight:'1.6',overflow:'auto',maxHeight:'280px',whiteSpace:'pre-wrap'}});
        pre.textContent=JSON.stringify(ST.histSelected.brief_json,null,2);
        det.appendChild(pre);histCard.appendChild(det);
      }
    }
    wrap.appendChild(histCard);
  }
  return wrap;
}

// ================================================================
// AI COSTS
// ================================================================
function renderAICosts() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '💡 PIPELINE & IA'));
  t.appendChild(div('page-sub', 'Configuracao dos agentes e custos estimados'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var pipeCard = div('card card-blue');
  pipeCard.appendChild(div('card-title', 'MODO DO PIPELINE'));
  var pToggle = div('pipe-toggle'); pToggle.style.marginBottom='16px';
  append(pToggle,
    el('button',{class:'pipe-btn'+(ST.pipeline==='daily'?' on':''),onclick:function(){setState({pipeline:'daily'});}}, '⚡ Rápido (5 agentes)'),
    el('button',{class:'pipe-btn'+(ST.pipeline==='deep'?' on':''),onclick:function(){setState({pipeline:'deep'});}}, '🔬 Completo (11 agentes)')
  );
  pipeCard.appendChild(pToggle);
  var pipeInfo = div('');
  pipeInfo.style.cssText = 'display:flex;gap:20px;flex-wrap:wrap';
  [
    ['Pipeline Rapido', DAILY_PIPELINE.join(' → ')],
    ['Pipeline Completo', DEEP_PIPELINE.join(' → ')]
  ].forEach(function(row) {
    var c = div('',null,{flex:'1',minWidth:'200px'});
    var lbl = p(''); lbl.style.cssText='font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:700';
    lbl.textContent = row[0];
    var val = p(''); val.style.cssText='font-size:12px;color:var(--t2);font-family:JetBrains Mono,monospace;line-height:1.8';
    val.textContent = row[1];
    append(c,lbl,val); pipeInfo.appendChild(c);
  });
  pipeCard.appendChild(pipeInfo);
  wrap.appendChild(pipeCard);

  // G2: Free-tier status card (read-only)
  var ftCard = div('card card-green');
  ftCard.appendChild(div('card-title', 'STATUS FREE-TIER'));
  var ftStatus = div('');
  ftStatus.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 0;margin-bottom:4px';
  var ftDot = span('ai-dot ' + (ST.freeTierActive !== false ? 'on' : 'off'));
  var ftTxt = span('');
  ftTxt.style.cssText = 'font-size:22px;font-weight:900;color:' + (ST.freeTierActive !== false ? 'var(--green)' : 'var(--red)');
  ftTxt.textContent = ST.freeTierActive !== false ? 'Free-Tier ATIVO ✓' : 'MODELO PAGO DETECTADO ✗';
  append(ftStatus, ftDot, ftTxt);
  ftCard.appendChild(ftStatus);

  // Modelo ativo (read-only)
  var modelRow = div('info-row');
  modelRow.appendChild(span('info-label', 'Modelo ativo (Gemini Free)'));
  var modelVal = span('info-val');
  modelVal.style.fontFamily = 'DM Mono, monospace';
  modelVal.textContent = (ST.aiCfg || {}).model || GEMINI_DEFAULT;
  modelRow.appendChild(modelVal);
  ftCard.appendChild(modelRow);

  // FACT_CHECKER toggle (padrão ON, não pode desligar no diário)
  var fcRow = div('info-row');
  fcRow.appendChild(span('info-label', 'Validação FACT_CHECKER'));
  var fcToggle = div('');
  fcToggle.style.cssText = 'display:flex;align-items:center;gap:10px';
  var fcBadge = span('');
  fcBadge.style.cssText = 'padding:4px 12px;border-radius:50px;font-size:11px;font-weight:800;background:rgba(16,185,129,.15);color:var(--green);border:1px solid rgba(16,185,129,.3)';
  fcBadge.textContent = 'ON — Obrigatório';
  var fcNote = span('');
  fcNote.style.cssText = 'font-size:10px;color:var(--t3)';
  fcNote.textContent = '(não pode desligar no modo Diário)';
  append(fcToggle, fcBadge, fcNote);
  fcRow.appendChild(fcToggle);
  ftCard.appendChild(fcRow);

  // Última execução FACT_CHECKER
  if (ST.factCheckerTs) {
    var fcTsRow = div('info-row');
    fcTsRow.appendChild(span('info-label', 'Última validação'));
    fcTsRow.appendChild(span('info-val', new Date(ST.factCheckerTs).toLocaleString('pt-BR')));
    ftCard.appendChild(fcTsRow);
  }
  wrap.appendChild(ftCard);

  // G2: modo pipeline
  var infoCard = div('card card-blue');
  infoCard.appendChild(div('card-title', 'CONFIGURAÇÃO ATUAL'));
  [
    ['Provedor IA', 'Google Gemini (Free-tier only)'],
    ['Modelo', (ST.aiCfg||{}).model || GEMINI_DEFAULT],
    ['Max tokens/agente', '900–1800'],
    ['Free-tier ativo', ST.freeTierActive !== false ? 'Sim ✓' : 'Não ✗'],
    ['Agentes Diário', DAILY_PIPELINE.length + ' agentes (incl. FACT_CHECKER)'],
    ['Agentes Deep Dive', DEEP_PIPELINE.length + ' agentes (incl. FACT_CHECKER)'],
    ['Fontes de mercado', 'Binance · ExchangeRate · Gold-API · BCB PTAX']
  ].forEach(function(row) {
    var r = div('info-row');
    r.appendChild(span('info-label', row[0]));
    var v = span('info-val'); v.textContent = row[1]; r.appendChild(v);
    infoCard.appendChild(r);
  });
  wrap.appendChild(infoCard);
  return wrap;
}

// ================================================================
// LOGS
// ================================================================
function renderLogs() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '📋 HISTÓRICO'));
  t.appendChild(div('page-sub', ST.logs.length + ' registros nesta sessao'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var card = div('card card-blue');
  var tbl = el('table',{class:'data-table'});
  var thead = el('thead',{},el('tr',{},[el('th',{},'HORÁRIO'),el('th',{},'AÇÃO'),el('th',{},'STATUS'),el('th',{},'DETALHES/NOTAS')]));
  var tbody = el('tbody');
  if (!ST.logs.length) {
    tbody.appendChild(el('tr',{},el('td',{colspan:'4',style:{textAlign:'center',padding:'32px',color:'var(--t3)'}},'Nenhum registro ainda.')));
  } else {
    ST.logs.forEach(function(l) {
      var tr = el('tr');
      tr.appendChild(el('td',{style:{fontSize:'12px'}},new Date(l.ts).toLocaleTimeString('pt-BR')));
      tr.appendChild(el('td',{style:{color:'var(--amber)',fontSize:'12px'}},l.action));
      var stColors = {ok:'var(--green)',warn:'var(--amber)',fail:'var(--red)'};
      tr.appendChild(el('td',{style:{color:stColors[l.status]||'var(--t2)',fontSize:'12px',fontWeight:'700'}},l.status.toUpperCase()));
      tr.appendChild(el('td',{style:{fontSize:'11px',color:'var(--t3)',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},l.notes));
      tbody.appendChild(tr);
    });
  }
  append(tbl,thead,tbody);
  card.appendChild(tbl);
  wrap.appendChild(card);
  return wrap;
}

// ================================================================
// SETTINGS
// ================================================================
function renderSettings() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', '⚙️ CONFIGURAÇÕES'));
  t.appendChild(div('page-sub', 'Sistema e seguranca'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var sysCard = div('card card-blue');
  sysCard.appendChild(div('card-title', 'SISTEMA'));
  [
    ['Versão', APP_VERSION],
    ['Usuário', ST.user?ST.user.username:''],
    ['Perfil', RISK_PROFILES[ST.riskProfile].label],
    ['IA', ST.aiCfg.provider + ' — ' + ST.aiCfg.model],
    ['Supabase', ST.sbClient?'Conectado':'Não configurado'],
    ['Ativos monitorados', Object.keys(ASSET_LABELS).length + ' pares de mercado']
  ].forEach(function(row) {
    var r = div('info-row');
    r.appendChild(span('info-label', row[0]));
    r.appendChild(span('info-val', row[1]));
    sysCard.appendChild(r);
  });
  wrap.appendChild(sysCard);

  var f = { old:'', nw:'', cf:'' };
  var pwMsg = p(''); pwMsg.style.cssText = 'font-size:13px;margin-top:8px;min-height:18px';
  var pwCard = div('card card-blue');
  pwCard.appendChild(div('card-title', 'TROCAR SENHA'));
  [['Senha atual','old'],['Nova senha (min. 8 chars)','nw'],['Confirmar nova senha','cf']].forEach(function(row) {
    var fg = div('fg'); fg.appendChild(el('label',{},row[0]));
    var inp = el('input',{class:'input',type:'password',oninput:function(e){f[row[1]]=e.target.value;}});
    fg.appendChild(inp); pwCard.appendChild(fg);
  });
  var saveBtn = btn('btn-primary','Alterar Senha',function() {
    if (!f.old||!f.nw||!f.cf) {pwMsg.textContent='Preencha todos os campos.';pwMsg.style.color='var(--red)';return;}
    if (f.nw!==f.cf) {pwMsg.textContent='Senhas não coincidem.';pwMsg.style.color='var(--red)';return;}
    if (f.nw.length<8) {pwMsg.textContent='Mínimo 8 caracteres.';pwMsg.style.color='var(--red)';return;}
    if (f.old!=='dbsa1981') {pwMsg.textContent='Senha atual incorreta.';pwMsg.style.color='var(--red)';return;}
    pwMsg.textContent='✓ Senha alterada.';pwMsg.style.color='var(--green)';
  });
  append(pwCard,saveBtn,pwMsg);
  wrap.appendChild(pwCard);
  return wrap;
}

// ================================================================
// BTC TRADING DESK PAGE — /btc
// ================================================================
function renderBtcDesk() {
  var params = ST.btcParams || { alvo: 5.0, stop: 2.0, capital: null, modo: 'SEGURO', timeframes: ['1h','4h'] };
  var snap = ST.snapshot;
  var btcPrice = snap && snap.prices && snap.prices['BTCUSDT'] ? snap.prices['BTCUSDT'] : null;
  var wrap = div('');

  // ── DISCLAIMER TOP (spec G) ──
  var disc = div('');
  disc.style.cssText = 'background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.15);border-radius:12px;padding:10px 16px;margin-bottom:16px;font-size:12px;color:rgba(245,158,11,.8);line-height:1.6';
  disc.textContent = '⚠️ Conteúdo educacional. Não é recomendação individual. Cripto tem alta volatilidade. Decisões são do usuário.';
  wrap.appendChild(disc);

  // ── HEADER / TOP BAR (seção 1) ──
  var hdr = div('page-header');
  var titleSide = div('');
  titleSide.appendChild(div('page-title', '₿ BTC Trading Desk'));
  var snapStatus = btcPrice ? '🟢 Dados ao vivo OK' : snap ? '🟡 Dados parciais' : '🔴 Offline';
  titleSide.appendChild(div('page-sub', snapStatus + (btcPrice ? ' · BTC $' + (btcPrice.last||0).toLocaleString('en-US',{maximumFractionDigits:0}) : '') + ' · Modo swing educacional'));
  var ctrlSide = div(''); ctrlSide.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  ctrlSide.appendChild(btn('btn-secondary', '📡 Atualizar', function() {
    stateSet({ snapshotLoading: true }); render();
    Promise.all([fetchAllMarketData(), fetchBTCCandles((params.timeframes||['1h'])[0], 50)])
      .then(function(r) { var s=r[0]; if(!s.btcCandles)s.btcCandles={}; s.btcCandles[(params.timeframes||['1h'])[0]]=r[1]; stateSet({snapshot:s,snapshotLoading:false}); render(); });
  }));
  ctrlSide.appendChild(btn('btn-primary', ST.btcGenerating ? '⚙️ Analisando...' : '🤖 Rodar Análise', function() {
    if (!ST.btcGenerating) runBtcPipeline();
  }, ST.btcGenerating));
  if (ST.btcBrief && !ST.btcBrief._error) {
    ctrlSide.appendChild(btn('btn-secondary', '⬇ Exportar', function() {
      var exp = { snapshot: ST.snapshot, params: params, agents: ST.btcAgentOutputs, final: ST.btcBrief, validation: ST.btcFactChecker };
      var blob = new Blob([JSON.stringify(exp,null,2)],{type:'application/json'});
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
      a.download='btc-desk-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
    }));
  }
  append(hdr, titleSide, ctrlSide);
  wrap.appendChild(hdr);

  if (!AIKEY.get()) {
    var kb = div('banner banner-err'); kb.style.cursor='pointer';
    kb.textContent = '🔑 Configure sua chave Gemini para rodar análise. É gratuito!';
    kb.addEventListener('click', function(){ setState({page:'ai_key'}); });
    wrap.appendChild(kb);
  }

  var grid = div('grid2');

  // ── SEÇÃO 2: PARÂMETROS ──
  var paramCard = div('card card-gold');
  paramCard.appendChild(div('card-title', '⚙️ PARÂMETROS DA OPERAÇÃO'));
  var paramNote = p(''); paramNote.style.cssText='font-size:11px;color:var(--t3);margin-bottom:16px';
  paramNote.textContent = 'Tipo: Curto Prazo (Swing) · Educacional · Sem execução automática';
  paramCard.appendChild(paramNote);

  // Alvo e Stop sliders
  var sliders = [
    { label: 'Alvo de lucro (%)', key: 'alvo', min: 0.5, max: 30, step: 0.5, def: 5.0, color: 'var(--green)' },
    { label: 'Stop loss (%)',     key: 'stop',  min: 0.5, max: 20, step: 0.5, def: 2.0, color: 'var(--red)' }
  ];
  sliders.forEach(function(s) {
    var val = params[s.key] || s.def;
    var row = div('slider-row');
    var lbl = el('label',{},s.label);
    lbl.style.color = s.color;
    var sli = el('input',{type:'range',min:s.min,max:s.max,step:s.step,value:val});
    sli.style.accentColor = s.color;
    var valEl = span('slider-val', val.toFixed(1) + '%');
    valEl.style.color = s.color;
    sli.addEventListener('input', function(e) {
      valEl.textContent = parseFloat(e.target.value).toFixed(1) + '%';
      params[s.key] = parseFloat(e.target.value);
    });
    append(row, lbl, sli, valEl); paramCard.appendChild(row);
  });

  // Capital input
  var capRow = div('fg');
  capRow.appendChild(el('label',{},'Capital (R$) — opcional'));
  var capInp = el('input',{class:'input',type:'number',placeholder:'Ex: 1000',value:params.capital||''});
  capInp.style.cssText = 'max-width:180px';
  capInp.addEventListener('input', function(e) { params.capital = e.target.value ? parseFloat(e.target.value) : null; });
  capRow.appendChild(capInp); paramCard.appendChild(capRow);

  // Modo
  var modoRow = div('');
  modoRow.style.cssText = 'margin-bottom:14px';
  modoRow.appendChild(el('label',{style:{display:'block',fontSize:'10px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:'8px',fontWeight:'800'}},'Modo'));
  var modos = ['CONSERVADOR','SEGURO','ARROJADO'];
  var modoGrp = div('profile-row');
  modos.forEach(function(m) {
    var pb = el('button',{class:'pbtn ' + RISK_PROFILES[m].short + (params.modo===m?' on':''),onclick:function(){ params.modo=m; storeSet('cio_btc_params', params); render(); }}, RISK_PROFILES[m].label);
    modoGrp.appendChild(pb);
  });
  modoRow.appendChild(modoGrp); paramCard.appendChild(modoRow);

  // Timeframes multi-select
  var tfRow = div('');
  tfRow.style.marginBottom = '14px';
  tfRow.appendChild(el('label',{style:{display:'block',fontSize:'10px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:'8px',fontWeight:'800'}},'Timeframes'));
  var tfGrp = div(''); tfGrp.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
  ['15m','1h','4h','1d'].forEach(function(tf) {
    var on = (params.timeframes||[]).indexOf(tf) >= 0;
    var tfb = el('button',{class:'filter-btn'+(on?' on':''),onclick:function(){
      var tfs = params.timeframes ? params.timeframes.slice() : ['1h'];
      var idx = tfs.indexOf(tf);
      if (idx >= 0) { if(tfs.length>1) tfs.splice(idx,1); } else tfs.push(tf);
      params.timeframes = tfs; storeSet('cio_btc_params', params); render();
    }}, tf);
    tfGrp.appendChild(tfb);
  });
  tfRow.appendChild(tfGrp); paramCard.appendChild(tfRow);

  var saveBtn = btn('btn-secondary', '💾 Salvar parâmetros', function() {
    storeSet('cio_btc_params', params);
    stateSet({ btcParams: params });
    var ok = div(''); ok.style.cssText='font-size:12px;color:var(--green);margin-top:8px';
    ok.textContent='✓ Salvo!'; paramCard.appendChild(ok);
    setTimeout(function(){try{paramCard.removeChild(ok);}catch(e){}},2000);
  });
  paramCard.appendChild(saveBtn);
  grid.appendChild(paramCard);

  // ── SEÇÃO 3: BTC TEMPO REAL ──
  var rtCard = div('card card-blue');
  rtCard.appendChild(div('card-title', '₿ BTC EM TEMPO REAL'));
  if (btcPrice) {
    var chg = btcPrice.chg24h_pct;
    var chgColor = chg == null ? 'var(--t3)' : chg >= 0 ? 'var(--green)' : 'var(--red)';
    var bigPriceEl = div('');
    bigPriceEl.style.cssText = 'font-family:"DM Mono",monospace;font-size:36px;font-weight:600;letter-spacing:-1px;margin-bottom:4px;background:linear-gradient(135deg,#fff 30%,var(--cyan) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
    bigPriceEl.textContent = '$' + (btcPrice.last||0).toLocaleString('en-US',{maximumFractionDigits:2});
    rtCard.appendChild(bigPriceEl);
    if (chg != null) {
      var chgEl = span(''); chgEl.style.cssText='font-size:16px;font-weight:800;color:'+chgColor;
      chgEl.textContent = (chg>=0?'▲':'▼') + ' ' + Math.abs(chg).toFixed(2) + '% 24h';
      rtCard.appendChild(chgEl);
    }
    var metaGrid = div('thermo-grid'); metaGrid.style.marginTop='16px';
    var metaItems = [
      ['Máx 24h', btcPrice.high ? '$'+btcPrice.high.toLocaleString('en-US',{maximumFractionDigits:0}) : '—'],
      ['Mín 24h', btcPrice.low  ? '$'+btcPrice.low.toLocaleString('en-US',{maximumFractionDigits:0})  : '—'],
      ['Volume 24h', btcPrice.volume ? btcPrice.volume.toLocaleString('en-US',{maximumFractionDigits:0}) + ' BTC' : '—'],
      ['Última atualização', snap.quality ? snap.quality.fetched_at : '—']
    ];
    // BTC Dom
    if (snap.prices && snap.prices['BTC_DOM']) metaItems.push(['Dominância BTC', (snap.prices['BTC_DOM'].last||0) + '%']);
    metaItems.forEach(function(row) {
      var c = div('thermo-item');
      c.appendChild(div('thermo-lbl', row[0]));
      c.appendChild(div('thermo-val', row[1]));
      metaGrid.appendChild(c);
    });
    rtCard.appendChild(metaGrid);
  } else {
    var nobt = div('empty-state'); nobt.style.padding='30px 0';
    nobt.innerHTML = '<div class="empty-icon" style="font-size:36px">₿</div><div class="empty-title" style="font-size:16px">Sem dados BTC</div><div class="empty-sub" style="font-size:12px">Clique "Atualizar" para buscar</div>';
    rtCard.appendChild(nobt);
  }

  // Alvo/Stop calculados
  if (btcPrice && btcPrice.last) {
    var ref = btcPrice.last;
    var target = ref * (1 + (params.alvo||5)/100);
    var stopPx  = ref * (1 - (params.stop||2)/100);
    var calcCard = div('');
    calcCard.style.cssText = 'margin-top:16px;padding:14px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.08)';
    calcCard.innerHTML = '<div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px">📐 Alvos Calculados (educacional)</div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--t2);font-size:13px">Referência (entry)</span><span style="color:var(--t1);font-family:DM Mono,monospace;font-size:13px">$' + ref.toLocaleString('en-US',{maximumFractionDigits:2}) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--green);font-size:13px">🎯 Alvo (' + params.alvo + '%)</span><span style="color:var(--green);font-family:DM Mono,monospace;font-size:13px;font-weight:700">$' + target.toLocaleString('en-US',{maximumFractionDigits:2}) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between"><span style="color:var(--red);font-size:13px">🛑 Stop (' + params.stop + '%)</span><span style="color:var(--red);font-family:DM Mono,monospace;font-size:13px;font-weight:700">$' + stopPx.toLocaleString('en-US',{maximumFractionDigits:2}) + '</span></div>';
    rtCard.appendChild(calcCard);
  }
  grid.appendChild(rtCard);

  // ── SEÇÃO 4: CANDLE TABLE ──
  var btcCandles = (snap && snap.btcCandles && snap.btcCandles[(params.timeframes||['1h'])[0]]) || [];
  var candleCard = div('card card-blue col2');
  var candleTitle = div('card-title'); candleTitle.innerHTML = '🕯️ CANDLES CANDLES OHLCV — ' + ((params.timeframes||['1h'])[0]);
  candleCard.appendChild(candleTitle);
  if (btcCandles.length > 0) {
    var recentCandles = btcCandles.slice(-20);
    var tbl = el('table',{class:'data-table'});
    var tblHead = el('thead',{},el('tr',{},[
      el('th',{style:{textAlign:'right'}},'HORA'),el('th',{style:{textAlign:'right'}},'ABERTURA'),
      el('th',{style:{textAlign:'right'}},'MÁXIMO'),el('th',{style:{textAlign:'right'}},'MÍNIMO'),
      el('th',{style:{textAlign:'right'}},'FECHAMENTO'),el('th',{style:{textAlign:'right'}},'VOL'),
      el('th',{},'')
    ]));
    var tblBody = el('tbody');
    recentCandles.forEach(function(c) {
      var isBull = c.close >= c.open;
      var color = isBull ? 'var(--green)' : 'var(--red)';
      var pct = c.open ? (((c.close - c.open)/c.open)*100).toFixed(2) : '0.00';
      var tr = el('tr');
      var ts = new Date(c.ts); var timeStr = ts.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      [
        el('td',{style:{textAlign:'right',color:'var(--t3)',fontFamily:'DM Mono,monospace',fontSize:'11px'}},timeStr),
        el('td',{style:{textAlign:'right',fontFamily:'DM Mono,monospace',fontSize:'12px'}},'$'+c.open.toLocaleString('en-US',{maximumFractionDigits:0})),
        el('td',{style:{textAlign:'right',fontFamily:'DM Mono,monospace',fontSize:'12px'}},'$'+c.high.toLocaleString('en-US',{maximumFractionDigits:0})),
        el('td',{style:{textAlign:'right',fontFamily:'DM Mono,monospace',fontSize:'12px'}},'$'+c.low.toLocaleString('en-US',{maximumFractionDigits:0})),
        el('td',{style:{textAlign:'right',fontFamily:'DM Mono,monospace',fontSize:'12px',color:color,fontWeight:'700'}},'$'+c.close.toLocaleString('en-US',{maximumFractionDigits:0})),
        el('td',{style:{textAlign:'right',fontFamily:'DM Mono,monospace',fontSize:'11px',color:'var(--t3)'}},(c.volume/1000).toFixed(1)+'K'),
        el('td',{style:{}},[
          (function(){var badge=span('');badge.style.cssText='font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;background:'+color+';color:#000;';badge.textContent=(isBull?'+':'')+pct+'%';return badge;})()
        ])
      ].forEach(function(td){tr.appendChild(td);});
      tblBody.appendChild(tr);
    });
    append(tbl, tblHead, tblBody);
    // Mini bar chart visual
    var chartWrap = div('');
    chartWrap.style.cssText = 'margin-bottom:14px;display:flex;align-items:flex-end;gap:2px;height:80px;padding:0 4px;overflow:hidden';
    var allClose = recentCandles.map(function(c){return c.close;});
    var minC = Math.min.apply(null, allClose), maxC = Math.max.apply(null, allClose);
    var range = maxC - minC || 1;
    recentCandles.forEach(function(c) {
      var isBull2 = c.close >= c.open;
      var heightPct = ((c.close - minC)/range)*90 + 10;
      var bar = div(''); bar.style.cssText='flex:1;border-radius:2px 2px 0 0;background:'+(isBull2?'var(--green)':'var(--red)')+';height:'+heightPct+'%;opacity:.7;min-width:3px;transition:opacity .2s';
      bar.title = '$' + c.close.toLocaleString('en-US',{maximumFractionDigits:0});
      bar.addEventListener('mouseenter',function(){this.style.opacity='1';});
      bar.addEventListener('mouseleave',function(){this.style.opacity='.7';});
      chartWrap.appendChild(bar);
    });
    candleCard.appendChild(chartWrap);
    candleCard.appendChild(tbl);
  } else {
    var nocandle = div(''); nocandle.style.cssText='text-align:center;padding:30px;color:var(--t3);font-size:14px';
    nocandle.textContent = 'Sem candles carregados. Clique "Atualizar" para buscar.';
    candleCard.appendChild(nocandle);
  }
  grid.appendChild(candleCard);

  // ── SEÇÃO 6: MACRO & RISCO GLOBAL ──
  var macroCard = div('card card-purple');
  macroCard.appendChild(div('card-title', '🌐 MACRO & RISCO GLOBAL'));
  var macroItems = [];
  if (snap && snap.macro_br) {
    if (snap.macro_br.selic) macroItems.push(['Selic (BR)', snap.macro_br.selic + '%']);
    if (snap.macro_br.ptax_venda) macroItems.push(['PTAX USD/BRL', 'R$ ' + snap.macro_br.ptax_venda]);
  }
  if (snap && snap.prices) {
    if (snap.prices['USDBRL']) macroItems.push(['Dólar (ExchangeRate)', 'R$ ' + (snap.prices['USDBRL'].last||0).toFixed(2)]);
    if (snap.prices['BTC_DOM']) macroItems.push(['Dominância BTC', (snap.prices['BTC_DOM'].last||0) + '%']);
    if (snap.prices['ETHUSDT']) macroItems.push(['Ethereum', '$' + (snap.prices['ETHUSDT'].last||0).toLocaleString('en-US',{maximumFractionDigits:0})]);
  }
  if (macroItems.length === 0) {
    macroItems.push(['Status', 'Atualize os dados para ver macro']);
  }
  macroItems.forEach(function(row) {
    var r = div('info-row');
    r.appendChild(span('info-label', row[0]));
    r.appendChild(span('info-val', row[1]));
    macroCard.appendChild(r);
  });
  grid.appendChild(macroCard);

  // ── GERANDO / PROGRESS ──
  if (ST.btcGenerating) {
    var sw = div('spinner-wrap col2');
    sw.appendChild(div('spinner'));
    var pt = p(''); pt.style.cssText='font-size:16px;color:var(--t2);margin-bottom:18px;font-weight:500;text-align:center';
    pt.textContent = 'Pipeline BTC rodando (' + BTC_PIPELINE.length + ' agentes)...';
    sw.appendChild(pt);
    var pl = div('');
    ST.btcProgress.forEach(function(prog) { sw.appendChild(div('prog-item '+prog.status, prog.label)); });
    sw.appendChild(pl);
    grid.appendChild(sw);
    wrap.appendChild(grid);
    wrap.appendChild(renderDisclaimer());
    return wrap;
  }

  // ── SEÇÃO 5: SINAIS TÉCNICOS (from CRYPTO_TRADER) ──
  var ct = ST.btcAgentOutputs['CRYPTO_TRADER'];
  var qs = ST.btcAgentOutputs['QUANT_SIGNAL'];
  if (ct || qs) {
    var sigCard = div('card card-blue col2');
    sigCard.appendChild(div('card-title', '📡 SINAIS TÉCNICOS BTC'));
    var sigGrid = div('thermo-grid');
    if (ct) {
      [
        ['Estrutura de Mercado', ct.market_structure || '—'],
        ['Qualidade do Setup',   ct.setup_quality    || '—'],
      ].forEach(function(row){
        var c=div('thermo-item'); c.appendChild(div('thermo-lbl',row[0]));
        var v=div('thermo-val'); v.textContent=row[1];
        var col = {alta:'var(--green)',media:'var(--amber)',baixa:'var(--red)',alta_de_mercado:'var(--green)',baixa_de_mercado:'var(--red)',lateral:'var(--t2)',indefinida:'var(--t3)'}[row[1]] || 'var(--t1)';
        v.style.color=col; c.appendChild(v); sigGrid.appendChild(c);
      });
      if (ct.levels) {
        [['Suporte', ct.levels.support ? '$'+ct.levels.support.toLocaleString('en-US',{maximumFractionDigits:0}) : '—'],
         ['Resistência', ct.levels.resistance ? '$'+ct.levels.resistance.toLocaleString('en-US',{maximumFractionDigits:0}) : '—']].forEach(function(row){
          var c=div('thermo-item'); c.appendChild(div('thermo-lbl',row[0])); c.appendChild(div('thermo-val',row[1])); sigGrid.appendChild(c);
        });
      }
    }
    if (qs) {
      [['Tendência Curto', qs.tendencia_curto||'—'],['Volatilidade', qs.volatilidade||'—']].forEach(function(row){
        var c=div('thermo-item'); c.appendChild(div('thermo-lbl',row[0]));
        var v=div('thermo-val'); v.textContent=row[1]; c.appendChild(v); sigGrid.appendChild(c);
      });
    }
    sigCard.appendChild(sigGrid);
    // Candle reading
    if (ct && ct.candle_reading && ct.candle_reading.length) {
      var crTitle = div('card-title'); crTitle.style.marginTop='16px'; crTitle.textContent='📖 Leitura de Candles';
      sigCard.appendChild(crTitle);
      (ct.candle_reading||[]).forEach(function(r){
        var row = div('check-item'); row.innerHTML='<span style="color:var(--cyan);margin-right:8px">•</span>' + r;
        sigCard.appendChild(row);
      });
    }
    // Data needed disclaimer
    var allNeeded = [].concat(ct?(ct.data_needed||[]):[]).concat(qs?(qs.data_needed||[]):[]);
    if (allNeeded.length && allNeeded[0]) {
      var dnWrap = div(''); dnWrap.style.cssText='margin-top:10px;padding:10px 14px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:10px;font-size:12px;color:var(--amber)';
      dnWrap.textContent = '⚠️ Dados insuficientes: ' + allNeeded.filter(Boolean).join(', ');
      sigCard.appendChild(dnWrap);
    }
    grid.appendChild(sigCard);
  }

  // ── SEÇÃO 7: PLANO (from ORCHESTRATOR_CIO) ──
  var btcBrief = ST.btcBrief;
  if (btcBrief && !btcBrief._error) {
    var planCard = div('card card-blue col2');
    planCard.appendChild(div('card-title', '🎯 PLANO DE ENTRADA/SAÍDA (Educacional)'));

    // Semáforo
    var semVal = btcBrief.semaforo || 'amarelo';
    var semColors = {verde:'var(--green)',amarelo:'var(--amber)',vermelho:'var(--red)'};
    var semEmojis = {verde:'🟢',amarelo:'🟡',vermelho:'🔴'};
    var semWrap = div('sema'); semWrap.style.marginBottom='16px';
    var dots = ['verde','amarelo','vermelho'].map(function(s){var d=div('sema-dot '+s+(s===semVal?' on':'')); return d;});
    var semLbl = span('sema-label'); semLbl.style.color=semColors[semVal]||'var(--t2)';
    semLbl.textContent = semEmojis[semVal] + ' ' + (btcBrief.semaforo_motivo || '');
    dots.forEach(function(d){semWrap.appendChild(d);}); semWrap.appendChild(semLbl);
    planCard.appendChild(semWrap);

    // Postura
    if (btcBrief.postura) {
      var postColors = {ESPERAR:'var(--t2)',BUSCAR_ENTRADA:'var(--cyan)',REDUZIR_RISCO:'var(--red)'};
      var postWrap = div('');
      postWrap.style.cssText='display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:50px;margin-bottom:18px;font-size:14px;font-weight:800;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)';
      postWrap.style.color = postColors[btcBrief.postura] || 'var(--t1)';
      postWrap.textContent = '📍 ' + btcBrief.postura.replace(/_/g,' ') + (btcBrief.postura_motivo ? ': ' + btcBrief.postura_motivo : '');
      planCard.appendChild(postWrap);
    }

    // Resumo leigo
    if (btcBrief.resumo_leigo) {
      var rl = div('');
      rl.style.cssText='background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:16px 20px;margin-bottom:20px;font-size:16px;line-height:1.7;color:var(--t1)';
      rl.textContent = btcBrief.resumo_leigo;
      planCard.appendChild(rl);
    }

    // Condições
    var condGrid = div('check-grid');
    var secEntry = div('');
    secEntry.appendChild(div('check-title', '✅ Condições para Considerar Entrada'));
    (btcBrief.condicoes_entrada||[]).forEach(function(c){ var r=div('check-item');r.innerHTML='<span style="color:var(--green);margin-right:6px">✓</span>'+c;secEntry.appendChild(r);});

    var secSaida = div('');
    secSaida.appendChild(div('check-title', '🚪 Condições de Saída'));
    (btcBrief.condicoes_saida||[]).forEach(function(c){var r=div('check-item');r.innerHTML='<span style="color:var(--amber);margin-right:6px">→</span>'+c;secSaida.appendChild(r);});

    var secRisk = div('');
    secRisk.appendChild(div('check-title', '🛡️ Gestão de Risco'));
    (btcBrief.gestao_risco||[]).forEach(function(c){var r=div('check-item');r.innerHTML='<span style="color:var(--red);margin-right:6px">⚡</span>'+c;secRisk.appendChild(r);});

    append(condGrid, secEntry, secSaida);
    planCard.appendChild(condGrid);
    planCard.appendChild(secRisk);

    // Riscos top 3
    if (btcBrief.risks_top3 && btcBrief.risks_top3.length) {
      var riskWrap = div('');
      riskWrap.style.cssText='margin-top:16px;padding:14px;background:rgba(244,63,94,.06);border:1px solid rgba(244,63,94,.15);border-radius:12px';
      var riskTitle = div(''); riskTitle.style.cssText='font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--red);margin-bottom:10px';
      riskTitle.textContent = '⚠️ RISCOS PRINCIPAIS';
      riskWrap.appendChild(riskTitle);
      btcBrief.risks_top3.forEach(function(r,i){
        var row=div('');row.style.cssText='padding:6px 0;font-size:13px;color:var(--t2);border-bottom:1px solid rgba(255,255,255,.04)';
        row.textContent = (i+1)+'. '+r; riskWrap.appendChild(row);
      });
      planCard.appendChild(riskWrap);
    }
    grid.appendChild(planCard);
  } else if (btcBrief && btcBrief._error) {
    var errCard = div('card col2');
    errCard.appendChild(div('banner banner-err', '⚠ Erro na análise. Tente novamente.'));
    grid.appendChild(errCard);
  } else if (!ST.btcGenerating && !btcBrief) {
    var emptyCard = div('card col2');
    emptyCard.innerHTML = '<div class="empty-icon">₿</div><div class="empty-title">Análise BTC não rodada</div><div class="empty-sub">Defina seus parâmetros e clique em "Rodar Análise" para o pipeline de ' + BTC_PIPELINE.length + ' agentes.</div>';
    grid.appendChild(emptyCard);
  }

  // ── SEÇÃO 8: FACT_CHECKER SEAL ──
  if (ST.btcFactChecker || ST.btcFactTs) {
    var fcCard = div('col2');
    fcCard.appendChild(renderFactCheckerSeal(ST.btcFactChecker, ST.btcFactTs));
    // Issues detail
    if (ST.btcFactChecker && (ST.btcFactChecker.critical_issues||[]).length) {
      var issCard = div('card card-red');
      issCard.appendChild(div('card-title', '🔍 ISSUES DO FACT_CHECKER'));
      (ST.btcFactChecker.critical_issues||[]).forEach(function(iss) {
        var r = div('');
        r.style.cssText='padding:8px 0;font-size:13px;color:var(--t2);border-bottom:1px solid rgba(255,255,255,.04)';
        r.textContent = '[' + iss.type + '] ' + iss.message + (iss.where?' ('+iss.where+')':'');
        issCard.appendChild(r);
      });
      // Botão revisar automaticamente
      if (ST.btcFactChecker.status === 'failed') {
        var revBtn = btn('btn-secondary','🔄 Revisar automaticamente', function(){
          if (!ST.btcGenerating) { stateSet({btcBrief:null,btcFactChecker:null}); runBtcPipeline(); }
        }); revBtn.style.marginTop='12px';
        issCard.appendChild(revBtn);
      }
      fcCard.appendChild(issCard);
    }
    grid.appendChild(fcCard);
  }

  wrap.appendChild(grid);

  // DISCLAIMER RODAPÉ
  var discBottom = div('');
  discBottom.style.cssText = 'margin-top:24px;padding:14px 18px;background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.1);border-radius:12px;font-size:12px;color:rgba(245,158,11,.65);line-height:1.7;text-align:center';
  discBottom.textContent = '⚠️ Este conteúdo é estritamente educacional. Não é recomendação individual. Cripto tem alta volatilidade e risco de perda total. Decisões de compra/venda são de exclusiva responsabilidade do usuário. Não garantimos resultados.';
  wrap.appendChild(discBottom);

  return wrap;
}

// ================================================================
// BOOT — A4: assertFreeTierModel na inicialização
// ================================================================
(function() {
  // A4: verificar e forçar free-tier no boot
  bootAssertFreeTier();
  // Forçar provider gemini no aiCfg se necessário
  var cfg = ST.aiCfg || {};
  if (cfg.provider !== 'gemini') {
    var nc = { provider: 'gemini', model: GEMINI_DEFAULT };
    Object.assign(ST, { aiCfg: nc, freeTierActive: true });
    storeSet('cio_ai_cfg', nc);
  }
  addLog('BOOT', 'ok', 'Free-tier: ' + (ST.freeTierActive !== false ? 'ativo' : 'inativo') + ' | modelo: ' + ((ST.aiCfg||{}).model || GEMINI_DEFAULT));
})();
render();
