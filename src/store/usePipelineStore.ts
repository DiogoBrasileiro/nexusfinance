import { create } from 'zustand';
import { Asset, AgentId, AgentOutput, FactCheckerOutput, MasterStrategistOutput } from '../types';
import { runAgent, runFactChecker, runMasterStrategist } from '../services/aiService';
import { useDataStore } from './useDataStore';
import { useSettingsStore } from './useSettingsStore';
import { useLogStore } from './useLogStore';
import { saveAnalysisRun, appendAuditLog } from '../services/dataLayer';

interface PipelineState {
  isRunning: boolean;
  currentAgent: AgentId | 'MASTER_STRATEGIST_TRADER' | 'FACT_CHECKER' | null;
  outputs: Record<Asset, AgentOutput[]>;
  masterPlan: Record<Asset, MasterStrategistOutput | null>;
  factCheck: Record<Asset, FactCheckerOutput | null>;
  
  runAnalysis: (asset: Asset, mode: 'SCAN' | 'DEEP') => Promise<void>;
  clearOutputs: (asset: Asset) => void;
}

const SCAN_PIPELINE: AgentId[] = ['MARKET_REGIME', 'PRICE_ACTION', 'SETUP_SCORER', 'CIO_ORCHESTRATOR'];
const DEEP_PIPELINE: AgentId[] = [
  'MARKET_REGIME', 'ORDERFLOW_MICRO', 'PRICE_ACTION', 'TECH_INDICATORS',
  'VOLATILITY_RISK', 'SETUP_SCORER', 'ENTRY_PLANNER', 'EXIT_PLANNER',
  'EXECUTION_DESK', 'PORTFOLIO_GUARD', 'CIO_ORCHESTRATOR'
];

export const usePipelineStore = create<PipelineState>((set, get) => ({
  isRunning: false,
  currentAgent: null,
  outputs: { BTCUSDT: [], ETHUSDT: [], SOLUSDT: [] },
  masterPlan: { BTCUSDT: null, ETHUSDT: null, SOLUSDT: null },
  factCheck: { BTCUSDT: null, ETHUSDT: null, SOLUSDT: null },

  runAnalysis: async (asset, mode) => {
    const { tickers, candles, freshness } = useDataStore.getState();
    const assetFreshness = freshness[asset];

    // A1) Freshness Gate
    if (!assetFreshness || assetFreshness.status === 'STALE' || assetFreshness.status === 'OFFLINE' || assetFreshness.age > 15) {
      useLogStore.getState().addLog('ERROR', `Análise bloqueada para ${asset}: Dados desatualizados ou offline.`);
      return;
    }

    // A2) Volatility Gate & A3) Lateralização Gate
    const assetCandles1m = candles[asset]['15m']; // fallback to 15m as we don't have 1m in current setup
    const assetCandles1h = candles[asset]['1h'];
    
    let range_pct_avg_1m = 0;
    let high_volatility = false;
    if (assetCandles1m && assetCandles1m.length >= 30) {
      const last30 = assetCandles1m.slice(-30);
      const sumRange = last30.reduce((sum, c) => sum + ((c.high - c.low) / c.open) * 100, 0);
      range_pct_avg_1m = sumRange / 30;
      if (range_pct_avg_1m > 1.2) high_volatility = true;
    }

    let range_market = false;
    if (assetCandles1h && assetCandles1h.length >= 50) {
      const last50 = assetCandles1h.slice(-50);
      const maxHigh = Math.max(...last50.map(c => c.high));
      const minLow = Math.min(...last50.map(c => c.low));
      const lastClose = last50[last50.length - 1].close;
      const amplitude = ((maxHigh - minLow) / lastClose) * 100;
      if (amplitude < 1.0) range_market = true;
    }

    // B) MINI-SNAPSHOT
    const snapshot_full = {
      ticker: tickers[asset],
      candles: candles[asset],
      params: useSettingsStore.getState()
    };

    const mini_snapshot = {
      ts_server: assetFreshness.ts_server,
      asset,
      freshness: assetFreshness,
      price: {
        last: tickers[asset]?.last || 0,
        chg24h_pct: tickers[asset]?.chg24h_pct || 0,
        vol24h: tickers[asset]?.vol24h || 0,
        high24h: tickers[asset]?.high24h || 0,
        low24h: tickers[asset]?.low24h || 0,
        volatility_hint_pct: tickers[asset]?.volatility_hint_pct || 0
      },
      tfs: ['15m', '1h', '4h', '1d'],
      ohlcv_tail: {
        '15m': candles[asset]['15m']?.slice(-20) || [],
        '1h': candles[asset]['1h']?.slice(-20) || [],
        '4h': candles[asset]['4h']?.slice(-20) || [],
        '1d': candles[asset]['1d']?.slice(-20) || []
      },
      derived: {
        range_pct_avg_1m,
        range_market,
        high_volatility
      }
    };

    const pipeline = mode === 'SCAN' ? SCAN_PIPELINE : DEEP_PIPELINE;
    
    set({ isRunning: true, currentAgent: pipeline[0] });
    
    let currentOutputs: AgentOutput[] = [];
    let previousSummaries = '';

    try {
      for (const agentId of pipeline) {
        set({ currentAgent: agentId });
        
        const snapshotToUse = agentId === 'PRICE_ACTION' ? snapshot_full : mini_snapshot;
        const output = await runAgent(agentId, asset, snapshotToUse, previousSummaries);
        currentOutputs.push(output);
        
        // Update summaries for next agent (keep it short)
        previousSummaries += `[${agentId}]: ${output.thesis.join(' ')}\n`;
        if (previousSummaries.length > 1000) {
          previousSummaries = previousSummaries.substring(previousSummaries.length - 1000);
        }
        
        set((state) => ({
          outputs: { ...state.outputs, [asset]: currentOutputs }
        }));
      }

      let masterPlanResult: MasterStrategistOutput | null = null;
      if (mode === 'DEEP') {
        set({ currentAgent: 'MASTER_STRATEGIST_TRADER' });
        masterPlanResult = await runMasterStrategist(asset, mini_snapshot, currentOutputs);
        
        set((state) => ({
          masterPlan: { ...state.masterPlan, [asset]: masterPlanResult }
        }));
      }

      set({ currentAgent: 'FACT_CHECKER' });
      const factCheckInputs = mode === 'DEEP' ? [...currentOutputs, masterPlanResult as any] : currentOutputs;
      let factCheckResult = await runFactChecker(asset, mini_snapshot, factCheckInputs);
      
      // E) AUTO-REVIEW
      if (mode === 'DEEP' && factCheckResult.status === 'failed') {
        useLogStore.getState().addLog('SYSTEM', `FACT_CHECKER falhou para ${asset}. Iniciando auto-revisão do MASTER_STRATEGIST_TRADER...`);
        set({ currentAgent: 'MASTER_STRATEGIST_TRADER' });
        
        // Re-run Master Strategist with fact checker issues
        const reviewContext = `CORRIJA OS SEGUINTES ERROS APONTADOS PELO FACT_CHECKER:\n${JSON.stringify(factCheckResult.critical_issues)}`;
        masterPlanResult = await runMasterStrategist(asset, mini_snapshot, currentOutputs, reviewContext);
        
        set((state) => ({
          masterPlan: { ...state.masterPlan, [asset]: masterPlanResult }
        }));

        set({ currentAgent: 'FACT_CHECKER' });
        factCheckResult = await runFactChecker(asset, mini_snapshot, [...currentOutputs, masterPlanResult as any]);
        
        if (factCheckResult.status === 'failed') {
          useLogStore.getState().addLog('ERROR', `Auto-revisão falhou para ${asset}. Resultado marcado como parcial.`);
          factCheckResult.status = 'partial'; // Block execution or mark as partial
        } else {
          useLogStore.getState().addLog('SYSTEM', `Auto-revisão bem-sucedida para ${asset}.`);
        }
      }

      set((state) => ({
        factCheck: { ...state.factCheck, [asset]: factCheckResult }
      }));

      useLogStore.getState().addLog(
        'ANALYSIS', 
        `Análise ${mode} concluída para ${asset}`, 
        { agents: pipeline.length, factCheckStatus: factCheckResult.status }
      );

      // Save to Supabase
      const runData = {
        asset,
        snapshot: mini_snapshot,
        agent_outputs: currentOutputs,
        strategist_output: masterPlanResult,
        fact_checker: factCheckResult,
        data_freshness: assetFreshness
      };
      
      saveAnalysisRun(runData).then(success => {
        if (success) {
          appendAuditLog('ANALYSIS_SYNC', 'SUCCESS', { asset });
        } else {
          appendAuditLog('ANALYSIS_SYNC', 'FAILED', { asset });
        }
      });

    } catch (error: any) {
      useLogStore.getState().addLog('ERROR', `Falha no pipeline para ${asset}: ${error.message}`);
      appendAuditLog('ANALYSIS_RUN', 'FAILED', { asset, error: error.message });
    } finally {
      set({ isRunning: false, currentAgent: null });
    }
  },

  clearOutputs: (asset) => set((state) => ({
    outputs: { ...state.outputs, [asset]: [] },
    masterPlan: { ...state.masterPlan, [asset]: null },
    factCheck: { ...state.factCheck, [asset]: null }
  }))
}));
