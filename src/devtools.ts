// Devtools (Bobby, 2026-10-01: "give you feedback faster"; 2026-10-02: "overwhelming",
// rebuilt small). Ctrl+Shift+D or the ⚙ in the pill. Presenter only.
//
//   Restart · Next ▶   the game from level 0, one phase per press along the real path:
//                      awaken the ankh (level 1) → fill the pack (the banner, level 2) →
//                      master the spells (the banner, level 3) → place the ankh → open the
//                      gate (a wave) → end the wave → place the ankh again…
//   spells             cast free (no reagents, cooldowns or level gate; nothing spent or
//                      tallied; phones hear "Seer casts X"), as the Seer, or as the phantom
//                      Seeker the mouse drives (Magic Arrow then nocks on it: swipe to shoot)
//   stage              night / day, a stray monster, a daemon, a ghost (the driven phantom,
//                      else the first phone), the open bag, Ginger's game, a bird's theft,
//                      a scatter
//   seekers            phantom Seekers the mouse drives (phantom.ts)
import { allCursors } from "./cursors";
import { labelFor } from "./identity";
import { SPELLS, devCast } from "./spells";
import { devFillBag, isQuestComplete, openGump, respawnGone, scatterReagents } from "./quest";
import { devAwaken } from "./ankh";
import { BANNER_MS, currentLevel, devSetLevel, resetGame } from "./levels";
import { ankhPlaced, devEndWave, devPlaceAnkh, devSpawnDaemon, devSpawnMonster, waveActive, waveCount } from "./horde";
import { devGhost } from "./ghosts";
import { devSetNight } from "./sky";
import { addPhantom, phantomIds, possess, possessedId, removeAllPhantoms, removePhantom } from "./phantom";
import { devCatPlay } from "./cat";
import { devBirdSteal } from "./signpost";
import { scatterTrinkets } from "./trinkets";
import { initSounds, isMuted, setMuted, soundCount } from "./sounds";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const panel = $("#dev");
const status = $("#dev-status");
const phaseEl = $("#dev-phase");
const nightBtn = $<HTMLButtonElement>("#dev-night");
const botSel = $<HTMLSelectElement>("#dev-bot");
const possessBtn = $<HTMLButtonElement>("#dev-bot-possess");
const phoneLine = $("#dev-phone");
let bannerUntil = 0; // a Next that started a banner: the next phase comes by itself after it
let tick = 0;

function say(text: string) {
  status.textContent = text;
}
/** Who dev actions act as: the phantom the mouse drives, else the Seer. */
function actor(): string {
  return possessedId() ?? "mouse";
}
/** Who the Ghost button hits: the driven phantom, else the first phone. */
function victim(): string | null {
  return possessedId() ?? [...allCursors().keys()][0] ?? null;
}

// ---------- the game, phase by phase ----------
type Phase = { where: string; next: string; go: () => string };
function phase(): Phase {
  const l = currentLevel();
  const banner = Date.now() < bannerUntil;
  if (l === 0) return { where: "level 0 · the ankh waits", next: "awaken it → level 1", go: () => (devAwaken() || devSetLevel(1), "the ankh awakens: level 1") };
  if (l === 1) {
    if (isQuestComplete() || banner) return { where: "level 1 · the pack is full", next: "level 2 after the banner", go: () => (devSetLevel(2), "level 2 now") };
    return { where: "level 1 · gathering", next: "fill the pack → level 2", go: () => (devFillBag(), (bannerUntil = Date.now() + BANNER_MS), "the pack is full: the banner, then level 2") };
  }
  if (l === 2) {
    if (banner) return { where: "level 2 · spells mastered", next: "level 3 after the banner", go: () => (devSetLevel(3), "level 3 now") };
    return {
      where: "level 2 · the spells",
      next: "master them all → level 3",
      go: () => {
        for (const s of SPELLS) document.dispatchEvent(new CustomEvent("spell-cast", { detail: { spell: s.id, by: "mouse" } }));
        bannerUntil = Date.now() + BANNER_MS;
        return "every spell cast by the Seer: the banner, then level 3";
      },
    };
  }
  if (waveActive()) return { where: `level 3 · wave ${waveCount()}`, next: "end the wave", go: () => devEndWave() };
  if (ankhPlaced()) return { where: "level 3 · the ankh on the gate", next: `open the gate → wave ${waveCount() + 1}`, go: () => (devAwaken(), "the gate tears open") };
  return { where: "level 3 · the ankh is the key", next: "place it on the gate", go: () => devPlaceAnkh() };
}
function renderPhase() {
  const p = phase();
  // Parked phantoms count as players (the ankh quorum, the horde): say so.
  const parked = phantomIds().filter((id) => id !== possessedId()).length;
  const park = parked ? ` <span class="dev-park">· ${parked} phantom${parked === 1 ? "" : "s"} parked</span>` : "";
  phaseEl.innerHTML = `${p.where} <span class="dev-next">next: ${p.next}</span>${park}`;
  nightBtn.textContent = document.body.classList.contains("night") ? "Day" : "Night";
}

// ---------- phantoms ----------
/** phantom.ts: a phantom came, went or changed hands. */
export function devPhantomsChanged() {
  const ids = phantomIds();
  const p = possessedId();
  renderPhase();
  botSel.innerHTML = ids.length ? ids.map((id) => `<option value="${id}">${labelFor(id).name}</option>`).join("") : `<option value="">no phantom</option>`;
  if (p) botSel.value = p;
  possessBtn.textContent = p ? "Release (Esc)" : "Possess";
  possessBtn.disabled = !ids.length;
  if (!ids.length) phoneLine.textContent = "";
}
/** phantom.ts: what the possessed phantom's phone would say. */
export function devPhoneLine(id: string, text: string) {
  phoneLine.textContent = `📱 ${labelFor(id).name}: ${text}`;
}
export function toggleDev(force?: boolean) {
  const on = force ?? !panel.classList.contains("open");
  panel.classList.toggle("open", on);
  window.clearInterval(tick);
  if (on) {
    void initSounds(); // a fresh pick from `npm run sounds` plays without a reload
    renderPhase();
    tick = window.setInterval(renderPhase, 1000); // waves end, bags fill, nights fall by themselves
  }
}
export function initDev() {
  $("#dev-restart").addEventListener("click", () => {
    const gone = removeAllPhantoms(); // a new game starts clean
    resetGame();
    bannerUntil = 0;
    say(gone ? `level 0: the ankh waits · ${gone} phantom${gone === 1 ? "" : "s"} sent away` : "level 0: the ankh waits");
    renderPhase();
  });
  $("#dev-next").addEventListener("click", () => {
    say(phase().go());
    renderPhase();
  });
  $("#dev-spells").innerHTML = SPELLS.map((s) => `<button type="button" data-spell="${s.id}" title="${s.effect}">${s.name}</button>`).join("");
  $("#dev-spells").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-spell]");
    if (!b) return;
    say(`${b.textContent}: ${devCast(b.dataset.spell!, actor())}`);
  });
  nightBtn.addEventListener("click", () => {
    const night = !document.body.classList.contains("night");
    devSetNight(night);
    say(night ? "night for ten minutes (Day ends it)" : "day");
    renderPhase();
  });
  $("#dev-monster").addEventListener("click", () => say(devSpawnMonster()));
  $("#dev-daemon").addEventListener("click", () => say(devSpawnDaemon()));
  $("#dev-ghost").addEventListener("click", () => {
    const v = victim();
    say(v ? `${labelFor(v).name}: ${devGhost(v)}` : "no Seeker to ghost: + Seeker first");
  });
  $("#dev-gump").addEventListener("click", () => {
    openGump();
    say("the bag is open");
  });
  $("#dev-cat").addEventListener("click", () => say(devCatPlay()));
  $("#dev-bird").addEventListener("click", () => say(devBirdSteal()));
  $("#dev-scatter").addEventListener("click", () => {
    scatterReagents();
    scatterTrinkets();
    say("reagents and trinkets scattered");
  });
  // Shown by CSS only while a limited reagent is spent (body.reagent-gone); quest.ts names it.
  $("#dev-respawn").addEventListener("click", () => {
    const back = respawnGone();
    say(back.length ? `${back.join(" & ")} back` : "nothing is waiting to return");
  });
  // Sound cues: mute / unmute (persisted); the label says how many events have a clip.
  const soundBtn = $<HTMLButtonElement>("#dev-sound");
  const renderSound = () => {
    soundBtn.textContent = isMuted() ? "🔇" : "🔊";
    soundBtn.title = `${isMuted() ? "Muted" : "Sound on"} · ${soundCount()} events have a clip (pick them with: npm run sounds)`;
  };
  soundBtn.addEventListener("click", () => {
    setMuted(!isMuted());
    renderSound();
    say(isMuted() ? "sound muted" : `sound on · ${soundCount()} cues`);
  });
  renderSound();
  window.setTimeout(renderSound, 3000); // after the clips have loaded
  // Phantom Seekers: fake phones the mouse drives.
  $("#dev-bot-add").addEventListener("click", () => {
    const id = addPhantom();
    say(`${labelFor(id).name} joined · your mouse drives it: click = tap, hold = grab, double-click = double-tap, Esc = let go`);
  });
  possessBtn.addEventListener("click", () => {
    if (possessedId()) possess(null);
    else if (botSel.value) possess(botSel.value);
  });
  botSel.addEventListener("change", () => {
    if (possessedId() && botSel.value) possess(botSel.value);
  });
  $("#dev-bot-remove").addEventListener("click", () => {
    const id = botSel.value || possessedId();
    if (!id) return;
    const name = labelFor(id).name;
    removePhantom(id);
    say(`${name} left`);
  });
  $("#dev-close").addEventListener("click", () => toggleDev(false));
  document.addEventListener("level-changed", renderPhase);
  devPhantomsChanged();
  renderPhase();
}
