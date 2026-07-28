// api/proxy.js — CORS bridge for the Gifted Movie API v2.
//
// One flat file, plain name — no brackets, no subfolder, no vercel.json rewrite
// needed. The browser calls this with the target endpoint packed into a "path"
// query param, e.g.:
//   /api/proxy?path=/homepage
//   /api/proxy?path=/search/avatar&page=1
//   /api/proxy?path=/sources/123&season=1&episode=1
//   /api/proxy?path=/captions/123/456&format=MP4
//
// Everything in the query string EXCEPT "path" is forwarded to the upstream API
// as its own query param (page, season, episode, format, ...). This file just
// reads req.query directly — Vercel decodes the query string exactly once, which
// matches the single encodeURIComponent() the front-end applies, so nothing gets
// double-encoded or corrupted.

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
        // Some APIs block requests that don't look like they came from a real
        // browser (no User-Agent at all is a classic bot signal) — Node's fetch
        // sends no User-Agent by default, so we add one just in case that's
        // what's tripping anti-bot protection on the upstream host.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (err) {
    // FIX: String(err) on a fetch failure just prints "TypeError: fetch failed"
    // and hides the actual reason (DNS failure, connection refused, connection
    // reset, TLS error, etc.), which lives on err.cause. Surface it so we can
    // actually diagnose what's happening between Vercel and the upstream host.
    res.status(502).json({
      error: 'Upstream request failed',
      details: String(err),
      cause: err && err.cause ? String(err.cause) : null,
      code: err && err.cause && err.cause.code ? err.cause.code : null,
    });
  }
};
