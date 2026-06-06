import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene.ts";
import { GAME_HEIGHT, GAME_WIDTH } from "./data/stage.ts";

// Web-first Phaser bootstrap. Scale.FIT keeps the fixed logical play area
// (960x540) centered and crisp at any screen/device size — important for the
// later Capacitor mobile port.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1b2230",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BattleScene],
});
