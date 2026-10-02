export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support common OpenSea env var naming variations
  const apiKey = process.env.OPENSEA_API_KEY ||
                 process.env.OPEN_SEA_API_KEY ||
                 process.env.OPENSEA_KEY ||
                 process.env.OPENSEA_APIKEY ||
                 process.env.VITE_OPENSEA_API_KEY;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const targetUrl = req.query?.url || body?.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Validate URL and restrict to OpenSea domains
  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname.endsWith('opensea.io')) {
      return res.status(403).json({ error: 'Only OpenSea endpoints are permitted' });
    }
  } catch (_) {
    return res.status(400).json({ error: 'Invalid target URL' });
  }

  const headers = { 'Accept': 'application/json' };
  if (apiKey) {
    headers['x-api-key'] = apiKey.trim();
  }

  const fetchOpts = {
    method: req.method === 'POST' ? 'POST' : 'GET',
    headers,
  };

  const payload = body?.payload !== undefined ? body.payload : (req.method === 'POST' && body ? body : null);
  if (req.method === 'POST' && payload !== null) {
    // Exclude proxy wrapper fields if payload was the root body
    const forwardPayload = (payload.url && payload.payload !== undefined) ? payload.payload : payload;
    headers['Content-Type'] = 'application/json';
    fetchOpts.body = typeof forwardPayload === 'string' ? forwardPayload : JSON.stringify(forwardPayload);
  }

  try {
    const response = await fetch(targetUrl, fetchOpts);
    const text = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.end(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error: ' + (err.message || String(err)) });
  }
}
