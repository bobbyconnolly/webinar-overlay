// The sound picker: a local page where Bobby listens to the harvested candidates for each
// event and picks one (or none). Picks go to public/sounds/picks.json and the chosen clip
// is copied to public/sounds/<event>.mp3, which the overlay plays (src/sounds.ts).
//   npm run sounds          (serves http://localhost:4333 and opens it)
// No dependencies: a plain http server over tools/sounds/candidates/.
import { EVENTS } from "./events.mjs";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../..");
const CAND = join(here, "candidates");
const PUB = join(ROOT, "public", "sounds");
const PICKS = join(PUB, "picks.json");
const PORT = Number(process.env.PORT) || 4333;
mkdirSync(PUB, { recursive: true });

const readPicks = () => (existsSync(PICKS) ? JSON.parse(readFileSync(PICKS, "utf8")) : { picks: {} });
const manifest = () => (existsSync(join(here, "candidates.json")) ? JSON.parse(readFileSync(join(here, "candidates.json"), "utf8")) : null);

function pick(event, n) {
  const ev = EVENTS.find((e) => e.id === event);
  if (!ev) return { ok: false, reason: "unknown event" };
  const p = readPicks();
  const dst = join(PUB, `${event}.mp3`);
  if (n === null) {
    delete p.picks[event];
    rmSync(dst, { force: true });
  } else {
    const m = manifest();
    const c = m?.events?.[event]?.candidates.find((c) => c.n === n);
    if (!c) return { ok: false, reason: "no such candidate" };
    copyFileSync(join(CAND, c.file), dst);
    p.picks[event] = { n, title: c.title, source: c.source, author: c.author, url: c.url, license: c.license, seconds: c.seconds, file: `${event}.mp3` };
  }
  p.updated = new Date().toISOString();
  writeFileSync(PICKS, JSON.stringify(p, null, 2));
  return { ok: true, picks: p.picks };
}

const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".mp3": "audio/mpeg", ".js": "text/javascript" };
createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
  if (req.method === "POST" && url.pathname === "/pick") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { try { const { event, n } = JSON.parse(body); send(200, JSON.stringify(pick(event, n === null ? null : Number(n)))); } catch (e) { send(400, JSON.stringify({ ok: false, reason: e.message })); } });
    return;
  }
  if (url.pathname === "/") return send(200, readFileSync(join(here, "picker.html")), types[".html"]);
  if (url.pathname === "/state") return send(200, JSON.stringify({ events: EVENTS, manifest: manifest(), picks: readPicks().picks }));
  if (url.pathname.startsWith("/c/")) {
    const rel = decodeURIComponent(url.pathname.slice(3)).replace(/\.\./g, "");
    const f = join(CAND, rel);
    if (!existsSync(f)) return send(404, "{}");
    return send(200, readFileSync(f), types[".mp3"]);
  }
  send(404, "{}");
}).listen(PORT, () => {
  console.log(`sound picker: http://localhost:${PORT}  (picks → public/sounds/picks.json)`);
  if (!manifest()) console.log("no candidates yet: run  npm run sounds:harvest  first");
  if (process.platform === "win32" && !process.env.NO_OPEN) exec(`start "" "http://localhost:${PORT}"`);
});
