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
  const ICONS = window.FO_ICONS;
  const spider = window.FO_SPIDER;

  const main = document.getElementById("main");
  const progressFill = document.getElementById("progressFill");
  const btnBack = document.getElementById("btnBack");

  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const LOCK = '<svg class="m-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const fresh = () => ({ passions: [], time: null, bank: null, goal: GOAL.start });
  let state = fresh();
  let stepIndex = 0;

  /* ---- Helpers ------------------------------------------------------------ */

  // Every timer and animation loop belongs to the step on screen: changing step bumps `gen`,
  // which drops them (a pending `sleep` never resolves, so the sequence just stops).
  let gen = 0;
  let timers = [];

  const later = (fn, ms) => {
    const g = gen;
    const id = setTimeout(() => g === gen && fn(), ms);
    timers.push(id);
    return id;
  };
  const sleep = (ms) => new Promise((resolve) => later(resolve, ms));
  const loop = (fn) => {
    const g = gen;
    const tick = (now) => {
      if (g !== gen) return;
      if (fn(now) !== false) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const html = (markup) => {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  };
  const esc = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  const slug = (text) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const bankLogo = (bank) => `<span class="bank-logo" style="background:${bank.bg}">${bank.svg}</span>`;
  /** A Lucide icon (icons.js), drawn in the current text color. */
  const icon = (name, cls = "") =>
    `<svg class="ico${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;

  /** Replays a one-shot CSS animation class. */
  const replay = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  /** Types the text letter by letter; the untyped rest is laid out invisible, so lines never move. */
  function typewrite(el, text, { charMs = 34, delay = 150 } = {}) {
    return new Promise((resolve) => {
      el.setAttribute("aria-label", text);
      el.innerHTML = '<span class="typed" aria-hidden="true"></span><span class="ghost" aria-hidden="true"></span>';
      const [typed, ghost] = el.children;
      ghost.textContent = text;
      const letters = Array.from(text);
      let count = 0;
      const step = () => {
        count += 1;
        typed.textContent = letters.slice(0, count).join("");
        ghost.textContent = letters.slice(count).join("");
        if (count < letters.length) later(step, charMs * (0.7 + Math.random() * 0.6));
        else resolve();
      };
      later(step, delay);
    });
  }

  /* ---- Sounds (Web Audio, no file) ------------------------------------------ */

  const sound = (() => {
    let context = null;
    let enabled = true;
    try {
      enabled = localStorage.getItem("fo-sound") !== "off";
    } catch {}
    document.body.classList.toggle("muted", !enabled);

    const audio = () => {
      if (!context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return null;
        context = new Context();
      }
      return context;
    };
    // Browsers only start audio from a tap or a key press. Resuming takes a moment, so a sound played
    // by that very first tap is scheduled anyway (it starts as soon as audio runs). Before any tap
    // (the preview in the admin list), nothing is scheduled, so nothing piles up.
    let unlocked = false;
    const unlock = () => {
      unlocked = true;
      audio()?.resume();
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });

    const ready = () => {
      if (!enabled || !unlocked) return null;
      const ctx = audio();
      if (!ctx || ctx.state === "closed") return null;
      if (ctx.state !== "running") ctx.resume();
      return ctx;
    };
    const output = (ctx, level) => {
      const out = ctx.createGain();
      out.gain.value = level;
      out.connect(ctx.destination);
      return out;
    };
    const note = (ctx, out, frequency, start, duration, level, type = "sine") => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(out);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    };

    return {
      toggle() {
        enabled = !enabled;
        document.body.classList.toggle("muted", !enabled);
        try {
          localStorage.setItem("fo-sound", enabled ? "on" : "off");
        } catch {}
      },
      /**
       * A card picked: a round "pop" whose pitch jumps up, with a bright sparkle on top. `step`
       * raises it along a major scale (each extra passion picked sounds one note higher).
       */
      select(step = 0) {
        const ctx = ready();
        if (!ctx) return;
        const now = ctx.currentTime;
        const out = output(ctx, 0.32);
        const semitones = [0, 2, 4, 7, 9, 12][Math.min(step, 5)];
        const lift = Math.pow(2, semitones / 12);
        const oscillator = ctx.createOscillator();
        oscillator.frequency.setValueAtTime(380 * lift, now);
        oscillator.frequency.exponentialRampToValueAtTime(900 * lift, now + 0.07);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.9, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
        oscillator.connect(gain).connect(out);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        note(ctx, out, 1800 * lift, now + 0.04, 0.2, 0.22);
        note(ctx, out, 2700 * lift, now + 0.04, 0.12, 0.08);
      },
      /** "Continuer": a soft whoosh rising under two quick notes going up. */
      confirm() {
        const ctx = ready();
        if (!ctx) return;
        const now = ctx.currentTime;
        const out = output(ctx, 0.3);
        const length = Math.floor(ctx.sampleRate * 0.26);
        const noise = ctx.createBuffer(1, length, ctx.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / length);
        const whoosh = ctx.createBufferSource();
        whoosh.buffer = noise;
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.Q.value = 0.9;
        band.frequency.setValueAtTime(600, now);
        band.frequency.exponentialRampToValueAtTime(3200, now + 0.24);
        const whooshLevel = ctx.createGain();
        whooshLevel.gain.value = 0.35;
        whoosh.connect(band).connect(whooshLevel).connect(out);
        whoosh.start(now);
        note(ctx, out, 784, now + 0.02, 0.22, 0.5, "triangle");
        note(ctx, out, 1175, now + 0.1, 0.32, 0.5, "triangle");
        note(ctx, out, 2350, now + 0.1, 0.25, 0.08);
      },
      /** A card unticked: the same pop going down, softer. */
      deselect() {
        const ctx = ready();
        if (!ctx) return;
        const now = ctx.currentTime;
        const out = output(ctx, 0.22);
        const oscillator = ctx.createOscillator();
        oscillator.frequency.setValueAtTime(720, now);
        oscillator.frequency.exponentialRampToValueAtTime(320, now + 0.09);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.8, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        oscillator.connect(gain).connect(out);
        oscillator.start(now);
        oscillator.stop(now + 0.18);
      },
      /** Soft click (the orbit, the page being painted). */
      tick(level = 1) {
        const ctx = ready();
        if (!ctx) return;
        note(ctx, output(ctx, 0.12 * level), 1500, ctx.currentTime, 0.05, 0.6, "triangle");
      },
      /** A coin clink for each stop of the slider, higher as the amount goes up (`progress` 0-1). */
      coin(progress = 0) {
        const ctx = ready();
        if (!ctx) return;
        const out = output(ctx, 0.16);
        const now = ctx.currentTime;
        const base = 1650 * Math.pow(2, progress * 0.9);
        // Metal rings with partials that are not harmonics (that is what makes it sound like a coin).
        for (const [ratio, level, length] of [
          [1, 0.55, 0.22],
          [2.76, 0.28, 0.14],
          [5.4, 0.12, 0.08],
        ]) {
          note(ctx, out, base * ratio, now, length, level);
        }
      },
      /** Two glassy notes going up (something found or connected). */
      pop() {
        const ctx = ready();
        if (!ctx) return;
        const out = output(ctx, 0.25);
        const now = ctx.currentTime;
        for (const [frequency, delay] of [
          [1318.5, 0],
          [1760, 0.11],
        ]) {
          note(ctx, out, frequency, now + delay, 0.45, 0.6);
          note(ctx, out, frequency * 2, now + delay, 0.45, 0.12);
        }
      },
      /** Rising arpeggio (the site goes live, the goal is reached). */
      launch() {
        const ctx = ready();
        if (!ctx) return;
        const out = output(ctx, 0.22);
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
          note(ctx, out, frequency, now + i * 0.085, 0.55, 0.5, "triangle");
          note(ctx, out, frequency * 2, now + i * 0.085, 0.4, 0.1);
        });
      },
    };
  })();

  /* ---- Confetti ------------------------------------------------------------ */

  const confetti = (() => {
    const canvas = document.getElementById("confetti");
    const ctx = canvas.getContext("2d");
    let pieces = [];
    let running = false;

    const resize = () => {
      const ratio = turned.pixelRatio();
      canvas.width = innerWidth * ratio;
      canvas.height = innerHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of pieces) {
        p.vy += p.gravity;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        p.life += 1;
        const flip = Math.abs(Math.cos(p.life * p.flipSpeed));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.life > 150 ? Math.max(0, 1 - (p.life - 150) / 50) : 1;
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size / 2.4, (p.size / 2.4) * flip + 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, (-p.size / 4) * flip, p.size, (p.size / 2) * flip + 0.5);
        }
        ctx.restore();
      }
      pieces = pieces.filter((p) => p.life < 200 && p.y < innerHeight + 40);
      if (pieces.length) requestAnimationFrame(draw);
      else {
        running = false;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
      }
    };

    return {
      burst(x, y, { count = 140, power = 1, colors = [] } = {}) {
        const palette = ["#FF7518", "#01B36C", "#ffffff", "#FFD166", "#4ade80", ...colors];
        for (let i = 0; i < count; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
          const speed = (6 + Math.random() * 11) * power;
          pieces.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            gravity: 0.28 + Math.random() * 0.1,
            size: 7 + Math.random() * 7,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.3,
            flipSpeed: 0.05 + Math.random() * 0.1,
            color: palette[Math.floor(Math.random() * palette.length)],
            round: Math.random() < 0.3,
            life: Math.random() * 20,
          });
        }
        if (!running) {
          running = true;
          requestAnimationFrame(draw);
        }
      },
      clear() {
        pieces = [];
      },
    };
  })();

  /* ---- Navigation ---------------------------------------------------------- */

  const STEPS = [stepPassions, stepTime, stepBank, stepGoal, stepBuild];

  const setProgress = (value) => {
    progressFill.style.width = `${Math.max(value, 0.04) * 100}%`;
  };

  function show(index) {
    const g = ++gen;
    timers.forEach(clearTimeout);
    timers = [];
    stepIndex = index;
    btnBack.classList.toggle("is-hidden", index === 0);
    setProgress(index / STEPS.length);

    const mount = () => {
      if (g !== gen) return;
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
        later(next, 450);
      });
    });
    return step;
  }

  /* ---- 4. Monthly goal (slider) ---------------------------------------------- */

  /** Slot-machine figure: each digit is a reel that rolls to its value. */
  function rollingAmount(container) {
    let shape = "";
    let columns = [];

    const build = (text) => {
      container.textContent = "";
      columns = [];
      for (const char of text) {
        if (/\d/.test(char)) {
          const reel = document.createElement("span");
          reel.className = "reel";
          const column = document.createElement("span");
          column.className = "reel-col";
          column.innerHTML = Array.from({ length: 20 }, (_, i) => `<span>${i % 10}</span>`).join("");
          reel.append(column);
          container.append(reel);
          columns.push(column);
        } else {
          const piece = document.createElement("span");
          piece.className = "static";
          piece.textContent = char;
          container.append(piece);
        }
      }
    };

    return (value, { opening = false } = {}) => {
      const text = eur0.format(value);
      const digits = text.replace(/\D/g, "");
      const nextShape = text.replace(/\d/g, "0");
      const rebuilt = nextShape !== shape;
      if (rebuilt) {
        build(text);
        shape = nextShape;
        // New reels start on 0, then roll up to their digit.
        columns.forEach((column) => {
          column.style.transition = "none";
          column.style.transform = "translateY(0)";
        });
        void container.offsetWidth;
        columns.forEach((column, i) => {
          column.style.transition = "";
          column.classList.toggle("opening", opening);
          column.style.transitionDelay = opening ? `${i * 70}ms` : "0ms";
        });
      }
      columns.forEach((column, i) => {
        if (!rebuilt) {
          column.classList.remove("opening");
          column.style.transitionDelay = "0ms";
        }
        column.style.transform = `translateY(${-(10 + Number(digits[i])) * 1.1}em)`;
      });
    };
  }

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

  const controls = document.getElementById("controls");
  let idleTimer = 0;
  const wake = () => {
    controls.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controls.classList.add("idle"), 2200);
  };
  window.addEventListener("pointermove", wake);
  window.addEventListener("pointerdown", wake);
  wake();

  document.getElementById("btnRestart").addEventListener("click", restart);
  document.getElementById("btnSound").addEventListener("click", () => sound.toggle());
  document.getElementById("btnSpider").addEventListener("click", () => spider.toggle());
  document.getElementById("btnTurn").addEventListener("click", () => turned.next());
  document.getElementById("btnFull").addEventListener("click", () => turned.fullscreen());
  btnBack.addEventListener("click", () => stepIndex > 0 && show(stepIndex - 1));

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "r") restart();
    else if (key === "m") sound.toggle();
    else if (key === "a") spider.toggle();
    else if (key === "t") turned.next();
    else if (key === "f") turned.fullscreen();
    else if (event.key === "Escape" && !document.fullscreenElement) turned.home();
  });

  show(0);
})();
