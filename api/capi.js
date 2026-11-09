// Vercel Serverless Function: relays browser events to Meta Conversions API.
// Env vars (set in Vercel dashboard): META_PIXEL_ID, META_ACCESS_TOKEN, optional META_TEST_EVENT_CODE

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'LandingPageView',
  'ImageSwipe',
  'CouponCopy',
  'AmazonClick',
]);
const CUSTOM_EVENTS = new Set(['LandingPageView', 'ImageSwipe', 'CouponCopy', 'AmazonClick']);
const crypto = require('crypto');
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const clean = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function dec(v) { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } }
const GRAPH_VERSION = 'v21.0';

function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  try {
    return JSON.parse(Buffer.isBuffer(b) ? b.toString('utf8') : b);
  } catch (e) {
    return {};
  }
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || undefined;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_ACCESS_TOKEN;
  if (!PIXEL_ID || !TOKEN) {
    return res.status(500).json({ ok: false, error: 'META_PIXEL_ID / META_ACCESS_TOKEN not set' });
  }

  const b = parseBody(req);
  const eventName = String(b.event_name || '');
  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({ ok: false, error: 'Unknown event_name' });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  let eventTime = Number(b.event_time) || nowSec;
  if (eventTime > nowSec || nowSec - eventTime > 6 * 24 * 3600) eventTime = nowSec;

  const userData = {
    client_ip_address: clientIp(req),
    client_user_agent: req.headers['user-agent'] || undefined,
  };
  if (b.external_id) userData.external_id = sha256(String(b.external_id).slice(0, 100).toLowerCase());
  // Geo from Vercel edge headers (hashed, as Meta requires)
  const city = clean(dec(req.headers['x-vercel-ip-city']));
  const region = clean(dec(req.headers['x-vercel-ip-country-region']));
  const country = clean(req.headers['x-vercel-ip-country']);
  if (city) userData.ct = sha256(city);
  if (region) userData.st = sha256(region);
  if (country) userData.country = sha256(country);
  if (b.fbp) userData.fbp = String(b.fbp).slice(0, 200);
  if (b.fbc) userData.fbc = String(b.fbc).slice(0, 300);

  const event = {
    event_name: eventName,
    event_time: eventTime,
    event_id: b.event_id ? String(b.event_id).slice(0, 100) : undefined,
    event_source_url: b.event_source_url ? String(b.event_source_url).slice(0, 2000) : undefined,
    action_source: 'website',
    user_data: userData,
  };
  if (b.custom_data && typeof b.custom_data === 'object' && Object.keys(b.custom_data).length) {
    event.custom_data = b.custom_data;
  }

  const payload = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Meta CAPI error', r.status, JSON.stringify(data));
      return res.status(502).json({ ok: false, meta: data });
    }
    return res.status(200).json({ ok: true, events_received: data.events_received, custom: CUSTOM_EVENTS.has(eventName) });
  } catch (err) {
    console.error('Meta CAPI request failed', err);
    return res.status(500).json({ ok: false, error: 'Request failed' });
  }
};
