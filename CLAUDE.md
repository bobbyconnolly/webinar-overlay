# CLAUDE.md — webinar overlay

Read this first, then RUNBOOK.md. Keep both current before stopping.

## What this is

Tauri v2 desktop overlay for a live webinar (Windows 11). Presenter: Bobby, **the Seer**.
Deadlines were a Microsoft Teams screen-share test on 2026-10-02 and **the webinar on
2026-10-20**, over Discord. The students watch the webinar over **Discord** screen share
(720p/30 unless Nitro, so the overlay reaches them at roughly half scale); stream mode exists
for that. Both platforms: share the whole screen, never a window.
Priority: speed over polish, end-to-end working, then iterate.
**Webinar setup (revised 2026-10-17**; it replaces the two-machine plan of 2026-10-03, in
which the webinar's organizer would have run the overlay as the Seer and the presenter joined
as a Seeker by phone): **the presenter runs the overlay on one machine**, shares the entire
screen on Discord with audio, and **is the Seer**; the students join on their phones; the
lag is explained, not avoided ("expect lag and why": the Discord loop, see `docs/talk.md`);
the live-coding part runs in a Claude Code session beside `npm run tauri dev`; the ending is
Ctrl+Shift+E (the amber portal, Enter Mystica on the phones). See RUNBOOK "The webinar: one
machine". The relay sits in Canada Central, near the students: their leg is the short one
and the overlay's leg is ~250 ms round trip wherever the relay sits (measured 2026-10-17:
240–370 ms from the presenter's end). Design consequences that still hold: a fresh machine
must come up right from the repo + `.env` alone (CLAUDE.md is the handover), and
default widget positions must look right on any display: `loadLayout()` in main.ts scales
the index.html defaults from the 1536×960 design viewport to the real one and clamps them on
screen for any widget with no saved position (done 2026-10-03).

Three milestones, built strictly in order, each confirmed by Bobby before the next:

1. **Overlay** — transparent, always-on-top, click-through window; Ctrl+Shift hold makes
   it interactive; lock toggle; placeholder widgets (Ultima theme). **DONE, confirmed by
   Bobby 2026-09-30** (hold chord was Alt+Shift then; changed on request).
2. **Backend on Azure** — WebSocket relay (rooms / join / broadcast pointer events) in
   resource group `webinar`, West US 2 (moved to **Canada Central** on 2026-10-03, near the
   students). Scripts for up/down/destroy. **DONE, confirmed 2026-09-30.**
3. **QR flow** — QR widget + full-screen QR + room code rotate, mobile pad moves per-phone
   cursors on the overlay, kill switch. **DONE, confirmed by Bobby 2026-09-30** (a remote
   phone connected through the cloud relay; its cursor moved on the overlay).

4. **Reagent quest** (Bobby's wish, 2026-09-30): backpack widget + gump, eight scattered
   reagents that phones carry in with hold-swipe-lift, inset drop zone, counter widget,
   `quest-complete` state as the hook for a spell-casting minigame. **BUILT and verified
   with a fake phone 2026-09-30** (grab, halfway drop not counted, collect, completion
   message to phones, Scatter reset). Art is SVG placeholders; Bobby will source better art.
   Then reworked on Bobby's feedback: the open backpack is its own widget (contents always
   visible), double-click / phone double-tap opens it, anti-spam in relay and overlay
   (flood test on Azure: flooder closed with 4008 in 0.5 s, others unaffected).
   Awaiting Bobby's confirmation with a real phone.

5. **Post-milestone work, all done 2026-09-30**: local relay mode (no Azure), student README
   + `tools/fake-phone.mjs`, identity (random generic names, "you are ▲ Name", delivery
   credit), trackpad-style cursor acceleration, stream mode (Ctrl+Shift+S, 1.5×, one
   layout per mode), and the **spell minigame** (four spells, phone spellbook drawer,
   reagents spent from the shared bag and re-scattered). Spells verified with two fake
   phones over three gather rounds. Awaiting Bobby's confirmation with real phones.

6. **2026-10-01, Bobby's second round**: moongate movable by its runes (Seer only); the
   presenter is **the Seer**, phones are **Seekers**; **levels** (`src/levels.ts`): the 8/8
   banner shows 6 s, then the goals card flips to level 2 "cast every spell" and a second
   banner comes when all four are cast; phones cannot take reagents out of the bag any
   more (rearrange only; the mouse still can); **Reset game** in the pill with a Yes/No
   confirmation replaces the Scatter button; the pill collapses to the lock icon. Built
   and type-checked; not yet exercised live (the running overlay had no CDP port).
   Awaiting Bobby.

7. **2026-10-01, third round** (Bobby answered "do what is the most fun"): the codex rolls
   up into a scroll (double-click / phone double-tap, throttled); − / + on the QR widget step
   its size 1× to 3×; the **ankh ritual** (quorum of cursors incl. the Seer's mouse, taps +
   wiggles charge it, shake + glow, white flash) grants **sparkle trails** for a minute.
   Rust now reports the mouse position. Built and type-checked, Rust compiled; not yet
   exercised live. Awaiting Bobby.

8. **2026-10-01, fourth round**: eye in the pill + Ctrl+Shift+H hides every widget but the
   pill (cursors and effects stay); Ctrl+Shift+L toggles the lock; QR widget narrower (no
   hint line, "Kick all", − / + on their own row); Lightning = two steep bolts; **Magic
   Arrow is aimed from the phone** (4 s, beam on the overlay, hits along the path). Death
   is out of scope by Bobby's call. Built, type-checked, cargo check OK; not exercised live.

9. **2026-10-01, evening**: Magic Arrow became nock-then-swipe, reagents carry charges
   (floor 3), held-in-bag reagents stay in stock, ankh quorum 2, codex = two lore pages
   (greeting, Ginger), **Create Food** (fifth spell: Ginger walks in and eats, tap him to
   meow on the phone). Repo pushed to GitHub (bobbyconnolly/ultimate-webinar-tauri). Not
   exercised live.

10. **2026-10-01, late**: Magic Arrow volley of three (steerable); Teleport gathers everything
    near the caster onto the gate, then it fires; lightning knock-ons (thunderclap shove,
    Ginger bolts, overloaded gate 10 s, wisps blown wide); Night Sight = 18 s moonglow
    hunt (a flock of 70 wisps on a canvas, scoreboard, winner blessed); signpost widget
    (lantern lit at night, two birds that fly off, bats at dusk); devtools panel
    (Ctrl+Shift+D: free casts as the Seer or a phone, fill / scatter / reset / awaken /
    respawn); reagent economy (plentiful pair, mandrake 2 charges gone 45–60 s, silk 1
    charge gone 2–3 min, countdown on phones, Respawn now); spellbook = 3 pages of 2 with a
    "yet unwritten" slot; QR widget folds into a rune stone; Ginger's eyes glow at night.
    Bobby tested most of it live between rounds; pushed and deployed at cc56ec2.
    **Loose ends**: the sixth spell (page 1, beside Magic Arrow: Reactive Armor / Poison /
    Clumsy proposed, or the audience names it); not yet seen live by Bobby: bats, glowing
    eyes, the economy countdowns, the overloaded gate, Teleport gather with several phones;
    a Reset-layout for the new widgets; the Friday Teams test; a second-account Discord
    screenshot of stream mode with the new widgets (signpost, scoreboard, devtools stay
    presenter-only).

11. **2026-10-01, night: level 3, the horde** (`src/horde.ts`, `src/sky.ts`). Bobby's
    idea (skeletons and ghouls through the moongate, Magic Arrow slays, Ginger charms,
    Lightning stuns and blocks spawns, Teleport banishes, 60 s), with two of my changes he
    took: the monsters raid the backpack (a stake), and the level is **group-paced, not
    Seer-paced** ("I'm a seer, not a god"): at mastery the ankh becomes the key, phones
    carry it onto the gate, the usual ritual there opens the gate; after the wave the ankh is
    flung off and the loop repeats, each wave a little bigger. His last ask: the wave is
    fought in the dark and Night Sight lights it for a minute. Verified headlessly with two
    fake phones over the Azure relay (51 checks: carry + snap, sealed gate, awaken → wave,
    theft + escape, stun + no spawns, volley slays, Teleport banishes, Ginger charms, Night
    Sight lifts, end + fling, reset). Not yet seen live by Bobby. The sixth spell is left for
    a Discord vote at the webinar (slot stays "yet unwritten").

12. **2026-10-02, Bobby's bundle after the first look**: devtools **phantom Seekers**
    (`src/phantom.ts`, "attaching my phone every time causes friction"), the room code in
    localStorage, Level/Night/Monster/Open-bag jumps; **level 3 opens with a full pack**;
    **Magic Arrow = four arrows, the fourth charged** (ring shakes, crescent grows, bigger
    arrow, double hit radius, two damage, 140 px recoil); **Teleport sends loose reagents
    into the pack** with the caster's credit (the mid-siege refill of black pearl and ash);
    **Ginger fights**: after the meal he hunts the nearest monster for 8 s, and a dish cast
    while 3+ monsters are about is a feast that ends in the **ultimate** (dark, three
    orange beams sweep a turn, monsters shake and turn to sulfurous ash, +1 charge each,
    credited to the feeder). Verified in headless Chrome with real pointer events and a
    fake phone listening in the room (round12-test, 21 checks). Not yet seen live by Bobby.
    Trigger alternatives offered for the ultimate: random chance, or a second dish while he
    eats (deliberate); the feast threshold `ULT_MIN_MONSTERS` in cat.ts is the switch.

13. **2026-10-02, the living horde** (Bobby: "they should wander around more and chase the
    cursors too", a daemon with slow fireballs, ghosts for 20 s, the revive spell left to
    the audience, and "a wondering healer in a brown robe"): roles by kind (skeletons raid
    and chase briefly, ghouls roam and hunt), a caught cursor is a **ghost** (`src/ghosts.ts`),
    the **daemon** from wave 2 lobs fireballs, and the **wandering healer** (`src/healer.ts`)
    paces by the signpost from level 3 and restores a ghost that drifts into him (my
    proposal, the old game's in-joke; Bobby: "Go"). No cursor-to-cursor revive, so the
    sixth-spell vote (Resurrection?) still matters. Verified in headless Chrome
    (round13-test, 15 checks). Not yet seen live by Bobby.

14. **2026-10-02, a live test with a remote tester** (watching the shared screen over a
    video call): "they didn't get the spells on their phone" and they struggled to pick reagents
    up and carry them. Reproduced their exact setup headlessly (the **deployed** phone page
    from the Azure relay in a phone-sized browser, the current overlay in another, through
    the real relay): named, spellbook tab at the level change, hold grabs, swipe carries,
    lift drops, re-identification after an overlay reload: all PASS (`realphone-test`, 8
    checks). So not the code path. Likely causes: the collapsed drawer's 44 px tab at the
    screen bottom went unnoticed, and a thumb drifting over 10 px in the first 350 ms
    silently cancelled the hold (plus ~250 ms relay RTT and the video-call delay in their
    control loop). Changes: the drawer **opens by itself** the first time the spellbook
    appears (`bookSeen` in the phone page, with a flash and a buzz), `HOLD_SLOP_PX` 28
    (a drift under that no longer cancels the hold; a tap still needs under 10 px), a
    35 ms buzz when the grab takes, and `GRAB_PAD` 14 → 24 px in quest.ts. The phone page
    changes need a deploy. Harness lesson: one headless browser per page (a background
    tab gets no animation frames, so its cursor never visibly moves; two overlay tabs also
    share the room).

15. **Round 15, BUILT 2026-10-02 (all four, in Bobby's order; verified headlessly, not
    yet seen by Bobby; the phone page changes need a deploy)**. Bobby took every proposal
    except "the gate shuffles the reagents":
    - **Level 0**: a fresh launch shows only the moongate, ankh, signpost, QR and codex (no
      reagents, backpack, gump or goals card: `body.level-0` hides them; `#items` too). The
      ankh pulses faintly gold as the invitation; phones hear "touch the ankh together" once.
      The first ankh awakening (the existing ritual) starts level 1: the backpack and the
      reagents burst in. Reset goes back to level 0; devtools gets a Level 0 jump (Level 1
      exists). The healer stays a level-3 thing.
    - **Level 1 antagonists** (gathering alone was "a little boring"): **Ginger plays**
      (during level 1 he wanders in, stalks a loose reagent, pounces and bats it ~150 px,
      sits, repeats, leaves; a tap still meows) and **the birds steal** (a signpost bird
      swoops on a loose reagent, carries it to the post and drops it there).
    - **Phone pad**: the player's arrow in their colour on a big textured disc replaces
      Ginger in the middle (Ginger to a corner as the mascot, keeps blinking); a **mini-map**
      of the stage (landscape 16:10, widget silhouettes from a `layout` message sent once and
      on change, the player's dot in their colour) with the position **dead-reckoned on the
      phone** from its own swipes using the same gain formula (the overlay sends the viewport
      size and gain constants once, and a `pos` correction only on teleport, nudge, recoil or
      ghost, so no per-frame traffic); and **tap the map to jump** (`goto {x, y}`
      normalised → the overlay teleports the cursor; Bobby accepted this as the one exception
      to "no new gestures"). Reason: the students' control loop runs through the stream delay
      (Zoom ~1 s, Discord similar); a local position readout takes the delay out of the loop.
    - Order Bobby wants: mini-map first, then the pad look, then level 0, then Ginger plays
      and the birds. Everything must stay solo-testable (phantoms) and the phone page changes
      need a deploy ("push").
    - The live demo will run under `npm run tauri dev` with an AI session adjusting the
      program live, so hot reload and the devtools stay central.
    - **What was built** (commits 58f0985, 17ce0da, c123b68, 872b135; see the Decisions
      "Round 15" entries): `src/minimap.ts` + the phone map, the stone-disc pad with Ginger in
      the corner, level 0 (`body.level-0`, the ankh invitation, `ankh-awakened` → level 1),
      Ginger's play states in `cat.ts`, the thieving birds in `signpost.ts`, and the devtools
      rebuilt small around **Restart / Next ▶** (Bobby: "overwhelming… test things from the
      initial state and go forwards with a single button", no "cast as"; see the Devtools
      decision). Two ritual bugs fixed on the way (taps could never finish it;
      quick taps alternated into double-taps). Tests in a session scratchpad outside the
      repo: `minimap-test` 35, `level0-test` 27, `antagonists-test` 20 checks, all PASS;
      `pad-probe` screenshots.

16. **2026-10-03, Bobby's first look at round 15** ("i really like the minimap"): the phone
    lost its "Seeker · room · connected" label (messages now show in a pill under the map,
    hidden when idle; "you are" and the map moved up, the disc stayed); the QR, the goals
    card and the codex are off the map and **the ankh is drawn as itself** (gold strokes;
    Bobby was shown three variants and this was my pick, pending his word); Ginger's paths
    avoid the signpost (entry, next prey, exit rejected and rolled again if the straight
    segment crosses the post's box); **a quick follow-up swipe** at the reagent he just
    batted (55%, stacking, never if the next bat would push it within 90 px of an edge;
    phones hear "again!"); Ginger on the phone moved up 26 px off the hint. Who moves what
    was reviewed (see the Decisions entry): phones never move the signpost or the moongate.
    Pushed and deployed at the end of the round on Bobby's "release deploy everything".

17. **2026-10-03, the codex as a herald** (Bobby's idea: tips per level in the codex, and
    less on the stage from level 3; he took all my proposals): level 0 keeps its lore plus a
    trinkets page; levels 1–3 get the Seer's notes (one big line per page, 5 / 7 / 6 pages),
    the codex unrolls on them at each level change and rolls itself up 30 s after the last
    page turn; the phones get the goal then the first note, and the note of any page they
    turn to; the goals card is gone from level 2 on (a gold spell strip for 7 s after each
    cast at level 2, the horde board carries the stake at level 3, the wave tally is in the
    end banner from wave 2); Respawn now lives in devtools. See the Decisions entry. The
    phone page changed (needs a deploy). Not yet seen live by Bobby. Same evening, Bobby's
    correction of the charge-and-bolt visit ("charge at the item, stay on it for 2 seconds
    with a couple flicks of the tail, and then bolt off for no reason; sometimes the item
    would get knocked away in the process"): the 190 px kick is gone, he perches on the toy
    1.7–2.6 s with the tail flicking, then bolts a random way and knocks it 70–150 px about
    half the time (see the charge-and-bolt Decisions entry). Later the same evening: visits
    20% sooner at level 0 and the charge visit down to about one in five; the signpost's
    **floating zone** (he may walk by the foot, never float over the post: every step routes
    around it); and **the moongate takes him** when his paws cross it (dazed, "?", looking
    about, then off); **the ankh feeds him** (onto it, a purr with a dim glow, a conjured dish);
    the charge visit a plain 30% per visit; and **the yarn game** (dragging the ball of yarn
    summons him and, near him, makes him drop his plan and chase it while it moves; far or
    still for 5 s and he quits). Each verified headlessly (visits-probe, post-probe,
    gate-probe, ankh-probe, yarn-probe).

Loose ends after round 15: a relay restart or redeploy leaves the old cursors on the
overlay (the desktop socket drops without a `leave` per phone; the phones reconnect with
new ids and get new cursors; Kick all or a reload clears them): harmless at the webinar as
long as nobody redeploys mid-show. The bird flyer is small (34 px, `.bird-flyer` in CSS).

Open ideas not built: sound cues (WebAudio), Reset-layout tray item, audience "how to
play" card, monitor picker, stable phone identity across reconnects, phones moving the
moongate (one id in `MOVABLE`; Bobby undecided 2026-10-01), a Reset item in the tray menu
(Rust), horde ideas not asked for: loot refunds, monsters that go for cursors, a boss.
**Identity rule from Bobby:** no free-text nicknames (naughty users); the overlay assigns
random Ultima-flavoured names, but **no actual character or place names from the games**
(no Lord British, Iolo, Britain…). Generic words are fine: "Avatar", the virtues, the
old profession words (bard, mage, ranger, shepherd, tinker, druid, paladin, fighter).

## Docs, who reads what

- `README.md` — students: quick start without cloud, controls, file map, protocol
  reference, how to extend. Keep it in sync when the protocol or controls change.
- `RUNBOOK.md` — the presenter: launch, Azure scripts, tests, resources.
- `CLAUDE.md` — this file: conventions, decisions, state.
- `tools/fake-phone.mjs` — a phone from the terminal (students and us). The richer
  CDP-driven checks of each round lived outside the repo (see "Testing notes" below).

## Stack

- Tauri 2 (Rust) + Vite + vanilla TypeScript. No UI framework on purpose (students read this).
- Frontend: `index.html`, `src/main.ts`, `src/styles.css`, static assets in `public/`.
- Rust: `src-tauri/src/lib.rs` (all app logic), `src-tauri/src/main.rs` (entry only).
- Config: `src-tauri/tauri.conf.json` (window flags), `src-tauri/capabilities/default.json`.
- Rust toolchain via rustup (`~/.cargo/bin`); MSVC from Visual Studio 2022 Community.

## Conventions

- Never commit secrets, subscription IDs, resource names that embed IDs, or URLs of
  deployed resources. Runtime config comes from env vars; `.env.example` is committed,
  `.env` is git-ignored. Vite exposes only `VITE_*` vars to the frontend.
- Commit small and often; messages say what works and what does not.
- Rust owns state that touches the OS (click-through flag, hotkeys). The frontend only
  renders what Rust emits and calls commands. Single source of truth = `OverlayState`.
- Widgets are plain DOM elements with class `widget` and a `data-widget` id. Drag
  positions persist in `localStorage`, one layout per mode: `overlay.widgets.v1` normally,
  `overlay.widgets.stream.v1` in stream mode (`layoutKey()` in `stage.ts`).
- Keep everything in one Azure resource group named `webinar`. Nothing outside it.
  Resources in it may sit in different regions (the registry in West US 2, the relay in
  Canada Central).

## Decisions (and why)

- **Ctrl+Shift hold = polling `GetAsyncKeyState` every 16 ms** in a Rust thread rather
  than the global-shortcut plugin. `RegisterHotKey` cannot express "modifiers only, held",
  and polling gives clean press *and* release edges with no focus requirement.
  Ctrl+Shift replaced Alt+Shift (Bobby's request): holding Alt focuses menu bars in
  many apps on release, and Alt+Shift is the Windows input-language switch. The chord
  is one constant (`HOLD_LABEL` + `hold_chord_held`) in `lib.rs`; the UI reads the label
  from the mode payload.
- **Action hotkeys use `tauri-plugin-global-shortcut`** (OS-level `RegisterHotKey`), so
  Ctrl+Shift+Q/R/X are consumed and never reach Teams or a browser. Registered from
  Rust, forwarded to the page as a `hotkey` event with the action name. A registration
  failure is logged and the overlay still runs.
- **Interactive = `locked || hold`.** App starts `locked = true`. "Unlock" in the pill makes
  it click-through; from then on Ctrl+Shift is needed to click anything, including the
  "Lock interactive" button. Tray menu (Lock / Unlock / Disconnect all / Quit) is the
  escape hatch.
- **One cursor per phone.** The relay stamps every forwarded message with a per-socket
  `id` and broadcasts `leave` on disconnect; the overlay keeps a map id → cursor element
  with the least-used colour from a small palette. Phones send `move` deltas as fractions
  of their own viewport every 33 ms with `dt` (ms since the previous batch); the overlay
  eases toward the target in rAF.
- **Trackpad-style acceleration** (Bobby asked what the standard is; it is this): gain =
  0.18 + 0.15 × speed (phone-screens/s), capped at 0.9, floor 0.18. A normal swipe (1.5/s)
  gives the original 0.4 (≈2.5 swipes to cross), slow drags ≈0.25 for precision, flicks up
  to 0.9. Speed is measured from the phone's `dt`, not arrival times (network jitter).
  Phones without `dt` get the constant 0.4. **Carrying multiplies the gain by 1.5**
  (`CARRY_BOOST` in main.ts, 2026-10-01: Bobby found dragging to the bag too slow). Ginger's follow on the phone is 0.3 × drag,
  max 80 px (doubled on request).
- **Full-screen QR** is a FLIP transition (measure small/big rects, animate transform) over
  a charcoal backdrop; the room code sits in the margin below the QR. Kill = kick only
  (code stays); rotate = kick + new code + new QR.
- **QR library**: `qrcode` (npm) rendered as inline SVG so it scales crisply.
- **Reagent quest (`src/quest.ts`)**: hold = grab is decided on the desktop by hit-testing
  the phone's *displayed* cursor against uncollected reagents (14 px tolerance); carried
  reagents follow the smoothed cursor via `onCursorFrame`; `release` drops. The drop
  zone is the pack's box inset 22% per side (8% for the open gump) and the reagent's
  **centre** must be inside, so a reagent on the rim does not count (Bobby's rule). The
  relay is untouched: `grab`/`drop`/`quest` are plain desktop→phone messages with a `to`
  id that phones filter on. Art lives in `public/reagents/*.svg` and
  `public/backpack/backpack.svg` as hand-drawn SVG placeholders; swap by filename in
  `REAGENTS`. Completion = `body.quest-complete` + `quest-complete` DOM event.
- **Open backpack is its own widget** (`data-widget="gump"`), not a child of the pack, so
  it can be placed anywhere and stays open: Bobby did not want collected reagents to
  vanish into the icon. Opened by double-click or a phone `dbltap` with its cursor on the
  pack; phones can only open (never close) and opens are rate limited
  (5 s per phone, 2 s per room). Both the pack (inset 22%) and the open gump interior
  (inset 6%) are drop zones.
- **Glitter rim on reagents** (Bobby's ask): two extra copies of the art sit *behind* it
  with eight zero-blur `drop-shadow`s in the reagent's hue, so only a 1–2 px rim that
  follows the alpha contour shows (smooth, no jaggies). The second copy is masked by a
  random 8×8 chessboard of four shades (an SVG data URI generated per reagent in
  `quest.ts`, `--board`), tiled at 7 px squares and panned diagonally over 10 s with
  wrap-around, so the shade changes square by square along the rim (Bobby: "local, not
  global"; a fine checkerboard fizz and a wide-band sweep were both rejected). Hue per
  reagent = `glitter` in `REAGENTS`. Art is inset 5 px inside a 60 px box (50 px art, all
  scaled by `--stage`) so the mask does not clip the rim, which Bobby had made 1.5× thicker.
  Any transparent PNG/SVG gets the effect automatically when Bobby swaps the art.
- **Moongate teleport (`src/moongate.ts`)**: tap/click on the gate → burst at the tap point
  at t=0; at the 0.26 s peak every cursor on the gate (rate limited 2.5 s each) jumps to `freeSpot()`
  (rejection sampling against all visible `.widget` rects + pill + banner, 20 px pad) with
  a star there; held reagents follow through the cursor-frame hook. The star is an inline
  SVG: four fat blades, each split into a white and a pale facet, solid centre; one
  0.52 s burst (0 → 90 px → 0, fast-out/collapse) turning 80° from a random start angle,
  additive bloom + glow (Bobby: "must read as light, not an object"); jump at the 0.26 s
  peak; z-index 70 (above cursors). A reagent *dropped* on the gate teleports itself via
  `gateTeleport()` from `quest.ts`'s `drop()` (mouse and phone share it); the dropping
  cursor stays. The presenter's own Windows cursor is out of scope by Bobby's decision.
  **Moving the gate (2026-10-01, Bobby's ask)**: the widget is `data-handle` and its caption
  is the `.handle`, so the mouse drags it only by the runes and a click on the gate itself
  stays a teleport (`data-fixed` removed; its position now persists like the others).
  Phones cannot carry it (`moongate` is not in `MOVABLE`); Bobby was undecided, and adding
  the id there is the whole switch (phones would then hold on the runes too).
- **Bag: phones rearrange, only the mouse removes** (Bobby reversed the 2026-09-30 "not a
  vault" rule on 2026-10-01): `hitReagent` still finds reagents inside the *open* bag
  (screen position = bag interior + gx/gy), but a phone grab there is `inBag`: the reagent
  stays collected, the frame loop clamps its gx/gy to the bag interior, `drop()` returns
  `kept:true` (phone: "stays in the pack") and the credit is untouched. The mouse `grab()`
  un-collects as before (count drops, glow clears). Phone grips still slip after 4–5 s
  (`grips` timers in main.ts → `letGo(id, true)` → `drop … slipped:true`); the mouse is
  exempt. A held reagent is out of the spellbook stock until released.
- **Phones carry widgets** (`src/widgets.ts`): hold on a `.widget` whose `data-widget` is in
  the MOVABLE set (backpack, gump, image, text) via `elementsFromPoint`; follows the
  cursor through the cursor-frame hook; release persists to the same localStorage key the
  mouse drag uses. `data-fixed` (no widget uses it now) is skipped by the mouse drag too;
  `data-handle` widgets (the moongate) are carried or dragged only when the hold or press
  is on their `.handle` child.
- **Relay serves shared art** at `/assets/<basename>` from `public/assets` inside the image;
  `relay/Dockerfile` is built with the repo root as context (root `.dockerignore` whitelists
  the few files) and copies `public/reagents/*` and `public/cat-ginger.svg` in. One source
  of truth for art; `basename()` blocks path traversal.
- **Phone page duplicates the star SVG/CSS** on purpose (it is a separate app); the cat is
  fetched from `/assets/cat-ginger.svg` and inlined so its `.eyes` group can blink.
- **Local relay mode** (`scripts/relay-local.mjs`, `npm run relay:local`): the same
  relay on the laptop for phones on the same Wi-Fi, no cloud. It writes `.env.local`
  (Vite precedence over `.env`, so the cloud config survives) with the LAN URL and a key,
  and spawns `relay/server.js` with that key. `npm run relay:cloud` deletes `.env.local`.
  Adapter choice: private ranges first, virtual adapters (vEthernet/WSL/VirtualBox…)
  last. The relay looks for art in `public/assets` (image) then `../public/reagents` and
  `../public` (repo). `relayMode()` in `relay.ts` classifies the URL (http or private IP =
  local) for the widget text. Root `npm install` has a `postinstall` that installs
  `relay/` deps (`cd relay && npm install`; see Gotchas). Phones on plain http lose only the wake lock (needs HTTPS).
- **Identity (`src/identity.ts`)**: the relay broadcasts `join` (replaced `presence`); the
  overlay creates the cursor at once, names it (`Adjective Profession` from generic word
  lists, 1-in-12 "Avatar of <virtue>", unique per session) and sends `you {name, color}`.
  Fallback: first message from an unknown id identifies too (rollover safety). Names are
  per socket; a reconnect gets a new one (a stable phone id in the URL would fix that;
  not done). **Credit** = items with `collected && deliveredBy === by`; un-collecting
  clears `deliveredBy`, so farming in/out gains nothing. Presenter = "mouse" →
  "Presenter". Tally in the goals widget, `top` in the completion message/banner.
- **Stream mode (`src/stage.ts`, Ctrl+Shift+S, tray)**: Bobby streams over Discord
  (720p/30 unless Nitro), so the overlay reaches students at ~half scale. Two CSS vars:
  `--stage` sizes screen-pixel things (reagents + rims + labels, cursors + names, burst),
  `--stage-w` transform-scales `.widget`s from their top-left (left/top anchors unchanged,
  so dragging and persistence are untouched). `.gump { --stage: 1 }` because the bag's own
  transform already scales its contents; `quest.ts` converts bag-local ↔ screen with
  `stage()` and uses `icon()` for on-screen reagent size. Hints and the close hint are
  hidden, the pill shrinks. Persisted in localStorage `overlay.stream`. Factor 1.5.
  Design rule from the discussion: **the phone is the personal UI, the overlay is the
  shared stage** (few, huge, high-contrast things); spells must follow it.
- **Spells (`src/spells.ts`, built 2026-09-30 on the agreed plan)**: `enabled` follows
  `level-changed` from levels.ts (on at level 2, off on reset); it does *not* flip off when
  casting empties the bag. `spendReagents()` in quest.ts un-collects the recipe's reagents and
  re-scatters them (the gather → cast → gather loop) and fires `bag-changed`, on which the
  overlay broadcasts `spells {enabled, stock, spells, cooldown}`; joiners get it with
  `you`. The spell list lives only in the overlay; the phone renders what it is sent. Rate
  limits 10 s/phone, 2 s/room. Effects: bolt = jittered SVG polyline + `#flash`; arrow =
  a glowing bar CSS-transitioned from caster to target, then `nudgeCursor` 160 px; teleport
  reuses bursts + `freeSpot`; night = `#night` layer + `body.night` (cursors glow). The
  phone drawer (`#spellbook`) is additive: the pad keeps working above it (Bobby's
  requirement). Generic spell names only.
- **Levels (`src/levels.ts`, 2026-10-01)**: the goals widget shows one goal at a time
  (`#goal-1` / `#goal-2` sections, `body.level-2`). quest.ts fires `quest-complete` only in
  level 1 (`setQuestLevel`); levels.ts shows the banner (`#quest-banner.show`, text set per
  level, `BANNER_MS` = 6 s, Bobby: "5-6 seconds is ok"), then sets level 2, which
  dispatches `level-changed` (spells.ts opens the spellbook) and tells phones
  `quest {state:"level", level:2, goal}`. Level 2 goal = cast each spell once (five since Create Food)
  (`spell-cast` events from spells.ts; first caster shown per spell, casts-per-name tally
  under "cast by"); done = banner "Thou hast mastered every spell" + `quest
  {state:"mastered"}`, then six seconds later level 3 (the horde, below). `overlay.level.v1`
  persists the level and the cast set; casters are per session like delivery credit.
  `body.quest-complete` now only means "bag is full" (pack glow) at any level. **Reset
  game** (pill, inline Yes/No that times out after 6 s; no native `confirm()` on the
  overlay) = `resetGame()`: level 1 first (closes the spellbook), then `scatterReagents()`.
  The Scatter button is gone.
- **Seer / Seekers** (Bobby, 2026-10-01): `PRESENTER_TITLE = "Seer"` (mouse credit, codex
  text, phone kick message), `PLAYER_TITLE = "Seeker"` sent as `you.role` and shown in the
  phone status line. UO volunteer ranks (Seer, Counselor, Game Master) are generic words
  and fit the identity rule.
- **Pill collapses** (Bobby, 2026-10-01): `‹` hides the mode text, Reset and the quit ✕
  and leaves the status dot, the lock icon (inline SVG padlock: closed = locked
  interactive, open = click-through), the eye and `›`; `overlay.pill.collapsed` persists it.
  Collapsing cancels a pending reset question. Quit stays in the tray menu.
- **Codex (`src/codex.ts`)**: lore pages (`.codex-page`, one `.on`; page 1 = a one-line
  greeting, page 2 = Ginger, the Seer's cat, with the cat art and his name in
  runes), ‹ › buttons + `#codex-pageno` for the Seer, `.parchment.rolled` hides the body
  and shows `public/scroll.svg` (120 px). Phones: tap on it = next page (`codex page`),
  double-tap = roll / unroll. One shared lock: every action by anyone (`lock()` in
  `setPage` / `setCodexOpen`) blocks phone actions for 6 s (`ignored`, Bobby: a page turn
  must not be undone at once by another phone); the Seer is never locked. The old
  per-phone 5 s cooldown is gone. `overlay.codex.rolled` and `.page` persist. Order in
  main.ts: tap = gate, codex, ankh; dbltap = bag, codex, wiggle. The Ctrl+Shift text left
  the codex on Bobby's request: it is for the Seekers, not the presenter.
- **QR stepped size (`qr.ts`)**: `ZOOMS = [0, 1, 1.5, 2, 3]`; `--qr-zoom` sizes `.qr-small`
  and the room code; two round − / + buttons, no hotkeys (Bobby). For late joiners while
  the full-screen view stays a once-at-the-start thing. Step 0 = `.qr.collapsed`: the
  widget folds into `public/rune-disk.svg` (Bobby 2026-10-01: a flat rune stone seen at an
  angle, not the ankh, since the moongate was taken; the status dot sits on it); a click
  on the folded widget (listener on the widget, drag-aware) or + unfolds to 1×; the
  full-screen FLIP starts from the stone when folded. `overlay.qr.size` persists (new key,
  default 1×).
- **Mouse from Rust (`src/mouse.ts`)**: the hold poller thread also calls `GetCursorPos`
  every other tick and emits `mouse` {x, y} in CSS px (window origin and scale factor
  re-read about once a second). The page gets no pointer events while click-through, so
  this is the only way to know where the Seer is. `pointermove` refines it when
  interactive. Needs `Win32_Foundation` + `Win32_UI_WindowsAndMessaging` in Cargo.
- **Ankh ritual (`src/ankh.ts`)**: region = frame grown 25% per side. Own rAF loop: each
  cursor on the ankh adds 0.06 charge per px moved (steps over 60 px are teleports and
  ignored), a tap/click adds 14, decay 18/s, full at 100. Without the quorum (>= 2 on it,
  was 3 until Bobby wanted to test with one phone, AND more than half of phones + 1 for
  the mouse) charge is capped at 35 (dim glow) and
  phones on it get `ankh stirs {have, need}` every 4 s. `--charge` on the frame drives
  box-shadow glow, brightness and the shake (JS jitter on the img up to 6 px). At 100:
  `.ankh-flash` (white radial, z 75, 0.85 s), charge 0, cooldown 12 s, everyone who
  contributed in the last 8 s (never "mouse") is blessed: `bless(id)` + `ankh blessed`;
  broadcast `ankh awakened {names}`; `announce("The Ankh Awakens")`. Independent of levels
  (Bobby: "most fun").
- **Sparkles (`src/sparkles.ts`)**: one full-screen canvas (`#sparkles`, z 58, under the
  cursors), additive blending, sprites pre-rendered per cursor colour (glow, mote,
  four-point star) tinted 45% toward gold-white. Per trail: emission = drip (0.8 + 6 s)/s
  at rest + (0.07 + 0.33 s) per px moved, spawned along the path covered in the frame;
  thrown backwards off the head (comet), random spread, gravity 70 px/s² (the drip), drag;
  size (0.22 + 0.78 s), life (0.45 + 0.55 s), spin, twinkle; particles shrink with age so
  the tail thins. s = (1 - age/60 s)^1.3, so at 50 s only a few tiny motes follow a shake
  (Bobby). A comet head glow sits on the tip; `.cursor.blessed` adds a gold drop-shadow. A
  jump over 400 px in one frame (teleport) emits nothing. Cap 2500 particles.
- **Hide widgets** (Bobby, 2026-10-01): `body.widgets-hidden` hides `.widget`, `#items` and
  the quest banner with `!important`; the pill, cursors, sparkles and `#fx` stay (phones
  can still point at slides). main.ts: phone `tap`/`dbltap`/`hold` just wiggle and `cast`
  answers `closed` while hidden; held things are dropped on hide. Eye button in the pill
  (open/closed inline SVG, red while hidden; it stays in the collapsed pill too, Bobby's
  request on 2026-10-01) and `hide` hotkey (Ctrl+Shift+H in `HOTKEYS`). `lock` hotkey = Ctrl+Shift+L.
  Not persisted. Hidden widgets have zero rects, so `onGate`/`onAnkh`/`freeSpot` are safe.
- **Magic Arrow: nock, then swipe** (Bobby 2026-10-01, after a timed phone-aiming version
  that "nobody is going to figure out"; the standing rules: no time pressure, no new gestures):
  `castSpell` spends, announces, tallies, then `nockArrow(caster)` (ring `.aim` in `#fx` at
  the cursor, origin stored) and answers `{ok, nocked:true}` (phone: "arrow nocked · swipe
  to shoot"). In `onCursorFrame`, once the tip is 80 px (× stage) from the origin, that
  direction fires the first arrow; `shoot()` then re-bases the origin on the tip and fires
  two more 500 ms apart (`VOLLEY` 3), each aimed by `aimSince()`: the movement since the
  previous shot if 20 px or more, else the last direction (Bobby, 2026-10-01: "three with a
  short duration between each … adjust it over 1.5 seconds"); between shots the beam
  previews the next aim. Each arrow: `arrow()` visual, then after the 380 ms flight every
  other cursor within 48 px of the segment is nudged 160 px, wiggled, burst and told
  `hit {by}`; the caster gets `aimed {hits, shot, of}` per arrow. The ring and beam go
  after the last landing. No deadline; `setEnabled(false)` (reset) cancels nocks (and the
  volley timer), a vanished cursor too. No `aim` messages any more.
- **Charges + stock** (Bobby, 2026-10-01): `Item.charges` = `max(3, cursorCount())` when a
  reagent is collected (Bobby: a floor of 3 so testing alone needs less re-gathering) (phones in the room at that moment; the mouse counts for nothing);
  persisted. `spendReagents` decrements (`.spent` flash; the `×N` badge is rendered but hidden by CSS
  since Bobby found it ugly in the bag, 2026-10-01: the phone stock row still shows counts) and throws the reagent out only on its last charge. `bagContents()` now
  counts every collected reagent even while a phone rearranges it inside the bag (it never
  leaves); if a spell throws it out meanwhile the grip is broken from quest.ts with `drop
  … spent:true` (the grips timer in main.ts then finds nothing to drop). `spells` carries
  `charges` for the phone stock row. The mouse taking one out still removes it.
  Lightning now strikes twice (170 ms apart) from 55°–125° off the horizontal, starting
  just above the screen (Bobby: not from the side). "Death" is deliberately out of scope.
- **Teleport = area gather onto the gate** (Bobby, 2026-10-01; replaced "the caster goes
  through"): vicinity = `gateVicinity()` (half the grown gate box, ~160 px at stage 1)
  around the caster's tip. Every cursor in it (the caster too) is `teleportCursor`ed to a
  `gateSpot()` (best-of-12 candidates farthest from the ones already placed: cheap blue
  noise, nothing stacks) with bursts and told `teleport {state:"gathered", ms}`; everything
  else comes from `sweepRegion(near)`: moongate.ts now keeps an *array* of sweepers
  (quest.ts registers reagents, cat.ts registers dishes, the cat eating one moves with his
  dish, and the cat walking about). `setGateCharging(true)` brightens the gate
  (`.moongate-wrap.charging`); after `GATHER_MS` 1.5 s `triggerMoongate(null)` fires the
  gate on whatever is still there (Bobby: they may try to get off; a full swipe is about
  the only way). The gate sweepers also apply to ordinary taps now, so a dish or Ginger on
  the gate goes through it like a reagent.
- **Lightning knock-ons** (Bobby 2026-10-01: "do all the things you mentioned for the gate"):
  each strike calls `thunderclap(gateCentre)`: a `.thunder-ring` in `#fx` expanding to
  2 × (vicinity + 120 px), every cursor within `gateVicinity()` is `nudgeCursor`ed 200 px
  (× stage) away from the centre, wiggled and told `shoved`; `sweepRegion(near)` movables
  (reagents, dishes, the cat; `Movable` now carries x/y so the radial direction is known)
  land at vicinity + 120 px along their radial, clamped to the screen. `scareCat()` at the
  first strike: he heads for the nearest edge at 2.4× speed with a `.startled` hop and a
  "!" bubble, the dish stays (its `.eaten` shrink is undone) and `scaredUntil` keeps a new
  dish from turning him back for 3 s. After the second strike `setGateOverloaded(10 s)`:
  `.moongate-wrap.overloaded` and a cursor-frame hook in moongate.ts that sends any cursor
  on the gate through at once (800 ms per-cursor guard, zapped in a setTimeout so it is
  outside the frame callback), with the usual `onTeleport` phone message.
- **Signpost widget** (`data-widget="signpost"`, inline SVG in index.html, Bobby's ask):
  decoration; brick post (SVG pattern), two signs (generic words: moongate, ankh), a
  bracket with a hanging lantern, a dirt patch with vines and grass, and the second sign
  behind the post drawn as a foreshortened parallelogram with scratch marks for text
  (Bobby: "moongate" did not fit, so it recedes up-right behind the post, unreadable). Two
  birds (`<g class="bird">`, red and blue, the blue one mirrored by its transform
  attribute) sit on the cap (`src/signpost.ts`): the Seer's click (the drag handler skips
  `.bird` presses) or a phone tap with the cursor on one (`birdTap`, phone told `bird
  {color}`) adds `.fly` (the SVG has `overflow: visible`, or they would vanish at the edge of its box, which Bobby saw) (CSS `translate` animation with a per-bird `--fx`, wings `rotate`
  flapping via `transform-box: fill-box`), then `.away` (hidden) and `.land` 25 s later.
  `z-index: 36` puts it above `#night` (35) so it stays lit in the dark; `body.night` brightens `.flame` and `.glass` and fades in `.lantern-glow`
  (340 px radial, breathing). Seer-draggable, not in MOVABLE. The "lanterns" darkness
  proposal (fog of war around cursors) was dropped in favour of the moonglow hunt.
- **Moonglow hunt (`src/moonglow.ts`, Bobby's idea 2026-10-01)**: Night Sight's knock-on.
  `startNightHunt` (from the night-sight effect; a recast extends `endAt` and adds wisps)
  spawns 70 wisps (12% loners) around 7 `freeSpot()` centres (Gaussian 48 px; half the
  clumps start drifting at 14–26 px/s) on the `#moonglow` canvas (z 57, above `#night` 35,
  under the sparkles). **Flock** (Bobby 2026-10-01: the CSS twinkle was "whipping around",
  wanted "slow, clustery, fluidy", comets with the lead taking turns, loners, evading the
  cursor; "trial-and-error"): per wisp wander heading (1.6 rad/s noise, 26 px/s²), cohesion
  within 150 px (34), alignment within 120 px (1.4/s), separation under 22 px (420), evade
  cursors and the mouse within 110 px (140), edge turn-back 70 px (220), drag 0.6/s, speed
  clamped 6 to 44 px/s × zeal 0.7–1.3, and `LEAD_SLOW` 0.3: ahead of the clump along its
  drift slows, behind speeds up (the leapfrogging). Loners weigh social forces at 12%.
  Drawn with additive sprites, a slow 1.4 s breath instead of a twinkle, and a 3-step
  streak behind moving wisps (comet). In `onCursorFrame` every wisp within 26 px (× stage)
  of the segment a cursor covered that frame is taken (grows and fades 450 ms; a jump over
  300 px resets the segment so teleports do not sweep). All knobs are the constants at the
  top of moonglow.ts. Scores per phone id; `#moonglow-board` (top centre,
  `.show`) lists names, counts and motes left; the phone gets `glow {count}` per pickup. At
  the end: leftovers fade, ties share, winners get `bless()` (the ankh's reward),
  `announce("X wins the moonglow · n")`, broadcast `glow {state:"end", winners, top}`,
  board hides after 4 s. Chosen over the "lanterns" darkness proposal. The mouse never
  competes. Lightning knock-ons (thunderclap shove, Ginger bolts, overloaded gate) were
  proposed and are undecided.
- **Create Food (`src/cat.ts`, 2026-10-01, Bobby's ask)**: fifth spell (garlic, ginseng,
  nightshade since the economy round; the UO recipe has mandrake root). `effect()` bursts at the
  caster's tip and `createFood(at)`: a `.food` (public/food.svg) in `#fx`; one cat
  (`.cat-walk`, the same cat-ginger.svg, which faces left, so `.flip` mirrors him whenever
  he heads right) walks in from the left or right edge at a random height, straight at the
  dish at 240 px/s, eats 2.6 s (`.eaten` shrinks the dish), then leaves at a random angle
  towards any edge (Bobby: the exit need not match the entry, "cats are weird"); more
  dishes queue; a dish cast while he is leaving turns him back. Own rAF
  loop with a bob and tilt. `catTap(id)` (phone tap, cursor on him, 1.5 s per phone) and
  the Seer's click → `meow()` bubble; main.ts sends `meow {to}` and the phone plays a
  WebAudio-synthesized meow (two voices, rising-then-falling pitch through a sweeping
  band-pass; the AudioContext is unlocked by the first pad touch). The phone drawer
  shows `SPELLS_PER_PAGE` (2) per page over `SPELL_PAGES` (3), each spell carrying its
  `page` (Bobby 2026-10-01: Magic Arrow on 1, Lightning + Teleport on 2, Night Sight +
  Create Food on 3); the `spells` message carries `pages` and `perPage`, an empty slot
  renders as a faint dashed "a spell yet unwritten" card (the hook if the audience names
  the sixth spell at the webinar). Earlier: four per page with invisible blanks; before
  that a scrolling panel, rejected (the drawer must not grow, the cards must not squish). Level 2 now needs all five.
- **Reagent economy** (Bobby's table and mine compared on 2026-10-01; he took mine):
  `ReagentDef.charges` (fixed) and `respawn: [lo, hi]` seconds. Default charges
  `max(5, 2 × phones)` and re-collectable forever (gathering is the pacing; Bobby's
  "respawn only 3×" cap was dropped so Magic Arrow never dies late in the hour). Mandrake
  root: 2 charges, gone 45–60 s (throttles Lightning and Teleport); spider's silk: 1 charge,
  gone 120–180 s (throttles Night Sight). Create Food moved to garlic + ginseng + nightshade
  so Ginger is not on the mandrake budget (and nightshade finally has a use). On the last
  charge of a `respawn` reagent `spendReagents` sets `gone` (`.reagent.gone` hidden,
  `screenPos` null, the sweeper and `placeReagent` skip it) and `scheduleRespawn` picks a
  random wait (`returnAt`; a reload mid-wait schedules again); `bringBack` lands it at a
  random spot with a burst and tells phones `respawn {names}`. `body.reagent-gone` shows
  the "Respawn <names> now" button in the level-2 card (`respawnGone()`, also devtools
  "Respawn now"). `spells` carries `returning {id: ms}`; the phone stock row shows a grey
  m:ss badge that ticks. Scatter, reset and Fill bag clear timers and `gone`. Persisted.
- **Night tweaks (same day)**: `NIGHT_MS` 18 s (16 was "a tad too short"); `scareBirds()` at dusk (birds `RETURN_MS`
  22 s); `thunderWisps(centre, 2.2 × vicinity)` from each thunderclap gives wisps a `kx/ky`
  kick (520 px/s, decays 3.5/s: fast off, fast settle) on top of the flock velocity;
  `createFood` clamps the dish into the middle half of the screen and returns the spot;
  `html, body { user-select: none }` after a stray text selection drew a box around Ginger.
- **Bats (`src/bats.ts`)**: `spawnBats()` at dusk rolls 0/1/2/3 with odds 10/20/50/20
  (mean 1.8, Bobby: "usually two"), arrivals staggered 0.6–6.6 s; each `.bat` in `#fx` is an
  inline SVG (wings as `<g>`s flapping via the `rotate` property at a per-bat rate, red
  pinprick eyes) flying a quadratic Bézier from one off-screen edge to another through a
  random inner control point, `u` advancing at `(1 + amp·sin(2πu + phase)) / dur` (amp
  0.35–0.65, dur 4.5–8 s) so it speeds and slows somewhere of its own; faces its x
  direction; wobbles. Gone when the arc ends.
- **Ginger's eyes glow at night**: `ensureCat` inlines cat-ginger.svg into `.cat-art`
  (img fallback) so `body.night … .eyes` can take a neon green fill on the irises and a
  pulsing green drop-shadow; the slit pupils stay dark. Flip and startle act on `.cat-art`.
- **QR fold fix**: the − click bubbled to the widget's unfold-on-click listener after it
  had already folded, so it unfolded again; the listener now ignores clicks on buttons.
  Double-click on the widget folds / unfolds (Bobby).
- **Devtools (`src/devtools.ts`, Bobby 2026-10-01: "give you feedback faster"; rebuilt
  2026-10-02 after "honestly the devtools is overwhelming")**: `#dev` panel (fixed
  bottom-right, z 90, 340 px wide), Ctrl+Shift+D (`dev` in `HOTKEYS`) or ⚙ in the pill.
  **Restart** = `resetGame()` (level 0) and **Next ▶** = `phase().go()`: one phase forward
  along the real path, decided from `currentLevel()`, `isQuestComplete()`, `ankhPlaced()`,
  `waveActive()` and a `bannerUntil` the panel sets when it starts a banner: level 0 →
  `devAwaken()` (or `devSetLevel(1)` with no cursor); level 1 → `devFillBag()` (quest-complete
  → the banner → level 2 by itself; pressed again meanwhile: `devSetLevel(2)`); level 2 →
  dispatches `spell-cast` for every spell as the Seer (the mastered banner → level 3 by
  itself); level 3 → `devPlaceAnkh()`, then `devAwaken()` (the gate opens, a wave), then
  `devEndWave()`, around again. `#dev-phase` shows "where · next: what", refreshed each second
  while open and on `level-changed`. No "cast as": dev casts are as the possessed phantom if
  the mouse drives one (`possessedId()`), else the Seer (`devVolley` from the mouse direction);
  Ghost hits the driven phantom, else the first phone. Rows: game, spells, stage (Night/Day
  toggle, Monster, Daemon, Ghost, Open bag, Ginger plays, Bird steals, Scatter), Seekers;
  `#dev-phone` (the possessed phantom's screen line) and `#dev-status` hide when empty.
  Removed from the panel (the functions stay): Fill bag, Awaken ankh, Place ankh, Summon /
  End wave, Level 0–3, Respawn now (the goals card has it), Reset game (= Restart).
  `devCast(spell, caster)` in spells.ts skips the level gate, cooldowns, stock and spending,
  announces, tells the phones `casted {dev:true}`, and runs the effect; it never dispatches
  `spell-cast` (no tally). With a phone caster Magic Arrow nocks on that phone; as the Seer
  it is `devVolley`. Teleport and Create Food use the mouse position when the caster has no
  cursor. `loose()` is the shared one-arrow routine. `waveCount()` in horde.ts gives the wave
  number for the phase line.
- **Level 3, the horde (`src/horde.ts`, 2026-10-01)**: levels.ts goes 2 → 3 six seconds
  after the mastery banner (`body.level-3`, `#goal-3`, phones `quest {level:3, goal}`);
  horde.ts listens to `level-changed` (so `initHorde` runs before `initLevels`). **Keyed**
  (level 3, ankh loose): `.frame.keyed::after` and `.moongate-wrap.keyed .rune` pulse in
  blue on the same 2.2 s clock; a rAF loop snaps the ankh when its art centre is within
  `gateVicinity() × SNAP` (0.75 → ~120 px) of the gate centre: `releaseWidget(frame)` (the
  phone gets `drop {placed:true}`), `data-fixed` (main.ts checks it per press and inside
  the drag `move`/`up`, widgets.ts refuses it), `.on-gate` (frame shed, `z-index: 2` so the
  ankh sits over the gate, which shows through the loop), re-centred every frame if the
  Seer drags the gate, position saved via `saveWidgetPos`. `setGateSealed(true)`:
  `triggerMoongate` returns "sealed" (no star), the overload hook is off, and main.ts skips
  the gate branch on taps (`gateSealed()`) so the tap falls through to `ankhTap`. ankh.ts:
  `awaken()` calls `startWave()` when `ankhPlaced()`; `devAwaken` works with no phones if
  the ankh is placed; during a wave `step()` keeps the charge at 0. **Wave**: `budget =
  min(30, 6 + 2 × phones + 3 × (wave − 1))` spawned over 42 s (jittered interval, skipped
  while `isGateOverloaded()`), `.monster.skeleton|ghoul` in `#fx` (inline SVGs in horde.ts,
  `.body` and `.eyes` groups; limbs swing by CSS `rotate` with `transform-box: fill-box`;
  `body.night` makes `.body` a silhouette, eyes glow), states walk → (loiter | return) /
  flee / gathered / dead. They walk to `packCentre()` (screen centre when hidden); arrival =
  `stealReagent(x, y)` in quest.ts (un-collects a random non-held reagent, `heldBy =
  "horde"`, `.stolen`; a `Loot` handle with carry / drop / escape; `releaseHorde()` on
  scatter and fill); back at the gate = `escape()` (random spot, `lost++`, `horde
  {state:"escaped"}`). Spells: `hitMonsters(from, to, radius, caster)` from `loose()`
  (`MON_R` 24 on top of the arrow's 48; `aimed.slain`), `stunMonsters(5 s)` from each
  lightning strike (the charm check runs before the stun check, so a stunned monster near
  Ginger flees when it wakes), `gatherMonsters(near, placed, caster)` + `banishGathered()`
  from the Teleport effect, `charmBy(caster)` from Create Food (monsters within `LOVE_R` 140
  px of `catPos()` get hearts, flee at 1.7×, vanish at the gate). Credit per caster id in
  `kills` (session, the card) and `waveKills` (the board, `#horde-board`, shares the
  moonglow board's CSS, a draining `.hb-bar`); phones get `slay {kind, how, count}`. Magic
  Arrow during a wave: `WAVE_ARROW_COOLDOWN_MS` 5 s, no room cooldown, nothing spent, no
  announce / `casted` (the recipe must still be in the bag; `cast` carries `cooldown`).
  **End** (60 s or nothing left): survivors `retreat` (flee, loot dropped), top slayer (never
  the Seer) blessed, `showBanner`, `horde {state:"end"}`, after `RETREAT_MS` 2.6 s
  `releaseAnkh()` (burst, `freeSpot()`, keyed again). `overlay.horde.v1` persists `wave` and
  `lost`; a reset (level-changed below 3) aborts, flings the ankh off and wipes both plus the
  tally. Devtools: Place ankh (toggle), Summon wave (no ankh needed), End wave.
- **Round 12 mechanics (2026-10-02)**: `fillBag(by)` in quest.ts (tops up charges too) runs
  from `setLevel(3)` with `by = null` + phones `quest {state:"filled"}`; `devFillBag` =
  `fillBag("mouse")`. Magic Arrow: `VOLLEY` 4, `shoot()` hands the fourth to `charge()`:
  `.aim.charging` (CSS: ring and beam shake, `.aim-crescent` grows over `--charge-ms`),
  phone `aimed {state:"charging", ms}`, after `CHARGE_MS` 900 the aim is re-read
  (`aimSince`) and `loose(..., big = true)`: `.arrow.big` (crescent head), radius ×
  `BIG_RADIUS` 2, knock × `BIG_KNOCK` 1.6, `hitMonsters(..., damage 2)`, then
  `nudgeCursor(-aim × RECOIL 140)` on the caster and `aimed {big:true}`. `devVolley` does
  the same from the mouse (no recoil). Teleport: `teleportReagentsToBag(near, caster)` in
  quest.ts (collect with `chargesFor`, credit, bursts) runs before `sweepRegion`, phone
  `teleport {state:"bagged", names}`. Ginger: cat.ts `setHordeHooks({threats, ultimate})`
  from `initHorde`; `createFood` marks a dish `ult` when `threats().length >=
  ULT_MIN_MONSTERS` (3; decided at the cast, `.food.ult` glows: by the time he finishes
  eating he has usually charmed the nearby ones, so an after-meal count failed in the test);
  `afterMeal(now, feast)` → `horde.ultimate(pos)` (state "ult", `.cat-walk.ult`, `ULT_MS`
  3 s must match horde.ts) or state "hunting" (`HUNT_MS` 8 s at `HUNT_SPEED` 1.3× toward
  the nearest threat; horde.ts's LOVE_R charm does the rest) or `leave()`. horde.ts
  `ultimate(centre, charmer)`: stuns everything, `#ult` layer (fixed, z 62: above cursors
  60 and sparkles 58, below `#fx` 65 so Ginger, the horde and the beams stay lit),
  `.ult-beams` in `#fx` positioned with the **`translate` property** (a `transform:
  translate` plus the animated `rotate` property orbits the screen corner: individual
  properties apply translate → rotate → transform) with three `<i>` arms at 0/120/240°,
  `rotate` 0 → 360° over `ULT_MS`; `sweepUlt` each frame marks monsters whose bearing is
  within `ULT_TOL` 9° of an arm (`.zapped` shake); `finishUlt` → `ash(m, by)`: `.ashed`
  crumble + puff, `addCharges("sulfurous-ash", 1, by)` (quest.ts: +n on the collected ash,
  or the ash lands in the bag with n), `credit(by, m, "ashed")`, phone `slay
  {how:"ashed"}`; broadcast `ult {state:"ginger"}`, announce "Ginger Unleashed".
- **The living horde (round 13)**: `Mon.state` gained `wander` / `chase` / `lurk`;
  `threat()` covers all hostile states. Raiders (skeleton): `walk` toward `raiderWaypoint`
  (partway to the pack plus `DRIFT` 110 px jitter, re-picked every 1.2–2.8 s; the pack
  itself within 200 px), steal at `ARRIVE`; hunters (ghoul): `wander` to `anywhere()`,
  pausing 0.3–1.2 s at each. Every frame (not laden, fleeing or lurking) `nearestLiving(m,
  SIGHT[kind])` starts a `chase` of that cursor id for `CHASE_MS[kind]` at
  `CHASE_MUL[kind]`, dropped when the cursor is a ghost, gone, or beyond `LOSE_R`;
  `endChase` returns to the role. Teeth: a living tip within `CATCH_R` 22 px (+6) →
  `ghostCursor(id, kind)` and `GLOAT_MS` pause with `.gloat`. The daemon (`lurk` within
  `DAEMON_LURK_R` of the gate, `SIGHT` 0 so it never chases) fires every `DAEMON_SHOT_MS`
  at `nearestLiving(FIREBALL_RANGE)`: `.fireball` divs stepped by `stepFireballs` at
  `FIREBALL_SPEED` 200 (Bobby: twice the first 100), positioned with the **`translate`
  property** because the flame pulse animates `scale` (with an inline `transform` the scale
  multiplied the translation and the ball zigzagged: the beams bug again, see **Gotchas**),
  ghosting a tip within `FIREBALL_R`, gone at range or off-screen;
  `.hurl` on the daemon. Spawned by `step()` at `daemonAt` (wave ≥ `DAEMON_FROM_WAVE`,
  `DAEMON_AT` 0.4 of the window), not counted in `budget`; `scaleOf()` sizes it 1.4× for
  the hit radius and `render`. `threats()` for Ginger excludes daemons (no charm, no hunt);
  the ultimate sweep includes them.
- **Ghosts (`src/ghosts.ts`)**: `ghostCursor(id, by)` → `.cursor.ghost` plus a `.wraith`
  child (inline sheet-ghost SVG + an `.ooo` "OooOOoo" span; CSS floats and sways it, glows
  it, and fades the murmur in for a third of each 5 s; the arrow itself drops to 0.35
  opacity. Bobby 2026-10-02: the faded arrow alone was not clear), burst, `onGhost`
  hook (main.ts: `letGo` + `cancelNockFor`), phone `ghost {state:"dead", by, ms}`, a
  `GHOST_MS` 20 s timer → `revive(id, "time")`; `revive(id, "healer")` from healer.ts; phone
  `ghost {state:"alive", how}`. `isGhost` gates: main.ts tap/dbltap/hold (wiggle only) and
  `moveCursor` boost `GHOST_DRIFT` 0.75; `castSpell` → `reason:"ghost"`; ankh.ts skips
  ghosts in `consider` and in `total`; moonglow skips pickups; `loose()` hits and the
  thunderclap shove skip ghosts; horde `nearestLiving` skips them. `forgetGhost` on leave,
  `forgetAllGhosts` in `dropEverything`. Devtools "Ghost" toggles the "cast as" phone.
- **Healer (`src/healer.ts`)**: an actor in `#fx` (`.healer`, SVG + `.label`), not a widget
  and in no sweeper. `level-changed` ≥ 3 → `healerArrive()` from the nearest side or bottom
  edge (never the top) to beside `home()` (signpost rect bottom centre − 10 px, or
  centre-right when hidden), then `pacing`: waypoints within `RANGE` 100 px (y squashed
  0.6), `PAUSE_MS` 1.8–5.2 s; < 3 → `healerDepart()`. **Soft and grounded** (Bobby
  2026-10-02: "moves too much and too quickly … looks like he's floating"): `WALK` 36 px/s
  (× `ENTER_MUL` 1.6 in and out), a `RAMP_MS` 600 start and an `EASE_R` 50 px arrival
  slow-down, bob 1.2 px; `forbidden(x, y)` = the V wedge above the foot (`|dx| < up /
  V_TAN`, `V_TAN` 0.7 = tan 35°): waypoints are re-rolled out of it, and a target across the
  post (or a midpoint in the wedge) goes via a `queue`d detour at the foot + 14 px
  (`nextLeg`, no pause at the corner). Probe: 32 s, 0 wedge hits, max 25 px/s, still half
  the time. Each frame a ghost's tip within `HEAL_R` 46 px →
  `revive(id, "healer")`. `healerTap(phoneId)` (main.ts tap branch, living only) → `healer
  {state:"well"}` once per `WELL_MS`. `initHealer` before `initLevels`.
- **Sky (`src/sky.ts`)**: one place decides `body.night` + `#night.on`: Night Sight's
  `nightfall(ms)` (extends), a wave's `setSiegeDark(on)`, and `liftDark(ms)` (Night Sight
  cast during a wave: light for `LIFT_MS` 60 s, no moonglow hunt, then dark again if the wave
  still runs). Bats, birds and the lantern follow `body.night` as before; horde.ts calls
  `scareBirds()` and `spawnBats()` at the wave start.
- **Spam protection in two layers**: the relay drops a socket's messages above 60/s and
  closes it above 200/s; the overlay (`src/ratelimit.ts`) allows 60 moves/s and 6
  actions/s per phone (`release` is free since 2026-10-02: every tap sends one and it only
  lets go of something). The phone page itself throttles moves to ~30/s.
- **Round 15: the phone mini-map (`src/minimap.ts`, 2026-10-02)**: the students' control
  loop runs through the stream delay, so the phone shows a landscape map of the stage (the
  visible `.widget` rects as silhouettes, the moongate an ellipse, per-id tints) with the
  player's dot, and **dead-reckons the dot itself** from its own swipes with the overlay's
  formula (`reckon()` in the phone page mirrors `moveCursor`: same `dx/dy/dt`, gain
  constants and clamps, `carrying` × 1.5, `ghost` × 0.75). The overlay sends `layout {w, h,
  gain, widgets}` to a joiner and broadcasts it when the visible layout changes (a 1 Hz poll
  compares rects rounded to 1/200 of the viewport: drags, hide, gump, QR fold, levels,
  stream mode, resize all covered without hooks) and `pos {x, y}` (the cursor's target in
  overlay px) only on jumps: `onCursorJump` in cursors.ts fires from `teleportCursor` and
  `nudgeCursor` (gate, Teleport, arrow knock, recoil, thunderclap, goto, phantom spawn), and
  main.ts sends one on grab, drop, ghost and revive (the gain changes). **Tap the map** =
  `goto {x, y}` (fractions) → `gotoFraction` teleports the tip there + wiggle; refused with
  `goto {ok:false, reason}` while carrying (a reagent would fly straight into the pack) or
  as a ghost (it drifts to the healer). A press on the map never starts a hold. The phone
  no longer clears its carrying state on a plain teleport (the overlay keeps the grip; the
  following `drop` clears it). `phantomHear` ignores `pos`/`layout`. Measured: the dot stays
  within 0.1 px of the overlay's cursor over plain, fast, carrying and ghost swipes.
- **Round 15: the pad (phone page)**: `#disc-box` (a 200-unit SVG: radial stone gradient,
  `feTurbulence` grain masked to the disc, an engraved groove with 8 studs and 24 notches, a
  `.rim` that takes `--me`) carries `#me-arrow` (the overlay's arrow path in `--me`, optically
  centred: the polygon's centroid is at (9.8, 11.0) of its 24-box, so `translate(-41%, -46%)`
  puts the mass, not the box, on the disc centre; Bobby 2026-10-03); `.hold`
  = gold rim + arrow glow, `.pop` scales the arrow, `#carry` sits on the disc; the reticle
  lost its inner ring; the disc shifts down 6vh and the reticle 12vh when the map shows.
  `#mascot` (Ginger) is fixed bottom-left, 18vmin, blinks at bursts/double-taps and idly
  every 4–11 s. The ghost dim applies to the reticle and the disc, not the map.
- **Round 15: level 0 (`levels.ts`)**: `Level` is 0–3, default 0 with nothing saved,
  persisted. `body.level-0` hides the pack, the gump, the goals card and `#items`
  (`!important`); `.frame:not(.keyed)::after` pulses gold (`ankh-invite`, 3 s). ankh.ts
  dispatches `ankh-awakened` after every awakening (devAwaken too); levels.ts's
  `onAnkhAwakened` at level 0 → `setLevel(1)`, `scatterReagents()`, a `burstAt` on every
  reagent and on the pack, phones `quest {state:"level", level:1, goal}`. `resetGame()` →
  level 0 + scatter + `quest {level:0, goal:"touch the ankh together"}`; `levelState(id)`
  gives a joiner the same once. `devSetLevel(0)` = reset, `devSetLevel(1)` = level 1 without
  the ritual (both reachable through the panel's Restart / Next). The phone shows a level-0
  message without a number; `quest reset` now reads
  "the reagents are scattered anew" (Scatter is used at any level). **Ankh fix**: `ankhTap`
  no longer clamps (`charge += TAP`; `step()` clamps after the full check), and main.ts
  charges the ankh on a `dbltap` too (quick taps alternate tap/dbltap on the phone).
  **Do not** dispatch `level-changed` at startup for levels < 3: horde.ts's `setKeyed(false)`
  wipes the persisted wave history; levels.ts calls `setCatLevel` / `setBirdLevel` directly.
- **Round 15: Ginger plays (`cat.ts`)**: states `stalking` / `pouncing` / `sitting`;
  `setCatLevel(1)` schedules visits (`PLAY_FIRST_MS` 20–40 s, then `PLAY_EVERY_MS` 45–90 s,
  both × `LEVEL0_SOONER` 0.83 at level 0 since Bobby's "doesn't appear often enough at level 0"
  on 2026-10-03;
  a visit needs `state === "away"` and a loose reagent, else it is re-rolled); `startPlay()`
  enters from an edge with `ROUNDS` 2–4; `pickTarget()` = the one he just batted (`SAME_AGAIN`
  60%) else the nearest of `looseReagents()`; stalk at `STALK_SPEED` 0.45× (`.stalk`: `scale:
  1 .86`), within `POUNCE_R` 120 px pounce at 2.6× (`.pounce`: a `translate` hop; individual
  properties compose with the flip's transform), at `CAT_W × 0.35` reach `bat()`:
  `batReagent(id, prey + BAT_PX 150 along his heading ± BAT_SPREAD 0.6 rad)` (quest.ts: clamp on
  screen, `.batted` transition on the slide, a WAAPI `rotate` wobble on the three images so
  the glitter rim follows), phones `cat {state:"bat", name}`, then `.sit` `SIT_MS` 1.5–3.5 s.
  `createFood` during play → `stopPlay()` + walking; `scareCat` and `leave()` call `stopPlay()`;
  `leave()` re-schedules while level 1 lasts; `setCatLevel(≠1)` sends him off. `devCatPlay()`.
- **Round 15: the birds steal (`signpost.ts`)**: `setBirdLevel(1)` schedules `stealNow()`
  (`STEAL_FIRST_MS` 45–75 s, `STEAL_EVERY_MS` 60–120 s): a random perched bird + a random loose
  reagent farther than `NOT_FROM` 160 px from the foot; the perched `<g>` gets `.away`, a
  `.bird-flyer` div in `#fx` (the bird's own paths in a 28×24 viewBox, 34 px, positioned with
  the `translate` property, `.art` flipped by x direction, wings on the `flap` keyframes) flies
  `arc()` (quadratic, bulge `DIP` 140, ease in-out) cap → reagent (`SWOOP_MS` 1.5 s), lifts it
  (`liftReagent(id, "bird")`: `heldBy = "bird"`, `.lifted` = big shadow + no pointer events;
  `releaseHorde()` frees "bird" too on scatter/fill), broadcasts `bird {state:"steal", color,
  name}`, hauls it `HAUL_MS` 1.8 s hanging `HANG` 20 px below to a spot within `DROP_R` 64 px of
  the foot (pushed 40 px to the side of the post), drops it, hops back to the cap, `.land`.
  `devBirdSteal()`.
- **Round 16 (2026-10-03)**: phone page: `#top` (absolute, flex column: `#me`, `#map`,
  `#status`) replaces the fixed status/me lines; `#status` is a pill that hides when empty
  (`idle()` returns "" unless ghost; "connecting…", "offline, retrying…" and the kick text
  still show); `#map` has `pointer-events: auto` inside a `pointer-events: none` column so
  the pad still sees its taps. `MAP_HIDDEN` in minimap.ts = qr, quest, text (never sent).
  The ankh on the map = `.glyph-ankh` (ellipse + stem + arms sized to the frame's box).
  `#mascot` bottom = safe + 84 px. cat.ts: `crossesPost(a, b)` (Liang–Barsky against the
  signpost rect grown by `CAT_W/2`), `entryFor(to)` (PATH_TRIES 12 edge points), used by
  `summonCat`, `startPlay` (the first prey is picked first, then the edge), `pickTarget`
  (prey filtered to those reachable straight) and `leave()` (exit angles re-rolled).
  **Reworked 2026-10-03 evening** (Bobby: "he can walk in front of the post if he's standing
  at the bottom of it; the problem is when he looks like he's floating because he overlaps
  with the center of the post, all the way up to the top/birds"): the obstacle is now the
  **floating zone** `floatBox()`, the signpost rect in cat-centre coordinates: x grown by
  `BODY_HALF` 0.35 × CAT_W, top − 0.5 × CAT_W, bottom = the foot line − `FOOT_TOL` 8 px −
  `FEET` 0.4 × CAT_W (his paws), so standing by the foot is allowed and overlapping the trunk,
  signs or birds with his feet in the air is not; `crossesPost` tests that zone, and **every
  step goes through `stepToward(goal, hop)`** (walking to a dish, stalking, pouncing, charging,
  lunging, hunting): a goal inside the zone is approached from below (`pushOut`), and a
  straight line that would cross it goes via the cheapest clear corner, both legs weighed, so
  he rounds the bottom of the post; the arrival snaps (bat, perch) also require a clear line.
  Toys lying in the zone are nobody's prey (`startPlay` / `pickTarget` filter `inFloat`, and
  a prey carried there mid-stalk makes him pick again); `scareCat` takes the nearest edge not
  across the post. Leaving, bolting and veering keep their ray checks (rays are chosen clear);
  `FOLLOW_UP` 0.55 / `FOLLOW_MARGIN` 90 / `wouldLeaveScreen()` in `bat()`: a follow-up
  pounces at once (`followingUp`, free of `rounds`), `cat {state:"bat", again:true}`.
  **The charge-and-bolt visit** (Bobby 2026-10-03, from watching a real cat; reshaped the same
  evening on his correction: "charge at the item, stay on it for 2 seconds with a couple
  flicks of the tail, and then bolt off for no reason; sometimes the item would get knocked
  away in the process, unintentionally"): `startPlay()` sets `skittish` with `SKITTISH_ODDS`
  0.3 on any visit, never on two running (`lastSkittish`). History the same evening: at first
  every far entry (more than 0.6 x screen width from the prey) was one, and since `entryFor`
  uses only the left and right edges and the level-0 trinkets lie in free spots away from the
  widgets, i.e. near the edges, half the visits were charges ("way too often", and "not seeing
  the multiple bats anymore"); then far entries only with odds 0.35 measured 4 of 16 at level 0
  but Bobby "didn't see it anymore", so the far-entry condition went: a plain chance per visit,
  about one in three, whatever the entry; the stalk then ends in
  `crouching` (`CROUCH_MS` 0.6-1.1 s, `.crouch` flat, a tense wiggle), `charging` at
  `CHARGE_SPEED` 3.2x onto the reagent (a touch past its centre), then **`perching`**
  (`PERCH_MS` 1.7-2.6 s, `.perch`: sitting up, the tail `<g class="tail">` in cat-ginger.svg
  flicks twice by a `rotate` keyframe about its base, phones `cat {state:"perch", name}`; a
  toy pulled from under him ends it at once), then `bolt()`: a **random** heading re-rolled off
  the signpost (no longer back toward the entry), and with `KNOCK_ODDS` 0.55 his hind legs
  send the reagent `KNOCK_PX` 70-150 px roughly backwards (`KNOCK_SPREAD` 0.9 rad; phones
  `cat {state:"bat", kick:true}`, "bolts off and knocks X away"); `bolting` at `BOLT_SPEED`
  2.6x with the `.startled` hop and a "!", `skidding` after `BOLT_LEG_MS` 0.45-0.8 s
  (`SKID_MS` 220, `.skid`), then `veer()`: a new angle `VEER_DEG` 35-70 off the line, either
  side, re-rolled off the signpost, and `leaving` at bolt speed until off the stage. No
  follow-ups, no sitting, one reagent per such visit. Near entries keep the
  stalk-pounce-sit game. The 190 px straight kick is gone. Verified (perch-probe, see the
  State at publication).
  **The emergence round** (Bobby 2026-10-03, after a bird took the toy Ginger had finished
  with: "i really liked that emergent behavior"): (1) **birds snatch from a parked carrier**:
  `stealNow()`'s pool adds `carriedReagents()` (phone-held, not the mouse, not inside the
  bag) whose cursor has been still for `PARK_MS` 1.5 s (`cursorIdleMs` in cursors.ts, kept
  by every move/nudge/teleport); at the landing the carrier must still be parked and the
  reagent within `SNATCH_R` 60 px of where the bird aimed, else it misses and flies home;
  `snatchReagent()` in quest.ts breaks the grip and returns the loot with `from`, the
  `onSnatch` hook (main.ts) clears the grip timer and sends `drop {snatched, by: colour}`,
  the broadcast `bird {state:"steal", victim}` tells the room (**`victim`, not `from`: the
  relay overwrites `from` and `id` on every forwarded message**, a gotcha found here).
  (2) **Ginger versus the birds**: at the landing, if `catPos()` is within `LUNGE_R` 220 px
  and `catLunge(at)` takes (he is stalking, pouncing or sitting), the bird flees to the cap
  empty-handed (`bird {state:"chased"}`), he dashes `LUNGE_MS` 650 at pounce speed with a
  "hss!" bubble (`cat {state:"lunge"}`) and sits; and `pickTarget()` makes a perched bird the
  prey with `BIRD_PREY` 25% (always, when nothing is loose): `preyPos()` is the foot of the
  post 36 px below the signpost, no post-crossing filter for it, and on arrival
  `startleBird()` = `scareBird` + `cat {state:"scare", color}` + "!" + a sit. (3) **The
  freshest toy**: `Item.movedAt` (set on drop, bat, kick, a bird's drop, place, the gate's
  landing; not persisted); Ginger's first prey and each round, and the bird's prey, are the
  freshest-moved reagent within `FRESH_MS` 20 s with `FRESH_PREY` 50%. (4) **The Seekers'
  dragging draws him**: quest.ts sums `dragPx` in the carry frame loop (phones only),
  `takeDragPx()`; `scheduleVisit()` fires at 85% of the rolled wait, comes then with
  probability `min(1, drag / DRAG_FULL 3000 px)`, else at the full wait (`DRAG_SOONER` 0.15:
  "up to 15%, not excessive"). `FAR_FRACTION` went 0.5 → 0.6 (at 0.5 a centre reagent was
  "far" from both edges, so every visit to the middle was a charge-and-bolt). Verified
  (emergence-test, 18 checks): the snatch and the miss with a real phone page, the lunge, the
  forced bird prey, the phone texts.
  **Trinkets (`src/trinkets.ts`, Bobby 2026-10-03: "uo allowed you to have knick-knacks
  that didn't do anything"; level 0 had nothing for Ginger)**: five `TRINKETS` (a ball of
  yarn = Ginger's favourite `fav`, a feather, a bone, a tankard, a pine cone; hand-drawn SVGs
  in `public/trinkets/`, ids `trinket:<file>`), their own `#trinkets` layer (z 39, under
  `#items`, hidden by `body.widgets-hidden`, never by the level), positions in
  `overlay.trinkets.v1`, scattered to `freeSpot()`s (best of 4, farthest from each other) on
  first run, Restart and the devtools Scatter. **No glitter rim** (my call, Bobby left it to
  me: the rim means "this counts for the quest"); a soft drop shadow, the same 60 px box, the
  name on hover / grab. Carrying: phones (`trinketHold` after `questHold`, before
  `widgetHold`; `grab {kind:"trinket", item: file, name}`; the grips timers apply; the phone
  shows `/assets/<file>.svg`), the mouse (its own `mouseDrag`); a drop on the gate goes
  through it (`gateTeleport`); a gate sweeper registers loose ones for taps, Teleport and the
  thunderclap. They never go into the pack and count for nothing. **quest.ts delegates** its
  loose-item API for `isTrinketId` ids (`looseReagents` ∪ `looseTrinkets`, `carriedReagents`
  ∪ `carriedTrinkets`, `batReagent` / `liftReagent` / `snatchReagent` → the trinket twins), so
  cat.ts and signpost.ts play with and steal both alike; `FAV_PREY` 0.4 sends Ginger for the
  yarn. `setCatLevel` / `setBirdLevel` are on for levels 0 and 1 now. **Level 0 guard**: the
  reagents are hidden by CSS only, so `looseReagents()`, `hitReagent` and the reagent gate
  sweeper skip them while `level === 0` (a bird went for Black Pearl at level 0 in the test).
  The relay serves the art (`Dockerfile` copies `public/trinkets/`, `.dockerignore` lets it
  through, `server.js` ASSET_DIRS has `../public/trinkets`). Verified (trinkets-test, 20):
  level 0 shows five and no reagents, a phone carries one with the art on the phone, the
  mouse drags one, the gate takes one, Ginger bats the yarn at level 0, a bird steals one at
  level 0, Restart scatters, level 1 keeps them beside the reagents, the eye hides them.
  **Who moves what** (reviewed with Bobby): the Seer drags every widget with the mouse (the
  moongate by its runes only); phones carry only `MOVABLE` = backpack, gump, ankh, codex (hold
  → carry → lift, grips slip after 4–5 s); the signpost, the moongate, the QR and the goals
  card are the Seer's alone; at level 3 the ankh snaps onto the gate and locks for everyone;
  loose reagents: the mouse and the phones grab them (phones only rearrange inside the bag);
  Ginger bats and the birds lift them at level 1, the horde steals from the bag at level 3.
- **The codex heralds the levels; the goals card is level 1's only** (Bobby 2026-10-03: "at
  each level it gives some tips" and "get rid of the codex and goals when we get to level 3";
  he took every proposal, the small ones too). `codex.ts` keeps the pages by `data-level`
  (index.html): level 0 = lore (the greeting, Ginger, and a third page for the trinkets:
  "Knick-knacks lie about the stage. They do nothing. Ginger disagrees."); levels 1–3 = **the
  Seer's notes**, one line per page in 24 px type (`.codex-page.tip`, a `::before` caption
  "the Seer's notes · level N"; the 15 px lore type is unreadable at Discord's half scale),
  5 / 7 / 6 pages, generic words only. **Constant height per level** (Bobby 2026-10-03: the
  buttons jumped while cycling): `.codex-body` is a grid, the level's pages (`.lvl`, set in
  `render()`) all sit in row 2 with `visibility: hidden` and only `.on` is visible, so the card is
  as tall as the level's tallest page (246 px at level 0, 201 at level 1 in the probe) and the
  nav (row 3) never moves; other levels' pages stay `display: none`. `heraldLevel(n)` from `setLevel` (`setCodexLevel` at
  startup, silent): the codex unrolls on the level's first page with the pop and, **from
  level 1 on, rolls itself up `HERALD_MS` 30 s after the last page turn or unroll** (the
  tips come and go; at level 0 it stays open, the greeting is part of the bare stage). The
  auto-roll sets no lock, so a double-tap brings it back at once (rolled, the hit area is the
  120 px scroll, so the cursor must be on that). Each note page carries `data-phone`, the
  plain wording: the level message gained `tip` (the first note; the phone flashes the goal
  5 s, then "codex · tip" 7 s through `flash(text, ms, next)`), `codex page` gained `tip`
  (the page turned to), and `levelState` now tells every joiner the level and its note.
  **Goals card**: `body.level-2 [data-widget=quest]` hides it from level 2 on (its hint line
  went too; the codex says it). Level 2's progress is the **spell strip** (`#spell-strip`,
  the boards' CSS in gold, the five names in a row, the cast ones lit in their first
  caster's colour, up `STRIP_MS` 7 s after each cast and 8 s at the level start, never once
  mastered: the banner has it; under the moonglow board when both are up). Level 3's "N
  waves fought · M carried off" moved to the horde board (a "carried off in all" line while
  `lost` > 0) and to the wave-end banner's sub from wave 2 on. `#goal-2` / `#goal-3`,
  horde.ts's `renderCard` and its session `kills` are gone; **Respawn now moved to the
  devtools stage row** (`#dev-respawn`, shown by `body.reagent-gone`, named by quest.ts).
- **Ginger and the moongate** (Bobby 2026-10-03 evening: "if ginger steps across the moongate
  he is teleported and then he stands there confused and then walks off"): each frame of
  `step()`, while he is on the move (`moving()`: walking, stalking, pouncing, charging,
  bolting, skidding, leaving, hunting, lunging; not eating, sitting, crouching or perching)
  and the gate is not sealed (`isGateSealed()`, new in moongate.ts) and `GATE_COOLDOWN_MS` 8 s
  have passed, `onGate(paws)` → `gateTakes()`: `stopPlay()`, state `jumping` (frozen on the
  gate), phones `cat {state:"gate"}`, and `gateTeleport(place, at)` (the gate's own star here
  and at the `freeSpot`) → `landFromGate(p)`: sidestepped out of the signpost's floating zone
  if the spot fell in its margin, state `dazed` for `DAZE_MS` 1.8–2.8 s (a "?" at the landing
  and again a second before the end, `facingRight` flips every `DAZE_TURN_MS` 450, a woozy
  sway in `render`), then `leave()`. The gate **firing** with him on it (a tap, a Teleport
  gather) goes through the same `landFromGate` from the sweeper's `move`, so he is dazed then
  too. The cooldown keeps his way out from bouncing him straight back through.
  **The ankh feeds him** (Bobby picked "sits and purrs" and added "maybe the ankh makes some
  food for him too"): ankh.ts registers `setAnkhHooks({on: onAnkh, busy: waveActive ||
  ankhPlaced, purr: catPurr, dishSpot})` in `initAnkh` (ankh.ts already sat downstream of
  cat.ts through horde.ts, so cat.ts cannot import it); his paws on the ankh while `moving()`,
  `ANKH_COOLDOWN_MS` 90 s apart, → `startPurr`: `stopPlay`, state `settling`: he walks
  (`stepToward`) to `purrSpot()` (the hooks' paw point: the frame's centre line, `PURR_UP` 0.3 of
  its height above the bottom edge; Bobby: "move a bit onto the ankh … not just standing next to
  it"), then `beginPurr`: state `purring` for `PURR_MS` 2.6–3.6 s with `.sit.purr` (a warm
  drop-shadow and a breathing `scale` swell), "prrr", phones `cat {state:"ankh"}`; each frame `catPurr(dt)` raises the charge at `PURR_PER_S` 40 **only up
  to `DIM_CAP`** (the dim glow; a cat never moves it toward awakening, the group does); at the
  end `endPurr`: `createFood(dishSpot())` (`DISH_BELOW` 56 px under the frame; createFood's
  middle-half clamp applies) with a `burstAt` there, and the usual dish logic takes him (walk,
  eat, `afterMeal`).
- **The yarn game** (Bobby 2026-10-03 night: "if a player moves the ball of yarn, there's an
  increased chance of summoning ginger and he will play with you as long as you keep moving the
  yarn and he's in the vicinity … moving the yarn while ginger is nearby will cause him to
  change plan and engage with the yarn; if you move it far away, it disengages after 5
  seconds"): trinkets.ts reports every player move of a carried trinket (`onTrinketMoved`, from
  the phone carry loop and the Seer's `mouseDrag`; never a bird) and exposes `trinketPos` /
  `trinketHolder`; cat.ts's `onYarnMoved` (registered in `initCat`): while he is **away**, the
  drag tallies (`yarnDragPx`) and every `YARN_SUMMON_PX` 400 px rolls `YARN_SUMMON_ODDS` 0.6 to
  `summonForYarn` (in from an edge, straight into the game; not within `YARN_SUMMON_GAP_MS` 20 s
  of his last visit's end, `lastVisitEndAt`); while he is about and `engageable()` (stalking,
  pouncing, sitting, crouching, charging, perching, leaving; not a meal, a fright, a daze or a
  purr) and the yarn moves within `YARN_NEAR_R` 340 px of him (not in the floating zone) →
  `engageYarn`: `yarnPlay`, `target = YARN_ID`, stalking, phones `cat {state:"yarn"}`.
  `preyPos()` follows the yarn held or loose; a held yarn cannot be batted, so `bat()` sends the
  holder `cat {to, state:"swat"}` ("keep it moving!") and sits `YARN_SWAT_SIT_MS` 0.4–0.9 s, then
  the sitting branch goes back to the yarn; a loose yarn is batted as usual and costs no round.
  `stepYarn` each frame: gone / in the floating zone / farther than `YARN_FAR_R` 520 px
  (`yarnFarSince`) or still (`yarnLastMoveAt`) for `YARN_LOSE_MS` 5 s → `yarnPlay` off,
  `pickTarget()` if rounds remain else `leave()`. Out of range he **sits and watches** it,
  facing it (no chase across the stage; the first probe had him follow a yarn taken 686 px
  away back into range within a second), and resumes if it comes back within range. Distance
  only counts once he has been within range (`yarnReached`): summoned from an edge he walks in
  at full speed until then (the next probe had him sit down at the edge and give up). `stopPlay` clears the game. Test hook:
  `window.catState()` = {state, target, yarnPlay, rounds}.
- **The phone pad is an analog stick** (Bobby 2026-10-04, after a playthrough with a tester:
  the joystick "should be kind of like the N64 controller … a little bit of displacement = a
  little continuous movement"; he asked what the industry does and took the proposal with
  "go"): in the phone page the thumb's displacement from where it landed is a velocity, held
  for as long as it is pushed, like a mobile game's virtual stick. Constants at the top of the
  gesture block: `STICK_DEAD_PX` 12 (nothing moves inside), `STICK_FULL_PX` 64 (full speed;
  Mario reads 64 of the N64's 80; pushing further adds nothing), `STICK_CURVE` 1.6 (speed =
  `STICK_FLOOR` 0.0125 + (`STICK_MAX` 0.26 − floor) × m^1.6 stage widths per second: 19 px/s
  at the dead-zone edge, ~160 at a half push, 400 at full on a 1536 stage, about 4 s across;
  the first deploy had twice that, 800 px/s, and Bobby found "they move way too fast around the
  map", "a 50% reduction"), `STICK_EASE_MS` 60 (the velocity follows the push); lifting stops dead, and bringing the
  thumb back to where it landed stops too. **The origin is where the thumb landed and it is
  invisible**: the arrow stays put, the `.push` rim ring in the player's colour answers the
  push (`opacity: var(--push)`), and the disc **leans a little with the thumb** as it did
  before the stick (`follow()`: `--fx/--fy` = `FOLLOW` 0.3 of the drag from the landing, at most
  `FOLLOW_MAX` 80 px, a 0.12 s transition, home on lift). Bobby's corrections after the first
  deploy the same day: the first version had the disc come under the thumb and follow it past
  a 76 px ring, and the arrow slide and turn as the knob; "the cursor changing direction on the
  joystick is just wrong. it should be a static thing … the cursor shouldn't move either …
  the joystick moves a little bit when i touch it and then seems stuck like that … very
  strange / too complicated"; the arrow also went from 46% to 38% of the disc ("a bit
  smaller"); a fully static disc was then "a minor regression": "put back the joystick moving
  with the thumb as it's being swiped", i.e. the original lean. The phone integrates in its own rAF (`frame`) and every `SEND_MS` 33
  sends `move {dx, dy, dt, stick:true}` as fractions of the **overlay's** viewport (from
  `layout`'s w/h; `STAGE_FALLBACK` 1536×960 before it arrives); cursors.ts `moveCursor(…,
  stick)` adds them with gain 1 (no acceleration; main.ts drops `CARRY_BOOST` for stick moves,
  pushing harder is the boost; `GHOST_DRIFT` still applies) and the dot on the map sums the very
  same fractions (`reckon` is stick-only now; `layout.gain` still carries the swipe formula,
  which `tools/fake-phone.mjs` and any plain `move` go through unchanged). **The hold**: `arm()`
  at the landing with the `HOLD_SLOP_PX` 28 band (a drift inside it still grabs, as before);
  when it fires the origin is re-centred under the thumb (the drift does not creep on) and
  `band` drops to the dead zone; leaving the band disarms; a true stop later in the stroke
  (inside the dead zone) re-arms a **rest-hold** (`hold {rest:true}`: main.ts skips
  `widgetHold` and the wiggle for it, so parking on the bag never picks it up and a pause is
  silent; the phone shows `.hold` and buzzes only when the `grab` arrives), so a player can
  steer onto a reagent, ease off, grab, push on and lift to drop without lifting in between.
  Tap, double-tap, lift = drop and the map tap are unchanged; a map press never starts the
  stick. Why velocity control despite the stream delay: a
  stick held a second too long overshoots by a screen, so the mini-map dot (local and exact) is
  what a student steers by, and the top speed stays moderate for that. The old swipe's
  anisotropy (fractions of a portrait phone: x went 3.5× as far per px as y) is gone, the stick
  is isotropic in overlay px. Texts: "push to carry", "push to shoot" (phantom.ts mirrors them),
  the hint, README's table and protocol, the RUNBOOK. Verified headlessly (`stick-test`, 39
  checks; see the State at publication). Not yet felt by Bobby; the phone page needs a deploy. Sound
  effects, his other note from that playthrough, are parked for after.
- **Sound cues (`src/sounds.ts`, `tools/sounds/`, 2026-10-04)**: Bobby's playthrough with a
  tester named "lack of sound effects" first; he asked whether free libraries need accounts
  and wanted "a tool that allows me to navigate/play the various sounds for a particular
  event … and i just pick the one i like. maybe have 7 options for each". Sources, checked
  from this machine: **Kenney** packs (CC0, a direct zip per pack, no account; `KENNEY_PACKS`
  in events.mjs, 606 files in 8 packs) and **OpenGameArt** (the CC0 filter in the search URL,
  public HTML and file links, no account; thin for some words: bow/arrow 0, purr 1, fireball
  2); **Freesound** (the biggest, best-tagged CC0 library) only with a free API key in `.env`
  as `FREESOUND_KEY` (401 without); Pixabay and Mixkit answer 403 to scripts and Mixkit
  forbids redistribution anyway. **CC0 only**, so the picked clips can live in the public
  repo. `tools/sounds/events.mjs` lists the 21 events (id, label, when, `oga` search words,
  `kenney` filename patterns, `fs` query, `max` seconds) and `SLOTS` 7. `npm run
  sounds:harvest` (`harvest.mjs`, node + ffmpeg + unzip, no npm deps): downloads into
  `tools/sounds/cache/` (git-ignored), interleaves the sources (Freesound, OGA, Kenney; two
  files per OGA asset and per Kenney pattern for variety), and cuts each with ffmpeg (silence
  trimmed both ends, capped at `max`, loudnorm −16 LUFS, mp3 128 kbps: plays in WebView2 and
  on iPhones alike) into `tools/sounds/candidates/<id>/<n>.mp3` + `candidates.json`
  (git-ignored). `npm run sounds` (`picker.mjs`, port 4333, opens the browser): the events
  down the left with ✓ marks, up to 7 cards per event with ▶, title, source, author, link,
  seconds, **pick** / **no sound for this** (keys 1–7 play, Shift+1–7 pick, 0 none, ↑↓
  events, space stop); a pick writes `public/sounds/picks.json` and copies the clip to
  `public/sounds/<id>.mp3` at once (committed; the presenting machine gets them from the
  repo). The overlay: `initSounds()` fetches the picks and decodes the clips into WebAudio
  buffers (re-run when the devtools panel opens, so a fresh pick plays without a reload);
  `sfx(id, {volume, cooldownMs})` plays (default cooldown 150 ms; `lightning` 400 so the two
  bolts give one thunder, `moongate` 300 inside `star()` so the landing star is silent, `wisp`
  70 at volume 0.6, `monster` 600, `slay` 120); mute and volume persist (`overlay.sound.*`);
  the devtools stage row has 🔊/🔇 whose tooltip counts the clips. Hooks: quest `grab` /
  `drop` (collect or drop) / `openGump`, moongate `star`, spells (the lightning strike,
  `loose`, night-sight, create-food), ankh `awaken`, levels `showBanner` (the wave end too),
  horde `spawn` / `fireball` / `slay` / `ash` / `ultimate`, `ghostCursor`, signpost `scareBird`
  and the theft, cat `meow` / `beginPurr` / `bat`, moonglow pickups. WebView2's autoplay
  policy: `additionalBrowserArgs` in tauri.conf.json adds
  `--autoplay-policy=no-user-gesture-required` (keeping Tauri's default disable-features
  list; a config change restarts `tauri dev`), plus a resume on the first pointer or key.
  **The stream must carry system audio**: Discord's screen share has a "Share audio" toggle
  (Windows), Teams "Include computer sound"; the presenting machine plays the cues. Test
  hooks: a DOM `sfx` event plays, `window.sfxStats()` reports loaded / played / state.
  Phone-side sounds (the meow is synthesized there today) are a later round.
- **Window covers the primary monitor** by setting position/size from the monitor bounds
  in `setup` instead of `fullscreen: true` (fullscreen + transparent has known black-screen
  issues on Windows). `skipTaskbar: true` so it stays out of Alt+Tab; hence the tray icon.
- **Placeholder widgets**: parchment text card, framed ankh SVG (drawn by hand, no
  copyrighted art), animated CSS moongate. Runic captions use Unicode runes rendered by
  the built-in "Segoe UI Historic" font.
- **Screen sharing (Teams on Friday, Discord for the students)**: share the *entire screen*,
  not a window. A layered always-on-top window is captured by screen share but never by
  window share. Teams to be verified Friday; Discord's 720p encode is the reason for stream
  mode and for keeping on-stream text at 28 px or more.
- **Azure Container Apps over a VM** for the relay. Reasons: managed TLS gives a public
  `https://`/`wss://` URL with zero certificate work; WebSockets are supported natively;
  scale-to-zero means US$0 compute when idle; and `az acr build` builds the image in the
  cloud, so Windows machines without Docker can deploy. Trade-offs: a Basic registry costs
  ~US$5/month while it exists, and a cold start of a few seconds on the first connection
  when scaled to zero (`up.sh` pins one replica for rehearsals). A VM would need a public
  IP, NSG, cloud-init, Caddy for TLS, and more scripts, for no benefit here.
- **Exactly one replica** (`--max-replicas 1`): rooms live in the relay's memory. Two
  replicas would split a room between them.
- **No Log Analytics workspace** (`--logs-destination none`): one less resource, no
  ingestion charges. `az containerapp logs show --follow` still streams console output.
- **Relay protocol is dumb on purpose.** It forwards any JSON to the rest of the room and
  tags it `from: "phone" | "desktop"`. Only `{type:"kick"}` from the desktop is
  interpreted. Pointer semantics live entirely in the overlay and the mobile page.
- **Desktop key.** `RELAY_DESKTOP_KEY` on the relay (Container App secret) must match
  `VITE_RELAY_KEY` in the overlay's `.env`, otherwise a phone could claim the desktop
  role and kick everyone. Both are generated by `deploy.sh` and never committed.
- **Room codes** are 4 characters from an alphabet without 0/O/1/I, generated on the
  overlay side and kept in `localStorage` (`overlay.room`; was `sessionStorage` until
  2026-10-02, when Bobby found rescanning after every relaunch a friction) so reloads *and*
  relaunches keep the room: a connected phone stays in it and gets its cursor back on its
  next message. Rotate makes a new code. The relay accepts any A-Z0-9 code up to 8 chars.
- **Phantom Seekers (`src/phantom.ts`, 2026-10-02, Bobby: "I need to attach my phone every
  time which causes friction")**: devtools "+ Seeker" creates `bot-N`, injects `{type:"join",
  role:"phone", id}` into `onRelayMessage` (so identify / naming / `you` run as for a phone;
  the `you` goes to the relay too, harmless), teleports it to a `freeSpot()` (Bobby: random,
  not all on the centre) and possesses it: `onMouse` (new hook in
  mouse.ts, fired by Rust reports and pointermove) → `setCursorTarget` (new in cursors.ts,
  smoothed) with the tip under the mouse; `#possess` (fixed, z 84, `cursor: none`, shown
  by `body.possessing`) takes the pointer while interactive and replays the phone page's
  gesture logic (350 ms hold, 10 px tap tolerance, 350 ms double-tap) as injected
  `{type, id, from:"phone"}` messages, so rate limits, grips and every main.ts path are the
  real ones; `leave` is injected without `from` (like the relay's). The pill got `z-index:
  86` so it stays clickable above the layer (devtools is 90). main.ts routes every outgoing
  message through `send()` = `relay.send` + `phantomHear`, which formats messages for the
  possessed phantom (`phoneText`, mirroring the phone page's strings) into `#dev-phone`.
  Esc releases. Devtools also got Level 1/2/3 (`devSetLevel` in levels.ts: 1 = reset, 3
  marks every spell cast by the Seer), Night/Day (`devSetNight` in sky.ts), Monster
  (`devSpawnMonster`, a stray monster outside a wave: the horde loop runs on
  `monsters.length` alone), Open bag.
- **down.sh disables ingress** in addition to scaling to zero: a phone page retrying
  every 2 s would otherwise keep waking the app.
- **The ending on the stage (2026-10-17, for the show)**: `body.end-open
  [data-widget=moongate]` gets `z-index: 52`, above `#end-full` (50) and under the cursors
  (60): the stage dims, the QR card takes the middle and the gate floats beside it (before
  this the backdrop hid the very gate the students were told to enter). The portal is
  **amber** (Bobby's pick over green or the ring alone): the `.portal .moongate` rule
  restates the radial gradient, the breathing ring and the swirl in amber (a `hue-rotate`
  filter would have turned the gold box-shadow blue along with the rest) and speeds the
  swirl up. The phone shows a **button, not a jump** (Bobby: "a link should appear in their
  device that they click"): `#portal` (fixed, z 100, outside `#pad` so no stick starts on
  it) with an `Enter Mystica` anchor set from `travel`'s url; nothing navigates by itself,
  the student taps and leaves on purpose, the socket's close is the `leave`. main.ts bursts
  (`burstAt`) at a leaving cursor that stands on an armed gate. The old fallback `<a>` lived
  in `#status`, which has `pointer-events: none` since round 16, so it could never be
  tapped: anything a phone must tap outside the pad gets its own element from now on. Not
  handled: closing the ending does not take the button back from phones that already got
  it (a reload does); at the show the ending is a one-way door.

## State at publication (2026-10-21)

This public copy was made the day after the webinar (2026-10-20), with the history squashed
to one commit. The per-session diary that used to live in this section (deploy logs, machine
notes, the scratchpad test suites of each round) and the Claude Code memory folder are not
part of it; everything above is.

- Everything described above was built and shipped. The phone page the relay serves is
  `relay/public/index.html`. The author's relay is scaled to zero; a fresh deployment comes
  from `scripts/deploy.sh` (see RUNBOOK) and gets its own URL and desktop key.
- Seen live by the presenter: milestones 1 to 3, the quest, the spells, the levels, the
  mini-map, the pad, level 0, the birds, the horde, the ending and the portal. Verified
  headlessly only (the suites lived outside the repo and are not included): the finer Ginger
  behaviours of round 17, the emergence round, the trinkets, the sound hooks.
- **The desktop key does NOT rotate on a deploy**: `deploy.sh` reuses `VITE_RELAY_KEY` from
  `.env` and prints "desktop key unchanged: the running overlay stays connected";
  `deploy.sh --new-key` rotates on purpose. A deploy still rolls the relay revision (sockets
  drop once, about a minute).
- **Parked phantoms count as players** (the ankh quorum once came out at 3 after Seekers
  were spawned, released and not subtracted): devtools Restart removes every phantom
  (`removeAllPhantoms()` in phantom.ts) and the phase line says "· N phantoms parked" while
  any are. Release still parks (a parked body is what the horde, arrows, Teleport gathers and
  a second cursor on the ankh need).
- **Loose ends**: the sixth spell slot ("a spell yet unwritten"); a Reset-layout item; a
  relay restart leaves the old cursors on the overlay until Kick all or a reload; the bird
  flyer is small (34 px, `.bird-flyer`).

### Testing notes

- **A self-contained rig**, never the live overlay: a local relay (`PORT=8090
  RELAY_DESKTOP_KEY=x node relay/server.js`), Vite on 1430 with
  `VITE_RELAY_URL=http://localhost:8090 VITE_RELAY_KEY=x`, a headless Chrome
  (`--remote-debugging-port=9333`, 1536×960) on the overlay page and another (9334, 390×844)
  on `http://localhost:8090/r/<room>`, both driven over the Chrome DevTools Protocol
  (`Runtime.evaluate`, `Input.dispatchMouseEvent`). The relay reads the phone page once at
  startup: restart it after editing `relay/public/index.html`. Reload the overlay page before
  each run (a relay restart leaves stale cursors) and find a phone's cursor by its name, never
  by DOM order. One headless browser per page: a background tab gets no animation frames, so
  its cursor never visibly moves, and two overlay tabs share the room. Phone-true screenshots
  need `Emulation.setDeviceMetricsOverride` (390×844 @2); `--window-size` alone gives a
  desktop-shaped viewport.
- **The Vite page runs in a plain browser without Tauri** (`invoke`/`listen` reject
  asynchronously, the rest works, `mode` stays locked-interactive): `chrome.exe --headless=new
  --remote-debugging-port=9333 --user-data-dir=<scratch> --window-size=1536,960
  http://localhost:1420/` (Vite listens on `[::1]` only; `localhost` resolves to it,
  `127.0.0.1` does not). A fresh profile has no `overlay.room`, so it joins its own random
  room and never disturbs a live one. Caveat: the devtools panel (z 90) is above the
  possession layer (z 84), so phantom gestures cannot reach what lies under the panel; move
  the widget first.
- **Driving the real overlay**: launch it with the WebView2 remote-debugging variable (see
  Gotchas), then CDP `Input.dispatchMouseEvent` goes through the real event pipeline (pointer
  capture included) and ignores the OS click-through flag. Devtools buttons can be clicked
  with `querySelector(...).click()`; the spells can be mastered by dispatching `spell-cast`
  events. A `tauri dev` started from a tool session dies at that session's background limit.
- Never fill the pack in a Ginger test (a full pack ends level 1); a press by the sitting
  cat hits him; small-step wiggles charge the ankh (steps over 60 px are teleports and count
  for nothing).

## Gotchas

- **Run `cargo` / `npm run tauri dev` from PowerShell, not Git Bash.** Git Bash puts GNU
  coreutils `link.exe` ahead of the MSVC linker on PATH and every crate fails to link
  ("link: extra operand"). `~/.cargo/bin` may need prepending to PATH in fresh shells.
- First `cargo` build is several minutes; later builds are incremental.
- The Bash tool's heredocs choke on apostrophes here; write files with the Write tool.
- If the overlay ever blocks the screen and the pill is unreachable, use the tray icon
  (Quit) or kill `webinar-overlay.exe`.
- Vite restarts when `.env` changes but can miss a second write that follows within
  milliseconds; `deploy.sh` therefore writes `.env` once. If the widget says
  "offline (close 4003, bad VITE_RELAY_KEY)", restart `npm run tauri dev`.
- Run the Azure scripts from Git Bash (`bash scripts/x.sh`); `az` output has CRLF on
  Windows, which `_common.sh`'s `azq` strips when capturing values.
- **Headless driving of the webview**: launch with
  `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"` before
  `npm run tauri dev`, then `http://127.0.0.1:9222/json` lists the page and a WebSocket
  `Runtime.evaluate` runs JS in it (Chrome DevTools Protocol). Handy for testing hotkey
  actions without a keyboard. Never ship with that variable set.
- Redeploying the relay rolls the revision: two replicas overlap for ~1 min and every
  socket drops once. Do not redeploy during the webinar.
- The widget drag handler calls `setPointerCapture` on the `.widget` element on every
  press, which retargets the resulting `click`/`dblclick` to the widget, so listeners on
  children (like the bag `<img>`) never fire. Put click listeners on the widget itself
  or on `button`s (which the drag handler skips). Cost Bobby a broken double-click once.
- **Inserting CSS by anchor**: anchor on a rule's *first* selector line. A block inserted
  before `.reagent.grabbed .name {` landed inside the selector list
  `.reagent:hover .name, .reagent.grabbed .name` and hijacked the hover rule (gold badge
  styles on the hovered label, mouse only; phones never hover). Cost Bobby a round.
- **Never mix an inline `transform: translate(...)` with an animated individual property
  (`rotate`, `scale`, `translate`)**: the individual properties are applied *before*
  `transform`, so the rotation or scale acts on the translation too (the ultimate's beams
  orbited the screen corner; the fireballs zigzagged). Position such elements with the
  `translate` property (`el.style.setProperty("translate", "x y")`), or animate a child.
- **The relay overwrites `from` and `id` on every message it forwards** (`msg.from = role;
  msg.id = ws.id`). Never put a payload field under either name: `bird steal` carried the
  victim as `from` and every phone read "desktop". Use `victim`, `item`, `by`, …
- Renderer-level mouse input for tests: CDP `Input.dispatchMouseEvent` with `clickCount`
  goes through the real event pipeline (pointer capture included) and ignores the OS
  click-through flag. `Runtime.evaluate` + `dispatchEvent` would not have caught that bug.
- **`npm --prefix <dir> install` recurses on Windows** (found 2026-10-20, the morning of the
  show, npm 10.8.2 / node 20): a `--prefix` on the command line sets the *global*
  prefix too, and on Windows the global `node_modules` sits right under the prefix (no `lib/`),
  so npm takes its "install this package globally" branch and installs the *current directory*
  (the overlay itself) into `relay/node_modules` as a junction, whose postinstall runs again, 22
  levels deep until PATH overflows and `npm` is "not recognized". Harmless on macOS and Linux
  (`lib/node_modules` there), which is why it never showed before. The postinstall is
  `cd relay && npm install` now; never use `--prefix` in a script here. If the junction ever
  reappears: `cmd /c rmdir relay\node_modules\webinar-overlay` (removes only the link; a
  recursive delete could follow it into the repo).
