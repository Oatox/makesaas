/*
 * Turned screen: to film the fake onboarding on a computer screen stood on its side, as if it were a
 * phone. T (or the button) turns the page a quarter turn one way, then the other, then back; the
 * choice is remembered on this device. Turned, this page only holds the onboarding in a phone-sized
 * frame (index.html?phone, so it gets the phone layout), turned and enlarged to fill the screen.
 *
 * Loaded first, in <head>: app.js and spider.js stop at once when this page is only the holder.
 * Inside the phone, turning, fullscreen and going back to the list belong to the holder.
 */
(() => {
  "use strict";

  const TURNS = [0, -90, 90]; // -90 for a screen turned clockwise, 90 for one turned the other way
  const PHONE_WIDTH = 400; // width of the phone's screen, in CSS px
  const inPhone = new URLSearchParams(location.search).has("phone");

  let turn = 0;
  try {
    turn = Number(localStorage.getItem("fo-turn")) || 0;
  } catch {}
  if (!TURNS.includes(turn)) turn = 0;

  const holder = !inPhone && turn !== 0;
  let frame = null;

  /** Pixels per CSS pixel for the canvases: more inside the phone, shown enlarged, so they stay sharp. */
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2) * (Number(window.frameElement?.dataset.zoom) || 1);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /** Back to the admin's list of tools (when embedded there). */
  function home() {
    if (window.parent !== window) window.parent.postMessage({ type: "marketing-tool:home" }, location.origin);
  }

  /** The next way: into or out of the phone, the page starts again; from one side to the other, it just turns. */
  function next() {
    const value = TURNS[(TURNS.indexOf(turn) + 1) % TURNS.length];
    try {
      localStorage.setItem("fo-turn", String(value));
    } catch {}
    if (holder && value !== 0) {
      turn = value;
      place();
    } else location.reload();
  }

  /** The phone, turned and enlarged so that its width fills the screen's height (or width, upright). */
  function place() {
    if (!frame) return;
    const quarter = turn % 180 !== 0;
    const across = quarter ? window.innerHeight : window.innerWidth;
    const along = quarter ? window.innerWidth : window.innerHeight;
    const zoom = across / PHONE_WIDTH;
    frame.style.width = `${PHONE_WIDTH}px`;
    frame.style.height = `${along / zoom}px`;
    frame.style.transform = `translate(-50%, -50%) rotate(${turn}deg) scale(${zoom})`;
    frame.dataset.zoom = String(zoom);
    // Its size in CSS px may stay the same: its canvases still follow the zoom.
    frame.contentWindow?.dispatchEvent(new Event("resize"));
  }

  if (inPhone) {
    const outer = window.parent !== window ? window.parent.FO_TURN : null;
    document.documentElement.classList.add("turned");
    window.FO_TURN = {
      holder: false,
      pixelRatio,
      next: () => (outer ? outer.next() : next()),
      fullscreen: () => (outer ? outer.fullscreen() : toggleFullscreen()),
      home: () => (outer ? outer.home() : home()),
    };
    return;
  }

  window.FO_TURN = { holder, pixelRatio, next, fullscreen: toggleFullscreen, home };
  if (!holder) return;

  // Holding the phone: the page's own onboarding is hidden (style.css) and never started.
  document.documentElement.classList.add("phone-holder");
  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    params.set("phone", "");
    frame = document.createElement("iframe");
    frame.className = "phone";
    frame.title = document.title;
    frame.src = `${location.pathname}?${params}`;
    frame.addEventListener("load", () => frame.contentWindow?.focus());
    document.body.append(frame);
    place();
  });
  window.addEventListener("resize", place);

  // In fullscreen, the tool's buttons leave the video, inside the phone too.
  document.addEventListener("fullscreenchange", () => {
    frame?.contentDocument?.documentElement.classList.toggle("filming", !!document.fullscreenElement);
  });

  // Keys pressed while the holder has the focus: its own here, the others go to the onboarding.
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "t") next();
    else if (key === "f") toggleFullscreen();
    else if (event.key === "Escape") {
      if (!document.fullscreenElement) home();
    } else frame?.contentWindow?.dispatchEvent(new KeyboardEvent("keydown", { key: event.key }));
  });
})();
