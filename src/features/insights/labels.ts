import { useTranslation } from 'react-i18next';

import { intlLocale } from '@/lib/i18n';

const humanize = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Readable names for the merged vocabulary (seva areas, regions, skills, languages, person types). */
export function useLabels() {
  const { t } = useTranslation();
  return {
    area: (k: string | null | undefined) => (k ? t(`interests.${k}`, { defaultValue: humanize(k) }) : t('labels.otherArea')),
    region: (k: string | null | undefined) => (k ? t(`regions.names.${k}`, { defaultValue: humanize(k) }) : t('regions.unknown')),
    skill: (k: string) => t(`skills.${k}`, { defaultValue: humanize(k) }),
    language: (k: string) => t(`languages.${k}`, { defaultValue: humanize(k) }),
    personType: (k: string | null | undefined) => t(`personTypes.${k ?? 'volunteer'}`),
    level: (k: string | null | undefined) => (k ? t(`levels.${k}`) : ''),
    month: (ym: string) => new Intl.DateTimeFormat(intlLocale(), { month: 'short' }).format(new Date(`${ym}-15T12:00:00`)),
    hours: (n: number) => t('labels.hoursShort', { n: Math.round(n * 10) / 10 }),
    num: (n: number) => new Intl.NumberFormat(intlLocale()).format(n),
  };
}

export const SKILL_SUGGESTIONS = [
  'kitchen', 'cooking', 'housekeeping', 'av_tech', 'photography', 'graphic_design', 'it_support', 'office', 'data_entry',
  'event_coordination', 'customer_service', 'childcare', 'teaching', 'facilitation', 'translation', 'driving', 'first_aid',
  'construction', 'grounds', 'marketing', 'fundraising', 'accounting', 'project_management',
] as const;

export const LANGUAGE_OPTIONS = ['english', 'french', 'hindi', 'spanish', 'gujarati', 'punjabi', 'tamil', 'telugu', 'marathi', 'bengali', 'malayalam', 'urdu'] as const;

export const PROVINCES = ['ON', 'QC', 'BC', 'AB', 'SK', 'MB', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'] as const;

/** Skills that usually serve each seva area (same table as public.area_skills in the database). */
export const AREA_SKILLS: Record<string, string[]> = {
  food: ['kitchen', 'cooking', 'food_safety'],
  technology: ['av_tech', 'it_support', 'web', 'livestream'],
  design_media: ['photography', 'graphic_design', 'marketing', 'social_media', 'video'],
  administration: ['office', 'data_entry', 'project_management', 'event_coordination', 'accounting'],
  event_setup: ['hospitality', 'reception', 'event_coordination', 'customer_service', 'housekeeping'],
  logistics: ['driving', 'construction', 'procurement', 'housekeeping'],
  environment: ['grounds', 'gardening', 'construction'],
  kids_youth: ['childcare', 'teaching'],
  elder_care: ['first_aid', 'nurse', 'driving', 'doctor'],
  meditation: ['wellness', 'teaching', 'facilitation'],
  teaching: ['teaching', 'facilitation', 'childcare'],
  translation: ['translation'],
  fundraising: ['fundraising', 'retail', 'sales', 'marketing'],
  outreach: ['customer_service', 'marketing', 'sales', 'social_media'],
  data: ['data_analytics', 'data_entry', 'it_support'],
  professional: ['accounting', 'legal', 'project_management', 'hr'],
};
