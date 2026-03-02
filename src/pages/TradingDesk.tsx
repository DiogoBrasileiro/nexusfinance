import { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePipelineStore } from '../store/usePipelineStore';
import { Asset, Timeframe } from '../types';
import { DataFreshnessHUD } from '../components/DataFreshnessHUD';
import { Play, Settings, ShieldCheck, AlertCircle, RefreshCw, Activity, Bot } from 'lucide-react';
import clsx from 'clsx';

export function TradingDesk() {
  const [asset, setAsset] = useState<Asset>('BTCUSDT');
  const { tickers, freshness, candles, refreshTicker } = useDataStore();
  const { 
    targetPct, stopPct, capital, riskProfile, timeframes,
    setTargetPct, setStopPct, setCapital, setRiskProfile, toggleTimeframe
  } = useSettingsStore();
  const [pipelineMode, setPipelineMode] = useState<'SCAN' | 'DEEP'>('SCAN');
  const [expandedAgents, setExpandedAgents] = useState<Record<number, boolean>>({});
  const { runAnalysis, isRunning, outputs, masterPlan, factCheck } = usePipelineStore();

  const toggleAgent = (idx: number) => {
    setExpandedAgents(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const ticker = tickers[asset];
  const fresh = freshness[asset];
  const currentCandles1m = candles[asset]['15m']; // fallback to 15m
  const currentCandles1h = candles[asset]['1h'];
  const currentOutputs = outputs[asset] || [];
  const currentMasterPlan = masterPlan[asset];
  const currentFactCheck = factCheck[asset];

  const isStaleOrOffline = !fresh || fresh.status === 'STALE' || fresh.status === 'OFFLINE' || fresh.age > 15;

  let range_pct_avg_1m = 0;
  let high_volatility = false;
  if (currentCandles1m && currentCandles1m.length >= 30) {
    const last30 = currentCandles1m.slice(-30);
    const sumRange = last30.reduce((sum, c) => sum + ((c.high - c.low) / c.open) * 100, 0);
    range_pct_avg_1m = sumRange / 30;
    if (range_pct_avg_1m > 1.2) high_volatility = true;
  }

  let range_market = false;
  if (currentCandles1h && currentCandles1h.length >= 50) {
    const last50 = currentCandles1h.slice(-50);
    const maxHigh = Math.max(...last50.map(c => c.high));
    const minLow = Math.min(...last50.map(c => c.low));
    const lastClose = last50[last50.length - 1].close;
    const amplitude = ((maxHigh - minLow) / lastClose) * 100;
    if (amplitude < 1.0) range_market = true;
  }

  const scanOutput = currentOutputs.find(o => o.agent === 'CIO_ORCHESTRATOR');
  const setupScore = scanOutput?.setup_score || 0;
  const deepAllowed = scanOutput?.DEEP_ALLOWED || false;
  const posture = scanOutput?.posture || 'ESPERAR';

  const entryReference = ticker?.last || 0;
  const targetPrice = entryReference * (1 + targetPct / 100);
  const stopPrice = entryReference * (1 - stopPct / 100);

  const handleRunAnalysis = (mode: 'SCAN' | 'DEEP') => {
    if (isStaleOrOffline) return;
    runAnalysis(asset, mode);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-main)]">Trading Desk</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Análise fatiada com 11 agentes e validação anti-alucinação.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={asset} 
            onChange={(e) => setAsset(e.target.value as Asset)}
            className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text-main)] text-sm rounded-full focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] block px-4 py-2 font-mono font-bold shadow-sm outline-none transition-all"
          >
            <option value="BTCUSDT">BTCUSDT</option>
            <option value="ETHUSDT">ETHUSDT</option>
            <option value="SOLUSDT">SOLUSDT</option>
          </select>
          
          <button 
            onClick={() => refreshTicker(asset)}
            className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-full hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Live Data & Params */}
        <div className="space-y-6">
          <section className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] border border-[var(--color-border-subtle)]">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-text-main)]">
                <Activity size={20} className="text-[var(--color-primary)] drop-shadow-[0_0_8px_var(--color-primary-glow)]" />
                Mercado ao Vivo
              </h2>
            </div>
            
            {ticker ? (
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-5xl font-mono font-bold tracking-tighter text-[var(--color-text-main)]">
                    ${ticker.last.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={clsx(
                    "text-xl font-medium px-2 py-1 rounded-md",
                    ticker.chg24h_pct >= 0 ? "text-[var(--color-primary)] bg-[var(--color-primary-glow)]" : "text-[var(--color-error)] bg-red-500/10"
                  )}>
                    {ticker.chg24h_pct >= 0 ? '+' : ''}{ticker.chg24h_pct.toFixed(2)}%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mt-6">
                  <div className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] block mb-1 text-xs uppercase tracking-wider font-semibold">High 24h</span>
                    <span className="font-mono font-medium text-[var(--color-text-main)] text-lg">${ticker.high24h.toLocaleString()}</span>
                  </div>
                  <div className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] block mb-1 text-xs uppercase tracking-wider font-semibold">Low 24h</span>
                    <span className="font-mono font-medium text-[var(--color-text-main)] text-lg">${ticker.low24h.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-[var(--color-text-muted)]">Carregando dados...</div>
            )}
            
            <div className="mt-6">
              <DataFreshnessHUD freshness={fresh} />
            </div>
          </section>

          <section className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] border border-[var(--color-border-subtle)]">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-[var(--color-text-main)]">
              <Settings size={20} className="text-[var(--color-text-muted)]" />
              Parâmetros da Operação
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Alvo de Lucro (%)</label>
                  <input 
                    type="number" 
                    value={targetPct} 
                    onChange={(e) => setTargetPct(Number(e.target.value))}
                    className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-2.5 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Stop Loss (%)</label>
                  <input 
                    type="number" 
                    value={stopPct} 
                    onChange={(e) => setStopPct(Number(e.target.value))}
                    className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-2.5 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Perfil de Risco</label>
                <select 
                  value={riskProfile} 
                  onChange={(e) => setRiskProfile(e.target.value as any)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-2.5 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
                >
                  <option value="conservador">Conservador</option>
                  <option value="moderado">Moderado</option>
                  <option value="agressivo">Agressivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Modo do Pipeline</label>
                <div className="flex bg-[var(--color-surface-elevated)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
                  <button 
                    onClick={() => setPipelineMode('SCAN')}
                    className={clsx(
                      "flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200",
                      pipelineMode === 'SCAN' ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary-glow)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                    )}
                  >
                    SCAN (Rápido)
                  </button>
                  <button 
                    onClick={() => setPipelineMode('DEEP')}
                    disabled={!deepAllowed}
                    className={clsx(
                      "flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200",
                      pipelineMode === 'DEEP' ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary-glow)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]",
                      !deepAllowed && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    DEEP (Profundo)
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-[var(--color-border-subtle)] space-y-4">
              <h3 className="text-sm font-medium text-[var(--color-text-main)] mb-3">Status do Mercado (Gating)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className={clsx(
                  "p-3 rounded-lg border",
                  high_volatility ? "bg-[var(--color-alert)]/10 border-[var(--color-alert)]/30 text-[var(--color-alert)]" : "bg-[var(--color-surface-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                )}>
                  <span className="block text-xs font-bold uppercase mb-1">Volatilidade</span>
                  <span className="text-sm">{high_volatility ? 'ALTA' : 'NORMAL'}</span>
                  <span className="block text-xs opacity-70 mt-1">Avg 1m: {range_pct_avg_1m.toFixed(2)}%</span>
                </div>
                
                <div className={clsx(
                  "p-3 rounded-lg border",
                  range_market ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-[var(--color-surface-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                )}>
                  <span className="block text-xs font-bold uppercase mb-1">Tendência</span>
                  <span className="text-sm">{range_market ? 'LATERAL' : 'DIRECIONAL'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
              <h3 className="text-sm font-medium text-[var(--color-text-main)] mb-3">Alvos Calculados (Educacional)</h3>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between items-center bg-[var(--color-surface-elevated)] p-2 rounded">
                  <span className="text-[var(--color-text-muted)]">Entrada Ref.</span>
                  <span className="font-medium text-[var(--color-text-main)]">${entryReference.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center bg-[var(--color-primary-glow)] p-2 rounded border border-[var(--color-primary)]/20">
                  <span className="text-[var(--color-primary)]">Alvo (+{targetPct}%)</span>
                  <span className="font-medium text-[var(--color-primary)] drop-shadow-[0_0_4px_var(--color-primary-glow)]">${targetPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center bg-[var(--color-error)]/10 p-2 rounded border border-[var(--color-error)]/20">
                  <span className="text-[var(--color-error)]">Stop (-{stopPct}%)</span>
                  <span className="font-medium text-[var(--color-error)]">${stopPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ESTRATÉGIA INDICADA */}
          {(currentMasterPlan || currentFactCheck) && (
            <section id="estrategia-indicada" className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-glow)] border border-[var(--color-primary)]/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]"></div>
              
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight drop-shadow-[0_0_8px_var(--color-primary-glow)]">ESTRATÉGIA INDICADA</h2>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium mt-1">Resumo educacional baseado no pipeline</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <span className={clsx(
                  "text-xs font-bold px-3 py-1.5 rounded-[var(--radius-chip)] border",
                  currentMasterPlan?.posture === 'BUSCAR_ENTRADA' ? "bg-[var(--color-primary-glow)] border-[var(--color-primary)]/30 text-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary-glow)]" :
                  currentMasterPlan?.posture === 'REDUZIR_RISCO' ? "bg-[var(--color-alert)]/10 border-[var(--color-alert)]/30 text-[var(--color-alert)]" :
                  "bg-[var(--color-surface-elevated)] border-[var(--color-border-strong)] text-[var(--color-text-secondary)]"
                )}>
                  POSTURA: {currentMasterPlan?.posture || 'ESPERAR'}
                </span>
                <span className={clsx(
                  "text-xs font-bold px-3 py-1.5 rounded-[var(--radius-chip)] border",
                  currentMasterPlan?.confidence === 'alta' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                  currentMasterPlan?.confidence === 'média' ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" :
                  "bg-[var(--color-surface-elevated)] border-[var(--color-border-strong)] text-[var(--color-text-secondary)]"
                )}>
                  CONFIANÇA: {currentMasterPlan?.confidence?.toUpperCase() || 'N/A'}
                </span>
                <span className={clsx(
                  "text-xs font-bold px-3 py-1.5 rounded-[var(--radius-chip)] border flex items-center gap-1",
                  fresh?.status === 'OK' ? "bg-[var(--color-primary-glow)] border-[var(--color-primary)]/30 text-[var(--color-primary)]" :
                  fresh?.status === 'PARCIAL' ? "bg-[var(--color-alert)]/10 border-[var(--color-alert)]/30 text-[var(--color-alert)]" :
                  "bg-[var(--color-error)]/10 border-[var(--color-error)]/30 text-[var(--color-error)]"
                )}>
                  DADOS: {fresh?.status || 'N/A'} {fresh ? `(${fresh.age}s)` : ''}
                </span>
              </div>

              {/* Big Numbers */}
              <div className="flex flex-col gap-3 mb-6">
                <div className="bg-[var(--color-surface-elevated)] px-4 py-3 rounded-xl border border-[var(--color-border-subtle)] flex items-center justify-between relative overflow-hidden shadow-sm">
                  <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Entrada</span>
                  <span className="text-xl font-mono font-bold text-white tracking-tight">
                    {currentMasterPlan?.posture === 'ESPERAR' || !currentMasterPlan?.entry.entry_price ? '—' : `$${currentMasterPlan.entry.entry_price.toLocaleString()}`}
                  </span>
                </div>
                
                <div className="bg-[var(--color-primary)]/10 px-4 py-3 rounded-xl border border-[var(--color-primary)]/30 flex items-center justify-between relative overflow-hidden shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.1)]">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/5 to-transparent pointer-events-none"></div>
                  <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider relative z-10">
                    Alvo <span className="opacity-70 ml-1">(+{currentMasterPlan?.targets.profit_target_pct || targetPct}%)</span>
                  </span>
                  <span className="text-xl font-mono font-bold text-white drop-shadow-[0_0_8px_var(--color-primary-glow)] relative z-10 tracking-tight">
                    {currentMasterPlan?.posture === 'ESPERAR' || !currentMasterPlan?.targets.take_profit_price ? '—' : `$${currentMasterPlan.targets.take_profit_price.toLocaleString()}`}
                  </span>
                </div>
                
                <div className="bg-[var(--color-error)]/10 px-4 py-3 rounded-xl border border-[var(--color-error)]/30 flex items-center justify-between relative overflow-hidden shadow-sm">
                  <span className="text-xs font-bold text-[var(--color-error)] uppercase tracking-wider">
                    Stop <span className="opacity-70 ml-1">(-{currentMasterPlan?.targets.stop_loss_pct || stopPct}%)</span>
                  </span>
                  <span className="text-xl font-mono font-bold text-white tracking-tight">
                    {currentMasterPlan?.posture === 'ESPERAR' || !currentMasterPlan?.targets.stop_price ? '—' : `$${currentMasterPlan.targets.stop_price.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {(currentMasterPlan?.posture === 'ESPERAR' || !currentMasterPlan?.entry.entry_price) && (
                <div className="text-center p-4 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-secondary)] mb-6 border border-[var(--color-border-subtle)]">
                  Sem gatilho confirmado. Aguardar condições.
                </div>
              )}

              {/* Checklist */}
              {currentMasterPlan && (
                <div className="space-y-5 mb-6">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text-main)] mb-3 uppercase flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                      Para considerar entrada
                    </h4>
                    <ul className="text-sm text-[var(--color-text-secondary)] space-y-2 pl-5 border-l border-[var(--color-border-strong)]">
                      {currentMasterPlan.entry.conditions.slice(0, 3).map((c, i) => <li key={i} className="relative before:content-[''] before:absolute before:-left-[21px] before:top-2.5 before:w-3 before:h-[1px] before:bg-[var(--color-border-strong)]">{c}</li>)}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text-main)] mb-3 uppercase flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary-glow)]"></div>
                      Para sair/proteger
                    </h4>
                    <ul className="text-sm text-[var(--color-text-secondary)] space-y-2 pl-5 border-l border-[var(--color-border-strong)]">
                      {currentMasterPlan.execution_plan.notes.slice(0, 2).map((c, i) => <li key={i} className="relative before:content-[''] before:absolute before:-left-[21px] before:top-2.5 before:w-3 before:h-[1px] before:bg-[var(--color-border-strong)]">{c}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text-main)] mb-3 uppercase flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-error)] shadow-[0_0_8px_rgba(255,90,106,0.5)]"></div>
                      Invalidação
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)] pl-5 border-l border-[var(--color-border-strong)] relative before:content-[''] before:absolute before:-left-[21px] before:top-2.5 before:w-3 before:h-[1px] before:bg-[var(--color-border-strong)]">
                      {currentMasterPlan.entry.invalid_if}
                    </p>
                  </div>
                </div>
              )}

              {/* Riscos Top 3 */}
              {currentMasterPlan && currentMasterPlan.risks_top3.length > 0 && (
                <div className="mb-6 bg-[var(--color-alert)]/10 p-4 rounded-xl border border-[var(--color-alert)]/30">
                  <h4 className="text-xs font-bold text-[var(--color-alert)] mb-2 uppercase tracking-wider">Riscos Top 3</h4>
                  <ul className="text-sm text-[var(--color-alert)]/80 space-y-1.5 list-disc list-inside">
                    {currentMasterPlan.risks_top3.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {/* Detalhes Técnicos (Collapsible) */}
              {currentMasterPlan && (
                <details className="mb-6 group">
                  <summary className="text-xs font-bold text-[var(--color-text-muted)] cursor-pointer uppercase tracking-wider hover:text-[var(--color-text-main)] transition-colors list-none flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform text-[var(--color-primary)]">▶</span> Detalhes Técnicos
                  </summary>
                  <div className="mt-4 p-4 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {currentMasterPlan.scenario_now}
                  </div>
                </details>
              )}

              {/* Fact Checker Badge */}
              {currentFactCheck && (
                <div className={clsx(
                  "p-4 rounded-xl border flex flex-col gap-3",
                  currentFactCheck.status === 'validated' ? "bg-[var(--color-primary-glow)] border-[var(--color-primary)]/30" :
                  currentFactCheck.status === 'partial' ? "bg-[var(--color-alert)]/10 border-[var(--color-alert)]/30" :
                  "bg-[var(--color-error)]/10 border-[var(--color-error)]/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {currentFactCheck.status === 'validated' ? (
                        <ShieldCheck className="text-[var(--color-primary)] drop-shadow-[0_0_8px_var(--color-primary-glow)]" size={20} />
                      ) : (
                        <AlertCircle className={currentFactCheck.status === 'partial' ? "text-[var(--color-alert)]" : "text-[var(--color-error)]"} size={20} />
                      )}
                      <h3 className={clsx(
                        "font-bold text-sm tracking-wider",
                        currentFactCheck.status === 'validated' ? "text-[var(--color-primary)]" :
                        currentFactCheck.status === 'partial' ? "text-[var(--color-alert)]" :
                        "text-[var(--color-error)]"
                      )}>
                        FACT CHECKER: {currentFactCheck.status.toUpperCase()}
                      </h3>
                    </div>
                    {currentFactCheck.status !== 'validated' && (
                      <button 
                        onClick={() => handleRunAnalysis('DEEP')}
                        className="text-xs font-bold px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-button)] shadow-sm hover:bg-[var(--color-surface)] text-[var(--color-text-main)] transition-colors"
                      >
                        Revisar Automaticamente
                      </button>
                    )}
                  </div>
                  
                  {currentFactCheck.critical_issues.length > 0 && (
                    <div className="mt-3 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-error)]/30 overflow-hidden shadow-sm">
                      <div className="bg-[var(--color-error)]/10 px-3 py-2 border-b border-[var(--color-error)]/20 flex items-center gap-2">
                        <AlertCircle size={14} className="text-[var(--color-error)]" />
                        <span className="text-xs font-bold text-[var(--color-error)] uppercase tracking-wider">Problemas Críticos Detectados</span>
                      </div>
                      <div className="p-3 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {currentFactCheck.critical_issues.map((issue, i) => (
                          <div key={i} className="flex flex-col gap-1.5 bg-[var(--color-surface)] p-3 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-error)]/30 transition-colors">
                            <span className="inline-flex self-start items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/20 uppercase tracking-wide">
                              {issue.type}
                            </span>
                            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed font-mono break-words">
                              {issue.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Pipeline & Output */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-soft)] border border-[var(--color-border-subtle)] flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-[var(--color-text-main)]">Análise & Pipeline</h2>
                <div className="hidden md:flex bg-[var(--color-surface-elevated)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
                  <button 
                    onClick={() => document.getElementById('estrategia-indicada')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                  >
                    Ver Resumo
                  </button>
                  <button 
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary-glow)] text-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary-glow)] rounded-md transition-colors"
                  >
                    Ver Detalhes (Agentes)
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRunAnalysis('SCAN')}
                  disabled={isRunning || isStaleOrOffline}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-[var(--radius-button)] font-medium transition-all text-sm",
                    isRunning 
                      ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] cursor-not-allowed" 
                      : isStaleOrOffline
                        ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] cursor-not-allowed"
                        : "bg-[var(--color-surface-elevated)] hover:bg-[var(--color-primary-glow)] text-[var(--color-text-main)] hover:text-[var(--color-primary)] border border-[var(--color-border-strong)] hover:border-[var(--color-primary)]/50 shadow-sm"
                  )}
                >
                  {isRunning && pipelineMode === 'SCAN' ? (
                    <RefreshCw size={16} className="animate-spin text-[var(--color-primary)]" />
                  ) : (
                    <Play size={16} />
                  )}
                  Rodar SCAN
                </button>
                
                {deepAllowed && (
                  <button
                    onClick={() => handleRunAnalysis('DEEP')}
                    disabled={isRunning || isStaleOrOffline}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-[var(--radius-button)] font-medium transition-all text-sm",
                      isRunning 
                        ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] cursor-not-allowed" 
                        : isStaleOrOffline
                          ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] cursor-not-allowed"
                          : "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:opacity-90 text-zinc-950 shadow-[0_0_15px_var(--color-primary-glow)]"
                    )}
                  >
                    {isRunning && pipelineMode === 'DEEP' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    Rodar DEEP
                  </button>
                )}
              </div>
            </div>

            {isStaleOrOffline && (
              <div className="mb-6 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-xl flex gap-3 text-[var(--color-error)]">
                <AlertCircle className="shrink-0" />
                <p className="text-sm">
                  <strong className="tracking-wider uppercase">Análise Bloqueada:</strong> Os dados do mercado estão desatualizados (STALE) ou offline. 
                  Verifique sua conexão ou o Data Service antes de rodar a IA.
                </p>
              </div>
            )}

            {!isRunning && currentOutputs.length === 0 && !isStaleOrOffline && (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] py-12">
                <Bot size={48} className="mb-4 opacity-20" />
                <p>Clique em "Rodar SCAN" para iniciar o Agentic Workflow.</p>
              </div>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              {pipelineMode === 'SCAN' && scanOutput && (
                <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] p-5 rounded-xl mb-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)] tracking-wider uppercase text-sm">Resumo SCAN (CIO)</h3>
                    <div className="flex gap-3">
                      <span className={clsx(
                        "text-xs font-bold px-2 py-1 rounded-[var(--radius-chip)]",
                        posture === 'BUSCAR_ENTRADA' ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)]" :
                        posture === 'REDUZIR_RISCO' ? "bg-[var(--color-alert)]/10 text-[var(--color-alert)]" :
                        "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
                      )}>
                        {posture}
                      </span>
                      <span className={clsx(
                        "text-xs font-bold px-2 py-1 rounded-[var(--radius-chip)]",
                        setupScore >= 70 ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)]" :
                        setupScore >= 50 ? "bg-[var(--color-alert)]/10 text-[var(--color-alert)]" :
                        "bg-[var(--color-error)]/10 text-[var(--color-error)]"
                      )}>
                        Score: {setupScore}/100
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">{scanOutput.thesis.join(' ')}</p>
                  <div className={clsx(
                    "p-3 rounded-lg text-sm font-medium border",
                    deepAllowed ? "bg-[var(--color-primary-glow)] border-[var(--color-primary)]/30 text-[var(--color-primary)]" : "bg-[var(--color-error)]/10 border-[var(--color-error)]/30 text-[var(--color-error)]"
                  )}>
                    {deepAllowed ? "✅ Análise DEEP permitida." : `❌ Análise DEEP bloqueada: ${scanOutput.motivo || 'Score baixo ou mercado desfavorável.'}`}
                  </div>
                </div>
              )}

              {currentOutputs.filter(out => out.agent !== 'MASTER_STRATEGIST_TRADER').map((out, idx) => {
                const isExpanded = expandedAgents[idx] || false;
                const hasMoreThesis = out.thesis.length > 2;
                const displayThesis = isExpanded ? out.thesis : out.thesis.slice(0, 2);

                return (
                  <div key={idx} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] p-4 rounded-xl hover:border-[var(--color-border-strong)] transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold tracking-wider text-[var(--color-primary)] bg-[var(--color-primary-glow)] px-2 py-1 rounded-[var(--radius-chip)] border border-[var(--color-primary)]/20">
                        {out.agent}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">Confiança: {out.confidence}</span>
                    </div>
                    <ul className="list-disc list-inside text-sm text-[var(--color-text-secondary)] space-y-1.5 mb-3">
                      {displayThesis.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                    
                    {hasMoreThesis && (
                      <button 
                        onClick={() => toggleAgent(idx)}
                        className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] mb-3 transition-colors"
                      >
                        {isExpanded ? 'Mostrar menos' : `Expandir (+${out.thesis.length - 2} itens)`}
                      </button>
                    )}
                    
                    {isExpanded && out.assertions && out.assertions.length > 0 && (
                      <div className="mb-3 bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">Asserções Validadas:</h4>
                        <ul className="list-disc list-inside text-xs text-[var(--color-text-secondary)] space-y-1">
                          {out.assertions.map((a, i) => (
                            <li key={i}>
                              <span className="font-medium text-[var(--color-text-main)]">{a.claim}</span>
                              <span className="text-[var(--color-text-muted)] ml-1">({a.evidence_fields.join(', ')})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {out.alerts.length > 0 && (
                      <div className="text-xs text-[var(--color-alert)] bg-[var(--color-alert)]/10 p-3 rounded-lg border border-[var(--color-alert)]/30 mt-2">
                        <strong className="uppercase tracking-wider">Alertas:</strong> {out.alerts.join(' | ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {(currentOutputs.length > 0 || currentFactCheck) && (
              <p className="text-xs text-[var(--color-text-muted)] text-center mt-6 font-mono">
                Conteúdo estritamente educacional. Não é recomendação de investimento.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
