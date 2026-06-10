/**
 * Campaign chapters — the player-facing *regions* of the world map.
 *
 * A "player chapter" is a themed region the player travels through (Greywood
 * Pass, Sunscar Wastes, Emberfall). It is identified by the `chN-` PREFIX of a
 * stage id, and is DISTINCT from the 5-stage difficulty band in chapters.ts
 * (`chapterIndexForStage`, which is parsed from the trailing stage number):
 * Chapter 1 spans two bands (stages 1–5 and 6–10) but is a single region.
 *
 * This module owns the narrative metadata — title, biome line, lore blurb, and
 * the (legally-safe, original-wording) homage descriptor shown to players. The
 * real anime/game/film inspirations stay in `// homage:` comments only, never
 * in the shipped strings.
 */
import { bgKey } from "./bgManifest.ts";

export interface CampaignChapter {
  /** 1-based player chapter number. */
  chapter: number;
  /** Id prefix used by stage ids: "ch1", "ch2", … */
  id: string;
  /** Region name shown as the chapter title. */
  title: string;
  /** One-line biome/setting descriptor. */
  biome: string;
  /** Battlefield backdrop texture key for the region. */
  bgKey: string;
  /** One-sentence hook shown under the chapter tab. */
  blurb: string;
  /** 2–3 sentence region lore. */
  lore: string;
  /** Player-facing "Inspired by" line — original wording, no franchise names. */
  homage: string;
}

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [
  {
    chapter: 1,
    id: "ch1",
    title: "Greywood Pass",
    biome: "A misted frontier road through old forest and frostbitten highlands.",
    bgKey: bgKey("chapter-greenwood"),
    blurb: "The road begins. Hold the pass and learn the shape of the war.",
    lore:
      "Greywood Pass is the last waymarked road before the wild country — a chain " +
      "of fords, gullies and warden-gates where the first warbands test the realm's " +
      "defences. Survive it and the easy country ends.",
    // homage: classic JRPG opening overworld (Final Fantasy / Dragon Quest road-out-of-town)
    homage: "Inspired by the gentle opening road of classic adventure RPGs.",
  },
  {
    chapter: 2,
    id: "ch2",
    title: "Sunscar Wastes",
    biome: "A glass-and-bone desert under a sun that will not set.",
    bgKey: bgKey("chapter-desert"),
    blurb: "A pilgrimage across cursed dunes toward an immortal tyrant.",
    lore:
      "Past the frostpeaks the road dies in glass and bone. The Wastes were an " +
      "empire once, until a tyrant chained the sun and burned it to ash in a single " +
      "afternoon. His enforcers still hunt the dunes — and the deeper you march " +
      "toward the Glass Throne, the heavier the sun leans on your shoulders.",
    // homage: a desert pilgrimage toward an immortal antagonist — Stardust Crusaders x Dune
    homage: "Inspired by a long desert pilgrimage toward an immortal tyrant.",
  },
  {
    chapter: 3,
    id: "ch3",
    title: "Emberfall",
    biome: "A vertical descent into a burning citadel with no horizon.",
    bgKey: bgKey("chapter-volcanic"),
    blurb: "Down into the furnace where the dead are forged into soldiers.",
    lore:
      "Beyond the Glass Throne the ground splits and the world drains downward into " +
      "fire. Emberfall is the demon-king's furnace — a citadel of falling embers " +
      "where the fallen are reforged into soldiers. There is no horizon here, only " +
      "deeper, and every stair you take the heat doubles.",
    // homage: descent into a demon-king's burning castle — Infinity Castle x Dante's Inferno
    homage: "Inspired by a descent into a demon-king's burning citadel.",
  },
];

const BY_NUMBER = new Map(CAMPAIGN_CHAPTERS.map((c) => [c.chapter, c]));

/** Player chapter number (1-based) parsed from a stage id's `chN-` prefix. */
export function playerChapterOf(stageId: string): number {
  const m = stageId.match(/^ch(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Region metadata for a stage, or undefined if the prefix is unknown. */
export function campaignChapterForStage(stageId: string): CampaignChapter | undefined {
  return BY_NUMBER.get(playerChapterOf(stageId));
}
