// Reagent quest. Eight reagents are scattered over the overlay; phones (or the
// presenter with the mouse) carry them into the backpack.
//
//   phone hold on a reagent  -> grab (the reagent follows that phone's cursor)
//   swipes                   -> carry
//   finger lifted (release)  -> drop; it counts only if its centre lands inside
//                               the backpack's INSET drop zone, not on the rim
//
// Every hold-swipe-release moves a reagent ~0.4 screen widths, so it takes a
// few. When all eight are in the pack during level 1 the overlay fires the
// `quest-complete` DOM event (levels.ts shows the banner and starts level 2);
// `body.quest-complete` marks a full bag at any level (the pack glows).
// Phones may rearrange reagents inside the open bag but never take them out;
// the Seer's mouse may. Positions and progress persist in localStorage.
import { cursorCount, getCursor, onCursorFrame } from "./cursors";
import { batTrinket, carriedTrinkets, isTrinketId, liftTrinket, looseTrinkets, snatchTrinket } from "./trinkets";
import { burstAt, gateTeleport, onGate, setGateSweeper } from "./moongate";
import { labelFor } from "./identity";
import { stage } from "./stage";
import { sfx } from "./sounds";

export type ReagentDef = {
  id: string;
  name: string;
  src: string;
  glitter: string;
  charges?: number; // fixed charges per collection; default: plentiful, max(5, 2 × phones)
  respawn?: [number, number]; // seconds: when spent it is gone, and comes back by itself after a random wait
};
/**
 * Swap `src` for better art later; any image format with transparency works.
 * `glitter` is the hue of the twinkling rim drawn around the art's contour.
 * The economy (agreed with Bobby 2026-10-01): the common pair that feeds Magic Arrow is
 * plentiful and re-collectable forever (gathering is the pacing); mandrake root throttles
 * the two disruptive spells (Lightning, Teleport) at 2 charges per 45–60 s; spider's silk
 * throttles Night Sight at one charge per 2–3 min. The Seer can respawn early.
 */
export const REAGENTS: ReagentDef[] = [
  { id: "black-pearl", name: "Black Pearl", src: "/reagents/black-pearl.svg", glitter: "#8fd6ff" },
  { id: "blood-moss", name: "Blood Moss", src: "/reagents/blood-moss.svg", glitter: "#ff5a5a" },
  { id: "garlic", name: "Garlic", src: "/reagents/garlic.svg", glitter: "#fff6d6" },
  { id: "ginseng", name: "Ginseng", src: "/reagents/ginseng.svg", glitter: "#ffd35c" },
  { id: "mandrake-root", name: "Mandrake Root", src: "/reagents/mandrake-root.svg", glitter: "#7cf29a", charges: 2, respawn: [45, 60] },
  { id: "nightshade", name: "Nightshade", src: "/reagents/nightshade.svg", glitter: "#c98cff" },
  { id: "spiders-silk", name: "Spider's Silk", src: "/reagents/spiders-silk.svg", glitter: "#9ff5ff", charges: 1, respawn: [120, 180] },
  { id: "sulfurous-ash", name: "Sulfurous Ash", src: "/reagents/sulfurous-ash.svg", glitter: "#f5ff6a" },
];
/** Charges a reagent gets when it lands in the bag. */
function chargesFor(def: ReagentDef) {
  return def.charges ?? Math.max(5, 2 * cursorCount());
}

const STORAGE_KEY = "overlay.quest.v1";
const ICON_BASE = 60; // css px at stage 1, matches .reagent (art inset 5 px for the rim)
/** On-screen reagent size: scales with stream mode. Inside the bag the bag's transform does it. */
const icon = () => ICON_BASE * stage();
const ZONE_INSET = 0.22; // fraction of the closed pack excluded on each side
const GUMP_INSET = 0.06; // fraction of the open gump interior excluded on each side
const GRAB_PAD = 24; // hit tolerance around a reagent, px (14 until 2026-10-02: a tester over a 250 ms link kept missing)
const PACK_PAD = 20; // hit tolerance around the pack for a double-tap, px
const GUMP_W = 236; // interior size used to place collected items (matches .gump-items CSS)
const GUMP_H = 190;
const OPEN_COOLDOWN_PHONE_MS = 5000; // one phone may open the gump this often
const OPEN_COOLDOWN_ANY_MS = 2000; // the room as a whole

type Item = {
  def: ReagentDef;
  el: HTMLElement;
  x: number; // on the overlay (css px, top-left)
  y: number;
  collected: boolean;
  gx: number; // inside the gump (css px, top-left, relative to #gump-items)
  gy: number;
  heldBy: string | null; // phone id, "mouse", or null
  deliveredBy: string | null; // who put it in the bag (credit); cleared when taken out
  charges: number; // spells it can still feed: the number of phones when it was put in the bag (Bobby); 0 when loose
  gone: boolean; // a limited reagent that was spent: off the overlay until it respawns
  returnAt: number; // when a gone reagent comes back by itself (ms epoch), 0 if not scheduled
  movedAt: number; // last time it was dropped, batted, kicked or carried off (not persisted): the antagonists like the freshest toy
};
let dragPx = 0; // how far the Seekers have carried reagents since the last reading (cat.ts: Ginger comes sooner)

type Hooks = {
  send: (msg: object) => void; // broadcast to phones via the relay
  isInteractive: () => boolean;
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const layer = $("#items");
const backpack = $("[data-widget=backpack]");
const pack = $("#pack");
const badge = $("#pack-badge");
const gump = $("[data-widget=gump]");
const gumpItems = $("#gump-items");
const gumpCount = $("#gump-count");
const countEl = $("#quest-count");
const listEl = $("#quest-list");
const tallyEl = $("#quest-tally");

const items = new Map<string, Item>();
const respawnTimers = new Map<string, number>(); // reagent id -> timer of its return
/** phone id -> reagent id + grab offset from the cursor tip; `inBag` = a phone rearranging inside the open bag */
const held = new Map<string, { id: string; ox: number; oy: number; inBag: boolean }>();
let hooks: Hooks;
let complete = false;
let level = 1; // set by levels.ts; a full bag only "completes" in level 1
export function setQuestLevel(n: number) {
  level = n;
}

// ---------- persistence ----------
type Saved = Record<string, { x: number; y: number; collected: boolean; gx: number; gy: number; charges?: number; gone?: boolean }>;
function save() {
  const out: Saved = {};
  for (const [id, it] of items) out[id] = { x: it.x, y: it.y, collected: it.collected, gx: it.gx, gy: it.gy, charges: it.charges, gone: it.gone };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
}
function load(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

// ---------- geometry ----------
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
function randomOverlayPos() {
  return { x: rand(60, innerWidth - icon() - 60), y: rand(110, innerHeight - icon() - 60) };
}
function randomGumpPos() {
  return { gx: rand(4, GUMP_W - ICON_BASE - 4), gy: rand(4, GUMP_H - ICON_BASE - 4) };
}
function inset(r: DOMRect, f: number) {
  return new DOMRect(r.left + r.width * f, r.top + r.height * f, r.width * (1 - 2 * f), r.height * (1 - 2 * f));
}
/** Drop zones: the closed pack (inset) and, when open, the gump interior (inset). */
export function dropZones(): DOMRect[] {
  const z = [inset(pack.getBoundingClientRect(), ZONE_INSET)];
  if (isGumpOpen()) z.push(inset(gumpItems.getBoundingClientRect(), GUMP_INSET));
  return z;
}
/** The pack's own zone (kept for tests). */
export function dropZone(): DOMRect {
  return dropZones()[0];
}
function centreInZone(it: Item) {
  const cx = it.x + icon() / 2;
  const cy = it.y + icon() / 2;
  return dropZones().some((z) => cx >= z.left && cx <= z.right && cy >= z.top && cy <= z.bottom);
}

// ---------- gump (open backpack) ----------
export function isGumpOpen() {
  return gump.classList.contains("open");
}
export function openGump() {
  if (isGumpOpen()) return;
  gump.classList.add("open");
  sfx("bag-open");
  gump.classList.remove("pop");
  void gump.offsetWidth;
  gump.classList.add("pop");
}
export function closeGump() {
  gump.classList.remove("open");
}
export function toggleGump() {
  if (isGumpOpen()) closeGump();
  else openGump();
}
/** Where a reagent is on screen: loose ones directly, collected ones only while the bag is open. */
function screenPos(it: Item): { x: number; y: number } | null {
  if (it.gone) return null;
  if (!it.collected) return { x: it.x, y: it.y };
  if (!isGumpOpen()) return null;
  const g = gumpItems.getBoundingClientRect(); // already scaled by the bag's transform
  return { x: g.left + it.gx * stage(), y: g.top + it.gy * stage() };
}
function hitReagent(px: number, py: number): Item | undefined {
  if (level === 0) return undefined; // level 0: the reagents are hidden (CSS), nothing to grab
  let best: Item | undefined;
  for (const it of items.values()) {
    if (it.heldBy) continue;
    const p = screenPos(it);
    if (!p) continue;
    if (px >= p.x - GRAB_PAD && px <= p.x + icon() + GRAB_PAD && py >= p.y - GRAB_PAD && py <= p.y + icon() + GRAB_PAD) best = it;
  }
  return best;
}

// ---------- rendering ----------
function render(it: Item) {
  it.el.classList.toggle("gone", it.gone);
  if (it.collected) {
    if (it.el.parentElement !== gumpItems) gumpItems.appendChild(it.el);
    it.el.style.transform = `translate(${it.gx}px, ${it.gy}px)`;
  } else {
    if (it.el.parentElement !== layer) layer.appendChild(it.el);
    it.el.style.transform = `translate(${it.x}px, ${it.y}px)`;
  }
}
/** Credit: reagents currently in the bag, by who delivered them. Sorted, best first. */
export function tally(): { by: string; name: string; color: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items.values()) if (it.collected && it.deliveredBy) counts.set(it.deliveredBy, (counts.get(it.deliveredBy) ?? 0) + 1);
  return [...counts]
    .map(([by, count]) => ({ by, count, ...labelFor(by) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function creditOf(by: string) {
  return tally().find((t) => t.by === by)?.count ?? 0;
}
/** Ids of the reagents currently in the bag (the spellbook's stock). A phone rearranging one inside still counts. */
export function bagContents(): string[] {
  return [...items.values()].filter((i) => i.collected).map((i) => i.def.id);
}
/** Charges left per reagent in the bag (for the phones' stock row). */
export function bagCharges(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items.values()) if (it.collected) out[it.def.id] = it.charges;
  return out;
}
/** `body.reagent-gone` while a limited reagent is spent: shows the Respawn button in the devtools panel, named. */
function updateGone() {
  const gone = [...items.values()].filter((i) => i.gone);
  document.body.classList.toggle("reagent-gone", gone.length > 0);
  $("#dev-respawn").textContent = `Respawn ${gone.map((i) => i.def.name).join(" & ") || "reagent"} now`;
}
/** A spent limited reagent waits a random time in its `respawn` range, then returns on its own. */
function scheduleRespawn(it: Item) {
  const [lo, hi] = it.def.respawn ?? [60, 60];
  const ms = (lo + Math.random() * (hi - lo)) * 1000;
  it.returnAt = Date.now() + ms;
  window.clearTimeout(respawnTimers.get(it.def.id));
  respawnTimers.set(it.def.id, window.setTimeout(() => bringBack([it]), ms));
}
function clearRespawns() {
  for (const t of respawnTimers.values()) window.clearTimeout(t);
  respawnTimers.clear();
  for (const it of items.values()) it.returnAt = 0;
}
/** Gone reagents land back on the overlay, loose, with a burst; phones are told. */
function bringBack(list: Item[]): string[] {
  const names: string[] = [];
  for (const it of list) {
    if (!it.gone) continue;
    window.clearTimeout(respawnTimers.get(it.def.id));
    respawnTimers.delete(it.def.id);
    it.gone = false;
    it.returnAt = 0;
    it.collected = false;
    Object.assign(it, randomOverlayPos());
    render(it);
    burstAt(it.x + icon() / 2, it.y + icon() / 2);
    names.push(it.def.name);
  }
  if (names.length) {
    updateGone();
    renderCounter();
    save();
    hooks.send({ type: "respawn", names });
    document.dispatchEvent(new CustomEvent("bag-changed"));
  }
  return names;
}
/** The Seer brings every spent reagent back now (the goals-card button, devtools). */
export function respawnGone(): string[] {
  return bringBack([...items.values()].filter((i) => i.gone));
}
/** For the phones' stock row: ms until each gone reagent returns by itself. */
export function returningReagents(): Record<string, number> {
  const out: Record<string, number> = {};
  const now = Date.now();
  for (const it of items.values()) if (it.gone && it.returnAt) out[it.def.id] = Math.max(0, it.returnAt - now);
  return out;
}
/** The number on the icon inside the bag; hidden for a single charge (the old look). */
function renderCharges(it: Item) {
  const b = it.el.querySelector<HTMLElement>(".charges");
  if (b) b.textContent = it.collected && it.charges > 1 ? `×${it.charges}` : "";
}
/**
 * Spend reagents from the bag (a spell was cast). Each one loses a charge; one
 * on its last charge leaves the bag and lands at a random spot on the overlay
 * (a phone holding it inside the bag loses its grip and is told). Returns where
 * the thrown-out ones landed. The pack glow goes if the bag is no longer full;
 * the level is unaffected.
 */
export function spendReagents(ids: string[]): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  let changed = false;
  for (const id of ids) {
    const it = items.get(id);
    if (!it || !it.collected) continue;
    changed = true;
    if (it.charges > 1) {
      it.charges--;
      renderCharges(it);
      it.el.classList.remove("spent");
      void it.el.offsetWidth;
      it.el.classList.add("spent");
      continue;
    }
    if (it.heldBy && it.heldBy !== "mouse") {
      const by = it.heldBy;
      held.delete(by);
      it.heldBy = null;
      it.el.classList.remove("grabbed");
      hooks.send({ type: "drop", to: by, kind: "reagent", name: it.def.name, collected: false, spent: true, slipped: false, score: creditOf(by) });
    }
    it.collected = false;
    it.deliveredBy = null;
    it.charges = 0;
    renderCharges(it);
    if (it.def.respawn) {
      // Limited: off the overlay until it comes back by itself (or the Seer brings it back).
      it.gone = true;
      render(it);
      scheduleRespawn(it);
      continue;
    }
    Object.assign(it, randomOverlayPos());
    render(it);
    spots.push({ x: it.x + icon() / 2, y: it.y + icon() / 2 });
  }
  if (changed) {
    updateGone();
    if (complete && ![...items.values()].every((i) => i.collected)) setComplete(false);
    renderCounter();
    save();
    document.dispatchEvent(new CustomEvent("bag-changed"));
  }
  return spots;
}
function renderCounter() {
  const got = [...items.values()].filter((i) => i.collected).length;
  countEl.textContent = `${got} / ${items.size}`;
  gumpCount.textContent = `${got} / ${items.size}`;
  badge.textContent = String(got);
  badge.classList.toggle("empty", got === 0);
  listEl.innerHTML = REAGENTS.map((d) => `<li class="${items.get(d.id)?.collected ? "got" : ""}">${d.name}</li>`).join("");
  const t = tally();
  tallyEl.innerHTML = t.length
    ? t.map((e) => `<li><span class="swatch" style="background:${e.color}"></span>${e.name} <b>${e.count}</b></li>`).join("")
    : `<li class="none">nobody has delivered anything yet</li>`;
}
export function renderTally() {
  renderCounter();
}
function updateHot() {
  let hot = false;
  for (const it of items.values()) if (it.heldBy && !it.collected && centreInZone(it)) hot = true;
  backpack.classList.toggle("hot", hot);
}

// ---------- game actions ----------
/**
 * Pick a reagent up at (grabX, grabY). The mouse takes a reagent out of the open
 * bag (it stops counting, the credit goes); a phone holding one inside the bag
 * only rearranges it: it stays collected and the frame loop keeps it inside.
 */
function grab(it: Item, by: string, grabX: number, grabY: number, color?: string) {
  const p = screenPos(it);
  if (!p) return;
  const inBag = it.collected && by !== "mouse";
  const wasInStock = it.collected; // either way it leaves the spellbook's stock while held
  if (it.collected && !inBag) {
    it.collected = false;
    it.deliveredBy = null; // whoever delivered it loses the credit
    it.charges = 0;
    renderCharges(it);
    it.x = p.x;
    it.y = p.y;
    render(it);
    renderCounter();
    if (complete) setComplete(false);
    save();
  }
  it.heldBy = by;
  held.set(by, { id: it.def.id, ox: p.x - grabX, oy: p.y - grabY, inBag });
  it.el.classList.add("grabbed");
  it.el.style.setProperty("--grab", color ?? "#f1d271");
  sfx("grab");
  if (wasInStock && !inBag) document.dispatchEvent(new CustomEvent("bag-changed")); // rearranging changes nothing
}
function drop(by: string): { name: string; collected: boolean; score: number; kept?: boolean } | null {
  const h = held.get(by);
  if (!h) return null;
  held.delete(by);
  const it = items.get(h.id)!;
  it.heldBy = null;
  it.el.classList.remove("grabbed");
  it.movedAt = Date.now();
  if (h.inBag) {
    // Rearranged inside the bag: nothing to count, the credit and the charges are untouched.
    render(it);
    save();
    sfx("drop");
    return { name: it.def.name, collected: true, kept: true, score: creditOf(by) };
  }
  let collected = false;
  if (centreInZone(it)) {
    it.collected = true;
    it.deliveredBy = by;
    it.charges = chargesFor(it.def);
    renderCharges(it);
    collected = true;
    // Dropped into the open bag: keep the exact spot. Dropped on the icon: random spot.
    const g = isGumpOpen() ? gumpItems.getBoundingClientRect() : null;
    const cx = it.x + icon() / 2;
    const cy = it.y + icon() / 2;
    if (g && cx >= g.left && cx <= g.right && cy >= g.top && cy <= g.bottom) {
      // screen px -> the bag's own (unscaled) coordinates
      it.gx = Math.max(0, Math.min(GUMP_W - ICON_BASE, (it.x - g.left) / stage()));
      it.gy = Math.max(0, Math.min(GUMP_H - ICON_BASE, (it.y - g.top) / stage()));
    } else {
      Object.assign(it, randomGumpPos());
    }
    it.el.classList.add("collected");
    setTimeout(() => it.el.classList.remove("collected"), 700);
  }
  sfx(collected ? "collect" : "drop");
  render(it);
  renderCounter();
  updateHot();
  save();
  if (collected && [...items.values()].every((i) => i.collected)) setComplete(true);
  if (collected) document.dispatchEvent(new CustomEvent("bag-changed"));
  // Dropped onto the moongate (mouse or phone): the reagent itself is teleported
  // to a random free spot; the cursor that dropped it stays put.
  if (!collected && onGate(it.x + icon() / 2, it.y + icon() / 2)) {
    gateTeleport(mover(it), { x: it.x + icon() / 2, y: it.y + icon() / 2 });
  }
  return { name: it.def.name, collected, score: creditOf(by) };
}
/** Callback that lands a loose reagent centred on a point (no-op if it was taken meanwhile). */
function mover(it: Item) {
  return (p: { x: number; y: number }) => {
    if (it.collected || it.heldBy) return;
    it.x = p.x - icon() / 2;
    it.y = p.y - icon() / 2;
    it.movedAt = Date.now();
    render(it);
    save();
  };
}
// ---------- the horde (level 3) ----------
/** A reagent in a monster's hands: follow it, fall where it dies, or go through the gate. */
export type Loot = { id: string; name: string; carry: (p: { x: number; y: number }) => void; drop: () => void; escape: () => { x: number; y: number } | null };
/** Centre of the pack icon (the horde's target), or null while the widgets are hidden. */
export function packCentre(): { x: number; y: number } | null {
  const r = pack.getBoundingClientRect();
  if (!r.width) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
/**
 * A monster at (x, y) takes a random reagent out of the bag (not one a phone is
 * rearranging). It stops counting at once (credit and charges go) and nobody
 * can grab it while the horde has it. Null if the bag is empty.
 */
export function stealReagent(x: number, y: number): Loot | null {
  const pool = [...items.values()].filter((i) => i.collected && !i.heldBy);
  if (!pool.length) return null;
  const it = pool[Math.floor(Math.random() * pool.length)];
  it.collected = false;
  it.deliveredBy = null;
  it.charges = 0;
  renderCharges(it);
  it.heldBy = "horde";
  it.x = x - icon() / 2;
  it.y = y - icon() / 2;
  it.el.classList.add("stolen");
  render(it);
  renderCounter();
  if (complete) setComplete(false);
  save();
  document.dispatchEvent(new CustomEvent("bag-changed"));
  const mine = () => it.heldBy === "horde";
  const free = () => {
    it.heldBy = null;
    it.el.classList.remove("stolen");
  };
  return {
    id: it.def.id,
    name: it.def.name,
    carry: (p) => {
      if (!mine()) return;
      it.x = p.x - icon() / 2;
      it.y = p.y - icon() / 2;
      render(it);
    },
    drop: () => {
      if (!mine()) return;
      free();
      render(it);
      save();
    },
    escape: () => {
      if (!mine()) return null;
      free();
      Object.assign(it, randomOverlayPos());
      render(it);
      save();
      return { x: it.x + icon() / 2, y: it.y + icon() / 2 };
    },
  };
}
/** Scatter, fill, reset: whatever the horde (or a bird) was carrying is let go where it is. */
function releaseHorde() {
  for (const it of items.values()) {
    if (it.heldBy !== "horde" && it.heldBy !== "bird") continue;
    it.heldBy = null;
    it.el.classList.remove("stolen", "lifted");
  }
}

// ---------- level 1 antagonists (cat.ts: Ginger bats them about; signpost.ts: the birds steal) ----------
/** Loose things on the overlay for the antagonists: reagents (not in the bag, in nobody's hands, not gone) and trinkets; centres, when each last moved, `fav` = Ginger's favourite. */
export function looseReagents(): { id: string; name: string; x: number; y: number; movedAt: number; fav?: boolean }[] {
  const out: { id: string; name: string; x: number; y: number; movedAt: number; fav?: boolean }[] = [];
  if (level > 0) {
    // level 0 hides the reagents (CSS only): Ginger and the birds must not see them
    for (const it of items.values()) {
      if (it.collected || it.heldBy || it.gone) continue;
      out.push({ id: it.def.id, name: it.def.name, x: it.x + icon() / 2, y: it.y + icon() / 2, movedAt: it.movedAt });
    }
  }
  return out.concat(looseTrinkets());
}
/** Things in a Seeker's hands out on the stage (not the mouse, not inside the bag): centres and the carrier. */
export function carriedReagents(): { id: string; name: string; x: number; y: number; by: string }[] {
  const out: { id: string; name: string; x: number; y: number; by: string }[] = [];
  for (const [by, h] of held) {
    if (by === "mouse" || h.inBag) continue;
    const it = items.get(h.id)!;
    out.push({ id: it.def.id, name: it.def.name, x: it.x + icon() / 2, y: it.y + icon() / 2, by });
  }
  return out.concat(carriedTrinkets());
}
/** How far the Seekers have carried reagents since the last call (px), then zero. */
export function takeDragPx(): number {
  const v = dragPx;
  dragPx = 0;
  return v;
}
/** Ginger bats a loose reagent: it slides to `to` (its centre, kept on screen) with a wobble. False if it was taken meanwhile. */
export function batReagent(id: string, to: { x: number; y: number }): boolean {
  if (isTrinketId(id)) return batTrinket(id, to);
  const it = items.get(id);
  if (!it || it.collected || it.heldBy || it.gone) return false;
  const half = icon() / 2;
  it.x = Math.max(8, Math.min(innerWidth - icon() - 8, to.x - half));
  it.y = Math.max(60, Math.min(innerHeight - icon() - 8, to.y - half));
  it.el.classList.add("batted"); // a transition on the slide
  it.movedAt = Date.now();
  render(it);
  save();
  for (const img of it.el.querySelectorAll("img")) img.animate([{ rotate: "0deg" }, { rotate: "-24deg" }, { rotate: "16deg" }, { rotate: "0deg" }], { duration: 650, easing: "ease-out" });
  window.setTimeout(() => it.el.classList.remove("batted"), 700);
  return true;
}
/** A bird (signpost.ts) lifts a loose reagent: carry it, drop it where it is. Null if it is not loose. */
export function liftReagent(id: string, by = "bird"): Loot | null {
  if (isTrinketId(id)) return liftTrinket(id, by);
  const it = items.get(id);
  if (!it || it.collected || it.heldBy || it.gone) return null;
  return lootHandle(it, by);
}
/** A bird snatches a reagent out of a Seeker's hands (never the mouse, never inside the bag): the grip is broken. Null if it cannot. */
export function snatchReagent(id: string, by = "bird"): (Loot & { from: string }) | null {
  if (isTrinketId(id)) return snatchTrinket(id, by);
  const it = items.get(id);
  if (!it || it.collected || it.gone || !it.heldBy || it.heldBy === "mouse") return null;
  const h = held.get(it.heldBy);
  if (!h || h.inBag) return null;
  const from = it.heldBy;
  held.delete(from);
  it.el.classList.remove("grabbed");
  it.heldBy = null;
  return { ...lootHandle(it, by), from };
}
function lootHandle(it: Item, by: string): Loot {
  it.heldBy = by;
  it.el.classList.add("lifted");
  const mine = () => it.heldBy === by;
  const free = () => {
    it.heldBy = null;
    it.el.classList.remove("lifted");
    it.movedAt = Date.now();
  };
  return {
    id: it.def.id,
    name: it.def.name,
    carry: (p) => {
      if (!mine()) return;
      it.x = p.x - icon() / 2;
      it.y = p.y - icon() / 2;
      render(it);
    },
    drop: () => {
      if (!mine()) return;
      free();
      render(it);
      save();
    },
    escape: () => {
      if (!mine()) return null;
      free();
      Object.assign(it, randomOverlayPos());
      render(it);
      save();
      return { x: it.x + icon() / 2, y: it.y + icon() / 2 };
    },
  };
}

/** Presenter/test helper: put a loose reagent at a point on the overlay. */
export function placeReagent(id: string, x: number, y: number) {
  const it = items.get(id);
  if (!it || it.collected || it.heldBy || it.gone) return false;
  it.x = x - icon() / 2;
  it.y = y - icon() / 2;
  it.movedAt = Date.now();
  render(it);
  save();
  return true;
}
/** A full bag. In level 1 that beats the level (levels.ts takes it from here); later it is just a glow. */
function setComplete(on: boolean) {
  complete = on;
  document.body.classList.toggle("quest-complete", on);
  if (on && level === 1) {
    const top = tally()[0];
    document.dispatchEvent(new CustomEvent("quest-complete", { detail: { top: top?.name ?? null } }));
    hooks.send({ type: "quest", state: "complete", top: top?.name ?? null });
  }
}
export function isQuestComplete() {
  return complete;
}

/**
 * Every reagent into the bag at once with full charges (ones already there are topped
 * up); `by` gets the credit for the new ones, null for nobody. Level 3 opens with this
 * (Bobby 2026-10-02: casting must be possible at once); devtools too. Level 1 completes as usual.
 */
export function fillBag(by: string | null): number {
  for (const b of [...held.keys()]) drop(b);
  releaseHorde();
  clearRespawns();
  let n = 0;
  for (const it of items.values()) {
    if (it.collected) {
      if (it.charges < chargesFor(it.def)) {
        it.charges = chargesFor(it.def);
        renderCharges(it);
      }
      continue;
    }
    it.gone = false;
    it.collected = true;
    it.deliveredBy = by;
    it.charges = chargesFor(it.def);
    Object.assign(it, randomGumpPos());
    render(it);
    renderCharges(it);
    n++;
  }
  updateGone();
  renderCounter();
  save();
  if (!complete) setComplete(true);
  document.dispatchEvent(new CustomEvent("bag-changed"));
  return n;
}
/** Devtools: the fill, delivered by the Seer. */
export function devFillBag() {
  fillBag("mouse");
}
/**
 * Teleport (Bobby 2026-10-02): loose reagents in the region fly into the bag instead of
 * through the gate, delivered by the caster (credit), with charges. Returns their names
 * and where they were (for the bursts).
 */
export function teleportReagentsToBag(inRegion: (x: number, y: number) => boolean, by: string): { name: string; x: number; y: number }[] {
  const out: { name: string; x: number; y: number }[] = [];
  for (const it of items.values()) {
    if (it.collected || it.heldBy || it.gone) continue;
    const cx = it.x + icon() / 2;
    const cy = it.y + icon() / 2;
    if (!inRegion(cx, cy)) continue;
    it.collected = true;
    it.deliveredBy = by;
    it.charges = chargesFor(it.def);
    Object.assign(it, randomGumpPos());
    render(it);
    renderCharges(it);
    it.el.classList.add("collected");
    window.setTimeout(() => it.el.classList.remove("collected"), 700);
    out.push({ name: it.def.name, x: cx, y: cy });
  }
  if (out.length) {
    renderCounter();
    updateHot();
    save();
    if ([...items.values()].every((i) => i.collected)) setComplete(true);
    document.dispatchEvent(new CustomEvent("bag-changed"));
  }
  return out;
}
/**
 * Ginger's ultimate turns monsters into sulfurous ash: +n charges on the ash in the bag,
 * or the ash lands in the bag with n charges if it was loose (never while someone holds it).
 */
export function addCharges(id: string, n: number, by: string | null): boolean {
  const it = items.get(id);
  if (!it || it.gone) return false;
  if (it.collected) {
    it.charges += n;
  } else {
    if (it.heldBy) return false;
    it.collected = true;
    it.deliveredBy = by;
    it.charges = n;
    Object.assign(it, randomGumpPos());
    render(it);
  }
  renderCharges(it);
  it.el.classList.remove("collected");
  void it.el.offsetWidth;
  it.el.classList.add("collected");
  window.setTimeout(() => it.el.classList.remove("collected"), 700);
  renderCounter();
  save();
  if (!complete && [...items.values()].every((i) => i.collected)) setComplete(true);
  document.dispatchEvent(new CustomEvent("bag-changed"));
  return true;
}

/** Scatter every reagent back onto the overlay and clear progress (part of the Seer's reset, levels.ts). */
export function scatterReagents() {
  for (const by of [...held.keys()]) drop(by);
  releaseHorde();
  clearRespawns();
  for (const it of items.values()) {
    it.collected = false;
    it.gone = false;
    it.deliveredBy = null;
    it.charges = 0;
    renderCharges(it);
    Object.assign(it, randomOverlayPos());
    render(it);
  }
  updateGone();
  setComplete(false);
  renderCounter();
  save();
  hooks.send({ type: "quest", state: "reset" });
  document.dispatchEvent(new CustomEvent("quest-reset"));
  document.dispatchEvent(new CustomEvent("bag-changed"));
}

// ---------- phone entry points (called from main.ts) ----------
export function questHold(phoneId: string): { name: string; id: string } | null {
  const c = getCursor(phoneId);
  if (!c || held.has(phoneId)) return null;
  const it = hitReagent(c.x, c.y);
  if (!it) return null;
  grab(it, phoneId, c.x, c.y, c.color);
  return { name: it.def.name, id: it.def.id };
}
export function questRelease(phoneId: string) {
  return drop(phoneId);
}
export function questDropAll() {
  for (const by of [...held.keys()]) drop(by);
}

// Double-tap with the cursor on the pack opens the gump. Phones can only open
// (never close), and opens are rate limited so a spammer cannot make it flicker.
const lastOpenByPhone = new Map<string, number>();
let lastOpenAny = 0;
export function questDoubleTap(phoneId: string): "opened" | "ignored" | null {
  const c = getCursor(phoneId);
  if (!c) return null;
  const r = pack.getBoundingClientRect();
  const onPack = c.x >= r.left - PACK_PAD && c.x <= r.right + PACK_PAD && c.y >= r.top - PACK_PAD && c.y <= r.bottom + PACK_PAD;
  if (!onPack) return null;
  const now = Date.now();
  if (isGumpOpen() || now - (lastOpenByPhone.get(phoneId) ?? 0) < OPEN_COOLDOWN_PHONE_MS || now - lastOpenAny < OPEN_COOLDOWN_ANY_MS) {
    return "ignored";
  }
  lastOpenByPhone.set(phoneId, now);
  lastOpenAny = now;
  openGump();
  return "opened";
}

// Carried reagents follow the *displayed* (smoothed) cursor each frame. One
// held inside the bag is clamped to the bag interior: phones rearrange, never remove.
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
onCursorFrame((cursors) => {
  let any = false;
  for (const [by, h] of held) {
    const c = cursors.get(by);
    if (!c) continue;
    const it = items.get(h.id)!;
    if (h.inBag) {
      if (!isGumpOpen()) continue; // the Seer closed the bag meanwhile: it stays where it was
      const g = gumpItems.getBoundingClientRect();
      it.gx = clamp((c.x + h.ox - g.left) / stage(), 0, GUMP_W - ICON_BASE);
      it.gy = clamp((c.y + h.oy - g.top) / stage(), 0, GUMP_H - ICON_BASE);
      render(it);
      continue;
    }
    const nx = c.x + h.ox;
    const ny = c.y + h.oy;
    if (by !== "mouse") dragPx += Math.hypot(nx - it.x, ny - it.y); // the Seekers' dragging draws Ginger
    it.x = nx;
    it.y = ny;
    render(it);
    any = true;
  }
  if (any) updateHot();
});

// ---------- presenter: mouse drag of reagents (loose or in the open bag) ----------
function mouseDrag(it: Item, ev: PointerEvent) {
  if (!hooks.isInteractive() || ev.button !== 0 || it.heldBy) return;
  ev.stopPropagation(); // do not drag the widget underneath
  const el = it.el;
  el.setPointerCapture(ev.pointerId);
  grab(it, "mouse", ev.clientX, ev.clientY); // out of the bag if it was inside; drop() decides where it lands
  const move = (m: PointerEvent) => {
    const h = held.get("mouse");
    if (!h || h.id !== it.def.id) return; // the grip ended under us (a scatter, a reset): ignore the rest of the drag
    it.x = m.clientX + h.ox;
    it.y = m.clientY + h.oy;
    render(it);
    updateHot();
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

/**
 * Shimmer mask: an 8×8 chessboard (about the size of a reagent) where every
 * square gets one of four shades at random. CSS tiles it, pans it slowly and
 * wraps it; the rim is the only place it shows through, so the shade changes
 * square by square along the contour instead of sweeping across everything.
 */
function chessboardMask(): string {
  const shades = [1, 0.72, 0.5, 0.3];
  let rects = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const a = shades[Math.floor(Math.random() * shades.length)];
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="black" fill-opacity="${a}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="56" height="56" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function initQuest(h: Hooks) {
  hooks = h;
  const saved = load();
  for (const def of REAGENTS) {
    const el = document.createElement("div");
    el.className = "reagent";
    el.dataset.id = def.id;
    // Two copies behind the art carry the contour rim (steady + shimmering); see .glit in CSS.
    el.style.setProperty("--glit", def.glitter);
    el.style.setProperty("--board", chessboardMask());
    el.innerHTML =
      `<img class="glit glit-a" src="${def.src}" alt="" draggable="false" aria-hidden="true" />` +
      `<img class="glit glit-b" src="${def.src}" alt="" draggable="false" aria-hidden="true" />` +
      `<img class="art" src="${def.src}" alt="${def.name}" draggable="false" />` +
      `<span class="name">${def.name}</span>` +
      `<span class="charges"></span>`;
    el.style.animationDelay = `${-Math.random() * 2}s`; // desynchronise the twinkle
    const s = saved?.[def.id];
    const it: Item = {
      def,
      el,
      ...(s ? { x: s.x, y: s.y, collected: s.collected, gx: s.gx, gy: s.gy } : { ...randomOverlayPos(), collected: false, gx: 8, gy: 8 }),
      heldBy: null,
      movedAt: 0,
      deliveredBy: null, // credit is per session; phone ids do not survive a restart
      charges: s?.collected ? Math.max(1, s.charges ?? 1) : 0,
      gone: s?.gone ?? false,
      returnAt: 0,
    };
    items.set(def.id, it);
    el.addEventListener("pointerdown", (ev) => mouseDrag(it, ev));
    render(it);
    renderCharges(it);
    if (it.gone && def.respawn) scheduleRespawn(it); // a reload mid-wait: wait again
  }
  renderCounter();
  updateGone();
  if ([...items.values()].every((i) => i.collected)) setComplete(true);
  save();

  // Presenter/test hook: document.dispatchEvent(new CustomEvent("quest:place", { detail: { id, x, y } }))
  document.addEventListener("quest:place", (e) => {
    const d = (e as CustomEvent<{ id: string; x: number; y: number }>).detail;
    if (d) placeReagent(d.id, d.x, d.y);
  });

  // A tap on the moongate also sweeps up loose reagents lying in the gate region.
  setGateSweeper((inRegion) =>
    [...items.values()]
      .filter((it) => level > 0 && !it.collected && !it.heldBy && !it.gone && inRegion(it.x + icon() / 2, it.y + icon() / 2))
      .map((it) => ({ x: it.x + icon() / 2, y: it.y + icon() / 2, move: mover(it) })),
  );

  // Double-click the pack to look inside (UO style); the ✕ closes it.
  // Listen on the widget, not the <img>: the widget drag handler captures the
  // pointer on press, which retargets click/dblclick to the widget element.
  backpack.addEventListener("dblclick", () => {
    if (backpack.dataset.dragged) return;
    toggleGump();
  });
  $("#gump-close").addEventListener("click", closeGump);
}
