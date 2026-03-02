import React, { useState, useEffect } from 'react';
import { Database, Save, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useSupabaseStore, resetSupabaseClient, getSupabase } from '../store/useSupabaseStore';

export function SupabaseConfig() {
  const { url: savedUrl, anonKey: savedKey, isConnected, setCredentials, setConnected } = useSupabaseStore();
  
  const [url, setUrl] = useState(savedUrl);
  const [anonKey, setAnonKey] = useState(savedKey);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setUrl(savedUrl);
    setAnonKey(savedKey);
  }, [savedUrl, savedKey]);

  const handleSave = () => {
    setCredentials(url, anonKey);
    resetSupabaseClient();
    setStatus('idle');
    setMessage('Configurações salvas. Teste a conexão para habilitar o sync.');
    setConnected(false);
  };

  const handleTest = async () => {
    if (!url || !anonKey) {
      setStatus('error');
      setMessage('Preencha URL e Anon Key.');
      return;
    }

    setStatus('testing');
    setMessage('Testando conexão...');

    try {
      // Temporarily set credentials to test
      setCredentials(url, anonKey);
      resetSupabaseClient();
      const supabase = getSupabase();
      
      if (!supabase) throw new Error("Falha ao inicializar cliente Supabase");

      // Simple query to test connection. We query a non-existent table or just auth
      // Supabase doesn't have a simple "ping", so we can just try to select from a table
      // or check auth session.
      const { error } = await supabase.from('app_settings').select('id').limit(1);
      
      // If the error is just that the table doesn't exist (PGRST116 or 42P01), it means we connected to the DB!
      // If it's a network error or auth error, it will be different.
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        throw error;
      }

      setStatus('success');
      setMessage('Conexão estabelecida com sucesso! Sync habilitado.');
      setConnected(true);
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(`Erro de conexão: ${error.message || 'Verifique suas credenciais.'}`);
      setConnected(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
          <Database className="text-indigo-600" />
          Supabase Storage
        </h1>
        <p className="text-zinc-500 mt-1">
          Configure a conexão com o Supabase para persistir seus dados e análises na nuvem.
        </p>
      </header>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
        <AlertTriangle className="shrink-0 mt-0.5" size={18} />
        <div>
          <strong>Aviso de Segurança:</strong> Como este é um projeto privado com login fixo, você pode usar a <code>anon key</code> com RLS (Row Level Security) desativado para simplificar. <strong>Não recomendado para apps públicos.</strong>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Supabase Project URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm text-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Supabase Anon Key</label>
          <input
            type="password"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJh..."
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm text-zinc-900"
          />
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium text-sm"
          >
            <Save size={16} />
            Salvar
          </button>
          
          <button
            onClick={handleTest}
            disabled={status === 'testing'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Database size={16} />
            {status === 'testing' ? 'Testando...' : 'Testar Conexão'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
            status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            status === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-zinc-50 text-zinc-800 border border-zinc-200'
          }`}>
            {status === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
            {status === 'error' && <XCircle size={18} className="text-red-600" />}
            {message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <h3 className="font-bold text-zinc-900 mb-4">Estrutura de Tabelas Necessária</h3>
        <p className="text-sm text-zinc-600 mb-4">Execute este SQL no SQL Editor do seu Supabase:</p>
        <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{`-- Tabela de Configurações
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Planos de Trade
CREATE TABLE trade_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  asset TEXT NOT NULL,
  params JSONB NOT NULL,
  status TEXT NOT NULL,
  linked_orders JSONB
);

-- Tabela de Execuções de Análise
CREATE TABLE analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  asset TEXT NOT NULL,
  snapshot JSONB,
  agent_outputs JSONB,
  strategist_output JSONB,
  fact_checker JSONB,
  data_freshness JSONB
);

-- Tabela de Logs de Auditoria
CREATE TABLE logs_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  meta JSONB
);`}
        </pre>
      </div>
    </div>
  );
}
