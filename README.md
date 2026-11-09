# GlowSkin landing – Meta Pixel + Conversions API (Vercel)

public/index.html  -> landing page (Pixel + server relay)
api/capi.js        -> serverless function, Meta CAPI ko event bhejta hai

## Deploy
1. Is folder ko GitHub pe push karo ya `npx vercel` chalao.
2. Vercel > Project > Settings > Environment Variables:
   - META_PIXEL_ID = 1713357160408455
   - META_ACCESS_TOKEN = (naya token)
   - META_TEST_EVENT_CODE = (sirf testing ke liye)
3. Redeploy (env change ke baad zaroori).

## Test
Events Manager > Test Events > code copy karo > META_TEST_EVENT_CODE me daalo > redeploy > page kholo.
Browser + Server dono events dikhne chahiye, "Deduplicated" status ke saath.
