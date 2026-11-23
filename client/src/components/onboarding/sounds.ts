/**
 * Short sounds of the onboarding, synthesized with Web Audio: no file to load. Browsers only let a
 * page play sound after a tap, and iOS only starts audio from inside one, so the first tap or key
 * press anywhere unlocks it; before that, sounds are skipped silently.
 */

let context: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    context = new Context();
  }
  return context;
}

if (typeof window !== "undefined") {
  const unlock = () => void audio()?.resume();
  window.addEventListener("pointerdown", unlock, { capture: true, once: true });
  window.addEventListener("keydown", unlock, { capture: true, once: true });
}

/** A sale coming in, like a cash register: the drawer ("ka"), then a bright bell that rings out ("ching"). */
export function playCashSound() {
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.3;
  out.connect(ctx.destination);

  // "Ka": a short burst of noise, filtered around the clack of the drawer.
  const length = Math.floor(ctx.sampleRate * 0.06);
  const noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const burst = ctx.createBufferSource();
  burst.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2500;
  band.Q.value = 1.2;
  const burstLevel = ctx.createGain();
  burstLevel.gain.value = 0.7;
  burst.connect(band).connect(burstLevel).connect(out);
  burst.start(now);

  // "Ching": a few bright bell partials, struck right after, ringing out for almost a second.
  const ring = now + 0.07;
  for (const [frequency, level] of [
    [2093, 0.5],
    [2637, 0.35],
    [4186, 0.18],
    [5274, 0.1],
  ]) {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ring);
    gain.gain.exponentialRampToValueAtTime(level, ring + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ring + 0.9);
    oscillator.connect(gain).connect(out);
    oscillator.start(ring);
    oscillator.stop(ring + 0.95);
  }
}

/** A message from the coach, like a phone notification: two soft notes going up, glassy. */
export function playMessageSound() {
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.25;
  out.connect(ctx.destination);

  for (const [frequency, delay] of [
    [1318.5, 0],
    [1760, 0.11],
  ]) {
    const start = now + delay;
    // Each note: its pitch, and a soft octave above for the glassy ring.
    for (const [harmonic, level] of [
      [1, 0.6],
      [2, 0.12],
    ]) {
      const oscillator = ctx.createOscillator();
      oscillator.frequency.value = frequency * harmonic;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      oscillator.connect(gain).connect(out);
      oscillator.start(start);
      oscillator.stop(start + 0.5);
    }
  }
}
