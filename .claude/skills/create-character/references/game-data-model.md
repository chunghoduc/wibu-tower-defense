# Game data model & hard rules

The source of truth is `src/data/schema.ts`. This file summarizes what a character
needs and the rules the content tests enforce. If schema.ts and this file ever
disagree, schema.ts wins — re-read it.

## The hard rules (non-negotiable)

1. **Original homages only.** Never use a real anime character's name, exact
   likeness, or signature catchphrase. Create an original name + original lore that
   *evokes* the archetype. Using real names/likenesses in a monetized game is
   copyright/trademark infringement. Record the inspiration as a
   `// homage: <character> (<anime>)` code comment — it is NOT shipped to players.
2. **Basic attacks are Physical or Magic only.** `damageType` must be `"Physical"`
   or `"Magic"`. **True damage comes only from skills** — set it via
   `behavior.activeType: "True"` (active skill) or a DoT
   `behavior.dot.damageType: "True"`. This makes True the special payoff of a
   signature, defense-ignoring move.
3. **Role × rarity grid.** Every role should have at least one character of each
   rarity. Prefer filling empty cells. Rarity must track the source's power level.
4. **Lore required.** `description` must be a non-empty, original blurb.

The content tests in `tests/content.test.ts` check rules 2–4 automatically.

## CharacterDef fields (the `t({...})` entry)

```ts
{
  id: string;            // kebab-case, unique (e.g. "kilo-lightning-hand")
  name: string;          // original homage display name
  rarity: "Common" | "Magic" | "Rare" | "Legendary" | "Unique";
  role: "damage" | "splash" | "chain" | "dot" | "debuff" | "support";
  damageType: "Physical" | "Magic";        // basic attack only
  target: "Ground" | "Air" | "Both";
  cost: number;          // in-battle gold to place
  description: string;   // original lore, 1-2 sentences
  passives: string[];    // 1-3 skill ids (kebab-case)
  active: string | null; // 1 active skill id, auto-casts at full mana
  behavior?: TowerBehavior;   // role-specific tuning (below)
  baseStats: Stats;      // use makeStats({...}); see references/balancing.md
  // artRef is added automatically by the t() helper as "placeholder"
}
```

## TowerBehavior — fill what the role uses

| Role | Required behavior |
|------|-------------------|
| `damage` | none (optionally `activeType: "True"` for a defense-ignoring ult) |
| `splash` | `splashRadius: number` |
| `chain` | `chainTargets: number`, `chainFalloff: number` (0..1 retained per bounce) |
| `dot` | `dot: { dps, duration, damageType? }` (set `damageType:"True"` for an absolute DoT) |
| `debuff` | `slow: { pct, duration }` and/or `stun: { duration, chance }` |
| `support` | `buffAura: { radius, atkPct?, attackSpeedPct? }` |

`activeType?: "Physical" | "Magic" | "True"` overrides the active skill's damage
type (default = the character's `damageType`). Use `"True"` only for signature
moves that ignore defenses in the source.

## Stats (the 24-stat system)

Build with `makeStats({ ... })` (everything defaults to 0 except critDamage=1.5,
skillPower=1). Common fields you'll set: `atk, attackSpeed, range, critRate,
critDamage, armorPen, magicPen, skillPower, maxHp, omnivamp, maxMana, manaOnHit,
manaRegen`. Percent-style stats are fractions (0.25 = 25%). Static towers leave
`moveSpeed` at 0. See `references/balancing.md` for budgets.

## Enemy immunity interaction (design for counterplay)

Enemies may be immune to ONE of {Physical, Magic, CC, AoE}. Don't design a
character that's the *only* answer to anything; the roster should always offer 2+
ways to deal with a threat. A True-damage signature is a good universal answer but
should be gated behind mana (a payoff, not a default).

## Where to add the character & how to verify

1. Add the `t({...})` entry to the `TOWERS` array in `src/data/towers.ts`, in the
   section for its role.
2. (Optional) If it should appear on the in-battle build bar, add its `id` to
   `SQUAD_IDS` in `src/scenes/BattleScene.ts` (the squad is 7).
3. Verify:
   ```bash
   npm run typecheck && npm test
   ```
   `tests/content.test.ts` enforces the rules above. Green = correctly wired.
