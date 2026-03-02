export type Asset = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';
export type Timeframe = '15m' | '1h' | '4h' | '1d';

export interface DataFreshness {
  source: 'Binance Direct' | 'Data Service';
  ts_server: number;
  price_ts: number;
  age: number; // seconds
  latency: number; // ms
  status: 'OK' | 'PARCIAL' | 'STALE' | 'OFFLINE';
}

export interface TickerData {
  symbol: string;
  last: number;
  chg24h_pct: number;
  vol24h: number;
  high24h: number;
  low24h: number;
  volatility_hint_pct?: number;
  ts: number;
}

export interface CandleData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type AgentId = 
  | 'MARKET_REGIME'
  | 'ORDERFLOW_MICRO'
  | 'PRICE_ACTION'
  | 'TECH_INDICATORS'
  | 'VOLATILITY_RISK'
  | 'SETUP_SCORER'
  | 'ENTRY_PLANNER'
  | 'EXIT_PLANNER'
  | 'EXECUTION_DESK'
  | 'PORTFOLIO_GUARD'
  | 'CIO_ORCHESTRATOR'
  | 'MASTER_STRATEGIST_TRADER';

export interface AgentOutput {
  agent: string;
  asset: string;
  thesis: string[];
  alerts: string[];
  assertions: { claim: string; evidence_fields: string[] }[];
  numbers_used: { field: string; value: number }[];
  data_needed: string[];
  confidence: 'baixa' | 'media' | 'alta';
  disclaimer: string;
  
  // Optional fields for specific agents
  setup_score?: number;
  posture?: 'ESPERAR' | 'BUSCAR_ENTRADA' | 'REDUZIR_RISCO';
  DEEP_ALLOWED?: boolean;
  motivo?: string;
}

export interface FactCheckerOutput {
  agent: 'FACT_CHECKER';
  status: 'validated' | 'partial' | 'failed';
  critical_issues: {
    type: 'unsupported_claim' | 'contradiction' | 'out_of_snapshot' | 'math_error';
    message: string;
    where: string;
  }[];
  missing_data: string[];
  confidence: 'baixa' | 'media' | 'alta';
}

export interface MasterStrategistOutput {
  agent: 'MASTER_STRATEGIST_TRADER';
  asset: string;
  scenario_now: string;
  posture: 'ESPERAR' | 'BUSCAR_ENTRADA' | 'REDUZIR_RISCO';
  entry: {
    entry_price: number | null;
    conditions: string[];
    invalid_if: string[];
  };
  targets: {
    profit_target_pct: number;
    stop_loss_pct: number;
    take_profit_price: number | null;
    stop_price: number | null;
  };
  execution_plan: {
    order_type: 'LIMIT' | 'MARKET' | 'NONE';
    notes: string[];
  };
  conflicts_resolved: string[];
  risks_top3: string[];
  numbers_used: { field: string; value: number }[];
  data_needed: string[];
  confidence: 'baixa' | 'media' | 'alta';
  disclaimer: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'REFRESH' | 'ANALYSIS' | 'SYSTEM' | 'ERROR';
  message: string;
  details?: any;
}
