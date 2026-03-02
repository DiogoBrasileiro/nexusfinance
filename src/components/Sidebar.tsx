import { NavLink } from 'react-router-dom';
import { 
  LineChart, Activity, Layers, Wallet, 
  Bot, FileText, ShieldAlert, Database, Zap,
  Briefcase, BarChart3, Key
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/trading', icon: LineChart, label: 'Trading Desk' },
  { to: '/live', icon: Activity, label: 'Cotações ao Vivo' },
  { to: '/setups', icon: Layers, label: 'Setups' },
  { to: '/portfolio', icon: Wallet, label: 'Carteira Cripto' },
  { to: '/trades', icon: Briefcase, label: 'Operações' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/binance', icon: Key, label: 'Conexão Binance' },
  { to: '/agents', icon: Bot, label: 'Agentes' },
  { to: '/outputs', icon: FileText, label: 'Outputs' },
  { to: '/logs', icon: ShieldAlert, label: 'Logs & Auditoria' },
  { to: '/data', icon: Database, label: 'Dados & APIs' },
  { to: '/pipeline', icon: Zap, label: 'Pipeline & IA' },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="w-64 bg-[var(--color-base)] text-[var(--color-text-secondary)] flex flex-col h-screen border-r border-[var(--color-border-subtle)]">
      <div className="p-6">
        <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight flex items-center gap-2">
          <Zap className="text-[var(--color-primary)] drop-shadow-[0_0_8px_var(--color-primary-glow)]" />
          NEXUS <span className="text-[var(--color-primary)]">DESK</span>
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 tracking-wider uppercase font-mono">Crypto Operations</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-button)] text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] shadow-[inset_2px_0_0_var(--color-primary)]'
                  : 'hover:bg-[var(--color-surface)] hover:text-[var(--color-text-main)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={clsx('transition-colors', isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]')} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)] text-center font-mono">
        v2.0.0-premium
      </div>
    </aside>
  );
}
