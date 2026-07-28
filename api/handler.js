// api/handler.js — CORS bridge for the Gifted Movie API v2.
//
// This file has a plain name on purpose (no [...brackets]) — Vercel's bracket-based
// catch-all routes require typing a literal "..." in a filename, which mobile
// keyboards/GitHub's web editor can silently mangle into a single "…" character,
// breaking routing with no visible error. Instead, vercel.json rewrites every
// /api/proxy/* request to this one file, and we read the ORIGINAL requested path
// straight out of req.url (Vercel rewrites preserve it) — nothing depends on any
// special filename syntax.
//
//   /api/proxy/homepage                          -> /homepage
//   /api/proxy/trending                           -> /trending
//   /api/proxy/search/avatar?page=1               -> /search/avatar?page=1
//   /api/proxy/info/123                           -> /info/123
//   /api/proxy/sources/123?season=1&episode=1     -> /sources/123?season=1&episode=1
//   /api/proxy/captions/123/456?format=MP4        -> /captions/123/456?format=MP4

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

  const fullUrl = new URL(req.url, 'http://internal');
  const prefix = '/api/proxy/';
  const pathname = fullUrl.pathname;

  if (!pathname.startsWith(prefix)) {
    res.status(400).json({ error: 'Missing endpoint path, e.g. /api/proxy/homepage', got: pathname });
    return;
  }

  const endpointPath = pathname.slice(prefix.length - 1); // keeps leading slash, e.g. "/search/avatar"
  const qs = fullUrl.search; // "?page=1" or ""
  const url = `${REMOTE_BASE}${endpointPath}${qs}`;

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
