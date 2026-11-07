import { intlLocale } from './i18n';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(), opts);

/** "Sat, Nov 14" */
export function formatDay(iso: string) {
  return fmt({ weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** "Sat, Nov 14, 2026" */
export function formatDayYear(iso: string) {
  return fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

/** "10:00 AM" */
export function formatTime(iso: string) {
  return fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/** "Sat, Nov 14 · 10:00 AM" */
export function formatWhen(iso: string) {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

/** "10:00 AM – 1:00 PM" */
export function formatRange(start: string, end?: string | null) {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** Calendar tile parts: { dow: "SAT", day: "14" } */
export function dayTile(iso: string) {
  const d = new Date(iso);
  return {
    dow: fmt({ weekday: 'short' }).format(d).replace('.', '').toUpperCase(),
    day: String(d.getDate()),
  };
}

export function formatDateTime(iso: string) {
  return fmt({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function greetingKey(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'discover.goodMorning' : h < 17 ? 'discover.goodAfternoon' : 'discover.goodEvening';
}

export function firstName(full?: string | null) {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}
