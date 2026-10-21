// Stream mode: everything the audience must see gets bigger, because the
// overlay reaches them at roughly half scale through a 720p video stream.
// CSS reads --stage (element sizes) and --stage-w (widget transform); JS that
// works in screen pixels (reagent hit-tests, bag placement) reads stage().
const STREAM_STAGE = 1.5;
const STORAGE_KEY = "overlay.stream";
let current = 1;

export function stage(): number {
  return current;
}
/** Widget positions are saved per mode: arrange the stage once for streaming, once for normal work. */
export function layoutKey(): string {
  return isStreamMode() ? "overlay.widgets.stream.v1" : "overlay.widgets.v1";
}
export function isStreamMode(): boolean {
  return current !== 1;
}
export function setStreamMode(on: boolean) {
  current = on ? STREAM_STAGE : 1;
  const root = document.documentElement;
  root.style.setProperty("--stage", String(current));
  root.style.setProperty("--stage-w", String(current));
  document.body.classList.toggle("stream", on);
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* fine */
  }
}
export function toggleStreamMode() {
  setStreamMode(!isStreamMode());
}
export function initStage() {
  let on = false;
  try {
    on = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* fine */
  }
  setStreamMode(on);
}
