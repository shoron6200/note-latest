/**
 * S04 body: the checklist. Unticked items in order (drag to reorder), then a
 * "Done" group. Enter adds an item below; Backspace on an empty item removes
 * it and moves to the one above. Item text saves on a short debounce.
 */
import { ChevronDown, ChevronRight, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, View, type TextInputInstance } from 'react-native';

import { copy } from '@/copy';
import { useRepo } from '@/data/DataProvider';
import type { Item } from '@/data/types';
import { useTheme, withAlpha, type NoteFont, type NoteSize } from '@/theme/theme';
import { ChecklistRow } from '@/ui/fields';
import { AppText, focusRing, type PState } from '@/ui/Text';

type Props = {
  noteId: string;
  items: Item[];
  font: NoteFont;
  size: NoteSize;
  editable: boolean;
  /** Pauses the outer ScrollView while an item is being dragged. */
  onDragging: (dragging: boolean) => void;
  /** Lets the editor flush pending text before it leaves. */
  registerFlush: (fn: () => Promise<void>) => void;
};

export function ChecklistEditor({ noteId, items, font, size, editable, onDragging, registerFlush }: Props) {
  const t = useTheme();
  const repo = useRepo();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);
  const pending = useRef(new Map<string, string>());
  const writing = useRef<Promise<void> | null>(null);
  const refs = useRef(new Map<string, TextInputInstance | null>());

  // Unchecked order, kept locally so a drag can reorder before it is saved.
  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const [order, setOrder] = useState<string[]>(open.map((i) => i.id));
  const dragging = useRef<string | null>(null);
  useEffect(() => {
    if (!dragging.current) setOrder(open.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.id}:${i.checked}:${i.position}`).join('|')]);

  // Same as the note text: save as you type, one write in flight.
  const drain = useCallback((): Promise<void> => {
    if (writing.current) return writing.current;
    const run = (async () => {
      while (pending.current.size) {
        const batch = [...pending.current.entries()];
        pending.current.clear();
        for (const [id, text] of batch) await repo.updateItem(id, text);
      }
    })().finally(() => {
      writing.current = null;
    });
    writing.current = run;
    return run;
  }, [repo]);

  const flush = useCallback(async () => {
    await drain();
    if (pending.current.size) await drain();
  }, [drain]);

  useEffect(() => {
    registerFlush(flush);
    return () => {
      flush();
    };
  }, [flush, registerFlush]);

  const setText = (id: string, text: string) => {
    pending.current.set(id, text);
    void drain();
  };

  const addAfter = async (after?: string) => {
    await flush();
    const it = await repo.addItem(noteId, { after });
    setFocusId(it.id);
  };

  const remove = async (id: string, focusPrevious: boolean) => {
    pending.current.delete(id);
    const idx = order.indexOf(id);
    await repo.removeItem(id);
    if (focusPrevious && idx > 0) {
      const prev = order[idx - 1];
      setFocusId(prev);
      refs.current.get(prev)?.focus();
    }
  };

  const move = async (id: string, delta: number) => {
    const idx = order.indexOf(id);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(idx, 1);
    next.splice(to, 0, id);
    setOrder(next);
    await repo.reorderItems(noteId, [...next, ...done.map((d) => d.id)]);
  };

  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <View>
      <View role="list" aria-label={copy.newItem.checklist}>
        {order.map((id) => {
          const it = byId.get(id);
          if (!it) return null;
          return (
            <DraggableRow
              key={id}
              id={id}
              order={order}
              setOrder={setOrder}
              enabled={editable}
              onDragStart={() => {
                dragging.current = id;
                onDragging(true);
              }}
              onDragEnd={async (final) => {
                dragging.current = null;
                onDragging(false);
                await repo.reorderItems(noteId, [...final, ...done.map((d) => d.id)]);
              }}
            >
              {(handleProps, isDragging) => (
                <ItemRow
                  item={it}
                  position={{ index: order.indexOf(id) + 1, count: order.length }}
                  font={font}
                  size={size}
                  editable={editable}
                  autoFocus={focusId === id}
                  dragging={isDragging}
                  handleProps={editable ? handleProps : undefined}
                  inputRef={(r) => {
                    refs.current.set(id, r);
                  }}
                  onText={(s) => setText(id, s)}
                  onToggle={async () => {
                    await flush();
                    await repo.toggleItem(id);
                  }}
                  onSubmit={() => addAfter(id)}
                  onRemove={(viaKey) => remove(id, viaKey)}
                  onMoveUp={() => move(id, -1)}
                  onMoveDown={() => move(id, 1)}
                  onBlur={flush}
                />
              )}
            </DraggableRow>
          );
        })}
      </View>

      {editable && (
        <Pressable
          role="button"
          aria-label={copy.editor.addItem}
          onPress={() => addAfter(order[order.length - 1])}
          style={(s: PState) => [
            { flexDirection: 'row', alignItems: 'center', gap: t.space[3], minHeight: 48, paddingLeft: t.space[2] + 2, borderRadius: t.radius.md },
            (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.05) },
            focusRing(t, s, t.radius.md),
          ]}
        >
          <Plus size={22} color={t.color.textMuted} />
          <AppText tone="muted">{copy.editor.addItem}</AppText>
        </Pressable>
      )}

      {done.length > 0 && (
        <View style={{ marginTop: t.space[3] }}>
          <Pressable
            role="button"
            aria-expanded={showDone}
            aria-label={copy.editor.done(done.length)}
            onPress={() => setShowDone(!showDone)}
            style={(s: PState) => [
              { flexDirection: 'row', alignItems: 'center', gap: t.space[2], minHeight: 44, paddingLeft: t.space[2] },
              focusRing(t, s, t.radius.md),
            ]}
          >
            {showDone ? <ChevronDown size={18} color={t.color.textMuted} /> : <ChevronRight size={18} color={t.color.textMuted} />}
            <AppText variant="sm" tone="muted" weight="600">
              {copy.editor.done(done.length)}
            </AppText>
          </Pressable>
          {showDone &&
            done.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                font={font}
                size={size}
                editable={editable}
                inputRef={(r) => {
                  refs.current.set(it.id, r);
                }}
                onText={(s) => setText(it.id, s)}
                onToggle={async () => {
                  await flush();
                  await repo.toggleItem(it.id);
                }}
                onRemove={() => remove(it.id, false)}
                onBlur={flush}
              />
            ))}
        </View>
      )}
    </View>
  );
}

/** One item, with its text held locally so typing never waits on the database. */
function ItemRow({
  item,
  position,
  font,
  size,
  editable,
  autoFocus,
  dragging,
  handleProps,
  inputRef,
  onText,
  onToggle,
  onSubmit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onBlur,
}: {
  item: Item;
  position?: { index: number; count: number };
  font: NoteFont;
  size: NoteSize;
  editable: boolean;
  autoFocus?: boolean;
  dragging?: boolean;
  handleProps?: ReturnType<typeof PanResponder.create>['panHandlers'];
  inputRef: (r: TextInputInstance | null) => void;
  onText: (s: string) => void;
  onToggle: () => void;
  onSubmit?: () => void;
  onRemove: (viaBackspace: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onBlur: () => void;
}) {
  const [text, setText] = useState(item.text);
  return (
    <ChecklistRow
      ref={inputRef}
      text={text}
      checked={item.checked}
      font={font}
      size={size}
      editable={editable}
      autoFocus={autoFocus}
      dragging={dragging}
      handleProps={handleProps}
      position={position}
      onChangeText={(s) => {
        // A pasted block of lines becomes one item per line.
        setText(s.replace(/\n/g, ' '));
        onText(s.replace(/\n/g, ' '));
      }}
      onToggle={onToggle}
      // Web textareas get Enter through onKeyPress below; phones use the return key.
      onSubmit={Platform.OS === 'web' ? undefined : onSubmit}
      onRemove={() => onRemove(false)}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onBlur={onBlur}
      onKeyPress={(e) => {
        if (e.nativeEvent.key === 'Backspace' && text === '') onRemove(true);
        if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && onSubmit) {
          (e as unknown as { preventDefault?: () => void }).preventDefault?.();
          onSubmit();
        }
      }}
    />
  );
}

/**
 * Drag to reorder with a plain PanResponder: the dragged row follows the
 * finger, and swaps with a neighbour once it passes half that neighbour's
 * height. Works with touch and with a mouse on web.
 */
function DraggableRow({
  id,
  order,
  setOrder,
  enabled,
  onDragStart,
  onDragEnd,
  children,
}: {
  id: string;
  order: string[];
  setOrder: (o: string[]) => void;
  enabled: boolean;
  onDragStart: () => void;
  onDragEnd: (finalOrder: string[]) => void;
  children: (handleProps: ReturnType<typeof PanResponder.create>['panHandlers'], isDragging: boolean) => ReactNode;
}) {
  const t = useTheme();
  const [active, setActive] = useState(false);
  const [gesture] = useState(() => new DragGesture(id, order, setActive));
  useEffect(() => {
    gesture.update({ order, setOrder, enabled, onDragStart, onDragEnd, duration: t.motion.fast });
  });

  return (
    <Animated.View
      role="listitem"
      onLayout={(e) => gesture.setHeight(e.nativeEvent.layout.height)}
      style={{ transform: [{ translateY: gesture.y }], zIndex: active ? 10 : 0 }}
    >
      {children(gesture.handlers, active)}
    </Animated.View>
  );
}

type Latest = {
  order: string[];
  setOrder: (o: string[]) => void;
  enabled: boolean;
  onDragStart: () => void;
  onDragEnd: (finalOrder: string[]) => void;
  duration: number;
};

/** The gesture and its bookkeeping. Mutated only by gesture callbacks and update(). */
class DragGesture {
  readonly y = new Animated.Value(0);
  readonly handlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  private latest: Latest;
  private order: string[];
  private offset = 0;
  private height = 56;

  constructor(
    private readonly id: string,
    order: string[],
    private readonly setActive: (v: boolean) => void,
  ) {
    this.order = order;
    this.latest = { order, setOrder: () => {}, enabled: true, onDragStart: () => {}, onDragEnd: () => {}, duration: 120 };
    this.handlers = PanResponder.create({
      onStartShouldSetPanResponder: () => this.latest.enabled,
      onMoveShouldSetPanResponder: () => this.latest.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => this.start(),
      onPanResponderMove: (_, g) => this.move(g.dy),
      onPanResponderRelease: () => this.finish(),
      onPanResponderTerminate: () => this.finish(),
    }).panHandlers;
  }

  update(latest: Latest) {
    this.latest = latest;
  }

  setHeight(h: number) {
    this.height = h;
  }

  private start() {
    this.order = this.latest.order;
    this.offset = 0;
    this.setActive(true);
    this.latest.onDragStart();
  }

  private move(gdy: number) {
    let dy = gdy - this.offset;
    const cur = this.order;
    const idx = cur.indexOf(this.id);
    const h = this.height;
    const swap = (to: number) => {
      const next = [...cur];
      [next[idx], next[to]] = [next[to], next[idx]];
      this.order = next;
      this.latest.setOrder(next);
    };
    if (dy > h / 2 && idx < cur.length - 1) {
      swap(idx + 1);
      this.offset += h;
      dy -= h;
    } else if (dy < -h / 2 && idx > 0) {
      swap(idx - 1);
      this.offset -= h;
      dy += h;
    }
    this.y.setValue(dy);
  }

  private finish() {
    Animated.timing(this.y, { toValue: 0, duration: this.latest.duration, useNativeDriver: false }).start();
    this.setActive(false);
    this.latest.onDragEnd(this.order);
  }
}
