// Per-entity visual descriptors -> SDXL prompts. Each character evokes the
// OUTLOOK of its anime-homage source without copying name/likeness.

const STYLE =
  "single full-body anime game character, {V}, clean cel-shaded anime illustration, vibrant saturated colors, bold clean outline, centered, full body visible head to toe, isolated on a pure plain flat white background, empty background";
const NEG =
  "circle behind character, round backdrop, spotlight, glowing disc, halo behind, decorative background, banner, flag, emblem, crest, vignette, gradient backdrop, colored background disc, background scenery, landscape, environment, room interior, wall, sky, clouds, ground, floor, grass, sand, desert, throne, castle, architecture, building, pillars, arch, furniture, props, user interface, UI, hud, character sheet, menu, multiple panels, icons row, thumbnails, frame, border, grid lines, multiple characters, multiple views, split image, text, words, watermark, logo, signature, blurry, lowres, jpeg artifacts, cropped head, cut off, deformed hands, extra limbs, extra fingers, cast shadow";

export const NEGATIVE = NEG;

export function style(visual) {
  return STYLE.replace("{V}", visual);
}

// pose suffixes for animation frames
export const POSE = {
  idle: "relaxed confident standing idle pose",
  attack: "dynamic attacking action pose mid-strike, motion",
};

// ---- TOWERS (homage-inspired looks) ----
export const TOWER_VISUAL = {
  "yamo-desert-bandit":
    "a roguish young desert martial artist with short messy black hair and a scar on one cheek, tan and orange martial arts gi, fingerless gloves, cocky grin",
  "kazu-spirit-brawler":
    "a tall tough teenage delinquent brawler with a tall orange pompadour, dark blue school uniform, wielding a glowing blue spirit sword",
  "zoran-thricedraw":
    "a muscular green-haired swordsman wearing a green bandana and a green coat with a haramaki sash, a scar over his left eye, holding three katana (one gripped in his teeth)",
  "prince-vael":
    "a proud arrogant warrior prince with tall upswept flame-shaped black hair and a sharp widow's peak, blue and white battle armor with rounded shoulder guards, white gloves and boots, glowing battle aura",
  "karu-sunfist":
    "a cheerful spiky black-haired martial artist in an orange gi with a blue belt, energetic fighting stance, glowing golden ki around fists",
  "jugo-limitless":
    "a tall powerful sorcerer with fluffy white hair and a black blindfold over his eyes, a long black trench coat, calm smirk, swirling blue energy in one raised hand",
  "sota-caped-fist":
    "a completely bald caped superhero in a plain yellow jumpsuit with a white flowing cape, red gloves, red boots and a red belt, blank bored expression",
  "pip-powderkeg":
    "a small eager young apprentice witch girl with short brown hair, an oversized pointed dark witch hat, a short dark mage robe with a cape, holding a small wooden staff",
  "iron-bo-cannonarm":
    "a huge muscular cyborg with swept-back bright blue hair and dark sunglasses, large metal mechanical arms with a built-in arm cannon, open shirt",
  "kanae-petalfall":
    "a graceful female swordswoman with long dark hair, a pink and teal flower-patterned haori over a dark uniform, holding a katana, gentle smile",
  "akagan-ashen":
    "a stern grizzled military admiral with short grey hair and a scarred face, a dark crimson double-breasted military coat, fists wreathed in glowing magma and embers",
  "megu-explosion-sage":
    "a dramatic crimson mage girl with brown hair, a large pointed witch hat and an eyepatch over one eye, a dark cloak with red lining, raising an ornate glowing staff, explosion casting pose",
  "tobi-skipstone":
    "a young energetic ninja boy with spiky brown hair, a blue metal ninja headband and a long blue scarf, dark ninja outfit, throwing stance",
  "zeni-spark":
    "a frightened blond swordsman with bright yellow hair, an orange haori with a white triangle pattern over a black uniform, holding a katana crackling with golden lightning",
  "hyo-frost-arc":
    "a small cool-eyed young captain swordsman with spiky white hair, a black robe under a white captain's haori, holding a katana wreathed in icy mist",
  "kilo-lightning-hand":
    "an agile assassin boy with silver-white spiky hair, a blue and white shirt with baggy shorts, hands crackling with blue electricity, playful grin",
  "sasu-stormblade":
    "a brooding dark ninja swordsman with spiky blue-black hair, a high-collared dark coat with a purple rope belt, a katana on his back, glowing red eyes",
  "bram-thornling":
    "a calm nature shaman with mossy green-brown hair, bark and leaf armor, an earthy robe, holding a wooden staff sprouting thorns and vines",
  "kona-ember-fox":
    "a mischievous fox-spirit girl with orange hair, fox ears and several flaming fox tails, an orange and red kimono, whisker marks on her cheeks",
  "shion-venom-priestess":
    "a sinister priestess in a deep purple hooded robe, pale skin and glowing green eyes, dripping green venom from her clawed hands",
  "roan-flame-alchemist":
    "a confident military flame officer with short black hair, a dark blue military uniform, white ignition gloves, snapping fingers producing a fire spark",
  "morren-plaguebearer":
    "an eerie curse spirit with patchwork grey and blue stitched skin and hair, mismatched eyes, a ragged grey robe, an unsettling wide smile",
  "doro-mire-spirit":
    "a lumpy muddy swamp spirit with a green-brown body dripping mud, glowing yellow eyes, simple and grotesque",
  "shika-shadowbinder":
    "a lazy tactician ninja with black hair tied up in a spiky pineapple-shaped ponytail, a green flak vest over a dark ninja outfit, bored half-lidded expression",
  "glace-ice-maker":
    "a cool casual ice mage with dark spiky hair, shirtless with a silver cross necklace, frost and ice forming over one hand",
  "yuki-frostward-maiden":
    "an icy general queen with long pale blue hair, an elegant white and blue military general's coat, creating jagged ice, cold confident smile",
  "garan-sandshackle":
    "a quiet sand wielder with spiky deep-red hair, a large sand gourd strapped to his back, a tan and crimson robe, dark rings around his teal eyes",
  "mochi-morale-sprite":
    "a tiny adorable round chibi mascot spirit, pastel pink, huge sparkly eyes and little fairy wings, cheerful",
  "lyra-tempo":
    "an elegant skeletal gentleman musician with a big dark afro and a top hat, a fancy tailcoat suit, holding a violin and bow",
  "orin-celestial-herald":
    "a kind gentle healer girl with long orange hair and blue flower hairpins, a blue and white outfit, conjuring a glowing golden hexagonal shield barrier",
  "aldric-banner-bearer":
    "a heroic blond military commander with combed-back hair, a tan military coat with a green cape, holding a war banner aloft, determined expression",
  "senna-slug-sannin":
    "a powerful female healer warrior with blonde hair in low twin ponytails and a blue diamond mark on her forehead, a green haori over a grey outfit, confident",
  // batch C — ranged & arcane towers (bow/crossbow/gun/thrown/tome/scepter/wand/orb)
  "aya-dawnshot":
    "a determined young archer princess with long bright red hair tied back, a red-and-cream traveller's tunic and half-cloak, a worn quiver, drawing a slender hunting bow",
  "lyran-ricochet":
    "a poised green-cloaked elf marksman with pointed ears and long pale hair, light leather armor, a hooded green ranger cloak, loosing an arrow from an elegant longbow",
  "seren-skyfall":
    "a weathered nomad archer-hero with tan skin and a headscarf, an open travel vest and arm-wraps, drawing a massive ornate war-bow aimed at the sky, glowing arrow",
  "dren-heavybolt":
    "a stern taciturn monster-hunter with short dark hair and a scarred jaw, a heavy hunter's longcoat and steel bracers, bracing a bulky steel-limbed crossbow",
  "vesska-venombolt":
    "a hooded female assassin with sharp eyes, a dark wrapped assassin's outfit with green toxin vials at the belt, aiming a slim repeating crossbow dripping green venom",
  "vance-the-drifter":
    "a lanky wandering gunslinger standing tall with spiky blond hair and round orange sunglasses, a long red trench coat over a grey bodysuit, holding a long silver revolver at his side, calm easy grin, full body",
  "yael-boomshot":
    "a confident red-orange long-ponytailed sharpshooter girl standing tall, a flame-print top with a slung ammo bandolier and short shorts, holding a large grenade launcher over one shoulder, full body",
  "rivka-rebound":
    "a humming markswoman with long wavy hair and round spectacles, a long military greatcoat, raising a slender ornate long-rifle, faint glowing curved bullet trails",
  "tella-wirefang":
    "an agile weapons-mistress with twin hair buns and bandaged forearms, a sleeveless qipao-style top, throwing a glittering fan of kunai and weighted bola-wire",
  "mortise-inkhex":
    "a pale gaunt scrivener-mage with dark circles, an ink-stained black scholar's robe, a quill behind one ear, a floating open black grimoire leaking sickly green ink",
  "verena-quillbane":
    "a stern female court archivist with hair in a tight bun, a high-collared violet academic robe with gold trim, holding an enchanted tome and a glowing quill",
  "auriel-wardlight":
    "a radiant regal queen-cleric with flowing golden hair and a winged circlet, a white-and-gold royal gown, raising a tall jewelled scepter pouring warm light",
  "sael-arcrod":
    "a wind-swept storm-priest with short tousled hair, a storm-grey robe with crackling blue trim, raising a copper scepter capped by a sparking blue crystal",
  "pim-sparklet":
    "a tiny over-eager apprentice witch girl in an oversized starry mage-robe and a too-big pointed hat, waving a stubby crystal-tipped wand spitting little sparks",
  "aldous-boltcaster":
    "a precise composed battle-mage with neat hair and a focusing monocle, a deep-blue mage coat covered in silver sigils, leveling a long rune-etched wand firing arcane darts",
  "aquella-the-radiant":
    "a dazzling water-goddess with long blue hair and a water-ring halo, a blue-and-white goddess dress with detached sleeves, a glowing scrying orb floating at her hand",
  // tanker — front-line bulwarks (homage-inspired, original designs)
  "riku-ironhide":
    "a big-hearted rugged young guardsman with spiky crimson-red hair, a red-trimmed leather guard's harness over jagged hardened iron-grey skin, fists hardened like rough iron, a manly confident grin, bracing stance",
  "garrek-ironscale":
    "a surly muscular drifter brawler with a wild black mane and a riveted studded brow, a dark studded long coat over metallic iron-scaled skin, one club-like dragon-iron forearm held close to the body, scowling, arms kept tucked in",
  "joro-diamondhide":
    "a towering broad-shouldered commander whose body is faceted like cut crystal diamond glinting with hard light, a heavy officer's coat over diamond-hard skin, massive crushing fists, stern",
  "reinhart-armored-wall":
    "a grim heavy soldier clad head to toe in interlocking bone-white armor plating over every limb, weathered battle-scarred plates, plated fists, stoic dutiful stance",
  "garron-unbreaking-pillar":
    "a towering muscular heroic guardian with a broad frame, golden swept-back hair in two upswept spikes, a blue and gold heroic battle suit, an unshakeable bright grin, a single bare fist raised, arms kept compact and close to the torso",
};

// ---- HERO weapon-variant looks (outlook changes with equipped weapon) ----
export const HERO_BASE =
  "a noble RPG knight hero with short brown hair, polished steel plate armor with gold trim, a blue tabard, standing heroic pose";
export const HERO_WEAPON = {
  sword:
    "prominently holding a large steel broadsword in one hand and a round kite shield in the other",
  bow: "prominently holding a large wooden longbow drawn with an arrow, a quiver on the back",
  staff: "prominently holding a tall glowing magic wizard staff with a crystal top",
  gun: "prominently holding a large ornate steampunk hand cannon firearm",
  fist: "no weapon, bare armored fists raised in a boxing stance, gauntlets glowing with energy",
};

// ---- BATTLE HERO weapon-class art (the in-battle hero, one archetype per
// WeaponType). Each is generated in two poses sharing one seed (stance + attack)
// so the strike reads as the same character. No worn gear — the weapon is baked in;
// only wings overlay at runtime. Keys: herobattle__<wt> / herobattle__<wt>__attack.
//
// These use their OWN richer style (heroBattleStyle below): a semi-realistic
// high-detail anime KEY-VISUAL / splash-art look with dramatic cinematic lighting,
// painterly shading and intricate gear detail — beauty above the flat cel-shaded
// chrome the rest of the roster uses, because the hero is the on-screen star.
export const HERO_BATTLE = {
  sword:
    "a heroic armored knight champion with short tousled brown hair and a determined gaze, clad in gleaming ornately-engraved silver plate armour with gold filigree trim and a tattered flowing royal-blue cape, raising a massive broadsword glowing with radiant blue light along the fuller, a battered round kite shield bearing a golden crest, faint embers and dust motes drifting in the air",
  bow: "a swift elven ranger hero with sharp focused eyes, a deep-green fur-trimmed hooded cloak over layered weathered leather armour, a quiver of fletched arrows across the back, drawing a tall ornately-carved longbow to full draw with a crackling arrow of golden light nocked, wind-blown cloak and hair",
  staff:
    "a venerable archmage hero with a long flowing silver beard and wise eyes, in deep-blue star-embroidered robes with intricate runic trim and a wide pointed wizard hat, raising a gnarled ancient wooden staff crowned by a brilliant floating arcane crystal shedding magical light, glowing sigils swirling around him",
  gun: "a dashing steampunk gunslinger hero with a confident smirk, in a long weathered brown leather coat with brass goggles on a worn hat brim and riveted bronze-and-leather armour plating, brandishing a large ornately-engraved hand cannon belching muzzle-flash sparks and curling smoke",
  tome: "an arcane warlock hero with luminous glowing eyes, in a high-collared dark-violet coat embroidered with shimmering golden runes, a heavy floating open spellbook orbited by radiant purple glyphs and crackling violet lightning, one gloved hand raised channelling swirling dark-magic energy",
  fist: "a fierce martial-arts monk hero with a bare muscular sculpted torso, a crimson sash and tightly-bound hand wraps and prayer beads, brilliant golden chi energy blazing around both clenched fists, hair whipped by the energy, a dynamic powerful kung-fu stance",
  any: "a seasoned versatile adventurer hero with short brown hair and a confident set jaw, in finely-detailed leather-and-steel travel armour with a worn blue tabard and a slung pack, holding a sturdy gleaming steel arming sword in a ready guard, dramatic rim light",
};

// Battle-hero-only style: a semi-realistic anime KEY-VISUAL / splash-art render —
// dramatic cinematic rim lighting, volumetric glow, painterly shading with crisp
// edges, intricate detail. Deliberately richer than the global cel-shaded STYLE so
// the in-battle hero reads as the polished star of the screen. Background stays a
// flat plain white so the cutout step trims cleanly.
const HERO_BATTLE_STYLE =
  "single full-body anime key-visual splash art of {V}, {P}, highly detailed semi-realistic rendering, intricate ornate detail, dramatic cinematic rim lighting with volumetric glow and god rays, rich painterly shading with crisp clean edges, vibrant saturated color, beautiful, masterpiece, full body visible head to toe, centered, isolated on a pure plain flat white background, empty background";
export const HERO_BATTLE_NEGATIVE =
  NEG +
  ", flat shading, dull washed-out colors, plain, simplistic, low detail, sketch, lineart only, unfinished, chibi, photo, photorealistic, 3d render";

/** Build the battle-hero prompt for a weapon descriptor + a POSE phrase. */
export function heroBattleStyle(visual, pose) {
  return HERO_BATTLE_STYLE.replace("{V}", visual).replace("{P}", pose);
}

// ---- BATTLE-HERO WORN WINGS ----
// Dedicated back-view wing art for the in-battle hero — one unique pair per wing
// item, rendered in TWO flap frames sharing a seed (glide vs raised up-stroke) so
// HeroWeaponSprite can crossfade a real wing-beat. Keys: herowing__<id> /
// herowing__<id>__up. Same semi-realistic key-visual polish as the battle hero,
// but a WINGS-ONLY subject (no wearer) so the cutout is a clean transparent pair.
export const HERO_WING = {
  "fledgling-wings":
    "small delicate snow-white feathered angel wings with soft downy plumage and a faint pale-gold halo glow",
  "tempest-wings":
    "large translucent storm-energy wings of glowing electric-blue feathers crackling with arcs of lightning and shedding sparks of wind",
  "worn-skywings":
    "broad weathered slate-grey feathered wings with frayed battle-worn tips and a faint dull sky-blue edge light",
  "fine-skywings":
    "broad clean slate-and-white feathered wings neatly preened and rimmed with soft sky-blue light",
  "masterwork-skywings":
    "broad pristine steel-white feathered wings with silver-tipped flight pinions and bright sky-blue rim light",
  "heroic-skywings":
    "radiant white feathered wings shot through with glowing blue energy feathers and a luminous sky-blue aura",
  "mythic-skywings":
    "luminous celestial white-and-blue wings blazing with a brilliant blue-white aura and drifting motes of light",
  "valkyrie-pinions":
    "broad regal white-feathered valkyrie wings tipped with gleaming polished golden flight-pinions and warm golden rim light",
  "phoenix-pinions":
    "blazing phoenix wings of flame-feathers burning from deep orange through bright gold, trailing soft glowing embers",
};

// Two beats of the flap, same seed → same wings in two poses.
export const WING_POSE = {
  spread: "the wings spread wide and sweeping gently downward in a relaxed glide",
  raised: "the wings swept upward and high at the peak of a powerful wing-beat",
};

const HERO_WING_STYLE =
  "a single matched symmetric pair of {V}, {P}, seen from behind as if worn on a hero's back, both wings fully visible and centered, highly detailed semi-realistic painterly rendering with crisp clean edges, dramatic rim lighting and soft volumetric glow, vibrant saturated color, beautiful, masterpiece, no character, no body, no person, no head, no wearer, just the pair of wings, isolated on a pure plain flat white background, empty background";
export const HERO_WING_NEGATIVE =
  NEG +
  ", person, human, body, torso, character, head, face, hair, arms, legs, wearer, mannequin, armor, clothing, single wing, one wing, asymmetric wings, flat shading, dull washed-out colors, low detail, chibi, sketch, photo, photorealistic, 3d render";

/** Build a battle-wing prompt for a wing descriptor + a WING_POSE phrase. */
export function heroWingStyle(visual, pose) {
  return HERO_WING_STYLE.replace("{V}", visual).replace("{P}", pose);
}

// ---- ENEMIES ----
export const ENEMY_VISUAL = {
  grunt:
    "a menacing undead husk soldier with grey rotting skin, tattered armor and a rusty sword, glowing red eyes",
  runner:
    "a small fast feral ghoul, hunched, with long claws and tattered rags, glowing yellow eyes",
  brute: "a huge brutish armored ogre with green-grey skin, tusks and spiked shoulder armor",
  bulwark:
    "an armored undead shieldbearer in heavy plate carrying an enormous tower shield, glowing visor",
  mender:
    "a sickly pale hooded acolyte in a grey robe holding a staff with a glowing green healing orb",
  regenerator:
    "a hulking mossy troll with green regenerating skin covered in moss and vines, hunched",
  slime: "a glossy green gelatinous slime monster with two big eyes, dripping",
  slimelet: "a tiny cute-but-gross green slime blob with two eyes",
  gargoyle:
    "a winged stone gargoyle with grey cracked rock skin, bat wings, horns and glowing red eyes, snarling",
  stormflyer: "a fierce flying storm drake with blue scales and crackling lightning wings",
  sapper:
    "a stocky grinning goblin demolisher carrying a lit round bomb, wrapped in leather straps",
  phantom:
    "a translucent pale blue ghostly stalker with hollow glowing eyes and a wispy lower body",
  summoner:
    "a skeletal necromancer with a bone skull, a dark purple robe and a glowing purple staff",
  imp: "a small red devil imp with horns, bat wings and a pitchfork, yellow eyes, mischievous",
  raider:
    "a hulking scarred berserker raider with war paint, fur armor and a huge battle axe, roaring",
  courier: "a sneaky small goblin coin-runner carrying a heavy bulging money bag, shifty eyes",
  golem:
    "a massive lumbering iron golem built of riveted dark metal plates, a glowing orange furnace core in its chest, huge heavy fists, blank slit eyes",
  monolith:
    "a towering walking stone monolith with a cracked grey granite body carved with glowing blue runes, stubby stone limbs, a single glowing rune-eye",
  herald:
    "an undead skeletal standard-bearer in tattered armor holding aloft a ragged glowing war banner, rallying pose, eerie green light",
  hexer:
    "a sinister hooded grave-witch hexbinder in a dark tattered shroud, pale bony clawed hands weaving glowing purple hex sigils, hollow glowing eyes",
  reaver:
    "a frenzied bloodmad berserker reaver in spiked dark armor streaked with blood-red war paint, wielding twin jagged cleavers, hunched in an aggressive charging lunge, glowing red eyes",
  prism:
    "a massive crystalline behemoth golem with a faceted translucent prism body refracting shifting blue and red light, heavy crystal limbs, slow and immense, a glowing core",
  carrier:
    "a bloated rotting plague-carrier monster, a swollen sickly green sac of spores straining to burst, oozing pustules, stubby limbs, dripping toxic ichor",
  dreadwing:
    "an armored iron-plated winged drake gunship, riveted dark metal battle-plating over heavy bomber wings, menacing glowing slit eyes, bristling with rivets and spikes",
  cantor:
    "a robed skeletal cantor priest wailing a dirge, mouth agape, tattered grey grave vestments, raised bony hands radiating a ghostly translucent sonic aura, hollow glowing eyes",
};
export const BOSS_VISUAL = {
  champion:
    "an imposing armored boss knight in ornate silver plate armor with gold trim, a flowing cape and a huge greatsword, glowing red eyes, intimidating",
  warden:
    "a massive fortress warden boss in heavy dark steel armor carrying a giant battle axe and a tower shield, glowing blue visor",
  overlord:
    "a towering dark sorcerer-lord boss with a purple skull-like face, ornate black and purple robes with a high collar and cape, a dark crown and floating dark magic orbs",
  // The Antihero Gallery — name-free, visually recognizable anti-hero homages.
  gravemourn:
    "a towering grim swordsman boss in dark steel-grey battle armor with a single scarred eye and a battle-worn iron prosthetic forearm, hefting a colossal slab-like greatsword as tall as himself, a tattered blood-red cloak, heavy low battle stance, clear full-body silhouette, bright rim light, high contrast, epic",
  vindicator:
    "a hardened militant vigilante boss in matte-black tactical armor blazoned with a stark glowing white skull emblem across the chest, crossed ammunition belts, leveling two heavy smoking firearms, muzzle-flash glow, cold merciless stare, gritty dramatic rim light, high contrast, epic",
  sundermark:
    "a wandering scarred warrior-assassin boss with a large X-shaped facial scar, dark dreadlocks and small round dark glasses, one forearm blazing with glowing crimson destruction runes crackling with red energy, weathered grey traveler's robes flaring, dramatic rim light, high contrast, epic",
  crownfall:
    "a proud armored warrior-prince boss with sharp upswept flame-shaped black hair, royal blue battle armor over a white bodysuit with white gloves and boots, a blazing golden ki aura erupting around him with electric sparks, arrogant battle scowl, dramatic rim light, high contrast, epic",
  unkilling:
    "a feral muscular berserker boss with wild dark hair drawn into two sharp points and thick sideburns, a yellow and blue armored bodysuit, three gleaming metal claws extended from each fist glinting, savage crouched lunge, sparks along the claws, dramatic rim light, high contrast, epic",
  mawborn:
    "a hulking glistening pitch-black symbiote monster boss with a huge fanged maw and bulging white eyes, long writhing tendrils and a massive lashing tongue, dripping silvery alien ooze, menacing hunched lunge, eerie rim light, high contrast, epic",
  devourer:
    "a colossal skinless titan boss of exposed steaming red musculature wreathed in rising steam, long dark hair framing a gaunt determined glowing-eyed face, towering unstoppable stride, dramatic rim light, epic scale, high contrast",
  crimsonlord:
    "a lean aristocratic vampire gunslinger boss in a vivid bright crimson-red long coat and matching wide-brimmed red hat, pale white skin, neat black hair, round amber glasses, leveling a long silver pistol, confident grin, clear full-body silhouette, bright rim light, high contrast, epic",
  fallenward:
    "a dread armored dark warlord boss in a flowing black cape and full glossy obsidian plate armor, an intimidating skull-like breathing-mask helmet, gripping a humming crimson energy blade casting a red glow, looming menace, dramatic rim light, high contrast, epic",
  ashghost:
    "a vengeful pale ash-skinned warrior boss with a bold red tattoo sweeping across one eye and a short dark beard, a scarred muscular body, twin chained blades wreathed in roaring fire whirling at his sides, flying embers, cold fury, dramatic rim light, epic scale, high contrast",
};

// ---- STRUCTURES (battle-world buildings: the player's castle) ----
export const STRUCTURE_VISUAL = {
  castle:
    "a heroic fantasy stronghold keep, a tall central tower flanked by two smaller turrets, crenellated stone battlements, a grand arched gate, blue conical rooftops, proud blue-and-gold banners, a glowing magical core orb above the gate, three-quarter front view, grounded at the base",
};
// state suffix appended to the base look so both share silhouette/identity
export const STRUCTURE_STATE = {
  intact:
    "pristine and proud, banners flying high, warm glowing windows, the magical core shining bright",
  damaged:
    "battle-damaged and besieged, cracked crumbling walls, fallen rubble, torn and burning banners, rising smoke and embers, the magical core dim and flickering",
};
// A structure is a BUILDING, not a character — its own style + negative (the
// character STYLE/NEG deliberately ban "castle/building/architecture").
const STRUCTURE_STYLE =
  "a single fantasy building game asset, {V}, clean cel-shaded anime illustration, vibrant saturated colors, bold clean outline, centered, the whole structure visible, isolated on a pure plain flat white background, empty background";
const STRUCTURE_NEG =
  "character, person, people, hero, knight, soldier, warrior, anime girl, anime boy, face, portrait, multiple buildings, town, city skyline, landscape panorama, background scenery, sky, clouds, ground texture, grass field, road, user interface, UI, hud, frame, border, text, words, watermark, logo, signature, blurry, lowres, jpeg artifacts, cropped, cut off, deformed, cast shadow";
export const STRUCTURE_NEGATIVE = STRUCTURE_NEG;
/** Building prompt from base look + state suffix. */
export function structureStyle(visual, state) {
  return STRUCTURE_STYLE.replace("{V}", `${visual}, ${state}`);
}

// ---- ROLE BADGE EMBLEMS (the small upper-right tower-role icon) ----
// Flat UI glyphs (not creatures), so they get their own style + negative — the
// character STYLE/NEGATIVE ban "icon/symbol/flat" and demand a full-body figure.
// One emblem per TowerRole; tinted to the role color at render time.
export const ROLE_VISUAL = {
  damage:
    "one bold targeting crosshair scope reticle, a thick ring crossed by four short tick marks with a small solid center dot, sky-blue",
  splash:
    "one bold spiky explosion burst, a solid star-shaped blast with sharp radiating shards, coral orange",
  chain: "one bold forked lightning bolt splitting into two jagged zigzag prongs, violet purple",
  dot: "one bold venom poison droplet teardrop with a tiny rising bubble and a small drip below, toxic green",
  support: "one bold thick solid upward pointing arrow rising, warm gold",
  debuff: "one bold thick solid downward pointing arrow falling, teal cyan",
  tanker: "one bold sturdy knight heater shield with a small round center boss stud, steel grey",
};
const ROLEICON_STYLE =
  "a single bold flat vector game UI emblem icon of {V}, ONE simple solid shape, very thick uniform clean outline, high contrast, flat cel-shaded, centered, no fine interior detail, instantly readable at 16 pixels, isolated on a pure plain flat white background, empty background, no text";
const ROLEICON_NEG =
  "character, person, creature, hero, knight figure, full body, anime girl, realistic, 3d render, photo, complex scene, landscape, multiple objects, busy, gradient background, drop shadow, watermark, text, letters, signature, frame, border";
export const ROLEICON_NEGATIVE = ROLEICON_NEG;
/** Flat role-emblem prompt from a visual description. */
export function roleIconStyle(visual) {
  return ROLEICON_STYLE.replace("{V}", visual);
}

// ---- ACHIEVEMENT MEDALLIONS (the per-achievement board badge) ----
// One ornate trophy-medallion per achievement id (must mirror ACHIEVEMENTS in
// src/data/achievements.ts — guarded by tests/achievementIconPrompts.test.ts).
// Tier metal (bronze → silver → gold) signals prestige; baked full-colour so the
// renderer does NOT tint (unlike role icons). Keyed by achievement id.
export const ACHIEVEMENT_VISUAL = {
  // Campaign
  "clear-stage-3":
    "a bronze medal embossed with a single blood-dripping dagger crossing a small round shield, crimson accents",
  "clear-stage-10":
    "a silver medal embossed with a closed ornate tome bound by a ribbon clasp, sky-blue accents",
  "clear-stage-20":
    "a fiery gold medal embossed with a volcanic stone gateway spewing rising embers, orange and red accents",
  "win-nightmare":
    "a dark obsidian medal embossed with a horned demon skull, ominous violet-purple accents",
  // Hero
  "hero-level-10":
    "a bronze medal embossed with a single upward chevron rank stripe above a small star, warm bronze accents",
  "hero-level-25":
    "a silver medal embossed with triple stacked upward chevron rank stripes above a star, steel-blue accents",
  "hero-level-50":
    "a radiant gold medal embossed with a brilliant five-pointed star bursting with light rays, golden accents",
  // Combat
  "kills-1000":
    "a bronze medal embossed with a single notched battle axe head, dull blood-red accents",
  "kills-10000":
    "a silver medal embossed with a cresting ocean wave breaking over a row of tiny skulls, teal accents",
  "kills-100000":
    "a gold medal embossed with a blazing meteor streaking over a small skull, fiery orange accents",
  "endless-wave-10":
    "a bronze medal embossed with a round buckler shield bearing a single upright flame, amber accents",
  "endless-wave-25":
    "a silver medal embossed with a broken sword planted point-down in the ground, grey-blue accents",
  "endless-wave-50":
    "a gold medal embossed with an unbroken stone pillar crowned by a faceted diamond, cyan accents",
  // Collection
  "own-10-towers":
    "a bronze medal embossed with three small raised banner flags in a row, green accents",
  "own-25-towers":
    "a silver medal embossed with a horned war helm over two crossed banners, crimson accents",
  "codex-50": "a silver medal embossed with a half-open glowing spellbook, indigo accents",
  "codex-100":
    "a gold medal embossed with a fully open radiant spellbook marked with a check, violet accents",
  // Engineering
  "place-50-towers":
    "a bronze medal embossed with a mason's trowel laid over a single brick, earthy brown accents",
  "place-500-towers":
    "a silver medal embossed with a crossed builder's hammer and gear cog, slate-grey accents",
  "place-5000-towers":
    "a gold medal embossed with a drafting compass over a rolled tower blueprint, gold and blue accents",
};
const ACHIEVEMENT_STYLE =
  "a single ornate cel-shaded anime game trophy medallion award icon, {V}, sculpted metallic relief with real depth, glossy highlights and soft rim light, clean cel-shaded anime game asset, bold clean outline, centered, isolated on a plain solid light grey background, no shadow, no text, no numbers";
const ACHIEVEMENT_NEG =
  "flat sticker, flat clipart, flat vector icon, 2d sticker, ribbon tab, lanyard, character, person, creature, hero, knight figure, full body, anime girl, realistic, photo, complex scene, landscape, multiple medals, multiple objects, busy, gradient background, drop shadow, watermark, text, letters, numbers, signature, frame, border";
export const ACHIEVEMENT_NEGATIVE = ACHIEVEMENT_NEG;
/** Trophy-medallion prompt from a visual description. */
export function achievementIconStyle(visual) {
  return ACHIEVEMENT_STYLE.replace("{V}", visual);
}

// ---- BATTLE CTA EMBLEM (home-screen hero call-to-action) ----
// One bold combat sigil rendered on the BATTLE button. Full-colour, NOT tinted.
export const BATTLE_EMBLEM_VISUAL =
  "two crossed steel longswords over a small round war shield, a single upright orange flame rising behind the blades";
const BATTLE_EMBLEM_STYLE =
  "a single bold flat vector game UI emblem icon of {V}, ONE compact heraldic crest, very thick uniform clean gold outline, fiery crimson and ember orange with steel accents, high contrast, flat cel-shaded, centered, instantly readable at 24 pixels, isolated on a pure plain flat white background, empty background, no text";
const BATTLE_EMBLEM_NEG =
  "character, person, creature, hero, knight figure, full body, anime girl, realistic, 3d render, photo, complex scene, landscape, multiple objects, busy, gradient background, drop shadow, watermark, text, letters, signature, frame, border";
export const BATTLE_EMBLEM_NEGATIVE = BATTLE_EMBLEM_NEG;
/** Combat-emblem prompt from a visual description. */
export function battleEmblemStyle(visual) {
  return BATTLE_EMBLEM_STYLE.replace("{V}", visual);
}

// ---- RARITY GEM EMBLEMS (expedition slot-requirement icons) ----
// One faceted gemstone per rarity tier, tinted to its hue (Common grey →
// Unique red). Full-colour baked; the renderer draws it untinted with a
// procedural faceted-gem fallback. Keys mirror RARITIES in schemaEnums.ts.
export const RARITY_GEM_VISUAL = {
  Common: "a plain polished grey quartz gemstone, simple faceted cut, muted silver-grey",
  Magic: "a brilliant sapphire-blue faceted gemstone, glowing azure core",
  Rare: "a radiant amethyst-purple faceted gemstone, violet inner glow",
  Legendary: "a blazing amber-orange faceted gemstone, fiery golden glow",
  Unique: "a molten ruby-red faceted gemstone, intense crimson radiance",
};
const RARITY_GEM_STYLE =
  "a single bold flat vector game UI emblem icon of {V}, ONE centered faceted gemstone, very thick uniform clean dark outline, flat cel shading, vivid saturated colors, crisp highlights, high contrast, instantly readable at 16 pixels, isolated on a pure plain flat white background, empty background, no text";
const RARITY_GEM_NEG =
  "text, words, letters, numbers, ring, jewelry setting, hand, finger, character, person, creature, realistic, 3d render, photo, complex scene, landscape, multiple gems, multiple objects, busy, gradient background, drop shadow, watermark, signature, frame, border";
export const RARITY_GEM_NEGATIVE = RARITY_GEM_NEG;
/** Faceted rarity-gem prompt from a visual description. */
export function rarityGemStyle(visual) {
  return RARITY_GEM_STYLE.replace("{V}", visual);
}

// ---- ITEMS (icon style) ----
const ITEM_STYLE =
  "a single game item icon, {V}, clean cel-shaded anime game asset, centered, isolated on a plain solid light grey background, no shadow, soft rim light";
export function itemStyle(v) {
  return ITEM_STYLE.replace("{V}", v);
}

// Rarity reads as a separable rim-glow layer (NOT a body re-tint) so the same
// item line stays recognizable across tiers — matches RARITY_PALETTE in artSpec.
const RARITY_RIM = {
  Common: "no glow, clean flat lighting",
  Magic: "a thin cobalt-blue rim glow",
  Rare: "a royal-purple rim glow with faint sparkles",
  Legendary: "a glowing molten-gold outline with ember motes",
  Unique: "a radiant crimson aura",
};
/** Item icon prompt from catalog metadata: the curated `look` + rarity rim. */
export function itemStyleFor(look, rarity) {
  return ITEM_STYLE.replace("{V}", `${look}, ${RARITY_RIM[rarity] || RARITY_RIM.Common}`);
}

// ---- WORN-ON-BODY OVERLAYS (the hero "dressed" paper-doll) ----
// Purpose-framed worn art per gear item: the piece ALONE, front-facing, no
// character/body/hands, so it composites cleanly onto the neutral hero
// mannequin at a body-region anchor (NOT a 3/4 inventory icon shot). Reuses each
// item's curated `look`; only the framing differs per slot. The dress presenter
// resolves worn__<id> with the item-icon as a graceful fallback (exists-gated),
// so a partial batch ships safely. Accessories (Amulet/Ring/Pet) are excluded —
// they don't read as worn on a body.
export const WORN_FRAMING = {
  Weapon:
    "shown alone as a single weapon prop with no wielder, upright and centered, full length filling the frame, crisp three-quarter front view",
  Helmet:
    "shown alone as a single empty headgear piece with no head or face inside, front view, centered, hollow",
  BodyArmor:
    "shown alone as a single empty chest armor torso garment with no wearer, front view, centered, flat-laid",
  Gloves:
    "shown alone as a matching pair of empty hand armor with no hands inside, front view, side by side, centered",
  Boots:
    "shown alone as a matching pair of empty footwear with no feet inside, front view, side by side, centered",
  Pants:
    "shown alone as a single empty pair of leg armor / armored trousers with no legs inside, waist at top and open cuffs at the bottom, front view, centered, flat-laid",
  Wing: "shown alone as a symmetric pair of wings fully spread, front view, centered, no wearer",
};
// Single-limb framing for slots whose worn art splits L/R on the procedural rig
// (one boot / one gauntlet, mirrored onto each foot/hand bone).
export const WORN_FRAMING_SINGLE = {
  Gloves:
    "shown alone as a SINGLE empty gauntlet for one hand only, no pair, no hand inside, three-quarter front view, centered, hollow",
  Boots:
    "shown alone as a SINGLE empty boot for one foot only, no pair, no foot inside, three-quarter front view, centered, hollow",
};
const WORN_STYLE =
  "a single game equipment piece worn-gear display, {V}, no character, no person, no body, no hands, no face, clean cel-shaded anime game asset, bold clean outline, centered, isolated on a plain solid light grey background, no shadow, soft rim light";
const WORN_NEG =
  "character, person, human, hero, knight, anime girl, anime boy, body, torso skin, head, face, neck, hands, fingers, arms, legs, feet, mannequin, dress form, full figure, portrait, wearing, model, multiple items, item grid, inventory panel, thumbnails, frame, border, text, words, numbers, watermark, signature, drop shadow, cast shadow, gradient background, busy background, scenery, blurry, lowres, jpeg artifacts";
export const WORN_NEGATIVE = WORN_NEG;
/** Worn-overlay prompt from catalog metadata: the curated `look` + slot framing + rarity rim.
 *  `single` selects the single-limb framing (one boot/gauntlet) for the per-limb rig. */
export function wornStyleFor(look, slot, rarity, single = false) {
  const framing =
    (single && WORN_FRAMING_SINGLE[slot]) ||
    WORN_FRAMING[slot] ||
    "shown alone, front view, centered";
  const rim = RARITY_RIM[rarity] || RARITY_RIM.Common;
  return WORN_STYLE.replace("{V}", `${look}, ${framing}, ${rim}`);
}

// ---- SKILLS (ability-emblem icon style) ----
// A skill icon is the EMBLEM of its cast effect — a glowing magical sigil/burst,
// no character, no weapon-holder. The `look` comes straight from each skill's VFX
// `appearance` metadata so the icon matches the in-battle signature.
const SKILL_STYLE =
  "a single magical ability skill emblem icon, a glowing energy sigil depicting {V}, dramatic radiant glow, swirling magical energy, no character, no person, clean cel-shaded anime game asset, bold centered emblem, isolated on a plain solid dark slate background, intense bloom";
/** Skill ability-icon prompt from VFX metadata: the effect `look` + rarity rim. */
export function skillStyleFor(look, rarity) {
  return SKILL_STYLE.replace("{V}", `${look}, ${RARITY_RIM[rarity] || RARITY_RIM.Common}`);
}
export const ITEM_VISUAL = {
  "iron-sword": "a simple straight iron longsword",
  "elven-bow": "an elegant curved green and gold elven longbow",
  "arcane-staff": "an ornate wooden magic staff topped with a glowing purple crystal",
  "thunder-cannon": "a heavy bronze steampunk hand cannon crackling with blue lightning",
  "leather-cap": "a simple brown leather cap helmet",
  "iron-helm": "a polished steel knight's helmet",
  "cloth-robe": "a simple grey-blue cloth robe garment",
  "scale-mail": "a steel scale-mail chest armor",
  "worn-gloves": "a pair of worn brown leather gloves",
  "assassin-gloves": "a pair of dark assassin gloves with hidden blades",
  "worn-boots": "a pair of worn brown leather boots",
  "swift-boots": "a pair of enchanted green boots with small white wings",
  "mana-pendant": "a silver amulet with a glowing blue mana gem",
  "copper-ring": "a simple copper ring",
  "resonance-ring": "a silver ring set with a glowing purple gem",
  "coin-sprite": "a cute glowing golden coin spirit with tiny wings",
  "fortune-fox": "an adorable orange fox spirit pet holding a gold coin",
  "fledgling-wings": "a pair of small white feathered angel wings",
  "tempest-wings": "a pair of glowing blue storm-energy wings",
};
