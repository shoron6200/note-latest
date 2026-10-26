/**
 * Photos and videos on the phone: the app's documents folder, under
 * "attachments/". Nothing here is visible to the gallery or other apps.
 */
import { Directory, File, Paths } from 'expo-file-system';

import type { FileStore, FileWriter } from './types';

const DIR = 'attachments';

function dir(): Directory {
  const d = new Directory(Paths.document, DIR);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

const fileOf = (name: string) => new File(dir(), name);

export function createFileStore(): FileStore {
  return {
    async uri(name) {
      const f = fileOf(name);
      return f.exists ? f.uri : null;
    },
    async exists(name) {
      return fileOf(name).exists;
    },
    async size(name) {
      const f = fileOf(name);
      return f.exists ? f.size : 0;
    },
    async sha256(name) {
      return fileOf(name).digest('SHA-256');
    },
    async read(name, offset, length) {
      const h = fileOf(name).open();
      try {
        h.offset = offset;
        return await h.readBytes(length);
      } finally {
        h.close();
      }
    },
    async importUri(srcUri, name) {
      const dest = fileOf(name);
      if (dest.exists) dest.delete();
      await new File(srcUri).copy(dest);
      return dest.size;
    },
    async writer(name): Promise<FileWriter> {
      const tmp = new File(Paths.cache, `${name}.partial`);
      if (tmp.exists) tmp.delete();
      tmp.create();
      return {
        append: (bytes) => tmp.write(bytes, { append: true }),
        async commit() {
          const dest = fileOf(name);
          await tmp.move(dest, { overwrite: true });
        },
        async abort() {
          if (tmp.exists) tmp.delete();
        },
      };
    },
    async remove(name) {
      const f = fileOf(name);
      if (f.exists) f.delete();
    },
    async list() {
      return dir()
        .list()
        .filter((x): x is File => x instanceof File)
        .map((f) => f.name);
    },
  };
}
