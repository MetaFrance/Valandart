// functions/api/paiement.js
// Cloudflare Pages Function — runtime V8 Edge (Web Crypto API uniquement)

export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();

    const merchantId = context.env.CAWL_MERCHANT_ID.trim();
    const apiKeyId   = context.env.CAWL_API_KEY_ID.trim();
    const secretKey  = context.env.CAWL_SECRET_KEY.trim();

    const host   = 'payment.cawl-solutions.fr';
    const path   = `/v1/${merchantId}/hostedcheckouts`;
    const url    = `https://${host}${path}`;
    const method = 'POST';

    // ── 1. BODY ───────────────────────────────────────────────────────────────
    const bodyObj = {
      order: {
        amountOfMoney: {
          currencyCode: "EUR",
          amount: Math.floor(Number(requestData.montant))  // en centimes
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

    // ── 2. DATE ───────────────────────────────────────────────────────────────
    const date = new Date().toUTCString().replace(/GMT$/, 'GMT');

    // ── 3. CONTENT-TYPE ───────────────────────────────────────────────────────
    const contentType = 'application/json';

    // ── 4. STRING TO SIGN ─────────────────────────────────────────────────────
    const stringToSign = [method, contentType, date, path].join('\n') + '\n';

    // ── 5. SIGNATURE HMAC-SHA256 ──────────────────────────────────────────────
    const encoder   = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(stringToSign));
    const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    // ── 6. AUTHORIZATION ──────────────────────────────────────────────────────
    const authHeader = `GCS v1HMAC:${apiKeyId}:${sigBase64}`;

    // ── 7. APPEL API CAWL ─────────────────────────────────────────────────────
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  contentType,
        'Date':          date,
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
    console.log("partialRedirectUrl brut:", result.partialRedirectUrl);

    // ── 8. CONSTRUCTION DE L'URL — formule officielle CAWL ────────────────────
    // Doc officielle : "https://payment." + partialRedirectUrl
    // partialRedirectUrl = "cawl-solutions.fr/hostedcheckout/PaymentMethods/Selection/xxxx"
    // Résultat final  = "https://payment.cawl-solutions.fr/hostedcheckout/..."
    const redirectUrl = `https://payment.${result.partialRedirectUrl}`;

    return new Response(JSON.stringify({
      success: true,
      redirectUrl
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
