// Sons synthétisés en Web Audio (aucun fichier).
// Calqués sur la vidéo : un "tok" dont la hauteur chute (~2.3 kHz → ~650 Hz) à chaque élément,
// un souffle filtré pendant la rotation, et un "ding" deux notes montantes (≈ Si5 → Mi6) à l'arrêt.
const Sfx = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let whoosh = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;

      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(comp).connect(ctx.destination);

      // 2 s de bruit blanc réutilisable
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    // iPhone : par le canal média, pour que le bouton silencieux ne coupe pas les sons.
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch {}
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noise(t, dur, { type = "bandpass", freq = 2000, q = 1, gain = 0.3, attack = 0.001 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  function tone(t, { type = "sine", from, to = from, glide = 0.03, gain = 0.3, attack = 0.002, dur = 0.1, lp = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + glide);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lp;
      f.Q.value = 0.7;
      node = o.connect(f);
    }
    node.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  // "tok" à chaque élément qui passe sous la barre
  function tick(strength = 1) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const p = 1 + (Math.random() - 0.5) * 0.06;
    tone(t, { type: "triangle", from: 2350 * p, to: 640 * p, glide: 0.032, gain: 0.5 * strength, dur: 0.075 });
    tone(t, { type: "sine", from: 560 * p, to: 470 * p, glide: 0.05, gain: 0.22 * strength, dur: 0.06 });
    noise(t, 0.018, { type: "bandpass", freq: 2400, q: 1.4, gain: 0.32 * strength });
  }

  // "clac" de départ
  function start() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    tone(t, { type: "sine", from: 190, to: 70, glide: 0.09, gain: 0.55, dur: 0.16 });
    noise(t, 0.05, { type: "highpass", freq: 1200, q: 0.7, gain: 0.35 });
    tone(t + 0.01, { type: "triangle", from: 1800, to: 900, glide: 0.04, gain: 0.25, dur: 0.07 });
  }

  // souffle de rotation, volume piloté par la vitesse (0..1)
  function whooshStart() {
    if (!ensure() || muted || whoosh) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2900;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(f).connect(g).connect(master);
    src.start();
    whoosh = { src, f, g };
  }
  function whooshSpeed(s) {
    if (!whoosh) return;
    const t = ctx.currentTime;
    whoosh.g.gain.setTargetAtTime(0.0001 + 0.075 * s * s, t, 0.05);
    whoosh.f.frequency.setTargetAtTime(1900 + 1300 * s, t, 0.05);
  }
  function whooshStop() {
    if (!whoosh) return;
    const w = whoosh;
    whoosh = null;
    const t = ctx.currentTime;
    w.g.gain.setTargetAtTime(0.0001, t, 0.06);
    w.src.stop(t + 0.4);
  }

  // "ding" de victoire
  function win() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    // impact grave
    tone(t, { type: "sine", from: 170, to: 55, glide: 0.16, gain: 0.6, dur: 0.3 });
    noise(t, 0.06, { type: "lowpass", freq: 900, q: 0.7, gain: 0.25 });
    // note 1 : Si5
    tone(t, { type: "square", from: 987.77, gain: 0.13, dur: 0.11, lp: 4200 });
    tone(t, { type: "sine", from: 987.77 * 2, gain: 0.12, dur: 0.1 });
    // note 2 : Mi6, tenue
    const t2 = t + 0.085;
    tone(t2, { type: "square", from: 1318.51, gain: 0.14, dur: 0.6, lp: 4200 });
    tone(t2, { type: "sine", from: 1318.51, gain: 0.18, dur: 0.75 });
    tone(t2, { type: "sine", from: 1318.51 * 2, gain: 0.06, dur: 0.45 });
    // petite brillance
    tone(t2 + 0.04, { type: "sine", from: 2637, gain: 0.05, dur: 0.5 });
    noise(t2 + 0.02, 0.35, { type: "bandpass", freq: 2900, q: 2, gain: 0.05, attack: 0.02 });
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
    if (m) whooshStop();
  }

  return { ensure, tick, start, win, whooshStart, whooshSpeed, whooshStop, setMuted, get muted() { return muted; } };
})();
