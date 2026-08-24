/* Cloudflare Worker version of proxy.js — does the exact same job (forwards
   the browser's chat request to NVIDIA and adds the CORS header NVIDIA
   itself doesn't send), but hosted for free on Cloudflare instead of run
   locally with `node proxy.js`. Paste this whole file into the Cloudflare
   dashboard's Worker code editor and deploy — see the setup guide for steps. */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST is supported' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    let parsed;
    try {
      parsed = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const { apiKey, ...nvidiaPayload } = parsed;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing apiKey in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(nvidiaPayload)
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
};
