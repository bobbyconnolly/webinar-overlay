// Phones can carry some widgets: hold on one grabs it, swipes carry it, release
// leaves it there (position persisted like the presenter's drags). Which
// widgets are movable by phones is a fixed list; the QR, the goals and the
// moongate are not. The presenter drags with the mouse via main.ts.
import { getCursor, onCursorFrame } from "./cursors";
import { layoutKey } from "./stage";

// Add "moongate" to let phones carry the gate too (by its runes: data-handle applies here as well).
const MOVABLE = new Set(["backpack", "gump", "image", "text"]);
const LABELS: Record<string, string> = {
  backpack: "backpack",
  gump: "open bag",
  image: "ankh",
  text: "codex",
  moongate: "moongate",
};

const held = new Map<string, { el: HTMLElement; ox: number; oy: number }>();

export function widgetHold(phoneId: string): { name: string; id: string } | null {
  const c = getCursor(phoneId);
  if (!c || held.has(phoneId)) return null;
  for (const e of document.elementsFromPoint(c.x, c.y)) {
    const w = (e as HTMLElement).closest?.(".widget") as HTMLElement | null;
    if (!w) continue;
    const id = w.dataset.widget ?? "";
    if (!MOVABLE.has(id) || w.dataset.fixed !== undefined || [...held.values()].some((h) => h.el === w)) return null;
    if (w.dataset.handle !== undefined && !(e as HTMLElement).closest(".handle")) return null; // only by its handle
    const r = w.getBoundingClientRect();
    held.set(phoneId, { el: w, ox: r.left - c.x, oy: r.top - c.y });
    w.classList.add("carried");
    return { name: LABELS[id] ?? id, id };
  }
  return null;
}

export function widgetRelease(phoneId: string): { name: string; id: string } | null {
  const h = held.get(phoneId);
  if (!h) return null;
  held.delete(phoneId);
  h.el.classList.remove("carried");
  const id = h.el.dataset.widget ?? "";
  saveWidgetPos(h.el);
  return { name: LABELS[id] ?? id, id };
}
/** Persist a widget's position in the current mode's layout (the same key the mouse drag uses). */
export function saveWidgetPos(el: HTMLElement) {
  const id = el.dataset.widget ?? "";
  try {
    const saved = JSON.parse(localStorage.getItem(layoutKey()) ?? "{}");
    saved[id] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    localStorage.setItem(layoutKey(), JSON.stringify(saved)); // the current mode's layout
  } catch {
    /* storage unavailable: position just does not persist */
  }
}
/** Take a widget out of whichever phone's hands it is in (the ankh snapping onto the gate); returns the phone ids. */
export function releaseWidget(el: HTMLElement): string[] {
  const ids: string[] = [];
  for (const [id, h] of held) if (h.el === el) ids.push(id);
  for (const id of ids) widgetRelease(id);
  return ids;
}

export function widgetDropAll() {
  for (const id of [...held.keys()]) widgetRelease(id);
}

onCursorFrame((cursors) => {
  for (const [by, h] of held) {
    const c = cursors.get(by);
    if (!c) continue;
    h.el.style.left = `${c.x + h.ox}px`;
    h.el.style.top = `${c.y + h.oy}px`;
  }
});
