
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const SECRET = process.env.GOOGLE_SHEETS_SECRET;

    if (!WEBHOOK_URL || !SECRET) {
      console.error('Google Sheets environment variables missing');
      return res.status(500).json({
        ok: false,
        error: 'Google Sheets configuration missing'
      });
    }

    let body = req.body;

    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const phone = String(body.phone || '').replace(/\D/g, '');

    if (!/^91[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid phone number'
      });
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify({
        secret: SECRET,
        phone: phone,
        event_source_url: String(body.event_source_url || '')
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Google Sheets error:', response.status, responseText);
      return res.status(502).json({
        ok: false,
        error: 'Google Sheets request failed'
      });
    }

    console.log('Lead sent to Google Sheets:', responseText);

    return res.status(200).json({
      ok: true,
      message: 'Lead received'
    });

  } catch (error) {
    console.error('Lead API error:', error);

    return res.status(500).json({
      ok: false,
      error: 'Lead processing failed'
    });
  }
};
