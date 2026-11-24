// Static stand-in for the old /wp-json/uc-records/v1/tab endpoint: one JSON file per record-book tab.
import { allRecordTabs, recordTabHtml } from '../../../lib/content.js';

export function getStaticPaths() {
  return allRecordTabs().map(({ slug, tab }) => ({ params: { book: slug, tab } }));
}

export async function GET({ params }) {
  const html = await recordTabHtml(params.book, params.tab);
  return new Response(JSON.stringify({ html }), { headers: { 'Content-Type': 'application/json' } });
}
