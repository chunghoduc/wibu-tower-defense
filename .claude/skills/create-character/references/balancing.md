# Balancing: stat budgets by rarity & role

These are starting budgets, derived from the existing roster, to keep new
characters in line. They are guidance, not law — nudge ±15% to express a
character, but a Common should never out-stat a Legendary of the same role. Final
numbers get tuned in playtest; aim for "feels right and consistent," not perfect.

Within a rarity, push a character toward the **high end if its source is strong for
that tier**, the low end if it's a weaker example. Across the whole roster, rarity
order is the dominant axis: Common < Magic < Rare < Legendary < Unique.

## Core scaling by rarity (baseline for the `damage` role)

| Rarity | atk | maxHp | range | cost | maxMana / onHit / regen | crit |
|--------|-----|-------|-------|------|--------------------------|------|
| Common | 12–16 | 100–130 | 120–135 | 40–55 | 50–60 / 7–9 / 1 | 0.10 / 1.5 |
| Magic | 18–24 | 140–180 | 130–150 | 70–90 | 70 / 10–12 / 1 | 0.15 / 1.6 |
| Rare | 28–34 | 190–220 | 150–170 | 95–115 | 70–80 / 13–15 / 1–2 | 0.20–0.25 / 1.8 |
| Legendary | 40–46 | 230–270 | 150–180 | 150–170 | 85–90 / 13–16 / 1–2 | 0.30–0.35 / 1.9–2.0 |
| Unique | 50–70 | 220–300 | 150–190 | 195–220 | 100–120 / 16–20 / 2 | 0.20–0.30 / 2.0–2.2 |

`attackSpeed` for `damage` is typically 0.7–1.4 (slower = harder hits). Use
`armorPen`/`magicPen` (0.3–0.5) for armor-shredders, `omnivamp` (0.1–0.15) for
sustain bruisers.

## Per-role adjustments (relative to the damage baseline)

- **splash** — `atk` ~0.65–0.8× baseline, slower `attackSpeed` (0.5–0.7). Set
  `splashRadius`: Common 55 → Magic 72 → Rare 86 → Legendary 96 → Unique 110–120.
- **chain** — `atk` ~0.8× baseline. `chainTargets`: Common 2 → Magic 3 → Rare 4 →
  Legendary 5 → Unique 6. `chainFalloff` 0.6 → 0.8 (higher rarity keeps more
  damage per bounce).
- **dot** — low `atk` (8–20, it's a chip-attack); the damage lives in the DoT.
  `dot.dps`: Common 7 → Magic 12 → Rare 16 → Legendary 24 → Unique 30.
  `dot.duration` 3–5s. DoT counters Regenerators — lean into that.
- **debuff** — low `atk` (8–30). `slow.pct`: 0.28 → 0.5 by rarity; `slow.duration`
  2–3s. `stun.chance` 0.2–0.45 with `stun.duration` 0.6–1.4s (reserve reliable
  stuns for higher rarity). CC-immune enemies ignore this — never the sole answer.
- **support** — very low `atk` (4–16), usually `maxMana: 0` (passive aura).
  `buffAura.radius` 120 → 185 by rarity; `atkPct` up to ~0.25 and/or
  `attackSpeedPct` up to ~0.18 at Unique. Support is force-multiplier, not DPS.

## True damage (skills only)

If the source's signature *ignores defenses*, grant True via the skill, not the
basic attack:
- Active: `behavior.activeType: "True"`.
- DoT: `behavior.dot.damageType: "True"`.
Use sparingly — it's the marquee payoff of Legendary/Unique kits, gated behind the
mana bar. A whole roster of True trivializes armor/resist design.

## Cost intuition

Cost roughly tracks rarity (see table) but also tempo: cheap early towers let the
player establish board presence; expensive Uniques are investments. A character
that generates value over time (dot, support) can cost a touch more than its raw
stats suggest.
