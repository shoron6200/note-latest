/**
 * Web preview only: photos and videos kept in IndexedDB, so they survive a
 * reload like the notes do. Telegram backup is phone-only.
 */
import type { FileStore, FileWriter } from './types';

const DB = 'pocketleaf-files';
const STORE = 'files';

let opening: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const getBlob = (name: string) => tx<Blob | undefined>('readonly', (s) => s.get(name) as IDBRequest<Blob | undefined>);
const putBlob = (name: string, b: Blob) => tx('readwrite', (s) => s.put(b, name));

/** One object URL per file for the life of the page. */
const urls = new Map<string, string>();

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function createFileStore(): FileStore {
  return {
    async uri(name) {
      const cached = urls.get(name);
      if (cached) return cached;
      const b = await getBlob(name);
      if (!b) return null;
      const u = URL.createObjectURL(b);
      urls.set(name, u);
      return u;
    },
    async exists(name) {
      return !!(await getBlob(name));
    },
    async size(name) {
      return (await getBlob(name))?.size ?? 0;
    },
    async sha256(name) {
      const b = await getBlob(name);
      if (!b) throw new Error('missing file');
      return hex(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()));
    },
    async read(name, offset, length) {
      const b = await getBlob(name);
      if (!b) throw new Error('missing file');
      return new Uint8Array(await b.slice(offset, offset + length).arrayBuffer());
    },
    async importUri(srcUri, name) {
      const b = await (await fetch(srcUri)).blob();
      await putBlob(name, b);
      return b.size;
    },
    async writer(name): Promise<FileWriter> {
      const parts: BlobPart[] = [];
      return {
        async append(bytes) {
          parts.push(bytes.slice());
        },
        async commit() {
          await putBlob(name, new Blob(parts));
        },
        async abort() {
          parts.length = 0;
        },
      };
    },
    async remove(name) {
      const u = urls.get(name);
      if (u) URL.revokeObjectURL(u);
      urls.delete(name);
      await tx('readwrite', (s) => s.delete(name));
    },
    async list() {
      return (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String);
    },
  };
}
