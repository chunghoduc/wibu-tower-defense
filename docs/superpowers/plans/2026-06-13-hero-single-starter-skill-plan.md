# Plan: Hero starts with a single equipped active skill

Spec: `docs/superpowers/specs/2026-06-13-hero-single-starter-skill-design.md`

## Milestone 1 — Fresh-save invariant (TDD, single commit)

### RED
Add tests to `tests/saveManager.test.ts` under a new `describe("fresh-save starter skills")`:

1. Fresh save equips exactly one active skill: `equippedSkillIds.length === 1`.
2. The equipped skill is `STARTER_SKILL_IDS[0]` (`"valiant-strike"`).
3. Hero still owns BOTH starters: `obtainedSkills` contains both ids in `STARTER_SKILL_IDS`.
4. Cap is respected generally: `equippedSkillIds.length <= MAX_ACTIVE_SKILLS`.

Import `STARTER_SKILL_IDS, MAX_ACTIVE_SKILLS` from `../src/data/skills.ts`.
Run `npx vitest run tests/saveManager.test.ts` → test 1/2/4 fail (current length is 2).

### GREEN
In `src/core/saveManagerCore.ts` `freshWithStarters()`:
- Change `save.hero.equippedSkillIds = [...STARTER_SKILL_IDS];`
  to `save.hero.equippedSkillIds = [STARTER_SKILL_IDS[0]];`
- Update the line-77 comment to note: owns two starters, equips one.

Run the test file → green.

### Verify
- `npx vitest run` (full suite green — no other test asserts both equipped)
- `npm run typecheck`
- `npm run lint` (file stays well under 500 lines)

### Commit
`fix(skills): new hero equips a single starter active (owns both, equips one)`
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
