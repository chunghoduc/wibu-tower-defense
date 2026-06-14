// Craft Wings LOADED-ICONS + SCROLL-LEAK repro.
//
// Opens the wing-craft dialog with real items (so item__<id> icons resolve),
// loads a few + a jewel + feather, screenshots the machine, then opens & destroys
// the dialog several times asserting the scene's pointerdown listener count stays
// flat (no scroll-handler stacking).
//   node scripts/playtest/repro_wing_icons.mjs [--port=4188]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
import { writeFileSync } from "node:fs";

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
  const shot = async (path) => {
    const r = await rpc("Page.captureScreenshot", { format: "png" });
    if (r?.data) writeFileSync(path, Buffer.from(r.data, "base64"));
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(600);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evalJs(
      `return !!(window.__game && window.__game.scene && window.__game.scene.getScene('MainMenuScene') && window.__game.scene.getScene('MainMenuScene').scene.isActive());`,
    );
    if (ready) break;
    await wait(400);
  }
  console.log("game ready:", ready);

  // ---- open the dialog with real items + auto-load ----
  const out = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const dlgMod = await import('/src/scenes/wingCraftDialog.ts');
    const itemsMod = await import('/src/data/items.ts');
    const keysMod = await import('/src/data/assetKeys.ts');
    // pick defs whose item icon texture is actually loaded, spread across rarities
    const defs = itemsMod.ITEM_CATALOG.filter(d => scene.textures.exists(keysMod.itemTex(d.id)));
    const pick = defs.slice(0, 40);
    const items = pick.map((d,i)=>({ id:'g'+i, defId:d.id, name:d.name, rarity:d.rarity }));
    window.__dlg = dlgMod.openWingCraftDialog(scene, {
      items, jewelsOwned: 5, feathersOwned: 3,
      preview: () => ({ success: 0.6, odds: [{rarity:'Rare',chance:0.6},{rarity:'Epic',chance:0.4}] }),
      confirm: () => {},
      onClose: () => { window.__dlg.destroy(); },
    });
    // auto-load: tap the Auto button zone (find by hitarea near its rect) — simpler: emit via the dialog's Auto path
    // load 6 items + materials directly through the same selected set by simulating taps on tray tiles is complex;
    // instead trigger Auto by locating the "Auto" text and emitting pointerup on its sibling zone.
    return JSON.stringify({ children: window.__dlg.list.length, itemCount: items.length, withTex: defs.length });
  `);
  console.log("dialog opened:", out);
  // Load via the real zones: recurse the dialog container, collect Zones, and emit
  // pointerup on the ones whose center matches Auto / jewel / feather sockets.
  const loaded = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const mach = await import('/src/core/wingCraftMachine.ts');
    const L = mach.wingMachineLayout(scene.scale.width, scene.scale.height);
    const zones = [];
    const walk = (o) => {
      if (!o) return;
      if (o.type === 'Zone') zones.push(o);
      if (o.list) o.list.forEach(walk);
    };
    walk(window.__dlg);
    const p = scene.input.activePointer;
    const center = (r) => ({ x: r.x + r.w/2, y: r.y + r.h/2 });
    const fireAt = (cx, cy) => {
      const z = zones.find(z => Math.abs(z.x - cx) < 2 && Math.abs(z.y - cy) < 2);
      if (z) { z.emit('pointerup', p, 0, 0, { stopPropagation(){} }); return true; }
      return false;
    };
    const a = center(L.autoBtn), j = center(L.jewelSocket), f = center(L.featherSocket);
    const r1 = fireAt(a.x, a.y);
    const r2 = fireAt(j.x, j.y);
    const r3 = fireAt(f.x, f.y);
    return JSON.stringify({ zones: zones.length, auto:r1, jewel:r2, feather:r3 });
  `);
  console.log("load taps:", loaded);
  await wait(500);
  await shot("/tmp/wing_icons.png");
  console.log("screenshot → /tmp/wing_icons.png");

  // ---- scroll-leak check: open + destroy ×5, listener count must stay flat ----
  const leak = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    if (window.__dlg && window.__dlg.destroy) window.__dlg.destroy();
    const dlgMod = await import('/src/scenes/wingCraftDialog.ts');
    const itemsMod = await import('/src/data/items.ts');
    const keysMod = await import('/src/data/assetKeys.ts');
    const defs = itemsMod.ITEM_CATALOG.filter(d => scene.textures.exists(keysMod.itemTex(d.id)));
    const items = defs.slice(0, 60).map((d,i)=>({ id:'h'+i, defId:d.id, name:d.name, rarity:d.rarity }));
    const opts = {
      items, jewelsOwned: 5, feathersOwned: 3,
      preview: () => ({ success: 0.5, odds: [{rarity:'Rare',chance:1}] }),
      confirm: () => {}, onClose: () => {},
    };
    const count = () => (scene.input.eventNames ? scene.input.listenerCount('pointerdown') : -1);
    const before = count();
    for (let i=0;i<5;i++){ const d = dlgMod.openWingCraftDialog(scene, opts); d.destroy(); }
    const after = count();
    return JSON.stringify({ before, after, delta: after - before });
  `);
  console.log("scroll-listener leak check:", leak);

  const errs = await evalJs(`return (window.__errors||[]).slice(0,5);`);
  console.log("client errors:", JSON.stringify(errs || []));
  ws.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
