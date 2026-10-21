// Overlay frontend. Rust owns the interactive/click-through state and the OS
// hotkeys; this file renders the mode, lets widgets be dragged, talks to the
// relay, draws phone cursors and runs the QR widget.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Relay, newRoomCode, type RelayMessage } from "./relay";
import { clearCursors, ensureCursor, moveCursor, removeCursor, setCursorLabel, wiggleCursor } from "./cursors";
import { renderQr, renderQrStatus, toggleQrFullscreen } from "./qr";
import { toggleEnding } from "./ending";
import { initQuest, questDoubleTap, questDropAll, questHold, questRelease, renderTally } from "./quest";
import { burstAt, initMoongate, isGatePortal, onGate, triggerMoongate } from "./moongate";
import { widgetDropAll, widgetHold, widgetRelease } from "./widgets";
import { PLAYER_TITLE, forgetAllNames, forgetName, nameFor } from "./identity";
import { initStage, layoutKey, toggleStreamMode } from "./stage";
import { announce, cancelNockFor, castSpell, initSpells, spellState } from "./spells";
import { initLevels, levelState, resetGame } from "./levels";
import { gateSealed, hordeState, initHorde } from "./horde";
import { forgetAllGhosts, forgetGhost, initGhosts, isGhost } from "./ghosts";
import { healerTap, initHealer } from "./healer";
import { initMouse } from "./mouse";
import { codexDoubleTap, codexTap, initCodex } from "./codex";
import { ankhTap, initAnkh, onAnkh } from "./ankh";
import { catLunge, catPos, catTap, initCat } from "./cat";
import { birdTap, initSignpost } from "./signpost";
import { devPhantomsChanged, devPhoneLine, initDev, toggleDev } from "./devtools";
import { initPhantoms, phantomHear } from "./phantom";
import { gotoFraction, initMinimap, layoutMessage, posMessage } from "./minimap";
import { initTrinkets, trinketDropAll, trinketHold, trinketRelease } from "./trinkets";
import { getCursor } from "./cursors";
import { allow, forget } from "./ratelimit";
import { initSounds } from "./sounds";

// Phones let go of whatever they hold after a random 4-5 s: nobody can block
// the level forever by holding a reagent (or the bag) hostage.
const GRIP_MIN_MS = 4000;
const GRIP_MAX_MS = 5000;
const grips = new Map<string, number>();
// Carrying something, a swipe goes 1.5x as far (Bobby: dragging to the bag was too slow).
// Swipes only: the phone's stick (2026-10-04) pushes harder instead.
const CARRY_BOOST = 1.5;
// A ghost drifts: its swipes and pushes go this much less far.
const GHOST_DRIFT = 0.75;

type Mode = { locked: boolean; hold: boolean; interactive: boolean; hotkey: string };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const body = document.body;
const modeLabel = $("#mode-label");
const lockBtn = $<HTMLButtonElement>("#lock-btn");
const lockTxt = $("#lock-btn .txt");

let mode: Mode = { locked: true, hold: false, interactive: true, hotkey: "Ctrl+Shift" };

function render(m: Mode) {
  mode = m;
  body.classList.toggle("interactive", m.interactive);
  body.classList.toggle("locked", m.locked);
  modeLabel.textContent = m.locked
    ? "Interactive · locked"
    : m.hold
      ? `Interactive · holding ${m.hotkey}`
      : `Click-through · hold ${m.hotkey} to interact`;
  lockTxt.textContent = m.locked ? "Unlock (click-through)" : "Lock interactive";
  lockBtn.title = m.locked ? `Unlock: clicks pass through unless you hold ${m.hotkey}` : "Lock: the overlay stays interactive";
  for (const kbd of document.querySelectorAll<HTMLElement>("[data-hotkey-label]")) kbd.textContent = m.hotkey;
}

lockBtn.addEventListener("click", () => invoke("set_locked", { locked: !mode.locked }));
$("#quit-btn").addEventListener("click", () => invoke("quit_app"));

// Reset game (back to level 1) asks first, inside the pill; the question times out.
const control = $("#control");
let confirmTimer = 0;
function askReset(on: boolean) {
  control.classList.toggle("confirm", on);
  window.clearTimeout(confirmTimer);
  if (on) confirmTimer = window.setTimeout(() => askReset(false), 6000);
}
$("#reset-btn").addEventListener("click", () => askReset(true));
$("#reset-no").addEventListener("click", () => askReset(false));
$("#reset-yes").addEventListener("click", () => {
  askReset(false);
  resetGame();
});

// The pill collapses to the lock icon (mode text, Reset and the quit ✕ hide); persisted.
const PILL_KEY = "overlay.pill.collapsed";
const collapseBtn = $("#collapse-btn");
function setCollapsed(on: boolean) {
  control.classList.toggle("collapsed", on);
  collapseBtn.textContent = on ? "›" : "‹";
  collapseBtn.title = on ? "Expand the panel" : "Collapse to the lock";
  if (on) askReset(false);
  localStorage.setItem(PILL_KEY, on ? "1" : "0");
}
collapseBtn.addEventListener("click", () => setCollapsed(!control.classList.contains("collapsed")));
setCollapsed(localStorage.getItem(PILL_KEY) === "1");

// Hide every widget (and the loose reagents) but the pill: Bobby shows slides in
// between. Cursors, sparkles and spell effects stay. Phones cannot grab or open
// anything meanwhile; whatever they held is dropped. Not persisted (per session).
let hidden = false;
const hideBtn = $("#hide-btn");
function setHidden(on: boolean) {
  hidden = on;
  body.classList.toggle("widgets-hidden", on);
  control.classList.toggle("hidden", on);
  hideBtn.title = on ? "Show the widgets (Ctrl+Shift+H)" : "Hide the widgets (Ctrl+Shift+H)";
  if (on) for (const id of [...grips.keys()]) letGo(id, false);
}
hideBtn.addEventListener("click", () => setHidden(!hidden));

listen<Mode>("overlay-mode", (e) => render(e.payload));
invoke<Mode>("get_mode").then(render);
initStage(); // stream mode (bigger) if it was on last time

// No WebView2 context menu on the overlay.
document.addEventListener("contextmenu", (e) => e.preventDefault());

// ---- Relay connection (desktop role). Overlay works with the relay down. ----
// Keep the room across page reloads (dev HMR); a new code only comes from rotate.
const ROOM_KEY = "overlay.room";
const initialRoom = localStorage.getItem(ROOM_KEY) ?? newRoomCode();
localStorage.setItem(ROOM_KEY, initialRoom); // survives relaunches, so a connected phone stays in the room (Bobby 2026-10-02)

// A phone gets its cursor, a name and a "you are…" message the first time we see it:
// on the relay's join notice, or on its first message if that was missed.
const identified = new Set<string>();
function identify(id: string) {
  if (identified.has(id)) return;
  identified.add(id);
  const c = ensureCursor(id);
  const name = nameFor(id);
  setCursorLabel(id, name);
  wiggleCursor(id);
  send({ type: "you", to: id, name, color: c.color, role: PLAYER_TITLE });
  send(layoutMessage(id)); // the stage for its mini-map, and where its cursor stands
  sendPos(id);
  send(spellState(id)); // is the spellbook open, what is in the bag
  const h = hordeState(id); // level 3: where the ankh and the horde stand
  if (h) send(h);
  const l = levelState(id); // level 0: "touch the ankh together"
  if (l) send(l);
}

/** Every message to the phones goes through here, so a possessed phantom (devtools) hears what its phone would. */
function send(m: object) {
  relay.send(m);
  phantomHear(m);
}
/** Correct the phone's dead-reckoned map dot (minimap.ts): after anything that changes how, or where, its cursor moves. */
function sendPos(id: string) {
  const p = posMessage(id);
  if (p) send(p);
}

function onRelayMessage(msg: RelayMessage) {
  const id = String(msg.id ?? "");
  if (msg.type === "join" && msg.role === "phone" && id) identify(id);
  if (msg.from === "phone" && id) {
    // Per-phone caps: moves are throttled to ~30/s by the page, actions are rare. A release
    // is free (every tap sends one, and it only ever lets go of something).
    if (msg.type === "move" ? !allow(`${id}:move`, 60) : msg.type !== "release" && !allow(`${id}:act`, 6)) return;
    identify(id);
    // Widgets hidden: nothing to tap, grab or open; just wiggle. A ghost can only drift (to the healer).
    if ((hidden || isGhost(id)) && (msg.type === "tap" || msg.type === "dbltap" || msg.type === "hold")) {
      wiggleCursor(id);
      return;
    }
    switch (msg.type) {
      case "move": {
        // The phone's stick sends distances, not finger deltas: no acceleration and no carry boost
        // (pushing harder is the boost); a ghost still drifts. Terminal phones still swipe.
        const stick = msg.stick === true;
        const boost = isGhost(id) ? GHOST_DRIFT : !stick && grips.has(id) ? CARRY_BOOST : 1;
        moveCursor(id, Number(msg.dx) || 0, Number(msg.dy) || 0, Number(msg.dt) || undefined, boost, stick);
        break;
      }
      case "tap": {
        // Tap on the moongate teleports (everyone on it); on the codex it turns the
        // page; on the ankh it charges the ritual (and wiggles); elsewhere it wiggles.
        // With the ankh resting on the gate (level 3) the gate is sealed: the tap charges the ankh.
        const c = getCursor(id);
        if (c && onGate(c.x, c.y) && !gateSealed()) {
          if (triggerMoongate(id, { x: c.x, y: c.y }) === "cooldown") wiggleCursor(id);
        } else {
          const pg = codexTap(id);
          if (pg === "ignored") send({ type: "codex", to: id, state: "ignored" });
          else if (pg) send({ type: "codex", to: id, state: "page", page: pg.page, of: pg.of, tip: pg.tip }); // tip = the note's plain wording
          if (catTap(id) === "meow") send({ type: "meow", to: id }); // Ginger, if he is about
          const bird = birdTap(id);
          if (bird) send({ type: "bird", to: id, color: bird });
          healerTap(id); // "thou art in good health", if the cursor is on him
          if (c && onAnkh(c.x, c.y)) ankhTap(id);
          wiggleCursor(id);
        }
        break;
      }
      case "dbltap": {
        // On the pack: open the gump. On the codex: roll / unroll it. Both rate
        // limited. Elsewhere: just a wiggle.
        const r = questDoubleTap(id);
        if (r !== null) {
          send({ type: "gump", to: id, state: r });
          break;
        }
        const cx = codexDoubleTap(id);
        if (cx !== null) send({ type: "codex", to: id, state: cx });
        else {
          // Quick taps on the ankh come as tap, dbltap, tap...: the second one charges it too.
          const c = getCursor(id);
          if (c && onAnkh(c.x, c.y)) ankhTap(id);
          wiggleCursor(id);
        }
        break;
      }
      case "hold": {
        // Hold on a reagent (loose, or inside the open bag) grabs it; else on a trinket; else
        // on a movable widget carries it; hold on nothing just wiggles. A rest-hold (`rest`:
        // the phone's stick stopped mid-stroke) never takes furniture and is silent on nothing.
        const g = questHold(id);
        const t = g ? null : trinketHold(id);
        const w = g || t || msg.rest ? null : widgetHold(id);
        // `item` not `id`: the relay overwrites `id` with the sender's socket id.
        if (g) send({ type: "grab", to: id, kind: "reagent", item: g.id, name: g.name });
        else if (t) send({ type: "grab", to: id, kind: "trinket", item: t.file, name: t.name });
        else if (w) send({ type: "grab", to: id, kind: "widget", item: w.id, name: w.name });
        else if (!msg.rest) wiggleCursor(id);
        if (g || t || w) {
          sendPos(id); // carrying changes the gain: resync the phone's map dot
          window.clearTimeout(grips.get(id));
          grips.set(
            id,
            window.setTimeout(() => letGo(id, true), GRIP_MIN_MS + Math.random() * (GRIP_MAX_MS - GRIP_MIN_MS)),
          );
        }
        break;
      }
      case "release":
        letGo(id, false);
        break;
      case "goto": {
        // A tap on the phone's mini-map: the cursor jumps there. Not while carrying (a reagent
        // would fly straight into the pack) and not as a ghost (it drifts to the healer).
        const reason = grips.has(id) ? "carrying" : isGhost(id) ? "ghost" : null;
        if (!reason) gotoFraction(id, Number(msg.x) || 0, Number(msg.y) || 0); // teleportCursor sends the pos
        send({ type: "goto", to: id, ok: !reason, ...(reason ? { reason } : {}) });
        break;
      }
      case "cast": {
        const r = hidden ? { ok: false, reason: "closed" } : castSpell(id, String(msg.spell ?? ""));
        send({ type: "cast", to: id, spell: msg.spell, ...r });
        break;
      }
    }
    return;
  }
  if (msg.type === "leave" && id) {
    window.clearTimeout(grips.get(id));
    grips.delete(id);
    questRelease(id); // drops whatever it was carrying, where it is
    trinketRelease(id);
    widgetRelease(id);
    forgetGhost(id);
    // the ending: a Seeker who tapped Enter Mystica leaves from the gate; a burst marks the going
    const gone = isGatePortal() ? getCursor(id) : undefined;
    if (gone && onGate(gone.x, gone.y)) burstAt(gone.x, gone.y);
    removeCursor(id);
    forget(id);
    forgetName(id);
    identified.delete(id);
    renderTally(); // a name may have left the tally's colour lookup
  }
}

/** Drop whatever a phone holds; `slipped` = the grip timer ran out, not the user. */
function letGo(id: string, slipped: boolean) {
  window.clearTimeout(grips.get(id));
  grips.delete(id);
  const d = questRelease(id);
  if (d) {
    // `kept`: it was only moved around inside the bag
    send({ type: "drop", to: id, kind: "reagent", name: d.name, collected: d.collected, kept: !!d.kept, slipped, score: d.score });
    sendPos(id);
    return;
  }
  const t = trinketRelease(id);
  if (t) {
    send({ type: "drop", to: id, kind: "trinket", name: t.name, collected: false, slipped });
    sendPos(id);
    return;
  }
  const w = widgetRelease(id);
  if (w) {
    send({ type: "drop", to: id, kind: "widget", name: w.name, collected: false, slipped });
    sendPos(id);
  }
}

const relay = new Relay(initialRoom, renderQrStatus, onRelayMessage);
renderQrStatus(relay);
renderQr(relay.room);
relay.connect();
void initSounds(); // the picked clips (public/sounds), decoded once; nothing picked = silent
initSpells({ send: (m) => send(m) }); // listens for level-changed
// Ghosts: a caught cursor drops what it holds and its nocked bow falls.
initGhosts({
  send: (m) => send(m),
  onGhost: (id) => {
    letGo(id, false);
    cancelNockFor(id);
    sendPos(id); // a ghost drifts (less gain): resync its map dot
  },
  onRevive: (id) => sendPos(id),
});
initHealer({ send: (m) => send(m) }); // listens for level-changed: walks in at level 3
initHorde({ send: (m) => send(m), announce }); // listens for level-changed too; before initLevels dispatches it
initLevels({ send: (m) => send(m) }); // before the quest: a full bag at startup must not re-fire level 1
initQuest({ send: (m) => send(m), isInteractive: () => mode.interactive });
initTrinkets({ isInteractive: () => mode.interactive }); // knick-knacks from level 0 on
initMoongate({
  onTeleport: (id) => send({ type: "teleport", to: id }),
  onPortal: (id, url) => send({ type: "travel", to: id, url }), // the ending: that phone leaves for Mystica
  isInteractive: () => mode.interactive,
});
initMouse(); // the Seer's own cursor, for the ankh quorum
initCodex();
initCat({ send: (m) => send(m) }); // level 1: Ginger bats reagents about (phones hear it)
initSignpost({
  send: (m) => send(m), // level 1: the birds steal (phones hear it)
  onSnatch: (id, name, color) => {
    // a bird took it out of a parked Seeker's hands: the grip is gone
    window.clearTimeout(grips.get(id));
    grips.delete(id);
    send({ type: "drop", to: id, kind: "reagent", name, collected: false, snatched: true, by: color });
    sendPos(id);
  },
  cat: { pos: catPos, lunge: catLunge }, // Ginger chases a bird that lands near him
});
initAnkh({ send: (m) => send(m) });
initMinimap({ send: (m) => send(m), carry: CARRY_BOOST, ghost: GHOST_DRIFT }); // phones' maps: layout once + on change, pos on jumps
// Phantom Seekers (devtools): their gestures enter here as if the relay had forwarded them.
initPhantoms({ inject: (m) => onRelayMessage(m as RelayMessage), onHear: devPhoneLine, onChange: devPhantomsChanged });
initDev();

// ---- Actions: hotkeys (Ctrl+Shift+Q/R/X via Rust), widget buttons, tray ----
function dropEverything() {
  for (const t of grips.values()) window.clearTimeout(t);
  grips.clear();
  questDropAll();
  trinketDropAll();
  widgetDropAll();
  forgetAllGhosts();
  identified.clear();
  forgetAllNames();
}
function rotateRoom() {
  const room = newRoomCode();
  localStorage.setItem(ROOM_KEY, room);
  dropEverything();
  clearCursors();
  relay.setRoom(room); // kicks the old room's phones first
  renderQrStatus(relay);
  renderQr(room);
}
function killSwitch() {
  relay.kick();
  dropEverything();
  clearCursors();
  toggleQrFullscreen(false);
}
const actions: Record<string, () => void> = {
  qr: () => toggleQrFullscreen(),
  rotate: rotateRoom,
  kill: killSwitch,
  stream: () => {
    toggleStreamMode();
    loadLayout(); // each mode keeps its own widget arrangement
  },
  hide: () => setHidden(!hidden),
  lock: () => invoke("set_locked", { locked: !mode.locked }),
  dev: () => toggleDev(),
  end: () => toggleEnding(),
};
$("#dev-btn").addEventListener("click", () => toggleDev());
$("#dev-end").addEventListener("click", actions.end);
listen<string>("hotkey", (e) => actions[e.payload]?.());
$("#qr-expand").addEventListener("click", actions.qr);
$("#qr-rotate").addEventListener("click", actions.rotate);
$("#qr-kill").addEventListener("click", actions.kill);

// ---- Draggable widgets (positions persist in localStorage, one layout per mode) ----
type Pos = { x: number; y: number };
function readLayout(): Record<string, Pos> {
  try {
    return JSON.parse(localStorage.getItem(layoutKey()) ?? "{}");
  } catch {
    return {};
  }
}
function saveWidgetPos(id: string, pos: Pos) {
  const layout = readLayout();
  layout[id] = pos;
  localStorage.setItem(layoutKey(), JSON.stringify(layout));
}
// The default positions in index.html are laid out for a 1536x960 viewport (Bobby's). On
// another display (2026-10-03) a widget with no saved position is placed
// proportionally and kept on screen, so a fresh machine looks right without dragging.
const DESIGN_W = 1536;
const DESIGN_H = 960;
const defaults = new Map<string, Pos>();
for (const el of document.querySelectorAll<HTMLElement>(".widget")) {
  defaults.set(el.dataset.widget!, { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 });
}
/** Apply the current mode's saved positions; widgets without one take their default, scaled to this display. */
function loadLayout() {
  const layout = readLayout();
  const sx = innerWidth / DESIGN_W;
  const sy = innerHeight / DESIGN_H;
  for (const el of document.querySelectorAll<HTMLElement>(".widget")) {
    if (el.dataset.fixed !== undefined) continue;
    const id = el.dataset.widget!;
    const p = layout[id];
    if (p) {
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      continue;
    }
    const d = defaults.get(id);
    if (!d) continue;
    el.style.left = `${d.x * sx}px`;
    el.style.top = `${d.y * sy}px`;
    const r = el.getBoundingClientRect(); // hidden widgets (level 0) have no size: nothing to clamp
    if (r.width) {
      el.style.left = `${Math.max(0, Math.min(innerWidth - r.width, d.x * sx))}px`;
      el.style.top = `${Math.max(0, Math.min(innerHeight - r.height, d.y * sy))}px`;
    }
  }
}
loadLayout();

for (const el of document.querySelectorAll<HTMLElement>(".widget")) {
  const id = el.dataset.widget!;
  const handleOnly = el.dataset.handle !== undefined; // dragged only by its .handle (the moongate, by its runes)

  el.addEventListener("pointerdown", (ev) => {
    // data-fixed = nobody moves this one; checked per press, since the ankh gains it while it rests on the gate.
    if (!mode.interactive || ev.button !== 0 || el.dataset.fixed !== undefined) return;
    delete el.dataset.dragged; // set once the pointer really moves (lets click handlers ignore drags)
    const target = ev.target as HTMLElement;
    if (target.closest("button, a, input, .reagent, .bird")) return;
    if (handleOnly && !target.closest(".handle")) return; // the gate itself stays a click target
    const startX = ev.clientX;
    const startY = ev.clientY;
    const rect = el.getBoundingClientRect();
    el.setPointerCapture(ev.pointerId);
    el.classList.add("dragging");

    const move = (m: PointerEvent) => {
      if (el.dataset.fixed !== undefined) return; // it snapped onto the gate mid-drag
      if (Math.abs(m.clientX - startX) + Math.abs(m.clientY - startY) > 4) el.dataset.dragged = "1";
      el.style.left = `${rect.left + (m.clientX - startX)}px`;
      el.style.top = `${rect.top + (m.clientY - startY)}px`;
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.classList.remove("dragging");
      if (el.dataset.fixed === undefined) saveWidgetPos(id, { x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  });
}
