// Small helpers that mirror the PHP/WordPress behaviour the old theme relied on,
// so the rebuilt pages produce the same markup as the WordPress site did.

/** WordPress esc_html / esc_attr equivalent. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** PHP nl2br(esc_html(x)). */
export function cell(value) {
  return esc(value).replace(/\r\n|\r|\n/g, (m) => '<br />' + m);
}

export const trim = (v) => String(v ?? '').trim();

/** PHP similar_text() percentage. */
export function similarPercent(a, b) {
  const sim = (s1, s2) => {
    if (!s1.length || !s2.length) return 0;
    let max = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < s1.length; i++) {
      for (let j = 0; j < s2.length; j++) {
        let k = 0;
        while (i + k < s1.length && j + k < s2.length && s1[i + k] === s2[j + k]) k++;
        if (k > max) { max = k; p1 = i; p2 = j; }
      }
    }
    if (!max) return 0;
    return max + sim(s1.slice(0, p1), s2.slice(0, p2)) + sim(s1.slice(p1 + max), s2.slice(p2 + max));
  };
  const total = a.length + b.length;
  return total ? (sim(a, b) * 2 * 100) / total : 0;
}

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

/** Month index (0-11) for a full or abbreviated month name, or -1. */
export function monthIndex(name) {
  const n = String(name).toLowerCase().replace(/\.$/, '');
  if (n === 'sept') return 8;
  return MONTHS.findIndex((m) => m === n || (n.length >= 3 && m.startsWith(n)));
}

export const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Conservative strtotime() stand-in for full dates such as
 * "Friday, September 4, 2026" or "Sep 4 2026". Returns YYYY-MM-DD or ''.
 */
export function parseFullDate(value) {
  const v = String(value).trim().replace(/\s+/g, ' ');
  const m = v.match(/^(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+)?([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (!m) return '';
  const mi = monthIndex(m[1]);
  const d = Number(m[2]);
  if (mi < 0 || d < 1 || d > 31) return '';
  return ymd(Number(m[3]), mi, d);
}

/** Strip HTML tags (wp_strip_all_tags). */
export const stripTags = (v) => String(v ?? '').replace(/<[^>]*>/g, '');
