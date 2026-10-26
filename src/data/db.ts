/**
 * The smallest database surface the repo needs. Two adapters implement it:
 * expo-sqlite in the app (expoDb.ts) and node:sqlite in the tests.
 * Keeping the repo on this interface is what lets the real queries be tested
 * without a phone.
 */
export type Param = string | number | null;

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: Param[]): Promise<T[]>;
  first<T>(sql: string, params?: Param[]): Promise<T | null>;
  /** Runs fn inside BEGIN/COMMIT; rolls back if it throws. */
  transaction(fn: () => Promise<void>): Promise<void>;
}
