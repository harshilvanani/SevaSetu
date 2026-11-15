#!/usr/bin/env bash
# Build the SevaSetu website into dist/ for static hosting (Hostinger / Apache).
#   - exports the Expo web app (single-page app)
#   - adds .htaccess: HTTPS, deep links (/seva/123 etc.) served by index.html, sensible caching
#   - adds a page description and link-preview tags (WhatsApp, social) to index.html
# Usage: npm run build:web   (reads EXPO_PUBLIC_* from .env)
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
npx expo export --platform web --output-dir dist

cp assets/images/og-image.png dist/og-image.png
cp assets/images/apple-touch-icon.png dist/apple-touch-icon.png
cp assets/images/pwa-192.png assets/images/pwa-512.png assets/images/pwa-maskable-512.png dist/
# (public/ already supplies sw.js and manifest.webmanifest, which expo export copies into dist/)

SITE_URL="$(grep -E '^EXPO_PUBLIC_SITE_URL=' .env 2>/dev/null | cut -d= -f2- | sed 's:/*$::' || true)"
SITE_URL="${EXPO_PUBLIC_SITE_URL:-$SITE_URL}"

node - "$SITE_URL" <<'NODE'
const fs = require('fs');
const site = process.argv[2] || '';
const file = 'dist/index.html';
const desc = 'Find meaningful seva near you or online, join in a tap, and see the difference your time makes. SevaSetu by The Art of Living.';
const img = site ? `${site}/og-image.png` : '/og-image.png';
const tags = [
  `<meta name="description" content="${desc}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="SevaSetu">`,
  `<meta property="og:title" content="SevaSetu — Connecting hearts through seva">`,
  `<meta property="og:description" content="${desc}">`,
  `<meta property="og:image" content="${img}">`,
  site ? `<meta property="og:url" content="${site}/">` : '',
  `<meta name="twitter:card" content="summary_large_image">`,
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
  `<link rel="manifest" href="/manifest.webmanifest">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-title" content="SevaSetu">`,
].filter(Boolean).join('\n    ');
let html = fs.readFileSync(file, 'utf8');
html = html.replace('</head>', `    ${tags}\n  </head>`);
fs.writeFileSync(file, html);
console.log('index.html: added description and link-preview tags' + (site ? ` for ${site}` : ' (no EXPO_PUBLIC_SITE_URL set)'));
NODE

cat > dist/.htaccess <<'HTACCESS'
# SevaSetu website (single-page app)
Options -Indexes
RewriteEngine On

AddType application/manifest+json .webmanifest

# Always use HTTPS
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Serve real files; send every other path (e.g. /seva/123, /auth/callback) to the app
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  # index.html, the service worker and the manifest must never be cached, so new versions show up immediately
  <FilesMatch "^(index\.html|sw\.js|manifest\.webmanifest)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  # Built JS/CSS/fonts have content hashes in their names: cache for a year
  <FilesMatch "\.(js|css|woff2?|ttf|otf)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  Header always set X-Content-Type-Options "nosniff"
  # No other site may show SevaSetu inside a frame (clickjacking)
  Header always set X-Frame-Options "DENY"
  # Browsers remember to use HTTPS for a year
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always set Permissions-Policy "camera=(), microphone=(), payment=(), geolocation=(self)"
  # Only our own scripts run; data goes only to our Supabase project; images may come from https sites (campaign pictures)
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' __SUPABASE_ORIGIN__ __SUPABASE_WS__; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>
HTACCESS

SUPABASE_ORIGIN="$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env 2>/dev/null | cut -d= -f2- | sed 's:/*$::' || true)"
SUPABASE_ORIGIN="${EXPO_PUBLIC_SUPABASE_URL:-$SUPABASE_ORIGIN}"
SUPABASE_WS="$(printf '%s' "$SUPABASE_ORIGIN" | sed 's#^https:#wss:#')"
sed -i "s#__SUPABASE_ORIGIN__#${SUPABASE_ORIGIN}#; s#__SUPABASE_WS__#${SUPABASE_WS}#" dist/.htaccess

echo "Built dist/ ($(du -sh dist | cut -f1)). Upload the contents of dist/ to the website's public_html."
