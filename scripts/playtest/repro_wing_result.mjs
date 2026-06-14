// Wing-craft RESULT REVEAL repro.
//
// Drives the new overlay directly (synthetic touch can't reach the headless
// game): build a success VM from a minted wing + a failure VM, open each overlay
// on the active scene, assert it mounts without throwing and screenshot both.
//   node scripts/playtest/repro_wing_result.mjs [--port=4188]
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
  const sceneKey = await evalJs(
    `return (window.__game.scene.scenes.find(s=>s.scene.isActive())||{}).scene?.key || 'none';`,
  );
  console.log("game ready:", ready, "active scene:", sceneKey);

  // ---- SUCCESS overlay ----
  const okOut = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const viewMod = await import('/src/core/wingCraftResultView.ts');
    const ovMod = await import('/src/scenes/wingCraftResultOverlay.ts');
    const itemsMod = await import('/src/data/items.ts');
    const wcMod = await import('/src/core/wingCraft.ts');
    // a Legendary skywings minted result
    const defId = wcMod.skywingsDefId('Legendary');
    const def = itemsMod.ITEM_CATALOG_MAP.get(defId);
    const item = {
      id:'w1', defId, acquiredLevel: 40,
      rolledStats: Object.fromEntries(Object.entries(def.baseStats||{}).filter(([k,v])=>typeof v==='number'&&v)),
      rolledPrimaryAffix: def.primaryAffix?.baseValue ?? 5,
      rolledAffixes: (def.additionalAffixPool||[]).slice(0,1).map(a=>({type:a.type??'atk', value: a.baseValue ?? 4})),
      enhanceLevel: 0,
    };
    const vm = viewMod.wingCraftResultView({ ok:true, success:true, rarity:'Legendary', item });
    window.__ov = ovMod.openWingCraftResultOverlay(scene, vm, ()=>{ window.__claimed = true; });
    return JSON.stringify({ kind: vm.kind, name: vm.name, rows: vm.kind==='success'?vm.statRows.length:0, children: window.__ov.list.length });
  `);
  console.log("SUCCESS:", okOut);
  await wait(700);
  await shot("/tmp/wing_result_success.png");
  // dismiss
  await evalJs(`window.__ov && window.__ov.list.find(o=>o.type==='Text' && /Claim/.test(o.text))?.emit('pointerup', window.__game.input.activePointer); return 1;`);
  await wait(400);
  const claimed = await evalJs(`return !!window.__claimed;`);
  console.log("claim dismissed + onDone fired:", claimed);

  // ---- FAILURE overlay ----
  const failOut = await evalJs(`
    const g = window.__game;
    if (window.__ov && window.__ov.destroy) window.__ov.destroy();
    const scene = g.scene.getScene('MainMenuScene') || g.scene.scenes.find(s=>s.scene.isActive());
    const viewMod = await import('/src/core/wingCraftResultView.ts');
    const ovMod = await import('/src/scenes/wingCraftResultOverlay.ts');
    const vm = viewMod.wingCraftResultView({ ok:true, success:false });
    window.__ov2 = ovMod.openWingCraftResultOverlay(scene, vm, ()=>{});
    return JSON.stringify({ kind: vm.kind, children: window.__ov2.list.length });
  `);
  console.log("FAILURE:", failOut);
  await wait(600);
  await shot("/tmp/wing_result_failure.png");

  // ---- runtime errors? ----
  const errs = await evalJs(`return (window.__errors||[]).slice(0,5);`);
  console.log("client errors:", JSON.stringify(errs || []));
  ws.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
