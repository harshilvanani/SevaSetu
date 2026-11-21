import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge, Chip } from '@/components/Chip';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Row, Screen, useLayout } from '@/components/Layout';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { type RegionRow, useCentres, useOrgInsights, useSaveCentre } from '@/features/insights/api';
import { Meter } from '@/features/insights/charts';
import { PROVINCES, useLabels } from '@/features/insights/labels';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { colors, fonts } from '@/theme/tokens';

export default function RegionsScreen() {
  return <OrganizerGate>{(org) => <Regions orgId={org.id} />}</OrganizerGate>;
}

function Regions({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const q = useOrgInsights(orgId);
  const centres = useCentres(orgId);
  const [adding, setAdding] = useState(false);
  const rows = [...(q.data?.regions ?? [])].sort((a, b) => b.volunteers + b.upcoming_events - (a.volunteers + a.upcoming_events));

  return (
    <Screen title={t('nav.regions')} maxWidth={1240} refreshing={q.isRefetching} onRefresh={() => { q.refetch(); centres.refetch(); }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 }} wrap gap={12}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text variant="overline" color={colors.purple}>{t('regions.overline')}</Text>
          <Text variant="h1">{t('regions.title')}</Text>
          <Text variant="caption">{t('regions.sub')}</Text>
        </View>
        {!adding ? <Button title={t('regions.addCentre')} icon="plus" variant="outline" onPress={() => setAdding(true)} /> : null}
      </Row>
      <OrgSwitcher />
      {adding ? <CentreForm orgId={orgId} onDone={() => setAdding(false)} /> : null}
      {q.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : rows.length === 0 ? (
        <EmptyState title={t('regions.emptyTitle')} body={t('regions.emptyBody')} />
      ) : (
        <View style={[{ gap: 12 }, isDesktop && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {rows.map((r) => (
            <View key={r.region} style={isDesktop ? { width: '32.5%' } : undefined}>
              <RegionCard r={r} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function RegionCard({ r }: { r: RegionRow }) {
  const { t } = useTranslation();
  const L = useLabels();
  const coverage = r.positions > 0 ? Math.round((100 * r.filled) / r.positions) : null;
  return (
    <Card style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#ECE7F4', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="globe" size={18} color={colors.plum} />
          </View>
          <Text variant="title">{L.region(r.region)}</Text>
        </Row>
        {coverage !== null ? <Badge label={t('regions.coverage', { percent: coverage })} tone={coverage >= 80 ? 'success' : coverage >= 60 ? 'purple' : 'amber'} /> : null}
      </Row>
      <Row gap={0} style={{ justifyContent: 'space-between' }}>
        <Num value={r.volunteers} label={t('regions.volunteers')} />
        <Num value={r.active} label={t('regions.active')} />
        <Num value={r.teachers} label={t('regions.teachers')} />
        <Num value={r.upcoming_events} label={t('regions.upcoming')} />
      </Row>
      <Meter label={t('regions.positionsFilled')} percent={coverage} note={r.positions ? t('insights.filledOf', { filled: r.filled, total: r.positions }) : t('regions.noOpenings')} />
      {r.centres.length ? (
        <View style={{ gap: 6 }}>
          <Text variant="small" color={colors.muted}>{t('regions.centres')}</Text>
          <Row gap={6} wrap>{r.centres.map((c) => <Badge key={c} label={c} tone="plain" />)}</Row>
        </View>
      ) : null}
      <View style={{ gap: 4 }}>
        <Text variant="small" color={colors.muted}>{t('regions.teacherLeads')}</Text>
        <Text variant="bodySm">{r.teacher_names.length ? r.teacher_names.join(', ') : t('regions.noTeachers')}</Text>
      </View>
      <Text variant="small" color={colors.muted}>{t('regions.hours', { hours: L.hours(r.hours) })}</Text>
    </Card>
  );
}

function Num({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 22, lineHeight: 28 }}>{value}</Text>
      <Text variant="small" color={colors.muted} align="center">{label}</Text>
    </View>
  );
}

function CentreForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useSaveCentre();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState<'CA' | 'US'>('CA');
  const [province, setProvince] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (name.trim().length < 2) return setError(t('regions.nameRequired'));
    try {
      await save.mutateAsync({ org_id: orgId, name: name.trim(), city: city.trim() || null, province: province.trim().toUpperCase() || null, country });
      onDone();
    } catch {
      setError(t('common.somethingWrong'));
    }
  };
  return (
    <Card style={{ gap: 14, padding: 20 }}>
      <Text variant="h3">{t('regions.addCentre')}</Text>
      <TextField label={t('regions.centreName')} value={name} onChangeText={setName} placeholder={t('regions.centrePlaceholder')} maxLength={120} />
      <TextField label={t('regions.city')} optional value={city} onChangeText={setCity} />
      <Segmented label={t('v360.country')} value={country} onChange={(c) => { setCountry(c); setProvince(''); }}
        options={[{ value: 'CA', label: t('v360.canada') }, { value: 'US', label: t('v360.usa') }]} />
      {country === 'CA' ? (
        <Row gap={8} wrap>{PROVINCES.map((p) => <Chip key={p} size="sm" label={p} selected={province === p} onPress={() => setProvince(p)} />)}</Row>
      ) : (
        <TextField label={t('v360.state')} optional value={province} onChangeText={setProvince} maxLength={2} autoCapitalize="characters" />
      )}
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
      <Row gap={8}>
        <Button title={t('common.save')} onPress={submit} loading={save.isPending} />
        <Button title={t('common.cancel')} variant="outline" onPress={onDone} />
      </Row>
    </Card>
  );
}
