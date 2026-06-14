// Battle-scene touch repro: real CDP touch events (mobile emulation) for
// tap-to-place and one-finger drag-to-pan (after zoom-in). Detects whether the
// touch gesture path works in the actual battlefield.
//   node scripts/playtest/repro_battle_touch.mjs [--port=4188]
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
  await rpc("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 844,
    screenHeight: 390,
  });
  await rpc("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await rpc("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }] });
  await wait(6000);

  await evalJs(`const g=window.__game;
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "started";`);
  await wait(1800);

  // game-coord -> client px helper
  await evalJs(`const cv=document.querySelector('#game canvas')||document.querySelector('canvas');
    const r=cv.getBoundingClientRect(); const sx=r.width/960, sy=r.height/540;
    window.__g2c=(gx,gy)=>({x:r.left+gx*sx, y:r.top+gy*sy}); return JSON.stringify({w:+r.width.toFixed(0),h:+r.height.toFixed(0)});`).then(v=>console.log("canvas:",v));

  const touch = async (type, pts) =>
    rpc("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const g2c = async (gx, gy) => JSON.parse(await evalJs(`const p=window.__g2c(${gx},${gy}); return JSON.stringify({x:+p.x.toFixed(1),y:+p.y.toFixed(1)});`));
  const tap = async (gx, gy) => {
    const p = await g2c(gx, gy);
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    await wait(50);
    await touch("touchEnd", []);
    await wait(60);
  };
  const drag = async (x0, y0, x1, y1, steps = 10) => {
    const a = await g2c(x0, y0);
    await touch("touchStart", [{ x: a.x, y: a.y }]);
    await wait(30);
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const p = await g2c(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
      await touch("touchMove", [{ x: p.x, y: p.y }]);
      await wait(22);
    }
    await touch("touchEnd", []);
    await wait(40);
  };

  console.log(
    "before:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene');
    return JSON.stringify({towers:bs.battle.towers.length, gold:bs.battle.gold, build:(bs.buildOrder||[]).slice(0,3).map(d=>d.id)});`),
  );

  // ARM a tower via the real avatar tap region, then field tap to place.
  // Avatar bar sits along the bottom; arm via state machine to be deterministic,
  // then place via a REAL touch on the field (exercises scene pointerup->place).
  const t0 = await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.toggleArm(bs.buildOrder[0].id); return JSON.stringify({armed:bs.placement.armedId, towers:bs.battle.towers.length});`);
  console.log("armed:", t0);
  await tap(470, 300); // real field touch to place
  console.log(
    "TOUCH tap-place =>",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({towers:bs.battle.towers.length, armed:bs.placement.armedId, ghost:!!bs.placeGhost});`),
  );

  // PAN: zoom in, then one-finger drag across the field -> camera scroll should move.
  console.log(
    "TOUCH pan@zoom =>",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.zoomStep(true); bs.camCtl.zoomStep(true);
    window.__sx0=bs.cameras.main.scrollX; window.__sy0=bs.cameras.main.scrollY; return JSON.stringify({zoom:+bs.cameras.main.zoom.toFixed(3), zoomedIn:bs.camCtl.isZoomedIn});`),
  );
  await drag(680, 300, 280, 300, 12);
  console.log(
    "  after pan:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); const c=bs.cameras.main;
    return JSON.stringify({dScroll:+(Math.abs(c.scrollX-window.__sx0)+Math.abs(c.scrollY-window.__sy0)).toFixed(2), consumed:bs.camCtl.consumedGesture});`),
  );

  const png = await rpc("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/repro_battle_touch.png", Buffer.from(png.data, "base64"));
  console.log("shot: /tmp/repro_battle_touch.png");
  ws.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
