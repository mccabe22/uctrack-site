(function () {
  'use strict';

  const config = window.UCMeetBar || {};
  const grid = document.getElementById('uc-meet-grid');
  if (!grid || !config.spreadsheetId) return;

  const CACHE_KEY = 'ucMeetBar:v1:' + config.spreadsheetId + ':' + (config.sheetName || 'Schedule');
  const CACHE_TTL = Number(config.cacheTtl || 600000);
  const FALLBACK_MS = Number(config.fallbackMs || 1800);

  function reveal() {
    grid.style.visibility = 'visible';
  }

  const fallbackTimer = window.setTimeout(reveal, FALLBACK_MS);

  function nyToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const p = {};
    parts.forEach(part => {
      if (part.type !== 'literal') p[part.type] = parseInt(part.value, 10);
    });
    return new Date(p.year, p.month - 1, p.day, 12, 0, 0);
  }

  function atNoon(year, month, day) {
    return new Date(year, month, day, 12, 0, 0);
  }

  function parseMeetDates(cell) {
    if (!cell) return null;
    const raw = cell.v;
    const formatted = cell.f || String(raw || '');

    if (typeof raw === 'string') {
      const gvizDate = raw.match(/^Date\((\d+),(\d+),(\d+)/);
      if (gvizDate) {
        const date = atNoon(+gvizDate[1], +gvizDate[2], +gvizDate[3]);
        return { start: date, end: date };
      }
    }

    const text = formatted.replace(/\./g, '');
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (!yearMatch) return null;

    const months = {
      january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
      april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
      august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9,
      november: 10, nov: 10, december: 11, dec: 11
    };
    const pattern = /\b(January|February|March|April|May|June|July|August|September|Sept|Sep|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Oct|Nov|Dec)\s*(\d{1,2})/gi;
    const matches = Array.from(text.matchAll(pattern));
    if (!matches.length) return null;

    const year = +yearMatch[1];
    const first = matches[0];
    const last = matches[matches.length - 1];
    return {
      start: atNoon(year, months[first[1].toLowerCase()], +first[2]),
      end: atNoon(year, months[last[1].toLowerCase()], +last[2])
    };
  }

  function shortDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric'
    }).format(date);
  }

  function meetDateLabel(meet) {
    if (!meet || !meet.start || !meet.end) return '';
    const start = new Date(meet.start);
    const end = new Date(meet.end);
    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) return shortDate(start);
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      const month = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', month: 'short'
      }).format(start);
      return month + ' ' + start.getDate() + '–' + end.getDate();
    }
    return shortDate(start) + '–' + shortDate(end);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
  }

  function setLink(id, href, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.href = href;
    el.removeAttribute('target');
    el.removeAttribute('rel');
    // The meet strip keeps its layout; only the short action word changes.
    const action = document.getElementById(id.replace('-link', '-action'));
    if (action && text) {
      action.textContent = /RESULTS/i.test(text) ? 'Results' : /FULL SCHEDULE/i.test(text) ? 'Details' : 'Schedule';
    } else if (text) {
      el.textContent = text;
    }
  }

  function update(lastMeet, nextMeet) {
    const scheduleUrl = config.scheduleUrl || '/scheduleresults/cross-country-scheduleresults/';

    if (nextMeet) {
      setText('uc-next-label', 'Up next');
      setText('uc-next-title', nextMeet.name);
      let details = meetDateLabel(nextMeet);
      if (nextMeet.location) details += ' • ' + nextMeet.location;
      if (nextMeet.time) details += ' • ' + nextMeet.time;
      setText('uc-next-details', details);
      setLink('uc-next-link', scheduleUrl, 'VIEW FULL SCHEDULE →');
    } else {
      setText('uc-next-label', 'Up next');
      setText('uc-next-title', 'Season Complete');
      setText('uc-next-details', config.seasonLabel || 'Cross Country');
      setLink('uc-next-link', scheduleUrl, 'VIEW FULL SCHEDULE →');
    }

    if (lastMeet) {
      setText('uc-last-label', 'Last meet');
      setText('uc-last-title', lastMeet.name);
      let details = meetDateLabel(lastMeet);
      if (lastMeet.location) details += ' • ' + lastMeet.location;
      setText('uc-last-details', details);
      setLink('uc-last-link', scheduleUrl, 'VIEW RESULTS →');
    } else {
      setText('uc-last-label', 'Last meet');
      setText('uc-last-title', 'No Results Yet');
      setText('uc-last-details', config.seasonLabel || 'Cross Country');
      setLink('uc-last-link', scheduleUrl, 'VIEW SCHEDULE →');
    }

    window.clearTimeout(fallbackTimer);
    reveal();
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !cached.savedAt || Date.now() - cached.savedAt > CACHE_TTL) return false;
      update(cached.lastMeet || null, cached.nextMeet || null);
      return true;
    } catch (e) {
      return false;
    }
  }

  function writeCache(lastMeet, nextMeet) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), lastMeet, nextMeet }));
    } catch (e) {}
  }

  window.ucMeetFeed = function (response) {
    try {
      if (!response || !response.table || !response.table.rows) {
        reveal();
        return;
      }

      const meets = response.table.rows.map(row => {
        const c = row.c || [];
        const dates = parseMeetDates(c[0]);
        if (!dates || !c[1] || !c[1].v) return null;
        return {
          start: dates.start.toISOString(),
          end: dates.end.toISOString(),
          name: c[1].f || c[1].v || '',
          location: c[2] ? (c[2].f || c[2].v || '') : '',
          time: c[3] ? (c[3].f || c[3].v || '') : ''
        };
      }).filter(Boolean).sort((a, b) => new Date(a.start) - new Date(b.start));

      const today = nyToday();
      const completed = meets.filter(meet => new Date(meet.end) < today);
      const currentOrUpcoming = meets.filter(meet => new Date(meet.end) >= today);
      const lastMeet = completed.length ? completed[completed.length - 1] : null;
      const nextMeet = currentOrUpcoming.length ? currentOrUpcoming[0] : null;

      writeCache(lastMeet, nextMeet);
      update(lastMeet, nextMeet);
    } catch (error) {
      console.error('UC Meet Automation:', error);
      reveal();
    }
  };

  if (readCache()) return;

  const feed = document.createElement('script');
  feed.src = 'https://docs.google.com/spreadsheets/d/' + config.spreadsheetId +
    '/gviz/tq?sheet=' + encodeURIComponent(config.sheetName || 'Schedule') +
    '&range=' + encodeURIComponent(config.sheetRange || 'A2:D') +
    '&headers=1&tqx=' + encodeURIComponent('out:json;responseHandler:ucMeetFeed');
  feed.async = true;
  feed.onerror = function () {
    window.clearTimeout(fallbackTimer);
    reveal();
  };
  document.head.appendChild(feed);
})();
