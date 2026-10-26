/**
 * Things shared to Pocketleaf from other apps (Android "Share → Pocketleaf"):
 * text, a link, photos, videos or a recording. expo-share-intent receives
 * them; this file turns them into one simple shape for the Save screen.
 * The web preview has its own version (incomingShare.web.tsx).
 */
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import type { ReactNode } from 'react';

import { kindForMime } from '@/data/attachments';

import type { Incoming } from './incomingShareTypes';

export type { Incoming, IncomingShareFile } from './incomingShareTypes';

export function IncomingShareProvider({ children }: { children: ReactNode }) {
  // Kept until the Save screen saves or discards it, even if you switch apps meanwhile.
  return <ShareIntentProvider options={{ resetOnBackground: false }}>{children}</ShareIntentProvider>;
}

export function useIncomingShare(): { share: Incoming | null; clear: () => void } {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  if (!hasShareIntent) return { share: null, clear: () => resetShareIntent() };
  const text = shareIntent.text?.trim() || null;
  return {
    share: {
      text,
      url: shareIntent.webUrl ?? null,
      title: shareIntent.meta?.title?.trim() || null,
      files: (shareIntent.files ?? []).map((f) => ({
        uri: f.path,
        mime: f.mimeType,
        name: f.fileName,
        size: f.size,
        width: f.width,
        height: f.height,
        durationMs: f.duration,
        kind: kindForMime(f.mimeType),
      })),
    },
    clear: () => resetShareIntent(),
  };
}
