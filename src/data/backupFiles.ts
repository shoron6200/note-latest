/**
 * Backup files on the phone. "Back up now" writes a JSON file and opens the
 * share sheet (Drive, Files/iCloud, email). Daily snapshots are kept in the
 * app's documents folder, which Android Auto Backup and iCloud device backup
 * include, so they reach your own cloud without any account in this app.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Repo } from './repo';

const SNAPSHOT_DIR = 'snapshots';
const KEEP_SNAPSHOTS = 7;
const DAY = 86_400_000;

const stamp = (d: Date) => d.toISOString().slice(0, 10);

/** Web preview: hand the browser a download instead of the share sheet. */
function downloadOnWeb(name: string, json: string) {
  const g = globalThis as unknown as { document?: Document; URL?: typeof URL; Blob?: typeof Blob };
  if (!g.document || !g.URL || !g.Blob) return;
  const url = g.URL.createObjectURL(new g.Blob([json], { type: 'application/json' }));
  const a = g.document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => g.URL!.revokeObjectURL(url), 1000);
}

export async function exportBackupFile(repo: Repo): Promise<'shared' | 'saved'> {
  const data = await repo.exportBackup();
  const json = JSON.stringify(data, null, 2);
  const name = `pocketleaf-backup-${stamp(new Date())}.json`;
  if (Platform.OS === 'web') {
    downloadOnWeb(name, json);
    await repo.setSetting('lastBackupAt', Date.now());
    return 'saved';
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  await repo.setSetting('lastBackupAt', Date.now());
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your backup', UTI: 'public.json' });
    return 'shared';
  }
  return 'saved';
}

/** Ask for a backup file. Returns its parsed JSON, or null if cancelled. */
export async function pickBackupFile(): Promise<unknown | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  let text: string;
  if (Platform.OS === 'web') {
    const f = (asset as unknown as { file?: Blob }).file;
    text = f ? await f.text() : await (await fetch(asset.uri)).text();
  } else {
    text = await new File(asset.uri).text();
  }
  try {
    return JSON.parse(text);
  } catch {
    return { format: 'not-json' };
  }
}

/** Write a rolling local snapshot if the last one is over a day old. */
export async function dailySnapshot(repo: Repo): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const s = await repo.getSettings();
  if (s.lastSnapshotAt && Date.now() - s.lastSnapshotAt < DAY) return false;
  const dir = new Directory(Paths.document, SNAPSHOT_DIR);
  if (!dir.exists) dir.create();
  const file = new File(dir, `snapshot-${stamp(new Date())}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(await repo.exportBackup()));
  const old = dir
    .list()
    .filter((x): x is File => x instanceof File && x.name.startsWith('snapshot-'))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(KEEP_SNAPSHOTS);
  for (const f of old) f.delete();
  await repo.setSetting('lastSnapshotAt', Date.now());
  return true;
}
