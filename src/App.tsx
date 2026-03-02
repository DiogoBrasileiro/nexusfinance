import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthGuard } from './components/AuthGuard';
import { Login } from './pages/Login';
import { TradingDesk } from './pages/TradingDesk';
import { LiveQuotes } from './pages/LiveQuotes';
import { Setups } from './pages/Setups';
import { Portfolio } from './pages/Portfolio';
import { Agents } from './pages/Agents';
import { Outputs } from './pages/Outputs';
import { Logs } from './pages/Logs';
import { DataConfig } from './pages/DataConfig';
import { PipelineConfig } from './pages/PipelineConfig';
import { BinanceConnection } from './pages/BinanceConnection';
import { Trades } from './pages/Trades';
import { Reports } from './pages/Reports';
import { SupabaseConfig } from './pages/SupabaseConfig';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<AuthGuard />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/trading" replace />} />
            <Route path="btc" element={<Navigate to="/trading" replace />} />
            <Route path="trading" element={<TradingDesk />} />
            <Route path="live" element={<LiveQuotes />} />
            <Route path="setups" element={<Setups />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="trades" element={<Trades />} />
            <Route path="reports" element={<Reports />} />
            <Route path="binance" element={<BinanceConnection />} />
            <Route path="supabase" element={<SupabaseConfig />} />
            <Route path="agents" element={<Agents />} />
            <Route path="outputs" element={<Outputs />} />
            <Route path="logs" element={<Logs />} />
            <Route path="data" element={<DataConfig />} />
            <Route path="pipeline" element={<PipelineConfig />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
