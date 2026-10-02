import type { VercelRequest, VercelResponse } from '@vercel/node';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzAjYIvySRYzpiAV2ppzwrYDzN41OHBy_pwTlB_t3dwMJ6fPxPUcmfzb586fcdsrXKFdQ/exec';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://hrbtc.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── GET → POST conversion ──────────────────────────────────────────────
  // Legacy code paths call `${SERVER_API_URL}?action=...&empId=...` with GET.
  // The frontend's fetchWithTimeout converts those to POST, but plain fetch()
  // calls (e.g. RealtimeSyncManager beacon-style requests) still send GET and
  // used to hit a 405 here. Convert query params into the same JSON body the
  // POST path would receive, so GAS reads `action` normally.
  let rawBody: string;
  if (req.method === 'GET') {
    rawBody = JSON.stringify(req.query ?? {});
  } else {
    // Vercel parses text/plain body as a string; double stringifying it would
    // make GAS unable to read `action` ("ต้องระบุ action"). Always forward the
    // raw body text unchanged.
    rawBody =
      req.body === undefined || req.body === null
        ? '{}'
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);
  }

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: rawBody,
    });

    const data = await response.text();

    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('GAS Proxy Error:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Proxy error'
    });
  }
}
