import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Camera, ChevronLeft, ChevronRight, Images } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import {
  askExactAlarms,
  askReminderPermission,
  getReminderPermission,
  openAppSettings,
  type ReminderPermission,
} from '@/data/notifications';
import { deviceTimeZone, formatLocalTime, localParts, zonedToUtc, type Repeat } from '@/data/time';
import type { Reminder } from '@/data/types';
import { NOTE_FONTS, NOTE_SIZES, useTheme, type NoteColor, type NoteFont, type NoteSize } from '@/theme/theme';
import { Button, ColourPicker, FontOption, IconButton, Segmented, SettingsRow, Tag } from '@/ui/controls';
import { whenLabel } from '@/ui/format';
import { useNow } from '@/ui/useNow';
import { Banner } from '@/ui/layout';
import { BottomSheet } from '@/ui/overlays';
import { AppText } from '@/ui/Text';

import { SheetRow } from './sheets';

// ---------------------------------------------------------------- S05 colour

export function ColourSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: NoteColor; onChange: (c: NoteColor) => void }) {
  const t = useTheme();
  return (
    <BottomSheet open={open} onClose={onClose} title={copy.editor.colour}>
      <View style={{ paddingHorizontal: t.space[2], paddingBottom: t.space[2] }}>
        <ColourPicker value={value} onChange={onChange} />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------- S06 font and size

export function FontSheet({
  open,
  onClose,
  font,
  size,
  onFont,
  onSize,
}: {
  open: boolean;
  onClose: () => void;
  font: NoteFont;
  size: NoteSize;
  onFont: (f: NoteFont) => void;
  onSize: (s: NoteSize) => void;
}) {
  const t = useTheme();
  return (
    <BottomSheet open={open} onClose={onClose} title={copy.editor.font}>
      <View role="radiogroup" aria-label={copy.editor.font}>
        {NOTE_FONTS.map((f) => (
          <FontOption key={f} font={f} selected={f === font} onPress={() => onFont(f)} />
        ))}
      </View>
      <View style={{ padding: t.space[3], gap: t.space[2] }}>
        <AppText variant="sm" tone="muted">
          {copy.editor.textSize}
        </AppText>
        <Segmented
          label={copy.editor.textSize}
          value={size}
          onChange={onSize}
          options={NOTE_SIZES.map((s) => ({ value: s, label: s.toUpperCase(), a11y: copy.editor.sizes[s] }))}
        />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------- S07 reminder

type Draft = { y: number; m: number; d: number; hh: number; mm: number };

const tzLabel = (tz: string) => tz.replace(/_/g, ' ');

function draftFrom(ts: number, tz: string): Draft {
  const p = localParts(ts, tz);
  return { y: p.y, m: p.m, d: p.d, hh: p.hh, mm: p.mm };
}

function addDays(d: Draft, n: number): Draft {
  const x = new Date(Date.UTC(d.y, d.m - 1, d.d + n));
  return { ...d, y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

function quickPicks(now: number, tz: string) {
  const today = draftFrom(now, tz);
  const inThree = draftFrom(now + 3 * 3600_000, tz);
  const laterToday = { ...inThree, mm: inThree.mm < 30 ? 30 : 0, hh: inThree.mm < 30 ? inThree.hh : inThree.hh + 1 };
  const weekday = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay(); // 0 = Sunday
  const toMonday = ((8 - weekday) % 7) || 7;
  const picks: { label: string; draft: Draft }[] = [];
  if (laterToday.hh < 22 && laterToday.d === today.d) picks.push({ label: copy.reminder.laterToday, draft: laterToday });
  if (today.hh < 17) picks.push({ label: copy.reminder.tonight, draft: { ...today, hh: 18, mm: 0 } });
  picks.push({ label: copy.reminder.tomorrow, draft: { ...addDays(today, 1), hh: 9, mm: 0 } });
  picks.push({ label: copy.reminder.nextWeek, draft: { ...addDays(today, toMonday), hh: 9, mm: 0 } });
  return picks;
}

type ReminderSheetProps = {
  open: boolean;
  onClose: () => void;
  current: Reminder | null;
  onSave: (r: { fireAt: number; timezone: string; localTime: string; repeat: Repeat }) => Promise<void>;
  onRemove: () => Promise<void>;
};

/** Mounted only while open, so it always starts from the saved reminder (or tomorrow 9:00). */
export function ReminderSheet(props: ReminderSheetProps) {
  return props.open ? <ReminderSheetBody {...props} /> : null;
}

function ReminderSheetBody({ onClose, current, onSave, onRemove }: ReminderSheetProps) {
  const t = useTheme();
  const tz = current?.timezone ?? deviceTimeZone();
  const now = useNow();
  const [draft, setDraft] = useState<Draft>(() =>
    current ? draftFrom(current.fireAt, tz) : { ...addDays(draftFrom(Date.now(), tz), 1), hh: 9, mm: 0 },
  );
  const [repeat, setRepeat] = useState<Repeat>(current?.repeat ?? 'none');
  const [perm, setPerm] = useState<ReminderPermission | null>(null);
  const [iosPicker, setIosPicker] = useState<'date' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  const [picks] = useState(() => quickPicks(Date.now(), tz));

  useEffect(() => {
    getReminderPermission().then(setPerm, () => setPerm(null));
  }, []);

  const fireAt = useMemo(() => zonedToUtc(draft, tz), [draft, tz]);
  const inPast = repeat === 'none' && fireAt <= now;

  const asDate = new Date(fireAt);
  const pickNative = (mode: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: asDate,
        mode,
        is24Hour: undefined,
        minimumDate: mode === 'date' ? new Date() : undefined,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) setDraft(draftFrom(d.getTime(), tz));
        },
      });
    } else {
      setIosPicker(iosPicker === mode ? null : mode);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const p = await askReminderPermission();
      setPerm(p);
      await onSave({ fireAt, timezone: tz, localTime: formatLocalTime(draft.hh, draft.mm), repeat });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const dateText = asDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const timeText = asDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const web = Platform.OS === 'web';

  return (
    <BottomSheet open onClose={onClose} title={copy.reminder.title}>
      <ScrollView style={{ maxHeight: t.layout['sheet-list-max-height'] * 1.5 }} contentContainerStyle={{ gap: t.space[3], paddingHorizontal: t.space[2], paddingBottom: t.space[2] }}>
        <View style={styles.picks}>
          {picks.map((p) => (
            <Button key={p.label} label={p.label} variant="secondary" size="sm" onPress={() => setDraft(p.draft)} />
          ))}
        </View>

        <View style={{ borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.color.surface }}>
          {web ? (
            <>
              <Stepper label={copy.reminder.date} value={dateText} onDown={() => setDraft(addDays(draft, -1))} onUp={() => setDraft(addDays(draft, 1))} />
              <Stepper
                label={copy.reminder.time}
                value={timeText}
                onDown={() => setDraft(draftFrom(fireAt - 15 * 60_000, tz))}
                onUp={() => setDraft(draftFrom(fireAt + 15 * 60_000, tz))}
              />
            </>
          ) : (
            <>
              <SettingsRow title={copy.reminder.date} value={dateText} onPress={() => pickNative('date')} />
              {iosPicker === 'date' && (
                <DateTimePicker value={asDate} mode="date" display="inline" minimumDate={new Date()} onChange={(_, d) => d && setDraft({ ...draftFrom(d.getTime(), tz), hh: draft.hh, mm: draft.mm })} />
              )}
              <SettingsRow title={copy.reminder.time} value={timeText} onPress={() => pickNative('time')} />
              {iosPicker === 'time' && (
                <DateTimePicker value={asDate} mode="time" display="spinner" onChange={(_, d) => d && setDraft({ ...draft, hh: d.getHours(), mm: d.getMinutes() })} />
              )}
            </>
          )}
        </View>

        <View style={{ gap: t.space[2] }}>
          <AppText variant="sm" tone="muted">
            {copy.reminder.repeat}
          </AppText>
          <Segmented
            label={copy.reminder.repeat}
            value={repeat}
            onChange={setRepeat}
            options={(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => ({ value: r, label: copy.reminder.repeats[r] }))}
          />
        </View>

        <AppText variant="xs" tone="muted">
          {whenLabel(fireAt, now)} · {copy.reminder.timezone(tzLabel(tz))}
        </AppText>

        {inPast && <Banner tone="danger" message={copy.reminder.inPast} />}
        {perm?.notifications === 'denied' && (
          <Banner message={copy.reminder.permissionOff} action={{ label: copy.reminder.openSettings, onPress: openAppSettings }} />
        )}
        {perm?.notifications === 'undetermined' && <Tag label={copy.reminder.permissionAsk} />}
        {perm?.exact === false && <Banner message={copy.reminder.exactAlarmsOff} action={{ label: copy.reminder.allowExact, onPress: askExactAlarms }} />}
        {web && <Tag label={copy.reminder.webNote} />}

        <View style={styles.actions}>
          {current && (
            <Button
              label={copy.reminder.remove}
              variant="text"
              onPress={async () => {
                await onRemove();
                onClose();
              }}
            />
          )}
          <Button label={copy.reminder.save} onPress={save} loading={busy} disabled={inPast} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function Stepper({ label, value, onDown, onUp }: { label: string; value: string; onDown: () => void; onUp: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.stepper, { paddingLeft: t.space[4], borderBottomColor: t.color.border }]} role="group" aria-label={label}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <IconButton icon={ChevronLeft} label={`Earlier ${label.toLowerCase()}`} onPress={onDown} />
      <AppText variant="sm" weight="600" style={{ minWidth: 104, textAlign: 'center' }} aria-live="polite">
        {value}
      </AppText>
      <IconButton icon={ChevronRight} label={`Later ${label.toLowerCase()}`} onPress={onUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
});

// ---------------------------------------------------------------- add a photo or video

export function AttachSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (source: 'camera' | 'library') => void }) {
  const t = useTheme();
  return (
    <BottomSheet open={open} onClose={onClose} title={copy.attach.title}>
      <View style={{ paddingHorizontal: t.space[1], paddingBottom: t.space[2] }}>
        <SheetRow icon={Camera} label={copy.attach.camera} onPress={() => onPick('camera')} />
        <SheetRow icon={Images} label={copy.attach.library} onPress={() => onPick('library')} />
        {Platform.OS === 'web' ? (
          <AppText variant="sm" tone="muted" style={{ paddingHorizontal: t.space[3], paddingTop: t.space[2] }}>
            {copy.attach.webNote}
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}
