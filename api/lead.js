
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
      console.error('Missing Google Sheets environment variables');

      return res.status(500).json({
        ok: false,
        error: 'Google Sheets configuration missing'
      });
    }

    if (!WEBHOOK_URL.includes('/exec')) {
      return res.status(500).json({
        ok: false,
        error: 'Invalid Google Apps Script URL. Use deployed /exec URL'
      });
    }

    let body = req.body;

    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body'
      });
    }

    const phone = String(body.phone || '').replace(/\D/g, '');

    if (!/^91[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid phone number'
      });
    }

    const payload = {
      secret: SECRET,
      phone: phone,
      event_source_url: String(body.event_source_url || '')
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const responseText = await response.text();

    console.log('Google Sheets HTTP Status:', response.status);
    console.log('Google Sheets Response:', responseText);

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: 'Google Sheets HTTP request failed',
        status: response.status,
        details: responseText.slice(0, 1000)
      });
    }

    let sheetResult;

    try {
      sheetResult = JSON.parse(responseText);
    } catch (e) {
      sheetResult = null;
    }

    if (
      responseText.includes('Unauthorized') ||
      (sheetResult && sheetResult.ok === false)
    ) {
      return res.status(502).json({
        ok: false,
        error: 'Google Apps Script rejected the request',
        details: responseText.slice(0, 1000)
      });
    }

    if (!responseText.includes('Success') &&
        !(sheetResult && sheetResult.ok === true)) {
      return res.status(502).json({
        ok: false,
        error: 'Unexpected Google Sheets response',
        details: responseText.slice(0, 1000)
      });
    }

    console.log('Lead successfully sent to Google Sheets');

    return res.status(200).json({
      ok: true,
      message: 'Lead saved successfully'
    });

  } catch (error) {
    console.error('Lead API Error:', error);

    return res.status(500).json({
      ok: false,
      error: 'Lead processing failed',
      details: error.message
    });
  }
};
