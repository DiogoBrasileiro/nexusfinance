import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseState {
  url: string;
  anonKey: string;
  isConnected: boolean;
  setCredentials: (url: string, key: string) => void;
  setConnected: (status: boolean) => void;
}

export const useSupabaseStore = create<SupabaseState>()(
  persist(
    (set) => ({
      url: '',
      anonKey: '',
      isConnected: false,
      setCredentials: (url, anonKey) => set({ url, anonKey }),
      setConnected: (isConnected) => set({ isConnected }),
    }),
    {
      name: 'nexus-supabase-storage',
    }
  )
);

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;
  
  const { url, anonKey } = useSupabaseStore.getState();
  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey);
      return supabaseInstance;
    } catch (e) {
      console.error("Failed to initialize Supabase client", e);
      return null;
    }
  }
  return null;
};

export const resetSupabaseClient = () => {
  supabaseInstance = null;
};
