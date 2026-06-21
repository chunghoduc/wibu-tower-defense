// Verifies the tower info panel SHOWS the support-aura buff: places a support
// (buffAura) tower + a damage tower in its radius, ticks the sim so
// recomputeTowerBuffs() runs, selects the damage tower, and reads the rendered
// 'atk' / 'attackSpeed' stat texts (must show the boosted number + aura tint).
//   npx vite --port 4189   then   node scripts/playtest/repro_aura_buff_panel.mjs
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4189");
const DIR = arg("dir", "/tmp");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const t = await (
    await fetch(
      `http://localhost:9222/json/new?${encodeURIComponent(`http://localhost:${PORT}/?debug`)}`,
      { method: "PUT" },
    )
  ).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const rpc = (method, params = {}) =>
    new Promise((res) => {
      const myId = ++id;
      const onMsg = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id === myId) {
          ws.removeEventListener("message", onMsg);
          res(m.result);
        }
      };
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  const evalJs = async (expr) => {
    const r = await rpc("Runtime.evaluate", {
      expression: `(async()=>{${expr}})()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      console.log("  EXC:", r.exceptionDetails.text, r.result?.description || "");
    return r.result?.value;
  };
  const shoot = async (name) => {
    const shot = await rpc("Page.captureScreenshot", { format: "png" });
    if (shot?.data) {
      writeFileSync(`${DIR}/${name}.png`, Buffer.from(shot.data, "base64"));
      console.log("shot:", `${DIR}/${name}.png`);
    }
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Emulation.setDeviceMetricsOverride", {
    width: 960,
    height: 540,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(800);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.registry.get("saveManager"));`);
    if (ready) break;
    await wait(500);
  }
  console.log("game ready:", ready);

  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("BattleScene"); return "battle";`);
  await wait(3000);

  const result = await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
    const b=bs.battle; b.gold=99999;
    const mod = await import("/src/data/towers.ts");
    const TOWERS = mod.TOWERS;
    const support = TOWERS.find(d=>d.role==="support");
    const dmg = TOWERS.find(d=>d.role==="damage");
    const can=(x,y)=>b.canPlaceAt({x,y});
    // Find a placeable spot for the damage tower, then drop the support adjacent.
    let spotD=null;
    for(let x=120;x<=820&&!spotD;x+=40)for(let y=120;y<=460;y+=40){ if(can(x,y)){spotD={x,y};break;} }
    const near={x:spotD.x+36,y:spotD.y};
    const spotS = can(near.x,near.y)?near:{x:spotD.x-36,y:spotD.y};
    let okD=b.placeTowerAt(dmg.id, spotD);
    let okS=b.placeTowerAt(support.id, spotS);
    // Step the sim so recomputeTowerBuffs runs.
    for(let i=0;i<3;i++) b.tick(0.05);
    const dt = b.towers.find(t=>t.def.id===dmg.id);
    // Select it through the real UI path.
    bs.selectTower(dt.uid);
    bs.draw();
    // Read the rendered stat texts straight off the panel.
    const map = bs.panel.statTextByKey;
    const atk = map.get("atk"), as = map.get("attackSpeed");
    return JSON.stringify({
      okD, okS, support: support.id, dmg: dmg.id,
      buffAtkPct: dt.buffAtkPct, buffAsPct: dt.buffAsPct,
      baseAtk: Math.round(dt.stats.atk), baseAs: +dt.stats.attackSpeed.toFixed(2),
      atkText: atk && atk.text, atkColor: atk && atk.style.color,
      asText: as && as.text, asColor: as && as.style.color,
    });`);
  console.log("RESULT:", result);
  await shoot("aura_buff_panel");

  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
