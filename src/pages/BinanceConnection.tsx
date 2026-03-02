import React, { useState } from 'react';
import { useBinanceStore } from '../store/useBinanceStore';
import { ShieldCheck, AlertCircle, Link, Unlink } from 'lucide-react';
import clsx from 'clsx';

export function BinanceConnection() {
  const { accountId, isConnected, setConnection, disconnect } = useBinanceStore();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [label, setLabel] = useState('Minha Conta Binance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simulate backend connection for GitHub Pages demo
      // In a real app, this would verify keys with the backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Fake delay
      
      if (apiKey && apiSecret) {
        const mockAccountId = `binance_${Math.random().toString(36).substring(2, 9)}`;
        setConnection(mockAccountId);
        // Store keys in localStorage for demo purposes (NOT SECURE for production)
        localStorage.setItem('nexus_binance_keys', JSON.stringify({ apiKey, apiSecret, label }));
      } else {
        throw new Error('API Key e Secret são obrigatórios');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-main)]">Conexão Binance</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Conecte sua conta da Binance para acompanhamento automático de ordens e P&L.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] p-8 shadow-[var(--shadow-soft)] border border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-4 mb-6">
            <div className={clsx(
              "w-14 h-14 rounded-2xl flex items-center justify-center border",
              isConnected ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary)]/30 shadow-[0_0_15px_var(--color-primary-glow)]" : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-strong)]"
            )}>
              {isConnected ? <Link size={28} /> : <Unlink size={28} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-main)]">Status da Conexão</h2>
              <p className={clsx(
                "text-sm font-medium mt-1",
                isConnected ? "text-[var(--color-primary)] drop-shadow-[0_0_4px_var(--color-primary-glow)]" : "text-[var(--color-text-muted)]"
              )}>
                {isConnected ? 'Conectado e Sincronizando' : 'Não conectado'}
              </p>
            </div>
          </div>

          {isConnected ? (
            <div className="space-y-6">
              <div className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-xl font-mono text-sm text-[var(--color-text-main)]">
                <span className="block text-xs text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Account ID (Local)</span>
                {accountId}
              </div>
              <button
                onClick={disconnect}
                className="w-full py-3 px-4 bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/30 font-medium rounded-[var(--radius-button)] hover:bg-[var(--color-error)]/20 transition-colors"
              >
                Desconectar Conta
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Nome da Conta</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-3 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-3 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">API Secret</label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg p-3 text-sm text-[var(--color-text-main)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all"
                  required
                />
              </div>
              
              {error && (
                <div className="p-3 bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm rounded-lg border border-[var(--color-error)]/30">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-zinc-950 font-bold rounded-[var(--radius-button)] hover:opacity-90 transition-all shadow-[0_0_15px_var(--color-primary-glow)] disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? 'Testando Conexão...' : 'Conectar à Binance'}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-blue-500/5 rounded-[var(--radius-card)] p-6 border border-blue-500/20">
            <h3 className="font-bold text-blue-400 flex items-center gap-2 mb-4">
              <ShieldCheck className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              Segurança e Privacidade
            </h3>
            <ul className="space-y-4 text-sm text-[var(--color-text-secondary)]">
              <li className="flex gap-3">
                <span className="font-bold text-blue-500">1.</span>
                <span className="leading-relaxed">As chaves da API <strong className="text-[var(--color-text-main)]">nunca</strong> são armazenadas no seu navegador. Elas são enviadas de forma segura para o backend e armazenadas no banco de dados local.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-blue-500">2.</span>
                <span className="leading-relaxed">O aplicativo armazena apenas um <code className="bg-[var(--color-surface-elevated)] px-1.5 py-0.5 rounded text-[var(--color-text-main)] border border-[var(--color-border-subtle)]">Account ID</code> anônimo para vincular suas operações.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-blue-500">3.</span>
                <span className="leading-relaxed">Recomendamos fortemente criar uma API Key na Binance com a permissão <strong className="text-[var(--color-text-main)]">"Enable Reading" (Somente Leitura)</strong>. Não ative permissões de saque ou trade.</span>
              </li>
            </ul>
          </div>

          <div className="bg-[var(--color-alert)]/5 rounded-[var(--radius-card)] p-6 border border-[var(--color-alert)]/20">
            <h3 className="font-bold text-[var(--color-alert)] flex items-center gap-2 mb-3">
              <AlertCircle className="text-[var(--color-alert)] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              Aviso Importante
            </h3>
            <p className="text-sm text-[var(--color-alert)]/80 leading-relaxed">
              O Nexus Crypto Desk <strong className="text-[var(--color-alert)]">não executa ordens automaticamente</strong>. O aplicativo apenas monitora sua conta da Binance para identificar ordens manuais que correspondam aos seus Planos de Trade, calculando P&L e taxas automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
