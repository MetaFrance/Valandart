const connectSdk = require('connect-sdk-nodejs');

export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();

        // Configuration du SDK avec tes variables Cloudflare
        const sdkConfig = {
            host: "payment.cawl-solutions.fr",
            scheme: "https",
            port: 443,
            apiKeyId: context.env.CAWL_API_KEY_ID.trim(),
            secretApiKey: context.env.CAWL_SECRET_KEY.trim(),
            integrator: "Valandart"
        };

        // Initialisation du client
        const client = connectSdk.init(sdkConfig);
        const merchantId = context.env.CAWL_MERCHANT_ID.trim();

        // Préparation du paiement
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

        // Appel via le SDK (il gère la signature tout seul)
        const response = await new Promise((resolve, reject) => {
            client.hostedcheckouts.create(merchantId, body, null, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        // Le SDK renvoie une réponse propre
        return new Response(JSON.stringify({
            success: true,
            redirectUrl: `https://payment.cawl-solutions.fr/${response.partialRedirectUrl}`
        }), { headers: { "Content-Type": "application/json" } });

    } catch (err) {
        // En cas d'erreur, le SDK nous donne souvent un message précis
        return new Response(JSON.stringify({ 
            success: false, 
            message: "Erreur SDK : " + (err.message || "Problème d'authentification") 
        }), { status: 500 });
    }
}
