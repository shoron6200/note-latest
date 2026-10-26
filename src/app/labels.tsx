/**
 * Edit labels (Keep's label editor): make a label on the top row, rename one
 * in place, or delete it. Deleting a label never deletes notes.
 * Opened with ?create=1 the "Create new label" field starts focused.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react-native';
import { useRef, useState, type Ref } from 'react';
import { ScrollView, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery, useRepo } from '@/data/DataProvider';
import { LABEL_MAX_CHARS } from '@/data/repo';
import type { Label } from '@/data/types';
import { labelErrorText } from '@/features/labels';
import { useTheme } from '@/theme/theme';
import { IconButton } from '@/ui/controls';
import { TopBar } from '@/ui/layout';
import { Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

export default function LabelsScreen() {
  const t = useTheme();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const { data: labels } = useQuery((r) => r.listLabels(), []);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const repo = useRepo();
  const snack = useSnackbar();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar onBack={() => router.back()} title={copy.labels.title} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }}>
        <View style={{ width: '100%', maxWidth: t.layout['editor-max-width'] }}>
          <CreateRow autoFocus={create === '1'} />
          {labels?.map((l) => (
            <LabelRow key={`${l.id}:${l.name}`} label={l} onDelete={() => setDeleting(l)} />
          ))}
          {labels && labels.length === 0 ? (
            <AppText tone="muted" style={{ padding: t.space[4] }}>
              {copy.labels.hashtagHint}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
      <Dialog
        open={!!deleting}
        title={copy.labels.deleteTitle}
        body={copy.labels.deleteBody}
        cancel={{ label: copy.common.cancel, onPress: () => setDeleting(null) }}
        confirm={{
          label: copy.labels.delete,
          variant: 'danger',
          onPress: async () => {
            if (!deleting) return;
            await repo.deleteLabel(deleting.id);
            setDeleting(null);
            snack(`${copy.browse.deleteLabel}: ${deleting.name}`);
          },
        }}
      />
    </SafeAreaView>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  label,
  autoFocus,
  onFocus,
  onBlur,
  onSubmit,
  inputRef,
}: {
  inputRef?: Ref<TextInputInstance>;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit: () => void;
}) {
  const t = useTheme();
  return (
    <TextInput
      ref={inputRef}
      aria-label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.color.textMuted}
      autoFocus={autoFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onSubmitEditing={onSubmit}
      returnKeyType="done"
      maxLength={LABEL_MAX_CHARS}
      selectionColor={t.color.accent}
      cursorColor={t.color.accent}
      style={[t.type.base, { flex: 1, color: t.color.text, minHeight: 48 }]}
    />
  );
}

function CreateRow({ autoFocus }: { autoFocus?: boolean }) {
  const t = useTheme();
  const repo = useRepo();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(!!autoFocus);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      await repo.createLabel(name);
      setName('');
      setError(null);
    } catch (e) {
      setError(labelErrorText(e));
    }
  };

  return (
    <View style={[styles.row, { borderBottomColor: t.color.border, borderTopColor: t.color.border, borderTopWidth: focused ? StyleSheet.hairlineWidth : 0, borderBottomWidth: focused ? StyleSheet.hairlineWidth : 0 }]}>
      {focused ? (
        <IconButton icon={X} label={copy.common.cancel} onPress={() => (setName(''), setError(null), setFocused(false))} />
      ) : (
        <View style={styles.lead}>
          <Plus size={22} color={t.color.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Field
          label={copy.labels.create}
          placeholder={copy.labels.create}
          value={name}
          autoFocus={autoFocus}
          onChangeText={(v) => (setName(v), setError(null))}
          onFocus={() => setFocused(true)}
          onSubmit={save}
        />
        {error ? (
          <AppText variant="sm" tone="danger" role="alert" style={{ marginBottom: t.space[2] }}>
            {error}
          </AppText>
        ) : null}
      </View>
      {focused ? <IconButton icon={Check} label={copy.labels.save} onPress={save} /> : <View style={styles.lead} />}
    </View>
  );
}

function LabelRow({ label, onDelete }: { label: Label; onDelete: () => void }) {
  const t = useTheme();
  const repo = useRepo();
  const [name, setName] = useState(label.name);
  const [editing, setEditing] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (name.trim() === label.name) {
      setEditing(false);
      setError(null);
      return;
    }
    try {
      await repo.renameLabel(label.id, name);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(labelErrorText(e));
    }
  };

  return (
    <View style={[styles.row, editing && { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.color.border }]}>
      {editing ? (
        <IconButton icon={Trash2} label={copy.labels.remove(label.name)} onPress={onDelete} />
      ) : (
        <View style={styles.lead}>
          <Tag size={22} color={t.color.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Field
          inputRef={input}
          label={copy.labels.rename(label.name)}
          value={name}
          onChangeText={(v) => (setName(v), setError(null))}
          onFocus={() => setEditing(true)}
          onSubmit={save}
        />
        {error ? (
          <AppText variant="sm" tone="danger" role="alert" style={{ marginBottom: t.space[2] }}>
            {error}
          </AppText>
        ) : !editing ? (
          <AppText variant="xs" tone="muted" style={{ marginTop: -8, marginBottom: 8 }}>
            {copy.labels.count(label.count)}
          </AppText>
        ) : null}
      </View>
      {editing ? (
        <IconButton icon={Check} label={copy.labels.save} onPress={save} />
      ) : (
        <IconButton icon={Pencil} label={copy.labels.rename(label.name)} onPress={() => input.current?.focus()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 4 },
  lead: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
