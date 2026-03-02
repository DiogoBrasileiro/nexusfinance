import { useDataStore } from '../store/useDataStore';
import { DataFreshnessHUD } from '../components/DataFreshnessHUD';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';
import { Asset } from '../types';

export function LiveQuotes() {
  const { tickers, freshness } = useDataStore();
  const assets: Asset[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Cotações ao Vivo</h1>
          <p className="text-zinc-500 mt-1">Acompanhamento em tempo real do mercado cripto.</p>
        </div>
        
        {/* Usando o freshness do BTC como referência geral */}
        <DataFreshnessHUD freshness={freshness['BTCUSDT']} />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {assets.map((asset) => {
          const ticker = tickers[asset];
          if (!ticker) return (
            <div key={asset} className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200 h-48 flex items-center justify-center text-zinc-400">
              Carregando {asset}...
            </div>
          );

          const isPositive = ticker.chg24h_pct >= 0;

          return (
            <div key={asset} className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200 hover:border-indigo-200 transition-colors text-zinc-900">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-700">
                    {asset.replace('USDT', '')}
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-900">{asset}</h2>
                    <span className="text-xs text-zinc-500 font-mono">Binance Spot</span>
                  </div>
                </div>
                
                <div className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium",
                  isPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                )}>
                  {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {isPositive ? '+' : ''}{ticker.chg24h_pct.toFixed(2)}%
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-mono font-bold tracking-tighter text-zinc-900">
                  ${ticker.last.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100 text-sm">
                <div>
                  <span className="block text-zinc-500 mb-1">Máxima 24h</span>
                  <span className="font-mono font-medium text-zinc-900">${ticker.high24h.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 mb-1">Mínima 24h</span>
                  <span className="font-mono font-medium text-zinc-900">${ticker.low24h.toLocaleString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-zinc-500 mb-1">Volume 24h</span>
                  <span className="font-mono font-medium text-zinc-900">{ticker.vol24h.toLocaleString(undefined, { maximumFractionDigits: 0 })} {asset.replace('USDT', '')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
