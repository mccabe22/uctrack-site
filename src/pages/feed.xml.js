// RSS feed of the latest 20 news stories (replaces WordPress /feed/).
import { getPosts } from '../lib/news.js';
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (s) => s.replace(/<[^>]*>/g, '');
export async function GET() {
  const posts = await getPosts();
  const site = 'https://www.uctrack.com';
  const items = posts.slice(0, 20).map((p) => `<item><title>${x(strip(p.title))}</title><link>${site}/${p.slug}/</link><guid>${site}/${p.slug}/</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${x(strip(p.excerpt).trim())}</description></item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Union Catholic Cross Country | Track + Field</title><link>${site}/</link><description>Home of Champions!</description>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
