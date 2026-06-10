# Item Balancing

Item power is anchored to **rarity** and **required level**, not free-handed.
The catalog already encodes the curve — match it rather than inventing numbers.

## Rarity tiers (the spine)

From `RARITY_TIERS` in `src/data/items.ts` — a generated line multiplies its
Common baseline by these:

| Rarity | Prefix | Req lvl | stat × | primary × | affixes rolled |
|--------|--------|--------:|-------:|----------:|---------------:|
| Common | Worn | 1 | 1.00 | 1.0 | 0 |
| Magic | Fine | 10 | 1.35 | 1.5 | 1 |
| Rare | Masterwork | 22 | 1.80 | 2.1 | 2 |
| Legendary | Heroic | 40 | 2.40 | 2.9 | 3 |
| Unique | Mythic | 60 | 3.00 | 3.7 | 3 |

A base/signature item picks ONE rarity and uses comparable absolute numbers to
the generated items at that tier (look at neighbors in `ITEM_CATALOG`).

## How to set numbers

1. **Find the closest existing item** of the same slot + rarity in `items.ts` and
   start from its `baseStats` / `primaryAffix.baseValue`. Nudge to taste; don't
   leap.
2. **Primary affix = identity.** One stat that says what the item is *for*
   (a Bow → `attackSpeed`; a tank chest → `armor`/`damageReduction`; a gold pet →
   `goldFind`). Make it the strongest line on the tooltip.
3. **affixPool = flavor rolls.** 2–4 stats that fit the fantasy; rarity decides
   how many actually roll.
4. **Required level** comes from the rarity tier (or the source's power for a
   signature). Base scalar stats scale UP with required level at roll time, so a
   high-req item is automatically stronger — don't double-count that in baseStats.

## Stat caps & gotchas (enforced by tests)

- **Crit is flat-added** (`critRate`, `critDamage`). It uses the tighter
  `AFFIX_RANGE` and a halved rarity ramp (`critDamp`) so top-tier crit gear can't
  stack to absurd chance. `tests/item-catalog.test.ts` fails if a single item can
  roll > ~30% total crit. Keep crit primaries/bases modest.
- **Fractional stats** (crit, pen, %, omnivamp) do NOT scale with item level —
  only scalar stats (atk/hp) do.
- `primaryAffix.baseValue` must be `> 0`; `requiredLevel >= 1`; weapons need a
  valid `weaponType`. All checked by `validateItemDef` + the content tests.

## Economy

`itemValue()` = `RARITY_BASE_PRICE[rarity]` (120 / 300 / 700 / 1600 / 3600) scaled
gently by required level; sell-back is 75%. New items inherit this automatically —
no per-item pricing needed.

For deeper systemic balancing (drop rates, economy pacing), use the
`game-designer` skill. Character stat budgets live in
`.claude/skills/create-character/references/balancing.md`.
