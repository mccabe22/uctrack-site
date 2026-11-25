/**
 * UC Track — Records Checker (Winter 2026-27)
 *
 * Every 10 minutes (and from the "UC Records" menu) this script:
 *   1. Reads every visible meet tab and finds marks it has not seen before.
 *   2. Compares each mark with the Winter record books (school records, top 10,
 *      top 10 by class, relay top 10).
 *   3. Adds anything that would make a list to "Records Review" as Pending,
 *      and emails a short summary.
 *   4. When a row is set to Approved, writes it into the record book
 *      (re-ranking the list) and notes what it did in the Processing column.
 * Nothing in the record books changes without an Approved row.
 *
 * Grad years come from the record books' class lists. Add anyone missing to the
 * "Classes" tab (Name | Grad Year), or type the class in the review row.
 */

var RC = {
  season: '2026-27',
  seasonEnd: 2027,
  records: {
    Boys:  { id: '1bbsb1bb727pSgLEgBJdkB7SJkFnKUaba27gbljnUuNA', school: 0, top10: 1, classes: 1933507034, relays: 2 },
    Girls: { id: '1JAKX8cuBBCyh7QcQV0ZuoryYDyDQNVs79JkSQ_QLh5k', school: 0, top10: 1, classes: 2125377032, relays: 2 }
  },
  skipTabs: ['Schedule', 'Records Review', 'Names', 'Records Sync Log', 'Classes'],
  reviewTab: 'Records Review',
  logTab: 'Records Sync Log',
  classTab: 'Classes',
  email: true
};

/* ------------------------------------------------------------------ */
/* Pure helpers (no Google services) — also tested outside Apps Script */
/* ------------------------------------------------------------------ */

var RELAY_MIN = { 'R:4x200': 80, 'R:4x400': 180, 'R:4x800': 420, 'R:4xMile': 960, 'R:SMR': 180, 'R:DMR': 560 };
var FIELD = ['Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault', 'Shot Put', 'Weight Throw'];
var CLASS_NAMES = ['Senior', 'Junior', 'Sophomore', 'Freshman'];
var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function rcTrim(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function rcKeyName(n) { return rcTrim(n).toLowerCase().replace(/[^a-z' -]/g, ''); }
function rcSamePerson(a, b) {
  var x = rcKeyName(a), y = rcKeyName(b);
  if (x === y) return true;
  var xs = x.split(' '), ys = y.split(' ');
  if (xs.length < 2 || ys.length < 2) return false;
  return xs[xs.length - 1] === ys[ys.length - 1] && xs[0].slice(0, 2) === ys[0].slice(0, 2);
}

/** Canonical record-book event for a results heading, e.g. "55 Meter Dash (Trials)" -> "55 Meter Dash". */
function rcEvent(raw) {
  var s = rcTrim(raw).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[–—]/g, '-');
  if (!s) return null;
  if (/relay|\b4\s*x|smr|dmr|medley|shuttle/.test(s)) {
    if (/shuttle|jump|vault|shot|throw/.test(s)) return null;           // check these by hand
    if (/distance medley|dmr/.test(s)) return 'R:DMR';
    if (/sprint medley|smr/.test(s)) return /\b800\s*m?\s*sprint/.test(s) ? null : 'R:SMR';
    var m = s.match(/4\s*x\s*(mile|1600|800|400|200)/);
    if (!m) return null;
    return 'R:4x' + (m[1] === '1600' ? 'Mile' : m[1] === 'mile' ? 'Mile' : m[1]);
  }
  if (/pentathlon|heptathlon/.test(s)) return null;
  var f = [['long jump', 'Long Jump'], ['triple jump', 'Triple Jump'], ['high jump', 'High Jump'], ['pole vault', 'Pole Vault'], ['shot put', 'Shot Put'], ['weight throw', 'Weight Throw']];
  for (var i = 0; i < f.length; i++) if (s.indexOf(f[i][0]) >= 0) return f[i][1];
  if (/\b(2|two)[\s-]*mile/.test(s)) return '2 Mile Run';
  if (/\b(1|one)?[\s-]*mile/.test(s)) return '1 Mile Run';
  var d = s.match(/\b(\d{2,4})\s*(m\b|meter|metre|-meter|m\s)/) || s.match(/^\s*(\d{2,4})\b/);
  if (!d) return null;
  var n = Number(d[1]);
  if (/hurdle|\bhh\b/.test(s)) return n + ' Meter Hurdles';
  return n + (n <= 400 ? ' Meter Dash' : ' Meter Run');
}

function rcIsField(event) { return FIELD.indexOf(event) >= 0; }

/** Mark text -> number (seconds for races, inches for field), or null if not a mark. */
function rcMark(text, field) {
  var t = rcTrim(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  if (!t || /^(dns|dnf|dq|nh|nm|foul|scr|ns|fs|nt|n\/a|-+|x)\b/i.test(t)) return null;
  if (field) {
    var m = t.match(/^(\d{1,3})\s*(?:-|'|ft)\s*(\d{1,2}(?:\.\d+)?)?/);
    if (m) return Math.floor((Number(m[1]) * 12 + Number(m[2] || 0)) * 4 + 1e-6) / 4;   // quarter inches, rounded down
    var mm = t.match(/^(\d{1,2}\.\d{1,2})\s*m$/i);
    if (mm) return Math.floor(Number(mm[1]) * 39.3701 * 4) / 4;
    return null;
  }
  var h = t.match(/^(\d{1,2}):(\d{1,2}):(\d{2}(?:\.\d+)?)/);
  if (h) return Number(h[1]) * 3600 + Number(h[2]) * 60 + Number(h[3]);
  var r = t.match(/^(\d{1,3}):(\d{2}(?:\.\d+)?)/);
  if (r) return Number(r[1]) * 60 + Number(r[2]);
  var s = t.match(/^(\d{1,3}\.\d{1,3})\b/);
  if (s) return Number(s[1]);
  return null;
}

/** The mark as the record books write it ("6.43", "1:19.95", "6' 04.00\""). */
function rcMarkText(text, field) {
  var t = rcTrim(text).replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  if (!field) { var m = t.match(/^[\d:.]+/); return m ? m[0] : t; }
  var v = rcMark(t, true);
  if (v == null) return t;
  var ft = Math.floor(v / 12 + 1e-9), inch = v - ft * 12;
  var s = inch.toFixed(2); if (inch < 10) s = '0' + s;
  return ft + "' " + s + '"';
}

function rcBetter(a, b, field) { return field ? a > b + 1e-9 : a < b - 1e-9; }

/** First date written in a cell ("Sunday, January 24, 2027", "THURSDAY, MARCH 11th" + year). */
function rcDate(text, fallbackYear) {
  var s = rcTrim(text).toLowerCase();
  var m = s.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/);
  if (m) {
    var y = m[3] ? Number(m[3]) : fallbackYear;
    if (!y) return null;
    return new Date(y, MONTHS.indexOf(m[1]), Number(m[2]));
  }
  var n = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (n) { var yy = Number(n[3]); if (yy < 100) yy += 2000; return new Date(yy, Number(n[1]) - 1, Number(n[2])); }
  return null;
}
function rcFmtDate(d) {
  if (!d) return '';
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(d.getMonth() + 1) + '/' + p(d.getDate()) + '/' + d.getFullYear();
}
function rcSameDay(text, d) {
  var m = String(text).match(/(\d{1,2})\/(\d{1,2})(?:-\d{1,2})?\/(\d{2,4})/); if (!m) return false;
  var y = Number(m[3]); if (y < 100) y += 2000;
  return Number(m[1]) === d.getMonth() + 1 && Math.abs(Number(m[2]) - d.getDate()) <= 3 && y === d.getFullYear();
}
function rcSeasonEnd(d) { return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); }

/** Read a meet tab (display values) into marks. */
function rcParseTab(values, genderOf, seasonEnd) {
  genderOf = genderOf || function () { return null; };
  var cell = function (r, c) { return r < values.length && c < (values[r] || []).length ? rcTrim(values[r][c]) : ''; };
  var title = cell(0, 0), location = cell(1, 0);
  var tabDate = rcDate(cell(2, 0)) || rcDate(cell(3, 0));
  if (!tabDate && seasonEnd) {                       // date written without a year: use the season
    var probe = rcDate(cell(2, 0), seasonEnd) || rcDate(cell(3, 0), seasonEnd);
    if (probe && probe.getMonth() >= 6) probe.setFullYear(seasonEnd - 1);
    tabDate = probe;
  }
  var year = tabDate ? tabDate.getFullYear() : null;
  var out = [];
  [[0, 'Boys'], [5, 'Girls']].forEach(function (p) {
    var c0 = p[0], gender = p[1], date = tabDate, ev = null, evRaw = '', inBlock = false, legs = [];
    for (var r = 3; r < values.length; r++) {
      var P = [cell(r, c0), cell(r, c0 + 1), cell(r, c0 + 2), cell(r, c0 + 3)];
      var a = P[0].toUpperCase();
      if (a === 'BOYS' || a === 'GIRLS') { gender = a === 'BOYS' ? 'Boys' : 'Girls'; inBlock = false; continue; }
      if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(P[0]) && !P[1]) {
        var dd = rcDate(P[0], year); if (dd) date = dd; inBlock = false; continue;
      }
      if (P[1] === 'Name') { inBlock = true; legs = []; continue; }
      if (P.join('') === '') { inBlock = false; continue; }
      if (P[0] && !/^\d+$/.test(P[0]) && !P[1]) {           // event heading
        evRaw = P[0]; ev = rcEvent(P[0]); inBlock = false; legs = []; continue;
      }
      if (!inBlock || !ev) continue;
      var relay = ev.indexOf('R:') === 0;
      if (relay) {
        if (P[1]) { legs.push(P[1]); continue; }
        if (P[2] && rcMark(P[2], false) >= (RELAY_MIN[ev] || 0) && legs.length >= 3) {
          out.push({ gender: genderOf(legs[0]) || genderOf(legs[1]) || gender, event: ev, eventRaw: evRaw, relay: true, name: legs.slice(0, 4).join('/'), extraLegs: legs.length > 4, legs: legs.slice(), markRaw: P[2], mark: rcMark(P[2], false), markText: rcMarkText(P[2], false), date: date, row: r + 1, notes: P[3] });
        }
        continue;
      }
      if (!P[1]) continue;
      var field = rcIsField(ev), v = rcMark(P[2], field);
      if (v == null) continue;
      out.push({ gender: genderOf(P[1]) || gender, event: ev, eventRaw: evRaw, relay: false, name: P[1], markRaw: P[2], mark: v, markText: rcMarkText(P[2], field), date: date, row: r + 1, notes: P[3] });
    }
  });
  return { title: title, location: location, date: tabDate, entries: out };
}

/** Relay names in the record book ("4 x 800 Meter Relay", "Sprint Medley Relay (SMR)") -> "R:4x800". */
function rcRelayKey(name) {
  var s = rcTrim(name).toLowerCase();
  if (/shuttle|jump|vault|shot|throw/.test(s)) return null;
  if (/distance medley|dmr/.test(s)) return 'R:DMR';
  if (/sprint medley|smr/.test(s)) return 'R:SMR';
  var m = s.match(/4\s*x\s*(mile|1600|800|400|200)/);
  return m ? 'R:4x' + (m[1] === '1600' || m[1] === 'mile' ? 'Mile' : m[1]) : null;
}

/** Parse a top-10 style sheet into blocks: {event: {rows:[{row, rank, date, name, markText, mark, meet, loc}], first, size}}. */
function rcParseLists(values, relay) {
  var blocks = {}, cur = null, classMode = false;
  for (var r = 1; r < values.length; r++) {
    var row = values[r] || [], a = rcTrim(row[0]);
    var rest = row.slice(1).map(rcTrim).join('');
    var isClass = CLASS_NAMES.indexOf(a) >= 0;
    if (a && !rest && !isClass) {                             // event heading
      var key = relay ? rcRelayKey(a) : a;
      cur = { event: key, name: a, lists: {}, currentList: 'School' }; if (key) blocks[key] = cur; continue;
    }
    if (!cur || !cur.event) continue;
    if (isClass) cur.currentList = a; else if (a === 'School') cur.currentList = 'School';
    if (!rest) continue;
    var listName = cur.currentList;
    var L = cur.lists[listName] || (cur.lists[listName] = { first: r + 1, size: 0, rows: [] });
    L.size++;
    var name = relay ? rcTrim(row[4]) : rcTrim(row[3]);
    var markText = relay ? rcTrim(row[3]) : rcTrim(row[4]);
    if ((!relay && (!name || name === 'N/A')) || !markText || markText === 'N/A') continue;
    L.rows.push({ row: r + 1, rank: rcTrim(row[1]), date: rcTrim(row[2]), name: name, markText: markText, meet: rcTrim(row[5]), loc: rcTrim(row[6]) });
  }
  return blocks;
}

/** School-records grid: {event: {row, cols:{School:{mark,name,year}, Senior:..}}} (+ relays: {row, mark, names, year}). */
function rcParseSchool(values) {
  var out = {}, relays = {}, inRelays = false;
  for (var r = 2; r < values.length; r++) {
    var a = rcTrim(values[r][0]);
    if (/RELAYS$/.test(a)) { inRelays = true; continue; }
    if (!a || a === 'RELAY' || a === 'EVENT') continue;
    if (inRelays) {
      var k = rcRelayKey(a); if (!k) continue;
      relays[k] = { row: r + 1, mark: rcTrim(values[r][1]), names: rcTrim((values[r + 1] || [])[1]) + ' ' + rcTrim((values[r + 2] || [])[1]), year: rcTrim((values[r + 3] || [])[1]) };
      continue;
    }
    var cols = {};
    ['School', 'Senior', 'Junior', 'Sophomore', 'Freshman'].forEach(function (c, i) {
      cols[c] = { col: i + 2, mark: rcTrim(values[r][i + 1]), name: rcTrim((values[r + 1] || [])[i + 1]), year: rcTrim((values[r + 2] || [])[i + 1]) };
    });
    out[a] = { row: r + 1, cols: cols };
  }
  return { individual: out, relays: relays };
}

/** Grad years learned from the class lists: name -> grad year. */
function rcGradYears(classBlocks, seasonEnd) {
  var votes = {};
  Object.keys(classBlocks).forEach(function (ev) {
    var lists = classBlocks[ev].lists;
    CLASS_NAMES.forEach(function (cls, i) {
      (lists[cls] ? lists[cls].rows : []).forEach(function (e) {
        var m = e.date.match(/(\d{1,2})\/[\d-]+\/(\d{2,4})$/); if (!m) return;
        var y = Number(m[2]); if (y < 100) y += 2000;
        var end = Number(m[1]) >= 7 ? y + 1 : y;
        if (seasonEnd && (end < seasonEnd - 3 || end > seasonEnd)) return;
        var grad = end + i, k = rcKeyName(e.name);
        votes[k] = votes[k] || {}; votes[k][grad] = (votes[k][grad] || 0) + 1;
      });
    });
  });
  var out = {};
  Object.keys(votes).forEach(function (k) {
    var best = null; Object.keys(votes[k]).forEach(function (g) { if (!best || votes[k][g] > votes[k][best]) best = g; });
    out[k] = Number(best);
  });
  return out;
}
function rcClassFor(grad, seasonEnd) { var i = grad - seasonEnd; return i >= 0 && i <= 3 ? CLASS_NAMES[i] : null; }
function rcClassFromText(t) {
  var s = rcTrim(t).toLowerCase();
  if (/^(sr|senior|12)/.test(s)) return 'Senior'; if (/^(jr|junior|11)/.test(s)) return 'Junior';
  if (/^(so|soph|sophomore|10)/.test(s)) return 'Sophomore'; if (/^(fr|fresh|freshman|9)/.test(s)) return 'Freshman';
  return null;
}

/** Where a mark would land in one list. Individual lists hold each athlete once. */
function rcPlace(list, entry, field, perPerformer) {
  if (!list) return null;
  var rows = list.rows.map(function (e) { return { e: e, v: rcMark(e.markText, field) }; }).filter(function (x) { return x.v != null; });
  var own = null;
  if (perPerformer) rows.forEach(function (x) { if (rcSamePerson(x.e.name, entry.name) && (!own || rcBetter(x.v, own.v, field))) own = x; });
  if (!perPerformer) rows.forEach(function (x) { if (Math.abs(x.v - entry.mark) < 1e-9 && x.e.date && entry.date && rcSameDay(x.e.date, entry.date)) own = x; });
  if (!perPerformer && own) return { qualifies: false, reason: 'already in the book', currentRank: own.e.rank || '' };
  if (own && !rcBetter(entry.mark, own.v, field)) return { qualifies: false, reason: 'already on list with ' + own.e.markText, currentRank: own.e.rank || '' };
  var alias = own && rcKeyName(own.e.name) !== rcKeyName(entry.name) ? own.e.name : '';
  var others = rows.filter(function (x) { return x !== own; });
  var rank = 1 + others.filter(function (x) { return rcBetter(x.v, entry.mark, field); }).length;
  var ties = others.some(function (x) { return Math.abs(x.v - entry.mark) < 1e-9; });
  return { qualifies: rank <= Math.min(list.size, 10), rank: rank, tie: ties, alias: alias, currentRank: own ? (own.e.rank || String(rows.indexOf(own) + 1)) : '', size: list.size };
}

/** Everything a mark qualifies for. */
function rcEvaluate(entry, book, cls) {
  var field = !entry.relay && rcIsField(entry.event);
  var res = { qualifies: [], proposed: '', current: '', notes: [] };
  if (entry.relay) {
    var rb = book.relays[entry.event]; if (!rb) return res;
    var rrec = rb.lists.School && rb.lists.School.rows[0] ? rcMark(rb.lists.School.rows[0].markText, false) : null;
    if (rrec && entry.mark < rrec * 0.93) { res.qualifies.push('CHECK ENTRY'); res.notes.push('Relay time looks impossible next to the school record (' + rb.lists.School.rows[0].markText + ').'); return res; }
    if (entry.extraLegs) res.notes.push('More than 4 names under this relay — check who ran.');
    var pr = rcPlace(rb.lists.School, entry, false, false);
    if (pr && pr.qualifies) {
      res.qualifies.push((pr.rank === 1 ? (pr.tie ? 'Ties School Record' : 'SCHOOL RECORD') + ' + ' : '') + 'Relay Top 10 (#' + pr.rank + ')');
      res.proposed = '#' + pr.rank;
    }
    return res;
  }
  var tb = book.top10[entry.event]; if (!tb) return res;
  var rec = tb.lists.School && tb.lists.School.rows[0] ? rcMark(tb.lists.School.rows[0].markText, field) : null;
  if (rec && (field ? entry.mark > rec * 1.12 : entry.mark < rec * 0.9)) {
    res.qualifies.push('CHECK ENTRY'); res.notes.push('This mark looks impossible next to the school record (' + tb.lists.School.rows[0].markText + ') — probably a typo in the results tab.');
    return res;
  }
  var p = rcPlace(tb.lists.School, entry, field, true);
  if (p && p.alias) res.notes.push('Matched to "' + p.alias + '" on the list — same athlete?');
  if (p && p.qualifies) {
    res.qualifies.push((p.rank === 1 ? (p.tie ? 'Ties School Record' : 'SCHOOL RECORD') + ' + ' : '') + 'Top 10 (#' + p.rank + ')');
    res.proposed = 'Top 10 #' + p.rank; res.current = p.currentRank ? 'Top 10 #' + p.currentRank : '';
  }
  if (cls) {
    var cb = book.classes[entry.event];
    var cp = cb ? rcPlace(cb.lists[cls], entry, field, true) : null;
    if (cp && cp.qualifies) {
      res.qualifies.push(cls + ' Top 10 (#' + cp.rank + (cp.rank === 1 ? (cp.tie ? ', ties class record' : ', CLASS RECORD') : '') + ')');
      res.proposed += (res.proposed ? ' · ' : '') + cls + ' #' + cp.rank;
      if (cp.currentRank) res.current += (res.current ? ' · ' : '') + cls + ' #' + cp.currentRank;
    }
  } else if (res.qualifies.length) {
    res.notes.push('Class unknown — type Fr/So/Jr/Sr in the Class column (or add to Classes tab) to check the class list.');
  }
  if (!field && /^\d+\.\d$/.test(entry.markText) && Number(entry.event.split(' ')[0]) <= 400) res.notes.push('One-decimal time: hand-timed? Check before approving.');
  return res;
}

/** New ordered rows for a list after adding a mark (individual lists drop the athlete's old entry). */
function rcInsert(list, entry, field, perPerformer) {
  var rows = list.rows.slice();
  if (perPerformer) rows = rows.filter(function (e) { return !rcSamePerson(e.name, entry.name) || rcBetter(rcMark(e.markText, field), entry.mark, field); });
  var add = { date: rcFmtDate(entry.date), name: entry.name, markText: entry.markText, meet: entry.meet, loc: entry.loc, isNew: true };
  var i = 0; while (i < rows.length && !rcBetter(entry.mark, rcMark(rows[i].markText, field), field)) i++;
  rows.splice(i, 0, add);
  rows = rows.slice(0, list.size);
  var out = [], prevV = null, prevRank = 0;
  rows.forEach(function (e, k) {
    var v = rcMark(e.markText, field);
    var rank = prevV != null && Math.abs(v - prevV) < 1e-9 ? prevRank : k + 1;
    prevV = v; prevRank = rank;
    out.push({ rank: rank, date: e.date, name: e.name, markText: e.markText, meet: e.meet, loc: e.loc, isNew: !!e.isNew });
  });
  return out;
}

if (typeof module !== 'undefined') module.exports = { rcEvent: rcEvent, rcMark: rcMark, rcMarkText: rcMarkText, rcParseTab: rcParseTab, rcParseLists: rcParseLists, rcParseSchool: rcParseSchool, rcGradYears: rcGradYears, rcClassFor: rcClassFor, rcEvaluate: rcEvaluate, rcInsert: rcInsert, rcPlace: rcPlace, rcIsField: rcIsField, RC: RC };

/* ------------------------------------------------------------------ */
/* Google Sheets side                                                   */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('UC Records')
    .addItem('Check new results now', 'rcRun')
    .addItem('Turn on automatic checking (every 10 min)', 'rcInstall')
    .addToUi();
}

/** One-time setup: dropdowns, Classes tab, and the 10-minute trigger. */
function rcInstall() {
  var ss = SpreadsheetApp.getActive();
  rcReviewSheet_(ss); rcClassSheet_(ss); rcLogSheet_(ss);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'rcRun') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rcRun').timeBased().everyMinutes(10).create();
  return 'Automatic checking is on.';
}

/** Check for new marks, then apply any approved rows. */
function rcRun() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 'busy';
  try { var a = rcCheck(); var b = rcApply(); Logger.log(a + '\n' + b); return a + '\n' + b; }
  finally { lock.releaseLock(); }
}

function rcReviewSheet_(ss) {
  var sh = ss.getSheetByName(RC.reviewTab);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Pending', 'Approved', 'Rejected'], true).setAllowInvalid(false).build();
  sh.getRange(3, 1, Math.max(sh.getMaxRows() - 2, 1), 1).setDataValidation(rule);
  return sh;
}
function rcLogSheet_(ss) {
  var sh = ss.getSheetByName(RC.logTab);
  if (!sh) { sh = ss.insertSheet(RC.logTab); sh.appendRow(['Candidate Key', 'Source Tab', 'Seen At', 'Details']); sh.hideSheet(); }
  return sh;
}
function rcClassSheet_(ss) {
  var sh = ss.getSheetByName(RC.classTab);
  if (!sh) {
    sh = ss.insertSheet(RC.classTab);
    sh.getRange(1, 1, 2, 3).setValues([['Name (as typed in results)', 'Grad Year', 'Name in record book (if different)'],
                                        ['Example Athlete', 2028, '']]);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold'); sh.setFrozenRows(1); sh.setColumnWidth(1, 220); sh.setColumnWidth(3, 260); sh.hideSheet();
  }
  return sh;
}

function rcBook_(gender) {
  var c = RC.records[gender], ss = SpreadsheetApp.openById(c.id);
  var byId = {}; ss.getSheets().forEach(function (s) { byId[s.getSheetId()] = s; });
  var vals = function (gid) { var s = byId[gid]; return { sheet: s, values: s.getDataRange().getDisplayValues() }; };
  var school = vals(c.school), top = vals(c.top10), cls = vals(c.classes), rel = vals(c.relays);
  return {
    sheets: { school: school.sheet, top10: top.sheet, classes: cls.sheet, relays: rel.sheet },
    school: rcParseSchool(school.values),
    top10: rcParseLists(top.values, false),
    classes: rcParseLists(cls.values, false),
    relays: rcParseLists(rel.values, true)
  };
}

function rcGradMap_(ss, books) {
  var grads = {};
  ['Boys', 'Girls'].forEach(function (g) { var m = rcGradYears(books[g].classes, RC.seasonEnd); for (var k in m) grads[k] = m[k]; });
  var aliases = {};
  var cs = ss.getSheetByName(RC.classTab);
  if (cs) cs.getDataRange().getDisplayValues().slice(1).forEach(function (r) {
    var n = rcKeyName(r[0]); if (!n || n === 'example athlete') return;
    if (/^\d{4}$/.test(rcTrim(r[1]))) grads[n] = Number(r[1]);
    if (rcTrim(r[2])) aliases[n] = rcTrim(r[2]);
  });
  return { grads: grads, aliases: aliases };
}

function rcGenderOf_(ss) {
  var map = {};
  var ns = ss.getSheetByName('Names');
  if (ns) ns.getDataRange().getDisplayValues().forEach(function (r) {
    if (rcTrim(r[0])) map[rcKeyName(r[0])] = 'Boys';
    if (rcTrim(r[2])) map[rcKeyName(r[2])] = 'Girls';
  });
  return function (n) { return map[rcKeyName(n)] || null; };
}

function rcEventLabel_(entry, book) {
  if (!entry.relay) return entry.event;
  var b = book.relays[entry.event]; return b ? b.name : entry.event.replace('R:', '') + ' Relay';
}

/** Step 1: find marks not seen before and queue the ones that make a list. */
function rcCheck() {
  var ss = SpreadsheetApp.getActive();
  var review = ss.getSheetByName(RC.reviewTab), log = rcLogSheet_(ss);
  var seen = {};
  log.getRange(1, 1, Math.max(log.getLastRow(), 1), 1).getValues().forEach(function (r) { seen[r[0]] = 1; });
  if (review.getLastRow() > 2) review.getRange(3, 16, review.getLastRow() - 2, 1).getValues().forEach(function (r) { if (r[0]) seen[r[0]] = 1; });
  var books = { Boys: rcBook_('Boys'), Girls: rcBook_('Girls') };
  var gm = rcGradMap_(ss, books), genderOf = rcGenderOf_(ss);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var newLog = [], newRows = [];
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (sh.isSheetHidden() || RC.skipTabs.indexOf(name) >= 0) return;
    var parsed = rcParseTab(sh.getDataRange().getDisplayValues(), genderOf, RC.seasonEnd);
    parsed.entries.forEach(function (e) {
      var key = [ss.getId(), name, e.gender, e.eventRaw, e.name, e.markRaw, rcFmtDate(e.date)].join('|').toLowerCase();
      if (seen[key]) return; seen[key] = 1;
      e.meet = parsed.title; e.loc = parsed.location;
      var bookName = gm.aliases[rcKeyName(e.name)]; if (bookName && !e.relay) e.name = bookName;
      var grad = gm.grads[rcKeyName(e.name)], cls = grad ? rcClassFor(grad, RC.seasonEnd) : null;
      var res = rcEvaluate(e, books[e.gender], cls);
      newLog.push([key, name, now, [e.gender, e.eventRaw, e.name, e.markRaw, parsed.title, rcFmtDate(e.date)].join('|')]);
      if (!res.qualifies.length) return;
      newRows.push(['Pending', RC.season, e.gender, rcEventLabel_(e, books[e.gender]), e.name, cls || '', e.markText, parsed.title,
                    rcFmtDate(e.date), res.qualifies.join(' • '), res.current, res.proposed, name, '', res.notes.join(' '), key]);
    });
  });
  if (newLog.length) log.getRange(log.getLastRow() + 1, 1, newLog.length, 4).setValues(newLog);
  if (newRows.length) {
    review.getRange(review.getLastRow() + 1, 1, newRows.length, 16).setValues(newRows);
    rcReviewSheet_(ss);
    if (RC.email) {
      var body = newRows.map(function (r) { return '• ' + r[2] + ' ' + r[3] + ': ' + r[4] + ' ' + r[6] + ' (' + r[7] + ') → ' + r[9]; }).join('\n');
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'UC Records: ' + newRows.length + ' mark(s) to review',
        body + '\n\nApprove or reject them in the Records Review tab:\n' + ss.getUrl() + '#gid=' + review.getSheetId());
    }
  }
  return 'Checked ' + newLog.length + ' new marks; ' + newRows.length + ' sent to Records Review.';
}

/** Step 2: write Approved rows into the record books. */
function rcApply() {
  var ss = SpreadsheetApp.getActive(), review = ss.getSheetByName(RC.reviewTab);
  if (review.getLastRow() < 3) return 'Nothing to apply.';
  var rows = review.getRange(3, 1, review.getLastRow() - 2, 16).getDisplayValues();
  var done = 0, books = {};
  rows.forEach(function (r, i) {
    var status = rcTrim(r[0]), processed = rcTrim(r[13]);
    if (processed) return;
    var out = review.getRange(i + 3, 14);
    if (status === 'Rejected') { out.setValue('Not added (rejected)'); return; }
    if (status !== 'Approved') return;
    try {
      var gender = r[2];
      books[gender] = books[gender] || rcBook_(gender);
      out.setValue(rcApplyOne_(ss, books[gender], r));
      books[gender] = rcBook_(gender);                 // re-read after writing
      done++;
    } catch (err) { out.setValue('Error: ' + err.message); }
  });
  return 'Applied ' + done + ' approved row(s).';
}

function rcApplyOne_(ss, book, r) {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d h:mm a');
  var relayKey = rcRelayKey(r[3]);
  var entry = { gender: r[2], name: rcTrim(r[4]), relay: !!relayKey, event: relayKey || rcTrim(r[3]), markText: rcTrim(r[6]),
                meet: rcTrim(r[7]), date: rcDate(r[8]) };
  var src = ss.getSheetByName(r[12]); entry.loc = src ? rcTrim(src.getRange('A2').getDisplayValue()) : '';
  var field = !entry.relay && rcIsField(entry.event);
  entry.mark = rcMark(entry.markText, field);
  if (entry.mark == null) return 'Error: cannot read the mark "' + entry.markText + '"';
  var did = [];

  if (entry.relay) {
    var rb = book.relays[entry.event];
    if (!rb) return 'Error: no relay list for ' + r[3];
    var pr = rcPlace(rb.lists.School, entry, false, false);
    if (!pr || !pr.qualifies) return 'Skipped ' + stamp + ': no longer makes the list';
    rcWriteRelay_(book.sheets.relays, rb.lists.School, entry);
    did.push('Relay Top 10 #' + pr.rank);
    var sr = book.school.relays[entry.event];
    if (sr && pr.rank === 1 && rcBetter(entry.mark, rcMark(sr.mark, false), false)) {
      var legs = entry.name.split('/');
      book.sheets.school.getRange(sr.row, 2, 4, 1).setValues([[entry.markText], [legs.slice(0, 2).join(', ') + ','], [legs.slice(2).join(', ')], [String(entry.date.getFullYear())]]);
      did.push('SCHOOL RECORD');
    }
    return 'Added ' + stamp + ': ' + did.join(', ');
  }

  var tb = book.top10[entry.event];
  if (!tb) return 'Error: no top-10 list for ' + entry.event;
  var p = rcPlace(tb.lists.School, entry, field, true);
  if (p && p.qualifies) { rcWriteList_(book.sheets.top10, tb.lists.School, rcInsert(tb.lists.School, entry, field, true)); did.push('Top 10 #' + p.rank); }
  var cls = rcClassFromText(r[5]);
  if (cls && book.classes[entry.event]) {
    var cl = book.classes[entry.event].lists[cls], cp = rcPlace(cl, entry, field, true);
    if (cp && cp.qualifies) { rcWriteList_(book.sheets.classes, cl, rcInsert(cl, entry, field, true)); did.push(cls + ' #' + cp.rank); }
  }
  var sc = book.school.individual[entry.event];
  if (sc) ['School', cls].forEach(function (col) {
    if (!col || !sc.cols[col]) return;
    var cur = rcMark(sc.cols[col].mark, field);
    if (cur == null || rcBetter(entry.mark, cur, field)) {
      book.sheets.school.getRange(sc.row, sc.cols[col].col, 3, 1).setValues([[entry.markText], [entry.name], [String(entry.date.getFullYear())]]);
      did.push(col === 'School' ? 'SCHOOL RECORD' : cls + ' record');
    }
  });
  if (!did.length) return 'Skipped ' + stamp + ': no longer makes any list' + (cls ? '' : ' (add a class to check class lists)');
  return 'Added ' + stamp + ': ' + did.join(', ');
}

/** Rewrite an individual list block (columns B-G) in place; col A labels stay. */
function rcWriteList_(sheet, list, rows) {
  var out = [];
  for (var k = 0; k < list.size; k++) {
    var e = rows[k];
    out.push(e ? [e.rank, e.date, e.name, e.markText, e.meet, e.loc] : [k + 1, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);
  }
  sheet.getRange(list.first, 2, list.size, 6).setValues(out);
}

/** Relay lists keep their history below the top 10, so add a row at the end of the block and re-sort. */
function rcWriteRelay_(sheet, list, entry) {
  var last = list.first + list.size - 1;
  sheet.insertRowAfter(last);
  sheet.getRange(last, 1, 1, 7).copyTo(sheet.getRange(last + 1, 1, 1, 7), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  var vals = sheet.getRange(list.first, 2, list.size, 6).getDisplayValues();
  var usesRank = rcTrim(vals[0][0]) !== '';
  var rows = vals.map(function (v) { return { date: v[1], markText: v[2], names: v[3], meet: v[4], loc: v[5] }; })
                 .filter(function (x) { return x.markText && x.markText !== 'N/A'; });
  var add = { date: rcFmtDate(entry.date), markText: entry.markText, names: entry.name, meet: entry.meet, loc: entry.loc };
  var i = 0; while (i < rows.length && !rcBetter(entry.mark, rcMark(rows[i].markText, false), false)) i++;
  rows.splice(i, 0, add);
  var out = [], prevV = null, prevRank = 0;
  rows.forEach(function (e, k) {
    var v = rcMark(e.markText, false), rank = prevV != null && Math.abs(v - prevV) < 1e-9 ? prevRank : k + 1;
    prevV = v; prevRank = rank;
    out.push([usesRank && rank <= 10 ? rank : '', e.date, e.markText, e.names, e.meet, e.loc]);
  });
  while (out.length < list.size + 1) out.push(['', '', '', '', '', '']);
  sheet.getRange(list.first, 2, out.length, 6).setValues(out);
}

/** Test on COPIES of the record books (never the real ones): approves three made-up marks and reports what changed. */
function rcSelfTest() {
  RC.records.Boys.id = '1GB8jd-I5cobamGx8LbIXZcu6PGTIvarC3TBKgGuuIBw';
  RC.records.Girls.id = '1eM2MkeIhqFBosgxpZsuo330wgDUcoP4EeD2cJQ10mnA';
  var ss = SpreadsheetApp.getActive(), out = [];
  var tests = [
    ['Approved', RC.season, 'Boys', '55 Meter Dash', 'Test Sprinter', 'Jr', '6.48', 'Self-Test Meet', '01/10/2027', '', '', '', 'Schedule'],
    ['Approved', RC.season, 'Boys', 'High Jump', 'Test Jumper', 'Fr', "6' 07.00\"", 'Self-Test Meet', '01/10/2027', '', '', '', 'Schedule'],
    ['Approved', RC.season, 'Girls', '4 x 400 Meter Relay', 'Test One/Test Two/Test Three/Test Four', '', '3:39.99', 'Self-Test Meet', '01/10/2027', '', '', '', 'Schedule']
  ];
  tests.forEach(function (t) { out.push(t[2] + ' ' + t[3] + ' ' + t[6] + ' → ' + rcApplyOne_(ss, rcBook_(t[2]), t)); });
  var b = rcBook_('Boys'), g = rcBook_('Girls');
  var show = function (l) { return l.rows.slice(0, 4).map(function (e) { return (e.rank || '-') + ' ' + e.name + ' ' + e.markText + ' ' + e.date; }).join(' | '); };
  out.push('Boys 55 top10: ' + show(b.top10['55 Meter Dash'].lists.School));
  out.push('Boys 55 Junior: ' + show(b.classes['55 Meter Dash'].lists.Junior));
  out.push('Boys HJ top10: ' + show(b.top10['High Jump'].lists.School));
  out.push('Boys HJ school grid: ' + JSON.stringify(b.school.individual['High Jump'].cols.School) + ' Fr ' + JSON.stringify(b.school.individual['High Jump'].cols.Freshman));
  out.push('Girls 4x400: ' + show(g.relays['R:4x400'].lists.School) + ' (rows now ' + g.relays['R:4x400'].lists.School.size + ')');
  out.push('Girls 4x400 grid: ' + JSON.stringify(g.school.relays['R:4x400']));
  Logger.log(out.join('\n'));
  return out.join('\n');
}
