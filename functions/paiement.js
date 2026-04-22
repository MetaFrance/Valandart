export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    
    // 1. Nettoyage et vérification des variables Cloudflare
    const merchantId = context.env.CAWL_MERCHANT_ID?.trim();
    const apiKeyId = context.env.CAWL_API_KEY_ID?.trim();
    const apiSecret = context.env.CAWL_SECRET_KEY?.trim();
    
    if (!merchantId || !apiKeyId || !apiSecret) {
      return new Response(JSON.stringify({ success: false, message: "Variables de configuration manquantes." }), { status: 500 });
    }

    const host = "payment.cawl-solutions.fr";
    const path = `/v1/${merchantId}/hostedcheckouts`;
    const date = new Date().toUTCString();
    
    // 2. L'ENCODAGE CRITIQUE : Strictement UTF-8 avec le charset
    const contentType = "application/json; charset=utf-8";

    // 3. CONSTRUCTION DE LA SIGNATURE (Identique au SDK)
    // L'ordre et les sauts de ligne (\n) sont vitaux
    const stringToSign = "POST\n" + 
                         contentType + "\n" + 
                         date + "\n" + 
                         "\n" + 
                         path + "\n";

    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const msgData = encoder.encode(stringToSign);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // 4. L'APPEL À LA BANQUE
    const response = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Date": date,
        "Authorization": `GCS v1HMAC:${apiKeyId}:${signature}`
      },
      body: JSON.stringify({
        order: {
          amountOfMoney: { 
            currencyCode: "EUR", 
            amount: Math.floor(Number(requestData.montant)) 
          },
          customer: { 
            emailAddress: requestData.email, 
            billingAddress: { countryCode: "FR" } 
          }
        },
        hostedCheckoutSpecificInput: {
          returnUrl: "https://valandartcreations.pages.dev/"
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Détail Erreur CAWL:", JSON.stringify(result));
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Erreur d'authentification (Vérifiez API Key/Secret)", 
        detail: result 
      }), { status: response.status });
    }

    // 5. REDIRECTION (Version sécurisée)
    // Le partialRedirectUrl nécessite d'être complété par le host
    const redirectUrl = `https://${host}/${result.partialRedirectUrl}`;

    return new Response(JSON.stringify({
      success: true,
      redirectUrl: redirectUrl
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
}
