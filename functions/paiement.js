export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
      return new Response(JSON.stringify({ success: false, message: "Montant invalide" }), { status: 400 });
    }

    // Récupération et nettoyage des clés (important si copier-coller avec espace)
    const merchantId = context.env.CAWL_MERCHANT_ID?.trim();
    const apiKeyId = context.env.CAWL_API_KEY_ID?.trim(); 
    const apiSecret = context.env.CAWL_SECRET_KEY?.trim(); 
    
    if (!merchantId || !apiKeyId || !apiSecret) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Configuration serveur incomplète (clés manquantes dans Cloudflare)." 
      }), { status: 500 });
    }

    // Configuration Endpoint
    const host = "payment.cawl-solutions.fr"; 
    const path = `/v1/${merchantId}/hostedcheckouts`;
    const cawlApiUrl = `https://${host}${path}`;

    // Formatage Date et Content-Type (STRICT)
    const date = new Date().toUTCString(); 
    const contentType = "application/json; charset=utf-8";
    
    // CONSTRUCTION DE LA CHAÎNE À SIGNER
    // Structure : Méthode + \n + ContentType + \n + Date + \n + Headers + \n + Path + \n
    const dataToSign = "POST\n" +
                       contentType + "\n" +
                       date + "\n" +
                       "\n" + // Ligne vide car pas de headers X-GCS personnalisés
                       path + "\n";

    // CRYPTOGRAPHIE HMAC-SHA256 (Compatible Cloudflare Workers)
    const enc = new TextEncoder();
    const keyData = enc.encode(apiSecret);
    const dataToSignEncoded = enc.encode(dataToSign);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataToSignEncoded);
    
    // Encodage Base64 de la signature
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Header d'autorisation final
    const authHeader = `GCS v1HMAC:${apiKeyId}:${signature}`;

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
      const erreurDétail = await cawlResponse.text();
      console.error("Détail refus CAWL:", erreurDétail);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Erreur d'authentification ou refus banque.",
        debug: erreurDétail 
      }), { status: 400 });
    }

    const data = await cawlResponse.json();
    
    // Construction de l'URL de redirection
    // La plateforme renvoie souvent un partialRedirectUrl
    let redirectUrl = data.partialRedirectUrl;
    if (redirectUrl && !redirectUrl.startsWith("http")) {
        redirectUrl = "https://" + host + "/" + redirectUrl;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      redirectUrl: redirectUrl 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (erreur) {
    return new Response(JSON.stringify({ success: false, message: erreur.message }), { status: 500 });
  }
}
