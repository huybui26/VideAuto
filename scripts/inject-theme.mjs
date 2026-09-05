#!/usr/bin/env node
/**
 * Batch inject CSS custom properties + theme applicator JS into all template HTML files.
 * Run: node scripts/inject-theme.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = join(process.cwd(), 'templates');

const THEME_JS = `
                // ── Theme Applicator ──
                var _t = v.__theme || {};
                var _r = document.getElementById('root');
                var _sv = function(n, val) { if (val) _r.style.setProperty(n, val); };
                _sv('--bg-primary', _t.bgPrimary);
                _sv('--bg-secondary', _t.bgSecondary);
                _sv('--text-primary', _t.textPrimary);
                _sv('--text-secondary', _t.textSecondary);
                _sv('--accent-1', _t.accent1);
                _sv('--accent-2', _t.accent2);
                _sv('--blob-1', _t.blob1);
                _sv('--blob-2', _t.blob2);
                _sv('--blob-3', _t.blob3);
`;

const DARK_DEFAULTS = `
                /* Theme defaults */
                --bg-primary: #020c1a;
                --bg-secondary: #0a1628;
                --text-primary: #fafaf8;
                --text-secondary: rgba(250,250,248,0.55);
                --accent-1: #ff4d6d;
                --accent-2: #5ce1e6;
                --blob-1: #1565c0;
                --blob-2: #0d47a1;
                --blob-3: #1976d2;
`;

const LIGHT_DEFAULTS = `
                /* Theme defaults */
                --bg-primary: #f5f2ef;
                --bg-secondary: #ede8e3;
                --text-primary: #1c1410;
                --text-secondary: rgba(28,20,16,0.55);
                --accent-1: #d8000f;
                --accent-2: #5ce1e6;
                --blob-1: #2a4a6e;
                --blob-2: #1a3a5e;
                --blob-3: #3a5a7e;
`;

function injectThemeJS(html) {
  if (html.includes('Theme Applicator')) return html;
  const pattern = /(\?[^:]*:\s*\{\}\s*;?\s*\n)/;
  const match = html.match(pattern);
  if (match) return html.replace(pattern, match[1] + THEME_JS);
  const setPattern = /([ \t]*var set = function)/;
  if (html.match(setPattern)) return html.replace(setPattern, THEME_JS + '\n$1');
  console.warn('  Warning: no injection point found');
  return html;
}

function injectCSSVars(html, isDark) {
  if (html.includes('--bg-primary')) return html;
  const defaults = isDark ? DARK_DEFAULTS : LIGHT_DEFAULTS;
  const rootPattern = /(#root\s*\{)\s*\n/;
  if (html.match(rootPattern)) return html.replace(rootPattern, '$1\n' + defaults + '\n');
  console.warn('  Warning: no #root found');
  return html;
}

const CONFIGS = {
  'frame-liquid-bg-hero': { done: true },
  'frame-bold-poster': { dark: [false, false] },
  'frame-statement-outro': { dark: [false, false] },
  'frame-stat-comparison': { dark: [true, true] },
  'frame-aicoding-list': { dark: [true, true] },
  'frame-alert-stat': { dark: [true, true] },
  'frame-build-minimal': { dark: [true, true] },
  'frame-vignelli': { dark: [true, true] },
  'frame-logo-outro': { dark: [true, true] },
  'frame-creative-voltage': { dark: [true, true] },
  'frame-glitch-title': { dark: [true, true] },
  'frame-glass-hero': { dark: [true, true] },
  'frame-bento-body': { dark: [true, true] },
  'frame-pentagram-stat': { dark: [true, true] },
  'frame-aicoding-comparison': { dark: [true, true] },
};

const dirs = readdirSync(TEMPLATES_DIR).filter(n => {
  const fp = join(TEMPLATES_DIR, n);
  return statSync(fp).isDirectory() && n.startsWith('frame-');
});

for (const name of dirs) {
  const cfg = CONFIGS[name];
  if (!cfg || cfg.done) { console.log('Skip ' + name); continue; }
  const files = [
    [join(TEMPLATES_DIR, name, 'compositions', 'portrait.html'), cfg.dark[0]],
    [join(TEMPLATES_DIR, name, 'index.html'), cfg.dark[1]],
  ];
  for (const [fp, isDark] of files) {
    if (!existsSync(fp)) { console.log('  Missing: ' + fp); continue; }
    console.log('Processing: ' + fp);
    let html = readFileSync(fp, 'utf8');
    html = injectCSSVars(html, isDark);
    html = injectThemeJS(html);
    writeFileSync(fp, html, 'utf8');
    console.log('  Done');
  }
}
console.log('All done!');
