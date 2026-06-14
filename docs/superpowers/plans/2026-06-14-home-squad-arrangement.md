# Home Squad Arrangement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rearrange the home-screen squad lineup so towers never overlap the wall gear hangers or each other, and read as a staged forward wedge.

**Architecture:** All geometry stays in the pure, unit-tested helper `squadStandPoints` in `src/scenes/homeRoom.ts` (tightened x span, deeper flipped arc, new per-point `scale`). `MainMenuScene#drawSquad` consumes the new `scale` for sprite size and render depth. No new modules; no art regen.

**Tech Stack:** TypeScript, Phaser 3, Vitest.

---

### Task 1: Tighten span, stage the arc, add perspective scale (pure helper, TDD)

**Files:**
- Modify: `src/scenes/homeRoom.ts:77-90` (`StandPoint` + `squadStandPoints`)
- Test: `tests/homeRoom.test.ts:71-82` (replace the squad stand-points test)

- [ ] **Step 1: Write the failing test**

Replace the existing `it("places n stand points ...")` block in
`tests/homeRoom.test.ts` (lines 71-82) with this stronger version. It imports
`hangerLayout` (already imported at the top of the file) to derive the real
hanger columns:

```ts
  it("staggers n stand points clear of the hangers, each other, and the dock", () => {
    const cells = hangerLayout(W, H);
    const leftX = Math.min(...cells.map((c) => c.x));
    const rightX = Math.max(...cells.map((c) => c.x));
    const HALF = 27; // sprite half-width at the rendered 54px height
    const HANGER_HALF = 17; // ~34px gear icon half-width
    for (const n of [1, 2, 4, 7]) {
      const pts = squadStandPoints(n, W, H);
      expect(pts).toHaveLength(n);
      // x order is left → right
      for (let i = 1; i < n; i++) {
        expect(pts[i].x - pts[i - 1].x).toBeGreaterThanOrEqual(54); // no mutual overlap
      }
      for (const p of pts) {
        // clears both wall hanger columns
        expect(p.x - HALF).toBeGreaterThan(leftX + HANGER_HALF);
        expect(p.x + HALF).toBeLessThan(rightX - HANGER_HALF);
        // mid/lower stage, above the bottom dock band
        expect(p.y).toBeGreaterThan(H * 0.5);
        expect(p.y).toBeLessThan(H * 0.62);
        // perspective scale stays in the staged range
        expect(p.scale).toBeGreaterThanOrEqual(0.85 - 1e-9);
        expect(p.scale).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    // odd squads: the centre member is the closest (largest) one
    const odd = squadStandPoints(7, W, H);
    expect(odd[3].scale).toBeCloseTo(1, 5);
    expect(odd[3].scale).toBeGreaterThan(odd[0].scale);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/homeRoom.test.ts -t "staggers n stand points"`
Expected: FAIL — current points expose no `scale` (undefined) and the n=2 / n=7
edge members sit at `W*0.16`/`W*0.84`, violating the hanger-clearance assertion.

- [ ] **Step 3: Write the minimal implementation**

In `src/scenes/homeRoom.ts`, extend `StandPoint` and rewrite `squadStandPoints`
(lines 77-90) to:

```ts
export interface StandPoint {
  x: number;
  y: number;
  /** Perspective scale multiplier (centre/front = 1, flanks/back smaller). */
  scale: number;
}

/** Up to n staged standing positions: a forward wedge clear of the wall hangers. */
export function squadStandPoints(n: number, W: number, H: number): StandPoint[] {
  const LEFT = 0.24,
    RIGHT = 0.76; // span tightened to clear the W*0.13 / W*0.87 hanger columns
  const FLANK_SCALE = 0.85; // edge members read as standing further back
  const out: StandPoint[] = [];
  for (let i = 0; i < n; i++) {
    const tt = n > 1 ? i / (n - 1) : 0.5;
    const wedge = Math.sin(tt * Math.PI); // 0 at the flanks, 1 dead centre
    out.push({
      x: W * (LEFT + tt * (RIGHT - LEFT)),
      y: H * 0.555 + wedge * 14, // centre sits lower (front); flanks higher (back)
      scale: FLANK_SCALE + wedge * (1 - FLANK_SCALE),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/homeRoom.test.ts`
Expected: PASS (all `homeRoom` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeRoom.ts tests/homeRoom.test.ts
git commit -m "feat(home): stage squad in a wedge clear of the wall hangers"
```

---

### Task 2: Apply perspective scale + depth in the presenter

**Files:**
- Modify: `src/scenes/MainMenuScene.ts:193-201` (`drawSquad` member loop)

- [ ] **Step 1: Update the squad render loop**

Replace the `stand.members.forEach(...)` block in `drawSquad`
(MainMenuScene.ts:193-201) with the version below. It multiplies the base 54px
height by `p.scale` and orders depth by closeness so front members occlude back
members cleanly (depth 5.85..6.0 — still below the pet at 7 and the dock at 7/8):

```ts
    const pts = squadStandPoints(stand.members.length, W, H);
    stand.members.forEach((id, i) => {
      const key = towerTex(id);
      if (!this.textures.exists(key)) return;
      const p = pts[i];
      const s = this.add
        .sprite(p.x, p.y, key)
        .setOrigin(0.5, 0.85)
        .setDepth(5 + p.scale);
      s.setScale((54 * p.scale) / s.height);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(home): apply staged perspective scale + depth to squad sprites"
```

---

### Task 3: Verify whole

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green (homeRoom + the rest unaffected).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds (only the pre-existing >500 kB chunk warning).

- [ ] **Step 3: Lint (file-size + cycles guard)**

Run: `npm run lint`
Expected: passes — `homeRoom.ts` and `MainMenuScene.ts` stay well under 500 lines.

---

## Self-Review

- **Spec coverage:** tighter span (Task 1), flipped/deepened arc (Task 1),
  perspective scale field + presenter use (Tasks 1-2), depth-by-closeness
  (Task 2), strengthened hanger/mutual/dock test (Task 1) — all spec points
  mapped. Empty-squad CTA untouched (no task touches it). No art regen.
- **Placeholder scan:** none — every code/test step shows full code.
- **Type consistency:** `StandPoint.scale` defined in Task 1 and consumed as
  `p.scale` in Task 2; `squadStandPoints` signature unchanged `(n, W, H)`.
