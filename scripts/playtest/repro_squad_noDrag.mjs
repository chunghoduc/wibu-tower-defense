// Repro: the no-drag squad-editing paths in SquadScene.
//   1. select a grid char → tap the info-panel "Add to Squad" → slot fills
//   2. tap "⚡ Auto" → remaining slots fill from best owned chars
//   3. tap "Clear" → squad empties
//
//   vite preview --port 4188  +  chrome --remote-debugging-port=9222
//   node scripts/playtest/repro_squad_noDrag.mjs --out=/tmp/squad_nodrag.png
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const OUT = arg("out", "/tmp/squad_nodrag.png");
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

  const seeded = await evalJs(`
    const g = window.__game;
    const mgr = g.registry.get('saveManager');
    const save = mgr.getSave();
    const ids = ['yamo-desert-bandit','kazu-spirit-brawler','zoran-thricedraw'];
    ids.forEach(i => { save.collection[i] = { stars: 1, copies: 0 }; });
    save.squad = [];
    g.scene.getScenes(true).map(s=>s.scene.key).forEach(k => g.scene.stop(k));
    g.scene.start('SquadScene');
    return JSON.stringify({ owned: Object.keys(save.collection) });
  `);
  console.log("seeded:", seeded);
  await wait(1600);

  // Read grid tile + control/panel button CSS centres.
  const geom = await evalJs(`
    const g = window.__game;
    const sc = g.scene.getScene('SquadScene');
    const cvs = g.canvas.getBoundingClientRect();
    const sx = cvs.width / g.scale.width, sy = cvs.height / g.scale.height;
    const toCss = (p) => ({ x: cvs.left + p.x * sx, y: cvs.top + p.y * sy });
    // First grid tile (charId) from the dyn container.
    let tile0 = null;
    sc.dyn.list.forEach(o => { const cid = o.getData && o.getData('charId'); if (cid && !tile0) tile0 = { id: cid, x: o.x, y: o.y }; });
    // Auto / Clear buttons from slotLayer (Text with matching content).
    const findText = (layer, needle) => {
      let hit = null;
      layer.list.forEach(o => {
        if (hit) return;
        const txt = o.text;
        if (typeof txt === 'string' && txt.includes(needle)) {
          const b = o.getBounds();
          hit = { x: b.centerX, y: b.centerY };
        }
      });
      return hit;
    };
    return JSON.stringify({
      tile0: tile0 ? { id: tile0.id, css: toCss(tile0) } : null,
      autoCss: (() => { const p = findText(sc.slotLayer, 'Auto'); return p ? toCss(p) : null; })(),
      clearCss: (() => { const p = findText(sc.slotLayer, 'Clear'); return p ? toCss(p) : null; })(),
    });
  `);
  console.log("geom:", geom);
  const G = JSON.parse(geom);

  const click = async (p) => {
    await rpc("Input.dispatchMouseEvent", { type: "mousePressed", x: Math.round(p.x), y: Math.round(p.y), button: "left", buttons: 1, clickCount: 1 });
    await wait(40);
    await rpc("Input.dispatchMouseEvent", { type: "mouseReleased", x: Math.round(p.x), y: Math.round(p.y), button: "left", buttons: 0, clickCount: 1 });
    await wait(160);
  };

  // 1. Select the grid char, then tap the panel "Add to Squad" button.
  await click(G.tile0.css);
  const addCss = await evalJs(`
    const g = window.__game;
    const sc = g.scene.getScene('SquadScene');
    const cvs = g.canvas.getBoundingClientRect();
    const sx = cvs.width / g.scale.width, sy = cvs.height / g.scale.height;
    let hit = null;
    sc.panel.list.forEach(o => {
      if (hit) return;
      const txt = o.text;
      if (typeof txt === 'string' && txt.includes('Add to Squad')) {
        const b = o.getBounds();
        hit = { x: cvs.left + b.centerX * sx, y: cvs.top + b.centerY * sy };
      }
    });
    return JSON.stringify(hit);
  `);
  console.log("addCss:", addCss);
  await click(JSON.parse(addCss));
  const afterAdd = await evalJs(`
    const sc = window.__game.scene.getScene('SquadScene');
    return JSON.stringify({ slots: sc.slots, count: sc.slots.filter(Boolean).length });
  `);
  console.log("afterAdd:", afterAdd);

  // 2. Auto-fill.
  await click(G.autoCss);
  const afterAuto = await evalJs(`
    const sc = window.__game.scene.getScene('SquadScene');
    return JSON.stringify({ count: sc.slots.filter(Boolean).length });
  `);
  console.log("afterAuto:", afterAuto);

  // 3. Clear.
  await click(G.clearCss);
  const afterClear = await evalJs(`
    const sc = window.__game.scene.getScene('SquadScene');
    return JSON.stringify({ count: sc.slots.filter(Boolean).length });
  `);
  console.log("afterClear:", afterClear);

  const add = JSON.parse(afterAdd);
  const auto = JSON.parse(afterAuto);
  const clear = JSON.parse(afterClear);
  const pass =
    add.slots[0] === G.tile0.id && // tap-Add filled slot 0 with the selected char
    auto.count > add.count && // Auto-fill added more
    clear.count === 0; // Clear emptied the squad
  console.log(pass ? "RESULT: PASS ✓" : "RESULT: FAIL ✗");

  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", OUT);
  ws.close();
  process.exit(pass ? 0 : 2);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
