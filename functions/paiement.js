export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();
        
        // 1. Récupération et nettoyage strict des variables Cloudflare
        const merchantId = context.env.CAWL_MERCHANT_ID?.trim();
        const apiKeyId = context.env.CAWL_API_KEY_ID?.trim();
        const apiSecret = context.env.CAWL_SECRET_KEY?.trim();

        if (!merchantId || !apiKeyId || !apiSecret) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "Erreur : Variables API manquantes dans Cloudflare." 
            }), { status: 500 });
        }

        const host = "payment.cawl-solutions.fr";
        const path = `/v1/${merchantId}/hostedcheckouts`;
        
        // 2. Formatage Date et Content-Type (Norme SDK CAWL)
        const date = new Date().toUTCString();
        // Le technicien parlait d'encodage : le charset est OBLIGATOIRE ici
        const contentType = "application/json; charset=utf-8";

        // 3. Construction de la String To Sign (Strictement identique au SDK)
        // Note : Les doubles sauts de ligne servent à dire "pas de headers X-GCS"
        const stringToSign = "POST\n" + 
                             contentType + "\n" + 
                             date + "\n" + 
                             "\n" + 
                             path + "\n";

        // 4. Cryptographie HMAC-SHA256 (Norme Web Crypto API)
        const encoder = new TextEncoder();
        const keyData = encoder.encode(apiSecret);
        const msgData = encoder.encode(stringToSign);

        const cryptoKey = await crypto.subtle.importKey(
            "raw", 
            keyData, 
            { name: "HMAC", hash: "SHA-256" }, 
            false, 
            ["sign"]
        );

        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
        
        // Conversion en Base64
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

        // 5. Envoi de la requête à CAWL
        const response = await fetch(`https://${host}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": contentType,
                "Date": date,
                "Authorization": `GCS v1HMAC:${apiKeyId}:${signature}`
            },
            body: JSON.stringify({
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
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erreur Banque:", data);
            return new Response(JSON.stringify({ 
                success: false, 
                message: "Erreur d'authentification", 
                detail: data 
            }), { status: response.status });
        }

        // 6. Redirection vers la page de paiement
        return new Response(JSON.stringify({
            success: true,
            redirectUrl: `https://${host}/${data.partialRedirectUrl}`
        }), { headers: { "Content-Type": "application/json" } });

    } catch (erreur) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: erreur.message 
        }), { status: 500 });
    }
}
