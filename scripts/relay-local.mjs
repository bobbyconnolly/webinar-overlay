#!/usr/bin/env node
// Run the relay on THIS machine for phones on the same Wi-Fi. No Azure needed.
//
//   npm run relay:local     start it; writes .env.local so the overlay uses it
//   npm run relay:cloud     delete .env.local -> the overlay uses the cloud relay from .env
//
// Vite loads .env.local over .env, so the cloud settings in .env are untouched.
// Windows Firewall may ask once to allow node on private networks: say yes.
import { networkInterfaces } from "node:os";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");
const PORT = Number(process.env.PORT || 8080);

if (process.argv.includes("--remove")) {
  if (existsSync(envLocal)) {
    unlinkSync(envLocal);
    console.log("removed .env.local: the overlay uses the cloud relay from .env again (it restarts by itself).");
  } else {
    console.log("no .env.local to remove.");
  }
  process.exit(0);
}

if (!existsSync(path.join(root, "relay", "node_modules", "ws"))) {
  console.error("relay dependencies missing. Run:  npm --prefix relay install");
  process.exit(1);
}

/** Best guess at the Wi-Fi/LAN IPv4: prefer private ranges, avoid virtual adapters. */
function lanIp() {
  const all = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) all.push({ name, address: i.address });
  }
  const virtual = /vethernet|wsl|virtualbox|vmware|docker|hyper-v|tailscale|zerotier/i;
  const score = (a) =>
    (virtual.test(a.name) ? 10 : 0) +
    (a.address.startsWith("192.168.") ? 0 : a.address.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a.address) ? 2 : 5);
  all.sort((a, b) => score(a) - score(b));
  return all[0];
}

const ip = lanIp();
if (!ip) {
  console.error("no LAN IPv4 address found. Are you connected to Wi-Fi?");
  process.exit(1);
}
const url = `http://${ip.address}:${PORT}`;

// Desktop key: keep the one already in .env.local or .env, else make one.
const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const keyOf = (t) => (t.match(/^VITE_RELAY_KEY=(.*)$/m)?.[1] ?? "").trim();
const key = keyOf(read(envLocal)) || keyOf(read(path.join(root, ".env"))) || randomBytes(16).toString("hex");
writeFileSync(
  envLocal,
  `# Written by "npm run relay:local". Vite loads this over .env.\n# Delete it ("npm run relay:cloud") to use the cloud relay from .env.\nVITE_RELAY_URL=${url}\nVITE_RELAY_KEY=${key}\n`,
);

console.log(`
Local relay:   ${url}   (adapter: ${ip.name})
Phone page:    ${url}/r/<ROOM>   (phones must be on the same Wi-Fi)
Health check:  ${url}/healthz

.env.local written -> the overlay uses this relay. If "npm run tauri dev" is already
running it restarts itself; otherwise start it now. The QR widget should say
"online · local Wi-Fi". Back to the cloud relay: npm run relay:cloud

Ctrl+C stops the relay.
`);

const child = spawn(process.execPath, [path.join(root, "relay", "server.js")], {
  cwd: path.join(root, "relay"),
  env: { ...process.env, PORT: String(PORT), RELAY_DESKTOP_KEY: key },
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
