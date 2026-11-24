// Health check: shows whether the last build read each Google Sheet successfully
// or fell back to a saved copy. Visit /build-info.json after a deploy.
import seasons from '../data/seasons.json';
import { renderXcSeason, renderTrackSeason } from '../lib/seasons.js';
import { RECORD_BOOKS, renderRecordTab } from '../lib/records.js';

export async function GET() {
  const status = {};
  const ok = (html) => (html && html.length > 200 ? 'live from Google Sheets' : 'SAVED COPY (sheet unreachable)');
  status['Cross Country ' + seasons.xc.year] = ok(await renderXcSeason({ ...seasons.xc, current: true }));
  status['Winter ' + seasons.winter.label] = ok(await renderTrackSeason({ ...seasons.winter, current: true }));
  for (const [slug, book] of Object.entries(RECORD_BOOKS)) {
    for (const [tab, cfg] of Object.entries(book.tabs)) {
      status[`${book.title} – ${cfg.label}`] = ok(await renderRecordTab(slug, tab));
    }
  }
  const body = { built: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET', status };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
