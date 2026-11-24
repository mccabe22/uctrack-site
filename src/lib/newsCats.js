// Categories shown as filter buttons on the News pages (only those with stories).
const ORDER = ['cross-country', 'winter-track-and-field', 'spring-track-and-field', 'results', 'awards', 'grammar-school-meet'];
const rank = (slug) => (ORDER.includes(slug) ? ORDER.indexOf(slug) : 99);
export function filterCats(posts) {
  const all = new Map(posts.flatMap((p) => p.categories).map((c) => [c.slug, c]));
  all.delete('all-posts');
  all.delete('uncategorized');
  return [...all.values()].sort((a, b) => rank(a.slug) - rank(b.slug));
}
