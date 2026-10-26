/**
 * Text in photos, read on this phone: Google ML Kit on Android, Apple Vision
 * on iOS. Nothing is uploaded. The web preview has no reader, so photos stay
 * unread there (and are read later on a phone, after a restore).
 */
import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import { Platform } from 'react-native';

import { createPhotoQueue } from './photoQueue';
import type { Repo } from './repo';
import type { FileStore } from './types';

export const photoTextSupported = Platform.OS !== 'web' && isSupported;

const queue = createPhotoQueue(extractTextFromImage);

export function readPendingPhotos(repo: Repo, store: FileStore): Promise<number> {
  return photoTextSupported ? queue.run(repo, store) : Promise.resolve(0);
}
