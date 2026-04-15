// Fichier : functions/paiement.js

export async function onRequestPost(context) {
  try {
    // 1. On récupère les données de votre site
    const requestData = await context.request.json();
    const montantEnCentimes = requestData.montant;
    const emailClient = requestData.email;

    // 2. L'URL CAWL avec votre ID
    const cawlApiUrl = "https://api.cawl.fr/v1/merchant/8911BE754F77C9DAEB55/hostedcheckouts"; 

    const cawlPayload = {
      order: {
        amountOfMoney: {
          currencyCode: "EUR",
          amount: montantEnCentimes
        },
        customer: {
          emailAddress: emailClient
        }
      },
      hostedCheckoutSpecificInput: {
        isRecurring: true, 
        returnUrl: "https://valandartcreations.pages.dev"
      }
    };

    // 3. CORRECTION : On utilise votre vrai Identifiant de Clé API pour l'autorisation
    const idCleApi = "8911BE754F77C9DAEB55";
    const cleSecrete = context.env.CAWL_SECRET_KEY;

    // 4. On appelle CAWL
    const cawlResponse = await fetch(cawlApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(idCleApi + ":" + cleSecrete) 
      },
      body: JSON.stringify(cawlPayload)
    });

    // Si CAWL refuse la connexion (ex: mauvaise clé ou mauvais lien), on le signale
    if (!cawlResponse.ok) {
       const erreurCawl = await cawlResponse.text();
       return new Response(JSON.stringify({ success: false, message: "CAWL a refusé: " + erreurCawl }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const data = await cawlResponse.json();

    // 5. CAWL nous donne le feu vert et l'URL de la page sécurisée
    return new Response(JSON.stringify({ 
      success: true, 
      checkoutId: data.hostedCheckoutId,
      redirectUrl: data.partialRedirectUrl 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    // S'il y a un gros bug, on l'attrape ici
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
