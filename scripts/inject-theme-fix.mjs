#!/usr/bin/env node
/**
 * Fix remaining templates that didn't get CSS vars from the first pass.
 * These templates use single-line #root { ... } CSS.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const T = join(process.cwd(), 'templates');

// Templates with single-line #root CSS that need fixing
const FIXES = [
  // [template, file, bgColor, textColor, accent1, accent2]
  ['frame-aicoding-list', 'index.html', '#08080f', '#f4f5fb', '#ff5a2c', '#ff9a3d'],
  ['frame-aicoding-comparison', 'index.html', '#070d12', '#eef3f4', '#ff6b3d', '#22d3ee'],
  ['frame-aicoding-comparison', 'compositions/portrait.html', '#070d12', '#eef3f4', '#ff6b3d', '#22d3ee'],
  ['frame-creative-voltage', 'index.html', '#0d0d14', '#fff', '#1e90ff', '#0cc0df'],
  ['frame-creative-voltage', 'compositions/portrait.html', '#0a1628', '#fff', '#1e90ff', '#0cc0df'],
  ['frame-glitch-title', 'index.html', '#0d0e10', '#f5f5f7', '#00e5ff', '#ff00ff'],
  ['frame-glitch-title', 'compositions/portrait.html', '#0d0e10', '#f5f5f7', '#00e5ff', '#ff00ff'],
  ['frame-stat-comparison', 'index.html', '#070d12', '#eef3f4', '#8e80ff', '#34e0c0'],
];

for (const [tmpl, file, bg, text, a1, a2] of FIXES) {
  const fp = join(T, tmpl, file);
  if (!existsSync(fp)) { console.log('Missing: ' + fp); continue; }
  
  let html = readFileSync(fp, 'utf8');
  
  if (html.includes('Theme defaults')) {
    console.log('Already done: ' + tmpl + '/' + file);
    continue;
  }
  
  // Find single-line #root { ... } and expand it
  const rootRegex = new RegExp(`(#root\\s*\\{\\s*)(position: relative;)`);
  if (rootRegex.test(html)) {
    const vars = `/* Theme defaults */\n    --bg-primary: ${bg}; --bg-secondary: ${bg};\n    --text-primary: ${text}; --text-secondary: ${text}80;\n    --accent-1: ${a1}; --accent-2: ${a2};\n    --blob-1: ${a1}33; --blob-2: ${a2}33; --blob-3: ${a1}22;\n    `;
    html = html.replace(rootRegex, `$1${vars}$2`);
    
    // Replace background: <color> with background: var(--bg-primary)
    html = html.replace(
      new RegExp(`(#root\\s*\\{[^}]*?)background:\\s*${bg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `$1background: var(--bg-primary)`
    );
    // Replace color: <color> with color: var(--text-primary)  
    html = html.replace(
      new RegExp(`(#root\\s*\\{[^}]*?)color:\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `$1color: var(--text-primary)`
    );
    
    writeFileSync(fp, html, 'utf8');
    console.log('Fixed CSS vars: ' + tmpl + '/' + file);
  } else {
    console.log('No match for #root in: ' + tmpl + '/' + file);
  }
}

// Fix liquid-bg-hero index.html
const lbhIndex = join(T, 'frame-liquid-bg-hero', 'index.html');
if (existsSync(lbhIndex)) {
  let html = readFileSync(lbhIndex, 'utf8');
  if (!html.includes('Theme defaults')) {
    html = html.replace(
      /(#root\s*\{)\s*\n/,
      `$1\n                /* Theme defaults */\n                --bg-primary: #020c1a;\n                --bg-secondary: #0a1628;\n                --text-primary: #fafaf8;\n                --text-secondary: rgba(250,250,248,0.55);\n                --accent-1: #ff4d6d;\n                --accent-2: #5ce1e6;\n                --blob-1: #1565c0;\n                --blob-2: #0d47a1;\n                --blob-3: #1976d2;\n\n`
    );
    // Replace hard-coded bg/color
    html = html.replace(/background: #020c1a;/, 'background: var(--bg-primary);');
    html = html.replace(/color: #fafaf8;/, 'color: var(--text-primary);');
    // Replace blob colors  
    html = html.replace(/\.blob1 \{[^}]*background: #1565c0/, m => m.replace('#1565c0', 'var(--blob-1)'));
    html = html.replace(/\.blob2 \{[^}]*background: #0d47a1/, m => m.replace('#0d47a1', 'var(--blob-2)'));
    html = html.replace(/\.blob3 \{[^}]*background: #1976d2/, m => m.replace('#1976d2', 'var(--blob-3)'));
    writeFileSync(lbhIndex, html, 'utf8');
    console.log('Fixed: liquid-bg-hero/index.html');
  }
}

console.log('Done!');
