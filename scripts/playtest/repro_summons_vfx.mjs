// Live repro for the flexible-magic + summon-skill feature. Equips a summon
// skill on the hero, forces a cast, and proves friendly minions spawn into
// battle.minions and damage enemies. Also screenshots a battle with minions.
//   node scripts/playtest/repro_summons_vfx.mjs [--port=4188] [--shot=/tmp/summons.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/summons.png");
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
  await wait(3000);

  // Start a battle, then directly drive the sim: cast a summon active from the
  // hero and confirm minions spawn + damage an enemy.
  const out = await evalJs(`
    const g = window.__game;
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene","InventoryScene","SkillsScene"].forEach(s=>g.scene.stop(s));
    g.scene.stop("BattleScene"); g.scene.start("BattleScene");
    await new Promise(r=>setTimeout(r,800));
    const bs = g.scene.getScene("BattleScene");
    const b = bs.battle;
    // let some enemies spawn
    for (let i=0;i<60 && b.enemies.length===0;i++) b.tick(0.05);
    const before = b.minions.length;
    // cast Conjure Flame Sprites from the hero at the first enemy (or hero pos)
    const target = b.enemies[0] ? b.enemies[0].pos : b.hero.pos;
    const SUMMON = { id:'conjure-flame-sprites' };
    b.castActive(b.hero.stats, b.hero.stats.atk, 'Magic', target, b.hero.pos, 'hero', -1, 'conjure-flame-sprites', undefined, 1, 'Legendary');
    const spawned = b.minions.length;
    const e = b.enemies[0];
    const hp0 = e ? e.hp : 0;
    for (let i=0;i<80;i++) b.tick(0.05); // 4s of minion combat
    const hp1 = e ? e.hp : 0;
    // also summon a golem + hawks to populate the field for the shot
    b.castActive(b.hero.stats, b.hero.stats.atk, 'Magic', b.hero.pos, b.hero.pos, 'hero', -1, 'summon-frost-golem', undefined, 1, 'Legendary');
    b.castActive(b.hero.stats, b.hero.stats.atk, 'Magic', b.hero.pos, b.hero.pos, 'hero', -1, 'call-storm-hawks', undefined, 1, 'Legendary');
    // place a couple towers for context
    const ids=(bs.buildOrder||[]).map(d=>d.id);
    for(let i=0;i<Math.min(3,ids.length);i++) b.placeTower(ids[i], i);
    return JSON.stringify({ before, spawned, minionsNow: b.minions.length,
      kinds: b.minions.map(m=>m.def.id), enemyDamaged: hp1 < hp0, dmg: Math.round(hp0-hp1) });
  `);
  console.log("summon result:", out);

  await wait(2500);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
  console.log("shot:", SHOT);
  ws.close();
}
main();
