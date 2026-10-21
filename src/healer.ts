// The wandering healer (Bobby 2026-10-02). A hooded figure in a brown robe with a
// staff who walks in when level 3 begins and paces about the signpost, labelled
// "a wandering healer". Invincible and immovable: monsters, fireballs, the gate
// and lightning ignore him. His one job, as in the old game: a ghost that drifts
// into him is restored at once. A living cursor that taps him is told it is in
// good health. He walks off when the game is reset.
import { allCursors, getCursor } from "./cursors";
import { ghostIds, isGhost, revive } from "./ghosts";
import { stage } from "./stage";

// Soft (Bobby 2026-10-02: "moves too much and too quickly"): a slow walk that eases in
// and out, long pauses, a small range. And grounded: a V-shaped no-go wedge opens upward
// from the foot of the signpost (half-angle atan(V_TAN)), so he never drifts up the post
// and "floats"; a waypoint on the far side of the post is reached by a detour below it.
const WALK = 36; // px/s at stage 1, on the flat
const ENTER_MUL = 1.6; // a little brisker walking in and out
const RANGE = 100; // how far from his spot he wanders, px at stage 1
const EASE_R = 50; // slows down over the last px before a waypoint
const RAMP_MS = 600; // and takes this long to get going
const V_TAN = 0.7; // tan(35°): the wedge's half-width per px above the foot
const HEAL_R = 46; // a ghost's tip this close to him is restored
const PAUSE_MS: [number, number] = [1800, 5200];
const WELL_MS = 4000; // one "good health" per phone this often
const W = 60; // art box at stage 1 (matches .healer)
const H = 90;
const EDGE_IN = 120; // he walks in from this far off the nearest edge (never the top: he would come down the post)

const SVG = `<svg viewBox="0 0 60 90" aria-hidden="true">
  <g stroke="#2e1d0e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M47 14 L47 87" stroke="#8a6a3a" stroke-width="3.5"/>
    <circle cx="47" cy="11" r="4" fill="#c9a227" stroke="#5a3a14"/>
    <path d="M30 18 C14 18 12 48 10 86 L50 86 C48 48 46 18 30 18 Z" fill="#6b4a2b"/>
    <path d="M18 60 C22 72 24 80 24 86 M40 56 C38 70 36 80 36 86" fill="none" stroke="#4a3018" stroke-width="1.5"/>
    <path d="M30 6 C19 6 16 16 17 24 C20 30 40 30 43 24 C44 16 41 6 30 6 Z" fill="#5a3d20"/>
    <path d="M30 12 C24 12 22 18 22 23 C22 27 38 27 38 23 C38 18 36 12 30 12 Z" fill="#1f140a"/>
    <path d="M26 20 C27.5 19 29 19 30 20 M32 20 C33 19 34.5 19 35.5 20" fill="none" stroke="#e9d8a6" stroke-width="1.3"/>
    <path d="M14 48 C10 52 8 58 12 60 L18 54 Z" fill="#e0b98a"/>
    <path d="M42 44 C46 46 50 50 48 54 L41 52 Z" fill="#e0b98a"/>
  </g>
</svg>`;

type Hooks = { send: (msg: object) => void };
let hooks: Hooks;
const fx = document.getElementById("fx")!;
const signpost = document.querySelector<HTMLElement>("[data-widget=signpost]")!;
let el: HTMLElement | null = null;
let x = 0;
let y = 0;
let tx = 0;
let ty = 0;
let facingRight = true;
let pauseUntil = 0;
let legStart = 0; // when the current leg began (the speed ramps up from it)
let queue: { x: number; y: number }[] = []; // waypoints after the current one (a detour below the post)
let state: "away" | "arriving" | "pacing" | "leaving" = "away";
let raf = 0;
let lastT = 0;
const lastWell = new Map<string, number>();
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** Where he belongs: at the foot of the signpost (screen centre-right if it is hidden). */
function home(): { x: number; y: number } {
  const r = signpost.getBoundingClientRect();
  if (!r.width) return { x: innerWidth * 0.82, y: innerHeight * 0.42 };
  return { x: r.left + r.width * 0.5, y: r.bottom - 10 * stage() };
}
/** Inside the wedge above the post's foot: his feet would be "up" the post. */
function forbidden(px: number, py: number): boolean {
  const h = home();
  const up = h.y - py;
  return up > 0 && Math.abs(px - h.x) < up / V_TAN;
}
function ensure(): HTMLElement {
  if (!el) {
    el = document.createElement("div");
    el.className = "healer";
    el.innerHTML = `${SVG}<span class="label">a wandering healer</span>`;
    fx.appendChild(el);
  }
  return el;
}
/** The next place to stand: around home, never in the wedge; the far side of the post via a detour below it. */
function waypoint() {
  const h = home();
  const s = stage();
  let nx = h.x + (Math.random() < 0.5 ? -1 : 1) * RANGE * 0.6 * s;
  let ny = h.y + 8 * s;
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RANGE * s;
    const cx = Math.max(60, Math.min(innerWidth - 60, h.x + Math.cos(a) * r));
    const cy = Math.max(120, Math.min(innerHeight - 40, h.y + Math.sin(a) * r * 0.6));
    if (forbidden(cx, cy)) continue;
    nx = cx;
    ny = cy;
    break;
  }
  queue = [];
  const crosses = (nx - h.x) * (x - h.x) < 0 && (ny < h.y + 6 * s || y < h.y + 6 * s);
  const mid = forbidden((nx + x) / 2, (ny + y) / 2);
  if (crosses || mid) queue.push({ x: h.x, y: h.y + 14 * s }); // round the foot of the post
  queue.push({ x: nx, y: ny });
  nextLeg();
}
function nextLeg() {
  const p = queue.shift();
  if (!p) return;
  tx = p.x;
  ty = p.y;
  legStart = performance.now();
}

/** Level 3 began: he walks in from the nearest edge to the signpost. */
export function healerArrive() {
  if (state === "arriving" || state === "pacing") return;
  const h = home();
  const s = stage();
  const edges = [
    { x: -EDGE_IN * s, y: h.y + 6 * s, d: h.x },
    { x: innerWidth + EDGE_IN * s, y: h.y + 6 * s, d: innerWidth - h.x },
    { x: h.x, y: innerHeight + EDGE_IN * s, d: innerHeight - h.y },
  ].sort((a, b) => a.d - b.d);
  x = edges[0].x;
  y = edges[0].y;
  queue = [];
  tx = h.x + (x < h.x ? -1 : 1) * RANGE * 0.5 * s;
  ty = h.y + 6 * s;
  legStart = performance.now();
  state = "arriving";
  const e = ensure();
  e.style.display = "";
  if (!raf) {
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }
}
/** The game was reset: he walks off the way he came. */
export function healerDepart() {
  if (state === "away" || state === "leaving") return;
  const s = stage();
  const edges = [
    { x: -EDGE_IN * s, y, d: x },
    { x: innerWidth + EDGE_IN * s, y, d: innerWidth - x },
    { x, y: innerHeight + EDGE_IN * s, d: innerHeight - y },
  ].sort((a, b) => a.d - b.d);
  queue = [];
  tx = edges[0].x;
  ty = edges[0].y;
  legStart = performance.now();
  state = "leaving";
}
export function healerPresent() {
  return state === "arriving" || state === "pacing";
}
/** Is the point on him (while he is about)? */
export function onHealer(px: number, py: number): boolean {
  if (!el || state === "away") return false;
  const r = el.getBoundingClientRect();
  return px >= r.left - 10 && px <= r.right + 10 && py >= r.top - 10 && py <= r.bottom + 10;
}
/** A living phone tapped with its cursor on him: "thou art in good health" (rate limited). */
export function healerTap(phoneId: string): boolean {
  const c = getCursor(phoneId);
  if (!c || isGhost(phoneId) || !onHealer(c.x, c.y)) return false;
  const now = Date.now();
  if (now - (lastWell.get(phoneId) ?? 0) < WELL_MS) return true;
  lastWell.set(phoneId, now);
  hooks.send({ type: "healer", to: phoneId, state: "well" });
  return true;
}

function step(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const s = stage();
  const e = ensure();
  const moving = state !== "pacing" || now >= pauseUntil;
  if (moving) {
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy);
    // Soft: ramps up over RAMP_MS, slows over the last EASE_R px, a little brisker in and out.
    const ramp = Math.min(1, 0.25 + (now - legStart) / RAMP_MS);
    const ease = state === "pacing" ? Math.max(0.2, Math.min(1, d / (EASE_R * s))) : 1;
    const v = WALK * s * (state === "pacing" ? 1 : ENTER_MUL) * ramp * ease;
    const hop = v * dt;
    if (d <= hop || d < 0.5) {
      x = tx;
      y = ty;
      if (queue.length) {
        nextLeg(); // the detour's second leg: no pause at the corner
      } else {
        if (state === "arriving") state = "pacing";
        if (state === "leaving") {
          state = "away";
          e.style.display = "none";
          return;
        }
        pauseUntil = now + rand(PAUSE_MS[0], PAUSE_MS[1]);
        waypoint();
      }
    } else {
      x += (dx / d) * hop;
      y += (dy / d) * hop;
      if (Math.abs(dx) > 1) facingRight = dx > 0;
    }
  }
  // His one job: a ghost that drifts into him is restored.
  if (state === "pacing" || state === "arriving") {
    for (const id of ghostIds()) {
      const c = allCursors().get(id);
      if (c && Math.hypot(c.x + 3 * s - x, c.y + 2 * s - y) <= HEAL_R * s) revive(id, "healer");
    }
  }
  const walking = moving && (state === "arriving" || state === "leaving" || (state === "pacing" && Math.hypot(tx - x, ty - y) > 1));
  const bob = walking ? Math.sin(now / 170) * 1.2 * s : 0;
  e.style.transform = `translate(${x - (W * s) / 2}px, ${y - H * s + bob}px)`;
  e.classList.toggle("flip", !facingRight);
  e.classList.toggle("walking", walking);
  if (state !== "away") raf = requestAnimationFrame(step);
}

/** Before initLevels: it dispatches level-changed at startup when the level is saved. */
export function initHealer(h: Hooks) {
  hooks = h;
  document.addEventListener("level-changed", (e) => {
    const level = (e as CustomEvent<{ level: number }>).detail.level;
    if (level >= 3) healerArrive();
    else healerDepart();
  });
}
