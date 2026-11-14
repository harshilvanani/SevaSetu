import { describe, expect, it } from '@jest/globals';

import { localizedName, suggestedSeva } from '../templates';

const tasks = [
  { name: 'Venue Setup', name_i18n: { hi: 'स्थल सज्जा', fr: 'Installation du lieu' } },
  { name: 'Food Prep', name_i18n: {} },
  { name: 'Collection of ', name_i18n: {} },
];

describe('localizedName', () => {
  it('uses the viewer’s language and falls back to English', () => {
    expect(localizedName(tasks[0], 'hi')).toBe('स्थल सज्जा');
    expect(localizedName(tasks[0], 'fr')).toBe('Installation du lieu');
    expect(localizedName(tasks[1], 'hi')).toBe('Food Prep');
    expect(localizedName(tasks[0], 'de')).toBe('Venue Setup');
  });
});

describe('suggestedSeva', () => {
  it('lists everything when nothing exists yet', () => {
    expect(suggestedSeva(tasks, [])).toHaveLength(3);
  });
  it('hides seva that already exist, ignoring case and spaces, in any language', () => {
    expect(suggestedSeva(tasks, ['venue setup ', 'Food Prep']).map((x) => x.name)).toEqual(['Collection of ']);
    expect(suggestedSeva(tasks, ['Installation du lieu']).map((x) => x.name)).toEqual(['Food Prep', 'Collection of ']);
  });
});
