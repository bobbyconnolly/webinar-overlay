// Level 3: the horde. Once every spell is mastered the ankh becomes the key to
// the moongate: it and the gate's runes pulse together in cold blue. Phones
// carry the ankh (hold, swipe, lift) or the Seer drags it; when its centre
// comes within reach of the gate it snaps onto it and locks there. The usual
// ankh ritual on the gate (the quorum, taps and wiggles) then tears the gate
// open: the blessing happens as always, the stage goes dark, and for WAVE_MS
// monsters step out of the gate. Skeletons are raiders: they meander to the
// backpack, take a reagent and carry it back to the gate (through the gate, the
// reagent is scattered far away), and chase a cursor that strays within reach
// for a few seconds. Ghouls are hunters: they roam and chase the nearest cursor
// in sight. A cursor caught by either is a ghost for a while (ghosts.ts). From
// wave DAEMON_FROM_WAVE a daemon steps out mid-wave, lurks near the gate and
// lobs slow fireballs at the nearest living cursor. Magic Arrow slays them (a
// skeleton takes one arrow, a ghoul two, a daemon three), Create Food's Ginger
// charms every monster near him into fleeing back through the gate (not the
// daemon) and hunts after his meal, Lightning stuns them all and the overloaded
// gate spawns nothing, Teleport pulls the ones near the caster onto the gate
// and banishes them, Ginger's ultimate turns them all to ash. Night Sight in the
// dark lifts it for a minute. At the end the survivors retreat, the top slayer
// is blessed, and the ankh is flung off the gate to a free spot, so the group
// can carry it back for the next wave (a little bigger, a little faster).
// Nobody but the group decides when a wave comes (Bobby: "I'm a seer, not a god").
import { allCursors, cursorCount } from "./cursors";
import { burstAt, freeSpot, gateCentre, gateSpot, gateVicinity, isGateOverloaded, setGateSealed, type Point } from "./moongate";
import { addCharges, packCentre, stealReagent, type Loot } from "./quest";
import { catPos, setHordeHooks } from "./cat";
import { labelFor } from "./identity";
import { bless } from "./sparkles";
import { stage } from "./stage";
import { setSiegeDark } from "./sky";
import { scareBirds } from "./signpost";
import { spawnBats } from "./bats";
import { releaseWidget, saveWidgetPos } from "./widgets";
import { showBanner } from "./levels";
import { ghostCursor, isGhost } from "./ghosts";
import { sfx } from "./sounds";

// ---- knobs (px and px/s at stage 1) ----
const WAVE_MS = 60_000; // Bobby: a minute
const SPAWN_WINDOW_MS = 42_000; // the last monster steps out by then
const FIRST_SPAWN_MS = 1500;
const BASE_COUNT = 6; // monsters per wave: BASE + PER_PHONE × phones + PER_WAVE × (wave − 1), at most MAX
const PER_PHONE = 2;
const PER_WAVE = 3;
const MAX_COUNT = 30;
const GHOUL_SHARE = 0.3; // + GHOUL_PER_WAVE per wave, at most GHOUL_MAX
const GHOUL_PER_WAVE = 0.1;
const GHOUL_MAX = 0.6;
const SPEED: Record<Kind, number> = { skeleton: 62, ghoul: 44, daemon: 30 };
const CHASE_MUL: Record<Kind, number> = { skeleton: 1.15, ghoul: 1.25, daemon: 1 };
const SPEED_PER_WAVE = 0.1; // each wave is this much faster
const FLEE_MUL = 1.7; // charmed or retreating: back to the gate at this speed
const HP: Record<Kind, number> = { skeleton: 1, ghoul: 2, daemon: 3 };
const MON_W = 64; // css box at stage 1 (matches .monster)
const MON_H = 84;
const DAEMON_SCALE = 1.4; // the daemon's box (matches .monster.daemon)
const MON_R = 24; // an arrow this close to the centre hits
const ARRIVE = 34; // this close to the pack centre = at the pack
const ARRIVE_GATE = 26;
const LOITER_R = 70; // nothing to steal: mill about this close to the pack
const LOVE_R = 140; // Ginger charms monsters this close to him (never the daemon)
const SIGHT: Record<Kind, number> = { skeleton: 150, ghoul: 360, daemon: 0 }; // a living cursor this close is chased
const CHASE_MS: Record<Kind, number> = { skeleton: 5000, ghoul: 9000, daemon: 0 }; // then back to its business
const LOSE_R = 480; // a chased cursor this far away is given up
const CATCH_R = 22; // a cursor's tip this close to a monster is caught (a ghost)
const GLOAT_MS = 700; // a monster stands over its catch this long
const DRIFT = 110; // raiders meander: the next waypoint is the pack plus this much jitter
const DAEMON_FROM_WAVE = 2;
const DAEMON_AT = 0.4; // of the spawn window
const DAEMON_LURK_R = 220; // it roams this close to the gate
const DAEMON_SHOT_MS = 3000;
const FIREBALL_SPEED = 200; // dodgeable (Bobby 2026-10-02: 100 was too slow)
const FIREBALL_RANGE = 900;
const FIREBALL_R = 26; // hits a tip this close
const SNAP = 0.75; // the ankh snaps onto the gate within this fraction of the gate's reach
const RETREAT_MS = 2600; // after the wave: the ankh is flung off the gate
const BOARD_HIDE_MS = 4000;
const ULT_MS = 3000; // Ginger's ultimate: three beams sweep a full turn in this long
const ULT_TOL = 9; // degrees: a monster this close to a beam's angle is caught
const STORAGE_KEY = "overlay.horde.v1";

type Kind = "skeleton" | "ghoul" | "daemon";
type State = "walk" | "wander" | "chase" | "lurk" | "loiter" | "return" | "flee" | "gathered" | "dead";
type Mon = {
  el: HTMLElement;
  kind: Kind;
  hp: number;
  x: number; // centre, screen px
  y: number;
  speed: number;
  state: State;
  loot: Loot | null;
  stunnedUntil: number;
  pauseUntil: number; // gloating over a catch, or resting at a waypoint
  facing: 1 | -1;
  bob: number;
  tgt: Point; // waypoint
  retarget: number;
  chaseId: string | null;
  chaseUntil: number;
  shotAt: number; // daemon: last fireball
  creditTo: string | null; // who gets the credit when it flees or is banished
};
type Fireball = { el: HTMLElement; x: number; y: number; dx: number; dy: number; left: number };
type Hooks = { send: (msg: object) => void; announce: (text: string, color: string) => void };

const SVG: Record<Kind, string> = {
  skeleton: `<svg viewBox="0 0 60 80" aria-hidden="true">
  <g class="body" fill="#e9e3d2" stroke="#3b3326" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <g class="leg leg-l"><path d="M24 50 L20 64 L18 76 L11 78" fill="none"/></g>
    <g class="leg leg-r"><path d="M36 50 L40 64 L42 76 L49 78" fill="none"/></g>
    <path d="M30 26 V48" fill="none"/>
    <path d="M22 46 Q30 54 38 46" fill="none"/>
    <path d="M30 30 Q20 32 20 38 M30 30 Q40 32 40 38 M30 36 Q22 38 22 43 M30 36 Q38 38 38 43 M19 28 H41" fill="none"/>
    <g class="arm arm-l"><path d="M20 29 L12 42 L10 54" fill="none"/></g>
    <g class="arm arm-r"><path d="M40 29 L48 42 L52 52" fill="none"/></g>
    <path d="M30 4 C19 4 16 12 17 19 C18 24 22 26 24 27 L24 30 H36 L36 27 C38 26 42 24 43 19 C44 12 41 4 30 4 Z"/>
    <path d="M26 27 V30 M30 27 V30 M34 27 V30" fill="none" stroke-width="1.5"/>
    <ellipse cx="24.5" cy="16" rx="3.6" ry="4" fill="#1a1410" stroke="none"/>
    <ellipse cx="35.5" cy="16" rx="3.6" ry="4" fill="#1a1410" stroke="none"/>
    <path d="M30 20 L28.5 23.5 H31.5 Z" fill="#1a1410" stroke="none"/>
  </g>
  <g class="eyes"><circle cx="24.5" cy="16.5" r="1.7" fill="#ff3b3b"/><circle cx="35.5" cy="16.5" r="1.7" fill="#ff3b3b"/></g>
</svg>`,
  ghoul: `<svg viewBox="0 0 60 80" aria-hidden="true">
  <g class="body" fill="#7d9a6a" stroke="#223020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <g class="leg leg-l"><path d="M24 56 L19 68 L16 78 L10 78" fill="none" stroke-width="5"/></g>
    <g class="leg leg-r"><path d="M36 56 L40 68 L43 78 L50 78" fill="none" stroke-width="5"/></g>
    <path d="M16 36 C14 22 24 16 34 18 C46 20 48 34 44 48 C42 56 36 60 28 58 C18 56 17 46 16 36 Z"/>
    <g class="arm arm-l"><path d="M18 34 L8 52 L9 66" fill="none" stroke-width="5"/><path d="M9 66 L5 72 M9 66 L10 73 M9 66 L13 71" fill="none"/></g>
    <g class="arm arm-r"><path d="M44 34 L52 50 L50 64" fill="none" stroke-width="5"/><path d="M50 64 L46 70 M50 64 L52 71 M50 64 L55 69" fill="none"/></g>
    <path d="M20 22 C18 10 28 4 36 6 C46 8 48 20 42 28 C38 32 24 32 20 22 Z"/>
    <path d="M26 27 L30 25 L34 27 L38 25" fill="none" stroke-width="1.6"/>
    <path d="M28 18 L26 21 M38 17 L36 20" fill="none" stroke-width="1.5"/>
  </g>
  <g class="eyes"><ellipse cx="27" cy="16" rx="2.2" ry="1.6" fill="#d8ff5a"/><ellipse cx="37" cy="15" rx="2.2" ry="1.6" fill="#d8ff5a"/></g>
</svg>`,
  daemon: `<svg viewBox="0 0 60 80" aria-hidden="true">
  <g class="body" fill="#7a1b1b" stroke="#2a0808" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path class="wing wl" d="M19 30 C6 16 1 30 3 46 C8 38 12 40 14 50 C16 42 20 40 23 46 Z" fill="#4a0f0f"/>
    <path class="wing wr" d="M41 30 C54 16 59 30 57 46 C52 38 48 40 46 50 C44 42 40 40 37 46 Z" fill="#4a0f0f"/>
    <g class="leg leg-l"><path d="M24 56 L20 68 L17 78 L10 78" fill="none" stroke-width="5"/></g>
    <g class="leg leg-r"><path d="M36 56 L40 68 L43 78 L50 78" fill="none" stroke-width="5"/></g>
    <path d="M20 30 C18 18 42 18 40 30 C42 44 40 56 30 58 C20 56 18 44 20 30 Z"/>
    <g class="arm arm-l"><path d="M20 32 L10 44 L12 56" fill="none" stroke-width="5"/></g>
    <g class="arm arm-r"><path d="M40 32 L50 44 L48 56" fill="none" stroke-width="5"/></g>
    <path d="M30 58 C34 66 44 64 48 72 L52 70" fill="none" stroke-width="3"/>
    <path d="M22 20 C20 8 40 8 38 20 C36 26 24 26 22 20 Z"/>
    <path d="M23 12 L17 2 L26 9 Z M37 12 L43 2 L34 9 Z" fill="#2a0808"/>
    <path d="M25 22 L30 20 L35 22" fill="none" stroke-width="1.5"/>
  </g>
  <g class="eyes"><ellipse cx="26" cy="16" rx="2.2" ry="1.5" fill="#ffd23f"/><ellipse cx="34" cy="16" rx="2.2" ry="1.5" fill="#ffd23f"/></g>
</svg>`,
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const fx = $("#fx");
const ultLayer = $("#ult");
const frame = $("[data-widget=image]"); // the ankh
const ankhImg = frame.querySelector<HTMLElement>("img")!;
const wrap = $("[data-widget=moongate]");
const board = $("#horde-board");
const list = $("#horde-list");
const bar = $("#horde-bar");

let hooks: Hooks;
let keyed = false; // level 3: the ankh is the key
let placed = false; // the ankh rests on the gate
let active = false; // a wave runs
let wave = 0; // waves fought (persisted)
let lost = 0; // reagents carried off (persisted)
let lostThisWave = 0;
let endAt = 0;
let spawnEndAt = 0;
let nextSpawnAt = 0;
let interval = 0;
let budget = 0;
let spawned = 0;
let daemonAt = 0; // when this wave's daemon steps out (0: none)
let monsters: Mon[] = [];
let fireballs: Fireball[] = [];
const waveKills = new Map<string, number>();
let charmer: string | null = null; // who cast Create Food last: Ginger's rout is theirs
let ult: { x: number; y: number; start: number; caster: string | null; zapped: Set<Mon>; el: HTMLElement } | null = null;
let raf = 0;
let lastT = 0;
let bootUntil = 0; // a re-lock right after a reload is silent
let hideTimer = 0;
let flingTimer = 0;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** Alive and hostile (not fleeing, gathered or dead). */
const threat = (m: Mon) => m.state === "walk" || m.state === "wander" || m.state === "chase" || m.state === "lurk" || m.state === "loiter" || m.state === "return";
const tipOf = (c: { x: number; y: number }) => ({ x: c.x + 3 * stage(), y: c.y + 2 * stage() });
const scaleOf = (m: Mon) => (m.kind === "daemon" ? DAEMON_SCALE : 1);

// ---------- persistence ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wave, lost }));
  } catch {
    /* fine */
  }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (s) {
      wave = Number(s.wave) || 0;
      lost = Number(s.lost) || 0;
    }
  } catch {
    /* fine */
  }
}

// ---------- state for the others ----------
/** Waves fought so far (the running one included). */
export function waveCount() {
  return wave;
}
export function waveActive() {
  return active;
}
/** The ankh rests on the gate and no wave runs: the ritual there opens the gate. */
export function ankhPlaced() {
  return placed && !active;
}
/** While the ankh rests on the gate, taps on the gate charge the ankh instead of teleporting. */
export function gateSealed() {
  return placed && !active;
}
/** What a joining phone should hear about level 3, or null when there is nothing to say. */
export function hordeState(to: string): object | null {
  if (active) return { type: "horde", to, state: "wave", wave, count: budget };
  if (placed) return { type: "horde", to, state: "placed" };
  if (keyed) return { type: "horde", to, state: "key" };
  return null;
}
/** Create Food: Ginger's charm is credited to whoever fed him last. */
export function charmBy(caster: string) {
  charmer = caster;
}

// ---------- the ankh as the key ----------
function ankhCentre(): Point {
  const r = ankhImg.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function setKeyed(on: boolean) {
  keyed = on;
  if (!on) {
    // A reset: the wave stops, the ankh leaves the gate like after a wave, the history is wiped.
    abort();
    releaseAnkh();
    wave = 0;
    lost = 0;
    save();
  }
  frame.classList.toggle("keyed", on && !placed);
  wrap.classList.toggle("keyed", on && !placed);
  ensureLoop();
}
/** Move the ankh so its art is centred on the gate (left/top are unscaled anchors; a delta moves the rect by the same delta). */
function centreAnkh() {
  const g = gateCentre();
  const a = ankhCentre();
  const dx = g.x - a.x;
  const dy = g.y - a.y;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  frame.style.left = `${parseFloat(frame.style.left) + dx}px`;
  frame.style.top = `${parseFloat(frame.style.top) + dy}px`;
}
/** Snap the ankh onto the gate and lock it there (nobody carries or drags it until the wave is over). */
function placeAnkh(quiet = false) {
  if (placed) return;
  placed = true;
  for (const id of releaseWidget(frame)) {
    // Out of that phone's hands: tell it, or its pad keeps showing the ankh as carried.
    hooks.send({ type: "drop", to: id, kind: "widget", name: "ankh", collected: false, slipped: false, placed: true });
  }
  frame.dataset.fixed = "";
  frame.classList.add("on-gate");
  frame.classList.remove("keyed");
  wrap.classList.remove("keyed");
  wrap.classList.add("sealed");
  centreAnkh();
  saveWidgetPos(frame);
  setGateSealed(true);
  if (!quiet) {
    const g = gateCentre();
    burstAt(g.x, g.y);
    hooks.send({ type: "horde", state: "placed" });
  }
}
function unlockAnkh() {
  if (!placed) return;
  placed = false;
  delete frame.dataset.fixed;
  frame.classList.remove("on-gate", "dark");
  wrap.classList.remove("sealed", "horde");
  setGateSealed(false);
}
/** After a wave: the ankh is thrown off the gate to a free spot, gold again, and yearns anew. */
function releaseAnkh() {
  if (!placed) return;
  const g = gateCentre();
  unlockAnkh();
  burstAt(g.x, g.y);
  const p = freeSpot();
  const a = ankhCentre();
  frame.style.left = `${parseFloat(frame.style.left) + (p.x - a.x)}px`;
  frame.style.top = `${parseFloat(frame.style.top) + (p.y - a.y)}px`;
  burstAt(p.x, p.y);
  saveWidgetPos(frame);
  frame.classList.toggle("keyed", keyed);
  wrap.classList.toggle("keyed", keyed);
}

// ---------- the wave ----------
/** The ritual on the gate completed (ankh.ts), or devtools: the gate tears open. */
export function startWave() {
  if (active) return;
  active = true;
  wave++;
  lostThisWave = 0;
  waveKills.clear();
  window.clearTimeout(flingTimer);
  window.clearTimeout(hideTimer);
  const now = performance.now();
  budget = Math.min(MAX_COUNT, BASE_COUNT + PER_PHONE * cursorCount() + PER_WAVE * (wave - 1));
  spawned = 0;
  endAt = now + WAVE_MS;
  spawnEndAt = now + SPAWN_WINDOW_MS;
  nextSpawnAt = now + FIRST_SPAWN_MS;
  interval = (SPAWN_WINDOW_MS - FIRST_SPAWN_MS) / budget;
  daemonAt = wave >= DAEMON_FROM_WAVE ? now + SPAWN_WINDOW_MS * DAEMON_AT : 0;
  setGateSealed(false);
  wrap.classList.remove("sealed", "keyed");
  wrap.classList.add("horde");
  frame.classList.remove("keyed");
  if (placed) frame.classList.add("dark");
  setSiegeDark(true);
  scareBirds();
  spawnBats();
  hooks.send({ type: "horde", state: "wave", wave, count: budget });
  window.setTimeout(() => hooks.announce("☠ The Horde Comes ☠", "#b8f0a0"), 1200);
  board.classList.add("show");
  save();
  renderBoard();
  ensureLoop();
}

function endWave(vanquished: boolean) {
  if (!active) return;
  active = false;
  daemonAt = 0;
  for (const m of monsters) if (threat(m) || m.state === "gathered") retreat(m);
  setSiegeDark(false);
  frame.classList.remove("dark");
  wrap.classList.remove("horde");
  const t = standings(waveKills).filter((e) => e.id !== "mouse"); // the Seer does not compete
  const top = t[0]?.count ?? 0;
  const winners = t.filter((e) => e.count === top && top > 0);
  for (const w of winners) if (allCursors().has(w.id)) bless(w.id);
  const names = winners.map((w) => w.name);
  let sub = names.length ? `${names.join(" & ")} slew the most · ${top}` : "nobody slew anything";
  if (lostThisWave) sub += ` · ${lostThisWave} reagent${lostThisWave === 1 ? "" : "s"} carried off`;
  if (wave > 1) sub += ` · ${wave} waves fought, ${lost} reagent${lost === 1 ? "" : "s"} lost in all`; // the old goals-card tally
  showBanner(vanquished ? "The horde is vanquished" : "The horde retreats", sub);
  hooks.send({ type: "horde", state: "end", wave, vanquished, winners: names, top, lost: lostThisWave });
  save();
  renderBoard();
  flingTimer = window.setTimeout(releaseAnkh, RETREAT_MS);
  hideTimer = window.setTimeout(() => board.classList.remove("show"), BOARD_HIDE_MS);
}
/** Reset, or the level went away: everything vanishes at once, no banner, the ankh just unlocks where it is. */
function abort() {
  active = false;
  daemonAt = 0;
  for (const m of monsters) {
    m.loot?.drop();
    m.el.remove();
  }
  monsters = [];
  for (const f of fireballs) f.el.remove();
  fireballs = [];
  waveKills.clear();
  setSiegeDark(false);
  frame.classList.remove("dark");
  wrap.classList.remove("horde");
  board.classList.remove("show");
  window.clearTimeout(flingTimer);
  renderBoard();
}

function spawn(kind?: Kind): Mon {
  const s = stage();
  const k: Kind = kind ?? (Math.random() < Math.min(GHOUL_MAX, GHOUL_SHARE + GHOUL_PER_WAVE * (wave - 1)) ? "ghoul" : "skeleton");
  sfx("monster", { cooldownMs: 600 });
  const p = gateSpot([]);
  const el = document.createElement("div");
  el.className = `monster ${k} born walking`;
  el.innerHTML = `<div class="art">${SVG[k]}</div><span class="stars">✦ ✦ ✦</span>`;
  fx.appendChild(el);
  window.setTimeout(() => el.classList.remove("born"), 600);
  const m: Mon = {
    el,
    kind: k,
    hp: HP[k],
    x: p.x,
    y: p.y,
    speed: SPEED[k] * (1 + SPEED_PER_WAVE * Math.max(0, wave - 1)) * rand(0.9, 1.1),
    state: k === "skeleton" ? "walk" : k === "ghoul" ? "wander" : "lurk",
    loot: null,
    stunnedUntil: 0,
    pauseUntil: 0,
    facing: 1,
    bob: Math.random() * Math.PI * 2,
    tgt: p,
    retarget: 0,
    chaseId: null,
    chaseUntil: 0,
    shotAt: performance.now(),
    creditTo: null,
  };
  monsters.push(m);
  if (k !== "daemon") spawned++;
  burstAt(p.x, p.y);
  render(m, performance.now(), s);
  renderBoard();
  return m;
}

// ---------- the monster brain ----------
/** The living cursor nearest to `m` within `r`, if any. */
function nearestLiving(m: Mon, r: number): { id: string; d: number; tip: Point } | null {
  let best: { id: string; d: number; tip: Point } | null = null;
  for (const [id, c] of allCursors()) {
    if (isGhost(id)) continue;
    const t = tipOf(c);
    const d = dist(m, t);
    if (d <= r && (!best || d < best.d)) best = { id, d, tip: t };
  }
  return best;
}
function packSpot(): Point {
  return packCentre() ?? { x: innerWidth / 2, y: innerHeight / 2 };
}
/** Raiders meander: the next waypoint is on the way to the pack, with some sideways wander. */
function raiderWaypoint(m: Mon, s: number) {
  const pc = packSpot();
  if (dist(m, pc) < 200 * s) return pc;
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * DRIFT * s;
  const k = rand(0.35, 0.7); // partway there
  return { x: m.x + (pc.x - m.x) * k + Math.cos(a) * r, y: m.y + (pc.y - m.y) * k + Math.sin(a) * r };
}
function anywhere(): Point {
  return { x: rand(80, innerWidth - 80), y: rand(120, innerHeight - 80) };
}
function lurkWaypoint(s: number): Point {
  const g = gateCentre();
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * DAEMON_LURK_R * s;
  return { x: Math.max(80, Math.min(innerWidth - 80, g.x + Math.cos(a) * r)), y: Math.max(120, Math.min(innerHeight - 80, g.y + Math.sin(a) * r)) };
}
function target(m: Mon): Point {
  switch (m.state) {
    case "walk":
    case "wander":
    case "lurk":
    case "loiter":
      return m.tgt;
    case "chase": {
      const c = m.chaseId ? allCursors().get(m.chaseId) : undefined;
      return c ? tipOf(c) : m.tgt;
    }
    default:
      return gateCentre();
  }
}
function startChase(m: Mon, id: string, now: number) {
  m.state = "chase";
  m.chaseId = id;
  m.chaseUntil = now + CHASE_MS[m.kind];
}
/** Back to its business after a chase: raiders to the pack, hunters to roaming. */
function endChase(m: Mon, s: number) {
  m.chaseId = null;
  m.state = m.kind === "skeleton" ? "walk" : "wander";
  m.tgt = m.kind === "skeleton" ? raiderWaypoint(m, s) : anywhere();
  m.retarget = performance.now() + rand(1200, 2500);
}
function stepMonster(m: Mon, dt: number, now: number, s: number) {
  if (m.state === "dead" || m.state === "gathered") return;
  // Ginger: a monster near him forgets everything and runs for the gate (once it can move). Not the daemon.
  const cat = catPos();
  if (cat && m.kind !== "daemon" && threat(m) && dist(m, cat) < LOVE_R * s) smitten(m);
  const stunned = now < m.stunnedUntil;
  m.el.classList.toggle("stunned", stunned);
  m.el.classList.toggle("walking", !stunned && now >= m.pauseUntil);
  if (stunned || now < m.pauseUntil) return;

  // Eyes open: a living cursor within sight is chased (not while laden, fleeing or lurking).
  if ((m.state === "walk" || m.state === "wander" || m.state === "loiter") && SIGHT[m.kind] > 0) {
    const seen = nearestLiving(m, SIGHT[m.kind] * s);
    if (seen) startChase(m, seen.id, now);
  }
  if (m.state === "chase") {
    const c = m.chaseId ? allCursors().get(m.chaseId) : undefined;
    if (!c || isGhost(m.chaseId!) || now >= m.chaseUntil || dist(m, tipOf(c)) > LOSE_R * s) endChase(m, s);
  }
  // Teeth: a living cursor's tip against a monster is caught.
  if (m.state === "walk" || m.state === "wander" || m.state === "chase" || m.state === "loiter") {
    const bite = nearestLiving(m, CATCH_R * s + 6);
    if (bite && ghostCursor(bite.id, m.kind)) {
      m.pauseUntil = now + GLOAT_MS;
      m.el.classList.remove("gloat");
      void m.el.offsetWidth;
      m.el.classList.add("gloat");
      if (m.state === "chase") endChase(m, s);
      return;
    }
  }
  // The daemon lobs a fireball at the nearest living cursor now and then.
  if (m.kind === "daemon" && m.state === "lurk" && now - m.shotAt >= DAEMON_SHOT_MS) {
    const prey = nearestLiving(m, FIREBALL_RANGE * s);
    if (prey) {
      m.shotAt = now;
      fireball(m, prey.tip, s);
      m.facing = prey.tip.x > m.x ? 1 : -1;
    }
  }
  // Waypoints for the roamers.
  if ((m.state === "wander" || m.state === "lurk" || m.state === "walk") && now >= m.retarget) {
    m.tgt = m.state === "lurk" ? lurkWaypoint(s) : m.state === "wander" ? anywhere() : raiderWaypoint(m, s);
    m.retarget = now + rand(1200, 2800);
  }
  if (m.state === "loiter" && now >= m.retarget) {
    const pc = packSpot();
    const a = Math.random() * Math.PI * 2;
    const r = rand(0.3, 1) * LOITER_R * s;
    m.tgt = { x: pc.x + Math.cos(a) * r, y: pc.y + Math.sin(a) * r };
    m.retarget = now + rand(900, 2200);
    // The bag may have been refilled meanwhile: try again.
    if (dist(m, pc) < LOITER_R * s) m.state = "walk";
  }
  const t = target(m);
  const dx = t.x - m.x;
  const dy = t.y - m.y;
  const d = Math.hypot(dx, dy);
  const mul = m.state === "flee" ? FLEE_MUL : m.state === "chase" ? CHASE_MUL[m.kind] : 1;
  const step = m.speed * s * mul * dt;
  const near = m.state === "walk" && dist(m, packSpot()) < ARRIVE * s;
  const atGate = (m.state === "return" || m.state === "flee") && d < ARRIVE_GATE * s;
  if (near || atGate || d <= step) {
    arrived(m, now, s);
    return;
  }
  m.x += (dx / d) * step;
  m.y += (dy / d) * step;
  if (Math.abs(dx) > 2) m.facing = dx > 0 ? 1 : -1;
  if (m.loot) m.loot.carry({ x: m.x + m.facing * 18 * s, y: m.y + 14 * s });
}
function arrived(m: Mon, now: number, s: number) {
  switch (m.state) {
    case "walk": {
      if (dist(m, packSpot()) > ARRIVE * s) {
        // Only a waypoint on the way: the next one.
        m.tgt = raiderWaypoint(m, s);
        m.retarget = now + rand(1200, 2800);
        break;
      }
      const loot = stealReagent(m.x, m.y);
      if (loot) {
        m.loot = loot;
        m.state = "return";
        m.el.classList.add("laden");
        hooks.send({ type: "horde", state: "stolen", kind: m.kind, name: loot.name });
      } else {
        m.state = "loiter";
        m.retarget = 0;
      }
      break;
    }
    case "wander":
    case "lurk":
      m.pauseUntil = now + rand(300, 1200);
      m.retarget = 0;
      break;
    case "loiter":
      m.retarget = 0;
      break;
    case "chase":
      break; // it is on the cursor: the bite above does the rest
    case "return": {
      // Through the gate with the loot: the reagent lands somewhere far off.
      const p = m.loot?.escape();
      if (p) burstAt(p.x, p.y);
      lost++;
      lostThisWave++;
      hooks.send({ type: "horde", state: "escaped", kind: m.kind, name: m.loot?.name ?? "a reagent" });
      m.loot = null;
      vanish(m);
      save();
      break;
    }
    case "flee":
      credit(m.creditTo, m, "charmed");
      vanish(m);
      break;
    default:
      break;
  }
}
function render(m: Mon, now: number, s: number) {
  const k = scaleOf(m);
  const moving = m.state !== "dead" && m.state !== "gathered" && now >= m.stunnedUntil && now >= m.pauseUntil;
  const bob = moving ? Math.sin(now / 110 + m.bob) * 3 * s : 0;
  m.el.style.transform = `translate(${m.x - (MON_W * s * k) / 2}px, ${m.y - (MON_H * s * k) / 2 + bob}px)`;
  m.el.classList.toggle("flip", m.facing === 1);
}
/** Gone through the gate (fled, escaped): a burst, no body left. */
function vanish(m: Mon) {
  burstAt(m.x, m.y);
  remove(m);
}
function remove(m: Mon) {
  m.el.remove();
  monsters = monsters.filter((x) => x !== m);
  renderBoard();
}
function smitten(m: Mon) {
  m.state = "flee";
  m.chaseId = null;
  m.creditTo = charmer;
  m.loot?.drop();
  m.loot = null;
  m.el.classList.remove("laden");
  m.el.classList.add("smitten");
  for (let i = 0; i < 3; i++) {
    const h = document.createElement("span");
    h.className = "heart";
    h.textContent = "♥";
    h.style.setProperty("--dx", `${rand(-22, 22)}px`);
    h.style.animationDelay = `${i * 0.18}s`;
    m.el.appendChild(h);
  }
}
function retreat(m: Mon) {
  m.state = "flee";
  m.chaseId = null;
  m.creditTo = null;
  m.loot?.drop();
  m.loot = null;
  m.el.classList.remove("laden", "gathered");
}
function credit(by: string | null, m: Mon, how: "arrow" | "charmed" | "banished" | "ashed") {
  if (!by) return;
  const n = (waveKills.get(by) ?? 0) + 1;
  waveKills.set(by, n);
  if (by !== "mouse") hooks.send({ type: "slay", to: by, kind: m.kind, how, count: n });
  renderBoard();
}

// ---------- the daemon's fireballs ----------
function fireball(m: Mon, at: Point, s: number) {
  sfx("fireball");
  const dx = at.x - m.x;
  const dy = at.y - m.y;
  const d = Math.hypot(dx, dy) || 1;
  const el = document.createElement("div");
  el.className = "fireball";
  fx.appendChild(el);
  const f: Fireball = { el, x: m.x + (dx / d) * 30 * s, y: m.y + (dy / d) * 10 * s, dx: dx / d, dy: dy / d, left: FIREBALL_RANGE * s };
  // The `translate` property, not `transform`: the flame pulse animates `scale`, and with an
  // inline transform the scale would multiply the translation too (the ball zigzagged).
  el.style.setProperty("translate", `${f.x}px ${f.y}px`);
  fireballs.push(f);
  m.el.classList.remove("hurl");
  void m.el.offsetWidth;
  m.el.classList.add("hurl");
}
function stepFireballs(dt: number, s: number) {
  if (!fireballs.length) return;
  const gone: Fireball[] = [];
  for (const f of fireballs) {
    const step = FIREBALL_SPEED * s * dt;
    f.x += f.dx * step;
    f.y += f.dy * step;
    f.left -= step;
    f.el.style.setProperty("translate", `${f.x}px ${f.y}px`);
    let hit = false;
    for (const [id, c] of allCursors()) {
      if (isGhost(id)) continue;
      if (dist(f, tipOf(c)) <= FIREBALL_R * s && ghostCursor(id, "fireball")) {
        hit = true;
        break;
      }
    }
    if (hit || f.left <= 0 || f.x < -60 || f.x > innerWidth + 60 || f.y < -60 || f.y > innerHeight + 60) {
      gone.push(f);
      if (hit) burstAt(f.x, f.y);
    }
  }
  for (const f of gone) {
    f.el.classList.add("out");
    window.setTimeout(() => f.el.remove(), 300);
  }
  fireballs = fireballs.filter((f) => !gone.includes(f));
}

// ---------- what the spells do to them ----------
function distToSegment(p: Point, a: Point, b: Point) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
/** Magic Arrow: every monster within `radius` of the segment takes `damage`; returns how many died. */
export function hitMonsters(from: Point, to: Point, radius: number, caster: string, damage = 1): number {
  let slain = 0;
  for (const m of [...monsters]) {
    if (m.state === "dead") continue;
    if (distToSegment(m, from, to) > radius + MON_R * scaleOf(m) * stage()) continue;
    m.hp -= damage;
    if (m.hp > 0) {
      m.el.classList.remove("hurt");
      void m.el.offsetWidth;
      m.el.classList.add("hurt");
      m.stunnedUntil = Math.max(m.stunnedUntil, performance.now() + 350); // staggers
      continue;
    }
    slain++;
    slay(m, caster);
  }
  return slain;
}
function slay(m: Mon, by: string) {
  m.state = "dead";
  sfx("slay", { cooldownMs: 120 });
  m.loot?.drop(); // falls where it stands, to be carried back
  m.loot = null;
  m.el.classList.remove("laden", "walking", "stunned", "gathered");
  m.el.classList.add("slain");
  burstAt(m.x, m.y);
  credit(by, m, "arrow");
  window.setTimeout(() => remove(m), 650);
}
/**
 * Ginger's ultimate (Bobby 2026-10-02): he sits at `centre`, everything but the horde,
 * him and three beams goes dark, the beams sweep a full turn in ULT_MS, every monster
 * they pass shakes and, when the sweep ends, turns into sulfurous ash: one charge into
 * the bag each, credited to whoever fed him. False if one is already running.
 */
function ultimate(centre: Point, caster: string | null): boolean {
  if (ult) return false;
  sfx("ult");
  const now = performance.now();
  for (const m of monsters) if (m.state !== "dead") m.stunnedUntil = Math.max(m.stunnedUntil, now + ULT_MS + 300);
  const el = document.createElement("div");
  el.className = "ult-beams";
  el.style.setProperty("--ms", `${ULT_MS}ms`);
  // The `translate` property, not `transform`: the spin is the animated `rotate` property,
  // and individual properties apply translate → rotate → transform, so a `transform:
  // translate()` would be rotated about the screen corner (seen: the beams orbited away).
  el.style.setProperty("translate", `${centre.x}px ${centre.y}px`);
  el.innerHTML = `<i></i><i></i><i></i>`;
  fx.appendChild(el);
  ultLayer.classList.add("on");
  document.body.classList.add("ult");
  ult = { x: centre.x, y: centre.y, start: now, caster, zapped: new Set(), el };
  hooks.send({ type: "ult", state: "ginger" });
  hooks.announce("✦ Ginger Unleashed ✦", "#ffb347");
  ensureLoop();
  return true;
}
/** Each frame of the ultimate: which monsters a beam is passing over right now. */
function sweepUlt(now: number) {
  if (!ult) return;
  const t = (now - ult.start) / ULT_MS;
  const base = t * 360;
  for (const m of monsters) {
    if (m.state === "dead" || ult.zapped.has(m)) continue;
    const bearing = ((Math.atan2(m.y - ult.y, m.x - ult.x) * 180) / Math.PI + 360) % 360;
    for (let k = 0; k < 3; k++) {
      const beam = (base + k * 120) % 360;
      let d = Math.abs(beam - bearing) % 360;
      if (d > 180) d = 360 - d;
      if (d < ULT_TOL) {
        ult.zapped.add(m);
        m.el.classList.add("zapped");
        break;
      }
    }
  }
  if (t >= 1) finishUlt();
}
function finishUlt() {
  if (!ult) return;
  const { zapped, caster, el } = ult;
  ult = null;
  for (const m of zapped) if (m.state !== "dead") ash(m, caster);
  el.classList.add("fade");
  window.setTimeout(() => el.remove(), 500);
  ultLayer.classList.remove("on");
  document.body.classList.remove("ult");
}
/** Turned to sulfurous ash: the monster crumbles grey and the bag gains a charge of ash. */
function ash(m: Mon, by: string | null) {
  m.state = "dead";
  sfx("slay", { cooldownMs: 120 });
  m.loot?.drop();
  m.loot = null;
  m.el.classList.remove("laden", "walking", "stunned", "zapped", "gathered");
  m.el.classList.add("ashed");
  addCharges("sulfurous-ash", 1, by);
  credit(by, m, "ashed");
  window.setTimeout(() => remove(m), 800);
}
/** Lightning: every monster freezes for `ms`. */
export function stunMonsters(ms: number) {
  const until = performance.now() + ms;
  for (const m of monsters) if (m.state !== "dead") m.stunnedUntil = Math.max(m.stunnedUntil, until);
}
/** Teleport: monsters `near` the caster are pulled onto the gate (spread out) and held there; `banishGathered` finishes it. */
export function gatherMonsters(near: (x: number, y: number) => boolean, placedSpots: Point[], caster: string): number {
  let n = 0;
  for (const m of monsters) {
    if (m.state === "dead" || m.state === "gathered" || !near(m.x, m.y)) continue;
    const p = gateSpot(placedSpots);
    burstAt(m.x, m.y);
    m.x = p.x;
    m.y = p.y;
    m.state = "gathered";
    m.chaseId = null;
    m.creditTo = caster;
    m.loot?.drop();
    m.loot = null;
    m.el.classList.remove("laden", "walking");
    m.el.classList.add("gathered");
    render(m, performance.now(), stage());
    burstAt(p.x, p.y);
    n++;
  }
  return n;
}
/** The gate fires: the gathered monsters go through it and do not come back. */
export function banishGathered() {
  for (const m of [...monsters]) {
    if (m.state !== "gathered") continue;
    credit(m.creditTo, m, "banished");
    m.state = "dead";
    m.el.classList.add("banished");
    burstAt(m.x, m.y);
    window.setTimeout(() => remove(m), 450);
  }
}

// ---------- the loop ----------
function ensureLoop() {
  if (raf || !(keyed || active || monsters.length || fireballs.length || ult)) return;
  if (!active && !keyed) renderBoard(); // a stray monster: the board stays hidden, the list just updates
  lastT = performance.now();
  raf = requestAnimationFrame(step);
}
function step(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const s = stage();
  sweepUlt(now);
  if (keyed && !placed && !active && dist(ankhCentre(), gateCentre()) < gateVicinity() * SNAP) placeAnkh(now < bootUntil);
  if (placed) centreAnkh(); // the Seer may drag the gate: the ankh stays on it
  if (active) {
    if (spawned < budget && now >= nextSpawnAt && now < spawnEndAt && !isGateOverloaded()) {
      spawn();
      nextSpawnAt = now + interval * rand(0.7, 1.3);
    }
    if (daemonAt && now >= daemonAt && !isGateOverloaded()) {
      daemonAt = 0;
      spawn("daemon");
      hooks.send({ type: "horde", state: "daemon" });
      hooks.announce("☠ A Daemon ☠", "#ff8c6b");
    }
    bar.style.width = `${Math.max(0, Math.min(100, ((endAt - now) / WAVE_MS) * 100))}%`;
    const noMore = (spawned >= budget || now >= spawnEndAt) && !daemonAt;
    if (now >= endAt) endWave(false);
    else if (noMore && !monsters.some((m) => threat(m) || m.state === "gathered")) endWave(true);
  }
  for (const m of monsters) {
    stepMonster(m, dt, now, s);
    render(m, now, s);
  }
  stepFireballs(dt, s);
  if (keyed || active || monsters.length || fireballs.length || ult) raf = requestAnimationFrame(step);
}

// ---------- the goals card and the board ----------
function standings(map: Map<string, number>) {
  return [...map]
    .map(([id, count]) => ({ id, count, ...labelFor(id) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
/** The board (the goals card is gone from level 2 on): this wave's slayers, what remains, and the stake so far. */
function renderBoard() {
  const t = standings(waveKills);
  const remain = monsters.filter((m) => threat(m) || m.state === "gathered").length + (active ? Math.max(0, budget - spawned) : 0);
  list.innerHTML =
    (t.length
      ? t.map((e) => `<li><span class="swatch" style="background:${e.color}"></span>${e.name} <b>${e.count}</b></li>`).join("")
      : `<li class="none">Magic Arrow slays them</li>`) +
    `<li class="left">${remain} remain · wave ${wave}</li>` +
    (lost ? `<li class="left">${lost} reagent${lost === 1 ? "" : "s"} carried off in all</li>` : "");
}

// ---------- devtools ----------
export function devSummonWave(): string {
  if (active) return "a wave is already running";
  startWave();
  return `wave ${wave}: ${budget} monsters over ${SPAWN_WINDOW_MS / 1000} s${daemonAt ? ", and a daemon" : ""}`;
}
export function devEndWave(): string {
  if (!active) return "no wave is running";
  endWave(false);
  return "the horde retreats";
}
/** One stray monster out of the gate, wave or not (for trying arrows and Ginger alone). */
export function devSpawnMonster(): string {
  const m = spawn();
  ensureLoop();
  return `a ${m.kind} steps out of the gate`;
}
export function devSpawnDaemon(): string {
  spawn("daemon");
  ensureLoop();
  return "a daemon steps out of the gate: it lobs fireballs at the nearest cursor";
}
export function devPlaceAnkh(): string {
  if (active) return "wait for the wave to end";
  if (placed) {
    releaseAnkh();
    return "ankh flung off the gate";
  }
  placeAnkh();
  return "ankh placed on the gate: awaken it to summon the horde";
}

export function initHorde(h: Hooks) {
  hooks = h;
  load();
  bootUntil = performance.now() + 800;
  // Ginger (cat.ts): where the monsters he can charm are, so he can hunt them after his meal, and the ultimate.
  setHordeHooks({
    threats: () => monsters.filter((m) => threat(m) && m.kind !== "daemon").map((m) => ({ x: m.x, y: m.y })),
    ultimate: (at) => ultimate(at, charmer),
  });
  // Before initLevels: it dispatches level-changed at startup when the level is saved.
  document.addEventListener("level-changed", (e) => setKeyed((e as CustomEvent<{ level: number }>).detail.level >= 3));
}
