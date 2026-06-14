// Wing-craft drag-close repro.
//
// Real synthetic touch input does NOT reach the game in this headless Chrome build
// ("Permissions check failed" — see repro_tap_place.mjs), so we reproduce the bug
// at the event-ROUTING level that Phaser's InputPlugin actually performs on a
// drag release: processDragUpEvent (fires `dragend`) THEN processUpEvents (fires
// `pointerup` on the top object under the released pointer). On touch the release
// routes to the full-screen dim zone, whose unconditional pointerup -> onClose
// tears the dialog down mid-craft. We assert:
//   A) a genuine tap-out (dim pointerup with NO preceding drag) DOES close, and
//   B) the tail of a tile drag (dragstart -> dragend -> dim pointerup) does NOT.
//   node scripts/playtest/repro_wing_drag.mjs [--port=4188]
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
    const akeys = await import('/src/data/assetKeys.ts');
    const matsMod = await import('/src/data/materials.ts');
    const itemsMod = await import('/src/data/items.ts');
    const catalog = itemsMod.ITEM_CATALOG || Object.values(itemsMod.ITEM_CATALOG_MAP || {});
    const goodDef = (catalog.find(d => scene.textures.exists(akeys.itemTex(d.id))) || {}).id || 'iron-sword';
    const W = g.scale.gameSize.width;
    const jewelKey = akeys.materialTex(matsMod.JEWEL_OF_CHAOS);

    const open = () => {
      window.__closed = 0;
      const items = Array.from({length:6}, (_,i)=>({ id:'it'+i, defId:goodDef, name:'Item '+i, rarity:'Common' }));
      return mod.openWingCraftDialog(scene, {
        items, jewelsOwned: 2, feathersOwned: 1,
        preview: () => ({ success: 0.5, odds: [{rarity:'Common',chance:1}] }),
        confirm: () => {},
        onClose: () => { window.__closed++; },
      });
    };
    const parts = (dlg) => {
      const dim = dlg.list.find(o => o.type === 'Zone' && Math.round(o.width) === Math.round(W));
      const tile = dlg.list.find(o => o.texture && o.input && o.input.draggable && o.texture.key === jewelKey);
      return { dim, tile };
    };
    const ap = scene.input.activePointer;

    // --- Scenario A: genuine tap-out (dim pointerup, no drag) should CLOSE ----
    let dlg = open();
    let p = parts(dlg);
    if (!p.dim || !p.tile) return JSON.stringify({ error: 'missing dim/tile', hasDim: !!p.dim, hasTile: !!p.tile });
    p.dim.emit('pointerup', ap, 0, 0, { stopPropagation(){} });
    const closedOnTapOut = window.__closed;
    if (dlg.scene) dlg.destroy();

    // --- Scenario B: tail of a tile drag should NOT close --------------------
    dlg = open();
    p = parts(dlg);
    // Engine order on release: dragstart happened earlier; dragend, THEN pointerup.
    scene.input.emit('dragstart', ap, p.tile);
    p.tile.emit('dragstart', ap);
    p.tile.emit('dragend', ap, 0, 0, false);   // snaps home + onDrop (load attempt)
    scene.input.emit('dragend', ap, p.tile, false);
    // ...then the engine routes the release pointerup to the full-screen dim zone:
    p.dim.emit('pointerup', ap, 0, 0, { stopPropagation(){} });
    const closedOnDragTail = window.__closed;
    const destroyedAfterDrag = !dlg.scene;
    if (dlg.scene) dlg.destroy();

    return JSON.stringify({ closedOnTapOut, closedOnDragTail, destroyedAfterDrag });
  `);
  const r = JSON.parse(out);
  if (r.error) {
    console.log("SETUP FAIL:", r);
    ws.close();
    process.exit(2);
  }
  console.log("A) genuine tap-out  -> onClose calls:", r.closedOnTapOut, "(expect 1)");
  console.log("B) drag-tail dim up -> onClose calls:", r.closedOnDragTail, "| destroyed:", r.destroyedAfterDrag, "(expect 0 / false)");

  const ok = r.closedOnTapOut === 1 && r.closedOnDragTail === 0 && !r.destroyedAfterDrag;
  console.log(
    ok
      ? "VERDICT: PASS (tap-out closes; drag release does NOT)"
      : "VERDICT: FAIL (drag release tears down the dialog — bug present)",
  );
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
