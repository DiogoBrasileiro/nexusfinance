import { useSettingsStore } from '../store/useSettingsStore';

export function DataConfig() {
  const { forceDataService, dataServiceUrl, setForceDataService, setDataServiceUrl } = useSettingsStore();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-main)]">Dados & APIs</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Configuração da fonte de dados (Binance Spot vs Data Service).</p>
      </header>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-8 shadow-[var(--shadow-soft)] border border-[var(--color-border-subtle)] max-w-2xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--color-text-main)]">Forçar Data Service</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Proibir conexão direta com a Binance API. Requer URL configurada.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={forceDataService}
                onChange={(e) => setForceDataService(e.target.checked)}
              />
              <div className="w-11 h-6 bg-[var(--color-surface-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
              DATA_SERVICE_BASE_URL
            </label>
            <input 
              type="url" 
              value={dataServiceUrl}
              onChange={(e) => setDataServiceUrl(e.target.value)}
              placeholder="https://meu-data-service.run.app"
              className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-3 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
