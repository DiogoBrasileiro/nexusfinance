import { Bot } from 'lucide-react';

const AGENTS = [
  'MARKET_REGIME', 'ORDERFLOW_MICRO', 'PRICE_ACTION', 'TECH_INDICATORS',
  'VOLATILITY_RISK', 'SETUP_SCORER', 'ENTRY_PLANNER', 'EXIT_PLANNER',
  'EXECUTION_DESK', 'PORTFOLIO_GUARD', 'CIO_ORCHESTRATOR', 'MASTER_STRATEGIST_TRADER'
];

export function Agents() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Agentes Especialistas</h1>
        <p className="text-zinc-500 mt-1">Equipe de 12 agentes de IA focados em cripto (Gemini Flash).</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map(agent => (
          <div key={agent} className="bg-white rounded-xl p-6 shadow-sm border border-zinc-200 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm">{agent}</h3>
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">ONLINE</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
