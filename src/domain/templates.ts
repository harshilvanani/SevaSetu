// Pure helpers for ready-made events (kept free of app code so they can be unit tested).

export type Translatable = { name: string; name_i18n: unknown };

/** A name in the viewer's language, falling back to English. */
export function localizedName(row: Translatable, lang: string): string {
  const map = (row.name_i18n ?? {}) as Record<string, string | undefined>;
  return map[lang]?.trim() ? (map[lang] as string) : row.name;
}

/** Template seva that the organizer has not created yet (compared by name, in any language, ignoring case). */
export function suggestedSeva<T extends Translatable>(templateTasks: T[], existingTitles: string[]): T[] {
  const have = new Set(existingTitles.map((s) => s.trim().toLowerCase()));
  return templateTasks.filter((task) => {
    const names = [task.name, ...Object.values((task.name_i18n ?? {}) as Record<string, string>)];
    return !names.some((n) => n && have.has(n.trim().toLowerCase()));
  });
}
