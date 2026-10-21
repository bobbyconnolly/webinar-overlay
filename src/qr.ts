// QR widget + full-screen QR view. The QR encodes the relay's mobile page URL
// for the current room. The full-screen view animates from the widget's small
// QR (FLIP: measure first/last rects, transition the transform).
import QRCode from "qrcode";
import { pageUrl, relayConfigured, relayMode, type Relay } from "./relay";
import { MYSTICA_URL } from "./mystica";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const widget = $("[data-widget=qr]");
const qrSmall = $("#qr-small");
const qrBig = $("#qr-big");
const full = $("#qr-full");
const roomSmall = $("#qr-room");
const roomBig = $("#qr-full-room");
const hostBig = $("#qr-full-host");
const statusEl = $("#qr-status");

const ANIM_MS = 420;
let expanded = false;
let collapseTimer = 0;

// Stepped size of the widget's own QR (− / + round buttons): for late joiners who
// cannot scan it, without going full screen (Bobby does that once, at the start).
// One step below 1× folds the widget into a rune stone (Bobby: once everyone has
// joined the QR is clutter); a click on the stone unfolds it for a latecomer.
const ZOOMS = [0, 1, 1.5, 2, 3]; // 0 = folded into the rune stone
const ZOOM_KEY = "overlay.qr.size";
let zoom = 1;
const biggerBtn = $<HTMLButtonElement>("#qr-bigger");
const smallerBtn = $<HTMLButtonElement>("#qr-smaller");
const icon = $("#qr-icon");
export function isQrFolded() {
  return ZOOMS[zoom] === 0;
}
function applyZoom() {
  const z = ZOOMS[zoom];
  widget.classList.toggle("collapsed", z === 0);
  widget.style.setProperty("--qr-zoom", String(z || 1));
  biggerBtn.disabled = zoom === ZOOMS.length - 1;
  smallerBtn.disabled = zoom === 0;
}
function setQrZoom(i: number) {
  zoom = Math.max(0, Math.min(ZOOMS.length - 1, i));
  applyZoom();
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {
    /* fine */
  }
}
export function stepQrZoom(dir: 1 | -1) {
  setQrZoom(zoom + dir);
}
try {
  const saved = localStorage.getItem(ZOOM_KEY);
  if (saved !== null) zoom = Math.max(0, Math.min(ZOOMS.length - 1, Number(saved) || 0));
} catch {
  /* fine */
}
applyZoom();
biggerBtn.addEventListener("click", () => stepQrZoom(1));
smallerBtn.addEventListener("click", () => stepQrZoom(-1));
// A click on the stone (not a drag, not a button: the − click bubbles up here after it
// has already folded the widget) unfolds it. Listen on the widget: the drag handler
// captures the pointer and retargets clicks to it. A double-click folds / unfolds.
widget.addEventListener("click", (e) => {
  if (widget.dataset.dragged || (e.target as HTMLElement).closest("button") || !isQrFolded()) return;
  setQrZoom(1);
});
widget.addEventListener("dblclick", (e) => {
  if (widget.dataset.dragged || (e.target as HTMLElement).closest("button")) return;
  setQrZoom(isQrFolded() ? 1 : 0);
});

/** "room": the relay page for this room. "mystica": the next game, the ending's backup route. */
export type QrMode = "room" | "mystica";
let qrMode: QrMode = "room";
let currentRoom = "";
export function setQrMode(m: QrMode) {
  if (m === qrMode) return;
  qrMode = m;
  widget.dataset.qrmode = m;
  full.dataset.qrmode = m;
  void renderQr(currentRoom);
}

export async function renderQr(room: string) {
  currentRoom = room;
  if (qrMode === "mystica" && MYSTICA_URL) {
    roomSmall.textContent = "Mystica";
    roomBig.textContent = "Mystica";
    const msvg = await QRCode.toString(MYSTICA_URL, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#1a1208", light: "#f7efd8" } });
    qrSmall.innerHTML = msvg;
    qrBig.innerHTML = msvg;
    hostBig.textContent = new URL(MYSTICA_URL).host;
    return;
  }
  roomSmall.textContent = room;
  roomBig.textContent = room;
  if (!relayConfigured) {
    // Setup card instead of a QR: the phone half needs a relay.
    const steps = `<div class="qr-none"><b>no relay configured</b>
      <span>run <code>npm run relay:local</code> (phones on your Wi-Fi)</span>
      <span>or <code>bash scripts/deploy.sh</code> (Azure)</span>
      <span>then restart the overlay</span></div>`;
    qrSmall.innerHTML = qrBig.innerHTML = steps;
    hostBig.textContent = "";
    return;
  }
  const url = pageUrl(room);
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#1a1208", light: "#f7efd8" },
  });
  qrSmall.innerHTML = svg;
  qrBig.innerHTML = svg;
  hostBig.textContent = new URL(url).host;
}

export function renderQrStatus(r: Relay) {
  widget.dataset.status = r.status;
  full.dataset.status = r.status;
  const where = relayMode() === "local" ? "local Wi-Fi" : "cloud";
  statusEl.textContent =
    r.status === "online"
      ? `online · ${where} · ${r.phones} phone${r.phones === 1 ? "" : "s"}`
      : r.status === "unconfigured"
        ? "no relay configured"
        : r.status === "offline" && r.lastClose === 4003
          ? `offline · ${where} · bad VITE_RELAY_KEY`
          : `${r.status} · ${where}`;
}

export function isQrExpanded() {
  return expanded;
}

export function toggleQrFullscreen(force?: boolean) {
  const next = force ?? !expanded;
  if (next === expanded) return;
  expanded = next;
  window.clearTimeout(collapseTimer);
  document.body.classList.toggle("qr-open", expanded);

  if (expanded) {
    // FLIP: start the big QR where the small one is, then let it grow into place.
    const first = (isQrFolded() ? icon : qrSmall).getBoundingClientRect();
    full.classList.add("open");
    const last = qrBig.getBoundingClientRect();
    qrBig.style.transition = "none";
    qrBig.style.transform = flipTransform(first, last);
    qrBig.getBoundingClientRect(); // flush styles
    qrBig.style.transition = "";
    qrBig.style.transform = "";
  } else {
    // Reverse: shrink back onto the small QR, then hide.
    const first = (isQrFolded() ? icon : qrSmall).getBoundingClientRect();
    const last = qrBig.getBoundingClientRect();
    qrBig.style.transform = flipTransform(first, last);
    full.classList.add("closing");
    collapseTimer = window.setTimeout(() => {
      full.classList.remove("open", "closing");
      qrBig.style.transition = "none";
      qrBig.style.transform = "";
      qrBig.getBoundingClientRect();
      qrBig.style.transition = "";
    }, ANIM_MS);
  }
}

function flipTransform(from: DOMRect, to: DOMRect) {
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

// Escape routes: any click on the full-screen view (interactive mode), the ✕
// button, or Escape. Ctrl+Shift+Q arrives via the `hotkey` event in main.ts.
full.addEventListener("click", () => toggleQrFullscreen(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") toggleQrFullscreen(false);
});
