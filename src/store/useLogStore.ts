import { create } from 'zustand';
import { LogEntry } from '../types';

interface LogState {
  logs: LogEntry[];
  addLog: (type: LogEntry['type'], message: string, details?: any) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (type, message, details) => set((state) => ({
    logs: [
      { id: crypto.randomUUID(), timestamp: Date.now(), type, message, details },
      ...state.logs
    ].slice(0, 500) // Keep last 500 logs
  })),
  clearLogs: () => set({ logs: [] })
}));
