import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene.ts";
import { MainMenuScene } from "./scenes/MainMenuScene.ts";
import { GachaScene } from "./scenes/GachaScene.ts";
import { CollectionScene } from "./scenes/CollectionScene.ts";
import { StageSelectScene } from "./scenes/StageSelectScene.ts";
import { ShopScene } from "./scenes/ShopScene.ts";
import { PassiveGridScene } from "./scenes/PassiveGridScene.ts";
import { HeroScene } from "./scenes/HeroScene.ts";
import { PreloadScene } from "./scenes/PreloadScene.ts";
import { GAME_HEIGHT, GAME_WIDTH } from "./data/stage.ts";
import { SaveManager } from "./core/saveManager.ts";
import { LocalSaveProvider } from "./core/save.ts";

const provider = new LocalSaveProvider();
const saveManager = new SaveManager(provider);

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
  scene: [PreloadScene, MainMenuScene, StageSelectScene, BattleScene, GachaScene, CollectionScene, ShopScene, PassiveGridScene, HeroScene],
});

game.registry.set("saveManager", saveManager);

// Expose the game for the headless playtest harness (dev, or ?debug on a build).
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  (globalThis as unknown as { __game: typeof game }).__game = game;
}
