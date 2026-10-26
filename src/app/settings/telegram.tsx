/**
 * Telegram backup: connect your own bot, back up now or daily, restore.
 * The token is typed here and kept in the phone's secure storage only.
 */
import { router } from 'expo-router';
import { DownloadCloud, Link2, LogOut, Send, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useRepo, useSettings } from '@/data/DataProvider';
import {
  backupNow,
  connectTelegram,
  disconnectTelegram,
  initTelegram,
  restoreNow,
  useTelegram,
  type TelegramState,
} from '@/data/telegramRunner';
import { useTheme } from '@/theme/theme';
import { Button, SettingsRow } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { whenLabel } from '@/ui/format';
import { Banner, TopBar } from '@/ui/layout';
import { Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

const T = copy.telegram;

function progressText(s: TelegramState): string | null {
  if (!s.busy) return null;
  if (s.busy === 'connect') return T.progress.connect;
  const p = s.progress;
  if (!p) return T.progress.finish;
  if (p.phase === 'files') return T.progress.files(p.done, p.total);
  if (p.phase === 'notes') return T.progress.notes;
  return T.progress.finish;
}

function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.color.surfaceRaised,
        borderColor: t.color.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: t.radius.md,
        padding: t.space[4],
        gap: t.space[3],
      }}
    >
      {children}
    </View>
  );
}

export default function TelegramScreen() {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const settings = useSettings();
  const tg = useTelegram();
  const [token, setToken] = useState('');
  const [ask, setAsk] = useState<'restore' | 'disconnect' | null>(null);

  useEffect(() => {
    initTelegram();
  }, []);

  const connect = async () => {
    const link = await connectTelegram(repo, token);
    if (link) {
      setToken('');
      snack(T.connected(link.chatName));
    }
  };

  const backup = async () => {
    const r = await backupNow(repo);
    if (r) snack(T.backedUp(r.filesSent, r.filesReused));
  };

  const restore = async () => {
    setAsk(null);
    const r = await restoreNow(repo);
    if (r) {
      await repo.reconcileReminders().catch(() => undefined);
      snack(T.restored(r.added, r.updated, r.filesRestored));
    }
  };

  const disconnect = async () => {
    setAsk(null);
    await disconnectTelegram(repo);
    snack(T.disconnected);
  };

  const busyText = progressText(tg);
  const last = tg.lastBackup;
  const problems = tg.lastRestore ? T.restoreProblems(tg.lastRestore.filesMissing, tg.lastRestore.filesFailed) : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar onBack={() => router.back()} title={T.title} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center', padding: t.layout.gutter }}>
        <View style={{ width: '100%', maxWidth: t.layout['editor-max-width'], gap: t.space[5] }}>
          <AppText>{T.intro}</AppText>

          {tg.ready && !tg.supported ? <Banner message={T.webOnly} /> : null}

          {tg.supported && !tg.link ? (
            <Card>
              <AppText variant="lg" role="heading">
                {T.stepsTitle}
              </AppText>
              {[T.step1, T.step2, T.step3].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: t.space[2] }}>
                  <AppText weight="700" tone="muted">
                    {i + 1}.
                  </AppText>
                  <AppText style={{ flex: 1 }}>{s}</AppText>
                </View>
              ))}
              <TextField
                label={T.tokenLabel}
                placeholder={T.tokenPlaceholder}
                value={token}
                onChangeText={setToken}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
                importantForAutofill="no"
                onSubmitEditing={connect}
              />
              <View style={{ flexDirection: 'row', gap: t.space[2], alignItems: 'flex-start' }}>
                <ShieldCheck size={18} color={t.color.textMuted} />
                <AppText variant="sm" tone="muted" style={{ flex: 1 }}>
                  {T.tokenSafe}
                </AppText>
              </View>
              <Button label={T.connect} icon={Link2} onPress={connect} loading={tg.busy === 'connect'} disabled={!token.trim() || !!tg.busy} />
            </Card>
          ) : null}

          {tg.supported && tg.link ? (
            <>
              <Card>
                <AppText weight="600">{T.status(tg.link.botName, tg.link.chatName)}</AppText>
                <AppText variant="sm" tone="muted">
                  {T.last(settings?.lastTelegramAt ? whenLabel(settings.lastTelegramAt) : null)}
                </AppText>
                {busyText ? (
                  <AppText variant="sm" aria-live="polite">
                    {busyText}
                  </AppText>
                ) : null}
                <Button label={T.now} icon={Send} onPress={backup} loading={tg.busy === 'backup'} disabled={!!tg.busy} />
                <Button
                  label={T.restore}
                  icon={DownloadCloud}
                  variant="secondary"
                  onPress={() => setAsk('restore')}
                  loading={tg.busy === 'restore'}
                  disabled={!!tg.busy}
                />
              </Card>

              {last && last.filesMissing > 0 ? <Banner message={T.missingFiles(last.filesMissing)} /> : null}
              {problems ? <Banner message={problems} /> : null}

              <View style={{ borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.color.surfaceRaised }}>
                <SettingsRow
                  title={T.auto}
                  subtitle={T.autoHint}
                  toggle={settings?.telegramAuto ?? true}
                  onToggle={(v) => repo.setSetting('telegramAuto', v)}
                />
              </View>

              <Button label={T.disconnect} icon={LogOut} variant="text" onPress={() => setAsk('disconnect')} disabled={!!tg.busy} />
            </>
          ) : null}

          {tg.error ? <Banner tone="danger" message={tg.error} /> : null}
        </View>
      </ScrollView>

      <Dialog
        open={ask === 'restore'}
        title={T.restoreTitle}
        body={T.restoreBody}
        cancel={{ label: copy.common.cancel, onPress: () => setAsk(null) }}
        confirm={{ label: T.restoreConfirm, onPress: restore }}
      />
      <Dialog
        open={ask === 'disconnect'}
        title={T.disconnectTitle}
        body={T.disconnectBody}
        cancel={{ label: copy.common.cancel, onPress: () => setAsk(null) }}
        confirm={{ label: T.disconnect, onPress: disconnect, variant: 'danger' }}
      />
    </SafeAreaView>
  );
}
