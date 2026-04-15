export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
        return new Response(JSON.stringify({ success: false, message: "Montant invalide" }), { status: 400 });
    }

    // VOS NOUVEAUX IDENTIFIANTS
    const merchantId = "CA131066056037"; // Votre PSPID
    const apiKeyId = "1E9F76181E3AD18D1B46"; // Votre Identifiant de clé API

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

    // L'URL utilise maintenant le Merchant ID (PSPID)
    const cawlApiUrl = `https://api.cawl.fr/v1/${merchantId}/hostedcheckouts`;

    const cawlResponse = await fetch(cawlApiUrl, {
      method: "POST",
// Remplace la partie "headers" par celle-ci
headers: {
    "Content-Type": "application/json",
    // Format : API_KEY_ID:SECRET_KEY encodé en Base64
    "Authorization": "Basic " + btoa(context.env.CAWL_API_KEY_ID + ":" + context.env.CAWL_SECRET_KEY)
},

    if (!cawlResponse.ok) {
       const erreurTexte = await cawlResponse.text();
       return new Response(JSON.stringify({ 
           success: false, 
           message: "Refus CAWL: " + erreurTexte
       }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const data = await cawlResponse.json();

    return new Response(JSON.stringify({ 
      success: true, 
      checkoutId: data.hostedCheckoutId,
      redirectUrl: data.partialRedirectUrl 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
