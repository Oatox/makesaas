/*
 * Second fake onboarding (marketing tool, to film), for one SaaS idea (ClipForge…): the monthly
 * goal → where the payments land → when the first sales must come → without showing up? → marketing
 * done for you? → the potential "computed", then the site created before your eyes, up to its first
 * subscription. Nothing is saved or sent anywhere.
 * Keys: 1-4 pick an answer, Enter continues, I next idea, R restart, M sound, A spider (spider.js),
 * T turned screen (turn.js), F fullscreen, Escape back to the list.
 */
(() => {
  "use strict";

  const turned = window.FO_TURN;
  if (turned.holder) return; // this page only holds the onboarding, turned (turn.js)

  const { IDEAS, GOAL, PAYMENTS, DEADLINES, FACE, MARKETING, POTENTIAL } = window.FO2_DATA;
  const spider = window.FO_SPIDER;
  const {
    ARROW,
    LOCK,
    eur0,
    html,
    esc,
    slug,
    bankLogo,
    icon,
    replay,
    newStep,
    isCurrent,
    later,
    sleep,
    loop,
    typewrite,
    sound,
    confetti,
    rollingAmount,
    controls,
  } = window.FO_KIT;

  const main = document.getElementById("main");
  const btnBack = document.getElementById("btnBack");
  const countNow = document.getElementById("countNow");
  const segments = document.getElementById("segments");

  /** The counter's "06": the five questions and the potential (the site comes after it). */
  const QUESTIONS = 6;
  const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
  const pad = (n) => String(n).padStart(2, "0");

  /* ---- The idea the questions are for ------------------------------------------ */

  // ?idea=<id>, else the last one picked on this device (I), else the first.
  const ideaById = (id) => IDEAS.find((i) => i.id === id);
  let idea = (() => {
    const asked = new URLSearchParams(location.search).get("idea");
    let saved = null;
    try {
      saved = localStorage.getItem("fo2-idea");
    } catch {}
    return ideaById(asked) ?? ideaById(saved) ?? IDEAS[0];
  })();

  const fresh = () => ({ goal: GOAL.start, payment: null, deadline: null, face: null, marketing: null });
  let state = fresh();
  let stepIndex = 0;

  /* ---- Navigation ---------------------------------------------------------- */

  const STEPS = [stepGoal, stepPayment, stepDeadline, stepFace, stepMarketing, stepPotential, stepBuild];

  segments.innerHTML = Array.from({ length: QUESTIONS }, () => "<span><i></i></span>").join("");
  document.getElementById("countAll").textContent = pad(QUESTIONS);

  /** "03 / 06", and the segments of the questions reached so far filled. */
  const setProgress = (index) => {
    countNow.textContent = pad(Math.min(index + 1, QUESTIONS));
    Array.from(segments.children).forEach((segment, i) => segment.classList.toggle("done", i <= index));
  };

  function show(index) {
    const g = newStep();
    stepIndex = index;
    btnBack.classList.toggle("is-hidden", index === 0);
    setProgress(index);

    const mount = () => {
      if (!isCurrent(g)) return;
      main.textContent = "";
      main.classList.toggle("wide", index === STEPS.length - 1);
      main.scrollTop = 0;
      const step = STEPS[index]();
      // Once a piece has made its entrance, drop the class: another animation (a tap) must not replay it.
      step.addEventListener("animationend", (event) => {
        if (event.animationName === "appear") event.target.classList.remove("appear");
      });
      main.append(step);
    };

    const old = main.firstElementChild;
    if (old) {
      old.classList.add("leaving");
      setTimeout(mount, 200);
    } else mount();
  }

  const next = () => show(stepIndex + 1);
  /** "Continuer" pressed: its sound, then the next step. */
  const proceed = () => {
    sound.confirm();
    next();
  };

  function restart() {
    state = fresh();
    confetti.clear();
    spider.respawn();
    show(0);
  }

  /** The next idea, the one the site is created for (drawn again if it is on screen). */
  function nextIdea() {
    idea = IDEAS[(IDEAS.indexOf(idea) + 1) % IDEAS.length];
    try {
      localStorage.setItem("fo2-idea", idea.id);
    } catch {}
    sound.select();
    if (STEPS[stepIndex] === stepBuild) show(stepIndex);
  }

  /* ---- Pieces of the questions ------------------------------------------------- */

  /** The question's icon in its tile, its kicker ("Ton objectif"), then its title, typed. */
  const questionHeader = (iconName, kicker) => `
    <header class="q">
      <span class="q-ico" aria-hidden="true">${icon(iconName)}</span>
      <p class="kicker appear" style="--d:120ms">${esc(kicker)}</p>
      <h1 class="title"></h1>
    </header>`;

  const typeTitle = (step, title) => typewrite(step.querySelector(".title"), title, { delay: 220 });

  /** An answer card: its logo (payments), its words, and its key in the corner (1, 2, 3…). */
  const choice = (option, i, { on, logo, d }) => `
    <button type="button" role="radio" class="opt choice appear${on ? " on" : ""}" style="--d:${d}ms" data-id="${option.id}" data-key="${i + 1}" aria-checked="${on}">
      ${logo ? bankLogo(option) : ""}
      <span class="c-text"><b>${esc(option.label ?? option.name)}</b><small>${esc(option.note)}</small></span>
      <kbd class="key" aria-hidden="true">${i + 1}</kbd>
    </button>`;

  /** A question with one answer: a tap (or its key) picks it, and the next screen comes by itself. */
  function pickStep({ key, options, iconName, kicker, title, layout = "list", logos = false }) {
    const step = html(`
      <section class="step">
        ${questionHeader(iconName, kicker)}
        <div class="choices ${layout}" role="radiogroup" aria-label="${esc(kicker)}">
          ${options.map((option, i) => choice(option, i, { on: state[key] === option.id, logo: logos, d: 260 + i * 60 })).join("")}
        </div>
      </section>`);

    typeTitle(step, title);
    let picked = false;
    step.querySelectorAll(".choice").forEach((card) => {
      card.addEventListener("click", () => {
        if (picked) return;
        picked = true;
        state[key] = card.dataset.id;
        step.querySelectorAll(".choice").forEach((c) => {
          c.classList.toggle("on", c === card);
          c.setAttribute("aria-checked", String(c === card));
        });
        replay(card, "pop");
        sound.select();
        // Long enough to see the card light up, short enough not to feel slow.
        later(next, 300);
      });
    });
    return step;
  }

  /* ---- 1. The monthly goal (a free slider) ------------------------------------- */

  function stepGoal() {
    const step = html(`
      <section class="step">
        ${questionHeader("target", "Ton objectif")}
        <div class="goal">
          <div class="amount" aria-hidden="true"></div>
          <p class="caption per-day appear" style="--d:250ms">soit <b class="day"></b> par jour</p>
          <div class="appear" style="--d:320ms">
            <input type="range" class="range" min="0" max="${GOAL.max}" step="1" value="${state.goal}" aria-label="Revenu par mois" />
            <div class="ends"><span>${eur0.format(0)}</span><span>${eur0.format(GOAL.max)}</span></div>
          </div>
        </div>
        <div class="continue appear" style="--d:420ms">
          <button type="button" class="btn btn-primary">Continuer ${ARROW}</button>
        </div>
      </section>`);

    typeTitle(step, "Quel revenu veux-\u2060tu atteindre ?");

    const range = step.querySelector(".range");
    const day = step.querySelector(".day");
    const button = step.querySelector(".btn-primary");
    const setAmount = rollingAmount(step.querySelector(".amount"));
    // A coin each time the amount crosses a thousand, higher as it goes up.
    let thousands = Math.floor(state.goal / 1000);

    /** Everything but the big figure, which rolls on its own (`set`). */
    const update = (value) => {
      state.goal = value;
      range.value = String(value);
      day.textContent = eur0.format(Math.round(value / 30));
      range.style.setProperty("--range-progress", String(value / GOAL.max));
      range.setAttribute("aria-valuetext", `${eur0.format(value)} par mois`);
      button.disabled = value <= 0;
      const now = Math.floor(value / 1000);
      if (now !== thousands) {
        thousands = now;
        sound.coin(value / GOAL.max);
      }
    };
    const set = (value) => {
      update(value);
      setAmount(value);
    };

    range.addEventListener("input", () => set(Number(range.value)));
    // Keys move by 500 € (one euro at a time would take forever).
    range.addEventListener("keydown", (event) => {
      const moves = { ArrowRight: 500, ArrowUp: 500, ArrowLeft: -500, ArrowDown: -500 };
      if (event.key in moves) set(Math.min(GOAL.max, Math.max(0, state.goal + moves[event.key])));
      else if (event.key === "Home") set(0);
      else if (event.key === "End") set(GOAL.max);
      else return;
      event.preventDefault();
    });

    update(state.goal);
    // Once on screen, so the reels spin in from 0.
    later(() => setAmount(state.goal, { opening: true }), 60);
    button.addEventListener("click", proceed);
    return step;
  }

  /* ---- 2 to 5. One answer each ------------------------------------------------- */

  function stepPayment() {
    return pickStep({
      key: "payment",
      options: PAYMENTS,
      iconName: "credit-card",
      kicker: "Tes paiements",
      title: "Sur quoi tu veux recevoir tes paiements ?",
      logos: true,
    });
  }

  function stepDeadline() {
    return pickStep({
      key: "deadline",
      options: DEADLINES,
      iconName: "clock",
      kicker: "Ton échéance",
      title: "D'ici quand tu dois avoir tes premières ventes ?",
    });
  }

  function stepFace() {
    return pickStep({
      key: "face",
      options: FACE,
      iconName: "eye-off",
      kicker: "Ta façon de faire",
      title: "Tu veux tout faire derrière ton téléphone sans te montrer ?",
      layout: "duo",
    });
  }

  function stepMarketing() {
    return pickStep({
      key: "marketing",
      options: MARKETING,
      iconName: "video",
      kicker: "Ton marketing",
      title: "Tu veux que l'IA le fasse à ta place ?",
      layout: "duo",
    });
  }

  /* ---- 6. The potential, "computed" from the answers --------------------------- */

  const answer = (list, id) => list.find((item) => item.id === id) ?? list[0];

  /** The goal times a share made of the answers (POTENTIAL in data.js), never a round figure. */
  function potentialOf() {
    const p = POTENTIAL;
    const share =
      p.base +
      (p.deadline[state.deadline] ?? 0.04) +
      (p.face[state.face] ?? 0.04) +
      (p.marketing[state.marketing] ?? 0.03) +
      (p.payment[state.payment] ?? 0.01);
    const value = Math.round(state.goal * share);
    return value % 10 === 0 ? value + 7 : value;
  }

  function stepPotential() {
    const deadline = answer(DEADLINES, state.deadline);
    const step = html(`
      <section class="step potential-step">
        ${questionHeader("trending-up", "Dernière étape")}
        <div class="potential">
          <div class="result" aria-live="polite">
            <div class="amount" aria-hidden="true"></div>
            <p class="caption">par mois, ton potentiel.</p>
            <p class="when">Tu as dit <b>${esc(deadline.said)}</b>. En t'y mettant maintenant, ta première vente peut tomber <b class="soon">${esc(deadline.soon)}</b>.</p>
          </div>
        </div>
        <div class="continue">
          <button type="button" class="btn btn-primary" disabled>Créer le site ${ARROW}</button>
        </div>
        <p class="fine appear" style="--d:300ms">Un scénario calculé sur tes réponses, pas une promesse.</p>
      </section>`);

    const $ = (selector) => step.querySelector(selector);
    const button = $(".btn-primary");
    const value = potentialOf();
    const setAmount = rollingAmount($(".amount"));

    // The title types, and the figure rolls in straight away.
    async function run() {
      typeTitle(step, "On chiffre ton potentiel.");
      await sleep(450);
      $(".result").classList.add("in");
      setAmount(value, { opening: true });
      sound.pop();
      await sleep(1500);

      $(".when").classList.add("in");
      await sleep(700);
      $(".continue").classList.add("in");
      button.disabled = false;
    }

    later(run, 150);
    button.addEventListener("click", proceed);
    return step;
  }

  /* ---- 7. The site created before your eyes ------------------------------------ */

  /** How long the line takes to paint the page: it starts as soon as the screen is there. */
  const PAINT_MS = 2600;

  function stepBuild() {
    const payment = answer(PAYMENTS, state.payment);
    const domain = `${slug(idea.name)}.fr`;
    const price = eur2.format(idea.price);

    const step = html(`
      <section class="step build" style="--accent:${idea.accent}">
        <h1 class="title"></h1>

        <div class="stage">
          <div class="mock" aria-label="Ton site : ${esc(domain)}">
            <div class="m-bar">
              <span class="m-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <div class="m-url">${LOCK}<span class="m-domain"></span><span class="m-live">En ligne</span><i class="m-load"></i></div>
              <span class="m-side" aria-hidden="true"></span>
            </div>
            <div class="site" aria-hidden="true">
              <nav class="s-nav sec skel">
                <div class="s-brand"><span class="s-logo sk">${icon(idea.icon)}</span><b class="sk">${esc(idea.name)}</b></div>
                <div class="s-links"><span class="sk">Fonctionnalités</span><span class="sk">Tarifs</span><span class="sk">Avis</span></div>
                <span class="s-btn sk">Essayer</span>
                <span class="s-burger"><i></i><i></i><i></i></span>
              </nav>
              <div class="s-hero">
                <div class="s-copy sec skel">
                  <span class="s-badge sk">${icon("sparkles")}<span>Nouveau · propulsé par l'IA</span></span>
                  <h3 class="s-h1"><span class="sk">${esc(idea.tagline)}</span></h3>
                  <p class="s-sub"><span class="sk">${esc(idea.sub)}</span></p>
                  <div class="s-btns"><span class="s-btn sk">Commencer →</span><span class="s-btn ghost sk">En savoir plus</span></div>
                  <span class="s-proof s-price sk wait"><b>${esc(price)}</b><span>par mois · essai gratuit</span></span>
                </div>
                <div class="s-vwrap sec skel">
                  <div class="s-visual sk block">
                    <span class="s-big">${icon(idea.icon)}</span>
                    ${idea.floats
                      .map(([name, title, detail], i) => `<span class="s-float f${i + 1}"><span class="s-float-ico">${icon(name)}</span><span><b>${esc(title)}</b><small>${esc(detail)}</small></span></span>`)
                      .join("")}
                  </div>
                </div>
              </div>
              <div class="s-feats sec skel">
                ${idea.features
                  .map(([name, title, detail]) => `<div class="s-card"><span class="s-fi sk">${icon(name)}</span><b class="sk">${esc(title)}</b><small class="sk">${esc(detail)}</small></div>`)
                  .join("")}
              </div>
              <i class="scan"></i>
            </div>
          </div>

          <div class="sale" aria-hidden="true">
            ${bankLogo(payment)}
            <span><b>Nouvel abonnement</b><small>${esc(price)} · ${esc(idea.name)}</small></span>
            <em>maintenant</em>
          </div>
        </div>
      </section>`);

    const $ = (selector) => step.querySelector(selector);
    const title = $(".title");
    const stage = $(".stage");
    const mock = $(".mock");
    const site = $(".site");

    // The line paints the page top to bottom; each section turns real when the line reaches it.
    const paint = (duration) => {
      const scan = $(".scan");
      scan.style.setProperty("--scan-ms", `${duration}ms`);
      scan.classList.add("run");
      const box = site.getBoundingClientRect();
      site.querySelectorAll(".sec").forEach((section) => {
        const rect = section.getBoundingClientRect();
        const at = rect.height ? Math.min(1, Math.max(0.03, (rect.top - box.top + rect.height * 0.3) / box.height)) : 0;
        later(() => reveal(section), duration * at);
      });
      later(() => {
        scan.style.transition = "opacity 0.4s";
        scan.style.opacity = "0";
      }, duration);
    };

    const reveal = (section) => {
      section.classList.remove("skel");
      sound.tick(0.5);
      if (section.classList.contains("s-copy")) typewrite(section.querySelector(".s-h1"), idea.tagline, { charMs: 24, delay: 60 });
    };

    const typeDomain = () => {
      const target = $(".m-domain");
      const load = $(".m-load");
      const letters = Array.from(domain);
      letters.forEach((_, i) => later(() => (target.textContent = letters.slice(0, i + 1).join("")), i * 55));
      later(() => (load.style.width = "100%"), letters.length * 55 + 100);
      later(() => (load.style.opacity = "0"), letters.length * 55 + 1050);
    };

    /** The price, a grey bar until then: the payment is plugged in. */
    const showPrice = () => {
      $(".s-price").classList.remove("wait");
      sound.coin(0.6);
    };

    // No wait: the mockup comes in and the line starts painting it at once; the price and the
    // address come while it paints, and the site goes live as soon as it is done.
    async function run() {
      typewrite(title, "On crée ton site…", { delay: 0 });
      mock.classList.add("in");
      await sleep(200);
      paint(PAINT_MS);
      later(typeDomain, PAINT_MS * 0.45);
      later(showPrice, PAINT_MS * 0.7);
      await sleep(PAINT_MS + 250);

      mock.classList.add("live");
      sound.launch();
      const rect = stage.getBoundingClientRect();
      confetti.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, { colors: [idea.accent] });
      typewrite(title, "Ton site est en ligne !", { delay: 0 });

      // And its first subscription comes in.
      await sleep(1600);
      $(".sale").classList.add("in");
      sound.coin(1);
      later(() => sound.coin(0.8), 120);
    }

    later(run, 30);
    return step;
  }

  /* ---- Controls ------------------------------------------------------------ */

  controls({
    restart,
    onKey(event) {
      if (event.key.toLowerCase() === "i") return nextIdea();
      const step = main.firstElementChild;
      if (!step || step.classList.contains("leaving")) return;
      if (/^[1-9]$/.test(event.key)) step.querySelector(`[data-key="${event.key}"]`)?.click();
      // Enter on a focused button already clicks it.
      else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        const button = step.querySelector(".btn-primary");
        if (button && !button.disabled) {
          event.preventDefault();
          button.click();
        }
      }
    },
  });
  document.getElementById("btnIdea").addEventListener("click", nextIdea);
  btnBack.addEventListener("click", () => stepIndex > 0 && show(stepIndex - 1));

  show(0);
})();
