// The signpost's birds. Two sit on the post cap; the Seer's click or a phone
// cursor tap on one sends it flying off (flapping, up and to its side), and it
// lands again a while later. Decoration with a little life in it (Bobby).
//
// Level 1 (Bobby 2026-10-02, "the birds steal"): now and then a perched bird
// swoops on a loose reagent, carries it back and drops it at the foot of the
// post, then settles on the cap again. The flight is a separate flyer element
// in #fx (the perched bird hides meanwhile) on two quadratic arcs: cap → reagent
// (a dip), reagent → foot; the reagent is lifted through quest.ts (nobody can grab
// it in the air) and hangs below the bird. Phones hear which bird took what.
import { cursorIdleMs, getCursor } from "./cursors";
import { labelFor } from "./identity";
import { carriedReagents, liftReagent, looseReagents, snatchReagent, type Loot } from "./quest";
import { stage } from "./stage";
import { sfx } from "./sounds";

const FLY_MS = 1300;
const LAND_MS = 700;
const RETURN_MS = 22_000; // Bobby: away for 20 to 25 s (night lasts 16)
const PAD = 10; // tap tolerance around a bird, px
// The thefts (level 1 only): the first one this long after the level begins, then every so often.
const STEAL_FIRST_MS: [number, number] = [45_000, 75_000];
const STEAL_EVERY_MS: [number, number] = [60_000, 120_000];
const SWOOP_MS = 1500; // cap → reagent
const HAUL_MS = 1800; // reagent → the foot of the post (laden, a little slower)
const HOP_MS = 600; // foot → cap
const DIP = 140; // how far above the straight line the arcs bulge, px (× stage)
const DROP_R = 120; // the reagent lands within this of the foot, px (× stage)
const DROP_TRIES = 10; // candidates per drop: the one farthest from the other loose reagents wins (Bobby 2026-10-03: they stacked)
const NOT_FROM = 160; // a reagent already this near the post is not worth the trip, px (× stage)
const HANG = 20; // the reagent hangs this far below the bird, px (× stage)
// More emergence (Bobby 2026-10-03): a bird may take a reagent out of a Seeker's hands if that
// cursor has been parked for PARK_MS (a moving carrier is safe, and it misses if the carrier
// moves before it lands); half the time it goes for the freshest-moved reagent; and if Ginger is
// close to where it lands he lunges and it flees empty-handed.
const PARK_MS = 1500;
const FRESH_PREY = 0.5;
const FRESH_MS = 20_000;
const LUNGE_R = 220; // px (× stage): Ginger this close to the landing bird chases it off
const SNATCH_R = 60; // px (× stage): the carried reagent must still be about where the bird aimed

type Hooks = {
  send: (msg: object) => void;
  onSnatch?: (phoneId: string, name: string, color: string) => void; // main.ts: the grip is gone, tell the phone
  cat?: { pos: () => { x: number; y: number } | null; lunge: (at: { x: number; y: number }) => boolean };
};
let hooks: Hooks = { send: () => {} };
const birds = [...document.querySelectorAll<SVGGElement>(".signpost .bird")];
const signpost = document.querySelector<HTMLElement>("[data-widget=signpost]")!;
const fx = document.getElementById("fx")!;
let stealLevel = false;
let stealTimer = 0;
let thief: SVGGElement | null = null; // the bird out stealing, if any

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function perched(b: Element) {
  return !b.classList.contains("fly") && !b.classList.contains("away");
}
/** The birds sitting on the cap right now, with their colour and screen centre (cat.ts stalks them). */
export function perchedBirds(): { el: SVGGElement; color: string; x: number; y: number }[] {
  return birds.filter(perched).map((b) => {
    const r = b.getBoundingClientRect();
    return { el: b, color: b.dataset.color ?? "bird", x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}
/** Send a bird off; it comes back by itself. False if it is already gone. */
export function scareBird(b: Element): boolean {
  if (!perched(b)) return false;
  b.classList.add("fly");
  sfx("bird");
  window.setTimeout(() => {
    b.classList.remove("fly");
    b.classList.add("away");
  }, FLY_MS);
  window.setTimeout(() => {
    b.classList.remove("away");
    b.classList.add("land");
    window.setTimeout(() => b.classList.remove("land"), LAND_MS);
  }, RETURN_MS);
  return true;
}
/** A phone tapped: the colour of the bird its cursor was on, if one flew; else null. */
export function birdTap(phoneId: string): string | null {
  const c = getCursor(phoneId);
  if (!c) return null;
  for (const b of birds) {
    if (!perched(b)) continue;
    const r = b.getBoundingClientRect();
    if (c.x >= r.left - PAD && c.x <= r.right + PAD && c.y >= r.top - PAD && c.y <= r.bottom + PAD) {
      scareBird(b);
      return b.dataset.color ?? "bird";
    }
  }
  return null;
}
/** Night falls: every bird that is still perched takes off. */
export function scareBirds() {
  for (const b of birds) scareBird(b);
}

// ---------- the theft ----------
/** Screen centre of a perched bird, and the foot of the post (bottom centre of the dirt patch). */
function birdAt(b: Element) {
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function footOfPost() {
  const r = signpost.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.bottom - 14 * stage() };
}
/** Where to drop it: a spot around the foot, out of the post, farthest from the other loose reagents (cheap blue noise). */
function landingSpot(foot: { x: number; y: number }, excludeId: string): { x: number; y: number } {
  const s = stage();
  const others = looseReagents().filter((r) => r.id !== excludeId);
  let best = { x: foot.x + 60 * s, y: foot.y };
  let bestD = -1;
  for (let i = 0; i < DROP_TRIES; i++) {
    const a = Math.random() * Math.PI * 2;
    const k = 0.3 + 0.7 * Math.sqrt(Math.random());
    const side = Math.cos(a) < 0 ? -44 * s : 44 * s; // never on the post itself
    const p = {
      x: Math.max(40 * s, Math.min(innerWidth - 40 * s, foot.x + side + Math.cos(a) * k * DROP_R * s)),
      y: Math.max(80 * s, Math.min(innerHeight - 40 * s, foot.y - 8 * s + Math.sin(a) * k * DROP_R * 0.5 * s)),
    };
    const d = others.reduce((m, r) => Math.min(m, Math.hypot(r.x - p.x, r.y - p.y)), Infinity);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
/** A flyer: the bird's art in its own small SVG in #fx, positioned with the `translate` property. */
function makeFlyer(b: SVGGElement): { el: HTMLElement; art: SVGGElement } {
  const el = document.createElement("div");
  el.className = "bird-flyer";
  el.innerHTML = `<svg viewBox="-14 -12 28 24" aria-hidden="true"><g class="art">${b.innerHTML}</g></svg>`;
  fx.appendChild(el);
  return { el, art: el.querySelector<SVGGElement>(".art")! };
}
/** Fly along a quadratic arc from `a` to `b` over `ms`, calling `on` with the position each frame. */
function arc(a: { x: number; y: number }, b: { x: number; y: number }, bulge: number, ms: number, on: (p: { x: number; y: number }) => void): Promise<void> {
  const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - bulge };
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; // ease in-out
      const x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x;
      const y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y;
      on({ x, y });
      if (u < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
/**
 * A perched bird swoops on a loose reagent and drops it at the foot of the post.
 * Returns what happened (for devtools), or null when nothing could be stolen.
 */
export function stealNow(): string | null {
  if (thief || !signpost.getBoundingClientRect().width) return null;
  const perchedBirds = birds.filter(perched);
  if (!perchedBirds.length) return null;
  const s = stage();
  const foot = footOfPost();
  const loose = looseReagents().filter((r) => Math.hypot(r.x - foot.x, r.y - foot.y) > NOT_FROM * s);
  // The prey: a loose reagent away from the post, or one in a parked Seeker's hands; half the
  // time the freshest-moved loose one (whatever moved it: a drop, a kick, a bird).
  const parked = carriedReagents().filter((r) => cursorIdleMs(r.by) >= PARK_MS);
  if (!loose.length && !parked.length) return null;
  const b = pick(perchedBirds);
  const fresh = loose.filter((r) => Date.now() - r.movedAt < FRESH_MS).sort((p, q) => q.movedAt - p.movedAt)[0];
  type Prey = { id: string; name: string; x: number; y: number; by?: string };
  const pool: Prey[] = [...loose, ...parked];
  const prey: Prey = fresh && Math.random() < FRESH_PREY ? fresh : pick(pool);
  const color = b.dataset.color ?? "bird";
  thief = b;
  b.classList.add("away");
  sfx("bird");
  const { el, art } = makeFlyer(b);
  let lastX = birdAt(b).x;
  const put = (p: { x: number; y: number }) => {
    el.style.setProperty("translate", `${p.x}px ${p.y}px`);
    if (Math.abs(p.x - lastX) > 0.5) art.style.transform = p.x > lastX ? "scaleX(-1)" : ""; // the art faces left
    lastX = p.x;
  };
  let loot: Loot | null = null;
  (async () => {
    await arc(birdAt(b), prey, DIP * s, SWOOP_MS, put);
    // Ginger close by: he lunges, the bird flees without it.
    const cp = hooks.cat?.pos();
    if (cp && Math.hypot(cp.x - prey.x, cp.y - prey.y) <= LUNGE_R * s && hooks.cat?.lunge({ x: prey.x, y: prey.y })) {
      hooks.send({ type: "bird", state: "chased", color });
      await arc(prey, birdAt(b), DIP * s, HOP_MS * 1.5, put);
      el.remove();
      b.classList.remove("away");
      b.classList.add("land");
      window.setTimeout(() => b.classList.remove("land"), LAND_MS);
      thief = null;
      return;
    }
    if (prey.by) {
      // Out of a Seeker's hands: only if the carrier is still parked and the reagent still about where the bird aimed.
      const now = carriedReagents().find((r) => r.id === prey.id && r.by === prey.by);
      const still = now && cursorIdleMs(now.by) >= PARK_MS && Math.hypot(now.x - prey.x, now.y - prey.y) <= SNATCH_R * s;
      const got = still ? snatchReagent(prey.id, "bird") : null;
      if (got) {
        loot = got;
        hooks.onSnatch?.(got.from, got.name, color);
        hooks.send({ type: "bird", state: "steal", color, name: got.name, victim: labelFor(got.from).name }); // not `from`: the relay overwrites that field
      }
    } else {
      loot = liftReagent(prey.id, "bird");
      if (loot) hooks.send({ type: "bird", state: "steal", color, name: loot.name });
    }
    const land = landingSpot(foot, prey.id);
    await arc(prey, land, DIP * s, loot ? HAUL_MS : SWOOP_MS, (p) => {
      put(p);
      loot?.carry({ x: p.x, y: p.y + HANG * s });
    });
    loot?.drop();
    await arc(land, birdAt(b), DIP * 0.4 * s, HOP_MS, put);
    el.remove();
    b.classList.remove("away");
    b.classList.add("land");
    window.setTimeout(() => b.classList.remove("land"), LAND_MS);
    thief = null;
  })();
  return prey.by ? `the ${color} bird is after ${prey.name} in ${labelFor(prey.by).name}'s hands` : `the ${color} bird is after ${prey.name}`;
}
function schedule(range: [number, number]) {
  window.clearTimeout(stealTimer);
  stealTimer = window.setTimeout(() => {
    if (!stealLevel) return;
    stealNow();
    schedule(STEAL_EVERY_MS);
  }, rand(range[0], range[1]));
}
/** levels.ts: the birds steal during levels 0 and 1 (trinkets from level 0, reagents from level 1). */
export function setBirdLevel(level: number) {
  const on = level <= 1;
  if (on === stealLevel) return;
  stealLevel = on;
  window.clearTimeout(stealTimer);
  if (on) schedule(STEAL_FIRST_MS);
}
/** Devtools: a theft right now. */
export function devBirdSteal(): string {
  return stealNow() ?? (thief ? "a bird is already out" : "nothing to steal: no loose reagent away from the post, or no bird perched");
}
export function initSignpost(h: Hooks) {
  hooks = h;
  // The widget drag handler skips `.bird` presses, so the click reaches the bird itself.
  for (const b of birds) b.addEventListener("click", () => scareBird(b));
}
