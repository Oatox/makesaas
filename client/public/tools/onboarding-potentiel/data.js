/*
 * Content of the second fake onboarding (nothing is computed: it is a show to film).
 * - IDEAS: the SaaS the potential and the site are about. They are the first fake onboarding's ideas
 *   (../onboarding/data.js), with their price. I (or the bulb button) goes to
 *   the next one, ?idea=<id> picks one.
 * - The six screens: GOAL, PAYMENTS, DEADLINES, FACE, MARKETING, then the potential (POTENTIAL).
 */
window.FO2_DATA = (() => {
  const { PASSIONS, BANKS } = window.FO_DATA;
  const bank = (id) => BANKS.find((b) => b.id === id);

  /** Each idea's monthly price, in euros (on the site and its first subscription). */
  const PRICES = {
    gaming: 7.99,
    sport: 9.99,
    musique: 9.99,
    cuisine: 4.99,
    voyage: 6.99,
    mode: 5.99,
    finance: 4.99,
    animaux: 4.99,
    cinema: 3.99,
  };

  // ClipForge first: clips cut by AI, the closest to the video this onboarding comes from.
  const ORDER = ["gaming", "sport", "musique", "cuisine", "voyage", "mode", "finance", "animaux", "cinema"];
  const IDEAS = ORDER.map((id) => {
    const passion = PASSIONS.find((p) => p.id === id);
    return { id, icon: passion.icon, ...passion.idea, price: PRICES[id] };
  });

  /** 1. The monthly goal: a free slider from 0 to `max` (odd amounts look computed), "soit … par jour". */
  const GOAL = { max: 30000, start: 0 };

  /**
   * 2. Where the payments land. Stripe's "S" is Simple Icons' (CC0), Whop's symbol is its own (from
   * whop.com). PayPal and Revolut come from the first fake onboarding.
   */
  const PAYMENTS = [
    {
      id: "stripe",
      name: "Stripe",
      note: "cartes, virements, abonnements",
      bg: "linear-gradient(150deg, #7a73ff, #635bff)",
      svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/></svg>',
    },
    { ...bank("paypal"), note: "le plus connu des acheteurs" },
    { ...bank("revolut"), note: "encaissement rapide, frais bas" },
    {
      id: "whop",
      name: "Whop",
      note: "paiement et accès gérés ensemble",
      bg: "linear-gradient(150deg, #ff6a3d, #fa4616)",
      // Whop's symbol (whop.com's logo, its mark only), white on its orange as its app icon.
      svg: '<svg viewBox="0 -9.5 39.5 39.5"><path fill="#fff" d="M6.29654 0.0205078C3.70387 0.0205078 1.92397 1.15863 0.565903 2.45194C0.565903 2.45194 0.0206171 2.96927 0.0309055 2.98996L5.71011 8.70125L11.3893 2.98996C10.309 1.50006 8.28221 0.0205078 6.29654 0.0205078Z"/><path fill="#fff" d="M20.3194 0.0205078C17.7267 0.0205078 15.9468 1.16897 14.5888 2.45194C14.5888 2.45194 14.0949 2.95892 14.0641 2.98996L7.04736 10.0463L12.7163 15.7472L25.4019 2.98996C24.3216 1.50006 22.2948 0.0205078 20.3194 0.0205078Z"/><path fill="#fff" d="M34.3738 0.0205078C31.7811 0.0205078 30.0012 1.16897 28.6431 2.45194C28.6431 2.45194 28.1287 2.95893 28.1081 2.98997L14.0645 17.1026L15.546 18.5925C17.8403 20.8998 21.6059 20.8998 23.9105 18.5925L39.4357 2.98997C38.3657 1.50006 36.3594 0.0205078 34.3738 0.0205078Z"/></svg>',
    },
  ];

  /** 3. When the first sales must come; `soon` is when the potential screen says it can come. */
  const DEADLINES = [
    { id: "today", label: "Aujourd'hui", note: "je veux mes premières ventes aujourd'hui", said: "aujourd'hui", soon: "ce soir" },
    { id: "week", label: "Cette semaine", note: "je veux mes premières ventes cette semaine", said: "cette semaine", soon: "dès demain" },
    { id: "month", label: "Dans le mois", note: "je veux mes premières ventes dans le mois", said: "dans le mois", soon: "cette semaine" },
  ];

  /** 4. Behind the phone, without showing up? */
  const FACE = [
    { id: "hidden", label: "Oui", note: "ni caméra, ni appel, ni visage à l'écran" },
    { id: "shown", label: "Non", note: "me montrer ne me dérange pas" },
  ];

  /** 5. Done for them? */
  const MARKETING = [
    { id: "auto", label: "Oui", note: "l'IA crée ton site, tes vidéos et ton plan à ta place" },
    { id: "self", label: "Non", note: "je préfère le faire moi-même" },
  ];

  /**
   * 6. The potential: the goal times a share that grows with the answers (from 0.68 to 0.85), so it
   * stays under the goal, as in the video.
   */
  const POTENTIAL = {
    base: 0.56,
    deadline: { today: 0.12, week: 0.08, month: 0.04 },
    face: { hidden: 0.04, shown: 0.07 },
    marketing: { auto: 0.07, self: 0.03 },
    payment: { stripe: 0.03, whop: 0.03, paypal: 0.02, revolut: 0.01 },
  };

  return { IDEAS, GOAL, PAYMENTS, DEADLINES, FACE, MARKETING, POTENTIAL };
})();
