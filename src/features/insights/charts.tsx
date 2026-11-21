import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

/** KPI tile: icon, label, big number, optional trend line (SevaConnect style on SevaSetu tokens). */
export function StatTile({
  icon,
  label,
  value,
  sub,
  tone = 'purple',
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'purple' | 'orange' | 'green' | 'plum';
  onPress?: () => void;
}) {
  const t = {
    purple: { bg: colors.purpleTint, fg: colors.purpleDark },
    orange: { bg: colors.amberTint, fg: colors.orangeText },
    green: { bg: colors.successTint, fg: colors.success },
    plum: { bg: '#ECE7F4', fg: colors.plum },
  }[tone];
  const body = (
    <Row gap={14} style={{ alignItems: 'flex-start' }}>
      <View style={[styles.iconTile, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={20} color={t.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption">{label}</Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 34 }}>{value}</Text>
        {sub ? <Text variant="small" color={colors.success}>{sub}</Text> : null}
      </View>
    </Row>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, shadow, pressed && { backgroundColor: '#FBF8F3' }]}>
      {body}
    </Pressable>
  ) : (
    <View style={[styles.tile, shadow]}>{body}</View>
  );
}

/** Single-series area chart (one hue, no legend; hover / tap shows the value). */
export function AreaChart({
  points,
  height = 180,
  formatLabel,
  formatValue,
  label,
}: {
  points: { key: string; value: number }[];
  height?: number;
  formatLabel: (key: string) => string;
  formatValue: (v: number) => string;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value)) * 1.15;
  const padX = 8;
  const plotH = height - 8;
  const x = (i: number) => (n <= 1 ? width / 2 : padX + (i * (width - padX * 2)) / (n - 1));
  const y = (v: number) => plotH - (v / max) * (plotH - 8);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${plotH} L${x(0).toFixed(1)},${plotH} Z` : '';
  const shown = active ?? n - 1;
  const summary = `${label}: ${points.map((p) => `${formatLabel(p.key)} ${formatValue(p.value)}`).join(', ')}`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: 8 }}>
      {n ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="caption">{formatLabel(points[shown].key)}</Text>
          <Text variant="label">{formatValue(points[shown].value)}</Text>
        </Row>
      ) : null}
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="seva-area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.purple} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.purple} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line key={f} x1={0} x2={width} y1={plotH * f} y2={plotH * f} stroke={colors.cardBorder} strokeWidth={1} />
            ))}
            <Line x1={0} x2={width} y1={plotH} y2={plotH} stroke={colors.border} strokeWidth={1} />
            <Path d={area} fill="url(#seva-area)" />
            <Path d={line} stroke={colors.purple} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {active !== null ? <Line x1={x(active)} x2={x(active)} y1={0} y2={plotH} stroke={colors.muted} strokeWidth={1} strokeDasharray="3 3" /> : null}
            <Circle cx={x(shown)} cy={y(points[shown]?.value ?? 0)} r={5} fill={colors.purple} stroke={colors.white} strokeWidth={2} />
          </Svg>
        ) : null}
        {/* hit targets wider than the marks: one column per point */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {points.map((p, i) => (
            <Pressable
              key={p.key}
              accessibilityLabel={`${formatLabel(p.key)}: ${formatValue(p.value)}`}
              onPress={() => setActive(i)}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(null)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        {points.map((p, i) => (
          <Text key={p.key} variant="small" color={i === shown ? colors.text : colors.muted} style={{ flex: 1, textAlign: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center' }}>
            {formatLabel(p.key)}
          </Text>
        ))}
      </Row>
    </View>
  );
}

/** Horizontal bars with the label and value as text (one hue: magnitude only). */
export function BarList({
  rows,
  formatValue,
  color = colors.purple,
  max,
}: {
  rows: { key: string; label: string; value: number; sub?: string }[];
  formatValue: (v: number) => string;
  color?: string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 6 }} accessible accessibilityLabel={`${r.label}: ${formatValue(r.value)}${r.sub ? `, ${r.sub}` : ''}`}>
          <Row style={{ justifyContent: 'space-between' }} gap={12}>
            <Text variant="bodySm" numberOfLines={1} style={{ flex: 1 }}>{r.label}</Text>
            <Text variant="label">{formatValue(r.value)}</Text>
          </Row>
          <View style={styles.track}>
            <View style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
          </View>
          {r.sub ? <Text variant="small" color={colors.muted}>{r.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Percent meter with the number beside it. */
export function Meter({ label, percent, note }: { label: string; percent: number | null; note?: string }) {
  const p = percent ?? 0;
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${label}: ${percent === null ? '—' : `${p}%`}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="bodySm">{label}</Text>
        <Text variant="label">{percent === null ? '—' : `${p}%`}</Text>
      </Row>
      <View style={styles.track}>
        <View style={{ width: `${Math.min(100, p)}%`, height: '100%', borderRadius: 4, backgroundColor: p >= 80 ? colors.success : p >= 60 ? colors.purple : colors.deepOrange }} />
      </View>
      {note ? <Text variant="small" color={colors.muted}>{note}</Text> : null}
    </View>
  );
}

/** Big outcome number with a label and a one-line explanation. */
export function Outcome({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <View style={styles.outcome}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 38, color: colors.purpleDark }}>{value}</Text>
      <Text variant="label" align="center">{label}</Text>
      <Text variant="small" color={colors.muted} align="center">{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 200,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.card,
    padding: 16,
  },
  iconTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  outcome: {
    flex: 1,
    minWidth: 150,
    alignItems: 'center',
    gap: 4,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cream,
  },
});
