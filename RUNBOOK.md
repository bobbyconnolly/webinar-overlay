# RUNBOOK — webinar overlay

## Prerequisites (Windows 11)

- Node 20+, npm.
- Rust: `winget install Rustlang.Rustup` (open a new terminal afterwards so
  `~/.cargo/bin` is on PATH).
- MSVC linker + Windows SDK. Having Visual Studio installed is **not** enough; the
  "C++ x64/x86 build tools" component and a Windows SDK must be present. With VS 2022
  Community already installed (run from an elevated PowerShell, or accept the UAC prompt):

  ```powershell
  & "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify `
    --productId Microsoft.VisualStudio.Product.Community --channelId VisualStudio.17.Release `
    --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
    --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --passive --norestart
  ```

  Without Visual Studio (students): `winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.26100"`.
- Build from **PowerShell**, not Git Bash (Git Bash shadows the MSVC linker with GNU `link`).
- Azure CLI, logged in with deploy rights.
- Copy `.env.example` to `.env` and fill values (nothing needed for milestone 1).

## Launch the overlay (dev)

```powershell
npm install          # first time only
npm run tauri dev    # starts Vite on :1420, builds Rust, opens the overlay
```

The overlay starts **interactive and locked**: it catches every click on the screen.
Top-right pill:

- **Unlock (click-through)** — clicks pass through to the desktop. From then on, hold
  **Ctrl+Shift** to interact (drag widgets, press buttons, re-lock).
- **Lock interactive** — stays interactive with no hotkey (only reachable while holding
  Ctrl+Shift once unlocked).
- **⚙** — devtools (Ctrl+Shift+D): free spell casts and shortcuts for testing.
- **eye** — hide / show every widget but the pill (Ctrl+Shift+H).
- **✕** — quit.
- **Reset game** — asks "reset the game? Yes / No" inline (the question goes away after
  6 s), then back to level 0: the bare stage, the ankh waiting; progress and tallies cleared.
- **‹** — collapses the pill to the status dot, the lock icon (closed padlock = locked
  interactive, open = click-through) and the eye; the mode text, Reset and ✕ hide. **›** expands it.
  Remembered across launches. Quit is still in the tray menu.

## Hotkeys

| Keys | Action |
|---|---|
| hold **Ctrl+Shift** | overlay is interactive while held (drag widgets, press buttons); release = click-through |
| **Ctrl+Shift+Q** | expand / collapse the full-screen QR code |
| **Ctrl+Shift+R** | rotate the room code: disconnects current phones, new QR |
| **Ctrl+Shift+X** | kill switch: disconnect every phone (room code stays, QR collapses) |
| **Ctrl+Shift+S** | stream mode: audience-facing elements 1.5× bigger, presenter hints hidden, pill shrunk. Remembered across launches. Use it whenever you share the screen. |
| **Ctrl+Shift+H** | hide / show every widget and the loose reagents (the pill, the cursors, sparkles and spell effects stay). Same as the eye in the pill, which turns red while hidden and is also in the collapsed pill. Phones can only move and cast meanwhile. |
| **Ctrl+Shift+L** | toggle the lock (same as the lock button) |
| **Ctrl+Shift+D** | devtools panel (also the ⚙ in the pill): **Restart** (level 0) and **Next ▶** (one phase forward along the real path), free spells as the Seer or as the phantom you drive, the stage switches (Night, Monster, Daemon, Ghost, Open bag, Ginger plays, Bird steals, Scatter), phantom Seekers. Nothing is spent or tallied. See "Testing without a phone". |
| **Ctrl+Shift+E** | the ending (also **Ending** in devtools): a full-screen QR of `VITE_MYSTICA_URL`, the Mystica game the students join afterwards, and the moongate turns amber and is a portal: a cursor that enters it gets an **Enter Mystica** button on its phone (once per phone); the tap leaves the room. Esc or the same key closes it. Greyed with "not set" if the variable is empty in `.env`. |

The action keys are registered with Windows, so other apps never see them while
the overlay runs (note: Ctrl+Shift+R is normally a browser hard reload). The tray menu
also has "Disconnect all phones".

Gold edge glow + green dot = interactive right now. No glow = click-through.
Tray icon (system tray, bottom-right) has Lock / Unlock / Quit as an escape hatch.
Stop the dev session with Ctrl+C in the terminal.

Widget positions persist between launches (browser localStorage inside the webview).

## The webinar: one machine (revised 2026-10-17; replaces the two-machine plan of 2026-10-03)

The presenter runs the overlay on one machine (the one with the webcam) and shares **the
entire screen** on Discord, voice and video. The presenter is **the Seer**: the mouse drags
widgets, is the +1 of the ankh's quorum, presses Next in the devtools. The students join on
their phones; the relay sits in Canada Central, near them (their leg is the short one; the
overlay's leg was about 250 ms round trip from the presenter's end, wherever the relay sits,
and the Discord stream adds a second or two on top). The lag is explained, not avoided: the
blurb is in `docs/talk.md` with the rest of the talk notes.

**The day before (allow an hour):**

1. `git pull`, `npm install`.
2. `.env` has three lines: `VITE_RELAY_URL`, `VITE_RELAY_KEY` and `VITE_MYSTICA_URL` (the
   Mystica app's https URL). Without the third the ending shows a greyed "not set".
3. `npm run tauri dev` from PowerShell (the first run on a machine compiles the Rust side,
   a few minutes). The Mystica server, if you run it locally, needs Node 22 or newer.
4. Ctrl+Shift+E: the stage dims, the Mystica QR in the middle, the moongate amber beside it.
   Drag the gate clear of the centre if it overlaps the card (positions persist; the ending
   card takes the middle). Ctrl+Shift+E again.
5. `bash scripts/status.sh`: up, 1 replica, health ok (`bash scripts/up.sh` if not).
6. A dry run over Discord with the phone: Go Live, entire screen, **share audio** on; scan
   the QR, push the stick, grab a reagent, Next through the levels; then the ending and the
   portal: steer onto the gate, tap Enter Mystica. Count the seconds between a push on the
   phone and the cursor moving on the stream: that number goes into the lag blurb. A second
   Discord account on another device shows what the students will see (text sizes, audio).
7. Claude Code in a second PowerShell for the live-coding part: `claude` in the repo root.
   The live change must stay in `src/` or `index.html` (hot reload); a `.env` or
   `tauri.conf.json` edit restarts the overlay.

**Show day, in order:**

- Discord: join the voice channel with the webcam, Go Live, **entire screen**, **share
  audio**. Never a window: the overlay is a layered window and window-share cannot see it.
- Overlay: `npm run tauri dev` → Unlock → stream mode (Ctrl+Shift+S) → devtools **Restart**
  → Ctrl+Shift+Q for the full-screen QR while the students scan, Ctrl+Shift+Q again. The
  codex greets them meanwhile.
- The talk and the game: **Next ▶** when a phase is done (or let the group do it);
  Ctrl+Shift+H hides the widgets if anything else goes on screen (the eye again after);
  Ctrl+Shift+X if someone misbehaves.
- The ending, after a wave ends (the ankh is loose again after every wave; with the ankh
  placed on the gate the gate is sealed and the portal takes nobody): **Ctrl+Shift+E** (or
  **Ending** in devtools). The stage dims, the Mystica QR fills the middle, the moongate
  turns amber and is a portal: "steer into the portal and look at your phone". A cursor that
  enters it gets an **Enter Mystica** button on its phone (once per phone); the tap leaves
  the room and the cursor bursts off the gate. Stragglers scan the QR. When the room is
  through: Ctrl+Shift+E (closes it; the gate goes back to blue), Ctrl+Shift+H, collapse the
  pill, bring the Mystica browser window up; the overlay stays on top but
  empty, click-through.
- Live coding, if there is time: the session beside the overlay (the live beat, below).
- After: `bash scripts/down.sh`.
- Two hours is fine: nothing in the overlay or the relay times out; the relay keeps sockets
  alive with pings and phones reconnect by themselves after a hiccup.
- A deploy mid-show is the one thing to avoid: it rolls the relay and drops everyone for a
  minute. Freeze the code the day before; the devtools cover the state.

**Why one machine:** the two-machine plan bought short network legs at the price of a Seer
who was not the speaker. The lag costs a minute of explanation, and a good one (it is the
reason the mini-map exists); the show is simpler with the speaker's hands on the keyboard.
On a display other than the one the layout was made on the widgets come up scaled to it on
first launch; drag them if you like, positions persist.

## The talk's frame: provenance, receipts, governance (2026-10-03)

Bobby frames AI-assisted application development around three pillars. This project is the
worked example; every artifact named below is in the repo. The pillars are three questions a
system built with an AI pair must be able to answer at any moment: how did it get this way,
what just happened and can it be shown, and what is it allowed to become and who decides.
Past, present and future is a fair mnemonic; the real axis is who can answer. The first two
can be answered from inside the repository, by a person or a model. The third cannot, because
its inputs are not in the repository.

- **Provenance is memory of intent.** For each thing that exists: the request that caused
  it, the reasoning that shaped it, and the alternatives that lost. A changelog records
  outcomes; provenance records the argument. Its job is to make the present legible to a
  stranger, human or model, so the stranger acts instead of reconstructing. Without it,
  decisions get re-litigated: a settled question is argued again, usually with less
  information than the first time, because nobody wrote down why it was settled. Here: the
  milestone log and the **Decisions (and why)** in CLAUDE.md. The clean example: Ctrl+Shift
  beat Alt+Shift because Alt steals focus for menus and Alt+Shift switches keyboard
  languages. No test proves it and no rule protects it; only the recorded reason does.
- **Receipts are evidence of state.** The trail development leaves when it is done honestly:
  the instruction, the change, the verification, the deployment record. A receipt is a claim
  bound to its proof, and it proves a moment, not a future; a probe that is never re-run has
  quietly turned into history. The instruction is a receipt, and the most important one: the
  prompt is the only record of what was asked, so the output cannot be judged without it,
  and a rule derived from it cannot later be checked for whether it still applies. That is
  why CLAUDE.md quotes the asks verbatim. A check that finds nothing is a receipt of absence,
  not a null event: the signpost probe's 0 floating frames of 3163 was the strongest evidence
  of its evening. Receipts of absence expire fastest, so they carry a time and a commit, and
  the handover says "run status.sh rather than trust this line" for that reason. Receipts
  yield rules of practice: never put a payload under the field the relay overwrites, one
  headless browser per page. Those say how we work, not what we serve.
- **Governance is mandate.** The commitments that bound what the system may become, and the
  people with the authority to change them. It is the only pillar with an outside: the
  audience, the organizer, the platforms, the deadline. Its rules are rules of purpose: the
  group paces level 3 and the presenter never holds the gate; no free-text nicknames and no
  character names from the games; share the whole screen, never a window; no time pressure
  and no new phone gestures. It is also the only pillar that can grant exceptions:
  tap-the-map-to-jump broke "no new gestures", and only a mandate could permit that. Every
  prompt exercises governance, since whoever asks holds the knob, which is what the
  organizer's day key is about. Only some prompts contain it: the ones that set a limit,
  grant an exception, or move authority ("do what is the most fun" delegates; "don't build
  anything, just explore" takes scope back; "push and deploy everything" is a release
  decision). Those are promoted out of the receipts into standing rules in the handover.
  Governance also arrives outside any prompt, the Discord resolution, the Teams rule, the
  deadline, which is why a person has to write it down: nobody prompts it, it is just true.

**Keep rules of practice and rules of purpose in separate drawers.** Mixing them produces two
familiar failures: defending a test workaround as if it were a value, and treating a value
as negotiable because it looks like a convention.

**Telling them apart: delete one.**
- Delete the decisions log and the code still works, the tests still pass, the rules still
  hold, but somebody changes Ctrl+Shift back to Alt+Shift and the menus start stealing
  focus. That loss is provenance.
- Delete the probes, screenshots and history and the why is known and the rules exist, but
  nothing shows the current state honours them; "it works" becomes an opinion. That loss is
  receipts.
- Delete the rules and the people holding them and the history and the proof remain, but
  nothing stops the next feature from breaking the audience's experience or the deadline;
  the session builds the phone-sized stage because it can. That loss is governance.

**Why the lines blur.** Not because the pillars overlap, but because artifacts migrate
between them with age. Today's probe output is tomorrow's reason for a belief, so receipts
become provenance. Provenance feeds governance: the recorded reason for the mini-map settled
the phone-stage question. And a governance decision must itself leave a receipt, or next month
it is re-litigated. The mini-map is all three at once: the one-second stream delay
(provenance), the dot measured within 0.1 px of the overlay cursor (receipts), the one new
gesture the audience was allowed (governance). Declining the phone-sized stage was a
governance call, and it was only a safe one because the other two were in order. One sentence
for the slide: governance without provenance is guessing, and without receipts it is faith.

**Two habits for the AI pair.** "I checked and it's fine" without the output is faith, not a
receipt: turn checks into assertions, what was looked for, where, when, and what came back.
And when a request conflicts with a standing rule, surface the rule rather than obey or
refuse silently; only the person asking can turn that moment into a granted exception.

**The live beat (the live-coding part: since 2026-10-17 Bobby's own Claude Code session
beside the overlay, no day key).** Set it up in one line first, or a refusal looks like a
failure to a casual viewer: "watch what it does when I ask for the wrong thing". Then ask the
session to put the full stage on the students' phones. With the handover file doing its job, it should answer with the rule, the
reason the mini-map exists, a rough estimate of what the feature would take, and a
recommendation to leave it for after the show, instead of starting to code. Thirty seconds,
and governance is visible. If it starts coding anyway, that is also a lesson: stop it, point
at the rule in CLAUDE.md, and ask again; the second answer is the one to discuss.

## Teams screen-share test (Friday)

1. Launch the overlay, unlock it (click-through).
2. In Teams, share **Screen** (entire display), not a window. Window-share cannot see
   an overlay that belongs to another process.
3. Confirm the codex (the parchment card), the ankh and the
   animated moongate are visible in the
   shared stream. Hold Ctrl+Shift and drag a widget; confirm the move shows on the stream.

## Run without Azure: relay on your own Wi-Fi

For students, classrooms and rehearsals without cloud credits. Phones must be on the
same Wi-Fi as the laptop (corporate or hotel networks with client isolation will block it).

```powershell
npm install            # also installs relay/ dependencies
npm run relay:local    # starts the relay on port 8080, prints your Wi-Fi address
npm run tauri dev      # in another terminal
```

`relay:local` writes `.env.local` (git-ignored) with `VITE_RELAY_URL=http://<your-ip>:8080`
and a desktop key; Vite loads it over `.env`, so cloud settings stay intact. The QR widget
says **online · local Wi-Fi** and the QR points phones at your laptop. Windows Firewall
asks once to allow node on private networks: say yes. Art is read straight from `public/`.

Back to the cloud relay: `npm run relay:cloud` (deletes `.env.local`; the overlay restarts
by itself). Without any relay configured the QR widget shows the setup steps instead of
a QR, and everything else (mouse, reagents, bag, moongate) still works.

## Backend: relay on Azure Container Apps

**A deploy keeps the desktop key** (it is read back from `.env`), so the running overlay
stays connected and nothing needs restarting; the relay revision rolls, so phones and the
overlay drop once and reconnect within a minute. `bash scripts/deploy.sh --new-key` rotates
the key on purpose (then restart `npm run tauri dev`).

All scripts are bash; on Windows run them from Git Bash: `bash scripts/<name>.sh`.
They need `az` logged in to a subscription with deploy rights. Nothing is created
outside resource group `webinar`.

| Script | What it does | Cost effect |
|---|---|---|
| `scripts/deploy.sh` | Create or update everything; builds the image from `relay/` in Azure (no local Docker). Writes `VITE_RELAY_URL` and `VITE_RELAY_KEY` into `.env`. | registry ~US$5/month while it exists |
| `scripts/up.sh` | Before a rehearsal or the webinar: enable ingress, pin 1 replica so there is no cold start. | 0.25 vCPU / 0.5 GiB, inside the monthly free grant |
| `scripts/down.sh` | Afterwards: scale to zero and disable ingress. Overlay shows "offline". | compute US$0 |
| `scripts/destroy.sh` | After the webinar: delete the whole `webinar` resource group. Asks you to type the group name. | everything US$0 |
| `scripts/status.sh` | List resources, replica count, health check. | none |

- Redeploy after editing `relay/`: `bash scripts/deploy.sh` again (idempotent). During the
  rollover (~1 min) two replicas exist and connections drop once; do not redeploy while
  the webinar is live.
- Test the relay from a terminal: `node relay/smoke.mjs "<VITE_RELAY_URL>" "<VITE_RELAY_KEY>"`
  (both values are in `.env`). Expect `PASS` and a phone kicked with code 4001.
- Play without a phone: `node tools/fake-phone.mjs --room <CODE> --swipe 0.3,0 --tap`
  (room code from the QR widget; `--hold`, `--release`, `--dbltap`, `--stay ms`, `--listen`).
- Live logs: `az containerapp logs show -g webinar -n relay --follow`.
- After `deploy.sh` changes `.env`, restart `npm run tauri dev` so Vite picks up the values.
- Health URL: `<VITE_RELAY_URL>/healthz`. Mobile page: `<VITE_RELAY_URL>/r/<ROOM>`.
- Test from a phone today: read the room code off the overlay's relay widget, open
  `<VITE_RELAY_URL>/r/<ROOM>` on the phone, tap the cat. The widget shows
  `1 phones · last: tap @ <time>`. The room code survives page reloads (kept in
  sessionStorage) and changes only on an explicit rotate (milestone 3) or app restart.

## QR flow test (phone → cursor on the overlay)

1. `bash scripts/up.sh`, then launch the overlay. The QR widget shows the room code and
   "online · 0 phones". If it says offline, the relay is down or `.env` is stale.
2. **Ctrl+Shift+Q** → the QR grows to full screen with the room code in the margin.
   Scan it with a phone: charcoal reticle page with a cat, status "room XXXX · connected".
   The widget now says "1 phone".
3. On the phone: **tap** the pad → an arrow cursor appears on the overlay and wiggles.
   **Hold still** → wiggle. **Push** (the pad is an analog stick since 2026-10-04: push from
   wherever the thumb landed; the disc leans a little with the thumb, the arrow stays put,
   the rim glows with the push)
   → the cursor moves that way for as long as you push, a little push creeps, a full push
   crosses the overlay in about 4 s; lift and it stops. Each phone gets its own cursor colour.
4. **Ctrl+Shift+R** → phone shows "disconnected by the Seer · rescan the QR code",
   the widget shows a new code and QR. **Ctrl+Shift+X** → same on the phone, code unchanged.
5. Backend down (`bash scripts/down.sh`): widget says "offline", QR greys out, full-screen
   view shows OFFLINE. Overlay keeps working.
6. Teams: share the whole screen; the audience sees the QR, cursors and widgets.

## Reagent quest (phones carry reagents into the backpack)

- Eight reagents lie scattered on the overlay; the backpack widget is the target and the
  goals widget shows `N / 8` with the names. **Reset game** in the pill (Yes / No) goes
  back to level 0 (the bare stage).
- Phone: steer the cursor onto a reagent, **hold still** (~0.4 s) to grab it (it glows in
  the cursor's colour, phone says "holding …"; easing the stick off onto it and resting
  grabs too, without lifting), **push** to carry, **lift** to drop. A full push carries it
  across the screen in about 4 s; the grip slips after 4–5 s.
- It counts only when the reagent's centre lands inside the backpack's inset zone (the
  pack glows while a carried reagent is over it). Dropped on the rim = still outside.
- **Looking inside**: double-click the bag icon (in interactive mode, or while holding
  Ctrl+Shift), or a phone double-taps with its cursor on it, and the open bag appears as
  its own widget (a bit wider than the ankh frame) with every collected reagent visible.
  Drag it anywhere; it stays open until you press its ✕. Phones can open it but never
  close it. A reagent dropped inside the open bag lands exactly where it was dropped; a
  reagent dropped on the bag icon lands at a random spot inside. Spots are remembered
  across restarts. The closed icon shows a count badge.
- Border art for the open bag: replace the `border` on `.gump` in `src/styles.css` with a
  `border-image` (nine-slice PNG/SVG) when you have the asset.
- You (the Seer) can drag reagents with the mouse in interactive mode, including out of
  the open bag. **Phones cannot take reagents out of the bag** (changed 2026-10-01): a hold
  inside the open bag only rearranges the reagent, clamped to the bag; the phone says
  "stays in the pack". A phone's grip slips after a random 4–5 s ("your grip slipped"),
  so nobody can hold a reagent, or the bag, hostage.
- **Phones can carry widgets**: the bag icon, the open bag, the ankh and the codex (hold,
  swipe, lift; position persists). Not the QR widget, not the goals widget, not the
  moongate. You move the moongate by dragging its runic caption with the mouse (the gate
  itself stays a click-to-teleport target); phones cannot, unless you add "moongate" to
  `MOVABLE` in `src/widgets.ts`.
- **Spells** (level 2: spellbook drawer on every phone, until Reset): Lightning
  (black pearl, mandrake root, sulfurous ash), Magic Arrow (black pearl, sulfurous ash),
  Teleport (blood moss, mandrake root), Night Sight (spider's silk, sulfurous ash), Create
  Food (garlic, ginseng, mandrake root: a dish at the caster's cursor, Ginger walks in from
  the left or right edge at any height, eats for 2.6 s, wanders off in a direction of his
  own choosing; a cursor tap on him = "meow"
  bubble here and a synthesized meow on that phone, one per phone per 1.5 s; dishes queue
  for the one cat). Casting
  spends the reagents from the bag; they land back on the overlay with bursts. One cast per
  phone per 10 s, one per room per 2 s. Big "Name casts Spell" text plus the effect on the
  overlay; every phone sees who cast. **Lightning** = two bolts 0.17 s apart, each from a
  random angle 55°–125° from the horizontal (never from the side). Each is a thunderclap:
  an expanding ring, cursors within the gate's reach are shoved 200 px outward (phone: "the
  lightning threw you back"), loose reagents and dishes flung past the reach; Ginger, if
  about, drops the meal and runs for the nearest edge at double speed (the dish stays);
  after the second bolt the gate is **overloaded** for 10 s (dashed white rim, faster
  spin): any cursor touching it is sent through at once, no tap, no cooldown.
  **Signpost**: a decorative widget you can drag: grey brick post on a patch of dirt with
  vines, a sign to the ankh in front and a second sign behind the post seen edge-on (too
  foreshortened to read), a hanging lantern that lights with a warm circular glow during
  Night Sight, and a red and a blue bird on the cap: your click or a phone cursor tap sends
  one flapping off; it lands again 25 s later. **Magic Arrow** is
  nocked on the cast (phone: "arrow nocked · push to shoot", a dashed ring spins on the
  cursor) and the caster's next push shoots: once the cursor has moved 80 px, that
  direction is the first arrow; two more follow 0.5 s apart, each re-aimed by whatever the
  cursor moved (20 px or more) since the previous shot, the beam previewing it. No
  deadline. Each arrow flies 760 px; every other cursor within 48 px of its path is knocked
  160 px and told "X's magic arrow hit you". A reset clears nocked arrows.
  **Teleport** pulls everything within the moongate's reach of the caster (about 160 px:
  cursors including the caster, loose reagents, the dish, Ginger) onto the gate, spread out
  with blue noise, the gate burning brighter; 1.5 s later the gate fires on whatever is
  still on it (a full swipe might get a cursor off in time; phones hear "pulled onto the
  moongate · get off it!").
  **Night Sight** lasts 18 s and starts the **moonglow hunt**: 70 pale-blue wisps in 7 clumps (plus 70 more on a recast, which also extends the night),
  a small flock: slow, clustery, drifting as comets with the lead changing hands, a few
  loners, shying away from cursors and your mouse; a phone cursor collects every wisp
  within 26 px of the path it swipes (no hold); a scoreboard under the top of the screen shows
  counts and how many are left; at the end the leader (ties share) is announced, gets a
  sparkle trail, and the phones hear who won. Your mouse does not compete. The signpost's
  birds take off at dusk and are back 22 s later; up to three bats may come (none, one, two
  or three with odds 10/20/50/20, usually two), each on its own arc across the screen,
  speeding up and slowing somewhere along it; Ginger's eyes glow neon green in the dark. Lightning during the night blows the wisps
  near the gate outward hard (they settle within a second). Spider's silk is limited (see Charges and the economy), so a
  night comes at most every 2–3 min unless you press Respawn now.
- **Charges and the economy** (agreed 2026-10-01): a reagent put in the bag gets plenty of
  charges, max(5, 2 × phones) (the phones' stock row shows the count; nothing on the icon
  itself); each cast uses a charge; on the last one the reagent is thrown back out to be
  gathered again, forever. **Limited**: mandrake root (Lightning, Teleport) holds 2 charges
  and is then gone for 45–60 s; spider's silk (Night Sight) holds 1 and is gone for
  2–3 min. A gone reagent shows a grey countdown in the phone stock row and bursts back
  onto the overlay by itself ("Mandrake Root is back" on the phones); the devtools panel
  (Ctrl+Shift+D) shows a **Respawn now** button meanwhile. Create Food uses garlic,
  ginseng and nightshade, so Ginger is never throttled. A reagent a phone is rearranging
  inside the bag still counts as stock; if a spell uses it up meanwhile, the grip breaks
  and the phone hears "X was spent by a spell". Recipes overlap on black pearl and sulfurous ash on
  purpose: the group must choose.
- **Names and credit**: when a phone joins, its cursor appears at once, wiggles, and gets a
  random name (e.g. "Valiant Bard", occasionally "Avatar of Valor") shown under the arrow;
  the phone shows "you are ▲ Valiant Bard" and tints its reticle in the cursor colour. The
  goals widget lists who delivered what ("delivered by"); the banner credits whoever led.
  Credit = reagents currently in the bag that you delivered, so taking one out costs the
  credit. Names last for the connection; a rescan gets a new one.
- **On the phone**: Ginger sits in the reticle; what you carry shows in his paws; a
  teleport bursts on him and he blinks twice. The relay serves the overlay's own art at
  `/assets/<file>` (copied into the image from `public/` by `relay/Dockerfile`, which is
  built from the repo root).
- **Moongate**: a phone tap with its cursor on the moongate (or your own click on it in
  interactive mode) plays a four-pointed star burst at the gate; every phone cursor
  sitting on the gate, and whatever it carries, is teleported at the peak of the burst to
  a random spot clear of all widgets, with a burst at the destination. One teleport per
  phone per 2.5 s. **Dropping a reagent onto the gate** (mouse or phone) teleports the
  reagent instead, and the cursor stays. Your own Windows cursor never teleports.
- Anti-spam: the relay drops a socket's messages above 60/s and disconnects it above
  200/s (code 4008); the overlay allows 6 actions/s per phone and one backpack open per
  phone per 5 s (one per room per 2 s).
- All eight in (level 1): gold banner "Thou hast gathered all the reagents" for 6 s, then
  **level 2 · cast every spell**: the goals card goes (from here on the stage shows progress
  only while it changes: a gold strip of the five spells at the top for 7 s after each cast,
  the horde's board during a wave), the codex unrolls on its level-2 notes (it rolls itself
  up 30 s after the last page turn) and the spellbook opens on the phones ("level 2 · cast
  every spell", then the codex's first note). All five spells cast: banner "Thou hast
  mastered every spell" for 6 s, then **level 3 · the horde** (next section).

## Level 3: the horde (2026-10-01)

- **The ankh is the key.** At level 3 the ankh frame and the moongate's runes pulse together
  in blue; the card says "the ankh yearns for the moongate"; phones hear "carry it there".
  Phones carry the ankh like the bag (hold, swipe, lift), you drag it with the mouse. When
  its centre comes within about 120 px of the gate centre it **snaps** onto the gate, sheds
  its frame and locks (nobody can move it; a phone holding it hears "the ankh is set upon
  the moongate"). The gate is **sealed** meanwhile: taps on it charge the ankh instead of
  teleporting, and lightning cannot zap through it.
- **Opening the gate** = the usual ankh ritual on it: the quorum (you plus one phone is
  enough alone), taps and wiggles, the white flash. Everyone who took part is blessed as
  always, and the gate tears open: "The Horde Comes", the stage goes dark (bats, birds off,
  lantern lit, Ginger's eyes), the ankh turns sickly green on the gate.
- **The wave** lasts 60 s. Monsters: 6 + 2 per phone + 3 per earlier wave (max 30), the
  last one out by 42 s, about 30% ghouls (more each wave). A skeleton dies to one arrow, a
  ghoul to two, a daemon to three. **Skeletons raid**: they meander toward the backpack
  (waypoints with sideways drift); one that reaches it takes a random reagent out of the
  bag (phones hear "a skeleton took Black Pearl from the pack"; it shows a red rim) and
  carries it back to the gate; through the gate the reagent is scattered far away
  ("escaped with"). Slay a laden one and the reagent drops where it fell. An empty bag just
  makes them mill about the pack. A living cursor within 150 px of a skeleton is chased
  for 5 s (then back to the raid; a laden one never chases). **Ghouls hunt**: they roam
  the whole screen and chase the nearest living cursor within 360 px for up to 9 s (given
  up beyond 480 px). Both are slower than a swipe, so only a parked cursor gets caught.
- **Ghosts** (`src/ghosts.ts`): a cursor whose tip touches a skeleton or ghoul, or a
  fireball, is a ghost for 20 s: the arrow goes faint and a glowing sheet ghost floats about
  it, murmuring "OooOOoo" every few seconds, "☠" before its name; swipes go 0.75× as far, it cannot grab, tap, double-tap or cast (phone: "a ghost cannot cast · find the
  healer"), monsters, arrows and the thunderclap ignore it, it does not count for the
  ankh quorum or pick moonglow; whatever it held drops and a nocked volley is cancelled.
  The phone dims blue and counts down ("☠ a ghoul got you · a ghost for 14 s · drift to
  the healer"). Back by itself at 20 s, or at once when it drifts into the healer. The
  monster that caught it hops once and stands over it for 0.7 s.
- **The wandering healer** (`src/healer.ts`): walks in from the nearest side or bottom
  edge (never the top) when level 3 begins (the Level 3 jump too), then paces softly within
  about 100 px of the signpost's foot: 36 px/s on the flat, easing in and out of each step,
  standing 2–5 s between them, labelled "a wandering healer". A V-shaped no-go wedge opens
  upward from the post's foot (35° each side of vertical), so his feet never climb the post;
  a spot on the far side is reached by stepping round below the post. Invincible and
  immovable (no sweeper, monsters and fireballs ignore him). A ghost's tip within 46 px of him is restored ("the healer
  restores thee"); a living cursor that taps him hears "thou art in good health" (once per
  4 s). He walks off on reset.
- **The daemon**: from wave 2 one steps out at 40% of the spawn window ("☠ A Daemon ☠",
  phones told), bigger, wings beating, lurking within 220 px of the gate; every 3 s it lobs
  a fireball at the nearest living cursor within 900 px: a straight line at 200 px/s,
  dodgeable; a tip within 26 px of it becomes a ghost. Three arrows kill it (the charged one counts two); Ginger
  cannot charm it, the ultimate ashes it, lightning stuns it, Teleport banishes it.
- **Level 3 opens with a full pack** (every reagent in, full charges, delivered by nobody;
  phones hear "the pack is filled · cast freely"), so casting starts at once. The Level 3
  devtools jump fills it too.
- **Spells in the wave**: Magic Arrow slays (free, 5 s per phone, no room cooldown, no big
  announcement; the recipe must still be in the bag). The volley is **four**: three half a
  second apart, then the fourth **charges** for 0.9 s (the ring shakes, a crescent grows
  ahead of the cursor, still steerable), flies as a bigger, brighter arrow with a crescent
  head, twice the hit radius, hurts the horde for two (a ghoul dies to it) and kicks the
  caster back 140 px (not the mouse). Lightning stuns every monster 5 s and
  the overloaded gate spawns nothing for 10 s (the budget is not lost, just delayed; after
  42 s nothing more comes). Teleport pulls the monsters near the caster onto the gate and
  banishes them when it fires, and **loose reagents near the caster go into the pack**
  instead of through the gate, credited to the caster with full charges (one blood moss
  and one mandrake root for a refill of black pearl and ash). Create Food: every monster
  within 140 px of Ginger gets hearts and flees to the gate at 1.7× speed, credited to
  whoever fed him; after the meal he **hunts** for 8 s (chases the nearest monster at
  1.3× his walk; charms on contact), then leaves. A dish cast while **3 or more** monsters
  are about is a **feast** (the dish glows orange): after eating it he unleashes the
  **ultimate**: everything under the effects layer goes dark (cursors too), three orange
  beams sweep a full turn from him in 3 s, every monster a beam passes shakes, and at the
  end they turn to sulfurous ash (one charge of ash into the pack each, or the ash lands in
  the pack if it was loose), credited to whoever fed him; phones hear "Ginger unleashes".
  Night Sight lifts the dark for 60 s (no moonglow hunt during a wave).
- **Board** at the top centre: slayers this wave, "N remain", a draining time bar. The goals
  card shows the session's tally ("slain by"), waves fought and reagents carried off.
- **End**: at 60 s, or when the last monster is gone ("vanquished"), survivors retreat
  through the gate (dropping loot), the top slayer (not you) gets a sparkle trail, the banner
  says who, and 2.6 s later the ankh is **flung off** the gate to a free spot, gold and
  yearning again: carry it back for wave 2. Reset game ends everything and flings the ankh
  off too.
- **Testing alone**: devtools **Next ▶** walks the phases: at level 3 it places the ankh, then
  opens the gate (a wave, no quorum needed), then ends the wave; the line under the buttons says
  what the next press does. To shoot: **+ Seeker** and possess it, cast Magic Arrow (it nocks on
  the phantom you drive), then swipe; with no phantom possessed the spells are the Seer's and
  the volley goes the way the mouse last moved.

## Sound cues (2026-10-04)

- **Pick them once**: `npm run sounds:harvest` (a few minutes: it downloads CC0 clips from
  Kenney and OpenGameArt, trims and normalizes them with ffmpeg; with `FREESOUND_KEY=` in
  `.env` from a free Freesound account it searches Freesound too, the richest library), then
  `npm run sounds` opens http://localhost:4333: one event at a time, up to seven clips each,
  ▶ to hear, **pick** or **no sound for this**; keys 1–7 play, Shift+1–7 pick, 0 none, ↑ ↓
  change the event. A pick lands in `public/sounds/` at once; the overlay re-reads the picks
  whenever the devtools panel opens (Ctrl+Shift+D), so pick, open devtools, play.
- **Commit `public/sounds/`** when done: the presenting machine takes the picks from the repo.
- **The stream must carry the sound**: Discord's screen share has a **Share audio** toggle
  (Windows); Teams: **Include computer sound**. The Seer's machine plays the cues; without
  that toggle the audience hears nothing. Check it in Friday's test.
- Mute / unmute: the 🔊 button in the devtools stage row (persisted); its tooltip counts the
  events that have a clip.

## Testing without a phone (2026-10-02)

- **The room code survives relaunches** (localStorage, not sessionStorage any more): a
  phone that was connected stays in the room; after the overlay comes back, one swipe or
  tap on the phone and its cursor is back (new name). Rotate still makes a new code.
- **Phantom Seekers** (devtools): **+ Seeker** adds a fake phone with a cursor and a name
  at a random spot clear of the widgets, and your mouse takes it over at once: the arrow follows the mouse everywhere (even
  click-through, from the Rust-reported position); while the overlay is interactive your
  clicks are its gestures: **click = tap, press and hold ~0.4 s = grab (then drag and
  release), two quick clicks = double-tap**. Everything a phone can do works: grab a
  reagent (also inside the open bag: it stays in), carry the bag, the codex or the ankh,
  open the gump, turn the codex page, tap the gate, charge the ankh (you + the phantom
  on the ankh make the quorum, so the ritual completes alone), collect moonglow, shoot
  nocked arrows (cast "as" the phantom, then swipe), slay for credit. Grips still slip after
  4–5 s like a phone's. **Esc** or **Release** gives the mouse back; the phantom stays
  where it was. The dropdown picks which phantom to drive; **− Seeker** removes it. The
  📱 line in the panel shows what that phone's screen would say (hold, drop, cast, hits,
  horde messages…). **A released phantom is parked, not gone: it still counts as a player**
  (the ankh quorum, the horde's budget); the phase line says "· 2 phantoms parked", and
  **Restart** sends them all away. While possessing, the pill and the devtools still take clicks; the
  widgets do not (the layer in between takes them), and whatever lies under the devtools
  panel (bottom right) is out of the phantom's reach while the panel is open: close it with
  Ctrl+Shift+D (Esc still releases). The OS cursor hides over the overlay.
- **The panel** (Ctrl+Shift+D or ⚙; rebuilt small on 2026-10-02, "overwhelming"): **Restart**
  (level 0, the bare stage) and **Next ▶**, which takes the game one phase forward along the
  real path: awaken the ankh (level 1) → fill the pack (the banner runs, then level 2) → master
  every spell (the banner, then level 3) → place the ankh on the gate → open the gate (a wave)
  → end the wave → place the ankh again (wave 2)… The line under them says where the game is
  and what Next will do. Then the **spells** (free; as the Seer, or as the phantom you drive),
  the **stage** row: **Night**/**Day** (ten minutes of dark, no moonglow), **Monster** (one
  skeleton or ghoul out of the gate, wave or not: shoot it, feed Ginger next to it), **Daemon**
  (one out of the gate, fireballs at the nearest cursor), **Ghost** (the phantom you drive,
  else the first phone, becomes a ghost for 20 s, or revives; never the Seer), **Open bag**,
  **Ginger plays**, **Bird steals**, **Scatter**; and the **Seekers** row. Three presses of
  **Monster**, then Create Food = a feast = the ultimate. Park a possessed phantom on a
  monster to be caught; drift the ghost to the healer to be restored. Gone: "cast as", the
  level buttons, Fill bag, Awaken, Place ankh, Summon / End wave, Respawn now (Next covers
  them; Respawn now is on the goals card when something is spent).
- **Persisted**: waves fought and reagents lost (`overlay.horde.v1`); the level; an ankh on
  the gate at reload re-locks there. Tallies are per session.
- Knobs: the constants at the top of `src/horde.ts`.
- **Reset game** (pill, next to the lock button; asks "reset the game? Yes / No", the
  question goes away by itself after 6 s): back to **level 0**: the bare stage (only the
  moongate, the ankh, the signpost, the QR and the codex), progress and tallies cleared,
  spellbook closed. Phones see "touch the ankh together".
- You are **the Seer** in every tally and on the phones; the phones are **Seekers**
  (status line "Seeker · room XXXX · connected").
- Progress, positions, the level and the spells cast persist across restarts
  (localStorage); Reset clears them.

## Round 15 (2026-10-02): the phone's map, the pad, level 0, Ginger plays, the birds steal

- **The mini-map** on the phone (top, under the status lines): a landscape map of your
  screen with the widgets as silhouettes (the moongate a blue oval, the pack brown, the ankh
  gold, the signpost green) and the player's dot in their colour. The dot moves **on the
  phone**, from the phone's own swipes with the overlay's gain formula, so it does not wait
  for the stream; the overlay only corrects it when the cursor jumps (moongate, Teleport,
  arrow knock-back, the bow's recoil, a thunderclap, a ghost, a grab or a drop). The map
  follows your drags, the hidden widgets, the open bag, the QR fold and stream mode within a
  second. **Tap the map** = the cursor jumps there (a ring marks the tap). Refused while
  carrying ("thou canst not jump while carrying · lift first") and as a ghost. Needs a
  deploy (the phone page) to reach real phones; phantoms have no map (nothing to see).
- **The pad**: a grained stone disc with an engraved compass ring carries the player's
  arrow in their colour; the rim takes their colour, glows gold on a hold; what they carry
  sits on the disc; the teleport star bursts on it. Ginger sits bottom-left as the mascot
  and still blinks at bursts and double-taps, and now and then by himself.
- **Level 0**: a fresh launch (nothing saved) and every Reset show only the moongate, the
  ankh, the signpost, the QR and the codex; the ankh pulses faintly gold; a joining phone
  hears "touch the ankh together" once. The usual ritual on the ankh (you + one Seeker is the
  quorum; taps and wiggles) starts level 1: the pack, the goals card and the eight reagents
  burst in, phones hear "level 1 · gather the reagents", the participants are blessed as
  always. The level survives a relaunch. Alone: **+ Seeker**, tap the map (or swipe) onto
  the ankh, put your mouse on it, wiggle and click (or tap with the phantom): about six taps.
  Or devtools **Next ▶** at level 0.
- **Fixed on the way**: taps alone could never finish the ritual (a tap clamped the charge
  to 100 and the next frame's decay ran before the "full" check): now they can; quick taps
  on the ankh alternate tap / double-tap, and the double-tap charges it too; a lift (the
  `release` every tap sends) no longer counts against a phone's six actions per second.
- **Ginger plays** (level 1 only): 20–40 s after level 1 begins, then every 45–90 s, he
  walks in from an edge, creeps up on a loose reagent (low), pounces (a hop) and bats it
  about 150 px on, sits a moment, goes for another (usually the same one), two to four
  times, and leaves. Phones hear "Ginger bats Garlic across the floor". A dish (Create Food)
  wins over the game, lightning scares him off, a tap on him still meows, the moongate still
  sweeps him. Knobs at the top of `src/cat.ts` (`PLAY_FIRST_MS`, `PLAY_EVERY_MS`, `BAT_PX`,
  `ROUNDS`…). Devtools **Ginger plays** = a visit now (any level, if a reagent is loose).
- **The birds steal** (level 1 only): 45–75 s after level 1 begins, then every 60–120 s, a
  perched bird swoops on a loose reagent (not one already near the post), carries it back
  (hanging under it, nobody can grab it in the air) and drops it at the foot of the post,
  then settles on the cap again. Phones hear "the red bird carries Black Pearl off to the
  signpost". Knobs at the top of `src/signpost.ts`. Devtools **Bird steals** = one now.
- **Alone**: everything above works with phantoms plus your mouse; the phone-side pieces
  (map, pad) need a real phone or the deployed page in a browser.
- **2026-10-03 touches**: no status label on the phone (messages come in a pill under the
  map, gone when there is nothing to say); the QR, the goals card and the codex are off the
  map and the ankh is drawn as an ankh; Ginger never floats in front of the signpost (he may
  walk by its foot, but every step detours around the post's box above the foot line, and a
  toy lying in front of the post is nobody's prey)
  and sometimes swipes the same reagent again at once, stacking, never off the screen. About
  one visit in three (never twice running) is the
  charge-and-bolt kind: he creeps up, crouches, charges, lands on the reagent and sits on it
  for about two seconds, tail flicking, then bolts off in a random direction with a "!" (about
  half the time his hind legs knock the reagent 70–150 px away), skids, veers off and is gone.
  If he steps onto the moongate on the move (or it fires with him on it), it sends him through
  like a dropped reagent: he lands dazed, sways, looks left and right with a "?" for about two
  seconds, then walks off; not while the ankh seals the gate, and not twice within 8 s. If he
  steps onto the ankh on the move he sits and purrs on it for about three seconds (the ankh
  glows up to its dim level, never toward awakening), then the ankh conjures a dish under its
  frame and he goes to eat it; not during a wave or while the ankh is on the gate, and at most
  once per 90 s. **The ball of yarn**: a Seeker (or you, with the mouse) dragging it may bring
  him while he is away (a 60% chance per 400 px dragged, not within 20 s of his last visit);
  dragged within 340 px of him it makes him drop his plan and chase it, pouncing at it when he
  catches up (a yarn in a hand gets a swat, the phone hears "keep it moving!"; a dropped one is
  batted), for as long as it keeps moving; taken more than 520 px away he sits and watches it
  (no chase across the stage), and after 5 s of that, or of the yarn lying still, he goes back
  to his own ideas.
- **More emergence** (same day): a bird may take a reagent out of a Seeker's hands if that
  cursor has been still for 1.5 s (a moving carrier is safe; it misses if the carrier moves
  before it lands; the phone hears "the red bird snatched X out of your hands!"); Ginger lunges
  at a bird landing within 220 px of him and it flees empty-handed ("Ginger chases the red
  bird off!"); now and then (25% a round, always when nothing is loose) his prey is a perched
  bird, which he stalks to the foot of the post and startles off; both he and the birds go
  for the freshest-moved reagent half the time; and the more the Seekers have dragged
  reagents since his last visit, the sooner (up to 15%) he comes back. The birds drop their
  loot spread around the post now. Alone: + Seeker, hold a reagent and keep the mouse still
  for two seconds, then devtools **Bird steals**.
- **Trinkets** (2026-10-03): five knick-knacks that do nothing (a ball of yarn, a feather, a
  bone, a tankard, a pine cone) lie about from level 0 on. Anyone can carry them (the phone
  shows the one in hand), the moongate sends them through, lightning flings them, Ginger
  plays with them (the yarn is his favourite) and the birds steal them; they never go into
  the pack. No glow on purpose: the glitter rim means "this counts". Restart and Scatter put
  them at fresh spots; the eye hides them with the widgets. So Ginger and the birds are about
  from level 0 now, with only the trinkets to play with until the reagents burst in.
- **Who moves what**: you drag every widget (the moongate by its runes). Seekers can carry
  the backpack, the open bag, the ankh and the codex (hold, swipe, lift; a grip slips after
  4–5 s) and never the signpost, the moongate, the QR or the goals card. At level 3 the ankh
  on the gate is locked for everyone. Loose reagents: you and the Seekers grab them (Seekers
  only rearrange inside the bag), Ginger bats them and the birds lift them at level 1, the
  horde steals from the bag at level 3.

## Codex, QR size, the ankh ritual (2026-10-01)

- **Codex**: two pages (a greeting; Ginger). ‹ › turn the page, a
  double-click rolls it up into a scroll icon (backpack-sized), another unrolls it. Phones
  tap it (cursor on it) to turn the page and double-tap to roll / unroll; after any action
  on it, by anyone, phones wait 6 s before the next ("the codex is not ready yet"). You are
  never locked. Page and rolled state are remembered across launches.
- **QR size**: − and + on the QR widget step the small QR through 1×, 1.5×, 2×, 3× (the room
  code grows with it) so you can help a late joiner without the full-screen view. One −
  below 1× folds the widget into a rune stone (a flat disk seen at an angle with a rune cut
  in it; the status dot stays on it); click the stone, or +, to unfold it for a latecomer.
  Remembered across launches.
- **Ankh ritual**: cursors on the ankh make it glow and shake a little. Taps and wiggling
  charge it, but past a dim glow it needs a quorum: at least 2 cursors on it and more
  than half of all cursors, where "all" = every phone plus your own mouse (so you and
  one phone, both on the ankh, are enough to test it) (Rust reports
  its position; the overlay still never draws it). Your mouse counts and charges (clicks
  in interactive mode, movement any time) but is never blessed. About 3 s of three
  people wiggling fills it: white flash over the ankh, "The Ankh Awakens", and every
  phone that took part in the last 8 s gets a sparkle trail: a comet behind the cursor
  (big at the head, thinning behind), a few motes dripping at rest, fading over 60 s to
  almost nothing. Phones short of the quorum see "the ankh stirs · 2 of 3 Seekers".
  Repeatable 12 s after a flash; a new blessing restarts the trail. Works at any level.

## Azure resources

All in resource group `webinar`, region West US 2. Names are fixed by
`scripts/_common.sh` except the registry, which gets a random suffix.

| Resource | Type | Notes |
|---|---|---|
| `webinar` | Resource group | `destroy.sh` deletes it and everything below |
| `webinaracr<hex>` | Container Registry, Basic | relay images; the only thing that costs money while idle (~US$5/month) |
| `webinar-env` | Container Apps environment | Consumption plan, no Log Analytics workspace |
| `relay` | Container App | external HTTPS/WSS ingress on port 8080, 0 to 1 replicas, secret `desktop-key` |

Not in Azure: `VITE_RELAY_URL` and `VITE_RELAY_KEY` live only in your local `.env`.
