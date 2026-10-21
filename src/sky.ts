// Day and night. Two things make it dark: the Night Sight spell (for NIGHT_MS,
// a recast extends it) and a horde wave (for as long as it runs). Night Sight
// cast during a wave does the opposite: it lifts the dark for a while (the
// monsters are hard to see otherwise). body.night and #night.on carry the look
// (the night layer, glowing cursors, the lantern, Ginger's eyes).
const night = document.getElementById("night")!;
let nightSightUntil = 0;
let siege = false;
let litUntil = 0;
let timer = 0;

function apply() {
  const now = Date.now();
  const dark = (now < nightSightUntil || siege) && now >= litUntil;
  night.classList.toggle("on", dark);
  document.body.classList.toggle("night", dark);
  window.clearTimeout(timer);
  // Re-evaluate at the next boundary (a timer ending, the light fading).
  const next = [nightSightUntil, litUntil].filter((t) => t > now);
  if (next.length) timer = window.setTimeout(apply, Math.min(...next) - now + 20);
}

/** Night Sight: dark for `ms` (extends a running night). */
export function nightfall(ms: number) {
  nightSightUntil = Math.max(nightSightUntil, Date.now()) + ms;
  apply();
}
/** A horde wave keeps it dark while it runs. */
export function setSiegeDark(on: boolean) {
  siege = on;
  if (!on) litUntil = 0;
  apply();
}
/** Night Sight during a wave: light for `ms`, then the dark comes back if the wave still runs. */
export function liftDark(ms: number) {
  litUntil = Date.now() + ms;
  apply();
}
export function isDark() {
  return document.body.classList.contains("night");
}
/** Devtools: night for ten minutes, or day now (a running wave keeps its own dark). */
export function devSetNight(on: boolean) {
  nightSightUntil = on ? Date.now() + 10 * 60_000 : 0;
  litUntil = 0;
  apply();
}
