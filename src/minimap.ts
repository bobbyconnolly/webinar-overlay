// Phone mini-map (Bobby 2026-10-02). The students' control loop runs through the
// stream delay (Zoom or Discord, about a second), so swiping toward a thing on the
// shared screen overshoots. The phone therefore shows a small map of the stage: the
// visible widgets as silhouettes and the player's own dot in their colour, and it
// keeps the dot's position *itself*, dead-reckoned from its own stick (since 2026-10-04
// the phone sums the very fractions it sends; `gain` below is the older swipe formula
// of cursors.ts, kept for terminal phones). The overlay sends:
//   layout {w, h, gain, widgets}  once to a joiner, then whenever the visible layout
//                                 changes (polled once a second: drags, hide, gump,
//                                 QR fold, level changes, stream mode, resize);
//   pos {x, y}                    only when a cursor is moved by anything but its own
//                                 swipes (teleport, nudge, recoil, ghost, grab, drop);
// so there is no per-frame traffic. A tap on the map sends goto {x, y} (fractions)
// and the overlay teleports the cursor there: the one agreed exception to "no new
// phone gestures".
import { gainParams, getCursor, onCursorJump, teleportCursor, wiggleCursor } from "./cursors";
import { stage } from "./stage";

const POLL_MS = 1000;
const GRID = 200; // rects are rounded to 1/200 of the viewport before comparing layouts
// Bobby 2026-10-03: the QR, the goals card and the codex are the Seer's furniture, not the game's: off the map.
const MAP_HIDDEN = new Set(["qr", "quest", "text"]);

type Hooks = { send: (m: object) => void; carry: number; ghost: number };
let hooks: Hooks;
let lastSig = "";

type Box = { id: string; x: number; y: number; w: number; h: number };
/** Visible widgets as fractions of the viewport (hidden ones have zero rects and are skipped). */
function boxes(): Box[] {
  const W = innerWidth;
  const H = innerHeight;
  const out: Box[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(".widget")) {
    const id = el.dataset.widget ?? "";
    if (MAP_HIDDEN.has(id)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    out.push({ id, x: r.left / W, y: r.top / H, w: r.width / W, h: r.height / H });
  }
  return out;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** The stage as the phone needs it; `to` for a joiner, none for a broadcast. */
export function layoutMessage(to?: string) {
  const g = gainParams();
  return {
    type: "layout",
    ...(to ? { to } : {}),
    w: innerWidth,
    h: innerHeight,
    gain: { base: g.base, per: g.perSpeed, max: g.max, fallback: g.fallback, carry: hooks.carry, ghost: hooks.ghost },
    widgets: boxes().map((b) => ({ id: b.id, x: r3(b.x), y: r3(b.y), w: r3(b.w), h: r3(b.h) })),
  };
}
/** Where this phone's cursor is (its target, in overlay CSS px), or null without a cursor. */
export function posMessage(id: string) {
  const c = getCursor(id);
  if (!c) return null;
  return { type: "pos", to: id, x: Math.round(c.tx * 10) / 10, y: Math.round(c.ty * 10) / 10 };
}
/** The phone tapped its map at (fx, fy) of the stage: the cursor's tip jumps there. */
export function gotoFraction(id: string, fx: number, fy: number): boolean {
  if (!getCursor(id)) return false;
  const s = stage();
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const x = clamp(fx, 0, 1) * innerWidth - 3 * s; // the tip, not the arrow's corner
  const y = clamp(fy, 0, 1) * innerHeight - 2 * s;
  teleportCursor(id, clamp(x, 0, innerWidth - 8), clamp(y, 0, innerHeight - 8));
  wiggleCursor(id);
  return true;
}

function poll() {
  const sig = JSON.stringify([innerWidth, innerHeight, boxes().map((b) => [b.id, ...[b.x, b.y, b.w, b.h].map((v) => Math.round(v * GRID))])]);
  if (sig === lastSig) return;
  lastSig = sig;
  hooks.send(layoutMessage());
}

export function initMinimap(h: Hooks) {
  hooks = h;
  onCursorJump((id) => {
    const p = posMessage(id);
    if (p) hooks.send(p);
  });
  window.setInterval(poll, POLL_MS);
  window.addEventListener("resize", poll);
}
