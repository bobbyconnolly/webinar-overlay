// Trinkets (Bobby 2026-10-03: "uo allowed you to have knick-knacks that didn't do
// anything"): a ball of yarn, a feather, a bone, a tankard, a pine cone. They lie about
// from level 0 on, anyone can carry them (hold / swipe / lift, or the Seer's mouse), the
// moongate sends them through, lightning flings them, Ginger plays with them (the yarn
// is his favourite) and the birds steal them; they never count for anything and never
// go into the pack. No glitter rim on purpose: the rim means "this counts for the quest";
// a soft shadow makes them read as objects on the floor (Bobby left the glow to me).
//
// quest.ts delegates its loose-item API (looseReagents, batReagent, liftReagent,
// snatchReagent, carriedReagents) here for ids that start with "trinket:", so cat.ts
// and signpost.ts treat trinkets and reagents alike.
import { getCursor, onCursorFrame } from "./cursors";
import { freeSpot, gateTeleport, onGate, setGateSweeper, type Movable } from "./moongate";
import { stage } from "./stage";
import type { Loot } from "./quest";

export type TrinketDef = { id: string; name: string; file: string; src: string; fav?: boolean };
export const TRINKETS: TrinketDef[] = [
  { id: "trinket:yarn", name: "a ball of yarn", file: "yarn", src: "/trinkets/yarn.svg", fav: true },
  { id: "trinket:feather", name: "a feather", file: "feather", src: "/trinkets/feather.svg" },
  { id: "trinket:bone", name: "a bone", file: "bone", src: "/trinkets/bone.svg" },
  { id: "trinket:tankard", name: "a tankard", file: "tankard", src: "/trinkets/tankard.svg" },
  { id: "trinket:pinecone", name: "a pine cone", file: "pinecone", src: "/trinkets/pinecone.svg" },
];
const STORAGE_KEY = "overlay.trinkets.v1";
const ICON_BASE = 60; // css px at stage 1, same box as a reagent
const GRAB_PAD = 24; // hit tolerance, px (same as reagents)
const SPREAD_TRIES = 4; // scatter: best of a few free spots, farthest from the other trinkets

type Hooks = { isInteractive: () => boolean };
type T = { def: TrinketDef; el: HTMLElement; x: number; y: number; heldBy: string | null; movedAt: number };
type P = { x: number; y: number };
const layer = document.getElementById("trinkets")!;
const items = new Map<string, T>();
/** holder (phone id or "mouse") -> trinket id + grab offset from the cursor tip */
const held = new Map<string, { id: string; ox: number; oy: number }>();
let hooks: Hooks = { isInteractive: () => true };
const icon = () => ICON_BASE * stage();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function isTrinketId(id: string): boolean {
  return id.startsWith("trinket:");
}
function render(t: T) {
  t.el.style.transform = `translate(${t.x}px, ${t.y}px)`;
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries([...items].map(([id, t]) => [id, { x: t.x, y: t.y }]))));
  } catch {
    /* fine */
  }
}
function load(): Record<string, P> | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}
function centre(t: T): P {
  return { x: t.x + icon() / 2, y: t.y + icon() / 2 };
}
function hit(px: number, py: number): T | undefined {
  let best: T | undefined;
  for (const t of items.values()) {
    if (t.heldBy) continue;
    if (px >= t.x - GRAB_PAD && px <= t.x + icon() + GRAB_PAD && py >= t.y - GRAB_PAD && py <= t.y + icon() + GRAB_PAD) best = t;
  }
  return best;
}
/** A spot clear of the widgets and, as far as can be, of the other trinkets. */
function spreadSpot(): P {
  let best = freeSpot();
  let bestD = -1;
  for (let i = 0; i < SPREAD_TRIES; i++) {
    const p = freeSpot();
    const d = [...items.values()].reduce((m, o) => Math.min(m, Math.hypot(o.x + icon() / 2 - p.x, o.y + icon() / 2 - p.y)), Infinity);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
/** Callback that lands a loose trinket centred on a point (no-op if someone holds it). */
function mover(t: T) {
  return (p: P) => {
    if (t.heldBy) return;
    t.x = p.x - icon() / 2;
    t.y = p.y - icon() / 2;
    t.movedAt = Date.now();
    render(t);
    save();
  };
}

// ---------- the loose-item API quest.ts delegates to ----------
export function looseTrinkets(): { id: string; name: string; x: number; y: number; movedAt: number; fav?: boolean }[] {
  const out: { id: string; name: string; x: number; y: number; movedAt: number; fav?: boolean }[] = [];
  for (const t of items.values()) {
    if (t.heldBy) continue;
    const c = centre(t);
    out.push({ id: t.def.id, name: t.def.name, x: c.x, y: c.y, movedAt: t.movedAt, fav: t.def.fav });
  }
  return out;
}
export function carriedTrinkets(): { id: string; name: string; x: number; y: number; by: string }[] {
  const out: { id: string; name: string; x: number; y: number; by: string }[] = [];
  for (const [by, h] of held) {
    if (by === "mouse") continue;
    const t = items.get(h.id)!;
    const c = centre(t);
    out.push({ id: t.def.id, name: t.def.name, x: c.x, y: c.y, by });
  }
  return out;
}
/** Where a trinket is right now, held or loose (its centre); null if unknown. */
export function trinketPos(id: string): P | null {
  const t = items.get(id);
  return t ? centre(t) : null;
}
/** Who holds it: a phone id, "mouse", "bird", or null. */
export function trinketHolder(id: string): string | null {
  return items.get(id)?.heldBy ?? null;
}
/** cat.ts listens: a player (a phone, or the Seer's mouse) moved a trinket they carry by `d` px (the yarn game). */
type MovedFn = (e: { id: string; by: string; x: number; y: number; d: number }) => void;
const movedFns: MovedFn[] = [];
export function onTrinketMoved(fn: MovedFn) {
  movedFns.push(fn);
}
function moved(t: T, by: string, d: number) {
  if (d < 0.5) return;
  const c = centre(t);
  for (const fn of movedFns) fn({ id: t.def.id, by, x: c.x, y: c.y, d });
}
/** Ginger bats it: a slide to `to` (its centre, kept on screen) with a wobble. */
export function batTrinket(id: string, to: P): boolean {
  const t = items.get(id);
  if (!t || t.heldBy) return false;
  const half = icon() / 2;
  t.x = clamp(to.x - half, 8, innerWidth - icon() - 8);
  t.y = clamp(to.y - half, 60, innerHeight - icon() - 8);
  t.el.classList.add("batted");
  t.movedAt = Date.now();
  render(t);
  save();
  t.el.querySelector("img")?.animate([{ rotate: "0deg" }, { rotate: "-24deg" }, { rotate: "16deg" }, { rotate: "0deg" }], { duration: 650, easing: "ease-out" });
  window.setTimeout(() => t.el.classList.remove("batted"), 700);
  return true;
}
function lootHandle(t: T, by: string): Loot {
  t.heldBy = by;
  t.el.classList.add("lifted");
  const mine = () => t.heldBy === by;
  const free = () => {
    t.heldBy = null;
    t.el.classList.remove("lifted");
    t.movedAt = Date.now();
  };
  return {
    id: t.def.id,
    name: t.def.name,
    carry: (p) => {
      if (!mine()) return;
      t.x = p.x - icon() / 2;
      t.y = p.y - icon() / 2;
      render(t);
    },
    drop: () => {
      if (!mine()) return;
      free();
      render(t);
      save();
    },
    escape: () => {
      if (!mine()) return null;
      free();
      const p = spreadSpot();
      t.x = p.x - icon() / 2;
      t.y = p.y - icon() / 2;
      render(t);
      save();
      return centre(t);
    },
  };
}
/** A bird lifts a loose trinket. */
export function liftTrinket(id: string, by = "bird"): Loot | null {
  const t = items.get(id);
  if (!t || t.heldBy) return null;
  return lootHandle(t, by);
}
/** A bird snatches a trinket out of a Seeker's hands (never the mouse). */
export function snatchTrinket(id: string, by = "bird"): (Loot & { from: string }) | null {
  const t = items.get(id);
  if (!t || !t.heldBy || t.heldBy === "mouse") return null;
  const from = t.heldBy;
  held.delete(from);
  t.el.classList.remove("grabbed");
  t.heldBy = null;
  return { ...lootHandle(t, by), from };
}

// ---------- carrying (phones via main.ts, the Seer by the mouse) ----------
function grab(t: T, by: string, grabX: number, grabY: number, color?: string) {
  t.heldBy = by;
  held.set(by, { id: t.def.id, ox: t.x - grabX, oy: t.y - grabY });
  t.el.classList.add("grabbed");
  t.el.style.setProperty("--grab", color ?? "#f1d271");
}
function drop(by: string): { name: string; id: string } | null {
  const h = held.get(by);
  if (!h) return null;
  held.delete(by);
  const t = items.get(h.id)!;
  t.heldBy = null;
  t.el.classList.remove("grabbed");
  t.movedAt = Date.now();
  render(t);
  save();
  const c = centre(t);
  if (onGate(c.x, c.y)) gateTeleport(mover(t), c); // dropped on the moongate: through it goes
  return { name: t.def.name, id: t.def.id };
}
/** A phone held with its cursor on a loose trinket: grab it. */
export function trinketHold(phoneId: string): { name: string; id: string; file: string } | null {
  const c = getCursor(phoneId);
  if (!c || held.has(phoneId)) return null;
  const t = hit(c.x, c.y);
  if (!t) return null;
  grab(t, phoneId, c.x, c.y, c.color);
  return { name: t.def.name, id: t.def.id, file: t.def.file };
}
export function trinketRelease(phoneId: string) {
  return drop(phoneId);
}
export function trinketDropAll() {
  for (const by of [...held.keys()]) drop(by);
}
/** Every trinket to a fresh spot clear of the widgets (Restart, the devtools Scatter). */
export function scatterTrinkets() {
  trinketDropAll();
  for (const t of items.values()) {
    t.heldBy = null;
    t.el.classList.remove("lifted", "grabbed");
    const p = spreadSpot();
    t.x = p.x - icon() / 2;
    t.y = p.y - icon() / 2;
    t.movedAt = 0;
    render(t);
  }
  save();
}

// Carried trinkets follow the displayed cursor each frame.
onCursorFrame((cursors) => {
  for (const [by, h] of held) {
    const c = cursors.get(by);
    if (!c) continue;
    const t = items.get(h.id)!;
    const nx = c.x + h.ox;
    const ny = c.y + h.oy;
    const d = Math.hypot(nx - t.x, ny - t.y);
    t.x = nx;
    t.y = ny;
    render(t);
    moved(t, by, d);
  }
});
// The moongate (a tap, the Teleport spell) and the thunderclap move loose trinkets too.
setGateSweeper((inRegion) => {
  const things: Movable[] = [];
  for (const t of items.values()) {
    if (t.heldBy) continue;
    const c = centre(t);
    if (inRegion(c.x, c.y)) things.push({ x: c.x, y: c.y, move: mover(t) });
  }
  return things;
});

function mouseDrag(t: T, ev: PointerEvent) {
  if (!hooks.isInteractive() || ev.button !== 0 || t.heldBy) return;
  ev.stopPropagation();
  const el = t.el;
  el.setPointerCapture(ev.pointerId);
  grab(t, "mouse", ev.clientX, ev.clientY);
  const move = (m: PointerEvent) => {
    const h = held.get("mouse");
    if (!h || h.id !== t.def.id) return;
    const nx = m.clientX + h.ox;
    const ny = m.clientY + h.oy;
    const d = Math.hypot(nx - t.x, ny - t.y);
    t.x = nx;
    t.y = ny;
    render(t);
    moved(t, "mouse", d);
  };
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    drop("mouse");
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

export function initTrinkets(h: Hooks) {
  hooks = h;
  const saved = load();
  for (const def of TRINKETS) {
    const el = document.createElement("div");
    el.className = "trinket";
    el.dataset.id = def.id;
    el.innerHTML = `<img class="art" src="${def.src}" alt="${def.name}" draggable="false" /><span class="name">${def.name}</span>`;
    const t: T = { def, el, x: 0, y: 0, heldBy: null, movedAt: 0 };
    el.addEventListener("pointerdown", (ev) => mouseDrag(t, ev));
    items.set(def.id, t);
    layer.appendChild(el);
    const s = saved?.[def.id];
    if (s) {
      t.x = s.x;
      t.y = s.y;
      render(t);
    }
  }
  if (!saved) scatterTrinkets();
}
