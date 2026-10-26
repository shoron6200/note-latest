import type { AttachmentKind } from '@/data/types';

export type IncomingShareFile = {
  uri: string;
  mime: string | null;
  name: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** null: not a photo, video or recording (a PDF, say), so it is left out. */
  kind: AttachmentKind | null;
};

export type Incoming = {
  text: string | null;
  url: string | null;
  /** The page or item title the other app sent, if any. */
  title: string | null;
  files: IncomingShareFile[];
};

/** Title and note text for a share: a link keeps its page title; plain text is the note. */
export function draftFor(s: Incoming): { title: string; body: string } {
  const body = (s.text ?? s.url ?? '').trim();
  const title = (s.title ?? '').trim();
  return { title: title && title !== body ? title : '', body };
}
