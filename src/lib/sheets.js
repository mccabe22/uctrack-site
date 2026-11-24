// Reads public Google Sheets as CSV during the site build.
// Every tab is fetched once per build and shared between pages.
import Papa from 'papaparse';

const cache = new Map();
const log = (...a) => console.log('[sheets]', ...a);

async function fetchText(url, allowHtml = false) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UCTrack/2.0)' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const body = await res.text();
        // Google answers some failures with an HTML sign-in page instead of an error.
        if (body.trim() && (allowHtml || !/^\s*<!doctype html|^\s*<html/i.test(body))) return body;
        return '';
      }
      if (res.status >= 400 && res.status < 500) return '';
    } catch (err) {
      if (attempt === 3) log('fetch failed', url, String(err));
    }
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }
  return '';
}

const base = (sheet) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheet)}`;

/** Raw CSV for a tab, trying each source in order (same order the old WordPress code used). */
export async function sheetCsv(sheet, gid, sources = ['export', 'gviz']) {
  const key = `${sheet}:${gid}:${sources.join(',')}`;
  if (cache.has(key)) return cache.get(key);
  const urls = {
    export: `${base(sheet)}/export?format=csv&gid=${gid}`,
    gviz: `${base(sheet)}/gviz/tq?tqx=out:csv&headers=0&gid=${gid}`,
    gvizPlain: `${base(sheet)}/gviz/tq?tqx=out:csv&gid=${gid}`,
    pub: `${base(sheet)}/pub?gid=${gid}&single=true&output=csv`,
  };
  const promise = (async () => {
    for (const s of sources) {
      const text = await fetchText(urls[s]);
      if (text.trim()) return text;
    }
    return '';
  })();
  cache.set(key, promise);
  return promise;
}

/** Rows the way the old theme read them: split on newlines first, then parse each line. */
export async function lineRows(sheet, gid, sources) {
  const text = await sheetCsv(sheet, gid, sources);
  if (!text.trim()) return [];
  return text.split(/\r\n|\r|\n/).map((line) => {
    if (line === '') return [''];
    const parsed = Papa.parse(line, { delimiter: ',', quoteChar: '"' });
    return parsed.data[0] ?? [''];
  });
}

/** Rows parsed as real CSV (multi-line cells kept), trailing blanks removed, values trimmed. */
export async function csvRows(sheet, gid, sources) {
  const text = await sheetCsv(sheet, gid, sources);
  if (!text.trim()) return [];
  const parsed = Papa.parse(text, { delimiter: ',', quoteChar: '"', skipEmptyLines: false });
  const rows = parsed.data.map((row) => {
    const r = row.map((v) => (typeof v === 'string' ? v.trim() : v));
    while (r.length && String(r[r.length - 1]).trim() === '') r.pop();
    return r;
  });
  // fgetcsv yields nothing for the final newline
  if (rows.length && rows[rows.length - 1].length === 0 && /\n$/.test(text)) rows.pop();
  return rows;
}

/** Visible tab ids for a spreadsheet (htmlview scrape), excluding helper tabs. */
export async function discoverTabs(sheet) {
  const key = `tabs:${sheet}`;
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    const tabs = new Map();
    for (const path of ['htmlview?usp=sharing', 'edit?usp=sharing']) {
      const html = await fetchText(`${base(sheet)}/${path}`, true).catch(() => '');
      for (const m of html.matchAll(/items\.push\(\{name:\s*"((?:\\.|[^"])*)".*?gid:\s*"([0-9]+)"/gs)) {
        let name;
        try { name = JSON.parse(`"${m[1]}"`); } catch { name = m[1]; }
        name = name.trim();
        if (name) tabs.set(Number(m[2]), name);
      }
      if (tabs.size) break;
    }
    const ignored = ['schedule', 'names', 'name', 'roster', 'template', 'instructions', 'settings', 'data', 'records review'];
    for (const [gid, name] of [...tabs]) {
      if (gid === 0 || ignored.includes(name.toLowerCase().trim())) tabs.delete(gid);
    }
    return tabs;
  })();
  cache.set(key, promise);
  return promise;
}
