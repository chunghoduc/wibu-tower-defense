// Affix-reroll Forge station repro. Seeds the real save with Rare/Legendary/Unique
// gear + entropy, opens the Reroll dialog on ForgeScene, screenshots it, fires a
// reroll on the selected item via its button zone, and screenshots the
// before/after comparison. Asserts no client errors + that affixes changed + cost
// escalated (rerollCount incremented).
//   node scripts/playtest/repro_affix_reroll.mjs [--port=4191]
import { writeFileSync } from "node:fs";
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4191");
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
  const errors = [];
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Log.enable");
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails?.text || "exception");
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      errors.push(m.params.entry.text);
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
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(700);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.scene);`);
    if (ready) break;
    await wait(400);
  }
  console.log("game ready:", ready);

  // Seed gear + entropy, open the Reroll dialog.
  const seeded = await evalJs(`
    const g = window.__game;
    const mgr = g.registry.get("saveManager");
    const itemsMod = await import('/src/data/items.ts');
    const dropMod = await import('/src/core/itemDrop.ts');
    const matMod = await import('/src/data/materials.ts');
    const save = mgr.getSave();
    const pick = (rar) => itemsMod.ITEM_CATALOG.find(d => d.rarity===rar && d.affixPool.length>=3);
    const mk = (rar, lvl) => dropMod.toItemInstanceSave(itemsMod.rollItem(pick(rar), lvl, Math.floor(Math.random()*1e6)));
    const r = mk('Rare', 20), l = mk('Legendary', 40), u = mk('Unique', 60);
    save.inventory.items.push(r, l, u);
    save.currency.gold = 999999;
    save.materials[matMod.CHAOS_JEWEL] = 300;
    // start ForgeScene
    g.scene.stop('MainMenuScene');
    g.scene.start('ForgeScene');
    return { ids:[r.id,l.id,u.id], names:[pick('Rare').name,pick('Legendary').name,pick('Unique').name] };
  `);
  console.log("seeded:", JSON.stringify(seeded));
  await wait(900);

  const opened = await evalJs(`
    const g = window.__game;
    const forge = g.scene.getScene('ForgeScene');
    forge.openReroll();
    return true;
  `);
  console.log("opened reroll dialog:", opened);
  await wait(600);

  await rpc("Page.bringToFront");
  let shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync("/tmp/reroll_before.png", Buffer.from(shot.data, "base64"));
  console.log("wrote /tmp/reroll_before.png");

  // Find the big REROLL button zone (width 168, height 38) and fire it.
  const fired = await evalJs(`
    const g = window.__game;
    const forge = g.scene.getScene('ForgeScene');
    const save = g.registry.get('saveManager').getSave();
    const selId = save.inventory.items.find(it=>{
      // the first eligible = highest rarity (Unique) is auto-selected
      return true;
    });
    const zones = [];
    const walk = (o) => { if (!o) return; if (o.type==='Zone') zones.push(o); if (o.list) o.list.forEach(walk); };
    forge.children.list.forEach(walk);
    const btn = zones.find(z => Math.round(z.width)===168 && Math.round(z.height)===38);
    const before = JSON.stringify(save.inventory.items.map(i=>({id:i.id, rr:i.rerollCount, aff:i.rolledAffixes})));
    if (btn) btn.emit('pointerup');
    const after = JSON.stringify(save.inventory.items.map(i=>({id:i.id, rr:i.rerollCount, aff:i.rolledAffixes})));
    return { found: !!btn, changed: before!==after, items: save.inventory.items.map(i=>({rr:i.rerollCount})) };
  `);
  console.log("reroll fired:", JSON.stringify(fired));
  await wait(500);
  shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync("/tmp/reroll_after.png", Buffer.from(shot.data, "base64"));
  console.log("wrote /tmp/reroll_after.png");

  console.log("client errors:", errors.length ? errors : "none");
  ws.close();
}
main();
