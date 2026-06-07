# Anti-Patterns & Pitfalls

Each entry is a thing to *stop doing*, why it bites, and what to do instead. Use this when reviewing existing code or modernizing a codebase.

## `any` — the type-safety off switch

`any` doesn't mean "any type," it means "stop checking." It propagates: one `any` flows into every expression that touches it, silently disabling checks far from where you wrote it.

```ts
function parse(json: string): any { return JSON.parse(json); }
const u = parse(raw);
u.naem.toUpperCase();  // typo + wrong assumptions, zero errors, runtime crash
```

Fix: return `unknown` and narrow, or parse with a schema.
```ts
function parse(json: string): unknown { return JSON.parse(json); }
const u = parse(raw);
if (isUser(u)) u.name.toUpperCase();   // checked
```
If you truly need an escape hatch, prefer `unknown` (forces narrowing) and reserve `any` for rare, localized, commented cases. Enable `@typescript-eslint/no-explicit-any` so each one is a deliberate exception.

## Type assertions (`as`) used as a hammer

`as` overrides the compiler with no runtime check. `data as User` when `data` is `unknown` is a promise you can't keep.

```ts
const user = (await res.json()) as User;  // hope the server agrees
```
Fix: validate, don't assert. Use a type guard or schema parse so the type reflects a real check. Legitimate `as`: `as const`, narrowing after a runtime check the type system can't express, branded-value constructors, and test fixtures. Never use `as any as T` (double assertion) outside truly exceptional, commented situations — it's a klaxon in review.

## `enum` — runtime baggage and erasability problems

```ts
enum Color { Red, Green, Blue }  // emits an IIFE; numeric enums get reverse mappings
```
Problems: enums emit runtime code (not erasable, so they break under type-stripping runtimes and `isolatedModules` for `const enum`), numeric enums create surprising reverse mappings, and they're nominal in confusing ways.

Fix — union of literals when you only need the values:
```ts
type Color = "red" | "green" | "blue";
```
Fix — `as const` object when you also need a runtime value to iterate/reference:
```ts
const Color = { Red: "red", Green: "green", Blue: "blue" } as const;
type Color = (typeof Color)[keyof typeof Color];  // "red" | "green" | "blue"
Object.values(Color);  // runtime iteration works
```
This pattern is tree-shakeable, erasable, and gives you both the type and a value namespace.

## Bag-of-optionals instead of a discriminated union

```ts
interface Request {
  isLoading: boolean;
  data?: Response;
  error?: Error;        // nothing stops data AND error both set, or both unset
}
```
Fix: a tagged union (see `type-patterns.md` §1) so only valid combinations are constructible.

## `Function`, `object`, `{}` as types

These are near-useless: `Function` accepts any callable with no signature info; `{}` means "anything except null/undefined" (not "empty object"); `object` is "any non-primitive." Fix: write the actual call signature `(x: number) => string`, the real shape, or `Record<string, unknown>` for an arbitrary object.

## Non-null assertion (`!`) sprinkled everywhere

`foo!.bar` tells the compiler "trust me, not null." Each one is an unchecked claim. A few at genuine boundaries are fine; a codebase full of them means the types are modeled wrong (or `strictNullChecks` is fighting reality). Fix the model — narrow with a guard, restructure so the value can't be null, or handle the null case.

## Ignoring promises (floating promises)

```ts
saveUser(user);   // forgot await — errors vanish, ordering breaks
```
Fix: `await` it, `void saveUser(user)` to intentionally fire-and-forget, or `.catch(handle)`. Enable `@typescript-eslint/no-floating-promises` — this catches a remarkable number of real production bugs.

## `@ts-ignore` over `@ts-expect-error`

`@ts-ignore` suppresses an error and stays silent forever — including after the underlying problem is fixed, hiding the next real error on that line. `@ts-expect-error` suppresses *and* fails the build if the line stops erroring, so it self-removes when obsolete. Always prefer it, and add a comment explaining why.

## Over-engineered types

The inverse failure: a baroque conditional/mapped type where a plain interface would do. It compiles slowly, produces unreadable error messages, and scares maintainers. Match type complexity to the problem. If a junior can't read the type, justify its existence.

## Mutating shared/input data

Functions that mutate their array/object parameters cause spooky action at a distance. Mark inputs `readonly T[]` / `Readonly<T>` and return new values. Reach for `as const` and immutable updates; let the type system enforce no-mutation at boundaries.

---

## Modern-feature awareness — stop writing outdated TypeScript

Training data lags the language. Don't reach for old idioms when current ones are better:

- **`namespace` / `module X {}`** — legacy, non-erasable, predates ES modules. Use ES modules (`import`/`export`). Only exception: augmenting types via `declare global` / module augmentation.
- **`enum`** — see above; unions or `as const` objects instead (extra relevant now that runtimes strip types).
- **`import x = require(...)` / `export =`** — CommonJS-era TS syntax. Use standard ESM.
- **Manual type predicates for simple filters** — TS 5.5+ infers many of them (`arr.filter(Boolean)`, `arr.filter(x => x != null)` now narrow). Don't write guards the compiler already infers.
- **`as const` widening workarounds** — `satisfies` (TS 4.9+) usually does what you reached for `as` to fake.
- **try/finally for cleanup** — `using` / `await using` (TS 5.2+) where the resource implements `[Symbol.dispose]`.
- **Import assertions `assert { type: "json" }`** — deprecated; use import attributes `with { type: "json" }`.
- **`baseUrl`, `outFile`, `downlevelIteration`** — deprecated in TS 6.0; migrate (use package `imports`/`#` subpaths instead of `baseUrl`).
- **Records & Tuples proposal** — was **withdrawn** by TC39; don't suggest it as a coming feature.
- **`Array<T>` vs `T[]`** — both fine; prefer `T[]` for simple element types, `Array<T>`/`ReadonlyArray<T>` when it reads better with complex inner types. Be consistent.

When modernizing, change idioms where it adds real value (safety, erasability, clarity) — not churn for its own sake. Note the TypeScript version in play; if unsure which features are available, check the project's installed version rather than assuming.
