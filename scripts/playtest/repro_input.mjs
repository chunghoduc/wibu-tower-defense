// Real-pointer input repro: drives the battle via synthetic DOM PointerEvents on
// the canvas (NOT bs.battle.placeTower) to exercise the actual gesture path.
//   node scripts/playtest/repro_input.mjs [--port=4188]
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
    if (r.exceptionDetails) console.log("  EXC:", r.exceptionDetails.text, r.result?.description || "");
    return r.result?.value;
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await wait(5500);

  // Enter battle.
  console.log(
    "scene:",
    await evalJs(`const g=window.__game; if(!g) return "no game";
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "started";`),
  );
  await wait(1800);

  // Helper installed in-page: dispatch a press→move→release gesture in GAME coords
  // (960x540) mapped to canvas client px. Returns nothing; Phaser reacts.
  await evalJs(`
    const cv = document.querySelector('#game canvas') || document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    const sx = r.width/960, sy = r.height/540;
    const pt = (gx,gy)=>({clientX: r.left+gx*sx, clientY: r.top+gy*sy});
    function fire(type, gx, gy){
      const p = pt(gx,gy);
      const ev = new PointerEvent(type, {pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons: type==='pointerup'?0:1, clientX:p.clientX, clientY:p.clientY, bubbles:true, cancelable:true});
      cv.dispatchEvent(ev);
      // Phaser also binds mouse events as a fallback.
      const mt = {pointerdown:'mousedown',pointermove:'mousemove',pointerup:'mouseup'}[type];
      cv.dispatchEvent(new MouseEvent(mt, {button:0, buttons: type==='pointerup'?0:1, clientX:p.clientX, clientY:p.clientY, bubbles:true, cancelable:true}));
    }
    window.__drag = async (x0,y0,x1,y1,steps=8)=>{
      fire('pointerdown', x0, y0); await new Promise(r=>setTimeout(r,40));
      for(let i=1;i<=steps;i++){ const f=i/steps; fire('pointermove', x0+(x1-x0)*f, y0+(y1-y0)*f); await new Promise(r=>setTimeout(r,25)); }
      fire('pointerup', x1, y1); await new Promise(r=>setTimeout(r,40));
    };
    window.__tap = async (x,y)=>{ fire('pointermove', x, y); await new Promise(r=>setTimeout(r,30)); fire('pointerdown',x,y); await new Promise(r=>setTimeout(r,30)); fire('pointerup',x,y); await new Promise(r=>setTimeout(r,40)); };
    return 'helpers-ready canvas='+Math.round(r.width)+'x'+Math.round(r.height);
  `).then((v) => console.log("setup:", v));

  // Baseline.
  console.log(
    "before:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene');
    return JSON.stringify({towers:bs.battle.towers.length, gold:bs.battle.gold, build:(bs.buildOrder||[]).slice(0,3).map(d=>d.id+':'+d.cost), zoom:+bs.cameras.main.zoom.toFixed(3), minZoom:+bs.camCtl.opts.minZoom.toFixed(3)});`),
  );

  // TEST 1: drag avatar 0 (game ~ (51,520)) onto field (480,250).
  await evalJs(`return window.__drag(51,520, 480,250, 10);`);
  console.log(
    "T1 drag-place:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({towers:bs.battle.towers.length, gold:bs.battle.gold});`),
  );

  // TEST 2: TAP avatar 0 (does tapping place anything?).
  await evalJs(`return window.__tap(51,520);`);
  console.log(
    "T2 tap-avatar:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({towers:bs.battle.towers.length});`),
  );

  // TEST 3: PAN at base zoom — drag across empty field, expect scroll change.
  console.log(
    "T3 pan@base:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); const c=bs.cameras.main; const sx0=c.scrollX, sy0=c.scrollY;
    await window.__drag(700,300, 300,300, 10);
    return JSON.stringify({zoomedIn:bs.camCtl.isZoomedIn, dScroll:+(Math.abs(c.scrollX-sx0)+Math.abs(c.scrollY-sy0)).toFixed(2)});`),
  );

  // TEST 4: zoom in, then PAN — expect scroll change.
  console.log(
    "T4 pan@zoom:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.zoomStep(true); bs.camCtl.zoomStep(true);
    const c=bs.cameras.main; const sx0=c.scrollX, sy0=c.scrollY;
    await window.__drag(700,300, 300,300, 10);
    return JSON.stringify({zoom:+c.zoom.toFixed(3), zoomedIn:bs.camCtl.isZoomedIn, dScroll:+(Math.abs(c.scrollX-sx0)+Math.abs(c.scrollY-sy0)).toFixed(2)});`),
  );

  // Reset to base zoom for clean placement coords.
  await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.reset(); return 'reset';`);

  // TEST 5: ARM card 0 (via the exact method the avatar tap invokes — Phaser's
  // gameobject-level pointerup does NOT fire under synthetic CDP events, so the
  // avatar->toggleArm binding is covered by unit tests + the listener's presence;
  // here we drive the field-tap->place wiring, which IS a real scene pointer up).
  const t0 = await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return bs.battle.towers.length;`);
  await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.toggleArm(bs.buildOrder[0].id); return bs.placement.armedId;`);
  await evalJs(`return window.__tap(470,300);`); // real scene field tap → place
  console.log(
    "T5 tap-place:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); return JSON.stringify({before:${t0}, after:bs.battle.towers.length, armed:bs.placement.armedId, ghost:!!bs.placeGhost});`),
  );

  // TEST 6: toggle the same card off via the state machine + cancelPlacement.
  console.log(
    "T6 arm-then-toggle:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene');
    bs.toggleArm(bs.buildOrder[1].id); const a1=bs.placement.armedId;
    bs.toggleArm(bs.buildOrder[1].id); const a2=bs.placement.armedId;
    return JSON.stringify({armed:a1, toggledOff:a2, ghost:!!bs.placeGhost});`),
  );

  // TEST 7: double-tap the field zooms in.
  console.log(
    "T7 double-tap-zoom:",
    await evalJs(`const bs=window.__game.scene.getScene('BattleScene'); bs.camCtl.reset(); const z0=bs.cameras.main.zoom;
    await window.__tap(480,300); await new Promise(r=>setTimeout(r,90)); await window.__tap(480,300);
    return JSON.stringify({z0:+z0.toFixed(3), z1:+bs.cameras.main.zoom.toFixed(3), zoomedIn:bs.camCtl.isZoomedIn});`),
  );

  const png = await rpc("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/repro_input.png", Buffer.from(png.data, "base64"));
  console.log("shot: /tmp/repro_input.png");
  ws.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
