/**
 * Adding photos, videos and voice notes to a note, and cleaning up files no note uses.
 * The file is copied into the app's own store first, then the row is added,
 * so a note never points at something that is not there.
 */
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import type { Repo } from './repo';
import type { Attachment, AttachmentKind, FileStore, NewAttachment } from './types';

import { holdFile } from './fileHelpers';

export { sweepUnusedFiles } from './fileHelpers';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/webm': 'webm',
  'audio/amr': 'amr',
  'audio/3gpp': '3gp',
};

const FALLBACK_EXT: Record<AttachmentKind, string> = { image: 'jpg', video: 'mp4', audio: 'm4a' };
const FALLBACK_MIME: Record<AttachmentKind, string> = { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/mp4' };

/** What kind of attachment a file of this type becomes; null for anything else (a PDF, say). */
export function kindForMime(mime: string | null | undefined): AttachmentKind | null {
  if (!mime) return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

/** A safe extension for the stored copy: from the MIME type, else the original name. */
export function extensionFor(mime: string | undefined, fileName: string | null | undefined, kind: AttachmentKind): string {
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  return FALLBACK_EXT[kind];
}

export function mimeFor(ext: string, kind: AttachmentKind): string {
  const hit = Object.entries(EXT_BY_MIME).find(([m, e]) => e === ext && m.startsWith(`${kind}/`));
  return hit ? hit[0] : FALLBACK_MIME[kind];
}

/** A file from the camera, the gallery, another app or the recorder, to copy into a note. */
export type IncomingFile = {
  uri: string;
  kind: AttachmentKind;
  mime?: string | null;
  name?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

/**
 * Copy files into the store, then add them to the note. A file that cannot be
 * copied is counted, not fatal; if the rows cannot be added, the copies go.
 */
export async function importFiles(
  repo: Repo,
  store: FileStore,
  noteId: string,
  files: IncomingFile[],
): Promise<{ added: Attachment[]; failed: number }> {
  const list: NewAttachment[] = [];
  const releases: (() => void)[] = [];
  let failed = 0;
  for (const f of files) {
    const ext = extensionFor(f.mime ?? undefined, f.name, f.kind);
    const fileName = `${Crypto.randomUUID()}.${ext}`;
    releases.push(holdFile(fileName));
    try {
      const size = await store.importUri(f.uri, fileName);
      list.push({
        kind: f.kind,
        fileName,
        mime: f.mime && kindForMime(f.mime) === f.kind ? f.mime : mimeFor(ext, f.kind),
        size: size || f.size || 0,
        width: f.kind === 'audio' ? null : f.width || null,
        height: f.kind === 'audio' ? null : f.height || null,
        durationMs: f.kind !== 'image' && f.durationMs ? Math.round(f.durationMs) : null,
      });
    } catch {
      failed++;
      await store.remove(fileName).catch(() => undefined);
    }
  }
  try {
    const added = list.length ? await repo.addAttachments(noteId, list) : [];
    return { added, failed };
  } catch (e) {
    for (const a of list) await store.remove(a.fileName).catch(() => undefined);
    throw e;
  } finally {
    releases.forEach((r) => r());
  }
}

export type PickSource = 'camera' | 'library';
export type PickResult = { added: Attachment[]; denied: boolean; failed: number };

/** Ask for permission if needed, open the camera or gallery, and add what was chosen. */
export async function pickAndAttach(repo: Repo, store: FileStore, noteId: string, source: PickSource): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    // Originals, as chosen: no re-compression.
    quality: 1,
    exif: false,
  };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { added: [], denied: true, failed: 0 };
    res = await ImagePicker.launchCameraAsync(options);
  } else {
    res = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 30 });
  }
  if (res.canceled || !res.assets?.length) return { added: [], denied: false, failed: 0 };

  const { added, failed } = await importFiles(
    repo,
    store,
    noteId,
    res.assets.map((a) => ({
      uri: a.uri,
      kind: a.type === 'video' || a.mimeType?.startsWith('video/') ? 'video' : 'image',
      mime: a.mimeType,
      name: a.fileName,
      size: a.fileSize,
      width: a.width,
      height: a.height,
      // The picker gives a video's length in milliseconds.
      durationMs: a.duration ?? null,
    })),
  );
  return { added, denied: false, failed };
}
