// Repro: tapping a bag ring while BOTH ring slots are full should open the
// compare modal with TWO equipped columns (one Replace per ring).
//
//   vite preview --port 4188  +  chrome --remote-debugging-port=9222
//   node scripts/playtest/repro_ring_compare.mjs --out=/tmp/ring_compare.png
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const OUT = arg("out", "/tmp/ring_compare.png");
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
      expression: `(()=>{${expr}})()`,
      returnByValue: true,
    });
    if (r.exceptionDetails) console.log("  EXC:", r.exceptionDetails.text, r.result?.description || "");
    return r.result?.value;
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await wait(5500); // preload + menu

  // Craft a save with two rings equipped and a third ring in the bag, then open
  // HeroScene and route the bag ring through openItemAction.
  const setup = await evalJs(`
    const g = window.__game;
    const mgr = g.registry.get('saveManager');
    const save = mgr.getSave();
    // Find three distinct ring defs from the live catalog.
    const items = g.__ITEM_CATALOG || null;
    return JSON.stringify({ hasGame: !!g, hasMgr: !!mgr, lvl: save.hero.level });
  `);
  console.log("setup:", setup);

  // Build instances directly (rollItem is module-internal; craft minimal saves).
  const built = await evalJs(`
    const g = window.__game;
    const mgr = g.registry.get('saveManager');
    const save = mgr.getSave();
    const reg = g.__catalog;
    // Pull ring defs off any scene that imported the catalog map is hard; instead
    // hardcode three known ring ids from itemLines.ts.
    const ringIds = ['common-blood-ring','rare-fortune-ring','legendary-precision-ring'];
    const mk = (defId, n) => ({
      id: 'repro-'+defId+'-'+n, defId, acquiredLevel: 1, requiredLevel: 1,
      rolledStats: {}, rolledPrimaryAffix: 1, rolledAffixes: [], enhanceLevel: 0,
    });
    const a = mk(ringIds[0],1), b = mk(ringIds[1],2), c = mk(ringIds[2],3);
    save.inventory.items.push(a,b,c);
    save.inventory.equipped.Ring1 = a.id;
    save.inventory.equipped.Ring2 = b.id;
    return JSON.stringify({ items: save.inventory.items.length, eq: save.inventory.equipped });
  `);
  console.log("built:", built);

  // Launch HeroScene fresh so it reads the crafted save.
  await evalJs(`
    const g = window.__game;
    const cur = g.scene.getScenes(true).map(s=>s.scene.key);
    cur.forEach(k => { if (k !== 'HeroScene') g.scene.stop(k); });
    g.scene.start('HeroScene');
  `);
  await wait(1800);

  // Invoke the bag ring's tap action directly (private but runtime-accessible).
  const opened = await evalJs(`
    const g = window.__game;
    const hero = g.scene.getScene('HeroScene');
    const save = g.registry.get('saveManager').getSave();
    const bag = save.inventory.items.find(it => it.id === 'repro-legendary-precision-ring-3');
    try { hero.openItemAction(bag, null); } catch (e) { return JSON.stringify({ error: String(e) }); }
    // Count Replace buttons rendered in the dialog container.
    let replaces = 0;
    const scan = (c) => c.list && c.list.forEach(o => {
      if (o.text === '⇄  Replace') replaces++;
      if (o.list) scan(o);
    });
    scan(hero.dialog);
    return JSON.stringify({ dialogVisible: hero.dialog.visible, replaceButtons: replaces });
  `);
  console.log("opened:", opened);

  await wait(600);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", OUT);
  ws.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
