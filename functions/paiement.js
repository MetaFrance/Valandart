export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
      return new Response(JSON.stringify({ success: false, message: "Montant invalide" }), { status: 400 });
    }

    // Identifiants CAWL
    const merchantId = "CA131066056037";
    const apiKeyId = "1E9F76181E3AD18D1B46"; 
    
    // TA CLÉ SECRÈTE (Doit impérativement être configurée dans les Variables d'environnement de ton Cloudflare Pages)
    const apiSecret = context.env.CAWL_SECRET_KEY; 
    
    if (!apiSecret) {
      return new Response(JSON.stringify({ success: false, message: "Clé secrète CAWL manquante côté serveur." }), { status: 500 });
    }

    // Configuration de l'URL
    // Note: Si ton API Key est une clé de test, remplace "payment.cawl-solutions.fr" par "payment.preprod.cawl-solutions.fr"
    const host = "payment.cawl-solutions.fr"; 
    const path = `/v1/${merchantId}/hostedcheckouts`;
    const cawlApiUrl = `https://${host}${path}`;

    // Préparation pour la signature cryptographique (GCS v1HMAC) exigée par CAWL
    const date = new Date().toUTCString(); // Format obligatoire ex: "Fri, 06 Jun 2014 13:39:43 GMT"
    const contentType = "application/json";
    
    // Le texte exact qui doit être signé
    const dataToSign = `POST\n${contentType}\n${date}\n${path}\n`;

    // Génération du cryptage HMAC-SHA256 (Natif Cloudflare)
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(apiSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
    // Conversion en Base64
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Construction du Header d'autorisation final
    const authHeader = `GCS v1HMAC:${apiKeyId}:${signatureBase64}`;

    // Le corps de la requête de paiement
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

    // Envoi de la requête au Crédit Agricole
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
      const erreurTexte = await cawlResponse.text();
      console.error("Erreur API CAWL :", erreurTexte);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Refus CAWL: " + erreurTexte
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const data = await cawlResponse.json();
    
    // On renvoie l'URL au site public. Attention, CAWL renvoie une "partialRedirectUrl", on DOIT ajouter "https://"
    return new Response(JSON.stringify({ 
      success: true, 
      checkoutId: data.hostedCheckoutId,
      redirectUrl: "https://" + data.partialRedirectUrl 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
