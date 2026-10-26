import { Check, GripVertical, Search, X } from 'lucide-react-native';
import { forwardRef, useState, type Ref } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderHandlers,
  type TextInputInstance,
  type TextInputKeyPressEvent,
  type TextInputProps,
} from 'react-native';

import { noteFontStyle } from '@/theme/fonts';
import { useTheme, withAlpha, type NoteFont, type NoteSize } from '@/theme/theme';

import { AppText, focusRing, type PState } from './Text';

// ---------------------------------------------------------------- TextField

type FieldVariant = 'title' | 'body' | 'search' | 'dialog';

export function TextField({
  variant = 'dialog',
  label,
  error,
  font = 'default',
  size = 'm',
  onClear,
  style,
  ...input
}: TextInputProps & {
  variant?: FieldVariant;
  /** Visible label (dialog) or accessibility label (others). Always required. */
  label: string;
  error?: string;
  font?: NoteFont;
  size?: NoteSize;
  onClear?: () => void;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const text =
    variant === 'title'
      ? { ...t.type.xl, ...noteFontStyle(font, true) }
      : variant === 'body'
        ? { fontSize: t.noteSize[size].size, lineHeight: t.noteSize[size].line, ...noteFontStyle(font) }
        : t.type.base;

  const box =
    variant === 'dialog'
      ? {
          borderWidth: focused || error ? 2 : 1,
          borderColor: error ? t.color.danger : focused ? t.color.focus : t.color.borderInput,
          borderRadius: t.radius.md,
          paddingHorizontal: focused || error ? t.space[3] - 1 : t.space[3],
          minHeight: 48,
        }
      : variant === 'search'
        ? { backgroundColor: t.color.surface, borderRadius: t.radius.pill, paddingLeft: 44, paddingRight: 44, minHeight: 48 }
        : null;

  const field = (
    <View style={{ justifyContent: 'center' }}>
      {variant === 'search' && (
        <View style={styles.leading} pointerEvents="none">
          <Search size={20} color={t.color.textMuted} />
        </View>
      )}
      <TextInput
        aria-label={label}
        aria-invalid={!!error}
        placeholderTextColor={t.color.textMuted}
        selectionColor={t.color.accent}
        cursorColor={t.color.accent}
        maxFontSizeMultiplier={1.5}
        multiline={variant === 'body'}
        textAlignVertical={variant === 'body' ? 'top' : 'center'}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        {...input}
        style={[
          text,
          { color: t.color.text, paddingVertical: variant === 'dialog' || variant === 'search' ? 10 : 4 },
          box,
          // Web: the field's own border is the focus indicator, so drop the browser outline.
          { outlineStyle: 'none' } as object,
          style,
        ]}
      />
      {variant === 'search' && !!input.value && onClear && (
        <Pressable
          role="button"
          aria-label="Clear search"
          onPress={onClear}
          style={(s: PState) => [styles.trailing, focusRing(t, s, t.radius.pill)]}
        >
          <X size={20} color={t.color.textMuted} />
        </Pressable>
      )}
    </View>
  );

  if (variant !== 'dialog') return field;
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="sm" weight="500">
        {label}
      </AppText>
      {field}
      {error ? (
        <AppText variant="sm" tone="danger" aria-live="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- ChecklistRow

export type ChecklistRowProps = {
  text: string;
  checked: boolean;
  font?: NoteFont;
  size?: NoteSize;
  dragging?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  /** Pan handlers for the drag handle; no handle is shown without them. */
  handleProps?: GestureResponderHandlers;
  /** 1-based place in the list, announced on the drag handle. */
  position?: { index: number; count: number };
  onToggle?: () => void;
  onChangeText?: (s: string) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSubmit?: () => void;
  onBlur?: () => void;
  onKeyPress?: (e: TextInputKeyPressEvent) => void;
};

export const ChecklistRow = forwardRef(function ChecklistRow(
  {
    text,
    checked,
    font = 'default',
    size = 'm',
    dragging,
    autoFocus,
    editable = true,
    handleProps,
    position,
    onToggle,
    onChangeText,
    onRemove,
    onMoveUp,
    onMoveDown,
    onSubmit,
    onBlur,
    onKeyPress,
  }: ChecklistRowProps,
  ref: Ref<TextInputInstance>,
) {
  const t = useTheme();
  const textStyle = {
    fontSize: t.noteSize[size].size,
    lineHeight: t.noteSize[size].line,
    ...noteFontStyle(font),
    color: checked ? t.color.textMuted : t.color.text,
    textDecorationLine: checked ? ('line-through' as const) : ('none' as const),
  };
  return (
    <View
      style={[
        styles.checkRow,
        dragging && [{ backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, transform: [{ scale: 1.02 }] }, t.elevation.sheet],
      ]}
    >
      {handleProps ? (
        <View
          accessible
          accessibilityRole="adjustable"
          aria-label={`Move ${text || 'item'}`}
          accessibilityHint="Drag, or swipe up or down to move"
          accessibilityValue={position ? { min: 1, max: position.count, now: position.index, text: `${position.index} of ${position.count}` } : undefined}
          aria-valuemin={position ? 1 : undefined}
          aria-valuemax={position?.count}
          aria-valuenow={position?.index}
          aria-valuetext={position ? `${position.index} of ${position.count}` : undefined}
          accessibilityActions={[
            { name: 'increment', label: 'Move down' },
            { name: 'decrement', label: 'Move up' },
          ]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'decrement' ? onMoveUp?.() : onMoveDown?.())}
          style={[styles.handle, Platform.OS === 'web' && ({ cursor: 'grab' } as object)]}
          {...handleProps}
        >
          <GripVertical size={20} color={t.color.textMuted} />
        </View>
      ) : (
        <View style={styles.handleSpace} />
      )}
      <Pressable
        role="checkbox"
        aria-checked={checked}
        aria-label={text || 'Empty item'}
        onPress={onToggle}
        style={(s: PState) => [styles.boxTarget, focusRing(t, s, t.radius.sm)]}
      >
        <View
          style={[
            styles.box,
            { borderRadius: 6, borderColor: checked ? t.color.accent : t.color.borderInput },
            checked && { backgroundColor: t.color.accent },
          ]}
        >
          {checked && <Check size={16} color={t.color.onAccent} strokeWidth={3} />}
        </View>
      </Pressable>
      <TextInput
        ref={ref}
        value={text}
        editable={editable}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onBlur={onBlur}
        onKeyPress={onKeyPress}
        submitBehavior="submit"
        autoFocus={autoFocus}
        placeholder="List item"
        placeholderTextColor={t.color.textMuted}
        aria-label="Item text"
        multiline
        // Native multiline inputs grow with their text; a web textarea needs a starting row count.
        numberOfLines={Platform.OS === 'web' ? 1 : undefined}
        maxFontSizeMultiplier={1.5}
        selectionColor={t.color.accent}
        style={[styles.checkText, textStyle, { outlineStyle: 'none' } as object]}
      />
      {editable && <Pressable
        role="button"
        aria-label={`Remove ${text || 'item'}`}
        onPress={onRemove}
        style={(s: PState) => [
          styles.boxTarget,
          (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.08), borderRadius: t.radius.pill },
          focusRing(t, s, t.radius.pill),
        ]}
      >
        <X size={18} color={t.color.textMuted} />
      </Pressable>}
    </View>
  );
});

const styles = StyleSheet.create({
  leading: { position: 'absolute', left: 14, zIndex: 1 },
  trailing: { position: 'absolute', right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 48 },
  handle: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  handleSpace: { width: 8 },
  boxTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, paddingVertical: 12 },
});
