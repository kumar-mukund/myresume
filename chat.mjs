/* Netlify Function version of proxy.js / cloudflare-worker.js — same job:
   forwards the browser's chat request to NVIDIA and adds the CORS header
   NVIDIA itself doesn't send, but hosted permanently on Netlify instead of
   run locally with `node proxy.js`. Deployed once via the Netlify CLI —
   see the setup guide for the exact commands. */

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

  let parsed;
  try {
    parsed = await req.json();
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

  // This model is reasoning-capable and burns a large chunk of its max_tokens
  // budget on hidden chain-of-thought (returned separately as
  // reasoning_content) unless told not to — which routinely pushed real
  // requests (e.g. the ATS review's longer prompt) past Netlify's ~26s
  // synchronous function execution ceiling, surfacing as a 504 to the
  // browser. Disabling it cuts a ~60-90s reasoning response down to ~15-20s
  // with no loss of answer quality for this kind of resume-advice task.
  // Respects an explicit client-supplied chat_template_kwargs, if any.
  if (!nvidiaPayload.chat_template_kwargs) {
    nvidiaPayload.chat_template_kwargs = { thinking: false };
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
};

export const config = {
  path: '/chat'
};
