// src/db/database.ts
// SQLite database con better-sqlite3

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { status } from '../cli/theme'

export function initDatabase(dbPath: string = './data/mejoraws.db'): Database.Database {
  // Asegurar que el directorio existe
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  
  // Habilitar WAL mode para mejor performance
  db.pragma('journal_mode = WAL')
  
  // Crear tablas
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      whatsapp INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      score INTEGER DEFAULT 0,
      source TEXT,
      consent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      contact_phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      campaign_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      contact_phone TEXT NOT NULL,
      stage TEXT DEFAULT 'nuevo',
      value REAL,
      probability INTEGER DEFAULT 0,
      notes TEXT,
      next_follow_up TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      contact_phone TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      objective TEXT,
      audience TEXT,
      template TEXT,
      variations TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      scheduled_at TEXT,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      read_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analytics (
      date TEXT PRIMARY KEY,
      sent INTEGER DEFAULT 0,
      delivered INTEGER DEFAULT 0,
      read INTEGER DEFAULT 0,
      replied INTEGER DEFAULT 0,
      deals_created INTEGER DEFAULT 0,
      deals_closed INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_phone);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_phone);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
    CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_phone);
    CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
  `)

  console.log(status.ok(`Base de datos inicializada: ${dbPath}`))
  return db
}

// Helper para generar IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}
