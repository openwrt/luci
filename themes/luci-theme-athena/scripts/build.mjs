import '../tests/make-icon.mjs';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const result = spawnSync('node_modules/.bin/tailwindcss', ['-i', 'style-src/styles.css', '-o', 'htdocs/luci-static/athena/athena.css', '--minify'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const cssPath = 'htdocs/luci-static/athena/athena.css';
const css = readFileSync(cssPath, 'utf8');
if (!css.endsWith('\n')) writeFileSync(cssPath, css + '\n');
