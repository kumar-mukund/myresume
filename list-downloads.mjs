/* Reads back every record log-download.mjs has written, newest first.
   Gated by a password (ADMIN_PASSWORD, a Netlify environment variable —
   never hardcoded here) so the download list isn't public. Consumed by
   admin.html. */
import { getStore } from '@netlify/blobs';

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
  const password = url.searchParams.get('password') || '';
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  try {
    const store = getStore('resume-downloads');
    const { blobs } = await store.list();
    const records = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
    records.sort((a, b) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')));
    return new Response(JSON.stringify(records), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Could not read storage: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
};

export const config = {
  path: '/list-downloads'
};
