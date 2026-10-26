import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { sweepUnusedFiles } from './attachments';
import { dailySnapshot } from './backupFiles';
import { openAppDb } from './expoDb';
import { readPendingPhotos } from './photoText';
import { migrate } from './migrations';
import { createScheduler, listenForReminders, setupNotifications } from './notifications';
import { createRepo, type Repo } from './repo';
import { seedIfEmpty } from './seed';
import { appFileStore, autoBackup } from './telegramRunner';
import type { Settings } from './types';

const RepoContext = createContext<Repo | null>(null);

export function useRepo(): Repo {
  const r = useContext(RepoContext);
  if (!r) throw new Error('useRepo outside DataProvider');
  return r;
}

/**
 * Run a read and re-run it after every write anywhere in the app.
 * `data` is undefined only on the first load (so screens can show a skeleton).
 * `deps` are the values the read depends on, like a hook dependency list.
 */
export function useQuery<T>(fn: (repo: Repo) => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | null; reload: () => void } {
  const repo = useRepo();
  const [state, setState] = useState<{ data: T | undefined; error: Error | null }>({ data: undefined, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(deps);
  const load = useEffectEvent(() => fn(repo));
  useEffect(() => {
    let version = 0;
    let alive = true;
    const run = () => {
      const mine = ++version;
      load().then(
        (data) => alive && mine === version && setState({ data, error: null }),
        (error: Error) => alive && mine === version && setState((s) => ({ data: s.data, error })),
      );
    };
    run();
    const unsubscribe = repo.subscribe(run);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [repo, key, tick]);
  return { data: state.data, error: state.error, reload: () => setTick((n) => n + 1) };
}

export function useSettings(): Settings | undefined {
  return useQuery((r) => r.getSettings(), []).data;
}

function demoRequested(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').has('demo');
  } catch {
    return false;
  }
}

/** Housekeeping on launch and on every return to the foreground. */
async function onForeground(repo: Repo) {
  await repo.reconcileReminders().catch(() => undefined);
  await repo.purgeTrash().catch(() => undefined);
  await dailySnapshot(repo).catch(() => undefined);
  await sweepUnusedFiles(repo, appFileStore()).catch(() => undefined);
  // Photos added or restored since last time: read their text for search.
  await readPendingPhotos(repo, appFileStore()).catch(() => undefined);
  // Last, and not awaited by anyone: it may take a while on a slow connection.
  await autoBackup(repo).catch(() => undefined);
}

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: (error: Error | null) => ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = await openAppDb();
      const { fts } = await migrate(db);
      const r = createRepo({ db, fts, newId: () => Crypto.randomUUID(), scheduler: createScheduler() });
      if (demoRequested()) await seedIfEmpty(r);
      await setupNotifications().catch(() => undefined);
      if (alive) setRepo(r);
      onForeground(r);
    })().catch((e: Error) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, []);

  // Foreground housekeeping.
  useEffect(() => {
    if (!repo) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') onForeground(repo);
    });
    return () => sub.remove();
  }, [repo]);

  // After changes settle: files no note uses any more (after "Delete for good",
  // "Empty trash", …) go, and new photos get their text read.
  useEffect(() => {
    if (!repo) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = repo.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        sweepUnusedFiles(repo, appFileStore()).catch(() => undefined);
        readPendingPhotos(repo, appFileStore()).catch(() => undefined);
      }, 3000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [repo]);

  // Reminders: delivered while open, or tapped (also when the tap launched the app).
  useEffect(() => {
    if (!repo) return;
    return listenForReminders(
      (id) => {
        repo.reminderFired(id).catch(() => undefined);
      },
      (id) => {
        repo.reminderFired(id).catch(() => undefined);
        router.push({ pathname: '/note/[id]', params: { id } });
      },
    );
  }, [repo]);

  if (!repo) return <>{fallback(error)}</>;
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}
