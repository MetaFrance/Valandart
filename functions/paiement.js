// Fichier : functions/paiement.js

export async function onRequestPost(context) {
  // 1. On récupère les données envoyées par votre site web (ex: l'email du client, le montant)
  const requestData = await context.request.json();
  const montantEnCentimes = requestData.montant; // Toujours en centimes (ex: 5000 pour 50€)
  const emailClient = requestData.email;

  // 2. On prépare la demande secrète pour CAWL (Worldline)
  // Remplacez l'URL par celle donnée dans votre documentation CAWL
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
      // C'est ICI la magie de la tokenisation : on demande à CAWL de créer un Token !
      isRecurring: true, 
      returnUrl: "https://valandartcreations.pages.dev" // Où renvoyer le client après le paiement
    }
  };

  try {
    // 3. On appelle CAWL avec votre Clé Secrète (tirée du coffre-fort Cloudflare)
    const cawlResponse = await fetch(cawlApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // On utilise la clé secrète configurée à l'étape 1 !
        "Authorization": "Basic " + btoa("API_KEY:" + context.env.CAWL_SECRET_KEY) 
      },
      body: JSON.stringify(cawlPayload)
    });

    const data = await cawlResponse.json();

    // 4. CAWL nous répond avec un "hostedCheckoutId" (un ticket de session)
    // On renvoie ce ticket à votre site web pour qu'il affiche la page de paiement
    return new Response(JSON.stringify({ 
      success: true, 
      checkoutId: data.hostedCheckoutId,
      redirectUrl: data.partialRedirectUrl // Le lien sécurisé vers la page CAWL
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    // S'il y a un problème, on avertit le site
    return new Response(JSON.stringify({ success: false, message: "Erreur avec CAWL" }), { status: 500 });
  }
}
