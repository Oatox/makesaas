(() => {
  // ---------------------------------------------------------------------------
  // Données
  // ---------------------------------------------------------------------------
  const DEFAULT_ITEMS = [
    "TRADING",
    "AMAZON FBA",
    "CRYPTO",
    "META ADS",
    "YOUTUBE SHORTS",
    "AGENCE SMMA",
    "AFFILIATION",
    "E-COMMERCE",
    "ROBLOX GAME",
    "DROPSHIPPING",
  ];
  // Phrases du haut : [partie normale, mot en couleur]
  const PHRASES = [
    ["LE SORT EST", "JETÉ."],
    ["QUE LE HASARD", "CHOISISSE."],
    ["LA ROUE A TOUJOURS", "RAISON."],
    ["LE DESTIN A DÉJÀ", "CHOISI."],
    ["FAIS CONFIANCE AU", "HASARD."],
    ["LA CHANCE VA", "TRANCHER."],
    ["ON NE DISCUTE PAS AVEC LE", "DESTIN."],
    ["TOURNE ET", "ASSUME."],
    ["LAISSE LE DESTIN", "DÉCIDER."],
  ];
  const [DEFAULT_TITLE, DEFAULT_ACCENT] = PHRASES[0];

  // Thèmes : le reste des couleurs est dans style.css ([data-theme="..."])
  const BARLOW = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif';
  const THEMES = [
    { id: "makesaas", name: "MakeSaaS", dot: "#ff7518", swatch: ["#0a0d0c", "#ff7518", "#01b36c"],
      font: '"Instrument Sans", "Inter", system-ui, sans-serif', weight: 700, spacing: -0.025, wordSpacing: 0.12,
      dim: [88, 106, 99], hot: [1, 43, 29], glow: null, wheelDim: [150, 166, 160] },
    { id: "rouge",   name: "Rouge",   dot: "#e8121c", swatch: ["#2a0505", "#e8121c", "#2e6a20"],
      font: BARLOW, weight: 800, spacing: 0.015, dim: [158, 29, 22], hot: [255, 177, 58], glow: "255,150,40",
      wheelDim: [190, 52, 38] },
    { id: "neon",    name: "Néon",    dot: "#ff3fdc", swatch: ["#0d0828", "#ff3fdc", "#00c4dc"],
      font: BARLOW, weight: 800, spacing: 0.015, dim: [104, 58, 170], hot: [255, 255, 255], glow: "255,110,235",
      wheelDim: [150, 105, 225] },
    { id: "or",      name: "Or",      dot: "#f2c14e", swatch: ["#171005", "#f2c14e", "#18a85a"],
      font: BARLOW, weight: 800, spacing: 0.015, dim: [128, 96, 40], hot: [42, 26, 4], glow: null,
      wheelDim: [176, 136, 62] },
  ];
  const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

  const STORE_KEY = "roulette-destin:v1";
  const STORE_VERSION = 2;

  const saved = load();
  // v1 avait "LAISSE LE DESTIN DÉCIDER." par défaut → passe à la nouvelle phrase
  if ((saved.v || 1) < 2 && saved.title === "LAISSE LE DESTIN" && saved.accent === "DÉCIDER.") {
    delete saved.title;
    delete saved.accent;
  }
  if (saved.title === "LE SORT EN EST") saved.title = "LE SORT EST";
  const state = {
    items: Array.isArray(saved.items) ? saved.items : DEFAULT_ITEMS.slice(),
    title: saved.title ?? DEFAULT_TITLE,
    accent: saved.accent ?? DEFAULT_ACCENT,
    theme: themeById(saved.theme).id,
    removeAfter: !!saved.removeAfter,
    forced: typeof saved.forced === "string" ? saved.forced : null, // résultat imposé (null = vrai hasard)
    forceKeep: !!saved.forceKeep, // garder le résultat imposé pour tous les lancers
    muted: !!saved.muted,
    history: Array.isArray(saved.history) ? saved.history : [],
    pos: Number.isFinite(saved.pos) ? saved.pos : 0,
    spinning: false,
    pendingRemoval: null, // élément à retirer au prochain lancer
    mode: new URLSearchParams(location.search).get("mode") === "wheel" ? "wheel" : "reel",
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function save() {
    const { items, title, accent, theme, removeAfter, forced, forceKeep, muted, history, pos } = state;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: STORE_VERSION, items, title, accent, theme, removeAfter, forced, forceKeep, muted, history, pos,
      }));
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const screen = $("screen");
  const frame = $("frame");
  const reel = $("reel");
  const blurStd = $("vblurStd");
  const btnSpin = $("btnSpin");
  const spinLabel = $("spinLabel");
  const editor = $("editor");
  const backdrop = $("backdrop");
  const itemsArea = $("itemsArea");
  const addForm = $("addForm");
  const addInput = $("addInput");
  const count = $("count");
  const optRemove = $("optRemove");
  const forceSelect = $("forceSelect");
  const optForceKeep = $("optForceKeep");
  const titleMain = $("titleMain");
  const titleAccent = $("titleAccent");
  const titleInput = $("titleInput");
  const accentInput = $("accentInput");
  const historyList = $("history");
  const dotsEl = $("dots");
  const themeChips = $("themeChips");
  const wheelEl = $("wheel");
  const wheelLive = $("wheelLive");
  const editorTitle = $("editorTitle");
  const modeButtons = [...document.querySelectorAll("button[data-mode]")];
  const views = [frame, wheelEl]; // reçoivent les classes rigged / rig-ping

  const wheel = createWheel({
    root: wheelEl,
    canvas: $("wheelCanvas"),
    pointer: $("pointer"),
    bulbs: $("bulbs"),
    getItems: () => state.items,
    getTheme: () => themeById(state.theme),
    getPos: () => state.pos,
  });

  const VISIBLE = 5; // lignes visibles dans la fenêtre (comme la vidéo)
  const HALF = 3; // lignes rendues de chaque côté du centre
  const rows = [];
  for (let k = -HALF; k <= HALF; k++) {
    const el = document.createElement("div");
    el.className = "row";
    const span = document.createElement("span");
    el.appendChild(span);
    reel.appendChild(el);
    rows.push({ el, span, text: null, size: 0 });
  }

  // ---------------------------------------------------------------------------
  // Mise en page + ajustement de la taille du texte
  // ---------------------------------------------------------------------------
  let rowH = 100;
  let baseFont = 60;
  let availW = 800;
  const measureCtx = document.createElement("canvas").getContext("2d");
  const fitCache = new Map();

  function layout() {
    if (state.mode === "wheel") wheel.layout();
    else reelLayout();
  }

  // redessine la vue active (après un changement de liste)
  function redraw() {
    screen.classList.toggle("is-empty", state.items.length === 0);
    if (state.mode === "wheel") wheel.refresh();
    else render(state.pos, 0);
  }

  function reelLayout() {
    if (!frame.clientHeight) return;
    rowH = frame.clientHeight / VISIBLE;
    baseFont = rowH * 0.64;
    availW = frame.clientWidth * 0.86;
    frame.style.setProperty("--row", rowH + "px");
    fitCache.clear();
    for (const r of rows) r.size = 0;
    render(state.pos, 0);
  }

  function fontSizeFor(text) {
    let s = fitCache.get(text);
    if (s === undefined) {
      const th = themeById(state.theme);
      measureCtx.font = `${th.weight} ${baseFont}px ${th.font}`;
      const up = text.toUpperCase();
      const spaces = (up.match(/ /g) || []).length;
      const w = measureCtx.measureText(up).width
        + up.length * baseFont * th.spacing
        + spaces * baseFont * (th.wordSpacing || 0);
      s = baseFont * Math.min(1, availW / Math.max(w, 1));
      fitCache.set(text, s);
    }
    return s;
  }

  // ---------------------------------------------------------------------------
  // Rendu du rouleau
  // pos = index (flottant) de l'élément au centre. pos qui augmente → la liste monte.
  // ---------------------------------------------------------------------------
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function render(pos, speed) {
    const n = state.items.length;
    screen.classList.toggle("is-empty", n === 0);
    if (n === 0) {
      for (const r of rows) { r.span.textContent = ""; r.text = null; }
      setBlur(0);
      return;
    }
    const base = Math.floor(pos);
    const frac = pos - base;
    const { dim: DIM, hot: HOT, glow: GLOW } = themeById(state.theme);

    for (let i = 0; i < rows.length; i++) {
      const k = i - HALF;
      const r = rows[i];
      const text = state.items[mod(base + k, n)];
      const off = k - frac; // en lignes, négatif = au-dessus

      if (r.text !== text) {
        r.text = text;
        r.span.textContent = text;
        r.size = 0;
      }
      const size = fontSizeFor(text);
      if (r.size !== size) {
        r.size = size;
        r.el.style.fontSize = size + "px";
      }

      r.el.style.transform = `translate3d(0, ${(off * rowH).toFixed(2)}px, 0)`;

      // couleur : rouge sombre → orange quand l'élément passe dans la barre
      let h = clamp(1 - Math.abs(off) / 0.62, 0, 1);
      h = h * h * (3 - 2 * h);
      const c = DIM.map((d, j) => Math.round(d + (HOT[j] - d) * h));
      r.el.style.color = `rgb(${c[0]},${c[1]},${c[2]})`;
      r.el.style.textShadow = GLOW && h > 0.04
        ? `0 0 ${(rowH * 0.2 * h).toFixed(1)}px rgba(${GLOW},${(0.5 * h).toFixed(2)})`
        : "none";
      r.el.style.opacity = (1 - clamp(Math.abs(off) - 1, 0, 2) * 0.22).toFixed(3);
    }

    // flou de mouvement vertical proportionnel à la vitesse
    setBlur(Math.min(rowH * 0.2, (speed * rowH / 60) * 0.42));
  }

  let blurOn = false;
  function setBlur(px) {
    if (px > 0.35) {
      blurStd.setAttribute("stdDeviation", `0 ${px.toFixed(2)}`);
      if (!blurOn) { reel.classList.add("blur"); blurOn = true; }
    } else if (blurOn) {
      reel.classList.remove("blur");
      blurOn = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Lancer
  // Profil calqué sur la vidéo : démarrage quasi instantané (~20 éléments/s),
  // puis décélération constante sur ~5 s → les "tok" s'espacent jusqu'à ~0,5 s.
  // ---------------------------------------------------------------------------
  function randInt(n) {
    if (n <= 1) return 0;
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }

  function clearWin() {
    frame.classList.remove("win");
    rows.forEach((r) => r.el.classList.remove("winner"));
    wheel.clearWin();
  }

  function spin() {
    if (state.spinning) return;

    // retrait différé du dernier gagnant (option)
    if (state.pendingRemoval !== null) {
      const idx = state.items.indexOf(state.pendingRemoval);
      if (idx !== -1) {
        state.items.splice(idx, 1);
        if (state.items.length) state.pos = mod(idx, state.items.length);
        syncTextarea();
      }
      state.pendingRemoval = null;
      refreshForce();
      clearWin();
      redraw();
    }

    const n = state.items.length;
    if (n === 0) { openEditor(); return; }

    Sfx.ensure();
    Sfx.start();
    Sfx.whooshStart();
    clearWin();

    // résultat imposé s'il y en a un, sinon vrai hasard
    const forcedIdx = state.forced !== null ? state.items.indexOf(state.forced) : -1;
    const target = forcedIdx !== -1 ? forcedIdx : randInt(n);

    let plan;
    if (state.mode === "wheel") {
      // 4 à 6 tours, arrêt n'importe où dans la case (pas pile au centre, plus naturel)
      const start = state.pos;
      const off = (Math.random() - 0.5) * 0.72;
      const delta = mod(target + off - start, n);
      const turns = 4 + randInt(3);
      plan = { start, N: turns * n + delta, A: 0.3, D: 4.9 + Math.random() * 1.1 };
    } else {
      const start = Math.round(state.pos);
      const delta = mod(target - mod(start, n), n);
      const minDist = 44 + randInt(10);
      const loops = Math.max(0, Math.ceil((minDist - delta) / n));
      const N = loops * n + delta; // nombre d'éléments à faire défiler
      const D = clamp(4.7 + Math.random() * 0.7 + Math.max(0, N - 55) * 0.03, 4.7, 7.5); // freinage
      plan = { start, N, A: 0.22, D };
    }
    run(plan);
  }

  // Accélération courte (A) puis freinage constant (D) : les "tok" s'espacent.
  function run({ start, N, A, D }) {
    const wheelMode = state.mode === "wheel";
    const v0 = (2 * N) / (A + D);
    const t0 = performance.now();
    let lastTick = Math.floor(start + 0.5);
    let lastSound = 0;

    state.spinning = true;
    screen.classList.add("spinning");
    btnSpin.disabled = true;
    spinLabel.textContent = "ÇA TOURNE...";
    itemsArea.readOnly = true;

    function frameStep(now) {
      const t = (now - t0) / 1000;
      if (t >= A + D) return finish(start + N);

      let s, v;
      if (t < A) {
        s = (v0 * t * t) / (2 * A);
        v = (v0 * t) / A;
      } else {
        const tau = t - A;
        s = (v0 * A) / 2 + v0 * tau - (v0 * tau * tau) / (2 * D);
        v = v0 * (1 - tau / D);
      }
      const pos = start + s;

      const tickIdx = Math.floor(pos + 0.5);
      if (tickIdx !== lastTick) {
        lastTick = tickIdx;
        // beaucoup de cases sur la roue → on limite la cadence des "tok"
        if (now - lastSound > 26) {
          lastSound = now;
          Sfx.tick(0.85 + 0.15 * (1 - v / v0));
        }
        if (wheelMode) wheel.tick();
      }
      Sfx.whooshSpeed(v / v0);

      state.pos = pos;
      if (wheelMode) wheel.draw(pos, v);
      else render(pos, v);
      requestAnimationFrame(frameStep);
    }
    requestAnimationFrame(frameStep);
  }

  function finish(finalPos) {
    const n = state.items.length;
    state.spinning = false;

    Sfx.whooshStop();
    Sfx.win();

    if (state.mode === "wheel") {
      state.pos = mod(finalPos, n); // garde la position dans la case
      wheel.draw(state.pos, 0);
      wheel.win();
    } else {
      state.pos = mod(Math.round(finalPos), n);
      render(state.pos, 0);
      frame.classList.add("win");
      const center = rows[HALF].el;
      center.classList.remove("winner");
      void center.offsetWidth; // relance l'animation
      center.classList.add("winner");
    }

    const label = state.items[mod(Math.round(state.pos), n)];
    wheelLive.textContent = label;
    state.history.unshift({ label, at: Date.now() });
    state.history = state.history.slice(0, 30);
    renderHistory();

    if (state.removeAfter) state.pendingRemoval = label;
    if (!state.forceKeep) state.forced = null; // retour au vrai hasard
    refreshForce();

    screen.classList.remove("spinning");
    btnSpin.disabled = false;
    spinLabel.textContent = "LANCER";
    itemsArea.readOnly = false;
    save();
  }

  // ---------------------------------------------------------------------------
  // Éditeur
  // ---------------------------------------------------------------------------
  function parseItems(text) {
    return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  function syncTextarea() {
    itemsArea.value = state.items.join("\n");
    count.textContent = state.items.length;
  }
  function itemsChanged() {
    state.pendingRemoval = null;
    clearWin();
    const n = state.items.length;
    state.pos = n ? mod(Math.round(state.pos), n) : 0;
    count.textContent = n;
    refreshForce();
    redraw();
    save();
  }

  // ---------------------------------------------------------------------------
  // Résultat imposé ("truqué") — rien ne s'affiche à l'écran, à part le petit
  // rivet gauche de la barre qui devient blanc (repère discret pour toi).
  // ---------------------------------------------------------------------------
  function refreshForce() {
    if (state.forced !== null && !state.items.includes(state.forced)) state.forced = null;

    const unique = [...new Set(state.items)];
    forceSelect.innerHTML = "";
    const rnd = new Option("🎲  Aléatoire (vrai hasard)", "");
    forceSelect.add(rnd);
    unique.forEach((label, i) => forceSelect.add(new Option(`${i + 1}. ${label.toUpperCase()}`, label)));
    forceSelect.value = state.forced ?? "";
    forceSelect.classList.toggle("on", state.forced !== null);
    views.forEach((v) => v.classList.toggle("rigged", state.forced !== null));
  }

  function setForced(label) {
    state.forced = label && state.items.includes(label) ? label : null;
    refreshForce();
    // petit clignotement du rivet pour confirmer
    views.forEach((v) => {
      v.classList.remove("rig-ping");
      void v.offsetWidth;
      v.classList.add("rig-ping");
    });
    save();
  }

  forceSelect.addEventListener("change", () => setForced(forceSelect.value || null));
  optForceKeep.addEventListener("change", () => { state.forceKeep = optForceKeep.checked; save(); });

  itemsArea.addEventListener("input", () => {
    if (state.spinning) return;
    state.items = parseItems(itemsArea.value);
    itemsChanged();
  });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.spinning) return;
    const v = addInput.value.trim();
    if (!v) return;
    state.items.push(v);
    syncTextarea();
    itemsChanged();
    addInput.value = "";
    addInput.focus();
  });

  $("btnShuffle").addEventListener("click", () => {
    if (state.spinning) return;
    const a = state.items;
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    syncTextarea();
    itemsChanged();
  });
  $("btnReset").addEventListener("click", () => {
    if (state.spinning) return;
    state.items = DEFAULT_ITEMS.slice();
    syncTextarea();
    itemsChanged();
  });
  $("btnClear").addEventListener("click", () => {
    if (state.spinning) return;
    if (state.items.length && !confirm("Vider toute la roulette ?")) return;
    state.items = [];
    syncTextarea();
    itemsChanged();
  });

  optRemove.addEventListener("change", () => {
    state.removeAfter = optRemove.checked;
    if (!state.removeAfter) state.pendingRemoval = null;
    save();
  });

  function applyTitle() {
    titleMain.textContent = state.title;
    titleAccent.textContent = state.accent;
    document.title = `${state.title} ${state.accent}`.trim();
  }
  titleInput.addEventListener("input", () => { state.title = titleInput.value.toUpperCase(); applyTitle(); save(); });
  accentInput.addEventListener("input", () => { state.accent = accentInput.value.toUpperCase(); applyTitle(); save(); });

  // 🎲 phrase au hasard (jamais deux fois la même d'affilée)
  $("btnPhrase").addEventListener("click", () => {
    const current = PHRASES.findIndex(([a, b]) => a === state.title && b === state.accent);
    let i;
    do { i = randInt(PHRASES.length); } while (i === current && PHRASES.length > 1);
    [state.title, state.accent] = PHRASES[i];
    titleInput.value = state.title;
    accentInput.value = state.accent;
    applyTitle();
    save();
  });

  // ---------------------------------------------------------------------------
  // Thèmes
  // ---------------------------------------------------------------------------
  const dotButtons = THEMES.map((t) => {
    const b = document.createElement("button");
    b.className = "dot";
    b.type = "button";
    b.style.setProperty("--c", t.dot);
    b.dataset.name = t.name;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Thème ${t.name}`);
    b.addEventListener("click", () => setTheme(t.id));
    dotsEl.appendChild(b);
    return b;
  });
  const chipButtons = THEMES.map((t) => {
    const b = document.createElement("button");
    b.className = "theme-chip";
    b.type = "button";
    b.innerHTML = `<span class="swatch">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join("")}</span>${t.name}`;
    b.addEventListener("click", () => setTheme(t.id));
    themeChips.appendChild(b);
    return b;
  });

  function setTheme(id) {
    const th = themeById(id);
    state.theme = th.id;
    document.documentElement.dataset.theme = th.id;
    THEMES.forEach((t, i) => {
      const on = t.id === th.id;
      dotButtons[i].classList.toggle("active", on);
      dotButtons[i].setAttribute("aria-checked", on);
      chipButtons[i].classList.toggle("active", on);
    });
    layout();
    // la police du thème peut arriver après coup → re-mesure
    document.fonts?.load(`${th.weight} 60px ${th.font}`).then(layout).catch(() => {});
    save();
  }
  // ---------------------------------------------------------------------------
  // Affichage : rouleau ou roue (même liste, même état)
  // ---------------------------------------------------------------------------
  function setMode(m) {
    if (state.spinning) return;
    state.mode = m === "wheel" ? "wheel" : "reel";
    screen.dataset.mode = state.mode;
    modeButtons.forEach((btn) => {
      const on = btn.dataset.mode === state.mode;
      btn.classList.toggle("active", on);
      if (btn.getAttribute("role") === "radio") btn.setAttribute("aria-checked", on);
    });
    editorTitle.textContent = state.mode === "wheel" ? "LA ROUE" : "LA ROULETTE";
    clearWin();
    if (state.items.length) state.pos = mod(Math.round(state.pos), state.items.length);

    const url = new URL(location.href);
    if (state.mode === "wheel") url.searchParams.set("mode", "wheel");
    else url.searchParams.delete("mode");
    history.replaceState(null, "", url);

    screen.classList.toggle("is-empty", state.items.length === 0);
    layout();
  }
  modeButtons.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

  function nextTheme() {
    const i = THEMES.findIndex((t) => t.id === state.theme);
    setTheme(THEMES[(i + 1) % THEMES.length].id);
  }

  function renderHistory() {
    historyList.innerHTML = "";
    for (const h of state.history.slice(0, 12)) {
      const li = document.createElement("li");
      li.textContent = h.label;
      const when = document.createElement("span");
      when.className = "when";
      const d = new Date(h.at);
      when.textContent = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " +
        d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      li.appendChild(when);
      historyList.appendChild(li);
    }
  }
  $("btnClearHistory").addEventListener("click", () => { state.history = []; renderHistory(); save(); });

  function openEditor() {
    editor.classList.add("open");
    backdrop.classList.add("open");
    editor.setAttribute("aria-hidden", "false");
    setTimeout(() => addInput.focus(), 250);
  }
  function closeEditor() {
    editor.classList.remove("open");
    backdrop.classList.remove("open");
    editor.setAttribute("aria-hidden", "true");
    document.activeElement?.blur();
  }
  const toggleEditor = () => (editor.classList.contains("open") ? closeEditor() : openEditor());

  // ---------------------------------------------------------------------------
  // Boutons du haut
  // ---------------------------------------------------------------------------
  // Ordinateur : le plein écran du navigateur. Téléphone ou tablette (ou navigateur sans plein écran,
  // comme sur iPhone) : la page admin qui contient l'outil lui laisse toute la page, les barres du
  // navigateur restant visibles (MarketingToolPage), jusqu'à ce qu'on recharge la page.
  const touchScreen = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
  function fillPage() {
    if (window.parent !== window) window.parent.postMessage({ type: "marketing-tool:fill" }, location.origin);
  }
  function toggleFullscreen() {
    const root = document.documentElement;
    if (touchScreen || !root.requestFullscreen) return fillPage();
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen().catch(fillPage);
  }
  function setMuted(m) {
    state.muted = m;
    Sfx.setMuted(m);
    document.body.classList.toggle("muted-on", m);
    save();
  }

  $("btnEdit").addEventListener("click", toggleEditor);
  $("btnClose").addEventListener("click", closeEditor);
  backdrop.addEventListener("click", closeEditor);
  $("btnFull").addEventListener("click", toggleFullscreen);
  $("btnSound").addEventListener("click", () => setMuted(!state.muted));
  btnSpin.addEventListener("click", spin);
  frame.addEventListener("click", () => (state.items.length ? spin() : openEditor()));
  wheelEl.addEventListener("click", () => (state.items.length ? spin() : openEditor()));

  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest("input, textarea");
    if (e.key === "Escape") {
      if (editor.classList.contains("open")) { closeEditor(); return; }
      // Intégrée dans une page (admin MakeSaaS) : Échap → retour à la liste des outils (si éditeur fermé)
      if (window.parent !== window) {
        window.parent.postMessage({ type: "marketing-tool:home" }, "*");
      }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); spin(); }
    else if (e.key === "e" || e.key === "E") toggleEditor();
    else if (e.key === "f" || e.key === "F") toggleFullscreen();
    else if (e.key === "m" || e.key === "M") setMuted(!state.muted);
    else if (e.key === "t" || e.key === "T") nextTheme();
    else if (e.key === "r" || e.key === "R") setMode(state.mode === "wheel" ? "reel" : "wheel");
    // 1…9 : impose l'élément n° (dans l'ordre de la liste) · 0 : retour au hasard
    else if (/^[0-9]$/.test(e.key) && !state.spinning) {
      if (e.key === "0") setForced(null);
      else {
        const label = [...new Set(state.items)][Number(e.key) - 1];
        if (label !== undefined) setForced(label);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  syncTextarea();
  optRemove.checked = state.removeAfter;
  optForceKeep.checked = state.forceKeep;
  refreshForce();
  titleInput.value = state.title;
  accentInput.value = state.accent;
  applyTitle();
  renderHistory();
  setMuted(state.muted);
  if (state.items.length) state.pos = mod(Math.round(state.pos), state.items.length);

  setMode(state.mode);
  setTheme(state.theme); // fait aussi le premier layout()
  window.addEventListener("resize", layout);
  document.addEventListener("fullscreenchange", () => setTimeout(layout, 50));
  document.fonts?.ready.then(layout);

  // petit accès debug/automatisation
  window.roulette = { spin, state, setTheme, setMode, wheel };
})();
