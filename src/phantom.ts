// Phantom Seekers (devtools, Bobby 2026-10-02: attaching a phone every time was
// friction). A phantom is a fake phone that lives only in this page: it gets a
// cursor, a name and every message a phone would get, and the Seer drives it
// with the mouse ("possession"): the cursor follows the mouse (also while
// click-through, from the Rust-reported position), and while the overlay is
// interactive a full-screen layer swallows the pointer and turns it into the
// phone's gestures: click = tap, two quick clicks = double-tap, press and hold
// = hold (grab), release = release, so every phone-only path (grab inside the
// bag, carry a widget, open the gump, turn the codex, the ankh quorum with the
// mouse, the moonglow, the horde credit) can be exercised alone. The gestures go
// through main.ts exactly as relay messages would. Messages addressed to the
// possessed phantom are shown in the devtools panel the way the phone would
// say them. Esc lets go.
import { getCursor, setCursorTarget, teleportCursor } from "./cursors";
import { labelFor } from "./identity";
import { freeSpot } from "./moongate";
import { onMouse } from "./mouse";
import { stage } from "./stage";

const HOLD_MS = 350; // same as the phone page
const TAP_MOVE_PX = 10;
const DBLTAP_MS = 350;

type Hooks = {
  inject: (msg: Record<string, unknown>) => void; // into main.ts as if it came from the relay
  onHear: (id: string, text: string) => void; // what the phantom's screen would say
  onChange: () => void; // phantoms added / removed / possessed
};
let hooks: Hooks;
let seq = 0;
const bots: string[] = [];
let possessed: string | null = null;
const layer = document.getElementById("possess")!;
let active: { x0: number; y0: number; t0: number; moved: boolean; held: boolean; holdTimer: number } | null = null;
let lastTapAt = 0;

export function phantomIds(): string[] {
  return [...bots];
}
export function possessedId(): string | null {
  return possessed;
}
export function isPhantom(id: string): boolean {
  return bots.includes(id);
}

/** A new phantom joins (named and identified like a phone) and the mouse takes it over. */
export function addPhantom(): string {
  const id = `bot-${++seq}`;
  bots.push(id);
  hooks.inject({ type: "join", role: "phone", id });
  const p = freeSpot(); // somewhere random and clear of widgets (Bobby: not all on the centre)
  teleportCursor(id, p.x, p.y);
  possess(id);
  return id;
}
export function removePhantom(id: string) {
  if (!bots.includes(id)) return;
  if (possessed === id) possess(null);
  bots.splice(bots.indexOf(id), 1);
  hooks.inject({ type: "leave", id });
  hooks.onChange();
}
/** Devtools Restart: a new game starts with no phantoms (a parked one counts as a player, which cost Bobby an ankh quorum). */
export function removeAllPhantoms(): number {
  const n = bots.length;
  for (const id of [...bots]) removePhantom(id);
  return n;
}
/** The mouse drives this phantom (null: none). */
export function possess(id: string | null) {
  if (possessed && possessed !== id) {
    endGesture();
    getCursor(possessed)?.el.classList.remove("possessed");
  }
  possessed = id && bots.includes(id) ? id : null;
  document.body.classList.toggle("possessing", !!possessed);
  if (possessed) {
    getCursor(possessed)?.el.classList.add("possessed");
    const c = getCursor(possessed);
    if (c) hooks.onHear(possessed, `you are ▲ ${labelFor(possessed).name} · the mouse drives this Seeker`);
  }
  hooks.onChange();
}

function send(m: Record<string, unknown>) {
  if (possessed) hooks.inject({ ...m, id: possessed, from: "phone" });
}
function endGesture() {
  if (!active) return;
  window.clearTimeout(active.holdTimer);
  active = null;
  send({ type: "release" });
}

// The possessed cursor's tip sits under the mouse, interactive or not.
onMouse((p) => {
  if (possessed) setCursorTarget(possessed, p.x - 3 * stage(), p.y - 2 * stage());
});

// The phone page's gestures, on the capture layer (only shown while possessing and interactive).
layer.addEventListener("pointerdown", (e) => {
  if (!possessed || e.button !== 0 || active) return;
  e.preventDefault();
  layer.setPointerCapture(e.pointerId);
  const a = { x0: e.clientX, y0: e.clientY, t0: Date.now(), moved: false, held: false, holdTimer: 0 };
  active = a;
  a.holdTimer = window.setTimeout(() => {
    if (active === a && !a.moved) {
      a.held = true;
      send({ type: "hold" });
    }
  }, HOLD_MS);
});
layer.addEventListener("pointermove", (e) => {
  if (!active) return;
  if (!active.moved && Math.hypot(e.clientX - active.x0, e.clientY - active.y0) > TAP_MOVE_PX) {
    active.moved = true;
    if (!active.held) window.clearTimeout(active.holdTimer);
  }
});
const end = (e: PointerEvent) => {
  if (!active) return;
  e.preventDefault();
  window.clearTimeout(active.holdTimer);
  const { moved, held, t0 } = active;
  active = null;
  if (!moved && !held && Date.now() - t0 < HOLD_MS) {
    const now = Date.now();
    if (now - lastTapAt < DBLTAP_MS) {
      send({ type: "dbltap" });
      lastTapAt = 0;
    } else {
      send({ type: "tap" });
      lastTapAt = now;
    }
  }
  send({ type: "release" });
};
layer.addEventListener("pointerup", end);
layer.addEventListener("pointercancel", end);
layer.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && possessed) possess(null);
});

/** main.ts: every outgoing message passes here; the possessed phantom's screen line follows. */
export function phantomHear(m: object) {
  const msg = m as Record<string, unknown>;
  const to = typeof msg.to === "string" ? msg.to : undefined;
  if (!possessed) return;
  if (msg.type === "pos" || msg.type === "layout") return; // the mini-map's data, not words
  if (to ? to !== possessed : msg.type === "spells") return; // broadcasts count (the thefts, the cat), except the chatty stock updates
  hooks.onHear(possessed, phoneText(msg));
}

/** Roughly what the phone page shows for a message (same wording where it matters). */
function phoneText(m: Record<string, unknown>): string {
  const s = (v: unknown) => String(v ?? "");
  const list = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
  switch (m.type) {
    case "you":
      return `you are ▲ ${s(m.name)} (${s(m.role)})`;
    case "spells":
      return `spellbook ${m.enabled ? "open" : "closed"} · stock: ${list(m.stock) || "nothing"}`;
    case "grab":
      return `holding ${s(m.name)} · push to carry, lift to drop`;
    case "drop":
      if (m.snatched) return `the ${s(m.by)} bird snatched ${s(m.name)} out of your hands!`;
      if (m.placed) return "the ankh is set upon the moongate";
      if (m.spent) return `${s(m.name)} was spent by a spell`;
      if (m.kept) return `${s(m.name)} stays in the pack · only the Seer takes things out`;
      if (m.slipped) return `your grip slipped · ${s(m.name)} fell`;
      return m.collected ? `${s(m.name)} into the pack! · you: ${s(m.score)}` : `dropped ${s(m.name)}`;
    case "teleport":
      return m.state === "gathered" ? "pulled onto the moongate · get off it!" : m.state === "bagged" ? `${list(m.names)} flew into the pack` : "the moongate took you somewhere else";
    case "travel":
      return `the moongate opens · tap Enter Mystica (${s(m.url)})`;
    case "gump":
      return m.state === "opened" ? "you opened the backpack" : "the backpack is already open";
    case "codex":
      return m.state === "page" ? `codex · page ${s(m.page)} of ${s(m.of)}` : m.state === "opened" ? "you unrolled the codex" : m.state === "closed" ? "you rolled up the codex" : "the codex is not ready yet";
    case "ankh":
      return m.state === "stirs" ? `the ankh stirs · ${s(m.have)} of ${s(m.need)} Seekers` : m.state === "blessed" ? "the ankh blesses you · sparkles for a minute" : `the ankh awakens · blessed ${list(m.names) || "nobody"}`;
    case "meow":
      return "meow!";
    case "shoved":
      return "the lightning threw you back";
    case "bird":
      return m.state === "steal" ? (m.victim ? `the ${s(m.color)} bird snatched ${s(m.name)} from ${s(m.victim)}` : `the ${s(m.color)} bird carries ${s(m.name)} off to the signpost`) : m.state === "chased" ? `Ginger chases the ${s(m.color)} bird off!` : `you startled the ${s(m.color)} bird`;
    case "cat":
      if (m.state === "scare") return `Ginger startles the ${s(m.color)} bird off the post`;
      if (m.state === "lunge") return "hss! Ginger lunges";
      if (m.state === "perch") return `Ginger charges ${s(m.name)} and sits on it, tail flicking`;
      if (m.state === "gate") return "the moongate took Ginger · he looks confused";
      if (m.state === "ankh") return "Ginger purrs on the ankh · it conjures him a dish";
      if (m.state === "yarn") return "Ginger goes for the ball of yarn";
      if (m.state === "swat") return "Ginger pounces at your yarn · keep it moving!";
      return m.kick ? `Ginger bolts off and knocks ${s(m.name)} away!` : m.again ? `Ginger bats ${s(m.name)} again!` : `Ginger bats ${s(m.name)} across the floor`;
    case "respawn":
      return `${list(m.names)} is back on the overlay`;
    case "glow":
      return m.state === "end" ? `moonglow over · ${list(m.winners) || "nobody"} won (${s(m.top)})` : `moonglow ${s(m.count)}`;
    case "cast":
      if (m.ok) return m.nocked ? "arrow nocked · push to shoot" : `you cast ${s(m.spell)}`;
      return `cast failed: ${s(m.reason)}`;
    case "casted":
      return `${s(m.by)} casts ${s(m.name)}`;
    case "aimed":
      if (m.state === "charging") return "the bow strains · the last arrow charges";
      return `${m.big ? "the great arrow" : `arrow ${s(m.shot)} of ${s(m.of)}`} · ${m.slain ? `slew ${s(m.slain)} · ` : ""}${list(m.hits) ? `hit ${list(m.hits)}` : "flew off"}`;
    case "ult":
      return "Ginger unleashes · the horde turns to ash";
    case "ghost":
      return m.state === "dead" ? `a ${s(m.by)} got you · a ghost for ${Math.round(Number(m.ms) / 1000)} s · drift to the healer` : m.how === "healer" ? "the healer restores thee" : "thou art alive again";
    case "healer":
      return "the healer bows · thou art in good health";
    case "goto":
      return m.ok ? "you jump to the mark on the map" : m.reason === "carrying" ? "thou canst not jump while carrying · lift first" : "a ghost can only drift";
    case "hit":
      return `${s(m.by)}'s magic arrow hit you`;
    case "quest":
      return m.state === "level" ? (m.level === 0 ? `${s(m.goal)}` : `level ${s(m.level)} · ${s(m.goal)}`) : m.state === "complete" ? `all reagents gathered · ${s(m.top)} led` : m.state === "mastered" ? `every spell cast · ${s(m.top)} cast the most` : m.state === "filled" ? "the pack is filled · cast freely" : "the reagents are scattered anew";
    case "horde":
      switch (m.state) {
        case "key":
          return "the ankh yearns for the moongate · carry it there";
        case "placed":
          return "the ankh rests on the moongate · gather on it";
        case "wave":
          return `wave ${s(m.wave)} · ${s(m.count)} monsters come through the moongate`;
        case "stolen":
          return `a ${s(m.kind)} took ${s(m.name)} from the pack`;
        case "escaped":
          return `the ${s(m.kind)} escaped with ${s(m.name)}`;
        case "daemon":
          return "a daemon steps out of the moongate · dodge its fireballs";
        case "end":
          return `${m.vanquished ? "the horde is vanquished" : "the horde retreats"} · ${list(m.winners) || "nobody"} slew the most (${s(m.top)})${m.lost ? ` · ${s(m.lost)} carried off` : ""}`;
        default:
          return `horde ${s(m.state)}`;
      }
    case "slay":
      return `${m.how === "charmed" ? "Ginger sent a" : m.how === "ashed" ? "Ginger turned a" : m.how === "banished" ? "you banished a" : "you slew a"} ${s(m.kind)}${m.how === "ashed" ? " to ash" : ""} · ${s(m.count)}`;
    default:
      return JSON.stringify(m);
  }
}

export function initPhantoms(h: Hooks) {
  hooks = h;
}
