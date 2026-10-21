// Tiny sliding-window limiter for phone messages: allow(key, maxPerSecond).
// The relay already drops floods; this keeps a "naughty" phone from spamming
// actions on the overlay (wiggles, grabs, double-tap opens).
const windows = new Map<string, number[]>();

export function allow(key: string, maxPerSec: number): boolean {
  const now = performance.now();
  const arr = windows.get(key) ?? [];
  while (arr.length && now - arr[0] > 1000) arr.shift();
  if (arr.length >= maxPerSec) {
    windows.set(key, arr);
    return false;
  }
  arr.push(now);
  windows.set(key, arr);
  return true;
}

export function forget(key: string) {
  for (const k of [...windows.keys()]) if (k.startsWith(key)) windows.delete(k);
}
