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
};
export const BOSS_VISUAL = {
  champion: "an imposing armored boss knight in ornate silver plate armor with gold trim, a flowing cape and a huge greatsword, glowing red eyes, intimidating",
  warden: "a massive fortress warden boss in heavy dark steel armor carrying a giant battle axe and a tower shield, glowing blue visor",
  overlord: "a towering dark sorcerer-lord boss with a purple skull-like face, ornate black and purple robes with a high collar and cape, a dark crown and floating dark magic orbs",
};

// ---- ITEMS (icon style) ----
const ITEM_STYLE = "a single game item icon, {V}, clean cel-shaded anime game asset, centered, isolated on a plain solid light grey background, no shadow, soft rim light";
export function itemStyle(v) { return ITEM_STYLE.replace("{V}", v); }
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
