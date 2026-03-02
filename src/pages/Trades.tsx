import { useEffect, useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { useBinanceStore } from '../store/useBinanceStore';
import { format } from 'date-fns';
import { FileText, Link, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export function Trades() {
  const { plans, fetchPlans, createPlan } = useTradeStore();
  const { isConnected, accountId } = useBinanceStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreatePlan = async () => {
    if (!accountId) return;
    setLoading(true);
    await createPlan({
      symbol: 'BTCUSDT',
      entry_target_price: 60000,
      exit_target_price: 65000,
      stop_price: 58000,
      invest_usdt: 1000,
      notes: 'Plano de teste',
      account_id: accountId
    });
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Operações</h1>
          <p className="text-zinc-500 mt-1">Gerencie seus Planos de Trade e acompanhe o status das ordens.</p>
        </div>
        
        <button 
          onClick={handleCreatePlan}
          disabled={!isConnected || loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Criando...' : 'Novo Plano de Trade'}
        </button>
      </header>

      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4 text-amber-800">
          <AlertCircle className="shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold mb-1">Conexão Binance Necessária</h3>
            <p className="text-sm">Para criar e acompanhar Planos de Trade, você precisa conectar sua conta da Binance. Acesse a página "Conexão Binance" no menu lateral.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3">Ativo</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Alvos (Entrada / Saída)</th>
                <th className="px-6 py-3">Investimento (USDT)</th>
                <th className="px-6 py-3">Ordens Vinculadas</th>
                <th className="px-6 py-3">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {plans.map(plan => (
                <tr key={plan.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-4 font-bold text-zinc-900">
                    {plan.symbol}
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-2 py-1 rounded text-xs font-bold",
                      plan.status === 'WAITING_ENTRY' ? "bg-amber-100 text-amber-700" :
                      plan.status === 'IN_POSITION' ? "bg-indigo-100 text-indigo-700" :
                      plan.status === 'CLOSED' ? "bg-emerald-100 text-emerald-700" :
                      "bg-zinc-100 text-zinc-700"
                    )}>
                      {plan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-zinc-600">
                    ${plan.entry_target_price.toLocaleString()} / ${plan.exit_target_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono font-medium text-zinc-900">
                    ${plan.invest_usdt.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-xs">
                      {plan.linked_entry_order_id ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-mono">
                          <Link size={12} /> EN: {plan.linked_entry_order_id}
                        </span>
                      ) : (
                        <span className="text-zinc-400">Sem ordem de entrada</span>
                      )}
                      {plan.linked_exit_order_id ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-mono">
                          <Link size={12} /> EX: {plan.linked_exit_order_id}
                        </span>
                      ) : (
                        <span className="text-zinc-400">Sem ordem de saída</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono text-xs">
                    {format(plan.created_at, 'dd/MM/yyyy HH:mm')}
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
                    Nenhum Plano de Trade encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
