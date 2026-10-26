/**
 * Recording a voice note. Three ways, picked when the sheet opens:
 *
 * - offline: the phone has an offline speech pack for your language. Words
 *   are turned into text on the phone while the sound is recorded (Android 13+).
 * - online: no offline pack, but you allowed online speech-to-text in Settings.
 *   The phone's speech service (Google) hears the audio.
 * - sound: anything else (no pack and online not allowed, an older phone, the
 *   web preview). Only the sound is kept.
 *
 * The sheet hands back the file, its length, and the words heard.
 */
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Download, Globe, Mic, Square, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import { useRepo, useSettings } from '@/data/DataProvider';
import { useTheme, withAlpha } from '@/theme/theme';
import { Button } from '@/ui/controls';
import { durationLabel } from '@/ui/media';
import { BottomSheet } from '@/ui/overlays';
import { AppText } from '@/ui/Text';

export type Recording = { uri: string; mime: string; durationMs: number; text: string };

type Mode = 'offline' | 'online' | 'sound';
type Plan = { mode: Mode; lang: string; reason?: 'no-pack' | 'unsupported' };

const MIN_MS = 700;

/** The phone's language, as a speech locale ("sr-RS", "en-US"). */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

/** "Serbian" for "sr-RS", in the phone's own language when it can; else the code. */
function languageName(locale: string): string {
  try {
    const DisplayNames = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (c: string) => string | undefined } }).DisplayNames;
    return (DisplayNames && new DisplayNames([locale], { type: 'language' }).of(locale.split('-')[0])) || locale;
  } catch {
    return locale;
  }
}

/** The offline pack that fits the phone's language: same locale, else same language. */
export function pickInstalled(locale: string, installed: string[]): string | null {
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  const want = norm(locale);
  const exact = installed.find((l) => norm(l) === want);
  if (exact) return exact;
  const lang = want.split('-')[0];
  return installed.find((l) => norm(l).split('-')[0] === lang) ?? null;
}

async function planFor(online: boolean): Promise<Plan> {
  const lang = deviceLocale();
  if (Platform.OS === 'web') return { mode: 'sound', lang, reason: 'unsupported' };
  try {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable() || !ExpoSpeechRecognitionModule.supportsRecording()) {
      return { mode: 'sound', lang, reason: 'unsupported' };
    }
    const installed = new Set<string>();
    for (const pkg of [undefined, 'com.google.android.as']) {
      const r = await ExpoSpeechRecognitionModule.getSupportedLocales(pkg ? { androidRecognitionServicePackage: pkg } : {}).catch(() => null);
      r?.installedLocales.forEach((l) => installed.add(l));
    }
    const pack = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() ? pickInstalled(lang, [...installed]) : null;
    if (pack) return { mode: 'offline', lang: pack };
    if (online) return { mode: 'online', lang };
    return { mode: 'sound', lang, reason: 'no-pack' };
  } catch {
    return { mode: 'sound', lang, reason: 'unsupported' };
  }
}

const VOICE_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

type Phase = 'planning' | 'ready' | 'starting' | 'recording' | 'saving';

/** Mounted only while open, so every recording starts clean. */
export function VoiceSheet(props: { open: boolean; onClose: () => void; onSaved: (r: Recording) => void | Promise<void>; onError: (message: string) => void }) {
  return props.open ? <VoiceSheetBody {...props} /> : null;
}

function VoiceSheetBody({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: (r: Recording) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const t = useTheme();
  const repo = useRepo();
  const settings = useSettings();
  const online = settings?.voiceOnline ?? false;
  const recorder = useAudioRecorder(VOICE_PRESET);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [phase, setPhase] = useState<Phase>('planning');
  const [finals, setFinals] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const startedAt = useRef(0);
  const speech = useRef<{ uri: string | null; ended: boolean; resolve: (() => void) | null }>({ uri: null, ended: false, resolve: null });
  const finalsRef = useRef<string[]>([]);
  const interimRef = useRef('');

  // Work out how this recording will go, then wait for the button.
  useEffect(() => {
    if (!settings) return;
    let alive = true;
    planFor(online).then((p) => {
      if (!alive) return;
      setPlan(p);
      setPhase('ready');
    });
    return () => {
      alive = false;
    };
  }, [online, settings]);

  // The clock while recording.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(id);
  }, [phase]);

  // ------------------------------------------------ speech events
  const settle = () => {
    const s = speech.current;
    if (s.ended && s.resolve) {
      s.resolve();
      s.resolve = null;
    }
  };
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript?.trim() ?? '';
    if (e.isFinal) {
      if (text) finalsRef.current = [...finalsRef.current, text];
      interimRef.current = '';
    } else {
      interimRef.current = text;
    }
    setFinals(finalsRef.current);
    setInterim(interimRef.current);
  });
  useSpeechRecognitionEvent('audioend', (e) => {
    if (e.uri) speech.current.uri = e.uri;
  });
  useSpeechRecognitionEvent('end', () => {
    speech.current.ended = true;
    settle();
  });
  useSpeechRecognitionEvent('error', (e) => {
    // Silence or nothing recognised is not a failure: the sound is still kept.
    if (e.error === 'no-speech' || e.error === 'speech-timeout' || e.error === 'aborted') return;
    setNote(e.message || e.error);
  });

  // Closing the sheet mid-recording throws the recording away.
  useEffect(
    () => () => {
      ExpoSpeechRecognitionModule.abort?.();
    },
    [],
  );

  const start = async () => {
    if (!plan) return;
    setPhase('starting');
    setNote(null);
    try {
      if (plan.mode === 'sound') {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error(copy.voice.denied);
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } else {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) throw new Error(copy.voice.denied);
        speech.current = { uri: null, ended: false, resolve: null };
        finalsRef.current = [];
        interimRef.current = '';
        ExpoSpeechRecognitionModule.start({
          lang: plan.lang,
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
          requiresOnDeviceRecognition: plan.mode === 'offline',
          addsPunctuation: plan.mode === 'offline',
          recordingOptions: { persist: true },
        });
      }
      startedAt.current = Date.now();
      setElapsed(0);
      setPhase('recording');
    } catch (e) {
      setPhase('ready');
      onError((e as Error).message || copy.voice.failed);
    }
  };

  const stop = async () => {
    const durationMs = Date.now() - startedAt.current;
    setPhase('saving');
    try {
      let uri: string | null = null;
      let mime = 'audio/wav';
      if (plan?.mode === 'sound') {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        uri = recorder.uri;
        mime = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      } else {
        // Wait for the last words and the file (at most a few seconds).
        await new Promise<void>((resolve) => {
          speech.current.resolve = resolve;
          ExpoSpeechRecognitionModule.stop();
          settle();
          setTimeout(resolve, 5000);
        });
        uri = speech.current.uri;
      }
      if (durationMs < MIN_MS) {
        onError(copy.voice.tooShort);
        onClose();
        return;
      }
      if (!uri) throw new Error(copy.voice.failed);
      const text = [...finalsRef.current, interimRef.current].filter(Boolean).join(' ').trim();
      await onSaved({ uri, mime, durationMs, text });
      onClose();
    } catch (e) {
      onError((e as Error).message || copy.voice.failed);
      onClose();
    }
  };

  const discard = async () => {
    if (phase === 'recording') {
      if (plan?.mode === 'sound') await recorder.stop().catch(() => undefined);
      else ExpoSpeechRecognitionModule.abort();
    }
    onClose();
  };

  const downloadPack = async () => {
    if (!plan) return;
    try {
      await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: plan.lang });
      setNote(copy.voice.downloading);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const heard = [...finals, interim].filter(Boolean).join(' ');
  const busy = phase === 'planning' || phase === 'starting' || phase === 'saving';

  return (
    <BottomSheet open onClose={discard} title={copy.voice.title}>
      <View style={{ paddingHorizontal: t.space[4], paddingBottom: t.space[4], gap: t.space[3] }}>
        <View style={styles.center}>
          <View
            style={[
              styles.mic,
              {
                backgroundColor: phase === 'recording' ? withAlpha(t.color.danger, 0.14) : withAlpha(t.color.accent, 0.12),
              },
            ]}
            aria-hidden
          >
            <Mic size={36} color={phase === 'recording' ? t.color.danger : t.color.accent} />
          </View>
          <AppText variant="xl" weight="700" style={{ fontVariant: ['tabular-nums'] }} aria-live="polite">
            {durationLabel(Math.max(elapsed, 1)) ?? '0:00'}
          </AppText>
          <AppText variant="sm" tone="muted" style={{ textAlign: 'center' }}>
            {phase === 'recording'
              ? copy.voice.recording
              : phase === 'starting'
                ? copy.voice.starting
                : phase === 'saving'
                  ? copy.voice.saving
                  : plan?.mode === 'offline'
                    ? copy.voice.offline
                    : plan?.mode === 'online'
                      ? copy.voice.online
                      : plan?.reason === 'no-pack'
                        ? copy.voice.noPack(languageName(plan.lang))
                        : plan
                          ? copy.voice.soundOnly
                          : ''}
          </AppText>
        </View>

        {plan?.mode !== 'sound' && heard ? (
          <View style={{ gap: 4 }}>
            <AppText variant="xs" weight="700" tone="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {copy.voice.heard}
            </AppText>
            <ScrollView style={{ maxHeight: 120 }}>
              <AppText aria-live="polite">{heard}</AppText>
            </ScrollView>
          </View>
        ) : null}

        {note ? (
          <AppText variant="sm" tone="muted" role="status">
            {note}
          </AppText>
        ) : null}

        {phase === 'ready' && plan?.reason === 'no-pack' ? (
          <View style={{ gap: t.space[2] }}>
            {Platform.OS === 'android' ? <Button label={copy.voice.download} icon={Download} variant="secondary" size="sm" onPress={downloadPack} /> : null}
            <Button label={copy.voice.allowOnline} icon={Globe} variant="text" size="sm" onPress={() => repo.setSetting('voiceOnline', true)} />
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label={copy.voice.discard} icon={X} variant="secondary" onPress={discard} disabled={phase === 'saving'} />
          {phase === 'recording' ? (
            <Button label={copy.voice.stop} icon={Square} variant="danger" onPress={stop} />
          ) : (
            <Button label={copy.voice.start} icon={Mic} onPress={start} disabled={busy || !plan} loading={busy} />
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 8 },
  mic: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});


export { discardTempRecording } from '@/data/tempFile';
