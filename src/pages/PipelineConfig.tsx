import { useSettingsStore } from '../store/useSettingsStore';

export function PipelineConfig() {
  const { pipelineMode, setPipelineMode } = useSettingsStore();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Pipeline & IA</h1>
        <p className="text-zinc-500 mt-1">Configurações do Agentic Workflow e validação.</p>
      </header>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-zinc-200 max-w-2xl">
        <h3 className="font-bold text-zinc-900 mb-4">Modo de Execução Padrão</h3>
        
        <div className="space-y-4">
          <label className="flex items-start gap-4 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-50">
            <input 
              type="radio" 
              name="pipeline" 
              value="rapido" 
              checked={pipelineMode === 'rapido'}
              onChange={() => setPipelineMode('rapido')}
              className="mt-1 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="font-bold text-zinc-900">Pipeline Rápido (5 Agentes)</div>
              <p className="text-sm text-zinc-500 mt-1">MARKET_REGIME → PRICE_ACTION → VOLATILITY_RISK → CIO_ORCHESTRATOR → FACT_CHECKER</p>
            </div>
          </label>

          <label className="flex items-start gap-4 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-50">
            <input 
              type="radio" 
              name="pipeline" 
              value="completo" 
              checked={pipelineMode === 'completo'}
              onChange={() => setPipelineMode('completo')}
              className="mt-1 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="font-bold text-zinc-900">Pipeline Completo (11 Agentes)</div>
              <p className="text-sm text-zinc-500 mt-1">Todos os agentes em sequência + FACT_CHECKER no final.</p>
            </div>
          </label>
        </div>
        
        <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800">
          <strong>FACT_CHECKER Obrigatório:</strong> O validador anti-alucinação será executado no final de qualquer pipeline para garantir a integridade dos dados.
        </div>
      </div>
    </div>
  );
}
