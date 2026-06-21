// Per-instance unique-trigger repro. Grants several copies of the SAME unique with
// DIFFERENT instance ids, equips each in turn, restarts BattleScene (which rebuilds
// resolveBattleTriggers), and records the rolled trigger kind — proving two copies
// of one item proc differently. Also screenshots a live battle.
//   node scripts/playtest/repro_unique_per_instance.mjs [--port=4188] [--shot=/tmp/unique_per_instance.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/unique_per_instance.png");
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
  await wait(600);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.scene);`);
    if (ready) break;
    await wait(400);
  }
  console.log("game ready:", ready);
  await wait(3500);

  // Grant 6 copies of Dawnbreaker, each a distinct instance id.
  await evalJs(`
    const g = window.__game;
    const save = g.registry.get('saveManager').getSave();
    save.hero.level = 60;
    const inst = (id) => ({ id, defId:'dawnbreaker', acquiredLevel:60, rolledStats:{}, rolledPrimaryAffix:0, rolledAffixes:[], enhanceLevel:0 });
    for (let i=0;i<6;i++) save.inventory.items.push(inst('dawn-'+i));
    return true;
  `);

  // For each copy: equip it, restart BattleScene, read the rolled onHit/onCrit/... kind.
  const kinds = [];
  for (let i = 0; i < 6; i++) {
    const k = await evalJs(`
      const g = window.__game;
      g.registry.get('saveManager').getSave().inventory.equipped.Weapon = 'dawn-${i}';
      ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene","InventoryScene"].forEach(s=>g.scene.stop(s));
      g.scene.stop("BattleScene"); g.scene.start("BattleScene");
      await new Promise(r=>setTimeout(r,500));
      const bs = g.scene.getScene("BattleScene");
      const t = bs.battle.triggers;
      const all = [...t.onHit,...t.onCrit,...t.onKill,...t.onHurt,...t.onCast];
      return all.map(e=>e.kind).join(",");
    `);
    kinds.push(k);
  }
  console.log("per-copy rolled kinds (dawnbreaker x6):", JSON.stringify(kinds));
  console.log("distinct kinds:", JSON.stringify([...new Set(kinds)]));

  // Place a few towers and let a battle run for the screenshot.
  await evalJs(`
    const bs = window.__game.scene.getScene("BattleScene");
    const ids=(bs.buildOrder||[]).map(d=>d.id);
    for(let i=0;i<Math.min(4,ids.length);i++) bs.battle.placeTower(ids[i], i);
  `);
  await wait(7000);
  console.log(
    "state:",
    await evalJs(`
    const b = window.__game.scene.getScene("BattleScene").battle;
    return JSON.stringify({ wave:b.waveIndex, enemies:b.enemies.length, heroHp:Math.ceil(b.hero.hp), outcome:b.outcome });
  `),
  );
  await wait(300);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
  console.log("shot:", SHOT);
  ws.close();
}
main();
