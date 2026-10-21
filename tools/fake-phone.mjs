#!/usr/bin/env node
// A phone you can drive from the terminal. It joins a room on the relay like
// the real phone page does, sends the same messages, and prints everything the
// overlay sends back. No phone, no QR scanning, no Wi-Fi juggling.
//
//   node tools/fake-phone.mjs --room 7TEN --swipe 0.3,0 --tap --stay 3000
//   node tools/fake-phone.mjs --room 7TEN --swipe -0.2,0.1 --hold --swipe 0.4,0 --release
//   node tools/fake-phone.mjs --room 7TEN --dbltap
//   node tools/fake-phone.mjs --room 7TEN --listen          # just sit there and print
//
// Actions run in the order given. Swipe deltas are fractions of the phone's
// screen (1 = a full swipe across). The overlay applies trackpad-style
// acceleration from the speed, so --swipe 0.5,0 --speed 3 (screens per
// second, default 1.5 = a normal swipe) travels further than the same
// distance at --speed 0.5. The relay URL comes from .env.local, then .env
// (VITE_RELAY_URL), or --url.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import WebSocket from "ws";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function option(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
function envValue(key) {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m && m[1].trim()) return m[1].trim();
  }
  return "";
}

const room = (option("--room") || "").toUpperCase();
const base = (option("--url") || envValue("VITE_RELAY_URL")).replace(/\/$/, "");
if (!room || !base) {
  console.error("usage: node tools/fake-phone.mjs --room <CODE> [--url http://host:8080] [actions...]");
  console.error("actions: --swipe dx,dy  --speed n  --tap  --dbltap  --hold  --release  --wait ms  --stay ms  --listen");
  process.exit(1);
}

// Actions in argv order. --speed applies to the swipes that follow it.
const actions = [];
let speed = 1.5;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--speed") speed = Number(argv[++i]) || 1.5;
  else if (a === "--swipe") actions.push({ type: "swipe", value: argv[++i], speed });
  else if (a === "--wait" || a === "--stay") actions.push({ type: "wait", value: Number(argv[++i]) || 1000 });
  else if (["--tap", "--dbltap", "--hold", "--release", "--listen"].includes(a)) actions.push({ type: a.slice(2) });
}

const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws?room=${room}&role=phone`);
const send = (o) => {
  ws.send(JSON.stringify(o));
  console.log("  ->", JSON.stringify(o));
};
ws.on("message", (d) => console.log("  <-", String(d)));
ws.on("close", (code, reason) => {
  console.log(`closed ${code} ${reason}`);
  process.exit(code === 1000 || code === 1005 ? 0 : 1);
});
ws.on("error", (e) => {
  console.error("error:", e.message);
  process.exit(1);
});

ws.on("open", async () => {
  console.log(`joined room ${room} at ${base}`);
  await sleep(300);
  for (const a of actions) {
    if (a.type === "swipe") {
      const [dx, dy] = a.value.split(",").map(Number);
      // like the page: batches while the finger moves; dt tells the overlay the speed
      const dist = Math.hypot(dx, dy || 0);
      const totalMs = Math.max(60, (dist / a.speed) * 1000);
      const steps = Math.max(2, Math.round(totalMs / 33));
      const dt = Math.round(totalMs / steps);
      for (let i = 0; i < steps; i++) {
        send({ type: "move", dx: dx / steps, dy: (dy || 0) / steps, dt });
        await sleep(dt);
      }
      await sleep(400); // let the overlay's smoothing settle
    } else if (a.type === "wait") {
      await sleep(a.value);
    } else if (a.type === "listen") {
      console.log("listening (Ctrl+C to quit)");
      await new Promise(() => {});
    } else {
      send({ type: a.type });
      await sleep(400);
    }
  }
  await sleep(500);
  ws.close(1000, "done");
});
