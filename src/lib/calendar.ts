import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export type CalendarItem = { title: string; start: string; end?: string | null; location?: string | null; notes?: string | null };

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

export function buildIcs(item: CalendarItem) {
  const end = item.end ?? new Date(new Date(item.start).getTime() + 2 * 3_600_000).toISOString();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SevaSetu//EN',
    'BEGIN:VEVENT',
    `UID:${icsDate(item.start)}-${Math.random().toString(36).slice(2)}@sevasetu`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(item.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(item.title)}`,
    item.location ? `LOCATION:${esc(item.location)}` : '',
    item.notes ? `DESCRIPTION:${esc(item.notes)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Opens the system "add event" sheet prefilled with the seva (native), or downloads an .ics file (web).
 * Returns false if permission was denied or no writable calendar exists.
 */
export async function addToCalendar(item: CalendarItem): Promise<boolean> {
  if (Platform.OS === 'web') {
    const blob = new Blob([buildIcs(item)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  const { granted } = await Calendar.requestCalendarPermissions(true);
  if (!granted) return false;

  let calendar: Calendar.ExpoCalendar | undefined;
  if (Platform.OS === 'ios') {
    calendar = Calendar.getDefaultCalendarSync();
  } else {
    const all = await Calendar.getCalendars();
    calendar = all.find((c) => c.isPrimary && c.allowsModifications) ?? all.find((c) => c.allowsModifications);
  }
  if (!calendar) return false;

  const end = item.end ?? new Date(new Date(item.start).getTime() + 2 * 3_600_000).toISOString();
  await calendar.addEventWithForm({
    title: item.title,
    startDate: new Date(item.start),
    endDate: new Date(end),
    location: item.location ?? undefined,
    notes: item.notes ?? undefined,
  });
  return true;
}
