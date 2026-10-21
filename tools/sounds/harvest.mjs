// Gathers sound candidates for every event in events.mjs from CC0 libraries, trims and
// normalizes them with ffmpeg, and writes tools/sounds/candidates/<event>/<n>.mp3 plus
// tools/sounds/candidates.json (title, source, author, link, seconds) for the picker.
//   node tools/sounds/harvest.mjs            all events
//   node tools/sounds/harvest.mjs meow bird  these events only
// Sources: Kenney's packs (CC0, no account), OpenGameArt (CC0 filter, no account), and
// Freesound (CC0 filter) when FREESOUND_KEY is set in .env or the environment.
// Needs ffmpeg + ffprobe on PATH and `unzip` (Git Bash has it). Downloads are cached in
// tools/sounds/cache/ so a re-run only re-cuts.
import { EVENTS, KENNEY_PACKS, SLOTS } from "./events.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../..");
const CACHE = join(here, "cache");
const OUT = join(here, "candidates");
const UA = "Mozilla/5.0 (webinar-overlay sound harvest; CC0 only)";
const only = new Set(process.argv.slice(2));
const AUDIO_RE = /\.(ogg|wav|mp3|flac|aiff?|m4a)$/i;

const key = freesoundKey();
console.log(key ? "Freesound: key found (CC0 search on)" : "Freesound: no FREESOUND_KEY (set it in .env for the richest pool); Kenney + OpenGameArt only");
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

// ---- helpers ----
function freesoundKey() {
  if (process.env.FREESOUND_KEY) return process.env.FREESOUND_KEY.trim();
  const env = join(ROOT, ".env");
  if (!existsSync(env)) return "";
  const m = readFileSync(env, "utf8").match(/^FREESOUND_KEY=["']?([^"'\r\n]+)/m);
  return m ? m[1].trim() : "";
}
const FETCH_MS = 45000; // a slow mirror must not hang the whole harvest
const MAX_BYTES = 25 * 1024 * 1024; // a sound pack bigger than this is skipped
async function fetchText(url) {
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function download(url, file, referer = "") {
  if (existsSync(file) && statSync(file).size > 0) return file;
  const r = await fetch(url, { headers: { "user-agent": UA, ...(referer ? { referer } : {}) }, signal: AbortSignal.timeout(FETCH_MS * 2) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) throw new Error(`too big ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(file, buf);
  return file;
}
function looksLikeAudio(file) {
  const b = readFileSync(file).subarray(0, 12);
  const s = b.toString("latin1");
  return s.startsWith("OggS") || s.startsWith("RIFF") || s.startsWith("fLaC") || s.startsWith("ID3") || s.startsWith("FORM") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || s.includes("ftyp") || s.startsWith("PK");
}
function seconds(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const v = parseFloat(r.stdout);
  return Number.isFinite(v) ? v : 0;
}
// Trim silence off both ends, cap the length, normalize loudness, encode mp3 (plays everywhere).
function cut(src, dst, max) {
  const af = `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5:LRA=11`;
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", af, "-t", String(max), "-ac", "2", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", dst], { encoding: "utf8" });
  if (r.status !== 0 || !existsSync(dst)) return 0;
  const s = seconds(dst);
  if (s < 0.08) { rmSync(dst, { force: true }); return 0; }
  return s;
}
function unzip(zip, dir) {
  if (existsSync(dir) && readdirSync(dir).length) return dir;
  mkdirSync(dir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  return dir;
}
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (AUDIO_RE.test(e.name) && !/preview/i.test(e.name)) out.push(p);
  }
  return out;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// OpenGameArt quirks: a pack's montage ("preview_22", "montageAudio-…", "sfx100v2_prev") is not a cue, a
// re-upload gets "_0" appended to the same file, and some titles are not for a classroom.
const MONTAGE_RE = /preview|montage|_prev\b|-prev\b/i;
const UNFIT_RE = /vulgar|voiceover|voice-over|nsfw|explicit|swear/i;
const sameClip = (a, b) => a.file === b.file || (a.pack === b.pack && statSync(a.file).size === statSync(b.file).size) || a.title.replace(/_\d+$/, "") === b.title.replace(/_\d+$/, "");

// ---- Kenney: the packs, once ----
const kenneyFiles = [];
for (const [pack, url] of Object.entries(KENNEY_PACKS)) {
  try {
    const zip = await download(url, join(CACHE, `kenney-${pack}.zip`));
    const dir = unzip(zip, join(CACHE, `kenney-${pack}`));
    for (const f of walk(dir)) kenneyFiles.push({ pack, file: f, name: f.split(/[\\/]/).pop() });
  } catch (e) { console.log(`  kenney ${pack}: ${e.message}`); }
}
console.log(`Kenney: ${kenneyFiles.length} files in ${Object.keys(KENNEY_PACKS).length} packs`);
function kenneyCandidates(ev) {
  const out = [];
  for (const pat of ev.kenney) {
    const re = new RegExp(pat, "i");
    for (const k of shuffle(kenneyFiles.filter((f) => re.test(f.name)))) {
      if (out.some((o) => o.file === k.file)) continue;
      out.push({ source: "kenney", title: k.name.replace(AUDIO_RE, ""), pack: k.pack, author: "Kenney", url: `https://kenney.nl/assets/${k.pack}`, license: "CC0", file: k.file });
      if (out.filter((o) => o.pack === k.pack && new RegExp(pat, "i").test(o.title)).length >= 2) break; // two per pattern, for variety
    }
  }
  return out;
}

// ---- OpenGameArt: search (CC0 sound effects) → asset pages → files ----
const ogaSeen = new Map(); // slug → candidates
async function ogaSearch(words) {
  const url = `https://opengameart.org/art-search-advanced?keys=${encodeURIComponent(words)}&field_art_type_tid%5B%5D=13&field_art_licenses_tid%5B%5D=4&sort_by=score&sort_order=DESC`;
  const html = await fetchText(url);
  const slugs = [...new Set([...html.matchAll(/href="\/content\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  return slugs.filter((s) => !["faq", "cc0", "sound-effects"].includes(s));
}
async function ogaAsset(slugName, words) {
  if (ogaSeen.has(slugName)) return ogaSeen.get(slugName);
  const out = [];
  try {
    const page = `https://opengameart.org/content/${slugName}`;
    const html = await fetchText(page);
    if (!/\/content\/cc0|CC0/.test(html)) { ogaSeen.set(slugName, out); return out; }
    const title = (html.match(/<title>([^<|]+)/)?.[1] ?? slugName).trim();
    if (UNFIT_RE.test(title)) { ogaSeen.set(slugName, out); return out; }
    const author = html.match(/class="username"[^>]*>([^<]+)</)?.[1]?.trim() ?? html.match(/\/users\/([a-z0-9_-]+)"/i)?.[1] ?? "unknown";
    const links = [...new Set([...html.matchAll(/https:\/\/opengameart\.org\/sites\/default\/files\/([^"'<> ]+\.(?:ogg|wav|mp3|flac|zip))/gi)].map((m) => m[0]))]
      .filter((u) => !/\/styles\/|audio_preview/.test(u) && !MONTAGE_RE.test(u.split("/").pop()));
    const dir = join(CACHE, "oga", slugName);
    mkdirSync(dir, { recursive: true });
    const files = [];
    for (const u of links.slice(0, 4)) {
      const name = decodeURIComponent(u.split("/").pop());
      try {
        const f = await download(u, join(dir, name), page);
        if (!looksLikeAudio(f)) { rmSync(f, { force: true }); continue; }
        if (/\.zip$/i.test(name)) {
          const inner = walk(unzip(f, join(dir, name.replace(/\.zip$/i, ""))));
          const wordRe = new RegExp(words.split(/\s+/).join("|"), "i");
          const picked = inner.filter((p) => wordRe.test(p.split(/[\\/]/).pop()) && !MONTAGE_RE.test(p));
          for (const p of shuffle(picked.length ? picked : inner.filter((p) => !MONTAGE_RE.test(p))).slice(0, 3)) files.push(p);
        } else files.push(f);
      } catch (e) { /* a dead link: skip */ }
    }
    for (const f of files) {
      const c = { source: "oga", title: `${title} · ${f.split(/[\\/]/).pop().replace(AUDIO_RE, "")}`, pack: slugName, author, url: page, license: "CC0", file: f };
      if (!out.some((o) => sameClip(o, c))) out.push(c); // "x.ogg" and "x_0.ogg" are one upload
    }
  } catch (e) { console.log(`  oga ${slugName}: ${e.message}`); }
  ogaSeen.set(slugName, out);
  return out;
}
async function ogaCandidates(ev) {
  const out = [];
  for (const words of ev.oga) {
    let slugs = [];
    try { slugs = await ogaSearch(words); } catch (e) { console.log(`  oga search "${words}": ${e.message}`); }
    for (const s of slugs.slice(0, 6)) {
      const got = await ogaAsset(s, words);
      for (const c of got.slice(0, 2)) if (!out.some((o) => o.file === c.file)) out.push(c); // two per asset
      if (out.length >= SLOTS + 3) break;
    }
    if (out.length >= SLOTS + 3) break;
  }
  return out;
}

// ---- Freesound (optional): CC0 search, the hq mp3 previews ----
async function freesoundCandidates(ev) {
  if (!key || !ev.fs) return [];
  const out = [];
  try {
    const q = new URLSearchParams({ query: ev.fs, filter: `license:"Creative Commons 0" duration:[0.1 TO ${ev.max + 4}]`, fields: "id,name,username,previews,duration,url", sort: "rating_desc", page_size: "12", token: key });
    const r = await fetch(`https://freesound.org/apiv2/search/text/?${q}`, { headers: { "user-agent": UA } });
    if (!r.ok) throw new Error(`${r.status}`);
    const j = await r.json();
    const dir = join(CACHE, "freesound");
    mkdirSync(dir, { recursive: true });
    for (const s of j.results ?? []) {
      const u = s.previews?.["preview-hq-mp3"] ?? s.previews?.["preview-lq-mp3"];
      if (!u) continue;
      try {
        const f = await download(u, join(dir, `${s.id}.mp3`));
        out.push({ source: "freesound", title: s.name, pack: String(s.id), author: s.username, url: s.url, license: "CC0", file: f });
      } catch (e) { /* skip */ }
    }
  } catch (e) { console.log(`  freesound "${ev.fs}": ${e.message}`); }
  return out;
}

// ---- per event: gather, interleave the sources, cut, keep SLOTS ----
const manifest = { generated: new Date().toISOString(), slots: SLOTS, events: {} };
const prev = existsSync(join(here, "candidates.json")) ? JSON.parse(readFileSync(join(here, "candidates.json"), "utf8")).events : {};
for (const ev of EVENTS) {
  if (only.size && !only.has(ev.id)) { if (prev[ev.id]) manifest.events[ev.id] = prev[ev.id]; continue; }
  process.stdout.write(`${ev.id}: `);
  const [fs, oga] = await Promise.all([freesoundCandidates(ev), ogaCandidates(ev)]);
  const ken = kenneyCandidates(ev);
  // Interleave: a recorded library first, then the others, until SLOTS are cut.
  const queues = [fs, oga, ken].filter((q) => q.length);
  const order = [];
  while (order.length < 40 && queues.some((q) => q.length)) for (const q of queues) if (q.length) order.push(q.shift());
  const dir = join(OUT, ev.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const kept = [];
  for (const c of order) {
    if (kept.length >= SLOTS) break;
    const n = kept.length + 1;
    const dst = join(dir, `${n}.mp3`);
    const s = cut(c.file, dst, ev.max);
    if (!s) continue;
    kept.push({ n, file: `${ev.id}/${n}.mp3`, title: c.title, source: c.source, pack: c.pack, author: c.author, url: c.url, license: c.license, seconds: Math.round(s * 100) / 100 });
  }
  manifest.events[ev.id] = { label: ev.label, when: ev.when, candidates: kept };
  console.log(`${kept.length} of ${SLOTS} (${kept.map((k) => k.source[0]).join("")})  fs ${fs.length + kept.filter((k) => k.source === "freesound").length} · oga ${oga.length + kept.filter((k) => k.source === "oga").length} · kenney ${ken.length + kept.filter((k) => k.source === "kenney").length} found`);
}
writeFileSync(join(here, "candidates.json"), JSON.stringify(manifest, null, 2));
const total = Object.values(manifest.events).reduce((n, e) => n + e.candidates.length, 0);
console.log(`\n${total} candidates for ${Object.keys(manifest.events).length} events → tools/sounds/candidates/ · now: npm run sounds`);
