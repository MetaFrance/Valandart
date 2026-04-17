export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
      return new Response(JSON.stringify({ success: false, message: "Montant invalide" }), { status: 400 });
    }

    // Récupération des clés depuis Cloudflare
    const merchantId = context.env.CAWL_MERCHANT_ID;
    const apiKeyId = context.env.CAWL_API_KEY_ID; 
    const apiSecret = context.env.CAWL_SECRET_KEY; 
    
    if (!merchantId || !apiKeyId || !apiSecret) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Configuration serveur incomplète (vérifie les variables Cloudflare)." 
      }), { status: 500 });
    }

    // 1. ON RETIRE LE PREPROD (Environnement de production direct)
    const host = "payment.cawl-solutions.fr"; 
    const path = `/v1/${merchantId}/hostedcheckouts`;
    const cawlApiUrl = `https://${host}${path}`;

    const date = new Date().toUTCString(); 
    const contentType = "application/json";
    
    // 2. CORRECTION SIGNATURE : Il faut obligatoirement 2 sauts de ligne (\n\n) avant le path !
    const dataToSign = `POST\n${contentType}\n${date}\n\n${path}\n`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(apiSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    const authHeader = `GCS v1HMAC:${apiKeyId}:${signatureBase64}`;

    const cawlPayload = {
      order: {
        amountOfMoney: { 
          currencyCode: "EUR", 
          amount: montantEnCentimes 
        },
        customer: { 
          emailAddress: requestData.email,
          billingAddress: {
            countryCode: "FR"
          }
        }
      },
      hostedCheckoutSpecificInput: {
        returnUrl: "https://valandartcreations.pages.dev/"
      }
    };

    const cawlResponse = await fetch(cawlApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Date": date,
        "Authorization": authHeader
      },
      body: JSON.stringify(cawlPayload)
    });

    if (!cawlResponse.ok) {
      // 3. AFFICHAGE DE L'ERREUR RÉELLE DE LA BANQUE
      const erreurTexte = await cawlResponse.text();
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Refus CAWL: " + erreurTexte
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const data = await cawlResponse.json();
    
    // 4. RUSTINE POUR ÉVITER LA PAGE 404 (Force le sous-domaine 'payment.')
    let finalUrl = data.partialRedirectUrl;
    if (finalUrl.startsWith("cawl-solutions.fr")) {
        finalUrl = finalUrl.replace("cawl-solutions.fr", host); 
    }

    return new Response(JSON.stringify({ 
      success: true, 
      checkoutId: data.hostedCheckoutId,
      redirectUrl: "https://" + finalUrl 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: "Erreur script: " + error.message }), { status: 500 });
  }
}
