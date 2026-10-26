/**
 * Save to Pocketleaf: what another app shared (text, a link, photos, videos,
 * a recording) becomes a new note. Edit the title and text, pick labels,
 * then Save (back to where you were) or Save and open.
 */
import { router } from 'expo-router';
import { Check, FileWarning, Mic, Share2, Tag as TagIcon, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { importFiles } from '@/data/attachments';
import { useQuery, useRepo } from '@/data/DataProvider';
import { appFileStore } from '@/data/telegramRunner';
import { useIncomingShare, type Incoming } from '@/features/incomingShare';
import { draftFor } from '@/features/incomingShareTypes';
import { useTheme, withAlpha } from '@/theme/theme';
import { Button } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { EmptyState, TopBar } from '@/ui/layout';
import { useSnackbar } from '@/ui/snackbar';
import { AppText, focusRing, type PState } from '@/ui/Text';

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ShareScreen() {
  const t = useTheme();
  const { share, clear } = useIncomingShare();
  if (!share) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
        <TopBar title={copy.share.title} onBack={leave} />
        <EmptyState icon={Share2} title={copy.share.nothing} body={copy.share.nothingBody} />
      </SafeAreaView>
    );
  }
  return <ShareForm share={share} clear={clear} />;
}

function ShareForm({ share, clear }: { share: Incoming; clear: () => void }) {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const draft = draftFor(share);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const labels = useQuery((r) => r.listLabels(), []).data ?? [];

  const files = share.files.filter((f) => f.kind !== null);
  const skipped = share.files.length - files.length;

  const discard = () => {
    clear();
    leave();
  };

  const save = async (open: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await repo.createNote({ type: 'text' });
      await repo.updateNote(id, { title: title.trim(), body });
      if (files.length) {
        const r = await importFiles(
          repo,
          appFileStore(),
          id,
          files.map((f) => ({ ...f, kind: f.kind! })),
        );
        if (r.failed) snack(copy.attach.failed(r.failed));
      }
      for (const labelId of picked) await repo.setLabel([id], labelId, true);
      clear();
      if (open) router.replace({ pathname: '/note/[id]', params: { id } });
      else leave();
      snack(copy.share.saved);
    } catch (e) {
      setBusy(false);
      snack((e as Error).message);
    }
  };

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar title={copy.share.title} onBack={discard} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }}>
        <View style={{ width: '100%', maxWidth: t.layout['editor-max-width'], paddingHorizontal: t.layout.gutter, gap: t.space[3] }}>
          {files.length > 0 && (
            <View style={{ gap: t.space[1] }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space[2], paddingVertical: t.space[1] }}>
                {files.map((f, i) => (
                  <View
                    key={`${f.uri}-${i}`}
                    style={[styles.thumb, { borderRadius: t.radius.md, backgroundColor: withAlpha(t.color.text, 0.08) }]}
                    aria-label={f.name ?? copy.attach.photo}
                  >
                    {f.kind === 'image' ? (
                      <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                    ) : f.kind === 'video' ? (
                      <Video size={28} color={t.color.textMuted} />
                    ) : (
                      <Mic size={28} color={t.color.textMuted} />
                    )}
                  </View>
                ))}
              </ScrollView>
              <AppText variant="xs" tone="muted">
                {copy.share.files(files.length)}
              </AppText>
            </View>
          )}
          {skipped > 0 && (
            <View style={styles.warn}>
              <FileWarning size={18} color={t.color.textMuted} />
              <AppText variant="sm" tone="muted" style={{ flex: 1 }}>
                {copy.share.skipped(skipped)}
              </AppText>
            </View>
          )}

          <TextField variant="title" label={copy.share.titleField} placeholder={copy.editor.titlePlaceholder} value={title} onChangeText={setTitle} />
          <TextField
            variant="body"
            label={copy.share.bodyField}
            placeholder={copy.editor.bodyPlaceholder}
            value={body}
            onChangeText={setBody}
            multiline
            style={{ minHeight: 120 }}
          />

          {labels.length > 0 && (
            <View style={{ gap: t.space[2] }}>
              <AppText variant="xs" weight="700" tone="muted" role="heading" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {copy.share.labels}
              </AppText>
              <View style={styles.chips} role="group" aria-label={copy.share.labels}>
                {labels.map((l) => {
                  const on = picked.has(l.id);
                  return (
                    <Pressable
                      key={l.id}
                      role="checkbox"
                      aria-checked={on}
                      aria-label={l.name}
                      onPress={() => toggle(l.id)}
                      style={(s: PState) => [
                        styles.chip,
                        {
                          borderRadius: t.radius.pill,
                          borderColor: on ? t.color.accent : t.color.border,
                          backgroundColor: on ? withAlpha(t.color.accent, 0.14) : 'transparent',
                        },
                        (s.pressed || s.hovered) && !on && { backgroundColor: withAlpha(t.color.text, 0.06) },
                        focusRing(t, s, t.radius.pill),
                      ]}
                    >
                      {on ? <Check size={16} color={t.color.accent} /> : <TagIcon size={16} color={t.color.textMuted} />}
                      <AppText variant="sm" style={{ color: on ? t.color.accent : t.color.text }}>
                        {l.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <Button label={copy.share.discard} variant="text" onPress={discard} disabled={busy} />
            <Button label={copy.share.saveOpen} variant="secondary" onPress={() => save(true)} disabled={busy} />
            <Button label={copy.share.save} onPress={() => save(false)} loading={busy} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 88, height: 88, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, minHeight: 36 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 8 },
});
