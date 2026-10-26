/** File bookkeeping shared by the app and the Telegram backup. No Expo imports, so the tests run it. */
import type { Repo } from './repo';
import type { Attachment, FileStore } from './types';

/** Files being copied in right now: their note row does not exist yet, so the sweep must leave them. */
const inFlight = new Set<string>();
export function holdFile(name: string) {
  inFlight.add(name);
  return () => {
    inFlight.delete(name);
  };
}

/**
 * Delete stored files that no note (trash included) refers to any more:
 * after "Delete for good", "Empty trash", the 30-day purge, or removing a photo.
 * Files a running Telegram restore is still writing are not in the store yet.
 */
export async function sweepUnusedFiles(repo: Repo, store: FileStore): Promise<number> {
  const used = await repo.usedFileNames();
  let removed = 0;
  for (const name of await store.list()) {
    if (used.has(name) || inFlight.has(name)) continue;
    await store.remove(name);
    removed++;
  }
  return removed;
}

/** The file's hash, computed once and remembered on every row that uses it. */
export async function hashOf(repo: Repo, store: FileStore, a: Pick<Attachment, 'fileName' | 'sha256'>): Promise<string> {
  if (a.sha256) return a.sha256;
  const h = await store.sha256(a.fileName);
  await repo.setFileHash(a.fileName, h);
  return h;
}
