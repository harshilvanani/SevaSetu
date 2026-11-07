// Renders the SevaSetu mark to all app icon / splash PNGs with headless Chromium.
// Usage: node scripts/gen-icons.js   (requires playwright)
const { chromium } = require('playwright');
const path = require('path');

const PEACH = '#FFF3E6', SUN = '#FF9800', PURPLE = '#8441AB';
// Mark drawn on a 64-unit grid: rising sun behind a bridge (setu) with three pillars.
const mark = (stroke = PURPLE, sun = SUN) => `
  <circle cx="32" cy="27" r="11" fill="${sun}"/>
  <path d="M12 45C17 34 24 29 32 29s15 5 20 16" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <path d="M7 45h50M22 34.5V45M32 29v16M42 34.5V45" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round"/>`;

// scale = fraction of canvas the 64-grid occupies
const svg = ({ size, bg, scale, stroke, sun }) => {
  const s = (size * scale) / 64, off = (size - size * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    ${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
    <g transform="translate(${off} ${off}) scale(${s})">${mark(stroke, sun)}</g></svg>`;
};

const outputs = [
  ['icon.png', { size: 1024, bg: PEACH, scale: 0.78 }],
  ['android-icon-foreground.png', { size: 1024, scale: 0.5 }],
  ['android-icon-monochrome.png', { size: 1024, scale: 0.5, stroke: '#FFFFFF', sun: '#FFFFFF' }],
  ['splash-icon.png', { size: 512, scale: 0.9 }],
  ['notification-icon.png', { size: 96, scale: 0.9, stroke: '#FFFFFF', sun: '#FFFFFF' }],
  ['favicon.png', { size: 48, bg: PEACH, scale: 0.86 }],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, opts] of outputs) {
    await page.setViewportSize({ width: opts.size, height: opts.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opts)}</body></html>`);
    await page.screenshot({ path: path.join(__dirname, '../assets/images', file), omitBackground: true, clip: { x: 0, y: 0, width: opts.size, height: opts.size } });
    console.log('wrote', file);
  }
  await browser.close();
})();
