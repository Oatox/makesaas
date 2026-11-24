import { describe, expect, test } from "bun:test";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import { formatChiffres, formatProfil, formatProjet, formatRoadmap } from "./context";

const PROJECT = { name: "Fitlo", description: "Ton programme de muscu en 3 questions.", audience: "Étudiants", problem: "Pas de programme clair.", price: 9 };

describe("coach context", () => {
  test("the profile: goal, other SaaS and onboarding answers", () => {
    const text = formatProfil({
      fullName: "Léa Martin",
      memberSince: "2026-11-20T10:00:00Z",
      goal: 5_000,
      goalGiven: true,
      onboarding: [{ question: "Qu'est-ce qui te passionne ?", answer: "Le sport" }],
      otherSaas: ["Ancien projet"],
    });
    expect(text).toContain("Objectif de revenu : 5 000 € par mois");
    expect(text).toContain("Ses autres SaaS sur MakeSaaS : Ancien projet");
    expect(text).toContain("- Qu'est-ce qui te passionne ? → Le sport");
  });

  test("the project, with the idea kept", () => {
    const text = formatProjet({
      name: "Fitlo",
      description: PROJECT.description,
      audience: "Étudiants",
      appUrl: null,
      createdAt: "2026-11-20T10:00:00Z",
      idea: { pitch: PROJECT.description, problem: PROJECT.problem, price: 9 },
    });
    expect(text).toContain("App en ligne : pas encore");
    expect(text).toContain("Problème réglé : Pas de programme clair.");
    expect(text).toContain("Prix conseillé : 9 € par mois");
  });

  const PROGRESS = { videos: 0, tiktokAccounts: 0, mrr: null };

  test("the roadmap: the objectives, the steps of the one in progress with their tasks done, the phase, the day's tasks, and the next one's instructions with its prompt", () => {
    const text = formatRoadmap(
      roadmapStagesFor(5_000),
      {
        goal: 5_000,
        project: PROJECT,
        progress: PROGRESS,
        done: Object.fromEntries(
          ["idea:chosen", "brand:logo", "build:claude", "build:landing"].map((key) => [
            key,
            { at: "2026-11-21T10:00:00Z", source: "declared" as const },
          ]),
        ),
      },
      "2026-11-23",
    );
    expect(text).toContain("0 atteint sur 7.");
    expect(text).toContain("- [ ] Lancer ton SaaS : EN COURS (2 / 4 étapes)");
    expect(text).toContain("  - [x] Ton logo : passée le");
    expect(text).toContain("  - [ ] Ton app en ligne : EN COURS (2 / 9 tâches)");
    expect(text).toContain("- [ ] Première vidéo : à venir");
    expect(text).toMatch(/- \[ \] 100\s€ par mois : à venir/);
    expect(text).not.toContain("7 vidéos");
    expect(text).toContain("Phase : lancement de son SaaS (3 tâches de lancement faites sur 19).");
    expect(text).toContain("- [ ] Ajoute les comptes (il la coche lui-même)");
    expect(text).toContain("Sa prochaine tâche : « Ajoute les comptes ».");
    expect(text).toContain("Le prompt à coller dans Base44 que sa tâche lui donne :");
    expect(text).toContain("Ajoute à Fitlo les comptes utilisateurs.");
  });

  test("the logo task gives Gus its ChatGPT prompt, and a step in progress its figure", () => {
    const at = "2026-11-21T10:00:00Z";
    const done = Object.fromEntries(["idea:chosen"].map((key) => [key, { at, source: "declared" as const }]));
    const text = formatRoadmap(roadmapStagesFor(5_000), { goal: 5_000, project: PROJECT, progress: PROGRESS, done }, "2026-11-23");
    expect(text).toContain("Sa prochaine tâche : « Crée ton logo ».");
    expect(text).toContain("1. Demande ton logo à ChatGPT. [bouton « Ouvrir ChatGPT », avec le prompt ci-dessous déjà écrit]");
    expect(text).toContain("Génère son logo");

    const growing = formatRoadmap(
      roadmapStagesFor(5_000),
      {
        goal: 5_000,
        project: PROJECT,
        progress: { videos: 3, tiktokAccounts: 1, mrr: null },
        done: Object.fromEntries(
          ["idea:chosen", "brand:logo", "build:domain", "payment:connect", "video:track", "video:posted"].map((key) => [key, { at, source: "observed" as const }]),
        ),
      },
      "2026-11-23",
    );
    expect(growing).toContain("2 atteints sur 7.");
    expect(growing).toContain("- [x] Lancer ton SaaS : atteint le");
    expect(growing).toContain("- [x] Première vidéo : atteint le");
    expect(growing).toContain("- [ ] Premier client : EN COURS (0 / 2 étapes)");
    expect(growing).toContain("  - [ ] 7 vidéos : EN COURS (3 / 7 vidéos)");
  });

  test("the figures without any account say so", () => {
    const text = formatChiffres({ connections: [], overview: null, accounts: [], videos: [], stats: [], carousels: [], now: Date.now() });
    expect(text).toContain("Aucun compte de paiement connecté");
    expect(text).toContain("Aucun compte TikTok suivi");
    expect(text).toContain("Aucun carrousel");
  });

  test("the figures: revenue, TikTok with its best videos, carousels", () => {
    const now = Date.parse("2026-11-23T12:00:00Z");
    const zeros = (value = 0) => Array.from({ length: 365 }, () => value);
    const text = formatChiffres({
      connections: [{ provider: "whop", account_name: "Fitlo", livemode: true, last_synced_at: "2026-11-23T10:00:00Z", last_error: null }],
      overview: {
        currency: "EUR",
        revenue: [...zeros().slice(0, 364), 18],
        mrr: [...zeros().slice(0, 364), 18],
        subscribers: [...zeros().slice(0, 364), 2],
        newSubscriptions: [...zeros().slice(0, 364), 2],
        churnedSubscriptions: zeros(),
        trialing: 1,
        recentPayments: [],
      },
      accounts: [{ id: "a", handle: "fitlo.app", followers: 1200, likes: 5000, video_count: 12, is_private: false, synced_at: "2026-11-23T09:00:00Z", sync_error: null }],
      videos: [{ account_id: "a", caption: "3 erreurs en muscu", posted_at: "2026-11-22T18:00:00Z", views: 45000, likes: 3000, comments: 80, shares: 40 }],
      stats: [{ account_id: "a", day: "2026-10-25", followers: 200, views: 1000 }],
      carousels: [{ title: "Programme débutant", status: "ready", created_at: "2026-11-21T10:00:00Z" }],
      now,
    });
    expect(text).toContain("MRR aujourd'hui : 18,00");
    expect(text).toContain("Abonnés payants : 2");
    expect(text).toMatch(/@fitlo\.app : 1\s200 abonnés \(\+1\s000 sur 30 jours\)/);
    expect(text).toContain("« 3 erreurs en muscu »");
    expect(text).toContain("« Programme débutant »");
    // The detail Gus analyses: the periods with activity only, and the latest videos one by one.
    expect(text).toContain("Évolution par périodes de 30 jours");
    expect(text.match(/30 jours jusqu'au/g)).toHaveLength(1);
    expect(text).toContain("Ses dernières vidéos");
    expect(text).toContain("Moyenne par vidéo sur 30 jours : 45");
  });
});
