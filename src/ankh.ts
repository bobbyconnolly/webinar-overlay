// The ankh ritual. Cursors that gather on the ankh make it glow and shake;
// taps and wiggling charge it, but it only charges past a dim glow with a
// quorum: at least MIN_CURSORS cursors on it AND more than half of all cursors (two
// in all means both)
// (every phone plus the Seer's own mouse, which counts for the quorum but is
// never blessed, since the overlay does not draw it). Full charge: a white
// flash hides the ankh and the cursors for a moment, then every phone that took
// part gets a sparkle trail (sparkles.ts) for a minute. Repeatable after a
// short cooldown; a second blessing restarts a trail. Independent of levels.
import { allCursors, getCursor } from "./cursors";
import { getMouse } from "./mouse";
import { bless } from "./sparkles";
import { labelFor } from "./identity";
import { announce } from "./spells";
import { ankhPlaced, startWave, waveActive } from "./horde";
import { isGhost } from "./ghosts";
import { setAnkhHooks } from "./cat";
import { stage } from "./stage";
import { sfx } from "./sounds";

const MIN_CURSORS = 2; // was 3; Bobby tests with his mouse plus one phone
const GROW = 0.25; // region = the frame box grown by this fraction per side
const FULL = 100; // charge units
const TAP = 14; // a tap or click on the ankh
const PER_PX = 0.06; // per pixel of movement while on the ankh (about 3 s of three people wiggling)
const DECAY_PER_S = 18;
const DIM_CAP = 35; // without the quorum the glow stops here
const PRESENCE_GLOW = 0.1; // just arriving makes it glow a little
const CONTRIB_WINDOW_MS = 8000; // who counts as a participant at the flash
const COOLDOWN_MS = 12_000;
const STIR_MSG_MS = 4000; // "the ankh stirs · 2 of 3" per phone
const MAX_STEP_PX = 60; // a bigger jump in one frame is a teleport, not a wiggle
const PURR_PER_S = 40; // Ginger purring on it (cat.ts): the glow climbs to the dim cap and no further
const DISH_BELOW = 56; // px (× stage) under the frame: where the ankh conjures his dish
const PURR_UP = 0.3; // his paws sit this fraction of the frame's height above its bottom edge

type Hooks = { send: (msg: object) => void };
let hooks: Hooks;
const frame = document.querySelector<HTMLElement>("[data-widget=image]")!;
const img = frame.querySelector<HTMLElement>("img")!;
let charge = 0;
let lastT = performance.now();
let lastFlash = -COOLDOWN_MS;
const lastPos = new Map<string, { x: number; y: number }>();
const contributed = new Map<string, number>(); // id -> last contribution time
const stirTold = new Map<string, number>();

/** Inside the ankh region (the frame grown by 25% per side). */
export function onAnkh(x: number, y: number): boolean {
  const r = frame.getBoundingClientRect();
  const px = r.width * GROW;
  const py = r.height * GROW;
  return x >= r.left - px && x <= r.right + px && y >= r.top - py && y <= r.bottom + py;
}

/** A tap (phone) or click (mouse) on the ankh. Not clamped here: step() clamps after the
 *  "full" check, so taps alone can finish the ritual (clamping to FULL here left the charge
 *  one frame of decay short of full forever, 2026-10-02). */
export function ankhTap(id: string) {
  contributed.set(id, performance.now());
  charge += TAP;
}

function need(total: number) {
  return Math.max(MIN_CURSORS, Math.floor(total / 2) + 1);
}

/** Ginger purring on the ankh (cat.ts, per frame): it stirs to the dim glow, never toward awakening. */
function catPurr(dt: number) {
  if (charge < DIM_CAP) charge = Math.min(DIM_CAP, charge + PURR_PER_S * dt);
}
/** Where the ankh conjures his dish: just under the frame. */
function dishSpot() {
  const r = frame.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.bottom + DISH_BELOW * stage() };
}
/** Where his paws go to sit on the ankh: the frame's centre line, in its lower third (Bobby: onto it, not beside it). */
function purrSpot() {
  const r = frame.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.bottom - r.height * PURR_UP };
}

function step(now: number) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  // Level 3, a wave running: the ankh lies dark on the gate and answers nobody.
  if (waveActive()) {
    charge = 0;
    frame.style.setProperty("--charge", "0");
    img.style.transform = "";
    requestAnimationFrame(step);
    return;
  }
  // Who is on the ankh: phones, plus the Seer's mouse under the id "mouse".
  const here: string[] = [];
  const seen = new Set<string>();
  const consider = (id: string, x: number, y: number) => {
    seen.add(id);
    const on = onAnkh(x, y);
    const prev = lastPos.get(id);
    lastPos.set(id, { x, y });
    if (!on) return;
    here.push(id);
    if (prev) {
      const d = Math.hypot(x - prev.x, y - prev.y);
      if (d > 0.5 && d < MAX_STEP_PX) {
        charge += d * PER_PX;
        contributed.set(id, now);
      }
    }
  };
  let living = 0;
  for (const [id, c] of allCursors()) {
    if (isGhost(id)) continue; // spirits neither count nor charge
    living++;
    consider(id, c.x, c.y);
  }
  const m = getMouse();
  if (m) consider("mouse", m.x, m.y);
  for (const id of [...lastPos.keys()]) if (!seen.has(id)) lastPos.delete(id);

  const total = living + 1; // every living phone and the Seer's mouse
  const quorum = here.length >= MIN_CURSORS && here.length * 2 > total;
  charge = Math.max(0, charge - DECAY_PER_S * dt);
  if (!quorum) charge = Math.min(charge, DIM_CAP);
  charge = Math.min(FULL, charge);

  // Tell the phones on it why it is not catching when they are short.
  if (!quorum && here.length && charge > 5) {
    for (const id of here) {
      if (id === "mouse" || now - (stirTold.get(id) ?? 0) < STIR_MSG_MS) continue;
      stirTold.set(id, now);
      hooks.send({ type: "ankh", to: id, state: "stirs", have: here.length, need: need(total) });
    }
  }

  // Look: glow with the charge, a small shake that grows with it.
  const glow = Math.max(charge / FULL, here.length ? PRESENCE_GLOW : 0);
  frame.style.setProperty("--charge", glow.toFixed(3));
  if (glow > 0.12) {
    const amp = (glow - 0.1) * 6;
    img.style.transform = `translate(${(Math.random() - 0.5) * amp}px, ${(Math.random() - 0.5) * amp}px)`;
  } else if (img.style.transform) {
    img.style.transform = "";
  }

  if (charge >= FULL && now - lastFlash >= COOLDOWN_MS) awaken(now);
  requestAnimationFrame(step);
}

function awaken(now: number) {
  lastFlash = now;
  charge = 0;
  flash();
  sfx("ankh");
  const names: string[] = [];
  for (const [id, at] of contributed) {
    if (id === "mouse" || now - at > CONTRIB_WINDOW_MS || !getCursor(id)) continue;
    bless(id);
    names.push(labelFor(id).name);
    hooks.send({ type: "ankh", to: id, state: "blessed" });
  }
  contributed.clear();
  hooks.send({ type: "ankh", state: "awakened", names });
  window.setTimeout(() => announce("✦ The Ankh Awakens ✦", "#ffe9b0"), 350);
  if (ankhPlaced()) startWave(); // level 3: awakened on the gate, it tears the gate open
  document.dispatchEvent(new CustomEvent("ankh-awakened")); // level 0: levels.ts starts the game
}

/** Devtools: awaken now and bless every connected phone. False if there is none (and no gate to open). */
export function devAwaken(): boolean {
  const now = performance.now();
  if (!allCursors().size && !ankhPlaced()) return false;
  for (const id of allCursors().keys()) contributed.set(id, now);
  lastFlash = -COOLDOWN_MS;
  awaken(now);
  return true;
}

/** A white burst centred on the ankh that covers it and the cursors for a moment. */
function flash() {
  const r = frame.getBoundingClientRect();
  const size = Math.hypot(r.width, r.height) * 2.6;
  const el = document.createElement("div");
  el.className = "ankh-flash";
  el.style.left = `${r.left + r.width / 2 - size / 2}px`;
  el.style.top = `${r.top + r.height / 2 - size / 2}px`;
  el.style.width = el.style.height = `${size}px`;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 1000);
}

export function initAnkh(h: Hooks) {
  hooks = h;
  // The Seer's click (not a drag) counts as a tap; the widget drag handler retargets clicks to the widget.
  frame.addEventListener("click", () => {
    if (frame.dataset.dragged) return;
    ankhTap("mouse");
  });
  // Ginger (cat.ts): his paws on the ankh make him sit and purr, and it feeds him; not during a wave or while it rests on the gate.
  setAnkhHooks({ on: onAnkh, busy: () => waveActive() || ankhPlaced(), purr: catPurr, purrSpot, dishSpot });
  requestAnimationFrame(step);
}
