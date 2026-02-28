// ================================================================
// CIO DIGITAL v2.1 - VANILLA JS - NO DEPENDENCIES
// ================================================================
var APP_VERSION = '2.1.0';

// ================================================================
// CONSTANTS
// ================================================================
var RISK_PROFILES = {
  CONSERVADOR: {
    label: 'Conservador', color: '#22c55e', bg: '#052e16',
    allowed: ['Renda Fixa','Tesouro','LCI/LCA','Fundos DI'],
    blocked: ['Cripto','Alavancagem','Derivativos'],
    max_risk: 'baixo', min_conf: 'alta', mode: 'MONITORAR',
    desc: 'Preservacao de capital. Foco em liquidez e controle.'
  },
  SEGURO: {
    label: 'Seguro', color: '#f59e0b', bg: '#451a03',
    allowed: ['Renda Fixa','FIIs','Acoes Blue Chip','Cambio'],
    blocked: ['Cripto','Alavancagem'],
    max_risk: 'medio', min_conf: 'media', mode: 'MONITORAR',
    desc: 'Equilibrio risco/retorno com travas claras.'
  },
  ARROJADO: {
    label: 'Arrojado', color: '#ef4444', bg: '#450a0a',
    allowed: ['Acoes','FIIs','Cripto','Cambio','Derivativos','BDRs'],
    blocked: [],
    max_risk: 'alto', min_conf: 'baixa', mode: 'SIMULAR',
    desc: 'Busca de alpha. Aceita volatilidade com controle de posicoes.'
  }
};

var DAILY_PIPELINE = ['MACRO_ORACLE','RISK_SHIELD','DERIVATIVES_HEDGE','ORCHESTRATOR_CIO'];
var DEEP_PIPELINE = ['MACRO_ORACLE','BRASIL_ANALYST','QUANT_SIGNAL','EQUITY_STOCK_MASTER',
  'REAL_ASSETS_CREDIT','RISK_SHIELD','DERIVATIVES_HEDGE','EXECUTION_DESK',
  'LEGAL_TAX_OPTIMIZER','ORCHESTRATOR_CIO'];

var AGENTS = {
  MACRO_ORACLE: { desc: 'Macro global, bancos centrais, regime risk-on/off.', styles: ['Druckenmiller','Dalio','Soros'], pipeline: ['daily','deep'] },
  BRASIL_ANALYST: { desc: 'Copom, Selic, IPCA, fiscal e impactos BR.', styles: ['Fraga','Arida','Resende'], pipeline: ['deep'] },
  QUANT_SIGNAL: { desc: 'Sinais quant: momentum, reversao, volatilidade.', styles: ['Simons','Asness','Lopez de Prado'], pipeline: ['deep'] },
  EQUITY_STOCK_MASTER: { desc: 'Acoes por setor/indice. Sem ticker por padrao.', styles: ['Lynch','Fisher','Smith'], pipeline: ['deep'] },
  REAL_ASSETS_CREDIT: { desc: 'FIIs, imoveis, credito privado (CRI/CRA).', styles: ['Zell','Schwarzman','Flatt'], pipeline: ['deep'] },
  RISK_SHIELD: { desc: 'CRO: stress test, drawdown, liquidez. Em duvida, rejeita.', styles: ['Howard Marks','Aaron Brown','Bookstaber'], pipeline: ['daily','deep'] },
  DERIVATIVES_HEDGE: { desc: 'Protecao assimetrica e antifragilidade por classe.', styles: ['Taleb','Spitznagel','Weinstein'], pipeline: ['daily','deep'] },
  EXECUTION_DESK: { desc: 'Execucao: liquidez, slippage, impacto, timing.', styles: ['Citadel','Virtu','Jane Street'], pipeline: ['deep'] },
  LEGAL_TAX_OPTIMIZER: { desc: 'Compliance, tributacao. Nao substitui advogado.', styles: ['Big4','Baker McKenzie','Withers'], pipeline: ['deep'] },
  ORCHESTRATOR_CIO: { desc: 'CIO Final. Sintetiza todos os agentes no Morning Brief.', styles: ['Dalio','Paul Tudor Jones','Soros'], pipeline: ['daily','deep'] }
};

var MOCK_SNAPSHOT = {
  ts: new Date().toISOString(),
  prices: {
    BTCUSDT: { last: 95240, chg24h_pct: 1.8 },
    USDBRL: { last: 5.74, chg24h_pct: -0.3 },
    IBOV: { last: 128500, chg24h_pct: 0.6 }
  },
  macro_br: { selic: 10.75, ipca_yoy: 4.87, usdbrl: 5.74 },
  events: [
    { when: 'Hoje 14h00', title: 'IPCA-15 acima do esperado: 0,62% vs 0,55%', impact: 'high' },
    { when: 'Hoje 15h30', title: 'Fed: ata reforca postura hawkish para 2025', impact: 'high' },
    { when: 'Amanha 09h00', title: 'Copom: divulgacao de ata', impact: 'med' }
  ],
  news: [
    { title: 'China anuncia pacote fiscal adicional de USD 300bi', source: 'Reuters', time: '08:00', tags: ['macro','commodities'] },
    { title: 'BCB mantem guidance hawkish; Selic estavel em 10,75%', source: 'Valor', time: '07:30', tags: ['macro','renda_fixa'] }
  ],
  quality: { source: 'mock_demo', partial: false }
};

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
  portfolio: storeGet('cio_portfolio', { 'Renda Fixa': 40, 'Acoes': 25, 'FIIs': 20, 'Cambio': 10, 'Cripto': 5 }),
  logs: [],
  config: storeGet('cio_config', { dsUrl: '', defaultAssets: 'BTCUSDT,USDBRL,IBOV', horizon: 'medio' }),
  sbCfg: storeGet('cio_sb', { url: '', anonKey: '', enabled: false }),
  aiCfg: storeGet('cio_ai_cfg', { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }),
  dbStatus: null,
  sbClient: null,
  keyInput: '',
  showKey: false,
  keyTestResult: null,
  sbBriefs: [],
  sbTab: 'config',
  histSelected: null,
  eventsFilter: 'Todos'
};

function setState(partial) {
  Object.assign(ST, partial);
  render();
}

function stateSet(partial) {
  Object.assign(ST, partial);
}

// ================================================================
// STORAGE
// ================================================================
function storeGet(k, def) {
  try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}
function storeSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
}
function storeGetStr(k, def) {
  try { return localStorage.getItem(k) || def || ''; } catch(e) { return def || ''; }
}
function storeSetStr(k, v) {
  try { localStorage.setItem(k, v); } catch(e) {}
}

// ================================================================
// AI KEY
// ================================================================
var AIKEY = {
  get: function() { return storeGetStr('cio_ai_key', ''); },
  set: function(k) { storeSetStr('cio_ai_key', k); },
  clear: function() { try { localStorage.removeItem('cio_ai_key'); } catch(e) {} }
};

// ================================================================
// AI API CALL
// ================================================================
function callAI(system, userMsg, maxTokens) {
  maxTokens = maxTokens || 1800;
  var key = AIKEY.get();
  if (!key) return Promise.reject(new Error('API_KEY_MISSING'));
  var cfg = ST.aiCfg;

  if (cfg.provider === 'gemini') {
    var geminiModel = cfg.model || 'gemini-2.0-flash';
    var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent?key=' + key;
    return fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: system + '\n\n' + userMsg }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 }
      })
    }).then(function(r) {
      if (!r.ok) return r.json().then(function(e) {
        if (r.status === 400) throw new Error('Chave invalida ou requisicao malformada (400).');
        if (r.status === 429) throw new Error('Limite de requisicoes Gemini atingido (429). Aguarde.');
        throw new Error(e.error && e.error.message ? e.error.message : 'HTTP ' + r.status);
      });
      return r.json();
    }).then(function(d) {
      var t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts
        ? d.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('')
        : '';
      try { return JSON.parse(t.replace(/```json|```/g, '').trim()); } catch(e) { return { raw: t, parse_error: true }; }
    });
  }

  if (cfg.provider === 'openai') {
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o',
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }]
      })
    }).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error && e.error.message ? e.error.message : 'HTTP ' + r.status); });
      return r.json();
    }).then(function(d) {
      var t = d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
      try { return JSON.parse(t.replace(/```json|```/g, '').trim()); } catch(e) { return { raw: t, parse_error: true }; }
    });
  }

  // Anthropic
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: cfg.model || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: system,
      messages: [{ role: 'user', content: userMsg }]
    })
  }).then(function(r) {
    if (!r.ok) {
      return r.json().then(function(e) {
        if (r.status === 401) throw new Error('Chave invalida ou expirada (401).');
        if (r.status === 429) throw new Error('Limite de requisicoes atingido (429). Aguarde.');
        throw new Error(e.error && e.error.message ? e.error.message : 'HTTP ' + r.status);
      });
    }
    return r.json();
  }).then(function(d) {
    var t = d.content && d.content[0] ? d.content[0].text : '';
    try { return JSON.parse(t.replace(/```json|```/g, '').trim()); } catch(e) { return { raw: t, parse_error: true }; }
  });
}

// ================================================================
// SUPABASE CLIENT
// ================================================================
function createSB(url, anonKey) {
  if (!url || !anonKey) return null;
  var h = { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey };
  function rpc(path, method, body) {
    method = method || 'GET';
    var headers = Object.assign({}, h, { 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' });
    return fetch(url + '/rest/v1' + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(e) { throw new Error('SB ' + method + ' ' + path + ': ' + e); });
      return r.text().then(function(t) { return t ? JSON.parse(t) : null; });
    });
  }
  return {
    saveBrief: function(d) { return rpc('/morning_briefs', 'POST', d); },
    getBriefs: function(n) { return rpc('/morning_briefs?order=created_at.desc&limit=' + (n || 20)); },
    savePortfolio: function(d) { return rpc('/portfolio_snapshots', 'POST', d); },
    getPortfolio: function() { return rpc('/portfolio_snapshots?order=created_at.desc&limit=1'); },
    saveLog: function(d) { return rpc('/audit_logs', 'POST', d); },
    getLogs: function(n) { return rpc('/audit_logs?order=created_at.desc&limit=' + (n || 80)); },
    upsertConfig: function(key, value) {
      return rpc('/app_config?key=eq.' + key).then(function(ex) {
        if (ex && ex.length) return rpc('/app_config?key=eq.' + key, 'PATCH', { value: JSON.stringify(value) });
        return rpc('/app_config', 'POST', { key: key, value: JSON.stringify(value) });
      });
    },
    getConfig: function(k) { return rpc('/app_config?key=eq.' + k + '&limit=1'); },
    ping: function() { return rpc('/morning_briefs?limit=1'); }
  };
}

// ================================================================
// SUPABASE INIT
// ================================================================
function initSupabase() {
  var cfg = ST.sbCfg;
  if (!cfg.enabled || !cfg.url || !cfg.anonKey) { stateSet({ sbClient: null, dbStatus: null }); return Promise.resolve(); }
  var client = createSB(cfg.url, cfg.anonKey);
  stateSet({ sbClient: client, dbStatus: 'syncing' });
  return Promise.all([
    client.getConfig('app_main_config').catch(function() { return null; }),
    client.getPortfolio().catch(function() { return null; }),
    client.getLogs(60).catch(function() { return null; })
  ]).then(function(results) {
    if (results[0] && results[0][0] && results[0][0].value) {
      try { Object.assign(ST.config, JSON.parse(results[0][0].value)); } catch(e) {}
    }
    if (results[1] && results[1][0] && results[1][0].allocations) {
      ST.portfolio = results[1][0].allocations;
    }
    if (results[2] && results[2].length) {
      ST.logs = results[2].map(function(l) {
        return { id: l.id, ts: l.created_at, user: l.username, action: l.action, status: l.status, notes: l.notes || '' };
      });
    }
    stateSet({ dbStatus: 'ok' });
  }).catch(function(e) {
    stateSet({ dbStatus: 'error' });
    console.warn('Supabase init:', e.message);
  });
}

// ================================================================
// LOGGING
// ================================================================
function addLog(action, status, notes) {
  var entry = { id: Date.now(), ts: new Date().toISOString(), user: ST.user ? ST.user.username : 'sys', action: action, status: status, notes: notes || '' };
  ST.logs = [entry].concat(ST.logs.slice(0, 99));
  if (ST.sbClient) {
    ST.sbClient.saveLog({ username: entry.user, action: action, status: status, notes: notes || '' }).catch(function() {});
  }
}

// ================================================================
// RISK POLICY ENGINE
// ================================================================
function applyPolicy(opps, profile) {
  var cfg = RISK_PROFILES[profile];
  if (!opps || !opps.length) return [];
  return opps.filter(function(o) {
    if (cfg.blocked.some(function(b) { return (o.classe || '').indexOf(b) >= 0; })) return false;
    if (cfg.max_risk === 'baixo' && (o.risco_nivel === 'alto' || o.risco_nivel === 'medio')) return false;
    if (cfg.min_conf === 'alta' && o.confianca !== 'alta') return false;
    if (cfg.min_conf === 'media' && o.confianca === 'baixa') return false;
    return true;
  }).map(function(o) { return Object.assign({}, o, { acao: cfg.mode }); });
}

// ================================================================
// BUILD AGENT PROMPTS
// ================================================================
function buildPrompt(agentId, snap, profile, horizon, prev) {
  var base = 'Retorne SOMENTE JSON valido. Sem markdown. Voce e ' + agentId + '. Sem chain-of-thought. Saida compacta max 1800 chars.';
  var inp = JSON.stringify({ snap: snap, profile: profile, horizon: horizon, prev: prev });

  var prompts = {
    MACRO_ORACLE: {
      sys: base + ' Filosofia: top-down, fluxo de capital, juros, ciclos.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"MACRO_ORACLE","regime_macro":"risk-on|risk-off|transicao|incerto","thesis":["","",""],"alerts":["","",""],"by_class":{"renda_fixa":[],"acoes":[],"fiis":[],"cambio":[],"cripto":[]},"disclaimer":"Conteudo educacional."}'
    },
    BRASIL_ANALYST: {
      sys: base + ' Filosofia: mercado domestico BR, Copom, curva, fiscal.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"BRASIL_ANALYST","thesis":["","",""],"alerts":["","",""],"by_class":{"renda_fixa":[],"acoes":[],"fiis":[],"cambio":[]},"selic_outlook":"","ipca_outlook":"","disclaimer":"Conteudo educacional."}'
    },
    QUANT_SIGNAL: {
      sys: base + ' Filosofia: sinais estatisticos, regimes de mercado.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"QUANT_SIGNAL","signals_by_class":{"renda_fixa":[{"signal":"","strength":0}],"acoes":[{"signal":"","strength":0}],"cambio":[{"signal":"","strength":0}],"cripto":[{"signal":"","strength":0}]},"volatility_stress":"baixo|medio|alto","guardrails":[],"disclaimer":"Conteudo educacional."}'
    },
    EQUITY_STOCK_MASTER: {
      sys: base + ' Filosofia: analise setorial, nunca tickers individuais.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"EQUITY_STOCK_MASTER","thesis":["","",""],"alerts":["","",""],"setores_destaque":[],"setores_evitar":[],"disclaimer":"Conteudo educacional."}'
    },
    REAL_ASSETS_CREDIT: {
      sys: base + ' Filosofia: ativos reais e iliquidos, spread, liquidez.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"REAL_ASSETS_CREDIT","thesis":["","",""],"alerts":["","",""],"by_class":{"fiis":[],"alternativos":[]},"hidden_risks":[],"disclaimer":"Conteudo educacional."}'
    },
    RISK_SHIELD: {
      sys: base + ' Filosofia: encontrar o que da ERRADO. Em duvida, rejeite.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"RISK_SHIELD","thesis":["","",""],"alerts":["","",""],"risks_top5":[{"risk":"","prob":"baixa|media|alta","impact":"baixo|medio|alto","mitigation":[""]}],"go_no_go":"go|no_go|precisa_dados","disclaimer":"Conteudo educacional."}'
    },
    DERIVATIVES_HEDGE: {
      sys: base + ' Filosofia: protecao contra cauda, antifragilidade.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"DERIVATIVES_HEDGE","thesis":["","",""],"alerts":["","",""],"hedge_by_class":{"acoes":[],"cambio":[],"cripto":[],"renda_fixa":[]},"anti_ruin_rules":[],"disclaimer":"Conteudo educacional."}'
    },
    EXECUTION_DESK: {
      sys: base + ' Filosofia: minimizar slippage, respeitar liquidez.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"EXECUTION_DESK","thesis":["","",""],"alerts":["","",""],"execution_playbook":{"acoes":[],"cambio":[],"cripto":[]},"avoid_mistakes":[],"disclaimer":"Conteudo educacional."}'
    },
    LEGAL_TAX_OPTIMIZER: {
      sys: base + ' Filosofia: estruturar com seguranca, evitar risco tributario.',
      usr: 'INPUT:' + inp + ' Retorne: {"agent":"LEGAL_TAX_OPTIMIZER","thesis":["","",""],"alerts":["","",""],"compliance_checklist":[],"tax_alerts":[],"observacao":"Nao substitui contador.","disclaimer":"Conteudo educacional."}'
    },
    ORCHESTRATOR_CIO: {
      sys: base + ' Filosofia: sintese objetiva. Sem ticker. Sem promessas.',
      usr: 'BUNDLE:' + JSON.stringify(prev) + ' SNAPSHOT:' + JSON.stringify(snap) + ' PERFIL:' + profile + '|HORIZONTE:' + horizon + ' Retorne: {"agent":"ORCHESTRATOR_CIO","morning_brief":{"radar_30s":"","resumo_6_bullets":["","","","","",""],"risks_top5":["","","","",""],"opportunities_top5":["","","","",""],"plan_by_class":{"renda_fixa":{"postura":"defensiva|neutra|ofensiva","actions":[],"alerts":[]},"acoes":{"postura":"","actions":[],"alerts":[]},"fiis":{"postura":"","actions":[],"alerts":[]},"cambio":{"postura":"","actions":[],"alerts":[]},"cripto":{"postura":"","actions":[],"alerts":[]},"alternativos":{"postura":"","actions":[],"alerts":[]}},"termometro":{"volatilidade":"baixo|medio|alto","liquidez":"boa|atencao|ruim","correlacao":"normal|alta|perigosa","stress_macro":"baixo|medio|alto","semaforo":"verde|amarelo|vermelho","nota":""},"checklist_do_dia":{"fazer":["","",""],"evitar":["","",""]},"opportunities_cards":[{"classe":"","tese":"","gatilho":"","invalidacao":"","riscos":["","",""],"confianca":"alta|media|baixa","risco_nivel":"baixo|medio|alto","acao":"MONITORAR|SIMULAR"}]},"disclaimer":"Conteudo educacional."}'
    }
  };

  var p = prompts[agentId];
  if (!p) return { sys: base, usr: 'Agente ' + agentId + ': analise e retorne JSON compacto. INPUT:' + JSON.stringify({ snap: snap, profile: profile }) };
  return p;
}

// ================================================================
// PIPELINE RUNNER
// ================================================================
function runPipeline() {
  if (!AIKEY.get()) { setState({ page: 'ai_key' }); return; }
  stateSet({ generating: true, brief: null, agentOutputs: {}, progress: [] });
  render();

  var pipeline = ST.pipeline === 'daily' ? DAILY_PIPELINE : DEEP_PIPELINE;
  var snap = MOCK_SNAPSHOT;

  // Step 1: fetch snapshot
  var fetchSnap = ST.config.dsUrl
    ? fetch(ST.config.dsUrl + '/snapshot?symbols=' + ST.config.defaultAssets + '&include=macro,events,news')
        .then(function(r) { return r.ok ? r.json() : snap; })
        .catch(function() { return snap; })
    : Promise.resolve(snap);

  fetchSnap.then(function(s) {
    snap = s;
    stateSet({ snapshot: snap, progress: [{ label: 'Snapshot recebido', status: 'done' }] });
    addLog('FETCH_SNAPSHOT', 'ok', s.quality ? s.quality.source : 'mock');
    render();

    // Step 2: run agents sequentially
    var bundle = {};
    var prog = [{ label: 'Snapshot recebido', status: 'done' }];
    var idx = 0;

    function runNext() {
      if (idx >= pipeline.length) {
        // Done - process final result
        var cio = bundle['ORCHESTRATOR_CIO'];
        var brief = null;
        if (cio && cio.morning_brief) {
          brief = cio.morning_brief;
          if (brief.opportunities_cards) {
            brief.opportunities_cards = applyPolicy(brief.opportunities_cards, ST.riskProfile);
          }
          // Save to Supabase
          if (ST.sbClient) {
            ST.sbClient.saveBrief({
              risk_profile: ST.riskProfile,
              pipeline_mode: ST.pipeline,
              brief_json: brief,
              snapshot_json: snap,
              agent_bundle: bundle,
              username: ST.user ? ST.user.username : 'admin'
            }).then(function(saved) {
              addLog('BRIEF_SAVED_DB', 'ok', saved && saved[0] ? saved[0].id : '');
            }).catch(function(e) {
              addLog('BRIEF_SAVED_DB', 'warn', e.message);
            });
          }
        } else {
          brief = { _error: true, _raw: cio };
        }
        addLog('GENERATE_BRIEF', 'ok', 'mode:' + ST.pipeline + ' profile:' + ST.riskProfile + ' agents:' + pipeline.length);
        setState({ generating: false, brief: brief });
        return;
      }

      var agId = pipeline[idx];
      prog.push({ label: agId + ' analisando...', status: 'running' });
      stateSet({ progress: prog.slice() });
      render();

      var prev = {};
      Object.keys(bundle).forEach(function(k) {
        prev[k] = { thesis: bundle[k].thesis, alerts: bundle[k].alerts };
      });
      if (agId === 'ORCHESTRATOR_CIO') prev = bundle;

      var prompt = buildPrompt(agId, snap, ST.riskProfile, ST.config.horizon, prev);

      callAI(prompt.sys, prompt.usr, 1800).then(function(result) {
        bundle[agId] = result;
        ST.agentOutputs[agId] = result;
        addLog('AGENT_' + agId, result.parse_error ? 'warn' : 'ok', '');
        prog[prog.length - 1] = { label: agId + ' completo', status: 'done' };
        stateSet({ progress: prog.slice() });
        idx++;
        setTimeout(runNext, 100);
      }).catch(function(e) {
        bundle[agId] = { agent: agId, error: e.message };
        addLog('AGENT_' + agId, 'fail', e.message);
        prog[prog.length - 1] = { label: agId + ' erro: ' + e.message.slice(0,40), status: 'done' };
        stateSet({ progress: prog.slice() });
        idx++;
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
  if (attrs) {
    Object.keys(attrs).forEach(function(k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class' || k === 'className') { e.className = v; return; }
      if (k === 'style' && typeof v === 'object') { Object.assign(e.style, v); return; }
      if (k.slice(0,2) === 'on') { e.addEventListener(k.slice(2).toLowerCase(), v); return; }
      if (k === 'disabled' && v) { e.disabled = true; return; }
      e.setAttribute(k, v);
    });
  }
  if (children !== undefined && children !== null) {
    if (typeof children === 'string') {
      e.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(function(c) {
        if (c === null || c === undefined) return;
        if (typeof c === 'string') { e.appendChild(document.createTextNode(c)); return; }
        e.appendChild(c);
      });
    } else if (typeof children === 'object' && children.nodeType) {
      e.appendChild(children);
    }
  }
  return e;
}

function div(cls, children, style) {
  var attrs = {};
  if (cls) attrs['class'] = cls;
  if (style) attrs['style'] = style;
  return el('div', attrs, children);
}

function p(cls, text) {
  return el('p', cls ? { 'class': cls } : {}, text);
}

function span(cls, text) {
  return el('span', cls ? { 'class': cls } : {}, text);
}

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
  var app = div('app', [renderSidebar(), div('main', [renderPage()])]);
  root.appendChild(app);
}

// ================================================================
// LOGIN PAGE
// ================================================================
function renderLogin() {
  var uVal = '', pVal = '';
  var wrap = div('login-wrap');
  var card = div('login-card');

  var logo = div('login-logo');
  setHTML(logo, '<div class="login-name">CIO DIGITAL</div><div class="login-line"></div><div class="login-sub">Family Office &middot; Mesa de Operacoes</div>');

  var errEl = div('login-err', '');
  
  var uInput = el('input', { type: 'text', class: 'input', autocomplete: 'username',
    oninput: function(e) { uVal = e.target.value; },
    onkeydown: function(e) { if (e.key === 'Enter') loginBtn.click(); }
  });
  var pInput = el('input', { type: 'password', class: 'input', autocomplete: 'current-password',
    oninput: function(e) { pVal = e.target.value; },
    onkeydown: function(e) { if (e.key === 'Enter') loginBtn.click(); }
  });

  var loginBtn = el('button', { class: 'login-btn', onclick: function() {
    loginBtn.disabled = true; loginBtn.textContent = 'Autenticando...';
    setTimeout(function() {
      if (uVal === 'diogobrasileiro' && pVal === 'dbsa1981') {
        stateSet({ logged: true, user: { username: uVal, role: 'admin' } });
        initSupabase().then(function() { render(); });
      } else {
        errEl.textContent = 'Credenciais invalidas.';
        loginBtn.disabled = false; loginBtn.textContent = 'Entrar';
      }
    }, 500);
  }}, 'Entrar');

  var uf = div('login-fg', [el('label', {}, 'Usuario'), uInput]);
  var pf = div('login-fg', [el('label', {}, 'Senha'), pInput]);
  var note = div('login-note');
  note.textContent = 'Plataforma educacional e analitica. Nao constitui recomendacao individual. Todo investimento tem risco.';

  append(card, logo, uf, pf, loginBtn, errEl, note);
  append(wrap, card);
  return wrap;
}

// ================================================================
// SIDEBAR
// ================================================================
function renderSidebar() {
  var hasKey = !!AIKEY.get();
  var dbSt = ST.dbStatus;

  var logo = div('sb-logo');
  var nameEl = div('sb-name', 'CIO DIGITAL');
  var verEl = div('sb-ver', 'v' + APP_VERSION + ' Mesa de Operacoes');
  var aiDot = div('sb-aistat', [
    el('span', { class: 'ai-dot ' + (hasKey ? 'on' : 'off') }),
    el('span', { class: 'ai-label' }, hasKey ? 'IA Ativa - ' + (ST.aiCfg.provider === 'openai' ? 'OpenAI' : ST.aiCfg.provider === 'gemini' ? 'Gemini (Free)' : 'Anthropic') : 'IA nao configurada')
  ]);
  append(logo, nameEl, verEl, aiDot);
  if (ST.sbClient) {
    var dbDot = div('sb-aistat', [
      el('span', { class: 'ai-dot ' + (dbSt === 'ok' ? 'on' : 'off') }),
      el('span', { class: 'ai-label' }, dbSt === 'ok' ? 'Supabase Online' : dbSt === 'syncing' ? 'Sincronizando...' : 'DB Offline')
    ]);
    logo.appendChild(dbDot);
  }

  var NAV_SECTIONS = [
    { title: 'Mesa', items: [
      { id: 'dashboard', icon: '⚡', label: 'Morning Brief' },
      { id: 'events', icon: '📡', label: 'Eventos' },
      { id: 'opportunities', icon: '🎯', label: 'Oportunidades' },
      { id: 'portfolio', icon: '📊', label: 'Portfolio' }
    ]},
    { title: 'Analise', items: [
      { id: 'agents', icon: '🤖', label: 'Agentes' },
      { id: 'agent_outputs', icon: '🧠', label: 'Outputs IA' }
    ]},
    { title: 'Config', items: [
      { id: 'ai_key', icon: '🔑', label: 'IA & API Key' },
      { id: 'profiles', icon: '🛡️', label: 'Perfis & Regras' },
      { id: 'data_apis', icon: '🔌', label: 'Dados & APIs' },
      { id: 'supabase', icon: '🗄️', label: 'Banco de Dados' },
      { id: 'ai_costs', icon: '💡', label: 'Pipeline & Custos' }
    ]},
    { title: 'Admin', items: [
      { id: 'logs', icon: '📋', label: 'Logs & Auditoria' },
      { id: 'settings', icon: '⚙️', label: 'Configuracoes' }
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
    var nokeyBadge = div('nokey-badge');
    nokeyBadge.appendChild(div('nokey-title', '🔑 API KEY NECESSARIA'));
    nokeyBadge.appendChild(div('nokey-sub', 'Clique para configurar'));
    nokeyBadge.addEventListener('click', function() { setState({ page: 'ai_key' }); });
    bottom.appendChild(nokeyBadge);
  } else {
    var keyOk = div('key-ok-badge');
    keyOk.innerHTML = '<span class="ai-dot on"></span><span class="ai-label">IA Conectada</span>';
    bottom.appendChild(keyOk);
  }

  var userArea = div('user-area');
  var av = div('user-av', ST.user ? ST.user.username[0].toUpperCase() : 'A');
  var info = div('');
  info.appendChild(div('user-name', ST.user ? ST.user.username : ''));
  info.appendChild(div('user-role', ST.user ? ST.user.role.toUpperCase() : ''));
  append(userArea, av, info);
  bottom.appendChild(userArea);

  var logoutBtn = el('button', { class: 'btn-logout', onclick: function() {
    setState({ logged: false, user: null, brief: null, snapshot: null, sbClient: null, dbStatus: null, page: 'dashboard' });
  }}, 'Sair');
  bottom.appendChild(logoutBtn);

  var sb = div('sidebar');
  append(sb, logo, nav, bottom);
  return sb;
}

// ================================================================
// PAGE ROUTER
// ================================================================
function renderPage() {
  var pages = {
    dashboard: renderDashboard,
    events: renderEvents,
    opportunities: renderOpportunities,
    portfolio: renderPortfolio,
    agents: renderAgents,
    agent_outputs: renderAgentOutputs,
    ai_key: renderAIKey,
    profiles: renderProfiles,
    data_apis: renderDataAPIs,
    supabase: renderSupabase,
    ai_costs: renderAICosts,
    logs: renderLogs,
    settings: renderSettings
  };
  var fn = pages[ST.page] || renderDashboard;
  return fn();
}

// ================================================================
// DASHBOARD
// ================================================================
function renderDashboard() {
  var hasKey = !!AIKEY.get();
  var wrap = div('');
  var today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Header
  var hdr = div('page-header');
  var titleSide = div('');
  titleSide.appendChild(div('page-title', 'MORNING BRIEF'));
  titleSide.appendChild(div('page-sub', today + ' - Modo: ' + (ST.pipeline === 'daily' ? 'Diario (4 agentes)' : 'Deep Dive (10 agentes)')));

  var ctrlSide = div('', null, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' });

  // Profile buttons
  var profRow = div('profile-row');
  ['CONSERVADOR','SEGURO','ARROJADO'].forEach(function(k) {
    var pb = el('button', { class: 'pbtn ' + k[0] + (ST.riskProfile === k ? ' on' : ''),
      onclick: function() { setState({ riskProfile: k }); }
    }, RISK_PROFILES[k].label);
    profRow.appendChild(pb);
  });
  ctrlSide.appendChild(profRow);

  // Pipeline toggle
  var pipeToggle = div('pipe-toggle');
  var bdaily = el('button', { class: 'pipe-btn' + (ST.pipeline === 'daily' ? ' on' : ''),
    onclick: function() { setState({ pipeline: 'daily' }); }
  }, '⚡ Diario');
  var bdeep = el('button', { class: 'pipe-btn' + (ST.pipeline === 'deep' ? ' on' : ''),
    onclick: function() { setState({ pipeline: 'deep' }); }
  }, '🔬 Deep Dive');
  append(pipeToggle, bdaily, bdeep);
  ctrlSide.appendChild(pipeToggle);

  // Action buttons
  var actRow = div('', null, { display: 'flex', gap: '8px' });
  if (ST.brief && !ST.brief._error) {
    var expBtn = btn('btn-secondary', '⬇ Exportar JSON', function() {
      var blob = new Blob([JSON.stringify({ brief: ST.brief, snapshot: ST.snapshot, ts: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'morning-brief-' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
    });
    actRow.appendChild(expBtn);
  }
  var genBtn = btn('btn-primary', ST.generating ? '⚙️ Processando...' : '⚡ Gerar Morning Brief', function() {
    if (!ST.generating) runPipeline();
  }, ST.generating);
  actRow.appendChild(genBtn);
  ctrlSide.appendChild(actRow);

  append(hdr, titleSide, ctrlSide);
  wrap.appendChild(hdr);

  // Banners
  if (!hasKey) {
    var keyBanner = div('banner banner-err');
    keyBanner.textContent = '🔑 API Key nao configurada - acesse IA & API Key para conectar.';
    keyBanner.style.cursor = 'pointer';
    keyBanner.addEventListener('click', function() { setState({ page: 'ai_key' }); });
    wrap.appendChild(keyBanner);
  }
  if (!ST.config.dsUrl) {
    var dsBanner = div('banner banner-warn', '⚠️ Data Service nao configurado - usando dados de demonstracao.');
    wrap.appendChild(dsBanner);
  }

  // Snapshot bar
  if (ST.snapshot) wrap.appendChild(renderSnapshotBar(ST.snapshot));

  // Generating state
  if (ST.generating) {
    var spinWrap = div('spinner-wrap');
    spinWrap.appendChild(div('spinner'));
    spinWrap.appendChild(p('', 'Pipeline em execucao... aguarde'));
    var progList = div('');
    ST.progress.forEach(function(prog) {
      var icon = prog.status === 'done' ? '✓' : prog.status === 'running' ? '◉' : '○';
      progList.appendChild(div('prog-item ' + prog.status, icon + ' ' + prog.label));
    });
    spinWrap.appendChild(progList);
    wrap.appendChild(spinWrap);
    return wrap;
  }

  // No brief
  if (!ST.brief) {
    var empty = div('empty-state');
    empty.innerHTML = '<div class="empty-icon">⚡</div><div class="empty-title">Nenhum brief gerado</div><div class="empty-sub">Selecione perfil e modo, depois clique em Gerar Morning Brief.</div>';
    wrap.appendChild(empty);
    wrap.appendChild(renderDisclaimer());
    return wrap;
  }

  if (ST.brief._error) {
    wrap.appendChild(div('banner banner-err', 'Erro ao parsear resposta do CIO. Verifique Outputs IA.'));
    wrap.appendChild(renderDisclaimer());
    return wrap;
  }

  var mb = ST.brief;
  var grid = div('grid2');

  // Block 1: Radar 30s
  var b1 = div('card card-blue col2');
  var b1h = div('card-title'); b1h.innerHTML = '<span class="card-badge">01</span> RADAR 30S';
  var b1body = p('', mb.radar_30s || '—');
  b1body.style.cssText = 'font-size:15px;line-height:1.7;font-weight:300';
  append(b1, b1h, b1body);
  grid.appendChild(b1);

  // Block 3: Termometro (rendered before bullets for visual grouping)
  var t = mb.termometro || {};
  var thermCard = div('card card-gold');
  var th = div('card-title'); th.innerHTML = '<span class="card-badge">03</span> TERMOMETRO DE RISCO';
  thermCard.appendChild(th);

  var sema = div('sema');
  ['verde','amarelo','vermelho'].forEach(function(c) {
    sema.appendChild(el('span', { class: 'sema-dot ' + c + (t.semaforo === c ? ' on' : '') }));
  });
  var semaLabel = el('span', { class: 'sema-label' }, (t.semaforo || '').toUpperCase());
  var semaColors = { verde: 'var(--gr)', amarelo: 'var(--am)', vermelho: 'var(--rd)' };
  semaLabel.style.color = semaColors[t.semaforo] || 'var(--tx2)';
  sema.appendChild(semaLabel);
  thermCard.appendChild(sema);

  var thermoGrid = div('thermo-grid');
  [['Volatilidade', t.volatilidade], ['Liquidez', t.liquidez], ['Correlacao', t.correlacao], ['Stress Macro', t.stress_macro]].forEach(function(pair) {
    var titem = div('thermo-item');
    titem.appendChild(div('thermo-lbl', pair[0]));
    var tval = div('thermo-val', (pair[1] || '—').toUpperCase());
    var colorMap = { baixo: 'var(--gr)', boa: 'var(--gr)', normal: 'var(--gr)', medio: 'var(--am)', atencao: 'var(--am)', alta: 'var(--am)', alto: 'var(--rd)', ruim: 'var(--rd)', perigosa: 'var(--rd)' };
    tval.style.color = colorMap[pair[1]] || 'var(--am)';
    titem.appendChild(tval);
    thermoGrid.appendChild(titem);
  });
  thermCard.appendChild(thermoGrid);
  if (t.nota) thermCard.appendChild(p('', t.nota));
  grid.appendChild(thermCard);

  // Block 2: Bullets
  var bullets = mb.resumo_6_bullets || [];
  var b2 = div('card card-purple col2');
  var b2h = div('card-title'); b2h.innerHTML = '<span class="card-badge">02</span> RESUMO ' + bullets.length + ' PONTOS-CHAVE';
  b2.appendChild(b2h);
  bullets.forEach(function(b, i) {
    var row = div('');
    row.style.cssText = 'display:flex;gap:10px;padding:6px 0;border-bottom:' + (i < bullets.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none');
    var num = span(''); num.style.cssText = 'color:var(--ac);font-family:JetBrains Mono,monospace;font-size:10px;flex-shrink:0';
    num.textContent = String(i + 1).padStart(2, '0');
    var txt = span(''); txt.style.cssText = 'font-size:12px;color:var(--tx2);line-height:1.5';
    txt.textContent = b;
    append(row, num, txt);
    b2.appendChild(row);
  });
  grid.appendChild(b2);

  // Block 4: Opportunities
  var opps = mb.opportunities_cards || [];
  var b4 = div('card card-green col2');
  var b4h = div('card-title'); b4h.innerHTML = '<span class="card-badge">04</span> OPORTUNIDADES - ' + RISK_PROFILES[ST.riskProfile].label.toUpperCase();
  b4.appendChild(b4h);
  if (!opps.length) {
    b4.appendChild(p('', 'Nenhuma oportunidade aprovada para o perfil atual. Foco em monitoramento.'));
  } else {
    opps.forEach(function(o) { b4.appendChild(renderOppCard(o)); });
  }
  grid.appendChild(b4);

  // Block 5: Risks
  var risks = mb.risks_top5 || [];
  var b5 = div('card card-red');
  var b5h = div('card-title'); b5h.innerHTML = '<span class="card-badge">05</span> RISCOS TOP 5';
  b5.appendChild(b5h);
  risks.forEach(function(r, i) {
    var row = div('');
    row.style.cssText = 'display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)';
    var num = span(''); num.style.cssText = 'color:var(--rd);font-size:10px;font-family:JetBrains Mono,monospace;flex-shrink:0';
    num.textContent = (i + 1) + '.';
    var txt = span(''); txt.style.cssText = 'font-size:11px;color:var(--tx2)';
    txt.textContent = r;
    append(row, num, txt);
    b5.appendChild(row);
  });
  grid.appendChild(b5);

  // Block 6: Checklist
  var cl = mb.checklist_do_dia || {};
  var b6 = div('card card-green');
  var b6h = div('card-title'); b6h.innerHTML = '<span class="card-badge">06</span> CHECKLIST DO DIA';
  b6.appendChild(b6h);
  var ckGrid = div('check-grid');
  var fazCol = div('');
  fazCol.appendChild(div('check-title', 'FAZER'));
  (cl.fazer || []).forEach(function(item) {
    var ci = div('check-item');
    var mk = span(''); mk.style.color = 'var(--gr)'; mk.textContent = '›';
    var txt = document.createTextNode(' ' + item);
    append(ci, mk, txt);
    fazCol.appendChild(ci);
  });
  var evitarCol = div('');
  evitarCol.appendChild(div('check-title', 'EVITAR'));
  (cl.evitar || []).forEach(function(item) {
    var ci = div('check-item');
    var mk = span(''); mk.style.color = 'var(--rd)'; mk.textContent = '›';
    var txt = document.createTextNode(' ' + item);
    append(ci, mk, txt);
    evitarCol.appendChild(ci);
  });
  append(ckGrid, fazCol, evitarCol);
  b6.appendChild(ckGrid);
  grid.appendChild(b6);

  // Block 7: Plan by class
  var plan = mb.plan_by_class || {};
  var planKeys = Object.keys(plan);
  if (planKeys.length) {
    var b7 = div('card card-blue col2');
    var b7h = div('card-title'); b7h.innerHTML = '<span class="card-badge">07</span> PLANO POR CLASSE';
    b7.appendChild(b7h);
    var planGrid = div('plan-grid');
    planKeys.forEach(function(cls) {
      var data = plan[cls];
      var pc = div('plan-card');
      var pcTop = div('');
      pcTop.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
      var pcCls = div('plan-cls', cls.replace(/_/g,' '));
      var postureClass = data.postura === 'ofensiva' ? 'plan-ofe' : data.postura === 'defensiva' ? 'plan-def' : 'plan-neu';
      var postureEl = span('plan-posture ' + postureClass, (data.postura || '').toUpperCase());
      append(pcTop, pcCls, postureEl);
      pc.appendChild(pcTop);
      (data.actions || []).forEach(function(a) {
        var ai = div(''); ai.style.cssText = 'font-size:10px;color:var(--tx2);padding:1px 0';
        ai.textContent = '› ' + a;
        pc.appendChild(ai);
      });
      (data.alerts || []).forEach(function(a) {
        var ai = div(''); ai.style.cssText = 'font-size:10px;color:var(--am);padding:1px 0';
        ai.textContent = '⚠ ' + a;
        pc.appendChild(ai);
      });
      planGrid.appendChild(pc);
    });
    b7.appendChild(planGrid);
    grid.appendChild(b7);
  }

  wrap.appendChild(grid);
  wrap.appendChild(renderDisclaimer());
  return wrap;
}

function renderSnapshotBar(snap) {
  var bar = div('snap-bar');
  var hdr = div('snap-header');
  hdr.appendChild(span('snap-lbl', 'SNAPSHOT DE MERCADO'));
  var qual = span('tag');
  qual.textContent = snap.quality && snap.quality.partial ? '⚠ PARCIAL' : '✓ OK';
  qual.style.color = snap.quality && snap.quality.partial ? 'var(--am)' : 'var(--gr)';
  hdr.appendChild(qual);
  bar.appendChild(hdr);
  var grid = div('snap-grid');
  Object.keys(snap.prices || {}).forEach(function(sym) {
    var d = snap.prices[sym];
    var item = div('snap-item');
    item.appendChild(div('snap-sym', sym));
    item.appendChild(div('snap-val', (d.last || 0).toLocaleString('pt-BR')));
    if (d.chg24h_pct != null) {
      var chg = div('snap-chg ' + (d.chg24h_pct >= 0 ? 'pos' : 'neg'));
      chg.textContent = (d.chg24h_pct >= 0 ? '+' : '') + d.chg24h_pct.toFixed(2) + '%';
      item.appendChild(chg);
    }
    grid.appendChild(item);
  });
  Object.keys(snap.macro_br || {}).forEach(function(k) {
    var v = snap.macro_br[k];
    if (v == null) return;
    var item = div('snap-item');
    item.appendChild(div('snap-sym', k.toUpperCase().replace(/_/g,' ')));
    item.appendChild(div('snap-val', String(v)));
    grid.appendChild(item);
  });
  bar.appendChild(grid);
  return bar;
}

function renderOppCard(o) {
  var card = div('opp-card');
  var top = div('opp-top');
  top.appendChild(span('opp-cls', o.classe || o.class || ''));
  var actEl = span('opp-act ' + ((o.acao || 'MONITORAR') === 'SIMULAR' ? 'act-sim' : 'act-mon'));
  actEl.textContent = o.acao || 'MONITORAR';
  top.appendChild(actEl);
  card.appendChild(top);
  card.appendChild(div('opp-thesis', o.tese || o.thesis || ''));
  if (o.gatilho) {
    var gd = div('opp-detail');
    gd.innerHTML = '<strong>GATILHO</strong>';
    gd.appendChild(document.createTextNode(o.gatilho));
    card.appendChild(gd);
  }
  if (o.invalidacao) {
    var id_ = div('opp-detail');
    id_.innerHTML = '<strong>INVALIDACAO</strong>';
    id_.appendChild(document.createTextNode(o.invalidacao));
    card.appendChild(id_);
  }
  if (o.riscos && o.riscos.length) {
    var rr = div('opp-risks');
    o.riscos.forEach(function(r) { rr.appendChild(span('risk-tag', r)); });
    card.appendChild(rr);
  }
  var confCls = o.confianca === 'alta' ? 'conf-high' : o.confianca === 'media' ? 'conf-med' : 'conf-low';
  card.appendChild(span('conf-badge ' + confCls, (o.confianca || '').toUpperCase() + ' CONFIANCA'));
  return card;
}

function renderDisclaimer() {
  var d = div('disclaimer');
  d.innerHTML = '<strong>⚠️ Conteudo educacional.</strong> Nao constitui recomendacao individual de compra/venda. Todo investimento tem risco. Decisoes sao de responsabilidade do investidor.';
  return d;
}

// ================================================================
// EVENTS PAGE
// ================================================================
function renderEvents() {
  var snap = ST.snapshot || MOCK_SNAPSHOT;
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'EVENTOS DO DIA'));
  t.appendChild(div('page-sub', 'Calendario e noticias do snapshot atual'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var cats = ['Todos','Macro Global','Brasil','Cripto','Geopolitica','Corporativo'];
  var fb = div('filter-bar');
  cats.forEach(function(c) {
    var b = el('button', { class: 'filter-btn' + (ST.eventsFilter === c ? ' on' : ''),
      onclick: function() { setState({ eventsFilter: c }); }
    }, c);
    fb.appendChild(b);
  });
  wrap.appendChild(fb);

  var evTitle = p(''); evTitle.style.cssText = 'font-size:9px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:10px';
  evTitle.textContent = 'EVENTOS';
  wrap.appendChild(evTitle);

  (snap.events || []).forEach(function(ev) {
    var card = div('card');
    card.style.setProperty('--card-color', 'var(--bd2)');
    var top = div(''); top.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start';
    var titleEl = p(''); titleEl.style.cssText = 'font-size:13px;font-weight:500;line-height:1.4;margin-bottom:7px';
    titleEl.textContent = ev.title;
    var impBadge = span('');
    var impColors = { high: 'background:rgba(232,64,64,.15);color:var(--rd)', med: 'background:rgba(200,136,32,.15);color:var(--am)' };
    impBadge.style.cssText = (impColors[ev.impact] || 'background:rgba(46,168,74,.15);color:var(--gr)') + ';padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;flex-shrink:0;margin-left:8px;margin-top:2px';
    impBadge.textContent = (ev.impact || '').toUpperCase();
    append(top, titleEl, impBadge);
    card.appendChild(top);
    var when = p(''); when.style.cssText = 'font-size:9px;color:var(--tx3)';
    when.textContent = '📅 ' + ev.when;
    card.appendChild(when);
    wrap.appendChild(card);
  });

  var newsTitle = p(''); newsTitle.style.cssText = 'font-size:9px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:10px;margin-top:10px';
  newsTitle.textContent = 'NOTICIAS';
  wrap.appendChild(newsTitle);

  (snap.news || []).forEach(function(n) {
    var card = div('card');
    var titleEl = p(''); titleEl.style.cssText = 'font-size:12px;font-weight:500;line-height:1.4;margin-bottom:7px';
    titleEl.textContent = n.title;
    card.appendChild(titleEl);
    var meta = div(''); meta.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
    var srcEl = span(''); srcEl.style.cssText = 'font-size:9px;color:var(--tx3)';
    srcEl.textContent = '📌 ' + n.source + ' · ' + n.time;
    var tags = div('');
    (n.tags || []).forEach(function(tag) {
      var tg = span('tag', tag);
      tg.style.marginLeft = '3px';
      tags.appendChild(tg);
    });
    append(meta, srcEl, tags);
    card.appendChild(meta);
    wrap.appendChild(card);
  });

  return wrap;
}

// ================================================================
// OPPORTUNITIES PAGE
// ================================================================
function renderOpportunities() {
  var opps = ST.brief ? ST.brief.opportunities_cards || [] : [];
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'OPORTUNIDADES'));
  t.appendChild(div('page-sub', 'Aprovadas pelo Risk Policy Engine - Perfil: ' + RISK_PROFILES[ST.riskProfile].label));
  hdr.appendChild(t);
  wrap.appendChild(hdr);
  if (!opps.length) {
    var em = div('empty-state');
    em.innerHTML = '<div class="empty-icon">🎯</div><div class="empty-title">Nenhuma oportunidade aprovada</div><div class="empty-sub">Gere um Morning Brief ou aguarde candidatos qualificados para o perfil atual.</div>';
    wrap.appendChild(em);
  } else {
    opps.forEach(function(o) { wrap.appendChild(renderOppCard(o)); });
  }
  wrap.appendChild(renderDisclaimer());
  return wrap;
}

// ================================================================
// PORTFOLIO PAGE
// ================================================================
function renderPortfolio() {
  var total = Object.values(ST.portfolio).reduce(function(a, b) { return a + b; }, 0);
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'PORTFOLIO'));
  t.appendChild(div('page-sub', 'Alocacao por classe - Soma: ' + total + '%'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var card = div('card card-blue');
  var ct = div('card-title', 'AJUSTE DE ALOCACAO');
  card.appendChild(ct);
  var hint = p(''); hint.style.cssText = 'font-size:11px;color:var(--tx2);margin-bottom:14px';
  hint.textContent = 'Ajuste a alocacao por classe (%):';
  card.appendChild(hint);

  Object.keys(ST.portfolio).forEach(function(cls) {
    var row = div('slider-row');
    var lbl = el('label', {}, cls);
    var slider = el('input', {
      type: 'range', min: '0', max: '100',
      style: { flex: '1', accentColor: 'var(--ac)' }
    });
    slider.value = String(ST.portfolio[cls]);
    var valEl = div('slider-val', ST.portfolio[cls] + '%');
    slider.addEventListener('input', function(e) {
      var newPct = parseInt(e.target.value);
      ST.portfolio[cls] = newPct;
      valEl.textContent = newPct + '%';
      storeSet('cio_portfolio', ST.portfolio);
      if (ST.sbClient) {
        clearTimeout(window._ptimer);
        window._ptimer = setTimeout(function() {
          ST.sbClient.savePortfolio({ allocations: ST.portfolio, username: ST.user ? ST.user.username : 'admin' }).catch(function() {});
        }, 2000);
      }
    });
    append(row, lbl, slider, valEl);
    card.appendChild(row);
  });

  if (total !== 100) {
    var warn = p(''); warn.style.cssText = 'font-size:10px;color:var(--am);margin-top:6px';
    warn.textContent = '⚠️ Soma atual: ' + total + '% (recomendado: 100%)';
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
// AGENTS PAGE
// ================================================================
function renderAgents() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'AGENTES'));
  t.appendChild(div('page-sub', Object.keys(AGENTS).length + ' especialistas ativos'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var grid = div('agent-grid');
  Object.keys(AGENTS).forEach(function(id) {
    var ag = AGENTS[id];
    var card = div('agent-card');
    card.appendChild(div('agent-name', id));
    card.appendChild(div('agent-ver', 'v2.1'));
    card.appendChild(div('agent-desc', ag.desc));
    var stylesWrap = div(''); stylesWrap.style.marginBottom = '8px';
    ag.styles.forEach(function(s) { stylesWrap.appendChild(span('agent-style', s)); });
    card.appendChild(stylesWrap);
    var pipesWrap = div(''); pipesWrap.style.marginBottom = '10px';
    if (ag.pipeline.indexOf('daily') >= 0) pipesWrap.appendChild(span('ptag ptag-d', '⚡ Diario'));
    if (ag.pipeline.indexOf('deep') >= 0) pipesWrap.appendChild(span('ptag ptag-dd', '🔬 Deep Dive'));
    card.appendChild(pipesWrap);
    var resultEl = div('');
    var testBtn = btn('btn-secondary', '▶ Testar Agente', function() {
      if (!AIKEY.get()) { alert('Configure a API Key em IA & API Key.'); return; }
      testBtn.disabled = true; testBtn.textContent = 'Testando...';
      var snap = ST.snapshot || MOCK_SNAPSHOT;
      var prompt = buildPrompt(id, snap, ST.riskProfile, ST.config.horizon, {});
      callAI(prompt.sys, prompt.usr, 600).then(function(result) {
        resultEl.className = 'agent-result';
        resultEl.textContent = JSON.stringify(result, null, 1).slice(0, 300) + '...';
        addLog('TEST_' + id, 'ok', '');
      }).catch(function(e) {
        resultEl.className = 'agent-result';
        resultEl.style.color = 'var(--rd)';
        resultEl.textContent = e.message;
        addLog('TEST_' + id, 'fail', e.message);
      }).then(function() {
        testBtn.disabled = false; testBtn.textContent = '▶ Testar Agente';
      });
    });
    append(card, resultEl, testBtn);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

// ================================================================
// AGENT OUTPUTS PAGE
// ================================================================
function renderAgentOutputs() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'OUTPUTS IA'));
  t.appendChild(div('page-sub', 'Resultado bruto de cada agente do ultimo pipeline'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var outputs = ST.agentOutputs;
  if (!Object.keys(outputs).length) {
    var em = div('empty-state');
    em.innerHTML = '<div class="empty-icon">🧠</div><div class="empty-title">Sem outputs</div><div class="empty-sub">Gere um Morning Brief para ver os outputs de cada agente.</div>';
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
    card.style.cssText = 'background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:14px;cursor:pointer';
    var topRow = div('');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
    var nameEl = span(''); nameEl.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:11px;color:var(--ac);font-weight:600';
    nameEl.textContent = id;
    var statusEl = span(''); statusEl.style.cssText = 'font-size:9px;font-weight:700;color:' + (out.parse_error ? 'var(--rd)' : 'var(--gr)');
    statusEl.textContent = out.parse_error ? '⚠ PARSE ERR' : '✓ OK';
    append(topRow, nameEl, statusEl);
    card.appendChild(topRow);
    (out.thesis || []).slice(0, 2).forEach(function(th) {
      var tp = p(''); tp.style.cssText = 'font-size:10px;color:var(--tx2);line-height:1.5;padding:1px 0';
      tp.textContent = '› ' + th;
      card.appendChild(tp);
    });
    card.appendChild(detailEl);
    card.addEventListener('click', function() {
      expanded = !expanded;
      detailEl.innerHTML = '';
      if (expanded) {
        var pre = el('pre', { style: { background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '6px', padding: '8px', fontSize: '9px', color: 'var(--tx2)', lineHeight: '1.6', overflow: 'auto', maxHeight: '200px', marginTop: '10px', whiteSpace: 'pre-wrap' } });
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
// AI KEY PAGE
// ================================================================
function renderAIKey() {
  var hasKey = !!AIKEY.get();
  var existingKey = AIKEY.get();
  var masked = existingKey ? existingKey.slice(0, 10) + '••••••••••••••••' + existingKey.slice(-4) : '';
  var wrap = div('');

  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'IA & API KEY'));
  t.appendChild(div('page-sub', 'Configure o cerebro de IA que alimenta todos os 10 agentes'));
  hdr.appendChild(t);
  if (hasKey) {
    var activeBadge = div('', null, { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(46,168,74,.1)', border: '1px solid rgba(46,168,74,.25)', borderRadius: '8px' });
    activeBadge.innerHTML = '<span class="ai-dot on"></span><span style="font-size:11px;color:var(--gr);font-weight:600">IA Ativa - ' + (ST.aiCfg.provider === 'openai' ? 'OpenAI' : ST.aiCfg.provider === 'gemini' ? 'Gemini (Free)' : 'Anthropic') + '</span>';
    hdr.appendChild(activeBadge);
  }
  wrap.appendChild(hdr);

  // Hero
  var hero = div('key-hero');
  hero.innerHTML = '<div class="key-hero-icon">🔑</div><div class="key-hero-title">Conecte seu Cerebro de IA</div><div class="key-hero-sub">A API key e usada para todos os agentes da mesa. Sua chave fica salva apenas no seu browser - nunca enviada a terceiros.</div>';
  wrap.appendChild(hero);

  // Provider selector
  var provCard = div('card card-blue');
  var pt = div('card-title', '1 — ESCOLHA O PROVEDOR');
  provCard.appendChild(pt);
  var provGrid = div('prov-grid');

  var PROVIDERS = {
    anthropic: { name: 'Anthropic Claude', icon: '🧠', desc: 'Claude Sonnet/Opus/Haiku. Melhor para analise financeira complexa.', link: 'https://console.anthropic.com/', models: [{ id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (recomendado)' }, { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (max qualidade)' }, { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (economico)' }] },
    openai: { name: 'OpenAI GPT', icon: '⚡', desc: 'GPT-4o e GPT-4o-mini. Alternativa robusta.', link: 'https://platform.openai.com/api-keys', models: [{ id: 'gpt-4o', label: 'GPT-4o (recomendado)' }, { id: 'gpt-4o-mini', label: 'GPT-4o mini (economico)' }, { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' }] },
    gemini: { name: 'Google Gemini', icon: '♊', desc: 'Gemini 2.0 Flash GRATIS — tier gratuito generoso. Ideal para uso sem custo.', link: 'https://aistudio.google.com/app/apikey', models: [{ id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (gratis - recomendado)' }, { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (gratis - mais leve)' }, { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (pago)' }] }
  };

  provGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
  ['anthropic', 'openai', 'gemini'].forEach(function(pid) {
    var info = PROVIDERS[pid];
    var pc = div('prov-card' + (ST.aiCfg.provider === pid ? ' on' : ''));
    pc.innerHTML = '<div class="prov-logo">' + info.icon + '</div><div class="prov-name">' + info.name + '</div><div class="prov-desc">' + info.desc + '</div>';
    var lnk = el('a', { class: 'ks-link', href: info.link, target: '_blank', rel: 'noopener' }, '→ Obter chave aqui');
    pc.appendChild(lnk);
    pc.addEventListener('click', function() {
      var nc = { provider: pid, model: info.models[0].id };
      stateSet({ aiCfg: nc });
      storeSet('cio_ai_cfg', nc);
      render();
    });
    provGrid.appendChild(pc);
  });
  provCard.appendChild(provGrid);

  var modelFg = div('fg');
  var modelLabel = el('label', {}, 'MODELO');
  var modelSel = el('select', { class: 'select', onchange: function(e) {
    var nc = Object.assign({}, ST.aiCfg, { model: e.target.value });
    stateSet({ aiCfg: nc });
    storeSet('cio_ai_cfg', nc);
  }});
  var models = PROVIDERS[ST.aiCfg.provider] ? PROVIDERS[ST.aiCfg.provider].models : PROVIDERS.anthropic.models;
  models.forEach(function(m) {
    var opt = el('option', { value: m.id }, m.label);
    if (m.id === ST.aiCfg.model) opt.selected = true;
    modelSel.appendChild(opt);
  });
  append(modelFg, modelLabel, modelSel);
  provCard.appendChild(modelFg);
  wrap.appendChild(provCard);

  // Steps
  var stepsCard = div('card card-blue');
  var st2 = div('card-title', '2 — COMO OBTER SUA CHAVE');
  stepsCard.appendChild(st2);
  var stepsGrid = div('key-steps');
  [
    ['01', 'Acesse o console', 'Anthropic: console.anthropic.com | OpenAI: platform.openai.com | Gemini (GRATIS): aistudio.google.com'],
    ['02', 'Crie uma API Key', 'Va em API Keys e crie uma nova chave. Gemini oferece tier gratuito generoso sem cartao de credito.'],
    ['03', 'Cole abaixo', 'Anthropic: sk-ant-... | OpenAI: sk-... | Gemini: AIza...'],
    ['04', 'Teste e salve', 'Clique em Testar para validar antes de salvar.']
  ].forEach(function(step) {
    var ks = div('key-step');
    ks.appendChild(div('ks-num', step[0]));
    ks.appendChild(div('ks-title', step[1]));
    ks.appendChild(div('ks-desc', step[2]));
    stepsGrid.appendChild(ks);
  });
  stepsCard.appendChild(stepsGrid);
  wrap.appendChild(stepsCard);

  // Key input card
  var inputCard = div('card card-blue');
  var st3 = div('card-title', '3 — COLE SUA CHAVE');
  inputCard.appendChild(st3);

  if (existingKey && !ST.keyInput) {
    var activeBanner = div('banner banner-ok');
    activeBanner.innerHTML = '✓ Chave ativa: <code style="font-family:monospace;font-size:10px">' + masked + '</code>';
    activeBanner.style.marginBottom = '14px';
    inputCard.appendChild(activeBanner);
  }

  var keyFg = div('fg');
  var keyLbl = el('label', {}, 'API KEY');
  var keyWrap = div('key-input-wrap');
  var keyInput = el('input', {
    type: ST.showKey ? 'text' : 'password',
    class: 'input',
    placeholder: existingKey ? 'Deixe em branco para manter atual' : 'sk-ant-api... ou sk-...',
    oninput: function(e) { ST.keyInput = e.target.value; }
  });
  if (ST.keyInput) keyInput.value = ST.keyInput;
  var eyeBtn = el('button', { class: 'key-eye', onclick: function() {
    ST.showKey = !ST.showKey;
    keyInput.type = ST.showKey ? 'text' : 'password';
    eyeBtn.textContent = ST.showKey ? '🙈' : '👁️';
  }}, ST.showKey ? '🙈' : '👁️');
  append(keyWrap, keyInput, eyeBtn);
  append(keyFg, keyLbl, keyWrap);
  inputCard.appendChild(keyFg);

  var msgEl = div('banner banner-ok'); msgEl.style.display = 'none'; msgEl.style.marginTop = '12px';

  var actRow = div('', null, { display: 'flex', gap: '10px', flexWrap: 'wrap' });

  var testBtn = btn('btn-primary', '▶ Testar Conexao', function() {
    var key = ST.keyInput || existingKey;
    if (!key) { msgEl.className = 'banner banner-err'; msgEl.textContent = 'Cole uma chave antes de testar.'; msgEl.style.display = 'flex'; return; }
    testBtn.disabled = true; testBtn.textContent = '⚙️ Testando...';
    var prevKey = AIKEY.get(); AIKEY.set(key);
    callAI('Retorne SOMENTE JSON valido.', '{"ping":true}', 50).then(function() {
      msgEl.className = 'banner banner-ok';
      msgEl.textContent = '✓ Conexao bem-sucedida com ' + (ST.aiCfg.provider === 'openai' ? 'OpenAI' : ST.aiCfg.provider === 'gemini' ? 'Gemini (Free)' : 'Anthropic') + '!';
    }).catch(function(e) {
      AIKEY.set(prevKey);
      msgEl.className = 'banner banner-err';
      msgEl.textContent = '✗ Erro: ' + e.message;
    }).then(function() {
      msgEl.style.display = 'flex';
      testBtn.disabled = false; testBtn.textContent = '▶ Testar Conexao';
    });
  });

  var saveBtn = btn('btn-green btn', '💾 Salvar Chave', function() {
    var key = ST.keyInput || existingKey;
    if (!key) { msgEl.className = 'banner banner-err'; msgEl.textContent = 'Nenhuma chave para salvar.'; msgEl.style.display = 'flex'; return; }
    AIKEY.set(key); ST.keyInput = '';
    msgEl.className = 'banner banner-ok';
    msgEl.textContent = '✓ Chave salva! Sistema usando ' + (ST.aiCfg.provider === 'openai' ? 'OpenAI' : ST.aiCfg.provider === 'gemini' ? 'Gemini (Free)' : 'Anthropic') + ' - ' + ST.aiCfg.model;
    msgEl.style.display = 'flex';
    render();
  });

  actRow.appendChild(testBtn);
  actRow.appendChild(saveBtn);
  if (existingKey) {
    var clearBtn = btn('btn-secondary', '🗑 Remover', function() {
      AIKEY.clear(); ST.keyInput = '';
      msgEl.className = 'banner banner-warn'; msgEl.textContent = 'Chave removida.'; msgEl.style.display = 'flex';
      render();
    });
    actRow.appendChild(clearBtn);
  }

  inputCard.appendChild(actRow);
  inputCard.appendChild(msgEl);
  wrap.appendChild(inputCard);

  // Security notes
  var secCard = div('card');
  secCard.appendChild(div('card-title', 'SEGURANCA & PRIVACIDADE'));
  var secGrid = div('grid2');
  [
    ['🔒 Armazenamento local', 'Chave salva no localStorage do seu browser. Nunca enviada ao servidor do CIO DIGITAL.'],
    ['🚀 Uso direto', 'Chamadas vao direto do browser para a API do provedor. Nenhum intermediario.'],
    ['🛡️ Boas praticas', 'Use uma chave dedicada para este app e configure limites de gasto no console.'],
    ['💰 Custo estimado', 'Gemini: GRATIS (15 req/min, 1M tokens/dia). Anthropic/OpenAI: ~4 chamadas (diario) ou ~10 (deep dive). Max 1800 tokens cada.']
  ].forEach(function(item) {
    var c = div('', null, { background: 'var(--bg3)', borderRadius: '7px', padding: '12px' });
    var t1 = p(''); t1.style.cssText = 'font-size:12px;font-weight:600;color:var(--tx);margin-bottom:4px';
    t1.textContent = item[0];
    var t2 = p(''); t2.style.cssText = 'font-size:10px;color:var(--tx3);line-height:1.6';
    t2.textContent = item[1];
    append(c, t1, t2);
    secGrid.appendChild(c);
  });
  secCard.appendChild(secGrid);
  wrap.appendChild(secCard);
  return wrap;
}

// ================================================================
// PROFILES PAGE
// ================================================================
function renderProfiles() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'PERFIS & REGRAS'));
  t.appendChild(div('page-sub', 'Presets do Risk Policy Engine'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);
  var cards = div('profile-cards');
  ['CONSERVADOR','SEGURO','ARROJADO'].forEach(function(k) {
    var cfg = RISK_PROFILES[k];
    var pc = div('profile-card');
    pc.style.background = ST.riskProfile === k ? cfg.bg : 'var(--bg2)';
    pc.style.borderColor = ST.riskProfile === k ? cfg.color : 'var(--bd)';
    var nameEl = p(''); nameEl.style.cssText = 'font-family:Bebas Neue,sans-serif;font-size:20px;letter-spacing:2px;color:' + cfg.color + ';margin-bottom:6px';
    nameEl.textContent = cfg.label;
    var descEl = p(''); descEl.style.cssText = 'font-size:11px;color:var(--tx2);margin-bottom:14px;line-height:1.5';
    descEl.textContent = cfg.desc;
    pc.appendChild(nameEl);
    pc.appendChild(descEl);
    var allowedTitle = p(''); allowedTitle.style.cssText = 'font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px';
    allowedTitle.textContent = 'Permitido';
    pc.appendChild(allowedTitle);
    var allowedWrap = div(''); allowedWrap.style.marginBottom = '10px';
    cfg.allowed.forEach(function(c) {
      var tg = span('tag', c);
      tg.style.cssText = 'border-color:' + cfg.color + '44;color:' + cfg.color + ';margin-right:3px;margin-bottom:3px;display:inline-block';
      allowedWrap.appendChild(tg);
    });
    pc.appendChild(allowedWrap);
    if (cfg.blocked.length) {
      var blockedTitle = p(''); blockedTitle.style.cssText = 'font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px';
      blockedTitle.textContent = 'Bloqueado';
      pc.appendChild(blockedTitle);
      var blockedWrap = div(''); blockedWrap.style.marginBottom = '10px';
      cfg.blocked.forEach(function(c) {
        var tg = span('tag', c);
        tg.style.cssText = 'border-color:rgba(232,64,64,.3);color:var(--rd);margin-right:3px;margin-bottom:3px;display:inline-block';
        blockedWrap.appendChild(tg);
      });
      pc.appendChild(blockedWrap);
    }
    if (ST.riskProfile === k) {
      var activeLabel = p(''); activeLabel.style.cssText = 'font-size:9px;color:' + cfg.color + ';font-weight:700;margin-top:10px';
      activeLabel.textContent = '✓ PERFIL ATIVO';
      pc.appendChild(activeLabel);
    }
    pc.addEventListener('click', function() { setState({ riskProfile: k }); });
    cards.appendChild(pc);
  });
  wrap.appendChild(cards);
  return wrap;
}

// ================================================================
// DATA & APIS PAGE
// ================================================================
function renderDataAPIs() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'DADOS & APIS'));
  t.appendChild(div('page-sub', 'Configuracao do Data Service e fontes de mercado'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var cfg = Object.assign({}, ST.config);
  var msgEl = div('banner banner-ok'); msgEl.style.display = 'none';

  var dsCard = div('card card-blue');
  dsCard.appendChild(div('card-title', 'DATA SERVICE'));
  var dsDesc = p(''); dsDesc.style.cssText = 'font-size:10px;color:var(--tx3);margin-bottom:14px;line-height:1.7';
  dsDesc.textContent = 'O Data Service e um backend que expoe /health e /snapshot. Se nao configurado, usa dados de demonstracao.';
  dsCard.appendChild(dsDesc);

  var urlFg = div('fg');
  var urlLbl = el('label', {}, 'DATA_SERVICE_BASE_URL');
  var urlInput = el('input', { class: 'input', type: 'text', placeholder: 'https://seu-endpoint.run.app', value: cfg.dsUrl || '',
    oninput: function(e) { cfg.dsUrl = e.target.value; }
  });
  append(urlFg, urlLbl, urlInput);
  dsCard.appendChild(urlFg);

  var testBtn = btn('btn-primary', '▶ Testar /health', function() {
    if (!cfg.dsUrl) { alert('Configure a URL primeiro.'); return; }
    testBtn.disabled = true; testBtn.textContent = 'Testando...';
    fetch(cfg.dsUrl + '/health').then(function(r) { return r.json(); }).then(function(d) {
      msgEl.className = 'banner banner-ok'; msgEl.textContent = '✓ Online - ' + JSON.stringify(d);
    }).catch(function(e) {
      msgEl.className = 'banner banner-err'; msgEl.textContent = '✗ Offline - ' + e.message;
    }).then(function() { msgEl.style.display = 'flex'; testBtn.disabled = false; testBtn.textContent = '▶ Testar /health'; });
  });
  dsCard.appendChild(testBtn);
  dsCard.appendChild(msgEl);
  wrap.appendChild(dsCard);

  var prefCard = div('card card-blue');
  prefCard.appendChild(div('card-title', 'PREFERENCIAS'));
  var assetFg = div('fg');
  var assetLbl = el('label', {}, 'Ativos padrao');
  var assetInput = el('input', { class: 'input', type: 'text', placeholder: 'BTCUSDT,USDBRL,IBOV', value: cfg.defaultAssets || '',
    oninput: function(e) { cfg.defaultAssets = e.target.value; }
  });
  append(assetFg, assetLbl, assetInput);
  prefCard.appendChild(assetFg);

  var horizFg = div('fg');
  var horizLbl = el('label', {}, 'Horizonte padrao');
  var horizSel = el('select', { class: 'select', onchange: function(e) { cfg.horizon = e.target.value; } });
  ['curto','medio','longo'].forEach(function(h) {
    var opt = el('option', { value: h }, h.charAt(0).toUpperCase() + h.slice(1) + ' prazo');
    if (h === cfg.horizon) opt.selected = true;
    horizSel.appendChild(opt);
  });
  append(horizFg, horizLbl, horizSel);
  prefCard.appendChild(horizFg);

  var saveBtn = btn('btn-green btn', '💾 Salvar', function() {
    stateSet({ config: cfg }); storeSet('cio_config', cfg);
    if (ST.sbClient) { ST.sbClient.upsertConfig('app_main_config', cfg).catch(function() {}); }
    var savedMsg = div('banner banner-ok', '✓ Configuracoes salvas!');
    prefCard.appendChild(savedMsg);
    setTimeout(function() { if (savedMsg.parentNode) savedMsg.parentNode.removeChild(savedMsg); }, 2000);
  });
  prefCard.appendChild(saveBtn);
  wrap.appendChild(prefCard);
  return wrap;
}

// ================================================================
// SUPABASE PAGE
// ================================================================
var SUPABASE_SQL = [
  '-- CIO DIGITAL v2.1 Supabase Schema',
  'CREATE TABLE IF NOT EXISTS morning_briefs (',
  '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
  '  created_at TIMESTAMPTZ DEFAULT NOW(),',
  '  risk_profile TEXT, pipeline_mode TEXT,',
  '  brief_json JSONB, snapshot_json JSONB,',
  '  agent_bundle JSONB, username TEXT',
  ');',
  'CREATE TABLE IF NOT EXISTS portfolio_snapshots (',
  '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
  '  created_at TIMESTAMPTZ DEFAULT NOW(),',
  '  allocations JSONB NOT NULL, username TEXT',
  ');',
  'CREATE TABLE IF NOT EXISTS app_config (',
  '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
  '  updated_at TIMESTAMPTZ DEFAULT NOW(),',
  '  key TEXT UNIQUE NOT NULL, value TEXT NOT NULL',
  ');',
  'CREATE TABLE IF NOT EXISTS audit_logs (',
  '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
  '  created_at TIMESTAMPTZ DEFAULT NOW(),',
  '  username TEXT, action TEXT NOT NULL,',
  '  status TEXT NOT NULL, notes TEXT',
  ');',
  'CREATE TABLE IF NOT EXISTS agent_outputs (',
  '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,',
  '  created_at TIMESTAMPTZ DEFAULT NOW(),',
  '  brief_id UUID REFERENCES morning_briefs(id) ON DELETE CASCADE,',
  '  agent_id TEXT NOT NULL, output_json JSONB NOT NULL',
  ');',
  'CREATE INDEX IF NOT EXISTS idx_briefs_ts ON morning_briefs(created_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_logs_ts ON audit_logs(created_at DESC);'
].join('\n');

function renderSupabase() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'BANCO DE DADOS'));
  t.appendChild(div('page-sub', 'Supabase - Persistencia e historico completo'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var dbSt = ST.dbStatus;
  var dbStatusEl = div('db-status ' + (ST.sbClient ? (dbSt === 'ok' ? 'db-ok' : 'db-err') : 'db-off'));
  dbStatusEl.textContent = ST.sbClient ? (dbSt === 'ok' ? '● Conectado ao Supabase' : dbSt === 'syncing' ? '◉ Sincronizando...' : '✗ Erro de conexao') : '○ Supabase nao configurado';
  wrap.appendChild(dbStatusEl);

  // Tab bar
  var tabs = [['config', '⚙ Configuracao'], ['schema', '🗃 SQL Schema'], ['history', '📂 Historico']];
  var tabBar = div('tab-bar');
  tabs.forEach(function(tab) {
    var tb = el('button', { class: 'tab-btn' + (ST.sbTab === tab[0] ? ' on' : ''),
      onclick: function() {
        stateSet({ sbTab: tab[0] });
        if (tab[0] === 'history' && ST.sbClient) {
          ST.sbClient.getBriefs(20).then(function(b) { setState({ sbBriefs: b || [] }); }).catch(function() { render(); });
        } else {
          render();
        }
      }
    }, tab[1]);
    tabBar.appendChild(tb);
  });
  wrap.appendChild(tabBar);

  if (ST.sbTab === 'config') {
    var localCfg = Object.assign({}, ST.sbCfg);
    var msgEl = div('banner banner-ok'); msgEl.style.display = 'none';
    var cfgCard = div('card card-blue');
    cfgCard.appendChild(div('card-title', 'CREDENCIAIS SUPABASE'));
    var descEl = p(''); descEl.style.cssText = 'font-size:10px;color:var(--tx3);margin-bottom:14px;line-height:1.7';
    descEl.textContent = 'Encontre em: app.supabase.com → Projeto → Settings → API. Use apenas a anon (public) key.';
    cfgCard.appendChild(descEl);

    var urlFg = div('fg');
    var urlLbl = el('label', {}, 'Project URL');
    var urlInput = el('input', { class: 'input', type: 'text', placeholder: 'https://xxxxxxxxxxxx.supabase.co', value: localCfg.url || '',
      oninput: function(e) { localCfg.url = e.target.value; }
    });
    append(urlFg, urlLbl, urlInput);
    cfgCard.appendChild(urlFg);

    var keyFg = div('fg');
    var keyLbl = el('label', {}, 'Anon Public Key (JWT)');
    var keyInput = el('input', { class: 'input', type: 'password', placeholder: 'eyJhbGci...', value: localCfg.anonKey || '',
      oninput: function(e) { localCfg.anonKey = e.target.value; }
    });
    append(keyFg, keyLbl, keyInput);
    cfgCard.appendChild(keyFg);

    var btns = div('', null, { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' });
    var testBtn = btn('btn-primary', '▶ Testar', function() {
      if (!localCfg.url || !localCfg.anonKey) { msgEl.className = 'banner banner-err'; msgEl.textContent = 'Preencha URL e Anon Key.'; msgEl.style.display = 'flex'; return; }
      testBtn.disabled = true; testBtn.textContent = 'Testando...';
      var c = createSB(localCfg.url, localCfg.anonKey);
      c.ping().then(function() {
        msgEl.className = 'banner banner-ok'; msgEl.textContent = '✓ Conexao bem-sucedida!';
      }).catch(function(e) {
        msgEl.className = 'banner banner-err'; msgEl.textContent = '✗ Erro: ' + e.message;
      }).then(function() { msgEl.style.display = 'flex'; testBtn.disabled = false; testBtn.textContent = '▶ Testar'; });
    });
    var saveBtn = btn('btn-green btn', '💾 Salvar e Conectar', function() {
      var newCfg = Object.assign({}, localCfg, { enabled: true });
      storeSet('cio_sb', newCfg); stateSet({ sbCfg: newCfg });
      initSupabase().then(function() {
        msgEl.className = 'banner banner-ok'; msgEl.textContent = '✓ Salvo! Reconectando...'; msgEl.style.display = 'flex';
        setTimeout(render, 800);
      });
    });
    btns.appendChild(testBtn);
    btns.appendChild(saveBtn);
    if (ST.sbClient) {
      var disBtn = btn('btn-secondary', 'Desabilitar', function() {
        var nc = Object.assign({}, localCfg, { enabled: false });
        storeSet('cio_sb', nc); setState({ sbCfg: nc, sbClient: null, dbStatus: null });
      });
      btns.appendChild(disBtn);
    }
    cfgCard.appendChild(btns);
    cfgCard.appendChild(msgEl);
    wrap.appendChild(cfgCard);
  }

  if (ST.sbTab === 'schema') {
    var schCard = div('card card-blue');
    var schHdr = div('', null, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' });
    schHdr.appendChild(div('card-title', 'SQL PARA CRIAR AS TABELAS'));
    var copyBtn = el('button', { class: 'copy-btn', onclick: function() {
      navigator.clipboard.writeText(SUPABASE_SQL).then(function() {
        copyBtn.textContent = '✓ Copiado!';
        setTimeout(function() { copyBtn.textContent = 'Copiar SQL'; }, 2000);
      });
    }}, 'Copiar SQL');
    schHdr.appendChild(copyBtn);
    schCard.appendChild(schHdr);
    var instrEl = p(''); instrEl.style.cssText = 'font-size:10px;color:var(--tx3);margin-bottom:12px;line-height:1.7';
    instrEl.textContent = '1. Acesse app.supabase.com → SQL Editor → New Query\n2. Cole o SQL abaixo\n3. Clique em Run';
    schCard.appendChild(instrEl);
    var sqlBlock = el('pre', { class: 'sql-block' }, SUPABASE_SQL);
    schCard.appendChild(sqlBlock);
    wrap.appendChild(schCard);
  }

  if (ST.sbTab === 'history') {
    var histCard = div('card card-blue');
    var histHdr = div('', null, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' });
    histHdr.appendChild(div('card-title', 'HISTORICO DE MORNING BRIEFS'));
    var refreshBtn = btn('btn-primary', '↺ Atualizar', function() {
      if (!ST.sbClient) { alert('Conecte o Supabase primeiro.'); return; }
      ST.sbClient.getBriefs(20).then(function(b) { setState({ sbBriefs: b || [] }); }).catch(function(e) { alert(e.message); });
    });
    histHdr.appendChild(refreshBtn);
    histCard.appendChild(histHdr);

    if (!ST.sbClient) {
      histCard.appendChild(div('banner banner-warn', 'Conecte o Supabase para ver o historico.'));
    } else if (!ST.sbBriefs.length) {
      var em = div('empty-state');
      em.innerHTML = '<div class="empty-icon">📂</div><div class="empty-title">Sem historico</div><div class="empty-sub">Gere um Morning Brief para comecar.</div>';
      histCard.appendChild(em);
    } else {
      var tbl = el('table', { class: 'data-table' });
      var thead = el('thead', {}, el('tr', {}, [
        el('th', {}, 'Data'), el('th', {}, 'Perfil'), el('th', {}, 'Modo'), el('th', {}, 'Usuario'), el('th', {}, 'JSON')
      ]));
      var tbody = el('tbody');
      ST.sbBriefs.forEach(function(b) {
        var tr = el('tr');
        tr.style.cursor = 'pointer';
        tr.appendChild(el('td', { style: { fontSize: '10px' } }, new Date(b.created_at).toLocaleString('pt-BR')));
        var profTd = el('td'); profTd.style.cssText = 'color:' + (b.risk_profile === 'CONSERVADOR' ? 'var(--gr)' : b.risk_profile === 'SEGURO' ? 'var(--am)' : 'var(--rd)') + ';font-weight:700;font-size:10px';
        profTd.textContent = b.risk_profile;
        tr.appendChild(profTd);
        tr.appendChild(el('td', { style: { fontSize: '10px' } }, b.pipeline_mode === 'daily' ? '⚡ Diario' : '🔬 Deep Dive'));
        tr.appendChild(el('td', { style: { fontSize: '10px' } }, b.username || 'admin'));
        var copyTd = el('td');
        var cpBtn = el('button', { class: 'copy-btn', onclick: function(e) {
          e.stopPropagation();
          navigator.clipboard.writeText(JSON.stringify(b.brief_json, null, 2));
        }}, '📋 Copiar');
        copyTd.appendChild(cpBtn);
        tr.appendChild(copyTd);
        tr.addEventListener('click', function() { setState({ histSelected: ST.histSelected && ST.histSelected.id === b.id ? null : b }); });
        tbody.appendChild(tr);
      });
      tbl.appendChild(thead); tbl.appendChild(tbody);
      histCard.appendChild(tbl);

      if (ST.histSelected) {
        var detail = div('', null, { marginTop: '14px' });
        var detailTitle = p(''); detailTitle.style.cssText = 'font-size:10px;color:var(--ac);font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px';
        detailTitle.textContent = 'Brief - ' + new Date(ST.histSelected.created_at).toLocaleString('pt-BR');
        detail.appendChild(detailTitle);
        var pre = el('pre', { style: { background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '7px', padding: '12px', fontSize: '9px', color: 'var(--tx2)', lineHeight: '1.6', overflow: 'auto', maxHeight: '260px', whiteSpace: 'pre-wrap' } });
        pre.textContent = JSON.stringify(ST.histSelected.brief_json, null, 2);
        detail.appendChild(pre);
        histCard.appendChild(detail);
      }
    }
    wrap.appendChild(histCard);
  }

  return wrap;
}

// ================================================================
// AI COSTS PAGE
// ================================================================
function renderAICosts() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'PIPELINE & CUSTOS'));
  t.appendChild(div('page-sub', 'Controle do pipeline agentic e uso de tokens'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var pipeCard = div('card card-blue');
  pipeCard.appendChild(div('card-title', 'MODO DO PIPELINE'));
  var pToggle = div('pipe-toggle'); pToggle.style.marginBottom = '14px';
  var bdaily = el('button', { class: 'pipe-btn' + (ST.pipeline === 'daily' ? ' on' : ''),
    onclick: function() { setState({ pipeline: 'daily' }); }
  }, '⚡ Diario (4 agentes)');
  var bdeep = el('button', { class: 'pipe-btn' + (ST.pipeline === 'deep' ? ' on' : ''),
    onclick: function() { setState({ pipeline: 'deep' }); }
  }, '🔬 Deep Dive (10 agentes)');
  append(pToggle, bdaily, bdeep);
  pipeCard.appendChild(pToggle);

  var pipeGridWrap = div('', null, { display: 'flex', gap: '24px', flexWrap: 'wrap' });
  var dailyList = div('');
  var dTitle = p(''); dTitle.style.cssText = 'font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px';
  dTitle.textContent = '⚡ PIPELINE DIARIO';
  dailyList.appendChild(dTitle);
  DAILY_PIPELINE.forEach(function(id, i) {
    var item = p(''); item.style.cssText = 'font-size:11px;color:var(--tx2);padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03)';
    item.innerHTML = '<span style="color:var(--tx3);font-family:JetBrains Mono,monospace;font-size:9px">' + (i+1) + '. </span>' + id;
    dailyList.appendChild(item);
  });
  var deepList = div('');
  var ddTitle = p(''); ddTitle.style.cssText = 'font-size:9px;color:var(--pu);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px';
  ddTitle.textContent = '🔬 DEEP DIVE';
  deepList.appendChild(ddTitle);
  DEEP_PIPELINE.forEach(function(id, i) {
    var item = p(''); item.style.cssText = 'font-size:11px;color:var(--tx2);padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03)';
    item.innerHTML = '<span style="color:var(--tx3);font-family:JetBrains Mono,monospace;font-size:9px">' + (i+1) + '. </span>' + id;
    deepList.appendChild(item);
  });
  append(pipeGridWrap, dailyList, deepList);
  pipeCard.appendChild(pipeGridWrap);
  wrap.appendChild(pipeCard);

  var infoCard = div('card card-blue');
  infoCard.appendChild(div('card-title', 'INFORMACOES DO MODELO'));
  [
    ['Modelo ativo', ST.aiCfg.model || 'Nao configurado'],
    ['Provedor', ST.aiCfg.provider === 'openai' ? 'OpenAI GPT' : ST.aiCfg.provider === 'gemini' ? 'Google Gemini (Free tier)' : 'Anthropic Claude'],
    ['Max tokens/chamada', '1800'],
    ['Modo economico', 'JSON compacto - sem chain-of-thought']
  ].forEach(function(row) {
    var r = div('info-row');
    r.appendChild(span('info-label', row[0]));
    r.appendChild(span('info-val', row[1]));
    infoCard.appendChild(r);
  });
  wrap.appendChild(infoCard);
  return wrap;
}

// ================================================================
// LOGS PAGE
// ================================================================
function renderLogs() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'LOGS & AUDITORIA'));
  t.appendChild(div('page-sub', ST.logs.length + ' registros nesta sessao'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var card = div('card card-blue');
  var tbl = el('table', { class: 'data-table' });
  var thead = el('thead', {}, el('tr', {}, [
    el('th', {}, 'HORARIO'), el('th', {}, 'USUARIO'), el('th', {}, 'ACAO'), el('th', {}, 'STATUS'), el('th', {}, 'NOTAS')
  ]));
  var tbody = el('tbody');
  if (!ST.logs.length) {
    tbody.appendChild(el('tr', {}, el('td', { colspan: '5', style: { textAlign: 'center', padding: '28px', color: 'var(--tx3)' } }, 'Nenhum log ainda.')));
  } else {
    ST.logs.forEach(function(l) {
      var tr = el('tr');
      tr.appendChild(el('td', { style: { fontSize: '10px' } }, new Date(l.ts).toLocaleTimeString('pt-BR')));
      tr.appendChild(el('td', { style: { color: 'var(--ac)', fontSize: '10px' } }, l.user));
      tr.appendChild(el('td', { style: { color: 'var(--gold)', fontSize: '10px' } }, l.action));
      var stColors = { ok: 'var(--gr)', warn: 'var(--am)', fail: 'var(--rd)' };
      tr.appendChild(el('td', { style: { color: stColors[l.status] || 'var(--tx2)', fontSize: '10px' } }, l.status.toUpperCase()));
      tr.appendChild(el('td', { style: { fontSize: '9px', color: 'var(--tx3)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, l.notes));
      tbody.appendChild(tr);
    });
  }
  append(tbl, thead, tbody);
  card.appendChild(tbl);
  wrap.appendChild(card);
  return wrap;
}

// ================================================================
// SETTINGS PAGE
// ================================================================
function renderSettings() {
  var wrap = div('');
  var hdr = div('page-header');
  var t = div('');
  t.appendChild(div('page-title', 'CONFIGURACOES'));
  t.appendChild(div('page-sub', 'Sistema, seguranca e preferencias'));
  hdr.appendChild(t);
  wrap.appendChild(hdr);

  var sysCard = div('card card-blue');
  sysCard.appendChild(div('card-title', 'SISTEMA'));
  [
    ['Versao', APP_VERSION],
    ['Idioma', 'pt-BR'],
    ['Usuario', ST.user ? ST.user.username : ''],
    ['Role', ST.user ? ST.user.role.toUpperCase() : ''],
    ['IA', ST.aiCfg.provider + ' - ' + ST.aiCfg.model],
    ['Supabase', ST.sbClient ? 'Conectado' : 'Nao configurado']
  ].forEach(function(row) {
    var r = div('info-row');
    r.appendChild(span('info-label', row[0]));
    r.appendChild(span('info-val', row[1]));
    sysCard.appendChild(r);
  });
  wrap.appendChild(sysCard);

  var f = { old: '', nw: '', cf: '' };
  var pwMsg = p(''); pwMsg.style.cssText = 'font-size:11px;margin-top:8px;min-height:16px';
  var pwCard = div('card card-blue');
  pwCard.appendChild(div('card-title', 'TROCAR SENHA'));
  [['Senha atual', 'old', 'password'], ['Nova senha (min. 8 chars)', 'nw', 'password'], ['Confirmar nova senha', 'cf', 'password']].forEach(function(row) {
    var fg = div('fg');
    fg.appendChild(el('label', {}, row[0]));
    var inp = el('input', { class: 'input', type: row[2], oninput: function(e) { f[row[1]] = e.target.value; } });
    fg.appendChild(inp);
    pwCard.appendChild(fg);
  });
  var saveBtn = btn('btn-primary', 'Alterar Senha', function() {
    if (!f.old || !f.nw || !f.cf) { pwMsg.textContent = 'Preencha todos os campos.'; pwMsg.style.color = 'var(--rd)'; return; }
    if (f.nw !== f.cf) { pwMsg.textContent = 'As senhas nao coincidem.'; pwMsg.style.color = 'var(--rd)'; return; }
    if (f.nw.length < 8) { pwMsg.textContent = 'Minimo 8 caracteres.'; pwMsg.style.color = 'var(--rd)'; return; }
    if (f.old !== 'dbsa1981') { pwMsg.textContent = 'Senha atual incorreta.'; pwMsg.style.color = 'var(--rd)'; return; }
    pwMsg.textContent = '✓ Senha alterada com sucesso.'; pwMsg.style.color = 'var(--gr)';
  });
  append(pwCard, saveBtn, pwMsg);
  wrap.appendChild(pwCard);
  return wrap;
}

// ================================================================
// BOOT
// ================================================================
render();
