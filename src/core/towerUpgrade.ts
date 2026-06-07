/**
 * In-battle tower upgrade design (T12).
 *
 * Buying a star (battleLevel 1..MAX_TOWER_UPGRADES) makes a tower stronger in a
 * way that fits its ROLE, not just bigger numbers. Two layers stack per level:
 *
 *   1. A general power bump every role gets (atk + maxHp), so an upgrade always
 *      feels worthwhile.
 *   2. A role emphasis — extra stat growth AND a scaled role behavior — so each
 *      archetype upgrades toward its fantasy:
 *
 *   role     | stat emphasis (per level) | behavior emphasis (per level)
 *   ---------|---------------------------|------------------------------------
 *   damage   | +atk, +range              | (pure single-target DPS)
 *   splash   | +atk, +range              | +10% splash radius
 *   chain    | +range                    | +1 bounce at L2 & L4, +falloff (keeps dmg)
 *   dot      | +range                    | +12% dot dps, +0.15s dot duration
 *   debuff   | +range (big)              | +5% slow, +0.1s slow, +stun chance/duration
 *   support  | +maxHp, +range            | +8% aura radius, +3% atk aura, +2% atkspd aura
 *
 * The stat emphasis is applied as increased% inside towerStatPipeline; the
 * behavior emphasis is produced by effectiveBehavior() and recomputed onto the
 * tower runtime whenever it spawns or upgrades, so the shared CharacterDef is
 * never mutated.
 */
import type { Stats, TowerBehavior, TowerRole, CharacterDef } from "../data/schema.ts";

/** General increased% applied per battleLevel to every tower, regardless of role. */
export const BATTLE_LEVEL_GENERAL: Partial<Stats> = { atk: 0.06, maxHp: 0.05 };

/** Extra increased% applied per battleLevel, by role (on top of the general bump). */
export const ROLE_STAT_EMPHASIS: Record<TowerRole, Partial<Stats>> = {
  damage: { atk: 0.04, range: 0.05 },
  splash: { atk: 0.03, range: 0.02 },
  chain: { range: 0.05 },
  dot: { range: 0.03 },
  debuff: { range: 0.06 },
  support: { maxHp: 0.05, range: 0.03 },
};

/** Combined increased% per battleLevel for a role (general + emphasis), ×battleLevel. */
export function upgradeIncreased(role: TowerRole, battleLevel: number): Partial<Stats> {
  if (battleLevel <= 0) return {};
  const out: Partial<Stats> = {};
  const add = (s: Partial<Stats>) => {
    for (const [k, v] of Object.entries(s) as [keyof Stats, number][]) {
      out[k] = (out[k] ?? 0) + v * battleLevel;
    }
  };
  add(BATTLE_LEVEL_GENERAL);
  add(ROLE_STAT_EMPHASIS[role]);
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Scale a tower's role behavior for the given battleLevel. Returns a NEW object
 * (never mutates def.behavior). Fields the role doesn't use are passed through.
 */
export function effectiveBehavior(def: CharacterDef, battleLevel: number): TowerBehavior {
  const b: TowerBehavior = { ...(def.behavior ?? {}) };
  const L = Math.max(0, battleLevel);
  if (L === 0) return b;

  switch (def.role) {
    case "splash":
      if (b.splashRadius !== undefined) b.splashRadius = b.splashRadius * (1 + 0.10 * L);
      break;
    case "chain":
      b.chainTargets = (b.chainTargets ?? 2) + Math.floor(L / 2);          // +1 at L2 & L4
      b.chainFalloff = clamp((b.chainFalloff ?? 0.6) + 0.04 * L, 0, 0.95); // retains more dmg
      break;
    case "dot":
      if (b.dot) b.dot = { ...b.dot, dps: b.dot.dps * (1 + 0.12 * L), duration: b.dot.duration + 0.15 * L };
      break;
    case "debuff":
      if (b.slow) b.slow = { pct: clamp(b.slow.pct + 0.05 * L, 0, 0.85), duration: b.slow.duration + 0.1 * L };
      if (b.stun) b.stun = { chance: clamp(b.stun.chance + 0.03 * L, 0, 0.9), duration: b.stun.duration + 0.05 * L };
      break;
    case "support":
      if (b.buffAura) b.buffAura = {
        radius: b.buffAura.radius * (1 + 0.08 * L),
        atkPct: (b.buffAura.atkPct ?? 0) + 0.03 * L,
        attackSpeedPct: (b.buffAura.attackSpeedPct ?? 0) + 0.02 * L,
      };
      break;
    default:
      break; // damage: pure stat scaling, no behavior change
  }
  return b;
}

/** Short player-facing summary of how a role upgrades (for the tooltip / panel). */
export function upgradeSummary(role: TowerRole): string {
  switch (role) {
    case "damage": return "Each star: more attack & range.";
    case "splash": return "Each star: more attack, range & splash radius.";
    case "chain": return "Each star: more range & damage; +1 bounce at ★2 and ★4.";
    case "dot": return "Each star: more range & far stronger/longer damage-over-time.";
    case "debuff": return "Each star: much more range, and a stronger/longer slow (and stun).";
    case "support": return "Each star: tougher, with a wider, stronger buff aura.";
    default: return "Each star: stronger.";
  }
}
