import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  right?: React.ReactNode;
};

export function TextField({ label, hint, error, optional, right, multiline, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="label" nativeID={`${label}-label`}>
          {label}
          {optional ? <Text variant="label" weight="regular" color={colors.muted}> (optional)</Text> : null}
        </Text>
        {right}
      </View>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor="#8A8378"
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && { borderColor: colors.purple },
          error ? { borderColor: colors.danger } : null,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (s: string) => void; placeholder: string }) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={styles.searchInput}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={8}>
          <Icon name="x" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Free-text tags (skills). Enter/submit adds a tag.
export function TagInput({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <View style={styles.wrap}>
      <Text variant="label">
        {label} <Text variant="label" weight="regular" color={colors.muted}>(optional)</Text>
      </Text>
      <View style={styles.tagBox}>
        {values.map((v) => (
          <View key={v} style={styles.tag}>
            <Text variant="bodySm" color={colors.amberText}>{v}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${v}`}
              onPress={() => onChange(values.filter((x) => x !== v))}
              style={styles.tagRemove}>
              <Icon name="x" size={13} color={colors.amberText} />
            </Pressable>
          </View>
        ))}
        <TextInput
          accessibilityLabel={label}
          value={draft}
          onChangeText={(t) => (t.endsWith(',') ? (setDraft(t.slice(0, -1)), setTimeout(add)) : setDraft(t))}
          onSubmitEditing={add}
          onBlur={add}
          blurOnSubmit={false}
          placeholder={placeholder}
          placeholderTextColor="#8A8378"
          style={styles.tagInput}
        />
      </View>
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  multiline: { minHeight: 110, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  search: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: fonts.regular, color: colors.text, height: '100%' },
  tagBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingLeft: 10,
    paddingRight: 2,
    borderRadius: 999,
    backgroundColor: colors.amberTint,
  },
  tagRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  tagInput: { flex: 1, minWidth: 100, height: 32, fontSize: 16, fontFamily: fonts.regular, color: colors.text },
});
