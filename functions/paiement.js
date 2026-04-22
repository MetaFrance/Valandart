const connectSdk = require('connect-sdk-nodejs');

export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();
        
        // 1. Récupération des variables Cloudflare (nettoyées)
        const merchantId = context.env.CAWL_MERCHANT_ID?.trim();
        const apiKeyId = context.env.CAWL_API_KEY_ID?.trim();
        const secretApiKey = context.env.CAWL_SECRET_KEY?.trim();

        // 2. Configuration du SDK
        const sdkClient = connectSdk.init({
            host: 'payment.cawl-solutions.fr',
            scheme: 'https',
            port: 443,
            apiKeyId: apiKeyId,
            secretApiKey: secretApiKey,
            integrator: 'Valandart'
        });

        // 3. Préparation du paiement
        const paymentPayload = {
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

        // 4. Exécution via le SDK (Gestion automatique de la signature HMAC)
        const response = await new Promise((resolve, reject) => {
            sdkClient.hostedcheckouts.create(merchantId, paymentPayload, null, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        // 5. Réponse vers ton site avec l'URL de redirection
        return new Response(JSON.stringify({
            success: true,
            redirectUrl: `https://payment.cawl-solutions.fr/${response.partialRedirectUrl}`
        }), { 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (err) {
        // En cas d'échec, on renvoie l'erreur précise du SDK
        console.error("Détail erreur SDK:", err);
        return new Response(JSON.stringify({ 
            success: false, 
            message: "La banque a refusé la connexion.",
            error: err.message 
        }), { status: 500 });
    }
}
