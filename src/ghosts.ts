// Ghosts (Bobby 2026-10-02). A cursor caught by a ghoul or a skeleton, or hit by a
// daemon's fireball, is a ghost for GHOST_MS: translucent and drifting, still able
// to move but not to grab, tap, cast, or count toward the ankh; monsters ignore
// it. Whatever it held is dropped and a nocked volley is cancelled (main.ts hook).
// It comes back by itself when the time is up, or at once when it drifts into the
// wandering healer (healer.ts). A revive spell is left to the audience's vote.
import { getCursor } from "./cursors";
import { burstAt } from "./moongate";
import { stage } from "./stage";
import { sfx } from "./sounds";

export const GHOST_MS = 20_000;
type Hooks = { send: (msg: object) => void; onGhost: (id: string) => void; onRevive?: (id: string) => void };
let hooks: Hooks;
const until = new Map<string, number>();
const timers = new Map<string, number>();

// The apparition (Bobby 2026-10-02: a faded arrow was not clear enough): a sheet ghost
// that floats about the arrow, glowing, and murmurs "OooOOoo" like the old game's ghosts.
const WRAITH = `<svg viewBox="0 0 40 48" aria-hidden="true">
  <path d="M20 3 C9 3 6 13 6 22 V41 L11 35 L15 43 L20 36 L25 43 L29 35 L34 41 V22 C34 13 31 3 20 3 Z" fill="#eef6ff" stroke="#9fc4e8" stroke-width="1.2" stroke-linejoin="round"/>
  <ellipse cx="14.5" cy="20" rx="3" ry="4" fill="#243247"/>
  <ellipse cx="25.5" cy="20" rx="3" ry="4" fill="#243247"/>
  <ellipse cx="20" cy="29" rx="2.4" ry="3" fill="#243247" opacity="0.8"/>
</svg><span class="ooo">OooOOoo</span>`;

export function isGhost(id: string): boolean {
  return until.has(id);
}
export function ghostIds(): string[] {
  return [...until.keys()];
}
/** Slain by `by` (a monster kind, "fireball", "devtools"): a ghost for GHOST_MS. False if already one or no cursor. */
export function ghostCursor(id: string, by: string): boolean {
  if (until.has(id)) return false;
  const c = getCursor(id);
  if (!c) return false;
  until.set(id, Date.now() + GHOST_MS);
  c.el.classList.add("ghost");
  sfx("ghost");
  const w = document.createElement("div");
  w.className = "wraith";
  w.innerHTML = WRAITH;
  c.el.appendChild(w);
  burstAt(c.x + 3 * stage(), c.y + 2 * stage());
  hooks.onGhost(id);
  hooks.send({ type: "ghost", to: id, state: "dead", by, ms: GHOST_MS });
  timers.set(id, window.setTimeout(() => revive(id, "time"), GHOST_MS));
  return true;
}
/** Back among the living, by the healer or by the clock. */
export function revive(id: string, how: "healer" | "time"): boolean {
  if (!until.has(id)) return false;
  until.delete(id);
  window.clearTimeout(timers.get(id));
  timers.delete(id);
  const c = getCursor(id);
  if (c) {
    c.el.classList.remove("ghost");
    c.el.querySelector(".wraith")?.remove();
    burstAt(c.x + 3 * stage(), c.y + 2 * stage());
  }
  hooks.send({ type: "ghost", to: id, state: "alive", how });
  hooks.onRevive?.(id);
  return true;
}
/** The phone left: nothing to revive. */
export function forgetGhost(id: string) {
  until.delete(id);
  window.clearTimeout(timers.get(id));
  timers.delete(id);
}
export function forgetAllGhosts() {
  for (const id of [...until.keys()]) forgetGhost(id);
}
/** Devtools: ghost a phone (never the Seer). */
export function devGhost(id: string): string {
  if (id === "mouse") return "the Seer cannot die";
  if (isGhost(id)) {
    revive(id, "time");
    return "revived";
  }
  return ghostCursor(id, "devtools") ? "a ghost for 20 s: drift to the healer" : "no such cursor";
}
export function initGhosts(h: Hooks) {
  hooks = h;
}
