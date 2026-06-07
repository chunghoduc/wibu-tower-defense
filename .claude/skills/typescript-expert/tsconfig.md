# TypeScript Configuration

Configuration is where most "TypeScript isn't catching my bugs" complaints actually originate. A loose config makes the compiler nearly decorative. Get this right first.

## Contents
1. Strictness flags that matter
2. Copy-paste base config
3. Variant additions (app / library / monorepo / DOM vs Node)
4. TypeScript 6.0 default changes (important)
5. How to reason about module / moduleResolution

---

## 1. Strictness flags that matter

`"strict": true` is the headline flag and is **on by default in TypeScript 6.0+**. It bundles `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables`, and `alwaysStrict`. Never turn it off for new code. If a legacy project can't enable it wholesale, enable the sub-flags incrementally — `strictNullChecks` first, it catches the most real bugs.

Beyond `strict`, these earn their keep:

- **`noUncheckedIndexedAccess`** — makes `arr[i]` and `record[key]` return `T | undefined`. This is the single highest-value flag *not* included in `strict`. It reflects reality: index access can miss. Expect to handle the `undefined`; that's the point.
- **`noImplicitOverride`** — requires the `override` keyword when overriding a base-class method, so renaming the base doesn't silently orphan the subclass method.
- **`exactOptionalPropertyTypes`** — distinguishes `{ x?: number }` (absent) from `{ x: number | undefined }` (present but undefined). Stricter and more correct, but can be noisy on existing code; enable deliberately.
- **`noFallthroughCasesInSwitch`**, **`noImplicitReturns`** — small, cheap, catch real mistakes.

Quality-of-life / correctness flags that belong in nearly every config:

- **`skipLibCheck`** — skip type-checking `.d.ts` files in dependencies. Big compile-speed win; the small risk is a dependency shipping broken types, which you can't fix anyway.
- **`esModuleInterop`** — sane interop with CommonJS default imports.
- **`isolatedModules`** — guarantees each file can be transpiled alone (required by esbuild/swc/Babel and by runtime type-stripping). Forbids a few non-erasable constructs, which is good hygiene.
- **`verbatimModuleSyntax`** — emits imports/exports exactly as written, forcing `import type` for type-only imports. Removes a whole class of bundler/CJS-ESM confusion. (Supersedes the old `importsNotUsedAsValues` / `preserveValueImports`.)
- **`moduleDetection: "force"`** — treats every file as a module, avoiding accidental global scope.
- **`resolveJsonModule`** — import `.json` with types.

---

## 2. Copy-paste base config

A solid, modern base. Adjust `target`/`lib`/`module` per the variant section. On TS 6.0+ several of these are already default but being explicit documents intent and survives config inheritance.

```jsonc
{
  "compilerOptions": {
    /* Base */
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    /* Strictness */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    /* Target / module — see variant section */
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler"
  }
}
```

`"module": "preserve"` with `"moduleResolution": "bundler"` is the modern default for code that a bundler (Vite, esbuild, webpack) or a TS-aware runtime will handle. It lets you write idiomatic ESM and mix dynamic `import()` freely.

---

## 3. Variant additions

Pick the situation(s) that apply and merge these in.

**Transpiling with `tsc` itself (no bundler):**
```jsonc
{
  "module": "nodenext",
  "moduleResolution": "nodenext",
  "outDir": "dist",
  "rootDir": "src",        // required on TS 6.0+, no longer inferred
  "sourceMap": true
}
```

**NOT transpiling with tsc (bundler or runtime handles it):**
```jsonc
{
  "module": "preserve",
  "moduleResolution": "bundler",
  "noEmit": true
}
```

**Building a library (publishing types):**
```jsonc
{
  "declaration": true,
  "declarationMap": true,   // lets consumers jump to your source
  "sourceMap": true
}
```
For a library inside a monorepo with project references also add `"composite": true`.

**Code runs in the browser/DOM:**
```jsonc
{ "lib": ["es2022", "dom", "dom.iterable"] }
```

**Code runs only in Node (no DOM):**
```jsonc
{ "lib": ["es2022"], "types": ["node"] }
```
On TS 6.0+ `@types/*` are no longer auto-included, so list what you depend on in `"types"`.

**React / JSX:**
```jsonc
{ "jsx": "react-jsx" }   // new JSX transform, no React import needed
```

---

## 4. TypeScript 6.0 default changes (March 2026)

TS 6.0 is a transition release before the Go-native 7.0. It changes defaults to match the modern ecosystem and deprecates legacy options. If you're scaffolding fresh you mostly benefit; if you're migrating, watch for these:

- **`strict` defaults to `true`.** Set `"strict": false` only if a project genuinely isn't ready.
- **`target` defaults to ES2025** (the current-year ES version), **`module`/`moduleResolution` modernized** (resolution defaults toward `bundler`).
- **`@types` packages are no longer auto-discovered.** Declare them explicitly: `"types": ["node", "vitest/globals"]` etc. This is the most common silent breakage on upgrade.
- **`rootDir` is no longer inferred** from input files — set it explicitly when emitting.
- **Deprecated options:** `baseUrl` (use `paths` with explicit relative roots or package imports), `outFile`, `downlevelIteration`, and others. Use the `--deprecation` flag to find them; `"ignoreDeprecations": "6.0"` silences temporarily (won't work in 7.0).
- **Import attributes:** `import data from "./x.json" with { type: "json" }` — the old `assert { ... }` syntax is deprecated.
- **`#/` subpath imports** and built-in **Temporal** types are now available.

The `ts5to6` codemod automates the two most disruptive changes (`baseUrl` removal, `rootDir` inference). TS 7.0 keeps the language nearly identical but rewrites the compiler in Go for ~10x faster builds.

---

## 5. Reasoning about module / moduleResolution

The decision tree:

- **Something downstream bundles or strips types** (Vite, esbuild, Bun, Node `--experimental-strip-types`) → `module: "preserve"`, `moduleResolution: "bundler"`, `noEmit: true`. You write modern ESM; the tool handles output.
- **`tsc` itself produces the JS you ship/run on Node** → `module: "nodenext"`, `moduleResolution: "nodenext"`. This respects your `package.json` `"type"` field and Node's ESM/CJS rules.
- **Avoid** the legacy `"node"` (a.k.a. node10) resolution and `module: "commonjs"` for new code — they predate `package.json` `"exports"` and misresolve modern packages.

When imports resolve in the editor but fail at build (or vice versa), it's almost always a `module`/`moduleResolution` mismatch with how the code is actually run. Align the config with the real runtime first.
