// Mobile repro #2: portrait phone + the portrait->landscape rotation transition.
// Tests (a) rotate-overlay state & whether it blocks, (b) pointer mapping after a
// simulated orientation change (stale canvas bounds?), (c) tap on BATTLE.
//   node scripts/playtest/repro_mobile2.mjs [--port=4188]
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
  // Start in PORTRAIT (iPhone 12-ish 390x844).
  await metrics(390, 844);
  await rpc("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await rpc("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }] });
  await wait(6000);

  const overlayState = await evalJs(`const o=document.getElementById('rotate-overlay');
    const cs=o?getComputedStyle(o):null;
    const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    return JSON.stringify({
      portrait: innerWidth+'x'+innerHeight,
      overlayDisplay: cs?cs.display:'(none-el)',
      overlayPointerEvents: cs?cs.pointerEvents:null,
      overlayZ: cs?cs.zIndex:null,
      canvas: {l:+r.left.toFixed(0),t:+r.top.toFixed(0),w:+r.width.toFixed(0),h:+r.height.toFixed(0)},
      splash: (()=>{const s=document.getElementById('loading-splash'); return s?getComputedStyle(s).display+'/'+getComputedStyle(s).pointerEvents:'(removed)';})(),
    });`);
  console.log("PORTRAIT:", overlayState);

  // Tap where BATTLE would be in the portrait-letterboxed canvas.
  const bp = JSON.parse(await evalJs(`const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    const sx=r.width/960, sy=r.height/540; const p={x:r.left+480*sx, y:r.top+443*sy};
    return JSON.stringify({x:+p.x.toFixed(0),y:+p.y.toFixed(0)});`));
  await touch("touchStart", bp.x, bp.y);
  await wait(60);
  await touch("touchEnd", bp.x, bp.y);
  await wait(700);
  console.log(
    "PORTRAIT tap BATTLE =>",
    await evalJs(`const g=window.__game; return JSON.stringify({menuActive:g.scene.isActive('MainMenuScene'), stageSelect:g.scene.isActive('StageSelectScene')});`),
  );

  // Now ROTATE to landscape (simulate the device turning). Fire the same events a
  // browser would: resize + orientationchange. Does Phaser remap pointers?
  await metrics(844, 390);
  await evalJs(`window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); return 'rotated';`);
  await wait(800);
  const land = await evalJs(`const o=document.getElementById('rotate-overlay'); const cs=o?getComputedStyle(o):null;
    const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    return JSON.stringify({land: innerWidth+'x'+innerHeight, overlayDisplay: cs?cs.display:'(none)', canvas:{l:+r.left.toFixed(0),t:+r.top.toFixed(0),w:+r.width.toFixed(0),h:+r.height.toFixed(0)}, scaleW:+window.__game.scale.width.toFixed(0), scaleH:+window.__game.scale.height.toFixed(0)});`);
  console.log("LANDSCAPE(after rotate):", land);

  // Pointer-map check after rotate: aim at game (480,270), read Phaser pointer.
  const mid = JSON.parse(await evalJs(`const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    const sx=r.width/960, sy=r.height/540; return JSON.stringify({x:r.left+480*sx, y:r.top+270*sy});`));
  await touch("touchStart", mid.x, mid.y);
  await wait(60);
  console.log(
    "pointer-map after rotate:",
    await evalJs(`const ap=window.__game.input.activePointer; return JSON.stringify({aimed:{x:480,y:270}, got:{x:+ap.x.toFixed(1),y:+ap.y.toFixed(1)}});`),
  );
  await touch("touchEnd", mid.x, mid.y);
  await wait(50);

  // Tap BATTLE in landscape after the rotate.
  const bp2 = JSON.parse(await evalJs(`const cv=document.querySelector('canvas'); const r=cv.getBoundingClientRect();
    const sx=r.width/960, sy=r.height/540; return JSON.stringify({x:r.left+480*sx, y:r.top+443*sy});`));
  await touch("touchStart", bp2.x, bp2.y);
  await wait(60);
  await touch("touchEnd", bp2.x, bp2.y);
  await wait(700);
  console.log(
    "LANDSCAPE tap BATTLE =>",
    await evalJs(`const g=window.__game; return JSON.stringify({menuActive:g.scene.isActive('MainMenuScene'), stageSelect:g.scene.isActive('StageSelectScene'), active:g.scene.getScenes(true).map(s=>s.scene.key)});`),
  );

  ws.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
