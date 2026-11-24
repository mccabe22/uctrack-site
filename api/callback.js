// Finishes GitHub sign-in and hands the token back to the editor window (Decap/Sveltia protocol).
export default async function handler(req, res) {
  const { code, state } = req.query;
  const cookie = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith('uc_oauth_state='));
  const expected = cookie ? cookie.split('=')[1] : '';
  let status = 'error';
  let content = { error: 'Sign-in failed. Close this window and try again.' };
  if (code && state && state === expected) {
    try {
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
      });
      const data = await r.json();
      if (data.access_token) { status = 'success'; content = { token: data.access_token, provider: 'github' }; }
      else content = { error: data.error_description || 'GitHub did not return a token.' };
    } catch (e) {
      content = { error: 'Could not reach GitHub.' };
    }
  }
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Set-Cookie', 'uc_oauth_state=; Path=/api; Max-Age=0');
  res.send(`<!doctype html><html><body><p>Signing in…</p><script>
(function () {
  var msg = ${JSON.stringify(message)};
  function receive(e) {
    if (e.origin !== window.location.origin) return;
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener('message', receive);
    setTimeout(function () { window.close(); }, 300);
  }
  window.addEventListener('message', receive);
  if (window.opener) window.opener.postMessage('authorizing:github', window.location.origin);
  else document.body.textContent = 'Signed in. You can close this window.';
})();
</script></body></html>`);
}
