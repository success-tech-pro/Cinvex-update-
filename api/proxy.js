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

// FIX: this was pointed at "movieapi.gifted.co.ke" — missing "tech". The real
// Gifted Tech API (creator: "GiftedTech" in every response) lives at
// giftedtech.co.ke. The typo'd host doesn't resolve, so every single endpoint
// failed identically (all 502s from the catch block below).
const REMOTE_BASE = 'https://movieapi.giftedtech.co.ke/api/v2';
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
