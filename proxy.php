<?php
/**
 * proxy.php — CORS bridge for the Gifted Movie API v2
 * -----------------------------------------------------
 * The browser calls THIS file (same origin as your page, so no CORS issue).
 * This file then calls movieapi.gifted.co.ke server-side (CORS doesn't apply
 * to server-to-server requests) and returns the JSON back to the browser
 * with permissive Access-Control-Allow-Origin headers, plus adds the Bearer
 * API key on this end so it never has to live in your front-end JS.
 *
 * Usage from the browser (see index.html changes):
 *   /proxy.php?path=/homepage
 *   /proxy.php?path=/search/Black%20Panther&page=1
 *   /proxy.php?path=/sources/5099284245269335848&season=1&episode=1
 *   /proxy.php?path=/captions/5099284245269335848/6511282988071157728&format=MP4
 *
 * i.e. everything after "?path=" is the endpoint path (starting with /),
 * and any other query params are forwarded straight through to the API.
 */

// ---------------- CORS headers ----------------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

// Preflight requests get a 204 and stop here.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------- Configuration ----------------
// Move this to an environment variable or a file outside the web root if
// this ever goes to production — it's fine here for getting you unblocked.
const REMOTE_BASE = 'https://movieapi.gifted.co.ke/api/v2';
const API_KEY     = 'gifted_movieapi_789fbud2389889dg8962e098g23d6';

// ---------------- Build the upstream URL ----------------
if (!isset($_GET['path']) || $_GET['path'] === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing "path" query parameter, e.g. ?path=/homepage']);
    exit;
}

$path = '/' . ltrim($_GET['path'], '/');

// Forward every other query param straight through (page, season, episode, format, ...)
$query = $_GET;
unset($query['path']);
$qs = http_build_query($query);

$url = REMOTE_BASE . $path . ($qs !== '' ? '?' . $qs : '');

// ---------------- Forward the request ----------------
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . API_KEY,
        'Accept: application/json',
    ],
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true,
]);

$body        = curl_exec($ch);
$httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curlErr     = curl_error($ch);
curl_close($ch);

// ---------------- Respond ----------------
if ($body === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Upstream request failed', 'details' => $curlErr]);
    exit;
}

http_response_code($httpCode ?: 200);
header('Content-Type: ' . ($contentType ?: 'application/json'));
echo $body;
