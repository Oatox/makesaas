/*
 * Third fake onboarding (marketing tool, to film): what you love → the monthly goal → the idea found
 * (names rolling, then its card) → its prompt → Claude building the site in its chat → the site,
 * scrolling, while the payments land. Nothing is saved or sent anywhere.
 * Its variant with the marketing (index.html?marketing) ends instead with the site's button "Lancer
 * mon marketing" → the idea's TikTok account, its videos made one after the other, then published:
 * their views climb.
 * Keys: 1-6 tick a passion, Enter continues (in the builder: paste, send, open the site; then publish
 * the videos), V pastes, R restart, M sound, A spider (spider.js), T turned screen (turn.js),
 * F fullscreen, Escape back to the list.
 */
(() => {
  "use strict";

  const turned = window.FO_TURN;
  if (turned.holder) return; // this page only holds the onboarding, turned (turn.js)

  const { PASSIONS, IDEAS, DECOYS, GOAL, BUILD_STEPS, PAYERS, MAKING, VIEWS, TIKTOK_MARK, WHOP_MARK, CLAUDE_MARK } =
    window.FO3_DATA;
  const spider = window.FO_SPIDER;
  const {
    ARROW,
    CHECK,
    LOCK,
    eur0,
    html,
    esc,
    clamp,
    slug,
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

  const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
  const EXTERNAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';
  const HEART =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

  /** The variant with the marketing (index.html?marketing): after the site, its TikTok videos. */
  const MARKETING = new URLSearchParams(location.search).has("marketing");

  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

  const fresh = () => ({ passions: [], goal: GOAL.start });
  let state = fresh();
  let stepIndex = 0;

  /** The idea found: the first passion ticked decides it (music, the video's, without any). */
  const ideaOf = () => IDEAS[state.passions[0]] ?? IDEAS.musique;
  const domainOf = (idea) => `${slug(idea.name)}.app`;

  /* ---- Navigation ---------------------------------------------------------- */

  const STEPS = [stepPassions, stepGoal, stepFind, stepIdea, stepPrompt, stepBuilder, stepSite];
  if (MARKETING) STEPS.push(stepMarketing);
  /** Screens laid out wider on a computer: the builder's chat, the site and the videos. */
  const WIDE = [stepBuilder, stepSite, stepMarketing];

  const setProgress = (value) => {
    progressFill.style.width = `${Math.max(value, 0.04) * 100}%`;
  };

  function show(index) {
    const g = newStep();
    stepIndex = index;
    btnBack.classList.toggle("is-hidden", index === 0);
    setProgress(index / (STEPS.length - 1));

    const mount = () => {
      if (!isCurrent(g)) return;
      main.textContent = "";
      main.classList.toggle("wide", WIDE.includes(STEPS[index]));
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

  /** Types the title, then shows the hint under it. */
  function header(step, title) {
    const subtitle = step.querySelector(".subtitle");
    typewrite(step.querySelector(".title"), title).then(() => subtitle?.classList.add("in"));
  }

  const burstOver = (el, options) => {
    const rect = el.getBoundingClientRect();
    confetti.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.35, options);
  };

  /* ---- 1. What you love (several picks) ---------------------------------------- */

  function stepPassions() {
    const step = html(`
      <section class="step">
        <h1 class="title"></h1>
        <p class="subtitle">Coche tout ce qui te parle.</p>
        <div class="passions loves" role="group" aria-label="Ce que tu aimes">
          ${PASSIONS.map((passion, i) => {
            const on = state.passions.includes(passion.id);
            return `<button type="button" class="opt tile appear${on ? " on" : ""}" style="--d:${200 + i * 40}ms" data-id="${passion.id}" data-key="${i + 1}" aria-pressed="${on}">
              <span class="tick">${CHECK}</span>
              <span class="glyph">${icon(passion.icon)}</span>
              <span class="label">${esc(passion.label)}</span>
            </button>`;
          }).join("")}
        </div>
        <div class="continue appear" style="--d:520ms">
          <button type="button" class="btn btn-primary"${state.passions.length ? "" : " disabled"}>Continuer ${ARROW}</button>
        </div>
      </section>`);

    header(step, "Qu'est-ce que tu aimes dans la vie ?");
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

  /* ---- 2. The monthly goal (slider, green to orange) ---------------------------- */

  // The thumb's color along the slider: MakeSaaS green, a warm yellow, then MakeSaaS orange.
  const KNOB = [
    [0, [1, 179, 108]],
    [0.5, [255, 196, 61]],
    [1, [255, 117, 24]],
  ];
  const knobAt = (share) => {
    const i = share <= KNOB[1][0] ? 0 : 1;
    const [from, a] = KNOB[i];
    const [to, b] = KNOB[i + 1];
    const t = (share - from) / (to - from);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(" ")})`;
  };

  function stepGoal() {
    const { stops, tiers } = GOAL;
    const last = stops.length - 1;
    let index = Math.max(0, stops.indexOf(state.goal));

    const step = html(`
      <section class="step">
        <h1 class="title"></h1>
        <div class="goal">
          <div class="amount" aria-hidden="true"></div>
          <div class="appear" style="--d:250ms">
            <p class="caption">par mois</p>
            <p class="tier3"><span class="tier-check">${CHECK}</span><b class="tier-word"></b></p>
            <input type="range" class="range range3" min="0" max="${last}" step="1" value="${index}" aria-label="Objectif par mois" />
            <div class="ends"><span>${eur0.format(stops[0])}</span><span>${eur0.format(stops[last])}</span></div>
          </div>
        </div>
        <div class="continue appear" style="--d:400ms">
          <button type="button" class="btn btn-primary">Continuer ${ARROW}</button>
        </div>
      </section>`);

    header(step, "Combien tu veux gagner par mois ?");

    const range = step.querySelector(".range");
    const word = step.querySelector(".tier-word");
    const setAmount = rollingAmount(step.querySelector(".amount"));

    /** Everything but the big figure, which rolls on its own. */
    const update = (i) => {
      const share = i / last;
      state.goal = stops[i];
      range.value = String(i);
      range.style.setProperty("--range-progress", String(share));
      step.style.setProperty("--knob", knobAt(share));
      const tier = tiers.find((t) => state.goal <= t.upTo);
      if (tier && word.textContent !== tier.word) {
        word.textContent = tier.word;
        replay(word, "swap");
      }
      range.setAttribute("aria-valuetext", `${eur0.format(state.goal)} par mois`);
    };

    range.addEventListener("input", () => {
      const i = Number(range.value);
      // A coin every 5 000 €, higher as it goes up.
      if (Math.floor(i / 5) !== Math.floor(index / 5)) sound.coin(i / last);
      index = i;
      update(i);
      setAmount(state.goal);
    });

    update(index);
    // Once on screen, so the reels spin in from 0.
    later(() => setAmount(state.goal, { opening: true }), 60);
    step.querySelector(".btn-primary").addEventListener("click", proceed);
    return step;
  }

  /* ---- 3. The idea found: the names rolling around the orb ---------------------- */

  /** MakeSaaS's mark, white, in the middle of the orb while it searches. */
  const BRAND_MARK =
    '<svg class="orb-brand" viewBox="-4.8 -27.9 130.8 130.8" aria-hidden="true"><path fill="#fff" d="M40.3 1.7Q41.3 0 43.1 0L69.4 0Q71.3 0 71.3 1.9L71.3 19.4Q71.3 21.3 70.4 22.9L49 61.9L49 37.6L29.3 73.3Q28.4 75 26.5 75L1.9 75Q0 75 0.9 73.3ZM87.5 1.7Q88.4 0 90.3 0L119.3 0Q121.1 0 120.8 1.9L109.4 73.1Q109.1 75 107.3 75L98 75Q96.2 75 96.2 73.1L96.2 37.6L76.5 73.3Q75.6 75 73.7 75L49.1 75Q47.2 75 48.1 73.3Z"/></svg>';

  /**
   * No screen to wait on: the orb spins with MakeSaaS's mark in it and the names roll at once, faster
   * then slower; once the idea lands, the orb calms down and shows the idea's icon.
   */
  function stepFind() {
    const idea = ideaOf();

    const step = html(`
      <section class="step find searching">
        <div class="orb-zone" aria-hidden="true">
          ${DECOYS.slice(0, 6)
            .map((name, i) => `<span class="ghost-chip g${i + 1}">${esc(name)}</span>`)
            .join("")}
          <div class="orb"><span class="orb-ring"></span><span class="orb-core"></span><span class="orb-spark">${BRAND_MARK}</span></div>
        </div>
        <p class="kicker3 appear" style="--d:120ms">Je cherche ton idée…</p>
        <div class="slot appear" style="--d:180ms"><div class="slot-reel"></div></div>
      </section>`);

    const kicker = step.querySelector(".kicker3");
    const spark = step.querySelector(".orb-spark");
    const reel = step.querySelector(".slot-reel");

    async function search() {
      // Names roll past, faster then slower, and the idea lands in the middle.
      const others = [...DECOYS, ...Object.values(IDEAS).map((i) => i.name)].filter((n) => n !== idea.name);
      const names = Array.from({ length: 16 }, (_, i) => others[(i * 7 + 3) % others.length]);
      names.push(idea.name);
      reel.innerHTML = names.map((name) => `<span>${esc(name)}</span>`).join("");
      const rows = Array.from(reel.children);
      await sleep(250);

      const row = rows[0].offsetHeight;
      const distance = (names.length - 1) * row;
      const began = performance.now();
      let current = -1;
      await new Promise((resolve) => {
        loop((now) => {
          const t = Math.min(1, (now - began) / 2800);
          const position = distance * easeOutQuart(t);
          reel.style.transform = `translateY(${row - position}px)`;
          const at = Math.round(position / row);
          if (at !== current) {
            rows[current]?.classList.remove("current");
            rows[at]?.classList.add("current");
            current = at;
            sound.tick(0.6);
          }
          if (t < 1) return true;
          resolve();
          return false;
        });
      });

      // Found: the name lights up, the orb calms down and shows the idea's icon.
      rows[rows.length - 1].classList.add("landed");
      step.classList.remove("searching");
      spark.innerHTML = icon(idea.icon);
      replay(spark, "pop");
      kicker.textContent = "Je l'ai trouvée";
      replay(kicker, "swap");
      sound.pop();
      await sleep(1000);
      next();
    }

    // As soon as the orb is in.
    later(search, 350);
    return step;
  }

  /* ---- 4. The idea's card --------------------------------------------------------- */

  function stepIdea() {
    const idea = ideaOf();
    const step = html(`
      <section class="step reveal">
        <p class="kicker3 appear">Ton idée est prête ${icon("sparkles")}</p>
        <article class="idea-card" style="--accent:${idea.accent}">
          <div class="ic-top"><span class="ic-kind">${esc(idea.kind)}</span><span class="ic-domain"><i></i>${esc(domainOf(idea))}</span></div>
          <span class="ic-art" aria-hidden="true">${icon(idea.icon)}</span>
          <span class="ic-logo" aria-hidden="true">${icon(idea.icon)}</span>
          <h2 class="ic-name">${esc(idea.name)}</h2>
          <p class="ic-pitch">${esc(idea.pitch)}</p>
          <div class="ic-feats">${idea.features.map(([name, label]) => `<span class="ic-feat">${icon(name)}${esc(label)}</span>`).join("")}</div>
          <div class="ic-grid">
            <div class="ic-box"><small>Cible</small><p>${esc(idea.audience)}</p></div>
            <div class="ic-box"><small>Objectif</small><p class="ic-goal">${icon("target")}${esc(eur0.format(state.goal))} / mois</p></div>
          </div>
          <div class="ic-steps">
            <small>Tes 3 premières actions</small>
            <ol>${idea.firstSteps.map((text, i) => `<li><span class="n">${i + 1}</span>${esc(text)}</li>`).join("")}</ol>
          </div>
        </article>
        <div class="continue appear" style="--d:650ms">
          <button type="button" class="btn btn-primary">Obtenir mon prompt ${ARROW}</button>
        </div>
      </section>`);

    later(() => {
      sound.launch();
      burstOver(step.querySelector(".idea-card"), { count: 110, colors: [idea.accent] });
    }, 250);
    step.querySelector(".btn-primary").addEventListener("click", proceed);
    return step;
  }

  /* ---- 5. Its prompt, to send to Claude ----------------------------------------- */

  /** The prompt Claude gets: just a landing page, with the idea and its style. */
  function promptText(idea) {
    return [
      `Fais-moi une landing page pour ma startup, ${idea.name}.`,
      "",
      `${idea.name} est ${idea.what}. ${idea.pitch}`,
      `Cible : ${lowerFirst(idea.audience)}`,
      `Accroche : « ${idea.hook} »`,
      `Fonctionnalités : ${idea.features.map(([, label]) => label).join(" · ")}.`,
      `Prix : ${eur2.format(idea.price)} par mois.`,
      "",
      "Les sections : l'accroche, le problème, 3 bénéfices, comment ça marche, le prix.",
      `Le style : sombre et élégant, grands titres en serif, ${idea.accent} en couleur d'accent, animations douces au scroll, parfaite sur mobile.`,
    ].join("\n");
  }

  function stepPrompt() {
    const idea = ideaOf();
    const text = promptText(idea);
    const step = html(`
      <section class="step">
        <p class="kicker3 appear">Ton prompt est prêt ${ARROW}</p>
        <h1 class="title"></h1>
        <p class="subtitle">Claude va créer ton site à partir de ce prompt.</p>
        <div class="prompt-card appear" style="--d:250ms">
          <div class="pc-head">
            <span class="pc-name">${CLAUDE_MARK} Prompt pour Claude</span>
            <button type="button" class="pc-copy">${COPY}<span>Copier le prompt</span></button>
          </div>
          <pre class="pc-text" aria-label="Le prompt"></pre>
        </div>
        <div class="continue appear" style="--d:450ms">
          <button type="button" class="btn btn-primary">Ouvrir Claude ${EXTERNAL}</button>
        </div>
      </section>`);

    header(step, "Envoie ça à Claude.");

    // The prompt writes itself in, fast.
    const pre = step.querySelector(".pc-text");
    later(() => {
      const began = performance.now();
      loop((now) => {
        const t = Math.min(1, (now - began) / 1300);
        pre.textContent = text.slice(0, Math.round(text.length * t));
        return t < 1;
      });
    }, 350);

    const copy = step.querySelector(".pc-copy");
    copy.addEventListener("click", () => {
      navigator.clipboard?.writeText(text).catch(() => {});
      copy.classList.add("done");
      copy.innerHTML = `${CHECK}<span>Copié</span>`;
      replay(copy, "pop");
      sound.select();
      // Enter then goes on to Claude instead of copying again (and no focus ring in the video).
      copy.blur();
    });
    step.querySelector(".btn-primary").addEventListener("click", proceed);
    return step;
  }

  /* ---- 6. Claude builds the site, in its chat ---------------------------------- */

  function stepBuilder() {
    const idea = ideaOf();
    const domain = domainOf(idea);
    const text = promptText(idea);
    const price = eur2.format(idea.price);

    const step = html(`
      <section class="step builder-step">
        <div class="builder" style="--accent:${idea.accent}">
          <header class="b-head">
            <span class="b-mark">${CLAUDE_MARK}</span><b>Claude</b><span class="b-sep">/</span><span class="b-title">Nouvelle conversation</span>
          </header>
          <div class="b-body">
            <div class="b-empty">
              <span class="b-logo">${CLAUDE_MARK}</span>
              <h2>Qu'est-ce qu'on construit aujourd'hui ?</h2>
            </div>
            <div class="b-thread"></div>
          </div>
          <div class="b-composer">
            <div class="b-input" role="textbox" tabindex="0" aria-label="Ton message">
              <span class="b-placeholder">Colle ton prompt ici…</span>
              <pre class="b-text"></pre>
            </div>
            <button type="button" class="b-send" aria-label="Envoyer" disabled>${SEND}</button>
          </div>
        </div>
      </section>`);

    const $ = (selector) => step.querySelector(selector);
    const body = $(".b-body");
    const thread = $(".b-thread");
    const input = $(".b-input");
    const send = $(".b-send");
    let stage = "empty"; // → pasted → sent → done

    const scrollDown = () => body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });

    /** A tap in the box (or V) pastes the prompt, its end in view. */
    const paste = () => {
      if (stage !== "empty") return;
      stage = "pasted";
      input.classList.add("filled");
      $(".b-text").textContent = text;
      input.scrollTop = input.scrollHeight;
      send.disabled = false;
      send.classList.add("ready");
      sound.pop();
    };

    const sendPrompt = () => {
      if (stage !== "pasted") return;
      stage = "sent";
      input.classList.remove("filled");
      $(".b-text").textContent = "";
      send.disabled = true;
      send.classList.remove("ready");
      step.querySelector(".builder").classList.add("talking");
      $(".b-title").textContent = `Site ${idea.name}`;
      sound.confirm();
      converse();
    };

    const CODE = [
      "export default function Home() {",
      "  return (",
      '    <main className="bg-black text-white">',
      `      <Hero title="${idea.hook}" />`,
      `      <Features items={${JSON.stringify(idea.features.map(([, label]) => label))}} />`,
      `      <Pricing price="${price}" plan="Pro" />`,
      "      <Waitlist />",
      "    </main>",
      "  );",
      "}",
    ];

    /** Lines of code typed into a block, one after the other. */
    const streamCode = async (list) => {
      const item = html('<li class="b-code"><pre></pre></li>');
      list.append(item);
      const pre = item.querySelector("pre");
      for (const line of CODE) {
        pre.textContent += `${line}\n`;
        scrollDown();
        await sleep(70);
      }
    };

    const aiMessage = (inner) =>
      html(`<div class="b-msg ai"><span class="b-avatar">${CLAUDE_MARK}</span><div class="b-ai">${inner}</div></div>`);

    async function converse() {
      const lines = text.split("\n");
      thread.append(
        html(`<div class="b-msg me"><p>${esc(lines.slice(0, 1).join(" "))}</p><span class="b-attach">${icon("clipboard-list")} Prompt · ${lines.length} lignes</span></div>`),
      );
      scrollDown();
      await sleep(650);

      const reply = aiMessage('<p class="b-say"></p><ol class="b-steps"></ol>');
      thread.append(reply);
      scrollDown();
      await typewrite(reply.querySelector(".b-say"), `Parfait, je m'occupe de tout : je construis ${idea.name} de A à Z, puis je le mets en ligne sur ${domain}.`, {
        charMs: 14,
        delay: 80,
      });

      const list = reply.querySelector(".b-steps");
      for (const [i, raw] of BUILD_STEPS.entries()) {
        const label = raw.replace("{name}", idea.name).replace("{domain}", domain);
        const item = html(`<li class="doing"><span class="b-state"><i class="b-spin"></i>${CHECK}</span><span>${esc(label)}</span></li>`);
        list.append(item);
        scrollDown();
        await sleep(i === 2 ? 800 : 480);
        item.classList.replace("doing", "done");
        sound.tick(0.7);
        if (i === 1) await streamCode(list);
      }

      await sleep(350);
      const done = aiMessage(`
        <p>C'est en ligne 🚀 Ton site <b>${esc(idea.name)}</b> est prêt : page d'accueil complète, animations, liste d'attente, paiement et version mobile.</p>
        <div class="b-site">
          <span class="b-site-logo">${icon(idea.icon)}</span>
          <span class="b-site-name"><b>${esc(idea.name)}</b><small><i></i>${esc(domain)} · en ligne</small></span>
        </div>
        <button type="button" class="b-open">Ouvrir mon site ${EXTERNAL}</button>`);
      thread.append(done);
      scrollDown();
      stage = "done";
      sound.launch();
      done.querySelector(".b-open").addEventListener("click", proceed);
    }

    input.addEventListener("click", paste);
    send.addEventListener("click", sendPrompt);
    // Enter: paste, then send, then open the site.
    step.onEnter = () => {
      if (stage === "empty") paste();
      else if (stage === "pasted") sendPrompt();
      else if (stage === "done") proceed();
    };
    step.onPaste = paste;
    return step;
  }

  /* ---- 7. The site, scrolling, while the payments land ------------------------- */

  /** In the variant, no payments: once the page has scrolled, its button leads to the marketing. */
  function stepSite() {
    const idea = ideaOf();
    const domain = domainOf(idea);
    const price = eur2.format(idea.price);
    const [top, middle, bottom] = idea.hero.lines;
    const [outroTop, outroBottom] = idea.outro;
    const brand = idea.name.toUpperCase();

    const step = html(`
      <section class="step site-step" style="--accent:${idea.accent}">
        <div class="browser">
          <div class="br-bar">
            <span class="br-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <div class="br-url">${LOCK}<span>${esc(domain)}</span><em>En ligne</em></div>
          </div>
          <div class="br-view">
            <div class="s3">
              <nav class="s3-nav">
                <b class="s3-brand"><i></i>${esc(brand)}</b>
                <span class="s3-links"><span>Fonctionnalités</span><span>Exemple</span><span>FAQ</span></span>
                <span class="s3-login">Connexion</span>
              </nav>
              <section class="s3-hero">
                <div class="s3-copy">
                  <p class="s3-kicker"><i></i>${esc(idea.hero.kicker)}</p>
                  <h1 class="s3-h1">${esc(top)}<br /><em>${esc(middle)}</em><br />${esc(bottom)}</h1>
                  <p class="s3-sub">${esc(idea.sub)}</p>
                  <span class="s3-cta">${esc(idea.cta)}</span>
                </div>
                <div class="s3-art" aria-hidden="true"><span class="s3-disc"><span class="s3-label">${icon(idea.icon)}</span></span></div>
              </section>
              <section class="s3-feats">
                ${idea.features.map(([name, label], i) => `<div class="s3-feat"><span class="s3-fi">${icon(name)}</span><small>0${i + 1}</small><b>${esc(label)}</b></div>`).join("")}
              </section>
              <section class="s3-how">
                <p class="s3-kicker"><i></i>Comment ça marche</p>
                <ol>${idea.steps.map((text, i) => `<li><small>0${i + 1}</small><b>${esc(text)}</b></li>`).join("")}</ol>
              </section>
              <section class="s3-price">
                <div class="s3-plan">
                  <small>${esc(idea.name)} Pro</small>
                  <b>${esc(price)}<span> / mois</span></b>
                  <p>Tout ${esc(idea.name)}, sans limite. Sans engagement.</p>
                  <span class="s3-cta">${esc(idea.cta)}</span>
                </div>
              </section>
              <section class="s3-outro">
                <h2>${esc(outroTop)}<br /><em>${esc(outroBottom)}</em></h2>
                <span class="s3-cta">${esc(idea.cta)}</span>
              </section>
              <footer class="s3-foot"><b>${esc(brand)}</b><span>Mentions légales · CGV · Contact</span></footer>
            </div>
          </div>
          <div class="pays" aria-live="polite"></div>
        </div>
        ${
          MARKETING
            ? `<div class="continue site-next"><button type="button" class="btn btn-primary" disabled>Lancer mon marketing ${ARROW}</button></div>`
            : ""
        }
      </section>`);

    const view = step.querySelector(".br-view");
    const pays = step.querySelector(".pays");

    // The variant's button: there from the start (the browser keeps its size), shown once the page has
    // scrolled, or as soon as a wheel or a touch takes over.
    const onward = step.querySelector(".site-next");
    const offerMarketing = () => {
      const button = onward.querySelector(".btn");
      if (!button.disabled) return;
      button.disabled = false;
      onward.classList.add("in");
      sound.pop();
    };
    onward?.querySelector(".btn").addEventListener("click", proceed);

    // The page scrolls down by itself (a wheel or a touch takes over).
    let held = false;
    const hold = () => {
      held = true;
      if (onward) offerMarketing();
    };
    view.addEventListener("wheel", hold, { passive: true });
    view.addEventListener("touchstart", hold, { passive: true });

    const scrollThrough = (ms) => {
      const distance = view.scrollHeight - view.clientHeight;
      const began = performance.now();
      loop((now) => {
        if (held) return false;
        const t = Math.min(1, (now - began) / ms);
        view.scrollTop = distance * easeInOutCubic(t);
        return t < 1;
      });
    };

    /** A payment notification, on top of the others (the oldest leave). */
    const pay = (payer) => {
      const note = html(`
        <div class="pay">
          <span class="pay-logo">${WHOP_MARK}</span>
          <span class="pay-text"><b>Nouveau paiement 💰</b><small>${esc(payer)} vient de payer ${esc(price)}</small></span>
          <em>maintenant</em>
        </div>`);
      pays.prepend(note);
      while (pays.children.length > 5) pays.lastElementChild.remove();
      sound.coin(0.7 + Math.random() * 0.3);
    };

    async function run() {
      await sleep(700);
      scrollThrough(6500);
      if (onward) {
        await sleep(6700);
        offerMarketing();
        return;
      }
      await sleep(1800);
      for (const [i, payer] of PAYERS.slice(0, 6).entries()) {
        pay(payer);
        if (i === 0) burstOver(step.querySelector(".browser"), { count: 120, colors: [idea.accent] });
        await sleep(700 - i * 60);
      }
      sound.launch();
    }

    later(run, 100);
    return step;
  }

  /* ---- 8. The marketing (variant): the TikTok videos made, published, then their views ---------- */

  /** Counts written as TikTok does: 812, 96,4 K, 2,4 M. */
  const compact = (n) => {
    if (n < 1000) return String(Math.round(n));
    const [value, unit] = n < 1e6 ? [n / 1e3, "K"] : [n / 1e6, "M"];
    return `${value.toLocaleString("fr-FR", { maximumFractionDigits: value < 100 ? 1 : 0 })}\u202f${unit}`;
  };

  /** No line break between a number and its word, nor before French's spaced punctuation. */
  const unbreakable = (text) => text.replace(/(\d) /g, "$1\u00a0").replace(/ ([:;!?»])/g, "\u00a0$1");

  /**
   * The idea's TikTok account, empty, and its videos being made side by side (each with its percent
   * and what it is doing), then their thumbnails. "Publier sur TikTok" (Enter): each one's views
   * climb, the account's figures with them, and hearts fly up.
   */
  function stepMarketing() {
    const idea = ideaOf();
    const videos = idea.videos;
    // Each video's picture: the idea's icon, then its features', in turn.
    const pictures = [idea.icon, ...idea.features.map(([name]) => name)];

    const step = html(`
      <section class="step mk-step" style="--accent:${idea.accent}">
        <p class="kicker3 appear">${TIKTOK_MARK}<span class="mk-kicker">Ton marketing</span></p>
        <h1 class="title"></h1>
        <div class="mk-profile appear" style="--d:150ms">
          <span class="mk-avatar">${icon(idea.icon)}</span>
          <div class="mk-who">
            <p class="mk-name"><b>${esc(idea.name)}</b><small>@${esc(slug(idea.name))}</small></p>
            <p class="mk-stats">
              <span><b data-stat="followers">0</b> Abonnés</span>
              <span><b data-stat="likes">0</b> J'aime</span>
              <span><b data-stat="views">0</b> Vues</span>
            </p>
          </div>
        </div>
        <div class="mk-grid appear" style="--d:300ms">
          ${videos
            .map(
              ([format, hook], i) => `
            <article class="mk-vid wait">
              <div class="mk-thumb">
                <span class="mk-art">${icon(pictures[i % pictures.length])}</span>
                <span class="mk-format">${esc(format)}</span>
                <p class="mk-hook look${i % 3}"><span>${esc(unbreakable(hook))}</span></p>
                <span class="mk-views">${PLAY}<b>0</b></span>
                <span class="mk-time">0:${String(14 + ((i * 17) % 42)).padStart(2, "0")}</span>
              </div>
              <div class="mk-gen">
                <b class="mk-pct">0 %</b>
                <small class="mk-stage">En attente</small>
                <i class="mk-bar"><span></span></i>
              </div>
            </article>`,
            )
            .join("")}
        </div>
        <div class="continue mk-foot appear" style="--d:450ms">
          <div class="mk-status"><i class="b-spin"></i><span>Je crée tes vidéos TikTok…</span><b>0 / ${videos.length}</b></div>
        </div>
      </section>`);

    header(step, "Je crée tes vidéos.");

    const $ = (selector) => step.querySelector(selector);
    const tiles = Array.from(step.querySelectorAll(".mk-vid"));
    const foot = $(".mk-foot");
    const stats = Object.fromEntries(Array.from(step.querySelectorAll("[data-stat]"), (el) => [el.dataset.stat, el]));
    let ready = 0;

    /** One video made: its percent climbing through what it is doing, then its thumbnail. */
    const make = (tile, ms) =>
      new Promise((resolve) => {
        const pct = tile.querySelector(".mk-pct");
        const stage = tile.querySelector(".mk-stage");
        const bar = tile.querySelector(".mk-bar span");
        tile.classList.replace("wait", "make");
        const began = performance.now();
        let shown = -1;
        let doing = -1;
        loop((now) => {
          const t = Math.min(1, (now - began) / ms);
          const value = Math.round(100 * (0.7 * t + 0.3 * easeOutQuart(t)));
          if (value !== shown) {
            pct.textContent = `${value} %`;
            bar.style.transform = `scaleX(${value / 100})`;
            shown = value;
          }
          const at = Math.min(MAKING.length - 1, Math.floor(t * MAKING.length));
          if (at !== doing) {
            stage.textContent = MAKING[at];
            doing = at;
            sound.tick(0.35);
          }
          if (t < 1) return true;
          resolve();
          return false;
        });
      });

    /** A video ready: its thumbnail shows, a note one step higher than the one before. */
    const done = (tile) => {
      tile.classList.replace("make", "ready");
      sound.select(ready);
      ready += 1;
      $(".mk-status b").textContent = `${ready} / ${tiles.length}`;
    };

    async function generate() {
      await sleep(900);
      // Several at once, each started a moment after the one before.
      await Promise.all(
        tiles.map(async (tile, i) => {
          await sleep(i * 520);
          await make(tile, 1900 + (i % 3) * 380);
          done(tile);
        }),
      );
      await sleep(350);
      foot.innerHTML = `<button type="button" class="btn btn-primary mk-publish appear">${TIKTOK_MARK}Publier sur TikTok</button>`;
      foot.querySelector(".btn").addEventListener("click", publish, { once: true });
      sound.pop();
    }

    /** A heart flying up from a video. */
    const heart = (tile) => {
      const x = Math.round(Math.random() * 40 - 20);
      const r = Math.round(Math.random() * 40 - 20);
      const el = html(`<span class="mk-heart" style="--x:${x}px;--r:${r}deg">${HEART}</span>`);
      el.addEventListener("animationend", () => el.remove());
      tile.append(el);
    };

    /** Each video's views climb (one after the other), the account's figures with them. */
    function countViews() {
      const counts = tiles.map((tile) => tile.querySelector(".mk-views b"));
      const shown = [];
      const began = performance.now();
      let nextHeart = began + 300;
      loop((now) => {
        let total = 0;
        let climbing = false;
        tiles.forEach((tile, i) => {
          const t = clamp((now - began - i * 180) / 5200, 0, 1);
          if (t < 1) climbing = true;
          const value = VIEWS[i % VIEWS.length] * easeInOutCubic(t);
          total += value;
          const text = compact(value);
          if (shown[i] !== text) counts[i].textContent = shown[i] = text;
        });
        stats.views.textContent = compact(total);
        stats.likes.textContent = compact(total * 0.093);
        stats.followers.textContent = compact(total * 0.016);
        if (climbing && now >= nextHeart) {
          heart(tiles[Math.floor(Math.random() * tiles.length)]);
          nextHeart = now + 180 + Math.random() * 220;
        }
        return climbing;
      });
    }

    /** Published: the views climb, and confetti once they take off. */
    async function publish() {
      sound.confirm();
      foot.innerHTML = `<div class="mk-status live"><i class="mk-dot"></i><span>En ligne sur TikTok</span><b>${tiles.length} vidéos</b></div>`;
      const kicker = $(".mk-kicker");
      kicker.textContent = "Tes vidéos sont en ligne";
      replay(kicker.parentElement, "swap");
      typewrite($(".title"), "Elles cartonnent.", { delay: 250 });
      tiles.forEach((tile, i) => later(() => tile.classList.replace("ready", "live"), i * 120));
      countViews();

      await sleep(1500);
      burstOver($(".mk-grid"), { count: 120, colors: [idea.accent, "#FE2C55", "#25F4EE"] });
      sound.launch();
    }

    later(generate, 100);
    return step;
  }

  /* ---- Controls ------------------------------------------------------------ */

  controls({
    restart,
    onKey(event) {
      const step = main.firstElementChild;
      if (!step || step.classList.contains("leaving")) return;
      if (/^[1-9]$/.test(event.key)) step.querySelector(`[data-key="${event.key}"]`)?.click();
      else if (event.key.toLowerCase() === "v") step.onPaste?.();
      // Enter on a focused button already clicks it.
      else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (step.onEnter) step.onEnter();
        else step.querySelector(".continue .btn:not(:disabled)")?.click();
      }
    },
  });
  btnBack.addEventListener("click", () => stepIndex > 0 && show(stepIndex - 1));

  show(0);
})();
