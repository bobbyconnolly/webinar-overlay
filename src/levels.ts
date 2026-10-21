// Levels. The game is a sequence of goals:
//
//   level 0  the stage is bare but for the moongate, the ankh, the signpost, the
//            QR, the codex and the trinkets; the ankh pulses gold: the first
//            awakening (the usual ritual) starts level 1, and the pack and the
//            reagents burst in
//   level 1  gather the eight reagents into the backpack      (quest.ts)
//   level 2  cast every spell at least once                    (spells.ts)
//   level 3  the horde: carry the ankh to the moongate, awaken  (horde.ts)
//            it there, fight the wave; repeatable, no level after
//
// Level 1's progress shows in the goals card. From level 2 on the card is gone
// (Bobby 2026-10-03: less on the stage) and progress shows only while it changes:
// the spell strip at the top for STRIP_MS after each cast at level 2, the horde
// board during a wave at level 3. The codex heralds every level with its notes
// (codex.ts); the phones get the level's goal and first note.
//
// Beating a level shows the gold banner for BANNER_MS, then the next level comes.
// Level 3 is the group's to start and restart (the Seer never holds it). Only
// the Seer (the presenter) resets, from the pill, back to level 0. The level and
// the spells already cast persist across reloads; who cast them is per session
// (phone ids do not survive a restart, like delivery credit).
import { SPELLS, type SpellId } from "./spells";
import { fillBag, packCentre, scatterReagents, setQuestLevel, tally } from "./quest";
import { labelFor } from "./identity";
import { burstAt } from "./moongate";
import { catLeave, setCatLevel } from "./cat";
import { setBirdLevel } from "./signpost";
import { scatterTrinkets } from "./trinkets";
import { codexTip, heraldLevel, setCodexLevel } from "./codex";
import { sfx } from "./sounds";

export const BANNER_MS = 6000; // Bobby: five or six seconds
const STRIP_MS = 7000; // the spell strip stays this long after a cast
const STORAGE_KEY = "overlay.level.v1";

type Hooks = { send: (msg: object) => void };
type Who = { name: string; color: string };
let hooks: Hooks;
type Level = 0 | 1 | 2 | 3;
let level: Level = 0; // a fresh launch: level 0 (Bobby 2026-10-02)
export const LEVEL_0_GOAL = "touch the ankh together";
const GOALS = [LEVEL_0_GOAL, "gather the reagents", "cast every spell", "carry the ankh to the moongate"];
/** spell id -> who cast it first */
const cast = new Map<SpellId, Who>();
/** casts this session per caster, keyed by name */
const casts = new Map<string, Who & { count: number }>();
let mastered = false;
let bannerTimer = 0;
let advanceTimer = 0;
let stripTimer = 0;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const banner = $("#quest-banner");
const bannerText = $("#quest-banner-text");
const bannerSub = $("#quest-banner-sub");
const strip = $("#spell-strip");
const stripTitle = strip.querySelector<HTMLElement>(".mg-title")!;
const stripList = $("#spell-strip-list");

export function currentLevel() {
  return level;
}

// ---------- persistence ----------
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ level, cast: Object.fromEntries(cast) }));
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!s) return;
    if (s.level === 0 || s.level === 1 || s.level === 2 || s.level === 3) level = s.level;
    for (const [id, who] of Object.entries(s.cast ?? {})) {
      if (SPELLS.some((sp) => sp.id === id)) cast.set(id as SpellId, who as Who);
    }
    mastered = cast.size === SPELLS.length;
  } catch {
    /* nothing saved, or garbage: level 0 */
  }
}

// ---------- banner ----------
export function showBanner(text: string, sub: string, ms = BANNER_MS) {
  bannerText.textContent = text;
  bannerSub.textContent = sub;
  banner.classList.add("show");
  sfx("banner");
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => banner.classList.remove("show"), ms);
}
function hideBanner() {
  window.clearTimeout(bannerTimer);
  banner.classList.remove("show");
}

// ---------- the phones ----------
/** The level message: the goal, and the codex's first note for the level as `tip` (levels 1–3). */
function levelMsg(n: Level, to?: string): object {
  return { type: "quest", ...(to ? { to } : {}), state: "level", level: n, goal: GOALS[n], tip: codexTip(n) };
}

// ---------- the spell strip (level 2) ----------
function sortedCasts() {
  return [...casts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
function renderStrip() {
  stripTitle.textContent = `✦ spells · ${cast.size} / ${SPELLS.length} ✦`;
  stripList.innerHTML = SPELLS.map((s) => {
    const w = cast.get(s.id);
    return `<li class="${w ? "got" : ""}"${w ? ` style="--who:${w.color}" title="first cast by ${w.name}"` : ""}>${s.name}</li>`;
  }).join("");
}
/** Level 2's progress for a moment: at the level start and after each cast; never once mastered (the banner has it). */
function showStrip(ms = STRIP_MS) {
  window.clearTimeout(stripTimer);
  if (level !== 2 || mastered) {
    strip.classList.remove("show");
    return;
  }
  renderStrip();
  strip.classList.add("show");
  stripTimer = window.setTimeout(() => strip.classList.remove("show"), ms);
}
function hideStrip() {
  window.clearTimeout(stripTimer);
  strip.classList.remove("show");
}

function setLevel(n: Level) {
  level = n;
  setQuestLevel(n);
  document.body.classList.toggle("level-0", n === 0);
  document.body.classList.toggle("level-2", n >= 2);
  document.body.classList.toggle("level-3", n === 3);
  setCatLevel(n); // levels 0 and 1: Ginger plays and the birds steal
  setBirdLevel(n);
  renderStrip();
  if (n === 2) showStrip(STRIP_MS + 1000);
  else hideStrip();
  heraldLevel(n); // the codex unrolls on the level's first page
  save();
  if (n === 3) {
    // The horde is coming: the pack is filled so everyone can cast at once (Bobby 2026-10-02).
    fillBag(null);
    hooks.send({ type: "quest", state: "filled" });
  }
  document.dispatchEvent(new CustomEvent("level-changed", { detail: { level: n } })); // spells.ts opens/closes the spellbook; horde.ts arms the ankh
}

// ---------- level transitions ----------
/** quest.ts: the bag is full in level 1. Banner, then level 2. */
function onQuestComplete() {
  if (level !== 1) return;
  const top = tally()[0];
  showBanner("Thou hast gathered all the reagents", top ? `${top.name} led the way` : "");
  window.clearTimeout(advanceTimer);
  advanceTimer = window.setTimeout(() => {
    setLevel(2);
    hooks.send(levelMsg(2));
  }, BANNER_MS);
}
/** spells.ts: a phone cast a spell. */
function onSpellCast(e: Event) {
  const { spell, by } = (e as CustomEvent<{ spell: SpellId; by: string }>).detail;
  if (level < 2) return; // casting is only possible from level 2 anyway
  const who = labelFor(by);
  if (!cast.has(spell)) cast.set(spell, { name: who.name, color: who.color });
  const c = casts.get(who.name) ?? { name: who.name, color: who.color, count: 0 };
  c.count++;
  casts.set(who.name, c);
  save();
  if (!mastered && level === 2 && cast.size === SPELLS.length) {
    mastered = true;
    const top = sortedCasts()[0];
    showBanner("Thou hast mastered every spell", top ? `${top.name} cast the most` : "");
    hooks.send({ type: "quest", state: "mastered", top: top?.name ?? null });
    // Then level 3: the ankh becomes the key to the moongate (horde.ts).
    window.clearTimeout(advanceTimer);
    advanceTimer = window.setTimeout(() => {
      setLevel(3);
      hooks.send(levelMsg(3));
    }, BANNER_MS);
  }
  showStrip(); // hides it once mastered: the banner takes over
}

/** Back to level 0: the bare stage, reagents scattered (and hidden), spellbook closed, tallies cleared. The Seer only. */
export function resetGame() {
  window.clearTimeout(advanceTimer);
  hideBanner();
  cast.clear();
  casts.clear();
  mastered = false;
  setLevel(0); // closes the spellbook before the scatter broadcasts the (empty) stock
  scatterReagents(); // progress cleared; the reagents stay hidden until the ankh awakens
  scatterTrinkets(); // the knick-knacks to fresh spots
  catLeave(); // a new game starts without Ginger mid-visit (level 0 is a play level too)
  hooks.send(levelMsg(0));
}
/** Level 0 (ankh.ts): the first awakening starts the game: the pack and the reagents burst in. */
function onAnkhAwakened() {
  if (level !== 0) return;
  setLevel(1);
  scatterReagents(); // fresh spots, nothing collected
  for (const el of document.querySelectorAll<HTMLElement>("#items .reagent")) {
    const r = el.getBoundingClientRect();
    if (r.width) burstAt(r.left + r.width / 2, r.top + r.height / 2);
  }
  const pc = packCentre();
  if (pc) burstAt(pc.x, pc.y);
  hooks.send(levelMsg(1));
}
/** What a joining phone hears about the level: the goal and the codex's first note for it. */
export function levelState(id: string): object {
  return levelMsg(level, id);
}

/** Devtools: jump to a level. 0 = the full reset; 1 = the game begins without the ritual; 3 marks every spell as cast by the Seer. */
export function devSetLevel(n: Level) {
  window.clearTimeout(advanceTimer);
  hideBanner();
  if (n === 0) {
    resetGame();
    return;
  }
  if (n === 1) {
    cast.clear();
    casts.clear();
    mastered = false;
    setLevel(1);
    scatterReagents();
    hooks.send(levelMsg(1));
    return;
  }
  if (n === 3) {
    const seer = labelFor("mouse");
    for (const s of SPELLS) if (!cast.has(s.id)) cast.set(s.id, { name: seer.name, color: seer.color });
    mastered = true;
  } else {
    // A fresh level 2: nothing cast yet, so mastering it again leads to level 3 as usual.
    cast.clear();
    casts.clear();
    mastered = false;
  }
  setLevel(n);
  hooks.send(levelMsg(n));
}

/** Must run before initQuest: a full bag at startup must not re-fire level 1. */
export function initLevels(h: Hooks) {
  hooks = h;
  load();
  setQuestLevel(level);
  document.body.classList.toggle("level-0", level === 0);
  document.body.classList.toggle("level-2", level >= 2);
  document.body.classList.toggle("level-3", level === 3);
  setCatLevel(level);
  setBirdLevel(level);
  setCodexLevel(level); // the level's pages, no herald at startup
  renderStrip();
  document.addEventListener("quest-complete", onQuestComplete);
  document.addEventListener("spell-cast", onSpellCast);
  document.addEventListener("ankh-awakened", onAnkhAwakened);
  if (level >= 2) document.dispatchEvent(new CustomEvent("level-changed", { detail: { level } }));
}
