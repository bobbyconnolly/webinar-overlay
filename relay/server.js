// Tiny WebSocket relay: rooms, join, broadcast. Also serves the mobile page.
//
//   GET /healthz             -> "ok"
//   GET /  or  /r/<ROOM>     -> mobile page (public/index.html)
//   WS  /ws?room=<ROOM>&role=phone|desktop[&key=<RELAY_DESKTOP_KEY>]
//
// Every JSON message a socket sends is forwarded, with `from` (role) and `id`
// (per-socket) added, to every *other* socket in the same room. The desktop
// may also send {"type":"kick"} to disconnect every phone in its room (kill
// switch). The relay itself never interprets pointer data.
//
// Relay-originated messages: {type:"hello", id, room, role, phones} to the
// joiner, {type:"join", id, role, phones} to the others, {type:"leave", id,
// role, phones} on disconnect.
//
// State is in memory: run exactly one replica (see scripts/deploy.sh).

import http from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8080);
// If set, only sockets presenting this key may claim the "desktop" role.
const DESKTOP_KEY = process.env.RELAY_DESKTOP_KEY || "";
// Per-socket message caps per second: above MAX the extra messages are dropped,
// above FLOOD the socket is closed (4008). Phones send ~30 moves/s at most.
const MAX_PER_SEC = 60;
const FLOOD_PER_SEC = 200;
const PAGE = readFileSync(new URL("./public/index.html", import.meta.url), "utf8");
// Art shared with the overlay (reagents, the cat). In the Docker image it is
// copied to public/assets (see relay/Dockerfile); when run from the repo
// (npm run relay:local) it is read straight from ../public.
const here = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIRS = [
  process.env.ASSETS_DIR,
  path.join(here, "public", "assets"),
  path.join(here, "..", "public", "reagents"),
  path.join(here, "..", "public", "trinkets"),
  path.join(here, "..", "public"),
].filter(Boolean);
const ASSET_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".gif": "image/gif" };
function findAsset(name) {
  for (const dir of ASSET_DIRS) {
    const file = path.join(dir, name);
    try {
      if (statSync(file).isFile()) return file;
    } catch {
      /* not here */
    }
  }
  return null;
}

/** room code -> Set<WebSocket> */
const rooms = new Map();

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (pathname === "/" || pathname.startsWith("/r/")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(PAGE);
  }
  if (pathname.startsWith("/assets/")) {
    // basename() defeats path traversal; only known image types are served.
    const name = path.basename(pathname);
    const type = ASSET_TYPES[path.extname(name).toLowerCase()];
    const file = type ? findAsset(name) : null;
    if (!file) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": type, "cache-control": "public, max-age=3600" });
    return createReadStream(file).pipe(res);
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });

function members(room) {
  return rooms.get(room) ?? new Set();
}
function phones(room) {
  let n = 0;
  for (const s of members(room)) if (s.role === "phone") n++;
  return n;
}
function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function broadcast(room, except, text) {
  for (const s of members(room)) if (s !== except && s.readyState === s.OPEN) s.send(text);
}
function kick(room, reason) {
  for (const s of [...members(room)]) if (s.role === "phone") s.close(4001, reason);
  log(`kick  ${room}: ${reason}`);
}
function log(line) {
  console.log(new Date().toISOString(), line);
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const room = (url.searchParams.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const role = url.searchParams.get("role") === "desktop" ? "desktop" : "phone";
  if (!room) {
    log("refuse: room required");
    return ws.close(4000, "room required");
  }
  if (role === "desktop" && DESKTOP_KEY && url.searchParams.get("key") !== DESKTOP_KEY) {
    log(`refuse ${room} desktop: bad key`);
    return ws.close(4003, "bad desktop key");
  }

  ws.id = crypto.randomUUID().slice(0, 8);
  ws.room = room;
  ws.role = role;
  ws.alive = true;
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  log(`join  ${room} ${role} ${ws.id} (phones=${phones(room)})`);

  send(ws, { type: "hello", id: ws.id, room, role, phones: phones(room) });
  // Tell the room who arrived (the overlay names the phone on this); carries the count.
  broadcast(room, ws, JSON.stringify({ type: "join", id: ws.id, role, phones: phones(room) }));

  ws.on("pong", () => {
    ws.alive = true;
  });
  ws.on("message", (data) => {
    const sec = Math.floor(Date.now() / 1000);
    if (ws.sec !== sec) {
      ws.sec = sec;
      ws.n = 0;
    }
    if (++ws.n > FLOOD_PER_SEC) {
      log(`flood ${room} ${role} ${ws.id}: closing`);
      return ws.close(4008, "too many messages");
    }
    if (ws.n > MAX_PER_SEC) return; // drop silently
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    if (role === "desktop" && msg.type === "kick") return kick(room, "kicked by presenter");
    msg.from = role;
    msg.id = ws.id;
    broadcast(room, ws, JSON.stringify(msg));
  });
  ws.on("close", () => {
    const set = rooms.get(room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(room);
    }
    log(`leave ${room} ${role} ${ws.id} (phones=${phones(room)})`);
    broadcast(room, ws, JSON.stringify({ type: "leave", id: ws.id, role, phones: phones(room) }));
  });
});

// Keepalive: ping every 25 s so idle proxies keep the socket; drop the dead.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 25_000).unref();

server.listen(PORT, () => log(`relay listening on :${PORT} (desktop key ${DESKTOP_KEY ? "required" : "NOT set"})`));
