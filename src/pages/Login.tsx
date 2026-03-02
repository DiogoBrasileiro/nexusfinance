import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Shield, Lock, User, AlertCircle, Zap } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(username, password);
    if (success) {
      navigate('/');
    } else {
      setError('Credenciais inválidas. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-base)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-glow)] border border-[var(--color-border-subtle)] overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] shadow-[0_0_15px_var(--color-primary-glow)]"></div>
        
        <div className="p-8 text-center border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/50">
          <div className="w-16 h-16 bg-[var(--color-primary-glow)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--color-primary)]/30 shadow-[0_0_15px_var(--color-primary-glow)]">
            <Zap className="text-[var(--color-primary)]" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-main)] tracking-tight">NEXUS <span className="text-[var(--color-primary)]">DESK</span></h1>
          <p className="text-[var(--color-text-muted)] mt-2 text-xs uppercase tracking-wider font-mono">Acesso Restrito</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-[var(--color-error)]/10 text-[var(--color-error)] p-3 rounded-lg text-sm flex items-center gap-2 border border-[var(--color-error)]/30">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all text-[var(--color-text-main)] text-sm"
                  placeholder="diogobrasileiro"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none transition-all text-[var(--color-text-main)] text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-zinc-950 font-bold py-3 rounded-[var(--radius-button)] hover:opacity-90 transition-all shadow-[0_0_15px_var(--color-primary-glow)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center"
            >
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
