// Create Food. The spell conjures a dish at the caster's cursor; Ginger walks in
// from the left or the right edge, from any height, straight at the dish; eats
// it (the dish shrinks away); then leaves in a direction of his own choosing,
// not necessarily the one he came from (Bobby: "cats are weird"). More dishes
// queue up for the one cat. Tapping the cat (a phone cursor on him, or the
// Seer's click) makes him meow: a bubble here, a synthesized meow on that phone
// (main.ts sends `meow`). The art faces left; he is mirrored when heading right.
//
// Level 1 (Bobby 2026-10-02, "Ginger plays"): gathering alone was a little boring,
// so during level 1 he wanders in now and then, stalks a loose reagent, pounces and
// bats it BAT_PX away, sits a moment, goes for another (often the same one), and
// leaves. A dish still wins (cats eat first); lightning still scares him off.
import { getCursor } from "./cursors";
import { burstAt, gateTeleport, isGateSealed, onGate, setGateSweeper, type Movable } from "./moongate";
import { batReagent, looseReagents, takeDragPx } from "./quest";
import { perchedBirds, scareBird } from "./signpost";
import { stage } from "./stage";
import { onTrinketMoved, trinketHolder, trinketPos } from "./trinkets";
import { sfx } from "./sounds";

const WALK_SPEED = 240; // px/s at stage 1
const EAT_MS = 2600;
const CAT_W = 96; // art box at stage 1, css px
const PAD = 18; // tap tolerance around the cat
const MEOW_COOLDOWN_MS = 1500; // per phone
// Level 3 (Bobby 2026-10-02: "summoning Ginger should aid in fighting"): after his meal he
// hunts the horde for HUNT_MS (chases the nearest monster; horde.ts charms whatever comes
// within reach of him), or, when the horde is thick, unleashes the ultimate instead.
const HUNT_MS = 8000;
const HUNT_SPEED = 1.3; // × WALK_SPEED while chasing
const ULT_MIN_MONSTERS = 3; // monsters about when he finishes eating: the ultimate instead of the hunt
const ULT_MS = 3000; // must match horde.ts
// Play (levels 0 and 1): the first visit this long after the level begins, then every so often.
const PLAY_FIRST_MS: [number, number] = [20_000, 40_000];
const PLAY_EVERY_MS: [number, number] = [45_000, 90_000];
const LEVEL0_SOONER = 0.83; // the waits at level 0 (Bobby 2026-10-03: "doesn't appear often enough at level 0", +20%)
const STALK_SPEED = 0.45; // × WALK_SPEED, creeping up
const POUNCE_R = 120; // px (× stage): from here he pounces
const POUNCE_SPEED = 2.6; // × WALK_SPEED
const BAT_PX = 150; // how far the reagent goes (Bobby: ~150 px)
const BAT_SPREAD = 0.6; // radians either side of straight on
const SIT_MS: [number, number] = [1500, 3500];
const ROUNDS: [number, number] = [2, 4]; // reagents batted per visit
const SAME_AGAIN = 0.6; // odds he goes for the one he just batted (cats)
const FOLLOW_UP = 0.55; // odds of a quick second swipe at the same reagent right after a bat (stacks; Bobby 2026-10-03)
const FOLLOW_MARGIN = 90; // px (x stage): no follow-up when the next bat would push it this close to an edge (off the screen)
// The charge-and-bolt visit (Bobby 2026-10-03, from watching a real cat; reshaped the same
// day from his description: "charge at the item, stay on it for 2 seconds with a couple flicks
// of the tail, and then bolt off for no reason; sometimes the item would get knocked away in the
// process, unintentionally"): when he comes in from far away he creeps up, crouches, charges
// flat out, lands on the reagent and perches on it, tail flicking, then bolts off in a random
// direction, skids to a stop partway, veers off and keeps running. Bolting, his hind legs
// sometimes send the reagent off backwards (never on purpose). A toy pulled from under him
// ends the perch at once.
const SKITTISH_ODDS = 0.3; // odds a visit is the charge-and-bolt kind, never on two visits running (Bobby 2026-10-03: first "way too often" when every far entry was one, then "don't see it anymore" at a far-entry-only 0.35: now a plain chance per visit, whatever the entry)
const CROUCH_MS: [number, number] = [600, 1100]; // the tense pause before the charge
const CHARGE_SPEED = 3.2; // × WALK_SPEED
const PERCH_MS: [number, number] = [1700, 2600]; // on the reagent, tail flicking, before the bolt
const KNOCK_ODDS = 0.55; // odds the bolt knocks the reagent away
const KNOCK_PX: [number, number] = [70, 150]; // how far (× stage), roughly backwards off his heading
const KNOCK_SPREAD = 0.9; // rad either side of straight back
const BOLT_SPEED = 2.6; // × WALK_SPEED, the retreat
const BOLT_LEG_MS: [number, number] = [450, 800]; // how long he bolts before the skid
const SKID_MS = 220;
const VEER_DEG: [number, number] = [35, 70]; // the new angle off the retreat line, either side
// More emergence (Bobby 2026-10-03): half the time his prey is the freshest-moved reagent (a
// bird's drop, a Seeker's drop, his own kick); now and then his prey is a perched bird, which he
// stalks to the foot of the post and startles off; a bird landing near him gets lunged at
// (signpost.ts asks); and the Seekers' dragging brings him a little sooner (up to 15%).
const FRESH_PREY = 0.5;
const FRESH_MS = 20_000;
const BIRD_PREY = 0.25; // odds a round goes for a perched bird instead of a reagent
const FAV_PREY = 0.4; // odds he goes for his favourite trinket (the ball of yarn) when it is loose
const LUNGE_MS = 650;
// The moongate (Bobby 2026-10-03 evening: "if ginger steps across the moongate he is teleported
// and then he stands there confused and then walks off"): his paws on the gate while he is on
// the move (or the gate firing with him on it) send him through like a dropped reagent; he
// lands dazed, looking left and right with a "?", swaying, then walks off. A cooldown so the
// way out cannot bounce him straight back through.
const DAZE_MS: [number, number] = [1800, 2800];
const DAZE_TURN_MS = 450; // he looks the other way this often while dazed
const GATE_COOLDOWN_MS = 8000;
// The ankh (Bobby 2026-10-03 evening, "maybe the ankh makes some food for him too"): his paws on
// the ankh while on the move stop him: he sits and purrs PURR_MS, the ankh glows dimly under him
// (ankh.ts: never past its dim cap, so he can never awaken it alone), and at the end it conjures
// him a dish beside itself, which he eats before walking off. Not while a wave runs or the ankh
// rests on the gate (ankh.ts says), and not again for ANKH_COOLDOWN_MS.
const PURR_MS: [number, number] = [2600, 3600];
const ANKH_COOLDOWN_MS = 90_000;
// The ball of yarn (Bobby 2026-10-03 night: "if a player moves the ball of yarn there's an
// increased chance of summoning ginger and he will play with you as long as you keep moving the
// yarn and he's in the vicinity … moving the yarn while ginger is nearby will cause him to change
// plan and engage with the yarn; if you move it far away, it disengages after 5 seconds"): a
// Seeker (or the Seer) dragging the yarn may summon him while he is away; dragged within
// YARN_NEAR_R of him it makes him drop his plan and chase it, pouncing at it when he catches up
// (a yarn in a hand cannot be batted: a swat and a short sit, then the chase again; a dropped
// one is batted as usual), for as long as it keeps moving; farther than YARN_FAR_R, or still, for
// YARN_LOSE_MS and he loses interest and goes back to his own ideas.
const YARN_ID = "trinket:yarn";
const YARN_SUMMON_PX = 400; // px (× stage) of dragging that may bring him while he is away
const YARN_SUMMON_ODDS = 0.6; // per YARN_SUMMON_PX
const YARN_SUMMON_GAP_MS = 20_000; // not within this of his last visit's end
const YARN_NEAR_R = 340; // px (× stage): the yarn moving within this of him engages him
const YARN_FAR_R = 520; // px (× stage): farther than this counts as taken away
const YARN_LOSE_MS = 5000;
const YARN_SWAT_SIT_MS: [number, number] = [400, 900]; // after a swat at the held yarn, before he goes again
const DRAG_FULL = 3000; // px of Seeker dragging since his last visit that counts as "a lot"
const DRAG_SOONER = 0.15; // at "a lot", the next visit comes this much sooner (Bobby: up to 15%, not excessive)

type Food = { el: HTMLElement; x: number; y: number; ult: boolean }; // centre; `ult`: a feast cast while the horde was thick
type HordeHooks = { threats: () => { x: number; y: number }[]; ultimate: (at: { x: number; y: number }) => boolean };
type Hooks = { send: (msg: object) => void };
let hooks: Hooks = { send: () => {} };
const fx = document.getElementById("fx")!;
const foods: Food[] = [];
let horde: HordeHooks | null = null;
let cat: HTMLElement | null = null;
let catX = 0;
let catY = 0;
let vx = 0; // unit heading while leaving
let vy = 0;
let facingRight = false;
let speedMul = 1; // 2.4 while fleeing lightning
let scaredUntil = 0;
let huntUntil = 0;
let ultUntil = 0;
let state: "away" | "walking" | "eating" | "leaving" | "hunting" | "ult" | "stalking" | "pouncing" | "sitting" | "crouching" | "charging" | "perching" | "bolting" | "skidding" | "lunging" | "jumping" | "dazed" | "settling" | "purring" = "away";
// play
let playLevel = false;
let playTimer = 0;
let rounds = 0;
let target: string | null = null; // the reagent he is after
let lastBatted: string | null = null;
let followingUp = false; // mid-chain: the pounce right after a bat
let sitUntil = 0;
let skittish = false; // this visit is the charge-and-bolt kind (he came from far)
let lastSkittish = false; // the previous visit was: the next one plays
let catLevel = 0; // the game level (0: visits come LEVEL0_SOONER)
let crouchUntil = 0;
let perchUntil = 0;
let skidAt = 0;
let skidUntil = 0;
let preyBird: SVGGElement | null = null; // this round: a perched bird, stalked to the foot of the post
let preyBirdColor = "";
let lungeTo: P = { x: 0, y: 0 };
let lungeUntil = 0;
let dazeUntil = 0; // the moongate: standing there confused until then
let dazeTurnAt = 0;
let dazeAskedAgain = false;
let gateCooldownUntil = 0;
let purrUntil = 0; // the ankh: sitting and purring on it until then
let ankhCooldownUntil = 0;
/** ankh.ts registers the ankh: its region, when it is busy (a wave, or placed on the gate), how a purr lights it, where he sits on it (a paw point), where its dish goes. */
type AnkhHooks = { on: (x: number, y: number) => boolean; busy: () => boolean; purr: (dt: number) => void; purrSpot: () => P; dishSpot: () => P };
let ankh: AnkhHooks | null = null;
export function setAnkhHooks(h: AnkhHooks) {
  ankh = h;
}
// the yarn game
let yarnPlay = false; // chasing the yarn a player drags
let yarnReached = false; // he has been within YARN_FAR_R of it this game (until then he walks in from his summons)
let yarnLastMoveAt = 0; // performance.now() of the last player move of the yarn
let yarnFarSince = 0; // when it went out of range (0: within range)
let yarnDragPx = 0; // dragging tallied while he is away
let lastVisitEndAt = -1e9;
const playing = () => state === "stalking" || state === "pouncing" || state === "sitting" || state === "crouching" || state === "charging" || state === "perching" || state === "bolting" || state === "skidding" || state === "lunging" || state === "jumping" || state === "dazed" || state === "settling" || state === "purring";
/** On the move (the gate takes him only then: not eating, sitting, crouching or perching). */
const moving = () => state === "walking" || state === "stalking" || state === "pouncing" || state === "charging" || state === "bolting" || state === "skidding" || state === "leaving" || state === "hunting" || state === "lunging";

/** horde.ts registers how to find the monsters and how to start the ultimate. */
export function setHordeHooks(h: HordeHooks) {
  horde = h;
}
let raf = 0;
let lastT = 0;
let eatUntil = 0;
let bubbleTimer = 0;
const lastMeow = new Map<string, number>();

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// The signpost (Bobby 2026-10-03: "sometimes he walks in front of the signpost and it doesn't
// look right", then: "he can walk in front of the post if he's standing at the bottom of it;
// the problem is when he looks like he's floating because he overlaps with the center of the
// post, all the way up to the top/birds"): the **floating zone** is the signpost's box above
// its foot, in cat-centre coordinates (his feet FEET below his centre must stay at or below
// the foot line while his body overlaps the post's width). Decisions (the entry, the next
// prey, the way out) reject a straight path through it, and every step he takes goes through
// `stepToward`, which detours around it by the cheapest clear corner: usually below the
// foot, where he reads as walking by the post.
const signpost = document.querySelector<HTMLElement>("[data-widget=signpost]");
const PATH_TRIES = 12;
const FEET = 0.4; // his paws sit this × CAT_W below his centre (the art's paws at 107 of 120)
const BODY_HALF = 0.35; // half his body width, × CAT_W, with a little margin
const FOOT_TOL = 8; // px (× stage): feet this close above the foot line still read as standing by it
type P = { x: number; y: number };
type Box = { l: number; t: number; r: number; b: number };
function floatBox(): Box | null {
  const r = signpost?.getBoundingClientRect();
  if (!r || !r.width) return null;
  const s = stage();
  const box = { l: r.left - BODY_HALF * CAT_W * s, t: r.top - 0.5 * CAT_W * s, r: r.right + BODY_HALF * CAT_W * s, b: r.bottom - FOOT_TOL * s - FEET * CAT_W * s };
  return box.b > box.t ? box : null;
}
const inBox = (p: P, box: Box) => p.x > box.l && p.x < box.r && p.y > box.t && p.y < box.b;
/** Is a cat centred here floating in front of the post? */
function inFloat(p: P): boolean {
  const box = floatBox();
  return !!box && inBox(p, box);
}
/** Does the segment a→b cross the floating zone? (Liang–Barsky clipping.) */
function crossesPost(a: P, b: P): boolean {
  const box = floatBox();
  if (!box) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - box.l],
    [dx, box.r - a.x],
    [-dy, a.y - box.t],
    [dy, box.b - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return true;
}
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
/** A goal inside the floating zone, approached from below: the spot under it at the foot line. */
function pushOut(p: P): P {
  const box = floatBox();
  return box && inBox(p, box) ? { x: p.x, y: box.b + 2 } : p;
}
/**
 * One step of `hop` px toward `goal`, never through the floating zone: a goal inside it is
 * approached from below, and a straight line that would cross it goes via the cheapest clear
 * corner (both legs weighed, so he rounds the bottom of the post rather than cutting across).
 * Turns him to face the way he steps; returns the heading taken.
 */
function stepToward(goal: P, hop: number): P {
  const here = { x: catX, y: catY };
  let aim = pushOut(goal);
  const box = floatBox();
  if (box && crossesPost(here, aim)) {
    const m = 2;
    const corners: P[] = [
      { x: box.l - m, y: box.b + m },
      { x: box.r + m, y: box.b + m },
      { x: box.l - m, y: box.t - m },
      { x: box.r + m, y: box.t - m },
    ];
    let best: P | null = null;
    let bestLen = Infinity;
    for (const c of corners) {
      if (crossesPost(here, c)) continue;
      const second = dist(c, aim);
      const len = dist(here, c) + second + (crossesPost(c, aim) ? second : 0); // a still-blocked second leg means another corner after this one
      if (len < bestLen) {
        bestLen = len;
        best = c;
      }
    }
    if (best) aim = best;
  }
  const dx = aim.x - catX;
  const dy = aim.y - catY;
  const d = Math.hypot(dx, dy) || 1;
  const step = Math.min(hop, d);
  catX += (dx / d) * step;
  catY += (dy / d) * step;
  if (Math.abs(dx) > 1) facingRight = dx > 0;
  return { x: dx / d, y: dy / d };
}
/** A point on the left or right edge whose straight path to `to` keeps clear of the signpost (best of PATH_TRIES). */
function entryFor(to: P): P & { fromLeft: boolean } {
  const s = stage();
  let p = { x: 0, y: 0, fromLeft: true };
  for (let i = 0; i < PATH_TRIES; i++) {
    const fromLeft = Math.random() < 0.5;
    p = { x: fromLeft ? -CAT_W * s : innerWidth + CAT_W * s, y: rand(CAT_W * s * 0.6, innerHeight - CAT_W * s * 0.6), fromLeft };
    if (!crossesPost(p, to)) break;
  }
  return p;
}

/**
 * A dish appears near `at` (the caster's cursor tip), kept inside the middle half of
 * the screen so the audience cannot miss the cat (Bobby); returns where it landed.
 * The cat comes if he is not already about.
 */
export function createFood(at: { x: number; y: number }): { x: number; y: number } {
  const x = Math.max(innerWidth * 0.25, Math.min(innerWidth * 0.75, at.x));
  const y = Math.max(innerHeight * 0.25, Math.min(innerHeight * 0.75, at.y));
  // Decided at the cast (the board says how many remain): a dish put down while the horde is
  // thick is a feast, and after it he unleashes the ultimate whatever happened meanwhile.
  const ult = (horde?.threats().length ?? 0) >= ULT_MIN_MONSTERS;
  const el = document.createElement("div");
  el.className = ult ? "food ult" : "food";
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.innerHTML = `<img src="/food.svg" alt="a dish" draggable="false" />`;
  fx.appendChild(el);
  foods.push({ el, x, y, ult });
  if (state === "away") summonCat();
  else if ((state === "leaving" || state === "hunting" || playing()) && Date.now() > scaredUntil) {
    stopPlay(); // a dish beats a game
    state = "walking"; // turn back for the new dish
  }
  return { x, y };
}
/** Done eating with nothing queued: the ultimate after a feast, a hunt if monsters are about, else off he goes. */
function afterMeal(now: number, feast: boolean) {
  const threats = horde?.threats() ?? [];
  if (feast && horde?.ultimate({ x: catX, y: catY })) {
    state = "ult";
    ultUntil = now + ULT_MS;
    ensureCat().classList.add("ult");
    return;
  }
  if (threats.length) {
    state = "hunting";
    huntUntil = now + HUNT_MS;
    return;
  }
  leave();
}

function ensureCat(): HTMLElement {
  if (!cat) {
    cat = document.createElement("div");
    cat.className = "cat-walk";
    cat.innerHTML = `<div class="cat-art"><img src="/cat-ginger.svg" alt="Ginger" draggable="false" /></div><span class="bubble">meow</span>`;
    cat.addEventListener("click", () => meow()); // the Seer, in interactive mode
    fx.appendChild(cat);
    // Inline the art so CSS can reach his eyes (they glow green in the dark); the img stays if the fetch fails.
    const art = cat.querySelector<HTMLElement>(".cat-art")!;
    fetch("/cat-ginger.svg")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((svg) => {
        art.innerHTML = svg;
      })
      .catch(() => {});
  }
  return cat;
}
/** Enter from the left or the right edge, at a height from which the walk to the dish misses the signpost. */
function summonCat() {
  const el = ensureCat();
  const e = entryFor(foods[0] ?? { x: innerWidth / 2, y: innerHeight / 2 });
  catX = e.x;
  catY = e.y;
  facingRight = e.fromLeft;
  speedMul = 1;
  state = "walking";
  el.style.display = "";
  if (!raf) {
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }
}
/** Done eating: wander off at a random angle, any edge, not through the signpost. */
function leave() {
  const here = { x: catX, y: catY };
  const far = Math.hypot(innerWidth, innerHeight);
  let a = 0;
  for (let i = 0; i < PATH_TRIES; i++) {
    a = Math.random() * Math.PI * 2;
    if (!crossesPost(here, { x: catX + Math.cos(a) * far, y: catY + Math.sin(a) * far })) break;
  }
  vx = Math.cos(a);
  vy = Math.sin(a);
  stopPlay();
  state = "leaving";
  if (playLevel) scheduleVisit(PLAY_EVERY_MS);
}

// ---------- level 1: he plays with the reagents ----------
function stopPlay() {
  target = null;
  preyBird = null;
  rounds = 0;
  followingUp = false;
  skittish = false;
  yarnPlay = false;
  cat?.classList.remove("stalk", "pounce", "sit", "crouch", "charge", "perch", "skid", "purr", "startled"); // scareCat adds its own startled after this
}
function scheduleVisit(range: [number, number]) {
  window.clearTimeout(playTimer);
  const base = rand(range[0], range[1]) * (catLevel === 0 ? LEVEL0_SOONER : 1);
  const visit = () => {
    if (!playLevel) return;
    if (state === "away" && looseReagents().length) startPlay();
    else scheduleVisit(PLAY_EVERY_MS); // busy, or nothing to play with: later
  };
  // The Seekers' dragging draws him: at DRAG_SOONER of the wait, the more they have carried
  // reagents about since his last visit, the likelier he comes now rather than at the full wait.
  playTimer = window.setTimeout(() => {
    const k = Math.min(1, takeDragPx() / DRAG_FULL);
    if (Math.random() < k) visit();
    else playTimer = window.setTimeout(visit, base * DRAG_SOONER);
  }, base * (1 - DRAG_SOONER));
}
/** The freshest-moved of these, if it moved within FRESH_MS. */
function freshest<T extends { movedAt: number }>(list: T[]): T | undefined {
  const f = list.filter((r) => Date.now() - r.movedAt < FRESH_MS).sort((p, q) => q.movedAt - p.movedAt)[0];
  return f;
}
/** Where the prey is right now: the reagent's centre, or the foot of the post below a perched bird; null if it is gone. */
function preyPos(): { x: number; y: number; id?: string; name?: string } | null {
  if (yarnPlay && target === YARN_ID) {
    const p = trinketPos(YARN_ID); // held or loose: he chases it either way
    return p ? { ...p, id: YARN_ID, name: "a ball of yarn" } : null;
  }
  if (preyBird) {
    if (!perchedBirds().some((b) => b.el === preyBird) || !signpost) return null;
    const r = signpost.getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + r.width / 2, y: r.bottom + 36 * stage() };
  }
  return target ? (looseReagents().find((r) => r.id === target) ?? null) : null;
}
/** signpost.ts: a bird is landing near him; he lunges at it (true), unless he is busy with something else. */
export function catLunge(at: P): boolean {
  if (!(state === "stalking" || state === "pouncing" || state === "sitting")) return false;
  const el = ensureCat();
  lungeTo = at;
  lungeUntil = performance.now() + LUNGE_MS;
  state = "lunging";
  el.classList.remove("stalk", "sit", "pounce");
  void el.offsetWidth;
  el.classList.add("pounce");
  bubble("hss!");
  hooks.send({ type: "cat", state: "lunge" });
  return true;
}
/** He walks in from an edge to play: ROUNDS reagents, then off. The first prey is picked first, then an edge it can be reached from. */
function startPlay(): boolean {
  const loose = looseReagents().filter((r) => !inFloat(r)); // a toy in front of the post is nobody's prey
  if (state !== "away" || !loose.length) return false;
  const el = ensureCat();
  const fav = loose.find((r) => r.fav);
  const fresh = freshest(loose);
  const prey = fav && Math.random() < FAV_PREY ? fav : fresh && Math.random() < FRESH_PREY ? fresh : loose[Math.floor(Math.random() * loose.length)];
  const e = entryFor(prey);
  catX = e.x;
  catY = e.y;
  // Sometimes, never twice running: the charge-and-bolt visit (one toy, no bats); else he plays.
  skittish = !lastSkittish && Math.random() < SKITTISH_ODDS;
  lastSkittish = skittish;
  facingRight = e.fromLeft;
  speedMul = 1;
  rounds = Math.round(rand(ROUNDS[0], ROUNDS[1]));
  el.style.display = "";
  target = prey.id;
  state = "stalking";
  el.classList.add("stalk");
  if (!raf) {
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }
  return true;
}
/** The one he just batted (usually), else the nearest loose reagent he can reach without crossing the signpost; none: off he goes. */
function pickTarget() {
  const loose = looseReagents().filter((r) => !inFloat(r)); // reachable around the post now (stepToward); never one lying in front of it
  const birds = perchedBirds();
  preyBird = null;
  if (rounds <= 0 || (!loose.length && !birds.length)) {
    leave();
    return;
  }
  // Now and then a perched bird is the prey: he stalks the foot of the post and startles it off.
  if (birds.length && (!loose.length || Math.random() < BIRD_PREY)) {
    const b = birds[Math.floor(Math.random() * birds.length)];
    preyBird = b.el;
    preyBirdColor = b.color;
    target = null;
  } else {
    const fav = loose.find((r) => r.fav);
    const fresh = freshest(loose);
    const again = lastBatted && Math.random() < SAME_AGAIN ? loose.find((r) => r.id === lastBatted) : undefined;
    const nearest = loose.reduce((best, r) => (Math.hypot(r.x - catX, r.y - catY) < Math.hypot(best.x - catX, best.y - catY) ? r : best));
    target = (fav && Math.random() < FAV_PREY ? fav : fresh && Math.random() < FRESH_PREY ? fresh : (again ?? nearest)).id;
  }
  state = "stalking";
  ensureCat().classList.add("stalk");
}
/** Reached the foot of the post under the bird: a hop, the bird is off, he sits. */
function startleBird(now: number) {
  const el = ensureCat();
  el.classList.remove("pounce");
  if (preyBird && scareBird(preyBird)) {
    hooks.send({ type: "cat", state: "scare", color: preyBirdColor });
    bubble("!");
    rounds--;
  }
  preyBird = null;
  state = "sitting";
  sitUntil = now + rand(SIT_MS[0], SIT_MS[1]);
  el.classList.add("sit");
}
/** Pounced on it: it skids BAT_PX on, more or less the way he came; then he sits. */
function bat(now: number, prey: { id: string; name: string; x: number; y: number }) {
  const s = stage();
  const base = Math.atan2(prey.y - catY, prey.x - catX) + rand(-BAT_SPREAD, BAT_SPREAD);
  const el = ensureCat();
  el.classList.remove("pounce");
  if (batReagent(prey.id, { x: prey.x + Math.cos(base) * BAT_PX * s, y: prey.y + Math.sin(base) * BAT_PX * s })) {
    hooks.send({ type: "cat", state: "bat", name: prey.name, again: followingUp });
    sfx("pounce");
    lastBatted = prey.id;
    if (!followingUp && !yarnPlay) rounds--; // follow-ups are free, and so is the yarn game
    // A quick follow-up swipe at the same reagent, stacking, unless the next bat would send it off the screen.
    const next = looseReagents().find((r) => r.id === prey.id);
    if (next && Math.random() < FOLLOW_UP && !wouldLeaveScreen(next)) {
      followingUp = true;
      target = prey.id;
      state = "pouncing";
      void el.offsetWidth;
      el.classList.add("pounce");
      return;
    }
  } else if (yarnPlay) {
    // the yarn is in somebody's hand: a swat at it, told to that hand
    const holder = trinketHolder(YARN_ID);
    if (holder && holder !== "mouse") hooks.send({ type: "cat", to: holder, state: "swat" });
  }
  followingUp = false;
  state = "sitting";
  sitUntil = now + (yarnPlay ? rand(YARN_SWAT_SIT_MS[0], YARN_SWAT_SIT_MS[1]) : rand(SIT_MS[0], SIT_MS[1]));
  el.classList.add("sit");
  if (!yarnPlay) target = null; // the yarn stays his target
}

// ---------- the yarn game ----------
/** He can be talked out of these by a moving yarn (not a meal, a fright, a daze or a purr). */
const engageable = () => state === "stalking" || state === "pouncing" || state === "sitting" || state === "crouching" || state === "charging" || state === "perching" || state === "leaving";
/** The yarn is his: whatever he was doing, he stalks it now. */
function engageYarn(now: number) {
  const el = ensureCat();
  el.classList.remove("pounce", "sit", "crouch", "charge", "perch", "skid", "startled");
  skittish = false;
  followingUp = false;
  preyBird = null;
  yarnPlay = true;
  yarnReached = true; // engaged, so it is near; summonForYarn clears this
  yarnFarSince = 0;
  yarnLastMoveAt = now;
  target = YARN_ID;
  state = "stalking";
  el.classList.add("stalk");
  hooks.send({ type: "cat", state: "yarn" });
}
/** Dragging brought him: in from an edge, straight into the yarn game. */
function summonForYarn(at: P) {
  const el = ensureCat();
  const e = entryFor(at);
  catX = e.x;
  catY = e.y;
  facingRight = e.fromLeft;
  speedMul = 1;
  lastSkittish = false;
  rounds = Math.round(rand(ROUNDS[0], ROUNDS[1])); // after the yarn he may play on
  el.style.display = "";
  window.clearTimeout(playTimer); // he is here; leaving schedules the next visit
  engageYarn(performance.now());
  yarnReached = false; // he walks in until the yarn is within range; only then does distance count
  if (!raf) {
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }
}
/** Each frame of the game: the yarn gone, far (or in front of the post), or still for YARN_LOSE_MS, and he loses interest. */
function stepYarn(now: number, s: number) {
  if (!(state === "stalking" || state === "pouncing" || state === "sitting")) return;
  const y = trinketPos(YARN_ID);
  const d = y ? dist(y, { x: catX, y: catY }) : Infinity;
  if (d <= YARN_FAR_R * s) yarnReached = true;
  const far = !y || inFloat(y) || (yarnReached && d > YARN_FAR_R * s); // distance counts once he has been near it
  if (far && !yarnFarSince) yarnFarSince = now;
  if (!far) yarnFarSince = 0;
  if (far && (state === "stalking" || state === "pouncing")) {
    // out of range: he sits and watches it rather than cross the stage (the sitting branch resumes if it comes back)
    const el = ensureCat();
    el.classList.remove("stalk", "pounce");
    el.classList.add("sit");
    state = "sitting";
    sitUntil = now + 250;
  }
  const lost = yarnFarSince !== 0 && now - yarnFarSince > YARN_LOSE_MS;
  const bored = now - yarnLastMoveAt > YARN_LOSE_MS;
  if (!lost && !bored) return;
  yarnPlay = false;
  yarnFarSince = 0;
  ensureCat().classList.remove("stalk", "pounce", "sit");
  if (rounds > 0 && playLevel) pickTarget();
  else leave();
}
/** trinkets.ts: a player moved a trinket they carry (the mouse too; never a bird). */
function onYarnMoved(e: { id: string; by: string; x: number; y: number; d: number }) {
  if (e.id !== YARN_ID || e.by === "bird" || !playLevel) return;
  const now = performance.now();
  const s = stage();
  yarnLastMoveAt = now;
  if (state === "away") {
    if (now - lastVisitEndAt < YARN_SUMMON_GAP_MS) return;
    yarnDragPx += e.d;
    if (yarnDragPx < YARN_SUMMON_PX * s) return;
    yarnDragPx = 0;
    if (Math.random() < YARN_SUMMON_ODDS) summonForYarn({ x: e.x, y: e.y });
    return;
  }
  if (yarnPlay || !engageable() || Date.now() < scaredUntil) return;
  if (inFloat(e) || dist(e, { x: catX, y: catY }) > YARN_NEAR_R * s) return;
  engageYarn(now);
}
/** On top of it: he stays put for PERCH_MS, tail flicking (CSS on `.perch`), then bolts for no reason. */
function perch(now: number, prey: { id: string; name: string }) {
  const el = ensureCat();
  el.classList.remove("charge");
  el.classList.add("perch");
  state = "perching";
  perchUntil = now + rand(PERCH_MS[0], PERCH_MS[1]);
  hooks.send({ type: "cat", state: "perch", name: prey.name });
}
/** The bolt: a random heading (not through the signpost), startled by nothing; his hind legs sometimes send the reagent off backwards. */
function bolt(now: number) {
  const s = stage();
  const el = ensureCat();
  el.classList.remove("perch");
  const far = Math.hypot(innerWidth, innerHeight);
  const here = { x: catX, y: catY };
  let a = Math.random() * Math.PI * 2;
  for (let i = 0; i < PATH_TRIES; i++) {
    a = Math.random() * Math.PI * 2;
    if (!crossesPost(here, { x: catX + Math.cos(a) * far, y: catY + Math.sin(a) * far })) break;
  }
  vx = Math.cos(a);
  vy = Math.sin(a);
  const prey = target ? looseReagents().find((r) => r.id === target) : undefined;
  if (prey && Math.random() < KNOCK_ODDS) {
    const ka = a + Math.PI + rand(-KNOCK_SPREAD, KNOCK_SPREAD);
    const kd = rand(KNOCK_PX[0], KNOCK_PX[1]) * s;
    if (batReagent(prey.id, { x: prey.x + Math.cos(ka) * kd, y: prey.y + Math.sin(ka) * kd })) {
      hooks.send({ type: "cat", state: "bat", name: prey.name, kick: true });
      lastBatted = prey.id;
    }
  }
  target = null;
  skidAt = now + rand(BOLT_LEG_MS[0], BOLT_LEG_MS[1]);
  state = "bolting";
  el.classList.remove("startled");
  void el.offsetWidth;
  el.classList.add("startled");
  bubble("!");
}
/** After the skid: a new angle off the retreat line (either side), still away from his imaginary fears, not through the signpost. */
function veer() {
  const base = Math.atan2(vy, vx);
  const far = Math.hypot(innerWidth, innerHeight);
  const here = { x: catX, y: catY };
  let a = base;
  for (let i = 0; i < PATH_TRIES; i++) {
    a = base + (Math.random() < 0.5 ? -1 : 1) * (rand(VEER_DEG[0], VEER_DEG[1]) * Math.PI) / 180;
    if (!crossesPost(here, { x: catX + Math.cos(a) * far, y: catY + Math.sin(a) * far })) break;
  }
  vx = Math.cos(a);
  vy = Math.sin(a);
  speedMul = BOLT_SPEED;
  stopPlay();
  state = "leaving";
  if (playLevel) scheduleVisit(PLAY_EVERY_MS);
}
/** Would batting it again, straight on from where he stands, land it within FOLLOW_MARGIN of an edge? */
function wouldLeaveScreen(prey: P): boolean {
  const s = stage();
  const dx = prey.x - catX;
  const dy = prey.y - catY;
  const d = Math.hypot(dx, dy) || 1;
  const lx = prey.x + (dx / d) * BAT_PX * s;
  const ly = prey.y + (dy / d) * BAT_PX * s;
  const m = FOLLOW_MARGIN * s;
  return lx < m || lx > innerWidth - m || ly < 60 + m || ly > innerHeight - m;
}
// ---------- the moongate takes him ----------
/** Put down at `p` by the gate (never floating in front of the post): dazed, looking about, then off. */
function landFromGate(p: P) {
  const el = ensureCat();
  const box = floatBox();
  let x = p.x;
  if (box && inBox(p, box)) x = p.x - box.l < box.r - p.x ? box.l - 2 : box.r + 2; // sidestep out of the floating zone
  catX = x;
  catY = p.y;
  stopPlay(); // whatever he was after, the visit is over after this
  const now = performance.now();
  state = "dazed";
  dazeUntil = now + rand(DAZE_MS[0], DAZE_MS[1]);
  dazeTurnAt = now + DAZE_TURN_MS;
  dazeAskedAgain = false;
  el.classList.remove("startled");
  el.classList.add("dazed");
  bubble("?");
}
/** His paws crossed the gate on the move: the gate's star here, then at the landing, and he is placed there. */
function gateTakes(now: number) {
  const el = ensureCat();
  stopPlay();
  state = "jumping"; // frozen on the gate until the star's peak
  gateCooldownUntil = now + GATE_COOLDOWN_MS;
  el.classList.remove("startled");
  hooks.send({ type: "cat", state: "gate" });
  gateTeleport(
    (p) => {
      if (state === "jumping") landFromGate(p); // unless a reset or a fright got there first
    },
    { x: catX, y: catY },
  );
}
// ---------- the ankh feeds him ----------
/** His paws crossed the ankh's edge: he walks a little onto it first (Bobby: not just standing next to it). */
function startPurr(now: number) {
  stopPlay();
  state = "settling";
  ankhCooldownUntil = now + ANKH_COOLDOWN_MS;
  ensureCat().classList.remove("startled");
}
/** Where his centre goes to sit on the ankh: the hooks' paw point, raised by his paws. */
function purrSpot(): P {
  const p = ankh!.purrSpot();
  return { x: p.x, y: p.y - FEET * CAT_W * stage() };
}
/** On it: he sits and purrs; ankh.ts lights the ankh dimly meanwhile (step → ankh.purr). */
function beginPurr(now: number) {
  const el = ensureCat();
  state = "purring";
  purrUntil = now + rand(PURR_MS[0], PURR_MS[1]);
  el.classList.add("sit", "purr");
  bubble("prrr");
  sfx("purr");
  hooks.send({ type: "cat", state: "ankh" });
}
/** The purr done: the ankh conjures a dish beside itself (a burst there), and he goes to eat it like any dish. */
function endPurr() {
  ensureCat().classList.remove("sit", "purr");
  const landed = createFood(ankh!.dishSpot()); // a dish beats a game: he turns to it
  burstAt(landed.x, landed.y);
}
/** levels.ts: he plays during levels 0 and 1 (the trinkets are out from level 0). */
export function setCatLevel(level: number) {
  catLevel = level;
  const on = level <= 1;
  if (on === playLevel) return;
  playLevel = on;
  window.clearTimeout(playTimer);
  if (on) scheduleVisit(PLAY_FIRST_MS);
  else if (playing()) leave();
}
/** Restart (levels.ts): a new game starts without him mid-visit; he comes back on his own clock. */
export function catLeave() {
  if (playing()) leave();
}
/** Devtools: a visit right now. */
export function devCatPlay(): string {
  if (state !== "away") return playing() ? "Ginger is already playing" : "Ginger is busy";
  return startPlay() ? "Ginger comes to play" : "no loose reagent to play with";
}
export function initCat(h: Hooks) {
  hooks = h;
  onTrinketMoved(onYarnMoved);
  // Test hook (headless probes): what he is up to.
  (window as unknown as { catState: () => object }).catState = () => ({ state, target, yarnPlay, rounds });
}

function step(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const s = stage();
  const el = ensureCat();
  const stepPx = WALK_SPEED * s * dt;
  // His paws on the moongate while on the move: through he goes (not while it is sealed by the ankh, not twice in a row).
  if (moving() && now >= gateCooldownUntil && !isGateSealed() && onGate(catX, catY + FEET * CAT_W * s)) gateTakes(now);
  // His paws on the ankh while on the move: he sits and purrs, and it feeds him (not during a wave, not on the gate, not again for a while).
  if (moving() && ankh && now >= ankhCooldownUntil && !ankh.busy() && ankh.on(catX, catY + FEET * CAT_W * s)) startPurr(now);
  if (yarnPlay) stepYarn(now, s);

  if (state === "walking") {
    const f = foods[0];
    if (!f) {
      leave();
    } else {
      // Stop beside the dish, on whichever side he is coming from (under it, if it sits in front of the post).
      const spot = pushOut({ x: f.x - (f.x >= catX ? 1 : -1) * CAT_W * 0.45 * s, y: f.y });
      const d = dist(spot, { x: catX, y: catY });
      if (d <= stepPx) {
        catX = spot.x;
        catY = spot.y;
        state = "eating";
        eatUntil = now + EAT_MS;
        f.el.classList.add("eaten");
        el.classList.add("eating");
        facingRight = f.x > catX;
      } else stepToward(spot, stepPx);
    }
  } else if (state === "lunging") {
    const d = dist(lungeTo, { x: catX, y: catY });
    const hop = stepPx * POUNCE_SPEED;
    if (d > hop && now < lungeUntil) stepToward(lungeTo, hop);
    else {
      el.classList.remove("pounce");
      state = "sitting";
      sitUntil = now + 1200;
      el.classList.add("sit");
      target = null;
      preyBird = null;
    }
  } else if (state === "stalking" || state === "pouncing") {
    const prey = preyPos();
    if (!prey || (!yarnPlay && inFloat(prey))) {
      yarnPlay = false; // (the yarn vanished: so does the game; a yarn dragged in front of the post gets stepYarn's 5 s grace instead)
      pickTarget(); // somebody took it, put it in front of the post, or the bird flew: another one
    } else {
      const dx = prey.x - catX;
      const dy = prey.y - catY;
      const d = Math.hypot(dx, dy) || 1;
      if (state === "stalking" && d <= POUNCE_R * s) {
        el.classList.remove("stalk");
        if (skittish) {
          // the tense pause before the charge
          state = "crouching";
          crouchUntil = now + rand(CROUCH_MS[0], CROUCH_MS[1]);
          el.classList.add("crouch");
          facingRight = dx > 0;
        } else {
          state = "pouncing";
          el.classList.add("pounce");
        }
      }
      if (state === "stalking" || state === "pouncing") {
        const hop = stepPx * (state === "pouncing" ? POUNCE_SPEED : yarnPlay && !yarnReached ? 1 : STALK_SPEED); // summoned by the yarn, he walks in until it is within range
        const reach = CAT_W * 0.35 * s;
        if (d - reach <= hop && !crossesPost({ x: catX, y: catY }, prey)) {
          catX = prey.x - (dx / d) * reach;
          catY = prey.y - (dy / d) * reach;
          facingRight = dx > 0;
          if (preyBird) startleBird(now);
          else bat(now, prey as { id: string; name: string; x: number; y: number });
        } else stepToward(prey, hop);
      }
    }
  } else if (state === "crouching") {
    if (now >= crouchUntil) {
      state = "charging";
      el.classList.remove("crouch");
      el.classList.add("charge");
    }
  } else if (state === "charging") {
    const prey = target ? looseReagents().find((r) => r.id === target) : undefined;
    if (!prey || inFloat(prey)) leave();
    else {
      const dx = prey.x - catX;
      const dy = prey.y - catY;
      const d = Math.hypot(dx, dy) || 1;
      const hop = stepPx * CHARGE_SPEED;
      if (d <= hop && !crossesPost({ x: catX, y: catY }, prey)) {
        // on top of it, a touch past its centre
        catX = prey.x + (dx / d) * 10 * s;
        catY = prey.y + (dy / d) * 10 * s;
        facingRight = dx > 0;
        perch(now, prey);
      } else stepToward(prey, hop);
    }
  } else if (state === "perching") {
    const prey = target ? looseReagents().find((r) => r.id === target) : undefined;
    if (!prey || now >= perchUntil) bolt(now); // his time is up, or the toy was pulled from under him
  } else if (state === "bolting") {
    catX += vx * stepPx * BOLT_SPEED;
    catY += vy * stepPx * BOLT_SPEED;
    if (Math.abs(vx) > 0.2) facingRight = vx > 0;
    const m = CAT_W * s * 1.5;
    if (catX < -m || catX > innerWidth + m || catY < -m || catY > innerHeight + m) {
      stopPlay();
      state = "away";
      lastVisitEndAt = now;
      el.classList.remove("startled"); // or the next visit starts with the fright's class still on
      el.style.display = "none";
      if (playLevel) scheduleVisit(PLAY_EVERY_MS);
    } else if (now >= skidAt) {
      state = "skidding";
      skidUntil = now + SKID_MS;
      el.classList.add("skid");
    }
  } else if (state === "skidding") {
    if (now >= skidUntil) {
      el.classList.remove("skid");
      veer();
    }
  } else if (state === "settling") {
    // onto the ankh proper, then the purr (a wave or a reset meanwhile: off he goes)
    if (!ankh || ankh.busy()) leave();
    else {
      const spot = purrSpot();
      if (dist(spot, { x: catX, y: catY }) <= stepPx) {
        catX = spot.x;
        catY = spot.y;
        beginPurr(now);
      } else stepToward(spot, stepPx);
    }
  } else if (state === "purring") {
    ankh?.purr(dt); // the ankh glows under him, up to its dim cap
    if (now >= purrUntil) endPurr();
  } else if (state === "jumping") {
    // frozen on the gate; gateTeleport lands him at the star's peak
  } else if (state === "dazed") {
    if (now >= dazeTurnAt) {
      facingRight = !facingRight; // looking left, looking right
      dazeTurnAt = now + DAZE_TURN_MS;
    }
    if (!dazeAskedAgain && now >= dazeUntil - 1000) {
      dazeAskedAgain = true;
      bubble("?");
    }
    if (now >= dazeUntil) {
      el.classList.remove("dazed");
      if (foods.length) state = "walking"; // dinner was interrupted: back to it (the cooldown lets him cross)
      else leave(); // off he goes, none the wiser
    }
  } else if (state === "sitting") {
    if (now >= sitUntil) {
      el.classList.remove("sit");
      if (yarnPlay) {
        const y = trinketPos(YARN_ID);
        if (yarnReached && y && dist(y, { x: catX, y: catY }) > YARN_FAR_R * s) {
          // still out of range: keep sitting, eyes on it (stepYarn's 5 s decides)
          if (Math.abs(y.x - catX) > 1) facingRight = y.x > catX;
          sitUntil = now + 250;
          el.classList.add("sit");
        } else {
          target = YARN_ID; // back to the yarn
          state = "stalking";
          el.classList.add("stalk");
        }
      } else if (rounds > 0 && playLevel) pickTarget();
      else leave();
    }
  } else if (state === "eating") {
    if (now >= eatUntil) {
      const eaten = foods.shift();
      eaten?.el.remove();
      el.classList.remove("eating");
      if (foods.length) state = "walking";
      else afterMeal(now, !!eaten?.ult);
    }
  } else if (state === "hunting") {
    // Chase the nearest monster; horde.ts charms whatever comes within reach of him.
    const threats = horde?.threats() ?? [];
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const t of threats) {
      const d = Math.hypot(t.x - catX, t.y - catY);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (!best || now >= huntUntil) leave();
    else {
      const hop = stepPx * HUNT_SPEED;
      if (dist(best, { x: catX, y: catY }) > hop) stepToward(best, hop);
      else if (Math.abs(best.x - catX) > 1) facingRight = best.x > catX;
    }
  } else if (state === "ult") {
    if (now >= ultUntil) {
      el.classList.remove("ult");
      if (foods.length) state = "walking";
      else afterMeal(now, false); // whatever is left: a hunt, else off he goes
    }
  } else if (state === "leaving") {
    catX += vx * stepPx * speedMul;
    catY += vy * stepPx * speedMul;
    if (Math.abs(vx) > 0.2) facingRight = vx > 0;
    const m = CAT_W * s * 1.5;
    if (catX < -m || catX > innerWidth + m || catY < -m || catY > innerHeight + m) {
      state = "away";
      lastVisitEndAt = now;
      el.classList.remove("startled"); // the fright's class must not greet the next visit
      el.style.display = "none";
    }
  }
  render(now);
  if (state !== "away") raf = requestAnimationFrame(step);
}

function render(now: number) {
  const s = stage();
  const el = ensureCat();
  const walking = state === "walking" || state === "leaving" || state === "hunting" || state === "pouncing" || state === "lunging";
  const running = state === "charging" || state === "bolting";
  const bob = walking ? Math.sin(now / 90) * 3 * s : running ? Math.sin(now / 60) * 4 * s : state === "eating" ? Math.sin(now / 140) * 2 * s : state === "stalking" ? Math.sin(now / 160) * 1.5 * s : state === "perching" ? Math.sin(now / 320) * s : 0; // perched: breathing
  const tilt = walking ? Math.sin(now / 180) * 4 : running ? Math.sin(now / 120) * 6 : state === "stalking" ? Math.sin(now / 260) * 2 : state === "crouching" ? Math.sin(now / 55) * 1.5 : state === "dazed" ? Math.sin(now / 150) * 7 : 0; // the crouch: a tiny tense wiggle; dazed: a woozy sway
  el.style.transform = `translate(${catX - (CAT_W * s) / 2}px, ${catY - (CAT_W * s) / 2 + bob}px) rotate(${tilt}deg)`;
  el.classList.toggle("flip", facingRight); // the art faces left
}

/** Where Ginger is while he is about (the horde flees from him), else null. */
export function catPos(): { x: number; y: number } | null {
  return cat && state !== "away" ? { x: catX, y: catY } : null;
}
/** Is the point on the cat (while he is about)? */
export function onCat(x: number, y: number): boolean {
  if (!cat || state === "away") return false;
  const r = cat.getBoundingClientRect();
  return x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD;
}

/** A phone tapped: "meow" if its cursor is on the cat (rate limited), "quiet" if on him but too soon, null otherwise. */
export function catTap(phoneId: string): "meow" | "quiet" | null {
  const c = getCursor(phoneId);
  if (!c || !onCat(c.x, c.y)) return null;
  const now = Date.now();
  if (now - (lastMeow.get(phoneId) ?? 0) < MEOW_COOLDOWN_MS) return "quiet";
  lastMeow.set(phoneId, now);
  meow();
  return "meow";
}

/** Put a dish somewhere else (the moongate does this); the cat eating it stays beside it. */
function moveFood(f: Food, p: { x: number; y: number }) {
  const s = stage();
  f.x = p.x;
  f.y = Math.min(innerHeight - CAT_W * s * 0.6, Math.max(CAT_W * s * 0.6, p.y));
  f.el.style.transform = `translate(${f.x}px, ${f.y}px)`;
  if (state === "eating" && foods[0] === f) {
    catX = f.x - (facingRight ? 1 : -1) * CAT_W * 0.45 * s;
    catY = f.y;
  }
}
// The moongate (a tap, or the Teleport spell's gathering) moves dishes, the cat
// eating one, and the cat when he is just walking about, along with the reagents.
setGateSweeper((inRegion) => {
  const things: Movable[] = [];
  for (const f of foods) if (inRegion(f.x, f.y)) things.push({ x: f.x, y: f.y, move: (p) => moveFood(f, p) });
  if (state !== "away" && state !== "eating" && state !== "ult" && state !== "jumping" && inRegion(catX, catY)) {
    things.push({
      x: catX,
      y: catY,
      move: (p) => {
        gateCooldownUntil = performance.now() + GATE_COOLDOWN_MS;
        landFromGate(p); // the gate fired with him on it: dazed there too
      },
    });
  }
  return things;
});

/** Lightning: he drops everything and runs for the nearest edge, fast. The dish stays for next time. */
export function scareCat() {
  if (state === "away") return;
  const el = ensureCat();
  const edges = [
    { x: -1, y: 0, d: catX },
    { x: 1, y: 0, d: innerWidth - catX },
    { x: 0, y: -1, d: catY },
    { x: 0, y: 1, d: innerHeight - catY },
  ].sort((a, b) => a.d - b.d);
  const far = Math.hypot(innerWidth, innerHeight);
  const edge = edges.find((e) => !crossesPost({ x: catX, y: catY }, { x: catX + e.x * far, y: catY + e.y * far })) ?? edges[0]; // the nearest edge not across the post
  vx = edge.x;
  vy = edge.y;
  speedMul = 2.4;
  scaredUntil = Date.now() + 3000; // a new dish does not turn him back mid-flight
  if (state === "eating") foods[0]?.el.classList.remove("eaten"); // the dish grows back
  stopPlay(); // clears the play classes (crouch, charge, skid too)
  state = "leaving";
  el.classList.remove("eating", "startled", "ult");
  void el.offsetWidth;
  el.classList.add("startled");
  bubble("!");
}
function bubble(text: string) {
  const el = ensureCat();
  el.querySelector(".bubble")!.textContent = text;
  el.classList.remove("meow");
  void el.offsetWidth;
  el.classList.add("meow");
  window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => el.classList.remove("meow"), 900);
}

/** The speech bubble on the overlay. */
export function meow() {
  bubble("meow");
  sfx("meow");
}
