import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { Badge, Chip } from "@/components/Chip";
import { SearchField } from "@/components/Field";
import { Icon } from "@/components/Icon";
import {
  Avatar,
  Card,
  EmptyState,
  Row,
  Screen,
  useLayout,
} from "@/components/Layout";
import { Segmented } from "@/components/Segmented";
import { Text } from "@/components/Text";
import { type DirectoryPerson, useDirectory } from "@/features/insights/api";
import { useLabels } from "@/features/insights/labels";
import { OrganizerGate, OrgSwitcher } from "@/features/org/components";
import { colors, radius } from "@/theme/tokens";

export default function VolunteersScreen() {
  return <OrganizerGate>{(org) => <Directory orgId={org.id} />}</OrganizerGate>;
}

type Status = "all" | "active" | "inactive";

function Directory({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const L = useLabels();
  const params = useLocalSearchParams<{ filter?: string }>();
  const q = useDirectory(orgId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState<{
    region?: string;
    area?: string;
    language?: string;
    type?: string;
    skill?: string;
    noAvailability?: boolean;
  }>(params.filter === "no_availability" ? { noAvailability: true } : {});

  const all = useMemo(() => q.data ?? [], [q.data]);
  const facets = useMemo(() => {
    const count = (pick: (p: DirectoryPerson) => (string | null)[]) => {
      const m = new Map<string, number>();
      all.forEach((p) =>
        pick(p).forEach((v) => v && m.set(v, (m.get(v) ?? 0) + 1)),
      );
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      region: count((p) => [p.region]),
      area: count((p) => p.interests),
      language: count((p) => p.languages),
      type: count((p) => [p.person_type]),
      skill: count((p) => p.skills).slice(0, 16),
    };
  }, [all]);

  const needle = query.trim().toLowerCase();
  const rows = all.filter(
    (p) =>
      (status === "all" || (status === "active") === p.is_active) &&
      (!f.region || p.region === f.region) &&
      (!f.area || p.interests.includes(f.area)) &&
      (!f.language || p.languages.includes(f.language)) &&
      (!f.type || p.person_type === f.type) &&
      (!f.skill || p.skills.includes(f.skill)) &&
      (!f.noAvailability || p.availability.length === 0) &&
      (!needle ||
        [
          p.full_name,
          p.code,
          p.city ?? "",
          p.profession ?? "",
          ...p.skills.map(L.skill),
          ...p.interests.map(L.area),
        ].some((s) => s.toLowerCase().includes(needle))),
  );
  const activeFilters = Object.values(f).filter(Boolean).length;
  const toggle = (key: keyof typeof f, v: string) =>
    setF((cur) => ({ ...cur, [key]: cur[key] === v ? undefined : v }));

  return (
    <Screen
      title={t("nav.volunteers")}
      maxWidth={1240}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <View style={{ gap: 4, paddingTop: 8 }}>
        <Text variant="overline" color={colors.purple}>
          {t("directory.overline")}
        </Text>
        <Text variant="h1">{t("directory.title")}</Text>
        <Text variant="caption">{t("directory.sub")}</Text>
      </View>
      <OrgSwitcher />

      <View
        style={[
          { gap: 12 },
          isDesktop && { flexDirection: "row", alignItems: "center" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t("directory.search")}
          />
        </View>
        <Row gap={8} wrap>
          <View style={{ minWidth: 300 }}>
            <Segmented<Status>
              label={t("directory.status")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t("directory.all") },
                { value: "active", label: t("directory.active") },
                { value: "inactive", label: t("directory.inactive") },
              ]}
            />
          </View>
          <Chip
            size="sm"
            icon="filter"
            label={
              activeFilters
                ? t("directory.filtersCount", { count: activeFilters })
                : t("directory.filters")
            }
            selected={showFilters}
            onPress={() => setShowFilters((s) => !s)}
          />
        </Row>
      </View>

      {showFilters ? (
        <Card style={{ gap: 14 }}>
          <FacetRow
            label={t("directory.type")}
            items={facets.type}
            value={f.type}
            onToggle={(v) => toggle("type", v)}
            format={L.personType}
          />
          <FacetRow
            label={t("directory.region")}
            items={facets.region}
            value={f.region}
            onToggle={(v) => toggle("region", v)}
            format={L.region}
          />
          <FacetRow
            label={t("directory.area")}
            items={facets.area}
            value={f.area}
            onToggle={(v) => toggle("area", v)}
            format={L.area}
          />
          <FacetRow
            label={t("directory.language")}
            items={facets.language}
            value={f.language}
            onToggle={(v) => toggle("language", v)}
            format={L.language}
          />
          <FacetRow
            label={t("directory.skill")}
            items={facets.skill}
            value={f.skill}
            onToggle={(v) => toggle("skill", v)}
            format={L.skill}
          />
          <Row gap={8} wrap>
            <Chip
              size="sm"
              label={t("directory.noAvailability")}
              selected={!!f.noAvailability}
              onPress={() =>
                setF((c) => ({ ...c, noAvailability: !c.noAvailability }))
              }
            />
            {activeFilters ? (
              <Chip
                size="sm"
                icon="x"
                label={t("directory.clear")}
                onPress={() => setF({})}
              />
            ) : null}
          </Row>
        </Card>
      ) : activeFilters ? (
        <Row gap={8} wrap>
          {f.noAvailability ? (
            <Chip
              size="sm"
              selected
              label={t("directory.noAvailability")}
              onPress={() => setF((c) => ({ ...c, noAvailability: false }))}
            />
          ) : null}
          {(["type", "region", "area", "language", "skill"] as const).map(
            (key) =>
              f[key] ? (
                <Chip
                  key={key}
                  size="sm"
                  selected
                  label={{
                    type: L.personType,
                    region: L.region,
                    area: L.area,
                    language: L.language,
                    skill: L.skill,
                  }[key](f[key] as string)}
                  onPress={() => toggle(key, f[key] as string)}
                />
              ) : null,
          )}
        </Row>
      ) : null}

      <Text variant="caption">
        {t("directory.showing", { count: rows.length, total: all.length })}
      </Text>

      {q.isPending ? (
        <Text variant="caption">{t("common.loading")}</Text>
      ) : all.length === 0 ? (
        <EmptyState
          title={t("directory.emptyTitle")}
          body={t("directory.emptyBody")}
        />
      ) : (
        <View
          style={[
            { gap: 12 },
            isDesktop && { flexDirection: "row", flexWrap: "wrap" },
          ]}
        >
          {rows.map((p) => (
            <View
              key={p.id}
              style={isDesktop ? { width: "32.5%", flexGrow: 0 } : undefined}
            >
              <PersonCard p={p} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function FacetRow({
  label,
  items,
  value,
  onToggle,
  format,
}: {
  label: string;
  items: [string, number][];
  value?: string;
  onToggle: (v: string) => void;
  format: (k: string) => string;
}) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" color={colors.muted}>
        {label}
      </Text>
      <Row gap={8} wrap>
        {items.map(([k, n]) => (
          <Chip
            key={k}
            size="sm"
            label={`${format(k)} · ${n}`}
            selected={value === k}
            onPress={() => onToggle(k)}
          />
        ))}
      </Row>
    </View>
  );
}

function PersonCard({ p }: { p: DirectoryPerson }) {
  const { t } = useTranslation();
  const L = useLabels();
  const topSkills = [...p.skills]
    .sort((a, b) => rank(p.skill_levels[b]) - rank(p.skill_levels[a]))
    .slice(0, 3);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.full_name}
      onPress={() =>
        router.push({ pathname: "/volunteers/[id]", params: { id: p.id } })
      }
      style={({ pressed }) => [
        styles.card,
        pressed && { backgroundColor: "#FBF8F3" },
      ]}
    >
      <Row gap={12} style={{ alignItems: "flex-start" }}>
        <Avatar
          name={p.full_name || "?"}
          size={44}
          color={
            p.person_type === "volunteer" ? colors.amber : colors.purpleTint
          }
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Row gap={6} wrap>
            <Text variant="label" numberOfLines={1}>
              {p.full_name || "—"}
            </Text>
            {p.person_type !== "volunteer" ? (
              <Badge label={L.personType(p.person_type)} tone="purple" />
            ) : null}
          </Row>
          <Text variant="small" color={colors.muted}>
            {[p.code, p.city ?? L.region(p.region)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View
          style={[
            styles.status,
            {
              backgroundColor: p.is_active ? colors.successTint : colors.track,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: p.is_active ? colors.success : colors.muted },
            ]}
          />
          <Text
            variant="small"
            color={p.is_active ? colors.success : colors.subtle}
          >
            {p.is_active ? t("directory.active") : t("directory.inactive")}
          </Text>
        </View>
      </Row>
      {p.interests.length ? (
        <Text variant="caption" numberOfLines={1}>
          {p.interests.slice(0, 3).map(L.area).join(" · ")}
        </Text>
      ) : null}
      {topSkills.length ? (
        <Row gap={6} wrap>
          {topSkills.map((s) => (
            <Badge
              key={s}
              label={
                p.skill_levels[s]
                  ? `${L.skill(s)} · ${L.level(p.skill_levels[s])}`
                  : L.skill(s)
              }
              tone="plain"
            />
          ))}
        </Row>
      ) : null}
      <Row gap={14}>
        <Row gap={4}>
          <Icon name="clock" size={14} color={colors.muted} />
          <Text variant="small" color={colors.subtle}>
            {L.hours(p.hours)}
          </Text>
        </Row>
        <Row gap={4}>
          <Icon name="calendar" size={14} color={colors.muted} />
          <Text variant="small" color={colors.subtle}>
            {t("directory.events", { count: p.events_count })}
          </Text>
        </Row>
        {p.languages.length ? (
          <Row gap={4} style={{ flexShrink: 1 }}>
            <Icon name="language" size={14} color={colors.muted} />
            <Text variant="small" color={colors.subtle} numberOfLines={1}>
              {p.languages.slice(0, 3).map(L.language).join(", ")}
            </Text>
          </Row>
        ) : null}
      </Row>
    </Pressable>
  );
}

const rank = (l?: string) =>
  l === "expert" ? 3 : l === "intermediate" ? 2 : l === "beginner" ? 1 : 0;

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
});
