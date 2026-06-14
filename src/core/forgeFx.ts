/**
 * forgeFx — pure (Phaser-free) signature spec for the Forge's per-function forging
 * effects. Maps a station (+ success) to a fully-described one-shot VFX so each
 * craft reads distinctly: Awakening erupts a soul-fire pillar, Alchemy swirls a
 * transmute vortex, Copy Exchange fuses ghost copies, Craft Wings flutters feathers
 * (or scatters ash on a failed gamble), Spark drops a guaranteed star. The presenter
 * (forgeFxPlayer.ts) only interprets this — the uniqueness is tested data here.
 * Mirrors the bossSkillTheme → BossFxKit split.
 */
import type { StationId } from "./forgeStations.ts";

export type ForgeFxKind =
  | "ascension"
  | "transmute"
  | "fusion"
  | "featherstorm"
  | "ashfall"
  | "starfall";

export interface ForgeFxSpec {
  kind: ForgeFxKind;
  primary: number; // signature color (hex int)
  accent: number; // secondary color
  glyph: string; // particle glyph
  particles: number; // count of orbiting/converging/spiral motes
  durationMs: number; // total play time
  rise: boolean; // dominant motion is upward vs inward/downward
}

export function forgeFxSpec(station: StationId, success: boolean): ForgeFxSpec {
  switch (station) {
    case "awaken":
      return {
        kind: "ascension",
        primary: 0x9a5cff,
        accent: 0xffe07a,
        glyph: "✦",
        particles: 4,
        durationMs: 900,
        rise: true,
      };
    case "alchemy":
      return {
        kind: "transmute",
        primary: 0x35c7c0,
        accent: 0x9a7bff,
        glyph: "⚗",
        particles: 6,
        durationMs: 850,
        rise: false,
      };
    case "copies":
      return {
        kind: "fusion",
        primary: 0x5fd98a,
        accent: 0xeafff0,
        glyph: "◈",
        particles: 5,
        durationMs: 800,
        rise: false,
      };
    case "wings":
      return success
        ? {
            kind: "featherstorm",
            primary: 0xc77bff,
            accent: 0xfff0ff,
            glyph: "🪶",
            particles: 8,
            durationMs: 1000,
            rise: true,
          }
        : {
            kind: "ashfall",
            primary: 0x6b6b78,
            accent: 0x9a9aa6,
            glyph: "·",
            particles: 7,
            durationMs: 900,
            rise: false,
          };
    case "spark":
      return {
        kind: "starfall",
        primary: 0xffc94d,
        accent: 0xfff6c0,
        glyph: "★",
        particles: 5,
        durationMs: 950,
        rise: false,
      };
  }
}
