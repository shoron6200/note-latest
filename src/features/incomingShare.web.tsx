/**
 * The web preview has no share sheet. For trying the Save screen in a
 * browser (and for the end-to-end tests), a share can be handed in through
 * `window.__pocketleafShare` before the page loads.
 */
import { useSyncExternalStore, type ReactNode } from 'react';

import { kindForMime } from '@/data/attachments';

import type { Incoming } from './incomingShareTypes';

export type { Incoming, IncomingShareFile } from './incomingShareTypes';

type WebShare = { text?: string; url?: string; title?: string; files?: { uri: string; mime: string; name?: string }[] };

function read(): Incoming | null {
  const raw = (globalThis as { __pocketleafShare?: WebShare }).__pocketleafShare;
  if (!raw) return null;
  return {
    text: raw.text ?? null,
    url: raw.url ?? null,
    title: raw.title ?? null,
    files: (raw.files ?? []).map((f) => ({
      uri: f.uri,
      mime: f.mime,
      name: f.name ?? null,
      size: null,
      width: null,
      height: null,
      durationMs: null,
      kind: kindForMime(f.mime),
    })),
  };
}

export function IncomingShareProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// One share for the whole app: the home screen sees it arrive, the Save screen clears it.
let current: Incoming | null | undefined;
const listeners = new Set<() => void>();
const snapshot = () => (current === undefined ? (current = read()) : current);

export function useIncomingShare(): { share: Incoming | null; clear: () => void } {
  const share = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot,
  );
  return {
    share,
    clear: () => {
      delete (globalThis as { __pocketleafShare?: WebShare }).__pocketleafShare;
      current = null;
      listeners.forEach((l) => l());
    },
  };
}
