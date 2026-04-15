export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
        return new Response(JSON.stringify({ success: false, message: "Montant invalide" }), { status: 400 });
    }

    const cawlPayload = {
      order: {
        amountOfMoney: { 
          currencyCode: "EUR", 
          amount: montantEnCentimes 
        },
        customer: { 
          emailAddress: requestData.email,
          // AJOUT SÉCURITÉ : On précise que le client est en France (FR) 
          // C'est souvent ce qui déclenche l'erreur 1016 quand c'est absent
          billingAddress: {
            countryCode: "FR"
          }
        }
      },
      hostedCheckoutSpecificInput: {
        // On simplifie l'URL au maximum
        returnUrl: "https://valandartcreations.pages.dev/"
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
       return new Response(JSON.stringify({ 
           success: false, 
           message: "Refus CAWL: " + erreurTexte,
           details: "Code 1016 : Vérifiez aussi l'URL de retour dans votre portail marchand CAWL."
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
