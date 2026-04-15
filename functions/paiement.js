export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    
    // 1. FORÇAGE STRICT : On s'assure que le montant est un "Nombre Entier Absolu"
    const montantEnCentimes = Math.floor(Number(requestData.montant));
    
    // Si c'est un texte invalide ou zéro, on bloque
    if (isNaN(montantEnCentimes) || montantEnCentimes <= 0) {
        return new Response(JSON.stringify({ success: false, message: "Erreur : Le montant calculé est invalide." }), { status: 400 });
    }

    // 2. Préparation du colis
    const cawlPayload = {
      order: {
        amountOfMoney: { 
          currencyCode: "EUR", 
          amount: montantEnCentimes 
        },
        customer: { 
          emailAddress: requestData.email || "client@email.com"
        }
      },
      hostedCheckoutSpecificInput: {
        returnUrl: "https://valandartcreations.pages.dev/index.html"
      }
    };

    // 3. Envoi à la banque
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
       
       // 🚨 LE SCANNER : On renvoie l'erreur MAIS AUSSI le colis exact qu'on a envoyé !
       return new Response(JSON.stringify({ 
           success: false, 
           message: "Refus CAWL: " + erreurTexte,
           payloadEnvoye: cawlPayload // On affiche le colis pour le radiographier
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
