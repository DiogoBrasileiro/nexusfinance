import { useLogStore } from '../store/useLogStore';
import { format } from 'date-fns';
import clsx from 'clsx';

export function Logs() {
  const { logs, clearLogs } = useLogStore();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Logs & Auditoria</h1>
          <p className="text-zinc-500 mt-1">Histórico de requisições, latência e análises.</p>
        </div>
        <button 
          onClick={clearLogs}
          className="px-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 text-zinc-700"
        >
          Limpar Logs
        </button>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Mensagem</th>
                <th className="px-6 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-3 font-mono text-zinc-500">
                    {format(log.timestamp, 'HH:mm:ss.SSS')}
                  </td>
                  <td className="px-6 py-3">
                    <span className={clsx(
                      "px-2 py-1 rounded text-xs font-bold",
                      log.type === 'ERROR' ? "bg-red-100 text-red-700" :
                      log.type === 'ANALYSIS' ? "bg-indigo-100 text-indigo-700" :
                      "bg-zinc-100 text-zinc-700"
                    )}>
                      {log.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-zinc-900">{log.message}</td>
                  <td className="px-6 py-3 font-mono text-xs text-zinc-500">
                    {log.details ? JSON.stringify(log.details) : '-'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">
                    Nenhum log registrado.
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
