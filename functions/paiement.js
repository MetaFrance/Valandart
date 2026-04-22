// functions/api/paiement.js
// Cloudflare Pages Function — runtime V8 Edge (Web Crypto API uniquement)

export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();

    const merchantId  = context.env.CAWL_MERCHANT_ID.trim();
    const apiKeyId    = context.env.CAWL_API_KEY_ID.trim();
    const secretKey   = context.env.CAWL_SECRET_KEY.trim();

    const host    = 'payment.cawl-solutions.fr';
    const path    = `/v1/${merchantId}/hostedcheckouts`;
    const url     = `https://${host}${path}`;
    const method  = 'POST';

    // ── 1. BODY ──────────────────────────────────────────────────────────────
    const bodyObj = {
      order: {
        amountOfMoney: {
          currencyCode: "EUR",
          amount: Math.floor(Number(requestData.montant))  // centimes entiers
        },
        customer: {
          emailAddress: requestData.email,
          billingAddress: { countryCode: "FR" }
        }
      },
      hostedCheckoutSpecificInput: {
        returnUrl: "https://valandartcreations.pages.dev/"
      }
    };
    const bodyStr = JSON.stringify(bodyObj);

    // ── 2. DATE (figée UNE SEULE FOIS) ───────────────────────────────────────
    const date = new Date().toUTCString().replace(/GMT$/, 'GMT');

    // ── 3. CONTENT-TYPE ──────────────────────────────────────────────────────
    // Dans la StringToSign : SANS charset
    const contentType = 'application/json';

    // ── 4. STRING TO SIGN ────────────────────────────────────────────────────
    // Format Worldline GCS :
    //   {METHOD}\n
    //   {Content-Type}\n
    //   {Date}\n
    //   {RequestURI}\n
    const stringToSign = [
      method,
      contentType,
      date,
      path
    ].join('\n') + '\n';

    // ── 5. SIGNATURE HMAC-SHA256 (Web Crypto) ────────────────────────────────
    const encoder  = new TextEncoder();
    const keyData  = encoder.encode(secretKey);
    const msgData  = encoder.encode(stringToSign);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    // ── 6. HEADER Authorization ───────────────────────────────────────────────
    const authHeader = `GCS v1HMAC:${apiKeyId}:${sigBase64}`;

    // ── 7. APPEL HTTP ─────────────────────────────────────────────────────────
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Date':         date,
        'Authorization': authHeader,
      },
      body: bodyStr
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`CAWL API error ${response.status}:`, responseText);
      return new Response(JSON.stringify({
        success: false,
        status:  response.status,
        message: "Erreur API CAWL",
        debug:   responseText
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const result = JSON.parse(responseText);

    // ── 8. RETOUR AU CLIENT ───────────────────────────────────────────────────
    // partialRedirectUrl contient déjà le domaine (ex: "cawl-solutions.fr/hostedcheckout/...")
    // On préfixe uniquement avec https://
    return new Response(JSON.stringify({
      success: true,
      redirectUrl: `https://${result.partialRedirectUrl}`
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("Erreur critique:", err);
    return new Response(JSON.stringify({
      success: false,
      message: "Erreur interne du serveur",
      debug:   err.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
