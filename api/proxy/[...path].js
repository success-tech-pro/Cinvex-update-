// api/proxy/[...path].js — CORS bridge for the Gifted Movie API v2 (catch-all route).
//
// This mirrors the upstream API's URL structure exactly:
//   /api/proxy/homepage                          -> /homepage
//   /api/proxy/trending                           -> /trending
//   /api/proxy/search/avatar?page=1               -> /search/avatar?page=1
//   /api/proxy/info/123                           -> /info/123
//   /api/proxy/sources/123?season=1&episode=1     -> /sources/123?season=1&episode=1
//   /api/proxy/captions/123/456?format=MP4        -> /captions/123/456?format=MP4
//
// No manual re-encoding of the path is needed — Vercel's [...path] catch-all segment
// hands us the real path pieces, and query params pass straight through.

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

  // req.query.path is the array of URL segments matched by [...path],
  // e.g. /api/proxy/search/avatar -> ['search', 'avatar']. Everything else in
  // req.query is a real query param (page, season, episode, format, ...).
  const { path, ...rest } = req.query || {};
  const segments = Array.isArray(path) ? path : (path ? [path] : []);

  if (!segments.length) {
    res.status(400).json({ error: 'Missing endpoint path, e.g. /api/proxy/homepage' });
    return;
  }

  const qs = Object.entries(rest)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] : v)}`)
    .join('&');
  const url = `${REMOTE_BASE}/${segments.join('/')}${qs ? '?' + qs : ''}`;

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
