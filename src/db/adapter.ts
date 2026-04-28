// src/db/adapter.ts
// Database abstraction layer — soporta SQLite y PostgreSQL
// Permite migración gradual sin cambiar el código de negocio

import Database from 'better-sqlite3'
import { childLogger } from '../utils/logger'

const log = childLogger('db:adapter')

export type DbType = 'sqlite' | 'postgres'

export interface DatabaseAdapter {
  type: DbType
  prepare(sql: string): PreparedStatement
  exec(sql: string): void
  close(): void
  transaction<T>(fn: () => T): T
}

export interface PreparedStatement {
  get(...params: any[]): any
  all(...params: any[]): any[]
  run(...params: any[]): { changes: number; lastInsertRowid?: number }
}

/**
 * SQLite adapter (default, zero-config)
 */
class SQLiteAdapter implements DatabaseAdapter {
  type: DbType = 'sqlite'
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql)
    return {
      get(...params: any[]) {
        return stmt.get(...params)
      },
      all(...params: any[]) {
        return stmt.all(...params)
      },
      run(...params: any[]) {
        const result = stmt.run(...params)
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid as number }
      },
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  close(): void {
    this.db.close()
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }
}

/**
 * PostgreSQL adapter (requiere pg)
 * Nota: pg se carga dinámicamente solo si se configura PostgreSQL
 */
class PostgresAdapter implements DatabaseAdapter {
  type: DbType = 'postgres'
  private pool: any

  constructor(pool: any) {
    this.pool = pool
  }

  prepare(sql: string): PreparedStatement {
    // Convertir ? placeholders a $1, $2, etc. para PostgreSQL
    let paramIndex = 0
    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`)

    return {
      async get(...params: any[]) {
        const result = await this.pool.query(pgSql + ' LIMIT 1', params)
        return result.rows[0] || null
      },
      async all(...params: any[]) {
        const result = await this.pool.query(pgSql, params)
        return result.rows
      },
      async run(...params: any[]) {
        const result = await this.pool.query(pgSql, params)
        return { changes: result.rowCount || 0 }
      },
    }
  }

  exec(sql: string): void {
    this.pool.query(sql).catch((err: Error) => {
      log.error({ err }, 'PostgreSQL exec error')
    })
  }

  close(): void {
    this.pool.end()
  }

  transaction<T>(fn: () => T): T {
    // PostgreSQL transactions via client
    return fn()
  }
}

/**
 * Factory: crea el adapter según la configuración
 */
export async function createDatabaseAdapter(config: {
  type?: DbType
  dbPath?: string
  pgConnectionString?: string
}): Promise<DatabaseAdapter> {
  const type = config.type || 'sqlite'

  if (type === 'postgres') {
    try {
      const { Pool } = await import('pg')
      const pool = new Pool({
        connectionString: config.pgConnectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      })

      // Test connection
      const client = await pool.connect()
      client.release()

      log.info('PostgreSQL connected')
      return new PostgresAdapter(pool)
    } catch (err: any) {
      log.warn({ err: err.message }, 'PostgreSQL not available, falling back to SQLite')
      // Fallback a SQLite
      const db = new Database(config.dbPath || './data/mejoraws.db')
      db.pragma('journal_mode = WAL')
      return new SQLiteAdapter(db)
    }
  }

  // Default: SQLite
  const dbPath = config.dbPath || './data/mejoraws.db'
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  log.info({ dbPath }, 'SQLite connected')
  return new SQLiteAdapter(db)
}
