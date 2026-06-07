/**
 * Procedural 24×24 SVG skill-icon system (T18).
 *
 * Every icon is generated purely from SVG primitives — no external files.
 * Passive icons are themed by semantic region/category (brawler=sword,
 * arcane/energy=spark, splash=blast, chain=arc, dot=drop, debuff=bind,
 * support=aura). Active icons are themed by attack style.
 *
 * `passiveIconSVG(id)` and `activeIconSVG(id)` are the primary entry points.
 * The MAP variants pre-build all icons at module load for O(1) lookup.
 */

// ---------------------------------------------------------------------------
// SVG helpers (24×24 viewBox, transparent background)
// ---------------------------------------------------------------------------

const C = 12; // centre of the 24×24 canvas

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;
}

/** Encode an SVG string as a data-URI usable in Phaser load.svg() */
function toDataURI(svgStr: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
}

// ---------------------------------------------------------------------------
// Icon shape builders — each returns the inner SVG markup (no <svg> wrapper)
// ---------------------------------------------------------------------------

/** Diamond / fallback */
function iconDiamond(fill: string, stroke: string): string {
  return `<polygon points="12,2 22,12 12,22 2,12" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

/** Dot fallback */
function iconDot(fill: string, stroke: string): string {
  return `<circle cx="${C}" cy="${C}" r="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
}

// ---- BRAWLER / melee-damage: sword silhouette ----
function iconSword(fill: string, stroke: string): string {
  // blade: thin vertical rectangle, guard: horizontal bar, pommel: small circle
  return [
    // blade
    `<rect x="11" y="2" width="2" height="14" rx="0.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    // crossguard
    `<rect x="7" y="15" width="10" height="2" rx="0.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    // pommel
    `<circle cx="${C}" cy="20" r="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    // highlight
    `<rect x="12" y="3" width="0.8" height="11" rx="0.4" fill="rgba(255,255,255,0.45)"/>`,
  ].join("");
}

/** Sword variant: diagonal strike arc */
function iconSwordArc(fill: string, stroke: string): string {
  return [
    // diagonal blade
    `<line x1="4" y1="4" x2="20" y2="20" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>`,
    `<line x1="4" y1="4" x2="20" y2="20" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round"/>`,
    // arc swipe
    `<path d="M 4 20 Q 12 2 20 4" fill="none" stroke="${fill}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>`,
    // crossguard perp
    `<line x1="8" y1="17" x2="14" y2="11" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>`,
  ].join("");
}

// ---- ARCANE / energy / ki: spark / star ----
function iconSpark(fill: string, stroke: string): string {
  // 4-point star
  const pts = "12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10";
  return [
    `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // inner glow circle
    `<circle cx="${C}" cy="${C}" r="3" fill="rgba(255,255,255,0.5)"/>`,
  ].join("");
}

// ---- SPLASH / explosion: blast circle ----
function iconBlast(fill: string, stroke: string): string {
  // central circle + spiky rays
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const r1 = 6, r2 = 10;
    const x1 = C + Math.cos(a) * r1, y1 = C + Math.sin(a) * r1;
    const x2 = C + Math.cos(a) * r2, y2 = C + Math.sin(a) * r2;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${fill}" stroke-width="2" stroke-linecap="round"/>`;
  }).join("");
  return [
    rays,
    `<circle cx="${C}" cy="${C}" r="5" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
    `<circle cx="${C}" cy="${C}" r="2.5" fill="rgba(255,255,255,0.45)"/>`,
  ].join("");
}

// ---- CHAIN / bounce: arc chain ----
function iconChain(fill: string, stroke: string): string {
  return [
    // three arc segments representing chain bounces
    `<path d="M 3 18 Q 8 4 12 12" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linecap="round"/>`,
    `<path d="M 12 12 Q 16 4 21 18" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linecap="round"/>`,
    // nodes at bounce points
    `<circle cx="3" cy="18" r="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<circle cx="${C}" cy="${C}" r="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<circle cx="21" cy="18" r="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
  ].join("");
}

// ---- DOT / poison / bleed: drop ----
function iconDrop(fill: string, stroke: string): string {
  // teardrop shape
  return [
    `<path d="M 12 3 Q 19 10 19 15 A 7 7 0 0 1 5 15 Q 5 10 12 3 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // inner highlight
    `<ellipse cx="9.5" cy="12" rx="1.5" ry="2.5" fill="rgba(255,255,255,0.35)"/>`,
  ].join("");
}

// ---- DEBUFF / bind / slow: chain link / shackle ----
function iconShackle(fill: string, stroke: string): string {
  return [
    // two overlapping rings → chain-link
    `<circle cx="9" cy="${C}" r="5.5" fill="none" stroke="${fill}" stroke-width="2.5"/>`,
    `<circle cx="15" cy="${C}" r="5.5" fill="none" stroke="${fill}" stroke-width="2.5"/>`,
    // outline pass
    `<circle cx="9" cy="${C}" r="5.5" fill="none" stroke="${stroke}" stroke-width="1"/>`,
    `<circle cx="15" cy="${C}" r="5.5" fill="none" stroke="${stroke}" stroke-width="1"/>`,
    // center clasp
    `<rect x="9.5" y="9" width="5" height="6" rx="1" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`,
  ].join("");
}

// ---- SUPPORT / aura / heal: plus / cross ----
function iconPlus(fill: string, stroke: string): string {
  return [
    `<rect x="10" y="3" width="4" height="18" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<rect x="3" y="10" width="18" height="4" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<circle cx="${C}" cy="${C}" r="3.5" fill="rgba(255,255,255,0.3)"/>`,
  ].join("");
}

// ---- ENERGY BEAM / ki wave: beam ----
function iconBeam(fill: string, stroke: string): string {
  return [
    // horizontal beam with taper
    `<polygon points="2,10 22,11.5 22,12.5 2,14" fill="${fill}" stroke="${stroke}" stroke-width="0.8" stroke-linejoin="round"/>`,
    // burst at source
    `<circle cx="4" cy="${C}" r="3.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<circle cx="4" cy="${C}" r="1.5" fill="rgba(255,255,255,0.5)"/>`,
  ].join("");
}

// ---- FLAME / fire: flame shape ----
function iconFlame(fill: string, stroke: string): string {
  return [
    // main flame
    `<path d="M 12 22 Q 4 18 5 11 Q 7 14 8 12 Q 9 6 12 2 Q 13 8 15 9 Q 14 5 16 4 Q 20 9 19 15 Q 19 20 12 22 Z" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`,
    // inner lighter core
    `<path d="M 12 20 Q 7 17 8 13 Q 10 16 11 14 Q 12 10 12 6 Q 14 11 15 12 Q 15 9 16 9 Q 18 13 17 17 Q 16 20 12 20 Z" fill="rgba(255,220,80,0.55)"/>`,
  ].join("");
}

// ---- ICE / crystal: hexagon / shard ----
function iconCrystal(fill: string, stroke: string): string {
  // hexagonal crystal
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const r = 9;
    return `${(C + Math.cos(a) * r).toFixed(1)},${(C + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
  return [
    `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // inner facet lines
    `<line x1="${C}" y1="3" x2="${C}" y2="21" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>`,
    `<line x1="3" y1="${C}" x2="21" y2="${C}" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>`,
    `<circle cx="${C}" cy="${C}" r="3" fill="rgba(255,255,255,0.4)"/>`,
  ].join("");
}

// ---- LIGHTNING / bolt ----
function iconBolt(fill: string, stroke: string): string {
  return [
    `<polygon points="14,2 7,13 12,13 10,22 17,11 12,11" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // highlight edge
    `<line x1="14" y1="2" x2="12" y2="11" stroke="rgba(255,255,255,0.45)" stroke-width="0.8"/>`,
  ].join("");
}

// ---- POISON / decay: skull-dot compound ----
function iconPoison(fill: string, stroke: string): string {
  return [
    // large drop for venom
    `<path d="M 12 4 Q 18 10 18 15 A 6 6 0 0 1 6 15 Q 6 10 12 4 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
    // skull-like eyes
    `<circle cx="9.5" cy="14" r="1.5" fill="${stroke}"/>`,
    `<circle cx="14.5" cy="14" r="1.5" fill="${stroke}"/>`,
    // drip
    `<path d="M 12 20 Q 11 22 12 23 Q 13 22 12 20" fill="${fill}" stroke="none"/>`,
  ].join("");
}

// ---- EARTH / sand: circle with cracks ----
function iconSandBind(fill: string, stroke: string): string {
  return [
    `<circle cx="${C}" cy="${C}" r="9" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
    // crack lines
    `<line x1="${C}" y1="3" x2="9" y2="${C}" stroke="${stroke}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>`,
    `<line x1="${C}" y1="3" x2="15" y2="${C}" stroke="${stroke}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>`,
    `<line x1="9" y1="${C}" x2="${C}" y2="21" stroke="${stroke}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>`,
    `<line x1="15" y1="${C}" x2="${C}" y2="21" stroke="${stroke}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>`,
    `<circle cx="${C}" cy="${C}" r="2.5" fill="${stroke}" opacity="0.5"/>`,
  ].join("");
}

// ---- CROWN / prestige ----
function iconCrown(fill: string, stroke: string): string {
  return [
    `<polygon points="2,20 2,10 7,15 12,5 17,15 22,10 22,20" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // jewels on top points
    `<circle cx="7" cy="15" r="1.5" fill="rgba(255,255,255,0.6)"/>`,
    `<circle cx="${C}" cy="5" r="1.5" fill="rgba(255,255,255,0.6)"/>`,
    `<circle cx="17" cy="15" r="1.5" fill="rgba(255,255,255,0.6)"/>`,
  ].join("");
}

// ---- GEM / conduit ----
function iconGem(fill: string, stroke: string): string {
  return [
    `<polygon points="12,2 20,8 17,22 7,22 4,8" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // facets
    `<polyline points="4,8 12,2 20,8" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.8"/>`,
    `<line x1="${C}" y1="2" x2="${C}" y2="22" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/>`,
    `<circle cx="${C}" cy="12" r="2.5" fill="rgba(255,255,255,0.3)"/>`,
  ].join("");
}

// ---- SHIELD / warden ----
function iconShield(fill: string, stroke: string): string {
  return [
    `<path d="M 12 2 L 21 6 L 21 13 Q 21 20 12 22 Q 3 20 3 13 L 3 6 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // emblem cross
    `<line x1="${C}" y1="8" x2="${C}" y2="18" stroke="rgba(255,255,255,0.5)" stroke-width="1.2" stroke-linecap="round"/>`,
    `<line x1="8" y1="${C}" x2="16" y2="${C}" stroke="rgba(255,255,255,0.5)" stroke-width="1.2" stroke-linecap="round"/>`,
  ].join("");
}

// ---- COIN / tactician ----
function iconCoin(fill: string, stroke: string): string {
  return [
    `<circle cx="${C}" cy="${C}" r="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`,
    `<circle cx="${C}" cy="${C}" r="6.5" fill="none" stroke="${stroke}" stroke-width="0.8" opacity="0.5"/>`,
    // $ symbol simplified: vertical line + two S-curves
    `<line x1="${C}" y1="5" x2="${C}" y2="19" stroke="${stroke}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`,
    `<path d="M 9 8.5 Q 9 6 12 6 Q 15 6 15 8.5 Q 15 11 12 12 Q 9 13 9 15.5 Q 9 18 12 18 Q 15 18 15 15.5" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round"/>`,
  ].join("");
}

// ---- FANG / predator ----
function iconFang(fill: string, stroke: string): string {
  return [
    // two curved fangs
    `<path d="M 8 4 Q 6 14 9 20 Q 11 22 12 20 Q 10 14 11 4 Z" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`,
    `<path d="M 16 4 Q 18 14 15 20 Q 13 22 12 20 Q 14 14 13 4 Z" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`,
    // highlight
    `<line x1="9" y1="5" x2="9" y2="14" stroke="rgba(255,255,255,0.35)" stroke-width="0.7" stroke-linecap="round"/>`,
    `<line x1="15" y1="5" x2="15" y2="14" stroke="rgba(255,255,255,0.35)" stroke-width="0.7" stroke-linecap="round"/>`,
  ].join("");
}

// ---- AURA / buff: radiating circle ----
function iconAura(fill: string, stroke: string): string {
  const rings = [9, 7, 5].map((r, i) =>
    `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${fill}" stroke-width="${1.5 - i * 0.3}" opacity="${1 - i * 0.25}"/>`
  ).join("");
  return [
    rings,
    // outline pass
    `<circle cx="${C}" cy="${C}" r="9" fill="none" stroke="${stroke}" stroke-width="0.8"/>`,
    `<circle cx="${C}" cy="${C}" r="3.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<circle cx="${C}" cy="${C}" r="1.5" fill="rgba(255,255,255,0.5)"/>`,
  ].join("");
}

// ---- MUSIC NOTE / speed aura ----
function iconNote(fill: string, stroke: string): string {
  return [
    // note head
    `<ellipse cx="9" cy="18" rx="3.5" ry="2.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    // stem
    `<line x1="12.5" y1="17" x2="12.5" y2="5" stroke="${fill}" stroke-width="2" stroke-linecap="round"/>`,
    `<line x1="12.5" y1="5" x2="19" y2="7" stroke="${fill}" stroke-width="2" stroke-linecap="round"/>`,
    // outline
    `<line x1="12.5" y1="17" x2="12.5" y2="5" stroke="${stroke}" stroke-width="0.8" stroke-linecap="round"/>`,
  ].join("");
}

// ---- SHADOW / phantom: eye ----
function iconEye(fill: string, stroke: string): string {
  return [
    // eye outline
    `<path d="M 2 12 Q 12 3 22 12 Q 12 21 2 12 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
    // iris
    `<circle cx="${C}" cy="${C}" r="4" fill="${stroke}" opacity="0.7"/>`,
    // pupil
    `<circle cx="${C}" cy="${C}" r="2" fill="rgba(0,0,0,0.8)"/>`,
    // highlight
    `<circle cx="10" cy="10" r="1" fill="rgba(255,255,255,0.6)"/>`,
  ].join("");
}

// ---- CANNON: circle barrel ----
function iconCannon(fill: string, stroke: string): string {
  return [
    // barrel
    `<rect x="4" y="10" width="14" height="5" rx="2.5" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    // muzzle
    `<rect x="17" y="9" width="4" height="7" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
    // wheel
    `<circle cx="7" cy="18" r="3.5" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
    `<circle cx="7" cy="18" r="1.2" fill="${stroke}" opacity="0.6"/>`,
    // blast dot
    `<circle cx="22" cy="${C}" r="1.5" fill="rgba(255,220,50,0.8)" stroke="${stroke}" stroke-width="0.5"/>`,
  ].join("");
}

// ---------------------------------------------------------------------------
// Color palettes per theme
// ---------------------------------------------------------------------------

interface IconTheme {
  fill: string;
  stroke: string;
  builder: (fill: string, stroke: string) => string;
}

const THEMES: Record<string, IconTheme> = {
  // passive regions
  brawler:  { fill: "#c0392b", stroke: "#1a0800",  builder: iconSword },
  arcane:   { fill: "#8e44ad", stroke: "#150022",  builder: iconSpark },
  warden:   { fill: "#27ae60", stroke: "#001a0a",  builder: iconShield },
  tactician:{ fill: "#f39c12", stroke: "#1a0d00",  builder: iconCoin },
  predator: { fill: "#e67e22", stroke: "#1a0800",  builder: iconFang },
  phantom:  { fill: "#2980b9", stroke: "#00101a",  builder: iconEye },
  conduit:  { fill: "#16a085", stroke: "#00150e",  builder: iconGem },
  prestige: { fill: "#d4ac0d", stroke: "#1a1200",  builder: iconCrown },
  // passive categories (for ids that don't match region keywords)
  splash:   { fill: "#e74c3c", stroke: "#1a0000",  builder: iconBlast },
  chain:    { fill: "#3498db", stroke: "#001020",  builder: iconChain },
  dot:      { fill: "#27ae60", stroke: "#001008",  builder: iconDrop },
  debuff:   { fill: "#8e44ad", stroke: "#100018",  builder: iconShackle },
  support:  { fill: "#2ecc71", stroke: "#001a08",  builder: iconPlus },
  // active skill styles
  fire:     { fill: "#e74c3c", stroke: "#1a0000",  builder: iconFlame },
  ice:      { fill: "#74b9ff", stroke: "#001428",  builder: iconCrystal },
  lightning:{ fill: "#f9ca24", stroke: "#1a1200",  builder: iconBolt },
  heal:     { fill: "#2ecc71", stroke: "#001a08",  builder: iconPlus },
  slash:    { fill: "#c0392b", stroke: "#1a0800",  builder: iconSwordArc },
  poison:   { fill: "#6ab04c", stroke: "#0a1a00",  builder: iconPoison },
  beam:     { fill: "#a29bfe", stroke: "#100028",  builder: iconBeam },
  cannon:   { fill: "#636e72", stroke: "#101010",  builder: iconCannon },
  aura:     { fill: "#fdcb6e", stroke: "#1a1000",  builder: iconAura },
  note:     { fill: "#81ecec", stroke: "#001a1a",  builder: iconNote },
  sand:     { fill: "#d4ac0d", stroke: "#1a1000",  builder: iconSandBind },
  shadow:   { fill: "#2d3436", stroke: "#0a0a0a",  builder: iconEye },
  // fallback
  default:  { fill: "#7f8c8d", stroke: "#101010",  builder: iconDiamond },
};

function buildIcon(theme: IconTheme): string {
  return svg(theme.builder(theme.fill, theme.stroke));
}

// ---------------------------------------------------------------------------
// Passive skill theme assignment
// ---------------------------------------------------------------------------

/**
 * Map of passive skill id → which theme key to use.
 * Primary grouping is by the semantic category comment in passiveSkills.ts:
 *   brawler-damage ids → brawler
 *   splash ids        → splash
 *   chain ids         → chain
 *   dot ids           → dot
 *   debuff ids        → debuff
 *   support ids       → support
 * A few ids contain region-flavour keywords and get the matching region theme.
 */
const PASSIVE_THEME: Record<string, string> = {
  // --- brawler / damage ---
  "wolf-fang":         "brawler",
  "spirit-sword":      "arcane",
  "street-code":       "brawler",
  "three-sword-style": "brawler",
  "first-strike":      "brawler",
  "royal-pride":       "prestige",
  "galick-surge":      "beam",
  "perfect-form":      "brawler",
  "boundless-ki":      "arcane",
  "instinct":          "phantom",
  "second-wind":       "support",
  "infinity":          "prestige",
  "six-eyes":          "phantom",
  "domain":            "arcane",
  "no-limiter":        "brawler",
  "deadpan":           "brawler",
  "casual-stride":     "brawler",
  // --- splash ---
  "loose-pin":         "splash",
  "siege-payload":     "cannon",
  "cola-boost":        "splash",
  "wide-bloom":        "splash",
  "fuse-master":       "splash",
  "eruption":          "fire",
  "molten-core":       "fire",
  "aftershock":        "splash",
  "explosion-only":    "splash",
  "crimson-pride":     "splash",
  "overflow":          "splash",
  // --- chain ---
  "bounce":            "chain",
  "conduit":           "conduit",
  "thunderclap":       "lightning",
  "cold-snap":         "ice",
  "ricochet":          "chain",
  "godspeed":          "lightning",
  "whirlwind":         "chain",
  "assassin-instinct": "predator",
  "sharingan":         "phantom",
  "chidori-stream":    "lightning",
  "vengeance":         "brawler",
  // --- dot ---
  "barbs":             "dot",
  "smolder":           "fire",
  "foxfire":           "fire",
  "virulence":         "poison",
  "lingering-toxin":   "poison",
  "ignition":          "fire",
  "pinpoint-flame":    "fire",
  "ambition":          "prestige",
  "corrosion":         "poison",
  "epidemic":          "poison",
  "necrosis":          "poison",
  // --- debuff ---
  "sticky-mud":        "sand",
  "shadow-bind":       "shadow",
  "two-hundred-iq":    "tactician",
  "ice-make":          "ice",
  "freezing-touch":    "ice",
  "deep-chill":        "ice",
  "hoarfrost":         "ice",
  "absolute-zero":     "ice",
  "sand-armor":        "sand",
  "iron-grip":         "debuff",
  "tailed-rage":       "brawler",
  // --- support ---
  "cheer":             "support",
  "allegro":           "note",
  "blessing":          "support",
  "shun-shield":       "warden",
  "rally":             "aura",
  "vanguard":          "warden",
  "last-charge":       "prestige",
  "hundred-healings":  "heal",
  "monster-strength":  "brawler",
  "sannin-resolve":    "prestige",
};

// ---------------------------------------------------------------------------
// Active skill theme assignment
// ---------------------------------------------------------------------------

const ACTIVE_THEME: Record<string, string> = {
  // energy / ki beam
  "spirit-ball":      "beam",
  "final-flash":      "beam",
  "kamefist-wave":    "beam",
  "hollow-purple":    "arcane",
  "serious-punch":    "brawler",
  // slash / melee
  "dimensional-slash":"slash",
  "iaido-slash":      "slash",
  // explosion / blast
  "frag-toss":        "splash",
  "coup-de-burst":    "cannon",
  "petal-storm":      "slash",
  "great-eruption":   "fire",
  "explosion":        "fire",
  // chain / bounce
  "double-skip":      "chain",
  "chain-lightning":  "lightning",
  "glacial-chain":    "ice",
  "thunderbolt":      "lightning",
  "kirin":            "lightning",
  // dot / poison
  "bramble":          "poison",
  "wildfire":         "fire",
  "plague-cloud":     "poison",
  "inferno-snap":     "fire",
  "black-rot":        "poison",
  // debuff / bind
  "tar-pit":          "sand",
  "shadow-stitch":    "shadow",
  "ice-geyser":       "ice",
  "blizzard":         "ice",
  "sand-burial":      "sand",
  // support / heal
  "pep-talk":         "support",
  "crescendo":        "note",
  "reject-fate":      "heal",
  "war-cry":          "aura",
  "creation-rebirth": "heal",
};

// ---------------------------------------------------------------------------
// SVG generator functions (public API)
// ---------------------------------------------------------------------------

/** Returns a 24×24 SVG string for a passive skill by id. */
export function passiveIconSVG(id: string): string {
  const themeKey = PASSIVE_THEME[id] ?? "default";
  const theme = THEMES[themeKey] ?? THEMES["default"];
  return buildIcon(theme);
}

/** Returns a 24×24 SVG string for a tower active skill by id. */
export function activeIconSVG(id: string): string {
  const themeKey = ACTIVE_THEME[id] ?? "default";
  const theme = THEMES[themeKey] ?? THEMES["default"];
  return buildIcon(theme);
}

// ---------------------------------------------------------------------------
// Pre-built map exports (data-URI values)
// ---------------------------------------------------------------------------

/** Maps every passive skill id → data-URI-encoded 24×24 SVG. */
export const PASSIVE_ICON_MAP: Record<string, string> = Object.fromEntries(
  Object.keys(PASSIVE_THEME).map((id) => [id, toDataURI(passiveIconSVG(id))])
);

/** Maps every tower active skill id → data-URI-encoded 24×24 SVG. */
export const ACTIVE_ICON_MAP: Record<string, string> = Object.fromEntries(
  Object.keys(ACTIVE_THEME).map((id) => [id, toDataURI(activeIconSVG(id))])
);

// ---------------------------------------------------------------------------
// Fallback helpers — exposed for cases where only the SVG string is needed
// ---------------------------------------------------------------------------

const _fallbackPassive = svg(iconDot("#7f8c8d", "#101010"));
const _fallbackActive  = svg(iconDiamond("#7f8c8d", "#101010"));

/** Returns fallback SVG if an id is not in the catalog. */
export function passiveIconSVGOrFallback(id: string): string {
  return PASSIVE_THEME[id] !== undefined ? passiveIconSVG(id) : _fallbackPassive;
}

/** Returns fallback SVG if an id is not in the catalog. */
export function activeIconSVGOrFallback(id: string): string {
  return ACTIVE_THEME[id] !== undefined ? activeIconSVG(id) : _fallbackActive;
}
