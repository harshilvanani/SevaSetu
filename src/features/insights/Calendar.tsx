import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { IconButton } from "@/components/Button";
import { Card, Row, useLayout } from "@/components/Layout";
import { Segmented } from "@/components/Segmented";
import { Text } from "@/components/Text";
import { formatDay, formatRange } from "@/lib/format";
import { intlLocale } from "@/lib/i18n";
import { colors, fonts, radius } from "@/theme/tokens";

export type CalendarView = "month" | "week" | "agenda";
export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  sub?: string;
  tone?: "purple" | "orange" | "green" | "plain";
  meta?: string;
  onPress?: () => void;
};

const toneColors = {
  purple: { bg: colors.purpleTint, fg: colors.purpleDark, bar: colors.purple },
  orange: {
    bg: colors.amberTint,
    fg: colors.amberTextDark,
    bar: colors.deepOrange,
  },
  green: { bg: colors.successTint, fg: colors.success, bar: colors.success },
  plain: { bg: colors.track, fg: colors.subtle, bar: colors.muted },
};

const DAY = 86_400_000;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mondayOf = (d: Date) => {
  const s = startOfDay(d);
  return new Date(s.getTime() - ((s.getDay() + 6) % 7) * DAY);
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Month / Week / Agenda calendar for seva and events. Weeks start on Monday. */
export function SevaCalendar({
  items,
  view,
  onViewChange,
  emptyText,
}: {
  items: CalendarItem[];
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  emptyText: string;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(() => new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      // multi-day events show on every day they cover (up to two weeks)
      const s = startOfDay(new Date(it.start));
      const e = new Date(it.end);
      for (
        let d = s, n = 0;
        d <= e && n < 14;
        d = new Date(d.getTime() + DAY), n++
      ) {
        const k = dayKey(d);
        m.set(k, [...(m.get(k) ?? []), it]);
      }
    }
    m.forEach((list) => list.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  }, [items]);

  const step = (dir: 1 | -1) =>
    setAnchor((a) =>
      view === "month"
        ? new Date(a.getFullYear(), a.getMonth() + dir, 1)
        : new Date(a.getTime() + dir * 7 * DAY),
    );
  const title =
    view === "month"
      ? new Intl.DateTimeFormat(intlLocale(), {
          month: "long",
          year: "numeric",
        }).format(anchor)
      : view === "week"
        ? `${formatDay(mondayOf(anchor).toISOString())} – ${formatDay(new Date(mondayOf(anchor).getTime() + 6 * DAY).toISOString())}`
        : t("calendar.upcoming");

  return (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: "space-between" }} wrap gap={10}>
        <View style={{ minWidth: 290 }}>
          <Segmented<CalendarView>
            label={t("calendar.view")}
            value={view}
            onChange={onViewChange}
            options={[
              { value: "month", label: t("calendar.month") },
              { value: "week", label: t("calendar.week") },
              { value: "agenda", label: t("calendar.agenda") },
            ]}
          />
        </View>
        {view !== "agenda" ? (
          <Row gap={6}>
            <IconButton
              icon="chevronLeft"
              bordered
              label={t("calendar.previous")}
              onPress={() => step(-1)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setAnchor(new Date())}
              style={styles.today}
            >
              <Text variant="label">{t("calendar.today")}</Text>
            </Pressable>
            <IconButton
              icon="chevronRight"
              bordered
              label={t("calendar.next")}
              onPress={() => step(1)}
            />
          </Row>
        ) : null}
      </Row>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {view === "month" ? (
        <MonthGrid anchor={anchor} byDay={byDay} />
      ) : view === "week" ? (
        <WeekList anchor={anchor} byDay={byDay} />
      ) : (
        <Agenda items={items} emptyText={emptyText} />
      )}
    </View>
  );
}

function MonthGrid({
  anchor,
  byDay,
}: {
  anchor: Date;
  byDay: Map<string, CalendarItem[]>;
}) {
  const { isPhone } = useLayout();
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Date | null>(null);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from(
      { length: 7 },
      (_, d) => new Date(gridStart.getTime() + (w * 7 + d) * DAY),
    ),
  ).filter((week, i) => i < 4 || week[0].getMonth() === anchor.getMonth());
  const today = new Date();
  const dows = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(), { weekday: "short" }).format(
      new Date(gridStart.getTime() + i * DAY),
    ),
  );
  const pickedItems = picked ? (byDay.get(dayKey(picked)) ?? []) : [];

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {dows.map((d) => (
            <Text
              key={d}
              variant="small"
              color={colors.muted}
              style={styles.dow}
            >
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={dayKey(week[0])} style={styles.weekRow}>
            {week.map((day) => {
              const list = byDay.get(dayKey(day)) ?? [];
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = sameDay(day, today);
              return (
                <Pressable
                  key={dayKey(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDay(day.toISOString())}: ${list.length ? list.map((x) => x.title).join(", ") : t("calendar.nothing")}`}
                  onPress={() => setPicked(day)}
                  style={[
                    styles.cell,
                    { minHeight: isPhone ? 52 : 96 },
                    !inMonth && { backgroundColor: "#FAF7F2" },
                    picked &&
                      sameDay(picked, day) && {
                        backgroundColor: colors.purpleTint,
                      },
                  ]}
                >
                  <View
                    style={[
                      styles.dayNum,
                      isToday && { backgroundColor: colors.purple },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 16,
                        fontFamily: fonts.semibold,
                        color: isToday
                          ? colors.white
                          : inMonth
                            ? colors.text
                            : colors.muted,
                      }}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  {isPhone ? (
                    list.length ? (
                      <Row gap={3} style={{ justifyContent: "center" }}>
                        {list.slice(0, 3).map((it) => (
                          <View
                            key={it.id}
                            style={[
                              styles.dotSm,
                              {
                                backgroundColor:
                                  toneColors[it.tone ?? "purple"].bar,
                              },
                            ]}
                          />
                        ))}
                      </Row>
                    ) : null
                  ) : (
                    <View style={{ gap: 3 }}>
                      {list.slice(0, 2).map((it) => {
                        const c = toneColors[it.tone ?? "purple"];
                        return (
                          <Pressable
                            key={it.id}
                            accessibilityRole="link"
                            onPress={it.onPress}
                            style={[
                              styles.chip,
                              { backgroundColor: c.bg, borderLeftColor: c.bar },
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 11,
                                lineHeight: 14,
                                fontFamily: fonts.medium,
                                color: c.fg,
                              }}
                            >
                              {it.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {list.length > 2 ? (
                        <Text variant="small" color={colors.muted}>
                          {t("calendar.more", { count: list.length - 2 })}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {picked ? (
        <Card style={{ gap: 10 }}>
          <Text variant="label">{formatDay(picked.toISOString())}</Text>
          {pickedItems.length ? (
            pickedItems.map((it) => <ItemRow key={it.id} it={it} />)
          ) : (
            <Text variant="caption">{t("calendar.nothing")}</Text>
          )}
        </Card>
      ) : null}
    </View>
  );
}

function WeekList({
  anchor,
  byDay,
}: {
  anchor: Date;
  byDay: Map<string, CalendarItem[]>;
}) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const start = mondayOf(anchor);
  const days = Array.from(
    { length: 7 },
    (_, i) => new Date(start.getTime() + i * DAY),
  );
  const today = new Date();
  return (
    <View
      style={[
        { gap: 10 },
        isDesktop && { flexDirection: "row", alignItems: "flex-start", gap: 8 },
      ]}
    >
      {days.map((d) => {
        const list = byDay.get(dayKey(d)) ?? [];
        return (
          <View
            key={dayKey(d)}
            style={[
              styles.weekDay,
              isDesktop && { flex: 1, minHeight: 220 },
              sameDay(d, today) && { borderColor: colors.purple },
            ]}
          >
            <Text
              variant="label"
              color={sameDay(d, today) ? colors.purple : colors.text}
            >
              {formatDay(d.toISOString())}
            </Text>
            {list.length ? (
              list.map((it) => {
                const c = toneColors[it.tone ?? "purple"];
                return (
                  <Pressable
                    key={it.id}
                    accessibilityRole="link"
                    onPress={it.onPress}
                    style={[
                      styles.weekItem,
                      { backgroundColor: c.bg, borderLeftColor: c.bar },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 16,
                        fontFamily: fonts.semibold,
                        color: c.fg,
                      }}
                      numberOfLines={2}
                    >
                      {it.title}
                    </Text>
                    <Text style={{ fontSize: 11, lineHeight: 14, color: c.fg }}>
                      {formatRange(it.start, it.end)}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text variant="small" color={colors.muted}>
                {t("calendar.free")}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Agenda({
  items,
  emptyText,
}: {
  items: CalendarItem[];
  emptyText: string;
}) {
  const [now] = useState(() => Date.now());
  const upcoming = items
    .filter((it) => new Date(it.end).getTime() >= now)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!upcoming.length) return <Text variant="caption">{emptyText}</Text>;
  return (
    <View style={{ gap: 10 }}>
      {upcoming.map((it) => (
        <ItemRow key={it.id} it={it} card />
      ))}
    </View>
  );
}

function ItemRow({ it, card }: { it: CalendarItem; card?: boolean }) {
  const d = new Date(it.start);
  const c = toneColors[it.tone ?? "purple"];
  const body = (
    <Row gap={12}>
      <View style={[styles.tile, { backgroundColor: c.bg }]}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 18,
            lineHeight: 22,
            color: c.fg,
          }}
        >
          {d.getDate()}
        </Text>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 10,
            lineHeight: 12,
            color: c.fg,
            textTransform: "uppercase",
          }}
        >
          {new Intl.DateTimeFormat(intlLocale(), { month: "short" })
            .format(d)
            .replace(".", "")}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {it.title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {[formatRange(it.start, it.end), it.sub].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {it.meta ? (
        <Text variant="small" color={colors.muted}>
          {it.meta}
        </Text>
      ) : null}
    </Row>
  );
  return (
    <Pressable
      accessibilityRole="link"
      onPress={it.onPress}
      style={({ pressed }) => [
        card && styles.agendaCard,
        pressed && { opacity: 0.85 },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  today: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  grid: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  weekRow: { flexDirection: "row" },
  dow: {
    flex: 1,
    textAlign: "center",
    paddingVertical: 8,
    backgroundColor: colors.cream,
  },
  cell: {
    flex: 1,
    padding: 4,
    gap: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayNum: {
    alignSelf: "flex-start",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dotSm: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  weekDay: {
    gap: 6,
    padding: 10,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  weekItem: { padding: 6, borderRadius: 6, borderLeftWidth: 3, gap: 2 },
  tile: {
    width: 46,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  agendaCard: {
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
});
