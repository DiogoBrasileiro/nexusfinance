import Database from 'better-sqlite3';

const db = new Database('nexus.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS binance_accounts (
    account_id TEXT PRIMARY KEY,
    label TEXT,
    api_key TEXT,
    api_secret TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS trade_plans (
    id TEXT PRIMARY KEY,
    symbol TEXT,
    created_at INTEGER,
    status TEXT,
    entry_target_price REAL,
    exit_target_price REAL,
    stop_price REAL,
    invest_usdt REAL,
    notes TEXT,
    account_id TEXT,
    linked_entry_order_id TEXT,
    linked_exit_order_id TEXT
  );

  CREATE TABLE IF NOT EXISTS binance_orders (
    orderId TEXT PRIMARY KEY,
    symbol TEXT,
    side TEXT,
    type TEXT,
    status TEXT,
    price REAL,
    origQty REAL,
    executedQty REAL,
    cummulativeQuoteQty REAL,
    time INTEGER,
    updateTime INTEGER
  );

  CREATE TABLE IF NOT EXISTS binance_fills (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    symbol TEXT,
    side TEXT,
    price REAL,
    qty REAL,
    quoteQty REAL,
    commission REAL,
    commissionAsset TEXT,
    time INTEGER
  );

  CREATE TABLE IF NOT EXISTS pnl_records (
    plan_id TEXT PRIMARY KEY,
    realized_pnl_usdt REAL,
    unrealized_pnl_usdt REAL,
    fees_usdt_total REAL,
    avg_entry_price REAL,
    avg_exit_price REAL,
    position_qty REAL,
    updated_at INTEGER,
    FOREIGN KEY(plan_id) REFERENCES trade_plans(id)
  );
`);

export default db;
