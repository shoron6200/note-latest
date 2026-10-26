/**
 * The design-system check (replica-design step 4): every primitive, in
 * isolation, in both themes. /design?mode=dark opens it in dark mode.
 * Not a user-facing screen; remove the route (or hide it) before release.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { CheckSquare, FileText, Folder, Pin, Search, SearchX, Share2, Trash2, Bell, Palette, Type } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { NOTE_FONT_LABELS } from '@/theme/fonts';
import {
  ModeContext,
  NOTE_COLORS,
  NOTE_FONTS,
  gridColumns,
  useTheme,
  type ModeSetting,
  type NoteColor,
  type NoteFont,
  type NoteSize,
} from '@/theme/theme';
import {
  Button,
  ColourPicker,
  Fab,
  FolderChip,
  FontOption,
  IconButton,
  Segmented,
  SettingsRow,
  Tag,
} from '@/ui/controls';
import { ChecklistRow, TextField } from '@/ui/fields';
import { Banner, EmptyState, TopBar } from '@/ui/layout';
import { NoteCard, type NoteCardData } from '@/ui/NoteCard';
import { DialogSurface, SheetSurface, Snackbar } from '@/ui/overlays';
import { AppText } from '@/ui/Text';

const SAMPLE: NoteCardData[] = [
  {
    id: '1',
    type: 'text',
    title: 'Ideas for the weekend',
    preview: 'Walk along the river if it is dry. Try the bakery near the station. Finish the second chapter.',
    color: 'yellow',
    font: 'default',
    pinned: true,
  },
  {
    id: '2',
    type: 'checklist',
    title: 'Groceries',
    preview: '',
    items: [
      { text: 'Oat milk', checked: false },
      { text: 'Tomatoes', checked: false },
      { text: 'Coffee beans', checked: false },
      { text: 'Bread', checked: true },
      { text: 'Lemons', checked: true },
    ],
    itemCount: 8,
    doneCount: 2,
    color: 'green',
    font: 'default',
    reminder: { label: 'Today 18:00' },
  },
  {
    id: '3',
    type: 'text',
    title: 'Book quotes',
    preview: 'Write down the lines worth keeping, with the page number.',
    color: 'purple',
    font: 'serif',
    folder: 'Reading',
  },
  {
    id: '4',
    type: 'text',
    title: '',
    preview: 'Wi-Fi at the cabin: ask the owner on arrival',
    color: 'default',
    font: 'default',
  },
  {
    id: '5',
    type: 'checklist',
    title: 'Packing',
    preview: '',
    items: [
      { text: 'Passport', checked: false },
      { text: 'Chargers', checked: false },
    ],
    itemCount: 2,
    doneCount: 0,
    color: 'blue',
    font: 'hand',
    reminder: { label: 'Yesterday 9:00', overdue: true },
  },
  {
    id: '6',
    type: 'text',
    title: 'Bike service',
    preview: 'Chain, brakes, rear tyre pressure.',
    color: 'orange',
    font: 'mono',
    reminder: { label: 'Mondays 8:00', repeat: true },
    folder: 'Home',
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[3], marginBottom: t.space[7] }}>
      <AppText variant="xs" tone="muted" weight="700" role="heading" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Row({ children, wrap = true, top }: { children: ReactNode; wrap?: boolean; top?: boolean }) {
  return <View style={[styles.row, wrap && { flexWrap: 'wrap' }, top && { alignItems: 'flex-start' }]}>{children}</View>;
}

function Swatch({ name, hex, border }: { name: string; hex: string; border: string }) {
  return (
    <View style={{ width: 92, gap: 4 }}>
      <View style={{ height: 44, borderRadius: 10, backgroundColor: hex, borderWidth: 1, borderColor: border }} />
      <AppText variant="xs">{name}</AppText>
      <AppText variant="xs" tone="muted">
        {hex}
      </AppText>
    </View>
  );
}

/** Masonry: split cards across N columns, keeping order left to right. */
function Masonry({ cards, columns }: { cards: NoteCardData[]; columns: number }) {
  const t = useTheme();
  const cols: NoteCardData[][] = Array.from({ length: columns }, () => []);
  cards.forEach((c, i) => cols[i % columns].push(c));
  return (
    <View style={{ flexDirection: 'row', gap: t.layout['grid-gap'] }}>
      {cols.map((col, i) => (
        <View key={i} style={{ flex: 1, gap: t.layout['grid-gap'] }}>
          {col.map((c) => (
            <NoteCard key={c.id} note={c} selected={c.id === '4'} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Gallery({ mode, setMode }: { mode: ModeSetting; setMode: (m: ModeSetting) => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [color, setColor] = useState<NoteColor>('yellow');
  const [font, setFont] = useState<NoteFont>('serif');
  const [size, setSize] = useState<NoteSize>('m');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('weekly');
  const [folder, setFolder] = useState('all');
  const [query, setQuery] = useState('bakery');
  const [items, setItems] = useState([
    { text: 'Call the dentist', checked: false },
    { text: 'Renew bus pass', checked: false },
    { text: 'Water the plants', checked: true },
  ]);
  const [toggle, setToggle] = useState(true);
  const content = Math.min(width, 960) - t.layout.gutter * 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }}>
      <TopBar
        title="Design system"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        actions={<IconButton icon={Search} label="Search" />}
        scrolled
      />
      <ScrollView contentContainerStyle={{ padding: t.layout.gutter, alignItems: 'center' }}>
        <View style={{ width: content }}>
          <Section title="Theme">
            <Segmented
              label="Theme"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Section>

          <Section title="Colour roles">
            <Row>
              {Object.entries(t.color)
                .filter(([k]) => k !== 'scrim')
                .map(([k, v]) => (
                  <Swatch key={k} name={k} hex={v} border={t.color.border} />
                ))}
            </Row>
          </Section>

          <Section title="Note colours">
            <Row>
              {NOTE_COLORS.map((c) => (
                <Swatch key={c} name={c} hex={t.note[c]} border={t.color.border} />
              ))}
            </Row>
          </Section>

          <Section title="Type">
            {(['display', 'xl', 'lg', 'base', 'sm', 'xs'] as const).map((v) => (
              <AppText key={v} variant={v}>
                {v} {t.type[v].fontSize}/{t.type[v].lineHeight} — Remember to buy stamps
              </AppText>
            ))}
            <View style={{ gap: 4, marginTop: 8 }}>
              {NOTE_FONTS.map((f) => (
                <FontOption key={f} font={f} selected={f === font} onPress={() => setFont(f)} />
              ))}
            </View>
          </Section>

          <Section title="Buttons">
            <Row>
              <Button label="Back up now" />
              <Button label="Restore" variant="secondary" />
              <Button label="Undo" variant="text" />
              <Button label="Delete forever" variant="danger" />
              <Button label="Saving" loading />
              <Button label="Disabled" disabled />
            </Row>
            <Row>
              <IconButton icon={Palette} label="Colour" />
              <IconButton icon={Type} label="Font" />
              <IconButton icon={Bell} label="Set reminder" />
              <IconButton icon={Pin} label="Pin" active />
              <IconButton icon={Share2} label="Share" />
              <IconButton icon={Trash2} label="Delete" variant="danger" />
              <IconButton icon={Folder} label="Move to folder" disabled />
            </Row>
          </Section>

          <Section title="Folder chips">
            <Row wrap={false}>
              {[
                { id: 'all', label: 'All', count: 24 },
                { id: 'work', label: 'Work', count: 9 },
                { id: 'home', label: 'Home', count: 6 },
                { id: 'reading', label: 'Reading', count: 3 },
              ].map((f) => (
                <FolderChip key={f.id} label={f.label} count={f.count} selected={folder === f.id} onPress={() => setFolder(f.id)} />
              ))}
            </Row>
          </Section>

          <Section title={`Note cards — ${gridColumns(content)} columns at this width`}>
            <Masonry cards={SAMPLE} columns={gridColumns(content)} />
          </Section>

          <Section title="Fields">
            <TextField variant="search" label={copy.search.placeholder} placeholder={copy.search.placeholder} value={query} onChangeText={setQuery} onClear={() => setQuery('')} />
            <TextField label={copy.folder.nameLabel} placeholder={copy.folder.namePlaceholder} />
            <TextField label={copy.folder.nameLabel} value="Work" error={copy.folder.duplicate} />
            <View style={{ backgroundColor: t.note.yellow, borderRadius: t.radius.md, padding: t.space[4], gap: 4 }}>
              <TextField variant="title" label="Title" placeholder="Title" defaultValue="Ideas for the weekend" font={font} />
              <TextField variant="body" label="Note" placeholder="Note" defaultValue={'Walk along the river if it is dry.\nTry the bakery near the station.'} font={font} size={size} />
            </View>
            <Segmented
              label="Text size"
              value={size}
              onChange={setSize}
              options={[
                { value: 's', label: 'S', a11y: 'Small text' },
                { value: 'm', label: 'M', a11y: 'Medium text' },
                { value: 'l', label: 'L', a11y: 'Large text' },
                { value: 'xl', label: 'XL', a11y: 'Extra large text' },
              ]}
            />
          </Section>

          <Section title="Checklist rows">
            <View style={{ backgroundColor: t.note.green, borderRadius: t.radius.md, paddingVertical: t.space[2] }}>
              {items.map((it, i) => (
                <ChecklistRow
                  key={i}
                  text={it.text}
                  checked={it.checked}
                  dragging={i === 1}
                  handleProps={{}}
                  onToggle={() => setItems(items.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                  onChangeText={(s) => setItems(items.map((x, j) => (j === i ? { ...x, text: s } : x)))}
                  onRemove={() => setItems(items.filter((_, j) => j !== i))}
                />
              ))}
            </View>
          </Section>

          <Section title="Bottom sheets">
            <Row top>
              <View style={styles.sheetDemo}>
                <SheetSurface title="Colour">
                  <ColourPicker value={color} onChange={setColor} />
                </SheetSurface>
              </View>
              <View style={styles.sheetDemo}>
                <SheetSurface title={copy.reminder.title}>
                  <View style={{ gap: t.space[3], paddingHorizontal: t.space[2] }}>
                    <SettingsRow title="Date" value="Mon 20 Oct" onPress={() => {}} />
                    <SettingsRow title="Time" value="9:00" onPress={() => {}} />
                    <Segmented
                      label="Repeat"
                      value={repeat}
                      onChange={setRepeat}
                      options={[
                        { value: 'none', label: 'Once' },
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'monthly', label: 'Monthly' },
                      ]}
                    />
                    <Banner message={copy.reminder.permissionOff} action={{ label: copy.reminder.openSettings, onPress: () => {} }} />
                    <Banner tone="danger" message={copy.reminder.inPast} />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                      <Button label={copy.reminder.remove} variant="text" />
                      <Button label={copy.reminder.save} />
                    </View>
                  </View>
                </SheetSurface>
              </View>
              <View style={styles.sheetDemo}>
                <SheetSurface title={copy.newItem.fabLabel}>
                  <SettingsRow title={copy.newItem.text} subtitle={copy.newItem.textHint} onPress={() => {}} />
                  <SettingsRow title={copy.newItem.checklist} subtitle={copy.newItem.checklistHint} onPress={() => {}} />
                </SheetSurface>
              </View>
            </Row>
          </Section>

          <Section title="Dialogs">
            <Row top>
              <View style={styles.sheetDemo}>
                <DialogSurface
                  title={copy.delete.title}
                  body={copy.delete.body}
                  cancel={{ label: copy.common.cancel, onPress: () => {} }}
                  confirm={{ label: copy.delete.confirm, variant: 'danger', onPress: () => {} }}
                />
              </View>
              <View style={styles.sheetDemo}>
                <DialogSurface title={copy.folder.newTitle} cancel={{ label: copy.common.cancel, onPress: () => {} }} confirm={{ label: copy.folder.create, onPress: () => {} }}>
                  <TextField label={copy.folder.nameLabel} placeholder={copy.folder.namePlaceholder} />
                </DialogSurface>
              </View>
            </Row>
          </Section>

          <Section title="Snackbar, tags, FAB">
            <Snackbar message={copy.delete.done} action={{ label: copy.delete.undo, onPress: () => {} }} />
            <Snackbar message={copy.backup.saved} />
            <Row>
              <Tag icon={Bell} label="Tomorrow 9:00" />
              <Tag icon={Bell} label="Yesterday 9:00" tone="danger" />
              <Tag icon={Folder} label="Work" />
            </Row>
            <Row top>
              <Fab />
              <Fab
                expanded
                actions={[
                  { label: copy.newItem.checklist, icon: CheckSquare, onPress: () => {} },
                  { label: copy.newItem.text, icon: FileText, onPress: () => {} },
                ]}
              />
            </Row>
          </Section>

          <Section title="Empty states">
            <View style={[styles.box, { borderColor: t.color.border, borderRadius: t.radius.md }]}>
              <EmptyState icon={FileText} title={copy.home.emptyTitle} body={copy.home.emptyBody} />
            </View>
            <View style={[styles.box, { borderColor: t.color.border, borderRadius: t.radius.md }]}>
              <EmptyState compact icon={SearchX} title={copy.search.noneTitle} body={copy.search.noneBody(query || 'that')} />
            </View>
          </Section>

          <Section title="Settings rows">
            <View style={{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, overflow: 'hidden' }}>
              <SettingsRow title="Theme" value={mode[0].toUpperCase() + mode.slice(1)} onPress={() => {}} />
              <SettingsRow title="Show notes as a grid" toggle={toggle} onToggle={setToggle} />
              <SettingsRow title="Back up and restore" subtitle="Last backup: never" onPress={() => {}} />
              <SettingsRow title="Note font" value={NOTE_FONT_LABELS[font]} onPress={() => {}} />
              <SettingsRow title="Calendar sync" subtitle="Not in this version" disabled />
            </View>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function DesignScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initial: ModeSetting = params.mode === 'dark' || params.mode === 'light' ? params.mode : 'system';
  const [mode, setMode] = useState<ModeSetting>(initial);
  return (
    <ModeContext.Provider value={mode}>
      <Gallery mode={mode} setMode={setMode} />
    </ModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sheetDemo: { width: 340, maxWidth: '100%' },
  box: { borderWidth: 1, borderStyle: 'dashed' },
});
