// Headless playtest driver (servers started externally). Drives the game via
// Chrome DevTools Protocol, runs a battle scenario, writes a screenshot.
//
//   # build first, start: vite preview --port 4188  +  chrome --remote-debugging-port=9222
//   node scripts/playtest/playtest.mjs --out=/tmp/shot.png [--place=4] [--wait=4000] [--eval='js'] [--scene=BattleScene]
//
// window.__game is exposed in dev/?debug. TS private fields are readable at
// runtime, so scenarios can poke scene internals.
import { writeFileSync } from "node:fs";

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : d; };
const OUT = arg("out", "/tmp/playtest.png");
const PLACE = Number(arg("place", "4"));
const WAIT = Number(arg("wait", "4000"));
const EXTRA = arg("eval", "");
const SCENE = arg("scene", "BattleScene");
const PORT = arg("port", "4188");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const t = await (await fetch(`http://localhost:9222/json/new?${encodeURIComponent(`http://localhost:${PORT}/?debug`)}`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const rpc = (method, params = {}) => new Promise((res) => {
    const myId = ++id;
    const onMsg = (ev) => { const m = JSON.parse(ev.data); if (m.id === myId) { ws.removeEventListener("message", onMsg); res(m.result); } };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await rpc("Runtime.evaluate", { expression: `(()=>{${expr}})()`, returnByValue: true });
    if (r.exceptionDetails) console.log("  EXC:", r.exceptionDetails.text, r.result?.description || "");
    return r.result?.value;
  };
  await rpc("Page.enable"); await rpc("Runtime.enable");
  await wait(5500); // preload + menu

  if (SCENE === "BattleScene") {
    console.log("scene:", await evalJs(`const g=window.__game; if(!g) return "no game";
      ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
      g.scene.start("BattleScene"); return "started";`));
    await wait(1600);
    console.log("place:", await evalJs(`
      const bs=window.__game.scene.getScene("BattleScene");
      if(!bs||!bs.battle) return "no battle";
      const ids=(bs.buildOrder||[]).map(d=>d.id); let p=0;
      for(let i=0;i<Math.min(${PLACE},ids.length);i++) if(bs.battle.placeTower(ids[i],i)) p++;
      return "placed="+p+" gold="+bs.battle.gold;`));
  } else {
    console.log("scene:", await evalJs(`window.__game.scene.start("${SCENE}"); return "started ${SCENE}";`));
    await wait(1200);
  }

  if (EXTRA) console.log("eval:", await evalJs(EXTRA));
  await wait(WAIT);

  if (SCENE === "BattleScene") {
    console.log("state:", await evalJs(`
      const bs=window.__game.scene.getScene("BattleScene");
      return JSON.stringify({wave:bs.battle.waveIndex,enemies:bs.battle.enemies.length,towers:bs.battle.towers.length,castle:Math.ceil(bs.battle.castleHp),outcome:bs.battle.outcome});`));
  }
  const png = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(png.data, "base64"));
  console.log("screenshot:", OUT);
  ws.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERR", e.message); process.exit(1); });
