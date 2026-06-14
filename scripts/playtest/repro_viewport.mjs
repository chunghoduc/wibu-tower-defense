// Viewport-fit repro: prove the canvas re-fits the VISIBLE viewport and the
// bottom BATTLE CTA stays tappable when the visual viewport shrinks (toolbar
// proxy) / the device rotates.
//   node scripts/playtest/repro_viewport.mjs [--port=4188]
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
  const metrics = (w, h) =>
    rpc("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: w,
      screenHeight: h,
    });
  const touch = async (type, x, y) =>
    rpc("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });

  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await metrics(844, 390);
  await rpc("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await rpc("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }] });
  await wait(6000);

  // Instrument: count scale.refresh() calls so we can prove the wiring fires.
  await evalJs(`const g=window.__game; window.__refreshes=0; const real=g.scale.refresh.bind(g.scale);
    g.scale.refresh=function(){window.__refreshes++; return real();}; return 'patched';`);

  const baseline = await evalJs(`const g=window.__game; const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    return JSON.stringify({canvasH:+r.height.toFixed(0), scaleH:+g.scale.height.toFixed(0), visH:+(visualViewport?visualViewport.height:innerHeight).toFixed(0)});`);
  console.log("baseline(844x390):", baseline);

  // SHRINK the visible viewport (toolbar appears: 390 -> 320) and fire the
  // visualViewport resize the way iOS would. The presenter must scale.refresh().
  await metrics(844, 320);
  await evalJs(`if (window.visualViewport) window.visualViewport.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize')); return 'shrunk';`);
  await wait(400);
  const afterShrink = await evalJs(`const g=window.__game; const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    return JSON.stringify({refreshes:window.__refreshes, canvasH:+r.height.toFixed(0), canvasBottom:+(r.top+r.height).toFixed(0), viewportH: innerHeight});`);
  console.log("after shrink(844x320):", afterShrink);

  // The BATTLE CTA must still be WITHIN the visible viewport and still tappable.
  const bp = JSON.parse(await evalJs(`const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    const sx=r.width/960, sy=r.height/540; const p={x:r.left+480*sx, y:r.top+443*sy};
    return JSON.stringify({x:+p.x.toFixed(0), y:+p.y.toFixed(0), withinViewport: (r.top+443*sy) <= innerHeight});`));
  console.log("BATTLE button:", JSON.stringify(bp));
  await touch("touchStart", bp.x, bp.y);
  await wait(60);
  await touch("touchEnd", bp.x, bp.y);
  await wait(800);
  console.log(
    "tap BATTLE after shrink =>",
    await evalJs(`const g=window.__game; return JSON.stringify({menuActive:g.scene.isActive('MainMenuScene'), stageSelect:g.scene.isActive('StageSelectScene')});`),
  );

  ws.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
