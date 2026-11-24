// Rebuild saved past-season files from their Google Sheets (every visible results tab becomes a meet).
// Usage: node scripts/regen-archives.mjs        (behind a proxy: NODE_USE_ENV_PROXY=1)
import fs from 'node:fs';
import { renderSeasonByTabs } from '../src/lib/seasons.js';
const S = JSON.parse(fs.readFileSync(new URL('../src/data/seasons.json', import.meta.url)));
const out = (name, html) => fs.writeFileSync(new URL(`../public/archive/${name}.html`, import.meta.url), html);
const count = (h) => [(h.match(/uc-xc-native-meet"/g) || []).length, (h.match(/status--results/g) || []).length];
const report = (name, html) => {
  let old = '';
  try { old = fs.readFileSync(new URL(`../public/archive/${name}.html`, import.meta.url), 'utf8'); } catch {}
  const [m0, r0] = count(old); const [m1, r1] = count(html);
  console.log(name.padEnd(16), `meets ${m0}→${m1}`, `with results ${r0}→${r1}`);
  if (html) out(name, html); else console.log('  !! could not read sheet; kept old file');
};
for (const [y, sheet] of Object.entries(S.archives.xc)) report(`xc-${y}`, await renderSeasonByTabs({ kind: 'xc', year: Number(y), sheet }));
for (const [y, [sheet, g, c]] of Object.entries(S.archives.spring)) report(`spring-${y}`, await renderSeasonByTabs({ kind: 'track', sheet, scheduleGid: g, scheduleCol: c, start: Number(y), end: Number(y) }));
for (const [l, [sheet, g, c]] of Object.entries(S.archives.winter)) { const [a] = l.split('-'); report(`winter-${l}`, await renderSeasonByTabs({ kind: 'track', sheet, scheduleGid: g, scheduleCol: c, start: Number(a), end: Number(a) + 1 })); }
