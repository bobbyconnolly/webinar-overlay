// Moongate teleport. A tap on the gate region (phone cursor over it, or the
// presenter's click) plays a four-pointed star burst at that exact point, and
// at the peak everything in the region is sent elsewhere: every phone cursor
// (with whatever it carries) and every reagent lying there, each to its own
// random free spot with a burst of its own. The region is the moongate grown
// by 30% on every side, to catch bystanders.
import { allCursors, getCursor, onCursorFrame, teleportCursor } from "./cursors";
import { sfx } from "./sounds";

const STAR_MS = 520; // one burst: 0 -> max -> 0
const JUMP_AT_MS = 260; // things jump at the peak of the burst
const COOLDOWN_MS = 2500; // per phone cursor
const GATE_GROW = 0.3; // region = gate box grown by this fraction per side
const MARGIN = 40; // keep destinations away from the screen edges
const WIDGET_PAD = 20; // and this far from any widget

export type Point = { x: number; y: number };
/** Something the gate (or a spell) can move: where it is, and how to put it somewhere else. */
export type Movable = { x: number; y: number; move: (p: Point) => void };
/** Registered by quest.ts (loose reagents) and cat.ts (dishes, the cat): everything of theirs inside a region. */
type Sweeper = (inRegion: (x: number, y: number) => boolean) => Movable[];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const wrap = $("[data-widget=moongate]");
const gate = $(".moongate");
const lastTeleport = new Map<string, number>();
let onTeleport: (phoneId: string) => void = () => {};
let onPortal: (phoneId: string, url: string) => void = () => {};
const sweepers: Sweeper[] = []; // quest.ts (reagents), cat.ts (the dish and Ginger)
let starSeq = 0;

export function initMoongate(h: { onTeleport: (phoneId: string) => void; onPortal?: (phoneId: string, url: string) => void; isInteractive: () => boolean }) {
  onTeleport = h.onTeleport;
  if (h.onPortal) onPortal = h.onPortal;
  // Presenter click (not a drag): listen on the widget, pointer capture retargets clicks to it.
  wrap.addEventListener("click", (e) => {
    if (wrap.dataset.dragged || !h.isInteractive()) return;
    triggerMoongate(null, { x: e.clientX, y: e.clientY });
  });
}
export function setGateSweeper(fn: Sweeper) {
  sweepers.push(fn);
}
/** Everything that is not a cursor inside a region (reagents, dishes, the cat), with movers. */
export function sweepRegion(inRegion: (x: number, y: number) => boolean): Movable[] {
  return sweepers.flatMap((s) => s(inRegion));
}
/**
 * Lightning overloads the gate: for `ms`, any cursor that touches it is sent
 * through at once, no tap and no per-cursor cooldown (a hazard to cross).
 */
let overloadedUntil = 0;
const lastZap = new Map<string, number>();
export function setGateOverloaded(ms: number) {
  overloadedUntil = Date.now() + ms;
  wrap.classList.add("overloaded");
  window.setTimeout(() => {
    if (Date.now() >= overloadedUntil) wrap.classList.remove("overloaded");
  }, ms);
}
export function isGateOverloaded() {
  return Date.now() < overloadedUntil;
}
/**
 * Level 3: while the ankh rests on the gate (horde.ts) the gate is sealed: no
 * tap teleports, the Teleport spell's gather does not fire it, and the overload
 * does not zap. Taps on it charge the ankh instead (main.ts).
 */
let sealed = false;
export function setGateSealed(on: boolean) {
  sealed = on;
}
export function isGateSealed() {
  return sealed;
}
/**
 * The ending: while a portal URL is set, the gate sends phones elsewhere for real. The first
 * time a cursor enters the region its phone gets `onPortal` (once per phone, ever), a star
 * marks the spot, and nothing is flung off the gate, so the student sees their phone move.
 * Ordinary teleports and the overload zap are off meanwhile.
 */
let portalUrl = "";
const sentPortal = new Set<string>();
export function setGatePortal(url: string) {
  portalUrl = url.trim();
  wrap.classList.toggle("portal", portalUrl !== "");
}
export function isGatePortal() {
  return portalUrl !== "";
}
onCursorFrame((cursors) => {
  if (!portalUrl || sealed) return;
  const entered: string[] = [];
  for (const [id, c] of cursors) if (onGate(c.x, c.y) && !sentPortal.has(id)) entered.push(id);
  if (!entered.length) return;
  for (const id of entered) sentPortal.add(id);
  window.setTimeout(() => {
    for (const id of entered) {
      const c = getCursor(id);
      if (c) star(c.x, c.y);
      onPortal(id, portalUrl);
    }
  }, 0);
});
onCursorFrame((cursors) => {
  const now = Date.now();
  if (now >= overloadedUntil || sealed || portalUrl) return;
  const zap: string[] = [];
  for (const [id, c] of cursors) {
    if (onGate(c.x, c.y) && now - (lastZap.get(id) ?? 0) >= 800) zap.push(id);
  }
  if (!zap.length) return;
  for (const id of zap) lastZap.set(id, now);
  window.setTimeout(() => {
    for (const id of zap) {
      const c = getCursor(id);
      if (!c) continue;
      star(c.x, c.y);
      const p = freeSpot();
      teleportCursor(id, p.x, p.y);
      star(p.x, p.y);
      onTeleport(id);
    }
  }, 0); // outside the frame callback that found them
});
/** How far "near the gate" reaches: half the grown gate box (the Teleport spell's vicinity). */
export function gateVicinity(): number {
  const r = gate.getBoundingClientRect();
  return Math.max(r.width, r.height) * (0.5 + GATE_GROW);
}
/**
 * A point on the gate for gathering things onto it, kept away from the ones
 * already placed (best of a dozen candidates: cheap blue noise, nothing stacks).
 */
export function gateSpot(placed: Point[]): Point {
  const r = gate.getBoundingClientRect();
  let best = gateCentre();
  let bestD = -1;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const k = Math.sqrt(Math.random());
    const p = { x: r.left + r.width / 2 + Math.cos(a) * k * r.width * 0.45, y: r.top + r.height / 2 + Math.sin(a) * k * r.height * 0.45 };
    const d = placed.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), Infinity);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  placed.push(best);
  return best;
}
/** The gate glows harder while a Teleport spell gathers things onto it. */
export function setGateCharging(on: boolean) {
  wrap.classList.toggle("charging", on);
}

/** Inside the gate region (the moongate box grown by 30% per side). */
export function onGate(x: number, y: number): boolean {
  const r = gate.getBoundingClientRect();
  const px = r.width * GATE_GROW;
  const py = r.height * GATE_GROW;
  return x >= r.left - px && x <= r.right + px && y >= r.top - py && y <= r.bottom + py;
}

/**
 * Burst at `at` (the tap/click point; defaults to the tapping cursor, else the
 * gate centre), then at the peak teleport every cursor and loose reagent in the
 * region. Cursors are rate limited per phone.
 */
export function triggerMoongate(byPhoneId: string | null, at?: Point): "teleported" | "cooldown" | "nobody" | "sealed" {
  const now = Date.now();
  if (sealed || portalUrl) return "sealed"; // a portal gate does not fling anyone; the frame hook sends them on
  if (byPhoneId && now - (lastTeleport.get(byPhoneId) ?? 0) < COOLDOWN_MS) return "cooldown";

  const cursors: string[] = [];
  for (const [id, c] of allCursors()) {
    if (onGate(c.x, c.y) && now - (lastTeleport.get(id) ?? 0) >= COOLDOWN_MS) cursors.push(id);
  }
  const movers = sweepRegion(onGate);

  const origin: Point = at ?? (byPhoneId ? getCursor(byPhoneId) : undefined) ?? gateCentre();
  star(origin.x, origin.y);
  if (!cursors.length && !movers.length) return "nobody";

  for (const id of cursors) lastTeleport.set(id, now);
  window.setTimeout(() => {
    for (const id of cursors) {
      if (!getCursor(id)) continue; // left meanwhile
      const p = freeSpot();
      teleportCursor(id, p.x, p.y);
      star(p.x, p.y);
      onTeleport(id);
    }
    for (const m of movers) {
      const p = freeSpot();
      star(p.x, p.y);
      m.move(p);
    }
  }, JUMP_AT_MS);
  return "teleported";
}

/**
 * Send one thing (not a cursor) through the gate: burst at `at` now, then at
 * the peak a burst at a free spot and `place(spot)`. Used by quest.ts when a
 * reagent is dropped onto the gate region.
 */
export function gateTeleport(place: (p: Point) => void, at?: Point) {
  const o = at ?? gateCentre();
  star(o.x, o.y);
  window.setTimeout(() => {
    const p = freeSpot();
    star(p.x, p.y);
    place(p);
  }, JUMP_AT_MS);
}

export function gateCentre(): Point {
  const g = gate.getBoundingClientRect();
  return { x: g.left + g.width / 2, y: g.top + g.height / 2 };
}
/** A star burst anywhere (spells reuse the moongate's). */
export function burstAt(x: number, y: number) {
  star(x, y);
}

// Four-pointed diamond star. Each blade folds along its spine: a linear
// gradient from pure white at the spine to a hair darker at the outer edge,
// and a radial white core over everything so the centre shines through.
function starSvg(): string {
  const n = ++starSeq;
  const stops = `<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e1ec"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <linearGradient id="gl${n}" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="38" y2="0">${stops}</linearGradient>
    <linearGradient id="gr${n}" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="62" y2="0">${stops}</linearGradient>
    <linearGradient id="gu${n}" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="0" y2="38">${stops}</linearGradient>
    <linearGradient id="gd${n}" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="0" y2="62">${stops}</linearGradient>
    <radialGradient id="core${n}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.28" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M50 2 L38 38 L50 50 Z" fill="url(#gl${n})"/><path d="M50 2 L62 38 L50 50 Z" fill="url(#gr${n})"/>
  <path d="M98 50 L62 38 L50 50 Z" fill="url(#gu${n})"/><path d="M98 50 L62 62 L50 50 Z" fill="url(#gd${n})"/>
  <path d="M50 98 L62 62 L50 50 Z" fill="url(#gr${n})"/><path d="M50 98 L38 62 L50 50 Z" fill="url(#gl${n})"/>
  <path d="M2 50 L38 62 L50 50 Z" fill="url(#gd${n})"/><path d="M2 50 L38 38 L50 50 Z" fill="url(#gu${n})"/>
  <path d="M50 2 L62 38 L98 50 L62 62 L50 98 L38 62 L2 50 L38 38 Z" fill="url(#core${n})"/>
</svg>`;
}

function star(x: number, y: number) {
  sfx("moongate", { cooldownMs: 300 }); // one sound per teleport: the landing star comes 260 ms after the first
  const el = document.createElement("div");
  el.className = "tstar";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty("--rot0", `${Math.floor(Math.random() * 360)}deg`); // random start angle
  el.innerHTML = starSvg();
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), STAR_MS + 60);
}

/** Random point on screen that is not over any visible widget or the pill. */
export function freeSpot(): Point {
  const blocks: DOMRect[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(".widget, #control, #quest-banner")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
    blocks.push(new DOMRect(r.left - WIDGET_PAD, r.top - WIDGET_PAD, r.width + 2 * WIDGET_PAD, r.height + 2 * WIDGET_PAD));
  }
  for (let i = 0; i < 60; i++) {
    const x = MARGIN + Math.random() * (innerWidth - 2 * MARGIN);
    const y = MARGIN + 60 + Math.random() * (innerHeight - 2 * MARGIN - 60);
    if (!blocks.some((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)) return { x, y };
  }
  return { x: innerWidth / 2, y: innerHeight / 2 }; // screen is very full; give up gracefully
}
