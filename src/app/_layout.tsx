import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseZap } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { DataProvider, useRepo, useSettings } from '@/data/DataProvider';
import { IncomingShareProvider, useIncomingShare } from '@/features/incomingShare';
import { useNoteFonts } from '@/theme/fonts';
import { ModeSetterContext } from '@/theme/mode';
import { ModeContext, useTheme } from '@/theme/theme';
import { EmptyState } from '@/ui/layout';
import { SnackbarHost } from '@/ui/snackbar';

/** Something shared from another app: open the Save screen over whatever is showing. */
function ShareWatcher() {
  const has = !!useIncomingShare().share;
  useEffect(() => {
    if (!has) return;
    // After the first frame, so the navigator is mounted on a cold start.
    const id = setTimeout(() => router.push('/share'), 0);
    return () => clearTimeout(id);
  }, [has]);
  return null;
}

function Screens() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <SnackbarHost>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.color.bg }, animation: 'default' }} />
        <ShareWatcher />
      </SnackbarHost>
    </>
  );
}

/** The stored theme setting drives every screen. */
function ThemedFromSettings() {
  const repo = useRepo();
  const settings = useSettings();
  return (
    <ModeContext.Provider value={settings?.theme ?? 'system'}>
      <ModeSetterContext.Provider value={(m) => repo.setSetting('theme', m)}>
        <Screens />
      </ModeSetterContext.Provider>
    </ModeContext.Provider>
  );
}

function StartupFallback({ error }: { error: Error | null }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center', padding: t.space[4] }}>
      {error ? (
        /Access Handle|createSyncAccessHandle|database is locked/i.test(error.message) ? (
          <EmptyState icon={DatabaseZap} title={copy.home.otherTabTitle} body={copy.home.otherTabBody} />
        ) : (
          <EmptyState icon={DatabaseZap} title={copy.home.loadError} body={error.message} />
        )
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const fontsLoaded = useNoteFonts();
  return (
    <IncomingShareProvider>
      <SafeAreaProvider>
        {fontsLoaded ? (
          <DataProvider fallback={(e) => <StartupFallback error={e} />}>
            <ThemedFromSettings />
          </DataProvider>
        ) : null}
      </SafeAreaProvider>
    </IncomingShareProvider>
  );
}
