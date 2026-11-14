import { describe, expect, it } from '@jest/globals';

import { fileSlug, toCsv } from './csv';

describe('toCsv', () => {
  it('starts with a byte-order mark and ends rows with CRLF', () => {
    expect(toCsv([['a', 'b']])).toBe('﻿a,b\r\n');
  });
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv([['x, y', 'say "hi"', 'two\nlines']])).toBe('﻿"x, y","say ""hi""","two\nlines"\r\n');
  });
  it('defuses spreadsheet formulas but keeps plain negative numbers', () => {
    expect(toCsv([['=SUM(A1)', '+1 555', '@cmd', '-5', 3]])).toBe("﻿'=SUM(A1),'+1 555,'@cmd,-5,3\r\n");
  });
  it('leaves empty values empty and keeps Hindi text intact', () => {
    expect(toCsv([[null, undefined, 'प्रिया']])).toBe('﻿,,प्रिया\r\n');
  });
});

describe('fileSlug', () => {
  it('keeps letters and digits, drops the rest', () => {
    expect(fileSlug('Diwali Community / Seva Week!')).toBe('Diwali-Community-Seva-Week');
    expect(fileSlug('दिवाली सेवा')).toBe('दिवाली-सेवा');
    expect(fileSlug('???')).toBe('export');
  });
});
