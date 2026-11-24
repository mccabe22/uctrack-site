// Sitemap of every page, news story and category archive.
import { getPosts } from '../lib/news.js';
import categories from '../data/categories.json';
import { pages } from '../lib/content.js';
export async function GET() {
  const posts = await getPosts();
  const site = 'https://www.uctrack.com';
  const urls = [
    ...pages.map((p) => site + p.path),
    ...posts.map((p) => `${site}/${p.slug}/`),
    ...categories.map((c) => `${site}/category/${c.slug}/`),
  ];
  const body = urls.map((u) => `<url><loc>${u}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
