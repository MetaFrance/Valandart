const connectSdk = require('connect-sdk-nodejs');

export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();
        
        // On récupère tes variables Cloudflare
        const merchantId = context.env.CAWL_MERCHANT_ID.trim();
        const apiKeyId = context.env.CAWL_API_KEY_ID.trim();
        const secretApiKey = context.env.CAWL_SECRET_KEY.trim();

        // Initialisation du SDK officiel
        const client = connectSdk.init({
            host: 'payment.cawl-solutions.fr',
            scheme: 'https',
            port: 443,
            apiKeyId: apiKeyId,
            secretApiKey: secretApiKey,
            integrator: 'Valandart'
        });

        // Préparation des données de la commande
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

        // Appel à la banque via le SDK
        const response = await new Promise((resolve, reject) => {
            client.hostedcheckouts.create(merchantId, paymentPayload, null, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        // Redirection vers la page de paiement sécurisée
        return new Response(JSON.stringify({
            success: true,
            redirectUrl: `https://payment.cawl-solutions.fr/${response.partialRedirectUrl}`
        }), { headers: { "Content-Type": "application/json" } });

    } catch (err) {
        console.error("Erreur SDK:", err);
        return new Response(JSON.stringify({ 
            success: false, 
            message: "Erreur SDK : " + (err.message || "Authentification échouée") 
        }), { status: 500 });
    }
}
