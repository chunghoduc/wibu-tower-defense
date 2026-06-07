---
name: sprite-batch-run
description: Run a full sprite generation batch for one or all entity kinds using parallel agents. Use when asked to generate sprites for a whole category (all towers, all enemies, etc.) or the entire roster.
metadata:
  type: project-skill
  project: wibu-td-designer
---

# Skill: sprite-batch-run

Generates all sprites for a given entity kind (or the full roster) by dispatching
independent parallel agents — one per sprite — then verifying all outputs before
writing to the game directory.

Wraps: `superpowers:dispatching-parallel-agents` + `generate-sprite` + `superpowers:verification-before-completion`

## Step 1 — Pre-flight

```bash
curl -s http://127.0.0.1:8765/health   # Must show ready:true
node src/cli.ts plan [kind]             # Lists every sprite, path, seed
```

If the API is not ready, stop and report — do not queue a batch.

## Step 2 — Determine work list

```bash
node src/cli.ts plan <kind>
```

Returns one line per entity: `<key> | <path> | <frameWidth> | <frameHeight> | <frames>`.

Partition the list. Each entity is fully independent — they share no state. This is the
right condition for parallel dispatch (`superpowers:dispatching-parallel-agents`).

## Step 3 — Dispatch parallel agents

Dispatch one agent per entity. Each agent's prompt must be self-contained:

```
Generate the sprite for <kind>__<entity-id> in the wibu-td-designer project.

Context:
- Working dir: /home/shyaken/Workplace/wibu-td-designer
- Game sprite dir: /home/shyaken/Workplace/wibu-tower-defense/public/assets/sprites/
- Entity: <entity-id>, kind: <kind>
- Target: <frameWidth>x<frameHeight>px, <frames> frame(s)
- Prompt: <exact prompt from catalog>
- Seed: <deterministic seed = hash of entity-id>

Steps:
1. Check API ready: curl -s http://127.0.0.1:8765/health
2. Generate image(s) via POST /generate
3. Run: node src/cli.ts generate <key>
4. Run: node src/cli.ts verify <key>
5. Report: PASS or FAIL with evidence

Return: one line — "<key>: PASS" or "<key>: FAIL — <reason>"
```

Maximum concurrent agents: cap at 8 (the GPU processes images one at a time anyway;
extra concurrency just queues them efficiently without memory pressure).

## Step 4 — Collect results

After all agents return:
- Count PASSes and FAILs.
- For each FAIL: log the reason, then retry once with a tweaked prompt (add more detail,
  change seed +1000).
- If a sprite fails twice: write `<key>: PLACEHOLDER` and continue — the game's
  PreloadScene falls back to shapes; do not block the batch on a single bad sprite.

## Step 5 — Batch verification (`superpowers:verification-before-completion`)

Run the full verify sweep before reporting the batch complete:

```bash
node src/cli.ts verify <kind>    # All sprites of this kind
```

Must report:
- Total sprites verified
- Pass count / fail count
- Any dimension mismatches
- Any missing alpha channels

**Do not report the batch as done until you have this output in hand and have read it.**

## Step 6 — Report

Give the user:
- Total generated / total skipped (PLACEHOLDER) / total failed after retry
- Any sprites needing manual review (listed by key)
- Path to `samples/` gallery for visual review

## Ordering advice

Generate in this order if doing the full roster, to catch style drift early:
1. `hero` (1 sprite) — establishes the style anchor
2. `tower` (32 sprites) — largest category, most visible
3. `boss` (10 sprites) — high-impact, worth reviewing mid-batch
4. `enemy` (16 sprites)
5. `item` (20 sprites)
6. `vfx` (12 sprites)

Review the hero and 2–3 towers before committing to the full batch.
