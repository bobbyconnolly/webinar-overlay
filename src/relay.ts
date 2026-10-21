// Relay client for the overlay (the "desktop" role). Reconnects forever with
// backoff; the overlay works fine with the relay down, status just says so.
//
// Wire protocol (see relay/server.js): every JSON message from a phone in the
// same room arrives here with `from: "phone"`. We send {type:"kick"} to drop
// every phone in the room (kill switch).

export type RelayStatus = "unconfigured" | "offline" | "connecting" | "online";
export type RelayMessage = { type: string; from?: string; [k: string]: unknown };

const BASE = ((import.meta.env.VITE_RELAY_URL as string | undefined) ?? "").trim().replace(/\/$/, "");
const KEY = ((import.meta.env.VITE_RELAY_KEY as string | undefined) ?? "").trim();

export const relayConfigured = BASE !== "";

export type RelayMode = "none" | "local" | "cloud";
/** "local" = a relay on this machine or the LAN (npm run relay:local), "cloud" = HTTPS elsewhere. */
export function relayMode(): RelayMode {
  if (!BASE) return "none";
  try {
    const u = new URL(BASE);
    if (u.protocol === "http:" || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)) return "local";
  } catch {
    /* fall through */
  }
  return "cloud";
}

/** Public page a phone opens for a room (what the QR code will encode). */
export function pageUrl(room: string): string {
  return `${BASE}/r/${room}`;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function newRoomCode(len = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export class Relay {
  status: RelayStatus = relayConfigured ? "offline" : "unconfigured";
  phones = 0;
  /** WebSocket close code of the last drop (4003 = bad desktop key, 1006 = unreachable). */
  lastClose = 0;
  private ws?: WebSocket;
  private retry?: number;
  private backoff = 1000;
  private stopped = false;

  constructor(
    public room: string,
    private onStatus: (relay: Relay) => void,
    private onMessage: (msg: RelayMessage) => void,
  ) {}

  connect() {
    if (!relayConfigured || this.stopped) return;
    this.setStatus("connecting");
    const url = `${BASE.replace(/^http/, "ws")}/ws?room=${this.room}&role=desktop&key=${encodeURIComponent(KEY)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.setStatus("online");
    };
    ws.onmessage = (ev) => {
      let msg: RelayMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      // hello / presence / leave all carry the current phone count.
      if (typeof msg.phones === "number") {
        this.phones = msg.phones;
        this.onStatus(this);
      }
      this.onMessage(msg);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return; // superseded by a newer socket
      this.lastClose = ev.code;
      this.phones = 0;
      this.setStatus("offline");
      if (!this.stopped) {
        this.retry = window.setTimeout(() => this.connect(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 15_000);
      }
    };
    ws.onerror = () => {
      /* onclose follows and handles retry */
    };
  }

  send(obj: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  /** Kill switch: disconnect every phone in the current room. */
  kick() {
    this.send({ type: "kick" });
  }

  /** Switch rooms: kick the old room's phones, then reconnect under the new code. */
  setRoom(room: string) {
    this.kick();
    this.room = room;
    this.phones = 0;
    window.clearTimeout(this.retry);
    const old = this.ws;
    this.ws = undefined;
    old?.close();
    this.connect();
  }

  private setStatus(s: RelayStatus) {
    this.status = s;
    this.onStatus(this);
  }
}
