// Rewrites the precache list in sw.js from the files on disk. Run after adding or removing app files:
//   node tools/update-precache.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = ['js', 'css'].flatMap(d => walk(join(root, d))).map(f => './' + relative(root, f)).sort();
const icons = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].filter(f => existsSync(join(root, 'icons', f))).map(f => './icons/' + f);
const shell = ['./', './index.html', './config.js', './manifest.webmanifest', ...files, ...icons];
const sw = join(root, 'sw.js'); const src = readFileSync(sw, 'utf8');
const out = src.replace(/(\/\* PRECACHE:START[^\n]*\n)[\s\S]*?(\/\* PRECACHE:END \*\/)/, `$1const SHELL = ${JSON.stringify(shell, null, 1).replace(/\n\s*/g, ' ')};\n$2`);
writeFileSync(sw, out); console.log(`precache: ${shell.length} files`);
