# UI Smoothness Redesign Plan

A concrete, low-risk plan to make the in-game UI feel **smoother and more polished**
without breaking the existing dual-camera + `crispText` supersampling approach. Nothing
here changes gameplay or the simulation; it is purely presentational.

Audited files:
`src/main.ts`, `src/scenes/ui.ts`, `src/scenes/audio.ts`, `src/scenes/PreloadScene.ts`,
`MainMenuScene.ts`, `StageSelectScene.ts`, `ShopScene.ts`, `GachaScene.ts`,
`CollectionScene.ts`, `HeroScene.ts`, `BattleScene.ts` (HUD), `battleInfoPanel.ts`, `fx.ts`,
`HeroLayeredSprite.ts`.

---

## 1. Current state — what's good and what's missing

### Good / keep
- `crispText()` / `makeCrisp()` in `ui.ts` is the canonical way to draw smooth, outlined
  text and is used consistently in battle code. **Do not regress this.**
- The battle FX layer (`fx.ts`) and `HeroLayeredSprite.ts` already lean on Phaser tweens
  with tasteful easings (`Back.easeOut`, `Sine.easeIn`, `Cubic.easeOut`, `Quad.easeOut`).
  So the team is comfortable with tweens — the menus simply never adopted them.
- Dual-camera split in `BattleScene` (`world` layer rendered by a zoomed camera, `ui`
  layer by a fixed 1:1 `uiCam` that `ignore`s the world) is correct and must be preserved.

### Concrete smoothness gaps
1. **Instant scene cuts.** Every navigation is a hard `this.scene.start(key)` (MainMenu
   buttons, all `← Back` links, `StageSelect.launchStage`, `BattleScene` return-to-menu).
   No camera fade — scenes pop. This is the single biggest "cheap" feeling.
2. **Menu scenes use raw `this.add.text`, not `crispText`.** `MainMenuScene`,
   `StageSelectScene`, `ShopScene`, `GachaScene`, `CollectionScene` build text with
   `this.add.text(...)`, so menu text is blocky/aliased relative to the battle HUD which
   uses `crispText`. (`HeroScene` and `battleInfoPanel` already use `crispText` — good.)
3. **Buttons only swap a background color on hover.** No scale/press feedback, no easing.
   `MainMenuScene` btns, `StageSelect` play/diff tabs, `Shop` buy btns, `Gacha` pull btns
   all just call `setBackgroundColor` on over/out. Feels static.
4. **Panels/modals appear with zero animation.** The enemy compendium
   (`StageSelect.openCompendium`), collection codex (`Collection.showDetail`), and the
   enhance dialog (`HeroScene.openEnhance`) all snap to full opacity/size. The battle info
   panel (`battleInfoPanel.setOpen`) toggles instantly (just flips `visible` + moves the tab).
5. **Gacha results pop in.** `GachaScene.showResults` builds all cards at once with no
   stagger/scale-in — the marquee "reward reveal" moment has no payoff.
6. **Abrupt numeric changes.** Gold / crystals / HP labels jump:
   - `BattleScene` HUD string (`Gold ${b.gold}`) is rebuilt verbatim each frame.
   - `Shop`/`Gacha` `💎 N Crystals` snaps after a purchase/pull.
   - `battleInfoPanel.tick` sets HP/MP text directly. (Bars are redrawn per frame, which is
     fine; the *numbers* are what jump.)
7. **Inconsistent design tokens.** Colors are re-declared per file: `RARITY_HEX`/`RARITY_INT`
   maps are duplicated in `Shop`, `Gacha`, `Collection`, `HeroScene`; gold accent `#ffd700`,
   panel fills `#1a2a3a`/`0x141c28`/`0x10141d`, button blue `#1565c0`/`#1a4a7a` all vary
   slightly. Spacing/padding are ad-hoc per scene. No shared spacing scale.
8. **No global page-in.** Scenes have no entry fade, so even a perfect first frame still
   appears to "blink" in.

---

## 2. The shared UI kit — `src/scenes/uiKit.ts` (new file)

Create a small, dependency-light kit. **Keep it < 300 lines** so it stays well under the
project's 500-line cap. It builds on `crispText` (import from `./ui.ts`) — it does **not**
replace it. Everything returns plain Phaser objects so existing layout math still works.

### 2.1 Design tokens (single source of truth)
```ts
export const COLORS = {
  // hex strings for Text styles
  gold: "#ffd86a", textHi: "#ffffff", textMid: "#cfe0f5", textLo: "#90a4bb",
  good: "#a5d6a7", bad: "#ef9a9a", accent: "#90caf9",
  btnFill: "#1f3a5c", btnFillHover: "#2c5285", btnFillDown: "#16263d", btnDisabled: "#2a3a4a",
  // ints for Graphics
  panelFill: 0x10141d, panelStroke: 0x2a3a56, slotFill: 0x16202c,
} as const;

export const RARITY_HEX: Record<string, string> = {
  Common:"#9e9e9e", Magic:"#2196f3", Rare:"#9c27b0", Legendary:"#ff9800", Unique:"#f44336",
};
export const RARITY_INT: Record<string, number> = {
  Common:0x9e9e9e, Magic:0x2196f3, Rare:0x9c27b0, Legendary:0xff9800, Unique:0xf44336,
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 18, xl: 28 } as const;
export const RADIUS = { sm: 5, md: 8, lg: 10 } as const;
export const DUR = { btn: 110, press: 90, panel: 220, fade: 250, count: 350 } as const;
export const EASE = { btn: "Back.easeOut", panel: "Back.easeOut", move: "Cubic.easeOut" } as const;
```
Migrating the duplicated `RARITY_HEX`/`RARITY_INT` in `Shop`/`Gacha`/`Collection`/`HeroScene`
to import from here removes ~4 copies (small, mechanical, low-risk — do it incrementally).

### 2.2 `button(scene, x, y, label, onClick, opts?)`
A `crispText`-backed button with hover + press tween feedback. Returns the Text so callers
can still `setOrigin`, position, etc.
- Build with `crispText(scene, x, y, label, { backgroundColor: COLORS.btnFill, ... })`.
- `setInteractive({ useHandCursor: true })`.
- `pointerover`: tween `scale` to `1.05` over `DUR.btn` `EASE.btn`; set hover bg.
- `pointerout`: tween `scale` to `1.0`; restore bg; cancel any in-flight tween on the target
  first (`scene.tweens.killTweensOf(btn)`) so rapid in/out doesn't stack.
- `pointerdown`: quick tween `scale` to `0.94` over `DUR.press`, then back; play
  `sfx.click()` if a `Sfx` is wired (optional opts.sfx); call `onClick` on `pointerup`
  (use `pointerup` not `pointerdown` for the action so the press animation reads).
- `opts`: `{ fontSize, fixedWidth, align, padding, disabled }`. When `disabled`, set alpha
  ~0.5 and skip interactivity.
- **Important for the dual-camera battle scene:** scaling a Text changes its transform only,
  not its resolution, so `crispText`'s LINEAR-filtered supersampled texture stays crisp.
  Keep `setOrigin(0.5)` for buttons that scale, so they grow from center (callers that need
  a different origin pass it after).

### 2.3 `panel(scene, x, y, w, h, opts?)`
Returns a `Container` holding a rounded-rect `Graphics` (fill `COLORS.panelFill`, stroke
`COLORS.panelStroke`, `RADIUS.lg`). Helper `popIn(container)` animates entry:
- start `setScale(0.92).setAlpha(0)`, tween to `scale 1, alpha 1` over `DUR.panel` with
  `EASE.panel`. For full-screen dim backdrops, fade the dim rect `alpha 0 → target` over
  `DUR.fade` (don't scale the backdrop).
- Companion `popOut(container, onDone)` reverses it (`scale 0.96, alpha 0`, `DUR.press`)
  then calls `onDone` (used by modal close to animate-out before `destroy(true)`).

### 2.4 `fadeSceneTo(scene, key, data?)`
The highest-value helper. Wraps the camera-fade handshake so callers keep their one-liner:
```ts
export function fadeSceneTo(scene, key, data?) {
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
    () => scene.scene.start(key, data));
  scene.cameras.main.fadeOut(DUR.fade, 0, 0, 0);
}
export function fadeSceneIn(scene) { scene.cameras.main.fadeIn(DUR.fade, 0, 0, 0); }
```
- **Battle caveat:** `BattleScene` adds a second camera (`uiCam`). `cameras.main.fadeOut`
  only fades the main camera, so the HUD layer would stay visible during the fade. For the
  battle → menu transition, call `fadeOut` on **both** cameras (iterate
  `scene.cameras.cameras`) or expose `fadeSceneTo(scene, key, data, { allCameras: true })`.
  Menu scenes are single-camera so the default path is fine.
- Each scene's `create()` calls `fadeSceneIn(this)` on its first line so the page eases in.

### 2.5 `tweenCount(scene, textObj, from, to, fmt?)`
Animate a numeric label instead of snapping:
```ts
export function tweenCount(scene, text, from, to, fmt = (n)=>`${Math.round(n)}`) {
  const o = { v: from };
  scene.tweens.add({ targets: o, v: to, duration: DUR.count, ease: EASE.move,
    onUpdate: () => text.setText(fmt(o.v)) });
}
```
Use for crystal/gold counters and the panel HP number. Throttle in per-frame contexts:
only kick a tween when the displayed target actually changes (store last target).

### 2.6 (Optional) `toast(scene, msg)` / `sectionLine(...)`
`HeroScene` already has a `showToast` and `battleInfoPanel`/`Collection` repeat a
"section header + divider line" pattern. Promoting these is a nice-to-have, not required;
defer to avoid scope creep and keep `uiKit.ts` small.

---

## 3. Per-scene adoption

| File | Change | Effort |
|---|---|---|
| **all scenes** | First line of `create()`: `fadeSceneIn(this)`. Replace every `this.scene.start(k)` (nav buttons, `← Back`, play, return-to-menu) with `fadeSceneTo(this, k)`. | Quick |
| `MainMenuScene.ts` | Replace the 7 raw `add.text` btns (L61-76) with `uiKit.button(...)`; title/crystal text → `crispText`. Stagger-tween the button grid in (alpha+y, `delay: i*40`). | Quick |
| `StageSelectScene.ts` | `← Back`, `? Enemies`, diff tabs, per-card `▶ Play` → `button()`. Title/labels → `crispText`. Wrap `openCompendium` panel in `panel()` + `popIn`; fade the `overlay` rect (it's already a rect, just tween alpha). Animate close via `popOut`. List drag already smooth — leave it. | Medium |
| `ShopScene.ts` | Buy btns → `button()` (disabled state via opts when unaffordable, replacing the alpha-only cue). Title/crystal/feedback → `crispText`. On purchase, `tweenCount` the crystal total. `feedbackText` fade-in (alpha 0→1, 150ms) instead of instant. Import `RARITY_HEX` from kit. | Quick |
| `GachaScene.ts` | Pull btns → `button()`. crystal/pity → `crispText` + `tweenCount` after a pull. **Stagger the result reveal** in `showResults`: each card `setScale(0.6).setAlpha(0)` then tween to `1/1` with `delay: i*70`, `EASE.panel`; flip `NEW!` badge in last. This is the marquee win. Import `RARITY_HEX` from kit. | Medium |
| `CollectionScene.ts` | `← Back` → nav fade. Grid card click → open `showDetail` via `panel()`/`popIn`; close via `popOut`. Title → `crispText`. Import `RARITY_*` from kit. (Per-card hover scale is optional — 60+ cards, keep cheap.) | Medium |
| `HeroScene.ts` | Already uses `crispText`. Add: filter tabs + enhance/close btns → `button()`; `openEnhance` dialog → `popIn`/`popOut`; `showToast` slide-in (tween y + alpha). `← Back` → nav fade. Low risk, already in-style. | Quick |
| `BattleScene.ts` (HUD) | `← Return to Menu` btn (L661) and victory overlay (L696) → `button()`/`panel()` with `popIn`; return uses `fadeSceneTo(this, "MainMenuScene", undefined, {allCameras:true})`. Gold value in the HUD string: split the gold number into its own `crispText` and `tweenCount` it (or accept the per-frame string for now — see §5). Speed/mute btns → `button()` for press feel. | Medium |
| `battleInfoPanel.ts` | `setOpen`: instead of flipping `visible`, slide `content`/`bg` in from `+12px x` with alpha (tween over `DUR.panel`); tab arrow already flips. `tick`: `tweenCount` the HP number only when the integer target changes (avoid per-frame tween spam). Upgrade/sell → `button()`. **Watch the 406-line count** (see §5). | Medium |

---

## 4. Easing / duration reference (use the `DUR`/`EASE` tokens)

- **Buttons** — hover scale 1.0→1.05, press 1.0→0.94→1.0. ~110ms, `Back.easeOut`.
- **Panels / modals** — scale 0.92→1.0 + alpha, ~220ms, `Back.easeOut` (subtle overshoot
  sells "pop"). Backdrop dim: alpha only, ~250ms, linear/`Sine`.
- **Scene fades** — 250ms `fadeOut(0,0,0)` then `fadeIn` on the next scene. Keep symmetric.
- **Numeric counters** — 350ms, `Cubic.easeOut`.
- **Gacha stagger** — per-card `delay: i*70ms`, card tween 220ms `Back.easeOut`.
- **Menu grid stagger** — `delay: i*40ms`, 200ms, alpha + 8px rise.

Reuse the easings already proven in `fx.ts`/`HeroLayeredSprite.ts` for visual consistency.

---

## 5. Quick wins vs larger refactors, and the 500-line rule

### Quick wins (do first — high perceived smoothness, tiny risk)
1. `fadeSceneTo` + `fadeSceneIn` everywhere. Single helper, ~one-line-per-callsite change,
   instantly removes the "hard cut" feeling across the whole game.
2. `button()` adoption in `MainMenuScene`, `ShopScene`, `GachaScene` (few callsites each).
3. `tweenCount` on crystal counters in Shop/Gacha.
4. Switch menu-scene `add.text` → `crispText` for title/label/counter text (visual parity
   with the battle HUD; near-zero risk).

### Medium (clear payoff, slightly more code)
5. `panel()` + `popIn`/`popOut` for the three modals (compendium, codex, enhance).
6. Gacha staggered result reveal.
7. `battleInfoPanel` open/close slide + HP counter tween.

### Larger / deferred
8. Migrating all duplicated `RARITY_*` maps to the kit (mechanical, touch many files —
   batch it but it's low value vs effort).
9. A full shared `toast`/`sectionLine` component layer (nice-to-have).

### File-size guardrails (< 500 lines enforced)
- `uiKit.ts` is **new**; keep it ~250-300 lines (tokens + 5 factories). Do not let it bloat
  into a component zoo — extract `uiKitModal.ts` if it ever approaches 450.
- `battleInfoPanel.ts` is already **406 lines**. Adding open/close tweens + a button helper
  inline risks crossing 500. **Mitigation:** route its buttons/HP-tween through `uiKit`
  (net add ~10-15 lines) rather than writing bespoke tween code locally. If it still grows,
  move the `drawStatGlyph`/`drawSkillGlyph` glyph drawers (L318-406, ~90 lines) into a new
  `battlePanelGlyphs.ts` — they're self-contained and a clean split.
- `BattleScene.ts` is **1047 lines** and already over the cap (pre-existing). Do **not** add
  net lines there — every HUD button/panel change must go *through* `uiKit` so the diff is
  net-neutral or negative. Flag the existing overage but don't expand it.
- All other scenes are 150-360 lines; adopting the kit should be net-neutral (it replaces
  inline `add.text` + hover handlers with shorter `button()` calls).

### Compatibility notes
- `crispText` + tween `scale` is safe: scaling transforms the already-supersampled,
  LINEAR-filtered texture, so text stays crisp while it animates. Don't tween `setResolution`.
- Preserve the `BattleScene` dual-camera contract: anything new on the HUD must be added to
  the `ui` layer (so `cameras.main.ignore(this.ui)` keeps it out of the world camera), and
  battle scene fades must cover **both** cameras.
- Honor the scene-re-entry reset rule (per project memory): any new pushed arrays/refs the
  kit introduces in a scene (e.g. tracked buttons) must be reset in `create()`.
- `tweenCount`/panel tweens create transient tween objects — fine, but in per-frame contexts
  (`battleInfoPanel.tick`, battle HUD) only start a tween when the integer target changes,
  and `killTweensOf` the proxy first to avoid pile-ups.
