/* Exchanges a GitHub OAuth redirect `code` for the signer's basic profile.
   Unlike chat.mjs (which takes a per-visitor NVIDIA key from the client —
   bring-your-own-key), GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET here are a
   single pair the SITE OWNER configures once as Netlify environment
   variables. The secret never touches the browser in either direction —
   the client only ever gets back { login, name, avatarUrl }, never the
   access token, since nothing else in this app needs further GitHub API
   calls beyond this one profile fetch. */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Only GET is supported' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code query param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'GitHub sign-in is not configured on the server (missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET env vars).' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.access_token) {
      return new Response(JSON.stringify({ error: tokenBody.error_description || 'GitHub did not return an access token.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${tokenBody.access_token}`, 'User-Agent': 'myresume-app' }
    });
    if (!profileRes.ok) {
      return new Response(JSON.stringify({ error: 'Could not fetch the GitHub profile.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    const profile = await profileRes.json();

    return new Response(JSON.stringify({
      login: profile.login || '',
      name: profile.name || '',
      avatarUrl: profile.avatar_url || ''
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'GitHub sign-in failed — please try again.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
};

export const config = {
  path: '/github-oauth'
};
