/*
 * Content of the third fake onboarding (nothing is computed: it is a show to film).
 * - PASSIONS: the first one picked decides the IDEA found, its prompt, the site built and its payments.
 *   Icons are Lucide names (../onboarding/icons.js).
 * - IDEAS: everything shown about an idea: its card, its prompt, the site Claude "builds".
 * - DECOYS: names rolling before the idea lands.
 */
window.FO3_DATA = (() => {
  const PASSIONS = [
    { id: "gaming", icon: "gamepad-2", label: "Gaming" },
    { id: "sport", icon: "dumbbell", label: "Sport" },
    { id: "cuisine", icon: "chef-hat", label: "Cuisine" },
    { id: "reseaux", icon: "smartphone", label: "Réseaux sociaux" },
    { id: "animaux", icon: "paw-print", label: "Animaux" },
    { id: "musique", icon: "headphones", label: "Musique" },
  ];

  /**
   * One idea per passion. `what`: what it is, in a sentence of the prompt; `hero`: the site's big title, its middle line in italics and in the accent;
   * `outro`: the site's last words, same; `price`: what each payment at the end is (euros a month).
   */
  const IDEAS = {
    gaming: {
      name: "ClipForge",
      kind: "App IA",
      what: "une app IA",
      accent: "#7C5CFF",
      icon: "gamepad-2",
      pitch: "Tes meilleurs moments de jeu, montés en clips TikTok par l'IA.",
      features: [
        ["crosshair", "Highlights détectés"],
        ["captions", "Sous-titres auto"],
        ["smartphone", "Export TikTok"],
      ],
      audience: "Les joueurs et les streamers qui postent sur TikTok.",
      firstSteps: ["Poste 3 clips montés avec l'app", "Envoie-la à 10 petits streamers", "Offre-leur 7 jours gratuits"],
      hook: "Tes meilleurs clips, montés en un clic.",
      hero: { kicker: "Pour les joueurs", lines: ["Tes meilleurs", "clips de jeu,", "montés pour toi."] },
      sub: "Importe ta partie : l'IA trouve tes kills, tes clutchs et tes fails, ajoute les sous-titres et te rend des clips prêts pour TikTok.",
      cta: "Monter mes clips",
      steps: ["Importe ta partie", "L'IA trouve tes moments", "Poste tes clips"],
      outro: ["Tes parties méritent", "d'être vues."],
      price: 7.99,
    },
    sport: {
      name: "FitPilot",
      kind: "App IA",
      what: "une app IA",
      accent: "#FF5A36",
      icon: "dumbbell",
      pitch: "Un coach sportif IA qui écrit ta séance du jour selon ton niveau.",
      features: [
        ["clipboard-list", "Programmes sur mesure"],
        ["trending-up", "Suivi des progrès"],
        ["bot", "Coach IA 24/7"],
      ],
      audience: "Ceux qui s'entraînent seuls à la salle ou chez eux.",
      firstSteps: ["Fais ta séance du jour avec l'app", "Fais-la tester à 5 potes de la salle", "Poste ton avant / après"],
      hook: "Ton coach dans ta poche, 24 h sur 24.",
      hero: { kicker: "Pour ceux qui s'entraînent seuls", lines: ["Ton coach", "dans ta poche,", "24 h sur 24."] },
      sub: "Dis-lui ton niveau et ton objectif : chaque jour, ta séance est prête, et elle s'adapte à tes progrès.",
      cta: "Avoir ma séance",
      steps: ["Dis ton objectif", "Reçois ta séance", "Suis tes progrès"],
      outro: ["Ton corps mérite", "un vrai plan."],
      price: 9.99,
    },
    cuisine: {
      name: "FrigoChef",
      kind: "App IA",
      what: "une app IA",
      accent: "#FF8A00",
      icon: "chef-hat",
      pitch: "Prends ton frigo en photo : l'IA te donne 3 recettes en 10 secondes.",
      features: [
        ["camera", "Photo du frigo"],
        ["timer", "Prêt en 20 min"],
        ["shopping-cart", "Liste de courses"],
      ],
      audience: "Les étudiants et les jeunes actifs qui cuisinent vite.",
      firstSteps: ["Cuisine un plat avec ton frigo", "Fais-la tester à ta coloc", "Lance le défi « frigo vide » sur TikTok"],
      hook: "Ce soir, on cuisine ce que t'as.",
      hero: { kicker: "Pour les frigos à moitié vides", lines: ["Ce soir,", "on cuisine", "ce que t'as."] },
      sub: "Une photo de ton frigo, et l'IA te propose 3 recettes simples avec ce qu'il y a dedans. Zéro gaspi, zéro prise de tête.",
      cta: "Scanner mon frigo",
      steps: ["Prends ton frigo en photo", "Choisis ta recette", "Régale-toi"],
      outro: ["Ton frigo a plus d'idées", "que toi."],
      price: 4.99,
    },
    reseaux: {
      name: "HookLab",
      kind: "App IA",
      what: "une app IA",
      accent: "#EC4899",
      icon: "smartphone",
      pitch: "Des accroches TikTok qui retiennent, écrites par l'IA pour ton compte.",
      features: [
        ["sparkles", "Accroches qui retiennent"],
        ["lightbulb", "Idées de vidéos"],
        ["trending-up", "Analyse de ton compte"],
      ],
      audience: "Les créateurs qui veulent percer sur TikTok.",
      firstSteps: ["Teste 3 accroches sur tes vidéos", "Montre tes vues à 10 créateurs", "Offre-leur 7 jours gratuits"],
      hook: "Les 3 premières secondes qui font tes vues.",
      hero: { kicker: "Pour les créateurs", lines: ["Les 3 secondes", "qui font", "tes vues."] },
      sub: "L'IA lit ton compte et t'écrit chaque jour des accroches et des idées de vidéos faites pour ton audience.",
      cta: "Écrire mes accroches",
      steps: ["Connecte ton compte", "Reçois tes accroches", "Poste et regarde"],
      outro: ["Tes vidéos méritent", "des millions de vues."],
      price: 9.99,
    },
    animaux: {
      name: "PawPal",
      kind: "App mobile",
      what: "une app mobile",
      accent: "#F59E0B",
      icon: "paw-print",
      pitch: "La santé de ton chien ou de ton chat, suivie par l'IA.",
      features: [
        ["syringe", "Rappels de vaccins"],
        ["bone", "Alimentation dosée"],
        ["stethoscope", "Véto IA"],
      ],
      audience: "Les propriétaires de chiens et de chats.",
      firstSteps: ["Inscris ton animal dans l'app", "Fais-la tester à 5 proprios du parc", "Poste ton chien sur TikTok"],
      hook: "Ton animal mérite le meilleur.",
      hero: { kicker: "Pour les chiens et les chats", lines: ["Ton animal", "mérite", "le meilleur."] },
      sub: "Vaccins, repas, petits bobos : tout est suivi, et l'IA répond à tes questions à n'importe quelle heure.",
      cta: "Inscrire mon animal",
      steps: ["Inscris ton animal", "Reçois tes rappels", "Pose tes questions"],
      outro: ["Il te le rendra", "au centuple."],
      price: 4.99,
    },
    musique: {
      name: "PressKit",
      kind: "Produit digital",
      what: "un produit digital",
      accent: "#E11D48",
      icon: "headphones",
      pitch: "Des modèles de dossier de presse prêts à remplir pour les artistes indé.",
      features: [
        ["clipboard-list", "Modèles prêts à remplir"],
        ["camera", "Bio et visuels inclus"],
        ["download", "Export en un lien"],
      ],
      audience: "Les beatmakers et les rappeurs qui démarrent seuls.",
      firstSteps: ["Écris à 10 artistes indé sur Instagram", "Crée un premier modèle", "Fais-le remplir par 2 d'entre eux"],
      hook: "Ton dossier de presse pro en 10 minutes.",
      hero: { kicker: "Pour les artistes indé", lines: ["Ton dossier", "de presse pro", "en 10 minutes."] },
      sub: "Des modèles prêts à remplir : ta bio, tes visuels, tes sons et tes contacts, dans un seul lien à envoyer aux médias, aux salles et aux labels.",
      cta: "Créer mon dossier",
      steps: ["Choisis un modèle", "Remplis les blancs", "Partage le lien"],
      outro: ["Ta musique mérite", "un vrai dossier."],
      price: 17.99,
    },
  };

  /** Names rolling past before the idea lands (other ideas, as if the AI weighed them). */
  const DECOYS = ["LoopBeat", "MenuMate", "StudyBuddy", "TripGenie", "Budgy", "DressMe", "CinéMatch", "PlantPal", "SleepWell", "GymBro"];

  /** 2. The monthly goal: the slider's stops, the one it starts on, the word under the figure. */
  const GOAL = {
    stops: Array.from({ length: 101 }, (_, i) => i * 1000),
    start: 10000,
    tiers: [
      { upTo: 3000, word: "Un bon début" },
      { upTo: 10000, word: "Réaliste" },
      { upTo: 30000, word: "Ambitieux" },
      { upTo: 70000, word: "Très ambitieux" },
      { upTo: Infinity, word: "Hors norme" },
    ],
  };

  /** 6. What the builder does once the prompt is sent, step by step (`{name}`, `{domain}` filled). */
  const BUILD_STEPS = [
    "Création de l'app {name}",
    "Direction artistique et composants",
    "Page d'accueil, section par section",
    "Animations et version mobile",
    "Comptes et liste d'attente",
    "Paiement Whop branché",
    "Mise en ligne",
    "Domaine {domain} branché, HTTPS actif",
  ];

  /** 7. The payments landing on the site at the end: who paid. */
  const PAYERS = ["lea.mzk", "theo_prod", "naya.music", "yanis.k", "chloe_tr", "hugo.dsn", "ines.bkr", "lucas_mrn"];

  /** Whop's symbol (whop.com's logo, its mark only), white, for the payment notifications. */
  const WHOP_MARK =
    '<svg viewBox="0 -9.5 39.5 39.5" aria-hidden="true"><path fill="#fff" d="M6.29654 0.0205078C3.70387 0.0205078 1.92397 1.15863 0.565903 2.45194C0.565903 2.45194 0.0206171 2.96927 0.0309055 2.98996L5.71011 8.70125L11.3893 2.98996C10.309 1.50006 8.28221 0.0205078 6.29654 0.0205078Z"/><path fill="#fff" d="M20.3194 0.0205078C17.7267 0.0205078 15.9468 1.16897 14.5888 2.45194C14.5888 2.45194 14.0949 2.95892 14.0641 2.98996L7.04736 10.0463L12.7163 15.7472L25.4019 2.98996C24.3216 1.50006 22.2948 0.0205078 20.3194 0.0205078Z"/><path fill="#fff" d="M34.3738 0.0205078C31.7811 0.0205078 30.0012 1.16897 28.6431 2.45194C28.6431 2.45194 28.1287 2.95893 28.1081 2.98997L14.0645 17.1026L15.546 18.5925C17.8403 20.8998 21.6059 20.8998 23.9105 18.5925L39.4357 2.98997C38.3657 1.50006 36.3594 0.0205078 34.3738 0.0205078Z"/></svg>';

  /** Claude's mark (Simple Icons, simple-icons 16.38.1), in the text color: the prompt and the chat. */
  const CLAUDE_MARK = '<svg class="claude-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>';

  return { PASSIONS, IDEAS, DECOYS, GOAL, BUILD_STEPS, PAYERS, WHOP_MARK, CLAUDE_MARK };
})();
