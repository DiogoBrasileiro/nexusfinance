import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,

  checkAuth: async () => {
    // Check localStorage for auth state
    const storedAuth = localStorage.getItem('nexus_auth');
    if (storedAuth === 'true') {
      set({ isAuthenticated: true, isLoading: false });
    } else {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  login: async (username, password) => {
    // Client-side validation for GitHub Pages deployment
    // Credentials: diogobrasileiro / dbsa1981
    if (username === 'diogobrasileiro' && password === 'dbsa1981') {
      localStorage.setItem('nexus_auth', 'true');
      set({ isAuthenticated: true });
      return true;
    }
    return false;
  },

  logout: async () => {
    localStorage.removeItem('nexus_auth');
    set({ isAuthenticated: false });
  },
}));
