import { useState, useCallback, useEffect } from "react";

// ============================================================
// CONSTANTS
// ============================================================
const APP_VERSION = "2.1.0";

// ============================================================
// SUPABASE CLIENT
// ============================================================
function createSupabaseClient(url, anonKey) {
  if (!url || !anonKey) return null;
  const headers = { "Content-Type": "application/json", "apikey": anonKey, "Authorization": `Bearer ${anonKey}` };

  const rpc = async (path, method = "GET", body = null) => {
    const res = await fetch(`${url}/rest/v1${path}`, {
      method, headers: { ...headers, "Prefer": method === "POST" ? "return=representation" : "return=minimal" },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Supabase ${method} ${path}: ${err}`); }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  return {
    // morning_briefs
    saveBrief: (data) => rpc("/morning_briefs", "POST", data),
    getBriefs: (limit = 30) => rpc(`/morning_briefs?order=created_at.desc&limit=${limit}`),
    getBriefById: (id) => rpc(`/morning_briefs?id=eq.${id}`),

    // portfolio_snapshots
    savePortfolio: (data) => rpc("/portfolio_snapshots", "POST", data),
    getPortfolio: () => rpc("/portfolio_snapshots?order=created_at.desc&limit=1"),

    // app_config
    saveConfig: (key, value) => rpc("/app_config", "POST", { key, value: JSON.stringify(value) }),
    getConfig: (key) => rpc(`/app_config?key=eq.${key}&limit=1`),
    upsertConfig: async (key, value) => {
      const existing = await rpc(`/app_config?key=eq.${key}`);
      if (existing?.length > 0) {
        return rpc(`/app_config?key=eq.${key}`, "PATCH", { value: JSON.stringify(value) });
      }
      return rpc("/app_config", "POST", { key, value: JSON.stringify(value) });
    },

    // audit_logs
    saveLog: (data) => rpc("/audit_logs", "POST", data),
    getLogs: (limit = 100) => rpc(`/audit_logs?order=created_at.desc&limit=${limit}`),

    // snapshots_cache
    saveSnapshot: (data) => rpc("/market_snapshots", "POST", data),
    getLatestSnapshot: () => rpc("/market_snapshots?order=created_at.desc&limit=1"),

    // agent_outputs
    saveAgentOutputs: (data) => rpc("/agent_outputs", "POST", data),
    getAgentOutputs: (briefId) => rpc(`/agent_outputs?brief_id=eq.${briefId}&order=created_at.asc`),

    // health check
    ping: () => rpc("/morning_briefs?limit=1")
  };
}

// SQL Schema for Supabase (shown in settings page)
const SUPABASE_SQL = `-- CIO DIGITAL v2.1 — Supabase Schema
-- Cole este SQL no SQL Editor do seu projeto Supabase

-- Tabela de briefs gerados
CREATE TABLE IF NOT EXISTS morning_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  risk_profile TEXT NOT NULL,
  pipeline_mode TEXT NOT NULL,
  brief_json JSONB NOT NULL,
  snapshot_json JSONB,
  agent_bundle JSONB,
  username TEXT DEFAULT 'admin'
);

-- Tabela de portfólio (histórico de snapshots)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  allocations JSONB NOT NULL,
  username TEXT DEFAULT 'admin',
  notes TEXT
);

-- Tabela de configurações do app
CREATE TABLE IF NOT EXISTS app_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT
);

-- Tabela de snapshots de mercado (cache)
CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  snapshot_json JSONB NOT NULL,
  source TEXT
);

-- Tabela de outputs dos agentes
CREATE TABLE IF NOT EXISTS agent_outputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  brief_id UUID REFERENCES morning_briefs(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  output_json JSONB NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_briefs_created ON morning_briefs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_created ON portfolio_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON market_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_brief ON agent_outputs(brief_id);

-- RLS: desabilite para uso admin direto (ou configure políticas)
-- ALTER TABLE morning_briefs ENABLE ROW LEVEL SECURITY;
-- Para uso simples com anon key, mantenha RLS desabilitado no MVP.`;

// Custom hook for Supabase sync
function useSupabase(supabaseConfig) {
  const client = supabaseConfig?.url && supabaseConfig?.anonKey
    ? createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

  const isConnected = !!client;

  const saveWithFallback = async (operation, localFallback) => {
    if (!client) { localFallback?.(); return { local: true }; }
    try { return await operation(client); }
    catch (e) { console.warn("Supabase save failed, using local:", e.message); localFallback?.(); return { local: true, error: e.message }; }
  };

  return { client, isConnected, saveWithFallback };
}

const RISK_PROFILES = {
  CONSERVADOR: {
    label: "Conservador", color: "#22c55e", bg: "#052e16",
    allowed: ["Renda Fixa", "Tesouro", "LCI/LCA", "Fundos DI"],
    blocked: ["Cripto", "Alavancagem", "Derivativos"],
    max_risk: "baixo", min_conf: "alta", mode: "MONITORAR",
    desc: "Preservação de capital. Foco em liquidez e controle."
  },
  SEGURO: {
    label: "Seguro", color: "#f59e0b", bg: "#451a03",
    allowed: ["Renda Fixa", "FIIs", "Ações Blue Chip", "Câmbio"],
    blocked: ["Cripto", "Alavancagem"],
    max_risk: "medio", min_conf: "media", mode: "MONITORAR",
    desc: "Equilíbrio risco/retorno com travas claras."
  },
  ARROJADO: {
    label: "Arrojado", color: "#ef4444", bg: "#450a0a",
    allowed: ["Ações", "FIIs", "Cripto", "Câmbio", "Derivativos", "BDRs"],
    blocked: [], max_risk: "alto", min_conf: "baixa", mode: "SIMULAR",
    desc: "Busca de alpha. Aceita volatilidade com controle de posições."
  }
};

// ============================================================
// AGENT DEFINITIONS
// ============================================================
const AGENTS = {
  MACRO_ORACLE: {
    id: "MACRO_ORACLE", name: "MACRO_ORACLE", version: "v2.0", status: "ONLINE",
    desc: "Macro global, bancos centrais, fluxos de capital e regime risk-on/off.",
    pipeline: ["daily", "deep"],
    styles: ["Druckenmiller", "Dalio", "Soros"],
    buildPrompt: (snapshot, profile, horizon, prevSummaries) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é MACRO_ORACLE.
Filosofia: leitura top-down de fluxo de capital, juros, ciclos e geopolítica.
styles_active: ${JSON.stringify(AGENTS.MACRO_ORACLE.styles)} (use visão dos 3 para enriquecer).
REGRAS: sem inventar números; null se não tiver dado; sem chain-of-thought; saída curta (máx 1800 chars).`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev: prevSummaries })}
Retorne JSON:
{"agent":"MACRO_ORACLE","styles_active":["…"],"regime_macro":"risk-on|risk-off|transicao|incerto","thesis":["b1","b2","b3"],"alerts":["a1","a2","a3"],"by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"],"alternativos":["…"]},"data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  BRASIL_ANALYST: {
    id: "BRASIL_ANALYST", name: "BRASIL_ANALYST", version: "v2.0", status: "ONLINE",
    desc: "Copom, Selic, IPCA, fiscal e impactos por classe no mercado brasileiro.",
    pipeline: ["deep"],
    styles: ["Armínio Fraga", "Pérsio Arida", "André Lara Resende"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é BRASIL_ANALYST.
Filosofia: análise profunda do mercado doméstico BR — Copom, curva, fiscal, câmbio.
styles_active: ${JSON.stringify(AGENTS.BRASIL_ANALYST.styles)}.
REGRAS: sem inventar dados; null se insuficiente; saída curta.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"BRASIL_ANALYST","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"],"alternativos":["…"]},"selic_outlook":"…","ipca_outlook":"…","data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  QUANT_SIGNAL: {
    id: "QUANT_SIGNAL", name: "QUANT_SIGNAL", version: "v1.0", status: "ONLINE",
    desc: "Sinais quantitativos: momentum, reversão, volatilidade, regime.",
    pipeline: ["deep"],
    styles: ["Jim Simons", "Cliff Asness", "Marcos López de Prado"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é QUANT_SIGNAL.
Filosofia: ignora narrativa; trabalha com sinais estatísticos e regimes de mercado.
styles_active: ${JSON.stringify(AGENTS.QUANT_SIGNAL.styles)}.
REGRAS: sem opinião subjetiva; force=0 se dados insuficientes; saída curta.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"QUANT_SIGNAL","styles_active":["…"],"signals_by_class":{"renda_fixa":[{"signal":"momento|reversao|volatilidade|range|indefinido","strength":0,"note":"…"}],"acoes":[{"signal":"…","strength":0,"note":"…"}],"fiis":[{"signal":"…","strength":0,"note":"…"}],"cambio":[{"signal":"…","strength":0,"note":"…"}],"cripto":[{"signal":"…","strength":0,"note":"…"}],"alternativos":[{"signal":"…","strength":0,"note":"…"}]},"volatility_stress":"baixo|medio|alto|null","guardrails":["…"],"data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  EQUITY_STOCK_MASTER: {
    id: "EQUITY_STOCK_MASTER", name: "EQUITY_STOCK_MASTER", version: "v2.0", status: "ONLINE",
    desc: "Ações por setor/índice — contexto setorial, valuation, momentum. Sem ticker por padrão.",
    pipeline: ["deep"],
    styles: ["Peter Lynch", "Philip Fisher", "Terry Smith"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é EQUITY_STOCK_MASTER.
Filosofia: análise setorial e de índices, nunca tickers individuais por padrão.
styles_active: ${JSON.stringify(AGENTS.EQUITY_STOCK_MASTER.styles)}.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"EQUITY_STOCK_MASTER","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":[],"acoes":["…"],"fiis":["…"],"cambio":[],"cripto":[],"alternativos":[]},"setores_destaque":["…"],"setores_evitar":["…"],"data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  REAL_ASSETS_CREDIT: {
    id: "REAL_ASSETS_CREDIT", name: "REAL_ASSETS_CREDIT", version: "v2.0", status: "ONLINE",
    desc: "FIIs, imóveis, crédito privado (CRI, CRA, debêntures). Ciclos e spreads.",
    pipeline: ["deep"],
    styles: ["Sam Zell", "Schwarzman", "Bruce Flatt"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é REAL_ASSETS_CREDIT.
Filosofia: ativos reais e ilíquidos — liquidez, ciclo, spread, risco jurídico.
styles_active: ${JSON.stringify(AGENTS.REAL_ASSETS_CREDIT.styles)}.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"REAL_ASSETS_CREDIT","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":[],"acoes":[],"fiis":["…"],"cambio":[],"cripto":[],"alternativos":["…"]},"hidden_risks":["liquidez","prazo","inadimplência","…"],"data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  RISK_SHIELD: {
    id: "RISK_SHIELD", name: "RISK_SHIELD", version: "v2.0", status: "ONLINE",
    desc: "CRO: stress test, VaR conceitual, drawdown, liquidez. Em dúvida, rejeita.",
    pipeline: ["daily", "deep"],
    styles: ["Howard Marks", "Aaron Brown", "Richard Bookstaber"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é RISK_SHIELD (CRO).
Filosofia: encontrar o que dá ERRADO antes de qualquer outra coisa.
styles_active: ${JSON.stringify(AGENTS.RISK_SHIELD.styles)}.
REGRA OURO: Em dúvida, rejeite. Preserve capital > alpha.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"RISK_SHIELD","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"],"alternativos":["…"]},"risks_top5":[{"risk":"…","prob":"baixa|media|alta","impact":"baixo|medio|alto","mitigation":["…"]}],"go_no_go":"go|no_go|precisa_dados","data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  DERIVATIVES_HEDGE: {
    id: "DERIVATIVES_HEDGE", name: "DERIVATIVES_HEDGE", version: "v1.0", status: "ONLINE",
    desc: "Proteção assimétrica e antifragilidade — hedge por classe, regras anti-ruína.",
    pipeline: ["daily", "deep"],
    styles: ["Nassim Taleb", "Mark Spitznagel", "Boaz Weinstein"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é DERIVATIVES_HEDGE.
Filosofia: proteção contra cauda (tail risk), antifragilidade, evitar ruína.
styles_active: ${JSON.stringify(AGENTS.DERIVATIVES_HEDGE.styles)}.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"DERIVATIVES_HEDGE","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"],"alternativos":["…"]},"hedge_by_class":{"acoes":["…"],"cambio":["…"],"cripto":["…"],"renda_fixa":["…"]},"anti_ruin_rules":["…"],"when_not_to_trade":["…"],"data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  EXECUTION_DESK: {
    id: "EXECUTION_DESK", name: "EXECUTION_DESK", version: "v1.0", status: "ONLINE",
    desc: "Execução algorítmica: liquidez, slippage, impacto de mercado e timing.",
    pipeline: ["deep"],
    styles: ["Citadel Securities", "Virtu Financial", "Jane Street"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é EXECUTION_DESK.
Filosofia: minimizar slippage e impacto, respeitar liquidez, evitar execução ruim.
styles_active: ${JSON.stringify(AGENTS.EXECUTION_DESK.styles)}.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"EXECUTION_DESK","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"],"alternativos":["…"]},"execution_playbook_by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"]},"avoid_costly_mistakes":["…"],"data_needed":["spread","liquidez","horario","…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  LEGAL_TAX_OPTIMIZER: {
    id: "LEGAL_TAX_OPTIMIZER", name: "LEGAL_TAX_OPTIMIZER", version: "v2.0", status: "ONLINE",
    desc: "Compliance, tributação, estruturação. Não substitui contador/advogado.",
    pipeline: ["deep"],
    styles: ["Big4", "Baker McKenzie", "Withers Worldwide"],
    buildPrompt: (snapshot, profile, horizon, prev) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é LEGAL_TAX_OPTIMIZER.
Filosofia: estruturar com segurança, evitar risco jurídico/tributário.
styles_active: ${JSON.stringify(AGENTS.LEGAL_TAX_OPTIMIZER.styles)}.
SEMPRE incluir: não substitui contador/advogado.`,
      user: `INPUT: ${JSON.stringify({ snapshot, profile, horizon, prev })}
Retorne JSON:
{"agent":"LEGAL_TAX_OPTIMIZER","styles_active":["…"],"thesis":["…","…","…"],"alerts":["…","…","…"],"by_class":{"renda_fixa":["…"],"acoes":["…"],"fiis":["…"],"cambio":["…"],"cripto":["…"],"alternativos":["…"]},"compliance_checklist":["…"],"tax_alerts":["…"],"observacao_br":"Não substitui contador/advogado. Regras mudam.","data_needed":["…"],"disclaimer":"Conteúdo educacional. Não é recomendação individual."}`
    })
  },
  ORCHESTRATOR_CIO: {
    id: "ORCHESTRATOR_CIO", name: "ORCHESTRATOR_CIO", version: "v2.0", status: "ONLINE",
    desc: "CIO orquestrador final. Sintetiza todos os agentes no Morning Brief.",
    pipeline: ["daily", "deep"],
    styles: ["Ray Dalio", "Paul Tudor Jones", "George Soros"],
    buildPrompt: (snapshot, profile, horizon, bundle) => ({
      system: `Retorne SOMENTE JSON válido. Sem markdown. Você é o ORCHESTRATOR_CIO.
Filosofia: síntese objetiva. Sem ticker por padrão. Sem promessas. Sem inventar.
styles_active: ${JSON.stringify(AGENTS.ORCHESTRATOR_CIO.styles)}.`,
      user: `BUNDLE DOS AGENTES: ${JSON.stringify(bundle)}
SNAPSHOT: ${JSON.stringify(snapshot)}
PERFIL: ${profile} | HORIZONTE: ${horizon}
Sintetize em JSON:
{"agent":"ORCHESTRATOR_CIO","morning_brief":{"radar_30s":"…","resumo_6_bullets":["…","…","…","…","…","…"],"risks_top5":["…","…","…","…","…"],"opportunities_top5":["…","…","…","…","…"],"plan_by_class":{"renda_fixa":{"postura":"defensiva|neutra|ofensiva","actions":["…"],"alerts":["…"]},"acoes":{"postura":"…","actions":["…"],"alerts":["…"]},"fiis":{"postura":"…","actions":["…"],"alerts":["…"]},"cambio":{"postura":"…","actions":["…"],"alerts":["…"]},"cripto":{"postura":"…","actions":["…"],"alerts":["…"]},"alternativos":{"postura":"…","actions":["…"],"alerts":["…"]}},"termometro":{"volatilidade":"baixo|medio|alto","liquidez":"boa|atencao|ruim","correlacao":"normal|alta|perigosa","stress_macro":"baixo|medio|alto","semaforo":"verde|amarelo|vermelho","nota":"…"},"checklist_do_dia":{"fazer":["…","…","…"],"evitar":["…","…","…"]},"opportunities_cards":[{"classe":"…","tese":"…","gatilho":"…","invalidacao":"…","riscos":["…","…","…"],"confianca":"alta|media|baixa","risco_nivel":"baixo|medio|alto","acao":"MONITORAR|SIMULAR"}]},"disclaimer":"Conteúdo educacional. Não é recomendação individual. Risco existe. Decisões são do usuário."}`
    })
  }
};

const DAILY_PIPELINE = ["MACRO_ORACLE", "RISK_SHIELD", "DERIVATIVES_HEDGE", "ORCHESTRATOR_CIO"];
const DEEP_PIPELINE = ["MACRO_ORACLE", "BRASIL_ANALYST", "QUANT_SIGNAL", "EQUITY_STOCK_MASTER", "REAL_ASSETS_CREDIT", "RISK_SHIELD", "DERIVATIVES_HEDGE", "EXECUTION_DESK", "LEGAL_TAX_OPTIMIZER", "ORCHESTRATOR_CIO"];

// ============================================================
// RISK POLICY ENGINE
// ============================================================
function applyPolicy(opps, profile) {
  const cfg = RISK_PROFILES[profile];
  return (opps || []).filter(o => {
    if (cfg.blocked.some(b => (o.classe || "").includes(b))) return false;
    if (cfg.max_risk === "baixo" && ["alto", "medio"].includes(o.risco_nivel)) return false;
    if (cfg.min_conf === "alta" && o.confianca !== "alta") return false;
    if (cfg.min_conf === "media" && o.confianca === "baixa") return false;
    return true;
  }).map(o => ({ ...o, acao: cfg.mode }));
}

// ============================================================
// API CALL
// ============================================================
async function callClaude(system, user, maxTokens = 1800) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }]
    })
  });
  const d = await res.json();
  const text = d.content?.[0]?.text || "";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { raw: text, parse_error: true }; }
}

async function fetchSnapshot(config) {
  if (!config.dataServiceUrl) return null;
  try {
    const symbols = (config.defaultAssets || "BTCUSDT,USDBRL").replace(/\s/g, "");
    const url = `${config.dataServiceUrl}/snapshot?symbols=${symbols}&include=macro,events,news`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      ts: new Date().toISOString(), symbols: [], prices: {}, macro_br: { selic: null, ipca_yoy: null, usdbrl: null },
      events: [], news: [], quality: { partial: true, notes: ["data_service_error: " + e.message] }
    };
  }
}

// ============================================================
// MOCK SNAPSHOT (fallback when no Data Service)
// ============================================================
const MOCK_SNAPSHOT = {
  ts: new Date().toISOString(),
  symbols: ["BTCUSDT", "USDBRL", "IBOV"],
  prices: {
    BTCUSDT: { last: 95240, chg24h_pct: 1.8, ohlcv: [] },
    USDBRL: { last: 5.74, chg24h_pct: -0.3, ohlcv: [] },
    IBOV: { last: 128500, chg24h_pct: 0.6, ohlcv: [] }
  },
  macro_br: { selic: 10.75, ipca_yoy: 4.87, usdbrl: 5.74 },
  events: [
    { when: "Hoje 14h00", title: "IPCA-15 acima do esperado: 0,62% vs 0,55%", impact: "high" },
    { when: "Hoje 15h30", title: "Fed: ata reforça postura hawkish para 2025", impact: "high" },
    { when: "Amanhã 09h00", title: "Copom: divulgação de ata", impact: "med" }
  ],
  news: [
    { title: "China anuncia pacote fiscal adicional de USD 300bi", source: "Reuters", time: "08:00", tags: ["macro", "commodities"] },
    { title: "BCB mantém guidance hawkish; Selic estável em 10,75%", source: "Valor", time: "07:30", tags: ["macro", "renda_fixa"] }
  ],
  quality: { source: "mock_demo", partial: false, notes: ["dados de demonstração"] }
};

// ============================================================
// STYLES
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700&family=JetBrains+Mono:wght@400;600&display=swap');
:root{--bg:#07090d;--bg2:#0c1018;--bg3:#131920;--bg4:#1a2230;--bd:#1e2938;--bd2:#263347;--tx:#dde6f0;--tx2:#7a8fa8;--tx3:#3d5068;--ac:#00c8f0;--ac2:#0099bb;--ac3:#006080;--gold:#e8a820;--gr:#2ea84a;--rd:#e84040;--am:#c88820;--pu:#7c4dcc;--cy:#00bcd4}
*{box-sizing:border-box;margin:0;padding:0}
body,#root{background:var(--bg);color:var(--tx);font-family:'DM Sans',sans-serif;min-height:100vh;font-size:14px}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:2px}
.app{display:flex;min-height:100vh}

/* LOGIN */
.lp{display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--bg);background-image:radial-gradient(ellipse at 15% 60%,rgba(0,200,240,.05) 0%,transparent 55%),radial-gradient(ellipse at 85% 20%,rgba(124,77,204,.04) 0%,transparent 50%),radial-gradient(ellipse at 50% 90%,rgba(232,168,32,.03) 0%,transparent 50%)}
.lc{width:390px;padding:48px 40px;background:var(--bg2);border:1px solid var(--bd);border-radius:14px;box-shadow:0 0 80px rgba(0,200,240,.07),0 24px 60px rgba(0,0,0,.5)}
.ll{text-align:center;margin-bottom:36px}
.lt{font-family:'Bebas Neue',sans-serif;font-size:44px;color:var(--ac);letter-spacing:5px;line-height:1}
.ll-line{width:70px;height:2px;background:linear-gradient(90deg,transparent,var(--ac),transparent);margin:10px auto 8px}
.ls{font-size:9px;color:var(--tx3);letter-spacing:3px;text-transform:uppercase}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:9px;color:var(--tx2);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.fg input{width:100%;padding:11px 14px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:13px;outline:none;transition:all .2s}
.fg input:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(0,200,240,.1)}
.bp{width:100%;padding:13px;background:linear-gradient(135deg,var(--ac),var(--ac2));color:#000;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:all .2s}
.bp:hover{opacity:.9;transform:translateY(-1px)}
.bp:disabled{opacity:.45;cursor:not-allowed;transform:none}
.em{color:var(--rd);font-size:11px;margin-top:10px;text-align:center}
.ln{margin-top:20px;padding:10px 14px;background:rgba(232,168,32,.06);border:1px solid rgba(232,168,32,.15);border-radius:7px;font-size:10px;color:var(--tx3);line-height:1.6;text-align:center}

/* SIDEBAR */
.sb{width:224px;background:var(--bg2);border-right:1px solid var(--bd);display:flex;flex-direction:column;position:fixed;height:100vh;z-index:100}
.sb-logo{padding:20px 18px 16px;border-bottom:1px solid var(--bd)}
.sb-n{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--ac);letter-spacing:3px;line-height:1}
.sb-s{font-size:8px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;margin-top:3px}
.sb-nav{flex:1;padding:12px 0;overflow-y:auto}
.ns{margin-bottom:4px}
.nt{font-size:8px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;padding:8px 18px 3px}
.ni{display:flex;align-items:center;gap:9px;padding:9px 18px;color:var(--tx2);font-size:12px;cursor:pointer;transition:all .12s;border-left:2px solid transparent}
.ni:hover{color:var(--tx);background:rgba(255,255,255,.025)}
.ni.active{color:var(--ac);border-left-color:var(--ac);background:rgba(0,200,240,.06)}
.ni-ic{font-size:14px;width:18px;text-align:center;flex-shrink:0}
.sb-bot{padding:14px;border-top:1px solid var(--bd)}
.ua{display:flex;align-items:center;gap:9px;margin-bottom:10px}
.uav{width:30px;height:30px;background:linear-gradient(135deg,var(--ac),var(--pu));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;flex-shrink:0}
.un{font-size:11px;color:var(--tx2);font-weight:500}
.ur{font-size:9px;color:var(--tx3)}
.blg{width:100%;padding:7px;background:transparent;border:1px solid var(--bd);border-radius:6px;color:var(--tx3);font-size:11px;cursor:pointer;transition:all .15s}
.blg:hover{border-color:var(--rd);color:var(--rd)}

/* MAIN */
.mc{margin-left:224px;flex:1;padding:28px;min-height:100vh}
.ph{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:20px}
.pt{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px}
.ps{font-size:11px;color:var(--tx2);margin-top:2px}
.ph-right{display:flex;flex-direction:column;align-items:flex-end;gap:9px;flex-shrink:0}

/* RISK SELECTOR */
.rs{display:flex;gap:6px}
.rb{padding:6px 13px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:all .15s;border:1px solid var(--bd);background:transparent;color:var(--tx2)}
.rC{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,.1)}
.rS{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.1)}
.rA{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.1)}

/* PIPELINE TOGGLE */
.pt2{display:flex;background:var(--bg3);border:1px solid var(--bd);border-radius:7px;overflow:hidden}
.pt2-btn{padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;border:none;background:transparent;color:var(--tx2);letter-spacing:.3px}
.pt2-btn.active{background:var(--ac3);color:var(--ac)}

/* BUTTONS */
.bg2{padding:9px 20px;background:linear-gradient(135deg,var(--ac),var(--ac2));color:#000;border:none;border-radius:7px;font-weight:700;font-size:12px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:7px}
.bg2:hover{opacity:.9}
.bg2:disabled{opacity:.4;cursor:not-allowed}
.bs2{padding:8px 13px;background:transparent;border:1px solid var(--bd);color:var(--tx2);border-radius:7px;font-size:11px;cursor:pointer;transition:all .12s}
.bs2:hover{border-color:var(--bd2);color:var(--tx)}

/* STATUS BANNER */
.banner{padding:8px 14px;border-radius:7px;font-size:11px;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.banner-warn{background:rgba(232,168,32,.1);border:1px solid rgba(232,168,32,.25);color:var(--gold)}
.banner-err{background:rgba(232,64,64,.1);border:1px solid rgba(232,64,64,.25);color:var(--rd)}
.banner-ok{background:rgba(46,168,74,.1);border:1px solid rgba(46,168,74,.25);color:var(--gr)}

/* BRIEF GRID */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.fw{grid-column:1/-1}
.bb{background:var(--bg2);border:1px solid var(--bd);border-radius:11px;padding:20px;position:relative;overflow:hidden}
.bb::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--bc,var(--ac)),transparent)}
.bh{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.bn{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--tx3);background:var(--bg3);padding:2px 7px;border-radius:3px}
.bt2{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--tx2)}

/* RADAR */
.rt{font-size:16px;line-height:1.7;color:var(--tx);font-weight:300}

/* SEMAFORO */
.sem{display:flex;align-items:center;gap:5px;margin-bottom:13px}
.sd{width:12px;height:12px;border-radius:50%;opacity:.2}
.sd.on{opacity:1;box-shadow:0 0 8px currentColor}
.sv{background:var(--gr);color:var(--gr)}.sa{background:var(--am);color:var(--am)}.sr{background:var(--rd);color:var(--rd)}
.sl{font-size:11px;font-weight:700;margin-left:4px}
.tg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ti{background:var(--bg3);border-radius:6px;padding:10px}
.tl{font-size:8px;color:var(--tx3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
.tv{font-size:13px;font-weight:700}
.tgr{color:var(--gr)}.tam{color:var(--am)}.trd{color:var(--rd)}

/* EVENTS */
.ei{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:10px;align-items:flex-start}
.ei:last-child{border-bottom:none}
.eim{padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;letter-spacing:1px;flex-shrink:0;margin-top:2px}
.ih{background:rgba(232,64,64,.15);color:var(--rd)}.im{background:rgba(200,136,32,.15);color:var(--am)}.il{background:rgba(46,168,74,.15);color:var(--gr)}
.et{font-size:12px;font-weight:500;line-height:1.4;color:var(--tx)}
.em3{font-size:10px;color:var(--tx3);margin-top:2px}
.ecs{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap}
.ctag{padding:1px 5px;background:var(--bg4);border:1px solid var(--bd2);border-radius:3px;font-size:9px;color:var(--tx3)}

/* OPP CARDS */
.oc{background:var(--bg3);border:1px solid var(--bd);border-radius:9px;padding:14px;margin-bottom:10px}
.oc:last-child{margin-bottom:0}
.och{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.ocl{font-size:9px;color:var(--ac);font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.oact{padding:2px 8px;border-radius:3px;font-size:8px;font-weight:700;letter-spacing:1px}
.amon{background:rgba(232,168,32,.15);color:var(--gold);border:1px solid rgba(232,168,32,.3)}
.asim{background:rgba(0,200,240,.1);color:var(--ac);border:1px solid rgba(0,200,240,.3)}
.ot{font-size:12px;font-weight:500;margin-bottom:8px;line-height:1.4}
.od{font-size:10px;color:var(--tx2);margin-bottom:4px}
.od strong{color:var(--tx3);text-transform:uppercase;font-size:8px;letter-spacing:.5px;display:block;margin-bottom:1px}
.ors{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.rt3{padding:2px 6px;background:rgba(232,64,64,.1);border:1px solid rgba(232,64,64,.2);border-radius:3px;font-size:9px;color:var(--rd)}
.cbdg{display:inline-flex;align-items:center;gap:2px;padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;margin-top:6px}
.cba{background:rgba(46,168,74,.1);color:var(--gr);border:1px solid rgba(46,168,74,.2)}
.cbm{background:rgba(200,136,32,.1);color:var(--am);border:1px solid rgba(200,136,32,.2)}
.cbb{background:rgba(232,64,64,.1);color:var(--rd);border:1px solid rgba(232,64,64,.2)}

/* CHECKLIST */
.clc{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.clh{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.clf{color:var(--gr)}.cle{color:var(--rd)}
.cli{display:flex;align-items:flex-start;gap:6px;padding:5px 0;font-size:11px;color:var(--tx2);border-bottom:1px solid rgba(255,255,255,.03)}
.cli:last-child{border-bottom:none}

/* LOADING */
.lw{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px}
.sp{width:36px;height:36px;border:2px solid var(--bd);border-top-color:var(--ac);border-radius:50%;animation:spin .7s linear infinite;margin-bottom:14px}
@keyframes spin{to{transform:rotate(360deg)}}
.lt4{font-size:12px;color:var(--tx2)}
.ap{margin-top:12px;width:300px}
.as3{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:var(--tx3);transition:color .2s}
.as3.done{color:var(--gr)}.as3.running{color:var(--ac)}.as3.pending{color:var(--tx3)}

/* EMPTY */
.es{text-align:center;padding:60px 20px}
.ei3{font-size:42px;margin-bottom:12px;opacity:.2}
.etit{font-size:15px;color:var(--tx2);margin-bottom:6px}
.esub{font-size:11px;color:var(--tx3);max-width:340px;margin:0 auto;line-height:1.6}

/* FILTER BAR */
.fb{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap}
.fbt{padding:5px 12px;border-radius:20px;font-size:11px;cursor:pointer;transition:all .12s;border:1px solid var(--bd);background:transparent;color:var(--tx2)}
.fbt.fa{border-color:var(--ac);color:var(--ac);background:rgba(0,200,240,.07)}

/* EVENT CARD */
.ec{background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:14px;margin-bottom:10px}
.ecat{font-size:8px;color:var(--tx3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px}
.etit2{font-size:13px;font-weight:500;margin-bottom:7px;line-height:1.4}
.ef{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.src{font-size:9px;color:var(--tx3)}

/* AGENT CARDS */
.ag{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.acard{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:18px;position:relative}
.acard.online::after{content:'ONLINE';position:absolute;top:14px;right:14px;font-size:8px;font-weight:700;letter-spacing:1px;color:var(--gr);background:rgba(46,168,74,.1);border:1px solid rgba(46,168,74,.2);padding:2px 7px;border-radius:3px}
.an{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--ac);margin-bottom:4px}
.av{font-size:9px;color:var(--tx3);margin-bottom:8px}
.ad{font-size:11px;color:var(--tx2);line-height:1.6;margin-bottom:6px}
.astyles{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.asty{padding:1px 6px;background:var(--bg4);border:1px solid var(--bd2);border-radius:3px;font-size:9px;color:var(--pu)}
.apip{display:flex;gap:3px;margin-bottom:10px}
.apiptag{padding:1px 6px;border-radius:3px;font-size:8px;font-weight:700}
.pip-daily{background:rgba(0,200,240,.1);color:var(--cy);border:1px solid rgba(0,200,240,.2)}
.pip-deep{background:rgba(124,77,204,.1);color:var(--pu);border:1px solid rgba(124,77,204,.2)}
.btest2{padding:5px 11px;font-size:10px;background:transparent;border:1px solid var(--bd);color:var(--tx2);border-radius:5px;cursor:pointer;transition:all .12s}
.btest2:hover{border-color:var(--ac);color:var(--ac)}
.btest2:disabled{opacity:.4;cursor:not-allowed}

/* AGENT RESULT */
.ares{margin-top:10px;padding:8px 10px;background:var(--bg);border-radius:6px;font-size:9px;color:var(--tx2);font-family:'JetBrains Mono',monospace;line-height:1.6;max-height:120px;overflow-y:auto;border:1px solid var(--bd)}

/* PORTFOLIO */
.palc{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.pacard{background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:14px}
.pacl{font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.papct{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:var(--ac)}
.pabar{height:2px;background:var(--bd);border-radius:1px;margin-top:6px}
.pafill{height:100%;background:var(--ac);border-radius:1px;transition:width .4s}
.pfm{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:20px;margin-bottom:18px}
.ig{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.ig label{font-size:11px;color:var(--tx2);width:130px;flex-shrink:0}
.ig input[type=range]{flex:1;accent-color:var(--ac)}
.igv{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ac);width:36px;text-align:right}

/* PROFILES PAGE */
.prcards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.prcard{background:var(--bg2);border:1px solid var(--bd);border-radius:11px;padding:20px;cursor:pointer;transition:all .2s}
.prname{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;margin-bottom:6px}
.prdesc{font-size:11px;color:var(--tx2);margin-bottom:14px;line-height:1.5}
.prdet{padding:8px 10px;background:rgba(255,255,255,.03);border-radius:5px;font-size:9px;font-family:'JetBrains Mono',monospace;line-height:1.9}
.practive{font-size:9px;font-weight:700;margin-top:10px}

/* LOGS */
.logt{width:100%;border-collapse:collapse}
.logt th{text-align:left;padding:9px 10px;font-size:8px;color:var(--tx3);letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid var(--bd)}
.logt td{padding:10px;font-size:10px;color:var(--tx2);border-bottom:1px solid rgba(255,255,255,.03);font-family:'JetBrains Mono',monospace}
.logt tr:hover td{background:rgba(255,255,255,.015)}

/* SETTINGS */
.cs{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:20px;margin-bottom:16px}
.cst{font-size:12px;font-weight:700;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--bd);color:var(--tx)}
.cr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03)}
.cr:last-child{border-bottom:none}
.crl{font-size:11px;color:var(--tx2)}
.crv{font-size:11px;color:var(--ac);font-family:'JetBrains Mono',monospace}
.tog{width:36px;height:20px;background:var(--bd2);border-radius:10px;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
.tog.on{background:var(--ac)}
.tog::after{content:'';position:absolute;width:14px;height:14px;background:white;border-radius:50%;top:3px;left:3px;transition:left .2s}
.tog.on::after{left:19px}
.fg2{margin-bottom:14px}
.fg2 label{display:block;font-size:9px;color:var(--tx2);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.fg2 input{width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--bd);border-radius:7px;color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:12px;outline:none;transition:border-color .2s}
.fg2 input:focus{border-color:var(--ac)}
.fg2 select{width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--bd);border-radius:7px;color:var(--tx);font-size:12px;outline:none;cursor:pointer}

/* DATA QUALITY BADGE */
.dqb{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:.5px}
.dqok{background:rgba(46,168,74,.1);color:var(--gr);border:1px solid rgba(46,168,74,.2)}
.dqwarn{background:rgba(200,136,32,.1);color:var(--am);border:1px solid rgba(200,136,32,.2)}
.dqerr{background:rgba(232,64,64,.1);color:var(--rd);border:1px solid rgba(232,64,64,.2)}

/* DISCLAIMER */
.dis{background:rgba(232,168,32,.05);border:1px solid rgba(232,168,32,.15);border-radius:7px;padding:10px 14px;font-size:10px;color:var(--am);line-height:1.5;margin-top:20px;display:flex;gap:8px}

/* SNAPSHOT CARD */
.snap{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:16px;margin-bottom:20px}
.snap-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.snap-title{font-size:9px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;font-weight:700}
.snap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
.snap-item{background:var(--bg3);border-radius:7px;padding:10px}
.snap-sym{font-size:9px;color:var(--tx3);letter-spacing:1px;margin-bottom:3px}
.snap-val{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:var(--tx)}
.snap-chg{font-size:9px;margin-top:2px;font-family:'JetBrains Mono',monospace}
.pos{color:var(--gr)}.neg{color:var(--rd)}

/* AI COSTS PAGE */
.aicosts{display:flex;flex-direction:column;gap:16px}
.aic-info{padding:12px 16px;background:rgba(0,200,240,.06);border:1px solid rgba(0,200,240,.15);border-radius:8px;font-size:11px;color:var(--tx2);line-height:1.7}

/* SUPABASE PAGE */
.sb-status{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:12px}
.sbs-ok{background:rgba(46,168,74,.1);border:1px solid rgba(46,168,74,.25);color:var(--gr)}
.sbs-err{background:rgba(232,64,64,.1);border:1px solid rgba(232,64,64,.25);color:var(--rd)}
.sbs-off{background:rgba(255,255,255,.04);border:1px solid var(--bd);color:var(--tx3)}
.sbs-sync{background:rgba(200,136,32,.1);border:1px solid rgba(200,136,32,.25);color:var(--am)}
.sb-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.sql-block{background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--tx2);line-height:1.8;overflow-x:auto;white-space:pre;max-height:340px;overflow-y:auto}
.sql-kw{color:var(--ac)}.sql-cm{color:var(--tx3)}.sql-tb{color:var(--gold)}
.hist-table{width:100%;border-collapse:collapse}
.hist-table th{text-align:left;padding:8px 10px;font-size:8px;color:var(--tx3);letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid var(--bd)}
.hist-table td{padding:9px 10px;font-size:11px;color:var(--tx2);border-bottom:1px solid rgba(255,255,255,.03)}
.hist-table tr:hover td{background:rgba(255,255,255,.02);cursor:pointer}
.copy-btn{padding:4px 10px;font-size:9px;background:transparent;border:1px solid var(--bd);color:var(--tx2);border-radius:4px;cursor:pointer;transition:all .12s}
.copy-btn:hover{border-color:var(--ac);color:var(--ac)}

/* RESPONSIVE MOBILE */
@media(max-width:700px){.sb{transform:translateX(-100%)}.mc{margin-left:0}.grid{grid-template-columns:1fr}.prcards{grid-template-columns:1fr}.ph{flex-direction:column}}
`;

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [riskProfile, setRiskProfile] = useState("SEGURO");
  const [pipelineMode, setPipelineMode] = useState("daily");
  const [brief, setBrief] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState([]);
  const [agentOutputs, setAgentOutputs] = useState({});
  const [snapshot, setSnapshot] = useState(null);
  const [portfolio, setPortfolio] = useState({ "Renda Fixa": 40, "Ações": 25, "FIIs": 20, "Câmbio": 10, "Cripto": 5 });
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState({ dataServiceUrl: "", defaultAssets: "BTCUSDT,USDBRL,IBOV", horizon: "medio", ecoMode: true, cacheEnabled: true });
  const [supabaseConfig, setSupabaseConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cio_sb_cfg") || "{}"); } catch { return {}; }
  });
  const [dbStatus, setDbStatus] = useState(null);
  const { client: sb, isConnected: sbConnected } = useSupabase(supabaseConfig?.enabled ? supabaseConfig : null);

  // On login: load persisted data from Supabase
  useEffect(() => {
    if (!sbConnected || !sb || !logged) return;
    (async () => {
      try {
        setDbStatus("syncing");
        const [cfgRow, portRow, logsRow] = await Promise.allSettled([
          sb.getConfig("app_main_config"),
          sb.getPortfolio(),
          sb.getLogs(80)
        ]);
        if (cfgRow.status === "fulfilled" && cfgRow.value?.[0]?.value) {
          setConfig(c => ({ ...c, ...JSON.parse(cfgRow.value[0].value) }));
        }
        if (portRow.status === "fulfilled" && portRow.value?.[0]?.allocations) {
          setPortfolio(portRow.value[0].allocations);
        }
        if (logsRow.status === "fulfilled" && logsRow.value?.length) {
          setLogs(logsRow.value.map(l => ({ id: l.id, ts: l.created_at, user: l.username, action: l.action, status: l.status, notes: l.notes || "" })));
        }
        setDbStatus("ok");
      } catch (e) { setDbStatus("error"); console.warn("Supabase load:", e.message); }
    })();
  }, [sbConnected, logged]);

  // Auto-save portfolio when it changes (debounced)
  useEffect(() => {
    if (!sbConnected || !sb || !logged) return;
    const timer = setTimeout(async () => {
      try { await sb.savePortfolio({ allocations: portfolio, username: user?.username || "admin" }); }
      catch (e) { console.warn("Portfolio sync:", e.message); }
    }, 2000);
    return () => clearTimeout(timer);
  }, [portfolio, sbConnected, logged]);

  const saveConfigToDb = useCallback(async (newConfig) => {
    if (!sbConnected || !sb) return;
    try { await sb.upsertConfig("app_main_config", newConfig); }
    catch (e) { console.warn("Config sync:", e.message); }
  }, [sbConnected, sb]);

  const addLog = useCallback(async (action, status, notes = "") => {
    const entry = { id: Date.now(), ts: new Date().toISOString(), user: user?.username || "sys", action, status, notes };
    setLogs(p => [entry, ...p.slice(0, 99)]);
    if (sbConnected && sb) {
      try { await sb.saveLog({ username: user?.username || "sys", action, status, notes: notes || "" }); }
      catch { /* silent */ }
    }
  }, [user, sbConnected, sb]);

  const login = (u, p) => {
    if (u === "diogobrasileiro" && p === "dbsa1981") {
      setUser({ username: u, role: "admin" });
      setLogged(true);
      return true;
    }
    return false;
  };
  const logout = () => { setLogged(false); setUser(null); setBrief(null); setSnapshot(null); setDbStatus(null); };

  const runPipeline = async () => {
    setGenerating(true); setBrief(null); setAgentOutputs({});
    const pipeline = pipelineMode === "daily" ? DAILY_PIPELINE : DEEP_PIPELINE;

    // Step 0: Fetch snapshot
    setProgress([{ label: "DATA SERVICE — Buscando snapshot de mercado...", status: "running" }]);
    let snap = MOCK_SNAPSHOT;
    if (config.dataServiceUrl) {
      const fetched = await fetchSnapshot(config);
      if (fetched) snap = fetched;
    }
    setSnapshot(snap);
    addLog("FETCH_SNAPSHOT", snap.quality?.partial ? "warn" : "ok", snap.quality?.notes?.join(", ") || "");
    setProgress([{ label: "DATA SERVICE — Snapshot recebido ✓", status: "done" }]);

    // Run agents sequentially
    const bundle = {};
    const allProgress = [{ label: "DATA SERVICE — Snapshot recebido ✓", status: "done" }];

    for (let i = 0; i < pipeline.length; i++) {
      const agentId = pipeline[i];
      const agent = AGENTS[agentId];
      const stepLabel = `${agentId} — ${agent.desc.split(":")[0]}...`;
      allProgress.push({ label: stepLabel, status: "running" });
      setProgress([...allProgress]);
      await new Promise(r => setTimeout(r, 300));

      try {
        const prevSummaries = Object.fromEntries(Object.entries(bundle).map(([k, v]) => [k, { thesis: v.thesis, alerts: v.alerts }]));
        let p;
        if (agentId === "ORCHESTRATOR_CIO") {
          p = agent.buildPrompt(snap, riskProfile, config.horizon, bundle);
        } else {
          p = agent.buildPrompt(snap, riskProfile, config.horizon, prevSummaries);
        }
        const result = await callClaude(p.system, p.user, 1800);
        bundle[agentId] = result;
        setAgentOutputs(prev => ({ ...prev, [agentId]: result }));
        addLog(`AGENT_${agentId}`, result.parse_error ? "warn" : "ok", result.parse_error ? "parse error" : "");
      } catch (e) {
        bundle[agentId] = { agent: agentId, error: e.message };
        addLog(`AGENT_${agentId}`, "fail", e.message);
      }

      allProgress[allProgress.length - 1] = { label: stepLabel.replace("...", " ✓"), status: "done" };
      setProgress([...allProgress]);
      await new Promise(r => setTimeout(r, 200));
    }

    // Extract final brief from CIO
    const cio = bundle["ORCHESTRATOR_CIO"];
    if (cio?.morning_brief) {
      const mb = cio.morning_brief;
      if (mb.opportunities_cards) {
        mb.opportunities_cards = applyPolicy(mb.opportunities_cards, riskProfile);
      }
      setBrief(mb);
      // Persist brief + agent bundle to Supabase
      if (sbConnected && sb) {
        try {
          const saved = await sb.saveBrief({
            risk_profile: riskProfile,
            pipeline_mode: pipelineMode,
            brief_json: mb,
            snapshot_json: snap,
            agent_bundle: bundle,
            username: user?.username || "admin"
          });
          addLog("BRIEF_SAVED_DB", "ok", `id:${saved?.[0]?.id || "unknown"}`);
        } catch (e) {
          addLog("BRIEF_SAVED_DB", "warn", `Supabase save failed: ${e.message}`);
        }
      }
    } else {
      setBrief({ _error: true, _raw: cio });
    }
    addLog("GENERATE_BRIEF", "ok", `mode:${pipelineMode} profile:${riskProfile} agents:${pipeline.length}`);
    setGenerating(false);
  };

  if (!logged) return <LoginPage onLogin={login} />;

  const NAV = [
    { s: "Mesa", items: [
      { id: "dashboard", i: "⚡", l: "Morning Brief" },
      { id: "events", i: "📡", l: "Eventos" },
      { id: "opportunities", i: "🎯", l: "Oportunidades" },
      { id: "portfolio", i: "📊", l: "Portfólio" },
    ]},
    { s: "Análise", items: [
      { id: "agents", i: "🤖", l: "Agentes" },
      { id: "agent_outputs", i: "🧠", l: "Outputs IA" },
    ]},
    { s: "Config", items: [
      { id: "profiles", i: "🛡️", l: "Perfis & Regras" },
      { id: "data_apis", i: "🔌", l: "Dados & APIs" },
      { id: "supabase", i: "🗄️", l: "Banco de Dados" },
      { id: "ai_costs", i: "💡", l: "IA & Custos" },
    ]},
    { s: "Admin", items: [
      { id: "logs", i: "📋", l: "Logs & Auditoria" },
      { id: "settings", i: "⚙️", l: "Configurações" },
    ]}
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="sb">
          <div className="sb-logo">
            <div className="sb-n">CIO DIGITAL</div>
            <div className="sb-s">v{APP_VERSION} · Mesa de Operações</div>
            {sbConnected && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: dbStatus === "ok" ? "var(--gr)" : dbStatus === "syncing" ? "var(--am)" : dbStatus === "error" ? "var(--rd)" : "var(--tx3)", boxShadow: dbStatus === "ok" ? "0 0 5px var(--gr)" : "none" }}></div>
                <span style={{ fontSize: 8, color: dbStatus === "ok" ? "var(--gr)" : dbStatus === "syncing" ? "var(--am)" : "var(--tx3)", letterSpacing: 1, textTransform: "uppercase" }}>
                  {dbStatus === "ok" ? "Supabase Online" : dbStatus === "syncing" ? "Sincronizando..." : dbStatus === "error" ? "DB Offline" : "Supabase"}
                </span>
              </div>
            )}
          </div>
          <div className="sb-nav">
            {NAV.map(s => (
              <div className="ns" key={s.s}>
                <div className="nt">{s.s}</div>
                {s.items.map(it => (
                  <div key={it.id} className={`ni${page === it.id ? " active" : ""}`} onClick={() => setPage(it.id)}>
                    <span className="ni-ic">{it.i}</span>{it.l}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="sb-bot">
            <div className="ua">
              <div className="uav">{user?.username?.[0]?.toUpperCase()}</div>
              <div><div className="un">{user?.username}</div><div className="ur">{user?.role?.toUpperCase()}</div></div>
            </div>
            <button className="blg" onClick={logout}>Sair</button>
          </div>
        </div>

        <div className="mc">
          {page === "dashboard" && <DashboardPage brief={brief} snapshot={snapshot} riskProfile={riskProfile} setRiskProfile={setRiskProfile} pipelineMode={pipelineMode} setPipelineMode={setPipelineMode} generating={generating} progress={progress} onRun={runPipeline} config={config} />}
          {page === "events" && <EventsPage snapshot={snapshot} />}
          {page === "opportunities" && <OppsPage brief={brief} profile={riskProfile} />}
          {page === "portfolio" && <PortfolioPage portfolio={portfolio} setPortfolio={setPortfolio} brief={brief} />}
          {page === "agents" && <AgentsPage onLog={addLog} snapshot={snapshot} riskProfile={riskProfile} config={config} />}
          {page === "agent_outputs" && <AgentOutputsPage outputs={agentOutputs} pipeline={pipelineMode === "daily" ? DAILY_PIPELINE : DEEP_PIPELINE} />}
          {page === "profiles" && <ProfilesPage profile={riskProfile} setProfile={setRiskProfile} />}
          {page === "data_apis" && <DataApisPage config={config} setConfig={(c) => { setConfig(c); saveConfigToDb(c); }} onLog={addLog} />}
          {page === "supabase" && <SupabasePage supabaseConfig={supabaseConfig} setSupabaseConfig={(c) => { setSupabaseConfig(c); try { localStorage.setItem("cio_sb_cfg", JSON.stringify(c)); } catch {} }} dbStatus={dbStatus} setDbStatus={setDbStatus} sb={sb} sbConnected={sbConnected} />}
          {page === "ai_costs" && <AICostsPage pipelineMode={pipelineMode} setPipelineMode={setPipelineMode} />}
          {page === "logs" && <LogsPage logs={logs} />}
          {page === "settings" && <SettingsPage user={user} />}
        </div>
      </div>
    </>
  );
}

// ============================================================
// LOGIN
// ============================================================
function LoginPage({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); await new Promise(r => setTimeout(r, 500));
    if (!onLogin(u, p)) setErr("Credenciais inválidas.");
    setLoading(false);
  };
  return (
    <>
      <style>{CSS}</style>
      <div className="lp">
        <div className="lc">
          <div className="ll">
            <div className="lt">CIO DIGITAL</div>
            <div className="ll-line"></div>
            <div className="ls">Family Office · Mesa de Operações</div>
          </div>
          <div className="fg"><label>Usuário</label><input value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoComplete="username" /></div>
          <div className="fg"><label>Senha</label><input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoComplete="current-password" /></div>
          <button className="bp" onClick={submit} disabled={loading}>{loading ? "Autenticando..." : "Entrar"}</button>
          {err && <div className="em">{err}</div>}
          <div className="ln">⚠️ Plataforma educacional e analítica. Não constitui recomendação individual. Todo investimento envolve risco.</div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function DashboardPage({ brief, snapshot, riskProfile, setRiskProfile, pipelineMode, setPipelineMode, generating, progress, onRun, config }) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const semC = { verde: "tgr", amarelo: "tam", vermelho: "trd" };
  const noService = !config.dataServiceUrl;

  const exportBrief = () => {
    if (!brief) return;
    const data = JSON.stringify({ brief, snapshot, ts: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `morning-brief-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">MORNING BRIEF</div>
          <div className="ps">{today} · Modo: {pipelineMode === "daily" ? "Diário (4 agentes)" : "Deep Dive (10 agentes)"}</div>
        </div>
        <div className="ph-right">
          <div className="rs">
            {Object.entries(RISK_PROFILES).map(([k, v]) => (
              <button key={k} className={`rb ${riskProfile === k ? "r" + k[0] : ""}`} onClick={() => setRiskProfile(k)}>{v.label}</button>
            ))}
          </div>
          <div className="pt2">
            <button className={`pt2-btn ${pipelineMode === "daily" ? "active" : ""}`} onClick={() => setPipelineMode("daily")}>⚡ Diário</button>
            <button className={`pt2-btn ${pipelineMode === "deep" ? "active" : ""}`} onClick={() => setPipelineMode("deep")}>🔬 Deep Dive</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {brief && <button className="bs2" onClick={exportBrief}>⬇ Exportar JSON</button>}
            <button className="bg2" onClick={onRun} disabled={generating}>{generating ? "⚙️ Processando..." : "⚡ Gerar Morning Brief"}</button>
          </div>
        </div>
      </div>

      {noService && (
        <div className="banner banner-warn">⚠️ Data Service não configurado — usando dados de demonstração. Configure em <strong>Dados &amp; APIs</strong>.</div>
      )}
      {snapshot?.quality?.partial && (
        <div className="banner banner-warn">⚠️ Dados parciais: {snapshot.quality.notes?.join(", ")}</div>
      )}

      {snapshot && <SnapshotBar snap={snapshot} />}

      {generating && (
        <div className="lw">
          <div className="sp"></div>
          <div className="lt4">Mesa de operações ativa — pipeline {pipelineMode === "daily" ? "diário" : "deep dive"}...</div>
          <div className="ap">
            {progress.map((s, i) => (
              <div key={i} className={`as3 ${s.status}`}>
                {s.status === "done" ? "✓" : s.status === "running" ? "◉" : "○"} {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {!generating && !brief && (
        <div className="es">
          <div className="ei3">⚡</div>
          <div className="etit">Nenhum brief gerado</div>
          <div className="esub">Selecione perfil e modo, depois clique em "Gerar Morning Brief" para ativar a mesa de operações.</div>
        </div>
      )}

      {!generating && brief && !brief._error && (
        <div className="grid">
          {/* BLOCO 1: RADAR */}
          <div className="bb" style={{ "--bc": "#00c8f0" }}>
            <div className="bh"><span className="bn">01</span><span className="bt2">Radar 30s</span></div>
            <div className="rt">{brief.radar_30s}</div>
          </div>

          {/* BLOCO 3: TERMOMETRO */}
          <div className="bb" style={{ "--bc": "#e8a820" }}>
            <div className="bh"><span className="bn">03</span><span className="bt2">Termômetro de Risco</span></div>
            {brief.termometro && (
              <>
                <div className="sem">
                  {["verde","amarelo","vermelho"].map(c => (
                    <div key={c} className={`sd s${c[0]} ${brief.termometro.semaforo === c ? "on" : ""}`}></div>
                  ))}
                  <span className={`sl ${semC[brief.termometro.semaforo] || "tam"}`}>{brief.termometro.semaforo?.toUpperCase()}</span>
                </div>
                <div className="tg">
                  {[["Volatilidade", brief.termometro.volatilidade], ["Liquidez", brief.termometro.liquidez], ["Correlação", brief.termometro.correlacao], ["Stress Macro", brief.termometro.stress_macro]].map(([l, v]) => {
                    const cls = { baixo: "tgr", boa: "tgr", normal: "tgr", medio: "tam", atencao: "tam", alta: "tam", alto: "trd", ruim: "trd", perigosa: "trd" }[v] || "tam";
                    return <div className="ti" key={l}><div className="tl">{l}</div><div className={`tv ${cls}`}>{v?.toUpperCase()}</div></div>;
                  })}
                </div>
                {brief.termometro.nota && <div style={{ fontSize: 10, color: "var(--tx2)", marginTop: 9 }}>{brief.termometro.nota}</div>}
              </>
            )}
          </div>

          {/* BLOCO 2: MUDANÇAS */}
          <div className="bb fw" style={{ "--bc": "#7c4dcc" }}>
            <div className="bh"><span className="bn">02</span><span className="bt2">Resumo — {brief.resumo_6_bullets?.length || 0} pontos-chave</span></div>
            {(brief.resumo_6_bullets || []).map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < (brief.resumo_6_bullets?.length || 0) - 1 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                <span style={{ color: "var(--ac)", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, flexShrink: 0, marginTop: 1 }}>{String(i+1).padStart(2, "0")}</span>
                <span style={{ fontSize: 12, color: "var(--tx2)", lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* BLOCO 4: OPORTUNIDADES */}
          <div className="bb fw" style={{ "--bc": "#2ea84a" }}>
            <div className="bh"><span className="bn">04</span><span className="bt2">Oportunidades · {RISK_PROFILES[riskProfile]?.label}</span></div>
            {(brief.opportunities_cards || []).length === 0
              ? <div style={{ fontSize: 11, color: "var(--tx3)" }}>Nenhuma oportunidade aprovada para o perfil {RISK_PROFILES[riskProfile]?.label} hoje. Foco em monitoramento e preservação.</div>
              : (brief.opportunities_cards || []).map((o, i) => <OppCard key={i} o={o} />)
            }
          </div>

          {/* BLOCO 5: RISCOS */}
          <div className="bb" style={{ "--bc": "#e84040" }}>
            <div className="bh"><span className="bn">05</span><span className="bt2">Riscos Top 5</span></div>
            {(brief.risks_top5 || []).map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                <span style={{ color: "var(--rd)", fontSize: 10, flexShrink: 0, fontFamily: "'JetBrains Mono',monospace" }}>{i+1}.</span>
                <span style={{ fontSize: 11, color: "var(--tx2)" }}>{r}</span>
              </div>
            ))}
          </div>

          {/* BLOCO 6: CHECKLIST */}
          <div className="bb" style={{ "--bc": "#22c55e" }}>
            <div className="bh"><span className="bn">06</span><span className="bt2">Checklist do Dia</span></div>
            <div className="clc">
              <div>
                <div className="clh clf">✓ Fazer</div>
                {(brief.checklist_do_dia?.fazer || []).map((it, i) => (
                  <div className="cli" key={i}><span style={{ color: "var(--gr)", flexShrink: 0 }}>›</span>{it}</div>
                ))}
              </div>
              <div>
                <div className="clh cle">✗ Evitar</div>
                {(brief.checklist_do_dia?.evitar || []).map((it, i) => (
                  <div className="cli" key={i}><span style={{ color: "var(--rd)", flexShrink: 0 }}>›</span>{it}</div>
                ))}
              </div>
            </div>
          </div>

          {/* PLANO POR CLASSE */}
          {brief.plan_by_class && (
            <div className="bb fw" style={{ "--bc": "#00bcd4" }}>
              <div className="bh"><span className="bn">07</span><span className="bt2">Plano por Classe</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
                {Object.entries(brief.plan_by_class).map(([cls, data]) => (
                  <div key={cls} style={{ background: "var(--bg3)", borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--ac)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{cls.replace("_", " ")}</span>
                      <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 3, fontWeight: 700, background: data.postura === "ofensiva" ? "rgba(46,168,74,.15)" : data.postura === "defensiva" ? "rgba(232,64,64,.15)" : "rgba(200,136,32,.15)", color: data.postura === "ofensiva" ? "var(--gr)" : data.postura === "defensiva" ? "var(--rd)" : "var(--am)" }}>{(data.postura || "").toUpperCase()}</span>
                    </div>
                    {(data.actions || []).map((a, i) => <div key={i} style={{ fontSize: 10, color: "var(--tx2)", padding: "2px 0" }}>› {a}</div>)}
                    {(data.alerts || []).map((a, i) => <div key={i} style={{ fontSize: 10, color: "var(--am)", padding: "2px 0" }}>⚠ {a}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {brief?._error && (
        <div className="banner banner-err">
          Erro ao parsear resposta do CIO. Verifique os outputs em "Outputs IA".
        </div>
      )}

      <div className="dis">
        <span>⚠️</span>
        <span><strong>Conteúdo educacional.</strong> Não constitui recomendação individual de compra/venda. Todo investimento tem risco. Decisões são de responsabilidade exclusiva do investidor.</span>
      </div>
    </>
  );
}

function SnapshotBar({ snap }) {
  const priceEntries = Object.entries(snap.prices || {});
  const macroEntries = Object.entries(snap.macro_br || {}).filter(([,v]) => v !== null);
  return (
    <div className="snap">
      <div className="snap-hdr">
        <span className="snap-title">Snapshot de Mercado</span>
        <span className={`dqb ${snap.quality?.partial ? "dqwarn" : "dqok"}`}>{snap.quality?.partial ? "⚠ PARCIAL" : "✓ OK"} · {snap.quality?.source}</span>
      </div>
      <div className="snap-grid">
        {priceEntries.map(([sym, data]) => (
          <div className="snap-item" key={sym}>
            <div className="snap-sym">{sym}</div>
            <div className="snap-val">{data.last ? data.last.toLocaleString("pt-BR") : "—"}</div>
            {data.chg24h_pct !== null && data.chg24h_pct !== undefined && (
              <div className={`snap-chg ${data.chg24h_pct >= 0 ? "pos" : "neg"}`}>{data.chg24h_pct >= 0 ? "+" : ""}{data.chg24h_pct?.toFixed(2)}%</div>
            )}
          </div>
        ))}
        {macroEntries.map(([k, v]) => (
          <div className="snap-item" key={k}>
            <div className="snap-sym">{k.toUpperCase().replace("_", " ")}</div>
            <div className="snap-val">{typeof v === "number" ? v.toLocaleString("pt-BR") : v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OppCard({ o }) {
  const cc = { alta: "cba", media: "cbm", baixa: "cbb" };
  return (
    <div className="oc">
      <div className="och">
        <span className="ocl">{o.classe || o.class}</span>
        <span className={`oact ${(o.acao || o.action) === "SIMULAR" ? "asim" : "amon"}`}>{o.acao || o.action || "MONITORAR"}</span>
      </div>
      <div className="ot">{o.tese || o.thesis}</div>
      {o.gatilho && <div className="od"><strong>Gatilho</strong>{o.gatilho}</div>}
      {o.invalidacao && <div className="od"><strong>Invalidação</strong>{o.invalidacao}</div>}
      <div className="ors">{(o.riscos || []).map((r, i) => <span className="rt3" key={i}>{r}</span>)}</div>
      <div>
        <span className={`cbdg ${cc[o.confianca] || "cbm"}`}>{(o.confianca || "").toUpperCase()} CONFIANÇA</span>
      </div>
    </div>
  );
}

// ============================================================
// EVENTS PAGE
// ============================================================
function EventsPage({ snapshot }) {
  const [filter, setFilter] = useState("Todos");
  const cats = ["Todos", "Macro Global", "Brasil", "Cripto", "Geopolítica", "Corporativo"];
  const events = snapshot?.events || MOCK_SNAPSHOT.events;
  const news = snapshot?.news || MOCK_SNAPSHOT.news;

  return (
    <>
      <div className="ph"><div><div className="pt">EVENTOS DO DIA</div><div className="ps">Calendário e notícias do snapshot atual</div></div></div>
      <div className="fb">{cats.map(c => <button key={c} className={`fbt${filter===c?" fa":""}`} onClick={() => setFilter(c)}>{c}</button>)}</div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, color: "var(--tx3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Eventos</div>
        {events.map((ev, i) => {
          const ic = ev.impact === "high" ? "ih" : ev.impact === "med" ? "im" : "il";
          return (
            <div className="ec" key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="etit2">{ev.title}</div>
                <span className={`eim ${ic}`}>{ev.impact?.toUpperCase()}</span>
              </div>
              <div className="ef"><span className="src">📅 {ev.when}</span></div>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ fontSize: 9, color: "var(--tx3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Notícias</div>
        {news.map((n, i) => (
          <div className="ec" key={i}>
            <div className="etit2">{n.title}</div>
            <div className="ef">
              <span className="src">📌 {n.source} · {n.time}</span>
              <div className="ecs">{(n.tags || []).map(t => <span className="ctag" key={t}>{t}</span>)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// OPPORTUNITIES PAGE
// ============================================================
function OppsPage({ brief, profile }) {
  const opps = brief?.opportunities_cards || [];
  return (
    <>
      <div className="ph"><div><div className="pt">OPORTUNIDADES</div><div className="ps">Aprovadas pelo Risk Policy Engine · Perfil: {RISK_PROFILES[profile]?.label}</div></div></div>
      {opps.length === 0
        ? <div className="es"><div className="ei3">🎯</div><div className="etit">Nenhuma oportunidade aprovada</div><div className="esub">Gere um Morning Brief ou aguarde candidatos qualificados para o perfil atual.</div></div>
        : opps.map((o, i) => <OppCard key={i} o={o} />)
      }
      <div className="dis"><span>⚠️</span><span>Análises educacionais por classe. Não constituem recomendação individual.</span></div>
    </>
  );
}

// ============================================================
// PORTFOLIO PAGE
// ============================================================
function PortfolioPage({ portfolio, setPortfolio, brief }) {
  const total = Object.values(portfolio).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="ph"><div><div className="pt">PORTFÓLIO</div><div className="ps">Alocação por classe · Soma: {total}%</div></div></div>
      <div className="pfm">
        <div style={{ fontSize: 11, color: "var(--tx2)", marginBottom: 14 }}>Ajuste a alocação por classe (%):</div>
        {Object.keys(portfolio).map(cls => (
          <div className="ig" key={cls}>
            <label>{cls}</label>
            <input type="range" min={0} max={100} value={portfolio[cls]} onChange={e => setPortfolio(p => ({ ...p, [cls]: +e.target.value }))} />
            <span className="igv">{portfolio[cls]}%</span>
          </div>
        ))}
        {total !== 100 && <div style={{ fontSize: 10, color: "var(--am)", marginTop: 6 }}>⚠️ Soma atual: {total}% (recomendado: 100%)</div>}
      </div>
      <div className="palc">
        {Object.entries(portfolio).map(([cls, v]) => (
          <div className="pacard" key={cls}>
            <div className="pacl">{cls}</div>
            <div className="papct">{v}%</div>
            <div className="pabar"><div className="pafill" style={{ width: `${v}%` }}></div></div>
          </div>
        ))}
      </div>
      {brief?.plan_by_class && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 9, color: "var(--tx3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Alertas do Plano por Classe</div>
          {Object.entries(brief.plan_by_class).map(([cls, data]) => (
            (data.alerts || []).length > 0 && (
              <div key={cls} style={{ background: "var(--bg2)", border: "1px solid rgba(232,168,32,.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: "var(--am)", fontWeight: 700, textTransform: "uppercase", marginRight: 8 }}>{cls.replace("_"," ")}</span>
                {(data.alerts || []).map((a, i) => <span key={i} style={{ fontSize: 11, color: "var(--tx2)" }}>{a} </span>)}
              </div>
            )
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// AGENTS PAGE
// ============================================================
function AgentsPage({ onLog, snapshot, riskProfile, config }) {
  const [testing, setTesting] = useState(null);
  const [results, setResults] = useState({});

  const testAgent = async (agentId) => {
    setTesting(agentId);
    onLog(`TEST_${agentId}`, "running", "");
    try {
      const agent = AGENTS[agentId];
      const snap = snapshot || MOCK_SNAPSHOT;
      const p = agentId === "ORCHESTRATOR_CIO"
        ? agent.buildPrompt(snap, riskProfile, "medio", {})
        : agent.buildPrompt(snap, riskProfile, "medio", {});
      const result = await callClaude(p.system, p.user, 800);
      setResults(prev => ({ ...prev, [agentId]: result }));
      onLog(`TEST_${agentId}`, result.parse_error ? "warn" : "ok", "");
    } catch (e) {
      setResults(prev => ({ ...prev, [agentId]: { error: e.message } }));
      onLog(`TEST_${agentId}`, "fail", e.message);
    }
    setTesting(null);
  };

  return (
    <>
      <div className="ph"><div><div className="pt">AGENTES</div><div className="ps">{Object.keys(AGENTS).length} especialistas ativos · Pipeline configurável</div></div></div>
      <div className="ag">
        {Object.values(AGENTS).map(agent => (
          <div className={`acard ${agent.status === "ONLINE" ? "online" : ""}`} key={agent.id}>
            <div className="an">{agent.name}</div>
            <div className="av">{agent.version}</div>
            <div className="ad">{agent.desc}</div>
            <div className="astyles">{agent.styles.map(s => <span key={s} className="asty">{s}</span>)}</div>
            <div className="apip">
              {agent.pipeline.includes("daily") && <span className="apiptag pip-daily">⚡ Diário</span>}
              {agent.pipeline.includes("deep") && <span className="apiptag pip-deep">🔬 Deep Dive</span>}
            </div>
            {results[agent.id] && (
              <div className="ares">{JSON.stringify(results[agent.id], null, 1).slice(0, 400)}...</div>
            )}
            <button className="btest2" onClick={() => testAgent(agent.id)} disabled={testing === agent.id}>
              {testing === agent.id ? "Testando..." : "▶ Testar Agente"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// AGENT OUTPUTS PAGE
// ============================================================
function AgentOutputsPage({ outputs, pipeline }) {
  const [selected, setSelected] = useState(null);
  const hasOutputs = Object.keys(outputs).length > 0;

  return (
    <>
      <div className="ph"><div><div className="pt">OUTPUTS IA</div><div className="ps">Resultado bruto de cada agente do último pipeline</div></div></div>
      {!hasOutputs && <div className="es"><div className="ei3">🧠</div><div className="etit">Sem outputs</div><div className="esub">Gere um Morning Brief para ver os outputs de cada agente.</div></div>}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {pipeline.filter(id => outputs[id]).map(id => {
          const out = outputs[id];
          const isSelected = selected === id;
          return (
            <div key={id} onClick={() => setSelected(isSelected ? null : id)} style={{ background: "var(--bg2)", border: `1px solid ${isSelected ? "var(--ac)" : "var(--bd)"}`, borderRadius: 9, padding: "12px 16px", cursor: "pointer", flex: "1 1 280px", minWidth: 280, transition: "border-color .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--ac)", fontWeight: 600 }}>{id}</span>
                <span style={{ fontSize: 9, color: out.parse_error ? "var(--rd)" : "var(--gr)", fontWeight: 700 }}>{out.parse_error ? "⚠ PARSE ERR" : "✓ OK"}</span>
              </div>
              {(out.thesis || out.thesis_by_class) && (
                <div style={{ fontSize: 10, color: "var(--tx2)", lineHeight: 1.5 }}>
                  {(out.thesis || []).slice(0,2).map((t, i) => <div key={i}>› {t}</div>)}
                </div>
              )}
              {isSelected && (
                <div style={{ marginTop: 12, padding: "10px", background: "var(--bg)", borderRadius: 6, fontSize: 9, color: "var(--tx2)", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto" }}>
                  {JSON.stringify(out, null, 2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// PROFILES PAGE
// ============================================================
function ProfilesPage({ profile, setProfile }) {
  return (
    <>
      <div className="ph"><div><div className="pt">PERFIS & REGRAS</div><div className="ps">Presets do Risk Policy Engine</div></div></div>
      <div className="prcards">
        {Object.entries(RISK_PROFILES).map(([k, cfg]) => (
          <div key={k} className="prcard" onClick={() => setProfile(k)} style={{ background: profile === k ? cfg.bg : "var(--bg2)", borderColor: profile === k ? cfg.color : "var(--bd)" }}>
            <div className="prname" style={{ color: cfg.color }}>{cfg.label}</div>
            <div className="prdesc">{cfg.desc}</div>
            <div style={{ fontSize: 9, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Permitido</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
              {cfg.allowed.map(c => <span key={c} className="ctag" style={{ borderColor: cfg.color + "44", color: cfg.color, fontSize: 9 }}>{c}</span>)}
            </div>
            {cfg.blocked.length > 0 && <>
              <div style={{ fontSize: 9, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Bloqueado</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
                {cfg.blocked.map(c => <span key={c} className="ctag" style={{ borderColor: "var(--rd)33", color: "var(--rd)", fontSize: 9 }}>{c}</span>)}
              </div>
            </>}
            <div className="prdet" style={{ marginTop: 4 }}>
              <span style={{ color: "var(--tx3)" }}>Modo: </span><span style={{ color: cfg.color }}>{cfg.mode}</span>{"  "}
              <span style={{ color: "var(--tx3)" }}>Risco: </span><span style={{ color: cfg.color }}>{cfg.max_risk}</span>{"  "}
              <span style={{ color: "var(--tx3)" }}>Confiança mín: </span><span style={{ color: cfg.color }}>{cfg.min_conf}</span>
            </div>
            {profile === k && <div className="practive" style={{ color: cfg.color }}>✓ PERFIL ATIVO</div>}
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================
// DATA & APIS PAGE
// ============================================================
function DataApisPage({ config, setConfig, onLog }) {
  const [local, setLocal] = useState(config);
  const [health, setHealth] = useState(null);
  const [testing, setTesting] = useState(false);

  const save = () => { setConfig(local); onLog("SAVE_CONFIG", "ok", "Data & APIs config saved"); };

  const testConn = async () => {
    setTesting(true); setHealth(null);
    try {
      const res = await fetch(`${local.dataServiceUrl}/health`);
      const data = await res.json();
      setHealth({ ok: true, data });
      onLog("TEST_CONNECTION", "ok", JSON.stringify(data));
    } catch (e) {
      setHealth({ ok: false, error: e.message });
      onLog("TEST_CONNECTION", "fail", e.message);
    }
    setTesting(false);
  };

  return (
    <>
      <div className="ph"><div><div className="pt">DADOS & APIS</div><div className="ps">Configuração do Data Service e fontes de mercado</div></div></div>

      <div className="cs">
        <div className="cst">Data Service (Backend)</div>
        <div className="fg2">
          <label>DATA_SERVICE_BASE_URL</label>
          <input value={local.dataServiceUrl} onChange={e => setLocal(l => ({ ...l, dataServiceUrl: e.target.value }))} placeholder="https://seu-endpoint.run.app" />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button className="bg2" style={{ fontSize: 11, padding: "7px 14px" }} onClick={testConn} disabled={testing || !local.dataServiceUrl}>{testing ? "Testando..." : "▶ Testar Conexão /health"}</button>
        </div>
        {health && (
          <div className={`banner ${health.ok ? "banner-ok" : "banner-err"}`}>
            {health.ok ? `✓ Online — ${JSON.stringify(health.data)}` : `✗ Offline — ${health.error}`}
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--tx3)", lineHeight: 1.7 }}>
          O Data Service deve expor: <code style={{ color: "var(--ac)" }}>/health</code> e <code style={{ color: "var(--ac)" }}>/snapshot?symbols=…&amp;include=macro,events,news</code><br />
          Se não configurado, o app usa dados de demonstração automaticamente.
        </div>
      </div>

      <div className="cs">
        <div className="cst">Ativos e Preferências</div>
        <div className="fg2"><label>Ativos padrão (separados por vírgula)</label><input value={local.defaultAssets} onChange={e => setLocal(l => ({ ...l, defaultAssets: e.target.value }))} placeholder="BTCUSDT,USDBRL,IBOV,SPY" /></div>
        <div className="fg2"><label>Horizonte padrão</label>
          <select value={local.horizon} onChange={e => setLocal(l => ({ ...l, horizon: e.target.value }))}>
            <option value="curto">Curto prazo</option>
            <option value="medio">Médio prazo</option>
            <option value="longo">Longo prazo</option>
          </select>
        </div>
      </div>

      <div className="cs">
        <div className="cst">Chaves de API (opcional — não envie ao front-end em produção)</div>
        {[["TWELVE_DATA_API_KEY", "TwelveData (ações)"], ["POLYGON_API_KEY", "Polygon.io (ações)"], ["NEWS_API_KEY", "NewsAPI (notícias)"]].map(([k, l]) => (
          <div className="fg2" key={k}><label>{l}</label><input type="password" placeholder="••••••••••" /></div>
        ))}
        <div style={{ fontSize: 10, color: "var(--tx3)", lineHeight: 1.6 }}>⚠️ Em produção: nunca exponha API keys no front-end. Configure no backend via Secret Manager (GCP).</div>
      </div>

      <button className="bg2" onClick={save}>💾 Salvar Configurações</button>
    </>
  );
}

// ============================================================
// AI & COSTS PAGE
// ============================================================
function AICostsPage({ pipelineMode, setPipelineMode }) {
  return (
    <>
      <div className="ph"><div><div className="pt">IA & CUSTOS</div><div className="ps">Controle do pipeline agentic e otimização de tokens</div></div></div>
      <div className="cs">
        <div className="cst">Modelo em Uso</div>
        <div className="cr"><span className="crl">Modelo ativo</span><span className="crv">claude-sonnet-4-20250514</span></div>
        <div className="cr"><span className="crl">Modo econômico</span><span className="crv">JSON compacto · sem chain-of-thought</span></div>
        <div className="cr"><span className="crl">Max tokens/agente</span><span className="crv">1800</span></div>
        <div className="cr"><span className="crl">Reutiliza snapshot</span><span className="crv">SIM</span></div>
      </div>

      <div className="cs">
        <div className="cst">Pipeline Agentic Workflow</div>
        <div style={{ marginBottom: 14 }}>
          <div className="pt2">
            <button className={`pt2-btn ${pipelineMode === "daily" ? "active" : ""}`} onClick={() => setPipelineMode("daily")}>⚡ Diário (4 agentes)</button>
            <button className={`pt2-btn ${pipelineMode === "deep" ? "active" : ""}`} onClick={() => setPipelineMode("deep")}>🔬 Deep Dive (10 agentes)</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 9, color: "var(--cy)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>⚡ Pipeline Diário</div>
            {DAILY_PIPELINE.map((id, i) => <div key={id} style={{ fontSize: 11, color: "var(--tx2)", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,.03)" }}><span style={{ color: "var(--tx3)", fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>{i+1}.</span> {id}</div>)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 9, color: "var(--pu)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>🔬 Deep Dive</div>
            {DEEP_PIPELINE.map((id, i) => <div key={id} style={{ fontSize: 11, color: "var(--tx2)", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,.03)" }}><span style={{ color: "var(--tx3)", fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>{i+1}.</span> {id}</div>)}
          </div>
        </div>
      </div>

      <div className="cs">
        <div className="cst">Filosofia do Pipeline</div>
        <div className="aic-info">
          <strong>Por que agentes sequenciais?</strong><br />
          Colocar múltiplas personas em um único prompt causa "diluição de atenção" — o modelo tenta equilibrar perspectivas conflitantes em vez de aprofundar cada análise.<br /><br />
          <strong>Solução adotada:</strong> Agentic Workflow sequencial. Cada agente recebe contexto compacto + resumos anteriores, foca em sua especialidade, e passa o output adiante. Resultado: análise mais profunda com tokens economizados.<br /><br />
          <strong>Modo Diário:</strong> 4 agentes essenciais (Macro → Risco → Hedge → CIO). Ideal para uso cotidiano.<br />
          <strong>Deep Dive:</strong> 10 agentes completos. Use quando quiser análise aprofundada por setor, quant, execução e tributário.
        </div>
      </div>
    </>
  );
}

// ============================================================
// SUPABASE PAGE
// ============================================================
function SupabasePage({ supabaseConfig, setSupabaseConfig, dbStatus, setDbStatus, sb, sbConnected }) {
  const [local, setLocal] = useState(supabaseConfig || {});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [briefs, setBriefs] = useState([]);
  const [loadingBriefs, setLoadingBriefs] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("config"); // config | schema | history

  const testConnection = async () => {
    if (!local.url || !local.anonKey) { setTestResult({ ok: false, msg: "Preencha URL e Anon Key." }); return; }
    setTesting(true); setTestResult(null);
    try {
      const client = createSupabaseClient(local.url, local.anonKey);
      await client.ping();
      setTestResult({ ok: true, msg: "Conexão bem-sucedida! Tabelas acessíveis." });
      setDbStatus("ok");
    } catch (e) {
      setTestResult({ ok: false, msg: `Erro: ${e.message}` });
      setDbStatus("error");
    }
    setTesting(false);
  };

  const save = () => {
    const cfg = { ...local, enabled: true };
    setSupabaseConfig(cfg);
    setTestResult({ ok: true, msg: "✓ Configuração salva! Reconectando..." });
    setTimeout(() => window.location.reload(), 1200);
  };

  const disable = () => {
    setSupabaseConfig({ ...local, enabled: false });
    setDbStatus(null);
    setTestResult({ ok: false, msg: "Supabase desabilitado. Usando armazenamento local." });
  };

  const loadHistory = async () => {
    if (!sbConnected || !sb) return;
    setLoadingBriefs(true);
    try {
      const data = await sb.getBriefs(20);
      setBriefs(data || []);
    } catch (e) { console.warn(e); }
    setLoadingBriefs(false);
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const statusInfo = sbConnected
    ? (dbStatus === "ok" ? { cls: "sbs-ok", dot: "var(--gr)", label: "Conectado ao Supabase", shadow: "0 0 6px var(--gr)" }
      : dbStatus === "syncing" ? { cls: "sbs-sync", dot: "var(--am)", label: "Sincronizando...", shadow: "none" }
      : { cls: "sbs-err", dot: "var(--rd)", label: "Erro de conexão", shadow: "none" })
    : { cls: "sbs-off", dot: "var(--tx3)", label: "Supabase não configurado — usando memória local", shadow: "none" };

  const TABS = [["config", "⚙ Configuração"], ["schema", "🗃 SQL Schema"], ["history", "📂 Histórico de Briefs"]];

  return (
    <>
      <div className="ph"><div><div className="pt">BANCO DE DADOS</div><div className="ps">Supabase · Persistência e histórico completo</div></div></div>

      <div className={`sb-status ${statusInfo.cls}`}>
        <div className="sb-dot" style={{ background: statusInfo.dot, boxShadow: statusInfo.shadow }}></div>
        <span>{statusInfo.label}</span>
      </div>

      {/* TABS */}
      <div className="pt2" style={{ marginBottom: 20, width: "fit-content" }}>
        {TABS.map(([id, label]) => (
          <button key={id} className={`pt2-btn ${activeTab === id ? "active" : ""}`} onClick={() => { setActiveTab(id); if (id === "history") loadHistory(); }}>{label}</button>
        ))}
      </div>

      {/* TAB: CONFIG */}
      {activeTab === "config" && (
        <>
          <div className="cs">
            <div className="cst">Credenciais do Supabase</div>
            <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 16, lineHeight: 1.7 }}>
              📍 Encontre estas informações em: <span style={{ color: "var(--ac)" }}>app.supabase.com → Seu Projeto → Settings → API</span><br />
              ⚠️ Use apenas a <strong>anon (public) key</strong>. Nunca cole a service_role key no front-end.
            </div>
            <div className="fg2">
              <label>Project URL</label>
              <input value={local.url || ""} onChange={e => setLocal(l => ({ ...l, url: e.target.value }))} placeholder="https://xxxxxxxxxxxx.supabase.co" />
            </div>
            <div className="fg2">
              <label>Anon Public Key (JWT)</label>
              <input type="password" value={local.anonKey || ""} onChange={e => setLocal(l => ({ ...l, anonKey: e.target.value }))} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button className="bg2" style={{ fontSize: 11 }} onClick={testConnection} disabled={testing}>{testing ? "Testando..." : "▶ Testar Conexão"}</button>
              <button className="bg2" style={{ fontSize: 11, background: "linear-gradient(135deg,var(--gr),#1a7a35)" }} onClick={save} disabled={!local.url || !local.anonKey}>💾 Salvar e Conectar</button>
              {sbConnected && <button className="bs2" onClick={disable}>Desabilitar</button>}
            </div>
            {testResult && (
              <div className={`banner ${testResult.ok ? "banner-ok" : "banner-err"}`}>{testResult.msg}</div>
            )}
          </div>

          <div className="cs">
            <div className="cst">O que é salvo automaticamente</div>
            {[
              ["🌅 Morning Briefs", "Cada brief gerado é salvo com snapshot, bundle de agentes e perfil de risco."],
              ["📊 Portfólio", "Alocações salvas automaticamente 2s após cada ajuste."],
              ["📋 Logs de Auditoria", "Cada ação (geração, login, teste de agente) é registrada com timestamp."],
              ["⚙️ Configurações", "Data Service URL, ativos, horizonte — persistem entre sessões."],
              ["🔄 Snapshots de mercado", "Snapshots salvos para referência histórica."],
            ].map(([title, desc]) => (
              <div className="cr" key={title}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--tx)", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 10, color: "var(--tx3)" }}>{desc}</div>
                </div>
                <span style={{ fontSize: 9, color: "var(--gr)", fontWeight: 700 }}>AUTO</span>
              </div>
            ))}
          </div>

          <div className="cs">
            <div className="cst">Segurança</div>
            <div style={{ fontSize: 11, color: "var(--tx2)", lineHeight: 1.8 }}>
              • A <strong>anon key</strong> é segura para o front-end — acesso controlado por Row Level Security (RLS).<br />
              • Para MVP, você pode desabilitar RLS nas tabelas para uso pessoal/admin.<br />
              • Para multiusuário: habilite RLS e crie políticas por <code style={{ color: "var(--ac)" }}>auth.uid()</code>.<br />
              • <strong>Nunca</strong> cole a <code style={{ color: "var(--rd)" }}>service_role</code> key em código front-end.<br />
              • As credenciais são salvas no <code style={{ color: "var(--ac)" }}>localStorage</code> do navegador — use em dispositivo pessoal.
            </div>
          </div>
        </>
      )}

      {/* TAB: SQL SCHEMA */}
      {activeTab === "schema" && (
        <div className="cs">
          <div className="cst" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>SQL para criar as tabelas</span>
            <button className="copy-btn" onClick={copySql}>{copied ? "✓ Copiado!" : "Copiar SQL"}</button>
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 14, lineHeight: 1.7 }}>
            1. Abra seu projeto em <span style={{ color: "var(--ac)" }}>app.supabase.com</span><br />
            2. Vá em <strong>SQL Editor</strong> → <strong>New Query</strong><br />
            3. Cole o SQL abaixo e clique em <strong>Run</strong>
          </div>
          <div className="sql-block">{SUPABASE_SQL}</div>
        </div>
      )}

      {/* TAB: HISTORY */}
      {activeTab === "history" && (
        <div className="cs">
          <div className="cst" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Histórico de Morning Briefs</span>
            <button className="bg2" style={{ fontSize: 10, padding: "6px 14px" }} onClick={loadHistory} disabled={!sbConnected || loadingBriefs}>{loadingBriefs ? "Carregando..." : "↺ Atualizar"}</button>
          </div>
          {!sbConnected && <div className="banner banner-warn">Conecte o Supabase para ver o histórico.</div>}
          {sbConnected && briefs.length === 0 && !loadingBriefs && (
            <div className="es"><div className="ei3">📂</div><div className="etit">Sem histórico</div><div className="esub">Gere um Morning Brief para começar.</div></div>
          )}
          {briefs.length > 0 && (
            <>
              <table className="hist-table">
                <thead><tr><th>Data</th><th>Perfil</th><th>Modo</th><th>Usuário</th><th>Ação</th></tr></thead>
                <tbody>
                  {briefs.map(b => (
                    <tr key={b.id} onClick={() => setSelectedBrief(selectedBrief?.id === b.id ? null : b)}>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                      <td><span style={{ color: b.risk_profile === "CONSERVADOR" ? "var(--gr)" : b.risk_profile === "SEGURO" ? "var(--am)" : "var(--rd)", fontWeight: 700, fontSize: 10 }}>{b.risk_profile}</span></td>
                      <td style={{ fontSize: 10 }}>{b.pipeline_mode === "daily" ? "⚡ Diário" : "🔬 Deep Dive"}</td>
                      <td style={{ fontSize: 10 }}>{b.username}</td>
                      <td><button className="copy-btn" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(b.brief_json, null, 2)); }}>📋 JSON</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedBrief && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: "var(--ac)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Brief selecionado — {new Date(selectedBrief.created_at).toLocaleString("pt-BR")}</div>
                  <div style={{ background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 7, padding: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "var(--tx2)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>
                    {JSON.stringify(selectedBrief.brief_json, null, 2)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}


function LogsPage({ logs }) {
  return (
    <>
      <div className="ph"><div><div className="pt">LOGS & AUDITORIA</div><div className="ps">{logs.length} registros nesta sessão</div></div></div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden" }}>
        <table className="logt">
          <thead><tr><th>HORÁRIO</th><th>USUÁRIO</th><th>AÇÃO</th><th>STATUS</th><th>NOTAS</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--tx3)" }}>Nenhum log ainda.</td></tr>}
            {logs.map(l => (
              <tr key={l.id}>
                <td>{new Date(l.ts).toLocaleTimeString("pt-BR")}</td>
                <td style={{ color: "var(--ac)" }}>{l.user}</td>
                <td style={{ color: "var(--gold)" }}>{l.action}</td>
                <td style={{ color: l.status === "ok" ? "var(--gr)" : l.status === "warn" ? "var(--am)" : "var(--rd)" }}>{l.status.toUpperCase()}</td>
                <td style={{ fontSize: 9, color: "var(--tx3)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// SETTINGS PAGE
// ============================================================
function SettingsPage({ user }) {
  const [f, setF] = useState({ old: "", nw: "", cf: "" });
  const [msg, setMsg] = useState("");
  const [togs, setTogs] = useState({ log_agentes: true, avisos_legais: true, modo_debug: false, cache_snapshots: true });

  const change = () => {
    if (!f.old || !f.nw || !f.cf) { setMsg("Preencha todos os campos."); return; }
    if (f.nw !== f.cf) { setMsg("As senhas não coincidem."); return; }
    if (f.nw.length < 8) { setMsg("Mínimo 8 caracteres."); return; }
    if (f.old !== "dbsa1981") { setMsg("Senha atual incorreta."); return; }
    setMsg("✓ Senha alterada. (Em produção: armazenada com bcrypt cost=12)");
    setF({ old: "", nw: "", cf: "" });
  };

  return (
    <>
      <div className="ph"><div><div className="pt">CONFIGURAÇÕES</div><div className="ps">Sistema, segurança e preferências</div></div></div>
      <div className="cs">
        <div className="cst">Sistema</div>
        {[["Versão", APP_VERSION], ["Idioma", "pt-BR"], ["Fuso", "America/Sao_Paulo"], ["Usuário", user?.username], ["Role", user?.role?.toUpperCase()]].map(([l, v]) => (
          <div className="cr" key={l}><span className="crl">{l}</span><span className="crv">{v}</span></div>
        ))}
      </div>
      <div className="cs">
        <div className="cst">Preferências</div>
        {Object.entries(togs).map(([k, v]) => (
          <div className="cr" key={k}>
            <span className="crl">{k.replace(/_/g, " ").toUpperCase()}</span>
            <div className={`tog ${v ? "on" : ""}`} onClick={() => setTogs(p => ({ ...p, [k]: !p[k] }))}></div>
          </div>
        ))}
      </div>
      <div className="cs">
        <div className="cst">Segurança — Trocar Senha</div>
        <div style={{ maxWidth: 380 }}>
          {[["Senha atual", "old"], ["Nova senha (mín. 8 chars)", "nw"], ["Confirmar nova senha", "cf"]].map(([l, k]) => (
            <div className="fg2" key={k}><label>{l}</label><input type="password" value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} /></div>
          ))}
          <button className="bg2" onClick={change} style={{ fontSize: 12, padding: "9px 20px" }}>Alterar Senha</button>
          {msg && <div style={{ marginTop: 10, fontSize: 11, color: msg.startsWith("✓") ? "var(--gr)" : "var(--rd)" }}>{msg}</div>}
        </div>
        <div style={{ marginTop: 16, padding: 12, background: "rgba(0,200,240,.04)", borderRadius: 7, fontSize: 9, color: "var(--tx3)", lineHeight: 1.7 }}>
          🔒 Produção: bcrypt (cost 12) ou argon2id · JWT + refresh token · Rate limiting em login · Secret Manager para API keys · HTTPS obrigatório
        </div>
      </div>
    </>
  );
}
