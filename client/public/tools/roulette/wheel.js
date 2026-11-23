// Vue "roue" : même liste, mêmes thèmes, mêmes sons que le rouleau.
//
// pos (flottant) = index de la case sous le pointeur (à droite, à 3 h), comme
// le pos du rouleau. pos qui augmente → la roue tourne dans le sens horaire.
// Le disque (cases + textes "éteints") est pré-rendu une fois ; à chaque frame
// on le redessine tourné (plusieurs copies = flou de mouvement), puis on
// allume par-dessus la case qui passe sous le pointeur, comme la barre du rouleau.
const createWheel = ({ root, canvas, pointer, bulbs: bulbsEl, getItems, getTheme, getPos }) => {
  const ctx = canvas.getContext("2d");
  const disc = document.createElement("canvas");
  const dctx = disc.getContext("2d");
  const mctx = document.createElement("canvas").getContext("2d");
  const blurBuf = document.createElement("canvas");
  const bctx = blurBuf.getContext("2d");

  const TAU = Math.PI * 2;
  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // géométrie, en fraction du rayon du disque
  const HUB = 0.17; // moyeu (dessiné en DOM par-dessus)
  const R_IN = 0.245; // début de la zone de texte
  const R_OUT = 0.83; // fin du texte (aligné vers l'extérieur)
  const PEG = 0.95; // picots
  // taille max du texte : plus grande quand il y a peu de cases
  const maxFont = (n) => clamp(0.13 + (8 - n) * 0.012, 0.13, 0.2);
  const BULBS = 24;

  const rgb = (c, k = 1) => `rgb(${c.map((x) => Math.round(x * k)).join(",")})`;

  // ampoules de la jante (allumage piloté en CSS via data-chase sur le conteneur)
  bulbsEl.style.setProperty("--n", BULBS);
  for (let i = 0; i < BULBS; i++) {
    const b = document.createElement("i");
    b.className = "bulb";
    b.style.setProperty("--i", i);
    b.dataset.p = i % 3;
    bulbsEl.appendChild(b);
  }

  let dpr = 1;
  let R = 0; // rayon du disque en px CSS
  let col = {};
  let fits = [];
  let capH = 0.7;
  let winAt = 0; // performance.now() du dernier gain (0 = rien à fêter)
  let fxRaf = 0;
  let kick = 0; // déviation du pointeur (0..1)
  let lastDraw = 0;
  let chase = null;

  function readColors() {
    const cs = getComputedStyle(root);
    const v = (k) => cs.getPropertyValue(k).trim();
    col = {
      a: v("--wh-seg-a"),
      b: v("--wh-seg-b"),
      c: v("--wh-seg-c"),
      line: v("--wh-seg-line"),
      peg: v("--wh-peg"),
      hl: [v("--wh-hl-in"), v("--wh-hl-out"), v("--wh-hl-edge")],
      win: [v("--wh-win-in"), v("--wh-win-out"), v("--wh-win-edge")],
    };
  }

  function setFont(c, th, s) {
    c.font = `${th.weight} ${s}px ${th.font}`;
    if ("letterSpacing" in c) c.letterSpacing = `${(th.spacing * s).toFixed(2)}px`;
    if ("wordSpacing" in c) c.wordSpacing = `${((th.wordSpacing || 0) * s).toFixed(2)}px`;
  }

  // Taille de texte par case : le bloc tient dans la longueur du rayon ET dans
  // l'ouverture de la case au point le plus étroit (début du texte).
  // Texte long → on essaie sur 2 lignes, gardé seulement si c'est nettement plus gros.
  const GAP = 0.3; // interligne (em) entre 2 lignes
  function fitBlock(lines, n, sn) {
    const w1 = Math.max(...lines.map((l) => mctx.measureText(l).width / 100), 0.01);
    const k = lines.length === 1 ? capH * 1.3 : (capH * 2 + GAP) * 1.12;
    let s = Math.min(R * maxFont(n), (R * (R_OUT - R_IN)) / w1);
    if (n > 1) s = Math.min(s, (2 * R * R_OUT * sn) / (k + 2 * w1 * sn));
    return { s, lines };
  }
  function computeFits(items, th) {
    const n = items.length;
    setFont(mctx, th, 100);
    capH = (mctx.measureText("H").actualBoundingBoxAscent || 70) / 100;
    const sn = Math.sin(Math.min(Math.PI / n, Math.PI / 2));
    fits = items.map((t) => {
      const up = t.toUpperCase();
      const one = fitBlock([up], n, sn);
      const words = up.split(/\s+/);
      if (words.length < 2) return one;
      let split = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(" ");
        const b = words.slice(k).join(" ");
        const d = Math.abs(a.length - b.length);
        if (!split || d < split.d) split = { d, lines: [a, b] };
      }
      const two = fitBlock(split.lines, n, sn);
      return two.s > one.s * 1.25 ? two : one;
    });
  }

  // texte aligné vers l'extérieur, finissant en x, centré verticalement sur la case
  function drawLabel(c, fit, x) {
    const { s, lines } = fit;
    if (lines.length === 1) c.fillText(lines[0], x, (capH * s) / 2);
    else {
      c.fillText(lines[0], x, (-GAP / 2) * s);
      c.fillText(lines[1], x, (capH + GAP / 2) * s);
    }
  }

  function wedgePath(c, center, theta, n, rIn, rOut) {
    c.beginPath();
    if (n <= 1) {
      c.arc(0, 0, rOut, 0, TAU);
      c.arc(0, 0, rIn, TAU, 0, true);
    } else {
      c.arc(0, 0, rOut, center - theta / 2, center + theta / 2);
      c.arc(0, 0, rIn, center + theta / 2, center - theta / 2, true);
    }
    c.closePath();
  }

  // ---------------------------------------------------------------------------
  // Pré-rendu du disque à l'angle 0 (case i centrée sur l'angle -i·θ)
  // ---------------------------------------------------------------------------
  function prerender() {
    const items = getItems();
    const n = items.length;
    const th = getTheme();
    const c = dctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, disc.width, disc.height);
    if (!R) return;
    c.setTransform(dpr, 0, 0, dpr, R * dpr, R * dpr);
    const theta = TAU / Math.max(n, 1);

    // cases
    for (let i = 0; i < Math.max(n, 1); i++) {
      c.beginPath();
      if (n <= 1) c.arc(0, 0, R, 0, TAU);
      else {
        c.moveTo(0, 0);
        c.arc(0, 0, R, -i * theta - theta / 2, -i * theta + theta / 2);
        c.closePath();
      }
      // nombre impair : la dernière case prend une 3e teinte (pas 2 voisines identiques)
      c.fillStyle = n > 1 && n % 2 && i === n - 1 ? col.c : i % 2 ? col.b : col.a;
      c.fill();
    }

    // relief : creux vers le moyeu, bord assombri
    const g = c.createRadialGradient(0, 0, R * HUB, 0, 0, R);
    g.addColorStop(0, "rgba(0,0,0,.45)");
    g.addColorStop(0.45, "rgba(0,0,0,.12)");
    g.addColorStop(0.84, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.32)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, R, 0, TAU);
    c.fill();

    // séparateurs + picots
    if (n > 1) {
      c.strokeStyle = col.line;
      c.lineWidth = Math.max(1, R * 0.0055);
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = -i * theta + theta / 2;
        c.moveTo(Math.cos(a) * R * HUB, Math.sin(a) * R * HUB);
        c.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      c.stroke();

      c.fillStyle = col.peg;
      for (let i = 0; i < n; i++) {
        const a = -i * theta + theta / 2;
        c.beginPath();
        c.arc(Math.cos(a) * R * PEG, Math.sin(a) * R * PEG, Math.max(1.5, R * 0.014), 0, TAU);
        c.fill();
      }
    }

    // anneau autour du moyeu
    c.strokeStyle = col.line;
    c.lineWidth = Math.max(1, R * 0.005);
    c.beginPath();
    c.arc(0, 0, R * (HUB + 0.035), 0, TAU);
    c.stroke();

    if (!n) return;
    computeFits(items, th);
    c.fillStyle = rgb(th.wheelDim || th.dim);
    c.textAlign = "right";
    c.textBaseline = "alphabetic";
    fits.forEach((fit, i) => {
      c.save();
      c.rotate(-i * theta);
      setFont(c, th, fit.s);
      drawLabel(c, fit, R * R_OUT);
      c.restore();
    });
  }

  // "pop" du texte gagnant (même courbe que le rouleau : 1 → 1.09 → 1 en 0,5 s)
  function popScale(t) {
    const p = t / 0.5;
    if (p >= 1) return 1;
    if (p < 0.4) {
      const x = p / 0.4 - 1;
      return 1 + 0.09 * (1 + 2.2 * x * x * x + 1.2 * x * x); // easeOutBack
    }
    const x = (p - 0.4) / 0.6;
    return 1 + 0.09 * (1 - x * x * (3 - 2 * x));
  }

  // ---------------------------------------------------------------------------
  // Rendu d'une frame
  // ---------------------------------------------------------------------------
  function draw(pos, speed) {
    const now = performance.now();
    const items = getItems();
    const n = items.length;
    const th = getTheme();
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    if (!R) return;
    c.setTransform(dpr, 0, 0, dpr, R * dpr, R * dpr);

    const theta = TAU / Math.max(n, 1);
    const rot = n ? pos * theta : 0;

    // flou de mouvement : copies du disque réparties sur l'arc parcouru
    // pendant ~1,3 frame, moyennées (alpha 1/(k+1) sur un disque opaque).
    // Rapide = beaucoup de copies → on les cumule en demi-résolution (le flou masque la perte).
    const spread = Math.min(speed * theta * 0.022, 0.34);
    const K = clamp(Math.round((spread * R) / 3) + 1, 1, 16);
    const half = K > 3;
    const dst = half ? bctx : c;
    if (half) {
      dst.setTransform(1, 0, 0, 1, 0, 0);
      dst.clearRect(0, 0, blurBuf.width, blurBuf.height);
      const k2 = blurBuf.width / (2 * R);
      dst.setTransform(k2, 0, 0, k2, blurBuf.width / 2, blurBuf.height / 2);
    }
    for (let k = 0; k < K; k++) {
      const a = K > 1 ? rot - spread * (k / (K - 1) - 0.5) : rot;
      dst.globalAlpha = 1 / (k + 1);
      dst.save();
      dst.rotate(a);
      dst.drawImage(disc, -R, -R, R * 2, R * 2);
      dst.restore();
    }
    dst.globalAlpha = 1;
    if (half) c.drawImage(blurBuf, -R, -R, R * 2, R * 2);

    if (n) {
      const idx = mod(Math.round(pos), n);
      const center = rot - idx * theta; // angle canvas du centre de la case sous le pointeur
      const tw = winAt ? (now - winAt) / 1000 : -1;
      const won = tw >= 0;

      // après un gain : les autres cases s'éteignent
      if (won) {
        c.fillStyle = `rgba(0,0,0,${(0.45 * Math.min(1, tw / 0.3)).toFixed(3)})`;
        c.beginPath();
        c.arc(0, 0, R, 0, TAU);
        c.fill();
      }

      // case allumée (s'estompe quand ça tourne vite, pour éviter le stroboscope)
      const hl = won ? 1 : clamp(1 - (speed - 3) / 12, 0.14, 1);
      const [gIn, gOut, edge] = won ? col.win : col.hl;
      wedgePath(c, center, theta, n, R * HUB, R);
      const g = c.createRadialGradient(0, 0, R * HUB, 0, 0, R);
      g.addColorStop(0, gIn);
      g.addColorStop(1, gOut);
      c.globalAlpha = hl;
      c.fillStyle = g;
      c.fill();
      if (n > 1) {
        c.lineWidth = Math.max(1.2, R * 0.007);
        c.strokeStyle = edge;
        c.stroke();
      }
      if (won && tw < 0.45) {
        c.globalAlpha = 0.55 * (1 - tw / 0.45);
        c.fillStyle = "#fff";
        c.fill();
      }
      c.globalAlpha = 1;

      // texte allumé
      const fit = fits[idx];
      if (fit) {
        const { s } = fit;
        c.save();
        c.rotate(center);
        setFont(c, th, s);
        const w = Math.max(...fit.lines.map((l) => c.measureText(l).width));
        const sc = won ? popScale(tw) : 1;
        // "pop" centré sur le bloc de texte
        c.translate(R * R_OUT - w / 2, 0);
        c.scale(sc, sc);
        c.textAlign = "right";
        c.textBaseline = "alphabetic";
        c.globalAlpha = hl;
        if (th.glow) {
          c.shadowColor = `rgba(${th.glow},0.55)`;
          c.shadowBlur = s * 0.45 * dpr;
        }
        c.fillStyle = rgb(th.hot);
        drawLabel(c, fit, w / 2);
        c.restore();
      }
    }

    updatePointer(now);
    updateChase(rot, speed);
  }

  function updatePointer(now) {
    const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 0;
    lastDraw = now;
    kick *= Math.exp(-dt / 0.075);
    if (kick < 0.002) kick = 0;
    pointer.style.setProperty("--kick", `${(-kick * 17).toFixed(2)}deg`);
  }

  // guirlande : la lumière "tourne" avec la roue (un pas tous les 2 intervalles d'ampoule)
  function updateChase(rot, speed) {
    const step = speed > 0.05 ? String(mod(Math.floor(rot / ((TAU / BULBS) * 2)), 3)) : "";
    if (step !== chase) {
      chase = step;
      bulbsEl.dataset.chase = step;
    }
  }

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  function refresh() {
    prerender();
    draw(getPos(), 0);
  }

  function layout() {
    const w = canvas.clientWidth;
    if (!w) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    R = w / 2;
    const px = Math.round(w * dpr);
    canvas.width = canvas.height = px;
    disc.width = disc.height = px;
    blurBuf.width = blurBuf.height = Math.round(px / 2);
    readColors();
    refresh();
  }

  // un picot passe sous le pointeur
  function tick() {
    kick = 0.75 + Math.random() * 0.25;
  }

  function win() {
    winAt = performance.now();
    root.classList.remove("win");
    void root.offsetWidth; // relance les animations CSS
    root.classList.add("win");
    cancelAnimationFrame(fxRaf);
    const loop = () => {
      draw(getPos(), 0);
      if (performance.now() - winAt < 650) fxRaf = requestAnimationFrame(loop);
    };
    fxRaf = requestAnimationFrame(loop);
  }

  function clearWin() {
    cancelAnimationFrame(fxRaf);
    const had = winAt !== 0;
    winAt = 0;
    root.classList.remove("win");
    if (had) draw(getPos(), 0);
  }

  return { layout, refresh, draw, tick, win, clearWin };
};
