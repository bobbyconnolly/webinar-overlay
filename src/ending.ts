// The ending (Ctrl+Shift+E, or "Ending" in devtools): a full-screen QR that sends everyone to
// Mystica, the next game. The URL comes from VITE_MYSTICA_URL (a deployed-resource URL, so it lives
// in .env, never in the repo). Same QR options as the relay QR so the two read as one family.
import QRCode from "qrcode";
import { MYSTICA_URL } from "./mystica";
import { setGatePortal } from "./moongate";
import { setQrMode } from "./qr";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const full = $("#end-full");
const big = $("#end-big");
const host = $("#end-host");

let open = false;
let rendered = false;

async function render(): Promise<void> {
  if (rendered) return;
  rendered = true;
  if (!MYSTICA_URL) {
    full.dataset.status = "unconfigured";
    host.textContent = "VITE_MYSTICA_URL is not set";
    return;
  }
  const svg = await QRCode.toString(MYSTICA_URL, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#1a1208", light: "#f7efd8" },
  });
  big.innerHTML = svg;
  host.textContent = new URL(MYSTICA_URL).host;
  full.dataset.status = "ready";
}

/**
 * Show or hide the ending screen. While it is up the moongate is a portal (a cursor on it sends
 * that phone to Mystica) and the QR widget shows the Mystica code as the backup route.
 */
export function toggleEnding(force?: boolean): void {
  const next = force ?? !open;
  if (next === open) return;
  open = next;
  if (open) void render();
  full.classList.toggle("open", open);
  document.body.classList.toggle("end-open", open);
  setGatePortal(open ? MYSTICA_URL : "");
  setQrMode(open && MYSTICA_URL ? "mystica" : "room");
}

export const endingOpen = (): boolean => open;

$("#end-close").addEventListener("click", () => toggleEnding(false));
full.addEventListener("click", (e) => {
  if (e.target === full) toggleEnding(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && open) toggleEnding(false);
});
