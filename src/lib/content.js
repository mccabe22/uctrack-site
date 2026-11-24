// Builds the final HTML for each saved page, filling in the Google-Sheets-driven blocks.
import seasons from '../data/seasons.json';
import posts from '../data/posts.json';
import { renderXcSeason, renderTrackSeason } from './seasons.js';
import { RECORD_BOOKS, renderRecordTab } from './records.js';
import { esc } from './util.js';

const pageFiles = import.meta.glob('../data/pages/*.json', { eager: true, import: 'default' });
const fallbackFiles = import.meta.glob('../data/records-fallback/*.html', { eager: true, query: '?raw', import: 'default' });

export const pages = Object.values(pageFiles);
export const pageByPath = (path) => pages.find((p) => p.path === path);

const warn = (msg) => console.warn(`\n[uctrack] WARNING: ${msg}\n`);

/** Tabs whose sheet can't be reached from the build (kept as a saved copy). */
const SNAPSHOT_TABS = new Set(['spring-track-field-boys-school-records/class-lists']);

const recordCache = new Map();
export async function recordTabHtml(slug, tab) {
  const key = `${slug}/${tab}`;
  if (recordCache.has(key)) return recordCache.get(key);
  const p = (async () => {
    const saved = fallbackFiles[`../data/records-fallback/${slug}__${tab}.html`] || '';
    if (SNAPSHOT_TABS.has(key)) return saved;
    const html = await renderRecordTab(slug, tab);
    // An empty or near-empty render means the sheet couldn't be read; keep the last good copy.
    if (!html || html.length < 200) { warn(`record book ${key} could not be read from Google Sheets; using saved copy`); return saved; }
    return html;
  })();
  recordCache.set(key, p);
  return p;
}

/** Every record-book tab (for the static JSON files the tab buttons load). */
export function allRecordTabs() {
  const out = [];
  for (const [slug, book] of Object.entries(RECORD_BOOKS)) {
    for (const tab of Object.keys(book.tabs)) out.push({ slug, tab });
  }
  out.push({ slug: 'spring-track-field-boys-school-records', tab: 'class-lists' });
  return out;
}

/** Home page "Latest News" cards (same markup as the old theme). */
export function homeNewsHtml(count = 4) {
  return posts.slice(0, count).map((p) => {
    const img = p.image?.card
      ? `<img width="${p.image.card.w}" height="${p.image.card.h}" src="${esc(p.image.card.src)}" class="attachment-uc-card size-uc-card wp-post-image" alt="${esc(p.image.alt)}" decoding="async" loading="lazy" />`
      : '<span>UC</span>';
    let excerpt = p.excerpt.replace(/<[^>]*>/g, '').replace(/&hellip;/g, '…').replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#038;|&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    excerpt = excerpt.replace(/^.{0,100}(?:AM|PM)\s+/s, '');
    const words = excerpt.split(/\s+/).filter(Boolean);
    excerpt = words.slice(0, 24).join(' ') + (words.length > 24 ? '…' : '');
    return `<article class="news-card ${esc(p.classList)}"><a class="news-card__image" href="/${p.slug}/" aria-label="${esc(p.title.replace(/<[^>]*>/g, ''))}">${img}</a><div class="news-card__body"><time>${esc(p.dateText)}</time><h3><a href="/${p.slug}/">${p.title}</a></h3><p>${esc(excerpt)}</p><a class="text-link" href="/${p.slug}/">READ STORY →</a></div></article>`;
  }).join('');
}

/** Fill the LIVE placeholders in a saved page. */
export async function renderPageHtml(page) {
  let html = page.html;
  const fill = (key, value) => { html = html.replace(`<!--LIVE:${key}-->`, () => value); };

  if (html.includes('<!--LIVE:xc-2026-->')) {
    const live = await renderXcSeason({ ...seasons.xc, current: true });
    if (!live) warn('cross country season sheet could not be read; using saved copy');
    fill('xc-2026', live || page.live['xc-2026']);
  }
  if (html.includes('<!--LIVE:winter-2026-27-->')) {
    const live = await renderTrackSeason({ ...seasons.winter, current: true });
    if (!live) warn('winter season sheet could not be read; using saved copy');
    fill('winter-2026-27', live || page.live['winter-2026-27']);
  }
  if (html.includes('<!--LIVE:records-->')) {
    const slug = page.path.replace(/\//g, '');
    const first = Object.keys(RECORD_BOOKS[slug].tabs)[0];
    fill('records', await recordTabHtml(slug, first));
  }
  if (html.includes('<!--LIVE:home-news-->')) fill('home-news', homeNewsHtml());
  return html;
}
