/**
 * Traduzioni per le email transazionali in tutte le lingue supportate.
 *
 * Ogni funzione accetta un locale e ritorna le stringhe tradotte.
 * Locale supportati: it (default), en, es, fr, de.
 *
 * Le email vengono inviate anche quando l'utente è offline, quindi la
 * lingua viene letta da `User.language` nel DB (impostata via LocaleSwitcher
 * o cookie NEXT_LOCALE al momento della creazione account).
 */

export type EmailLocale = "it" | "en" | "es" | "fr" | "de";

const DEFAULT_LOCALE: EmailLocale = "it";

/** Normalizza un valore arbitrario su una delle lingue supportate. */
export function normalizeEmailLocale(
  input: string | null | undefined,
): EmailLocale {
  if (!input) return DEFAULT_LOCALE;
  const short = input.toLowerCase().split(/[-_]/)[0];
  if (
    short === "it" ||
    short === "en" ||
    short === "es" ||
    short === "fr" ||
    short === "de"
  ) {
    return short;
  }
  return DEFAULT_LOCALE;
}

/**
 * Dizionario stringhe email per chiave → locale → testo.
 * Usa placeholder {destination}, {amount}, ecc. sostituiti da interp().
 */
type EmailDict = Record<string, Record<EmailLocale, string>>;

const DICT: EmailDict = {
  // Subjects
  "subject.purchaseConfirmed": {
    it: "Pagamento ricevuto — stiamo generando il tuo itinerario",
    en: "Payment received — we're generating your itinerary",
    es: "Pago recibido — estamos generando tu itinerario",
    fr: "Paiement reçu — nous générons votre itinéraire",
    de: "Zahlung erhalten — wir erstellen deinen Reiseplan",
  },
  "subject.itineraryReady": {
    it: "Il tuo itinerario è pronto",
    en: "Your itinerary is ready",
    es: "Tu itinerario está listo",
    fr: "Votre itinéraire est prêt",
    de: "Dein Reiseplan ist fertig",
  },
  "subject.welcome": {
    it: "Benvenuto in EasyTrip",
    en: "Welcome to EasyTrip",
    es: "Bienvenido a EasyTrip",
    fr: "Bienvenue sur EasyTrip",
    de: "Willkommen bei EasyTrip",
  },
  "subject.cancelConfirmed": {
    it: "Viaggio cancellato — credito disponibile",
    en: "Trip cancelled — credit available",
    es: "Viaje cancelado — crédito disponible",
    fr: "Voyage annulé — crédit disponible",
    de: "Reise storniert — Guthaben verfügbar",
  },
  "subject.tripExpired": {
    it: "Il tuo viaggio è terminato — i ricordi restano",
    en: "Your trip has ended — the memories remain",
    es: "Tu viaje ha terminado — los recuerdos permanecen",
    fr: "Votre voyage est terminé — les souvenirs restent",
    de: "Deine Reise ist zu Ende — die Erinnerungen bleiben",
  },
  "subject.preTripCountdown": {
    it: "Il tuo viaggio sta per iniziare",
    en: "Your trip is about to begin",
    es: "Tu viaje está a punto de comenzar",
    fr: "Votre voyage va bientôt commencer",
    de: "Deine Reise beginnt bald",
  },
  "subject.tripStartToday": {
    it: "Buon viaggio!",
    en: "Have a great trip!",
    es: "¡Buen viaje!",
    fr: "Bon voyage !",
    de: "Gute Reise!",
  },
  "subject.abandonedCheckout": {
    it: "Il tuo checkout è ancora in sospeso",
    en: "Your checkout is still pending",
    es: "Tu compra sigue pendiente",
    fr: "Votre paiement est encore en attente",
    de: "Dein Checkout ist noch offen",
  },

  // Common phrases
  hello: {
    it: "Ciao",
    en: "Hi",
    es: "Hola",
    fr: "Bonjour",
    de: "Hallo",
  },
  signature: {
    it: "EasyTrip",
    en: "EasyTrip",
    es: "EasyTrip",
    fr: "EasyTrip",
    de: "EasyTrip",
  },
  tagline: {
    it: "Viaggia di più, pianifica di meno.",
    en: "Travel more, plan less.",
    es: "Viaja más, planifica menos.",
    fr: "Voyagez plus, planifiez moins.",
    de: "Mehr reisen, weniger planen.",
  },

  // Purchase confirmed
  "purchaseConfirmed.body": {
    it: "Abbiamo ricevuto il pagamento per il viaggio verso <strong>{destination}</strong>.",
    en: "We've received your payment for the trip to <strong>{destination}</strong>.",
    es: "Hemos recibido el pago del viaje a <strong>{destination}</strong>.",
    fr: "Nous avons reçu votre paiement pour le voyage vers <strong>{destination}</strong>.",
    de: "Wir haben deine Zahlung für die Reise nach <strong>{destination}</strong> erhalten.",
  },
  "purchaseConfirmed.generating": {
    it: "Stiamo generando il tuo itinerario: riceverai un'altra email appena sarà pronto.",
    en: "We're generating your itinerary: you'll get another email as soon as it's ready.",
    es: "Estamos generando tu itinerario: recibirás otro correo en cuanto esté listo.",
    fr: "Nous générons votre itinéraire : vous recevrez un autre e-mail dès qu'il sera prêt.",
    de: "Wir erstellen deinen Reiseplan: Du bekommst eine weitere E-Mail, sobald er fertig ist.",
  },
  "purchaseConfirmed.cta": {
    it: "Apri il viaggio in EasyTrip",
    en: "Open the trip in EasyTrip",
    es: "Abre el viaje en EasyTrip",
    fr: "Ouvrir le voyage dans EasyTrip",
    de: "Reise in EasyTrip öffnen",
  },

  // Itinerary ready
  "itineraryReady.title": {
    it: "Il tuo itinerario per <strong>{destination}</strong> è pronto.",
    en: "Your itinerary for <strong>{destination}</strong> is ready.",
    es: "Tu itinerario para <strong>{destination}</strong> está listo.",
    fr: "Votre itinéraire pour <strong>{destination}</strong> est prêt.",
    de: "Dein Reiseplan für <strong>{destination}</strong> ist fertig.",
  },
  "itineraryReady.efficiency": {
    it: "Efficienza percorso (stima AI): <strong>{score}</strong>",
    en: "Route efficiency (AI estimate): <strong>{score}</strong>",
    es: "Eficiencia de la ruta (estimación IA): <strong>{score}</strong>",
    fr: "Efficacité de l'itinéraire (estimation IA) : <strong>{score}</strong>",
    de: "Routen-Effizienz (KI-Schätzung): <strong>{score}</strong>",
  },
  "itineraryReady.cta": {
    it: "Vedi l'itinerario",
    en: "View the itinerary",
    es: "Ver el itinerario",
    fr: "Voir l'itinéraire",
    de: "Reiseplan ansehen",
  },
  "itineraryReady.memberNote": {
    it: "Come membro del gruppo puoi consultare giorno per giorno attività e mappa dall'app.",
    en: "As a group member you can view day-by-day activities and the map in the app.",
    es: "Como miembro del grupo puedes consultar las actividades diarias y el mapa en la app.",
    fr: "En tant que membre du groupe, vous pouvez consulter les activités jour par jour et la carte dans l'app.",
    de: "Als Gruppenmitglied kannst du die täglichen Aktivitäten und die Karte in der App ansehen.",
  },
  "itineraryReady.memberTitle": {
    it: "Itinerario pronto — {destination}",
    en: "Itinerary ready — {destination}",
    es: "Itinerario listo — {destination}",
    fr: "Itinéraire prêt — {destination}",
    de: "Reiseplan fertig — {destination}",
  },

  // Welcome
  "welcome.title": {
    it: "Benvenuto in EasyTrip",
    en: "Welcome to EasyTrip",
    es: "Bienvenido a EasyTrip",
    fr: "Bienvenue sur EasyTrip",
    de: "Willkommen bei EasyTrip",
  },
  "welcome.body": {
    it: "{greet}, siamo felici di averti qui. EasyTrip trasforma la tua destinazione in un itinerario giorno per giorno, con mappe, ristoranti e consigli su misura.",
    en: "{greet}, we're glad you're here. EasyTrip turns your destination into a day-by-day itinerary, with maps, restaurants, and tailored tips.",
    es: "{greet}, nos alegra tenerte aquí. EasyTrip convierte tu destino en un itinerario día a día, con mapas, restaurantes y consejos a medida.",
    fr: "{greet}, nous sommes heureux de vous accueillir. EasyTrip transforme votre destination en un itinéraire jour par jour, avec cartes, restaurants et conseils personnalisés.",
    de: "{greet}, schön, dass du da bist. EasyTrip macht aus deinem Ziel einen Tag-für-Tag-Reiseplan mit Karten, Restaurants und persönlichen Tipps.",
  },
  "welcome.cta": {
    it: "Apri l'app",
    en: "Open the app",
    es: "Abrir la app",
    fr: "Ouvrir l'app",
    de: "App öffnen",
  },
  "welcome.tip": {
    it: "Suggerimento: crea il tuo primo viaggio in pochi secondi dalla dashboard.",
    en: "Tip: create your first trip in seconds from the dashboard.",
    es: "Consejo: crea tu primer viaje en segundos desde el panel.",
    fr: "Astuce : créez votre premier voyage en quelques secondes depuis le tableau de bord.",
    de: "Tipp: Erstelle deine erste Reise in Sekunden vom Dashboard aus.",
  },

  // Cancel confirmed
  "cancelConfirmed.title": {
    it: "Viaggio a {destination} cancellato",
    en: "Trip to {destination} cancelled",
    es: "Viaje a {destination} cancelado",
    fr: "Voyage à {destination} annulé",
    de: "Reise nach {destination} storniert",
  },
  "cancelConfirmed.body": {
    it: 'Abbiamo cancellato il tuo viaggio. Non preoccuparti: l\'importo pagato è stato convertito in <strong style="color:#16a34a">{amount} di credito EasyTrip</strong>.',
    en: 'We\'ve cancelled your trip. No worries: the amount you paid has been converted into <strong style="color:#16a34a">{amount} of EasyTrip credit</strong>.',
    es: 'Hemos cancelado tu viaje. No te preocupes: el importe pagado se ha convertido en <strong style="color:#16a34a">{amount} de crédito EasyTrip</strong>.',
    fr: 'Nous avons annulé votre voyage. Pas d\'inquiétude : le montant payé a été converti en <strong style="color:#16a34a">{amount} de crédit EasyTrip</strong>.',
    de: 'Wir haben deine Reise storniert. Keine Sorge: Der gezahlte Betrag wurde in <strong style="color:#16a34a">{amount} EasyTrip-Guthaben</strong> umgewandelt.',
  },
  "cancelConfirmed.creditLabel": {
    it: "Il tuo credito",
    en: "Your credit",
    es: "Tu crédito",
    fr: "Votre crédit",
    de: "Dein Guthaben",
  },
  "cancelConfirmed.validUntil": {
    it: "Valido fino al {date}",
    en: "Valid until {date}",
    es: "Válido hasta el {date}",
    fr: "Valable jusqu'au {date}",
    de: "Gültig bis {date}",
  },
  "cancelConfirmed.usage": {
    it: "Puoi usare il credito per il prossimo viaggio. Sarà applicato automaticamente al checkout.",
    en: "You can use the credit for your next trip. It will be applied automatically at checkout.",
    es: "Puedes usar el crédito para tu próximo viaje. Se aplicará automáticamente al pagar.",
    fr: "Vous pouvez utiliser le crédit pour votre prochain voyage. Il sera appliqué automatiquement au paiement.",
    de: "Du kannst das Guthaben für deine nächste Reise verwenden. Es wird automatisch beim Checkout angewendet.",
  },
  "cancelConfirmed.cta": {
    it: "🌍 Pianifica il prossimo viaggio",
    en: "🌍 Plan your next trip",
    es: "🌍 Planifica tu próximo viaje",
    fr: "🌍 Planifier le prochain voyage",
    de: "🌍 Nächste Reise planen",
  },
  "cancelConfirmed.footer": {
    it: "EasyTrip — Il credito viene applicato automaticamente al checkout. Ti invieremo un promemoria prima della scadenza.",
    en: "EasyTrip — The credit is applied automatically at checkout. We'll send a reminder before it expires.",
    es: "EasyTrip — El crédito se aplica automáticamente al pagar. Te enviaremos un aviso antes de que expire.",
    fr: "EasyTrip — Le crédit est appliqué automatiquement au paiement. Nous enverrons un rappel avant l'expiration.",
    de: "EasyTrip — Das Guthaben wird automatisch beim Checkout angewendet. Wir erinnern dich rechtzeitig vor Ablauf.",
  },

  // Trip expired
  "tripExpired.title": {
    it: "Il tuo viaggio a {destination} è stato indimenticabile",
    en: "Your trip to {destination} was unforgettable",
    es: "Tu viaje a {destination} fue inolvidable",
    fr: "Votre voyage à {destination} a été inoubliable",
    de: "Deine Reise nach {destination} war unvergesslich",
  },
  "tripExpired.body": {
    it: "Ogni viaggio lascia un segno. I luoghi che hai scoperto, i sapori che hai assaggiato, i momenti che hai vissuto — sono tutti qui, pronti per essere rivissuti.",
    en: "Every trip leaves a mark. The places you discovered, the flavors you tasted, the moments you lived — they're all here, ready to be relived.",
    es: "Cada viaje deja huella. Los lugares que descubriste, los sabores que probaste, los momentos que viviste — están todos aquí, listos para revivirse.",
    fr: "Chaque voyage laisse une trace. Les lieux découverts, les saveurs goûtées, les moments vécus — tout est là, prêt à être revécu.",
    de: "Jede Reise hinterlässt Spuren. Die Orte, die du entdeckt hast, die Aromen, die du probiert hast, die Momente, die du erlebt hast — alles ist hier, bereit noch einmal erlebt zu werden.",
  },
  "tripExpired.accessInfo": {
    it: "L'accesso al tuo itinerario è scaduto, ma i ricordi restano per sempre.",
    en: "Access to your itinerary has expired, but the memories last forever.",
    es: "El acceso a tu itinerario ha caducado, pero los recuerdos duran para siempre.",
    fr: "L'accès à votre itinéraire a expiré, mais les souvenirs restent à jamais.",
    de: "Der Zugriff auf deinen Reiseplan ist abgelaufen, aber die Erinnerungen bleiben für immer.",
  },
  "tripExpired.reactivateCta": {
    it: "📖 Rileggi i ricordi — €2,90",
    en: "📖 Relive the memories — €2.90",
    es: "📖 Revive los recuerdos — €2,90",
    fr: "📖 Revivre les souvenirs — 2,90 €",
    de: "📖 Erinnerungen wiedererleben — 2,90 €",
  },
  "tripExpired.reactivateBody": {
    it: "Riattiva l'accesso completo per 30 giorni e rivivi ogni giorno del viaggio.",
    en: "Reactivate full access for 30 days and relive every day of the trip.",
    es: "Reactiva el acceso completo durante 30 días y revive cada día del viaje.",
    fr: "Réactivez l'accès complet pendant 30 jours et revivez chaque jour du voyage.",
    de: "Aktiviere den vollen Zugriff für 30 Tage und erlebe jeden Reisetag neu.",
  },
  "tripExpired.newTripCta": {
    it: "🌍 Nuovo viaggio — sconto 20%",
    en: "🌍 New trip — 20% discount",
    es: "🌍 Nuevo viaje — 20% de descuento",
    fr: "🌍 Nouveau voyage — 20% de réduction",
    de: "🌍 Neue Reise — 20% Rabatt",
  },
  "tripExpired.newTripBody": {
    it: "Hai già vissuto la magia di un itinerario su misura. La prossima avventura ti aspetta.",
    en: "You've already experienced the magic of a tailored itinerary. The next adventure is waiting.",
    es: "Ya has vivido la magia de un itinerario a medida. La próxima aventura te espera.",
    fr: "Vous avez déjà vécu la magie d'un itinéraire sur mesure. La prochaine aventure vous attend.",
    de: "Du hast bereits die Magie eines maßgeschneiderten Reiseplans erlebt. Das nächste Abenteuer wartet.",
  },
  "tripExpired.footer": {
    it: "EasyTrip — Il tuo itinerario è al sicuro. Puoi riattivare l'accesso in qualsiasi momento.",
    en: "EasyTrip — Your itinerary is safe. You can reactivate access at any time.",
    es: "EasyTrip — Tu itinerario está a salvo. Puedes reactivar el acceso en cualquier momento.",
    fr: "EasyTrip — Votre itinéraire est en sécurité. Vous pouvez réactiver l'accès à tout moment.",
    de: "EasyTrip — Dein Reiseplan ist sicher. Du kannst den Zugriff jederzeit reaktivieren.",
  },

  // Pre-trip countdown
  "preTrip.title": {
    it: "Il viaggio a {destination} inizia tra {days}!",
    en: "Your trip to {destination} starts in {days}!",
    es: "¡Tu viaje a {destination} empieza en {days}!",
    fr: "Votre voyage à {destination} commence dans {days} !",
    de: "Deine Reise nach {destination} beginnt in {days}!",
  },
  "preTrip.body": {
    it: "Manca pochissimo! Ecco una mini checklist per partire sereno:",
    en: "Almost there! Here's a mini checklist to leave with peace of mind:",
    es: "¡Falta muy poco! Aquí una mini lista para partir tranquilo:",
    fr: "Plus qu'un pas ! Voici une mini checklist pour partir sereinement :",
    de: "Es ist fast so weit! Hier eine Mini-Checkliste für eine entspannte Abreise:",
  },
  "preTrip.checkDocuments": {
    it: "Documenti e carta d'identità",
    en: "Documents and ID",
    es: "Documentos y DNI",
    fr: "Documents et pièce d'identité",
    de: "Dokumente und Ausweis",
  },
  "preTrip.checkCharger": {
    it: "Caricatore telefono e power bank",
    en: "Phone charger and power bank",
    es: "Cargador de móvil y power bank",
    fr: "Chargeur de téléphone et power bank",
    de: "Handy-Ladegerät und Powerbank",
  },
  "preTrip.checkShoes": {
    it: "Scarpe comode (camminerai molto!)",
    en: "Comfortable shoes (you'll walk a lot!)",
    es: "Zapatos cómodos (¡caminarás mucho!)",
    fr: "Chaussures confortables (vous marcherez beaucoup !)",
    de: "Bequeme Schuhe (du wirst viel laufen!)",
  },
  "preTrip.checkApp": {
    it: "App EasyTrip aperta e pronta",
    en: "EasyTrip app open and ready",
    es: "App EasyTrip abierta y lista",
    fr: "App EasyTrip ouverte et prête",
    de: "EasyTrip-App geöffnet und bereit",
  },
  "preTrip.checkWeather": {
    it: "Controllare il meteo della destinazione",
    en: "Check the weather at your destination",
    es: "Consultar el tiempo en el destino",
    fr: "Vérifier la météo à destination",
    de: "Wetter am Reiseziel prüfen",
  },
  "preTrip.cta": {
    it: "📋 Rivedi il tuo itinerario",
    en: "📋 Review your itinerary",
    es: "📋 Revisa tu itinerario",
    fr: "📋 Revoir votre itinéraire",
    de: "📋 Reiseplan überprüfen",
  },
  "preTrip.footer": {
    it: "EasyTrip — Buona preparazione!",
    en: "EasyTrip — Happy packing!",
    es: "EasyTrip — ¡Buena preparación!",
    fr: "EasyTrip — Bonne préparation !",
    de: "EasyTrip — Gute Vorbereitung!",
  },

  // Trip start today
  "tripStart.title": {
    it: "Buon viaggio a {destination}!",
    en: "Have a great trip to {destination}!",
    es: "¡Buen viaje a {destination}!",
    fr: "Bon voyage à {destination} !",
    de: "Gute Reise nach {destination}!",
  },
  "tripStart.body": {
    it: "Oggi è il grande giorno! Il tuo itinerario è sbloccato e pronto.",
    en: "Today is the big day! Your itinerary is unlocked and ready.",
    es: "¡Hoy es el gran día! Tu itinerario está desbloqueado y listo.",
    fr: "C'est le grand jour ! Votre itinéraire est débloqué et prêt.",
    de: "Heute ist der große Tag! Dein Reiseplan ist freigeschaltet und bereit.",
  },
  "tripStart.reminderLabel": {
    it: "Ricorda:",
    en: "Remember:",
    es: "Recuerda:",
    fr: "À retenir :",
    de: "Denk dran:",
  },
  "tripStart.reminder1": {
    it: "Apri l'itinerario del giorno per vedere attività e mappa",
    en: "Open the day's itinerary to see activities and map",
    es: "Abre el itinerario del día para ver las actividades y el mapa",
    fr: "Ouvrez l'itinéraire du jour pour voir les activités et la carte",
    de: "Öffne den Tagesplan, um Aktivitäten und Karte zu sehen",
  },
  "tripStart.reminder2": {
    it: 'Usa il bottone <strong>"Cosa faccio adesso?"</strong> se qualcosa va storto',
    en: 'Use the <strong>"What do I do now?"</strong> button if something goes wrong',
    es: 'Usa el botón <strong>"¿Qué hago ahora?"</strong> si algo sale mal',
    fr: "Utilisez le bouton <strong>« Que faire maintenant ? »</strong> si quelque chose ne va pas",
    de: "Nutze die Schaltfläche <strong>„Was mache ich jetzt?“</strong>, wenn etwas schiefgeht",
  },
  "tripStart.reminder3": {
    it: "Controlla i ristoranti consigliati per pranzo e cena",
    en: "Check the recommended restaurants for lunch and dinner",
    es: "Revisa los restaurantes recomendados para comer y cenar",
    fr: "Consultez les restaurants recommandés pour le déjeuner et le dîner",
    de: "Sieh dir die empfohlenen Restaurants für Mittag- und Abendessen an",
  },
  "tripStart.cta": {
    it: "🗺️ Apri il tuo itinerario",
    en: "🗺️ Open your itinerary",
    es: "🗺️ Abre tu itinerario",
    fr: "🗺️ Ouvrir votre itinéraire",
    de: "🗺️ Reiseplan öffnen",
  },
  "tripStart.footerHint": {
    it: "Buon divertimento! Ogni giorno del viaggio si sblocca automaticamente.",
    en: "Have fun! Each day of the trip unlocks automatically.",
    es: "¡Diviértete! Cada día del viaje se desbloquea automáticamente.",
    fr: "Amusez-vous bien ! Chaque journée se débloque automatiquement.",
    de: "Viel Spaß! Jeder Reisetag wird automatisch freigeschaltet.",
  },
  "tripStart.footer": {
    it: "EasyTrip — Il tuo compagno di viaggio AI.",
    en: "EasyTrip — Your AI travel companion.",
    es: "EasyTrip — Tu compañero de viaje AI.",
    fr: "EasyTrip — Votre compagnon de voyage IA.",
    de: "EasyTrip — Dein KI-Reisebegleiter.",
  },

  // Abandoned checkout
  "abandonedCheckout.title": {
    it: "Il checkout per {destination} non è stato completato",
    en: "The checkout for {destination} was not completed",
    es: "No has completado el pago para {destination}",
    fr: "Le paiement pour {destination} n'a pas été finalisé",
    de: "Der Checkout für {destination} wurde nicht abgeschlossen",
  },
  "abandonedCheckout.body": {
    it: "Il pagamento è ancora in sospeso. Puoi tornare al viaggio e concludere l'acquisto quando vuoi: l'itinerario AI ti aspetta.",
    en: "Your payment is still pending. You can return to the trip and complete the purchase whenever you want: the AI itinerary is waiting for you.",
    es: "El pago sigue pendiente. Puedes volver al viaje y finalizar la compra cuando quieras: el itinerario con IA te está esperando.",
    fr: "Le paiement est encore en attente. Vous pouvez revenir au voyage et finaliser l'achat quand vous le souhaitez : l'itinéraire IA vous attend.",
    de: "Deine Zahlung steht noch aus. Du kannst jederzeit zur Reise zurückkehren und den Kauf abschließen: Der KI-Reiseplan wartet auf dich.",
  },
  "abandonedCheckout.cta": {
    it: "Completa il pagamento",
    en: "Complete the payment",
    es: "Completar el pago",
    fr: "Finaliser le paiement",
    de: "Zahlung abschließen",
  },
  "abandonedCheckout.footer": {
    it: "EasyTrip — Se hai già pagato, ignora questa email.",
    en: "EasyTrip — If you've already paid, please ignore this email.",
    es: "EasyTrip — Si ya has pagado, ignora este correo.",
    fr: "EasyTrip — Si vous avez déjà payé, ignorez cet e-mail.",
    de: "EasyTrip — Falls du bereits bezahlt hast, ignoriere diese E-Mail.",
  },

  // Member joined
  "memberJoined.memberTitle": {
    it: "Sei nel gruppo: {destination}",
    en: "You're in the group: {destination}",
    es: "Estás en el grupo: {destination}",
    fr: "Vous êtes dans le groupe : {destination}",
    de: "Du bist in der Gruppe: {destination}",
  },
  "memberJoined.memberBody": {
    it: "{organizer} ti ha aggiunto al viaggio. Puoi vedere itinerario e spese condivise nell'app.",
    en: "{organizer} added you to the trip. You can see the itinerary and shared expenses in the app.",
    es: "{organizer} te ha añadido al viaje. Puedes ver el itinerario y los gastos compartidos en la app.",
    fr: "{organizer} vous a ajouté au voyage. Vous pouvez voir l'itinéraire et les dépenses partagées dans l'app.",
    de: "{organizer} hat dich zur Reise hinzugefügt. Du kannst Reiseplan und geteilte Ausgaben in der App sehen.",
  },
  "memberJoined.memberCta": {
    it: "Apri il viaggio",
    en: "Open the trip",
    es: "Abrir el viaje",
    fr: "Ouvrir le voyage",
    de: "Reise öffnen",
  },
  "memberJoined.organizerTitle": {
    it: "Nuovo membro per {destination}",
    en: "New member for {destination}",
    es: "Nuevo miembro para {destination}",
    fr: "Nouveau membre pour {destination}",
    de: "Neues Mitglied für {destination}",
  },
  "memberJoined.organizerBody": {
    it: "<strong>{email}</strong> è entrato nel gruppo del viaggio.",
    en: "<strong>{email}</strong> joined the trip group.",
    es: "<strong>{email}</strong> se ha unido al grupo del viaje.",
    fr: "<strong>{email}</strong> a rejoint le groupe du voyage.",
    de: "<strong>{email}</strong> ist der Reisegruppe beigetreten.",
  },
  "memberJoined.organizerCta": {
    it: "Vedi il gruppo",
    en: "View the group",
    es: "Ver el grupo",
    fr: "Voir le groupe",
    de: "Gruppe ansehen",
  },
  "memberJoined.organizerFallback": {
    it: "l'organizzatore",
    en: "the organizer",
    es: "el organizador",
    fr: "l'organisateur",
    de: "der Organisator",
  },

  // Units
  "unit.dayOne": {
    it: "1 giorno",
    en: "1 day",
    es: "1 día",
    fr: "1 jour",
    de: "1 Tag",
  },
  "unit.daysMany": {
    it: "{count} giorni",
    en: "{count} days",
    es: "{count} días",
    fr: "{count} jours",
    de: "{count} Tage",
  },

  // Subjects: credit expiry / post-trip / referral
  "subject.creditExpiryTomorrow": {
    it: "🚨 Il tuo credito EasyTrip scade domani!",
    en: "🚨 Your EasyTrip credit expires tomorrow!",
    es: "🚨 ¡Tu crédito EasyTrip vence mañana!",
    fr: "🚨 Votre crédit EasyTrip expire demain !",
    de: "🚨 Dein EasyTrip-Guthaben verfällt morgen!",
  },
  "subject.creditExpiryDays": {
    it: "⏰ Il tuo credito EasyTrip scade tra {days} giorni",
    en: "⏰ Your EasyTrip credit expires in {days} days",
    es: "⏰ Tu crédito EasyTrip vence en {days} días",
    fr: "⏰ Votre crédit EasyTrip expire dans {days} jours",
    de: "⏰ Dein EasyTrip-Guthaben verfällt in {days} Tagen",
  },
  "subject.postTripFeedback": {
    it: "💭 Com'è andato il viaggio a {destination}?",
    en: "💭 How was your trip to {destination}?",
    es: "💭 ¿Qué tal el viaje a {destination}?",
    fr: "💭 Comment s'est passé votre voyage à {destination} ?",
    de: "💭 Wie war deine Reise nach {destination}?",
  },
  "subject.postTripReengage": {
    it: "🌤️ Dove vai il prossimo weekend?",
    en: "🌤️ Where are you going next weekend?",
    es: "🌤️ ¿Adónde vas el próximo fin de semana?",
    fr: "🌤️ Où allez-vous le week-end prochain ?",
    de: "🌤️ Wohin geht es am nächsten Wochenende?",
  },
  "subject.referralSignup": {
    it: "🎉 Il tuo amico si è registrato su EasyTrip!",
    en: "🎉 Your friend just signed up on EasyTrip!",
    es: "🎉 ¡Tu amigo se ha registrado en EasyTrip!",
    fr: "🎉 Votre ami vient de s'inscrire sur EasyTrip !",
    de: "🎉 Dein Freund hat sich bei EasyTrip angemeldet!",
  },
  "subject.referralReward": {
    it: "🎁 Hai guadagnato 1 trip gratis!",
    en: "🎁 You earned 1 free trip!",
    es: "🎁 ¡Has ganado 1 viaje gratis!",
    fr: "🎁 Vous avez gagné 1 voyage gratuit !",
    de: "🎁 Du hast 1 Gratisreise verdient!",
  },

  // Credit expiry reminder
  "creditExpiry.title": {
    it: "Il tuo credito EasyTrip scade tra {days}",
    en: "Your EasyTrip credit expires in {days}",
    es: "Tu crédito EasyTrip vence en {days}",
    fr: "Votre crédit EasyTrip expire dans {days}",
    de: "Dein EasyTrip-Guthaben verfällt in {days}",
  },
  "creditExpiry.body": {
    it: 'Hai ancora <strong style="color:#16a34a">{amount}</strong> di credito da usare. Non lasciarlo scadere!',
    en: 'You still have <strong style="color:#16a34a">{amount}</strong> of credit to use. Don\'t let it expire!',
    es: 'Todavía tienes <strong style="color:#16a34a">{amount}</strong> de crédito por usar. ¡No dejes que venza!',
    fr: 'Il vous reste <strong style="color:#16a34a">{amount}</strong> de crédit à utiliser. Ne le laissez pas expirer !',
    de: 'Du hast noch <strong style="color:#16a34a">{amount}</strong> Guthaben übrig. Lass es nicht verfallen!',
  },
  "creditExpiry.expiryLabel": {
    it: "Scadenza credito",
    en: "Credit expiration",
    es: "Vencimiento del crédito",
    fr: "Expiration du crédit",
    de: "Guthaben-Ablauf",
  },
  "creditExpiry.afterNote": {
    it: "Dopo questa data, il credito non sarà più utilizzabile.",
    en: "After this date, the credit will no longer be usable.",
    es: "Después de esta fecha, el crédito ya no podrá utilizarse.",
    fr: "Après cette date, le crédit ne sera plus utilisable.",
    de: "Nach diesem Datum ist das Guthaben nicht mehr nutzbar.",
  },
  "creditExpiry.cta": {
    it: "🌍 Usa il credito — pianifica un viaggio",
    en: "🌍 Use the credit — plan a trip",
    es: "🌍 Usa el crédito — planifica un viaje",
    fr: "🌍 Utilisez le crédit — planifiez un voyage",
    de: "🌍 Guthaben einlösen — Reise planen",
  },
  "creditExpiry.footer": {
    it: "EasyTrip — Il credito viene applicato automaticamente al checkout.",
    en: "EasyTrip — Credit is applied automatically at checkout.",
    es: "EasyTrip — El crédito se aplica automáticamente al finalizar la compra.",
    fr: "EasyTrip — Le crédit est appliqué automatiquement lors du paiement.",
    de: "EasyTrip — Das Guthaben wird beim Checkout automatisch angewendet.",
  },

  // Post-trip feedback
  "postTripFeedback.title": {
    it: "Com'è andato il viaggio a {destination}?",
    en: "How was your trip to {destination}?",
    es: "¿Qué tal el viaje a {destination}?",
    fr: "Comment s'est passé votre voyage à {destination} ?",
    de: "Wie war deine Reise nach {destination}?",
  },
  "postTripFeedback.intro": {
    it: "Speriamo che il tuo viaggio sia stato indimenticabile! I luoghi, i sapori, le persone — ogni viaggio lascia qualcosa di speciale.",
    en: "We hope your trip was unforgettable! The places, the flavors, the people — every trip leaves something special.",
    es: "Esperamos que tu viaje haya sido inolvidable. Los lugares, los sabores, la gente: cada viaje deja algo especial.",
    fr: "Nous espérons que votre voyage a été inoubliable ! Les lieux, les saveurs, les gens — chaque voyage laisse une trace.",
    de: "Wir hoffen, deine Reise war unvergesslich! Die Orte, die Aromen, die Menschen — jede Reise hinterlässt etwas Besonderes.",
  },
  "postTripFeedback.ask": {
    it: "Ti è piaciuto l'itinerario? C'è stato un posto che ti ha sorpreso? Un ristorante da ricordare? Ci farebbe piacere saperlo — rispondi a questa email con un pensiero.",
    en: "Did you like the itinerary? Was there a place that surprised you? A restaurant to remember? We'd love to hear — just reply to this email with a thought.",
    es: "¿Te gustó el itinerario? ¿Hubo un lugar que te sorprendió? ¿Un restaurante memorable? Nos encantaría saberlo: responde a este correo con tus impresiones.",
    fr: "Avez-vous aimé l'itinéraire ? Un endroit vous a-t-il surpris ? Un restaurant à retenir ? Nous serions ravis de le savoir — répondez simplement à cet e-mail.",
    de: "Hat dir der Reiseplan gefallen? Gab es einen Ort, der dich überrascht hat? Ein unvergessliches Restaurant? Wir würden es gerne erfahren — antworte einfach auf diese E-Mail.",
  },
  "postTripFeedback.nextLabel": {
    it: "Hai già in mente la prossima destinazione?",
    en: "Do you already have the next destination in mind?",
    es: "¿Ya tienes en mente el próximo destino?",
    fr: "Avez-vous déjà en tête la prochaine destination ?",
    de: "Hast du schon dein nächstes Reiseziel im Kopf?",
  },
  "postTripFeedback.nextBody": {
    it: "Pianifica il prossimo viaggio in 30 secondi e parti di nuovo alla scoperta.",
    en: "Plan your next trip in 30 seconds and set off again on a new adventure.",
    es: "Planifica tu próximo viaje en 30 segundos y vuelve a descubrir el mundo.",
    fr: "Planifiez votre prochain voyage en 30 secondes et repartez à l'aventure.",
    de: "Plane deine nächste Reise in 30 Sekunden und brich wieder zu einem Abenteuer auf.",
  },
  "postTripFeedback.cta": {
    it: "🌍 Pianifica il prossimo viaggio",
    en: "🌍 Plan the next trip",
    es: "🌍 Planifica el próximo viaje",
    fr: "🌍 Planifier le prochain voyage",
    de: "🌍 Nächste Reise planen",
  },
  "postTripFeedback.footer": {
    it: "EasyTrip — Ogni viaggio è un ricordo da custodire.",
    en: "EasyTrip — Every trip is a memory worth keeping.",
    es: "EasyTrip — Cada viaje es un recuerdo que vale la pena conservar.",
    fr: "EasyTrip — Chaque voyage est un souvenir à chérir.",
    de: "EasyTrip — Jede Reise ist eine Erinnerung, die bleibt.",
  },

  // Post-trip re-engagement (14 days after)
  "postTripReengage.title": {
    it: "Dove vai il prossimo weekend?",
    en: "Where are you going next weekend?",
    es: "¿Adónde vas el próximo fin de semana?",
    fr: "Où allez-vous le week-end prochain ?",
    de: "Wohin geht es am nächsten Wochenende?",
  },
  "postTripReengage.body": {
    it: "Sono passate due settimane dal tuo ultimo viaggio. La routine può aspettare, la prossima avventura no.",
    en: "It's been two weeks since your last trip. The routine can wait — the next adventure can't.",
    es: "Han pasado dos semanas desde tu último viaje. La rutina puede esperar; la próxima aventura, no.",
    fr: "Cela fait deux semaines depuis votre dernier voyage. La routine peut attendre, pas la prochaine aventure.",
    de: "Es ist zwei Wochen her seit deiner letzten Reise. Der Alltag kann warten, das nächste Abenteuer nicht.",
  },
  "postTripReengage.ideasTitle": {
    it: "Idee per un weekend veloce:",
    en: "Ideas for a quick weekend:",
    es: "Ideas para un fin de semana rápido:",
    fr: "Idées pour un week-end rapide :",
    de: "Ideen für ein schnelles Wochenende:",
  },
  "postTripReengage.idea1": {
    it: "🇮🇹 Un borgo italiano che non conosci ancora",
    en: "🇮🇹 An Italian village you haven't explored yet",
    es: "🇮🇹 Un pueblo italiano que aún no conoces",
    fr: "🇮🇹 Un village italien que vous ne connaissez pas encore",
    de: "🇮🇹 Ein italienisches Dorf, das du noch nicht kennst",
  },
  "postTripReengage.idea2": {
    it: "🇪🇸 Una città europea a 2 ore di volo",
    en: "🇪🇸 A European city 2 hours away by plane",
    es: "🇪🇸 Una ciudad europea a 2 horas de vuelo",
    fr: "🇪🇸 Une ville européenne à 2 heures de vol",
    de: "🇪🇸 Eine europäische Stadt nur 2 Flugstunden entfernt",
  },
  "postTripReengage.idea3": {
    it: "🏔️ Montagna o lago per staccare dalla città",
    en: "🏔️ Mountains or lakes to escape the city",
    es: "🏔️ Montaña o lago para desconectar de la ciudad",
    fr: "🏔️ Montagne ou lac pour s'évader de la ville",
    de: "🏔️ Berge oder See, um der Stadt zu entfliehen",
  },
  "postTripReengage.cta": {
    it: "✨ Crea un itinerario in 30 secondi",
    en: "✨ Create an itinerary in 30 seconds",
    es: "✨ Crea un itinerario en 30 segundos",
    fr: "✨ Créez un itinéraire en 30 secondes",
    de: "✨ Erstelle einen Reiseplan in 30 Sekunden",
  },
  "postTripReengage.closing": {
    it: "Il tuo prossimo viaggio è a un clic di distanza.",
    en: "Your next trip is just one click away.",
    es: "Tu próximo viaje está a un clic de distancia.",
    fr: "Votre prochain voyage est à un clic.",
    de: "Deine nächste Reise ist nur einen Klick entfernt.",
  },
  "postTripReengage.footer": {
    it: "EasyTrip — Viaggia di più, pianifica di meno.",
    en: "EasyTrip — Travel more, plan less.",
    es: "EasyTrip — Viaja más, planifica menos.",
    fr: "EasyTrip — Voyagez plus, planifiez moins.",
    de: "EasyTrip — Mehr reisen, weniger planen.",
  },

  // Referral: friend signed up
  "referralSignup.title": {
    it: "🎉 Il tuo amico si è registrato!",
    en: "🎉 Your friend just signed up!",
    es: "🎉 ¡Tu amigo se ha registrado!",
    fr: "🎉 Votre ami vient de s'inscrire !",
    de: "🎉 Dein Freund hat sich angemeldet!",
  },
  "referralSignup.greeting": {
    it: "Ciao <strong>{name}</strong>,",
    en: "Hi <strong>{name}</strong>,",
    es: "Hola <strong>{name}</strong>,",
    fr: "Bonjour <strong>{name}</strong>,",
    de: "Hallo <strong>{name}</strong>,",
  },
  "referralSignup.body": {
    it: "Ottima notizia! <strong>{email}</strong> si è registrato su EasyTrip grazie al tuo link di invito.",
    en: "Great news! <strong>{email}</strong> just signed up on EasyTrip thanks to your invite link.",
    es: "¡Buenas noticias! <strong>{email}</strong> se ha registrado en EasyTrip gracias a tu enlace de invitación.",
    fr: "Bonne nouvelle ! <strong>{email}</strong> vient de s'inscrire sur EasyTrip grâce à votre lien d'invitation.",
    de: "Gute Nachrichten! <strong>{email}</strong> hat sich über deinen Einladungslink bei EasyTrip angemeldet.",
  },
  "referralSignup.reward": {
    it: "Quando acquisterà il primo viaggio, riceverai automaticamente <strong>€3,99 di credito</strong> (= 1 trip Solo/Coppia gratis!) sul tuo account.",
    en: "When they buy their first trip, you'll automatically receive <strong>€3.99 credit</strong> (= 1 free Solo/Couple trip!) in your account.",
    es: "Cuando compre su primer viaje, recibirás automáticamente <strong>3,99 € de crédito</strong> (= ¡1 viaje Solo/Pareja gratis!) en tu cuenta.",
    fr: "Lorsqu'il achètera son premier voyage, vous recevrez automatiquement <strong>3,99 € de crédit</strong> (= 1 voyage Solo/Duo gratuit !) sur votre compte.",
    de: "Wenn er seine erste Reise kauft, erhältst du automatisch <strong>3,99 € Guthaben</strong> (= 1 kostenloser Solo/Paar-Trip!) auf deinem Konto.",
  },
  "referralSignup.cta": {
    it: "Vedi i tuoi inviti",
    en: "View your invites",
    es: "Ver tus invitaciones",
    fr: "Voir vos invitations",
    de: "Einladungen ansehen",
  },
  "referralSignup.closing": {
    it: "Continua a condividere il tuo link per guadagnare più trip gratis!",
    en: "Keep sharing your link to earn more free trips!",
    es: "¡Sigue compartiendo tu enlace para conseguir más viajes gratis!",
    fr: "Continuez à partager votre lien pour gagner plus de voyages gratuits !",
    de: "Teile deinen Link weiter und verdiene noch mehr Gratisreisen!",
  },

  // Referral: reward earned
  "referralReward.title": {
    it: "🎁 Hai guadagnato 1 trip gratis!",
    en: "🎁 You earned 1 free trip!",
    es: "🎁 ¡Has ganado 1 viaje gratis!",
    fr: "🎁 Vous avez gagné 1 voyage gratuit !",
    de: "🎁 Du hast 1 Gratisreise verdient!",
  },
  "referralReward.body": {
    it: "Un tuo amico ha appena acquistato il primo viaggio su EasyTrip! Come promesso, abbiamo accreditato <strong>€{amount}</strong> sul tuo account.",
    en: "One of your friends just bought their first trip on EasyTrip! As promised, we've credited <strong>€{amount}</strong> to your account.",
    es: "¡Uno de tus amigos acaba de comprar su primer viaje en EasyTrip! Como prometimos, hemos abonado <strong>{amount} €</strong> en tu cuenta.",
    fr: "Un de vos amis vient d'acheter son premier voyage sur EasyTrip ! Comme promis, nous avons crédité <strong>{amount} €</strong> sur votre compte.",
    de: "Einer deiner Freunde hat soeben seine erste Reise auf EasyTrip gekauft! Wie versprochen haben wir <strong>{amount} €</strong> auf deinem Konto gutgeschrieben.",
  },
  "referralReward.validUntil": {
    it: "Credito valido fino al {date}",
    en: "Credit valid until {date}",
    es: "Crédito válido hasta el {date}",
    fr: "Crédit valable jusqu'au {date}",
    de: "Guthaben gültig bis {date}",
  },
  "referralReward.howToUse": {
    it: "Usa il credito per il tuo prossimo viaggio — sarà applicato automaticamente al checkout!",
    en: "Use the credit for your next trip — it will be applied automatically at checkout!",
    es: "Usa el crédito para tu próximo viaje: ¡se aplicará automáticamente al finalizar la compra!",
    fr: "Utilisez le crédit pour votre prochain voyage — il sera appliqué automatiquement au paiement !",
    de: "Nutze das Guthaben für deine nächste Reise — es wird beim Checkout automatisch angewendet!",
  },
  "referralReward.cta": {
    it: "✨ Crea il tuo prossimo viaggio gratis",
    en: "✨ Create your next trip for free",
    es: "✨ Crea tu próximo viaje gratis",
    fr: "✨ Créez votre prochain voyage gratuitement",
    de: "✨ Erstelle deine nächste Reise kostenlos",
  },
  "referralReward.closing": {
    it: "Continua a invitare amici per guadagnare ancora!",
    en: "Keep inviting friends to earn even more!",
    es: "¡Sigue invitando amigos para ganar aún más!",
    fr: "Continuez à inviter des amis pour gagner encore plus !",
    de: "Lade weiter Freunde ein und verdiene noch mehr!",
  },

  // Nurture no-trip (marketing)
  "subject.nurtureNoTrip3": {
    it: "Il tuo primo itinerario EasyTrip ti aspetta",
    en: "Your first EasyTrip itinerary is waiting",
    es: "Tu primer itinerario EasyTrip te espera",
    fr: "Votre premier itinéraire EasyTrip vous attend",
    de: "Dein erster EasyTrip-Reiseplan wartet",
  },
  "subject.nurtureNoTrip7": {
    it: "Pronto a pianificare un viaggio con EasyTrip?",
    en: "Ready to plan a trip with EasyTrip?",
    es: "¿Listo para planear un viaje con EasyTrip?",
    fr: "Prêt à planifier un voyage avec EasyTrip ?",
    de: "Bereit, eine Reise mit EasyTrip zu planen?",
  },
  "nurture.title3": {
    it: "Hai già pensato alla prossima destinazione?",
    en: "Have you thought about your next destination yet?",
    es: "¿Ya has pensado en tu próximo destino?",
    fr: "Avez-vous déjà pensé à votre prochaine destination ?",
    de: "Hast du schon an dein nächstes Reiseziel gedacht?",
  },
  "nurture.title7": {
    it: "Ti manca solo un clic per il primo itinerario",
    en: "You're just one click away from your first itinerary",
    es: "Solo te falta un clic para tu primer itinerario",
    fr: "Vous êtes à un clic de votre premier itinéraire",
    de: "Nur ein Klick trennt dich von deinem ersten Reiseplan",
  },
  "nurture.body3": {
    it: "Sono passati alcuni giorni dalla registrazione: se vuoi, crea il tuo primo viaggio e ricevi un piano giorno per giorno.",
    en: "A few days have passed since you signed up: if you'd like, create your first trip and get a day-by-day plan.",
    es: "Han pasado algunos días desde tu registro: si quieres, crea tu primer viaje y recibe un plan día a día.",
    fr: "Quelques jours se sont écoulés depuis votre inscription : si vous le souhaitez, créez votre premier voyage et recevez un plan jour par jour.",
    de: "Seit deiner Anmeldung sind einige Tage vergangen: Erstelle auf Wunsch deine erste Reise und erhalte einen Plan Tag für Tag.",
  },
  "nurture.body7": {
    it: "Un weekend, una settimana o una gita fuori porta: EasyTrip organizza tutto in base alle tue date e al tuo stile.",
    en: "A weekend, a week, or a getaway: EasyTrip organizes everything based on your dates and your style.",
    es: "Un fin de semana, una semana o una escapada: EasyTrip lo organiza todo según tus fechas y tu estilo.",
    fr: "Un week-end, une semaine ou une escapade : EasyTrip organise tout selon vos dates et votre style.",
    de: "Ein Wochenende, eine Woche oder ein Kurztrip: EasyTrip organisiert alles nach deinen Daten und deinem Stil.",
  },
  "nurture.cta": {
    it: "Crea un viaggio",
    en: "Create a trip",
    es: "Crear un viaje",
    fr: "Créer un voyage",
    de: "Reise erstellen",
  },
  "nurture.footer": {
    it: "Hai ricevuto questa email perché hai scelto di ricevere comunicazioni da EasyTrip.",
    en: "You received this email because you chose to receive communications from EasyTrip.",
    es: "Has recibido este correo porque elegiste recibir comunicaciones de EasyTrip.",
    fr: "Vous avez reçu cet e-mail parce que vous avez choisi de recevoir des communications d'EasyTrip.",
    de: "Du hast diese E-Mail erhalten, weil du Mitteilungen von EasyTrip abonniert hast.",
  },
  "nurture.preferences": {
    it: "Puoi cambiare idea in qualsiasi momento: preferenze privacy",
    en: "You can change your mind at any time: privacy preferences",
    es: "Puedes cambiar de opinión en cualquier momento: preferencias de privacidad",
    fr: "Vous pouvez changer d'avis à tout moment : préférences de confidentialité",
    de: "Du kannst es jederzeit ändern: Datenschutzeinstellungen",
  },

  // Shared misc
  "email.travelerFallback": {
    it: "Viaggiatore",
    en: "Traveler",
    es: "Viajero",
    fr: "Voyageur",
    de: "Reisender",
  },
  "email.brandFooter": {
    it: "EasyTrip — Viaggia di più, pianifica di meno.",
    en: "EasyTrip — Travel more, plan less.",
    es: "EasyTrip — Viaja más, planifica menos.",
    fr: "EasyTrip — Voyagez plus, planifiez moins.",
    de: "EasyTrip — Mehr reisen, weniger planen.",
  },
};

/** Ritorna la stringa tradotta sostituendo i placeholder {key}. */
export function t(
  key: string,
  locale: EmailLocale,
  vars?: Record<string, string | number>,
): string {
  const entry = DICT[key];
  if (!entry) {
    return key;
  }
  let text = entry[locale] ?? entry[DEFAULT_LOCALE];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}

/** Formatta una data ISO nel formato locale dell'utente. */
export function formatEmailDate(
  isoOrDate: string | Date,
  locale: EmailLocale,
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const bcp: Record<EmailLocale, string> = {
    it: "it-IT",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
  };
  try {
    return new Intl.DateTimeFormat(bcp[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Helper per "X giorno/giorni" nelle varie lingue. */
export function daysLabel(count: number, locale: EmailLocale): string {
  return count === 1
    ? t("unit.dayOne", locale)
    : t("unit.daysMany", locale, { count });
}
