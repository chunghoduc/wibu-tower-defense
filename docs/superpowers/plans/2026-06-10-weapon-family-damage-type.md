# Weapon-Family → Damage-Type Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text `meta.weapon` string with a structured `WeaponSpec` so a tower's `damageType`, attack style, and range band are *derived* from its weapon family (bow/gun/crossbow → Physical; staff/tome/scepter → Magic; elemental "enchant" can flip a physical weapon to Magic), then add 16 new towers to populate the empty ranged/magic families.

**Architecture:** A single canonical taxonomy module (`weaponFamily.ts`) maps every family → damage class + base range. `towerBuilder.t()` derives `damageType` from the weapon; `attackStyleFor()` reads the structured family/element instead of keyword-scanning prose. All 37 existing towers are migrated with **zero** damage-type or melee-class drift (guarded by parity tests). Then 16 new towers fill the bow/gun/crossbow/tome/scepter/wand/orb gaps via the `create-character` skill.

**Tech Stack:** TypeScript + Phaser 3.80, Vitest (`npm test`), `tsc --noEmit` (`npm run typecheck`). Tests live in `tests/`.

---

## File Structure

- **Create** `src/data/weaponFamily.ts` — the canonical taxonomy: `WeaponFamily` union, `WeaponElement` union, `WeaponSpec` interface, `FAMILY` table (damage class + base range), `deriveDamageType()`, `weaponBaseRange()`.
- **Create** `tests/weapon-family.test.ts` — unit tests for the taxonomy + derivation.
- **Modify** `src/data/schema.ts:239-246` — `CharacterMeta.weapon` becomes `WeaponSpec` (re-exported from `weaponFamily.ts`).
- **Modify** `src/data/towerBuilder.ts` — `t()` derives `damageType` from `meta.weapon` (input `damageType` optional).
- **Modify** `src/data/attackStyle.ts:33-82` — rewrite `attackStyleFor()` to read the structured spec.
- **Modify** `src/data/weaponRange.ts` — derive `WEAPON_RANGE` from the family table (single source of truth).
- **Modify** `src/data/schemaValidators.ts:18-…` — validate the weapon spec + that derived damageType matches.
- **Modify** `src/data/towers.ts` (17 towers) and `src/data/towersB.ts` (20 towers) — migrate each `weapon:` string to a `WeaponSpec`, drop the now-derived `damageType:` field.
- **Modify** `src/scenes/CollectionScene.ts:183` — display `m.weapon.display`.
- **Create** `tests/weapon-migration.test.ts` — parity: every existing tower's derived `damageType` + melee-class is unchanged; family coverage.
- **Phase B (new content):** new tower entries added via the `create-character` skill (which appends to `towers.ts`/`towersB.ts` or a new `towersC.ts` and regenerates art).

---

## PHASE A — The ruleset (Tasks 1–7)

### Task 1: Weapon-family taxonomy module

**Files:**
- Create: `src/data/weaponFamily.ts`
- Test: `tests/weapon-family.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/weapon-family.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  WEAPON_FAMILIES, FAMILY, deriveDamageType, weaponBaseRange,
  type WeaponSpec,
} from "../src/data/weaponFamily.ts";

describe("weapon-family taxonomy", () => {
  it("every family has a damage class and a base range", () => {
    for (const f of WEAPON_FAMILIES) {
      const row = FAMILY[f];
      expect(row.damageClass === "Physical" || row.damageClass === "Magic", f).toBe(true);
      expect(row.range, f).toBeGreaterThan(0);
    }
  });

  it("ranged families reach past melee, melee families stay short", () => {
    for (const f of ["bow", "crossbow", "gun", "staff", "tome", "scepter"] as const) {
      expect(FAMILY[f].range, f).toBeGreaterThanOrEqual(120);
    }
    for (const f of ["fist", "sword", "blunt"] as const) {
      expect(FAMILY[f].range, f).toBeLessThan(140);
    }
  });

  it("family default decides damage type", () => {
    expect(deriveDamageType({ family: "bow", display: "" })).toBe("Physical");
    expect(deriveDamageType({ family: "gun", display: "" })).toBe("Physical");
    expect(deriveDamageType({ family: "staff", display: "" })).toBe("Magic");
    expect(deriveDamageType({ family: "tome", display: "" })).toBe("Magic");
  });

  it("elemental enchant flips a physical weapon to Magic (option ii)", () => {
    expect(deriveDamageType({ family: "sword", display: "" })).toBe("Physical");
    expect(deriveDamageType({ family: "sword", enchanted: true, display: "" })).toBe("Magic");
    expect(deriveDamageType({ family: "fist", element: "fire", enchanted: true, display: "" })).toBe("Magic");
  });

  it("weaponBaseRange returns the family base", () => {
    const spec: WeaponSpec = { family: "bow", display: "a bow" };
    expect(weaponBaseRange(spec)).toBe(FAMILY.bow.range);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- weapon-family`
Expected: FAIL — cannot resolve `../src/data/weaponFamily.ts`.

- [ ] **Step 3: Write the taxonomy module**

Create `src/data/weaponFamily.ts`:

```ts
/**
 * Canonical weapon taxonomy — the single source of truth that turns a tower's
 * weapon into its damage type, attack reach, and (via attackStyle.ts) its basic-
 * attack visual. Each family declares a damage CLASS (Physical or Magic) and a
 * base RANGE band. A tower authors only its weapon; damageType is DERIVED, so a
 * bow can never be a "magic" tower by accident.
 *
 * Option (ii) "Elemental Enchant": a physical weapon (fist/sword/…) infused with
 * elemental or spirit energy (`enchanted: true`) reads as Magic — e.g. magma
 * fists, a frost katana. This is the only escape hatch from the family default.
 */
import type { AttackDamageType } from "./schema.ts";

export const WEAPON_ELEMENTS = ["fire", "ice", "lightning", "poison", "holy"] as const;
export type WeaponElement = (typeof WEAPON_ELEMENTS)[number];

export const WEAPON_FAMILIES = [
  // physical melee
  "fist", "sword", "spear", "blunt",
  // physical ranged
  "bow", "crossbow", "gun", "thrown",
  // magic implements
  "staff", "tome", "scepter", "wand", "rod", "orb",
  // physical conduits / thematic
  "thorn", "sand", "banner",
  // magic conduits / thematic
  "curse", "nature", "shadow", "talisman", "instrument", "aura", "charm",
] as const;
export type WeaponFamily = (typeof WEAPON_FAMILIES)[number];

/** A tower's structured weapon: family drives everything; the rest is flavour/VFX. */
export interface WeaponSpec {
  /** Weapon family — decides damage class, attack style, and base reach. */
  family: WeaponFamily;
  /** Elemental flavour — picks the projectile/impact VFX (fireball, iceball…). */
  element?: WeaponElement;
  /** Option (ii): elemental/spirit energy infuses a physical weapon → Magic. */
  enchanted?: boolean;
  /** Wields several blades at once → the swing reads as a rapid flurry. */
  multi?: boolean;
  /** A single, world-ending blow → the swing reads as a weighty smash. */
  heavy?: boolean;
  /** Player-facing weapon description shown in the collection codex. */
  display: string;
}

interface FamilyRow {
  damageClass: AttackDamageType;
  /** Characteristic reach; authoring guidance + hero WEAPON_RANGE source. */
  range: number;
}

/** The canonical family → {damage class, base range} table. */
export const FAMILY: Record<WeaponFamily, FamilyRow> = {
  // physical melee
  fist: { damageClass: "Physical", range: 90 },
  sword: { damageClass: "Physical", range: 115 },
  spear: { damageClass: "Physical", range: 120 },
  blunt: { damageClass: "Physical", range: 110 },
  // physical ranged
  bow: { damageClass: "Physical", range: 240 },
  crossbow: { damageClass: "Physical", range: 230 },
  gun: { damageClass: "Physical", range: 260 },
  thrown: { damageClass: "Physical", range: 200 },
  // magic implements
  staff: { damageClass: "Magic", range: 210 },
  tome: { damageClass: "Magic", range: 195 },
  scepter: { damageClass: "Magic", range: 200 },
  wand: { damageClass: "Magic", range: 185 },
  rod: { damageClass: "Magic", range: 195 },
  orb: { damageClass: "Magic", range: 190 },
  // physical conduits / thematic
  thorn: { damageClass: "Physical", range: 160 },
  sand: { damageClass: "Physical", range: 150 },
  banner: { damageClass: "Physical", range: 150 },
  // magic conduits / thematic
  curse: { damageClass: "Magic", range: 180 },
  nature: { damageClass: "Magic", range: 180 },
  shadow: { damageClass: "Magic", range: 175 },
  talisman: { damageClass: "Magic", range: 185 },
  instrument: { damageClass: "Magic", range: 150 },
  aura: { damageClass: "Magic", range: 170 },
  charm: { damageClass: "Magic", range: 150 },
};

/** Derive a tower's basic-attack damage type from its weapon (family + enchant). */
export function deriveDamageType(spec: WeaponSpec): AttackDamageType {
  if (spec.enchanted) return "Magic"; // option (ii): infused physical weapon → Magic
  return FAMILY[spec.family].damageClass;
}

/** The characteristic reach for a weapon family (authoring guidance for towers). */
export function weaponBaseRange(spec: WeaponSpec): number {
  return FAMILY[spec.family].range;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- weapon-family`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/weaponFamily.ts tests/weapon-family.test.ts
git commit -m "feat(data): canonical weapon-family taxonomy + damage-type derivation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Restructure `CharacterMeta.weapon` to `WeaponSpec`

This is the type cutover. It will break compilation of `towers.ts`/`towersB.ts` until Tasks 5–6 migrate them — that is expected and resolved within this phase. Do Tasks 2→3→4→5→6 back-to-back; only run the full suite green at the end of Task 6.

**Files:**
- Modify: `src/data/schema.ts:239-246`

- [ ] **Step 1: Change the meta type**

In `src/data/schema.ts`, add the import near the other type imports at the top of the file (after the file's opening doc comment, alongside existing `export type` declarations — place this import at line 12, before the `DAMAGE_TYPES` block):

```ts
import type { WeaponSpec } from "./weaponFamily.ts";
```

Then replace the `weapon` field in `CharacterMeta` (currently `src/data/schema.ts:244-245`):

```ts
  /** The character's signature weapon, structured so damage type/style derive from it. */
  weapon: WeaponSpec;
```

- [ ] **Step 2: Typecheck to confirm the expected breakage**

Run: `npm run typecheck`
Expected: FAIL — many errors in `towers.ts`/`towersB.ts` ("Type 'string' is not assignable to type 'WeaponSpec'") and in `towerBuilder.ts`. This confirms the cutover surface. Proceed to Task 3.

---

### Task 3: Derive `damageType` in `towerBuilder.t()`

**Files:**
- Modify: `src/data/towerBuilder.ts`

- [ ] **Step 1: Rewrite `t()` to derive the damage type**

Replace the entire body of `src/data/towerBuilder.ts` with:

```ts
import { makeStats, type CharacterDef, type AttackDamageType } from "./schema.ts";
import { augmentTowerStats, applyDamageArchetype, towerBaseline } from "./towerStats.ts";
import { deriveDamageType } from "./weaponFamily.ts";

/** A tower definition before building: artRef is stamped, damageType is derived. */
type TowerInput = Omit<CharacterDef, "artRef" | "damageType"> & {
  /** Optional explicit override; normally omitted and derived from meta.weapon. */
  damageType?: AttackDamageType;
};

/**
 * Wrap a character definition into a balanced, art-stamped tower. Layers:
 *  1. role × rarity baseline owns the CORE power budget (atk/rate/range/hp/mana
 *     + placement cost) so the roster scales coherently;
 *  2. the per-tower baseStats supply FLAVOUR (crit, penetration, lifesteal…) on
 *     top — identity (role, type, passives, active, behaviour) is preserved;
 *  3. augmentTowerStats fills the defensive/survival layer by role × rarity;
 *  4. applyDamageArchetype splits Physical (high atk/rate, no skill power) from
 *     Magic (low atk/rate, high skill power → powerful actives).
 *
 * `damageType` is DERIVED from the structured weapon (family + elemental enchant)
 * so a bow is always Physical and a tome always Magic — no hand-authored value to
 * drift. An explicit `damageType` may be supplied only as a deliberate override
 * and must agree with the weapon.
 */
export function t(def: TowerInput): CharacterDef {
  const spec = def.meta?.weapon;
  const derived = spec ? deriveDamageType(spec) : undefined;
  if (def.damageType && derived && def.damageType !== derived) {
    throw new Error(
      `tower ${def.id}: authored damageType ${def.damageType} disagrees with weapon-derived ${derived}`,
    );
  }
  const damageType = def.damageType ?? derived;
  if (!damageType) throw new Error(`tower ${def.id}: cannot derive damageType (no meta.weapon)`);

  const { core, cost } = towerBaseline(def.role, def.rarity);
  const budgeted = makeStats({ ...def.baseStats, ...core }); // baseline owns the core keys
  const augmented = augmentTowerStats(def.role, def.rarity, budgeted);
  const baseStats = applyDamageArchetype(damageType, def.rarity, augmented);
  return { ...def, damageType, cost, baseStats, artRef: "placeholder" };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL still — but now only in `towers.ts`/`towersB.ts` (the `weapon:` string literals) and possibly `attackStyle.ts`. `towerBuilder.ts` itself should no longer error. Proceed to Task 4.

---

### Task 4: Rewrite `attackStyleFor()` to read the structured spec

**Files:**
- Modify: `src/data/attackStyle.ts:33-82`

- [ ] **Step 1: Replace `attackStyleFor` and its helpers**

In `src/data/attackStyle.ts`, replace lines 33-82 (the `attackStyleFor` function and the `has`/`fire…` keyword block above it that only it uses — i.e. replace from the `const RANGED_MELEE` line's usage onward; keep `RANGED_MELEE`, `MELEE_STYLES`, `isMeleeStyle`). Specifically, delete the old `attackStyleFor` (lines 32-82) and the now-unused `has` helper (line 17) **only if** `skillStyleFor` no longer needs it — it does (lines 112-118), so KEEP `has`. Replace just the `attackStyleFor` function (lines 32-82) with:

```ts
/** Pick a basic-attack style for a character from its structured weapon spec. */
export function attackStyleFor(def: CharacterDef): AttackStyle {
  const spec = def.meta?.weapon;
  if (!spec) return fallbackStyle(def); // defensive: towers always carry a spec

  const el = spec.element;
  const fire = el === "fire", ice = el === "ice", elec = el === "lightning", poison = el === "poison";

  // Aura-based archetypes read by effect, not by a flying projectile.
  if (def.role === "support") return "holy";
  if (def.role === "debuff") return ice ? "iceball" : "hex";
  // Tankers are walls — they body-slam and crack the ground.
  if (def.role === "tanker") return "smash";

  // Elemental theme drives the projectile flavour (incl. enchanted melee weapons).
  if (fire) return "fireball";
  if (ice) return "iceball";
  if (elec) return "lightning";
  if (poison) return "poison";

  // Otherwise the weapon the character actually holds.
  switch (spec.family) {
    case "bow":
    case "crossbow":
      return "arrow";
    case "gun":
      return "cannon";
    case "blunt":
      return "smash";
    case "spear":
    case "sword":
      if (def.baseStats.range >= RANGED_MELEE) return "arcane";
      return spec.multi ? "flurry" : "slash"; // several blades → a rapid flurry
    case "staff":
    case "wand":
    case "tome":
    case "scepter":
    case "rod":
    case "orb":
      return "arcane";
    case "fist":
      if (def.damageType === "Magic") return "arcane"; // ki/spirit fists cast
      return spec.heavy ? "smash" : "punch";
    default:
      // thrown / thorn / sand / banner / nature / curse / shadow / talisman /
      // instrument / aura / charm — read by role / damage type.
      return fallbackStyle(def);
  }
}

/** Role/range fallback when no weapon family maps to a concrete swing or loose. */
function fallbackStyle(def: CharacterDef): AttackStyle {
  if (def.role === "dot") return "poison";
  if (def.role === "chain") return "lightning";
  if (def.damageType === "Magic") return "arcane";
  return def.baseStats.range >= RANGED_MELEE ? "arrow" : "slash";
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL only in `towers.ts`/`towersB.ts` now (the string `weapon:` literals). Proceed to Task 5.

---

### Task 5: Migrate the 17 towers in `towers.ts`

For each tower below, in `src/data/towers.ts`: (a) **delete** the `damageType: "…",` line (it is now derived), and (b) replace the `weapon: "…"` line inside `meta` with the structured object shown. Every value is chosen so the derived `damageType` equals the one being deleted and the attack style is unchanged (verified in Task 7).

**Files:**
- Modify: `src/data/towers.ts`

- [ ] **Step 1: Migrate all 17 `weapon` fields and drop `damageType`**

Apply exactly these replacements (id → new `weapon:` value; delete that tower's `damageType:` line):

```
yamo-desert-bandit       weapon: { family: "fist", display: "Bare fists and a thrown ball of ki" },
kazu-spirit-brawler      weapon: { family: "sword", enchanted: true, display: "A Spirit Sword conjured from raw energy" },
zoran-thricedraw         weapon: { family: "sword", multi: true, display: "Three katana — one in each hand and one clenched in his teeth" },
prince-vael              weapon: { family: "fist", display: "Bare-handed ki combat capped by a piercing energy flash" },
karu-sunfist             weapon: { family: "fist", enchanted: true, display: "Fists and a charged, world-shaking ki wave" },
jugo-limitless           weapon: { family: "curse", display: "Cursed energy that folds the space around his foes" },
sota-caped-fist          weapon: { family: "fist", heavy: true, display: "A single bare-fisted punch that ends everything" },
pip-powderkeg            weapon: { family: "gun", element: "fire", display: "Gunpowder, hand-lit bombs, and a stubby explosion wand" },
iron-bo-cannonarm        weapon: { family: "gun", display: "Twin siege cannons built into both forearms" },
kanae-petalfall          weapon: { family: "sword", enchanted: true, display: "A slender nichirin katana whose cuts scatter razor petals" },
akagan-ashen             weapon: { family: "fist", element: "fire", enchanted: true, display: "Fists of erupting molten magma" },
megu-explosion-sage      weapon: { family: "staff", element: "fire", display: "A gnarled wizard's staff that channels a single apocalyptic Explosion" },
tobi-skipstone           weapon: { family: "thrown", display: "Energy-charged stones skipped across the crowd" },
zeni-spark               weapon: { family: "sword", element: "lightning", enchanted: true, display: "A lightning-etched nichirin katana, unleashed only while asleep" },
hyo-frost-arc            weapon: { family: "sword", element: "ice", enchanted: true, display: "An ice-releasing longsword that looses ricocheting frozen arcs" },
kilo-lightning-hand      weapon: { family: "fist", element: "lightning", enchanted: true, display: "Bare hands cloaked in crackling lightning" },
sasu-stormblade          weapon: { family: "sword", element: "lightning", enchanted: true, display: "A lightning-charged chokuto that calls down a dragon of thunder" },
```

For each tower the edit is two changes — delete the `damageType: "Physical",` (or `"Magic",`) line and swap the `weapon:` string for the object. Example, `yamo-desert-bandit` goes from:

```ts
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    ...
    meta: {
      homage: "...",
      outfit: "...",
      weapon: "Bare fists and a thrown ball of ki",
    },
```

to:

```ts
    rarity: "Common",
    role: "damage",
    target: "Both",
    ...
    meta: {
      homage: "...",
      outfit: "...",
      weapon: { family: "fist", display: "Bare fists and a thrown ball of ki" },
    },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL only in `towersB.ts` now. Proceed to Task 6.

---

### Task 6: Migrate the 20 towers in `towersB.ts`, fold `weaponRange`, fix the codex display

**Files:**
- Modify: `src/data/towersB.ts`
- Modify: `src/data/weaponRange.ts`
- Modify: `src/scenes/CollectionScene.ts:183`

- [ ] **Step 1: Migrate all 20 `weapon` fields and drop `damageType`**

In `src/data/towersB.ts`, same two-change pattern as Task 5, with these values:

```
bram-thornling           weapon: { family: "thorn", element: "poison", display: "Barbed vines that lash and bleed trespassers" },
kona-ember-fox           weapon: { family: "nature", element: "fire", display: "Foxfire — clinging spirit flame that smolders in the wound" },
shion-venom-priestess    weapon: { family: "talisman", element: "poison", display: "Anointing toxins and venom-tipped prayer talismans" },
roan-flame-alchemist     weapon: { family: "aura", element: "fire", display: "Spark-cloth gloves that snap fire to life from the air itself" },
morren-plaguebearer      weapon: { family: "curse", element: "poison", display: "A bare touch that spreads unstoppable black decay" },
doro-mire-spirit         weapon: { family: "nature", display: "A mire conduit of sucking tar and grasping mud that drag foes down" },
shika-shadowbinder       weapon: { family: "shadow", display: "His own shadow, stretched out to stitch enemies in place" },
glace-ice-maker          weapon: { family: "aura", element: "ice", display: "An ice conjurer's focus — weapons sculpted from ice in an instant" },
yuki-frostward-maiden    weapon: { family: "sword", element: "ice", enchanted: true, display: "A rapier of conjured ice and a time-freezing aura" },
garan-sandshackle        weapon: { family: "sand", display: "A living gourd of sand that entombs and crushes" },
mochi-morale-sprite      weapon: { family: "charm", display: "Tiny cheer pom-poms and bottomless encouragement" },
lyra-tempo               weapon: { family: "instrument", display: "A battle-violin whose quickening rhythm hastens allies" },
orin-celestial-herald    weapon: { family: "charm", display: "Fairy-blessing shields and fate-rejecting wards" },
aldric-banner-bearer     weapon: { family: "banner", display: "A great war-banner raised high as a rallying standard" },
senna-slug-sannin        weapon: { family: "fist", display: "Monstrous chakra-enhanced fists and master healing arts" },
riku-ironhide            weapon: { family: "fist", display: "Iron-hardened fists and a shoulder-first body slam" },
garrek-ironscale         weapon: { family: "fist", enchanted: true, display: "Iron-scaled fists and a club-like dragon-iron forearm" },
joro-diamondhide         weapon: { family: "fist", display: "Diamond-hard fists that crack the ground on impact" },
reinhart-armored-wall    weapon: { family: "fist", display: "Plated fists and a full-body charge that flattens the line" },
garron-unbreaking-pillar weapon: { family: "fist", display: "Bare fists and a city-block-shaking smash" },
```

- [ ] **Step 2: Fold `WEAPON_RANGE` into the family table (single source of truth)**

Replace the body of `src/data/weaponRange.ts` with:

```ts
/**
 * Characteristic attack reach per HERO weapon family. The hero's WeaponType maps
 * onto the canonical tower weapon families (weaponFamily.ts) so towers and the
 * hero share one reach table: bare fists box at point blank, swords reach a melee
 * step, bows/guns snipe from afar, staves/tomes cast at mid range. Values straddle
 * the RANGED_MELEE threshold (120, see attackStyle.ts). `% range` affixes scale on
 * top of this base in the hero stat pipeline.
 */
import type { WeaponType } from "./schema.ts";
import { FAMILY, type WeaponFamily } from "./weaponFamily.ts";

/** Maps a hero WeaponType onto its tower weapon family; `Any` has no family. */
const HERO_WEAPON_FAMILY: Record<WeaponType, WeaponFamily | null> = {
  Fist: "fist",
  Sword: "sword",
  Bow: "bow",
  Gun: "gun",
  Staff: "staff",
  Tome: "tome",
  Any: null,
};

const ANY_RANGE = 150;

export const WEAPON_RANGE: Record<WeaponType, number> = {
  Fist: FAMILY.fist.range,
  Sword: FAMILY.sword.range,
  Bow: FAMILY.bow.range,
  Gun: FAMILY.gun.range,
  Staff: FAMILY.staff.range,
  Tome: FAMILY.tome.range,
  Any: ANY_RANGE,
};

/** Hero reach for the equipped weapon family; unarmed boxes at the Fist range. */
export function heroRangeForWeapon(weaponType: WeaponType | null): number {
  if (!weaponType) return WEAPON_RANGE.Fist;
  const fam = HERO_WEAPON_FAMILY[weaponType];
  return fam ? FAMILY[fam].range : ANY_RANGE;
}
```

(The numeric results are identical to before: Fist 90, Sword 115, Bow 240, Gun 260, Staff 210, Tome 195, Any 150.)

- [ ] **Step 3: Fix the codex weapon display**

In `src/scenes/CollectionScene.ts`, change line 183 from:

```ts
      field("Weapon", m.weapon);
```

to:

```ts
      field("Weapon", m.weapon.display);
```

- [ ] **Step 4: Add weapon-spec validation**

In `src/data/schemaValidators.ts`, inside `validateCharacter` (after the existing `damageType` assertion around line 24-26), add:

```ts
  if (c.meta) {
    assert(
      (WEAPON_FAMILIES as readonly string[]).includes(c.meta.weapon.family),
      `character ${c.id}: invalid weapon family ${c.meta.weapon.family}`,
    );
    assert(
      deriveDamageType(c.meta.weapon) === c.damageType,
      `character ${c.id}: weapon ${c.meta.weapon.family} derives ${deriveDamageType(c.meta.weapon)} but damageType is ${c.damageType}`,
    );
  }
```

And add to the imports at the top of `schemaValidators.ts`:

```ts
import { WEAPON_FAMILIES, deriveDamageType } from "./weaponFamily.ts";
```

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run typecheck`
Expected: PASS (no errors).

Run: `npm test`
Expected: PASS — including the existing `tests/attack-style.test.ts`, which pins the exact styles this migration preserves (tobi→lightning, kona→fireball, glace→iceball, pip→fireball, iron-bo→cannon, megu→fireball, akagan→fireball, kazu→slash, zoran→flurry, yamo/prince→punch, sota→smash, tankers→smash, doro/shika/garan→hex, kilo/sasu→lightning, karu→arcane, kanae→arcane, morren→poison).

If any style assertion fails, the `element`/`multi`/`heavy`/`family` for that tower was mis-set — fix that tower's `weapon` spec, do not edit the test.

- [ ] **Step 6: Commit**

```bash
git add src/data/schema.ts src/data/towerBuilder.ts src/data/attackStyle.ts \
  src/data/weaponRange.ts src/data/towers.ts src/data/towersB.ts \
  src/data/schemaValidators.ts src/scenes/CollectionScene.ts
git commit -m "feat(data): structured WeaponSpec — derive damageType/style/range from weapon family

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Enforcement tests (parity + coverage)

**Files:**
- Create: `tests/weapon-migration.test.ts`

- [ ] **Step 1: Write the parity + coverage test**

Create `tests/weapon-migration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/data/towers.ts";
import { attackStyleFor, isMeleeStyle } from "../src/data/attackStyle.ts";
import { deriveDamageType, FAMILY, type WeaponFamily } from "../src/data/weaponFamily.ts";

/** Pre-rework damage types — frozen snapshot guarding against silent drift. */
const EXPECTED_DAMAGE: Record<string, "Physical" | "Magic"> = {
  "yamo-desert-bandit": "Physical", "kazu-spirit-brawler": "Magic", "zoran-thricedraw": "Physical",
  "prince-vael": "Physical", "karu-sunfist": "Magic", "jugo-limitless": "Magic", "sota-caped-fist": "Physical",
  "pip-powderkeg": "Physical", "iron-bo-cannonarm": "Physical", "kanae-petalfall": "Magic",
  "akagan-ashen": "Magic", "megu-explosion-sage": "Magic",
  "tobi-skipstone": "Physical", "zeni-spark": "Magic", "hyo-frost-arc": "Magic",
  "kilo-lightning-hand": "Magic", "sasu-stormblade": "Magic",
  "bram-thornling": "Physical", "kona-ember-fox": "Magic", "shion-venom-priestess": "Magic",
  "roan-flame-alchemist": "Magic", "morren-plaguebearer": "Magic",
  "doro-mire-spirit": "Magic", "shika-shadowbinder": "Magic", "glace-ice-maker": "Magic",
  "yuki-frostward-maiden": "Magic", "garan-sandshackle": "Physical",
  "mochi-morale-sprite": "Magic", "lyra-tempo": "Magic", "orin-celestial-herald": "Magic",
  "aldric-banner-bearer": "Physical", "senna-slug-sannin": "Physical",
  "riku-ironhide": "Physical", "garrek-ironscale": "Magic", "joro-diamondhide": "Physical",
  "reinhart-armored-wall": "Physical", "garron-unbreaking-pillar": "Physical",
};

/** Which towers fought in melee (cleave) before the rework — must not flip. */
const EXPECTED_MELEE = new Set<string>([
  "yamo-desert-bandit", "kazu-spirit-brawler", "zoran-thricedraw", "prince-vael", "sota-caped-fist",
  "senna-slug-sannin", "riku-ironhide", "garrek-ironscale", "joro-diamondhide",
  "reinhart-armored-wall", "garron-unbreaking-pillar", "doro-mire-spirit", "shika-shadowbinder",
  "garan-sandshackle",
]);

describe("weapon migration parity", () => {
  it("every tower carries a structured weapon spec", () => {
    for (const t of TOWERS) expect(t.meta?.weapon?.family, t.id).toBeTruthy();
  });

  it("derived damageType matches each tower's built damageType (zero drift)", () => {
    for (const t of TOWERS) {
      expect(deriveDamageType(t.meta!.weapon), t.id).toBe(t.damageType);
    }
  });

  it("damageType matches the pre-rework snapshot for all 37 existing towers", () => {
    for (const [id, dmg] of Object.entries(EXPECTED_DAMAGE)) {
      const t = TOWERS.find((x) => x.id === id);
      expect(t, `missing ${id}`).toBeTruthy();
      expect(t!.damageType, id).toBe(dmg);
    }
  });

  it("melee-vs-ranged class (cleave) is unchanged for existing towers", () => {
    for (const id of Object.keys(EXPECTED_DAMAGE)) {
      const t = TOWERS.find((x) => x.id === id)!;
      expect(isMeleeStyle(attackStyleFor(t)), `${id} → ${attackStyleFor(t)}`).toBe(EXPECTED_MELEE.has(id));
    }
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- weapon-migration`
Expected: PASS (4 tests). If "zero drift" or "melee class" fails, a tower's `weapon` spec is mis-tagged — fix the tower, not the test.

- [ ] **Step 3: Commit**

```bash
git add tests/weapon-migration.test.ts
git commit -m "test(data): weapon-migration parity — zero damageType/melee-class drift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## PHASE B — 16 new towers filling the empty families (Tasks 8–9)

Phase A leaves the ruleset complete but the roster still has **zero** real bows, guns, crossbows, tomes, scepters, wands, or orbs. Phase B adds 16 towers via the `create-character` skill, one per character. The skill owns story → trait analysis → stats/skills → art (SDXL) → animation; this plan supplies only the canonical *weapon assignment* (family/element) and the role/rarity slot each character must fill so the family gaps close.

**Constraints (carry into every `create-character` run):**
- Legal safety: original homages only, never a real anime/game/movie name in shipped fields; `homage` is a designer-only note.
- The new tower's `meta.weapon` MUST be a `WeaponSpec` with the family below; do NOT author `damageType` (it derives).
- Set `baseStats.range` near `FAMILY[family].range` so the tower reads as ranged/melee correctly.
- Only one SDXL/image-gen process at a time.
- If `towers.ts` or `towersB.ts` would exceed 500 lines after additions, create `src/data/towersC.ts` for the new entries and export them through `TOWERS` (follow the existing `TOWERS_B` wiring pattern in `towers.ts:19`).

### Task 8: Create the 9 physical-ranged towers (bow / crossbow / gun / thrown)

**Files:**
- Modify/Create: `src/data/towers.ts` / `src/data/towersB.ts` / `src/data/towersC.ts` (via `create-character`)

- [ ] **Step 1: Create each character via the `create-character` skill**

Run the `create-character` skill once per row, passing the family/element + role + rarity so it fills the slot. Suggested identities are starting points; the skill refines them:

```
1. family: "bow",      element: -          role: damage   rarity: Common     (rapid archer — fast single-target loose)
2. family: "bow",      element: -          role: chain    rarity: Rare       (ricochet volley — arrows skip between foes)
3. family: "bow",      element: -          role: splash   rarity: Legendary  (arrow-rain — area volley)
4. family: "crossbow", element: -          role: damage   rarity: Magic      (heavy-bolt sniper — high single hit)
5. family: "crossbow", element: "poison"   role: dot      rarity: Rare       (poison-bolt — bleed/venom over time)
6. family: "gun",      element: -          role: damage   rarity: Rare       (gunslinger — rapid bullets)
7. family: "gun",      element: "fire"      role: splash   rarity: Legendary  (grenadier — explosive shells)
8. family: "gun",      element: -          role: chain    rarity: Unique     (ricochet pistolero — bouncing rounds)
9. family: "thrown",   element: -          role: debuff   rarity: Magic      (kunai/bola thrower — slows on hit)
```

After EACH character: run `npm run typecheck && npm test`. The new tower's derived `damageType` will be Physical for families 1–8 (bow/crossbow/gun/thrown) and Physical for the thrown debuff (style resolves to `hex` via the debuff role) — confirm the validator passes (it asserts `deriveDamageType === damageType`).

- [ ] **Step 2: Commit after each character**

`create-character` commits its own art + data; if it does not, commit with:

```bash
git add -A -- src/data public/assets/sprites
git commit -m "feat(roster): add <character-id> (<family> <role> <rarity>)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 9: Create the 7 magic-implement towers (tome / scepter / wand / orb)

**Files:**
- Modify/Create: `src/data/towers.ts` / `src/data/towersB.ts` / `src/data/towersC.ts` (via `create-character`)

- [ ] **Step 1: Create each character via the `create-character` skill**

```
10. family: "tome",    element: "poison"   role: dot      rarity: Magic      (curse-scribe — damage-over-time hexes)
11. family: "tome",    element: -          role: debuff   rarity: Rare       (hex-scholar — weakens/curses; style → hex)
12. family: "scepter", element: "holy"      role: support  rarity: Legendary  (royal warding — buff/shield aura; style → holy)
13. family: "scepter", element: "lightning" role: chain    rarity: Rare       (arc-scepter — chaining bolts)
14. family: "wand",    element: "lightning" role: splash   rarity: Common     (spark-wand — small AoE zaps)
15. family: "wand",    element: -          role: damage   rarity: Legendary  (arcane-missile — single-target bolts; style → arcane)
16. family: "orb",     element: "holy"      role: support  rarity: Unique     (oracle's orb — powerful aura; style → holy)
```

All families 10–16 are Magic by default (no enchant needed). For chain/splash with an element, the style resolves to the elemental projectile (lightning/etc.); support resolves to `holy`; debuff resolves to `hex`. After EACH character: `npm run typecheck && npm test`.

- [ ] **Step 2: Family-coverage test**

Create/extend `tests/weapon-migration.test.ts` with a coverage block (append inside the existing file, after the `describe` block):

```ts
describe("weapon-family coverage", () => {
  const present = new Set(TOWERS.map((t) => t.meta!.weapon.family));
  it("every previously-empty ranged/magic family now has a tower", () => {
    for (const fam of ["bow", "crossbow", "gun", "tome", "scepter", "wand", "orb"] as WeaponFamily[]) {
      expect(present.has(fam), `no tower uses family ${fam}`).toBe(true);
    }
  });
  it("each populated family's towers reach roughly its family band", () => {
    for (const t of TOWERS) {
      const band = FAMILY[t.meta!.weapon.family].range;
      // tower range is an identity stat but should stay within 60u of the band.
      expect(Math.abs(t.baseStats.range - band) <= 60, `${t.id} range ${t.baseStats.range} vs band ${band}`).toBe(true);
    }
  });
});
```

Run: `npm test -- weapon-migration`
Expected: PASS. (If the band test fails for a brand-new tower, nudge its authored `baseStats.range` toward `FAMILY[family].range`. If it fails for a *pre-existing* tower whose identity range is intentionally far from the band, relax that specific case — but for the 16 new towers, keep them in band.)

- [ ] **Step 3: Final verification + commit**

Run: `npm run build` (runs `tsc --noEmit` + vite build)
Expected: PASS.

```bash
git add -A -- src/data tests public/assets/sprites
git commit -m "feat(roster): 16 new towers fill bow/gun/crossbow/tome/scepter/wand/orb families

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1 taxonomy → Task 1 (`weaponFamily.ts` + `FAMILY` table). ✓
- §2 structured `WeaponSpec`, derived `damageType`, rewritten `attackStyleFor`, `CollectionScene` display, `weaponRange` fold, hero `WeaponType` subset alias → Tasks 2,3,4,6. ✓
- §3 audit/re-tag of 37 existing towers, display touch-ups (doro, glace), zero drift → Tasks 5,6 + parity test Task 7. ✓
- §4 16 new towers across empty families → Tasks 8,9. ✓
- §5 enforcement (derivation stability, migration parity, family coverage, <500-line split) → Tasks 7,9 + `towersC.ts` note. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Migration values are spelled out per tower; new-tower specs give exact family/element/role/rarity. The only delegated generation is `create-character` (a skill that owns stats/art by design), with explicit weapon assignments supplied. ✓

**Type consistency:** `WeaponSpec`/`WeaponFamily`/`WeaponElement`/`FAMILY`/`deriveDamageType`/`weaponBaseRange` defined in Task 1 and used identically in Tasks 2,3,4,6,7,9. `t()` input type `TowerInput` drops `damageType` consistently with Tasks 5–6 (which delete the field). `attackStyleFor` reads `def.meta?.weapon` matching the new `CharacterMeta.weapon: WeaponSpec`. ✓
