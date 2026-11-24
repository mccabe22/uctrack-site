// School record books, rendered from Google Sheets at build time.
// Port of the "UC Records Live" WordPress plugin (v1.0.12) so the markup,
// classes and search behaviour stay exactly the same.
import { csvRows } from './sheets.js';
import { esc, cell, trim } from './util.js';

export const RECORD_BOOKS = {
  'cross-country-class-records': {
    title: 'Cross Country', eyebrow: 'Fall Record Book',
    sheet: '1mbIoosLcV2dlaS5n439sfQ0JEFtkyNn1L_MQWmXP_qA',
    tabs: {
      'girls-records': { label: 'Girls Records', gid: '0', mode: 'matrix', maxRows: 31 },
      'boys-records': { label: 'Boys Records', gid: '2', mode: 'matrix', maxRows: 31 },
      'girls-team-average': { label: 'Girls Team Average', gid: '6', mode: 'teamavg', maxRows: 87 },
      'boys-team-average': { label: 'Boys Team Average', gid: '7', mode: 'teamavg', maxRows: 78 },
    },
  },
  'winter-track-field-boys-school-records': {
    title: 'Winter Track & Field — Boys', eyebrow: 'Indoor Record Book',
    sheet: '1bbsb1bb727pSgLEgBJdkB7SJkFnKUaba27gbljnUuNA',
    tabs: {
      'school-records': { label: 'School Records', gid: '0', mode: 'matrix' },
      'top-10': { label: 'Top 10', gid: '1', mode: 'top10' },
      'class-lists': { label: 'Top 10 by Class', gid: '1933507034', mode: 'top10class' },
      'relay-history': { label: 'Relay History', gid: '2', mode: 'relay' },
    },
  },
  'winter-track-class-records': {
    title: 'Winter Track & Field — Girls', eyebrow: 'Indoor Record Book',
    sheet: '1JAKX8cuBBCyh7QcQV0ZuoryYDyDQNVs79JkSQ_QLh5k',
    tabs: {
      'school-records': { label: 'School Records', gid: '0', mode: 'matrix' },
      'top-10': { label: 'Top 10', gid: '1', mode: 'top10' },
      'class-lists': { label: 'Top 10 by Class', gid: '2125377032', mode: 'top10class' },
      'relay-history': { label: 'Relay History', gid: '2', mode: 'relay' },
    },
  },
  'spring-track-field-boys-school-records': {
    title: 'Spring Track & Field — Boys', eyebrow: 'Outdoor Record Book',
    sheet: '19m7JR2KRS5jrw6j55sd2kbM6mquVl6Chuc4VNvCvGFk',
    tabs: {
      'school-records': { label: 'School Records', gid: '0', mode: 'matrix' },
      'top-10': { label: 'Top 10', gid: '1463460844', mode: 'top10' },
      'class-lists': { label: 'Top 10 by Class', gid: '1494004116', mode: 'classlist' },
      'relay-history': { label: 'Relay History', gid: '1900000002', mode: 'relay' },
    },
  },
  'spring-track-field-girls-school-records': {
    title: 'Spring Track & Field — Girls', eyebrow: 'Outdoor Record Book',
    sheet: '1KxHDNfW7sArpwP5iS-YOMNBfZXh36QYTcmmRvYMJyYk',
    tabs: {
      'school-records': { label: 'School Records', gid: '0', mode: 'matrix' },
      'top-10': { label: 'Top 10', gid: '128001608', mode: 'top10' },
      'class-lists': { label: 'Top 10 by Class', gid: '2116238297', mode: 'top10class' },
      'relay-history': { label: 'Relay History', gid: '1900000001', mode: 'relay' },
    },
  },
};

const nonempty = (row) => (row || []).filter((v) => trim(v) !== '').length;
const at = (row, i) => (row && row[i] != null ? row[i] : '');
const isRelayYear = (v) => {
  v = trim(v);
  return v !== '' && /^(?:19|20)\d{2}(?:\s*(?:\/|&|,|-)\s*(?:19|20)?\d{2})*$/.test(v);
};

function relayGroup(event, records) {
  records = records.filter((r) => r.mark || (r.athleteLines && r.athleteLines.length) || r.year);
  if (!records.length) return '';
  const parts = [event];
  for (const r of records) { parts.push(r.mark || '', r.year || '', ...(r.athleteLines || [])); }
  const search = parts.join(' ').toLowerCase();
  const tied = records.length > 1 ? ' ucrl-record-card--relay-tied' : '';
  let h = `<article class="ucrl-record-card ucrl-record-card--relay${esc(tied)} ucrl-filter-item" data-search="${esc(search)}">`;
  h += `<div class="ucrl-event-name">${cell(event)}</div><div class="ucrl-record-grid ucrl-record-grid--relay">`;
  for (const r of records) {
    const lines = (r.athleteLines || []).map(trim).filter(Boolean);
    const mark = trim(r.mark); const year = trim(r.year);
    h += `<div class="ucrl-record-cell ucrl-record-cell--school ucrl-relay-record-cell"><div class="ucrl-record-label">${records.length > 1 ? 'School Record' : 'School'}</div><div class="ucrl-record-mark">${cell(mark)}</div>`;
    if (lines.length) h += `<div class="ucrl-record-athlete ucrl-record-athlete--relay">${lines.map(cell).join('<br>')}</div>`;
    if (year !== '') h += `<div class="ucrl-record-year ucrl-record-year--relay">${cell(year)}</div>`;
    h += '</div>';
  }
  return h + '</div></article>';
}

function renderMatrix(rows) {
  let headerIndex = -1;
  rows.forEach((row, i) => {
    const first = trim(at(row, 0)).toUpperCase();
    if (first === 'EVENT' || first === 'COURSE') headerIndex = i;
  });
  if (headerIndex < 0) return renderGeneric(rows);
  const header = rows[headerIndex];
  let legend = [];
  for (let i = 0; i < headerIndex; i++) {
    rows[i].forEach((raw, j) => {
      const v = trim(raw);
      if (v === '' || (j === 0 && /record/i.test(v))) return;
      if (j === 0 && nonempty(rows[i]) === 1) return;
      if (/^[*#@]/.test(v)) legend.push(v);
    });
  }
  legend = [...new Set(legend)];
  let h = '';
  if (legend.length) h += `<div class="ucrl-legend" aria-label="Record key">${legend.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;
  h += '<div class="ucrl-matrix">';
  let i = headerIndex + 1; let inRelays = false; let relaySection = '';
  const count = rows.length;
  while (i < count) {
    const perf = rows[i];
    if (nonempty(perf) === 0) { i++; continue; }
    const event = trim(at(perf, 0)); const second = trim(at(perf, 1));
    if (nonempty(perf) === 1 && /RELAYS?$/i.test(event)) {
      inRelays = true;
      if (/FIELD/i.test(event)) relaySection = 'field'; else if (/RUNNING/i.test(event)) relaySection = 'running';
      h += `<div class="ucrl-relay-section-title">${cell(event)}</div>`; i++; continue;
    }
    if (event.toUpperCase() === 'RELAY' && second.toUpperCase().includes('SCHOOL')) {
      inRelays = true;
      if (relaySection === '') { relaySection = 'running'; h += '<div class="ucrl-relay-section-title">RUNNING RELAYS</div>'; }
      i++; continue;
    }
    if (inRelays) {
      if (relaySection !== 'field' && /^(Long Jump|Triple Jump|High Jump|Pole Vault|Shot Put|Discus|Javelin|Weight Throw)\b/i.test(event)) {
        relaySection = 'field'; h += '<div class="ucrl-relay-section-title">FIELD RELAYS</div>';
      }
      if (event === '' || second === '') { i++; continue; }
      let j = i + 1;
      while (j < count && trim(at(rows[j], 0)) === '') j++;
      const records = [];
      const cols = Math.max(header.length, perf.length);
      for (let c = 1; c < cols; c++) {
        const mark = trim(at(perf, c));
        if (mark === '') continue;
        const athleteLines = []; let year = '';
        for (let k = i + 1; k < j; k++) {
          const cand = trim(at(rows[k], c));
          if (cand === '') continue;
          if (isRelayYear(cand)) year = cand; else athleteLines.push(cand);
        }
        records.push({ mark, athleteLines, year });
      }
      h += relayGroup(event, records);
      i = j; continue;
    }
    if (event === '' || nonempty(perf) < 2) { i++; continue; }
    const athlete = i + 1 < count && trim(at(rows[i + 1], 0)) === '' ? rows[i + 1] : [];
    const year = i + 2 < count && trim(at(rows[i + 2], 0)) === '' ? rows[i + 2] : [];
    const parts = [event];
    for (let c = 1; c < header.length; c++) parts.push(at(perf, c), at(athlete, c), at(year, c));
    h += `<article class="ucrl-record-card ucrl-filter-item" data-search="${esc(parts.join(' ').toLowerCase())}"><div class="ucrl-event-name">${cell(event)}</div><div class="ucrl-record-grid">`;
    for (let c = 1; c < header.length; c++) {
      const mark = at(perf, c); const name = at(athlete, c); const yr = at(year, c); const label = at(header, c);
      const school = trim(label).toUpperCase() === 'SCHOOL';
      if (trim(mark) === '' && trim(name) === '' && trim(yr) === '') { h += '<div class="ucrl-record-cell ucrl-record-cell--empty" aria-hidden="true"></div>'; continue; }
      h += `<div class="ucrl-record-cell${school ? ' ucrl-record-cell--school' : ''}"><div class="ucrl-record-label">${esc(label)}</div><div class="ucrl-record-mark">${cell(mark)}</div>`;
      if (trim(name) !== '') h += `<div class="ucrl-record-athlete">${cell(name)}</div>`;
      if (trim(yr) !== '') h += `<div class="ucrl-record-year">${cell(yr)}</div>`;
      h += '</div>';
    }
    h += '</div></article>';
    // PHP: empty arrays are falsy, so an all-blank-but-present row still counts as "set" only if non-empty array
    i += year.length ? 3 : athlete.length ? 2 : 1;
  }
  return h + '</div>';
}

function flatRelayHistory(rows, headerIndex) {
  let title = '';
  for (let i = 0; i < headerIndex; i++) {
    if (nonempty(rows[i]) === 1) { const c = trim(at(rows[i], 0)); if (c) title = c; }
  }
  if (!title) title = 'Relay History';
  let h = `<div class="ucrl-leaderboards"><div class="ucrl-list-section ucrl-filter-item" data-search="${esc(title.toLowerCase())}"><h3>${cell(title)}</h3>`;
  h += '<table class="ucrl-list-table"><thead><tr><th>Event</th><th>Rank</th><th>Year</th><th>Performance</th><th>Relay Team</th><th>Meet</th><th>Venue</th></tr></thead><tbody>';
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (nonempty(row) === 0) continue;
    const [event, rank, year, mark, athletes, meet, venue] = [0, 1, 2, 3, 4, 5, 6].map((c) => trim(at(row, c)));
    if (event === '' || mark === '') continue;
    const search = [event, rank, year, mark, athletes, meet, venue].join(' ').toLowerCase();
    h += `<tr class="ucrl-data-row" data-search="${esc(search)}"><td data-label="Event" class="ucrl-relay-event">${cell(event)}</td><td data-label="Rank"><span class="ucrl-rank">${esc(rank)}</span></td><td data-label="Year">${cell(year)}</td><td data-label="Performance" class="ucrl-performance">${cell(mark)}</td><td data-label="Relay Team" class="ucrl-relay-team">${cell(athletes)}</td><td data-label="Meet">${cell(meet)}</td><td data-label="Venue">${cell(venue)}</td></tr>`;
  }
  return h + '</tbody></table></div></div>';
}

function renderTop10(rows, mode) {
  const isRelay = mode === 'relay'; const isClass = mode === 'top10class';
  if (isRelay) {
    for (let hi = 0; hi < rows.length; hi++) {
      const r = rows[hi]; const H = (c) => trim(at(r, c)).toUpperCase();
      if (H(0) === 'EVENT' && H(1) === 'RANK' && ['YEAR', 'DATE'].includes(H(2)) && ['MARK', 'PERFORMANCE'].includes(H(3)) && H(4).includes('ATHLETE')) return flatRelayHistory(rows, hi);
    }
  }
  let section = ''; let klass = ''; let started = false;
  let h = '<div class="ucrl-leaderboards">';
  rows.forEach((row, index) => {
    const n = nonempty(row);
    if (n === 0) return;
    const first = trim(at(row, 0)); const rank = trim(at(row, 1));
    if (n === 1 && first !== '') {
      if (index === 0 && /TOP 10|LISTS|RECORDS/i.test(first)) return;
      if (started) h += '</tbody></table></div>';
      section = first; klass = ''; started = true;
      h += `<div class="ucrl-list-section ucrl-filter-item" data-search="${esc(first.toLowerCase())}"><h3>${cell(first)}</h3>`;
      h += `<table class="ucrl-list-table"><thead><tr><th>Rank</th><th>Date</th><th>${isRelay ? 'Performance' : 'Athlete'}</th><th>${isRelay ? 'Relay Team' : 'Performance'}</th><th>Meet</th><th>Location</th></tr></thead><tbody>`;
      return;
    }
    if (!started || !/^\d+$/.test(rank)) return;
    if (isClass && first !== '' && /^(Senior|Junior|Soph|Sophomore|Freshman|Frosh)$/i.test(first)) {
      klass = first; h += `<tr class="ucrl-class-divider"><td colspan="6">${esc(klass)}</td></tr>`;
    }
    let date, mark, athlete, meet, location;
    if (isRelay) [date, mark, athlete, meet, location] = [2, 3, 4, 5, 6].map((c) => at(row, c));
    else [date, athlete, mark, meet, location] = [2, 3, 4, 5, 6].map((c) => at(row, c));
    const search = [section, klass, rank, date, athlete, mark, meet, location].join(' ').toLowerCase();
    h += `<tr class="ucrl-data-row" data-search="${esc(search)}"><td data-label="Rank"><span class="ucrl-rank">${esc(rank)}</span></td><td data-label="Date">${cell(date)}</td>`;
    h += `<td data-label="${isRelay ? 'Performance' : 'Athlete'}">${cell(isRelay ? mark : athlete)}</td>`;
    h += `<td data-label="${isRelay ? 'Relay Team' : 'Performance'}" class="ucrl-performance${isRelay ? ' ucrl-relay-team' : ''}">${cell(isRelay ? athlete : mark)}</td>`;
    h += `<td data-label="Meet">${cell(meet)}</td><td data-label="Location">${cell(location)}</td></tr>`;
  });
  if (started) h += '</tbody></table></div>';
  return h + '</div>';
}

function renderTeamAvg(rows) {
  let section = ''; let started = false;
  let h = '<div class="ucrl-leaderboards">';
  const head = '<table class="ucrl-list-table"><thead><tr><th>Date</th><th>Team Average</th><th>Top Five</th><th>Meet</th></tr></thead><tbody>';
  rows.forEach((row, index) => {
    const n = nonempty(row);
    if (n === 0) return;
    const first = trim(at(row, 0)); const date = trim(at(row, 1));
    const isHeading = first !== '' && date === '' && n <= 2 && first === first.toUpperCase() && /[A-Z]/.test(first);
    if (isHeading) {
      if (started) h += '</tbody></table></div>';
      section = first; started = true;
      h += `<div class="ucrl-list-section ucrl-filter-item" data-search="${esc(first.toLowerCase())}"><h3>${cell(first)}</h3>${head}`;
      return;
    }
    if (!started && index > 0 && date !== '') {
      section = trim(at(rows[0], 0) || 'Team Average History'); started = true;
      h += `<div class="ucrl-list-section ucrl-filter-item" data-search="${esc(section.toLowerCase())}"><h3>${cell(section)}</h3>${head}`;
    }
    if (!started || date === '') return;
    const avg = at(row, 2); const athletes = at(row, 3); const meet = at(row, 4);
    const search = [section, date, avg, athletes, meet].join(' ').toLowerCase();
    h += `<tr class="ucrl-data-row" data-search="${esc(search)}"><td data-label="Date">${cell(date)}</td><td data-label="Team Average" class="ucrl-performance">${cell(avg)}</td><td data-label="Top Five">${cell(athletes)}</td><td data-label="Meet">${cell(meet)}</td></tr>`;
  });
  if (started) h += '</tbody></table></div>';
  return h + '</div>';
}

// Spring Boys "Top 10 by Class" (ported from the theme's spring-boys-class-lists-hotfix.php).
function renderClassList(rows) {
  let h = '<div class="ucrl-leaderboards">'; let open = false; let event = ''; let klass = '';
  for (const row of rows) {
    const [first, rank, date, athlete, perf, meet, loc] = [0, 1, 2, 3, 4, 5, 6].map((c) => trim(at(row, c)));
    if (![first, rank, date, athlete, perf, meet, loc].some((v) => v !== '')) continue;
    if (![rank, date, athlete, perf, meet, loc].some((v) => v !== '')) {
      if (/TOP 10 CLASS LISTS|VERIFIED CLASS RECORDS/i.test(first)) continue;
      if (open) h += '</tbody></table></div>';
      event = first; klass = '';
      h += `<div class="ucrl-list-section ucrl-filter-item" data-search="${esc(event.toLowerCase())}"><h3>${esc(event)}</h3><table class="ucrl-list-table"><thead><tr><th>Rank</th><th>Date</th><th>Athlete</th><th>Performance</th><th>Meet</th><th>Location</th></tr></thead><tbody>`;
      open = true; continue;
    }
    if (!open || !/^\d+$/.test(rank)) continue;
    if (['Senior', 'Junior', 'Sophomore', 'Freshman'].includes(first)) { klass = first; h += `<tr class="ucrl-class-divider"><td colspan="6">${esc(klass)}</td></tr>`; }
    const search = `${event} ${klass} ${rank} ${date} ${athlete} ${perf} ${meet} ${loc}`.trim().toLowerCase();
    h += `<tr class="ucrl-data-row" data-search="${esc(search)}"><td data-label="Rank"><span class="ucrl-rank">${esc(rank)}</span></td><td data-label="Date">${esc(date)}</td><td data-label="Athlete">${esc(athlete)}</td><td data-label="Performance" class="ucrl-performance">${esc(perf)}</td><td data-label="Meet">${esc(meet)}</td><td data-label="Location">${esc(loc)}</td></tr>`;
  }
  if (open) h += '</tbody></table></div>';
  return h + '</div>';
}

function renderGeneric(rows) {
  const max = Math.max(0, ...rows.map((r) => r.length));
  let h = '<div class="ucrl-generic-wrap"><table class="ucrl-list-table"><tbody>';
  for (const row of rows) {
    const n = nonempty(row);
    if (n === 0) continue;
    if (n === 1) { h += `<tr class="ucrl-generic-heading"><td colspan="${max}">${cell(at(row, 0))}</td></tr>`; continue; }
    h += `<tr class="ucrl-data-row" data-search="${esc(row.join(' ').toLowerCase())}">`;
    for (let c = 0; c < max; c++) h += `<td>${cell(at(row, c))}</td>`;
    h += '</tr>';
  }
  return h + '</tbody></table></div>';
}

/** Render one tab. Returns '' when the sheet cannot be read. */
export async function renderRecordTab(slug, tabKey) {
  const book = RECORD_BOOKS[slug]; const tab = book?.tabs[tabKey];
  if (!tab) return '';
  let rows = await csvRows(book.sheet, tab.gid, ['pub', 'gvizPlain']);
  if (!rows.length) return '';
  if (tab.maxRows && rows.length > tab.maxRows) rows = rows.slice(0, tab.maxRows);
  switch (tab.mode) {
    case 'matrix': return renderMatrix(rows);
    case 'top10': case 'top10class': case 'relay': return renderTop10(rows, tab.mode);
    case 'teamavg': return renderTeamAvg(rows);
    case 'classlist': return renderClassList(rows);
    default: return renderGeneric(rows);
  }
}
