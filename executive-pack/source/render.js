#!/usr/bin/env node
// Draws every executive diagram as a 16:9 slide image (PNG) and an editable vector file (SVG).
//   node executive-pack/source/render.js
// Needs Playwright with Chromium (already installed for the app's browser tests) and the app's fonts in node_modules.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const flows = require('./flows');
const arch = require('./architecture');

const font = (pkg, file) => 'file://' + path.join(REPO, 'node_modules/@expo-google-fonts', pkg, file);
const FONTS = `
@font-face { font-family: 'Poppins'; font-weight: 400; src: url('${font('poppins', '400Regular/Poppins_400Regular.ttf')}'); }
@font-face { font-family: 'Poppins'; font-weight: 500; src: url('${font('poppins', '500Medium/Poppins_500Medium.ttf')}'); }
@font-face { font-family: 'Poppins'; font-weight: 600; src: url('${font('poppins', '600SemiBold/Poppins_600SemiBold.ttf')}'); }
@font-face { font-family: 'Lora'; font-weight: 600; src: url('${font('lora', '600SemiBold/Lora_600SemiBold.ttf')}'); }`;

// ---------------------------------------------------------------- drawing code (runs inside the browser page)
const PAGE_SCRIPT = String.raw`
const C = {
  cream: '#FDFBF7', ink: '#222222', body: '#525252', muted: '#6E675F', line: '#E7DFD3',
  plum: '#3C285F', purple: '#8441AB', purpleDark: '#5E2E7E', purpleTint: '#F3EAF8',
  orange: '#F17225', orangeText: '#B5480A', amberTint: '#FFF1D9', green: '#1F6B3A', greenTint: '#E3F2E7',
};
const TONES = {
  vol: { band: '#FFF7EC', edge: '#F17225', label: '#B5480A' },
  core: { band: '#F7F1FB', edge: '#8441AB', label: '#5E2E7E' },
  org: { band: '#EEF6F0', edge: '#1F6B3A', label: '#1F6B3A' },
  adm: { band: '#F0ECF5', edge: '#3C285F', label: '#3C285F' },
  other: { band: '#F6F3EE', edge: '#8A8378', label: '#4A4A4A' },
};
const laneTone = (name) => {
  if (/^Volunteer|People affected/.test(name)) return TONES.vol;
  if (name === 'SevaSetu') return TONES.core;
  if (/Organizer|Leader/.test(name)) return TONES.org;
  if (/Admin|New centre/.test(name)) return TONES.adm;
  return TONES.other;
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ctx = document.createElement('canvas').getContext('2d');
const width = (text, size, weight = 400, family = 'Poppins') => { ctx.font = weight + ' ' + size + 'px ' + family; return ctx.measureText(text).width; };
function wrap(text, size, weight, maxW, family) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (width(next, size, weight, family) <= maxW || !cur) cur = next; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function textBlock(lines, x, y, size, weight, color, anchor = 'middle', lh = 1.28, family = 'Poppins') {
  return lines.map((l, i) => '<text x="' + x + '" y="' + (y + i * size * lh) + '" font-family="' + family + ', Arial, sans-serif" font-size="' + size + '" font-weight="' + weight + '" fill="' + color + '" text-anchor="' + anchor + '">' + esc(l) + '</text>').join('');
}
const W = 1920, H = 1080;
const defs = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + C.purpleDark + '"/></marker></defs>';
const shell = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + defs + '<rect width="' + W + '" height="' + H + '" fill="' + C.cream + '"/>' + inner + '</svg>';
function header(overline, title, subtitle) {
  let s = '<text x="70" y="78" font-family="Poppins, Arial" font-size="22" font-weight="600" letter-spacing="2.6" fill="' + C.purple + '">' + esc(overline.toUpperCase()) + '</text>';
  s += '<text x="70" y="138" font-family="Lora, Georgia, serif" font-size="50" font-weight="600" fill="' + C.ink + '">' + esc(title) + '</text>';
  if (subtitle) s += '<text x="70" y="180" font-family="Poppins, Arial" font-size="24" font-weight="400" fill="' + C.body + '">' + esc(subtitle) + '</text>';
  return s;
}
const pill = (x, y, text, bg, fg, size = 17) => {
  const w = width(text, size, 600) + 26;
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (size + 14) + '" rx="' + ((size + 14) / 2) + '" fill="' + bg + '"/>' +
    '<text x="' + (x + w / 2) + '" y="' + (y + size + 3) + '" font-family="Poppins, Arial" font-size="' + size + '" font-weight="600" fill="' + fg + '" text-anchor="middle">' + esc(text) + '</text>';
};
const pillW = (text, size = 17) => width(text, size, 600) + 26;

// ---------------------------------------------------------------- swimlane flow
window.drawFlow = function (f) {
  const lanes = f.lanes; const nl = lanes.length; const n = f.steps.length;
  const top = 214, bottom = 952, labelW = 210, left = 50, right = W - 50;
  const laneH = (bottom - top) / nl;
  const colX0 = left + labelW + 20, colW = (right - colX0) / n;
  const boxW = Math.min(colW - 58, 260), boxH = Math.min(laneH - 46, 156);
  let s = header(f.group + ' · ' + f.id, f.title);
  if (f.steps.some((x) => x.planned)) {
    const t = 'Planned (Phase 2)'; const pw = pillW(t);
    s += '<rect x="' + (W - 70 - pw - 70) + '" y="52" width="54" height="30" rx="8" fill="#fff" stroke="' + C.orange + '" stroke-width="2.5" stroke-dasharray="7 5"/>';
    s += pill(W - 70 - pw, 52, t, C.amberTint, C.orangeText);
  }
  lanes.forEach((name, i) => {
    const t = laneTone(name); const y = top + i * laneH;
    s += '<rect x="' + left + '" y="' + (y + 4) + '" width="' + (right - left) + '" height="' + (laneH - 8) + '" rx="18" fill="' + t.band + '"/>';
    s += '<rect x="' + left + '" y="' + (y + 4) + '" width="8" height="' + (laneH - 8) + '" rx="4" fill="' + t.edge + '"/>';
    const lines = wrap(name, 26, 600, labelW - 40);
    s += textBlock(lines, left + 30, y + laneH / 2 - ((lines.length - 1) * 26 * 1.2) / 2 + 9, 26, 600, t.label, 'start', 1.2);
  });
  const pos = f.steps.map((st, i) => {
    const li = lanes.indexOf(st.lane); if (li < 0) throw new Error(f.id + ': unknown lane ' + st.lane);
    const col = st.col ?? i;
    return { cx: colX0 + colW * col + colW / 2, cy: top + li * laneH + laneH / 2, st, i };
  });
  // arrows first, so boxes sit on top
  for (let i = 0; i < pos.length - 1; i++) {
    const a = pos[i], b = pos[i + 1];
    const x1 = a.cx + boxW / 2, x2 = b.cx - boxW / 2 - 4;
    let d;
    if (Math.abs(a.cy - b.cy) < 1) d = 'M' + x1 + ',' + a.cy + ' L' + x2 + ',' + b.cy;
    else { const mx = (x1 + x2) / 2; const r = 14; const dir = b.cy > a.cy ? 1 : -1;
      d = 'M' + x1 + ',' + a.cy + ' L' + (mx - r) + ',' + a.cy + ' Q' + mx + ',' + a.cy + ' ' + mx + ',' + (a.cy + r * dir) +
          ' L' + mx + ',' + (b.cy - r * dir) + ' Q' + mx + ',' + b.cy + ' ' + (mx + r) + ',' + b.cy + ' L' + x2 + ',' + b.cy; }
    const planned = b.st.planned;
    s += '<path d="' + d + '" fill="none" stroke="' + C.purpleDark + '" stroke-width="3"' + (planned ? ' stroke-dasharray="9 7"' : '') + ' marker-end="url(#ah)"/>';
  }
  for (const p of pos) {
    const t = laneTone(p.st.lane); const x = p.cx - boxW / 2, y = p.cy - boxH / 2;
    let size = 23; let lines = wrap(p.st.text, size, 500, boxW - 34);
    while (lines.length > 4 && size > 18) { size -= 1; lines = wrap(p.st.text, size, 500, boxW - 34); }
    s += '<rect x="' + x + '" y="' + y + '" width="' + boxW + '" height="' + boxH + '" rx="16" fill="#FFFFFF" stroke="' + (p.st.planned ? C.orange : t.edge) + '" stroke-width="2.5"' + (p.st.planned ? ' stroke-dasharray="9 6"' : '') + '/>';
    const ty = p.cy - ((lines.length - 1) * size * 1.25) / 2 + size * 0.36 + 6;
    s += textBlock(lines, p.cx, ty, size, 500, C.ink, 'middle', 1.25);
    s += '<circle cx="' + (x + 2) + '" cy="' + (y + 2) + '" r="19" fill="' + (p.st.planned ? C.orange : C.purple) + '"/>';
    s += '<text x="' + (x + 2) + '" y="' + (y + 10) + '" font-family="Poppins, Arial" font-size="20" font-weight="600" fill="#fff" text-anchor="middle">' + (p.i + 1) + '</text>';
    if (p.st.planned) s += pill(x + boxW - pillW('Planned', 15) + 8, y - 16, 'Planned', C.amberTint, C.orangeText, 15);
  }
  if (f.note) {
    s += '<circle cx="80" cy="1007" r="14" fill="' + C.purpleTint + '"/><text x="80" y="1014" font-family="Poppins" font-size="19" font-weight="600" fill="' + C.purple + '" text-anchor="middle">i</text>';
    const lines = wrap(f.note, 22, 400, 1700);
    s += textBlock(lines, 106, 1015 - (lines.length - 1) * 13, 22, 400, C.body, 'start', 1.2);
  }
  s += '<text x="' + (W - 60) + '" y="1050" font-family="Poppins" font-size="16" font-weight="500" fill="' + C.muted + '" text-anchor="end">SevaSetu</text>';
  return shell(s);
};

// ---------------------------------------------------------------- architecture
window.drawArch = function (a) {
  let s = header(a.overline, a.title, a.subtitle);
  const toneOf = (b) => TONES[b.tone] ?? TONES.core;
  for (const g of a.groups) {
    const core = g.tone === 'core';
    s += '<rect x="' + g.x + '" y="' + g.y + '" width="' + g.w + '" height="' + g.h + '" rx="22" fill="' + (core ? '#F7F1FB' : '#FFFFFF') + '" stroke="' + (core ? C.purple : C.line) + '" stroke-width="' + (core ? 2.5 : 2) + '"/>';
    s += '<text x="' + (g.x + 22) + '" y="' + (g.y + 36) + '" font-family="Poppins" font-size="22" font-weight="600" fill="' + (core ? C.purpleDark : C.ink) + '">' + esc(g.label) + '</text>';
    if (g.sub) s += '<text x="' + (g.x + 22) + '" y="' + (g.y + g.h - 22) + '" font-family="Poppins" font-size="17" font-weight="500" fill="' + C.purpleDark + '">' + esc(g.sub) + '</text>';
  }
  const box = Object.fromEntries(a.boxes.map((b) => [b.id, b]));
  const side = (b, sd) => sd === 'l' ? [b.x, b.y + b.h / 2] : sd === 't' ? [b.x + b.w / 2, b.y] : sd === 'b' ? [b.x + b.w / 2, b.y + b.h] : [b.x + b.w, b.y + b.h / 2];
  for (const [from, to, label, fs, ts] of a.arrows) {
    const A = box[from], B = box[to]; if (!A || !B) throw new Error(a.file + ': arrow ' + from + ' → ' + to);
    const [x1, y1] = side(A, fs || 'r'); let [x2, y2] = side(B, ts || 'l');
    let d;
    if ((fs === 't' && ts === 't') || (fs === 'b' && ts === 'b')) {
      const yy = fs === 't' ? Math.min(y1, y2) - 26 : Math.max(y1, y2) + 26; const dy = fs === 't' ? 4 : -4;
      d = 'M' + x1 + ',' + y1 + ' L' + x1 + ',' + yy + ' L' + x2 + ',' + yy + ' L' + x2 + ',' + (y2 - dy);
    } else {
      x2 -= 4; const mx = (x1 + x2) / 2;
      d = Math.abs(y1 - y2) < 2 ? 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 : 'M' + x1 + ',' + y1 + ' L' + mx + ',' + y1 + ' L' + mx + ',' + y2 + ' L' + x2 + ',' + y2;
      if (label) { const lw = width(label, 16, 500) + 16; s += ''; a._labels = (a._labels || []).concat([[mx, (y1 + y2) / 2, label, lw]]); }
    }
    s += '<path d="' + d + '" fill="none" stroke="' + C.purpleDark + '" stroke-width="2.5" stroke-linejoin="round" marker-end="url(#ah)" opacity="0.85"/>';
  }
  for (const b of a.boxes) {
    const t = toneOf(b);
    s += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="14" fill="#FFFFFF" stroke="' + t.edge + '" stroke-width="2.5"/>';
    const parts = [];
    const tl = wrap(b.title, 21, 600, b.w - 28); parts.push([tl, 21, 600, C.ink]);
    if (b.desc) parts.push([wrap(b.desc, 17, 400, b.w - 28), 17, 400, C.body]);
    if (a.variant === 'named' && b.named) parts.push([wrap(b.named, 16, 600, b.w - 28), 16, 600, C.purple]);
    const total = parts.reduce((n, [ls, sz]) => n + ls.length * sz * 1.25 + 6, -6);
    let y = b.y + b.h / 2 - total / 2 + 17;
    for (const [ls, sz, wt, col] of parts) { s += textBlock(ls, b.x + b.w / 2, y, sz, wt, col, 'middle', 1.25); y += ls.length * sz * 1.25 + 6; }
    if (b.tag) { const bg = b.tag === 'New' ? C.orange : C.purple; const pw = pillW(b.tag, 14); s += pill(b.x + b.w - pw + 6, b.y - 14, b.tag, bg, '#FFFFFF', 14); }
  }
  for (const [mx, my, label, lw] of a._labels || []) {
    s += '<rect x="' + (mx - lw / 2) + '" y="' + (my - 15) + '" width="' + lw + '" height="28" rx="8" fill="' + C.cream + '"/>';
    s += '<text x="' + mx + '" y="' + (my + 5) + '" font-family="Poppins" font-size="16" font-weight="500" fill="' + C.purpleDark + '" text-anchor="middle">' + esc(label) + '</text>';
  }
  a._labels = [];
  if (a.boxes.some((b) => b.tag)) {
    let x = W - 70 - pillW('New', 14) - pillW('Upgraded', 14) - 20;
    s += pill(x, 56, 'New', C.orange, '#fff', 14); x += pillW('New', 14) + 20; s += pill(x, 56, 'Upgraded', C.purple, '#fff', 14);
  }
  if (a.footer) s += '<text x="' + (W / 2) + '" y="1030" font-family="Poppins" font-size="21" font-weight="500" fill="' + C.body + '" text-anchor="middle">' + esc(a.footer) + '</text>';
  return shell(s);
};

// ---------------------------------------------------------------- scope table
window.drawScope = function (sc) {
  let s = header(sc.overline, sc.title);
  const x0 = 70, x1 = 380, x2 = 1100, xEnd = 1850, top = 200, rowH = 106;
  s += '<rect x="' + x0 + '" y="' + top + '" width="' + (xEnd - x0) + '" height="64" rx="14" fill="' + C.plum + '"/>';
  [['', x0], ['Today', x1], ['Future (on AWS)', x2]].forEach(([t, x]) => { s += '<text x="' + (x + 24) + '" y="' + (top + 42) + '" font-family="Poppins" font-size="24" font-weight="600" fill="#fff">' + esc(t) + '</text>'; });
  sc.rows.forEach((r, i) => {
    const y = top + 76 + i * rowH;
    s += '<rect x="' + x0 + '" y="' + y + '" width="' + (xEnd - x0) + '" height="' + (rowH - 10) + '" rx="12" fill="' + (i % 2 ? '#FFFFFF' : '#F7F1FB') + '"/>';
    const cells = [[r[0], x0, x1 - x0, 600, C.purpleDark], [r[1], x1, x2 - x1, 400, C.ink], [r[2], x2, xEnd - x2, 500, C.ink]];
    for (const [t, x, w, wt, col] of cells) {
      const lines = wrap(t, 22, wt, w - 48);
      s += textBlock(lines, x + 24, y + (rowH - 10) / 2 - ((lines.length - 1) * 22 * 1.25) / 2 + 8, 22, wt, col, 'start', 1.25);
    }
  });
  return shell(s);
};
`;

(async () => {
  const outFlows = path.join(ROOT, 'flows');
  const outArch = path.join(ROOT, 'architecture');
  fs.mkdirSync(outFlows, { recursive: true });
  fs.mkdirSync(outArch, { recursive: true });
  const html = path.join(__dirname, '.render.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS} body{margin:0}</style></head>
<body><div id="o"></div><span style="font-family:Poppins;font-weight:400">a</span><span style="font-family:Poppins;font-weight:500">a</span><span style="font-family:Poppins;font-weight:600">a</span><span style="font-family:Lora;font-weight:600">a</span>
<script>${PAGE_SCRIPT}</script></body></html>`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
  await page.goto('file://' + html);
  await page.evaluate(() => document.fonts.ready);
  const fontsOk = await page.evaluate(() => ['400 20px Poppins', '600 20px Poppins', '600 20px Lora'].every((f) => document.fonts.check(f)));
  if (!fontsOk) throw new Error('Brand fonts did not load');

  const save = async (svg, dir, file) => {
    fs.writeFileSync(path.join(dir, file + '.svg'), svg);
    await page.evaluate((svg) => { document.getElementById('o').innerHTML = svg; }, svg);
    await page.locator('#o svg').screenshot({ path: path.join(dir, file + '.png') });
  };
  for (const f of flows) {
    const svg = await page.evaluate((f) => window.drawFlow(f), f);
    await save(svg, outFlows, f.file);
    console.log('flow', f.id, f.file);
  }
  for (const a of arch) {
    const svg = await page.evaluate((a) => window.drawArch(a), a);
    await save(svg, outArch, a.file);
    console.log('architecture', a.file);
  }
  const svg = await page.evaluate((s) => window.drawScope(s), arch.scope);
  await save(svg, outArch, arch.scope.file);
  console.log('scope', arch.scope.file);
  await browser.close();
  fs.unlinkSync(html);
})().catch((e) => { console.error(e); process.exit(1); });
