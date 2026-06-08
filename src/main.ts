import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene.ts";
import { MainMenuScene } from "./scenes/MainMenuScene.ts";
import { GachaScene } from "./scenes/GachaScene.ts";
import { CollectionScene } from "./scenes/CollectionScene.ts";
import { StageSelectScene } from "./scenes/StageSelectScene.ts";
import { ShopScene } from "./scenes/ShopScene.ts";
import { PassiveGridScene } from "./scenes/PassiveGridScene.ts";
import { HeroScene } from "./scenes/HeroScene.ts";
import { SquadScene } from "./scenes/SquadScene.ts";
import { SettingsScene } from "./scenes/SettingsScene.ts";
import { SkillsScene } from "./scenes/SkillsScene.ts";
import { QuestScene } from "./scenes/QuestScene.ts";
import { PreloadScene } from "./scenes/PreloadScene.ts";
import { GAME_HEIGHT, GAME_WIDTH, STAGES } from "./data/stage.ts";
import { SaveManager } from "./core/saveManager.ts";
import { LocalSaveProvider } from "./core/save.ts";
import { installLogger, log } from "./debug/logger.ts";
import { setCombatLogSink } from "./core/combatLog.ts";
import { setAudioVolume, setAudioMuted } from "./scenes/audio.ts";

installLogger();

const provider = new LocalSaveProvider();
const saveManager = new SaveManager(provider);

// Apply persisted audio settings at boot (music starts on first user gesture
// from the main menu, which is required for Web Audio to play).
{
  const s = saveManager.getSettings();
  setAudioVolume(s.volume);
  setAudioMuted(s.muted);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1b2230",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [PreloadScene, MainMenuScene, StageSelectScene, BattleScene, GachaScene, CollectionScene, ShopScene, PassiveGridScene, HeroScene, SquadScene, SettingsScene, SkillsScene, QuestScene],
});

game.registry.set("saveManager", saveManager);

// Breadcrumb every scene create/shutdown — the trail that makes a later crash
// diagnosable (e.g. the scene-re-entry class of bug). Scenes are instantiated by
// boot time, and these emitters persist for each instance across start/stop.
game.events.once(Phaser.Core.Events.READY, () => {
  for (const sc of game.scene.getScenes(false)) {
    const key = sc.scene.key;
    sc.events.on(Phaser.Scenes.Events.CREATE, () => log.info("scene", `create ${key}`));
    sc.events.on(Phaser.Scenes.Events.SHUTDOWN, () => log.info("scene", `shutdown ${key}`));
  }
});

// Expose the game for the headless playtest harness (dev, or ?debug on a build).
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  (globalThis as unknown as { __game: typeof game }).__game = game;
  // Jump straight into any stage's battlefield: __battle(7) loads stage 7.
  (globalThis as unknown as { __battle: (n: number) => string }).__battle = (n = 1) => {
    const st = STAGES[Math.max(1, Math.min(STAGES.length, n)) - 1];
    game.registry.set("selectedStage", st);
    game.scene.stop("BattleScene");
    game.scene.start("BattleScene");
    return `battle -> ${st.id} (${st.name})`;
  };
  // Damage-calculation debugging: call __damageLog() in the console to stream the
  // full per-hit formula to the console + runtime log, __damageLog(false) to stop.
  (globalThis as unknown as { __damageLog: (on?: boolean) => string }).__damageLog = (on = true) => {
    setCombatLogSink(on ? (line) => { console.log(line); log.info("dmg", line); } : null);
    return on ? "damage logging ON" : "damage logging OFF";
  };
}
