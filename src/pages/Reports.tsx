import { useEffect, useState } from 'react';
import { useBinanceStore } from '../store/useBinanceStore';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import clsx from 'clsx';

export function Reports() {
  const { isConnected, accountId } = useBinanceStore();
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && accountId) {
      setLoading(true);
      // Simulate backend fetch for GitHub Pages demo
      new Promise(resolve => setTimeout(resolve, 800))
        .then(() => {
          // Mock balances
          setBalances([
            { asset: 'USDT', free: '10000.00', locked: '0.00' },
            { asset: 'BTC', free: '0.50000000', locked: '0.00' },
            { asset: 'ETH', free: '5.00000000', locked: '0.00' },
            { asset: 'SOL', free: '150.00000000', locked: '0.00' }
          ]);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isConnected, accountId]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Relatórios & P&L</h1>
        <p className="text-zinc-500 mt-1">Visão geral do seu portfólio e performance.</p>
      </header>

      {!isConnected ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800">
          <h3 className="font-bold mb-1">Conexão Binance Necessária</h3>
          <p className="text-sm">Conecte sua conta da Binance para visualizar seus saldos e relatórios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <h2 className="font-bold text-zinc-900">Saldo USDT</h2>
            </div>
            {loading ? (
              <div className="text-zinc-400">Carregando...</div>
            ) : (
              <div className="text-3xl font-mono font-bold tracking-tighter text-zinc-900">
                ${parseFloat(balances.find(b => b.asset === 'USDT')?.free || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-2">Disponível para operações</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <h2 className="font-bold text-zinc-900">P&L Realizado</h2>
            </div>
            <div className="text-3xl font-mono font-bold tracking-tighter text-emerald-600">
              +$0.00
            </div>
            <p className="text-xs text-zinc-500 mt-2">Lucro líquido (após taxas)</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <h2 className="font-bold text-zinc-900">P&L Não Realizado</h2>
            </div>
            <div className="text-3xl font-mono font-bold tracking-tighter text-zinc-900">
              $0.00
            </div>
            <p className="text-xs text-zinc-500 mt-2">Posições abertas (marcação a mercado)</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <h2 className="font-bold text-zinc-900">Taxas Totais</h2>
            </div>
            <div className="text-3xl font-mono font-bold tracking-tighter text-red-600">
              -$0.00
            </div>
            <p className="text-xs text-zinc-500 mt-2">Comissões pagas (convertidas para USDT)</p>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
          <h2 className="text-xl font-bold text-zinc-900 mb-6">Saldos em Cripto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {['BTC', 'ETH', 'SOL'].map(asset => {
              const balance = balances.find(b => b.asset === asset);
              return (
                <div key={asset} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <div className="font-bold text-zinc-900 mb-2">{asset}</div>
                  <div className="font-mono text-lg text-zinc-900">{parseFloat(balance?.free || '0').toLocaleString()}</div>
                  <div className="text-xs text-zinc-500 mt-1">Livre</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
