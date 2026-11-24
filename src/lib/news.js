// News stories from the editor's Markdown files, shaped for the page templates.
import { getCollection } from 'astro:content';
import legacy from '../data/news-legacy.json';
import categories from '../data/categories.json';
import { esc } from './util.js';

const slugFor = (name) => categories.find((c) => c.name === name)?.slug
  || name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const tz = 'America/New_York';
const dateText = (d) => d.toLocaleDateString('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' });
function isoWithOffset(d) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' }).formatToParts(d).map((p) => [p.type, p.value]));
  const off = (parts.timeZoneName || 'GMT-05:00').replace('GMT', '') || '+00:00';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${off}`;
}

function autoExcerpt(body) {
  const text = String(body || '')
    .replace(/<[^>]*>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`]+/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').filter(Boolean);
  return `<p>${esc(words.slice(0, 24).join(' '))}${words.length > 24 ? ' [&hellip;]' : ''}</p>\n`;
}

let cache;
export async function getPosts() {
  if (cache) return cache;
  const entries = (await getCollection('news')).filter((e) => !e.data.draft);
  cache = entries.map((e) => {
    const old = legacy[e.id];
    const cats = (e.data.categories?.length ? e.data.categories : ['All Posts']).map((name) => ({ name, slug: slugFor(name) }));
    if (!cats.some((c) => c.slug === 'all-posts')) cats.unshift({ name: 'All Posts', slug: 'all-posts' });
    let image = null;
    if (e.data.image) {
      image = old?.image && old.image.src === e.data.image
        ? { ...old.image, alt: e.data.image_alt ?? old.image.alt, card: old.image.card || { src: old.image.src, w: old.image.w, h: old.image.h } }
        : { src: e.data.image, alt: e.data.image_alt || '', w: null, h: null, srcset: '', card: { src: e.data.image, w: null, h: null } };
    }
    const classList = old?.classList || ['post', 'type-post', 'status-publish', 'format-standard', image ? 'has-post-thumbnail' : '', 'hentry', ...cats.map((c) => `category-${c.slug}`)].filter(Boolean).join(' ');
    return {
      entry: e, id: old?.id || 0, slug: e.id, title: esc(e.data.title),
      date: isoWithOffset(e.data.date), dateText: dateText(e.data.date), author: e.data.author,
      categories: cats, classList, image,
      excerpt: old?.excerpt || autoExcerpt(e.body),
    };
  }).sort((a, b) => b.entry.data.date - a.entry.data.date);
  return cache;
}
