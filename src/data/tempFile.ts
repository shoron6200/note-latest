/** A recorder's own copy of a file, once the note has its own: no need to keep both. */
import { File } from 'expo-file-system';

export function discardTempRecording(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Left in the cache folder; the phone clears that on its own.
  }
}
