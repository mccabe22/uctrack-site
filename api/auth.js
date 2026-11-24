// Starts "Sign in with GitHub" for the editor at /admin.
// Needs Vercel env vars GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (a GitHub OAuth App).
import crypto from 'node:crypto';

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('Editor login is not set up yet: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel.');
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirect = `https://${host}/api/callback`;
  res.setHeader('Set-Cookie', `uc_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('scope', 'repo,user');
  url.searchParams.set('state', state);
  res.redirect(302, url.toString());
}
