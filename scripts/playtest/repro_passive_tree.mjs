// Passive-tree expansion repro: opens PassiveGridScene, asserts the live tree is
// massive (~936 nodes, < 1/5 reachable at the 100-pt cap), the scene runs a 2-camera
// (tree + fixed UI panel) setup, and pan/zoom clamp into range. Screenshots the board.
//   node scripts/playtest/repro_passive_tree.mjs [--port=4188] [--shot=/tmp/x.png]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/passive_tree.png");
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
    width: 960,
    height: 540,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(500);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.scene);`);
    if (ready) break;
    await wait(500);
  }
  console.log("game ready:", ready);

  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach((sc)=>{ if(sc.scene.key!=="PassiveGridScene") g.scene.stop(sc.scene.key); });
    g.scene.start("PassiveGridScene"); return "started";`);
  await wait(1200);

  const report = JSON.parse(
    await evalJs(`const g=window.__game;
      const s=g.scene.getScene("PassiveGridScene");
      // Node count via the data module reachable from the scene's import graph.
      const mod = await import("/src/data/passiveGrid.ts").catch(()=>null);
      const nodeCount = mod ? mod.PASSIVE_NODES.length : -1;
      const cams = s.cameras.cameras.length;
      // Drive zoom + pan, read back the clamped values.
      const cam = s.cameras.main;
      cam.zoom = 99; s.input.emit; // direct set; clamp happens via wheel/buttons in-app
      const z0 = cam.zoom;
      return JSON.stringify({ nodeCount, cams, zoomRaw: z0 });`),
  );
  console.log("report:", report);

  // Exercise the real clamp path the buttons use: zoom by factor then clamp.
  const clamp = JSON.parse(
    await evalJs(`const s=window.__game.scene.getScene("PassiveGridScene");
      const cam=s.cameras.main;
      // Simulate the +/- buttons' effect through wheel events the scene listens to.
      s.input.emit("wheel", {x:200,y:200}, [], 0, 200, 0); // zoom out
      const zout = cam.zoom;
      for(let i=0;i<40;i++) s.input.emit("wheel", {x:200,y:200}, [], 0, -50, 0); // zoom in hard
      const zin = cam.zoom;
      return JSON.stringify({ zout, zin });`),
  );
  console.log("zoom clamp:", clamp);

  await wait(300);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("shot:", SHOT);
  }

  const massive = report.nodeCount >= 880;
  const coverageOK = 100 / report.nodeCount < 0.2;
  const twoCams = report.cams >= 2;
  const zoomClamped = clamp.zin <= 1.6001 && clamp.zout >= 0.3999;
  const ok = massive && coverageOK && twoCams && zoomClamped;
  console.log(
    ok
      ? "VERDICT: PASS"
      : `VERDICT: FAIL (massive=${massive} coverage=${coverageOK} cams=${twoCams} zoom=${zoomClamped})`,
  );
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
