# Lean Item Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the rarity-prefix adjective (`Worn`/`Fine`/`Masterwork`/`Heroic`/`Mythic`) from generated item-line display names so each line leads with its lean, famous-evoking homage base across all rarities.

**Architecture:** Two name-baking sites in `src/data/items.ts` (the generation loop and the lore-merge branch) currently prepend `tier.prefix` to the display `name`. Both change to use the bare base name. Item `id`s and the `RARITY_TIERS.prefix` field are untouched (ids are save keys + PNG anchors; the prefix still builds the id). All other systems read `def.name` unchanged.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Lock the lean-name contract with a failing test

**Files:**
- Test: `tests/item-catalog.test.ts` (append a new `describe`/`it`)

- [ ] **Step 1: Write the failing test**

Append to `tests/item-catalog.test.ts` (after the existing top-level imports it already has `ITEM_CATALOG`, `ITEM_CATALOG_MAP`):

```ts
describe("lean item names (no rarity-prefix adjective)", () => {
  const RARITY_WORDS = ["Worn", "Fine", "Masterwork", "Heroic", "Mythic"];
  const LINE_IDS = [
    "kingsworn-brand", "galewind-longbow", "mithrilweave-shirt",
    "warblade", "longbow", "platemail",
  ];

  it("a generated line shows the same bare base name across all five tiers", () => {
    for (const line of LINE_IDS) {
      const names = ["worn", "fine", "masterwork", "heroic", "mythic"].map(
        (p) => ITEM_CATALOG_MAP.get(`${p}-${line}`)!.name,
      );
      // identical across tiers
      expect(new Set(names).size, `${line} names: ${names.join(" | ")}`).toBe(1);
      // and free of any rarity-prefix word
      for (const n of names) {
        for (const w of RARITY_WORDS) {
          expect(n.startsWith(w + " "), `${line} -> "${n}"`).toBe(false);
        }
      }
    }
  });

  it("no generated-line catalog item name starts with a rarity-prefix word", () => {
    for (const def of ITEM_CATALOG) {
      const dash = def.id.indexOf("-");
      const idPrefix = dash > 0 ? def.id.slice(0, dash) : "";
      if (!["worn", "fine", "masterwork", "heroic", "mythic"].includes(idPrefix)) continue;
      for (const w of RARITY_WORDS) {
        expect(def.name.startsWith(w + " "), `${def.id} -> "${def.name}"`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/item-catalog.test.ts -t "lean item names"`
Expected: FAIL — names are currently `"Worn Kingsworn Brand"` etc., so `startsWith("Worn ")` is true and the set has 5 distinct names.

---

### Task 2: Drop the prefix from the generation loop

**Files:**
- Modify: `src/data/items.ts` (the `for (const line of ITEM_LINES)` generation loop, the `name:` field)

- [ ] **Step 1: Edit the generated name**

In `src/data/items.ts`, inside `generatedItems.push(i({ ... }))`, change:

```ts
      name: `${tier.prefix} ${line.base}`,
```

to:

```ts
      name: line.base,
```

(The `id: \`${tier.prefix.toLowerCase()}-${line.id}\`` line directly above is UNCHANGED — the prefix still builds the id.)

- [ ] **Step 2: Run the contract test** (still partially failing is OK here)

Run: `npx vitest run tests/item-catalog.test.ts -t "lean item names"`
Expected: the `warblade/longbow/platemail` cases (lines without lore) now pass; lines WITH lore (`kingsworn-brand`, `galewind-longbow`, `mithrilweave-shirt`) still FAIL because the lore-merge branch re-applies the prefix. Proceed to Task 3.

---

### Task 3: Drop the prefix from the lore-merge branch

**Files:**
- Modify: `src/data/items.ts` (the `for (const def of ITEM_CATALOG)` lore-merge loop)

- [ ] **Step 1: Edit the lore-base name branch**

In `src/data/items.ts`, in the lore-merge loop, change:

```ts
  } else if (lore.base) {
    const prefix = def.id.slice(0, def.id.indexOf("-"));
    def.name = `${cap(prefix)} ${lore.base}`;
  }
```

to:

```ts
  } else if (lore.base) {
    def.name = lore.base;
  }
```

- [ ] **Step 2: Check for an now-unused `cap` helper**

Run: `grep -n "cap(" src/data/items.ts`
If `cap` is no longer referenced anywhere, remove its declaration line
`const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);` to avoid an
unused-variable lint/tsc error. If it is still used, leave it.

- [ ] **Step 3: Run the contract test**

Run: `npx vitest run tests/item-catalog.test.ts -t "lean item names"`
Expected: PASS (both `it` blocks).

---

### Task 4: Update stale comments to match the new behavior

**Files:**
- Modify: `tests/item-catalog.test.ts:131` (comment)
- Modify: `src/data/itemLore.ts` (doc comment around line 15)

- [ ] **Step 1: Fix the test comment**

In `tests/item-catalog.test.ts`, the existing expansion test has:

```ts
      // Name is the rarity-prefixed homage base, never a raw "Mythic <lineId>".
```

Change to:

```ts
      // Name is the bare homage base (no rarity prefix), never a raw lineId.
```

- [ ] **Step 2: Fix the itemLore.ts doc comment**

In `src/data/itemLore.ts`, the header comment says the catalog renders
`${rarityPrefix} ${base}` (e.g. "Mythic Hollowmoon Cleaver"). Change that
sentence to reflect that generated lines now display the bare `base` name
across all tiers (rarity is conveyed by color/level/stats, not a name prefix);
the `id` still carries the tier prefix. Keep it concise — one or two sentences.

- [ ] **Step 3: Commit**

```bash
git add src/data/items.ts src/data/itemLore.ts tests/item-catalog.test.ts \
  docs/superpowers/specs/2026-06-12-lean-item-names-design.md \
  docs/superpowers/plans/2026-06-12-lean-item-names.md
git commit -m "feat(items): lean display names — drop rarity-prefix adjective

Generated item lines now show their bare homage base name across all five
rarities (e.g. \"Kingsworn Brand\" not \"Worn Kingsworn Brand\"). IDs keep the
tier prefix (save keys + PNG anchors). Names lead with the famous-evoking word.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all green (the existing `item-catalog` expansion contracts still pass;
the new lean-name contract passes).

- [ ] **Step 3: Spot-check a few names**

Run:
```bash
node --input-type=module -e "import('./src/data/items.ts').then(m=>{const g=id=>m.ITEM_CATALOG_MAP.get(id).name;console.log(['worn-kingsworn-brand','mythic-kingsworn-brand','fine-galewind-longbow','heroic-mithrilweave-shirt','worn-warblade'].map(g).join('\n'))})"
```
Expected: `Kingsworn Brand` / `Kingsworn Brand` / `Galewind Longbow` /
`Mithrilweave Shirt` / `Warblade` (no rarity prefixes). If `node` cannot import
`.ts` directly, skip this step — the vitest contract already proves it.
```
```

---

## Self-Review

**Spec coverage:**
- Drop prefix in generation loop → Task 2 ✓
- Drop prefix in lore-merge branch → Task 3 ✓
- Keep ids / `RARITY_TIERS.prefix` → explicit "UNCHANGED" notes in Tasks 2–3 ✓
- RED test: same bare name across tiers + no prefix word → Task 1 ✓
- Catalog-wide guard against prefix creep → Task 1 second `it` ✓
- Existing expansion contracts still pass + fix stale comment → Tasks 4–5 ✓
- Hand-authored base items unaffected (carry `lore.name`) → not a gap; no code path touched ✓

**Placeholder scan:** none.

**Type consistency:** `def.name` is a `string`; `line.base` / `lore.base` are
`string`. `ITEM_CATALOG_MAP.get(id)!.name` matches existing usage in the test
file. No new types introduced.
