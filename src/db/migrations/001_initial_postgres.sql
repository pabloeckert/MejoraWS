-- MejoraWS — PostgreSQL Schema
-- Migration 001: Initial schema (equivalent to SQLite schema)
-- Run: psql -d mejoraws -f 001_initial_postgres.sql

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  company TEXT,
  whatsapp BOOLEAN DEFAULT FALSE,
  tags JSONB DEFAULT '[]',
  score INTEGER DEFAULT 0,
  source TEXT,
  consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  campaign_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  stage TEXT DEFAULT 'nuevo',
  value NUMERIC(12,2),
  probability INTEGER DEFAULT 0,
  notes TEXT,
  next_follow_up TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  audience TEXT,
  template TEXT,
  variations JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics (daily aggregates)
CREATE TABLE IF NOT EXISTS analytics (
  date DATE PRIMARY KEY,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  deals_created INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0
);

-- Config
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_phone);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_phone);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_phone);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
