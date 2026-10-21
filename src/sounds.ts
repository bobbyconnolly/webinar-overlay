// Sound cues on the shared stage (Bobby 2026-10-04: "lack of sound effects" was the first
// thing a playthrough with a tester missed). The Seer's machine plays them and the screen
// share carries them (Discord: "share audio" on the screen share; Teams: "include computer
// sound"). Which clip plays for which moment is Bobby's pick: `npm run sounds`
// (tools/sounds/picker.mjs) writes public/sounds/picks.json and copies the chosen clip to
// public/sounds/<event>.mp3; `sfx("event")` here plays it. An event without a pick is
// silent. Every candidate is CC0 (Kenney, OpenGameArt, Freesound), so the picks live in
// the public repo. Playback: WebAudio buffers (decoded once, overlapping plays allowed), a
// per-event cooldown so a volley or a wisp hunt does not machine-gun, a master volume and
// a mute (devtools; persisted). WebView2 needs no gesture first: tauri.conf.json passes
// --autoplay-policy=no-user-gesture-required.
const DEFAULT_COOLDOWN_MS = 150;
const PICKS_URL = "/sounds/picks.json";

type Pick = { file: string; title?: string; seconds?: number };
const buffers = new Map<string, AudioBuffer>();
const lastPlayed = new Map<string, number>();
const played = new Map<string, number>(); // test hook: plays per event
let ctx: AudioContext | null = null;
let muted = localStorage.getItem("overlay.sound.muted") === "1";
let volume = Number(localStorage.getItem("overlay.sound.volume") ?? 0.8);
let picks: Record<string, Pick> = {};
let master: GainNode | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Load the picks and decode their clips. Safe to call again (a re-pick while running). */
export async function initSounds() {
  try {
    const r = await fetch(PICKS_URL, { cache: "no-store" });
    if (!r.ok) return; // nothing picked yet
    picks = ((await r.json()).picks ?? {}) as Record<string, Pick>;
  } catch {
    return;
  }
  const c = context();
  if (!c) return;
  for (const [id, p] of Object.entries(picks)) {
    try {
      const r = await fetch(`/sounds/${p.file}`, { cache: "no-store" });
      if (!r.ok) continue;
      buffers.set(id, await c.decodeAudioData(await r.arrayBuffer()));
    } catch {
      /* a missing or broken clip: silent */
    }
  }
  // A click-through overlay gets few gestures; resume on the first one anyway, in case the policy flag is missing.
  const resume = () => { if (ctx && ctx.state === "suspended") void ctx.resume(); };
  document.addEventListener("pointerdown", resume, { passive: true });
  document.addEventListener("keydown", resume, { passive: true });
}

/** Play the clip picked for an event (nothing if none). `cooldownMs` guards repeats; `volume` scales this play. */
export function sfx(id: string, opts: { volume?: number; cooldownMs?: number } = {}) {
  const now = performance.now();
  const cooldown = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  if (now - (lastPlayed.get(id) ?? -1e9) < cooldown) return;
  lastPlayed.set(id, now);
  played.set(id, (played.get(id) ?? 0) + 1);
  const buf = buffers.get(id);
  const c = ctx;
  if (!buf || !c || !master || muted) return;
  if (c.state === "suspended") void c.resume();
  const src = c.createBufferSource();
  src.buffer = buf;
  if (opts.volume !== undefined && opts.volume !== 1) {
    const g = c.createGain();
    g.gain.value = opts.volume;
    src.connect(g).connect(master);
  } else src.connect(master);
  src.start();
}

export function setMuted(on: boolean) {
  muted = on;
  localStorage.setItem("overlay.sound.muted", on ? "1" : "0");
  if (master) master.gain.value = on ? 0 : volume;
}
export function isMuted() {
  return muted;
}
export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem("overlay.sound.volume", String(volume));
  if (master && !muted) master.gain.value = volume;
}
export function soundVolume() {
  return volume;
}
/** How many events have a clip, for the devtools line. */
export function soundCount() {
  return buffers.size;
}

// Test hooks: document.dispatchEvent(new CustomEvent("sfx", { detail: "meow" })) plays; window.sfxStats() reports.
document.addEventListener("sfx", (e) => sfx(String((e as CustomEvent).detail)));
(window as unknown as { sfxStats: () => unknown }).sfxStats = () => ({
  loaded: [...buffers.keys()],
  played: Object.fromEntries(played),
  state: ctx?.state ?? "none",
  muted,
  volume,
});
