# Type-Level Patterns

The techniques that separate expert TypeScript from annotated JavaScript. Reach for these when designing domain models, generic APIs, or library type signatures. Use the minimum power needed — clever types have a maintenance cost.

## Contents
1. Discriminated unions & exhaustiveness
2. Generics & constraints
3. `satisfies` — validate without widening
4. `const` type parameters & `as const`
5. Branded / nominal types
6. Essential utility types
7. Template-literal types
8. Conditional & mapped types
9. Type guards & assertion functions
10. Explicit resource management (`using`)

---

## 1. Discriminated unions & exhaustiveness

The workhorse of "make illegal states unrepresentable." Tag each variant with a literal field; TypeScript narrows on it.

```ts
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function render(s: RequestState<User>): string {
  switch (s.status) {
    case "idle":    return "—";
    case "loading": return "Loading…";
    case "success": return s.data.name;   // data exists only here
    case "error":   return s.error.message;
    default:        return assertNever(s); // compile error if a case is added and missed
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

The `assertNever` default case is the safety net: add a new variant to the union and every non-exhaustive switch becomes a compile error pointing you to the gap.

## 2. Generics & constraints

Generics preserve type information through a function. Constrain them with `extends` so you can use the type inside.

```ts
// Preserves the element type — caller gets T | undefined, not any
function first<T>(arr: readonly T[]): T | undefined {
  return arr[0];
}

// Constrained: K must be a key of T, return type is the precise property type
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Default type parameters for ergonomic APIs
function createStore<State, Action = { type: string }>(reducer: (s: State, a: Action) => State) { /* … */ }
```

Rule of thumb: if a type parameter appears only once in the signature, it probably shouldn't be a type parameter — it's just `unknown`/`any` in disguise. Each parameter should relate two or more positions (input↔output, or two inputs).

## 3. `satisfies` — validate without widening

`satisfies` checks a value against a type **without** changing the value's inferred (narrower) type. Use it for config objects and lookup tables where you want both validation and precise inference.

```ts
const config = {
  port: 3000,
  host: "localhost",
  retries: 3,
} satisfies Record<string, string | number>;

config.port.toFixed(0);    // ok — TS still knows port is number
config.host.toUpperCase(); // ok — TS still knows host is string
// A typo'd value type (e.g. port: true) would fail the satisfies check
```

Compare: a `: Record<string, string | number>` annotation would *widen* every field to `string | number`, losing the per-key precision. `satisfies` is the expert default for "validate the shape, keep the specifics."

## 4. `const` type parameters & `as const`

`as const` freezes a literal to its narrowest type (readonly, literal values rather than widened `string`/`number`).

```ts
const ROUTES = { home: "/", login: "/login" } as const;
type Route = (typeof ROUTES)[keyof typeof ROUTES]; // "/" | "/login"
```

`const` type parameters get that narrowness at call sites without the caller writing `as const`:

```ts
function defineRoutes<const T extends readonly string[]>(routes: T): T {
  return routes;
}
const r = defineRoutes(["home", "about"]); // r: readonly ["home", "about"], not string[]
```

## 5. Branded / nominal types

TypeScript is structural: two types with the same shape are interchangeable. When that's wrong — a `UserId` should never be passed where an `OrderId` is expected, even though both are strings — add a brand.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

function getUser(id: UserId): User { /* … */ }

const raw = "abc";
getUser(raw);                 // error: plain string isn't a UserId
getUser(raw as UserId);       // the one sanctioned place to assert — at the boundary
```

Brands cost nothing at runtime (the `__brand` field never exists) and prevent an entire category of "passed the wrong ID" bugs. Create branded values through a single validating constructor so the `as` lives in exactly one place.

## 6. Essential utility types

Built in — don't reinvent them.

- `Partial<T>` / `Required<T>` — toggle all properties optional/required.
- `Readonly<T>` — all properties readonly.
- `Pick<T, K>` / `Omit<T, K>` — select / exclude keys. `Omit` is great for "T but without the server-generated fields."
- `Record<K, V>` — object with keys `K` and values `V`.
- `ReturnType<F>` / `Parameters<F>` / `Awaited<T>` — extract from functions/promises. `type User = Awaited<ReturnType<typeof fetchUser>>` keeps a derived type in sync with its source.
- `Exclude<U, M>` / `Extract<U, M>` / `NonNullable<T>` — filter unions.

Compose them: `type UpdateUserDto = Partial<Omit<User, "id" | "createdAt">>`.

## 7. Template-literal types

Types built from string patterns. Powerful for typed event names, route params, CSS units, etc.

```ts
type EventName = `on${Capitalize<"click" | "hover">}`; // "onClick" | "onHover"

// Extract path params from a route string
type Params<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | Params<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;
type T = Params<"/users/:id/posts/:postId">; // "id" | "postId"
```

Use when it removes real duplication or enforces a real invariant — not to show off. Deeply recursive template types slow the compiler.

## 8. Conditional & mapped types

Conditional: `T extends U ? X : Y`. Mapped: transform every key.

```ts
type Nullable<T> = { [K in keyof T]: T[K] | null };
type Getters<T> = { [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K] };

// `infer` extracts a type from within another
type ElementType<T> = T extends readonly (infer E)[] ? E : never;
```

Distributivity: a conditional over a naked type parameter distributes across unions (`Exclude` works this way). Wrap in a tuple `[T] extends [U]` to opt out when you don't want distribution.

## 9. Type guards & assertion functions

How you safely cross from `unknown` to a known type. Always prefer these over `as`.

```ts
// Type guard: narrows in the true branch
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v && typeof (v as any).id === "string";
}

// Assertion function: throws if false, narrows for the rest of scope
function assertIsUser(v: unknown): asserts v is User {
  if (!isUser(v)) throw new TypeError("Not a User");
}
```

For anything beyond trivial shapes, use a schema library (Zod, Valibot, ArkType) — `schema.parse(input)` *is* parse-don't-validate: it returns a typed value or throws, and the static type is inferred from the schema. Note that TypeScript 5.5+ **infers** many simple predicates automatically (e.g. `arr.filter(x => x !== null)` now narrows), so you write fewer guards by hand than you used to.

## 10. Explicit resource management (`using`)

`using` / `await using` (TS 5.2+) give deterministic cleanup via `Symbol.dispose` / `Symbol.asyncDispose` — like RAII or `with` blocks. The resource is disposed when the scope exits, even on throw.

```ts
function openFile(path: string): { handle: number } & Disposable {
  const handle = /* open */ 0;
  return { handle, [Symbol.dispose]() { /* close */ } };
}

{
  using file = openFile("data.txt");
  // …use file…
} // file disposed automatically here
```

Use for files, locks, DB connections, spans — anything that must be released. Cleaner and safer than try/finally chains.

---

**Restraint clause.** Type-level programming is seductive. A 40-line recursive conditional type that saves a 3-line guard is a net loss. Optimize for the reader who maintains this in a year. Prefer the simplest type that makes illegal states unrepresentable, and stop there.
