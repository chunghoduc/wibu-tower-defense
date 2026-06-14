// Repro: in SquadScene, dragging a grid character onto an empty slot must NOT
// jam the tap-guard. After the drop, clicking a DIFFERENT character must still
// select it. Before the fix, the drop's redraw destroyed the dragged tile,
// Phaser skipped `dragend`, `didDrag` stayed true, and every later tap was eaten.
//
//   vite preview --port 4188  +  chrome --remote-debugging-port=9222
//   node scripts/playtest/repro_squad_drag.mjs --out=/tmp/squad_drag.png
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const OUT = arg("out", "/tmp/squad_drag.png");
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

  // Seed three owned characters, empty squad, then open SquadScene fresh.
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

  // Map of canvas → CSS pixels: the Phaser canvas is scaled to fit the window.
  const geom = await evalJs(`
    const g = window.__game;
    const sc = g.scene.getScene('SquadScene');
    const cvs = g.canvas.getBoundingClientRect();
    const sx = cvs.width / g.scale.width, sy = cvs.height / g.scale.height;
    // First two grid tiles (charId) from the dyn container, and slot 0 centre.
    const tiles = [];
    sc.dyn.list.forEach(o => { const cid = o.getData && o.getData('charId'); if (cid) tiles.push({ id: cid, x: o.x, y: o.y }); });
    // slotRect(0): x0=24,y0=50,w=94,h=48 → centre (24+47, 50+24)
    const slot0 = { x: 24 + 47, y: 50 + 24 };
    const toCss = (p) => ({ x: cvs.left + p.x * sx, y: cvs.top + p.y * sy });
    return JSON.stringify({
      tile0: { id: tiles[0]?.id, css: toCss(tiles[0]) },
      tile1: { id: tiles[1]?.id, css: toCss(tiles[1]) },
      slot0css: toCss(slot0),
      tiles: tiles.length,
    });
  `);
  console.log("geom:", geom);
  const G = JSON.parse(geom);

  const mouse = (type, p, extra = {}) =>
    rpc("Input.dispatchMouseEvent", {
      type,
      x: Math.round(p.x),
      y: Math.round(p.y),
      button: "left",
      buttons: type === "mouseReleased" ? 0 : 1,
      clickCount: 1,
      ...extra,
    });

  // --- Real drag: press on grid tile0, move in steps onto slot0, release. ---
  await mouse("mousePressed", G.tile0.css);
  await wait(40);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const x = G.tile0.css.x + ((G.slot0css.x - G.tile0.css.x) * i) / steps;
    const y = G.tile0.css.y + ((G.slot0css.y - G.tile0.css.y) * i) / steps;
    await mouse("mouseMoved", { x, y });
    await wait(25);
  }
  await mouse("mouseReleased", G.slot0css);
  await wait(150);

  const afterDrop = await evalJs(`
    const sc = window.__game.scene.getScene('SquadScene');
    return JSON.stringify({ didDrag: sc.didDrag, slot0: sc.slots[0], selected: sc.selectedId });
  `);
  console.log("afterDrop:", afterDrop);

  // --- Now CLICK a different grid tile; selection must change to it. ---
  await mouse("mousePressed", G.tile1.css);
  await wait(40);
  await mouse("mouseReleased", G.tile1.css);
  await wait(150);

  const afterClick = await evalJs(`
    const sc = window.__game.scene.getScene('SquadScene');
    return JSON.stringify({ didDrag: sc.didDrag, selected: sc.selectedId });
  `);
  console.log("afterClick:", afterClick);

  const drop = JSON.parse(afterDrop);
  const click = JSON.parse(afterClick);
  const pass =
    drop.slot0 === G.tile0.id && // drag assigned the slot
    drop.didDrag === false && // guard cleared after drop
    click.selected === G.tile1.id; // click after drag selected the other char
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
