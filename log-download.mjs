/* Records one entry every time a visitor actually completes a download
   (PDF or PNG) — not just at sign-in. Stored in Netlify Blobs (a key-value
   store included with every Netlify site, no extra service to sign up
   for). Pairs with list-downloads.mjs, which reads this same store back
   out as JSON for the admin.html viewer. */
import { getStore } from '@netlify/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST is supported' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const record = {
    timestamp: new Date().toISOString(),
    method: String(body.method || '').slice(0, 40),
    label: String(body.label || '').slice(0, 200),
    name: String(body.name || '').slice(0, 200),
    phone: String(body.phone || '').slice(0, 40),
    email: String(body.email || '').slice(0, 200),
    howHeard: String(body.howHeard || '').slice(0, 200),
    exportType: String(body.exportType || '').slice(0, 10)
  };

  try {
    const store = getStore('resume-downloads');
    const key = record.timestamp + '-' + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, record);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Could not write to storage: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
};

export const config = {
  path: '/log-download'
};
