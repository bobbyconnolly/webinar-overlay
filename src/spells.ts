// Spell casting: level 2 (levels.ts opens the spellbook when the level starts
// and closes it on reset). A phone casts from its spellbook drawer; the
// recipe's reagents are spent from the shared bag and fly back out to random
// spots (gather, cast, gather). Every cast is reported as a `spell-cast` DOM
// event for the level-2 tally. Effects are big and simple so they survive a
// 720p stream.
import { allCursors, getCursor, nudgeCursor, onCursorFrame, teleportCursor, wiggleCursor } from "./cursors";
import { burstAt, gateCentre, gateSpot, gateVicinity, setGateCharging, setGateOverloaded, sweepRegion, triggerMoongate } from "./moongate";
import { bagCharges, bagContents, packCentre, returningReagents, spendReagents, teleportReagentsToBag } from "./quest";
import { createFood, scareCat } from "./cat";
import { startNightHunt, thunderWisps } from "./moonglow";
import { getMouse, getMouseDir } from "./mouse";
import { scareBirds } from "./signpost";
import { spawnBats } from "./bats";
import { labelFor } from "./identity";
import { stage } from "./stage";
import { liftDark, nightfall } from "./sky";
import { banishGathered, charmBy, gatherMonsters, hitMonsters, stunMonsters, waveActive } from "./horde";
import { isGhost } from "./ghosts";
import { sfx } from "./sounds";

export type SpellId = "lightning" | "magic-arrow" | "teleport" | "night-sight" | "create-food";
/** The phone spellbook shows SPELLS_PER_PAGE per page, by `page`; an empty slot is "yet unwritten". */
export const SPELL_PAGES = 3;
export const SPELLS_PER_PAGE = 2;
export const SPELLS: { id: SpellId; name: string; recipe: string[]; effect: string; page: number }[] = [
  { id: "magic-arrow", name: "Magic Arrow", recipe: ["black-pearl", "sulfurous-ash"], effect: "nock it, then swipe: four arrows, the last one charged", page: 1 },
  { id: "lightning", name: "Lightning", recipe: ["black-pearl", "mandrake-root", "sulfurous-ash"], effect: "two bolts strike the moongate · stuns the horde", page: 2 },
  { id: "teleport", name: "Teleport", recipe: ["blood-moss", "mandrake-root"], effect: "all near you onto the moongate · loose reagents into the pack", page: 2 },
  { id: "night-sight", name: "Night Sight", recipe: ["spiders-silk", "sulfurous-ash"], effect: "a night of moonglow · in the siege, a minute of light", page: 3 },
  { id: "create-food", name: "Create Food", recipe: ["garlic", "ginseng", "nightshade"], effect: "a dish at your cursor; Ginger comes, then hunts the horde", page: 3 },
];

const COOLDOWN_PHONE_MS = 10_000;
const COOLDOWN_ANY_MS = 2_000;
const NIGHT_MS = 18_000; // Bobby: 16 was "a tad too short"
const LIFT_MS = 60_000; // Night Sight during a horde wave: light for a minute (Bobby)
const STUN_MS = 5000; // Lightning: the horde freezes this long (Bobby)
const WAVE_ARROW_COOLDOWN_MS = 5000; // Magic Arrow during a wave: shorter, no room cooldown, nothing spent
const GATHER_MS = 1500; // Teleport: time on the gate before it fires (Bobby: they may try to get off)
const SHOVE = 200; // Lightning: how far a thunderclap throws a cursor, px at stage 1
const FLING = 120; // and how far beyond the vicinity a reagent lands
const OVERLOAD_MS = 10_000; // the gate zaps anyone touching it for this long after lightning

type Hooks = { send: (msg: object) => void };
let hooks: Hooks;
let enabled = false;
const lastCast = new Map<string, number>();
let lastCastAny = 0;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const banner = $("#spell-banner");
const flash = $("#flash");
const fx = $("#fx");

export function initSpells(h: Hooks) {
  hooks = h;
  document.addEventListener("level-changed", (e) => setEnabled((e as CustomEvent<{ level: number }>).detail.level >= 2));
  document.addEventListener("bag-changed", () => broadcastState());
}

export function spellsEnabled() {
  return enabled;
}
function setEnabled(on: boolean) {
  if (enabled === on) return;
  enabled = on;
  document.body.classList.toggle("spells", on);
  if (!on) cancelAllNocks();
  broadcastState();
}
/** What phones need to draw their spellbook: enabled + what is in the bag (and its charges). */
export function spellState(to?: string) {
  return {
    type: "spells",
    to,
    enabled,
    stock: bagContents(),
    charges: bagCharges(),
    returning: returningReagents(), // gone reagents: ms until they come back
    spells: SPELLS,
    pages: SPELL_PAGES,
    perPage: SPELLS_PER_PAGE,
    cooldown: COOLDOWN_PHONE_MS,
  };
}
function broadcastState() {
  hooks.send(spellState());
}

/** A phone asked to cast. Returns what to tell it (`nocked`: Magic Arrow waits for the next swipe; `cooldown`: ms until its next cast). */
export function castSpell(phoneId: string, spellId: string): { ok: boolean; reason?: string; nocked?: boolean; cooldown?: number } {
  const spell = SPELLS.find((s) => s.id === spellId);
  if (!spell) return { ok: false, reason: "unknown" };
  if (!enabled) return { ok: false, reason: "closed" };
  if (isGhost(phoneId)) return { ok: false, reason: "ghost" }; // find the healer first
  const now = Date.now();
  // During a horde wave Magic Arrow is the weapon: a shorter cooldown, no room-wide
  // cooldown, nothing spent (the recipe must still be in the bag, which is what the
  // horde steals) and no big announcement, so twenty phones can all shoot.
  const volley = spell.id === "magic-arrow" && waveActive();
  const cooldown = volley ? WAVE_ARROW_COOLDOWN_MS : COOLDOWN_PHONE_MS;
  if (now - (lastCast.get(phoneId) ?? 0) < cooldown) return { ok: false, reason: "cooldown" };
  if (!volley && now - lastCastAny < COOLDOWN_ANY_MS) return { ok: false, reason: "busy" };
  const stock = new Set(bagContents());
  if (!spell.recipe.every((r) => stock.has(r))) return { ok: false, reason: "missing" };

  lastCast.set(phoneId, now);
  const who = labelFor(phoneId);
  if (!volley) {
    lastCastAny = now;
    // Spend: the reagents leave the bag and land at random spots, each with a burst.
    const spots = spendReagents(spell.recipe);
    for (const p of spots) burstAt(p.x, p.y);
    announce(`${who.name} casts ${spell.name}`, who.color);
    hooks.send({ type: "casted", by: who.name, color: who.color, spell: spell.id, name: spell.name });
    broadcastState();
  }
  document.dispatchEvent(new CustomEvent("spell-cast", { detail: { spell: spell.id, by: phoneId } })); // levels.ts tallies
  if (spell.id === "magic-arrow") {
    nockArrow(phoneId, who.color); // the caster's next swipe shoots it
    return { ok: true, nocked: true, cooldown };
  }
  window.setTimeout(() => effect(spell.id, phoneId), 350);
  return { ok: true };
}

/**
 * Devtools: cast without reagents, cooldowns or the level gate; nothing is spent
 * or tallied. `caster` is a phone id or "mouse" (the Seer: his mouse stands in
 * for a cursor, and Magic Arrow shoots the way the mouse last moved).
 */
export function devCast(spellId: string, caster: string): string {
  const spell = SPELLS.find((s) => s.id === spellId);
  if (!spell) return "unknown spell";
  const who = labelFor(caster);
  announce(`${who.name} casts ${spell.name}`, who.color);
  hooks.send({ type: "casted", by: who.name, color: who.color, spell: spell.id, name: spell.name, dev: true });
  if (spell.id === "magic-arrow") {
    if (getCursor(caster)) {
      nockArrow(caster, who.color);
      hooks.send({ type: "cast", to: caster, spell: spell.id, ok: true, nocked: true });
      return "nocked: swipe on that phone";
    }
    devVolley(who);
    return "volley from the mouse, the way it last moved";
  }
  window.setTimeout(() => effect(spell.id, caster), 350);
  return "cast";
}
/** The volley from the mouse position, each arrow the way the mouse is moving at that moment; the last one charged. */
function devVolley(who: { name: string; color: string }) {
  let shot = 0;
  const fire = () => {
    const from = getMouse() ?? { x: innerWidth / 2, y: innerHeight / 2 };
    const a = Math.random() * Math.PI * 2;
    const dir = getMouseDir() ?? { x: Math.cos(a), y: Math.sin(a) };
    shot++;
    loose("mouse", who, who.color, from, dir, shot, shot === VOLLEY);
    if (shot < VOLLEY) window.setTimeout(fire, shot === VOLLEY - 1 ? CHARGE_MS : VOLLEY_GAP_MS);
  };
  fire();
}

/** Big centred text for a moment (spell casts, the ankh awakening). */
export function announce(text: string, color: string) {
  banner.textContent = text;
  banner.style.setProperty("--who", color);
  banner.classList.remove("show");
  void banner.offsetWidth;
  banner.classList.add("show");
  window.setTimeout(() => banner.classList.remove("show"), 2600);
}

function effect(id: SpellId, caster: string) {
  switch (id) {
    case "lightning": {
      // Two strikes in quick succession, each from its own angle: 55° to 125° from
      // the horizontal (Bobby: not from the side), starting just above the screen.
      // Each one is a thunderclap: everything near the gate is thrown outward.
      // Ginger bolts at the first; after the second the gate is overloaded.
      const strike = () => {
        const g = gateCentre();
        const th = ((55 + Math.random() * 70) * Math.PI) / 180;
        const len = (g.y + 40) / Math.sin(th);
        bolt(g.x - len * Math.cos(th), g.y - len * Math.sin(th), g.x, g.y, "#e8f4ff", 7 * stage());
        flashScreen();
        sfx("lightning", { cooldownMs: 400 }); // one thunder for the pair of bolts
        thunderclap(g);
        stunMonsters(STUN_MS); // the horde, if any, freezes; the overloaded gate spawns nothing meanwhile
      };
      strike();
      scareCat();
      window.setTimeout(() => {
        strike();
        setGateOverloaded(OVERLOAD_MS);
      }, 170);
      break;
    }
    case "magic-arrow":
      break; // nocked at the cast, shot by the next swipe: nockArrow / fireArrow below
    case "teleport": {
      // Everything near the caster (the caster too, other cursors, loose reagents,
      // the dish and Ginger) is pulled onto the moongate, spread with blue noise so
      // nothing stacks; GATHER_MS later the gate fires on whatever is still on it.
      const c = getCursor(caster);
      const centre = c ? tipOf(c) : (getMouse() ?? gateCentre()); // devtools: the Seer casts from the mouse
      const radius = gateVicinity();
      const near = (x: number, y: number) => Math.hypot(x - centre.x, y - centre.y) <= radius;
      const placed: { x: number; y: number }[] = [];
      const s = stage();
      for (const [id, o] of allCursors()) {
        const t = tipOf(o);
        if (!near(t.x, t.y)) continue;
        burstAt(t.x, t.y);
        const p = gateSpot(placed);
        teleportCursor(id, p.x - 3 * s, p.y - 2 * s); // the tip lands on the spot
        burstAt(p.x, p.y);
        hooks.send({ type: "teleport", to: id, state: "gathered", ms: GATHER_MS });
      }
      // Loose reagents near the caster fly into the pack instead (Bobby 2026-10-02: a way to
      // replenish black pearl and ash mid-siege), with the caster's credit; the dish and
      // Ginger still go onto the gate.
      const bagged = teleportReagentsToBag(near, caster);
      for (const b of bagged) burstAt(b.x, b.y);
      if (bagged.length) {
        const pc = packCentre();
        if (pc) burstAt(pc.x, pc.y);
        hooks.send({ type: "teleport", to: caster, state: "bagged", names: bagged.map((b) => b.name) });
      }
      for (const m of sweepRegion(near)) {
        const p = gateSpot(placed);
        m.move(p);
        burstAt(p.x, p.y);
      }
      gatherMonsters(near, placed, caster); // the horde near the caster is pulled in too, and banished when the gate fires
      setGateCharging(true);
      window.setTimeout(() => {
        setGateCharging(false);
        banishGathered();
        triggerMoongate(null);
      }, GATHER_MS);
      break;
    }
    case "create-food": {
      const c = getCursor(caster);
      const at = c ? tipOf(c) : (getMouse() ?? gateCentre()); // devtools: at the mouse
      const p = createFood(at); // kept in the middle half of the screen
      burstAt(p.x, p.y);
      sfx("food");
      charmBy(caster); // monsters that come near Ginger flee, credited to the caster
      break;
    }
    case "night-sight": {
      sfx("night");
      // In a horde wave the stage is already dark: Night Sight lifts it for a while instead.
      if (waveActive()) {
        liftDark(LIFT_MS);
        break;
      }
      // Darkness for NIGHT_MS (a recast extends it), and the moonglow hunt with it.
      nightfall(NIGHT_MS);
      startNightHunt({ send: (m) => hooks.send(m), announce }, NIGHT_MS);
      scareBirds(); // the signpost's birds take off at dusk
      spawnBats(); // and bats may come, usually two
      break;
    }
  }
}

// ---------- Magic Arrow: nock, then swipe to shoot a volley of three ----------
// Casting nocks the arrow: a dashed ring spins on the caster's cursor. The
// caster's next swipe shoots: once the cursor has travelled NOCK_PX from where
// it was at the cast, that direction is the first arrow (a twitch does nothing).
// Two more follow VOLLEY_GAP_MS apart; each takes the direction the cursor has
// moved since the previous shot (ADJUST_PX or more), else keeps the last one, so
// the caster can steer the volley over about a second. The fourth and last one
// charges first (Bobby 2026-10-02): the ring shakes and a crescent grows ahead of
// the cursor for CHARGE_MS (still steerable), then a bigger, brighter arrow with
// twice the hit radius flies, hurts the horde for two, and kicks the caster back
// (recoil). No deadline and no extra gesture (Bobby: nobody figures out timed
// aiming); a reset clears nocked arrows. Each arrow flies ARROW_RANGE with the
// beam shown, and every other cursor within HIT_RADIUS of its path is knocked
// back and told who shot.
const NOCK_PX = 80;
const ADJUST_PX = 20; // movement between shots that re-aims the next one
const VOLLEY = 4;
const VOLLEY_GAP_MS = 500;
const CHARGE_MS = 900; // the last arrow builds up this long
const BIG_RADIUS = 2; // × HIT_RADIUS for the charged arrow
const BIG_KNOCK = 1.6; // × KNOCK
const RECOIL = 140; // px the caster is kicked back on release, at stage 1
const ARROW_RANGE = 760; // px at stage 1
const HIT_RADIUS = 48;
const KNOCK = 160;
const FLIGHT_MS = 380;
type Dir = { x: number; y: number };
type Nock = { ox: number; oy: number; color: string; el: HTMLElement; dir: Dir | null; shots: number; timer: number };
const nocked = new Map<string, Nock>();

const tipOf = (c: { x: number; y: number }) => ({ x: c.x + 3 * stage(), y: c.y + 2 * stage() });

function nockArrow(caster: string, color: string) {
  cancelNock(caster);
  const c = getCursor(caster);
  if (!c) return;
  const t = tipOf(c);
  const el = document.createElement("div");
  el.className = "aim";
  el.style.setProperty("--who", color);
  el.innerHTML = `<div class="aim-beam"></div><div class="aim-ring"></div><div class="aim-crescent"></div>`;
  el.style.setProperty("--charge-ms", `${CHARGE_MS}ms`);
  el.style.transform = `translate(${t.x}px, ${t.y}px)`;
  fx.appendChild(el);
  nocked.set(caster, { ox: t.x, oy: t.y, color, el, dir: null, shots: 0, timer: 0 });
}
function cancelNock(caster: string) {
  const n = nocked.get(caster);
  if (!n) return;
  window.clearTimeout(n.timer);
  n.el.remove();
  nocked.delete(caster);
}
export function cancelAllNocks() {
  for (const id of [...nocked.keys()]) cancelNock(id);
}
/** A caster became a ghost: the bow falls. */
export function cancelNockFor(id: string) {
  cancelNock(id);
}
/** Direction the cursor moved since the last shot (or the cast), if it is enough; else the last shot's. */
function aimSince(n: Nock, t: Dir): Dir | null {
  const dx = t.x - n.ox;
  const dy = t.y - n.oy;
  const d = Math.hypot(dx, dy);
  const need = (n.dir ? ADJUST_PX : NOCK_PX) * stage();
  return d >= need ? { x: dx / d, y: dy / d } : n.dir;
}
// The ring follows the caster. Enough travel since the cast shoots the first
// arrow; between shots the beam previews where the next one will go.
onCursorFrame(() => {
  for (const [id, n] of nocked) {
    const c = getCursor(id);
    if (!c) {
      cancelNock(id);
      continue;
    }
    const t = tipOf(c);
    n.el.style.transform = `translate(${t.x}px, ${t.y}px)`;
    const aim = aimSince(n, t);
    if (!aim) continue;
    if (!n.dir) shoot(id, aim);
    else n.el.style.setProperty("--ang", `${(Math.atan2(aim.y, aim.x) * 180) / Math.PI}deg`);
  }
});
function shoot(caster: string, dir: Dir) {
  const n = nocked.get(caster);
  if (!n) return;
  const c = getCursor(caster);
  if (!c) {
    cancelNock(caster);
    return;
  }
  const who = labelFor(caster);
  const from = tipOf(c);
  n.dir = dir;
  n.ox = from.x; // the next shot is aimed by the movement from here
  n.oy = from.y;
  n.shots++;
  const shot = n.shots;
  n.el.style.setProperty("--ang", `${(Math.atan2(dir.y, dir.x) * 180) / Math.PI}deg`);
  n.el.style.setProperty("--range", `${ARROW_RANGE * stage()}px`);
  n.el.classList.add("aimed");
  if (shot === VOLLEY) {
    charge(caster, n, dir); // the last one builds up first
    return;
  }
  loose(caster, who, n.color, from, dir, shot);
  n.timer = window.setTimeout(() => {
    const m = nocked.get(caster);
    const cc = getCursor(caster);
    if (!m || !cc) return;
    shoot(caster, aimSince(m, tipOf(cc)) ?? dir);
  }, VOLLEY_GAP_MS);
}
/** The charged last arrow: CHARGE_MS of shaking and a growing crescent (still steerable), then the big one and the recoil. */
function charge(caster: string, n: Nock, dir: Dir) {
  n.el.classList.add("charging");
  hooks.send({ type: "aimed", to: caster, state: "charging", ms: CHARGE_MS });
  n.timer = window.setTimeout(() => {
    const m = nocked.get(caster);
    const cc = getCursor(caster);
    if (!m || !cc) return;
    const aim = aimSince(m, tipOf(cc)) ?? dir;
    m.el.classList.remove("charging");
    m.el.style.setProperty("--ang", `${(Math.atan2(aim.y, aim.x) * 180) / Math.PI}deg`);
    const from = tipOf(cc);
    loose(caster, labelFor(caster), m.color, from, aim, VOLLEY, true);
    nudgeCursor(caster, -aim.x * RECOIL * stage(), -aim.y * RECOIL * stage()); // the bow kicks
    wiggleCursor(caster);
    // The ring and beam go once the last arrow has landed.
    window.setTimeout(() => {
      if (nocked.get(caster) === m) cancelNock(caster);
    }, FLIGHT_MS + 150);
  }, CHARGE_MS);
}
/** One arrow from `from` along `dir`: the visual, then the hits along its path. `big` = the charged last one. */
function loose(caster: string, who: { name: string; color: string }, color: string, from: Dir, dir: Dir, shot: number, big = false) {
  const range = ARROW_RANGE * stage();
  const to = {
    x: Math.max(0, Math.min(innerWidth, from.x + dir.x * range)),
    y: Math.max(0, Math.min(innerHeight, from.y + dir.y * range)),
  };
  arrow(from.x, from.y, to.x, to.y, color, big);
  sfx("arrow");
  const radius = HIT_RADIUS * stage() * (big ? BIG_RADIUS : 1);
  const knock = KNOCK * stage() * (big ? BIG_KNOCK : 1);
  window.setTimeout(() => {
    const hits: string[] = [];
    for (const [id, o] of allCursors()) {
      if (id === caster || isGhost(id)) continue; // an arrow passes through a spirit
      const p = tipOf(o);
      if (distToSegment(p, from, to) > radius) continue;
      nudgeCursor(id, dir.x * knock, dir.y * knock);
      wiggleCursor(id);
      burstAt(p.x, p.y);
      hits.push(labelFor(id).name);
      hooks.send({ type: "hit", to: id, by: who.name, color: who.color });
    }
    const slain = hitMonsters(from, to, radius, caster, big ? 2 : 1); // level 3: the horde along the path
    burstAt(to.x, to.y);
    hooks.send({ type: "aimed", to: caster, state: "fired", hits, slain, shot, of: VOLLEY, big });
  }, FLIGHT_MS);
}
function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
/** A shockwave from the gate: cursors in the vicinity are shoved outward, loose things flung further. */
function thunderclap(centre: { x: number; y: number }) {
  const s = stage();
  const radius = gateVicinity();
  const near = (x: number, y: number) => Math.hypot(x - centre.x, y - centre.y) <= radius;
  const away = (x: number, y: number): Dir => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      const a = Math.random() * Math.PI * 2;
      return { x: Math.cos(a), y: Math.sin(a) };
    }
    return { x: dx / d, y: dy / d };
  };
  thunderWisps(centre, radius * 2.2); // during a night hunt the wisps near the gate scatter wide
  const ring = document.createElement("div");
  ring.className = "thunder-ring";
  const size = 2 * (radius + FLING * s);
  ring.style.left = `${centre.x - size / 2}px`;
  ring.style.top = `${centre.y - size / 2}px`;
  ring.style.width = ring.style.height = `${size}px`;
  fx.appendChild(ring);
  window.setTimeout(() => ring.remove(), 700);
  for (const [id, c] of allCursors()) {
    if (isGhost(id)) continue; // the thunder passes through a spirit
    const t = tipOf(c);
    if (!near(t.x, t.y)) continue;
    const d = away(t.x, t.y);
    nudgeCursor(id, d.x * SHOVE * s, d.y * SHOVE * s);
    wiggleCursor(id);
    hooks.send({ type: "shoved", to: id });
  }
  for (const m of sweepRegion(near)) {
    const d = away(m.x, m.y);
    const r = radius + FLING * s;
    m.move({
      x: Math.max(40, Math.min(innerWidth - 40, centre.x + d.x * r)),
      y: Math.max(80, Math.min(innerHeight - 40, centre.y + d.y * r)),
    });
  }
}

function flashScreen() {
  flash.classList.remove("on");
  void flash.offsetWidth;
  flash.classList.add("on");
  window.setTimeout(() => flash.classList.remove("on"), 400);
}

/** Jagged lightning bolt from (x0,y0) to (x1,y1), drawn as an SVG that fades out. */
function bolt(x0: number, y0: number, x1: number, y1: number, color: string, width: number) {
  const pts: string[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jitter = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 90;
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const len = Math.hypot(nx, ny) || 1;
    pts.push(`${x0 + (x1 - x0) * t + (nx / len) * jitter},${y0 + (y1 - y0) * t + (ny / len) * jitter}`);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "bolt");
  svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="#fff" stroke-width="${width * 0.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
  fx.appendChild(svg);
  window.setTimeout(() => svg.remove(), 700);
}

/** Glowing arrow that flies from the caster to the target in 0.38 s; the charged one is bigger with a crescent head. */
function arrow(x0: number, y0: number, x1: number, y1: number, color: string, big = false) {
  const el = document.createElement("div");
  el.className = big ? "arrow big" : "arrow";
  el.style.color = color;
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  el.style.transform = `translate(${x0}px, ${y0}px) rotate(${ang}deg)`;
  fx.appendChild(el);
  void el.offsetWidth;
  el.style.transform = `translate(${x1}px, ${y1}px) rotate(${ang}deg)`;
  window.setTimeout(() => el.remove(), 500);
}
