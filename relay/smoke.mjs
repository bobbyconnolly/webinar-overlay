// End-to-end smoke test: a fake desktop and a fake phone join room SMOKE,
// the phone taps, the desktop must receive it. Then the desktop kicks.
//   node smoke.mjs https://<relay-host> [desktop-key]
import WebSocket from "ws";

const base = (process.argv[2] || "http://localhost:8080").replace(/\/$/, "");
const key = process.argv[3] || process.env.RELAY_DESKTOP_KEY || "";
const wsBase = base.replace(/^http/, "ws");
const room = "SMOKE";
const t0 = Date.now();
const ms = () => `${Date.now() - t0} ms`;

const timeout = setTimeout(() => {
  console.error("FAIL: timed out after 20 s");
  process.exit(1);
}, 20_000);

const desktop = new WebSocket(`${wsBase}/ws?room=${room}&role=desktop&key=${encodeURIComponent(key)}`);
desktop.on("open", () => {
  console.log(`desktop joined (${ms()})`);
  const phone = new WebSocket(`${wsBase}/ws?room=${room}&role=phone`);
  phone.on("open", () => {
    console.log(`phone joined (${ms()})`);
    phone.send(JSON.stringify({ type: "tap", n: 1 }));
  });
  phone.on("close", (code, reason) => console.log(`phone closed ${code} ${reason} (${ms()})`));
  phone.on("error", (e) => console.error("phone error:", e.message));
});
desktop.on("message", (d) => {
  const m = JSON.parse(d);
  console.log("desktop got", JSON.stringify(m));
  if (m.type === "tap" && m.from === "phone") {
    console.log(`PASS: phone -> relay -> desktop round trip OK (${ms()})`);
    desktop.send(JSON.stringify({ type: "kick" }));
    setTimeout(() => {
      clearTimeout(timeout);
      process.exit(0);
    }, 800);
  }
});
desktop.on("close", (code, reason) => console.log(`desktop closed ${code} ${reason}`));
desktop.on("error", (e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
