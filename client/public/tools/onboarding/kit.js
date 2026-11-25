/*
 * What the fake onboardings (marketing tools to film) share: markup helpers, timers that belong to
 * the step on screen, typing, sounds, confetti, the rolling figure and the tool's controls.
 * Loaded after turn.js, icons.js and spider.js; each tool's app.js reads window.FO_KIT.
 */
window.FO_KIT = (() => {
  "use strict";

  const turned = window.FO_TURN;
  if (turned.holder) return null; // this page only holds the onboarding, turned (turn.js)

  const ICONS = window.FO_ICONS;

  /* ---- Markup and maths ------------------------------------------------------ */

  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const LOCK = '<svg class="m-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

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
      .replace(/\p{M}/gu, "")
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

  /* ---- Timers of the step on screen ------------------------------------------ */

  // Every timer and animation loop belongs to the step on screen: `newStep` (changing step) bumps
  // `gen`, which drops them (a pending `sleep` never resolves, so the sequence just stops).
  let gen = 0;
  let timers = [];

  /** Drops the timers of the step on screen; returns the new step's number. */
  const newStep = () => {
    gen += 1;
    timers.forEach(clearTimeout);
    timers = [];
    return gen;
  };
  const isCurrent = (g) => g === gen;

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
    // Creating the audio context can hold the page a moment (the sound card wakes up): it is created
    // as soon as the mouse moves over the page, so the first tap does not wait for it. (It stays
    // silent until that tap; the previews of the admin list get no mouse, so none is created there.)
    const warm = () => {
      window.removeEventListener("pointermove", warm, { capture: true });
      audio();
    };
    window.addEventListener("pointermove", warm, { capture: true, passive: true });

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

  /* ---- Rolling figure -------------------------------------------------------- */

  /** Slot-machine figure: each digit is a reel that rolls to its value (`format` writes it). */
  function rollingAmount(container, format = (value) => eur0.format(value)) {
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
      const text = format(value);
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

  /* ---- Tool controls ------------------------------------------------------- */

  /**
   * The buttons in the corner (fading out while the mouse rests, so they stay out of the video) and
   * the keys: R restart, M sound, A spider (spider.js), T turned screen (turn.js), F fullscreen,
   * Escape back to the list. `onKey` gets the other keys pressed without a modifier.
   */
  function controls({ restart, onKey = () => {} }) {
    const bar = document.getElementById("controls");
    const spider = window.FO_SPIDER;
    let idleTimer = 0;
    const wake = () => {
      bar.classList.remove("idle");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => bar.classList.add("idle"), 2200);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    wake();

    document.getElementById("btnRestart").addEventListener("click", restart);
    document.getElementById("btnSound").addEventListener("click", () => sound.toggle());
    document.getElementById("btnSpider").addEventListener("click", () => spider.toggle());
    document.getElementById("btnTurn").addEventListener("click", () => turned.next());
    document.getElementById("btnFull").addEventListener("click", () => turned.fullscreen());

    window.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "r") restart();
      else if (key === "m") sound.toggle();
      else if (key === "a") spider.toggle();
      else if (key === "t") turned.next();
      else if (key === "f") turned.fullscreen();
      else if (event.key === "Escape") {
        if (!document.fullscreenElement) turned.home();
      } else onKey(event);
    });
  }

  return {
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
  };
})();
