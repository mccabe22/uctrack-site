/**
 * UC Track — auto-publish uctrack.com when a results or records Google Sheet changes.
 *
 * One copy of this script watches every sheet the website reads. When any of them is
 * edited, it waits until editing has stopped for a few minutes, then asks Vercel to
 * rebuild the site (about a minute). It also rebuilds once every night as a safety net.
 *
 * SETUP (one time, about 3 minutes):
 *   1. Go to https://script.google.com → New project. Name it "UC Track Auto-Publish".
 *   2. Delete the sample code and paste in this whole file. Click Save.
 *   3. In Vercel: Project → Settings → Git → Deploy Hooks → name "Google Sheets",
 *      branch "main" → Create. Copy the URL it gives you.
 *   4. Back here: Project Settings (gear icon) → Script Properties → Add property
 *        Property: DEPLOY_HOOK_URL     Value: (paste the Vercel URL)
 *      Save.
 *   5. Choose the function "install" in the toolbar and click Run. Approve the
 *      permission prompt (it needs to read when your sheets were last changed).
 *
 * Any time you want the site updated right away: choose "publishNow" and click Run.
 * When a new season's sheet starts, add its ID to SHEETS below (and tell whoever
 * maintains the site so the season page points at it).
 */

const SHEETS = {
  'Cross Country 2026 schedule + results': '1nwcdNnP79GTJ2oOyuho_3OtGSTL8IjFPLcByorqJgp4',
  'Winter 2026-27 schedule + results': '1rMiu8Lxe1p2f07VtMHoc0dxZPrnbRzsTOob1kCQaNbY',
  'Spring 2027 schedule + results': '13pkOkK16goAU_pfKyi6gp-tc1REA2N44sitbYQUEVj4',
  'Cross Country records': '1mbIoosLcV2dlaS5n439sfQ0JEFtkyNn1L_MQWmXP_qA',
  'Winter boys records': '1bbsb1bb727pSgLEgBJdkB7SJkFnKUaba27gbljnUuNA',
  'Winter girls records': '1JAKX8cuBBCyh7QcQV0ZuoryYDyDQNVs79JkSQ_QLh5k',
  'Spring boys records': '19m7JR2KRS5jrw6j55sd2kbM6mquVl6Chuc4VNvCvGFk',
  'Spring girls records': '1KxHDNfW7sArpwP5iS-YOMNBfZXh36QYTcmmRvYMJyYk',
};

/** Minutes of no editing before publishing, so a burst of meet-day edits makes one rebuild. */
const QUIET_MINUTES = 3;

function install() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkForChanges').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('nightlyRebuild').timeBased().atHour(3).everyDays(1).inTimezone('America/New_York').create();
  PropertiesService.getScriptProperties().setProperty('lastPublishedEdit', String(latestEdit_()));
  Logger.log('Installed. Watching %s sheets.', Object.keys(SHEETS).length);
}

function checkForChanges() {
  const props = PropertiesService.getScriptProperties();
  const latest = latestEdit_();
  const published = Number(props.getProperty('lastPublishedEdit') || 0);
  if (latest <= published) return;
  if (Date.now() - latest < QUIET_MINUTES * 60 * 1000) return; // still editing; check again next run
  if (rebuild_('sheet edited')) props.setProperty('lastPublishedEdit', String(latest));
}

function publishNow() {
  rebuild_('manual');
  PropertiesService.getScriptProperties().setProperty('lastPublishedEdit', String(latestEdit_()));
}

function nightlyRebuild() {
  rebuild_('nightly');
}

function latestEdit_() {
  let latest = 0;
  Object.keys(SHEETS).forEach((name) => {
    try {
      latest = Math.max(latest, DriveApp.getFileById(SHEETS[name]).getLastUpdated().getTime());
    } catch (e) {
      Logger.log('Could not read "%s": %s', name, e);
    }
  });
  return latest;
}

function rebuild_(reason) {
  const hook = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK_URL');
  if (!hook) throw new Error('Add the DEPLOY_HOOK_URL script property first (see setup step 4).');
  const res = UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
  const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
  Logger.log('Rebuild (%s): %s %s', reason, res.getResponseCode(), ok ? 'started' : res.getContentText());
  return ok;
}
