// Who is who. Every phone gets a random name from generic words (no character
// or place names from the games, by Bobby's rule) and the colour of its cursor.
// Phones never choose their own name. "mouse" is the presenter: the Seer (Bobby's
// pick, 2026-10-01; Seer, Counselor and Game Master were the UO volunteer ranks,
// generic words). The audience are Seekers.
import { getCursor } from "./cursors";

export const PRESENTER_TITLE = "Seer";
export const PLAYER_TITLE = "Seeker"; // what the phone page calls its user; plural in the docs

const ADJECTIVES = [
  "Honest", "Valiant", "Humble", "Just", "Merry", "Curious", "Wandering", "Bold", "Gentle", "Silent",
  "Clever", "Fearless", "Patient", "Kindly", "Stout", "Nimble", "Wise", "Weary", "Eager", "Lucky",
];
const PROFESSIONS = [
  "Bard", "Mage", "Ranger", "Shepherd", "Tinker", "Druid", "Paladin", "Fighter", "Alchemist", "Scribe",
  "Apprentice", "Wanderer", "Healer", "Minstrel", "Squire", "Pilgrim",
];
const PRESENTER = { name: PRESENTER_TITLE, color: "#f1d271" };

const names = new Map<string, string>();

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

/** The name for a phone id, assigned on first sight and unique within the session. */
export function nameFor(id: string): string {
  let n = names.get(id);
  if (n) return n;
  const taken = new Set(names.values());
  do {
    n = Math.random() < 1 / 12 ? `Avatar ${pick(["of Honesty", "of Compassion", "of Valor", "of Justice", "of Sacrifice", "of Honor", "of Spirituality", "of Humility"])}` : `${pick(ADJECTIVES)} ${pick(PROFESSIONS)}`;
  } while (taken.has(n));
  names.set(id, n);
  return n;
}
export function forgetName(id: string) {
  names.delete(id);
}
export function forgetAllNames() {
  names.clear();
}

/** Display label + colour for whoever `by` is (phone id or "mouse"). */
export function labelFor(by: string): { name: string; color: string } {
  if (by === "mouse") return PRESENTER;
  return { name: names.get(by) ?? nameFor(by), color: getCursor(by)?.color ?? "#cfd3d8" };
}
