// Mobile-touch repro: emulate a landscape phone (mobile:true + touch), load the
// MainMenuScene, and dispatch REAL touch events at the BATTLE CTA + a drag, to
// see whether mobile input reaches Phaser at all.
//   node scripts/playtest/repro_mobile.mjs [--port=4188]
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
  // Emulate a landscape phone with touch. mobile:true => pointer:coarse coarse.
  await rpc("Emulation.setDeviceMetricsOverride", {
    width: 740,
    height: 360,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 740,
    screenHeight: 360,
  });
  await rpc("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await rpc("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }] });

  await wait(6000); // preload + menu

  console.log(
    "env:",
    await evalJs(`const g=window.__game; if(!g) return "no game";
    return JSON.stringify({
      scene: g.scene.getScenes(true).map(s=>s.scene.key),
      coarse: matchMedia('(pointer: coarse)').matches,
      fullscreen: g.scale.isFullscreen,
      canvasTouchAction: getComputedStyle(document.querySelector('canvas')).touchAction,
    });`),
  );

  // Compute the BATTLE button's CLIENT px from game coords via the canvas rect.
  const setup = await evalJs(`
    const cv = document.querySelector('#game canvas') || document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    const sx = r.width/960, sy = r.height/540;
    window.__g2c = (gx,gy)=>({x: r.left+gx*sx, y: r.top+gy*sy});
    return JSON.stringify({rect:{l:+r.left.toFixed(1),t:+r.top.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}, sx:+sx.toFixed(3)});
  `);
  console.log("canvas:", setup);

  // BATTLE CTA center ~ game (480,443). Read it precisely from the live layout.
  const battlePt = await evalJs(`
    const p = window.__g2c(480, 443);
    return JSON.stringify({x:+p.x.toFixed(1), y:+p.y.toFixed(1)});
  `);
  console.log("battlePt(client):", battlePt);
  const bp = JSON.parse(battlePt);

  // Dispatch a REAL touch tap via CDP Input domain at the BATTLE button.
  const touch = async (type, x, y) =>
    rpc("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });

  const sceneBefore = await evalJs(`return window.__game.scene.isActive('MainMenuScene');`);
  await touch("touchStart", bp.x, bp.y);
  await wait(60);
  await touch("touchEnd", bp.x, bp.y);
  await wait(900);
  console.log(
    "TAP battle =>",
    await evalJs(`const g=window.__game; return JSON.stringify({
      menuActiveBefore: ${sceneBefore},
      menuActive: g.scene.isActive('MainMenuScene'),
      stageSelectActive: g.scene.isActive('StageSelectScene'),
      active: g.scene.getScenes(true).map(s=>s.scene.key),
    });`),
  );

  // Probe Phaser's manager pointer mapping: dispatch a touch mid-canvas and read
  // where Phaser thinks it landed (worldX/Y) vs the game coord we aimed at.
  const mid = JSON.parse(await evalJs(`const p=window.__g2c(480,270); return JSON.stringify(p);`));
  await touch("touchStart", mid.x, mid.y);
  await wait(50);
  console.log(
    "pointer-map:",
    await evalJs(`const g=window.__game; const sc=g.scene.getScenes(true)[0]; const ap=g.input.activePointer;
    return JSON.stringify({aimedGame:{x:480,y:270}, pointer:{x:+ap.x.toFixed(1), y:+ap.y.toFixed(1), worldX:+(ap.worldX||0).toFixed(1), worldY:+(ap.worldY||0).toFixed(1)}, downScene: sc?sc.scene.key:null});`),
  );
  await touch("touchEnd", mid.x, mid.y);

  const png = await rpc("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/repro_mobile.png", Buffer.from(png.data, "base64"));
  console.log("shot: /tmp/repro_mobile.png");
  ws.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
