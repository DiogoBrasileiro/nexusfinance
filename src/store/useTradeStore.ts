import { create } from 'zustand';
import { Asset } from '../types';

export interface TradePlan {
  id: string;
  symbol: Asset;
  created_at: number;
  status: 'DRAFT' | 'WAITING_ENTRY' | 'ORDER_PLACED' | 'IN_POSITION' | 'WAITING_EXIT' | 'CLOSED' | 'CANCELED';
  entry_target_price: number;
  exit_target_price: number;
  stop_price: number;
  invest_usdt: number;
  notes: string;
  account_id: string;
  linked_entry_order_id: string | null;
  linked_exit_order_id: string | null;
}

interface TradeState {
  plans: TradePlan[];
  fetchPlans: () => Promise<void>;
  createPlan: (plan: Omit<TradePlan, 'id' | 'created_at' | 'status' | 'linked_entry_order_id' | 'linked_exit_order_id'>) => Promise<void>;
  updatePlanStatus: (id: string, status: TradePlan['status'], entryId?: string, exitId?: string) => Promise<void>;
}

export const useTradeStore = create<TradeState>((set) => ({
  plans: [],
  
  fetchPlans: async () => {
    try {
      const storedPlans = localStorage.getItem('nexus_trade_plans');
      if (storedPlans) {
        set({ plans: JSON.parse(storedPlans) });
      } else {
        set({ plans: [] });
      }
    } catch (error) {
      console.error('Failed to fetch trades', error);
      set({ plans: [] });
    }
  },

  createPlan: async (planData) => {
    try {
      const newPlan: TradePlan = {
        id: Math.random().toString(36).substring(2, 9),
        ...planData,
        created_at: Date.now(),
        status: 'WAITING_ENTRY',
        linked_entry_order_id: null,
        linked_exit_order_id: null
      };

      set((state) => {
        const updatedPlans = [newPlan, ...state.plans];
        localStorage.setItem('nexus_trade_plans', JSON.stringify(updatedPlans));
        return { plans: updatedPlans };
      });
    } catch (error) {
      console.error('Failed to create trade plan', error);
    }
  },

  updatePlanStatus: async (id, status, entryId, exitId) => {
    try {
      set((state) => {
        const updatedPlans = state.plans.map(p => 
          p.id === id 
            ? { 
                ...p, 
                status, 
                linked_entry_order_id: entryId || p.linked_entry_order_id,
                linked_exit_order_id: exitId || p.linked_exit_order_id
              } 
            : p
        );
        localStorage.setItem('nexus_trade_plans', JSON.stringify(updatedPlans));
        return { plans: updatedPlans };
      });
    } catch (error) {
      console.error('Failed to update trade status', error);
    }
  }
}));
