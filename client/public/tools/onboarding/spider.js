/*
 * The spider of the fake onboarding: a house spider wandering over the screen, on top of
 * everything, to hook viewers in the first second of the video (it looks like it is on their own
 * screen). Off by default: the spider button or A turns it on, remembered on this device; turned
 * off, it runs off the nearest edge. Restarting (R) brings it back in from an edge, and a tap near
 * it makes it flee.
 *
 * Nothing is loaded: its body is painted once on small canvases (hairs, pattern, eyes), its legs
 * every frame, each knee placed by inverse kinematics. Legs step in two alternating groups of four
 * (left 1, right 2, left 3, right 4, then the others), as real spiders walk, and it moves like one:
 * a dash, a dead stop, a long stillness, a front leg tasting the air, a soft shadow under it.
 */
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const smooth = (t) => t * t * (3 - 2 * t);
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));

  /** Seeded random numbers (mulberry32): the hairs and spots stay put from one frame to the next. */
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ---- Anatomy (in body lengths L; the spider faces +x, its right side is +y) -------------- */

  const CEPHALOTHORAX = { rx: 0.2, ry: 0.165, taper: 0.22 }; // centered on the spider's position
  const ABDOMEN = { rx: 0.3, ry: 0.205, taper: 0.12 };
  const WAIST = -0.2; // the pedicel, around which the abdomen swings a little
  const ABDOMEN_BACK = 0.29; // from the waist to the abdomen's center
  const BODY_Z = 0.12; // height of the body above the glass
  // Light from the top of the screen, a bit to the left: highlights on that side, shadow the other way.
  const LIGHT = { x: -0.42, y: -0.91 };
  const SHADOW = { x: 0.28, y: 0.5 }; // shift of the shadow per unit of height

  // One entry per pair, front to back: the hip under the carapace, the direction of the foot at rest
  // and the leg's length (house spiders: legs 1 and 4 the longest).
  const PAIRS = [
    { hip: [0.1, 0.085], angle: 0.6, length: 2.05 },
    { hip: [0.035, 0.12], angle: 1.12, length: 1.78 },
    { hip: [-0.035, 0.12], angle: 1.98, length: 1.58 },
    { hip: [-0.1, 0.085], angle: 2.56, length: 1.98 },
  ];
  const REACH = 0.8; // the foot rests this far from the hip, as a share of the leg's length
  const KNEE_LEAN = 0.32; // knees lean outward from straight up (radians)
  // Femur, patella + tibia, metatarsus, tarsus: shares of the leg's length; thickness at each joint.
  const LEG_SEGMENTS = [0.27, 0.33, 0.27, 0.13];
  const LEG_WIDTHS = [0.082, 0.068, 0.054, 0.04, 0.025];
  const LEG_COLORS = ["#5c4231", "#543c2b", "#4a3425", "#3f2c1f"];
  const PALP_SEGMENTS = [0.075, 0.055, 0.085];
  const PALP_WIDTHS = [0.05, 0.046, 0.044, 0.038];
  const PALP_COLORS = ["#5a4130", "#523b2a", "#4a3425"];
  const TAP_TIME = 0.9; // a front leg raised while resting (seconds)
  const TWITCH_TIME = 0.35; // a palp tapping

  /** Hairs of a limb, segment by segment: fine ones lying toward the tip, a few stiff spines. */
  function limbHairs(rnd, counts, spines = 0.2) {
    return counts.map((count, segment) =>
      Array.from({ length: count }, () => {
        const spine = segment < 3 && rnd() < spines;
        return {
          t: 0.08 + rnd() * 0.88,
          side: rnd() < 0.5 ? -1 : 1,
          angle: spine ? 0.38 + rnd() * 0.22 : 0.16 + rnd() * 0.26,
          length: spine ? 0.045 + rnd() * 0.025 : 0.02 + rnd() * 0.03,
          pale: !spine && rnd() < 0.22,
          spine,
        };
      }),
    );
  }

  const legs = [];
  for (const side of [1, -1]) {
    PAIRS.forEach((pair, index) => {
      const [hx, hy] = pair.hip;
      const reach = pair.length * REACH;
      // Seen from above, the knees of the front legs point back and those of the back legs forward.
      const back = index < 2 ? 1 : -1;
      legs.push({
        side,
        index,
        group: (index + (side > 0 ? 0 : 1)) % 2,
        length: pair.length,
        hip: { x: hx, y: hy * side },
        rest: { x: hx + Math.cos(pair.angle) * reach, y: (hy + Math.sin(pair.angle) * reach) * side },
        knee: { x: -back * Math.sin(pair.angle), y: back * Math.cos(pair.angle) * side },
        pos: { x: 0, y: 0 }, // the tip, in px (planted, or on its way)
        z: 0,
        from: { x: 0, y: 0 },
        ideal: { x: 0, y: 0 },
        error: 0,
        stepping: false,
        t: 0,
        duration: 0.1,
        lift: 0,
        tap: 0, // time into a raise (0: none)
        hairs: limbHairs(seeded(index * 13 + (side > 0 ? 3 : 57)), [26, 28, 20, 12], 0.12),
      });
    });
  }
  const palps = [1, -1].map((side) => ({ side, twitch: 0, hairs: limbHairs(seeded(side > 0 ? 91 : 97), [10, 8, 12], 0) }));

  /* ---- Canvas ----------------------------------------------------------------------------- */

  const canvas = document.createElement("canvas");
  canvas.className = "spider";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  // The shadow is drawn solid at half resolution, then laid down blurred and see-through.
  const shade = document.createElement("canvas");
  const shadeCtx = shade.getContext("2d");
  const SHADE_RES = 0.5;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let L = 50; // body length, in px
  let skin = null; // the painted body parts

  /* ---- Painting the body (once) ------------------------------------------------------------- */

  /** An egg-shaped outline, narrower at the front when `taper` > 0. */
  function eggPath(g, { rx, ry, taper }) {
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * TAU;
      const c = Math.cos(t);
      const x = rx * c;
      const y = ry * Math.sin(t) * (1 - taper * c);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
  }
  const eggPoint = ({ rx, ry, taper }, t, r) => {
    const c = Math.cos(t);
    return { x: rx * r * c, y: ry * r * Math.sin(t) * (1 - taper * c) };
  };
  const outward = ({ rx, ry }, t) => Math.atan2(Math.sin(t) / ry, Math.cos(t) / rx);

  /** Short, slightly curved hairs, each placed and aimed by `place()` → { x, y, angle, length }. */
  function hairs(g, rnd, count, colors, width, place, alpha = [0.25, 0.6]) {
    g.lineWidth = width;
    for (let i = 0; i < count; i++) {
      const { x, y, angle, length } = place();
      const [r, gr, b] = colors[Math.floor(rnd() * colors.length)];
      const ex = x + Math.cos(angle) * length;
      const ey = y + Math.sin(angle) * length;
      const bend = (rnd() - 0.5) * 0.35 * length;
      g.strokeStyle = `rgba(${r}, ${gr}, ${b}, ${(alpha[0] + rnd() * (alpha[1] - alpha[0])).toFixed(2)})`;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo((x + ex) / 2 - Math.sin(angle) * bend, (y + ey) / 2 + Math.cos(angle) * bend, ex, ey);
      g.stroke();
    }
  }

  /** A canvas covering [x0, x1] × [y0, y1] (in L), at twice the screen's resolution: still sharp once turned. */
  function paint([x0, y0, x1, y1], painter) {
    const scale = L * dpr * 2;
    const c = document.createElement("canvas");
    c.width = Math.ceil((x1 - x0) * scale);
    c.height = Math.ceil((y1 - y0) * scale);
    const g = c.getContext("2d");
    g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    g.lineCap = "round";
    const soft = (units) => (g.filter = units ? `blur(${(units * scale).toFixed(1)}px)` : "none");
    painter(g, soft);
    return { canvas: c, x0, y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Carapace (with the chelicerae and the eyes): orange-brown, two dark bands, fine hairs. */
  function paintCarapace(g, soft) {
    const rnd = seeded(7);
    const shape = CEPHALOTHORAX;

    // Chelicerae (the fangs' bases), half under the front edge: glossy, red-brown.
    for (const side of [-1, 1]) {
      const cy = side * 0.034;
      const fill = g.createRadialGradient(0.225, cy - side * 0.01, 0.003, 0.215, cy, 0.055);
      fill.addColorStop(0, "#9a6a45");
      fill.addColorStop(0.5, "#55341f");
      fill.addColorStop(1, "#1f130b");
      g.fillStyle = fill;
      g.beginPath();
      g.ellipse(0.215, cy, 0.056, 0.034, side * 0.12, 0, TAU);
      g.fill();
    }
    hairs(g, rnd, 60, [[200, 165, 120], [40, 24, 14]], 0.004, () => {
      const side = rnd() < 0.5 ? -1 : 1;
      return { x: 0.19 + rnd() * 0.06, y: side * (0.012 + rnd() * 0.045), angle: side * rnd() * 0.5, length: 0.015 + rnd() * 0.015 };
    });

    g.save();
    eggPath(g, shape);
    const base = g.createRadialGradient(-0.04, 0, 0.01, -0.02, 0, 0.23);
    base.addColorStop(0, "#b08a5e");
    base.addColorStop(0.55, "#8d6642");
    base.addColorStop(1, "#4a311f");
    g.fillStyle = base;
    g.fill();
    g.clip();

    // Two dark bands from the eyes back, a pale line between them, grooves fanning out.
    soft(0.012);
    g.strokeStyle = "rgba(48, 28, 14, 0.85)";
    g.lineWidth = 0.055;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(0.16, side * 0.04);
      g.quadraticCurveTo(0.01, side * 0.105, -0.18, side * 0.06);
      g.stroke();
    }
    soft(0.012);
    g.strokeStyle = "rgba(214, 176, 126, 0.35)";
    g.lineWidth = 0.04;
    g.beginPath();
    g.moveTo(0.12, 0);
    g.lineTo(-0.19, 0);
    g.stroke();
    soft(0.005);
    g.strokeStyle = "rgba(42, 25, 13, 0.5)";
    g.lineWidth = 0.011;
    for (const side of [-1, 1]) {
      for (const a of [0.55, 1.25, 1.95, 2.6]) {
        g.beginPath();
        g.moveTo(-0.05 + Math.cos(a) * 0.035, side * Math.sin(a) * 0.03);
        g.lineTo(-0.05 + Math.cos(a) * 0.2, side * Math.sin(a) * 0.17);
        g.stroke();
      }
    }
    g.strokeStyle = "rgba(30, 17, 9, 0.75)";
    g.lineWidth = 0.014;
    g.beginPath();
    g.moveTo(-0.035, 0);
    g.lineTo(-0.08, 0);
    g.stroke();
    soft(0.012);
    g.fillStyle = "rgba(28, 16, 9, 0.6)";
    g.beginPath();
    g.ellipse(0.17, 0, 0.04, 0.062, 0, 0, TAU);
    g.fill();
    soft(0);

    // Fine hairs lying forward, toward the middle line.
    hairs(
      g,
      rnd,
      320,
      [[214, 182, 138], [60, 38, 22]],
      0.0035,
      () => {
        const p = eggPoint(shape, rnd() * TAU, Math.sqrt(rnd()) * 0.97);
        return { ...p, angle: -Math.sign(p.y) * rnd() * 0.5 + (rnd() - 0.5) * 0.5, length: 0.008 + rnd() * 0.012 };
      },
      [0.15, 0.4],
    );
    // Rounder toward the rim.
    const rim = g.createRadialGradient(-0.02, 0, 0.07, -0.02, 0, 0.22);
    rim.addColorStop(0, "rgba(0, 0, 0, 0)");
    rim.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    g.fillStyle = rim;
    g.fillRect(-0.3, -0.3, 0.7, 0.6);
    g.restore();

    eggPath(g, shape);
    g.strokeStyle = "rgba(26, 15, 8, 0.85)";
    g.lineWidth = 0.009;
    g.stroke();
    // Hairs across the edge: a fuzzy outline, not a drawn one.
    hairs(g, rnd, 90, [[190, 158, 118], [60, 40, 24]], 0.0035, () => {
      const t = rnd() * TAU;
      return { ...eggPoint(shape, t, 0.97), angle: outward(shape, t) + (rnd() - 0.5) * 0.9, length: 0.008 + rnd() * 0.014 };
    });

    // Eight eyes in two rows, black and glossy.
    for (const [x, y, r] of [
      [0.188, 0.015, 0.009],
      [0.183, 0.04, 0.012],
      [0.162, 0.022, 0.011],
      [0.158, 0.05, 0.012],
    ]) {
      for (const side of [-1, 1]) {
        g.fillStyle = "#080503";
        g.beginPath();
        g.arc(x, y * side, r, 0, TAU);
        g.fill();
        g.fillStyle = "rgba(255, 255, 255, 0.75)";
        g.beginPath();
        g.arc(x - r * 0.3, y * side - r * 0.35, r * 0.3, 0, TAU);
        g.fill();
      }
    }
  }

  /** Abdomen: mottled grey-brown, a pale mark then dark chevrons, dense hairs, spinnerets. */
  function paintAbdomen(g, soft) {
    const rnd = seeded(23);
    const shape = ABDOMEN;

    for (const side of [-1, 1]) {
      g.strokeStyle = "#3a281b";
      g.lineWidth = 0.024;
      g.beginPath();
      g.moveTo(-0.26, side * 0.014);
      g.quadraticCurveTo(-0.31, side * 0.02, -0.345, side * 0.032);
      g.stroke();
    }

    g.save();
    eggPath(g, shape);
    const base = g.createRadialGradient(0.04, 0, 0.02, 0.02, 0, 0.32);
    base.addColorStop(0, "#6f5641");
    base.addColorStop(0.55, "#4d3a2b");
    base.addColorStop(1, "#211812");
    g.fillStyle = base;
    g.fill();
    g.clip();

    soft(0.008);
    for (let i = 0; i < 240; i++) {
      const p = eggPoint(shape, rnd() * TAU, Math.sqrt(rnd()));
      g.fillStyle =
        rnd() < 0.55 ? `rgba(32, 22, 14, ${(0.12 + rnd() * 0.2).toFixed(2)})` : `rgba(175, 145, 108, ${(0.1 + rnd() * 0.18).toFixed(2)})`;
      g.beginPath();
      g.arc(p.x, p.y, 0.008 + rnd() * 0.022, 0, TAU);
      g.fill();
    }

    // A pale mark at the front, then dark chevrons pointing forward, each with two pale spots.
    soft(0.012);
    g.strokeStyle = "rgba(196, 160, 116, 0.55)";
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.25, 0);
    g.lineTo(0.04, 0);
    g.stroke();
    g.strokeStyle = "rgba(30, 19, 11, 0.45)";
    g.lineWidth = 0.016;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(0.25, side * 0.03);
      g.quadraticCurveTo(0.14, side * 0.05, 0.03, side * 0.02);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const x = 0.02 - i * 0.05;
      const w = 0.125 - i * 0.018;
      g.strokeStyle = `rgba(20, 12, 7, ${(0.85 - i * 0.06).toFixed(2)})`;
      g.lineWidth = 0.024 - i * 0.002;
      g.beginPath();
      g.moveTo(x - 0.045, -w);
      g.quadraticCurveTo(x - 0.005, -w * 0.35, x, 0);
      g.quadraticCurveTo(x - 0.005, w * 0.35, x - 0.045, w);
      g.stroke();
      g.fillStyle = `rgba(212, 178, 132, ${(0.65 - i * 0.06).toFixed(2)})`;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(x - 0.03, side * w * 0.55, 0.018 - i * 0.0015, 0.012, 0, 0, TAU);
        g.fill();
      }
    }
    soft(0);

    // Dense hairs, lying back and fanning out.
    hairs(
      g,
      rnd,
      750,
      [[186, 156, 118], [100, 76, 54], [26, 17, 10], [26, 17, 10]],
      0.0035,
      () => {
        const p = eggPoint(shape, rnd() * TAU, Math.sqrt(rnd()) * 0.98);
        return { ...p, angle: Math.PI - (p.y / shape.ry) * 0.4 + (rnd() - 0.5) * 0.7, length: 0.01 + rnd() * 0.016 };
      },
      [0.15, 0.45],
    );
    const rim = g.createRadialGradient(0.04, 0, 0.1, 0.03, 0, 0.32);
    rim.addColorStop(0, "rgba(0, 0, 0, 0)");
    rim.addColorStop(0.7, "rgba(0, 0, 0, 0.08)");
    rim.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    g.fillStyle = rim;
    g.fillRect(-0.5, -0.4, 1, 0.8);
    g.restore();

    hairs(g, rnd, 200, [[190, 160, 122], [120, 92, 66], [50, 34, 22]], 0.0035, () => {
      const t = rnd() * TAU;
      const out = outward(shape, t);
      return { ...eggPoint(shape, t, 0.95), angle: out + wrapAngle(Math.PI - out) * 0.35 + (rnd() - 0.5) * 0.6, length: 0.01 + rnd() * 0.018 };
    });
  }

  const paintSkin = () => ({
    carapace: paint([-0.3, -0.26, 0.34, 0.26], paintCarapace),
    abdomen: paint([-0.42, -0.3, 0.37, 0.3], paintAbdomen),
  });

  /* ---- Behaviour ------------------------------------------------------------------------- */

  const body = { x: 0, y: 0, heading: 0, speed: 0, turn: 0, phase: 0, abdomen: 0 }; // speed in L/s
  // mode: off | move | rest | turn | leave
  const brain = { mode: "off", target: { x: 0, y: 0 }, max: 0, wait: 0, pause: 0, heading: 0 };
  let nextGroup = 0;

  const rotate = (v, heading = body.heading) => {
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  };
  const toWorld = (p, x = body.x, y = body.y, heading = body.heading) => {
    const r = rotate(p, heading);
    return { x: x + r.x * L, y: y + r.y * L };
  };

  const margin = () => 0.75 * L;
  const inside = (x, y) => ({ x: clamp(x, margin(), W - margin()), y: clamp(y, margin(), H - margin()) });
  const anywhere = () => inside(rand(0, W), rand(0, H));
  const distanceTo = (p) => Math.hypot(p.x - body.x, p.y - body.y);
  const gone = () => {
    const out = 2.6 * L;
    return body.x < -out || body.x > W + out || body.y < -out || body.y > H + out;
  };

  function go(target, max) {
    brain.mode = "move";
    brain.target = target;
    brain.max = max;
    brain.pause = 0;
  }

  function rest(min, max) {
    brain.mode = "rest";
    brain.wait = rand(min, max);
  }

  /** After a rest: mostly a short walk ahead, sometimes a dash anywhere, sometimes a turn on the spot. */
  function decide() {
    const roll = Math.random();
    if (roll < 0.16) {
      brain.mode = "turn";
      brain.heading = body.heading + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.7);
      return;
    }
    const dash = roll > 0.64;
    const angle = dash ? rand(0, TAU) : body.heading + rand(-1.2, 1.2);
    const reach = (dash ? rand(4, 10) : rand(1.2, 4)) * L;
    let target = inside(body.x + Math.cos(angle) * reach, body.y + Math.sin(angle) * reach);
    if (distanceTo(target) < L) target = anywhere();
    go(target, dash ? rand(6, 9) : rand(1.6, 3.2));
  }

  /** Runs in from beyond an edge and stops dead somewhere in the middle: the hook. */
  function enter() {
    const spot = inside(rand(0.3, 0.7) * W, rand(0.3, 0.65) * H);
    const out = 2.6 * L;
    const edge = Math.floor(Math.random() * 4);
    const along = rand(0.15, 0.85);
    body.x = edge === 0 ? -out : edge === 1 ? W + out : along * W;
    body.y = edge === 2 ? -out : edge === 3 ? H + out : along * H;
    body.heading = Math.atan2(spot.y - body.y, spot.x - body.x);
    body.speed = 4;
    body.turn = 0;
    body.abdomen = 0;
    for (const leg of legs) {
      leg.pos = toWorld(leg.rest);
      leg.z = 0;
      leg.stepping = false;
      leg.tap = 0;
    }
    go(spot, rand(5.5, 7.5));
  }

  /** Off by the nearest edge. */
  function leave() {
    const out = 3 * L;
    const exits = [
      { gap: body.x, x: -out, y: body.y },
      { gap: W - body.x, x: W + out, y: body.y },
      { gap: body.y, x: body.x, y: -out },
      { gap: H - body.y, x: body.x, y: H + out },
    ];
    const exit = exits.reduce((a, b) => (b.gap < a.gap ? b : a));
    brain.mode = "leave";
    brain.target = { x: exit.x, y: exit.y };
    brain.max = 8;
  }

  /** A finger came down next to it: away from it, as fast as it goes. */
  function flee(x, y) {
    const away = Math.atan2(body.y - y, body.x - x) + rand(-0.4, 0.4);
    let target = inside(body.x + Math.cos(away) * 8 * L, body.y + Math.sin(away) * 8 * L);
    if (distanceTo(target) < 3 * L) {
      const corners = [inside(0, 0), inside(W, 0), inside(0, H), inside(W, H)];
      target = corners.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) > Math.hypot(a.x - x, a.y - y) ? b : a));
    }
    go(target, rand(8.5, 10.5));
  }

  /** Resting: now and then a front leg rises and tastes the air, a palp taps. */
  function fidget(dt) {
    if (Math.random() < dt * 0.35 && !legs.some((leg) => leg.tap > 0)) {
      const front = legs.filter((leg) => leg.index === 0 && !leg.stepping);
      const leg = front[Math.floor(Math.random() * front.length)];
      if (leg) leg.tap = 1e-4;
    }
    for (const palp of palps) if (palp.twitch <= 0 && Math.random() < dt * 0.5) palp.twitch = 1e-4;
  }

  /** Where it wants to go: the speed (L/s) and the turn (rad/s) it aims for. */
  function think(dt) {
    let speed = 0;
    let turn = 0;
    if (brain.mode === "move" || brain.mode === "leave") {
      const dx = brain.target.x - body.x;
      const dy = brain.target.y - body.y;
      const distance = Math.hypot(dx, dy) / L;
      const error = wrapAngle(Math.atan2(dy, dx) - body.heading);
      const fast = brain.max > 4;
      turn = clamp(error * 9, fast ? -6 : -4, fast ? 6 : 4);
      // Facing away, it turns on the spot first; it brakes hard right before the spot.
      speed = Math.min(brain.max, Math.sqrt(2 * 30 * distance)) * Math.max(0, Math.cos(error)) ** 3;
      if (brain.mode === "leave") {
        if (gone()) brain.mode = "off";
      } else if (distance < 0.08) {
        if (fast) rest(0.6, 2.4);
        else rest(0.2, 1.5);
        if (Math.random() < 0.1) brain.wait += rand(2, 3.5); // a long, creepy stillness
      } else if (brain.pause > 0) {
        brain.pause -= dt;
        speed = 0;
      } else if (!fast && Math.random() < dt * 0.7) {
        brain.pause = rand(0.12, 0.5); // walking, it stops and goes again
      }
    } else if (brain.mode === "turn") {
      const error = wrapAngle(brain.heading - body.heading);
      turn = clamp(error * 8, -3.5, 3.5);
      if (Math.abs(error) < 0.04) rest(0.4, 1.8);
    } else if (brain.mode === "rest") {
      brain.wait -= dt;
      if (brain.wait <= 0) decide();
      else fidget(dt);
    }
    return { speed, turn };
  }

  function move(dt) {
    const want = think(dt);
    // Spiders start and stop almost at once.
    body.speed = approach(body.speed, want.speed, (want.speed > body.speed ? 40 : 75) * dt);
    body.turn = approach(body.turn, want.turn, 60 * dt);
    body.heading = wrapAngle(body.heading + body.turn * dt);
    body.x += Math.cos(body.heading) * body.speed * L * dt;
    body.y += Math.sin(body.heading) * body.speed * L * dt;
    // The abdomen lags behind in turns.
    body.abdomen = lerp(body.abdomen, clamp(-body.turn * 0.03, -0.25, 0.25), Math.min(1, dt * 10));
    for (const leg of legs) if (leg.tap > 0 && (leg.tap += dt) > TAP_TIME) leg.tap = 0;
    for (const palp of palps) if (palp.twitch > 0 && (palp.twitch += dt) > TWITCH_TIME) palp.twitch = 0;
  }

  /* ---- Gait: two groups of four legs, taking turns ------------------------------------------ */

  function lift(leg, duration) {
    leg.stepping = true;
    leg.t = 0;
    leg.duration = duration * rand(0.9, 1.1);
    leg.from = { ...leg.pos };
    leg.lift = clamp(0.07 + (leg.error / L) * 0.2, 0.08, 0.24) * L;
    leg.tap = 0;
  }

  function walk(dt) {
    // Faster, the steps get quicker and longer; turning on the spot counts too (the feet go round).
    const pace = Math.max(body.speed, Math.abs(body.turn) * 1.4);
    const duration = clamp(0.17 - pace * 0.0135, 0.058, 0.17);
    const threshold = Math.max(0.11, pace * duration * 0.85) * L;
    body.phase += (dt * Math.PI) / duration;
    // Where each foot should land: its place at rest, around where the body will be mid-step.
    const lead = duration * 0.9;
    const heading = body.heading + body.turn * lead;
    const x = body.x + Math.cos(body.heading) * body.speed * L * lead;
    const y = body.y + Math.sin(body.heading) * body.speed * L * lead;
    let swinging = false;
    for (const leg of legs) {
      leg.ideal = toWorld(leg.rest, x, y, heading);
      if (leg.stepping) {
        leg.t += dt / leg.duration;
        if (leg.t >= 1) {
          leg.stepping = false;
          leg.pos = { ...leg.ideal };
          leg.z = 0;
        } else {
          const k = smooth(leg.t);
          leg.pos = { x: lerp(leg.from.x, leg.ideal.x, k), y: lerp(leg.from.y, leg.ideal.y, k) };
          leg.z = Math.sin(Math.PI * leg.t) * leg.lift;
          swinging = true;
        }
      }
      leg.error = Math.hypot(leg.ideal.x - leg.pos.x, leg.ideal.y - leg.pos.y);
    }
    // A group lifts once the other has landed, the one whose turn it is first.
    if (!swinging) {
      for (const group of [nextGroup, 1 - nextGroup]) {
        const four = legs.filter((leg) => leg.group === group);
        if (!four.some((leg) => leg.error > threshold)) continue;
        for (const leg of four) if (leg.error > threshold * 0.3) lift(leg, duration);
        nextGroup = 1 - group;
        break;
      }
    }
    // A leg left very far behind (it came back on screen, the tab slept) steps whatever the others do;
    // otherwise it waits for its group, stretched, so never more than four legs are up.
    for (const leg of legs) if (!leg.stepping && leg.error > 2 * L) lift(leg, duration * 0.8);
  }

  /* ---- Drawing ----------------------------------------------------------------------------- */

  /** Hip, knee, the two joints below and the tip, in px with their height (z). */
  function legJoints(leg, cx, cy) {
    const hip = { ...toWorld(leg.hip, cx, cy), z: BODY_Z * L };
    let foot = { x: leg.pos.x, y: leg.pos.y, z: leg.z };
    if (leg.tap > 0) {
      const raise = Math.sin((Math.PI * leg.tap) / TAP_TIME);
      foot.x += Math.cos(body.heading) * 0.12 * L * raise;
      foot.y += Math.sin(body.heading) * 0.12 * L * raise;
      foot.z += 0.24 * L * raise * (1 + 0.18 * Math.sin(leg.tap * 26));
    }

    const total = leg.length * L;
    const thigh = LEG_SEGMENTS[0] * total;
    const shin = (1 - LEG_SEGMENTS[0]) * total * 0.97; // the lower leg arches a little
    let dx = foot.x - hip.x;
    let dy = foot.y - hip.y;
    let dz = foot.z - hip.z;
    let span = Math.hypot(dx, dy, dz) || 1e-3;
    // Out of reach (dragged during a dash): the leg straightens and its tip slides.
    const fit = clamp(span, Math.abs(shin - thigh) * 1.05 + 1e-3, (thigh + shin) * 0.995) / span;
    if (fit !== 1) {
      dx *= fit;
      dy *= fit;
      dz *= fit;
      span *= fit;
      foot = { x: hip.x + dx, y: hip.y + dy, z: hip.z + dz };
    }
    const flat = Math.hypot(dx, dy) || 1e-3;
    const ux = dx / flat;
    const uy = dy / flat;
    const pitch = Math.atan2(dz, flat);
    const cosA = clamp((thigh * thigh + span * span - shin * shin) / (2 * thigh * span), -1, 1);
    const along = thigh * cosA;
    const rise = thigh * Math.sqrt(1 - cosA * cosA);

    // The knee bends up, leaning outward: square to the leg, on the side set by the pair.
    const line = { x: ux * Math.cos(pitch), y: uy * Math.cos(pitch), z: Math.sin(pitch) };
    const up = { x: -ux * Math.sin(pitch), y: -uy * Math.sin(pitch), z: Math.cos(pitch) };
    const lean = rotate(leg.knee);
    const dot = lean.x * ux + lean.y * uy;
    let ox = lean.x - dot * ux;
    let oy = lean.y - dot * uy;
    const norm = Math.hypot(ox, oy) || 1;
    ox /= norm;
    oy /= norm;
    const c = Math.cos(KNEE_LEAN);
    const s = Math.sin(KNEE_LEAN);
    const bend = { x: up.x * c + ox * s, y: up.y * c + oy * s, z: up.z * c };
    const knee = {
      x: hip.x + line.x * along + bend.x * rise,
      y: hip.y + line.y * along + bend.y * rise,
      z: hip.z + line.z * along + bend.z * rise,
    };
    // Down to the tip, the tibia and the metatarsus arch a little over the straight line.
    const lower = 1 - LEG_SEGMENTS[0];
    const joint = (share, arch) => {
      const t = share / lower;
      return {
        x: lerp(knee.x, foot.x, t) + bend.x * arch * total,
        y: lerp(knee.y, foot.y, t) + bend.y * arch * total,
        z: lerp(knee.z, foot.z, t) + bend.z * arch * total,
      };
    };
    return [hip, knee, joint(LEG_SEGMENTS[1], 0.035), joint(LEG_SEGMENTS[1] + LEG_SEGMENTS[2], 0.018), foot];
  }

  /** The palps, held forward like two short legs, moving with the steps or tapping at rest. */
  function palpJoints(palp, cx, cy, time) {
    const side = palp.side;
    const walking = Math.min(1, body.speed / 1.5);
    const stride = Math.sin(body.phase + (side > 0 ? 0 : Math.PI));
    const twitch = palp.twitch > 0 ? Math.sin((Math.PI * palp.twitch) / TWITCH_TIME) : 0;
    let angle = body.heading + side * (0.26 + stride * 0.25 * walking + Math.sin(time * 1.1 + side) * 0.04 + twitch * 0.18);
    let p = { ...toWorld({ x: 0.17, y: 0.058 * side }, cx, cy), z: 0.09 * L };
    const lifted = Math.max(0, stride) * walking * 0.05 + twitch * 0.06;
    const heights = [0.075, 0.06, 0.02 + lifted];
    const joints = [p];
    PALP_SEGMENTS.forEach((length, i) => {
      if (i) angle -= side * 0.12; // curls in a little toward the chelicerae
      p = { x: p.x + Math.cos(angle) * length * L, y: p.y + Math.sin(angle) * length * L, z: heights[i] * L };
      joints.push(p);
    });
    return joints;
  }

  /** A segment: a tube tapering from `wa` to `wb`, with round ends. */
  function tube(a, b, wa, wb, color) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, wb / 2, angle - Math.PI / 2, angle + Math.PI / 2);
    ctx.arc(a.x, a.y, wa / 2, angle + Math.PI / 2, angle + Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  }

  function drawLimb({ joints, widths, hairs: hairSets, colors }) {
    const segments = joints.length - 1;
    for (let i = 0; i < segments; i++) tube(joints[i], joints[i + 1], widths[i] * L, widths[i + 1] * L, colors[i]);

    const fine = new Path2D();
    const pale = new Path2D();
    const spines = new Path2D();
    for (let i = 0; i < segments; i++) {
      const a = joints[i];
      const b = joints[i + 1];
      const wa = widths[i] * L;
      const wb = widths[i + 1] * L;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-3;
      const ux = dx / len;
      const uy = dy / len;

      // Darker rings, and a highlight along the lit side: round, not flat.
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(24, 15, 9, 0.38)";
      for (const [t0, t1] of i < 2 ? [[0.34, 0.44], [0.74, 0.9]] : [[0.7, 0.88]]) {
        ctx.lineWidth = lerp(wa, wb, (t0 + t1) / 2) * 1.04;
        ctx.beginPath();
        ctx.moveTo(a.x + dx * t0, a.y + dy * t0);
        ctx.lineTo(a.x + dx * t1, a.y + dy * t1);
        ctx.stroke();
      }
      const lit = -uy * LIGHT.x + ux * LIGHT.y > 0 ? 0.24 : -0.24;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(214, 176, 132, 0.22)";
      ctx.lineWidth = lerp(wa, wb, 0.5) * 0.3;
      ctx.beginPath();
      ctx.moveTo(a.x + dx * 0.1 - uy * wa * lit, a.y + dy * 0.1 + ux * wa * lit);
      ctx.lineTo(a.x + dx * 0.9 - uy * wb * lit, a.y + dy * 0.9 + ux * wb * lit);
      ctx.stroke();

      // Hairs lying toward the tip; spines stand out more.
      for (const hair of hairSets[i]) {
        const half = lerp(wa, wb, hair.t) * 0.4 * hair.side;
        const bx = a.x + dx * hair.t - uy * half;
        const by = a.y + dy * hair.t + ux * half;
        const c = Math.cos(hair.angle);
        const s = Math.sin(hair.angle) * hair.side;
        const path = hair.spine ? spines : hair.pale ? pale : fine;
        path.moveTo(bx, by);
        path.lineTo(bx + (ux * c - uy * s) * hair.length * L, by + (uy * c + ux * s) * hair.length * L);
      }
    }
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(0.4, L * 0.007);
    ctx.strokeStyle = "rgba(24, 15, 9, 0.6)";
    ctx.stroke(fine);
    ctx.strokeStyle = "rgba(196, 160, 118, 0.4)";
    ctx.stroke(pale);
    ctx.lineWidth = Math.max(0.5, L * 0.011);
    ctx.strokeStyle = "rgba(18, 11, 6, 0.85)";
    ctx.stroke(spines);
  }

  function blit(texture, at, heading) {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(heading);
    ctx.scale(L, L);
    ctx.drawImage(texture.canvas, texture.x0, texture.y0, texture.w, texture.h);
    ctx.restore();
  }

  /** Light and shade that stay on the same side of the screen whichever way it turns. */
  function sheen(at, heading, shape, strength) {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(heading);
    ctx.scale(L, L);
    eggPath(ctx, shape);
    ctx.clip();
    ctx.rotate(-heading);
    const r = shape.rx;
    const across = ctx.createLinearGradient(LIGHT.x * r, LIGHT.y * r, -LIGHT.x * r, -LIGHT.y * r);
    across.addColorStop(0, `rgba(255, 236, 205, ${0.16 * strength})`);
    across.addColorStop(0.5, "rgba(255, 236, 205, 0)");
    across.addColorStop(1, `rgba(0, 0, 0, ${0.32 * strength})`);
    ctx.fillStyle = across;
    ctx.fillRect(-1, -1, 2, 2);
    const gx = LIGHT.x * r * 0.42;
    const gy = LIGHT.y * shape.ry * 0.42;
    const glint = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 0.55);
    glint.addColorStop(0, `rgba(255, 245, 225, ${0.22 * strength})`);
    glint.addColorStop(1, "rgba(255, 245, 225, 0)");
    ctx.fillStyle = glint;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  /** Its shadow on the screen: each part shifted by its height, so raised legs leave theirs behind. */
  function drawShadow(limbs, parts) {
    const g = shadeCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, shade.width, shade.height);
    g.setTransform(SHADE_RES, 0, 0, SHADE_RES, 0, 0);
    g.fillStyle = "#000";
    g.strokeStyle = "#000";
    g.lineCap = "round";
    g.lineJoin = "round";
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const { joints, widths } of limbs) {
      g.beginPath();
      joints.forEach((p, i) => {
        const x = p.x + p.z * SHADOW.x;
        const y = p.y + p.z * SHADOW.y;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      });
      g.lineWidth = widths[1] * L;
      g.stroke();
    }
    for (const { at, heading, shape, z } of parts) {
      g.save();
      g.translate(at.x + z * L * SHADOW.x, at.y + z * L * SHADOW.y);
      g.rotate(heading);
      g.scale(L, L);
      eggPath(g, shape);
      g.fill();
      g.restore();
    }
    const pad = 0.4 * L;
    x0 = Math.max(0, Math.floor(x0 - pad));
    y0 = Math.max(0, Math.floor(y0 - pad));
    x1 = Math.min(W, Math.ceil(x1 + pad));
    y1 = Math.min(H, Math.ceil(y1 + pad));
    if (x1 <= x0 || y1 <= y0) return;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.filter = `blur(${(0.035 * L * dpr).toFixed(1)}px)`;
    ctx.drawImage(shade, x0 * SHADE_RES, y0 * SHADE_RES, (x1 - x0) * SHADE_RES, (y1 - y0) * SHADE_RES, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  function draw(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";

    // The body sways a little from side to side with the steps.
    const sway = Math.sin(body.phase) * 0.014 * Math.min(1, body.speed / 1.5) * L;
    const cx = body.x - Math.sin(body.heading) * sway;
    const cy = body.y + Math.cos(body.heading) * sway;
    const waist = toWorld({ x: WAIST, y: 0 }, cx, cy);
    const tilt = body.heading + body.abdomen;
    const abdomenAt = { x: waist.x - Math.cos(tilt) * ABDOMEN_BACK * L, y: waist.y - Math.sin(tilt) * ABDOMEN_BACK * L };
    const carapaceAt = { x: cx, y: cy };

    const limbs = [
      ...legs.map((leg) => ({ joints: legJoints(leg, cx, cy), widths: LEG_WIDTHS, hairs: leg.hairs, colors: LEG_COLORS })),
      ...palps.map((palp) => ({ joints: palpJoints(palp, cx, cy, time), widths: PALP_WIDTHS, hairs: palp.hairs, colors: PALP_COLORS })),
    ];
    drawShadow(limbs, [
      { at: abdomenAt, heading: tilt, shape: ABDOMEN, z: 0.15 },
      { at: carapaceAt, heading: body.heading, shape: CEPHALOTHORAX, z: 0.11 },
    ]);
    for (const limb of limbs) drawLimb(limb);
    blit(skin.abdomen, abdomenAt, tilt);
    sheen(abdomenAt, tilt, ABDOMEN, 0.65);
    blit(skin.carapace, carapaceAt, body.heading);
    sheen(carapaceAt, body.heading, CEPHALOTHORAX, 0.6);
  }

  /* ---- Loop, size, switch ----------------------------------------------------------------- */

  let running = false;
  let last = 0;

  function frame(now) {
    if (brain.mode === "off") {
      running = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    move(dt);
    walk(dt);
    draw(now / 1000);
    requestAnimationFrame(frame);
  }

  function run() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    shade.width = Math.ceil(W * SHADE_RES);
    shade.height = Math.ceil(H * SHADE_RES);
    // About a third of a phone screen from leg tip to leg tip.
    const size = clamp(Math.min(W, H) * 0.14, 30, 84);
    if (!skin || ratio !== dpr || Math.abs(size - L) > L * 0.08) {
      L = size;
      dpr = ratio;
      skin = paintSkin();
    }
  }

  let on = false;
  try {
    on = localStorage.getItem("fo-spider") === "on";
  } catch {}
  const mark = () => document.body.classList.toggle("spider-on", on);

  function toggle() {
    on = !on;
    mark();
    try {
      localStorage.setItem("fo-spider", on ? "on" : "off");
    } catch {}
    if (!on) {
      if (brain.mode !== "off") leave();
    } else if (brain.mode === "off") {
      enter();
      run();
    } else rest(0.2, 0.8); // it was leaving: it changes its mind
  }

  /** A new take: if it is on, it comes back in from an edge. */
  function respawn() {
    if (!on) return;
    enter();
    run();
  }

  window.addEventListener("resize", resize);
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!on || brain.mode === "off" || brain.mode === "leave") return;
      if (Math.hypot(event.clientX - body.x, event.clientY - body.y) > 2.2 * L) return;
      flee(event.clientX, event.clientY);
    },
    { capture: true, passive: true },
  );

  resize();
  mark();
  if (on) {
    enter();
    run();
  }

  window.FO_SPIDER = { toggle, respawn };
})();
