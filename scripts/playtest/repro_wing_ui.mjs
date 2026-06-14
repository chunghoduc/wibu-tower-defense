// Wing-craft redesigned-UI repro.
//
// Synthetic touch input does not reach the headless game, so we drive the public
// dialog at the event-ROUTING level: open the dialog with a LARGE inventory, then
// emit `pointerup` on the located control zones and assert the redesigned behavior.
// Asserts:
//   A) opens without throwing on a 60-item inventory;
//   B) the tray WINDOWS its tiles (<= cols*rowsVisible rendered, never the full 60) —
//      proves the no-overflow scroll fix;
//   C) rarity filter chips = All + one per present rarity;
//   D) Auto fills 5 lowest-rarity items + 1 jewel + feather, then Forge -> confirm
//      is called with exactly 5 ids and 1 jewel;
//   E) Clear empties the machine (a second Forge after Clear does NOT fire confirm).
//   node scripts/playtest/repro_wing_ui.mjs [--port=4188]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
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
  for (let i = 0; i < 40; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.scene);`);
    if (ready) break;
    await wait(400);
  }
  console.log("game ready:", ready);

  const out = await evalJs(`
    const g = window.__game;
    const scene = g.scene.getScene("MainMenuScene") || g.scene.scenes.find(s=>s.scene.isActive());
    const mod = await import('/src/scenes/wingCraftDialog.ts');
    const layMod = await import('/src/core/wingCraftMachine.ts');
    const akeys = await import('/src/data/assetKeys.ts');
    const itemsMod = await import('/src/data/items.ts');
    const catalog = itemsMod.ITEM_CATALOG || Object.values(itemsMod.ITEM_CATALOG_MAP || {});
    const goodDef = (catalog.find(d => scene.textures.exists(akeys.itemTex(d.id))) || {}).id || 'iron-sword';
    const W = g.scale.gameSize.width, H = g.scale.gameSize.height;
    const L = layMod.wingMachineLayout(W, H);
    const ap = scene.input.activePointer;

    // 60 items: 20 Common, 20 Rare, 20 Legendary (lowest rarity = Common).
    const rar = (i) => i < 20 ? 'Common' : i < 40 ? 'Rare' : 'Legendary';
    const items = Array.from({length:60}, (_,i)=>({ id:'it'+i, defId:goodDef, name:'Item '+i, rarity: rar(i) }));

    window.__confirm = null;
    const dlg = mod.openWingCraftDialog(scene, {
      items, jewelsOwned: 3, feathersOwned: 1,
      preview: (ids,j) => ({ success: 0.5, odds: [{rarity:'Common',chance:1}] }),
      confirm: (ids,j) => { window.__confirm = { n: ids.length, jewels: j }; },
      onClose: () => {},
    });

    // --- collect zones recursively from the dialog tree ---
    const zones = [];
    const walk = (o) => {
      if (!o) return;
      if (o.type === 'Zone') zones.push(o);
      if (o.list) o.list.forEach(walk);
    };
    walk(dlg);
    const near = (o, cx, cy) => Math.abs(o.x - cx) < 2 && Math.abs(o.y - cy) < 2;
    const at = (rect) => zones.find(z => near(z, rect.x + rect.w/2, rect.y + rect.h/2));

    // tiles are cell x cell; chips are <=cell wide x filterRow.h; auto/clear are 58 x filterRow.h.
    const tileZones = zones.filter(z => Math.round(z.width) === L.cell && Math.round(z.height) === L.cell).length;
    const chipZones = zones.filter(z =>
      Math.round(z.height) === L.filterRow.h &&
      Math.round(z.y) === Math.round(L.filterRow.y + L.filterRow.h/2) &&
      Math.round(z.width) <= L.cell,
    ).length;

    // craft button is a Text at L.craftBtn (origin 0,0)
    const texts = [];
    const walkT = (o) => { if (!o) return; if (o.type === 'Text') texts.push(o); if (o.list) o.list.forEach(walkT); };
    walkT(dlg);
    const craft = texts.find(o => Math.round(o.x) === Math.round(L.craftBtn.x) && Math.round(o.y) === Math.round(L.craftBtn.y));

    const autoZ = at(L.autoBtn), clearZ = at(L.clearBtn);
    const found = { autoZ: !!autoZ, clearZ: !!clearZ, craft: !!craft };

    // D) Auto then Forge -> confirm with 5 ids + 1 jewel
    autoZ && autoZ.emit('pointerup', ap, 0, 0, { stopPropagation(){} });
    craft && craft.emit('pointerup', ap, 0, 0, { stopPropagation(){} });
    const afterAuto = window.__confirm;

    // E) Clear then Forge -> no confirm (machine empty, gate locked)
    window.__confirm = null;
    clearZ && clearZ.emit('pointerup', ap, 0, 0, { stopPropagation(){} });
    craft && craft.emit('pointerup', ap, 0, 0, { stopPropagation(){} });
    const afterClear = window.__confirm;

    if (dlg.scene) dlg.destroy();
    return JSON.stringify({
      tileZones, windowCap: L.cols * L.rowsVisible, chipZones, found, afterAuto, afterClear,
    });
  `);
  const r = JSON.parse(out || "{}");
  console.log("B) tiles rendered:", r.tileZones, "<= window cap", r.windowCap, "(of 60 items)");
  console.log("C) filter chips:", r.chipZones, "(expect 4: All+Common+Rare+Legendary)");
  console.log("   control zones found:", JSON.stringify(r.found));
  console.log("D) Auto+Forge -> confirm:", JSON.stringify(r.afterAuto), "(expect n:5 jewels:1)");
  console.log("E) Clear+Forge -> confirm:", JSON.stringify(r.afterClear), "(expect null)");

  const ok =
    r.tileZones > 0 &&
    r.tileZones <= r.windowCap &&
    r.tileZones < 60 &&
    r.chipZones === 4 &&
    r.found.autoZ &&
    r.found.clearZ &&
    r.found.craft &&
    r.afterAuto &&
    r.afterAuto.n === 5 &&
    r.afterAuto.jewels === 1 &&
    r.afterClear === null;
  console.log(ok ? "VERDICT: PASS" : "VERDICT: FAIL");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
