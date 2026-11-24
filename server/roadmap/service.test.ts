import { describe, expect, test } from "bun:test";
import { canUntickMission, currentStageIndex, isCustomDomain, paymentLinkBodySchema, stageProgress, ticksAfter } from "@shared/roadmap";
import { missionTime, roadmapStagesFor, stageTimeLeft } from "@shared/roadmap-missions";
import {
  buildAccountsPrompt,
  buildAppPrompt,
  buildLandingPrompt,
  buildLogoPrompt,
  buildOnboardingPrompt,
  buildPaymentPrompt,
  buildReviewPrompt,
  chatGptUrl,
  missionPromptText,
} from "@shared/roadmap-prompts";
import { observedMissions, withEarlierBuildMissions, type MissionFacts } from "./service";

const CREATED = "2026-11-20T10:00:00.000Z";
const NOW = "2026-11-23T15:00:00.000Z";
const STAGES = roadmapStagesFor(10_000);

/** A year of daily values from 2025-11-26 (day 359 is 2026-11-20), zero but on the days given. */
const series = (days: Record<number, number>, carry = false) => {
  const values: number[] = [];
  let last = 0;
  for (let day = 0; day < 365; day++) {
    if (days[day] !== undefined) last = days[day];
    values.push(days[day] ?? (carry ? last : 0));
  }
  return values;
};

const facts = (overrides: Partial<MissionFacts> = {}): MissionFacts => ({
  saasCreatedAt: CREATED,
  hasCustomDomain: false,
  hasLogo: false,
  hasPaymentLink: false,
  hasPaymentAccount: false,
  tiktokAccounts: 0,
  videoDates: [],
  revenue: null,
  rates: null,
  now: NOW,
  ...overrides,
});

describe("roadmapStagesFor", () => {
  test("the base stages, the MRR tiers under the goal, then the goal", () => {
    const keys = (goal: number) => roadmapStagesFor(goal).map((stage) => stage.key);
    expect(keys(5_000)).toEqual(["idea", "brand", "build", "payment", "video", "customer", "mrr_100", "mrr_1000", "mrr_2500", "mrr_5000"]);
    expect(keys(3_000).slice(-2)).toEqual(["mrr_2500", "mrr_3000"]);
    expect(roadmapStagesFor(3_000).at(-1)?.isGoal).toBe(true);
    // No goal (or a wrong one): 10 000 € by default.
    expect(keys(Number.NaN).at(-1)).toBe("mrr_10000");
  });

  test("every mission key is unique and says its stage", () => {
    for (const goal of [1_000, 10_000, 100_000]) {
      const stages = roadmapStagesFor(goal);
      const keys = stages.flatMap((stage) => stage.missions.map((mission) => mission.key));
      expect(new Set(keys).size).toBe(keys.length);
      for (const stage of stages) for (const mission of stage.missions) expect(mission.key.startsWith(`${stage.key}:`)).toBe(true);
    }
  });

  test("every mission is a few short steps, and says how long it takes unless it happens on its own", () => {
    for (const stage of roadmapStagesFor(100_000)) {
      for (const mission of stage.missions) {
        expect(mission.steps.length).toBeGreaterThan(0);
        expect(mission.steps.length).toBeLessThanOrEqual(4);
        for (const step of mission.steps) expect(step.text.length).toBeLessThanOrEqual(140);
        const onItsOwn = mission.check.kind === "first_payment" || mission.check.kind === "mrr";
        expect(missionTime(mission) === null).toBe(onItsOwn);
      }
    }
  });

  test("the time of a mission, and what is left of a stage", () => {
    const stage = (key: string) => STAGES.find((item) => item.key === key)!;
    expect(missionTime(stage("brand").missions[0])).toBe("5 min");
    expect(stageTimeLeft(stage("brand"), {})).toBe("≈ 5 min");
    expect(stageTimeLeft(stage("build"), {})).toBe("≈ 2 h 09");
    expect(stageTimeLeft(stage("build"), { "build:claude": { at: NOW, source: "declared" } })).toBe("≈ 2 h 07");
    // A mission over days: no total.
    expect(stageTimeLeft(stage("customer"), {})).toBeNull();
    expect(missionTime(stage("customer").missions[0])).toBe("7 jours");
  });

  test("every MRR stage ends on its amount, checked from the data", () => {
    for (const stage of STAGES.filter((item) => item.mrr)) {
      expect(stage.missions.at(-1)?.check).toEqual({ kind: "mrr", amount: stage.mrr });
      expect(stage.missions.length).toBeGreaterThan(1);
    }
  });
});

describe("isCustomDomain", () => {
  test("a domain of its own, not the free address of Base44 or another host", () => {
    expect(isCustomDomain("https://fitlo.com")).toBe(true);
    expect(isCustomDomain("https://app.fitlo.fr/start")).toBe(true);
    expect(isCustomDomain("https://fitlo-948908fb.base44.app")).toBe(false);
    expect(isCustomDomain("https://FITLO.BASE44.APP")).toBe(false);
    expect(isCustomDomain("https://fitlo.netlify.app")).toBe(false);
    // A domain that only ends like a free host is still its own.
    expect(isCustomDomain("https://mybase44.app")).toBe(true);
    expect(isCustomDomain(null)).toBe(false);
    expect(isCustomDomain("pas une adresse")).toBe(false);
  });
});

describe("observedMissions", () => {
  test("a new SaaS: only its idea", () => {
    expect(observedMissions(facts(), STAGES)).toEqual({ "idea:chosen": { at: CREATED, source: "declared" } });
  });

  test("the app's address on its own domain: its domain bought, its publishing still the member's to tick", () => {
    const done = observedMissions(facts({ hasCustomDomain: true }), STAGES);
    expect(done["build:domain"]).toEqual({ at: NOW, source: "declared" });
    expect(done["build:online"]).toBeUndefined();
  });

  test("the accounts and the videos, dated by the Nth video", () => {
    const videoDates = Array.from({ length: 7 }, (_, i) => `2026-11-${String(19 + i).padStart(2, "0")}T18:00:00.000Z`);
    const done = observedMissions(facts({ hasPaymentAccount: true, tiktokAccounts: 1, videoDates }), STAGES);
    // No address on a domain of its own yet.
    expect(done["build:domain"]).toBeUndefined();
    expect(done["payment:connect"]).toEqual({ at: NOW, source: "observed" });
    expect(done["video:track"]?.source).toBe("observed");
    expect(done["video:posted"]).toEqual({ at: videoDates[0], source: "before" });
    expect(done["customer:7_videos"]).toEqual({ at: videoDates[6], source: "observed" });
    expect(done["mrr_100:30_videos"]).toBeUndefined();
    expect(done["mrr_1000:2_accounts"]).toBeUndefined();
    // Manual missions are only ticked by the member.
    expect(done["build:claude"]).toBeUndefined();
    expect(done["build:online"]).toBeUndefined();
    expect(done["brand:logo"]).toBeUndefined();
  });

  test("the logo, once the SaaS has one", () => {
    const done = observedMissions(facts({ hasLogo: true }), STAGES);
    expect(done["brand:logo"]).toEqual({ at: NOW, source: "observed" });
  });

  test("the Whop shop, once the member gave its payment link", () => {
    expect(observedMissions(facts(), STAGES)["payment:whop"]).toBeUndefined();
    expect(observedMissions(facts({ hasPaymentLink: true }), STAGES)["payment:whop"]).toEqual({ at: NOW, source: "declared" });
  });

  test("a payment link is a Whop address, written as pasted", () => {
    const parse = (url: string) => paymentLinkBodySchema.safeParse({ saasId: "00000000-0000-4000-8000-000000000000", url });
    expect(parse("https://whop.com/checkout/plan_abc123/").data?.url).toBe("https://whop.com/checkout/plan_abc123/");
    expect(parse("whop.com/checkout/plan_abc123").data?.url).toBe("https://whop.com/checkout/plan_abc123");
    expect(parse("http://whop.com/fitlo/").data?.url).toBe("https://whop.com/fitlo/");
    expect(parse("https://WHOP.com").data?.url).toBe("https://whop.com/");
    expect(parse("https://sandbox.whop.com/checkout/plan_abc").success).toBe(true);
    expect(parse("https://whop.com.evil.example/checkout").success).toBe(false);
    expect(parse("https://notwhop.com/checkout").success).toBe(false);
    expect(parse("https://buy.stripe.com/abc").success).toBe(false);
  });

  test("the first payment and the MRR, compared in euros", () => {
    const done = observedMissions(
      facts({
        revenue: { currency: "USD", seriesStart: "2025-11-26", revenue: series({ 360: 29 }), mrr: series({ 360: 105, 362: 1_200 }, true) },
        rates: { EUR: 1, USD: 1.1 },
      }),
      STAGES,
    );
    expect(done["customer:first_payment"]).toEqual({ at: "2026-11-21T12:00:00.000Z", source: "observed" });
    // 105 $ is less than 100 €; 1 200 $ is more.
    expect(done["mrr_100:reached"]?.at).toBe("2026-11-23T12:00:00.000Z");
    expect(done["mrr_1000:reached"]?.at).toBe("2026-11-23T12:00:00.000Z");
    expect(done["mrr_2500:reached"]).toBeUndefined();
  });
});

describe("stage progress", () => {
  test("unticking a mission unticks the ones ticked after it", () => {
    const [first, second, third] = STAGES.flatMap((stage) => stage.missions)
      .filter((mission) => mission.check.kind === "manual")
      .map((mission) => mission.key);
    const done = Object.fromEntries([first, second, third].map((key) => [key, { at: NOW, source: "declared" as const }]));
    expect(ticksAfter(STAGES, done, first)).toEqual([second, third]);
    expect(ticksAfter(STAGES, done, third)).toEqual([]);
    expect(canUntickMission(STAGES, done, first)).toBe(false);
    expect(canUntickMission(STAGES, done, third)).toBe(true);
  });

  test("a stage is done when all its missions are; the current one is the first not done", () => {
    const done = { "idea:chosen": { at: CREATED, source: "declared" as const }, "build:claude": { at: NOW, source: "declared" as const } };
    expect(stageProgress(STAGES[0], done)).toEqual({ done: 1, total: 1, complete: true });
    expect(stageProgress(STAGES[1], done)).toEqual({ done: 0, total: 1, complete: false });
    expect(stageProgress(STAGES[2], done)).toEqual({ done: 1, total: 9, complete: false });
    expect(currentStageIndex(STAGES, done)).toBe(1);
  });
});

describe("prompts", () => {
  const project = { name: "Fitlo", description: "Ton programme de muscu en 3 questions.", audience: "Étudiants", problem: "Pas de programme clair.", price: 9 };

  const feature = "Tes créneaux et ton niveau → ton programme de la semaine";

  test("the first prompt creates the app: its project, its home page and legal pages, its logo and colors", () => {
    const prompt = buildLandingPrompt({ ...project, feature, logoUrl: "https://files.example.com/u/s/logo/abc.png" });
    expect(prompt).toContain("Crée une app web appelée Fitlo, pensée d'abord pour le téléphone, avec tous ses textes en français.");
    expect(prompt).toContain("L'idée : Ton programme de muscu en 3 questions.");
    expect(prompt).toContain(`Sa fonctionnalité principale : ${feature}`);
    expect(prompt).toContain("Pour qui : Étudiants");
    expect(prompt).toContain("3 situations que vit ce public");
    // No pricing section on the home page.
    expect(prompt).not.toContain("Tarifs");
    expect(prompt).not.toContain("€");
    expect(prompt).toContain("Mentions légales, CGU et Politique de confidentialité");
    expect(prompt).toContain("une page /commencer qui affiche « Bientôt disponible »");
    expect(prompt).toContain("inspire-toi de ce modèle : https://saas-boilerplate-0bbac609.base44.app (");
    expect(prompt).toContain("Mon logo est cette image : https://files.example.com/u/s/logo/abc.png");
    // Learned from a first app built with these prompts: its own copy of the logo, one voice, French everywhere.
    expect(prompt).toContain("Importe-la dans les fichiers de l'app et utilise ta copie");
    expect(prompt).toContain("l'app tutoie l'utilisateur, partout et toujours");
    expect(prompt).toContain("tient sur une seule ligne sur téléphone");
    expect(prompt).toContain("Une page introuvable (404) en français");
    expect(prompt).toContain('lang="fr"');
    expect(prompt).toContain("« Nom de la page · Fitlo »");
    expect(prompt).toContain("les couleurs de mon logo");
    // No logo yet: the app's name instead.
    expect(buildLandingPrompt(project)).toContain("j'ajouterai mon logo plus tard");
    expect(buildLandingPrompt(project)).not.toContain("Mon logo est cette image");
  });

  test("the accounts prompt: Base44's login pages, settings, the Pro field only admins change, the admin page", () => {
    const prompt = buildAccountsPrompt(project);
    expect(prompt).toContain("Ajoute à Fitlo les comptes utilisateurs.");
    expect(prompt).toContain("les pages de connexion de Base44");
    expect(prompt).toContain("la connexion avec Google");
    expect(prompt).toContain("inspire-toi de https://saas-boilerplate-0bbac609.base44.app/login");
    expect(prompt).toContain("tutoient l'utilisateur");
    expect(prompt).toContain("« Connexion · Fitlo »");
    expect(prompt).toContain("« En créant ton compte, tu acceptes les CGU et la politique de confidentialité »");
    expect(prompt).toContain("« Se connecter » devient un petit lien discret");
    expect(prompt).toContain("supprimer son compte après confirmation");
    expect(prompt).toContain("un champ is_subscriber (non par défaut) que seuls les administrateurs peuvent modifier");
    expect(prompt).toMatch(/l'offre Pro à 9\s€ par mois/);
    expect(prompt).toContain("« Passer en Pro » ou « Repasser en Gratuit »");
  });

  test("the onboarding and the core are built around the idea's main feature, else its pitch", () => {
    expect(buildOnboardingPrompt({ ...project, feature })).toContain(`(Fitlo : ${feature})`);
    expect(buildOnboardingPrompt(project)).toContain("(Fitlo : Ton programme de muscu en 3 questions)");
    // The paywall right after the questions, with the price, then the sign-up.
    expect(buildOnboardingPrompt(project)).toContain("3. Paywall : juste après, un écran d'abonnement en plein écran.");
    expect(buildOnboardingPrompt(project)).toMatch(/l'offre Pro à 9\s€ par mois, 4 avantages concrets/);
    expect(buildOnboardingPrompt(project)).toContain("« Débloquer mon résultat »");
    expect(buildOnboardingPrompt(project)).toContain("ce bouton reste visible en bas de l'écran, sans avoir à faire défiler");
    expect(buildOnboardingPrompt(project)).toContain("le vrai résultat complet n'est jamais dans la page");
    expect(buildOnboardingPrompt(project)).toContain("« ta musculation », pas « ton musculation »");
    expect(buildPaymentPrompt(project)).toContain("« Débloquer mon résultat »");
    expect(buildOnboardingPrompt(project)).toContain("onboarding_answers");
    expect(buildAppPrompt({ ...project, feature })).toContain(`le cœur de Fitlo dans l'espace connecté, sa fonctionnalité principale : ${feature}.`);
    expect(buildAppPrompt(project)).toContain("sa fonctionnalité principale : Ton programme de muscu en 3 questions.");
    expect(buildAppPrompt(project)).toContain("réservés aux abonnés Pro (is_subscriber) et aux administrateurs");
    // Learned from a first app: its core was the onboarding again, with a score made up from answers.
    expect(buildAppPrompt(project)).toContain("le résultat du parcours d'accueil ne la remplace pas");
    expect(buildAppPrompt(project)).toContain("la fonctionnalité principale, en premier et en grand");
    expect(buildAppPrompt(project)).toContain("n'affiche jamais un score, une mesure ou un chiffre que l'app n'a pas vraiment calculé");
    expect(buildAppPrompt(project)).toContain("tout ce qu'ils promettent, l'app le fait vraiment");
    expect(buildAppPrompt(project)).not.toContain("part de ses réponses du parcours d'accueil");
    // Each OneShotAPI call costs the member credits: a daily limit, announced, never "unlimited".
    expect(buildAppPrompt(project)).toContain("Fixe une limite d'utilisations par jour et par utilisateur, vérifiée par la fonction serveur");
    expect(buildAppPrompt(project)).toMatch(/au plus un quart de son abonnement \(9\s€ par mois\) en crédits/);
    expect(buildAppPrompt(project)).toContain("« Tu as atteint ta limite du jour, reviens demain »");
    expect(buildAppPrompt(project)).toContain("Nulle part l'app ne promet d'usage illimité.");
    expect(buildAppPrompt(project)).not.toContain("autant qu'il veut");
    expect(buildAccountsPrompt(project)).toContain("ne présente pas Gratuit comme une offre avec des fonctionnalités");
    // Pro users cancel on Whop, which deleting the account does not do.
    expect(buildPaymentPrompt(project)).toContain("« Gérer mon abonnement » vers son lien de gestion Whop (à défaut, ses commandes Whop : https://whop.com/@me/settings/orders/)");
    expect(buildPaymentPrompt(project)).toContain("supprimer ton compte ne l'arrête pas");
    // AI or an API goes through OneShotAPI, from a server function, with the member's key in the app's secrets.
    expect(buildAppPrompt(project)).toContain("utilise OneShotAPI");
    expect(buildAppPrompt(project)).toContain("https://api.oneshotapi.com");
    expect(buildAppPrompt(project)).toContain("https://oneshotapi.com/llms.txt");
    expect(buildAppPrompt(project)).toContain("dans les secrets de l'app sous le nom ONESHOT_API_KEY, jamais dans le code");
    expect(buildAppPrompt(project)).toContain("explique-moi simplement, étape par étape, comment l'obtenir");
    expect(buildAppPrompt(project)).toContain("https://oneshotapi.com/keys");
    expect(buildAppPrompt(project)).not.toContain("IA intégrée de Base44");
    expect(buildPaymentPrompt(project)).toContain("[COLLE TON LIEN DE PAIEMENT ICI]");
    expect(buildPaymentPrompt(project)).toMatch(/un abonnement à 9\s€ par mois/);
  });

  test("the idea's consumer price keeps its cents in every prompt", () => {
    const priced = { ...project, price: 9.99 };
    // Intl puts a narrow no-break space before the euro sign.
    expect(buildAccountsPrompt(priced)).toMatch(/l'offre Pro à 9,99\s€ par mois/);
    expect(buildOnboardingPrompt(priced)).toMatch(/l'offre Pro à 9,99\s€ par mois/);
    expect(buildPaymentPrompt(priced)).toMatch(/un abonnement à 9,99\s€ par mois/);
    expect(buildAppPrompt(priced)).toMatch(/un quart de son abonnement \(9,99\s€ par mois\)/);
  });

  test("a SaaS created by its name only still gets prompts", () => {
    const bare = { name: "Fitlo", description: null, audience: null, problem: null, price: null };
    expect(buildLandingPrompt(bare)).not.toContain("L'idée");
    expect(buildLandingPrompt(bare)).toContain("3 situations que vit mon public");
    expect(buildAccountsPrompt(bare)).toContain("Gratuit, ou l'offre Pro, un abonnement mensuel");
    expect(buildOnboardingPrompt(bare)).toContain("avant de lui préparer son résultat. Une question par écran");
    expect(buildAppPrompt(bare)).toContain("le cœur de Fitlo dans l'espace connecté, sa fonctionnalité principale, celle que promet la page d'accueil.");
    expect(buildAppPrompt(bare)).toContain("au plus un quart de son abonnement en crédits");
    expect(buildPaymentPrompt(bare)).toContain("un abonnement mensuel");
  });

  test("once the core is built, the build tasks before it are done too", () => {
    const built = { at: CREATED, source: "declared" as const };
    const done = withEarlierBuildMissions({ "build:first_version": built });
    expect(done["build:landing"]).toEqual({ at: CREATED, source: "observed" });
    expect(done["build:accounts"]).toEqual({ at: CREATED, source: "observed" });
    expect(done["build:onboarding"]).toEqual({ at: CREATED, source: "observed" });
    // Ticked by the member: kept as is.
    const ticked = withEarlierBuildMissions({ "build:first_version": built, "build:landing": { at: NOW, source: "declared" } });
    expect(ticked["build:landing"]).toEqual({ at: NOW, source: "declared" });
    // Not built yet: nothing added.
    expect(withEarlierBuildMissions({ "build:claude": built })).toEqual({ "build:claude": built });
  });

  test("« Valide ton app » comes right before publishing, and those who already published skip it", () => {
    const build = STAGES.find((stage) => stage.key === "build")!.missions.map((mission) => mission.key);
    expect(build.indexOf("build:review")).toBe(build.indexOf("build:online") - 1);
    expect(build.indexOf("build:review")).toBe(build.indexOf("build:customize") + 1);
    const published = { at: CREATED, source: "declared" as const };
    expect(withEarlierBuildMissions({ "build:online": published })["build:review"]).toEqual({ at: CREATED, source: "observed" });
    expect(withEarlierBuildMissions({ "build:customize": published })["build:review"]).toBeUndefined();
  });

  test("the payment prompt: a checkout bound to the user, then the signed Whop webhook turns them Pro", () => {
    const prompt = buildPaymentPrompt({ ...project, price: 9.99 });
    expect(prompt).toMatch(/Mon offre sur Whop : un abonnement à 9,99\s€ par mois\. Son lien de paiement : \[COLLE TON LIEN DE PAIEMENT ICI\]/);
    // Once given in the Whop shop's task, the member's link replaces the placeholder.
    const linked = buildPaymentPrompt({ ...project, paymentLink: "https://whop.com/checkout/plan_abc123/" });
    expect(linked).toContain("Son lien de paiement : https://whop.com/checkout/plan_abc123/\n");
    expect(linked).not.toContain("[COLLE TON LIEN");
    expect(prompt).toContain("L'identifiant de cette offre (plan_…) est dans ce lien ; s'il n'y est pas, demande-le-moi.");
    // The server alone talks to Whop, with the member's key in the app's secrets.
    expect(prompt).toContain("https://api.whop.com/api/v1");
    expect(prompt).toContain("https://docs.whop.com/developer/guides/webhooks.md");
    expect(prompt).toContain("sous le nom WHOP_API_KEY, jamais dans le code");
    // The checkout carries the user, comes back to the app.
    expect(prompt).toContain("une checkout configuration sur mon offre, avec son identifiant d'utilisateur dans les metadata et un retour vers /app");
    // The webhook: signed, the membership read again, the access statuses of Whop.
    expect(prompt).toContain("vérifie leur signature sur le corps brut de la requête avec le secret WHOP_WEBHOOK_SECRET");
    expect(prompt).toContain("À chaque événement membership.updated");
    expect(prompt).toContain("elle relit cet abonnement auprès de l'API Whop");
    expect(prompt).toContain("met is_subscriber à oui si le statut est active, trialing, past_due ou completed, et à non sinon");
    expect(prompt).toContain("« Paiement reçu, on active ton accès… »");
    // The member gets the key now; the webhook once the app is published, its secret added by hand.
    expect(prompt).toContain("sur https://whop.com/dashboard/developer, dans Account API Keys");
    expect(prompt).toContain("donne-moi l'adresse exacte de ton webhook");
    expect(prompt).toContain("ne me le demande pas maintenant");
    // Nobody is turned Pro by hand anymore.
    expect(prompt).not.toContain("nouvel onglet");
  });

  test("the payment tasks: the Whop shop, the prompt, the webhook before the test, then the revenue", () => {
    const payment = STAGES.find((stage) => stage.key === "payment")!.missions;
    expect(payment.map((mission) => mission.key)).toEqual(["payment:whop", "payment:in_app", "payment:webhook", "payment:test", "payment:connect"]);
    const steps = (key: string) => payment.find((mission) => mission.key === key)!.steps.map((step) => step.text).join("\n");
    expect(steps("payment:whop")).toContain("**Use Whop for payment processing only**");
    // The shop's task asks for its payment link, and is done once it is given.
    const shop = payment.find((mission) => mission.key === "payment:whop")!;
    expect(shop.steps.at(-1)?.action).toEqual({ kind: "payment_link" });
    expect(shop.check).toEqual({ kind: "payment_link" });
    expect(steps("payment:in_app")).toContain("ton lien de paiement Whop est déjà dedans");
    expect(steps("payment:webhook")).toContain("coche **membership.updated**");
    expect(steps("payment:webhook")).toContain("nomme-le **WHOP_WEBHOOK_SECRET**");
    expect(steps("payment:test")).toContain("ce compte passe Pro tout seul");
    expect(steps("payment:in_app")).not.toContain("Passer en Pro");
    // Those who tested their payment before the webhook task existed have it done.
    const tested = { at: CREATED, source: "declared" as const };
    expect(withEarlierBuildMissions({ "payment:test": tested })["payment:webhook"]).toEqual({ at: CREATED, source: "observed" });
    expect(withEarlierBuildMissions({ "payment:in_app": tested })["payment:webhook"]).toBeUndefined();
    // The Whop account connected right in its task, then its revenue on the dashboard and with Gus.
    const connect = payment.find((mission) => mission.key === "payment:connect")!;
    expect(connect.steps.map((step) => step.action?.kind)).toEqual(["payment_account", "page", "gus"]);
  });

  test("the review prompt checks the whole app before publishing, and lets Base44 fix it", () => {
    const prompt = buildReviewPrompt(project);
    expect(prompt).toContain("Avant que je publie Fitlo, passe toute l'app en revue");
    expect(prompt).toContain("sans bouton ni lien mort ni page blanche");
    expect(prompt).toContain("le résultat complet n'est jamais dans la page");
    expect(prompt).toContain("vérifie l'accès Pro et la limite du jour");
    expect(prompt).toContain("Aucun faux avis, aucun faux chiffre");
    expect(prompt).toContain("« Nom de la page · Fitlo »");
    expect(prompt).toContain("s'il reste des [À COMPLÉTER], demande-moi les informations qui manquent");
    // The payment comes after publishing.
    expect(prompt).toContain("« Bientôt disponible » sur la page Abonnement est normal");
    expect(prompt).toContain("ce que tu as corrigé, puis ce qui me reste à faire moi-même");
    expect(missionPromptText("review", project)).toBe(prompt);
  });

  test("the logo prompt for ChatGPT carries the project on its own", () => {
    expect(buildLogoPrompt(project)).toContain("app appelée Fitlo");
    expect(buildLogoPrompt(project)).toContain("Pour qui : Étudiants");
    expect(buildLogoPrompt(project)).toContain("Génère son logo");
    expect(buildLogoPrompt(project)).toContain("sans aucun texte");
    expect(buildLogoPrompt(project)).not.toContain("direction artistique");
    expect(buildLogoPrompt({ ...project, description: null, audience: null, problem: null })).not.toContain("L'idée");
  });

  test("the ChatGPT button carries its prompt, and every step's prompt exists", () => {
    const url = new URL(chatGptUrl(buildLogoPrompt(project)));
    expect(url.origin).toBe("https://chatgpt.com");
    expect(url.searchParams.get("q")).toBe(buildLogoPrompt(project));
    for (const stage of STAGES) {
      for (const mission of stage.missions) {
        for (const step of mission.steps) {
          if (step.action?.kind === "chatgpt" || step.action?.kind === "copy") {
            expect(missionPromptText(step.action.prompt, project)).toContain("Fitlo");
          }
        }
      }
    }
  });
});
