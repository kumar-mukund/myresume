/* Tiny local proxy so the resume builder's browser page can reach NVIDIA's
   API. NVIDIA's endpoint (integrate.api.nvidia.com) does not send CORS
   headers, so a browser tab calling it directly is blocked outright — no
   header or trick on the browser side can get around that, since CORS is
   enforced by the browser, not something client-side code can opt out of.
   A server-to-server call isn't subject to CORS at all, so this small
   script (no npm install needed — only Node's built-in http/https) sits in
   between: the browser calls this on localhost, this forwards to NVIDIA,
   and adds the CORS header on the way back.

   Run:  node proxy.js
   Then leave this running and use the "Ask AI" tab in the resume builder. */

const http = require('http');
const https = require('https');

const PORT = 8787;
const NVIDIA_HOST = 'integrate.api.nvidia.com';
const NVIDIA_PATH = '/v1/chat/completions';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/chat') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. POST a chat request to /chat.' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { apiKey, ...nvidiaPayload } = parsed;
    if (!apiKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing apiKey in request body' }));
      return;
    }

    const payload = JSON.stringify(nvidiaPayload);
    const upstreamReq = https.request({
      hostname: NVIDIA_HOST,
      path: NVIDIA_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, upstreamRes => {
      let responseBody = '';
      upstreamRes.on('data', chunk => { responseBody += chunk; });
      upstreamRes.on('end', () => {
        res.writeHead(upstreamRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(responseBody);
      });
    });

    upstreamReq.on('error', err => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Could not reach NVIDIA API: ' + err.message }));
    });

    upstreamReq.write(payload);
    upstreamReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`NVIDIA API proxy running at http://localhost:${PORT}`);
  console.log('Leave this running, then use the "Ask AI" tab in the resume builder.');
});
