# Side-by-side Item Compare Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the inventory compare-and-replace modal so the selected (bag) item and the equipped item sit as two cards side by side, deltas in brackets on the left, Enhance under the left card and Replace under the right.

**Architecture:** Pure-data change first — `CompareRow` gains an additive `bag` formatted value (selected item's value). Then rewrite the Phaser presenter `itemCompareDialog.ts` into a two-column layout driven by the existing union row list. `HeroScene` and the `CompareCallbacks` contract are untouched.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Game stage is 960×540.

---

### Task 1: Add the selected-item value to `CompareRow`

**Files:**

- Modify: `src/data/itemCompare.ts`
- Test: `tests/item-compare.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/item-compare.test.ts` inside the existing `describe("compareItems — base stat diffs")` block (or a new `describe`):

```ts
describe("compareItems — selected (bag) value column", () => {
  it("exposes the selected item's formatted value per row", () => {
    const bag = ref({ rolledStats: { maxHp: 100, armor: 50 } });
    const equipped = ref({ rolledStats: { armor: 52, magicResist: 50 } });
    const { stats } = compareItems(bag, equipped);
    const byLabel = (l: string) => stats.find((r) => r.label === l)!;

    expect(byLabel("HP").bag).toBe("100"); // selected has it, equipped doesn't
    expect(byLabel("Armor").bag).toBe("50"); // both have it
    expect(byLabel("M.Resist").bag).toBe("0"); // equipped-only → selected shows 0
  });

  it("scales the selected value by enhance level", () => {
    const bag = ref({ rolledStats: { armor: 20 }, enhanceLevel: 5 }); // ×1.4 → 28
    const equipped = ref({ rolledStats: { armor: 20 } });
    expect(compareItems(bag, equipped).stats.find((r) => r.label === "Armor")!.bag).toBe("28");
  });

  it("formats fractional / affix selected values as percent", () => {
    const bag = ref({ rolledStats: { critRate: 0.22 } });
    const equipped = ref({ rolledStats: { critRate: 0.1 } });
    expect(compareItems(bag, equipped).stats.find((r) => r.label === "Crit")!.bag).toBe("22%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/item-compare.test.ts`
Expected: FAIL — `bag` is `undefined` (property does not exist on `CompareRow`).

- [ ] **Step 3: Add the field and populate it**

In `src/data/itemCompare.ts`, add to the `CompareRow` interface (after `equipped`):

```ts
/** The selected (bag) item's value, formatted (the number you'd gain by equipping it). */
bag: string;
```

In the `row()` helper, add `bag: fmt(bagV)` to the returned object (alongside `equipped: fmt(eqV)`):

```ts
return {
  label,
  equipped: fmt(eqV),
  bag: fmt(bagV),
  delta: zero ? "0" : (d > 0 ? "+" : "-") + mag,
  dir: zero ? 0 : d > 0 ? 1 : -1,
};
```

- [ ] **Step 4: Run the whole compare test file**

Run: `npx vitest run tests/item-compare.test.ts`
Expected: PASS (new `bag` assertions + all pre-existing `equipped`/`delta`/`dir` assertions).

- [ ] **Step 5: Commit**

```bash
git add src/data/itemCompare.ts tests/item-compare.test.ts
git commit -m "feat(compare): expose selected-item value on CompareRow"
```

---

### Task 2: Two-column compare dialog presenter

**Files:**

- Modify (rewrite render body): `src/scenes/itemCompareDialog.ts`

No test (Phaser presenter — verified by build + CDP playtest, consistent with the
existing untested dialogs). Keep the file < 500 lines.

- [ ] **Step 1: Rewrite `renderCompareDialog`**

Replace the body of `src/scenes/itemCompareDialog.ts` from the constants block down with
the two-column layout below. Keep the file header comment, the `RARITY_HEX` / `RARITY_INT`
/ `SLOT_LABEL` maps, the `DELTA_COLOR` map, and the `CompareCallbacks` interface. Update
the geometry constants and the render function:

```ts
const W = 430; // wider: two columns on the 960-wide stage
const COL_GAP = 14;
const PAD = 14;
const ROW_H = 19;
const HEADER_H = 74; // icon + name + section legend
const SECTION_H = 22;
const FOOTER_H = 64;

/** Render the compare-and-replace modal into `dialog` and make it visible. */
export function renderCompareDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  bag: ItemRef,
  equipped: ItemRef,
  slot: ItemSlot,
  cb: CompareCallbacks,
): void {
  dialog.removeAll(true);
  const { stats, affixes } = compareItems(bag, equipped);

  let bodyRows = SECTION_H + Math.max(1, stats.length) * ROW_H;
  if (affixes.length) bodyRows += SECTION_H + affixes.length * ROW_H;
  const H = HEADER_H + bodyRows + FOOTER_H;
  const dx = (scene.scale.width - W) / 2;
  const dy = Math.max(20, (scene.scale.height - H) / 2 - 6);

  // Column geometry (x offsets relative to dx).
  const colW = (W - PAD * 2 - COL_GAP) / 2;
  const leftX = PAD; // left card origin
  const rightX = PAD + colW + COL_GAP;
  const midX = PAD + colW + COL_GAP / 2;

  const g = scene.add.graphics();
  g.fillStyle(0x070b12, 0.6).fillRect(0, 0, scene.scale.width, scene.scale.height); // scrim
  g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(2, RARITY_INT[bag.def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
  // faint divider between the two cards
  g.lineStyle(1, 0x2a3650, 0.8).lineBetween(dx + midX, dy + 10, dx + midX, dy + H - FOOTER_H + 2);
  const scrim = scene.add
    .zone(0, 0, scene.scale.width, scene.scale.height)
    .setOrigin(0)
    .setInteractive();
  scrim.on("pointerup", cb.onClose);
  dialog.add(g);
  dialog.add(scrim);

  const txt = (
    xx: number,
    yy: number,
    s: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) => {
    const t = crispText(scene, dx + xx, dy + yy, s, {
      fontSize: "12px",
      color: "#dfe8f3",
      ...style,
    });
    dialog.add(t);
    return t;
  };
  const enh = (r: ItemRef) => (r.inst.enhanceLevel ? ` +${r.inst.enhanceLevel}` : "");

  // ---- column headers: icon + label + item name ----
  const header = (originX: number, tag: string, ref: ItemRef) => {
    const icon = makeFitIcon(scene, dx + originX + 16, dy + 26, `item__${ref.def.id}`, 30, "❔");
    icon.setDepth(0);
    dialog.add(icon);
    txt(originX + 36, 10, tag, { fontSize: "9px", color: "#7e8ea3" });
    txt(originX + 36, 22, `${ref.def.name}${enh(ref)}`, {
      fontSize: "12px",
      color: RARITY_HEX[ref.def.rarity],
      fontStyle: "bold",
      wordWrap: { width: colW - 40 },
    });
  };
  header(leftX, "SELECTED", bag);
  header(rightX, `EQUIPPED · ${SLOT_LABEL[slot]}`, equipped);
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(
    dx + PAD,
    dy + HEADER_H - 6,
    dx + W - PAD,
    dy + HEADER_H - 6,
  );

  // ---- rows: same stat at the same y in both columns ----
  let y = HEADER_H;
  const section = (title: string) => {
    txt(leftX + 4, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" });
    txt(rightX + 4, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" });
    y += SECTION_H;
  };
  const rowLine = (r: CompareRow) => {
    // left card: label … bag value (delta bracket)
    txt(leftX + 6, y, r.label, { fontSize: "12px", color: "#cdd9ea" });
    txt(leftX + colW - 52, y, r.bag, { fontSize: "12px", color: "#dfe8f3" }).setOrigin(1, 0);
    txt(leftX + colW - 2, y, `(${r.delta})`, {
      fontSize: "11px",
      color: DELTA_COLOR[String(r.dir) as "0"],
      fontStyle: "bold",
    }).setOrigin(1, 0);
    // right card: label … equipped value
    txt(rightX + 6, y, r.label, { fontSize: "12px", color: "#cdd9ea" });
    txt(rightX + colW - 2, y, r.equipped, { fontSize: "12px", color: "#dfe8f3" }).setOrigin(1, 0);
    y += ROW_H;
  };

  section("Stats");
  if (stats.length) stats.forEach(rowLine);
  else {
    txt(leftX + 6, y, "No base stats.", { fontSize: "11px", color: "#7c8aa0" });
    y += ROW_H;
  }

  if (affixes.length) {
    section("Affixes");
    affixes.forEach(rowLine);
  }

  // ---- footer buttons: Enhance under left card, Replace under right card ----
  const btnY = dy + H - 46;
  const enhance = crispText(scene, dx + leftX + colW / 2, btnY, "⚒  Enhance", {
    fontSize: "14px",
    color: "#dfe8f3",
    backgroundColor: "#26344a",
  })
    .setOrigin(0.5, 0)
    .setPadding(14, 8, 14, 8)
    .setInteractive({ useHandCursor: true });
  enhance.on("pointerup", cb.onEnhance);
  dialog.add(enhance);

  const replace = crispText(scene, dx + rightX + colW / 2, btnY, "⇄  Replace", {
    fontSize: "14px",
    color: "#fff",
    backgroundColor: "#1565c0",
  })
    .setOrigin(0.5, 0)
    .setPadding(14, 8, 14, 8)
    .setInteractive({ useHandCursor: true });
  replace.on("pointerup", cb.onReplace);
  dialog.add(replace);

  const close = crispText(scene, dx + W - 14, dy + 8, "✕", { fontSize: "16px", color: "#ef9a9a" })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", cb.onClose);
  dialog.add(close);

  dialog.add(
    panelText(scene, dx + PAD, dy + H - 16, "Bracket = change vs equipped · Green up · Red down", {
      fontSize: "9px",
      color: "#6c7c93",
    }),
  );

  dialog.setVisible(true);
}
```

- [ ] **Step 2: Add the `makeFitIcon` import**

At the top of `src/scenes/itemCompareDialog.ts`, add:

```ts
import { makeFitIcon } from "./itemIcon.ts";
```

(Verify `makeFitIcon` is exported from `src/scenes/itemIcon.ts` — it is.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; bundle builds.

- [ ] **Step 4: Confirm file size**

Run: `wc -l src/scenes/itemCompareDialog.ts`
Expected: well under 500.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/itemCompareDialog.ts
git commit -m "feat(compare): two-column side-by-side compare dialog"
```

---

### Task 3: Verify end-to-end

**Files:** none (verification only).

- [ ] **Step 1: Full test suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: CDP playtest**

Open HeroScene, force the compare dialog via `window.__game`, confirm: two columns; the
left card shows the selected item with `(±delta)` brackets coloured green/red; a stat the
equipped item has but the selected lacks appears as a left row with `0 (-x)`; `⚒ Enhance`
sits under the left card and `⇄ Replace` under the right; tapping the scrim / ✕ closes; no
errors in `logs/runtime.log`.

- [ ] **Step 3: Update memory**

Update `memory/project_inventory_compare_replace.md` to note the compare dialog is now a
two-column side-by-side layout (selected left + Enhance, equipped right + Replace, deltas
bracketed on the left over the union of both items' stats), and add the index line if the
hook text changes.

---

## Self-Review

**Spec coverage:**

- Req 1 (two items side by side, selected left / equipping right) → Task 2 two-column layout. ✓
- Req 2 (Enhance under left, Replace under right) → Task 2 footer buttons. ✓
- Req 3 (deltas in bracket on left + extra rows for equipped-only stats) → Task 1 `bag` field + Task 2 left-column bracket; union already provided by `compareItems`. ✓

**Placeholder scan:** none — all code shown in full.

**Type consistency:** `CompareRow.bag` added in Task 1 and consumed as `r.bag` in Task 2. `makeFitIcon(scene,x,y,key,fit,fallback)` matches the signature in `itemIcon.ts`. `DELTA_COLOR`, `RARITY_HEX`, `RARITY_INT`, `SLOT_LABEL`, `panelText`, `crispText` all already exist in the file/imports. Callbacks `onEnhance`/`onReplace`/`onClose` unchanged → no `HeroScene` edit needed.
