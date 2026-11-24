// Live season schedules + meet results, rendered from Google Sheets at build time.
// Ports of the old theme's xc-2026-results.php (cross country) and
// spring-2026-results.php / winter-archive-results.php (track), producing the same markup.
import { lineRows, discoverTabs } from './sheets.js';
import { esc, trim, similarPercent, parseFullDate, stripTags, monthIndex, ymd } from './util.js';

const at = (row, i) => trim(row && row[i] != null ? row[i] : '');
const includesCI = (hay, needle) => needle === '' || hay.toLowerCase().includes(needle.toLowerCase());
const SOURCES = ['export', 'gviz'];

function norm(v, extra = false) {
  v = stripTags(v).toLowerCase();
  const chars = extra ? ['&', '-', '–', '—', '/', '.', ',', '(', ')', "'", '"'] : ['&', '-', '–', '—', '/', '.', ',', ];
  for (const c of chars) v = v.split(c).join(' ');
  return v.replace(/[^a-z0-9]+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Cross country                                                       */
/* ------------------------------------------------------------------ */

function xcParseSide(rows, col) {
  const events = []; let current = -1;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    const c0 = at(r, col), c1 = at(r, col + 1), c2 = at(r, col + 2), c3 = at(r, col + 3);
    const nextName = rows[i + 1] ? at(rows[i + 1], col + 1).toLowerCase() : '';
    const nextResult = rows[i + 1] ? at(rows[i + 1], col + 2).toLowerCase() : '';
    if (c0 !== '' && c1 === '' && nextName === 'name' && nextResult.includes('result')) {
      let time = c2, note = c3;
      if (time === '' && /\b(?:a\.?m\.?|p\.?m\.?)\b/i.test(note)) { time = note; note = ''; }
      events.push({ name: c0, time, note, athletes: [] });
      current = events.length - 1; continue;
    }
    if (c1.toLowerCase() === 'name' || c2.toLowerCase().includes('result')) continue;
    if (current >= 0 && c1 !== '') events[current].athletes.push({ place: c0, name: c1, result: c2, splits: c3 });
  }
  return events.filter((e) => e.athletes.length);
}

function xcDateKey(value, year) {
  const clean = String(value).replace(/Sept\.|Sept /gi, 'Sep ');
  const key = parseFullDate(clean);
  return key && Number(key.slice(0, 4)) === Number(year) ? key : '';
}

async function xcResultMeet(year, sheet, gid) {
  const rows = await lineRows(sheet, gid, SOURCES);
  if (rows.length < 7) return null;
  const title = at(rows[0], 0); const location = at(rows[1], 0);
  let date = ''; let note = '';
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    rows[i].forEach((raw, j) => {
      const c = trim(raw);
      if (date === '' && c.includes(String(year))) { date = c; return; }
      if (i <= 2 && j > 0 && c !== '' && !c.includes(String(year)) && c.length > 3) note = c;
    });
  }
  if (date === '') return null;
  const boys = xcParseSide(rows, 0); const girls = xcParseSide(rows, 5);
  if (!boys.length && !girls.length) return null;
  return { title, location, date, note, boys, girls };
}

function xcMatch(year, meet, results) {
  const tName = norm(meet.meet); const tDate = xcDateKey(meet.date, year);
  let best = null; let bestScore = 0;
  for (const r of results) {
    const cName = norm(r.title); const cDate = xcDateKey(r.date, year);
    if (tDate && cDate) { if (tDate === cDate) return r; continue; }
    if (tName === cName || tName.includes(cName) || cName.includes(tName)) return r;
    const pct = similarPercent(tName, cName);
    if (pct > bestScore) { bestScore = pct; best = r; }
  }
  return bestScore >= 76 ? best : null;
}

function xcEvent(e) {
  let h = `<section class="uc-xc-native-event"><div class="uc-xc-native-event-head"><div><h6>${esc(e.name)}</h6>`;
  if (e.note) h += `<em>${esc(e.note)}</em>`;
  h += '</div>';
  if (e.time) h += `<span>${esc(e.time)}</span>`;
  h += '</div><div class="uc-xc-native-table-wrap"><table class="uc-xc-native-table uc-xc-results-table"><thead><tr><th>Pl.</th><th>Athlete</th><th>Result</th><th>Splits</th></tr></thead><tbody>';
  for (const a of e.athletes) {
    h += `<tr><td data-label="Place">${esc(a.place)}</td><td data-label="Athlete"><strong>${esc(a.name)}</strong></td><td data-label="Result"><strong>${esc(a.result)}</strong></td><td data-label="Splits">${esc(a.splits)}</td></tr>`;
  }
  return h + '</tbody></table></div></section>';
}

function xcResults(r) {
  let h = '<div class="uc-xc-native-results-panel"><div class="uc-xc-native-results-intro"><div><span>Official UC Results</span></div>';
  if (r.note) h += `<b>${esc(r.note)}</b>`;
  h += '</div><div class="uc-xc-native-team-grid">';
  if (r.boys.length) h += `<div class="uc-xc-native-team"><h5>BOYS</h5>${r.boys.map(xcEvent).join('')}</div>`;
  if (r.girls.length) h += `<div class="uc-xc-native-team"><h5>GIRLS</h5>${r.girls.map(xcEvent).join('')}</div>`;
  return h + '</div></div>';
}

/** Cross country season list. Returns '' if the sheet can't be read. */
export async function renderXcSeason({ year, sheet, tabs = [], current = true }) {
  const rows = await lineRows(sheet, 0, SOURCES);
  const schedule = [];
  for (const r of rows) {
    const date = at(r, 0), meet = at(r, 1);
    if (date === '' || meet === '' || date.toLowerCase() === 'date' || /^note:/i.test(date)) continue;
    if (!date.includes(String(year)) && !/\bTBD\b/i.test(date)) continue;
    schedule.push({ date, meet, location: at(r, 2), time: at(r, 3), transport: at(r, 4) });
  }
  if (!schedule.length) return '';
  const discovered = await discoverTabs(sheet);
  const gids = discovered.size ? [...discovered.keys()] : tabs;
  const results = (await Promise.all(gids.map((g) => xcResultMeet(year, sheet, g)))).filter(Boolean);
  let h = '<div class="uc-xc-native-list">';
  for (const m of schedule) {
    const r = xcMatch(year, m, results);
    h += `<article class="uc-xc-native-meet"><div class="uc-xc-native-meet-main"><div class="uc-xc-native-date">${esc(m.date)}</div><div><h5>${esc(m.meet)}</h5><div class="uc-xc-native-meta">`;
    if (m.location) h += `<span>${esc(m.location)}</span>`;
    if (m.time) h += `<span>${esc(m.time)}</span>`;
    if (m.transport) h += `<span>${esc(m.transport)}</span>`;
    h += `</div></div><span class="uc-xc-native-status${r ? ' uc-xc-native-status--results' : ''}">${r ? 'Results Posted' : current ? 'Scheduled' : 'Season Archive'}</span></div>`;
    if (r) h += `<details class="uc-xc-native-toggle"><summary>View Meet Results</summary>${xcResults(r)}</details>`;
    h += '</article>';
  }
  return h + '</div>';
}

/* ------------------------------------------------------------------ */
/* Track & field (winter / spring)                                     */
/* ------------------------------------------------------------------ */

const isRelay = (name) => /\brelay\b|\b4\s*x\s*\w+|\b4x\w+|\b(?:distance|sprint)\s+medley\b|\bmedley\b/i.test(name);
function cleanResult(v) {
  v = trim(v);
  if (/^-{2,}$/.test(v)) return '';
  const m = v.match(/^(\d{1,2}):(\d{2}):00$/);
  return m ? `${m[1]}.${m[2]}` : v;
}
const cleanNote = (v) => trim(trim(v).replace(/\b(\d{1,3}(?:st|nd|rd|th))\s+pl\.?\b/gi, '$1'));

function trackParseSide(rows, col) {
  const events = []; let current = -1;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    const c0 = at(r, col), c1 = at(r, col + 1), c2 = at(r, col + 2), c3 = at(r, col + 3);
    const nextName = rows[i + 1] ? at(rows[i + 1], col + 1).toLowerCase() : '';
    const nextResult = rows[i + 1] ? at(rows[i + 1], col + 2).toLowerCase() : '';
    if (c0 !== '' && c1 === '' && nextName === 'name' && nextResult.includes('result')) {
      events.push({ name: c0, meta: c3 !== '' ? c3 : c2, athletes: [], teamResult: '', teamNote: '' });
      current = events.length - 1; continue;
    }
    if (current < 0 || c1.toLowerCase() === 'name' || /^-{3,}/.test(c0)) continue;
    if (c1 !== '') {
      if (['BOYS', 'GIRLS'].includes(c1.toUpperCase())) continue;
      events[current].athletes.push({ place: c0, name: c1, result: cleanResult(c2), detail: c3 });
      continue;
    }
    if (isRelay(events[current].name) && (c2 !== '' || c3 !== '')) {
      if (c2 !== '') events[current].teamResult = cleanResult(c2);
      if (c3 !== '') events[current].teamNote = c3;
    }
  }
  return events.filter((e) => e.athletes.length || e.teamResult !== '' || e.teamNote !== '');
}

function ordinal(n) {
  const mod100 = n % 100;
  const s = mod100 >= 11 && mod100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return n + s;
}

function trackEvent(e) {
  const relay = isRelay(e.name);
  let h = `<section class="uc-xc-native-event uc-spring-native-event${relay ? ' uc-spring-native-event--relay' : ''}"><div class="uc-xc-native-event-head"><div><h6>${esc(e.name)}</h6></div>${relay ? '<span>Relay</span>' : ''}</div>`;
  if (e.athletes.length) {
    const mark = relay ? 'Split / Mark' : 'Result';
    h += `<div class="uc-xc-native-table-wrap"><table class="uc-xc-native-table uc-spring-native-table"><thead><tr><th>Athlete</th><th>${mark}</th><th>Notes / Splits</th></tr></thead><tbody>`;
    for (const a of e.athletes) {
      let notes = trim(a.detail); const place = trim(a.place);
      if (place !== '') {
        const pn = /^\d+$/.test(place) ? ordinal(Number(place)) : place.replace(/\s*place\s*$/i, '');
        notes = notes !== '' ? `${pn} - ${notes}` : pn;
      }
      h += `<tr><td data-label="Athlete"><strong>${esc(a.name)}</strong></td><td class="${trim(a.result) === '' ? 'is-empty' : ''}" data-label="${mark}"><strong>${esc(a.result)}</strong></td><td class="${notes === '' ? 'is-empty' : ''}" data-label="Notes / Splits">${esc(notes)}</td></tr>`;
    }
    h += '</tbody></table></div>';
  }
  if (relay && (e.teamResult !== '' || e.teamNote !== '')) {
    h += `<div class="uc-spring-native-team-result"><span>Team Result</span><strong>${esc(e.teamResult)}</strong><em>${esc(e.teamNote)}</em></div>`;
  }
  return h + '</section>';
}

export function trackResults(r) {
  const count = (r.boys.length ? 1 : 0) + (r.girls.length ? 1 : 0);
  let h = '<div class="uc-xc-native-results-panel uc-spring-native-results-panel"><div class="uc-xc-native-results-intro"><div><span>Official UC Results</span></div>';
  if (r.note) h += `<b>${esc(r.note)}</b>`;
  h += `</div><div class="uc-xc-native-team-grid${count === 1 ? ' uc-spring-native-team-grid--single' : ''}">`;
  if (r.boys.length) h += `<div class="uc-xc-native-team"><h5>BOYS</h5>${r.boys.map(trackEvent).join('')}</div>`;
  if (r.girls.length) h += `<div class="uc-xc-native-team"><h5>GIRLS</h5>${r.girls.map(trackEvent).join('')}</div>`;
  return h + '</div></div>';
}

/** Season date → YYYY-MM-DD. Fall months belong to the start year, the rest to the end year. */
function trackDateKey(v, cfg) {
  v = trim(v);
  if (v === '') return '';
  const clean = v.replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const m = clean.match(new RegExp(`\\b(${cfg.monthPattern})\\.?\\s+(\\d{1,2})`, 'i'));
  if (!m) return '';
  const mi = monthIndex(m[1].slice(0, 3));
  const day = Number(m[2]);
  if (mi < 0 || day < 1 || day > 31) return '';
  const year = mi >= 6 ? cfg.start : cfg.end;
  // strtotime rolls invalid days (e.g. Feb 30) forward; mirror that.
  const d = new Date(Date.UTC(year, mi, day));
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function trackResultMeet(cfg, gid) {
  const rows = await lineRows(cfg.sheet, gid, SOURCES);
  if (rows.length < 7) return null;
  const boys = trackParseSide(rows, 0); const girls = trackParseSide(rows, 5);
  for (const side of [boys, girls]) for (const e of side) {
    for (const a of e.athletes) a.detail = cleanNote(a.detail);
    e.teamNote = cleanNote(e.teamNote);
  }
  if (!boys.length && !girls.length) return null;
  const title = at(rows[0], 0); const location = at(rows[1], 0);
  let date = '';
  outer: for (let r = 0; r < Math.min(5, rows.length); r++) {
    for (let i = 0; i < rows[r].length; i++) {
      const c = at(rows[r], i);
      if (trackDateKey(c, cfg) !== '') { date = c; break outer; }
    }
  }
  let note = '';
  if (rows[2]) {
    for (let i = 1; i < rows[2].length; i++) {
      const x = at(rows[2], i);
      if (x === '' || ['BOYS', 'GIRLS'].includes(x.toUpperCase()) || includesCI(x, title) || includesCI(x, location) || trackDateKey(x, cfg) !== '') continue;
      note = x; break;
    }
  }
  return { title, location, date, dateKey: trackDateKey(date, cfg), note, boys, girls };
}

function trackMatch(meet, results) {
  const target = norm(meet.meet, true); let best = null; let score = 0;
  for (const r of results) {
    const name = norm(r.title, true);
    if (name === '') continue;
    let s = 0;
    if (target === name) s += 12;
    else if (target.includes(name) || name.includes(target)) s += 8;
    else { const p = similarPercent(target, name); if (p >= 80) s += 5; else if (p >= 65) s += 3; }
    if (meet.dateKey && r.dateKey === meet.dateKey) s += 6;
    if (s > score) { score = s; best = r; }
  }
  return score >= 6 ? best : null;
}

/**
 * Track season (winter or spring) list. cfg: { sheet, scheduleGid, scheduleCol, start, end, tabs, current }.
 * Returns '' if the schedule can't be read.
 */
export async function renderTrackSeason(cfg) {
  cfg = { monthPattern: 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|Nov(?:ember)?|Dec(?:ember)?', scheduleCol: 1, ...cfg };
  const rows = await lineRows(cfg.sheet, cfg.scheduleGid, SOURCES);
  const c = cfg.scheduleCol;
  const schedule = [];
  for (const r of rows) {
    const date = at(r, c), meet = at(r, c + 1);
    if (date === '' || meet === '' || date.toLowerCase() === 'date' || /^note:/i.test(date)) continue;
    const dateKey = trackDateKey(date, cfg);
    if (dateKey === '') continue;
    schedule.push({ date, dateKey, meet, location: at(r, c + 2), time: at(r, c + 3), transport: at(r, c + 4) });
  }
  schedule.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : a.meet < b.meet ? -1 : a.meet > b.meet ? 1 : 0));
  if (!schedule.length) return '';
  let gids = cfg.tabs || [];
  if (cfg.discover) { const d = await discoverTabs(cfg.sheet); if (d.size) gids = [...new Set([...gids, ...d.keys()])].filter((g) => g !== cfg.scheduleGid); }
  const results = (await Promise.all(gids.map((g) => trackResultMeet(cfg, g)))).filter(Boolean);
  let h = '<div class="uc-xc-native-list uc-spring-native-list">';
  for (const m of schedule) {
    const r = trackMatch(m, results);
    h += `<article class="uc-xc-native-meet"><div class="uc-xc-native-meet-main"><div class="uc-xc-native-date">${esc(m.date)}</div><div><h5>${esc(m.meet)}</h5><div class="uc-xc-native-meta">`;
    if (m.location) h += `<span>${esc(m.location)}</span>`;
    if (m.time && m.time.toUpperCase() !== 'N/A') h += `<span>${esc(m.time)}</span>`;
    if (m.transport && m.transport.toUpperCase() !== 'N/A') h += `<span>${esc(m.transport)}</span>`;
    h += `</div></div><span class="uc-xc-native-status${r ? ' uc-xc-native-status--results' : ''}">${r ? 'Results Posted' : cfg.current ? 'Upcoming' : 'Season Archive'}</span></div>`;
    if (r) h += `<details class="uc-xc-native-toggle uc-spring-native-toggle"><summary>View Meet Results</summary>${trackResults(r)}</details>`;
    h += '</article>';
  }
  return h + '</div>';
}

/* ------------------------------------------------------------------ */
/* Tab-driven seasons: every visible results tab becomes a meet.        */
/* ------------------------------------------------------------------ */

const ALL_MONTHS = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

/** Track parser that also keeps event blocks whose name row is missing. */
function trackParseSideLoose(rows, col) {
  const events = []; let current = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const c0 = at(r, col), c1 = at(r, col + 1), c2 = at(r, col + 2), c3 = at(r, col + 3);
    const next = rows[i + 1];
    const nextName = next ? at(next, col + 1).toLowerCase() : '';
    const nextResult = next ? at(next, col + 2).toLowerCase() : '';
    if (c0 !== '' && c1 === '' && nextName === 'name' && nextResult.includes('result') && !/^\d+$/.test(c0)) {
      events.push({ name: c0, meta: c3 !== '' ? c3 : c2, athletes: [], teamResult: '', teamNote: '' });
      current = events.length - 1; continue;
    }
    if (c1.toLowerCase() === 'name' && c2.toLowerCase().includes('result')) {
      // A Name/Results header with no event name above it starts an unnamed block.
      const prev = rows[i - 1];
      const prevIsHeader = prev && at(prev, col) !== '' && at(prev, col + 1) === '' && current >= 0 && events[current].name === at(prev, col);
      if (!prevIsHeader) {
        events.push({ name: 'Results', meta: '', athletes: [], teamResult: '', teamNote: '' });
        current = events.length - 1;
      }
      continue;
    }
    if (current < 0 || /^-{3,}/.test(c0)) continue;
    if (c1 !== '') {
      if (['BOYS', 'GIRLS'].includes(c1.toUpperCase())) continue;
      events[current].athletes.push({ place: c0, name: c1, result: cleanResult(c2), detail: cleanNote(c3) });
      continue;
    }
    if (isRelay(events[current].name) && (c2 !== '' || c3 !== '')) {
      if (c2 !== '') events[current].teamResult = cleanResult(c2);
      if (c3 !== '') events[current].teamNote = cleanNote(c3);
    }
  }
  return events.filter((e) => e.athletes.length || e.teamResult !== '' || e.teamNote !== '');
}


/** XC parser that also accepts a race header followed directly by athlete rows (no Name/Results row). */
function xcParseSideLoose(rows, col) {
  const events = []; let current = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const c0 = at(r, col), c1 = at(r, col + 1), c2 = at(r, col + 2), c3 = at(r, col + 3);
    const next = rows[i + 1];
    const nextName = next ? at(next, col + 1) : '';
    const nextResult = next ? at(next, col + 2).toLowerCase() : '';
    const timeLike = /\b(?:a\.?m\.?|p\.?m\.?)\b/i;
    const raceLike = /\b(miles?|5k|meters?|varsity|jv|novice|frosh|freshman|open|championship|race|heat|seeded|unseeded)\b/i;
    const headerWithNames = nextName.toLowerCase() === 'name' && nextResult.includes('result');
    const headerNoNames = nextName !== '' && nextName.toLowerCase() !== 'name' && (timeLike.test(c2) || timeLike.test(c3) || raceLike.test(c0));
    if (c0 !== '' && c1 === '' && !/^\d+$/.test(c0) && !/^(BOYS|GIRLS)$/i.test(c0) && (headerWithNames || headerNoNames)) {
      let time = c2, note = c3;
      if (time === '' && timeLike.test(note)) { time = note; note = ''; }
      events.push({ name: c0, time, note, athletes: [] });
      current = events.length - 1; continue;
    }
    if (c1.toLowerCase() === 'name' || c2.toLowerCase().includes('result')) continue;
    if (current >= 0 && c1 !== '') events[current].athletes.push({ place: c0, name: c1, result: c2, splits: c3 });
  }
  return events.filter((e) => e.athletes.length);
}

function genericDateKey(v, cfg) {
  return trackDateKey(v, { ...cfg, monthPattern: ALL_MONTHS });
}

async function tabMeet(cfg, gid, tabName) {
  const rows = await lineRows(cfg.sheet, gid, SOURCES);
  const isDate = (v) => genericDateKey(v, cfg) !== '';
  let title = at(rows[0], 0); let location = at(rows[1], 0);
  if (isDate(title)) { title = ''; location = ''; }
  if (isDate(location)) location = '';
  let date = '';
  outer: for (let r = 0; r < Math.min(6, rows.length); r++) {
    for (let i = 0; i < (rows[r] || []).length; i++) { const c = at(rows[r], i); if (isDate(c)) { date = c; break outer; } }
  }
  let boys, girls;
  if (cfg.kind === 'xc') { boys = xcParseSideLoose(rows, 0); girls = xcParseSideLoose(rows, 5); }
  else { boys = trackParseSideLoose(rows, 0); girls = trackParseSideLoose(rows, 5); }
  let note = '';
  const okNote = (x) => x.length > 3 && !['BOYS', 'GIRLS'].includes(x.toUpperCase()) && !isDate(x) && !includesCI(x, title || '\u0000') && !includesCI(x, location || '\u0000');
  if (rows[2]) { for (let i = 1; i < rows[2].length; i++) { const x = at(rows[2], i); if (x && okNote(x)) { note = x; break; } } }
  for (let r = 0; !note && r <= 3 && r < rows.length; r++) {
    for (let i = 1; i < (rows[r] || []).length; i++) {
      const x = at(rows[r], i);
      if (x.length > 3 && !['BOYS', 'GIRLS'].includes(x.toUpperCase()) && !isDate(x) && !/^\d{1,2}:\d{2}\s*[AP]M$/i.test(x) && !includesCI(x, title || '\u0000') && !includesCI(x, location || '\u0000') && !/^(name|results?|notes)$/i.test(x)) { note = x; break; }
    }
    if (note) break;
  }
  // Saved copy (e.g. Spring 2026) wins when the sheet tab is incomplete.
  const saved = cfg.saved?.[gid];
  const unnamed = [...boys, ...girls].some((e) => e.name === 'Results');
  if (saved && (title === '' || unnamed || (!boys.length && !girls.length))) {
    return { gid, tabName, title: saved.title || title, location: saved.location || location, date: date || saved.date || '', dateKey: genericDateKey(date || saved.date || '', cfg), note: saved.note || note, boys: saved.boys, girls: saved.girls };
  }
  if (!date && !boys.length && !girls.length) return null; // helper tab, not a meet
  return { gid, tabName, title, location, date, dateKey: genericDateKey(date, cfg), note: cfg.kind === 'xc' ? (await xcResultMeet(cfg.year, cfg.sheet, gid))?.note || '' : note, boys, girls };
}

function nameScore(a, b) {
  const x = norm(a, true), y = norm(b, true);
  if (!x || !y) return 0;
  if (x === y) return 12;
  if (x.includes(y) || y.includes(x)) return 8;
  const p = similarPercent(x, y);
  return p >= 80 ? 5 : p >= 65 ? 3 : 0;
}

/**
 * Season list built from the sheet's visible tabs. cfg: { kind: 'xc'|'track', sheet, scheduleGid, scheduleCol,
 * start, end, year, current, tabs (fallback ids), saved (gid → meet) }.
 */
export async function renderSeasonByTabs(cfg) {
  cfg = { scheduleGid: 0, scheduleCol: 0, ...cfg };
  if (cfg.kind === 'xc') { cfg.start = cfg.end = cfg.year; }
  // Schedule rows (blank dates kept; they sort after the previous dated row).
  const sRows = await lineRows(cfg.sheet, cfg.scheduleGid, SOURCES);
  const c = cfg.scheduleCol; const schedule = []; let lastKey = '';
  sRows.forEach((r, idx) => {
    const date = at(r, c), meet = at(r, c + 1);
    if (meet === '' || /^(meet|date)$/i.test(meet) || date.toLowerCase() === 'date' || /^note:/i.test(date)) return;
    const dateKey = genericDateKey(date, cfg);
    if (date !== '' && dateKey === '' && !/\bTBD\b/i.test(date)) return;
    if (dateKey) lastKey = dateKey;
    schedule.push({ date, dateKey, sortKey: dateKey || lastKey, meet, location: at(r, c + 2), time: at(r, c + 3), transport: at(r, c + 4), idx, used: false });
  });
  // Visible tabs in sheet order.
  const discovered = await discoverTabs(cfg.sheet);
  let tabList = discovered.size ? [...discovered] : (cfg.tabs || []).map((g) => [g, '']);
  tabList = tabList.filter(([g]) => g !== cfg.scheduleGid && !(cfg.exclude || []).includes(g));
  const meets = (await Promise.all(tabList.map(([g, n]) => tabMeet(cfg, g, n)))).filter(Boolean);
  if (!meets.length && !schedule.length) return '';

  const entries = [];
  meets.forEach((m, order) => {
    let best = null; let bestScore = 0;
    for (const s of schedule) {
      if (s.used) continue;
      let score = nameScore(s.meet, m.title);
      const gap = m.dateKey && s.dateKey ? Math.abs(Date.parse(m.dateKey) - Date.parse(s.dateKey)) / 864e5 : null;
      if (gap === 0) score += 6;
      else if (gap !== null && gap <= 3 && score >= 3) score += 3;
      else if (gap !== null && gap > 3 && score < 8) continue;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best && bestScore >= 6) best.used = true; else best = null;
    if (!m.title && !best) {
      // Untitled tab: use the schedule row on the same day if there is one.
      const sameDay = schedule.find((s) => !s.used && s.dateKey && s.dateKey === m.dateKey);
      if (sameDay) { sameDay.used = true; best = sameDay; }
    }
    const hasResults = m.boys.length || m.girls.length;
    entries.push({
      date: (best && best.date && (!/\b(19|20)\d{2}\b/.test(m.date) || best.dateKey === m.dateKey)) ? best.date : (m.date || 'Date TBA'),
      sortKey: m.dateKey || best?.sortKey || '9999',
      order,
      meet: best?.meet || m.title || m.tabName || 'Meet',
      location: best?.location || m.location,
      time: best?.time || '', transport: best?.transport || '',
      result: hasResults ? m : null,
    });
  });
  for (const s of schedule) {
    if (s.used) continue;
    if (!s.dateKey && !cfg.current) continue; // undated, no results tab, past season
    entries.push({ date: s.date || 'Date TBA', sortKey: s.sortKey || '9999', order: 1000 + s.idx, meet: s.meet, location: s.location, time: s.time, transport: s.transport, result: null });
  }
  entries.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.order - b.order));

  const xc = cfg.kind === 'xc';
  let h = `<div class="uc-xc-native-list${xc ? '' : ' uc-spring-native-list'}">`;
  for (const e of entries) {
    const r = e.result;
    h += `<article class="uc-xc-native-meet"><div class="uc-xc-native-meet-main"><div class="uc-xc-native-date">${esc(e.date)}</div><div><h5>${esc(e.meet)}</h5><div class="uc-xc-native-meta">`;
    if (e.location) h += `<span>${esc(e.location)}</span>`;
    if (e.time && e.time.toUpperCase() !== 'N/A') h += `<span>${esc(e.time)}</span>`;
    if (e.transport && e.transport.toUpperCase() !== 'N/A') h += `<span>${esc(e.transport)}</span>`;
    const idle = cfg.current ? (xc ? 'Scheduled' : 'Upcoming') : 'Season Archive';
    h += `</div></div><span class="uc-xc-native-status${r ? ' uc-xc-native-status--results' : ''}">${r ? 'Results Posted' : idle}</span></div>`;
    if (r) {
      const body = xc ? xcResults({ note: r.note, boys: r.boys, girls: r.girls }) : trackResults(r);
      h += `<details class="uc-xc-native-toggle${xc ? '' : ' uc-spring-native-toggle'}"><summary>View Meet Results</summary>${body}</details>`;
    }
    h += '</article>';
  }
  return h + '</div>';
}
