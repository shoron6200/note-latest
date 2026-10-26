/**
 * S03 text note / S04 checklist editor. Autosave: title and body save on a
 * short debounce, and flush when the field blurs, the app goes to the
 * background, and the screen closes. A brand-new note left empty is discarded.
 */
import { router, useLocalSearchParams } from 'expo-router';
import {
  Archive,
  ArchiveRestore,
  BellPlus,
  BellRing,
  Camera,
  CheckSquare,
  FileQuestion,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  Palette,
  Pin,
  PinOff,
  Plus,
  SquarePlus,
  Tag,
  Type,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { importFiles, pickAndAttach, sweepUnusedFiles, type PickSource } from '@/data/attachments';
import { useQuery, useRepo } from '@/data/DataProvider';
import { appFileStore } from '@/data/telegramRunner';
import type { NoteFull, NotePatch } from '@/data/types';
import { ChecklistEditor } from '@/features/ChecklistEditor';
import { AttachSheet, ColourSheet, FontSheet, ReminderSheet } from '@/features/editorSheets';
import { LabelPicker, labelErrorText } from '@/features/labels';
import { NoteActionsSheet, SheetRow } from '@/features/sheets';
import { discardTempRecording, VoiceSheet, type Recording } from '@/features/voice';
import { useTheme, withAlpha } from '@/theme/theme';
import { Button, IconButton, Tag as Chip } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { editedLabel, reminderChip } from '@/ui/format';
import { Banner, EmptyState, TopBar } from '@/ui/layout';
import { VoiceNotes } from '@/ui/audio';
import { MediaStrip } from '@/ui/media';
import { LabelChip } from '@/ui/NoteCard';
import { BottomSheet } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText, focusRing, type PState } from '@/ui/Text';

type Sheet = 'colour' | 'font' | 'reminder' | 'attach' | 'add' | 'actions' | 'labels' | 'voice' | null;

/** "#groc" right before the cursor: the start of a label typed into the note. */
const HASHTAG = /(?:^|\s)#([\p{L}\p{N}_-]{1,50})$/u;

export default function NoteScreen() {
  const { id, isNew, attach } = useLocalSearchParams<{ id: string; isNew?: string; attach?: string }>();
  const { data: note, error } = useQuery((r) => r.getNote(id), [id]);
  const t = useTheme();

  if (error || note === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
        <TopBar onBack={() => router.back()} />
        <EmptyState icon={FileQuestion} title={copy.editor.notFoundTitle} body={copy.editor.notFoundBody} />
      </SafeAreaView>
    );
  }
  if (!note) return <View style={{ flex: 1, backgroundColor: t.color.bg }} aria-busy />;
  return <Editor key={note.id} note={note} isNew={isNew === '1'} attachFirst={attach === 'library'} recordFirst={attach === 'voice'} />;
}

function Editor({ note, isNew, attachFirst, recordFirst }: { note: NoteFull; isNew: boolean; attachFirst?: boolean; recordFirst?: boolean }) {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [scrollOn, setScrollOn] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [tagError, setTagError] = useState<string | null>(null);
  const allLabels = useQuery((r) => r.listLabels(), []).data ?? [];
  const editable = note.deletedAt === null;

  // ---------------------------------------------------------- autosave
  // Saves as you type: one write in flight at a time, and the newest text
  // always follows it. A refresh or a killed app loses at most that one write.
  const pending = useRef<NotePatch>({});
  const writing = useRef<Promise<void> | null>(null);
  const itemFlush = useRef<() => Promise<void>>(async () => undefined);

  const drain = useCallback((): Promise<void> => {
    if (writing.current) return writing.current;
    const run = (async () => {
      while (Object.keys(pending.current).length) {
        const patch = pending.current;
        pending.current = {};
        await repo.updateNote(note.id, patch);
      }
    })().finally(() => {
      writing.current = null;
    });
    writing.current = run;
    return run;
  }, [repo, note.id]);

  const flush = useCallback(async () => {
    await drain();
    if (Object.keys(pending.current).length) await drain();
    await itemFlush.current();
  }, [drain]);

  const queue = (patch: NotePatch) => {
    pending.current = { ...pending.current, ...patch };
    void drain();
  };

  // Flush when the app is backgrounded (it may be killed after that).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  // Leaving the screen: save what is pending, then drop a brand-new note left empty.
  useEffect(() => {
    const noteId = note.id;
    return () => {
      flush()
        .then(() => (isNew ? repo.discardIfEmpty(noteId) : false))
        .catch(() => undefined);
    };
  }, [flush, repo, note.id, isNew]);

  // Live values for colour, font, pin, reminder, items: from the database.
  const live = useQuery((r) => r.getNote(note.id), [note.id]).data ?? note;

  // Turned into a note from a list (or back): the body comes from the database.
  const lastType = useRef(note.type);
  useEffect(() => {
    if (live.type !== lastType.current) {
      lastType.current = live.type;
      setBody(live.body);
    }
  }, [live.type, live.body]);
  // Changed somewhere else (text added from a photo, a restore): show it,
  // unless you are mid-edit here, in which case your text wins.
  const dbBody = useRef(note.body);
  useEffect(() => {
    if (live.body === dbBody.current) return;
    dbBody.current = live.body;
    if (!Object.keys(pending.current).length && !writing.current && live.type === lastType.current) setBody(live.body);
  }, [live.body, live.type]);
  const bg = t.note[live.color];

  const update = async (patch: NotePatch) => {
    await repo.updateNote(note.id, patch);
  };

  const attach = async (source: PickSource) => {
    setSheet(null);
    await flush();
    // Let the sheet finish closing: iOS can't show the picker over a closing sheet.
    if (Platform.OS !== 'web') await new Promise((r) => setTimeout(r, 350));
    try {
      const r = await pickAndAttach(repo, appFileStore(), note.id, source);
      if (r.denied) snack(copy.attach.denied);
      else if (r.failed) snack(copy.attach.failed(r.failed));
      else if (r.added.length) snack(copy.attach.added(r.added.length));
    } catch {
      snack(copy.attach.failed(1));
    }
  };

  // ---------------------------------------------------------- voice notes
  // The words heard go into the note (a new paragraph, or a new list item);
  // the recording is attached under it.
  const bodyNow = useRef(body);
  useEffect(() => {
    bodyNow.current = body;
  }, [body]);
  const saveRecording = async (r: Recording) => {
    await flush();
    try {
      const { added } = await importFiles(repo, appFileStore(), note.id, [
        { uri: r.uri, kind: 'audio', mime: r.mime, durationMs: r.durationMs, name: r.uri.split('/').pop() },
      ]);
      if (!added.length) throw new Error(copy.voice.failed);
    } finally {
      discardTempRecording(r.uri);
    }
    if (r.text) {
      if (isListType(live.type)) {
        await itemFlush.current();
        await repo.addItem(note.id, { text: r.text });
      } else {
        const prev = bodyNow.current;
        const next = prev.trim() ? `${prev.trimEnd()}\n\n${r.text}` : r.text;
        setBody(next);
        queue({ body: next });
        await flush();
      }
    }
    snack(r.text ? copy.voice.saved : copy.voice.savedNoWords);
  };

  const removeVoice = async (id: string) => {
    await repo.removeAttachment(id);
    await sweepUnusedFiles(repo, appFileStore()).catch(() => undefined);
    snack(copy.voice.removed);
  };

  // "New voice note" from the speed dial: open the recorder straight away.
  const askedForVoice = useRef(false);
  useEffect(() => {
    if (!recordFirst || askedForVoice.current) return;
    askedForVoice.current = true;
    setSheet('voice');
  }, [recordFirst]);

  // "New image note" from the speed dial: open the gallery straight away.
  const askedForImage = useRef(false);
  useEffect(() => {
    if (!attachFirst || askedForImage.current) return;
    askedForImage.current = true;
    void attach('library');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachFirst]);

  // Archive, as in Keep: the note leaves the screen and the list says so, with Undo.
  const toggleArchive = async () => {
    const before = { pinned: live.pinned, archived: live.archived };
    await flush();
    await repo.updateNote(note.id, { archived: !live.archived });
    if (!live.archived) {
      router.back();
      snack(copy.done.archived(1, before.pinned ? 1 : 0), { label: copy.delete.undo, onPress: () => repo.updateNote(note.id, before) });
    } else {
      snack(copy.done.unarchived(1));
    }
  };

  const togglePin = async () => {
    await update({ pinned: !live.pinned });
    if (!live.pinned && live.archived) snack(copy.done.pinnedUnarchived(1));
  };

  // ---------------------------------------------------------- #labels
  const tagMatch = !isListType(live.type) && editable ? HASHTAG.exec(body.slice(0, cursor)) : null;
  const tagText = tagMatch?.[1] ?? '';
  const onNote = new Set(live.labels.map((l) => l.id));
  const suggestions = tagText
    ? allLabels.filter((l) => !onNote.has(l.id) && l.name.toLowerCase().startsWith(tagText.toLowerCase())).slice(0, 3)
    : [];
  const canCreateTag = !!tagText && !allLabels.some((l) => l.name.toLowerCase() === tagText.toLowerCase());
  const addTag = async (labelId: string | null) => {
    try {
      const id = labelId ?? (await repo.createLabel(tagText)).id;
      await repo.setLabel([note.id], id, true);
      setTagError(null);
    } catch (e) {
      setTagError(labelErrorText(e));
    }
  };

  const reminder = live.reminder;
  const chip = reminder ? reminderChip(reminder) : null;
  const isList = live.type === 'checklist';
  const maxW = t.layout['editor-max-width'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar
        bg={bg}
        onBack={async () => {
          await flush();
          router.back();
        }}
        actions={
          editable ? (
            <>
              <IconButton icon={live.pinned ? PinOff : Pin} label={live.pinned ? copy.editor.unpin : copy.editor.pin} active={live.pinned} onPress={togglePin} />
              <IconButton icon={reminder ? BellRing : BellPlus} label={copy.editor.reminder} active={!!reminder && reminder.status === 'scheduled'} onPress={() => setSheet('reminder')} />
              <IconButton icon={live.archived ? ArchiveRestore : Archive} label={live.archived ? copy.editor.unarchive : copy.editor.archive} onPress={toggleArchive} />
            </>
          ) : (
            <IconButton icon={MoreVertical} label={copy.editor.more} onPress={() => setSheet('actions')} />
          )
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        scrollEnabled={scrollOn}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: t.layout.gutter, gap: t.space[2] }}>
          {!editable && (
            <View style={{ gap: t.space[2], marginBottom: t.space[2] }}>
              <Banner message={copy.editor.inTrash} />
              <Button
                label={copy.editor.restore}
                icon={ArchiveRestore}
                variant="secondary"
                onPress={async () => {
                  await repo.restoreNote(note.id);
                  snack(copy.trash.restored);
                }}
              />
            </View>
          )}

          <TextField
            variant="title"
            label={copy.editor.titlePlaceholder}
            placeholder={copy.editor.titlePlaceholder}
            value={title}
            editable={editable}
            font={live.font}
            onChangeText={(v) => {
              setTitle(v);
              queue({ title: v });
            }}
            onBlur={flush}
            returnKeyType="next"
            autoFocus={false}
            maxLength={300}
          />

          {chip && (
            <Chip
              icon={BellRing}
              label={chip.label}
              tone={chip.overdue ? 'danger' : 'muted'}
              onPress={editable ? () => setSheet('reminder') : undefined}
            />
          )}

          <MediaStrip
            items={live.attachments}
            onOpen={(a) => router.push({ pathname: '/media/[id]', params: { id: a.id } })}
            onAdd={editable ? () => setSheet('attach') : undefined}
          />
          <VoiceNotes items={live.attachments} onRemove={editable ? (a) => removeVoice(a.id) : undefined} />

          {isList ? (
            <ChecklistEditor
              noteId={note.id}
              items={live.items}
              font={live.font}
              size={live.fontSize}
              editable={editable}
              onDragging={(d) => setScrollOn(!d)}
              registerFlush={(fn) => (itemFlush.current = fn)}
            />
          ) : (
            <TextField
              variant="body"
              label={copy.editor.bodyPlaceholder}
              placeholder={copy.editor.bodyPlaceholder}
              value={body}
              editable={editable}
              font={live.font}
              size={live.fontSize}
              autoFocus={!note.title && !note.body}
              onChangeText={(v) => {
                setBody(v);
                queue({ body: v });
              }}
              onSelectionChange={(e) => setCursor(e.nativeEvent.selection.end)}
              onBlur={flush}
              style={{ minHeight: t.layout['editor-body-min-height'] }}
            />
          )}

          {live.labels.length > 0 && (
            <View style={styles.labels} role="group" aria-label={copy.editor.labels}>
              {live.labels.map((l) => (
                <LabelChip key={l.id} label={l.name} onPress={editable ? () => setSheet('labels') : undefined} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {(suggestions.length > 0 || canCreateTag || tagError) && (
        <View style={[styles.suggest, { backgroundColor: t.color.surfaceRaised, borderTopColor: t.color.border }]} role="group" aria-label={copy.editor.labels}>
          {tagError ? (
            <AppText variant="sm" tone="danger" role="alert" style={{ padding: t.space[3] }}>
              {tagError}
            </AppText>
          ) : null}
          {suggestions.map((l) => (
            <SuggestRow key={l.id} icon={Tag} label={l.name} onPress={() => addTag(l.id)} />
          ))}
          {canCreateTag && !tagError ? <SuggestRow icon={Plus} label={copy.labels.hashtagCreate(tagText)} onPress={() => addTag(null)} /> : null}
        </View>
      )}

      {/* Keep's bottom toolbar: add, colour, text style … "Edited" … more. */}
      <View style={[styles.toolbar, { backgroundColor: bg, paddingHorizontal: t.space[1] }]}>
        {editable ? (
          <>
            <IconButton icon={SquarePlus} label={copy.editor.add} onPress={() => setSheet('add')} />
            <IconButton icon={Palette} label={copy.editor.colour} onPress={() => setSheet('colour')} />
            <IconButton icon={Type} label={copy.editor.font} onPress={() => setSheet('font')} />
          </>
        ) : null}
        <AppText variant="xs" tone="muted" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {copy.editor.edited(editedLabel(live.updatedAt))}
        </AppText>
        {editable ? <IconButton icon={MoreVertical} label={copy.editor.more} onPress={() => setSheet('actions')} /> : <View style={{ width: 48 }} />}
      </View>
      </KeyboardAvoidingView>

      <BottomSheet open={sheet === 'add'} onClose={() => setSheet(null)} title={copy.editor.add}>
        <SheetRow icon={Camera} label={copy.editor.takePhoto} onPress={() => attach('camera')} />
        <SheetRow icon={ImageIcon} label={copy.editor.addImage} onPress={() => attach('library')} />
        <SheetRow icon={Mic} label={copy.editor.recordVoice} onPress={() => setSheet('voice')} />
        <SheetRow
          icon={CheckSquare}
          label={isList ? copy.editor.hideCheckboxes : copy.editor.checkboxes}
          onPress={async () => {
            setSheet(null);
            await flush();
            await repo.convertNote(note.id, isList ? 'text' : 'checklist');
          }}
        />
      </BottomSheet>
      <LabelPicker open={sheet === 'labels'} onClose={() => setSheet(null)} noteIds={[note.id]} />
      <VoiceSheet open={sheet === 'voice'} onClose={() => setSheet(null)} onSaved={saveRecording} onError={(m) => snack(m)} />

      <AttachSheet open={sheet === 'attach'} onClose={() => setSheet(null)} onPick={attach} />
      <ColourSheet open={sheet === 'colour'} onClose={() => setSheet(null)} value={live.color} onChange={(color) => update({ color })} />
      <FontSheet
        open={sheet === 'font'}
        onClose={() => setSheet(null)}
        font={live.font}
        size={live.fontSize}
        onFont={(font) => update({ font })}
        onSize={(fontSize) => update({ fontSize })}
      />
      <ReminderSheet
        open={sheet === 'reminder'}
        onClose={() => setSheet(null)}
        current={reminder}
        onSave={async (r) => {
          await flush();
          await repo.setReminder(note.id, r);
          snack(copy.reminder.set(reminderChip({ fireAt: r.fireAt, repeat: r.repeat, status: 'scheduled' }).label.replace(/^(Today|Tomorrow|Yesterday)\b/, (w) => w.toLowerCase())));
        }}
        onRemove={async () => {
          await repo.clearReminder(note.id);
          snack(copy.reminder.removed);
        }}
      />
      <NoteActionsSheet
        note={sheet === 'actions' ? { ...live, title: title } : null}
        onClose={() => setSheet(null)}
        onLabels={() => setSheet('labels')}
        leaveOnTrash
      />
    </SafeAreaView>
  );
}

const isListType = (type: NoteFull['type']) => type === 'checklist';

function SuggestRow({ icon: Icon, label, onPress }: { icon: typeof Tag; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <View>
      {/* A plain Pressable row; the keyboard stays up while it is tapped. */}
      <PressRow onPress={onPress} label={label}>
        <Icon size={20} color={t.color.textMuted} />
        <AppText numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </AppText>
      </PressRow>
    </View>
  );
}

function PressRow({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={(s: PState) => [
        styles.suggestRow,
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
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  suggest: { borderTopWidth: StyleSheet.hairlineWidth },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 },
});
