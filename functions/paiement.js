export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    
    // SÉCURITÉ : On force le montant à devenir un vrai nombre entier mathématique.
    // Et on vérifie qu'il est supérieur à 0 (la banque refuse les transactions à 0€).
    const montantEnCentimes = parseInt(requestData.montant, 10);
    
    if (!montantEnCentimes || montantEnCentimes <= 0) {
        return new Response(JSON.stringify({ success: false, message: "Erreur : Le montant calculé est invalide ou égal à zéro." }), { status: 400 });
    }

    const cawlPayload = {
      order: {
        amountOfMoney: { 
          currencyCode: "EUR", 
          amount: montantEnCentimes // Ici, on est 100% sûr d'envoyer un nombre pur
        },
        customer: { 
          emailAddress: requestData.email 
        }
      },
      hostedCheckoutSpecificInput: {
        returnUrl: "https://valandartcreations.pages.dev/index.html"
      }
    };

    const cawlResponse = await fetch("https://api.cawl.fr/v1/merchant/8911BE754F77C9DAEB55/hostedcheckouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa("8911BE754F77C9DAEB55:" + context.env.CAWL_SECRET_KEY) 
      },
      body: JSON.stringify(cawlPayload)
    });

    if (!cawlResponse.ok) {
       const erreurTexte = await cawlResponse.text();
       return new Response(JSON.stringify({ success: false, message: "Refus CAWL: " + erreurTexte }), { status: 400 });
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
