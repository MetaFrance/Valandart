export async function onRequestPost(context) {
  try {
    // 1. Récupération des données envoyées par le client (index.html)
    const requestData = await context.request.json();
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    // Validation du montant
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
      return new Response(JSON.stringify({ success: false, message: "Montant invalide" }), { status: 400 });
    }

    // 2. Récupération des identifiants sécurisés dans Cloudflare (Variables d'environnement)
    // IMPORTANT : Tu dois configurer ces 3 variables dans ton interface Cloudflare Pages
    const merchantId = context.env.CAWL_MERCHANT_ID;
    const apiKeyId = context.env.CAWL_API_KEY_ID; 
    const apiSecret = context.env.CAWL_SECRET_KEY; 
    
    if (!merchantId || !apiKeyId || !apiSecret) {
      console.error("Erreur : Les variables d'environnement CAWL ne sont pas configurées.");
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Configuration serveur incomplète (clés manquantes)." 
      }), { status: 500 });
    }

    // 3. Configuration de l'URL de l'API Crédit Agricole (CAWL / Worldline)
    const host = "payment.cawl-solutions.fr"; 
    const path = `/v1/${merchantId}/hostedcheckouts`;
    const cawlApiUrl = `https://${host}${path}`;

    // 4. Préparation de la signature cryptographique (GCS v1HMAC)
    // Cette étape est obligatoire pour que le Crédit Agricole accepte la connexion
    const date = new Date().toUTCString(); 
    const contentType = "application/json";
    
    // Construction de la chaîne à signer
    const dataToSign = `POST\n${contentType}\n${date}\n${path}\n`;

    // Utilisation de l'API WebCrypto de Cloudflare pour crypter la signature en HMAC-SHA256
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(apiSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
    
    // Conversion de la signature en Base64
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // 5. Construction du Header d'autorisation final
    const authHeader = `GCS v1HMAC:${apiKeyId}:${signatureBase64}`;

    // 6. Préparation du panier pour CAWL
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
        // L'URL où le client revient après avoir payé
        returnUrl: "https://valandartcreations.pages.dev/"
      }
    };

    // 7. Envoi de la requête sécurisée au Crédit Agricole
    const cawlResponse = await fetch(cawlApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Date": date,
        "Authorization": authHeader
      },
      body: JSON.stringify(cawlPayload)
    });

    // 8. Gestion de la réponse de la banque
    if (!cawlResponse.ok) {
      const erreurTexte = await cawlResponse.text();
      console.error("Refus API CAWL :", erreurTexte);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Erreur lors de l'appel à la banque."
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const data = await cawlResponse.json();
    
    // 9. Renvoi de l'URL de paiement au navigateur du client
    // On ajoute "https://" devant la redirection partielle fournie par CAWL
    return new Response(JSON.stringify({ 
      success: true, 
      checkoutId: data.hostedCheckoutId,
      redirectUrl: "https://" + data.partialRedirectUrl 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Erreur serveur :", error.message);
    return new Response(JSON.stringify({ success: false, message: "Erreur interne du serveur." }), { status: 500 });
  }
}
