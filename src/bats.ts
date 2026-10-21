// Bats. When night falls (and the signpost's birds have fled) up to three bats
// may come: none, one, two or three with odds 10 / 20 / 50 / 20, a mean of 1.8
// ("usually two", Bobby). Each flies in along its own random arc from one edge
// of the screen to another, speeding up and slowing down somewhere along it (a
// different somewhere and amount each), wings flapping at its own rate. Small,
// like the birds, with two pinprick red eyes.
import { stage } from "./stage";

const ODDS = [0.1, 0.2, 0.5, 0.2]; // bats: 0, 1, 2, 3
const FIRST_MS = 600; // earliest arrival after dusk
const SPREAD_MS = 6000; // arrivals spread over this
const MARGIN = 60; // start and end this far off-screen
type P = { x: number; y: number };
type Bat = { el: HTMLElement; s: P; c: P; e: P; u: number; dur: number; amp: number; phase: number; wobble: number };

const fx = document.getElementById("fx")!;
const BAT_SVG = `<svg viewBox="0 0 28 20" aria-hidden="true">
  <g class="wing wl"><path d="M12 10 C8 4 3 3 0 6 C3 7 4 9 2 12 C5 12 9 11 12 10 Z" fill="#2a2230" /></g>
  <g class="wing wr"><path d="M16 10 C20 4 25 3 28 6 C25 7 24 9 26 12 C23 12 19 11 16 10 Z" fill="#2a2230" /></g>
  <ellipse cx="14" cy="10" rx="3.2" ry="4" fill="#2a2230" />
  <path d="M12 6 L11 2 L13.5 5 Z M16 6 L17 2 L14.5 5 Z" fill="#2a2230" />
  <circle cx="12.8" cy="8" r="0.7" fill="#ff3b3b" /><circle cx="15.2" cy="8" r="0.7" fill="#ff3b3b" />
</svg>`;
let bats: Bat[] = [];
let raf = 0;
let lastT = 0;

/** Dusk: roll the dice and send the bats, staggered. */
export function spawnBats() {
  const r = Math.random();
  let n = 0;
  let acc = 0;
  for (let i = 0; i < ODDS.length; i++) {
    acc += ODDS[i];
    if (r < acc) {
      n = i;
      break;
    }
  }
  for (let i = 0; i < n; i++) window.setTimeout(launch, FIRST_MS + Math.random() * SPREAD_MS);
}

/** A point just off one edge of the screen; `side` 0..3 = left, right, top, bottom. */
function edgePoint(side: number): P {
  const m = MARGIN * stage();
  switch (side) {
    case 0:
      return { x: -m, y: 80 + Math.random() * (innerHeight - 160) };
    case 1:
      return { x: innerWidth + m, y: 80 + Math.random() * (innerHeight - 160) };
    case 2:
      return { x: 80 + Math.random() * (innerWidth - 160), y: -m };
    default:
      return { x: 80 + Math.random() * (innerWidth - 160), y: innerHeight + m };
  }
}

function launch() {
  const from = Math.floor(Math.random() * 4);
  let to = Math.floor(Math.random() * 4);
  if (to === from) to = (to + 1 + Math.floor(Math.random() * 3)) % 4;
  const el = document.createElement("div");
  el.className = "bat";
  el.innerHTML = BAT_SVG;
  const flap = `${(0.11 + Math.random() * 0.06).toFixed(3)}s`;
  for (const w of el.querySelectorAll<SVGGElement>(".wing")) w.style.animationDuration = flap;
  fx.appendChild(el);
  bats.push({
    el,
    s: edgePoint(from),
    c: { x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * (0.2 + Math.random() * 0.6) },
    e: edgePoint(to),
    u: 0,
    dur: 4.5 + Math.random() * 3.5,
    amp: 0.35 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
    wobble: Math.random() * Math.PI * 2,
  });
  if (!raf) {
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }
}

function step(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const s = stage();
  for (const b of bats) {
    // Progress along the arc, faster and slower in its own rhythm.
    b.u += (dt / b.dur) * (1 + b.amp * Math.sin(2 * Math.PI * b.u + b.phase));
    const u = Math.min(1, b.u);
    const k = 1 - u;
    const x = k * k * b.s.x + 2 * k * u * b.c.x + u * u * b.e.x;
    const y = k * k * b.s.y + 2 * k * u * b.c.y + u * u * b.e.y + Math.sin(now / 70 + b.wobble) * 2.5 * s;
    const dx = 2 * k * (b.c.x - b.s.x) + 2 * u * (b.e.x - b.c.x);
    const facing = dx >= 0 ? 1 : -1;
    b.el.style.transform = `translate(${x - 14 * s}px, ${y - 10 * s}px) scaleX(${facing})`;
  }
  const gone = bats.filter((b) => b.u >= 1);
  for (const b of gone) b.el.remove();
  bats = bats.filter((b) => b.u < 1);
  if (bats.length) raf = requestAnimationFrame(step);
}
