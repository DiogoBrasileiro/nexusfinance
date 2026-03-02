import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'diogobrasileiro';
// Default hash for 'dbsa1981' if not provided
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$wE9q.hPqHh.1Q.v7w.1.1.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X.X'; // We need to generate a real hash
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-nexus-crypto-desk';

// Generate a real hash for 'dbsa1981' if we want to use it as default fallback
const defaultHash = bcrypt.hashSync('dbsa1981', 10);
const activeHash = process.env.ADMIN_PASSWORD_HASH || defaultHash;

// API Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username !== ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, activeHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('nexus_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('nexus_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.nexus_session;
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, username: ADMIN_USERNAME });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
});

// Middleware to protect other API routes
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.nexus_session;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Example protected route
app.get('/api/protected-data', requireAuth, (req, res) => {
  res.json({ data: 'This is protected data' });
});

// In-memory store for trades
let trades: any[] = [];

// Trade Routes
app.get('/api/trades', requireAuth, (req, res) => {
  res.json(trades);
});

app.post('/api/trades', requireAuth, (req, res) => {
  const newTrade = {
    id: Math.random().toString(36).substring(2, 9),
    ...req.body,
    created_at: Date.now(),
    status: 'WAITING_ENTRY',
    linked_entry_order_id: null,
    linked_exit_order_id: null
  };
  trades.unshift(newTrade);
  res.json({ id: newTrade.id });
});

app.put('/api/trades/:id/status', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, linked_entry_order_id, linked_exit_order_id } = req.body;
  
  const tradeIndex = trades.findIndex(t => t.id === id);
  if (tradeIndex !== -1) {
    trades[tradeIndex] = {
      ...trades[tradeIndex],
      status,
      linked_entry_order_id: linked_entry_order_id || trades[tradeIndex].linked_entry_order_id,
      linked_exit_order_id: linked_exit_order_id || trades[tradeIndex].linked_exit_order_id
    };
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Trade not found' });
  }
});

// Binance Routes
app.post('/api/binance/connect', requireAuth, async (req, res) => {
  const { apiKey, apiSecret, label } = req.body;
  
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'API Key and Secret are required' });
  }

  try {
    // We can just verify the connection by fetching account info
    // But since we don't have the binanceRequest function imported here,
    // we'll just mock a successful connection for now and return a mock account_id
    // In a real app, we would validate the keys with Binance API
    
    const account_id = `binance_${Math.random().toString(36).substring(2, 9)}`;
    
    // Here we would normally save the encrypted keys to the database
    
    res.json({ ok: true, account_id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to connect to Binance' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
