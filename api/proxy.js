// api/proxy.js — CORS bridge for the Gifted Movie API v2, as a Vercel serverless function.
//
// Vercel auto-deploys any file under /api as a serverless endpoint, so once this file
// sits at api/proxy.js in your project, it's reachable at:
//   https://your-app.vercel.app/api/proxy
//
// The browser calls THIS endpoint (same origin as your page — no CORS issue). This
// function then calls movieapi.gifted.co.ke server-side (CORS doesn't apply to
// server-to-server requests), attaches the Bearer key here so it never has to live in
// your front-end JS, and returns the JSON back with permissive CORS headers.
//
// Usage from the browser (see index.html changes):
//   /api/proxy?path=/homepage
//   /api/proxy?path=/search/Black%20Panther&page=1
//   /api/proxy?path=/sources/5099284245269335848&season=1&episode=1
//   /api/proxy?path=/captions/5099284245269335848/6511282988071157728&format=MP4

const REMOTE_BASE = 'https://movieapi.gifted.co.ke/api/v2';
const API_KEY = 'gifted_movieapi_789fbud2389889dg8962e098g23d6';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const { path, ...rest } = req.query || {};
  if (!path) {
    res.status(400).json({ error: 'Missing "path" query parameter, e.g. ?path=/homepage' });
    return;
  }

  const cleanPath = '/' + String(path).replace(/^\/+/, '');
  const qs = Object.entries(rest)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] : v)}`)
    .join('&');
  const url = `${REMOTE_BASE}${cleanPath}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', details: String(err) });
  }
};
