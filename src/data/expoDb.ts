import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { Db, Param } from './db';

export const DB_NAME = 'pocketleaf.db';

export function wrapExpoDb(raw: SQLiteDatabase): Db {
  return {
    exec: (sql) => raw.execAsync(sql),
    run: async (sql, params: Param[] = []) => {
      const r = await raw.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T,>(sql: string, params: Param[] = []) => raw.getAllAsync<T>(sql, params),
    first: <T,>(sql: string, params: Param[] = []) => raw.getFirstAsync<T>(sql, params),
    // Not exclusive in expo-sqlite, but every write already goes through the
    // repo's single serial queue, so nothing else can interleave with it.
    transaction: (fn) => raw.withTransactionAsync(fn),
  };
}

export async function openAppDb(): Promise<Db> {
  const raw = await openDatabaseAsync(DB_NAME);
  const db = wrapExpoDb(raw);
  // SQLite ignores ON DELETE rules unless this runs on every connection.
  await db.exec('PRAGMA foreign_keys = ON;');
  try {
    await db.exec('PRAGMA journal_mode = WAL;');
  } catch {
    // The web build may not support WAL; the default journal is still safe.
  }
  return db;
}
