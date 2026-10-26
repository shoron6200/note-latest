/**
 * Voice notes in a note: one row each with play / pause, a progress bar,
 * the time, and delete. One recording plays at a time.
 */
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Mic, Pause, Play, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import type { Attachment } from '@/data/types';
import { useTheme, withAlpha } from '@/theme/theme';

import { IconButton } from './controls';
import { durationLabel, useFileUri } from './media';
import { Dialog } from './overlays';
import { AppText, focusRing, type PState } from './Text';

// Only one row plays at a time: starting one pauses the one before.
let pauseOther: (() => void) | null = null;

export function VoiceNotes({ items, onRemove }: { items: Attachment[]; onRemove?: (a: Attachment) => void }) {
  const t = useTheme();
  const voice = items.filter((a) => a.kind === 'audio');
  const [removing, setRemoving] = useState<Attachment | null>(null);
  if (!voice.length) return null;
  return (
    <View style={{ gap: t.space[2] }} role="list" aria-label={copy.voice.count(voice.length)}>
      {voice.map((a, i) => (
        <View key={a.id} role="listitem">
          <VoiceRow a={a} label={copy.voice.item(i + 1, voice.length)} onRemove={onRemove ? () => setRemoving(a) : undefined} />
        </View>
      ))}
      <Dialog
        open={!!removing}
        title={copy.voice.removeTitle}
        body={copy.voice.removeBody}
        cancel={{ label: copy.common.cancel, onPress: () => setRemoving(null) }}
        confirm={{
          label: copy.voice.remove,
          variant: 'danger',
          onPress: () => {
            if (removing) onRemove?.(removing);
            setRemoving(null);
          },
        }}
      />
    </View>
  );
}

function VoiceRow({ a, label, onRemove }: { a: Attachment; label: string; onRemove?: () => void }) {
  const uri = useFileUri(a.fileName);
  if (uri === undefined) return <RowFrame label={label} />;
  if (uri === null) return <RowFrame label={label} missing onRemove={onRemove} />;
  return <Player key={uri} uri={uri} a={a} label={label} onRemove={onRemove} />;
}

function Player({ uri, a, label, onRemove }: { uri: string; a: Attachment; label: string; onRemove?: () => void }) {
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration > 0 ? status.duration : (a.durationMs ?? 0) / 1000;

  // Played to the end: back to the start, ready to play again.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    pauseOther?.();
    pauseOther = () => player.pause();
    // Play through the speaker even with the phone on silent, like any voice memo app.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    if (duration && status.currentTime >= duration - 0.05) await player.seekTo(0);
    player.play();
  };

  return (
    <RowFrame
      label={label}
      playing={status.playing}
      onToggle={toggle}
      progress={duration ? Math.min(1, status.currentTime / duration) : 0}
      time={
        status.playing || status.currentTime > 0
          ? `${durationLabel(status.currentTime * 1000) ?? '0:00'} / ${durationLabel(duration * 1000) ?? '0:00'}`
          : (durationLabel(duration * 1000) ?? '')
      }
      onRemove={onRemove}
    />
  );
}

function RowFrame({
  label,
  playing,
  onToggle,
  progress = 0,
  time,
  missing,
  onRemove,
}: {
  label: string;
  playing?: boolean;
  onToggle?: () => void;
  progress?: number;
  time?: string;
  missing?: boolean;
  onRemove?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: withAlpha(t.color.text, 0.06), borderRadius: t.radius.pill, paddingLeft: t.space[1] }]}>
      <Pressable
        role="button"
        aria-label={`${playing ? copy.voice.pause : copy.voice.play}: ${label}`}
        disabled={!onToggle}
        onPress={onToggle}
        style={(s: PState) => [
          styles.play,
          { backgroundColor: onToggle ? t.color.accent : withAlpha(t.color.text, 0.12) },
          (s.pressed || s.hovered) && { opacity: 0.85 },
          focusRing(t, s, 22),
        ]}
      >
        {missing ? (
          <Mic size={20} color={t.color.textMuted} />
        ) : playing ? (
          <Pause size={20} color={t.color.onAccent} fill={t.color.onAccent} />
        ) : (
          <Play size={20} color={t.color.onAccent} fill={t.color.onAccent} style={{ marginLeft: 2 }} />
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        {missing ? (
          <AppText variant="sm" tone="muted" numberOfLines={1}>
            {copy.attach.missing}
          </AppText>
        ) : (
          <View
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            style={[styles.track, { backgroundColor: withAlpha(t.color.text, 0.15) }]}
          >
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: t.color.accent }]} />
          </View>
        )}
      </View>
      <AppText variant="xs" tone="muted" style={{ minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {time ?? ''}
      </AppText>
      {onRemove ? <IconButton icon={Trash2} label={`${copy.voice.remove}: ${label}`} onPress={onRemove} /> : <View style={{ width: t.space[3] }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
