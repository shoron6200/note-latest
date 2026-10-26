/**
 * Labels on notes, the way Keep does them: a full-screen picker with a name
 * field on top. Typing filters the list; a name nobody has yet offers
 * "Create “…”". With several notes selected, a label on only some of them
 * shows a part-ticked box; tapping it puts it on all of them.
 */
import { ArrowLeft, Check, Minus, Plus, Tag } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery, useRepo } from '@/data/DataProvider';
import { LABEL_MAX_CHARS } from '@/data/repo';
import { DuplicateLabelError, LabelLimitError } from '@/data/types';
import { useTheme, withAlpha } from '@/theme/theme';
import { IconButton } from '@/ui/controls';
import { AppText, focusRing, type PState } from '@/ui/Text';

/** The message to show for a failed create or rename. */
export function labelErrorText(e: unknown): string {
  if (e instanceof DuplicateLabelError) return copy.labels.duplicate;
  if (e instanceof LabelLimitError) return copy.labels.limit;
  const m = String((e as Error)?.message ?? e);
  if (/empty/.test(m)) return copy.labels.emptyName;
  if (/too long/.test(m)) return copy.labels.tooLong;
  return m;
}

type Tick = 'all' | 'some' | 'none';

export function TickBox({ state, color }: { state: Tick; color?: string }) {
  const t = useTheme();
  const on = state !== 'none';
  const c = color ?? t.color.accent;
  return (
    <View
      aria-hidden
      style={[
        styles.box,
        { borderColor: on ? c : t.color.borderInput, backgroundColor: on ? c : 'transparent', borderRadius: 4 },
      ]}
    >
      {state === 'all' && <Check size={16} color={t.color.onAccent} strokeWidth={3} />}
      {state === 'some' && <Minus size={16} color={t.color.onAccent} strokeWidth={3} />}
    </View>
  );
}

/** Mounted only while open, so the name field starts empty each time. */
export function LabelPicker(props: { open: boolean; onClose: () => void; noteIds: string[] }) {
  return props.open && props.noteIds.length > 0 ? <LabelPickerBody {...props} /> : null;
}

function LabelPickerBody({ onClose, noteIds }: { onClose: () => void; noteIds: string[] }) {
  const t = useTheme();
  const repo = useRepo();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const labels = useQuery((r) => r.listLabels(), []).data;
  const notes = useQuery((r) => Promise.all(noteIds.map((id) => r.getNote(id))), [noteIds]).data;

  const has = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes ?? []) for (const l of n?.labels ?? []) m.set(l.id, (m.get(l.id) ?? 0) + 1);
    return m;
  }, [notes]);
  const total = notes?.filter(Boolean).length ?? noteIds.length;
  const tick = (id: string): Tick => {
    const n = has.get(id) ?? 0;
    return n === 0 ? 'none' : n >= total ? 'all' : 'some';
  };

  const q = text.replace(/\s+/g, ' ').trim();
  const shown = (labels ?? []).filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));
  const exact = (labels ?? []).some((l) => l.name.toLowerCase() === q.toLowerCase());

  const toggle = async (id: string) => {
    setError(null);
    await repo.setLabel(noteIds, id, tick(id) !== 'all');
  };

  const create = async () => {
    if (!q) return;
    try {
      const l = await repo.createLabel(q);
      await repo.setLabel(noteIds, l.id, true);
      setText('');
      setError(null);
    } catch (e) {
      setError(labelErrorText(e));
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent aria-label={copy.labels.pickerTitle}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
        <View style={[styles.bar, { height: t.layout['top-bar-height'], paddingHorizontal: t.space[1], borderBottomColor: t.color.border }]}>
          <IconButton icon={ArrowLeft} label={copy.common.back} onPress={onClose} />
          <TextInput
            aria-label={copy.labels.pickerPlaceholder}
            placeholder={copy.labels.pickerPlaceholder}
            placeholderTextColor={t.color.textMuted}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            maxLength={LABEL_MAX_CHARS}
            returnKeyType="done"
            onSubmitEditing={() => (q && !exact ? create() : undefined)}
            selectionColor={t.color.accent}
            cursorColor={t.color.accent}
            style={[t.type.base, { flex: 1, color: t.color.text, paddingHorizontal: t.space[2], minHeight: 48 }]}
          />
        </View>
        {error ? (
          <AppText variant="sm" tone="danger" role="alert" style={{ paddingHorizontal: t.space[4], paddingTop: t.space[2] }}>
            {error}
          </AppText>
        ) : null}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: t.space[2] }}>
          {q && !exact ? (
            <Row onPress={create} label={copy.labels.createNamed(q)}>
              <Plus size={22} color={t.color.accent} />
              <AppText style={{ flex: 1, color: t.color.accent }} numberOfLines={1}>
                {copy.labels.createNamed(q)}
              </AppText>
            </Row>
          ) : null}
          {labels && labels.length === 0 && !q ? (
            <AppText tone="muted" style={{ padding: t.space[4] }}>
              {copy.labels.none}
            </AppText>
          ) : null}
          {shown.map((l) => {
            const state = tick(l.id);
            return (
              <Row
                key={l.id}
                role="checkbox"
                checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                label={l.name}
                hint={state === 'some' ? copy.labels.partly : undefined}
                onPress={() => toggle(l.id)}
              >
                <Tag size={22} color={t.color.textMuted} />
                <AppText style={{ flex: 1 }} numberOfLines={1}>
                  {l.name}
                </AppText>
                <TickBox state={state} />
              </Row>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Row({
  children,
  onPress,
  label,
  role = 'button',
  checked,
  hint,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  role?: 'button' | 'checkbox';
  checked?: boolean | 'mixed';
  hint?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      role={role}
      aria-label={label}
      aria-checked={role === 'checkbox' ? checked : undefined}
      accessibilityHint={hint}
      onPress={onPress}
      style={(s: PState) => [
        styles.row,
        { paddingHorizontal: t.space[4] },
        (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
        focusRing(t, s, 0),
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 20, minHeight: 56 },
  box: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
