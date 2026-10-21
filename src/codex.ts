// The codex (parchment card): the stage's lore and, from level 1 on, the Seer's
// notes for the level. It rolls up into a scroll icon about the size of the
// backpack. The Seer double-clicks it to roll or unroll and turns pages with the
// ‹ › buttons; phones tap it with their cursor on it to turn the page and
// double-tap to roll or unroll. Every phone action on it, and every Seer action,
// starts one shared LOCK_MS during which phones get "not ready" (Bobby: a page
// turn must not be undone by someone else's double-tap right away). The Seer is
// never locked.
//
// Pages carry data-level (index.html): the level-0 pages are lore (the greeting,
// Ginger, the trinkets); the others are one-line tips in big type, since Discord
// shows the overlay at half scale. The codex is a herald (Bobby 2026-10-03): at a
// level change it unrolls, pops to that level's first page and, from level 1 on,
// rolls itself up again HERALD_MS after the last page turn or unroll, so the tips
// come and go and the stage stays clear. At level 0 it stays open (the greeting is
// part of the bare stage). Each tip page's data-phone is the plain version the
// phones get: with the level message, and when a tap turns to it.
import { getCursor } from "./cursors";

const ROLLED_KEY = "overlay.codex.rolled";
const PAGE_KEY = "overlay.codex.page";
const PAD = 16; // hit tolerance around the card / scroll, px
const LOCK_MS = 6000;
export const HERALD_MS = 30_000; // from level 1 on: open this long after the last page turn, then it rolls itself

const codex = document.querySelector<HTMLElement>("[data-widget=text]")!;
const allPages = [...codex.querySelectorAll<HTMLElement>(".codex-page")];
const pageNo = codex.querySelector<HTMLElement>("#codex-pageno")!;
let level = 0;
let pages = pagesOf(0);
let page = 0;
let lockedUntil = 0;
let rollTimer = 0;

function pagesOf(n: number): HTMLElement[] {
  const ps = allPages.filter((p) => Number(p.dataset.level) === n);
  return ps.length ? ps : allPages.filter((p) => Number(p.dataset.level) === 0);
}
function lock() {
  lockedUntil = Date.now() + LOCK_MS;
}
function phoneMay(): boolean {
  return Date.now() >= lockedUntil;
}
function render() {
  for (const p of allPages) {
    p.classList.toggle("lvl", pages.includes(p)); // the level's pages share one grid cell, so the card's height is the tallest of them and the ‹ › buttons never jump (Bobby)
    p.classList.toggle("on", p === pages[page]);
  }
  pageNo.textContent = `${page + 1} / ${pages.length}`;
}
function savePage() {
  try {
    localStorage.setItem(PAGE_KEY, String(page));
  } catch {
    /* fine */
  }
}
/** Roll or unroll (with the pop), persist; no lock, no timer: the callers decide those. */
function apply(open: boolean) {
  codex.classList.toggle("rolled", !open);
  codex.classList.remove("pop");
  void codex.offsetWidth;
  codex.classList.add("pop");
  try {
    localStorage.setItem(ROLLED_KEY, open ? "0" : "1");
  } catch {
    /* fine */
  }
}
/** From level 1 on, an open codex rolls itself HERALD_MS after the last thing anyone did to it. */
function armRoll() {
  window.clearTimeout(rollTimer);
  if (level < 1 || !isCodexOpen()) return;
  rollTimer = window.setTimeout(() => {
    if (isCodexOpen()) apply(false); // no lock: whoever wants it back may unroll it at once
  }, HERALD_MS);
}

export function isCodexOpen() {
  return !codex.classList.contains("rolled");
}
export function setCodexOpen(open: boolean) {
  apply(open);
  lock();
  armRoll();
}
export function toggleCodex() {
  setCodexOpen(!isCodexOpen());
}

export function setPage(n: number) {
  page = ((n % pages.length) + pages.length) % pages.length;
  render();
  savePage();
  lock();
  armRoll();
}

/** The plain phone wording of the level's first note (undefined for the lore pages of level 0). */
export function codexTip(n: number): string | undefined {
  return pagesOf(n)[0]?.dataset.phone || undefined;
}

/** Startup (levels.ts, before initCodex): which level's pages, no fuss. */
export function setCodexLevel(n: number) {
  level = n;
  pages = pagesOf(n);
  page = Math.min(page, pages.length - 1);
  render();
  armRoll();
}
/** A level change (levels.ts): the codex unrolls on that level's first page, pops, and (from level 1) tucks itself away later. */
export function heraldLevel(n: number) {
  level = n;
  pages = pagesOf(n);
  page = 0;
  render();
  savePage();
  apply(true);
  armRoll();
}

function cursorOnCodex(phoneId: string): boolean {
  const c = getCursor(phoneId);
  if (!c) return false;
  const r = codex.getBoundingClientRect();
  return c.x >= r.left - PAD && c.x <= r.right + PAD && c.y >= r.top - PAD && c.y <= r.bottom + PAD;
}

/** A phone double-tapped: rolls / unrolls if its cursor is on the codex and the lock is free. */
export function codexDoubleTap(phoneId: string): "opened" | "closed" | "ignored" | null {
  if (!cursorOnCodex(phoneId)) return null;
  if (!phoneMay()) return "ignored";
  toggleCodex();
  return isCodexOpen() ? "opened" : "closed";
}

/** A phone tapped: turns the page if its cursor is on the open codex and the lock is free. `tip` = the new page's plain wording, for tip pages. */
export function codexTap(phoneId: string): { page: number; of: number; tip?: string } | "ignored" | null {
  if (!isCodexOpen() || !cursorOnCodex(phoneId)) return null;
  if (!phoneMay()) return "ignored";
  setPage(page + 1);
  return { page: page + 1, of: pages.length, tip: pages[page].dataset.phone || undefined };
}

export function initCodex() {
  let rolled = false;
  let saved = 0;
  try {
    rolled = localStorage.getItem(ROLLED_KEY) === "1";
    saved = Number(localStorage.getItem(PAGE_KEY)) || 0;
  } catch {
    /* fine */
  }
  codex.classList.toggle("rolled", rolled);
  page = Math.min(Math.max(0, saved), pages.length - 1);
  render();
  lockedUntil = 0; // startup is not a transaction
  armRoll();
  // Listen on the widget: the drag handler captures the pointer and retargets dblclick to it.
  codex.addEventListener("dblclick", (e) => {
    if (codex.dataset.dragged || (e.target as HTMLElement).closest("button")) return;
    toggleCodex();
  });
  codex.querySelector("#codex-prev")!.addEventListener("click", () => setPage(page - 1));
  codex.querySelector("#codex-next")!.addEventListener("click", () => setPage(page + 1));
}
