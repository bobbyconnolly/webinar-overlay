// Sparkle trails: the ankh's blessing. A blessed cursor sheds glowing motes
// and little stars as it moves (a comet: fat at the head, thinning behind),
// drips a few while it rests, and the whole thing decays over a minute until
// only a couple of tiny motes follow a shake. One full-screen canvas, additive
// blending, sprites pre-rendered per cursor colour (no per-particle shadows),
// so a few hundred particles stay at 60 fps.
import { getCursor } from "./cursors";
import { stage } from "./stage";

export const BLESS_MS = 60_000; // Bobby: decays over the next minute
const MAX_PARTICLES = 2500;
const GRAVITY = 70; // px/s², the slow "drip"
const DRAG = 1.6; // per second
const TELEPORT_PX = 400; // a jump bigger than this in one frame is a teleport: no comet across the screen
const GOLD = "#ffe9b0"; // tinkerbell dust, tinted with the cursor's own colour

type Trail = { id: string; color: string; start: number; lx: number; ly: number; lt: number; vx: number; vy: number; acc: number };
type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  age: number;
  rot: number;
  spin: number;
  tw: number; // twinkle frequency
  ph: number; // twinkle phase
  star: boolean; // four-pointed star, else a soft mote
  key: string; // sprite set (cursor colour)
};
type Sprites = { glow: HTMLCanvasElement; star: HTMLCanvasElement; mote: HTMLCanvasElement };

const canvas = document.getElementById("sparkles") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const trails = new Map<string, Trail>();
const particles: P[] = [];
const sprites = new Map<string, Sprites>();
let raf = 0;
let lastT = 0;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener("resize", resize);

/** 1 right after the flash, a long tail to 0 at BLESS_MS (0.08 at 50 s, 0.02 at 57 s). */
function strength(age: number) {
  const t = Math.min(1, age / BLESS_MS);
  return Math.pow(1 - t, 1.3);
}

/** Start (or restart) a cursor's trail. */
export function bless(id: string) {
  const c = getCursor(id);
  if (!c) return;
  const now = performance.now();
  trails.set(id, { id, color: c.color, start: now, lx: c.x, ly: c.y, lt: now, vx: 0, vy: 0, acc: 0 });
  c.el.classList.add("blessed");
  spritesFor(c.color);
  if (!raf) {
    lastT = now;
    raf = requestAnimationFrame(frame);
  }
}
export function isBlessed(id: string) {
  return trails.has(id);
}
export function blessedCount() {
  return trails.size;
}

function frame(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  emit(now, dt);
  simulate(dt);
  draw(now);
  if (trails.size || particles.length) raf = requestAnimationFrame(frame);
  else ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function tip(c: { x: number; y: number }) {
  return { x: c.x + 3 * stage(), y: c.y + 2 * stage() }; // the arrow's point
}

function emit(now: number, dt: number) {
  for (const t of trails.values()) {
    const c = getCursor(t.id);
    const age = now - t.start;
    if (!c || age >= BLESS_MS) {
      trails.delete(t.id);
      c?.el.classList.remove("blessed");
      continue;
    }
    const s = strength(age);
    const p = tip(c);
    const dx = p.x - t.lx;
    const dy = p.y - t.ly;
    const dist = Math.hypot(dx, dy);
    const fdt = Math.max(1, now - t.lt) / 1000;
    if (dist > TELEPORT_PX) {
      t.lx = p.x;
      t.ly = p.y;
      t.lt = now;
      t.vx = t.vy = 0;
      continue;
    }
    t.vx = t.vx * 0.6 + (dx / fdt) * 0.4;
    t.vy = t.vy * 0.6 + (dy / fdt) * 0.4;
    // Emission: a slow drip at rest (fewer near the end, never zero until it ends),
    // plus a lot per pixel of movement (a swipe lays a comet, a shake throws a cloud).
    t.acc += dt * (0.8 + 6 * s) + dist * (0.07 + 0.33 * s);
    let n = Math.min(60, Math.floor(t.acc));
    t.acc -= n;
    while (n-- > 0) spawn(t, p, dist, s);
    t.lx = p.x;
    t.ly = p.y;
    t.lt = now;
  }
}

function spawn(t: Trail, p: { x: number; y: number }, dist: number, s: number) {
  // Along the path covered this frame, so fast swipes leave no gaps.
  const k = dist > 0 ? Math.random() : 0;
  const x = t.lx + (p.x - t.lx) * k;
  const y = t.ly + (p.y - t.ly) * k;
  const back = 0.05 + Math.random() * 0.22; // thrown backwards off the head
  const ang = Math.random() * Math.PI * 2;
  const sp = (15 + Math.random() * 85) * (0.4 + 0.6 * s);
  const star = Math.random() < 0.3;
  // Big at full strength, very small near the end (Bobby: "very small too, and few").
  const size = (star ? 2.5 + Math.pow(Math.random(), 2) * 7 : 1.2 + Math.pow(Math.random(), 2) * 4.5) * (0.22 + 0.78 * s) * stage();
  const life = (0.45 + Math.random() * 1.3) * (0.45 + 0.55 * s);
  particles.push({
    x,
    y,
    vx: -t.vx * back + Math.cos(ang) * sp,
    vy: -t.vy * back + Math.sin(ang) * sp - 12,
    size,
    life,
    age: 0,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 8,
    tw: 5 + Math.random() * 10,
    ph: Math.random() * Math.PI * 2,
    star,
    key: t.color,
  });
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
}

function simulate(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }
    const d = 1 - DRAG * dt;
    p.vx *= d;
    p.vy = p.vy * d + GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
  }
}

function draw(now: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "lighter";
  // Comet heads: a soft glow on the cursor tip itself, fading with the blessing.
  for (const t of trails.values()) {
    const c = getCursor(t.id);
    if (!c) continue;
    const s = strength(now - t.start);
    const sp = spritesFor(t.color);
    const size = (22 + 34 * s) * stage();
    const p = tip(c);
    ctx.globalAlpha = 0.2 + 0.5 * s;
    ctx.drawImage(sp.glow, p.x - size / 2, p.y - size / 2, size, size);
  }
  for (const p of particles) {
    const f = 1 - p.age / p.life;
    const a = Math.pow(f, 1.1) * (0.55 + 0.45 * Math.sin(p.tw * p.age + p.ph));
    const sz = p.size * (0.35 + 0.65 * f); // shrinks as it ages: the tail thins out
    const sp = spritesFor(p.key);
    const g = sz * 3.4;
    ctx.globalAlpha = a * 0.45;
    ctx.drawImage(sp.glow, p.x - g / 2, p.y - g / 2, g, g);
    ctx.globalAlpha = a;
    if (p.star) {
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      const w = sz * 2.2;
      ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
      ctx.drawImage(sp.star, -w / 2, -w / 2, w, w);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      const w = sz * 1.7;
      ctx.drawImage(sp.mote, p.x - w / 2, p.y - w / 2, w, w);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// ---------- sprites ----------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (ch) => ch + ch) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): [number, number, number] {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t)) as [number, number, number];
}
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function spritesFor(color: string): Sprites {
  let s = sprites.get(color);
  if (s) return s;
  const tint = mix(GOLD, color, 0.45); // gold-white dust with the cursor's own hue
  const make = (size: number, paint: (c: CanvasRenderingContext2D, r: number) => void) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d")!;
    c.translate(size / 2, size / 2);
    paint(c, size / 2);
    return cv;
  };
  const glow = make(64, (c, r) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba([255, 255, 255], 0.85));
    g.addColorStop(0.25, rgba(tint, 0.5));
    g.addColorStop(0.6, rgba(tint, 0.12));
    g.addColorStop(1, rgba(tint, 0));
    c.fillStyle = g;
    c.fillRect(-r, -r, 2 * r, 2 * r);
  });
  const mote = make(32, (c, r) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, rgba(tint, 0.9));
    g.addColorStop(1, rgba(tint, 0));
    c.fillStyle = g;
    c.fillRect(-r, -r, 2 * r, 2 * r);
  });
  const star = make(64, (c, r) => {
    // Four fat points with a bright core, like the moongate's star.
    const o = r * 0.95;
    const i = r * 0.22;
    c.beginPath();
    c.moveTo(0, -o);
    c.lineTo(i, -i);
    c.lineTo(o, 0);
    c.lineTo(i, i);
    c.lineTo(0, o);
    c.lineTo(-i, i);
    c.lineTo(-o, 0);
    c.lineTo(-i, -i);
    c.closePath();
    const g = c.createRadialGradient(0, 0, 0, 0, 0, o);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, rgba([255, 255, 255].map((v, i) => Math.round((v + tint[i]) / 2)) as [number, number, number], 0.95));
    g.addColorStop(1, rgba(tint, 0.6));
    c.fillStyle = g;
    c.fill();
  });
  s = { glow, star, mote };
  sprites.set(color, s);
  return s;
}
