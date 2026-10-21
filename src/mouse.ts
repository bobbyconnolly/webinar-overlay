// The Seer's own Windows cursor. The overlay never draws it, but the ankh
// ritual counts it (Bobby: "my cursor counts for the quorum"). While the
// overlay is click-through the page gets no mouse events at all, so Rust polls
// GetCursorPos and emits `mouse` in CSS pixels about 30 times a second; when
// the overlay is interactive the page's own pointermove refines it.
import { listen } from "@tauri-apps/api/event";

export type Point = { x: number; y: number };
let pos: Point | null = null;
let dir: Point | null = null; // unit direction of the last real movement (devtools aim Magic Arrow with it)
const subs: ((p: Point) => void)[] = [];

function update(p: Point) {
  if (pos) {
    const dx = p.x - pos.x;
    const dy = p.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d >= 6) dir = { x: dx / d, y: dy / d };
  }
  pos = p;
  for (const fn of subs) fn(p);
}
/** Called on every mouse report (Rust while click-through, pointermove while interactive). */
export function onMouse(fn: (p: Point) => void) {
  subs.push(fn);
}
export function initMouse() {
  listen<Point>("mouse", (e) => update(e.payload));
  document.addEventListener("pointermove", (e) => update({ x: e.clientX, y: e.clientY }));
}
/** Last known position in overlay CSS px, or null before the first report. */
export function getMouse(): Point | null {
  return pos;
}
/** Which way the mouse last moved (unit vector), or null if it never has. */
export function getMouseDir(): Point | null {
  return dir;
}
