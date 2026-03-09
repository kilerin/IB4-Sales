-- IB4Sales Dashboard - PostgreSQL Schema
-- Run: psql $DATABASE_URL -f lib/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  file_size BIGINT,
  closed_sets_count INTEGER
);

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS closed_sets_count INTEGER;

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  "group" VARCHAR(100),
  type VARCHAR(100),
  manager VARCHAR(100),
  UNIQUE(upload_id, company_name)
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS "group" VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_group VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(100);

CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  set_id INTEGER,
  status VARCHAR(100),
  side VARCHAR(50),
  deal_date DATE,
  vendor_supplier VARCHAR(255),
  amount_payed_usd DECIMAL(20,4),
  amount_received_usd DECIMAL(20,4),
  trade_contract_margin_usd DECIMAL(20,4),
  pct_margin DECIMAL(10,4),
  fx DECIMAL(20,4),
  manager VARCHAR(100),
  le_we_pay VARCHAR(50),
  our_bank VARCHAR(50)
);

ALTER TABLE deals ADD COLUMN IF NOT EXISTS set_id INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS le_we_pay VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS our_bank VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pct_margin DECIMAL(10,4);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fx DECIMAL(20,4);
-- type берётся из CLIENTS, не из deals
ALTER TABLE deals DROP COLUMN IF EXISTS type;
CREATE INDEX IF NOT EXISTS idx_deals_upload_date ON deals(upload_id, deal_date);
CREATE INDEX IF NOT EXISTS idx_deals_upload_side ON deals(upload_id, side);
CREATE INDEX IF NOT EXISTS idx_deals_upload_manager ON deals(upload_id, manager);
CREATE INDEX IF NOT EXISTS idx_clients_upload ON clients(upload_id);
