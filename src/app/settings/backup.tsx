/** S13 Back up and restore. A backup is one JSON file you keep where you like. */
import { router } from 'expo-router';
import { DownloadCloud, UploadCloud } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { exportBackupFile, pickBackupFile } from '@/data/backupFiles';
import { useRepo, useSettings } from '@/data/DataProvider';
import { validateBackup } from '@/data/repo';
import { BackupFormatError } from '@/data/types';
import { useTheme } from '@/theme/theme';
import { Button } from '@/ui/controls';
import { whenLabel } from '@/ui/format';
import { Banner, TopBar } from '@/ui/layout';
import { Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

export default function BackupScreen() {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const settings = useSettings();
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ data: unknown; notes: number } | null>(null);

  const backup = async () => {
    setBusy('backup');
    setError(null);
    try {
      await exportBackupFile(repo);
      snack(copy.backup.saved);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    setError(null);
    setBusy('restore');
    try {
      const data = await pickBackupFile();
      if (data === null) return;
      const parsed = validateBackup(data);
      setCandidate({ data, notes: parsed.notes.length });
    } catch (e) {
      const msg = String((e as Error).message);
      setError(e instanceof BackupFormatError && /newer/.test(msg) ? copy.backup.newerFile : copy.backup.badFile);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!candidate) return;
    setBusy('restore');
    try {
      const r = await repo.importBackup(candidate.data);
      await repo.reconcileReminders();
      setCandidate(null);
      snack(copy.backup.restored(r.added, r.updated));
    } catch {
      setError(copy.backup.badFile);
      setCandidate(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar onBack={() => router.back()} title={copy.backup.title} />
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: t.layout.gutter }}>
        <View style={{ width: '100%', maxWidth: t.layout['editor-max-width'], gap: t.space[5] }}>
          <AppText>{copy.backup.intro}</AppText>
          <AppText variant="sm" tone="muted">
            {copy.backup.mediaNote}
          </AppText>

          <View style={[styles.card, { backgroundColor: t.color.surfaceRaised, borderColor: t.color.border, borderRadius: t.radius.md, padding: t.space[4], gap: t.space[3] }]}>
            <AppText variant="sm" tone="muted">
              {copy.backup.last(settings?.lastBackupAt ? whenLabel(settings.lastBackupAt) : null)}
            </AppText>
            <Button label={copy.backup.now} icon={UploadCloud} onPress={backup} loading={busy === 'backup'} />
            <Button label={copy.backup.restore} icon={DownloadCloud} variant="secondary" onPress={pick} loading={busy === 'restore'} />
          </View>

          {error && <Banner tone="danger" message={error} />}

          <View style={{ gap: t.space[2] }}>
            <AppText variant="lg" role="heading">
              {copy.backup.autoTitle}
            </AppText>
            <AppText tone="muted">{copy.backup.autoBody}</AppText>
          </View>
        </View>
      </ScrollView>

      <Dialog
        open={!!candidate}
        title={copy.backup.restoreTitle}
        body={copy.backup.restoreBody(candidate?.notes ?? 0)}
        cancel={{ label: copy.common.cancel, onPress: () => setCandidate(null) }}
        confirm={{ label: copy.backup.restoreConfirm, onPress: restore, loading: busy === 'restore' }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});
