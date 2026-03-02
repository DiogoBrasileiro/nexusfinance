import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useEffect, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { startBinanceSync, stopBinanceSync } from '../services/syncService';
import { Menu, X } from 'lucide-react';

export function Layout() {
  const { startAutoRefresh, stopAutoRefresh } = useDataStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    startAutoRefresh();
    startBinanceSync();
    return () => {
      stopAutoRefresh();
      stopBinanceSync();
    };
  }, [startAutoRefresh, stopAutoRefresh]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-[var(--color-base)] text-[var(--color-text-main)] font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)] z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 font-bold text-[var(--color-text-main)]">
          <span className="text-[var(--color-primary)] drop-shadow-[0_0_8px_var(--color-primary-glow)]">⚡</span>
          NEXUS <span className="text-[var(--color-primary)]">DESK</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0 w-full">
        <Outlet />
      </main>
    </div>
  );
}
