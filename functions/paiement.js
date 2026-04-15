export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    
    const cawlPayload = {
      order: {
        amountOfMoney: { 
          currencyCode: "EUR", 
          amount: requestData.montant 
        },
        customer: { 
          emailAddress: requestData.email 
        }
      },
      hostedCheckoutSpecificInput: {
        isRecurring: true, 
        returnUrl: "https://valandartcreations.pages.dev"
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
