// Fichier : functions/webhook.js

export async function onRequestPost(context) {
  try {
    // 1. On réceptionne le colis (les données envoyées automatiquement par CAWL)
    const payload = await context.request.json();
    
    // CAWL envoie plusieurs types de messages. On vérifie que c'est bien une création de Token.
    // (Note : les noms exacts "token.id" dépendront de la documentation technique CAWL)
    const nouveauToken = payload.token.id; 
    const emailClient = payload.payment.customer.emailAddress;
    const carteMasquee = payload.token.card.obfuscatedCardNumber; // Ex: **** 4242

    // 2. On ouvre votre carnet d'adresses (La base de données D1 liée sous le nom 'DB')
    const { DB } = context.env;
    
    // 3. On écrit la nouvelle ligne dans le tableau
    await DB.prepare(
      "INSERT INTO clients_tokens (email_client, cawl_token, derniers_chiffres) VALUES (?, ?, ?)"
    ).bind(emailClient, nouveauToken, carteMasquee).run();

    // 4. On dit à CAWL "Message bien reçu !" (très important pour qu'ils arrêtent d'envoyer le webhook)
    return new Response("Webhook reçu et Token enregistré", { status: 200 });

  } catch (error) {
    // En cas de problème, on le signale
    return new Response("Erreur lors de la lecture du Webhook", { status: 500 });
  }
}
