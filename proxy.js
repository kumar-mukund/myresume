/* Local dev helper for the Ask AI / ATS AI Review features — forwards the
   browser's chat request to NVIDIA's chat completions API and adds the CORS
   header NVIDIA itself doesn't send, so testing from file:// or localhost
   works the same way netlify/functions/chat.mjs does once deployed. Same
   request/response contract as that function — this is its local twin.

   Run: node proxy.js
   Then open master_resume_builder.html — CHAT_PROXY_URL already points at
   http://localhost:8787/chat automatically whenever the page is loaded from
   file:// or localhost, so no other configuration is needed. */

const http = require('http');

const PORT = 8787;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.url !== '/chat' || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Only POST /chat is supported' }));
    return;
  }

  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { apiKey, ...nvidiaPayload } = parsed;
    if (!apiKey) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Missing apiKey in request body' }));
      return;
    }

    // See the matching comment in netlify/functions/chat.mjs — this model
    // burns tokens on hidden reasoning unless told not to, which is slow for
    // no quality benefit on resume-advice prompts. Kept in sync with the
    // deployed function so local and live behavior match.
    if (!nvidiaPayload.chat_template_kwargs) {
      nvidiaPayload.chat_template_kwargs = { thinking: false };
    }

    try {
      const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(nvidiaPayload)
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(body);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Could not reach NVIDIA API: ' + e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Ask AI local proxy running at http://localhost:${PORT}`);
});
