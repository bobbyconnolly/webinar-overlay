// Night Sight's minigame: the moonglow hunt. When night falls, a few dozen
// wisps appear in clumps; a phone cursor collects every wisp it passes over (no
// hold, just swipe through the thick of them). A scoreboard shows the counts
// while the night lasts; when it ends the leader wins, is announced, and gets a
// sparkle trail (the ankh's reward). Ties all win. The Seer's mouse does not
// compete (the wisps shy away from it all the same).
//
// The wisps are a small flock (Bobby: "slow, clustery, fluidy"): each one
// wanders on its own slowly turning heading, is weakly drawn to the wisps
// around it, matches their drift (so a clump moves as one, like a comet), keeps
// a little distance (so they slide over each other instead of stacking), slows
// when it gets ahead of its clump and speeds up when behind (the lead changes
// hands), shies away from cursors, and turns back from the screen edges. A few
// are loners. Everything is tuned by the constants below.
import { allCursors, onCursorFrame } from "./cursors";
import { labelFor } from "./identity";
import { freeSpot } from "./moongate";
import { getMouse } from "./mouse";
import { bless } from "./sparkles";
import { stage } from "./stage";
import { isGhost } from "./ghosts";
import { sfx } from "./sounds";

const COUNT = 70;
const CLUSTERS = 7;
const SIGMA = 48; // px spread around a clump centre at stage 1
const LONER_SHARE = 0.12;
const PICK_R = 26; // px from the cursor tip at stage 1
const JUMP_PX = 300; // a bigger cursor step in one frame is a teleport: no sweep across the screen

// ---- flock tuning (px and px/s at stage 1; forces in px/s²) ----
const R_SEP = 22; // closer than this: push apart
const R_COH = 150; // within this: drawn to the local centre
const R_ALI = 120; // within this: match drift
const R_EVADE = 110; // cursors this close are shied away from
const W_WANDER = 26;
const W_COH = 34;
const W_ALI = 1.4; // per second, towards the neighbours' average velocity
const W_SEP = 420;
const W_EVADE = 140;
const W_EDGE = 220;
const EDGE = 70; // start turning back this far from an edge
const DRAG = 0.6; // per second
const V_MIN = 6;
const V_MAX = 44; // times each wisp's zeal (0.7 to 1.3)
const TURN_RATE = 1.6; // rad/s of heading noise
const LEAD_SLOW = 0.3; // ahead of the clump: slow by up to this; behind: speed up
const KICK = 520; // lightning: outward burst speed at the gate, px/s at stage 1
const KICK_DECAY = 3.5; // per second: fast off the mark, settles within a second

type Hooks = { send: (msg: object) => void; announce: (text: string, color: string) => void };
type Wisp = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  th: number; // wander heading
  zeal: number; // personal top speed factor
  loner: boolean;
  size: number; // px at stage 1
  phase: number; // slow pulse
  kx: number; // a lightning kick: on top of the flock velocity, dies away fast
  ky: number;
  takenAt: number; // 0 while alive, else the time it was caught
};

const canvas = document.getElementById("moonglow") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const board = document.getElementById("moonglow-board")!;
const list = document.getElementById("moonglow-list")!;
let wisps: Wisp[] = [];
const scores = new Map<string, number>();
const last = new Map<string, { x: number; y: number }>();
let running = false;
let fadeFrom = 0; // after the night: wisps fade out until this + 1 s
let endAt = 0;
let endTimer = 0;
let hideTimer = 0;
let raf = 0;
let lastT = 0;
let hooks: Hooks | null = null;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener("resize", resize);

const tip = (c: { x: number; y: number }) => ({ x: c.x + 3 * stage(), y: c.y + 2 * stage() });
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
function gauss() {
  // Box-Muller, clipped: clumps, not a smear.
  const u = Math.random() || 1e-9;
  const v = Math.random();
  return Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
}

/** Night fell: start the hunt (or, if one is running, add wisps and extend it). */
export function startNightHunt(h: Hooks, ms: number) {
  hooks = h;
  const now = Date.now();
  window.clearTimeout(endTimer);
  window.clearTimeout(hideTimer);
  if (!running) {
    running = true;
    fadeFrom = 0;
    wisps = wisps.filter((w) => !w.takenAt);
    scores.clear();
    last.clear();
    endAt = now;
    board.classList.add("show");
  }
  endAt = Math.max(endAt, now) + ms;
  endTimer = window.setTimeout(finish, endAt - now);
  spawn(COUNT);
  renderBoard();
  if (!raf) {
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function spawn(n: number) {
  const s = stage();
  const loners = Math.round(n * LONER_SHARE);
  const centres = Array.from({ length: CLUSTERS }, () => {
    const p = freeSpot();
    // Some clumps drift from the start (a comet), others hang about.
    const moving = Math.random() < 0.5;
    const a = Math.random() * Math.PI * 2;
    const sp = moving ? rand(14, 26) * s : rand(0, 4) * s;
    return { x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
  });
  for (let k = 0; k < n; k++) {
    const loner = k < loners;
    const c = centres[k % CLUSTERS];
    const p = loner ? freeSpot() : { x: c.x + gauss() * SIGMA * s, y: c.y + gauss() * SIGMA * s };
    const th = Math.random() * Math.PI * 2;
    wisps.push({
      x: Math.max(20, Math.min(innerWidth - 20, p.x)),
      y: Math.max(70, Math.min(innerHeight - 20, p.y)),
      vx: loner ? Math.cos(th) * 8 * s : c.vx + gauss() * 3 * s,
      vy: loner ? Math.sin(th) * 8 * s : c.vy + gauss() * 3 * s,
      th,
      zeal: rand(0.7, 1.3),
      loner,
      size: rand(9, 17),
      phase: Math.random() * Math.PI * 2,
      kx: 0,
      ky: 0,
      takenAt: 0,
    });
  }
}

// ---------- the flock ----------
function simulate(dt: number) {
  const s = stage();
  const rSep = R_SEP * s;
  const rCoh = R_COH * s;
  const rAli = R_ALI * s;
  const rEv = R_EVADE * s;
  const edge = EDGE * s;
  const shy: { x: number; y: number }[] = [];
  for (const c of allCursors().values()) shy.push(tip(c));
  const m = getMouse();
  if (m) shy.push(m);

  const alive = wisps.filter((w) => !w.takenAt);
  for (const w of alive) {
    let cx = 0;
    let cy = 0;
    let nc = 0;
    let ax = 0;
    let ay = 0;
    let na = 0;
    let sx = 0;
    let sy = 0;
    for (const o of alive) {
      if (o === w) continue;
      const dx = o.x - w.x;
      const dy = o.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d < rSep && d > 0.01) {
        const k = (rSep - d) / rSep;
        sx -= (dx / d) * k;
        sy -= (dy / d) * k;
      }
      if (d < rCoh) {
        cx += o.x;
        cy += o.y;
        nc++;
      }
      if (d < rAli) {
        ax += o.vx;
        ay += o.vy;
        na++;
      }
    }
    // Wander: a slowly turning heading of its own.
    w.th += (Math.random() - 0.5) * 2 * TURN_RATE * dt;
    let fx = Math.cos(w.th) * W_WANDER * s;
    let fy = Math.sin(w.th) * W_WANDER * s;
    const social = w.loner ? 0.12 : 1;
    let lead = 0; // how far ahead of the clump along its drift, -1..1
    if (nc) {
      cx = cx / nc - w.x;
      cy = cy / nc - w.y;
      const d = Math.hypot(cx, cy) || 1;
      fx += (cx / d) * W_COH * s * social * Math.min(1, d / (rCoh * 0.5));
      fy += (cy / d) * W_COH * s * social * Math.min(1, d / (rCoh * 0.5));
      const sp = Math.hypot(w.vx, w.vy);
      if (sp > 1) lead = Math.max(-1, Math.min(1, -(cx * w.vx + cy * w.vy) / sp / (rCoh * 0.5)));
    }
    if (na) {
      fx += (ax / na - w.vx) * W_ALI * social;
      fy += (ay / na - w.vy) * W_ALI * social;
    }
    fx += sx * W_SEP * s;
    fy += sy * W_SEP * s;
    for (const p of shy) {
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < rEv && d > 0.01) {
        const k = (rEv - d) / rEv;
        fx += (dx / d) * W_EVADE * s * k;
        fy += (dy / d) * W_EVADE * s * k;
      }
    }
    if (w.x < edge) fx += ((edge - w.x) / edge) * W_EDGE * s;
    if (w.x > innerWidth - edge) fx -= ((w.x - (innerWidth - edge)) / edge) * W_EDGE * s;
    if (w.y < edge + 50) fy += ((edge + 50 - w.y) / edge) * W_EDGE * s;
    if (w.y > innerHeight - edge) fy -= ((w.y - (innerHeight - edge)) / edge) * W_EDGE * s;

    w.vx = (w.vx + fx * dt) * (1 - DRAG * dt);
    w.vy = (w.vy + fy * dt) * (1 - DRAG * dt);
    // The lead changes hands: ahead of the clump slows, behind speeds up.
    const vmax = V_MAX * s * w.zeal * (1 - LEAD_SLOW * lead);
    const vmin = V_MIN * s;
    const sp = Math.hypot(w.vx, w.vy);
    if (sp > vmax) {
      w.vx *= vmax / sp;
      w.vy *= vmax / sp;
    } else if (sp < vmin && sp > 0.01) {
      w.vx *= vmin / sp;
      w.vy *= vmin / sp;
    }
    w.kx *= 1 - KICK_DECAY * dt;
    w.ky *= 1 - KICK_DECAY * dt;
    w.x += (w.vx + w.kx) * dt;
    w.y += (w.vy + w.ky) * dt;
  }
}
/** Lightning during the night: wisps within `radius` of `centre` are blown outward hard and settle fast. */
export function thunderWisps(centre: { x: number; y: number }, radius: number) {
  if (!running) return;
  const s = stage();
  for (const w of wisps) {
    if (w.takenAt) continue;
    const dx = w.x - centre.x;
    const dy = w.y - centre.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 0.01) continue;
    const k = 0.4 + 0.6 * (1 - d / radius);
    w.kx += (dx / d) * KICK * s * k;
    w.ky += (dy / d) * KICK * s * k;
  }
}

// ---------- pickups ----------
function distToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / l2));
  return Math.hypot(px - (a.x + abx * t), py - (a.y + aby * t));
}
// Every frame a cursor moved: wisps along the path it covered are taken.
onCursorFrame((cursors) => {
  if (!running) return;
  const r = PICK_R * stage();
  const now = performance.now();
  for (const [id, c] of cursors) {
    if (isGhost(id)) continue; // a ghost passes through the moonglow
    const t = tip(c);
    let prev = last.get(id) ?? t;
    if (Math.hypot(t.x - prev.x, t.y - prev.y) > JUMP_PX) prev = t;
    last.set(id, t);
    for (const w of wisps) {
      if (w.takenAt || distToSegment(w.x, w.y, prev, t) > r) continue;
      w.takenAt = now;
      sfx("wisp", { volume: 0.6, cooldownMs: 70 });
      const n = (scores.get(id) ?? 0) + 1;
      scores.set(id, n);
      hooks?.send({ type: "glow", to: id, count: n });
    }
  }
  renderBoard();
});

// ---------- drawing ----------
let glowSprite: HTMLCanvasElement | null = null;
let coreSprite: HTMLCanvasElement | null = null;
function sprites() {
  if (glowSprite && coreSprite) return { glow: glowSprite, core: coreSprite };
  const make = (size: number, stops: [number, string][]) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d")!;
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return cv;
  };
  glowSprite = make(64, [
    [0, "rgba(255,255,255,0.9)"],
    [0.3, "rgba(191,233,255,0.55)"],
    [0.65, "rgba(120,200,255,0.12)"],
    [1, "rgba(120,200,255,0)"],
  ]);
  coreSprite = make(24, [
    [0, "rgba(255,255,255,1)"],
    [0.4, "rgba(230,248,255,0.9)"],
    [1, "rgba(191,233,255,0)"],
  ]);
  return { glow: glowSprite, core: coreSprite };
}

function frame(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (running) simulate(dt);
  wisps = wisps.filter((w) => !w.takenAt || now - w.takenAt < 450);
  draw(now);
  const fading = fadeFrom && now - fadeFrom < 1100;
  if (running || fading) raf = requestAnimationFrame(frame);
  else {
    wisps = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function draw(now: number) {
  const s = stage();
  const { glow, core } = sprites();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "lighter";
  const fade = fadeFrom ? Math.max(0, 1 - (now - fadeFrom) / 1000) : 1;
  for (const w of wisps) {
    let a = fade;
    let size = w.size * s * (1 + 0.12 * Math.sin(now / 1400 + w.phase)); // a slow breath, not a twinkle
    if (w.takenAt) {
      const k = (now - w.takenAt) / 450;
      a *= 1 - k;
      size *= 1 + 1.6 * k;
    } else {
      // A short streak behind a moving wisp: a clump on the move reads as a comet.
      const sp = Math.hypot(w.vx, w.vy);
      if (sp > 2) {
        const ux = w.vx / sp;
        const uy = w.vy / sp;
        const len = Math.min(18, sp * 0.35) * s;
        for (let k = 1; k <= 3; k++) {
          const g = size * 2.6 * (1 - k * 0.18);
          ctx.globalAlpha = a * 0.16 * (1 - k * 0.25);
          ctx.drawImage(glow, w.x - ux * len * k * 0.5 - g / 2, w.y - uy * len * k * 0.5 - g / 2, g, g);
        }
      }
    }
    const g = size * 2.6;
    ctx.globalAlpha = a * 0.75;
    ctx.drawImage(glow, w.x - g / 2, w.y - g / 2, g, g);
    const c = size * 0.9;
    ctx.globalAlpha = a;
    ctx.drawImage(core, w.x - c / 2, w.y - c / 2, c, c);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// ---------- scoreboard and the end ----------
function standings() {
  return [...scores]
    .map(([id, count]) => ({ id, count, ...labelFor(id) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
function renderBoard() {
  const t = standings();
  const left = wisps.filter((w) => !w.takenAt).length;
  list.innerHTML =
    (t.length
      ? t.map((e) => `<li><span class="swatch" style="background:${e.color}"></span>${e.name} <b>${e.count}</b></li>`).join("")
      : `<li class="none">swipe through the moonglow</li>`) + `<li class="left">${left} left</li>`;
}

function finish() {
  running = false;
  fadeFrom = performance.now();
  const t = standings();
  const top = t[0]?.count ?? 0;
  const winners = t.filter((e) => e.count === top && top > 0);
  for (const w of winners) {
    if (allCursors().has(w.id)) bless(w.id); // the ankh's reward, for the hunt's winner
  }
  const text =
    winners.length === 0
      ? "nobody caught any moonglow"
      : winners.length === 1
        ? `${winners[0].name} wins the moonglow · ${top}`
        : `${winners.map((w) => w.name).join(" & ")} share the moonglow · ${top}`;
  hooks?.announce(text, winners[0]?.color ?? "#bfe9ff");
  hooks?.send({ type: "glow", state: "end", winners: winners.map((w) => w.name), top });
  renderBoard();
  hideTimer = window.setTimeout(() => board.classList.remove("show"), 4000);
}
