import { useBinanceStore } from '../store/useBinanceStore';
import { useTradeStore, TradePlan } from '../store/useTradeStore';
import { useLogStore } from '../store/useLogStore';

export async function syncBinanceOrders() {
  const { accountId, isConnected } = useBinanceStore.getState();
  if (!isConnected || !accountId) return;

  const { plans, updatePlanStatus } = useTradeStore.getState();
  const activePlans = plans.filter(p => ['WAITING_ENTRY', 'ORDER_PLACED', 'IN_POSITION', 'WAITING_EXIT'].includes(p.status));

  if (activePlans.length === 0) return;

  try {
    // Group by symbol to avoid duplicate requests
    const symbols = [...new Set(activePlans.map(p => p.symbol))];
    
    for (const symbol of symbols) {
      // Fetch open orders and all orders for the symbol
      const [openRes, allRes] = await Promise.all([
        fetch(`/api/binance/openOrders?account_id=${accountId}&symbol=${symbol}`),
        fetch(`/api/binance/allOrders?account_id=${accountId}&symbol=${symbol}&limit=50`)
      ]);

      if (!openRes.ok || !allRes.ok) throw new Error('Failed to fetch orders');
      
      const openOrders = await openRes.json();
      const allOrders = await allRes.json();
      
      const plansForSymbol = activePlans.filter(p => p.symbol === symbol);

      for (const plan of plansForSymbol) {
        // 1. Check Entry Orders
        if (plan.status === 'WAITING_ENTRY' || plan.status === 'ORDER_PLACED') {
          // Look for BUY orders matching the entry target price (0.15% tolerance)
          const targetPrice = plan.entry_target_price;
          const investUsdt = plan.invest_usdt;
          
          const matchingOrder = allOrders.find((o: any) => {
            if (o.side !== 'BUY') return false;
            const price = parseFloat(o.price);
            const qty = parseFloat(o.origQty);
            const quoteQty = price * qty;
            
            const priceMatch = Math.abs(price - targetPrice) / targetPrice <= 0.0015;
            const valueMatch = Math.abs(quoteQty - investUsdt) / investUsdt <= 0.10;
            
            return priceMatch && valueMatch;
          });

          if (matchingOrder) {
            const status = matchingOrder.status === 'FILLED' ? 'IN_POSITION' : 'ORDER_PLACED';
            if (plan.status !== status || plan.linked_entry_order_id !== matchingOrder.orderId) {
              await updatePlanStatus(plan.id, status, matchingOrder.orderId.toString(), undefined);
              useLogStore.getState().addLog('SYSTEM', `Ordem de ENTRADA vinculada ao plano ${plan.id}`, { orderId: matchingOrder.orderId, status });
            }
          }
        }

        // 2. Check Exit Orders
        if (plan.status === 'IN_POSITION' || plan.status === 'WAITING_EXIT') {
           // Look for SELL orders matching the exit target price
           const targetPrice = plan.exit_target_price;
           
           const matchingOrder = allOrders.find((o: any) => {
             if (o.side !== 'SELL') return false;
             const price = parseFloat(o.price);
             const priceMatch = Math.abs(price - targetPrice) / targetPrice <= 0.0015;
             return priceMatch;
           });

           if (matchingOrder) {
            const status = matchingOrder.status === 'FILLED' ? 'CLOSED' : 'WAITING_EXIT';
            if (plan.status !== status || plan.linked_exit_order_id !== matchingOrder.orderId) {
              await updatePlanStatus(plan.id, status, undefined, matchingOrder.orderId.toString());
              useLogStore.getState().addLog('SYSTEM', `Ordem de SAÍDA vinculada ao plano ${plan.id}`, { orderId: matchingOrder.orderId, status });
            }
          }
        }
      }
    }
  } catch (error: any) {
    useLogStore.getState().addLog('ERROR', `Falha na sincronização com Binance: ${error.message}`);
  }
}

// Start polling
let syncInterval: number | null = null;

export function startBinanceSync() {
  if (!syncInterval) {
    syncInterval = window.setInterval(syncBinanceOrders, 15000); // 15s poll
  }
}

export function stopBinanceSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
