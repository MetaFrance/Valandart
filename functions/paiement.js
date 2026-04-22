export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();
        
        // 1. Récupération et nettoyage strict des variables
        const merchantId = context.env.CAWL_MERCHANT_ID?.trim();
        const apiKeyId = context.env.CAWL_API_KEY_ID?.trim();
        const apiSecret = context.env.CAWL_SECRET_KEY?.trim();

        const host = "payment.cawl-solutions.fr";
        const path = `/v1/${merchantId}/hostedcheckouts`;
        
        // 2. Formatage DATE et CONTENT-TYPE (C'est ici que l'encodage se joue)
        const date = new Date().toUTCString();
        // La doc exige charset=utf-8 pour que la signature corresponde
        const contentType = "application/json; charset=utf-8";

        // 3. CONSTRUCTION DE LA CHAÎNE À SIGNER (Version SDK)
        // L'ordre des lignes est crucial : POST, TYPE, DATE, HEADERS (vide), PATH
        const stringToSign = "POST\n" + 
                             contentType + "\n" + 
                             date + "\n" + 
                             "\n" + 
                             path + "\n";

        // 4. CRÉATION DE LA SIGNATURE HMAC-SHA256
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
        
        // Conversion de la signature en Base64
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

        // 5. ENVOI DE LA REQUÊTE À CAWL
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

        // Si la banque répond une erreur, on la renvoie pour la voir dans la console
        if (!response.ok) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "Erreur signature ou clés", 
                debug: data 
            }), { status: response.status });
        }

        // 6. REDIRECTION VERS LA PAGE DE PAIEMENT
        // On construit l'URL complète car partialRedirectUrl est... partiel.
        const finalRedirectUrl = `https://${host}/${data.partialRedirectUrl}`;

        return new Response(JSON.stringify({
            success: true,
            redirectUrl: finalRedirectUrl
        }));

    } catch (erreur) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: "Erreur technique: " + erreur.message 
        }), { status: 500 });
    }
}
