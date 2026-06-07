---
name: typescript-expert
description: Write, review, and refactor TypeScript like a senior specialist — strict type safety, expressive type-level design, idiomatic conventions, and modern (TypeScript 6.x / 7.x) features. Use this skill whenever the task involves writing, reviewing, debugging, or designing TypeScript or .ts/.tsx code, setting up or fixing tsconfig.json, modeling domain types, designing generic APIs or library type signatures, eliminating `any`, fixing type errors, or migrating JavaScript to TypeScript — even when the user only says "TS", "types", "write this in TypeScript", or pastes a type error without naming the language. Prefer this skill over writing TypeScript from memory, since it encodes current defaults and patterns that drift quickly.
---

# TypeScript Expert

This skill turns ordinary TypeScript output into the kind a senior TypeScript engineer would write and approve in code review: type-safe by construction, expressive without being clever for its own sake, and aligned with the current ecosystem.

Apply it to any TypeScript work — application code, library type signatures, config, type-level utilities, refactors, error fixing, or JS→TS migration.

## The mindset (read this first)

Expert TypeScript is not "JavaScript with annotations sprinkled on." It is **type-driven design**: the types come first and the implementation flows from them. Internalize these four principles; everything else in this skill is downstream of them.

1. **Make illegal states unrepresentable.** If a combination of values can never validly occur, the type system should forbid it. A loading state that somehow also has an error, a user with `isPaid: true` but no `subscription` — these bugs vanish when the shape can't be constructed. Reach for discriminated unions over bags of optional fields.

2. **Parse, don't validate.** Validate untrusted input *once*, at the boundary, and return a *narrower type* that carries the proof forward. Downstream code receives `User`, not `unknown` it has to re-check. The type is the receipt that validation happened.

3. **Let inference do the work; annotate the contracts.** Don't annotate what the compiler already knows (local `const`s, obvious returns of trivial arrows). *Do* annotate the contracts that others depend on: exported function signatures, public return types, module boundaries. Explicit boundaries + inferred internals is the expert balance.

4. **Types are documentation that can't go stale.** A precise type teaches the reader how to use the code. Prefer a type that explains itself (`type Pixels = number & { _brand: "Pixels" }`) over a comment that says "this is in pixels."

## Workflow for any TypeScript task

1. **Understand the domain before typing it.** What are the real entities and states? What's impossible? This determines your types.
2. **Check the config reality.** If a `tsconfig.json` exists, read it — strictness level changes what code is correct. If you're scaffolding, set up strict config (see `references/tsconfig.md`). Assume `strict: true` unless told otherwise; on TypeScript 6.0+ it is the default.
3. **Design the types, then implement.** Model state and boundaries first. Write the implementation to satisfy the types.
4. **Apply the quick decision rules below** at every choice point — they're the high-frequency calls that separate expert from average code.
5. **Self-review** against the checklist at the bottom before presenting.

## Quick decision rules

These are the calls you make constantly. Get them right by reflex.

- **`any` → `unknown`.** `any` silently disables type checking and infects everything it touches. Use `unknown` and narrow, or write a proper generic. The only acceptable `any` is rare, localized, and commented with why.
- **Type assertion (`as`) → type guard.** `value as Foo` is a lie the compiler can't check. Prefer a user-defined type guard (`function isFoo(v: unknown): v is Foo`) or a schema parse. Acceptable `as` uses: `as const`, narrowing `unknown` after a real runtime check you can't express otherwise, and test fixtures.
- **`enum` → union of string literals or `as const` object.** Enums emit runtime code, have surprising numeric-reverse-mapping behavior, and interact poorly with `isolatedModules`/type-stripping. `type Status = "idle" | "active" | "done"` is simpler, tree-shakeable, and erasable. (See `references/pitfalls.md` for the `as const` object pattern when you need a runtime value.)
- **Bag of optionals → discriminated union.** If two fields are "always together or never," or a `boolean` flag implies the presence of other fields, model it as a tagged union instead.
- **`interface` for object shapes you might extend or merge; `type` for unions, intersections, mapped/conditional types, and aliases of primitives or functions.** Both are fine for plain objects — pick one and stay consistent within a file/project.
- **`import type` for type-only imports.** Keeps types out of the runtime graph, prevents accidental side-effect imports and circular-dependency surprises, and is required-friendly under `verbatimModuleSyntax`.
- **Explicit return types on exported functions.** Catches accidental return-type drift and makes the contract readable without opening the body.
- **`readonly` for data you don't mutate.** `readonly T[]` / `Readonly<T>` on parameters signals intent and prevents accidental mutation of callers' data.

## Reference material — load what the task needs

This skill keeps deep material in `references/`. Read the file relevant to the task; don't load all of them by default.

- **`references/tsconfig.md`** — Configuration. Strict-flag recommendations, copy-paste configs for app / library / monorepo / DOM vs Node, and the TypeScript 6.0 default changes (strict-by-default, ES2025 target, `bundler` resolution, `@types` no longer auto-discovered, deprecated options). Read when scaffolding a project, fixing build/resolution errors, or asked about strictness.
- **`references/type-patterns.md`** — Type-level engineering. Generics and constraints, discriminated unions, branded/nominal types, the `satisfies` operator, `const` type parameters, key utility types, template-literal types, conditional & mapped types, exhaustiveness checking, and explicit resource management (`using`). Read when designing generic APIs, library types, domain models, or any non-trivial type.
- **`references/conventions.md`** — Naming, file/folder structure, import style, and project organization. Read when scaffolding, reviewing structure, or asked about conventions.
- **`references/pitfalls.md`** — Anti-patterns and their fixes, plus modern-feature awareness (what changed recently and what to stop doing). Read when reviewing existing code, debugging type weirdness, or modernizing a codebase.

## Modern TypeScript awareness (do not write outdated code)

TypeScript moves fast and training data goes stale. Keep these current facts in mind; details in `references/`.

- **TypeScript 6.0 (shipped March 2026)** flipped several defaults: `strict` is now `true` by default, `target` defaults to ES2025, module resolution defaults to `bundler`, and `@types` packages are no longer auto-discovered (declare them in `"types"`). Several legacy options (`baseUrl`, `outFile`, `downlevelIteration`) are deprecated. Import attributes use `with { ... }`, not the old `assert { ... }`.
- **TypeScript 7.0** is a native (Go) rewrite of the compiler targeting ~10x faster builds. The *language* is largely the same; the toolchain is what changes.
- **Erasable-syntax era.** Node and other runtimes increasingly run `.ts` by stripping types. Favor syntax that erases cleanly: union types over `enum`, plain classes over parameter-property-heavy patterns when erasability matters. This is another reason to avoid `enum` and namespaces.
- **`Record`s & `Tuple`s** (the immutable-value-type proposal) was **withdrawn** by TC39 — do not reference it as upcoming.
- Use modern language features where they fit: `satisfies` (validate without widening), `using`/`await using` (deterministic cleanup), `const` type parameters (preserve literal inference), and inferred type predicates (the compiler now infers many guards you used to write by hand).

## Self-review checklist

Before presenting TypeScript, verify:

- [ ] No `any` (except rare, localized, commented). No unchecked `as` assertions.
- [ ] Illegal states are unrepresentable — unions are discriminated, no contradictory optional bags.
- [ ] Exported functions have explicit return types; internal locals lean on inference.
- [ ] Untrusted input is parsed/narrowed at the boundary, not re-checked everywhere.
- [ ] No `enum` where a union or `as const` object would do.
- [ ] `import type` used for type-only imports.
- [ ] Generics carry types through instead of erasing them to `any`/`unknown`.
- [ ] `switch` over a union has an exhaustiveness guard (`assertNever`) if new variants are plausible.
- [ ] Names follow convention (PascalCase types, camelCase values, no `I`-prefix).
- [ ] Code is correct under `strict` (and ideally `noUncheckedIndexedAccess`).

When you bend a rule, do it deliberately and say why in a brief comment — expert code is intentional, not accidental.
