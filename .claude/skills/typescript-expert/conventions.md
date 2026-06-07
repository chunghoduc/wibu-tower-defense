# Conventions & Project Structure

Conventions exist so a reader spends attention on logic, not on decoding style. These are the mainstream choices a TypeScript reviewer expects; consistency within a project matters more than any single choice, so match an existing codebase's conventions over these defaults when one exists.

## Naming

| Kind | Case | Example |
|------|------|---------|
| Types, interfaces, classes, enums, type params | `PascalCase` | `UserProfile`, `HttpClient`, `T`, `TData` |
| Variables, functions, methods, properties | `camelCase` | `userCount`, `fetchUser`, `isActive` |
| True constants (compile-time, never reassigned) | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS` |
| Files | `kebab-case` or match framework | `user-service.ts`, `UserCard.tsx` (React) |
| Boolean values/props | predicate prefix | `isLoading`, `hasAccess`, `canEdit`, `shouldRetry` |

Specifics that signal experience:

- **No `I` prefix on interfaces** (`User`, not `IUser`). It's a C# habit that structural typing makes pointless; the ecosystem dropped it years ago.
- **No `T` prefix or `Type` suffix** on types (`User`, not `TUser` or `UserType`).
- **Descriptive generic parameters when there's more than one.** `Map<K, V>` is clear; but prefer `TData`, `TError`, `TContext` over `T, U, V` once you have several or they're non-obvious. A lone, obvious parameter stays `T`.
- **Abbreviations are cased as words:** `parseUrl`, `httpClient`, `userId` — not `parseURL`, `HTTPClient`, `userID`. (Match the surrounding codebase if it disagrees.)
- **Name by role, not type.** `users` not `userArray`; `getUser` not `getUserObject`. The type system already records the type.

## File & folder structure

**Organize by feature, not by technical layer.** Co-locating everything a feature needs makes it easy to find, change, and delete as a unit. Layer-based folders (`/controllers`, `/services`, `/types` for the whole app) scatter a single feature across the tree and grow worse with size.

```
src/
  features/
    auth/
      auth.service.ts
      auth.types.ts
      auth.hooks.ts
      auth.test.ts
      index.ts          # the feature's public surface
    billing/
      …
  shared/               # genuinely cross-cutting only
    ui/
    lib/
    types/
  app.ts
```

Guidelines:

- **One barrel (`index.ts`) per feature, exposing only its public API.** Barrels make imports tidy and let you refactor internals freely. Do *not* create a single root barrel re-exporting the whole app — it hurts build/bundle performance and invites circular dependencies.
- **Co-locate tests** (`*.test.ts`) and types with the code they describe. A shared `types/` folder is for types used across many features; feature-local types live in the feature.
- **Keep files focused.** ~200–400 lines is a comfortable ceiling; past it, ask whether the file has more than one reason to change and split (e.g. `user.service.ts` → `+ user.repository.ts + user.mapper.ts`). Treat this as a smell-detector, not a hard limit — a long `switch` or a cohesive type module can exceed it fine.
- **Functions: one job.** If you're tempted to write `// step 1`, `// step 2` comments inside a function, those steps want to be named functions. ~20–30 lines is a soft guide; readability is the real metric.

## Imports

- **`import type` for type-only imports**, and inline `import { fn, type Opts }` when mixing. Required-friendly under `verbatimModuleSyntax`; keeps types out of the runtime graph.
- **Group and order imports:** external packages, then internal aliases (`@/…`), then relative (`./…`), with a blank line between groups. Let a formatter/lint rule enforce it rather than doing it by hand.
- **Prefer named exports over default exports.** Named exports give consistent names across the codebase, better auto-import, and safer refactors. Defaults are fine where a framework expects them (e.g. a page/route module).
- **Use path aliases** (`@/features/auth`) instead of `../../../..` chains. Configure via your bundler/runtime; note `baseUrl` is deprecated in TS 6.0, so use package `imports` (`#/…`) or tool-level alias config.

## Code style (let tooling own most of it)

Don't hand-police formatting — adopt the tools and move on:

- **Formatter:** Prettier or Biome. Zero-config-ish, ends all formatting debates.
- **Linter:** ESLint with `typescript-eslint` (type-aware rules), or Biome's linter. Turn on `@typescript-eslint/no-explicit-any`, `no-floating-promises` (catches unawaited promises — a top source of real bugs), `no-unnecessary-condition`, `consistent-type-imports`, and exhaustiveness checks for switches.
- **Async:** never leave a promise floating; `await` it, `void` it intentionally, or `.catch` it. Mark functions `async` only if they `await`; return `Promise<T>` from the signature.
- **Prefer `const`;** use `let` only when reassignment is real; never `var`.
- **Errors:** throw `Error` (or subclasses), never strings. In `catch`, the variable is `unknown` under strict — narrow before use.

The expert posture on style: encode it in config (`tsconfig`, `eslint`, formatter) so it's enforced automatically and never discussed in review. Human attention goes to design and correctness.
