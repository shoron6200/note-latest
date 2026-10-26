/**
 * Photos and videos in the UI: a thumbnail, the strip under a note's title,
 * and the cover on a card. Videos show a play badge rather than a frame, so
 * the list never decodes video just to draw a card.
 */
import { ImageOff, ImagePlus, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import { appFileStore } from '@/data/telegramRunner';
import { isVisual, type Attachment, type VisualKind } from '@/data/types';
import { useTheme, withAlpha } from '@/theme/theme';

import { AppText, focusRing, type PState } from './Text';

/** A loadable URI for a stored file; undefined while looking, null when it is not on this phone. */
export function useFileUri(fileName: string | undefined): string | null | undefined {
  const [found, setFound] = useState<{ name: string; uri: string | null } | null>(null);
  useEffect(() => {
    if (!fileName) return;
    let alive = true;
    appFileStore()
      .uri(fileName)
      .then(
        (uri) => alive && setFound({ name: fileName, uri }),
        () => alive && setFound({ name: fileName, uri: null }),
      );
    return () => {
      alive = false;
    };
  }, [fileName]);
  if (!fileName) return null;
  return found?.name === fileName ? found.uri : undefined;
}

export function durationLabel(ms: number | null | undefined): string | null {
  if (!ms || ms < 0) return null;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The picture itself (or a placeholder), filling its box. */
export function MediaFill({ kind, fileName, durationMs }: { kind: VisualKind; fileName: string; durationMs?: number | null }) {
  const t = useTheme();
  const uri = useFileUri(fileName);
  const dark = t.mode === 'dark' ? '#000000' : '#1c1b19';
  if (uri === null) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: withAlpha(t.color.text, 0.08) }]}>
        <ImageOff size={22} color={t.color.textMuted} />
      </View>
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: kind === 'video' ? dark : withAlpha(t.color.text, 0.06) }]}>
      {kind === 'image' && uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      {kind === 'video' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={[styles.play, { backgroundColor: withAlpha('#ffffff', 0.9) }]}>
            <Play size={18} color="#1c1b19" fill="#1c1b19" />
          </View>
          {durationLabel(durationMs) ? (
            <AppText variant="xs" weight="600" style={[styles.duration, { color: '#ffffff' }]}>
              {durationLabel(durationMs)}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const THUMB = 96;

/** The row of photos and videos under a note's title. Voice notes are listed apart (ui/audio.tsx). */
export function MediaStrip({
  items: all,
  onOpen,
  onAdd,
}: {
  items: Attachment[];
  onOpen: (a: Attachment) => void;
  onAdd?: () => void;
}) {
  const t = useTheme();
  const items = all.flatMap((a) => (isVisual(a.kind) ? [{ ...a, kind: a.kind }] : []));
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space[2], paddingVertical: t.space[1] }}>
      {items.map((a, i) => (
        <Pressable
          key={a.id}
          role="button"
          aria-label={copy.attach.open(a.kind, i + 1, items.length)}
          onPress={() => onOpen(a)}
          style={(s: PState) => [
            styles.thumb,
            { borderRadius: t.radius.md, width: THUMB, height: THUMB },
            (s.pressed || s.hovered) && { opacity: 0.85 },
            focusRing(t, s, t.radius.md),
          ]}
        >
          <MediaFill kind={a.kind} fileName={a.fileName} durationMs={a.durationMs} />
        </Pressable>
      ))}
      {onAdd ? (
        <Pressable
          role="button"
          aria-label={copy.editor.attach}
          onPress={onAdd}
          style={(s: PState) => [
            styles.thumb,
            styles.center,
            {
              borderRadius: t.radius.md,
              width: THUMB,
              height: THUMB,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: withAlpha(t.color.text, 0.3),
            },
            (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
            focusRing(t, s, t.radius.md),
          ]}
        >
          <ImagePlus size={24} color={t.color.textMuted} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

/** The first photo or video across the top of a card, with a count when there are more. */
export function CardCover({ kind, fileName, count }: { kind: VisualKind; fileName: string; count: number }) {
  const t = useTheme();
  return (
    <View style={{ marginHorizontal: -t.space[4], marginTop: -t.space[4], height: 132, overflow: 'hidden' }} aria-hidden>
      <MediaFill kind={kind} fileName={fileName} />
      {count > 1 ? (
        <View style={[styles.count, { backgroundColor: withAlpha('#000000', 0.6), borderRadius: t.radius.pill }]}>
          <AppText variant="xs" weight="600" style={{ color: '#ffffff' }}>
            +{count - 1}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  thumb: { overflow: 'hidden' },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  duration: { position: 'absolute', right: 6, bottom: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  count: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 2 },
});
