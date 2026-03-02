import { usePipelineStore } from '../store/usePipelineStore';

export function Outputs() {
  const { outputs, factCheck } = usePipelineStore();
  
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Outputs</h1>
        <p className="text-zinc-500 mt-1">Histórico de análises geradas pelos agentes.</p>
      </header>
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-zinc-200 text-center text-zinc-500">
        <p>Execute uma análise no Trading Desk para ver os outputs detalhados aqui.</p>
      </div>
    </div>
  );
}
