// Battle-CTA repro: opens MainMenuScene, asserts the emblem texture loaded and
// the CTA container carries the layered button parts, then screenshots it.
//   node scripts/playtest/repro_battle_cta.mjs [--port=4188] [--shot=/tmp/x.png]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/battle_cta.png");
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

  let texLoaded = false;
  for (let i = 0; i < 30; i++) {
    texLoaded = await evalJs(`return window.__game.textures.exists('ui__battle-emblem');`);
    if (texLoaded) break;
    await wait(500);
  }
  console.log("battle-emblem texture loaded:", texLoaded);

  await evalJs(`window.__game.scene.start("MainMenuScene"); return "started";`);
  await wait(1200);

  const report = JSON.parse(
    await evalJs(`const s=window.__game.scene.getScene("MainMenuScene");
      // The CTA is the only container holding the ui__battle-emblem image.
      const conts=s.children.list.filter(o=>o.type==='Container');
      let hit=null;
      for(const c of conts){
        const hasEmblem=c.list && c.list.some(o=>o.texture && o.texture.key==='ui__battle-emblem');
        if(hasEmblem){ hit=c; break; }
      }
      const parts = hit ? hit.list.map(o=>o.type) : [];
      return JSON.stringify({
        foundCta: !!hit,
        hasGraphics: parts.includes('Graphics'),
        hasImage: parts.includes('Image'),
        hasText: parts.includes('Text'),
        hasZone: parts.includes('Zone'),
      });`),
  );
  console.log("CTA report:", report);

  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("shot:", SHOT);
  }

  const ok =
    texLoaded &&
    report.foundCta &&
    report.hasGraphics &&
    report.hasImage &&
    report.hasText &&
    report.hasZone;
  console.log(ok ? "VERDICT: PASS" : "VERDICT: FAIL");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
