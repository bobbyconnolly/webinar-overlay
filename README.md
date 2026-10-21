# Webinar overlay

A transparent, always-on-top desktop overlay for live presentations, with a twist: the
audience scans a QR code, and each phone gets a cursor on the presenter's screen. Phones
carry magical reagents into a backpack, get thrown around by a moongate, and generally
make the presenter's screen a small shared game. Ultima Online flavour throughout.

Three parts:

```
 ┌──────────────────────┐        WebSocket         ┌────────────────┐        ┌───────────────┐
 │ Overlay (Tauri, Rust │ <──────────────────────> │ Relay (Node)   │ <────> │ Phones        │
 │ + TypeScript, Win11) │  role=desktop            │ rooms, forward │ phone  │ (web page)    │
 └──────────────────────┘                          └────────────────┘        └───────────────┘
   src-tauri/, src/                                  relay/server.js           relay/public/index.html
```

The relay is deliberately dumb: it forwards any JSON from one socket to the others in the
same room and tags it with who sent it. All the meaning lives in the overlay and the phone
page, which makes both easy to change.

## Quick start (no cloud needed)

Requirements: Windows 11, Node 20+, Rust (`winget install Rustlang.Rustup`, then a new
terminal), and the MSVC C++ build tools plus a Windows SDK (Visual Studio Installer →
"Desktop development with C++"; see RUNBOOK.md for the exact components). Build from
PowerShell, not Git Bash.

```powershell
npm install            # overlay and relay dependencies
npm run relay:local    # relay on port 8080, prints your Wi-Fi address (terminal 1)
npm run tauri dev      # builds and opens the overlay (terminal 2, first build takes minutes)
```

The overlay opens over your whole screen, interactive and locked (gold glow). Click
**Unlock** in the top-right pill to make it click-through; from then on hold **Ctrl+Shift**
to interact (the **‹** at the end of the pill collapses it to a lock icon). The **−** and
**+** buttons on the QR widget step its QR through 1×, 1.5×, 2× and 3× for late joiners, and
one − below 1× folds the widget into a rune stone (click the stone to unfold it); the
full-screen view is separate. The QR widget should say **online · local Wi-Fi**. Phones on the same Wi-Fi
scan the QR (or press **Ctrl+Shift+Q** to show it full screen).

No phone handy? Drive a fake one from a terminal, using the room code shown on the widget:

```powershell
node tools/fake-phone.mjs --room 7TEN --swipe 0.3,0.1 --tap
```

## Playing

| On the phone | On the overlay |
|---|---|
| push (an analog stick: from wherever your thumb lands on the pad) | your cursor moves that way for as long as you push; a little push creeps, a full push runs (about 4 s across the screen); the disc leans a little with your thumb and the rim glows with the push; lift and it stops (or bring the thumb back to where it landed) |
| tap | your cursor wiggles |
| hold still ~0.4 s | grab what is under the cursor: a loose reagent, a reagent inside the open bag, or a movable widget (the phone buzzes once when it takes; a thumb may drift a little meanwhile). Stopping the stick mid-push and resting grabs too (reagents and trinkets only) |
| push while holding | carry it |
| lift | drop it (a reagent counts when its centre lands in the bag or the open bag window) |
| double-tap on the bag | opens the bag window (you can never close it) |
| tap on the codex | turns its page (level 0: a greeting, Ginger the cat, the trinkets; from level 1 on: the Seer's notes for the level, one tip per page, which your phone shows too) |
| double-tap on the codex | rolls the parchment up into a scroll, or unrolls it |
| tap or wiggle on the ankh | charges the ankh ritual (see below) |
| tap on the moongate | a star burst; everyone and everything on the gate is teleported |
| tap the **map** at the top of the phone | your cursor jumps there (the map shows the stage's widgets and your dot; the dot is computed on the phone from your own pushes, so it never lags behind the video) |

Five **trinkets** lie about at every level: a ball of yarn, a feather, a bone, a tankard, a
pine cone. They do nothing. Carry them, drop them on the moongate, watch Ginger bat them
and the birds steal them; they never go into the pack. The **ball of yarn** is Ginger's
favourite: drag it about and he is likelier to come; drag it near him and he drops whatever he
was doing to chase it, pouncing at it when he catches up, for as long as you keep it moving.
Take it far away, or leave it still, and after five seconds he loses interest.

The game has **levels**. Level 1's progress shows in the goals widget; from level 2 on the
widget is gone and progress shows only while it changes (a strip of the five spells at the top
for a few seconds after each cast, the horde's board during a wave). The **codex** heralds each
level: it unrolls on the level's first note (your phone shows the goal and that note too) and,
from level 1 on, rolls itself up again half a minute after the last page turn; at level 0 it
stays open. **Level 0** is the bare
stage: only the moongate, the ankh, the signpost, the QR, the codex and the trinkets; the ankh pulses
gold, and the first ankh ritual (below) starts level 1 with the pack and the reagents
bursting in. **Level 1**: get all eight reagents into the backpack, while Ginger wanders in
now and then to bat a loose reagent about (or, about one visit in three, to charge
it, sit on it for a couple of seconds flicking his tail, then bolt off for no reason, sometimes
knocking it away as he goes; if his paws cross the moongate it sends him through: he stands
there dazed, looks about, and walks off; and if they cross the ankh he sits and purrs on it, the
ankh glows a little, and it conjures him a dish) and a signpost bird swoops off with one to the foot of the post. Keep
moving while you carry: a bird will take a reagent out of a hand that has been still for a
couple of seconds. Ginger chases birds that land near him and sometimes startles one off the
post, and both go for whatever moved last. At 8 / 8 a banner shows for six seconds ("… led the way"), then
**level 2** starts: cast every spell at least once (the spellbook opens on every phone).
When all five have been cast the banner shows again, then **level 3** starts (see below).
Phones may rearrange reagents inside the open bag but cannot take them out (the Seer, with
the mouse, can). Grips slip after 4–5 s, so nobody can hold something forever. Phones can
move the bag, the open bag, the ankh and the codex, but not the QR, the goals widget or
the moongate. **Reset game** in the pill (it asks first) goes back to level 0.

The **ankh ritual** works at any level. Cursors on the ankh make it glow and shake a little;
taps and wiggling charge it, but past a dim glow it needs a quorum: at least 2 cursors on
it and more than half of all cursors (every phone plus the Seer's own mouse, which counts
but never gets the reward). Short of that the phones on it hear "the ankh stirs · 2 of 3
Seekers". Full charge: a white flash over the ankh, "The Ankh Awakens", and every phone
that took part gets a **sparkle trail** for a minute: a comet behind the cursor when it
moves, a few motes dripping when it rests, fading to almost nothing by the end. Repeatable
after a short cooldown.

**Spells.** When the bag is full a spellbook drawer slides open at the bottom of every phone
(tap its tab to collapse or reopen it; the pad above keeps working).
Five spells, each a recipe of two or three reagents, two to a page over three pages with
‹ › below (an empty slot shows as "a spell yet unwritten"); tap a lit one to cast. The recipe's
reagents are spent from the shared bag. Most reagents carry **plenty of charges** (five, or
two per phone connected when it was put in; the phone stock row shows the count); each cast
uses one, and on the last one the reagent lands back on the overlay, so the group gathers
again (gather, cast, gather). Two are **limited**: mandrake root holds 2 charges and, once
spent, is gone for 45–60 s; spider's silk holds 1 and is gone for 2–3 min. The phone stock
row shows a countdown on a gone reagent, and it bursts back onto the overlay by itself (the
presenter can bring it back early). A reagent a phone is holding inside the bag still
counts. One cast per phone every ten seconds. The overlay
announces "Name casts Spell" and plays the effect: Lightning (two bolts into the moongate
in quick succession, each a thunderclap that throws every cursor and loose thing near the
gate outward; Ginger bolts for the nearest edge; for 10 s after, the gate is overloaded and
sends anyone who touches it through at once), Magic Arrow (nocked on the cast: a ring spins on the caster's cursor, and the caster's
next swipe shoots a volley of four, half a second apart, each re-aimed by the movement
since the last; the fourth charges first, the ring shaking and a crescent growing ahead of
the cursor for a second, then a bigger, brighter arrow flies with twice the reach around
its path and the bow kicks the caster back; every cursor near a path is knocked back), Teleport (everything near the
caster, cursors, the dish and Ginger, is pulled onto the moongate, spread
out so nothing stacks; 1.5 s later the gate fires on whatever is still on it; loose
reagents near the caster fly into the pack instead, with the caster's credit), Night Sight (eighteen seconds of night, bats, Ginger's eyes aglow, and the **moonglow hunt**: a flock of seventy glowing wisps
drifts about in clumps, shying away from cursors; every wisp a cursor swipes over is collected, a scoreboard counts, and when the night
ends the leader is announced and gets a sparkle trail),
Create Food (a dish
appears at the caster's cursor; Ginger walks in from one side at any height, eats it and wanders off
wherever he likes; tap him with your cursor and he meows on your phone). The spellbook stays open until the Seer resets the game.

**Level 3: the horde.** Once every spell is mastered the pack is filled (everyone can cast
at once) and the ankh becomes the key to the
moongate: it and the gate's runes pulse together in blue (phones hear "the ankh yearns for
the moongate"). Carry it there (hold, swipe, lift, as with the bag; the Seer can drag it
too). When its centre comes within reach of the gate it snaps onto it and locks; the gate
is then sealed (taps on it charge the ankh instead of teleporting). The usual ankh ritual
on the gate, the quorum tapping and wiggling, blesses as always and tears the gate open:
the stage goes dark and for a minute skeletons and ghouls step out of the gate. Skeletons
are raiders: they meander to the backpack, take a reagent and carry it back (through the
gate, that reagent is scattered far away), and chase a cursor that strays close for a few
seconds. Ghouls are hunters: they roam and chase the nearest cursor in sight. A cursor
caught by either is a **ghost** for 20 s: pale, drifting, unable to grab, tap or cast, and
ignored by the monsters; it comes back by itself, or at once if it drifts into the
**wandering healer**, the hooded figure who paces by the signpost from level 3 on
(invincible; a living cursor that taps him is told it is in good health). From the second
wave a **daemon** steps out mid-wave, lurks near the gate and lobs slow fireballs at the
nearest living cursor: dodge them, a hit makes a ghost too; three arrows kill it and
Ginger cannot charm it. **Magic Arrow** slays them (a skeleton takes one arrow,
a ghoul two, the charged fourth arrow hurts for two; during a wave the arrow costs nothing,
the room-wide cooldown is off and a phone may shoot every 5 s, but the recipe must be in
the bag, which is what the horde steals).
**Lightning** stuns every monster for 5 s and the overloaded gate spawns nothing for 10 s.
**Teleport** pulls the monsters near the caster onto the gate and banishes them, and sends
loose reagents near the caster into the pack (the way to get black pearl and ash back
mid-siege). **Create Food**: every monster that comes near Ginger forgets everything and
runs back through the gate (credited to whoever fed him), and after his meal he **hunts**:
chases the nearest monster for eight seconds. A dish put down while **three or more**
monsters are about is a feast (it glows): after it he sits and **unleashes**: everything
but the horde, him and three orange beams goes dark, the beams sweep a full turn around
him, every monster they pass shakes and turns to sulfurous ash, one charge into the pack
each, credited to whoever fed him. **Night Sight** in the dark lifts it for a minute
(monsters are silhouettes with glowing eyes otherwise). A board at the top counts who slew
what and how many remain. When the minute is up, or the last monster is gone, the survivors
retreat, the top slayer gets a sparkle trail, and the ankh is flung off the gate to a free
spot: carry it back for the next wave, a little bigger and faster. The Seer never starts a
wave; the group does. Devtools can place the ankh, summon a wave and end one.

Presenter hotkeys: **Ctrl+Shift+Q** full-screen QR, **Ctrl+Shift+R** new room code (kicks
everyone), **Ctrl+Shift+X** disconnect everyone, **Ctrl+Shift+S** stream mode (everything
the audience must see gets 1.5× bigger and presenter hints disappear; use it when sharing
the screen, because a 720p stream reaches viewers at roughly half scale), **Ctrl+Shift+H**
hide every widget but the pill (the eye in the pill does the same; cursors and effects
stay), **Ctrl+Shift+L** toggle the lock, **Ctrl+Shift+D** a devtools panel that casts any
spell for free (as the presenter or as a phone), fills, scatters or resets the game, jumps
to any level, night or day, places the ankh on the gate, summons or ends a wave, and adds
**phantom Seekers**: fake phones the mouse drives (click = tap, hold = grab, double-click =
double-tap, Esc = let go) with a line showing what their screen would say. The tray icon
has the same plus Lock, Unlock and Quit. **Ctrl+Shift+E** is the ending: a full-screen QR
that sends everyone to Mystica, the game that follows the webinar, and the moongate turns
amber and becomes a portal: a cursor that enters it gets an Enter Mystica button on its phone.

## With Azure (optional)

`scripts/deploy.sh` builds the relay image in Azure (no Docker needed) and runs it on
Azure Container Apps with a public HTTPS/WSS URL; `up.sh` / `down.sh` start and stop
compute, `destroy.sh` deletes everything. Everything lives in one resource group. Details,
costs and a resource list are in RUNBOOK.md. The scripts write `VITE_RELAY_URL` and
`VITE_RELAY_KEY` into `.env`; `npm run relay:local` writes `.env.local`, which wins while it
exists (`npm run relay:cloud` removes it).

## Where things are

| Path | What |
|---|---|
| `src-tauri/src/lib.rs` | the window (transparent, topmost, click-through), the Ctrl+Shift hold poller, OS hotkeys, tray |
| `src/main.ts` | wiring: mode, widget dragging, relay messages → game actions, grip timers |
| `src/relay.ts` | reconnecting WebSocket client (desktop role), room codes, local/cloud detection |
| `src/cursors.ts` | one cursor per phone, smoothing, teleport |
| `src/quest.ts` | reagents, backpack, drop zones, counter, completion, persistence |
| `src/moongate.ts` | the star burst and teleports |
| `src/spells.ts` | the spellbook: recipes, casting rules, effects |
| `src/stage.ts` | stream mode scale and per-mode layouts |
| `src/identity.ts` | random names and credit labels |
| `src/widgets.ts` | phones carrying widgets |
| `src/qr.ts` | QR widget (stepped size) and full-screen QR |
| `src/codex.ts` | the parchment rolling up into a scroll |
| `src/ankh.ts` | the ankh ritual: quorum, charge, flash |
| `src/sparkles.ts` | the sparkle trails on a canvas |
| `src/moonglow.ts` | Night Sight's moonglow hunt: motes, pickups, scoreboard, winner |
| `src/signpost.ts` | the signpost's birds, and their thefts (levels 0 and 1) |
| `src/trinkets.ts` | the knick-knacks: carried, batted, stolen, teleported, never collected |
| `src/minimap.ts` | the phone's mini-map: the `layout` and `pos` messages, the `goto` jump |
| `src/devtools.ts` | the presenter's panel: Restart / Next through the phases, free spells, stage switches, phantom Seekers |
| `src/cat.ts` | Ginger: Create Food (the dish, walking, eating, fleeing lightning, the meow), his level-1 game with the reagents, his level-3 hunt and ultimate |
| `src/horde.ts` | level 3: the ankh as the key to the moongate, the waves of skeletons and ghouls, what each spell does to them, the board |
| `src/sky.ts` | day and night: Night Sight's dark, a wave's dark, Night Sight lifting it during a wave |
| `src/mouse.ts` | the presenter's mouse position, reported by Rust |
| `src/phantom.ts` | phantom Seekers: fake phones the mouse drives, for testing without a phone |
| `src/ghosts.ts` | a caught cursor is a ghost for 20 s |
| `src/healer.ts` | the wandering healer by the signpost, who restores ghosts |
| `src/ratelimit.ts` | per-phone message caps |
| `relay/server.js` | rooms, forwarding, kick, keepalive, flood limits, serves the phone page and `/assets` |
| `relay/public/index.html` | the phone page (reticle, Ginger, gestures) |
| `public/reagents/*.svg`, `public/backpack/`, `public/cat-ginger.svg` | placeholder art; swap the files, names are in `REAGENTS` in `quest.ts` |
| `scripts/` | Azure scripts and `relay-local.mjs` |
| `tools/fake-phone.mjs` | a phone driven from the terminal |
| `tools/sounds/` | the sound cues: `events.mjs` (one entry per moment), `npm run sounds:harvest` (CC0 clips from Kenney and OpenGameArt, plus Freesound with a free key in `.env`), `npm run sounds` (a local page to listen and pick one per event) |
| `public/sounds/` | the picked clips and `picks.json`; `src/sounds.ts` plays them (`sfx("meow")`); all CC0 |

State that persists (browser storage inside the overlay): widget positions, one layout per
mode (`overlay.widgets.v1`, `overlay.widgets.stream.v1`), stream mode on/off
(`overlay.stream`), reagent positions and progress (`overlay.quest.v1`), the level and the
spells already cast (`overlay.level.v1`), the collapsed pill, the rolled codex, the QR size,
the room code for the session. **Reset game** (in the pill, with a confirmation) clears the game state and goes
back to level 0.

## Protocol

Connect: `ws(s)://<relay>/ws?room=<CODE>&role=phone` or `&role=desktop&key=<VITE_RELAY_KEY>`.
Every message is JSON. The relay forwards a message to every other socket in the room and
adds `from` (`"phone"` or `"desktop"`) and `id` (the sender's socket id). Do not put your
own `id` field in a message; use another name.

Phone → overlay: `{type:"move", dx, dy, dt, stick:true}` from the phone page's analog stick
(the distance covered since the previous batch, as fractions of the *overlay's* viewport;
added as is, gain 1; a ghost's × 0.75), or `{type:"move", dx, dy, dt}` without `stick` (a
swipe: fractions of the phone screen, and ms since the previous batch; `tools/fake-phone.mjs`
sends these), `{type:"tap"}`, `{type:"dbltap"}`, `{type:"hold"}` (`rest:true` when the stick
stopped mid-push: reagents and trinkets only, no widgets, silent on nothing),
`{type:"release"}`, `{type:"goto", x, y}` (a tap on the phone's mini-map, fractions of the
overlay: the cursor's tip jumps there; refused while carrying or as a ghost).
The stick on the phone: dead zone 12 px, full speed at 64 px (the ring is 76 px and the base
follows the thumb past it), speed = 0.0125 + 0.2475 × m^1.6 stage widths per second (m = the
push past the dead zone, 0 to 1; full = about 4 s across), eased over 60 ms, no inertia. For swipes the overlay applies
trackpad-style acceleration from `dt`: gain = 0.18 + 0.15 × speed (phone-screens per second),
capped at 0.9 overlay widths per phone width; a normal swipe lands at 0.4, a slow drag at
about 0.25, a flick near 0.9. Without `dt` the gain is 0.4. While the phone carries something
a swipe's gain is multiplied by 1.5; a ghost's by 0.75.

**The mini-map** (the phone's "Seer's glass"): the phone keeps its own cursor position,
dead-reckoned from its own stick (it sums the very fractions it sends), so the dot on its map
never waits for the video stream. The overlay sends `{type:"layout", to?, w, h, gain:{base, per, max,
fallback, carry, ghost}, widgets:[{id, x, y, w, h}]}` once to a joiner and broadcast whenever
the visible layout changes (polled once a second; widget rects as fractions of the overlay),
and `{type:"pos", to, x, y}` (overlay px of the cursor's target) only when the cursor is moved
by something other than its own swipes: a teleport, a nudge, the bow's recoil, becoming or
ceasing to be a ghost, a grab or a drop (the gain changes). `{type:"goto", to, ok, reason}`
answers a map tap (reason: `carrying`, `ghost`).

Phone → overlay, spells: `{type:"cast", spell}` with a spell id from the `spells` message.

Overlay → phones (all phones receive them; `to` names the one it concerns):
`{type:"you", to, name, color, role}` right after a phone joins (its random name, cursor
colour and role, "Seeker"),
`{type:"spells", enabled, stock, charges, returning, spells, pages, perPage, cooldown}`
(spellbook open or not, reagent ids in the bag with their charges left, ms until each gone
reagent returns, the spell list with recipes and a `page` each, how many pages and slots
per page; sent to a joiner and broadcast when the bag changes),
`{type:"cast", to, spell, ok, reason, nocked}` (reason: missing, cooldown, busy, closed,
unknown; `nocked`: Magic Arrow waits for the caster's next swipe), `{type:"aimed", to,
state:"fired", hits, shot, of}` (names knocked back, per arrow of the volley), `{type:"hit", to, by, color}`,
`{type:"casted", by, color, spell, name}` (everyone hears who cast what),
`{type:"grab", to, kind:"reagent"|"trinket"|"widget", item, name}` (`item` is the reagent id,
the trinket's art file, or the widget id; `/assets/<item>.svg` is the art),
`{type:"drop", to, kind, name, collected, kept, spent, slipped, score}` (`score` = reagents
currently in the bag that this phone delivered; `kept` = it was only moved inside the bag;
`spent` = a spell used it up while this phone held it),
`{type:"teleport", to}`, `{type:"travel", to, url}` (the ending: the moongate is a portal and
this cursor entered it; the phone shows an Enter Mystica button for `url`, https only, once per
phone; tapping it leaves the room), `{type:"gump", to, state:"opened"|"ignored"}`,
`{type:"codex", to, state:"opened"|"closed"|"page"|"ignored", page, of, tip}` (one phone action
on the codex every 6 s, room-wide; `tip` = the plain wording of the note page turned to),
`{type:"ankh", to, state:"stirs", have, need}` (on the ankh, short of the quorum),
`{type:"ankh", to, state:"blessed"}` (this phone got a sparkle trail),
`{type:"teleport", to, state:"gathered", ms}` (pulled onto the moongate by a Teleport spell;
the plain `teleport` follows when the gate fires),
`{type:"ankh", state:"awakened", names}` (everyone hears who was blessed),
`{type:"meow", to}` (this phone tapped the cat: play a meow),
`{type:"shoved", to}` (a thunderclap threw this cursor back),
`{type:"bird", to, color}` (this phone startled a bird off the signpost),
`{type:"glow", to, count}` (a moonglow mote collected, running count),
`{type:"glow", state:"end", winners, top}` (the night ended; everyone hears who won),
`{type:"respawn", names}` (a spent limited reagent is back, by itself or by the presenter),
`{type:"quest", state:"complete"|"level"|"mastered"|"reset", top, level, goal, tip}` (level 1
beaten, a level started (0 = "touch the ankh together"; 1, 2 or 3; `tip` = the codex's first
note for the level, levels 1–3; also sent to every joiner with `to`), every spell cast, the
reagents scattered),
`{type:"cat", state:"bat", name, again, kick}` (level 1: Ginger batted a loose reagent away;
`again` = a follow-up swipe at the same one, `kick` = his bolt knocked it away), `{type:"cat",
state:"perch", name}` (he charged it and sits on it), `{type:"cat", state:"gate"}` (he stepped
onto the moongate and was sent through it), `{type:"cat", state:"ankh"}` (he stepped onto the
ankh: he sits and purrs, and it conjures him a dish), `{type:"cat", state:"yarn"}` (a dragged
ball of yarn has his attention), `{type:"cat", to, state:"swat"}` (he pounced at the yarn in this
phone's hand),
`{type:"cat", state:"scare", color}` (Ginger startled a bird off the post), `{type:"cat",
state:"lunge"}` (he lunged at a landing bird), `{type:"bird", state:"chased", color}` (the
bird fled him empty-handed), `{type:"drop", to, kind:"reagent", name, snatched:true, by}` (a
bird took it out of this phone's parked hand; `by` = the bird's colour),
`{type:"bird", state:"steal", color, name, victim}` (level 1: a signpost bird carried a loose
reagent off to the post; `victim` = the Seeker it was snatched from, if any),
`{type:"horde", state:"key"|"placed"|"wave"|"stolen"|"escaped"|"end", wave, count, kind,
name, winners, top, lost, vanquished}` (level 3: the ankh became the key, it rests on the
gate, a wave began with `count` monsters, a `kind` took `name` from the pack, it got through
the gate with it, the wave ended; `key`/`placed`/`wave` also go to a joiner with `to`),
`{type:"slay", to, kind, how:"arrow"|"banished"|"charmed"|"ashed", count}` (this phone's
arrow slew one, its Teleport banished one, its Ginger charmed one or turned one to ash;
`count` = its tally this wave), `{type:"ult", state:"ginger"}` (Ginger's ultimate began),
`{type:"teleport", to, state:"bagged", names}` (this phone's Teleport sent loose reagents
into the pack), `{type:"quest", state:"filled"}` (level 3 began: the pack is full),
`{type:"aimed", to, state:"charging", ms}` (the last arrow of this phone's volley is
charging; the following `aimed` carries `big:true`),
`{type:"ghost", to, state:"dead", by, ms}` (this cursor was caught by a `by` of
"skeleton", "ghoul", "fireball" or "devtools": a ghost for `ms`), `{type:"ghost", to,
state:"alive", how:"healer"|"time"}` (back among the living), `{type:"healer", to,
state:"well"}` (this living cursor tapped the healer), `{type:"horde", state:"daemon"}`
(a daemon stepped out); `cast` can answer `reason:"ghost"`,
`{type:"drop", to, kind:"widget", name:"ankh", placed:true}` (the ankh snapped onto the gate
out of this phone's hands). `aimed` carries `slain` (monsters that arrow killed) and `cast`
carries `cooldown` (ms; shorter for Magic Arrow during a wave).
The desktop may send `{type:"kick"}`, which the relay turns into closing every phone.

Relay → sockets: `{type:"hello", id, room, role, phones}` to the one who joined,
`{type:"join", id, role, phones}` to everyone else, `{type:"leave", id, role, phones}` when
someone leaves.

Names are assigned by the overlay from generic words (no character or place names from the
games); phones cannot choose their own. The presenter is **the Seer**, the phones are
**Seekers**. Credit counts reagents currently in the bag per deliverer.

Close codes: 4000 room missing, 4001 kicked by the presenter, 4003 bad desktop key,
4008 flooding (more than 200 messages in a second; above 60/s messages are dropped).

## Extending it

- **A new widget**: add an element with class `widget` and a unique `data-widget` in
  `index.html`; it becomes draggable and its position persists. Add its id to `MOVABLE` in
  `src/widgets.ts` if phones may carry it; add `data-fixed` if nobody may; add `data-handle`
  and give one child the class `handle` if it should be dragged only by that part (the
  moongate, by its runes; the rest of it keeps its own clicks).
- **A new phone gesture**: send a new `type` from the phone page, handle it in
  `onRelayMessage` in `src/main.ts`. The relay needs no change.
- **Better art**: replace the SVGs in `public/`; any transparent PNG works. The phones get
  the same files through the relay's `/assets/` route.
- **Another level**: `src/levels.ts` owns the goals card, the banner and the transitions;
  add a goal there (it listens for `quest-complete` and `spell-cast` on `document` and
  dispatches `level-changed`, which `horde.ts` uses to arm the ankh at level 3). The wave's
  knobs (monsters per wave, speeds, hit points, Ginger's charm radius, the snap distance) are
  the constants at the top of `src/horde.ts`; the monster art is two inline SVG strings there.

## Known limits

- Windows only for the Ctrl+Shift hold (the lock toggle works everywhere); the overlay
  covers the primary monitor; share the whole screen in Teams, not a window.
- Phones on a plain-http local relay lose the screen wake lock; everything else works.
- Rooms live in the relay's memory: one relay instance per room. The Azure setup runs
  exactly one replica.
