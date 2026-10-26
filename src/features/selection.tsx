/**
 * Multi-select, as in Keep: long-press a card to start, tap more cards to add
 * or drop them, and the top bar turns into an action bar for the picked notes.
 * Back (or ×) clears the selection.
 */
import { router } from 'expo-router';
import { ArchiveRestore, Archive, Copy, Folder as FolderIcon, MoreVertical, Palette, Pin, PinOff, Tag, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import { useRepo } from '@/data/DataProvider';
import type { NoteSummary } from '@/data/types';
import { ColourSheet } from '@/features/editorSheets';
import { LabelPicker } from '@/features/labels';
import { FolderPickerSheet, SheetRow } from '@/features/sheets';
import { useTheme, withAlpha, type NoteColor } from '@/theme/theme';
import { IconButton } from '@/ui/controls';
import { BottomSheet, Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

export function useSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const active = ids.size > 0;
  const toggle = useCallback((id: string) => {
    setIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setIds(new Set()), []);

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clear();
      return true;
    });
    return () => sub.remove();
  }, [active, clear]);

  return { ids, active, toggle, clear, setIds };
}

type Snapshot = { id: string; pinned: boolean; archived: boolean };
type Sheet = 'colour' | 'labels' | 'more' | 'folder' | 'forever' | null;

/** The action bar shown in place of the top bar while notes are selected. */
export function SelectionBar({ notes, inTrash, onClear }: { notes: NoteSummary[]; inTrash?: boolean; onClear: () => void }) {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const [sheet, setSheet] = useState<Sheet>(null);
  const ids = notes.map((n) => n.id);
  const n = notes.length;
  const allPinned = n > 0 && notes.every((x) => x.pinned);
  const allArchived = n > 0 && notes.every((x) => x.archived);
  const colours = new Set(notes.map((x) => x.color));
  const colour: NoteColor = colours.size === 1 ? notes[0].color : 'default';
  const folders = new Set(notes.map((x) => x.folderId));

  const snapshot: Snapshot[] = notes.map((x) => ({ id: x.id, pinned: x.pinned, archived: x.archived }));
  const putBack = async (snap: Snapshot[]) => {
    for (const s of snap) await repo.updateNote(s.id, { pinned: s.pinned, archived: s.archived });
  };
  const finish = () => {
    setSheet(null);
    onClear();
  };

  const pin = async () => {
    const r = await repo.updateNotes(ids, { pinned: !allPinned });
    finish();
    if (r.unarchived) snack(copy.done.pinnedUnarchived(r.unarchived), { label: copy.delete.undo, onPress: () => putBack(snapshot) });
  };

  const archive = async () => {
    const r = await repo.updateNotes(ids, { archived: !allArchived });
    finish();
    snack(allArchived ? copy.done.unarchived(r.changed) : copy.done.archived(r.changed, r.unpinned), {
      label: copy.delete.undo,
      onPress: () => putBack(snapshot),
    });
  };

  const trash = async () => {
    const r = await repo.trashNotes(ids);
    finish();
    snack(copy.done.trashed(r.changed, r.unpinned), {
      label: copy.delete.undo,
      onPress: async () => {
        await repo.restoreNotes(ids);
        await putBack(snapshot);
      },
    });
  };

  const duplicate = async () => {
    const id = await repo.duplicateNote(ids[0]);
    finish();
    snack(copy.done.copied, id ? { label: copy.actions.open, onPress: () => router.push({ pathname: '/note/[id]', params: { id } }) } : undefined);
  };

  return (
    <>
      <View
        role="toolbar"
        aria-label={copy.select.count(n)}
        style={[
          styles.bar,
          { height: t.layout['top-bar-height'], paddingHorizontal: t.space[1], backgroundColor: withAlpha(t.color.accent, t.mode === 'dark' ? 0.2 : 0.1) },
        ]}
      >
        <IconButton icon={X} label={copy.select.clear} onPress={onClear} />
        <AppText variant="lg" weight="600" aria-live="polite" style={{ flex: 1, marginLeft: t.space[2] }}>
          {n}
        </AppText>
        {inTrash ? (
          <>
            <IconButton
              icon={ArchiveRestore}
              label={copy.select.restore}
              onPress={async () => {
                await repo.restoreNotes(ids);
                finish();
                snack(copy.done.restored(n));
              }}
            />
            <IconButton icon={Trash2} label={copy.select.deleteForever} variant="danger" onPress={() => setSheet('forever')} />
          </>
        ) : (
          <>
            <IconButton icon={allPinned ? PinOff : Pin} label={allPinned ? copy.select.unpin : copy.select.pin} onPress={pin} />
            <IconButton icon={Palette} label={copy.select.colour} onPress={() => setSheet('colour')} />
            <IconButton icon={Tag} label={copy.select.labels} onPress={() => setSheet('labels')} />
            <IconButton icon={MoreVertical} label={copy.select.more} onPress={() => setSheet('more')} />
          </>
        )}
      </View>

      <ColourSheet
        open={sheet === 'colour'}
        onClose={() => setSheet(null)}
        value={colour}
        onChange={async (c) => {
          await repo.updateNotes(ids, { color: c });
        }}
      />
      <LabelPicker open={sheet === 'labels'} onClose={finish} noteIds={ids} />
      <BottomSheet open={sheet === 'more'} onClose={() => setSheet(null)} title={copy.select.count(n)}>
        <SheetRow icon={allArchived ? ArchiveRestore : Archive} label={allArchived ? copy.select.unarchive : copy.select.archive} onPress={archive} />
        <SheetRow icon={FolderIcon} label={copy.select.move} onPress={() => setSheet('folder')} />
        {n === 1 ? <SheetRow icon={Copy} label={copy.select.copy} onPress={duplicate} /> : null}
        <SheetRow icon={Trash2} label={copy.select.delete} tone="danger" onPress={trash} />
      </BottomSheet>
      <FolderPickerSheet
        open={sheet === 'folder'}
        onClose={() => setSheet(null)}
        value={folders.size === 1 ? notes[0]?.folderId ?? null : '\u0000'}
        onPick={async (folderId, name) => {
          await repo.updateNotes(ids, { folderId });
          finish();
          snack(copy.folder.moved(name));
        }}
      />
      <Dialog
        open={sheet === 'forever'}
        title={copy.delete.foreverTitle}
        body={copy.delete.foreverBody}
        cancel={{ label: copy.common.cancel, onPress: () => setSheet(null) }}
        confirm={{
          label: copy.delete.foreverConfirm,
          variant: 'danger',
          onPress: async () => {
            await repo.deleteNotesForever(ids);
            finish();
            snack(copy.done.deletedForever(n));
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
