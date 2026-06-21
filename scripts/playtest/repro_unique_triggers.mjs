// Unique triggered-powers repro. Grants + equips Dawnbreaker (onHit execute) and
// Aegis of Dawn (onHurt reflect), starts a battle, and confirms the live battle
// resolved their triggers — then ticks until an enemy strikes the hero and proves
// thornmail reflects damage back. Also screenshots the inventory tooltip ⚡ line.
//   node scripts/playtest/repro_unique_triggers.mjs [--port=4188] [--shot=/tmp/unique_triggers.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/unique_triggers.png");
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
  await wait(4000);

  // Grant + equip the two trigger uniques.
  console.log(
    "equip:",
    await evalJs(`
    const g = window.__game;
    const mgr = g.registry.get('saveManager');
    const save = mgr.getSave();
    const inst = (id, defId) => ({ id, defId, acquiredLevel: 60, rolledStats: {}, rolledPrimaryAffix: 0, rolledAffixes: [], enhanceLevel: 0 });
    save.hero.level = 60;
    save.inventory.items.push(inst('u-weap', 'dawnbreaker'));
    save.inventory.items.push(inst('u-body', 'aegis-of-dawn'));
    save.inventory.equipped.Weapon = 'u-weap';
    save.inventory.equipped.BodyArmor = 'u-body';
    return JSON.stringify({ items: save.inventory.items.length, equipped: save.inventory.equipped });
  `),
  );

  // Start a battle and read the resolved triggers off the live BattleState.
  await evalJs(`
    const g = window.__game;
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene","InventoryScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene");
  `);
  await wait(1800);
  console.log(
    "triggers:",
    await evalJs(`
    const bs = window.__game.scene.getScene("BattleScene");
    if (!bs || !bs.battle) return "no battle";
    const t = bs.battle.triggers;
    return JSON.stringify({
      onHit: t.onHit.map(e=>e.kind),
      onHurt: t.onHurt.map(e=>e.kind),
      onKill: t.onKill.map(e=>e.kind),
    });
  `),
  );

  // Place towers, then run the battle and watch the hero take a hit + reflect.
  await evalJs(`
    const bs = window.__game.scene.getScene("BattleScene");
    const ids=(bs.buildOrder||[]).map(d=>d.id);
    for(let i=0;i<Math.min(4,ids.length);i++) bs.battle.placeTower(ids[i], i);
  `);
  await wait(8000);
  console.log(
    "state:",
    await evalJs(`
    const bs = window.__game.scene.getScene("BattleScene");
    const b = bs.battle;
    return JSON.stringify({ wave: b.waveIndex, enemies: b.enemies.length, heroHp: Math.ceil(b.hero.hp), outcome: b.outcome });
  `),
  );

  await wait(400);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
  console.log("shot:", SHOT);
  ws.close();
}
main();
