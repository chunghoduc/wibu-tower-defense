// Per-entity visual descriptors -> SDXL prompts. Each character evokes the
// OUTLOOK of its anime-homage source without copying name/likeness.

const STYLE = "single full-body anime game character, {V}, clean cel-shaded anime illustration, vibrant saturated colors, bold clean outline, centered, full body visible head to toe, isolated on a pure plain flat white background, empty background";
const NEG = "circle behind character, round backdrop, spotlight, glowing disc, halo behind, decorative background, banner, flag, emblem, crest, vignette, gradient backdrop, colored background disc, background scenery, landscape, environment, room interior, wall, sky, clouds, ground, floor, grass, sand, desert, throne, castle, architecture, building, pillars, arch, furniture, props, user interface, UI, hud, character sheet, menu, multiple panels, icons row, thumbnails, frame, border, grid lines, multiple characters, multiple views, split image, text, words, watermark, logo, signature, blurry, lowres, jpeg artifacts, cropped head, cut off, deformed hands, extra limbs, extra fingers, cast shadow";

export const NEGATIVE = NEG;

export function style(visual) { return STYLE.replace("{V}", visual); }

// pose suffixes for animation frames
export const POSE = {
  idle: "relaxed confident standing idle pose",
  attack: "dynamic attacking action pose mid-strike, motion",
};

// ---- TOWERS (homage-inspired looks) ----
export const TOWER_VISUAL = {
  "yamo-desert-bandit": "a roguish young desert martial artist with short messy black hair and a scar on one cheek, tan and orange martial arts gi, fingerless gloves, cocky grin",
  "kazu-spirit-brawler": "a tall tough teenage delinquent brawler with a tall orange pompadour, dark blue school uniform, wielding a glowing blue spirit sword",
  "zoran-thricedraw": "a muscular green-haired swordsman wearing a green bandana and a green coat with a haramaki sash, a scar over his left eye, holding three katana (one gripped in his teeth)",
  "prince-vael": "a proud arrogant warrior prince with tall upswept flame-shaped black hair and a sharp widow's peak, blue and white battle armor with rounded shoulder guards, white gloves and boots, glowing battle aura",
  "karu-sunfist": "a cheerful spiky black-haired martial artist in an orange gi with a blue belt, energetic fighting stance, glowing golden ki around fists",
  "jugo-limitless": "a tall powerful sorcerer with fluffy white hair and a black blindfold over his eyes, a long black trench coat, calm smirk, swirling blue energy in one raised hand",
  "sota-caped-fist": "a completely bald caped superhero in a plain yellow jumpsuit with a white flowing cape, red gloves, red boots and a red belt, blank bored expression",
  "pip-powderkeg": "a small eager young apprentice witch girl with short brown hair, an oversized pointed dark witch hat, a short dark mage robe with a cape, holding a small wooden staff",
  "iron-bo-cannonarm": "a huge muscular cyborg with swept-back bright blue hair and dark sunglasses, large metal mechanical arms with a built-in arm cannon, open shirt",
  "kanae-petalfall": "a graceful female swordswoman with long dark hair, a pink and teal flower-patterned haori over a dark uniform, holding a katana, gentle smile",
  "akagan-ashen": "a stern grizzled military admiral with short grey hair and a scarred face, a dark crimson double-breasted military coat, fists wreathed in glowing magma and embers",
  "megu-explosion-sage": "a dramatic crimson mage girl with brown hair, a large pointed witch hat and an eyepatch over one eye, a dark cloak with red lining, raising an ornate glowing staff, explosion casting pose",
  "tobi-skipstone": "a young energetic ninja boy with spiky brown hair, a blue metal ninja headband and a long blue scarf, dark ninja outfit, throwing stance",
  "zeni-spark": "a frightened blond swordsman with bright yellow hair, an orange haori with a white triangle pattern over a black uniform, holding a katana crackling with golden lightning",
  "hyo-frost-arc": "a small cool-eyed young captain swordsman with spiky white hair, a black robe under a white captain's haori, holding a katana wreathed in icy mist",
  "kilo-lightning-hand": "an agile assassin boy with silver-white spiky hair, a blue and white shirt with baggy shorts, hands crackling with blue electricity, playful grin",
  "sasu-stormblade": "a brooding dark ninja swordsman with spiky blue-black hair, a high-collared dark coat with a purple rope belt, a katana on his back, glowing red eyes",
  "bram-thornling": "a calm nature shaman with mossy green-brown hair, bark and leaf armor, an earthy robe, holding a wooden staff sprouting thorns and vines",
  "kona-ember-fox": "a mischievous fox-spirit girl with orange hair, fox ears and several flaming fox tails, an orange and red kimono, whisker marks on her cheeks",
  "shion-venom-priestess": "a sinister priestess in a deep purple hooded robe, pale skin and glowing green eyes, dripping green venom from her clawed hands",
  "roan-flame-alchemist": "a confident military flame officer with short black hair, a dark blue military uniform, white ignition gloves, snapping fingers producing a fire spark",
  "morren-plaguebearer": "an eerie curse spirit with patchwork grey and blue stitched skin and hair, mismatched eyes, a ragged grey robe, an unsettling wide smile",
  "doro-mire-spirit": "a lumpy muddy swamp spirit with a green-brown body dripping mud, glowing yellow eyes, simple and grotesque",
  "shika-shadowbinder": "a lazy tactician ninja with black hair tied up in a spiky pineapple-shaped ponytail, a green flak vest over a dark ninja outfit, bored half-lidded expression",
  "glace-ice-maker": "a cool casual ice mage with dark spiky hair, shirtless with a silver cross necklace, frost and ice forming over one hand",
  "yuki-frostward-maiden": "an icy general queen with long pale blue hair, an elegant white and blue military general's coat, creating jagged ice, cold confident smile",
  "garan-sandshackle": "a quiet sand wielder with spiky deep-red hair, a large sand gourd strapped to his back, a tan and crimson robe, dark rings around his teal eyes",
  "mochi-morale-sprite": "a tiny adorable round chibi mascot spirit, pastel pink, huge sparkly eyes and little fairy wings, cheerful",
  "lyra-tempo": "an elegant skeletal gentleman musician with a big dark afro and a top hat, a fancy tailcoat suit, holding a violin and bow",
  "orin-celestial-herald": "a kind gentle healer girl with long orange hair and blue flower hairpins, a blue and white outfit, conjuring a glowing golden hexagonal shield barrier",
  "aldric-banner-bearer": "a heroic blond military commander with combed-back hair, a tan military coat with a green cape, holding a war banner aloft, determined expression",
  "senna-slug-sannin": "a powerful female healer warrior with blonde hair in low twin ponytails and a blue diamond mark on her forehead, a green haori over a grey outfit, confident",
  // batch C — ranged & arcane towers (bow/crossbow/gun/thrown/tome/scepter/wand/orb)
  "aya-dawnshot": "a determined young archer princess with long bright red hair tied back, a red-and-cream traveller's tunic and half-cloak, a worn quiver, drawing a slender hunting bow",
  "lyran-ricochet": "a poised green-cloaked elf marksman with pointed ears and long pale hair, light leather armor, a hooded green ranger cloak, loosing an arrow from an elegant longbow",
  "seren-skyfall": "a weathered nomad archer-hero with tan skin and a headscarf, an open travel vest and arm-wraps, drawing a massive ornate war-bow aimed at the sky, glowing arrow",
  "dren-heavybolt": "a stern taciturn monster-hunter with short dark hair and a scarred jaw, a heavy hunter's longcoat and steel bracers, bracing a bulky steel-limbed crossbow",
  "vesska-venombolt": "a hooded female assassin with sharp eyes, a dark wrapped assassin's outfit with green toxin vials at the belt, aiming a slim repeating crossbow dripping green venom",
  "vance-the-drifter": "a lanky wandering gunslinger standing tall with spiky blond hair and round orange sunglasses, a long red trench coat over a grey bodysuit, holding a long silver revolver at his side, calm easy grin, full body",
  "yael-boomshot": "a confident red-orange long-ponytailed sharpshooter girl standing tall, a flame-print top with a slung ammo bandolier and short shorts, holding a large grenade launcher over one shoulder, full body",
  "rivka-rebound": "a humming markswoman with long wavy hair and round spectacles, a long military greatcoat, raising a slender ornate long-rifle, faint glowing curved bullet trails",
  "tella-wirefang": "an agile weapons-mistress with twin hair buns and bandaged forearms, a sleeveless qipao-style top, throwing a glittering fan of kunai and weighted bola-wire",
  "mortise-inkhex": "a pale gaunt scrivener-mage with dark circles, an ink-stained black scholar's robe, a quill behind one ear, a floating open black grimoire leaking sickly green ink",
  "verena-quillbane": "a stern female court archivist with hair in a tight bun, a high-collared violet academic robe with gold trim, holding an enchanted tome and a glowing quill",
  "auriel-wardlight": "a radiant regal queen-cleric with flowing golden hair and a winged circlet, a white-and-gold royal gown, raising a tall jewelled scepter pouring warm light",
  "sael-arcrod": "a wind-swept storm-priest with short tousled hair, a storm-grey robe with crackling blue trim, raising a copper scepter capped by a sparking blue crystal",
  "pim-sparklet": "a tiny over-eager apprentice witch girl in an oversized starry mage-robe and a too-big pointed hat, waving a stubby crystal-tipped wand spitting little sparks",
  "aldous-boltcaster": "a precise composed battle-mage with neat hair and a focusing monocle, a deep-blue mage coat covered in silver sigils, leveling a long rune-etched wand firing arcane darts",
  "aquella-the-radiant": "a dazzling water-goddess with long blue hair and a water-ring halo, a blue-and-white goddess dress with detached sleeves, a glowing scrying orb floating at her hand",
  // tanker — front-line bulwarks (homage-inspired, original designs)
  "riku-ironhide": "a big-hearted rugged young guardsman with spiky crimson-red hair, a red-trimmed leather guard's harness over jagged hardened iron-grey skin, fists hardened like rough iron, a manly confident grin, bracing stance",
  "garrek-ironscale": "a surly muscular drifter brawler with a wild black mane and a riveted studded brow, a dark studded long coat over metallic iron-scaled skin, one club-like dragon-iron forearm held close to the body, scowling, arms kept tucked in",
  "joro-diamondhide": "a towering broad-shouldered commander whose body is faceted like cut crystal diamond glinting with hard light, a heavy officer's coat over diamond-hard skin, massive crushing fists, stern",
  "reinhart-armored-wall": "a grim heavy soldier clad head to toe in interlocking bone-white armor plating over every limb, weathered battle-scarred plates, plated fists, stoic dutiful stance",
  "garron-unbreaking-pillar": "a towering muscular heroic guardian with a broad frame, golden swept-back hair in two upswept spikes, a blue and gold heroic battle suit, an unshakeable bright grin, a single bare fist raised, arms kept compact and close to the torso",
};

// ---- HERO weapon-variant looks (outlook changes with equipped weapon) ----
export const HERO_BASE = "a noble RPG knight hero with short brown hair, polished steel plate armor with gold trim, a blue tabard, standing heroic pose";
export const HERO_WEAPON = {
  sword: "prominently holding a large steel broadsword in one hand and a round kite shield in the other",
  bow: "prominently holding a large wooden longbow drawn with an arrow, a quiver on the back",
  staff: "prominently holding a tall glowing magic wizard staff with a crystal top",
  gun: "prominently holding a large ornate steampunk hand cannon firearm",
  fist: "no weapon, bare armored fists raised in a boxing stance, gauntlets glowing with energy",
};

// ---- ENEMIES ----
export const ENEMY_VISUAL = {
  grunt: "a menacing undead husk soldier with grey rotting skin, tattered armor and a rusty sword, glowing red eyes",
  runner: "a small fast feral ghoul, hunched, with long claws and tattered rags, glowing yellow eyes",
  brute: "a huge brutish armored ogre with green-grey skin, tusks and spiked shoulder armor",
  bulwark: "an armored undead shieldbearer in heavy plate carrying an enormous tower shield, glowing visor",
  mender: "a sickly pale hooded acolyte in a grey robe holding a staff with a glowing green healing orb",
  regenerator: "a hulking mossy troll with green regenerating skin covered in moss and vines, hunched",
  slime: "a glossy green gelatinous slime monster with two big eyes, dripping",
  slimelet: "a tiny cute-but-gross green slime blob with two eyes",
  gargoyle: "a winged stone gargoyle with grey cracked rock skin, bat wings, horns and glowing red eyes, snarling",
  stormflyer: "a fierce flying storm drake with blue scales and crackling lightning wings",
  sapper: "a stocky grinning goblin demolisher carrying a lit round bomb, wrapped in leather straps",
  phantom: "a translucent pale blue ghostly stalker with hollow glowing eyes and a wispy lower body",
  summoner: "a skeletal necromancer with a bone skull, a dark purple robe and a glowing purple staff",
  imp: "a small red devil imp with horns, bat wings and a pitchfork, yellow eyes, mischievous",
  raider: "a hulking scarred berserker raider with war paint, fur armor and a huge battle axe, roaring",
  courier: "a sneaky small goblin coin-runner carrying a heavy bulging money bag, shifty eyes",
  golem: "a massive lumbering iron golem built of riveted dark metal plates, a glowing orange furnace core in its chest, huge heavy fists, blank slit eyes",
  monolith: "a towering walking stone monolith with a cracked grey granite body carved with glowing blue runes, stubby stone limbs, a single glowing rune-eye",
  herald: "an undead skeletal standard-bearer in tattered armor holding aloft a ragged glowing war banner, rallying pose, eerie green light",
  hexer: "a sinister hooded grave-witch hexbinder in a dark tattered shroud, pale bony clawed hands weaving glowing purple hex sigils, hollow glowing eyes",
  reaver: "a frenzied bloodmad berserker reaver in spiked dark armor streaked with blood-red war paint, wielding twin jagged cleavers, hunched in an aggressive charging lunge, glowing red eyes",
  prism: "a massive crystalline behemoth golem with a faceted translucent prism body refracting shifting blue and red light, heavy crystal limbs, slow and immense, a glowing core",
  carrier: "a bloated rotting plague-carrier monster, a swollen sickly green sac of spores straining to burst, oozing pustules, stubby limbs, dripping toxic ichor",
  dreadwing: "an armored iron-plated winged drake gunship, riveted dark metal battle-plating over heavy bomber wings, menacing glowing slit eyes, bristling with rivets and spikes",
  cantor: "a robed skeletal cantor priest wailing a dirge, mouth agape, tattered grey grave vestments, raised bony hands radiating a ghostly translucent sonic aura, hollow glowing eyes",
};
export const BOSS_VISUAL = {
  champion: "an imposing armored boss knight in ornate silver plate armor with gold trim, a flowing cape and a huge greatsword, glowing red eyes, intimidating",
  warden: "a massive fortress warden boss in heavy dark steel armor carrying a giant battle axe and a tower shield, glowing blue visor",
  overlord: "a towering dark sorcerer-lord boss with a purple skull-like face, ornate black and purple robes with a high collar and cape, a dark crown and floating dark magic orbs",
  // The Antihero Gallery — name-free, visually recognizable anti-hero homages.
  gravemourn: "a towering grim black-armored swordsman boss with a single scarred eye and a prosthetic iron forearm, wielding a colossal slab-like greatsword as tall as himself, tattered dark cloak, brooding rage",
  vindicator: "a hardened militant vigilante boss in black tactical body armor bearing a stark white skull emblem across the chest, draped in ammunition belts, gripping heavy military firearms, grim and merciless",
  sundermark: "a wandering scarred warrior-assassin boss with a large X-shaped facial scar, dark dreadlocked hair and small round sunglasses, one arm wrapped in glowing red destruction sigils, flowing grey traveler's robes",
  crownfall: "a proud armored warrior-prince boss with spiked black flame-shaped hair, royal blue battle armor over a white bodysuit with white gloves and boots, crackling golden energy aura, arrogant scowl",
  unkilling: "a feral muscular berserker boss with wild dark hair drawn into two points and thick sideburns, a yellow and blue armored bodysuit, three gleaming metal claws extending from each fist, savage snarl",
  mawborn: "a hulking pitch-black symbiote monster boss with a huge fanged maw and bulging white eyes, long writhing tendrils and a massive lashing tongue, glistening alien ooze",
  devourer: "a colossal skinless titan boss of exposed steaming red musculature, long flowing dark hair framing a gaunt determined face with glowing eyes, towering and unstoppable",
  crimsonlord: "a lean aristocratic vampire gunslinger boss in a bright crimson red long coat and a matching red wide-brimmed hat, pale white skin, neat black hair, round orange glasses, holding a long silver pistol, dramatic clearly-separated full-body poses",
  fallenward: "a dread armored dark warlord boss in a flowing black cape and full obsidian plate armor, an intimidating skull-like helmet with a breathing mask, wielding a humming crimson energy blade",
  ashghost: "a vengeful pale ash-skinned spartan warrior boss with a bold red tattoo across one eye, a short dark beard and a scarred muscular body, twin chained blades wreathed in fire, cold fury",
};

// ---- ITEMS (icon style) ----
const ITEM_STYLE = "a single game item icon, {V}, clean cel-shaded anime game asset, centered, isolated on a plain solid light grey background, no shadow, soft rim light";
export function itemStyle(v) { return ITEM_STYLE.replace("{V}", v); }

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

// ---- SKILLS (ability-emblem icon style) ----
// A skill icon is the EMBLEM of its cast effect — a glowing magical sigil/burst,
// no character, no weapon-holder. The `look` comes straight from each skill's VFX
// `appearance` metadata so the icon matches the in-battle signature.
const SKILL_STYLE = "a single magical ability skill emblem icon, a glowing energy sigil depicting {V}, dramatic radiant glow, swirling magical energy, no character, no person, clean cel-shaded anime game asset, bold centered emblem, isolated on a plain solid dark slate background, intense bloom";
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
