// Remote cursors: one per phone, keyed by the relay-assigned socket id.
// Positions are CSS pixels of the overlay viewport. The phone page's analog stick
// (2026-10-04) sends distances as fractions of the *overlay's* viewport with
// `stick: true`: added as they are (gain 1). The older swipe path is kept for
// terminal phones (tools/fake-phone.mjs): deltas as fractions of the *phone's*
// viewport plus the time since the previous batch, with trackpad-style
// acceleration: slow drags give fine control near a reagent, a flick crosses the screen.
//   gain = GAIN_BASE + GAIN_PER_SPEED * speed  (speed in phone-screens/second)
//   0.5/s -> 0.26   1.5/s -> 0.4 (a normal swipe, ~2.5 to cross)   3/s -> 0.63   >=4.8/s -> 0.9
// Motion is smoothed toward a target in rAF.

const GAIN_BASE = 0.18;
const GAIN_PER_SPEED = 0.15;
const GAIN_MAX = 0.9;
const GAIN_FALLBACK = 0.4; // phones that send no dt (older page)
const SMOOTH = 0.35;
const COLORS = ["#f1d271", "#4fc3ff", "#7cf29a", "#ff8fb1", "#c9a1ff", "#ffb35c", "#8fe3ff", "#f0f0f0"];

export type Cursor = { el: HTMLElement; x: number; y: number; tx: number; ty: number; color: string };

const layer = document.getElementById("cursors")!;
const cursors = new Map<string, Cursor>();
let raf = 0;
const frameSubs: ((cursors: Map<string, Cursor>) => void)[] = [];
const jumpSubs: ((id: string, x: number, y: number) => void)[] = [];
const movedAt = new Map<string, number>(); // last time a cursor's target changed: idle = parked
/** Milliseconds since this cursor last moved (huge for an unknown one). */
export function cursorIdleMs(id: string): number {
  return Date.now() - (movedAt.get(id) ?? 0);
}

/** The gain formula's constants, for the phone's dead-reckoned mini-map (minimap.ts). */
export function gainParams() {
  return { base: GAIN_BASE, perSpeed: GAIN_PER_SPEED, max: GAIN_MAX, fallback: GAIN_FALLBACK };
}
/** Called when a cursor is moved by anything but its own swipes (teleport, nudge): the phone's map needs a correction. */
export function onCursorJump(fn: (id: string, x: number, y: number) => void) {
  jumpSubs.push(fn);
}

/** Called after every animation frame in which a cursor moved. */
export function onCursorFrame(fn: (cursors: Map<string, Cursor>) => void) {
  frameSubs.push(fn);
}
/** Displayed (smoothed) position of a phone's cursor tip. */
export function getCursor(id: string): Cursor | undefined {
  return cursors.get(id);
}
export function allCursors(): ReadonlyMap<string, Cursor> {
  return cursors;
}
/** Send a cursor toward an absolute point (smoothed): a phantom following the mouse. */
export function setCursorTarget(id: string, x: number, y: number) {
  const c = cursors.get(id);
  if (!c) return;
  if (Math.abs(c.tx - x) > 0.5 || Math.abs(c.ty - y) > 0.5) movedAt.set(id, Date.now());
  c.tx = clamp(x, 0, innerWidth - 8);
  c.ty = clamp(y, 0, innerHeight - 8);
  tick();
}
/** Push a cursor by a screen-pixel offset (smoothed). */
export function nudgeCursor(id: string, dx: number, dy: number) {
  const c = cursors.get(id);
  if (!c) return;
  c.tx = clamp(c.tx + dx, 0, innerWidth - 8);
  c.ty = clamp(c.ty + dy, 0, innerHeight - 8);
  movedAt.set(id, Date.now());
  tick();
  for (const fn of jumpSubs) fn(id, c.tx, c.ty);
}
/** Jump instantly (no smoothing) and let followers (held reagents) catch up. */
export function teleportCursor(id: string, x: number, y: number) {
  const c = cursors.get(id);
  if (!c) return;
  c.x = c.tx = x;
  c.y = c.ty = y;
  movedAt.set(id, Date.now());
  c.el.style.transform = `translate(${x}px, ${y}px)`;
  for (const fn of frameSubs) fn(cursors);
  for (const fn of jumpSubs) fn(id, x, y);
}

const ARROW = `<svg viewBox="0 0 24 24" width="52" height="52" aria-hidden="true">
  <path d="M3 2 L21 12 L12.5 13.6 L8 22 Z" fill="currentColor" stroke="#1a1208" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** Least-used palette colour among the cursors on screen, so concurrent phones differ. */
function colorFor(id: string): string {
  const used = new Map<string, number>();
  for (const c of cursors.values()) used.set(c.color, (used.get(c.color) ?? 0) + 1);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const min = Math.min(...COLORS.map((c) => used.get(c) ?? 0));
  const free = COLORS.filter((c) => (used.get(c) ?? 0) === min);
  return free[h % free.length];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function ensureCursor(id: string): Cursor {
  let c = cursors.get(id);
  if (!c) {
    const el = document.createElement("div");
    el.className = "cursor";
    const color = colorFor(id);
    el.style.color = color;
    el.innerHTML = ARROW + `<span class="label"></span>`;
    layer.appendChild(el);
    const x = innerWidth / 2;
    const y = innerHeight / 2;
    c = { el, x, y, tx: x, ty: y, color };
    cursors.set(id, c);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
  return c;
}

/** dx/dy are fractions of the phone's viewport (a full swipe = 1); dt ms since the previous batch. */
/** `boost` multiplies the gain: 1.5 while the phone carries something (Bobby: a full swipe should go 1.5x as far). */
/** `stick`: the phone's analog stick (2026-10-04) already turned its push into a distance, as fractions of the
 *  overlay's viewport: no acceleration here, the gain is the boost alone (1, or a ghost's drift). */
export function moveCursor(id: string, dx: number, dy: number, dt?: number, boost = 1, stick = false) {
  const c = ensureCursor(id);
  let gain = GAIN_FALLBACK;
  if (stick) gain = 1;
  else if (dt && dt > 0) {
    const speed = Math.hypot(dx, dy) / (dt / 1000); // phone-screens per second
    gain = Math.min(GAIN_MAX, GAIN_BASE + GAIN_PER_SPEED * speed);
  }
  gain *= boost;
  if (dx || dy) movedAt.set(id, Date.now());
  c.tx = clamp(c.tx + dx * innerWidth * gain, 0, innerWidth - 8);
  c.ty = clamp(c.ty + dy * innerHeight * gain, 0, innerHeight - 8);
  tick();
}

/** Name shown under the arrow. */
export function setCursorLabel(id: string, text: string) {
  const c = ensureCursor(id);
  const label = c.el.querySelector<HTMLElement>(".label");
  if (label) label.textContent = text;
}

export function wiggleCursor(id: string) {
  const { el } = ensureCursor(id);
  el.classList.remove("wiggle");
  void el.offsetWidth; // restart the animation
  el.classList.add("wiggle");
}

export function removeCursor(id: string) {
  cursors.get(id)?.el.remove();
  cursors.delete(id);
  movedAt.delete(id);
}

export function clearCursors() {
  for (const id of [...cursors.keys()]) removeCursor(id);
}

export function cursorCount() {
  return cursors.size;
}

function tick() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    let moving = false;
    for (const c of cursors.values()) {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) {
        c.x = c.tx;
        c.y = c.ty;
      } else {
        c.x += dx * SMOOTH;
        c.y += dy * SMOOTH;
        moving = true;
      }
      c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
    }
    for (const fn of frameSubs) fn(cursors);
    if (moving) tick();
  });
}
