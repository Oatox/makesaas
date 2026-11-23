/*
 * Content of the fake onboarding (nothing is computed: it is a show to film).
 * - PASSIONS: the first passion picked decides the SaaS "created" at the end (its `idea`).
 * - Icons are Lucide names (icons.js); features and floats are [icon, title, detail].
 * - TIMES, BANKS, GOAL: the other questions.
 * Bank logos: Revolut, PayPal, Lydia and N26 come from Simple Icons (CC0); Boursorama and Crédit
 * Agricole are the symbols of their official logos (Wikimedia Commons), on white like PayPal.
 */
window.FO_DATA = (() => {
  const PASSIONS = [
    {
      id: "sport",
      icon: "dumbbell",
      label: "Sport",
      idea: {
        name: "FitPilot",
        accent: "#FF5A36",
        tagline: "Ton coach sportif IA, dans ta poche.",
        sub: "Des séances sur mesure qui s'adaptent à ton niveau, chaque jour.",
        features: [
          ["clipboard-list", "Programmes sur mesure", "Adaptés à ton niveau"],
          ["trending-up", "Suivi des progrès", "Chaque séance compte"],
          ["bot", "Coach IA 24/7", "Une réponse en 2 secondes"],
        ],
        floats: [
          ["flame", "Séance du jour", "32 min · Haut du corps"],
          ["trending-up", "Progression", "+12 % ce mois-ci"],
        ],
      },
    },
    {
      id: "gaming",
      icon: "gamepad-2",
      label: "Gaming",
      idea: {
        name: "ClipForge",
        accent: "#7C5CFF",
        tagline: "Tes meilleurs clips, montés par l'IA.",
        sub: "Importe ta partie, récupère des clips prêts pour TikTok en un clic.",
        features: [
          ["crosshair", "Highlights détectés", "Kills, clutchs et fails"],
          ["captions", "Sous-titres auto", "Dans ta langue"],
          ["smartphone", "Export TikTok", "Au bon format"],
        ],
        floats: [
          ["clapperboard", "3 clips prêts", "Montage terminé"],
          ["eye", "+48 k vues", "Sur ton dernier clip"],
        ],
      },
    },
    {
      id: "musique",
      icon: "headphones",
      label: "Musique",
      idea: {
        name: "BeatMate",
        accent: "#FF3D7F",
        tagline: "Ta prochaine prod en 5 minutes.",
        sub: "Des boucles, des accords et des mélodies générés pour ton style.",
        features: [
          ["drum", "Boucles uniques", "Libres de droits"],
          ["piano", "Accords intelligents", "Toujours justes"],
          ["download", "Export WAV et MIDI", "Direct dans ton logiciel"],
        ],
        floats: [
          ["music", "Nouvelle boucle", "92 BPM · La mineur"],
          ["flame", "Top 10", "Des prods de la semaine"],
        ],
      },
    },
    {
      id: "cuisine",
      icon: "chef-hat",
      label: "Cuisine",
      idea: {
        name: "FrigoChef",
        accent: "#FF8A00",
        tagline: "Des recettes avec ce qu'il y a dans ton frigo.",
        sub: "Prends ton frigo en photo : l'IA te propose 3 recettes en 10 secondes.",
        features: [
          ["camera", "Photo du frigo", "Ingrédients reconnus"],
          ["timer", "Prêt en 20 min", "Des recettes simples"],
          ["shopping-cart", "Liste de courses", "Générée pour toi"],
        ],
        floats: [
          ["cooking-pot", "Recette trouvée", "Curry de légumes · 20 min"],
          ["recycle", "Zéro gaspi", "4 ingrédients sauvés"],
        ],
      },
    },
    {
      id: "voyage",
      icon: "plane",
      label: "Voyage",
      idea: {
        name: "TripGenie",
        accent: "#0EA5E9",
        tagline: "Ton voyage parfait, planifié en 30 secondes.",
        sub: "Vols, hôtels et activités réunis dans un itinéraire jour par jour.",
        features: [
          ["map", "Itinéraire jour par jour", "Optimisé pour toi"],
          ["badge-percent", "Bons plans", "Les meilleurs prix"],
          ["wifi-off", "Hors ligne", "Partout dans le monde"],
        ],
        floats: [
          ["map-pin", "Lisbonne · 4 jours", "Itinéraire prêt"],
          ["badge-percent", "−32 %", "Sur ton vol"],
        ],
      },
    },
    {
      id: "mode",
      icon: "shirt",
      label: "Mode",
      idea: {
        name: "DressMe",
        accent: "#E0459B",
        tagline: "Ton styliste perso, chaque matin.",
        sub: "L'IA compose tes tenues avec les vêtements que tu as déjà.",
        features: [
          ["shirt", "Tenue du jour", "Selon la météo"],
          ["shopping-bag", "Dressing virtuel", "Tout ton placard"],
          ["sparkles", "Conseils de style", "Comme un pro"],
        ],
        floats: [
          ["shirt", "Tenue du jour", "Look casual · 18 °C"],
          ["heart", "4,9/5", "Note des membres"],
        ],
      },
    },
    {
      id: "finance",
      icon: "trending-up",
      label: "Finance",
      idea: {
        name: "Budgy",
        accent: "#10B981",
        tagline: "Ton budget, enfin sous contrôle.",
        sub: "Connecte tes comptes : l'IA trie tes dépenses et te dit où économiser.",
        features: [
          ["landmark", "Comptes connectés", "Toutes tes banques"],
          ["receipt", "Dépenses triées", "Automatiquement"],
          ["target", "Objectifs d'épargne", "Atteints plus vite"],
        ],
        floats: [
          ["piggy-bank", "+240 € épargnés", "Ce mois-ci"],
          ["trending-down", "Abonnements", "3 inutiles trouvés"],
        ],
      },
    },
    {
      id: "animaux",
      icon: "paw-print",
      label: "Animaux",
      idea: {
        name: "PawPal",
        accent: "#F59E0B",
        tagline: "La santé de ton animal, dans ta poche.",
        sub: "Vaccins, rappels, alimentation : tout est suivi, et l'IA répond à tes questions.",
        features: [
          ["syringe", "Rappels de vaccins", "Jamais en retard"],
          ["bone", "Alimentation", "Dosée pour lui"],
          ["stethoscope", "Véto IA", "Réponse immédiate"],
        ],
        floats: [
          ["bell", "Rappel vaccin", "Dans 3 jours"],
          ["bone", "Repas du soir", "120 g de croquettes"],
        ],
      },
    },
    {
      id: "cinema",
      icon: "clapperboard",
      label: "Cinéma",
      idea: {
        name: "CinéMatch",
        accent: "#EF4444",
        tagline: "Le film parfait pour ce soir, en 10 secondes.",
        sub: "Dis-nous ton humeur : on te trouve le film et la plateforme où le voir.",
        features: [
          ["popcorn", "Recos sur mesure", "Selon ton humeur"],
          ["tv", "Toutes les plateformes", "Netflix, Prime, Disney+"],
          ["users", "Mode duo", "Fini les débats"],
        ],
        floats: [
          ["popcorn", "Ce soir", "Thriller · 1 h 52"],
          ["star", "97 % match", "Avec tes goûts"],
        ],
      },
    },
  ];

  // `reply`: what the coach answers under the picked row, as in the real onboarding (AnswerPanel).
  const TIMES = [
    {
      id: "30m",
      icon: "zap",
      label: "30 min par jour",
      note: "Entre deux trucs",
      short: "30 min / jour",
      reply: "Parfait pour commencer : une seule tâche courte par jour, et ton SaaS avance quand même.",
    },
    {
      id: "1h",
      icon: "coffee",
      label: "1 h par jour",
      note: "Le soir, tranquille",
      short: "1 h / jour",
      reply: "Super rythme : assez pour avancer chaque jour, sans t'épuiser.",
    },
    {
      id: "2h",
      icon: "flame",
      label: "2 h par jour",
      note: "Je suis motivé",
      short: "2 h / jour",
      reply: "Avec 2 h par jour, tu avances vite. On remplit tes journées avec ce qui compte le plus.",
    },
    {
      id: "3h",
      icon: "rocket",
      label: "3 h et plus",
      note: "Je veux tout donner",
      short: "3 h+ / jour",
      reply: "Tu peux t'y mettre à fond. Ton plan sera précis, jour par jour.",
    },
    {
      id: "we",
      icon: "calendar-days",
      label: "Le week-end",
      note: "Quand j'ai du temps",
      short: "Le week-end",
      reply: "Le week-end suffit pour démarrer : on regroupe tes tâches sur tes jours libres.",
    },
  ];

  const BANKS = [
    {
      id: "revolut",
      name: "Revolut",
      bg: "linear-gradient(150deg, #33373e, #0b0c0f)",
      svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z"/></svg>',
    },
    {
      id: "boursorama",
      name: "Boursorama",
      bg: "#ffffff",
      svg: '<svg viewBox="-5 -2 75 80" style="width:66%;height:66%"><path fill="#003883" d="M64.677.579c-.001-.018-.007-.034-.01-.05-.004-.016-.005-.032-.009-.046a.627.627 0 0 0-.02-.053l-.013-.037c-.01-.02-.02-.035-.03-.053-.006-.008-.011-.019-.016-.028-.01-.017-.025-.033-.037-.05l-.02-.026a.424.424 0 0 0-.04-.04c-.01-.009-.016-.018-.025-.025-.014-.012-.03-.023-.046-.035l-.028-.021c-.014-.01-.03-.018-.046-.027l-.035-.02c-.013-.006-.027-.01-.04-.015-.017-.007-.03-.014-.047-.02l-.038-.01c-.018-.005-.034-.01-.052-.012l-.044-.006C64.065.004 64.048 0 64.032 0S64 0 63.984.002c-.016 0-.031 0-.047.002-.018.001-.034.007-.051.01-.015.004-.03.005-.044.009a.258.258 0 0 0-.048.018c-.016.005-.032.01-.048.017-.012.005-.024.014-.039.021-.017.01-.037.018-.054.03L32.818 19.837l5.987 18.545 19.472-1.6L64.672.785c.004-.018.004-.035.005-.053.002-.018.006-.035.006-.053 0-.016 0-.03-.002-.046 0-.02 0-.037-.004-.056v.002Z"/><path fill="#D20073" d="M50.633 75.007c.144.446.79.402.87-.06l6.777-38.169-19.472 1.6 11.825 36.629Z"/><path fill="#009DE0" d="m32.822 19.834 5.986 18.544-38.32 3.15c-.467.039-.673-.575-.278-.827l32.614-20.866-.002-.002Z"/></svg>',
    },
    {
      id: "credit-agricole",
      name: "Crédit Agricole",
      bg: "#ffffff",
      svg: '<svg viewBox="-6.684 -56.434 335.668 335.668" style="width:74%;height:74%"><path fill="#006645" d="m 211.79999,103.7 -20,-50.5 -26,55.8 c -8.8,17.6 -37.6,22.7 -57.7,25.5 l 3.7,-7.5 58.2,-109.9 h 45.4 l 32.5,66.7 14.3,31.6 29.4,63.5 -20.3,-0.1 -15.8,-0.1 c -6.6,0.1 -13.1,-0.4 -15.9,-7.4 l -5.6,-13.6 -9.4,-22.9 z"/><rect fill="#006645" x="0" y="197" width="299.79999" height="25.799999"/><path fill="#e20613" d="m 321.69999,0 v 0 l -12,6.4 -42.6,22.4 c 0,0 -14.7,7.9 -24.1,9.9 l 0.1,0.1 -0.1,-0.1 c 2.6,8.1 5.2,13.3 7.7,17.4 0.7,1.2 1.8,2.2 3,2.9 1.6,1 3.4,1.5 5.3,1.6 1.9,0.1 3.8,-0.3 5.6,-1.2 l 57.3,-30.8 z"/><path fill="#008a91" d="m 248.39999,84 -36.1,20 c -45.3,24.7 -104.2,48.6 -155.199996,44.4 -21.6,-1.8 -34.5,-9.9 -33.3,-23.7 1.4,-15.7 15,-32.2 38.8,-48.7 18.2,-12.6 34.2,-19.5 42.599996,-22.4 11,-3.9 20.4,-5.6 30.4,-6.1 2.4,0 4.7,0.2 6.4,0.7 0,-0.3 -0.1,-0.6 -0.2,-0.9 v 0 c -4.6,-29.3 -12.2,-33.2 -24.3,-32.8 C 83.699994,15.6 41.299994,38.9 18.799994,66 6.6999939,80.5 0.5999939,97.9 0.2999939,110.3 c -0.4,19 7.1,44.9 30.3000001,58.1 25.8,14.7 62.7,13.7 96.199996,6.1 36,-8.1 67.5,-23.7 98.4,-39.4 l 37.5,-19.5 59.4,-34.1 0.2,-37.1 z"/></svg>',
    },
    {
      id: "paypal",
      name: "PayPal",
      bg: "#ffffff",
      svg: '<svg viewBox="0 0 24 24"><path fill="#003087" d="M7.016 19.198h-4.2a.562.562 0 0 1-.555-.65L5.093.584A.692.692 0 0 1 5.776 0h7.222c3.417 0 5.904 2.488 5.846 5.5-.006.25-.027.5-.066.747A6.794 6.794 0 0 1 12.071 12H8.743a.69.69 0 0 0-.682.583l-.325 2.056-.013.083-.692 4.39-.015.087z"/><path fill="#009cde" d="M19.79 6.142c-.01.087-.01.175-.023.261a7.76 7.76 0 0 1-7.695 6.598H9.007l-.283 1.795-.013.083-.692 4.39-.134.843-.014.088H6.86l-.497 3.15a.562.562 0 0 0 .555.65h3.612c.34 0 .63-.249.683-.585l.952-6.031a.692.692 0 0 1 .683-.584h2.126a6.793 6.793 0 0 0 6.707-5.752c.306-1.95-.466-3.744-1.89-4.906z"/></svg>',
    },
    {
      id: "lydia",
      name: "Lydia",
      bg: "linear-gradient(150deg, #3a95ff, #0061e0)",
      svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.895 17.611a.421.421 0 01-.168.035h-1.155a.608.608 0 01-.56-.377l-4-9.613-3.991 9.607a.61.61 0 01-.56.377H6.273a.42.42 0 01-.385-.59L10.91 5.575a.793.793 0 01.726-.475h.748a.792.792 0 01.726.48l5.003 11.482a.42.42 0 01-.218.549z"/></svg>',
    },
    {
      id: "n26",
      name: "N26",
      bg: "linear-gradient(150deg, #5cc0aa, #2a8a77)",
      svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M0 3.803v1.195h7.436V3.803H0zM12.69 7.29c-2.034 0-3.038 1.252-3.038 2.684 0 .234.027.468.092.728l1.393.135a3.697 3.697 0 0 1-.09-.793c0-1.072.71-1.586 1.598-1.586.866 0 1.507.485 1.507 1.652 0 1.186-.58 1.995-1.464 2.88-.925.923-2.4 2.027-3.112 2.534v1.092h6.135v-1.195h-4.168c.695-.48 1.69-1.279 2.133-1.72.502-.503 1.931-1.794 1.931-3.636 0-1.903-1.24-2.775-2.918-2.775zm8.34 0c-1.976 0-3.454 1.517-3.454 4.916 0 3.017 1.233 4.508 3.356 4.508 1.754 0 3.068-1.198 3.068-3.172 0-1.542-.823-3.066-2.793-3.066-1.1 0-1.884.51-2.281 1.263 0-1.78.62-3.33 2.094-3.33.937 0 1.309.538 1.507 1.422l1.366-.271c-.321-1.527-1.292-2.27-2.864-2.27zM.075 7.389v9.228h1.33v-6.312c0-.56-.013-.898-.039-1.223h.026c.136.372.298.699.539 1.123l3.732 6.412h1.69V7.39H6.04v6.31c0 .56.013.898.04 1.223h-.028a7.252 7.252 0 0 0-.537-1.123L1.783 7.389H.076zm20.817 4.185c1.114 0 1.744.822 1.744 1.992 0 1.256-.717 2.034-1.701 2.034-1.09 0-1.843-1.001-1.973-2.329.33-1.133 1.063-1.697 1.93-1.697zM0 19.008v1.19h7.436v-1.19H0z"/></svg>',
    },
  ];

  /** Monthly goal: the slider's stops, the one it starts on, and the line under it. */
  const GOAL = {
    stops: [500, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 20000, 50000],
    start: 3000,
    tiers: [
      { upTo: 1000, word: "Un bon complément", note: "De quoi payer ton loyer chaque mois." },
      { upTo: 2000, word: "Un deuxième salaire", note: "Tu doubles tes revenus sans quitter ton job." },
      { upTo: 5000, word: "Quitter ton job", note: "Tu vis de ton SaaS, à ton rythme." },
      { upTo: 10000, word: "La liberté", note: "Tu travailles d'où tu veux, quand tu veux." },
      { upTo: Infinity, word: "Mode légende", note: "Ton SaaS tourne pendant que tu dors." },
    ],
  };

  return { PASSIONS, TIMES, BANKS, GOAL };
})();
