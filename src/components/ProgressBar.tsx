import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

// Simple fill bar (capacity claimed).
export function ProgressBar({ value, color = colors.deepOrange, height = 6, track = colors.track }: {
  value: number; // 0..1
  color?: string;
  height?: number;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height, backgroundColor: track }]}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

// Segmented bar: verified | pending | remaining. Verified work and pending reports are always distinct.
export function ImpactBar({
  verified,
  pending,
  total,
  label,
  onDark,
  height = 8,
}: {
  verified: number;
  pending: number;
  total: number;
  label: string;
  onDark?: boolean;
  height?: number;
}) {
  const v = total > 0 ? (verified / total) * 100 : 0;
  const p = total > 0 ? (pending / total) * 100 : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.segmented, { height, backgroundColor: onDark ? 'rgba(253,251,247,0.18)' : colors.track }]}>
      {v > 0 ? <View style={{ width: `${v}%`, backgroundColor: onDark ? colors.cream : colors.purple }} /> : null}
      {p > 0 ? <View style={{ width: `${p}%`, backgroundColor: colors.amber }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 999, overflow: 'hidden' },
  segmented: { flexDirection: 'row', gap: 3, borderRadius: 999, overflow: 'hidden' },
});
