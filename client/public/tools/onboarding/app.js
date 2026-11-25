/*
 * Fake onboarding (marketing tool, to film): passions → time → bank → monthly goal → the site
 * "created" before your eyes, up to the moment it goes live.
 * Nothing is saved or sent anywhere. Keys: R restart, M sound, A spider (spider.js), T turned screen
 * (turn.js), F fullscreen, Escape back to the list.
 */
(() => {
  "use strict";

  const turned = window.FO_TURN;
  if (turned.holder) return; // this page only holds the onboarding, turned (turn.js)

  const { PASSIONS, TIMES, BANKS, GOAL } = window.FO_DATA;
  const spider = window.FO_SPIDER;
  // Shared with the other fake onboardings (kit.js): helpers, timers of the step on screen, sounds…
  const {
    ARROW,
    CHECK,
    LOCK,
    eur0,
    html,
    esc,
    clamp,
    easeOutCubic,
    easeInCubic,
    easeOutBack,
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
  const progressFill = document.getElementById("progressFill");
  const btnBack = document.getElementById("btnBack");

  const fresh = () => ({ passions: [], time: null, bank: null, goal: GOAL.start });
  let state = fresh();
  let stepIndex = 0;

  /* ---- Navigation ---------------------------------------------------------- */

  const STEPS = [stepPassions, stepTime, stepBank, stepGoal, stepBuild];

  const setProgress = (value) => {
    progressFill.style.width = `${Math.max(value, 0.04) * 100}%`;
  };

  function show(index) {
    const g = newStep();
    stepIndex = index;
    btnBack.classList.toggle("is-hidden", index === 0);
    setProgress(index / STEPS.length);

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

  /** Types the question, then shows the hint under it. */
  function header(step, title) {
    const subtitle = step.querySelector(".subtitle");
    typewrite(step.querySelector(".title"), title).then(() => subtitle?.classList.add("in"));
  }

  /* ---- 1. Passions (several picks) ------------------------------------------- */

  function stepPassions() {
    const step = html(`
      <section class="step">
        <h1 class="title"></h1>
        <p class="subtitle">Choisis-en autant que tu veux : on part de là pour trouver ton idée.</p>
        <div class="passions" role="group" aria-label="Tes passions">
          ${PASSIONS.map((passion, i) => {
            const on = state.passions.includes(passion.id);
            return `<button type="button" class="opt tile appear${on ? " on" : ""}" style="--d:${200 + i * 35}ms" data-id="${passion.id}" aria-pressed="${on}">
              <span class="tick">${CHECK}</span>
              <span class="glyph">${icon(passion.icon)}</span>
              <span class="label">${esc(passion.label)}</span>
            </button>`;
          }).join("")}
        </div>
        <div class="continue appear" style="--d:650ms">
          <button type="button" class="btn btn-primary"${state.passions.length ? "" : " disabled"}>Continuer ${ARROW}</button>
        </div>
      </section>`);

    header(step, "Qu'est-ce qui te passionne ?");
    const button = step.querySelector(".btn-primary");

    step.querySelectorAll(".tile").forEach((tile) => {
      tile.addEventListener("click", () => {
        const id = tile.dataset.id;
        const on = !state.passions.includes(id);
        state.passions = on ? [...state.passions, id] : state.passions.filter((p) => p !== id);
        tile.classList.toggle("on", on);
        tile.setAttribute("aria-pressed", String(on));
        replay(tile, "pop");
        if (on) sound.select(state.passions.length - 1);
        else sound.deselect();
        button.disabled = !state.passions.length;
      });
    });
    button.addEventListener("click", proceed);
    return step;
  }

  /* ---- 2. Time (one pick, the coach replies under it, "Continuer" confirms) ------ */

  function stepTime() {
    const step = html(`
      <section class="step">
        <h1 class="title"></h1>
        <p class="subtitle">Même un peu chaque jour, ça suffit pour lancer ton SaaS.</p>
        <div class="rows" role="radiogroup" aria-label="Ton temps">
          ${TIMES.map((time, i) => {
            const on = state.time === time.id;
            return `<div class="pick appear" style="--d:${200 + i * 50}ms">
              <button type="button" role="radio" class="opt row${on ? " on attached" : ""}" data-id="${time.id}" aria-checked="${on}">
                <span class="row-ico">${icon(time.icon)}</span>
                <span class="lbl"><b>${esc(time.label)}</b><small>${esc(time.note)}</small></span>
                <span class="radio" aria-hidden="true"></span>
              </button>
              <div class="reply${on ? " open" : ""}" aria-hidden="${!on}"><div><p>${esc(time.reply)}</p></div></div>
            </div>`;
          }).join("")}
        </div>
        <div class="continue appear" style="--d:500ms">
          <button type="button" class="btn btn-primary"${state.time ? "" : " disabled"}>Continuer ${ARROW}</button>
        </div>
      </section>`);

    header(step, "Combien de temps peux-tu y consacrer ?");
    const button = step.querySelector(".btn-primary");

    // A tap picks the row and unfolds the coach's reply under it; another tap changes the pick.
    step.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("click", () => {
        if (state.time === row.dataset.id) return;
        state.time = row.dataset.id;
        step.querySelectorAll(".pick").forEach((pick) => {
          const current = pick.querySelector(".row");
          const on = current === row;
          current.classList.toggle("on", on);
          current.classList.toggle("attached", on);
          current.setAttribute("aria-checked", String(on));
          const reply = pick.querySelector(".reply");
          reply.classList.toggle("open", on);
          reply.setAttribute("aria-hidden", String(!on));
        });
        replay(row, "pop");
        sound.select();
        button.disabled = false;
      });
    });
    button.addEventListener("click", proceed);
    return step;
  }

  /* ---- 3. Bank (one pick, moves on by itself) ---------------------------------- */

  function stepBank() {
    const step = html(`
      <section class="step">
        <h1 class="title"></h1>
        <p class="subtitle">L'argent de tes clients arrive directement sur ton compte.</p>
        <div class="banks" role="radiogroup" aria-label="Ta banque">
          ${BANKS.map((bank, i) => {
            const on = state.bank === bank.id;
            return `<button type="button" role="radio" class="opt bank appear${on ? " on" : ""}" style="--d:${200 + i * 50}ms" data-id="${bank.id}" aria-checked="${on}">
              ${bankLogo(bank)}
              <b>${esc(bank.name)}</b>
            </button>`;
          }).join("")}
        </div>
      </section>`);

    header(step, "Où veux-tu recevoir tes paiements ?");
    let picked = false;

    step.querySelectorAll(".bank").forEach((card) => {
      card.addEventListener("click", () => {
        if (picked) return;
        picked = true;
        state.bank = card.dataset.id;
        step.querySelectorAll(".bank").forEach((c) => {
          c.classList.toggle("on", c === card);
          c.setAttribute("aria-checked", String(c === card));
        });
        replay(card, "pop");
        sound.select();
        later(next, 300);
      });
    });
    return step;
  }

  /* ---- 4. Monthly goal (slider) ---------------------------------------------- */

  function stepGoal() {
    const { stops, tiers } = GOAL;
    const last = stops.length - 1;
    const start = Math.max(0, stops.indexOf(state.goal));

    const step = html(`
      <section class="step">
        <h1 class="title"></h1>
        <p class="subtitle">On construit ton site pour atteindre cet objectif.</p>
        <div class="goal">
          <div class="amount" aria-hidden="true"></div>
          <div class="appear" style="--d:250ms">
            <p class="caption">par mois</p>
            <input type="range" class="range" min="0" max="${last}" step="any" value="${start}" aria-label="Objectif par mois" />
            <div class="ends"><span>${eur0.format(stops[0])}</span><span>${eur0.format(stops[last])}</span></div>
            <p class="tier" aria-live="polite"></p>
          </div>
        </div>
        <div class="continue appear" style="--d:400ms">
          <button type="button" class="btn btn-primary">Créer mon site ${ARROW}</button>
        </div>
      </section>`);

    header(step, "Combien veux-tu gagner par mois ?");

    const range = step.querySelector(".range");
    const tierLine = step.querySelector(".tier");
    const setAmount = rollingAmount(step.querySelector(".amount"));

    let position = start;
    let index = start;
    let tierWord = "";
    let glideTarget = null;
    let glideToken = 0;

    const showTier = () => {
      const tier = tiers.find((t) => stops[index] <= t.upTo);
      if (!tier || tier.word === tierWord) return;
      tierWord = tier.word;
      tierLine.innerHTML = `<span><b>${esc(tier.word)}</b> · ${esc(tier.note)}</span>`;
    };

    const setPosition = (value) => {
      position = value;
      range.value = String(value);
      range.style.setProperty("--range-progress", String(value / last));
      const nearest = Math.round(value);
      range.setAttribute("aria-valuetext", `${eur0.format(stops[nearest])} par mois`);
      if (nearest === index) return;
      index = nearest;
      state.goal = stops[index];
      setAmount(state.goal);
      showTier();
      sound.coin(index / last);
    };

    // On release (or a key), the thumb glides onto the nearest stop.
    const glideTo = (target) => {
      const token = ++glideToken;
      const from = position;
      const began = performance.now();
      glideTarget = target;
      loop((now) => {
        if (token !== glideToken) return false;
        const t = Math.min(1, (now - began) / 220);
        setPosition(from + (target - from) * easeOutCubic(t));
        if (t < 1) return true;
        glideTarget = null;
        return false;
      });
    };

    range.addEventListener("input", () => {
      glideToken++;
      glideTarget = null;
      setPosition(Number(range.value));
    });
    range.addEventListener("pointerdown", () => {
      glideToken++;
      const release = () => {
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
        glideTo(Math.round(position));
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
    });
    range.addEventListener("keydown", (event) => {
      const from = glideTarget ?? index;
      const moves = { ArrowRight: from + 1, ArrowUp: from + 1, ArrowLeft: from - 1, ArrowDown: from - 1, Home: 0, End: last };
      if (!(event.key in moves)) return;
      event.preventDefault();
      glideTo(clamp(moves[event.key], 0, last));
    });

    range.style.setProperty("--range-progress", String(start / last));
    range.setAttribute("aria-valuetext", `${eur0.format(stops[start])} par mois`);
    showTier();
    // Once on screen, so the reels spin in from 0.
    later(() => setAmount(stops[index], { opening: true }), 60);

    step.querySelector(".btn-primary").addEventListener("click", proceed);
    return step;
  }

  /* ---- 5. The site created before your eyes ----------------------------------- */

  function stepBuild() {
    const passion = PASSIONS.find((p) => p.id === state.passions[0]) ?? PASSIONS[0];
    const idea = passion.idea;
    const time = TIMES.find((t) => t.id === state.time) ?? TIMES[1];
    const bank = BANKS.find((b) => b.id === state.bank) ?? BANKS[0];
    const goal = state.goal;
    const domain = `${slug(idea.name)}.app`;

    const step = html(`
      <section class="step build" style="--accent:${idea.accent}">
        <h1 class="title"></h1>

        <div class="stage">
          <div class="orbit"><div class="core"></div></div>

          <div class="idea" role="status">
            <div class="idea-kicker">${icon("lightbulb")} Ton idée</div>
            <div class="idea-logo">${icon(passion.icon)}</div>
            <h2 class="idea-name">${esc(idea.name)}</h2>
            <p class="idea-tagline">${esc(idea.tagline)}</p>
            <div class="chips">
              <span class="chip">${icon("target")} ${eur0.format(goal)} / mois</span>
              <span class="chip">${icon(time.icon)} ${esc(time.short)}</span>
              <span class="chip">${bankLogo(bank)} ${esc(bank.name)}</span>
            </div>
          </div>

          <div class="mock" aria-label="Ton site : ${esc(domain)}">
            <div class="m-bar">
              <span class="m-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <div class="m-url">${LOCK}<span class="m-domain"></span><span class="m-live">En ligne</span><i class="m-load"></i></div>
              <span class="m-side" aria-hidden="true"></span>
            </div>
            <div class="site" aria-hidden="true">
              <nav class="s-nav sec skel">
                <div class="s-brand"><span class="s-logo sk">${icon(passion.icon)}</span><b class="sk">${esc(idea.name)}</b></div>
                <div class="s-links"><span class="sk">Fonctionnalités</span><span class="sk">Tarifs</span><span class="sk">Avis</span></div>
                <span class="s-btn sk">Essayer</span>
                <span class="s-burger"><i></i><i></i><i></i></span>
              </nav>
              <div class="s-hero">
                <div class="s-copy sec skel">
                  <span class="s-badge sk">${icon("sparkles")}<span>Nouveau · propulsé par l'IA</span></span>
                  <h3 class="s-h1"><span class="sk">${esc(idea.tagline)}</span></h3>
                  <p class="s-sub"><span class="sk">${esc(idea.sub)}</span></p>
                  <div class="s-btns"><span class="s-btn sk">Commencer →</span><span class="s-btn ghost sk">Voir la démo</span></div>
                  <span class="s-proof sk"><span class="stars">${Array.from({ length: 5 }, () => icon("star")).join("")}</span><span>Déjà 2 400+ membres</span></span>
                </div>
                <div class="s-vwrap sec skel">
                  <div class="s-visual sk block">
                    <span class="s-big">${icon(passion.icon)}</span>
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
        </div>
      </section>`);

    const $ = (selector) => step.querySelector(selector);
    const title = $(".title");
    const stage = $(".stage");
    const ideaCard = $(".idea");
    const mock = $(".mock");
    const site = $(".site");

    // The pieces of the sequence, then the sequence itself (started once the step is on screen).
    const orbit = () =>
      new Promise((resolve) => {
        const orbitEl = $(".orbit");
        const core = $(".core");
        const passionIcons = state.passions.slice(0, 6).map((id) => PASSIONS.find((p) => p.id === id)?.icon);
        const items = [...passionIcons, time.icon].filter(Boolean).map((name) => icon(name));
        items.push(bankLogo(bank), icon("euro"));
        const planets = items.map((content, i) => {
          const planet = document.createElement("div");
          planet.className = "planet";
          planet.innerHTML = content;
          planet.style.opacity = "0";
          orbitEl.append(planet);
          later(() => sound.tick(0.7), 120 + i * 90);
          return planet;
        });
        later(() => core.classList.add("on"), 250);

        const began = performance.now();
        const { width, height } = stage.getBoundingClientRect();
        const radius = Math.min(width, height) * 0.36;
        loop((now) => {
          const t = now - began;
          planets.forEach((planet, i) => {
            const shown = clamp((t - 100 - i * 90) / 380, 0, 1);
            const merge = easeInCubic(clamp((t - 1650) / 480, 0, 1));
            const angle = (i / planets.length) * Math.PI * 2 + t * 0.0011 - Math.PI / 2;
            const r = radius * (0.55 + 0.45 * easeOutBack(shown)) * (1 - merge);
            const scale = easeOutBack(shown) * (1 - 0.75 * merge);
            planet.style.transform = `translate(${Math.cos(angle) * r}px, ${Math.sin(angle) * r * 0.82}px) scale(${scale})`;
            planet.style.opacity = String(Math.min(1, shown * 1.6) * (1 - merge));
          });
          if (t < 2150) return true;
          planets.forEach((planet) => planet.remove());
          resolve();
          return false;
        });
      });

    // The line paints the page top to bottom; each section turns real when the line reaches it.
    const paint = (duration) => {
      const scan = $(".scan");
      scan.style.setProperty("--scan-ms", `${duration}ms`);
      scan.classList.add("run");
      const box = site.getBoundingClientRect();
      site.querySelectorAll(".sec").forEach((section) => {
        const rect = section.getBoundingClientRect();
        const at = rect.height ? clamp((rect.top - box.top + rect.height * 0.3) / box.height, 0.03, 1) : 0;
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

    const typeDomain = () =>
      new Promise((resolve) => {
        const target = $(".m-domain");
        const load = $(".m-load");
        const letters = Array.from(domain);
        letters.forEach((_, i) => later(() => (target.textContent = letters.slice(0, i + 1).join("")), i * 55));
        later(() => (load.style.width = "100%"), letters.length * 55 + 100);
        later(() => {
          load.style.opacity = "0";
          resolve();
        }, letters.length * 55 + 1050);
      });

    const burstOverStage = (options) => {
      const rect = stage.getBoundingClientRect();
      confetti.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, { colors: [idea.accent], ...options });
    };

    async function run() {
      typewrite(title, "On crée ton site…");
      await sleep(350);

      await orbit();

      $(".core").classList.add("flash");
      ideaCard.classList.add("in");
      sound.pop();
      await sleep(1100);

      ideaCard.classList.add("out");
      await sleep(250);
      mock.classList.add("in");
      await sleep(400);

      paint(3200);
      await sleep(3600);

      await typeDomain();

      mock.classList.add("live");
      setProgress(1);
      sound.launch();
      burstOverStage();
      typewrite(title, "Ton site est en ligne !", { delay: 0 });
    }

    later(run, 250);
    return step;
  }

  /* ---- Controls ------------------------------------------------------------ */

  controls({ restart });
  btnBack.addEventListener("click", () => stepIndex > 0 && show(stepIndex - 1));

  show(0);
})();
