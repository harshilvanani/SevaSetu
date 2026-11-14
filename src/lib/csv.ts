import { Platform, Share } from 'react-native';

/** A cell that starts with = + - @ (or a tab / return) can run as a formula in Excel or Sheets; defuse it. */
function cell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Rows to CSV text with a UTF-8 byte-order mark so Excel shows non-Latin names (e.g. Hindi) correctly. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** A safe file name: letters and digits of any language, hyphens, no path characters. */
export function fileSlug(text: string): string {
  const s = text.trim().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return s || 'export';
}

/** Web: downloads the file. Native: opens the share sheet with the text. */
export async function downloadCsv(filename: string, csv: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    await Share.share({ message: csv, title: filename });
  }
}
