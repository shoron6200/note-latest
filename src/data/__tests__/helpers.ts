import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { Db, Param } from '../db';
import { migrate } from '../migrations';
import { createRepo } from '../repo';
import type { Scheduler } from '../types';

/** node:sqlite behind the same Db interface the app uses with expo-sqlite. */
export function nodeDb(): Db {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  return {
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params: Param[] = []) => {
      const r = raw.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    all: async <T,>(sql: string, params: Param[] = []) => raw.prepare(sql).all(...params) as T[],
    first: async <T,>(sql: string, params: Param[] = []) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    transaction: async (fn) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export class FakeScheduler implements Scheduler {
  maxPending = 64;
  pending = new Map<string, { noteId: string; title: string; body: string; fireAt: number }>();
  private n = 0;
  async schedule(r: { noteId: string; title: string; body: string; fireAt: number }) {
    const id = `os-${++this.n}`;
    this.pending.set(id, r);
    return id;
  }
  async cancel(osId: string) {
    this.pending.delete(osId);
  }
  async listScheduled() {
    return [...this.pending.entries()].map(([osId, r]) => ({ osId, noteId: r.noteId }));
  }
}

export async function setup(opts: { now?: number; fts?: boolean } = {}) {
  const db = nodeDb();
  const { fts } = await migrate(db);
  const clock = { t: opts.now ?? Date.UTC(2026, 9, 18, 10, 0) };
  const scheduler = new FakeScheduler();
  const repo = createRepo({ db, fts: opts.fts ?? fts, newId: randomUUID, now: () => clock.t, scheduler });
  const tick = (ms = 1000) => {
    clock.t += ms;
  };
  return { db, repo, clock, tick, scheduler, fts };
}
