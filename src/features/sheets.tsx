import { router } from 'expo-router';
import {
  ArchiveRestore,
  Check,
  CheckSquare,
  Copy,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Pin,
  PinOff,
  Share2,
  Tag,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import { useQuery, useRepo } from '@/data/DataProvider';
import { DuplicateFolderError, type NoteType } from '@/data/types';
import { useTheme, withAlpha } from '@/theme/theme';
import type { IconType } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { BottomSheet, Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText, focusRing, type PState } from '@/ui/Text';

// ---------------------------------------------------------------- a sheet row

export function SheetRow({
  icon: Icon,
  label,
  onPress,
  tone = 'text',
  selected,
  role = 'button',
}: {
  icon?: IconType;
  label: string;
  onPress: () => void;
  tone?: 'text' | 'danger';
  selected?: boolean;
  role?: 'button' | 'radio';
}) {
  const t = useTheme();
  const fg = tone === 'danger' ? t.color.danger : t.color.text;
  return (
    <Pressable
      role={role}
      aria-label={label}
      aria-checked={role === 'radio' ? !!selected : undefined}
      onPress={onPress}
      style={(s: PState) => [
        styles.row,
        { paddingHorizontal: t.space[3], borderRadius: t.radius.md, gap: t.space[3] },
        (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
        focusRing(t, s, t.radius.md),
      ]}
    >
      {Icon ? <Icon size={22} color={fg} /> : null}
      <AppText style={{ flex: 1, color: fg }} numberOfLines={1}>
        {label}
      </AppText>
      {selected ? <Check size={20} color={t.color.accent} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- folder name dialog

type FolderNameProps = {
  open: boolean;
  onClose: () => void;
  /** Rename this folder; create a new one when absent. */
  folder?: { id: string; name: string };
  onSaved?: (f: { id: string; name: string }) => void;
};

/** Mounted only while open, so every opening starts from the folder's current name. */
export function FolderNameDialog(props: FolderNameProps) {
  return props.open ? <FolderNameDialogBody {...props} /> : null;
}

function FolderNameDialogBody({ onClose, folder, onSaved }: FolderNameProps) {
  const repo = useRepo();
  const [name, setName] = useState(folder?.name ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError(copy.folder.emptyName);
    setBusy(true);
    try {
      if (folder) {
        await repo.renameFolder(folder.id, name);
        onSaved?.({ id: folder.id, name: name.trim() });
      } else {
        const f = await repo.createFolder(name);
        onSaved?.(f);
      }
      onClose();
    } catch (e) {
      setError(e instanceof DuplicateFolderError ? copy.folder.duplicate : String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title={folder ? copy.folder.renameTitle : copy.folder.newTitle}
      cancel={{ label: copy.common.cancel, onPress: onClose }}
      confirm={{ label: folder ? copy.folder.rename : copy.folder.create, onPress: save, loading: busy }}
    >
      <TextField
        label={copy.folder.nameLabel}
        placeholder={copy.folder.namePlaceholder}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        error={error}
        autoFocus
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={save}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------- folder picker (S08 sheet)

export function FolderPickerSheet({
  open,
  onClose,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onPick: (folderId: string | null, name: string | null) => void;
}) {
  const t = useTheme();
  const folders = useQuery((r) => r.listFolders(), []).data ?? [];
  const [creating, setCreating] = useState(false);
  return (
    <>
      <BottomSheet open={open && !creating} onClose={onClose} title={copy.actions.moveToFolder}>
        <ScrollView style={{ maxHeight: t.layout['sheet-list-max-height'] }} role="radiogroup" aria-label={copy.actions.moveToFolder}>
          <SheetRow role="radio" label={copy.folder.none} selected={value === null} onPress={() => onPick(null, null)} />
          {folders.map((f) => (
            <SheetRow
              key={f.id}
              role="radio"
              icon={FolderIcon}
              label={f.name}
              selected={value === f.id}
              onPress={() => onPick(f.id, f.name)}
            />
          ))}
        </ScrollView>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.color.border, marginVertical: t.space[1] }} />
        <SheetRow icon={FolderPlus} label={`${copy.folder.newTitle}…`} onPress={() => setCreating(true)} />
      </BottomSheet>
      <FolderNameDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(f) => {
          setCreating(false);
          onPick(f.id, f.name);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- note actions (S10)

export type ActionTarget = {
  id: string;
  type: NoteType;
  title: string;
  pinned: boolean;
  folderId: string | null;
  deletedAt: number | null;
};

export function NoteActionsSheet({
  note,
  onClose,
  leaveOnTrash,
  onLabels,
}: {
  note: ActionTarget | null;
  onClose: () => void;
  /** Show a "Labels" row (the editor opens its label picker). */
  onLabels?: () => void;
  /** In the editor: go back to the list after moving the note to the trash. */
  leaveOnTrash?: boolean;
}) {
  const repo = useRepo();
  const snack = useSnackbar();
  const [confirm, setConfirm] = useState<'trash' | 'forever' | null>(null);
  const [picking, setPicking] = useState(false);
  // The parent keeps `note` set until done() calls onClose, so the dialogs
  // opened from the sheet still know which note they act on.
  const n = note;

  const done = () => {
    setConfirm(null);
    setPicking(false);
    onClose();
  };

  if (!n) return null;
  const inTrash = n.deletedAt !== null;

  const share = async () => {
    const text = await repo.noteAsText(n.id);
    onClose();
    try {
      await Share.share({ message: text, title: n.title || undefined });
    } catch {
      // Sharing is not available (some browsers): nothing else to do.
    }
  };

  return (
    <>
      <BottomSheet open={!!note && !confirm && !picking} onClose={onClose} title={n.title.trim() || copy.actions.title}>
        {inTrash ? (
          <>
            <SheetRow
              icon={ArchiveRestore}
              label={copy.editor.restore}
              onPress={async () => {
                await repo.restoreNote(n.id);
                snack(copy.trash.restored);
                done();
              }}
            />
            <SheetRow icon={Trash2} label={copy.delete.foreverConfirm} tone="danger" onPress={() => setConfirm('forever')} />
          </>
        ) : (
          <>
            <SheetRow
              icon={n.pinned ? PinOff : Pin}
              label={n.pinned ? copy.actions.unpin : copy.actions.pin}
              onPress={async () => {
                await repo.updateNote(n.id, { pinned: !n.pinned });
                done();
              }}
            />
            {onLabels ? <SheetRow icon={Tag} label={copy.editor.labels} onPress={onLabels} /> : null}
            <SheetRow icon={FolderIcon} label={copy.actions.moveToFolder} onPress={() => setPicking(true)} />
            <SheetRow icon={Share2} label={copy.actions.share} onPress={share} />
            <SheetRow
              icon={Copy}
              label={copy.actions.duplicate}
              onPress={async () => {
                const id = await repo.duplicateNote(n.id);
                done();
                snack(copy.actions.duplicated, id ? { label: copy.actions.open, onPress: () => router.push({ pathname: '/note/[id]', params: { id } }) } : undefined);
              }}
            />
            <SheetRow
              icon={n.type === 'text' ? CheckSquare : FileText}
              label={n.type === 'text' ? copy.actions.toList : copy.actions.toText}
              onPress={async () => {
                await repo.convertNote(n.id, n.type === 'text' ? 'checklist' : 'text');
                done();
              }}
            />
            <SheetRow icon={Trash2} label={copy.delete.confirm} tone="danger" onPress={() => setConfirm('trash')} />
          </>
        )}
      </BottomSheet>

      <FolderPickerSheet
        open={picking}
        onClose={done}
        value={n.folderId}
        onPick={async (folderId, name) => {
          await repo.updateNote(n.id, { folderId });
          snack(copy.folder.moved(name));
          done();
        }}
      />

      <Dialog
        open={confirm === 'trash'}
        title={copy.delete.title}
        body={copy.delete.body}
        cancel={{ label: copy.common.cancel, onPress: () => setConfirm(null) }}
        confirm={{
          label: copy.delete.confirm,
          variant: 'danger',
          onPress: async () => {
            const id = n.id;
            await repo.trashNote(id);
            done();
            if (leaveOnTrash) router.back();
            snack(copy.delete.done, { label: copy.delete.undo, onPress: () => repo.restoreNote(id) });
          },
        }}
      />
      <Dialog
        open={confirm === 'forever'}
        title={copy.delete.foreverTitle}
        body={copy.delete.foreverBody}
        cancel={{ label: copy.common.cancel, onPress: () => setConfirm(null) }}
        confirm={{
          label: copy.delete.foreverConfirm,
          variant: 'danger',
          onPress: async () => {
            await repo.deleteForever(n.id);
            done();
            if (leaveOnTrash) router.back();
            snack(copy.trash.deletedForever);
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
});
