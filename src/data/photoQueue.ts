/**
 * The queue behind "text in photos" (photoText.ts holds the native reader).
 * Each photo is read once; what it says goes into search. A photo whose file
 * is missing (a restore still downloading) or that fails is skipped for the
 * rest of this session and tried again on the next launch.
 */
import type { Repo } from './repo';
import type { FileStore } from './types';

/** Lines the reader returns become one text; blank lines and extra spaces go. */
export function joinBlocks(blocks: string[]): string {
  return blocks
    .map((b) => b.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const BATCH = 20;

export function createPhotoQueue(read: (uri: string) => Promise<string[]>) {
  const skipped = new Set<string>();
  let running: Promise<number> | null = null;
  let again = false;

  /** Read every photo not read yet. Returns how many were read. Safe to call often. */
  function run(repo: Repo, store: FileStore): Promise<number> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      let done = 0;
      do {
        again = false;
        const batch = (await repo.unreadPhotos(BATCH + skipped.size)).filter((a) => !skipped.has(a.fileName)).slice(0, BATCH);
        for (const a of batch) {
          const uri = await store.uri(a.fileName).catch(() => null);
          if (!uri) {
            skipped.add(a.fileName);
            continue;
          }
          try {
            await repo.setPhotoText(a.fileName, joinBlocks(await read(uri)));
            done++;
          } catch {
            skipped.add(a.fileName);
          }
        }
        if (batch.length === BATCH) again = true;
      } while (again);
      return done;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return { run };
}
