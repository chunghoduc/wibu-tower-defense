# 0001 — Data Storage Strategy: Static Design Data and Player Saves

- **Status:** Proposed
- **Date:** 2026-06-07
- **Deciders:** Architecture
- **Targets:** Web (Vite/Phaser 3), iOS, Android (Capacitor)

## Context

The game holds two fundamentally different kinds of data:

1. **Static game-design data** — characters/towers, items, skills, passives, enemies,
   stages. Authored by designers, version-controlled, **read-only at runtime**. Today
   these live as ~3.7k lines of typed TypeScript in `src/data/` (e.g. `towers.ts`,
   `items.ts`, `schema.ts`), imported directly and validated at load time by the
   `validate*` functions in `schema.ts`.

2. **Player save data** — a single `HeroSave` document (hero progress, inventory,
   collection, currency, progress flags, squad, materials). Persisted through the
   `SaveProvider` interface in `src/core/save.ts`. The current implementation,
   `LocalSaveProvider`, serializes the whole blob to one `localStorage` key
   (`wibu-td-save`). There is already a working **versioned migration** path
   (`loadAndMigrate`, currently `CURRENT_SAVE_VERSION = 5`) with defensive backfill.

The save is **one small, self-contained document** (kilobytes), read once at boot and
rewritten on each mutation via `SaveManager.persist()`. It is not relational and has no
ad-hoc query needs — every consumer just reads fields off the in-memory `HeroSave`.

The question: **(A)** should static design data move into a local database, and
**(B)** what is the best persistence layer for player saves across web + iOS + Android?

### Key constraint discovered during review

`SaveProvider` is **synchronous** today (`load(): HeroSave | null`, `persist(data): void`).
Every cross-platform native store (Capacitor Preferences, SQLite, IndexedDB) is
**asynchronous**. This is the single biggest design force on part (B): the interface must
become async, or load must happen eagerly before `SaveManager` is constructed.

## Decision

**A — Static design data stays as TypeScript files in the repo. No runtime DB.**

**B — Player saves remain a single serialized document behind `SaveProvider`, with a
platform-appropriate provider chosen at startup**: `idb-keyval` (IndexedDB) on web,
Capacitor **Preferences** on native (with a documented SQLite escape hatch). The
`SaveProvider` interface is made **async**.

## Options Considered

### Part A — Static design data

| Option                                       | Pros                                                                                                                                                                                | Cons                                                                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TS files in repo (current)**               | Compile-time typed; validated by `schema.ts`; tree-shakeable; zero runtime DB; trivial diffs/PR review; ships inside the JS bundle, works fully offline; refactors are type-checked | Data lives in code (designers edit TS); rebuild to change content                                                                                                                               |
| JSON assets loaded at runtime                | Designer-friendlier; no rebuild                                                                                                                                                     | Loses compile-time types and tree-shaking; needs runtime fetch + validation; adds a load/error path for no real gain                                                                            |
| Local DB (SQLite/IndexedDB) seeded from data | Queryable                                                                                                                                                                           | **Pure overhead** — the data is read-only and accessed by id/array iteration, never queried relationally; adds a seeding/migration burden, async boot, and native dependencies for zero benefit |

The static catalogs are small, read-only, and accessed by direct reference or simple
array/`id` lookup. A database buys nothing and costs bundle size, an async boot path, and
a seeding step. **Keep them as TS.**

### Part B — Player save persistence

| Option                                    | Cross-platform                                          | Migration                                          | Bundle/Deps           | Fit for a single blob                                 | Verdict                            |
| ----------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- | --------------------- | ----------------------------------------------------- | ---------------------------------- |
| **localStorage (current)**                | Web only; unreliable/oversize-capped in WKWebView       | Already implemented                                | 0                     | Good                                                  | Web-only — insufficient for mobile |
| **idb-keyval (IndexedDB)**                | All browsers + Android WebView + iOS WKWebView          | Reuse `loadAndMigrate`                             | ~1 KB                 | Excellent — get/set one key                           | **Web provider**                   |
| **Capacitor Preferences**                 | iOS + Android (native UserDefaults / SharedPreferences) | Reuse `loadAndMigrate`                             | small plugin          | Excellent for a small blob                            | **Native provider**                |
| `@capacitor-community/sqlite` / op-sqlite | iOS + Android (+ web via WASM)                          | Manual schema migrations on top of save migrations | Large (native + WASM) | Overkill — relational engine for one row              | Escape hatch only                  |
| WatermelonDB / Dexie                      | Dexie = web only; Watermelon = reactive ORM             | Schema migrations                                  | Large                 | Overkill — observable relational models we don't need | Rejected                           |

A relational DB (SQLite, WatermelonDB) is justified only by large datasets, partial
loads, or rich querying. We have a **single small document loaded whole** — none of those
apply. Adding SQLite means a native dependency, a second migration system layered over the
one we already have, and a heavier bundle, for no functional gain.

## Consequences

**Positive**

- One serialization format and **one migration system** (`loadAndMigrate`) across all
  three platforms — the existing versioned migration is reused unchanged.
- Minimal new dependencies: `idb-keyval` (web) + `@capacitor/preferences` (native).
- Offline-first by construction; no network, no schema, no seeding.
- Provider selection is the only platform-specific code; the rest of the game is unaware.

**Negative / trade-offs**

- **`SaveProvider` must become async.** `SaveManager` construction and its `persist()`
  calls change from sync to async (see sketch). This is a contained, mechanical refactor
  (one consumer: `SaveManager`; one construction site: `main.ts`).
- Preferences stores a single string value. If a save ever grows large or needs partial
  updates (unlikely for this game), migrate the native provider to SQLite behind the same
  interface — no call-site changes.
- IndexedDB/Preferences can be cleared by the OS under storage pressure; saves are local
  only. If durability matters later, add an optional cloud-sync provider behind the same
  interface (the abstraction already allows it).

## Implementation Sketch

Make the interface async and add platform providers. Game logic keeps the in-memory
`HeroSave`; only boot/persist boundaries await.

```ts
// src/core/save.ts — interface goes async
export interface SaveProvider {
  load(): Promise<HeroSave | null>;
  persist(data: HeroSave): Promise<void>;
  clear(): Promise<void>;
}

// Web — IndexedDB via idb-keyval (replaces LocalSaveProvider as the web default)
import { get, set, del } from "idb-keyval";
const SAVE_KEY = "wibu-td-save";

export class IdbSaveProvider implements SaveProvider {
  async load() {
    const raw = await get(SAVE_KEY);
    return raw == null ? null : loadAndMigrate(raw); // reuse existing migration
  }
  async persist(data: HeroSave) {
    await set(SAVE_KEY, data);
  } // structured-clone, no JSON.stringify needed
  async clear() {
    await del(SAVE_KEY);
  }
}

// Native — Capacitor Preferences
import { Preferences } from "@capacitor/preferences";

export class PreferencesSaveProvider implements SaveProvider {
  async load() {
    const { value } = await Preferences.get({ key: SAVE_KEY });
    return value ? loadAndMigrate(JSON.parse(value)) : null;
  }
  async persist(data: HeroSave) {
    await Preferences.set({ key: SAVE_KEY, value: JSON.stringify(data) });
  }
  async clear() {
    await Preferences.remove({ key: SAVE_KEY });
  }
}
```

```ts
// src/core/saveManager.ts — async two-phase construction (no logic change beyond awaits)
export class SaveManager {
  private save!: HeroSave;
  private constructor(private readonly provider: SaveProvider) {}

  static async create(provider: SaveProvider): Promise<SaveManager> {
    const mgr = new SaveManager(provider);
    const loaded = await provider.load();
    mgr.save = loaded ?? createFreshSave();
    if (!loaded) {
      /* starter crystals + squad, as today */
    }
    await mgr.persistNow();
    return mgr;
  }

  // persist() stays fire-and-forget for gameplay calls; failures are logged, not awaited.
  private persist(): void {
    this.save.lastSavedAt = Date.now();
    void this.provider.persist(this.save);
  }
  private persistNow(): Promise<void> {
    this.save.lastSavedAt = Date.now();
    return this.provider.persist(this.save);
  }
}
```

```ts
// src/main.ts — pick provider by platform (Capacitor exposes isNativePlatform())
import { Capacitor } from "@capacitor/core";
const provider = Capacitor.isNativePlatform()
  ? new PreferencesSaveProvider()
  : new IdbSaveProvider();
const saveManager = await SaveManager.create(provider);
```

`LocalSaveProvider` (localStorage) can be retained as a trivial sync-wrapped fallback /
test double, but is no longer the default on any shipping platform.

## Follow-ups (not part of this decision)

- Add `@capacitor/preferences` + `idb-keyval` deps when the Capacitor shell lands.
- Optional: a `CloudSaveProvider` behind the same interface for cross-device sync.
- Keep `loadAndMigrate` as the **single** source of save-versioning truth regardless of
  backing store.
