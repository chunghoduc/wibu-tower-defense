---
name: design-new-character
description: Design a brand-new tower character, enemy, or boss for the Wibu TD game from scratch — concept through generated sprite. Use when the user wants to add a new character that does not yet exist in the game's data catalog.
metadata:
  type: project-skill
  project: wibu-td-designer
---

# Skill: design-new-character

Full pipeline from blank-slate idea to committed sprite and data entry.

Wraps: `brainstorming` → `deep-research` → `generating-images` → `generate-sprite` → `superpowers:verification-before-completion`

## Phase 1 — Brainstorm (invoke `brainstorming` skill)

Before writing a single line of data or code, invoke the `brainstorming` skill.

The brainstorm must answer:
- **Name:** Unique, fits the anime-homage naming convention (e.g. "kazu-spirit-brawler").
- **Kind:** tower | enemy | boss
- **Role** (tower only): damage | splash | chain | dot | support | debuff
- **Damage type:** Physical | Magic | True
- **Target** (tower only): ground | air | both
- **Rarity** (tower/item): Common | Magic | Rare | Legendary | Unique
- **Archetype** (enemy): Rusher | Brute | Bulwark | Mender | Regenerator | Splitter |
  Gargoyle | StormFlyer | Sapper | Phantom | Summoner | Raider | Courier | Boss
- **Flying:** yes | no
- **Silhouette concept:** 1-sentence visual description fitting the role silhouette guide
- **Lore:** 1–2 sentences (used verbatim in the art prompt)
- **Anime inspiration:** which real anime/manga character inspired this (for internal reference only)
- **Stats snapshot:** not full numbers — just the emphasis (e.g. "high ATK, low HP, fast attack speed")

Do NOT skip brainstorming for "obviously simple" characters. Silhouette conflicts and
role-overlap issues are caught here, not in the art.

## Phase 2 — Research references (invoke `deep-research` if needed)

If the character archetype, art style, or lore is unfamiliar:
- Use `deep-research` to look up relevant anime aesthetics, pixel art conventions,
  or Phaser sprite integration patterns.
- Specifically useful for: boss visual language, flying unit silhouettes,
  new damage type visual cues.

## Phase 3 — Draft the data entry

Write the TypeScript entry for the game's data catalog:

**For a tower** (`../wibu-tower-defense/src/data/towers.ts`):
```typescript
{
  id: "name-kebab-case",
  name: "Display Name",
  description: "Lore sentence.",
  role: "damage",          // one of the 6 roles
  damageType: "Physical",
  target: "ground",
  rarity: "Rare",
  baseAtk: 0,             // placeholder — balancing is separate
  baseHp: 0,
  baseAtkSpeed: 0,
  baseRange: 0,
  baseMana: 0,
  baseManaRegen: 0,
  baseManaOnHit: 0,
  activeSkillId: "iron-cleave",
  passiveSkills: [],
}
```

**For an enemy** (`../wibu-tower-defense/src/data/enemies.ts`): fill EnemyDef.
**For a boss**: set `archetype: "Boss"`.

After writing the entry, validate it compiles:
```bash
cd ../wibu-tower-defense && npm run typecheck
```

## Phase 4 — Generate the art prompt

```bash
node src/cli.ts prompts | grep "<new-id>"
```

If the new entity doesn't appear (because it's not in the game catalog yet), construct
the prompt manually using the same template as `artPrompts.ts`:

```
8-bit retro pixel art sprite, NES/SNES era, limited disciplined palette,
crisp single-pixel outline, strong readable silhouette, transparent background,
front-facing or 3/4 view, no text, no signature, centered
<dims> character sprite. Name: "<name>". Role: <role> tower (<silhouette>).
Attack: <damageType>; targets <target>. <rarity> rarity — accent colour <accent>, <treatment>.
Lore: <lore>. Provide 4 frames (idle, attack, hit, death) sharing one palette and silhouette.
```

## Phase 5 — Generate the sprite

Follow the `generate-sprite` skill for the full generation + post-processing + verify flow.

## Phase 6 — Review and commit

1. Send the preview image to the user:
   ```
   [[send: samples/<id>-preview.png]]
   ```
2. Wait for approval. If the user wants changes: adjust the prompt and re-generate (change seed).
3. Once approved, run `superpowers:verification-before-completion`:
   ```bash
   node src/cli.ts verify <kind>__<id>
   ```
4. Commit the new data entry + sprite together:
   ```bash
   cd ../wibu-tower-defense
   git add src/data/towers.ts public/assets/sprites/tower/<id>.png
   git commit -m "feat: add <name> (<role>, <rarity>)"
   ```

## Hard rules

- **A character that fails `verify` does not get committed.** Regenerate.
- **Do not invent stat numbers.** Leave placeholders; balancing is a separate task.
- **The anime inspiration stays internal.** It must not appear in any prompt, lore text,
  or committed document (copyright / homage, not copy).
- **One new character per brainstorm session.** Do not batch-brainstorm without separate
  approval for each.
