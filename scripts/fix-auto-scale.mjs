import fs from 'fs';
import path from 'path';

const files = [
  'templates/frame-vignelli/index.html',
  'templates/frame-vignelli/compositions/portrait.html',
  'templates/frame-stat-comparison/index.html',
  'templates/frame-aicoding-comparison/index.html',
  'templates/frame-aicoding-comparison/compositions/portrait.html',
];

for (const file of files) {
  const p = path.join(process.cwd(), file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/if\s*\(el\.scrollWidth\s*>\s*el\.offsetWidth\)\s*\{[\s\S]*?var sized = Math\.max\(([^,]+),\s*Math\.floor\(([^*]+)\s*\*\s*el\.offsetWidth\s*\/\s*el\.scrollWidth\)\);/g, 
    `var pw = el.parentElement.clientWidth;\n                    if (el.scrollWidth > pw) {\n                        var sized = Math.max($1, Math.floor($2 * pw / el.scrollWidth));`);
  fs.writeFileSync(p, content, 'utf8');
  console.log(`Updated ${file}`);
}
