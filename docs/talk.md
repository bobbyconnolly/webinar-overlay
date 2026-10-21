# The talk: notes for the show (2026-10-20)

One page to keep open beside the overlay. The run order is in RUNBOOK.md ("The webinar: one
machine"); this is what to say. The dense version of the three pillars is in RUNBOOK.md
("The talk's frame"); the blurbs below are the spoken ones.

## The shape

1. Laptop, webcam, Discord. Overlay up, stream mode, the full-screen QR while people arrive.
   Talk with whoever is there.
2. The year with AI: what got built, in order. The LinkedIn message that started this one.
3. The segue into the game: UO in the nineties; the moongate, the ankh, the reagents.
4. Before the first swipe: **the lag blurb**.
5. The game, level by level. The three words come out when they happen (see "where the
   words land"), not as a lecture.
6. The ending: Ctrl+Shift+E, "steer into the portal, look at your phone", Enter Mystica.
7. Mystica, together. Live coding if there is time. Questions.

## The lag (before the first swipe, ~45 s)

> You are going to feel lag, so let me tell you exactly where it comes from. Your thumb
> moves on your phone. That goes to a relay server in Canada, close to you: twenty
> milliseconds. From there it has to reach my laptop, a long way from that relay: another
> hundred and fifty. My screen moves your cursor right away. But you are
> not looking at my screen. You are looking at a video of my screen. Discord captures it,
> compresses it, sends it to its servers and plays it back to you, and that part takes a
> second or two. So from your thumb to your eyes the loop is about two seconds. Your hand is
> used to fifty milliseconds. That is why it feels like steering a boat.
>
> The fix is on your phone: the map. The dot on the map is computed by your phone, from your
> own thumb, no network involved. It is exactly where your cursor is, before the video
> catches up. Steer by the dot. Glance at the stream for what happened. Small pushes, let
> go, wait. And my voice reaches you faster than the video, so when I say "now", you will
> see it a moment later.

Measure it at the dry run (push on the phone, count until the stream moves) and say the
number you measured. The relay round trip from the presenter's end was 240 to 370 ms on 2026-10-17.

## The three words (spoken, ~1 min each)

> **Provenance** means: where did this come from, and why is it the way it is. Not what
> changed, a changelog has that. The argument. An example from this game: the key you hold
> to click on the overlay is Ctrl+Shift. It used to be Alt+Shift. Alt pops open menus in
> Windows apps when you let go, and Alt+Shift switches your keyboard language. Nothing in
> the code says any of that. No test fails if you change it back. The only thing protecting
> that decision is one sentence in a text file saying why. With an AI pair this matters
> twice as much: the AI forgets everything between sessions, and it will cheerfully
> re-decide anything you did not write down, usually with less information than you had the
> first time. Provenance is memory of intent.

> **Receipts** means: can you show me? A receipt is a claim tied to its proof. The prompt
> that asked for something is a receipt. The test output is a receipt. The screenshot is a
> receipt. "I checked and it's fine" is not a receipt; the output is. In this game the cat
> is not allowed to walk over the signpost, and the receipt is a probe that watched him for
> eight visits, three thousand frames, zero floating frames. The dot on your phone map was
> measured within a tenth of a pixel of my cursor. Receipts expire: "the server is up" was
> true when it was written, so the handover file says "run the status script, don't trust
> this line". I said I don't read the code any more. What I read instead is receipts.

> **Governance** means: who decides, and what is off limits. These rules do not come from
> the code. They come from the audience, the organizer, the platform, the deadline. In this
> game: you cannot type your own nickname, because some of you would be naughty, so the
> game names you. Share the whole screen, never a window, or the overlay is invisible. The
> group opens the horde gate, not me: I am a seer, not a god. And governance is the only
> thing that can grant an exception: we had a rule of no new phone gestures, and
> tap-the-map was the one exception we allowed, because of the lag. The AI cannot supply
> governance. It is not in the repo. Somebody has to write it down. And every prompt you
> type is governance: whoever asks holds the knob.

The one-liner: **governance without provenance is guessing; without receipts it is faith.**

The "delete one" test, if there is time:

> Delete the decisions log: the code still runs, but next month someone switches it back to
> Alt+Shift. That is losing provenance. Delete the probes and screenshots: the why is known,
> but "it works" is now an opinion. That is losing receipts. Delete the rules and the people
> holding them: history and proof remain, but nothing stops the next feature from wrecking
> the audience's experience. That is losing governance.

### Where the words land in the game

- **Provenance**: when someone asks why anything is the way it is (the Ctrl+Shift story,
  or "why does the cat avoid the signpost": because a cat floating over a post looked
  wrong, and that sentence is in the file).
- **Receipts**: the first time the mini-map dot and the stream disagree for a second, then
  agree. "The dot is the receipt; the stream is the rumour."
- **Governance**: the ankh. It needs a quorum; the Seer's mouse is one vote. "I'm a seer,
  not a god." And the names: nobody typed theirs.

## The sea and the solvent

> Think of the model as a sea of everything that was ever written down, and you are
> standing at the edge. You cannot drink the sea. You have to know the words that call up
> the part you need. That is why I keep saying: learn the terminology. "Trackpad
> acceleration." "Dead zone." "A FLIP animation." Say the word and you get the whole design
> the industry already settled on, instead of an invention. If you do not know the word,
> describe the behaviour and ask what it is called; the gap closes in one exchange. Some
> things take a few prompts to wake up. This may matter less as the models get better at
> guessing. It matters now.
>
> But it is not a database. A database hands back what you put in. This is a solvent: what
> you pour in dissolves and recombines across boundaries that used to be solid. One
> LinkedIn message became a webinar, became this game, became a server in Canada and the
> thing in your hand. Code, docs, story, this talk: one substance now.
>
> A solvent dissolves your boundaries too, including the one between what you asked and
> what you meant. The three words are the walls you choose to keep.

## Points to pick from

Each is one or two sentences on stage. The stories are all true and all in the repo.

1. **"I don't look at the code" has a second half: I read receipts instead.** The reading
   moved up a level; it did not go away. When a student asks "then how do you know it
   works?": the probes, the screenshots, the status script, the tester on the phone. And the
   honest limit: the headless test passed and the tester still could not find the spellbook
   tab. A test proves what you asked it to prove.
2. **Taste is the scarce input now.** Most of this game came from reactions, not specs:
   "5–6 seconds is ok", "must read as light, not an object", "cats are weird", "I'm a seer,
   not a god". Code got cheap; knowing what you want and recognising it when you see it did
   not. Build opinions about how things should feel. Play the thing.
3. **Ask what the industry does.** The stick, the cursor acceleration and the QR animation
   all came from one question: "what is the standard here?", then "like the N64
   controller". Vocabulary by asking, not by memorising. And "show me three variants" before
   building: the first answer is the median answer.
4. **A reversal with a reason is not a failure.** The organizer-runs-it plan was made for a
   good reason (short network legs) and reversed for a better one (explain the lag; keep the
   speaker's hands on the keyboard). Because the reasons were written down, reversing cost
   nothing and nobody re-argued it. That is provenance working, in the planning of this
   very talk. It is also what "question what we are doing in the first place" looks like.
5. **The solvent dissolves your boundaries too.** The timed arrow "nobody is going to
   figure out", the joystick that "seemed stuck": what was asked and what was meant drifted
   apart, and the human in the loop noticed within a minute each time. Engage with the
   tools, because that minute is the job.
6. **Ginger.** The cat in the game was my cat. Every behaviour came from watching the real
   one: "charge at the item, stay on it for two seconds with a couple of flicks of the tail,
   then bolt off for no reason". That is what specification looks like now: you look closely
   at the real thing and say what you saw.
7. **The handover file is the real source.** A fresh machine or a fresh model comes up
   right from the repo plus one `.env`. Your CLAUDE.md is a better résumé than your résumé.
8. **The dead leaf, finished.** Whatever form this takes next (chat, ambient, fully
   automated), the three questions survive because they are about trust, not tooling: how
   did it get this way, can you show me, who decides. If the interface is a dead leaf, the
   questions are the tree.
9. **The game is the talk**, said once, lightly: reagents are vocabulary; a spell is a
   prompt that only works with the right ingredients; the ankh needs a quorum because
   governance is collective; the portal is the next world.
10. **Cost, for the IT crowd.** The relay is about five dollars a month idle and scales to
    zero; the image is built in the cloud, so no Docker on Windows. Cloud is cheap if you
    turn it off.

## Answers to have ready

- **"How do you know it works if you don't read the code?"** Point 1. Then: "and sometimes
  I don't; a tester on a phone finds it in a minute. That minute is the job."
- **"Will this take our jobs?"** The deciding did not get cheaper. Point 2, point 4.
- **"What happens when the AI is wrong?"** Receipts. The relay overwrote a field called
  `from` and every phone read "desktop"; the fix was a rule in the file: never put a payload
  under that name. The wrongness became a sentence.
- **"Is no-code the future?"** Point 8. "I don't know. The questions survive the interface."
