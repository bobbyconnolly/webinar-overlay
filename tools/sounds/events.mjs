// The overlay's sound cues: one entry per moment that may make a sound on the shared
// stage (the Seer's machine plays them; the screen share carries them to the audience).
// `harvest.mjs` fills tools/sounds/candidates/<id>/ with up to SLOTS clips per event from
// CC0 libraries, `picker.mjs` lets Bobby listen and pick one (or none) per event, and the
// overlay (src/sounds.ts) plays public/sounds/<id>.mp3 for the picked ones.
//   oga:    search words for OpenGameArt (CC0 sound effects, no account)
//   kenney: filename patterns over Kenney's CC0 packs (no account)
//   fs:     a Freesound query (CC0 filter; needs FREESOUND_KEY in .env)
//   max:    seconds a clip is cut to
export const SLOTS = 7;

export const EVENTS = [
  { id: "meow", label: "Ginger meows", when: "a tap on Ginger, and when he turns up for a dish", max: 2.5,
    oga: ["cat meow", "meow", "kitten"], kenney: [], fs: "cat meow" },
  { id: "purr", label: "Ginger purrs", when: "he settles on the ankh", max: 4,
    oga: ["purr", "cat purr", "purring"], kenney: [], fs: "cat purr" },
  { id: "pounce", label: "Ginger bats a toy", when: "a pounce lands and the reagent skids away", max: 1.5,
    oga: ["pounce", "swipe", "thump"], kenney: ["impactSoft_", "impactPunch_", "chop"], fs: "cat pounce thump" },
  { id: "grab", label: "something is picked up", when: "a phone (or the mouse) grabs a reagent or a trinket", max: 1.5,
    oga: ["pickup", "pick up item", "grab"], kenney: ["cloth[1-4]", "handleSmallLeather", "pluck_"], fs: "pick up item" },
  { id: "drop", label: "something is dropped", when: "a reagent lands on the floor (not in the pack)", max: 1.5,
    oga: ["drop", "thud"], kenney: ["dropLeather", "bookPlace", "impactSoft_", "impactPlank_light"], fs: "drop item soft" },
  { id: "collect", label: "into the pack", when: "a reagent's centre lands in the backpack", max: 2,
    oga: ["collect", "coin", "pickup coin"], kenney: ["handleCoins", "metalClick", "confirmation_", "impactBell_light", "powerUp"], fs: "collect item" },
  { id: "bag-open", label: "the backpack opens", when: "a double-click / double-tap on the pack", max: 2,
    oga: ["bag open", "chest open", "zipper"], kenney: ["beltHandle", "clothBelt", "metalLatch", "open_"], fs: "bag open leather" },
  { id: "moongate", label: "the moongate takes someone", when: "the star burst on the gate", max: 3,
    oga: ["teleport", "portal", "warp"], kenney: ["phaseJump", "phaserUp", "forceField_"], fs: "teleport magic" },
  { id: "lightning", label: "lightning strikes", when: "each of the two bolts of the Lightning spell", max: 4,
    oga: ["thunder", "lightning"], kenney: ["explosionCrunch_", "lowFrequency_explosion", "impactMetal_heavy"], fs: "thunder crack" },
  { id: "arrow", label: "an arrow is loosed", when: "each Magic Arrow of a volley", max: 1.5,
    oga: ["arrow whoosh", "bow shot", "swish", "whoosh"], kenney: ["laserSmall_", "zap"], fs: "bow arrow shoot" },
  { id: "night", label: "night falls", when: "Night Sight: the stage goes dark", max: 5,
    oga: ["owl", "night", "wind"], kenney: ["lowDown", "lowThreeTone", "phaserDown", "minimize_"], fs: "owl hoot night" },
  { id: "food", label: "a dish appears", when: "Create Food: the dish pops onto the stage", max: 1.5,
    oga: ["pop", "ding"], kenney: ["pluck_", "bong_", "pepSound"], fs: "magic pop" },
  { id: "ankh", label: "the ankh awakens", when: "the white flash at the end of the ritual", max: 5,
    oga: ["bell", "gong", "chime", "choir"], kenney: ["impactBell_heavy", "bong_", "jingles_STEEL"], fs: "gong deep" },
  { id: "banner", label: "a level banner", when: "the pack is full, every spell is cast, a wave is over", max: 6,
    oga: ["fanfare", "jingle", "victory"], kenney: ["jingles_NES", "jingles_PIZZI", "jingles_SAX"], fs: "fanfare short win" },
  { id: "monster", label: "a monster comes through", when: "a skeleton or a ghoul steps out of the gate", max: 2.5,
    oga: ["skeleton", "zombie", "growl", "bones"], kenney: ["impactWood_", "dice", "impactMining_"], fs: "zombie growl" },
  { id: "slay", label: "a monster is slain", when: "an arrow, Teleport or the ultimate takes one", max: 2,
    oga: ["death", "bone", "crumble"], kenney: ["impactGlass_", "impactMining_", "explosionCrunch_"], fs: "bones crumble" },
  { id: "ghost", label: "a Seeker becomes a ghost", when: "a monster catches a cursor", max: 3,
    oga: ["ghost", "spooky"], kenney: ["lowRandom", "spaceTrash", "glitch_"], fs: "ghost moan" },
  { id: "fireball", label: "the daemon hurls a fireball", when: "each shot from wave 2 on", max: 2,
    oga: ["fireball", "fire whoosh"], kenney: ["thrusterFire_", "laserLarge_"], fs: "fireball whoosh" },
  { id: "bird", label: "a bird flies off", when: "a click or a tap sends one off the signpost; a theft", max: 2,
    oga: ["bird", "wings", "flap"], kenney: [], fs: "bird wings flap" },
  { id: "ult", label: "Ginger unleashed", when: "the feast ends and the three beams sweep", max: 4,
    oga: ["magic", "spell", "explosion magic"], kenney: ["explosionCrunch_", "lowFrequency_explosion", "powerUp"], fs: "magic explosion" },
  { id: "wisp", label: "a wisp is caught", when: "every moonglow pickup (short and soft)", max: 0.8,
    oga: ["sparkle", "twinkle", "chime"], kenney: ["tick_", "glass_", "rollover", "pepSound", "tone1"], fs: "sparkle twinkle short" },
];

export const KENNEY_PACKS = {
  "rpg-audio": "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
  "ui-audio": "https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip",
  "interface-sounds": "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
  "impact-sounds": "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
  "digital-audio": "https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney_digital-audio.zip",
  "music-jingles": "https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip",
  "sci-fi-sounds": "https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip",
  "casino-audio": "https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip",
};
