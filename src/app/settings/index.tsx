/** S12 Settings: theme, view, sort, folders, trash, backup, voice notes, reminders, about. */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useRepo, useSettings } from '@/data/DataProvider';
import { initTelegram, useTelegram } from '@/data/telegramRunner';
import { getReminderPermission, openAppSettings, type ReminderPermission } from '@/data/notifications';
import type { Sort, ThemeSetting } from '@/data/types';
import { useTheme } from '@/theme/theme';
import { Segmented, SettingsRow } from '@/ui/controls';
import { TopBar } from '@/ui/layout';
import { AppText } from '@/ui/Text';
import { whenLabel } from '@/ui/format';

function Group({ title, children }: { title?: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2], marginBottom: t.space[6] }}>
      {title ? (
        <AppText variant="xs" weight="700" tone="muted" role="heading" style={{ textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: t.space[1] }}>
          {title}
        </AppText>
      ) : null}
      <View style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.color.border }}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const repo = useRepo();
  const settings = useSettings();
  const [perm, setPerm] = useState<ReminderPermission | null>(null);
  const tg = useTelegram();

  useEffect(() => {
    const check = () => getReminderPermission().then(setPerm).catch(() => setPerm(null));
    check();
    initTelegram();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  if (!settings) return <View style={{ flex: 1, backgroundColor: t.color.bg }} />;
  const permText =
    perm?.notifications === 'granted' ? copy.settings.remindersOn : perm?.notifications === 'denied' ? copy.settings.remindersOff : copy.settings.remindersAsk;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar onBack={() => router.back()} title={copy.settings.title} />
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: t.layout.gutter }}>
        <View style={{ width: '100%', maxWidth: t.layout['editor-max-width'] }}>
          <Group title={copy.settings.theme}>
            <View style={{ padding: t.space[3] }}>
              <Segmented<ThemeSetting>
                label={copy.settings.theme}
                value={settings.theme}
                onChange={(v) => repo.setSetting('theme', v)}
                options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: copy.settings.themes[v] }))}
              />
            </View>
          </Group>

          <Group title={copy.home.title}>
            <SettingsRow title={copy.settings.view} toggle={settings.viewMode === 'grid'} onToggle={(v) => repo.setSetting('viewMode', v ? 'grid' : 'list')} />
            <View style={{ padding: t.space[3], gap: t.space[2] }}>
              <AppText variant="sm" tone="muted">
                {copy.settings.sort}
              </AppText>
              <Segmented<Sort>
                label={copy.settings.sort}
                value={settings.sort}
                onChange={(v) => repo.setSetting('sort', v)}
                options={(['updated', 'created', 'title'] as const).map((v) => ({ value: v, label: copy.settings.sorts[v] }))}
              />
            </View>
            <SettingsRow title={copy.settings.folders} onPress={() => router.push('/folders')} />
            <SettingsRow title={copy.settings.trash} onPress={() => router.push('/trash')} />
          </Group>

          <Group title={copy.settings.backup}>
            <SettingsRow
              title={copy.settings.backup}
              subtitle={copy.backup.last(settings.lastBackupAt ? whenLabel(settings.lastBackupAt) : null)}
              onPress={() => router.push('/settings/backup')}
            />
            <SettingsRow
              title={copy.settings.telegram}
              subtitle={tg.link ? copy.telegram.rowOn(tg.link.botName) : tg.ready && !tg.supported ? copy.telegram.webOnly : copy.telegram.rowOff}
              onPress={() => router.push('/settings/telegram')}
            />
          </Group>

          <Group title={copy.settings.voice}>
            <SettingsRow
              title={copy.settings.voiceOnline}
              subtitle={copy.settings.voiceOnlineHint}
              toggle={settings.voiceOnline}
              onToggle={(v) => repo.setSetting('voiceOnline', v)}
            />
          </Group>

          <Group title={copy.settings.reminders}>
            <SettingsRow title={copy.settings.reminders} subtitle={permText} value={perm?.notifications === 'granted' ? undefined : copy.reminder.openSettings} onPress={openAppSettings} />
          </Group>

          <Group title={copy.settings.about}>
            <View style={{ padding: t.space[4], gap: t.space[2] }}>
              <AppText>{copy.settings.aboutBody}</AppText>
              <AppText variant="sm" tone="muted">
                {copy.settings.version(Constants.expoConfig?.version ?? '1.0.0')}
              </AppText>
            </View>
          </Group>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
