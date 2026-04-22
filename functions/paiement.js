const connectSdk = require('connect-sdk-nodejs');

export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();
        
        // Récupération des clés que tu viens de montrer en image
        const merchantId = context.env.CAWL_MERCHANT_ID.trim();
        const apiKeyId = context.env.CAWL_API_KEY_ID.trim();
        const secretApiKey = context.env.CAWL_SECRET_KEY.trim();

        // Initialisation du SDK officiel (le "cerveau" qui gère la signature)
        const client = connectSdk.init({
            host: 'payment.cawl-solutions.fr',
            scheme: 'https',
            port: 443,
            apiKeyId: apiKeyId,
            secretApiKey: secretApiKey,
            integrator: 'Valandart'
        });

        // Préparation de la requête de paiement
        const body = {
            order: {
                amountOfMoney: {
                    currencyCode: "EUR",
                    amount: Math.floor(Number(requestData.montant))
                },
                customer: {
                    emailAddress: requestData.email,
                    billingAddress: { countryCode: "FR" }
                }
            },
            hostedCheckoutSpecificInput: {
                returnUrl: "https://valandartcreations.pages.dev/"
            }
        };

        // Exécution de l'appel à la banque
        const response = await new Promise((resolve, reject) => {
            client.hostedcheckouts.create(merchantId, body, null, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        // On renvoie l'URL de redirection au client
        return new Response(JSON.stringify({
            success: true,
            redirectUrl: `https://payment.cawl-solutions.fr/${response.partialRedirectUrl}`
        }), { headers: { "Content-Type": "application/json" } });

    } catch (err) {
        console.error("Erreur critique SDK:", err);
        return new Response(JSON.stringify({ 
            success: false, 
            message: "La banque a rejeté la connexion. Vérifiez vos clés API.",
            debug: err.message 
        }), { status: 500 });
    }
}
