/** S08 Folders: create, rename and delete. Deleting a folder keeps its notes. */
import { router } from 'expo-router';
import { Folder as FolderIcon, FolderPlus, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery, useRepo } from '@/data/DataProvider';
import type { Folder } from '@/data/types';
import { FolderNameDialog } from '@/features/sheets';
import { useTheme } from '@/theme/theme';
import { Button, IconButton } from '@/ui/controls';
import { EmptyState, TopBar } from '@/ui/layout';
import { Dialog } from '@/ui/overlays';
import { useSnackbar } from '@/ui/snackbar';
import { AppText } from '@/ui/Text';

export default function FoldersScreen() {
  const t = useTheme();
  const repo = useRepo();
  const snack = useSnackbar();
  const { data: folders } = useQuery((r) => r.listFolders(), []);
  const [editing, setEditing] = useState<Folder | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar
        onBack={() => router.back()}
        title={copy.folder.title}
        actions={<IconButton icon={FolderPlus} label={copy.folder.newTitle} onPress={() => setEditing('new')} />}
      />
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: t.layout.gutter }}>
        <View style={{ width: '100%', maxWidth: t.layout['editor-max-width'] }}>
          {!folders ? null : folders.length === 0 ? (
            <EmptyState icon={FolderIcon} title={copy.folder.emptyTitle} body={copy.folder.emptyBody} action={{ label: copy.folder.newTitle, onPress: () => setEditing('new') }} />
          ) : (
            <View role="list" style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: t.color.border }}>
              {folders.map((f, i) => (
                <View
                  key={f.id}
                  role="listitem"
                  style={[
                    styles.row,
                    { paddingLeft: t.space[4], borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: t.color.border },
                  ]}
                >
                  <FolderIcon size={22} color={t.color.textMuted} />
                  <View style={{ flex: 1, paddingVertical: t.space[3] }}>
                    <AppText numberOfLines={2}>{f.name}</AppText>
                    <AppText variant="sm" tone="muted">
                      {copy.folder.count(f.count)}
                    </AppText>
                  </View>
                  <IconButton icon={Pencil} label={`${copy.folder.rename} ${f.name}`} onPress={() => setEditing(f)} />
                  <IconButton icon={Trash2} label={`${copy.folder.delete} ${f.name}`} variant="danger" onPress={() => setDeleting(f)} />
                </View>
              ))}
            </View>
          )}
          {folders && folders.length > 0 && (
            <View style={{ marginTop: t.space[4] }}>
              <Button label={copy.folder.newTitle} icon={FolderPlus} variant="secondary" onPress={() => setEditing('new')} />
            </View>
          )}
        </View>
      </ScrollView>

      <FolderNameDialog open={editing !== null} onClose={() => setEditing(null)} folder={editing && editing !== 'new' ? editing : undefined} />
      <Dialog
        open={!!deleting}
        title={deleting ? copy.folder.deleteTitle(deleting.name) : ''}
        body={deleting ? copy.folder.deleteBody(deleting.count) : ''}
        cancel={{ label: copy.common.cancel, onPress: () => setDeleting(null) }}
        confirm={{
          label: copy.folder.delete,
          variant: 'danger',
          onPress: async () => {
            if (!deleting) return;
            await repo.deleteFolder(deleting.id);
            setDeleting(null);
            snack(copy.folder.moved(null));
          },
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
});
