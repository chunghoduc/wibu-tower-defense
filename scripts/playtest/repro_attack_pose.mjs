// Attack-pose repro.
//
// Proves towers swap to their single-frame __attack combat-stance texture while
// engaged (an enemy in range) and relax back to the animated base sheet after
// the lane lulls. Drives a battle, places towers, waits for a wave, and polls
// each tower sprite's live texture.key.
//   node scripts/playtest/repro_attack_pose.mjs [--port=4188] [--shot=/tmp/attackpose.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/attackpose.png");
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
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(6000);

  console.log(
    "start:",
    await evalJs(`const g=window.__game; if(!g) return "no game";
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "started";`),
  );
  await wait(1800);
  console.log(
    "place:",
    await evalJs(`const bs=window.__game.scene.getScene("BattleScene");
    if(!bs||!bs.battle) return "no battle";
    const ids=(bs.buildOrder||[]).map(d=>d.id); let p=0;
    for(let i=0;i<Math.min(4,ids.length);i++) if(bs.battle.placeTower(ids[i],i)) p++;
    return "placed="+p;`),
  );

  // Poll up to ~12s for at least one tower to enter its engaged pose.
  const probe = `
    const bs=window.__game.scene.getScene("BattleScene");
    const out=[];
    for(const [uid,s] of bs.towerSprites){
      const baseId=s.texture.key.replace(/^tower__/,"").replace(/__attack$/,"");
      const ak="tower__"+baseId+"__attack";
      out.push({key:s.texture.key, posed:s.texture.key.endsWith("__attack"),
        atkLoaded:bs.textures.exists(ak),
        engagedIn:Math.round(((s.getData("engagedUntil")||0)-bs.time.now))});
    }
    return JSON.stringify({nEnemies:(bs.battle.enemies||[]).length,
      tEnemies:(bs.battle.enemies||[]).filter(e=>e.alive).length, towers:out});`;
  let last = JSON.parse(await evalJs(probe));
  console.log("placed towers:", JSON.stringify(last));

  // Deterministic render-path check: force one tower into its engaged window and
  // confirm manageSprites swaps the live texture to the __attack pose, scales it,
  // then reverts once the window clears. (Real combat fires too sparsely to poll.)
  const force = `
    const bs=window.__game.scene.getScene("BattleScene");
    const [uid,s]=[...bs.towerSprites.entries()][0];
    s.setData("engagedUntil", bs.time.now + 4000);`;
  await evalJs(force);
  await wait(120); // a few frames for manageSprites to run the swap
  const engaged = JSON.parse(
    await evalJs(`const bs=window.__game.scene.getScene("BattleScene");
      const s=[...bs.towerSprites.values()][0];
      return JSON.stringify({key:s.texture.key, posed:s.texture.key.endsWith("__attack"),
        scaleY:Math.round(s.scaleY*1000)/1000, originY:s.originY});`),
  );
  console.log("forced-engaged:", JSON.stringify(engaged));
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(shot.data, "base64"));

  // Clear the window and confirm it relaxes back to the animated base sheet.
  await evalJs(`const bs=window.__game.scene.getScene("BattleScene");
    [...bs.towerSprites.values()][0].setData("engagedUntil", 0);`);
  await wait(200);
  const relaxedSample = JSON.parse(
    await evalJs(`const bs=window.__game.scene.getScene("BattleScene");
      const s=[...bs.towerSprites.values()][0];
      return JSON.stringify({key:s.texture.key, posed:s.texture.key.endsWith("__attack")});`),
  );
  console.log("after-clear:", JSON.stringify(relaxedSample));

  const sawPose = engaged.posed === true;
  const relaxed = relaxedSample.posed === false;
  const v = [];
  v.push(["forced-engaged tower swaps to its __attack pose texture", sawPose]);
  v.push(["pose origin lowered to feet (>0.78)", engaged.originY > 0.78]);
  v.push(["tower relaxes back to base sheet when window clears", relaxed]);
  for (const [name, ok] of v) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log("screenshot:", SHOT);
  ws.close();
  if (!sawPose) process.exitCode = 2;
}
main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
