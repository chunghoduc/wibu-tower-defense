---
name: create-character
description: >-
  Create a new playable character (collectible tower) for the Wibu Tower Defense
  game and wire it into the data catalog. Use this whenever the user wants to add
  a character, unit, tower, or anime-homage to the game, expand the roster, fill a
  role/rarity gap, or says things like "add a new character", "make a [anime]
  homage tower", "we need a Rare support unit", or "design a character based on
  X". Runs a fixed pipeline (story -> character -> trait analysis -> stats/skills
  -> art -> animation) so every new character is balanced, legally safe, and
  consistent with the existing roster. Prefer this skill over hand-editing
  towers.ts directly.
---

# Create Character

This skill adds a new collectible character (deployed in battle as a tower) to
**Wibu Tower Defense**. Characters are **original homages** to iconic anime — they
*evoke* a famous character's vibe but never copy real names, likenesses, or
signature lines (this is a legal requirement, not a style choice — see
`references/game-data-model.md`).

Follow the six-stage pipeline in order. Each stage has a concrete output that
feeds the next. Do not skip to "write the code" — the earlier stages are what make
the character feel *right* and stay balanced.

## Why a pipeline

A good collectible character is a tight loop: a recognizable fantasy (the source),
a mechanical identity (role + damage type), a power level that matches both its
rarity and its source's strength, and art/animation that reads at a glance. Doing
these out of order produces characters that are mechanically flat or tonally off.
The pipeline forces the fantasy to drive the mechanics, then the mechanics to
drive the art.

Before starting, skim `references/game-data-model.md` (the data contract and the
hard rules) and `references/balancing.md` (the stat budgets). Keep them open.

---

## Stage 1 — Story selection

Pick the **source anime/franchise** the character will pay homage to.

- If the user named one, use it. Otherwise propose 2-3 famous, all-time options
  and let them choose (variety across franchises keeps the roster interesting).
- Capture *why* it fits: tone, era, the kind of powers it's known for.

**Output:** the chosen franchise + a one-line reason.

## Stage 2 — Character selection

Pick the **specific iconic character** within that story to homage.

- Prefer recognizable, beloved characters — the homage only lands if players feel
  the reference.
- Note the source character's **canonical power tier** (street-level vs
  world-ending). This directly sets rarity in Stage 3. A famously weak character
  should become a low rarity; a top-tier powerhouse a high one.

**Output:** the source character + a power-tier read (weak / mid / strong /
top-tier).

## Stage 3 — Analyze character traits

Translate the source into game terms. Decide each, with a sentence of reasoning:

1. **Role** — damage, splash, chain, dot, debuff, or support. Map the fighting
   style: single-target bruiser/marksman → `damage`; explosive/AoE → `splash`;
   lightning/multi-hit → `chain`; poison/burn/decay → `dot`; ice/sand/binding →
   `debuff`; healer/buffer/commander → `support`.
2. **Rarity** — from the power-tier read in Stage 2 (Common → Magic → Rare →
   Legendary → Unique).
3. **Damage type** — `Physical` or `Magic` for the basic attack ONLY. (Energy/ki,
   elemental, cursed → Magic; pure martial/weapon → Physical.)
4. **Target** — Ground, Air, or Both (ranged/projectile/energy users usually Both;
   melee usually Ground).
5. **Signature skill concept** — the one move everyone remembers. If that move
   *ignores defenses* in the source (a reality-warp, an absolute attack, a
   one-shot), the active or DoT should deal **True** damage (the only path to True
   — see the data model).
6. **Personality hook** — one trait to carry into the lore.

**Check the roster grid first.** Open `src/data/towers.ts` and confirm whether
this (role, rarity) cell is already filled. Every role should have one character
per rarity; prefer filling gaps. If the cell is full, that's fine for a marquee
character, but call it out to the user.

**Output:** role, rarity, damageType, target, signature concept, personality.

## Stage 4 — Design stats & skills

Produce the full `CharacterDef` and add it to the catalog.

1. **Stats** — use the rarity × role budgets in `references/balancing.md`. Higher
   rarity = higher numbers; match the source's strength within the tier. Give
   casters a mana bar (`maxMana`, `manaOnHit`, `manaRegen`); support towers
   usually have `maxMana: 0` (their aura is passive).
2. **Role behavior** — fill the `behavior` block the role needs (splashRadius /
   chainTargets+chainFalloff / dot / slow+stun / buffAura). See the data model.
3. **Skills** — 1–3 `passives` and one `active` skill id (kebab-case, evocative).
   These are data identifiers for now (the per-skill effect engine is Phase 3);
   the active auto-casts as an AoE burst. If the signature is an
   ignores-defense move, set `behavior.activeType: "True"` (or a DoT
   `damageType: "True"`).
4. **Original name + lore** — an original homage name (NOT the real character's
   name) and a 1–2 sentence `description` that evokes the source without copying
   protected text. Add a `// homage: <character> (<anime>)` comment — a designer
   note, never shipped to players.
5. **Cost** — scale with rarity/power (see balancing).
6. **Add it** to the `TOWERS` array in `src/data/towers.ts` using the existing
   `t({...})` helper, placed in its role section.

**Then verify** (this is how you know it's wired correctly):
```bash
npm run typecheck && npm test
```
The content tests enforce the rules (Phys/Magic-only attacks, role behavior
present, role×rarity coverage, non-empty lore). Fix anything they flag.

**Output:** a committed-quality `CharacterDef` entry that passes typecheck + tests.

## Stage 5 — Art design

Design the 8-bit pixel sprite. The game is data-driven and art is authored last,
so the deliverable here is a **sprite spec + a reusable AI-generation prompt**, and
setting the character's `artRef`. Follow `references/art-animation.md` for the
canonical dimensions, palette discipline, and the prompt template. The silhouette
must read at small size and signal the character's role and rarity.

**Output:** an art spec + filled-in AI-gen prompt; `artRef` set (placeholder until
the asset exists).

## Stage 6 — Animation design

Plan the sprite's animation set: `idle`, `attack`, `hit`, `death`, and an
`active-cast` flourish for the signature skill. Specify frame counts and timing
per `references/art-animation.md`, matching the character's attack speed so the
attack animation reads in rhythm with its cadence.

**Output:** an animation frame plan (states, frame counts, timing notes).

---

## Wrap up

Summarize the new character to the user: the homage and source, role/rarity/damage
type, signature skill, key stats, and the art/animation plan. Confirm tests pass.
Offer to commit (Conventional Commit, e.g. `feat(content): add <name> (<role>
<rarity>)`).
