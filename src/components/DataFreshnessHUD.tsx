import { DataFreshness } from '../types';
import { Activity, Clock, Server, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export function DataFreshnessHUD({ freshness }: { freshness: DataFreshness | null }) {
  if (!freshness) return null;

  const statusColors = {
    OK: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    PARCIAL: 'bg-amber-100 text-amber-700 border-amber-200',
    STALE: 'bg-orange-100 text-orange-700 border-orange-200',
    OFFLINE: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="flex items-center gap-4 text-xs font-mono bg-white border border-zinc-200 rounded-lg p-2 shadow-sm">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Server size={14} />
        <span>{freshness.source}</span>
      </div>
      
      <div className="w-px h-4 bg-zinc-200" />
      
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Clock size={14} />
        <span>Idade: {freshness.age}s</span>
      </div>
      
      <div className="w-px h-4 bg-zinc-200" />
      
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Activity size={14} />
        <span>Latência: {freshness.latency}ms</span>
      </div>
      
      <div className="w-px h-4 bg-zinc-200" />
      
      <div className={clsx(
        'px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1',
        statusColors[freshness.status]
      )}>
        {freshness.status !== 'OK' && <AlertTriangle size={12} />}
        {freshness.status}
      </div>
    </div>
  );
}
