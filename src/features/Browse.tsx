/**
 * The main screen: the Pocketleaf wordmark with search and the view toggle,
 * a navigation drawer (All notes, Reminders, Folders, Labels, Archive, Trash,
 * Settings), notes as an index or a grid of leaves, the Write button (tap:
 * a new note; chevron or long-press: list, photo, voice), and long-press
 * multi-select.
 */
import { router } from 'expo-router';
import {
  Archive,
  ArrowLeft,
  Bell,
  CheckSquare,
  Folder as FolderIcon,
  FolderCog,
  Image as ImageIcon,
  LayoutGrid,
  Hash,
  Menu,
  NotebookText,
  Mic,
  MoreVertical,
  Pencil,
  Plus,
  Rows3,
  Search,
  Settings2,
  Tag,
  Trash,
  Trash2,
  Type,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME, copy } from '@/copy';
import { useQuery, useRepo, useSettings } from '@/data/DataProvider';
import type { BrowseView, NoteSummary, NoteType } from '@/data/types';
import { labelErrorText } from '@/features/labels';
import { SelectionBar, useSelection } from '@/features/selection';
import { SheetRow } from '@/features/sheets';
import { gridColumns, isWide, useTheme } from '@/theme/theme';
import { Fab, IconButton } from '@/ui/controls';
import { DrawerDivider, DrawerHeading, DrawerItem, NavDrawer } from '@/ui/drawer';
import { TextField } from '@/ui/fields';
import { EmptyState } from '@/ui/layout';
import { GridSkeleton, NoteSections, sectionsFor } from '@/ui/NoteGrid';
import { BottomSheet, Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

const same = (a: BrowseView, b: BrowseView) => a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '');

export function Browse({ fixed }: { fixed?: BrowseView }) {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const settings = useSettings();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState<BrowseView>(fixed ?? { kind: 'notes' });
  const [drawer, setDrawer] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const lastY = useRef(0);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'deleteLabel' | 'emptyTrash' | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const sel = useSelection();

  const labels = useQuery((r) => r.listLabels(), []).data;
  const folders = useQuery((r) => r.listFolders(), []).data;

  // The label or folder on screen was deleted (here or in Edit labels): back to Notes.
  const gone =
    (picked.kind === 'label' && labels && !labels.some((l) => l.id === picked.id)) ||
    (picked.kind === 'folder' && folders && !folders.some((f) => f.id === picked.id));
  const view: BrowseView = gone ? { kind: 'notes' } : picked;
  const label = view.kind === 'label' ? labels?.find((l) => l.id === view.id) : undefined;
  const folder = view.kind === 'folder' ? folders?.find((f) => f.id === view.id) : undefined;

  const sort = settings?.sort ?? 'updated';
  const viewMode = settings?.viewMode ?? 'list';
  const notes = useQuery((r) => r.listView(view, sort), [view, sort]);
  const list = notes.data;

  const gutter = isWide(width) ? t.layout['gutter-wide'] : t.layout.gutter;
  const columns = viewMode === 'list' ? 1 : gridColumns(Math.min(width, 1280) - gutter * 2);
  // The index reads best at a book-like measure; the grid may use the room.
  const contentWidth = Math.min(width - gutter * 2, viewMode === 'list' ? t.layout['list-max-width'] : 1280 - gutter * 2);
  const canCreate = view.kind !== 'archive' && view.kind !== 'trash';

  const go = (v: BrowseView) => {
    setDrawer(false);
    sel.clear();
    if (v.kind === 'trash' && fixed) return;
    setPicked(v);
  };

  // One note per tap: a double tap on Write must not make two.
  const creating = useRef(false);
  const create = async (type: NoteType, attach?: 'library' | 'voice') => {
    setFabOpen(false);
    if (creating.current) return;
    creating.current = true;
    try {
      const id = await repo.createNote({
        type,
        folderId: view.kind === 'folder' ? view.id : null,
        labelId: view.kind === 'label' ? view.id : null,
      });
      router.push({ pathname: '/note/[id]', params: attach ? { id, isNew: '1', attach } : { id, isNew: '1' } });
    } finally {
      setTimeout(() => (creating.current = false), 600);
    }
  };

  // Android back: a drawer view goes back to All notes (the "Start a…" sheet handles its own back).
  useEffect(() => {
    const busy = !fabOpen && !fixed && view.kind !== 'notes' && !sel.active && !drawer;
    if (!busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPicked({ kind: 'notes' });
      return true;
    });
    return () => sub.remove();
  }, [fabOpen, fixed, view.kind, sel.active, drawer]);

  const open = (n: NoteSummary) => {
    if (sel.active) sel.toggle(n.id);
    else router.push({ pathname: '/note/[id]', params: { id: n.id } });
  };

  const title =
    view.kind === 'reminders'
      ? copy.nav.reminders
      : view.kind === 'archive'
        ? copy.nav.archive
        : view.kind === 'trash'
          ? copy.nav.trash
          : view.kind === 'label'
            ? (label?.name ?? '')
            : view.kind === 'folder'
              ? (folder?.name ?? '')
              : APP_NAME;

  const toggleView = (
    <IconButton
      icon={viewMode === 'grid' ? Rows3 : LayoutGrid}
      label={viewMode === 'grid' ? copy.home.asList : copy.home.asGrid}
      onPress={() => repo.setSetting('viewMode', viewMode === 'grid' ? 'list' : 'grid')}
    />
  );
  const menuButton = fixed ? (
    <IconButton icon={ArrowLeft} label={copy.common.back} onPress={() => router.back()} />
  ) : (
    <IconButton icon={Menu} label={copy.nav.open} onPress={() => setDrawer(true)} />
  );
  const hasMenu = view.kind === 'label' || (view.kind === 'trash' && !!list?.length);

  const selected = list?.filter((n) => sel.ids.has(n.id)) ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }} edges={['top', 'left', 'right']}>
      {sel.active ? (
        <SelectionBar notes={selected} inTrash={view.kind === 'trash'} onClear={sel.clear} />
      ) : (
        <View
          style={[
            styles.header,
            {
              height: t.layout['top-bar-height'],
              paddingHorizontal: Math.max(t.space[1], (width - contentWidth) / 2 - t.space[3]),
              borderBottomColor: t.color.border,
              borderBottomWidth: scrolled ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        >
          {menuButton}
          <AppText
            variant={view.kind === 'label' || view.kind === 'folder' || view.kind === 'notes' ? 'screen' : 'xl'}
            role="heading"
            numberOfLines={1}
            style={{ flex: 1, marginLeft: t.space[1] }}
          >
            {title}
          </AppText>
          <IconButton icon={Search} label={view.kind === 'notes' && !fixed ? copy.nav.searchBar : copy.home.search} onPress={() => router.push('/search')} />
          {toggleView}
          {hasMenu ? <IconButton icon={MoreVertical} label={copy.home.more} onPress={() => setMenu(true)} /> : null}
        </View>
      )}

      <ScrollView
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setScrolled(y > 4);
          // The Write button folds to its pen while reading down, and opens again on the way up.
          if (Math.abs(y - lastY.current) > 8) {
            setCompact(y > lastY.current && y > 48);
            lastY.current = y;
          }
        }}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: t.layout['fab-size'] * 2 + t.space[6] }}
      >
        <View style={{ width: contentWidth, paddingTop: t.space[2], alignSelf: 'center', gap: t.space[3] }}>
          {view.kind === 'trash' && list && list.length > 0 ? (
            <AppText variant="sm" tone="muted" style={{ paddingHorizontal: t.space[1] }}>
              {copy.trash.hint}
            </AppText>
          ) : null}
          {notes.error ? (
            <EmptyState title={copy.home.loadError} body={notes.error.message} action={{ label: copy.common.tryAgain, onPress: notes.reload }} />
          ) : !list ? (
            <GridSkeleton columns={columns} />
          ) : list.length === 0 ? (
            <Empty view={view} />
          ) : (
            <NoteSections
              sections={sectionsFor(view.kind, list)}
              columns={columns}
              showFolder={view.kind !== 'folder'}
              hideLabel={view.kind === 'label' ? view.id : undefined}
              selected={sel.active ? sel.ids : null}
              onOpen={open}
              onLongPress={(n) => sel.toggle(n.id)}
            />
          )}
        </View>
      </ScrollView>

      {canCreate && !sel.active && (
        <Fab
          compact={compact}
          onPress={() => create('text')}
          onMore={() => setFabOpen(true)}
          style={{ position: 'absolute', right: Math.max(t.layout['fab-offset'], (width - contentWidth) / 2), bottom: t.layout['fab-offset'] + t.space[4] }}
        />
      )}
      <BottomSheet open={fabOpen} onClose={() => setFabOpen(false)} title={copy.newItem.moreTitle}>
        <SheetRow icon={Type} label={copy.newItem.text} onPress={() => create('text')} />
        <SheetRow icon={CheckSquare} label={copy.newItem.checklist} onPress={() => create('checklist')} />
        <SheetRow icon={ImageIcon} label={copy.newItem.image} onPress={() => create('text', 'library')} />
        <SheetRow icon={Mic} label={copy.newItem.voice} onPress={() => create('text', 'voice')} />
      </BottomSheet>

      {!fixed && (
        <NavDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          header={
            <AppText variant="screen" role="heading" style={{ paddingHorizontal: t.space[6], paddingTop: t.space[3], paddingBottom: t.space[4] }}>
              {APP_NAME}
            </AppText>
          }
        >
          <DrawerItem icon={NotebookText} label={copy.nav.notes} selected={view.kind === 'notes'} onPress={() => go({ kind: 'notes' })} />
          <DrawerItem icon={Bell} label={copy.nav.reminders} selected={view.kind === 'reminders'} onPress={() => go({ kind: 'reminders' })} />
          <DrawerDivider />
          <DrawerHeading label={copy.nav.folders} action={{ label: copy.nav.editLabels, a11y: copy.nav.manageFolders, onPress: () => (setDrawer(false), router.push('/folders')) }} />
          {folders?.map((f) => (
            <DrawerItem key={f.id} icon={FolderIcon} label={f.name} selected={same(view, { kind: 'folder', id: f.id })} onPress={() => go({ kind: 'folder', id: f.id })} />
          ))}
          {folders && folders.length === 0 ? (
            <DrawerItem icon={FolderCog} label={copy.nav.manageFolders} onPress={() => (setDrawer(false), router.push('/folders'))} />
          ) : null}
          {labels?.length ? (
            <>
              <DrawerDivider />
              <DrawerHeading label={copy.nav.labels} action={{ label: copy.nav.editLabels, a11y: copy.nav.editLabelsA11y, onPress: () => (setDrawer(false), router.push('/labels')) }} />
              {labels.map((l) => (
                <DrawerItem key={l.id} icon={Hash} label={l.name} selected={same(view, { kind: 'label', id: l.id })} onPress={() => go({ kind: 'label', id: l.id })} />
              ))}
            </>
          ) : (
            <DrawerDivider />
          )}
          <DrawerItem icon={Plus} label={copy.nav.createLabel} onPress={() => (setDrawer(false), router.push({ pathname: '/labels', params: { create: '1' } }))} />
          <DrawerDivider />
          <DrawerItem icon={Archive} label={copy.nav.archive} selected={view.kind === 'archive'} onPress={() => go({ kind: 'archive' })} />
          <DrawerItem icon={Trash2} label={copy.nav.trash} selected={view.kind === 'trash'} onPress={() => go({ kind: 'trash' })} />
          <DrawerDivider />
          <DrawerItem icon={Settings2} label={copy.nav.settings} onPress={() => (setDrawer(false), router.push('/settings'))} />
        </NavDrawer>
      )}

      <BottomSheet open={menu} onClose={() => setMenu(false)} title={title}>
        {view.kind === 'label' ? (
          <>
            <SheetRow icon={Pencil} label={copy.browse.renameLabel} onPress={() => (setMenu(false), setDialog('rename'))} />
            <SheetRow icon={Trash2} label={copy.browse.deleteLabel} tone="danger" onPress={() => (setMenu(false), setDialog('deleteLabel'))} />
          </>
        ) : (
          <SheetRow icon={Trash2} label={copy.trash.emptyAll} tone="danger" onPress={() => (setMenu(false), setDialog('emptyTrash'))} />
        )}
      </BottomSheet>

      {label && <RenameLabelDialog open={dialog === 'rename'} onClose={() => setDialog(null)} id={label.id} name={label.name} />}
      <Dialog
        open={dialog === 'deleteLabel'}
        title={copy.labels.deleteTitle}
        body={copy.labels.deleteBody}
        cancel={{ label: copy.common.cancel, onPress: () => setDialog(null) }}
        confirm={{
          label: copy.labels.delete,
          variant: 'danger',
          onPress: async () => {
            if (label) await repo.deleteLabel(label.id);
            setDialog(null);
            setPicked({ kind: 'notes' });
          },
        }}
      />
      <Dialog
        open={dialog === 'emptyTrash'}
        title={copy.trash.emptyAllTitle}
        body={copy.trash.emptyAllBody(list?.length ?? 0)}
        cancel={{ label: copy.common.cancel, onPress: () => setDialog(null) }}
        confirm={{
          label: copy.trash.emptyAll,
          variant: 'danger',
          onPress: async () => {
            await repo.emptyTrash();
            setDialog(null);
            snack(copy.trash.deletedForever);
          },
        }}
      />
    </SafeAreaView>
  );
}

function Empty({ view }: { view: BrowseView }) {
  switch (view.kind) {
    case 'archive':
      return <EmptyState icon={Archive} title={copy.browse.archiveEmptyTitle} body={copy.browse.archiveEmptyBody} />;
    case 'reminders':
      return <EmptyState icon={Bell} title={copy.browse.remindersEmptyTitle} body={copy.browse.remindersEmptyBody} />;
    case 'trash':
      return <EmptyState icon={Trash} title={copy.trash.emptyTitle} body={copy.trash.emptyBody} />;
    case 'label':
      return <EmptyState icon={Tag} title={copy.browse.labelEmptyTitle} body={copy.browse.labelEmptyBody} />;
    case 'folder':
      return <EmptyState icon={FolderIcon} title={copy.home.emptyFolderTitle} body={copy.home.emptyFolderBody} />;
    default:
      return <EmptyState title={copy.home.emptyTitle} body={copy.home.emptyBody} />;
  }
}

/** Mounted only while open, so it starts from the label's current name. */
function RenameLabelDialog(props: { open: boolean; onClose: () => void; id: string; name: string }) {
  return props.open ? <RenameLabelBody {...props} /> : null;
}

function RenameLabelBody({ onClose, id, name: initial }: { onClose: () => void; id: string; name: string }) {
  const repo = useRepo();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const save = async () => {
    try {
      await repo.renameLabel(id, name);
      onClose();
    } catch (e) {
      setError(labelErrorText(e));
    }
  };
  return (
    <Dialog open title={copy.browse.renameLabel} cancel={{ label: copy.common.cancel, onPress: onClose }} confirm={{ label: copy.folder.rename, onPress: save }}>
      <TextField
        label={copy.labels.nameLabel}
        value={name}
        onChangeText={(v) => (setName(v), setError(undefined))}
        error={error}
        autoFocus
        maxLength={50}
        returnKeyType="done"
        onSubmitEditing={save}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
