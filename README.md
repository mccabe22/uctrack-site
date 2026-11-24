# uctrack.com

The Union Catholic Cross Country + Track & Field website, rebuilt as a fast static site
(Astro, hosted on Vercel). It replaced the WordPress site in November 2026.

## How content gets onto the site

| What | Where it comes from | How it updates |
|---|---|---|
| Current season schedules + results (XC 2026, Winter 2026–27) | Google Sheets | Rebuilt automatically after sheet edits (see below) |
| School record books (all 5) | Google Sheets | Same |
| Homepage "Up Next / Last Meet" bar | XC schedule sheet | Live in the visitor's browser |
| Past seasons (2004 → last season) | Saved archive in `public/archive/` | Fixed |
| Old meet result PDFs | `public/Reports/` (same paths as the old site) | Fixed |
| News stories (601) and pages | `src/data/` (exported from WordPress) | Edit the JSON, or ask for help |

## Automatic updates from Google Sheets

`google-apps-script/AutoPublish.gs` runs in Google Apps Script. It checks the sheets every
5 minutes, and once edits have stopped for 3 minutes it calls the Vercel deploy hook.
It also rebuilds nightly at 3am. Setup steps are at the top of that file.

If Google can't be reached during a build, each page keeps its last saved copy and the
build log shows a `WARNING` line, so the site never breaks.

## Starting a new season

Edit `src/data/seasons.json`: put the new sheet ID in the `xc` or `winter` entry (the
year/label too). Before switching, save the finished season as an archive file in
`public/archive/` so it stays on the site. Add the new sheet ID to `SHEETS` in the Apps Script.

## Developing

```
npm install
npm run build     # output in dist/
npm run preview
```
On machines behind a proxy, Node needs `NODE_USE_ENV_PROXY=1` to reach Google.
