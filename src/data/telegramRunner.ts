/**
 * One Telegram job at a time (connect, backup or restore), its progress for
 * the screens, and the daily automatic backup. Wi-Fi or mobile data both
 * count, as asked; it only needs the internet to be reachable.
 */
import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { copy } from '../copy';
import { createFileStore } from './fileStore';
import type { Repo } from './repo';
import {
  backupToTelegram,
  findChat,
  NeedsStartError,
  NoBackupFoundError,
  restoreFromTelegram,
  TelegramError,
  type BackupResult,
  type Progress,
  type RestoreResult,
} from './telegram';
import {
  clearCredentials,
  createTransport,
  getLink,
  getToken,
  looksLikeToken,
  saveCredentials,
  sha256Bytes,
  telegramSupported,
  type TelegramLink,
} from './telegramApi';
import type { FileStore } from './types';

export type TelegramState = {
  ready: boolean;
  supported: boolean;
  link: TelegramLink | null;
  busy: null | 'connect' | 'backup' | 'restore';
  progress: Progress | null;
  /** Plain-language problem from the last job, if it failed. */
  error: string | null;
  lastBackup: BackupResult | null;
  lastRestore: RestoreResult | null;
};

let state: TelegramState = {
  ready: false,
  supported: false,
  link: null,
  busy: null,
  progress: null,
  error: null,
  lastBackup: null,
  lastRestore: null,
};
const listeners = new Set<() => void>();
function set(patch: Partial<TelegramState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let storeSingleton: FileStore | null = null;
export const appFileStore = () => (storeSingleton ??= createFileStore());

export function useTelegram(): TelegramState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => state,
  );
}

export async function initTelegram() {
  if (state.ready) return;
  const supported = Platform.OS !== 'web' && (await telegramSupported().catch(() => false));
  set({ ready: true, supported, link: supported ? await getLink() : null });
}

/** What went wrong, in words for the screen. Never includes the token. */
export function explain(e: unknown): string {
  const t = copy.telegram.errors;
  if (e instanceof NeedsStartError) return t.needsStart;
  if (e instanceof NoBackupFoundError) return t.noBackup;
  if (e instanceof TelegramError) {
    if (e.code === 401 || e.code === 404) return t.badToken;
    if (e.code === 403) return t.blocked;
    if (e.code === 0) return t.network;
    if (e.code === 429) return t.slowDown;
    return t.generic(e.message);
  }
  return t.generic(e instanceof Error ? e.message : String(e));
}

async function deps(repo: Repo) {
  const token = await getToken();
  const link = state.link ?? (await getLink());
  if (!token || !link) throw new TelegramError(401, 'not connected');
  return {
    repo,
    store: appFileStore(),
    tx: createTransport(token),
    chatId: link.chatId,
    sha256Bytes,
    onProgress: (p: Progress) => set({ progress: p }),
  };
}

async function run<T>(kind: 'connect' | 'backup' | 'restore', job: () => Promise<T>): Promise<T | null> {
  if (state.busy) return null;
  set({ busy: kind, progress: null, error: null });
  try {
    return await job();
  } catch (e) {
    set({ error: explain(e) });
    return null;
  } finally {
    set({ busy: null, progress: null });
  }
}

export function connectTelegram(repo: Repo, token: string): Promise<TelegramLink | null> {
  return run('connect', async () => {
    const clean = token.trim();
    if (!looksLikeToken(clean)) throw new TelegramError(401, 'bad token');
    const found = await findChat(createTransport(clean));
    const previous = state.link;
    // Another chat or bot: files sent to the old one can't be reused.
    if (!previous || previous.chatId !== found.chatId || previous.botName !== found.botName) await repo.forgetTelegramFiles();
    await saveCredentials(clean, found);
    set({ link: found });
    return found;
  });
}

export async function disconnectTelegram(repo: Repo) {
  await clearCredentials();
  await repo.forgetTelegramFiles();
  set({ link: null, lastBackup: null, lastRestore: null, error: null });
}

export function backupNow(repo: Repo): Promise<BackupResult | null> {
  return run('backup', async () => {
    const r = await backupToTelegram(await deps(repo));
    set({ lastBackup: r });
    return r;
  });
}

export function restoreNow(repo: Repo): Promise<RestoreResult | null> {
  return run('restore', async () => {
    const r = await restoreFromTelegram(await deps(repo));
    set({ lastRestore: r });
    return r;
  });
}

const AUTO_EVERY = 23 * 3_600_000;

/** Called on launch and on every return to the app. Quiet: errors only show on the Telegram screen. */
export async function autoBackup(repo: Repo) {
  await initTelegram();
  if (!state.supported || !state.link || state.busy) return;
  const s = await repo.getSettings();
  if (!s.telegramAuto) return;
  if (s.lastTelegramAt && Date.now() - s.lastTelegramAt < AUTO_EVERY) return;
  const net = await Network.getNetworkStateAsync().catch(() => null);
  if (!net?.isConnected || net.isInternetReachable === false) return;
  await backupNow(repo);
}
