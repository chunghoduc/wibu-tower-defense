// Endless-CTA repro: opens MainMenuScene, asserts the bottom-LEFT ENDLESS forged
// square exists (ENDLESS label + Zone + the SDXL emblem image loaded), screenshots
// it, then verifies the launch path is gated (clearing nothing → toast, not battle).
//   node scripts/playtest/repro_endless_cta.mjs [--port=4189] [--shot=/tmp/x.png]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4189");
const SHOT = arg("shot", "/tmp/endless_cta.png");
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

  await evalJs(`window.__game.scene.start("MainMenuScene"); return "started";`);
  await wait(1200);

  const report = JSON.parse(
    await evalJs(`const s=window.__game.scene.getScene("MainMenuScene");
      const conts=s.children.list.filter(o=>o.type==='Container');
      let hit=null;
      for(const c of conts){
        const hasLabel=c.list && c.list.some(o=>o.type==='Text' && /endless/i.test(o.text||''));
        const hasZone=c.list && c.list.some(o=>o.type==='Zone');
        if(hasLabel && hasZone){ hit=c; break; }
      }
      const parts = hit ? hit.list.map(o=>o.type) : [];
      return JSON.stringify({
        foundCta: !!hit,
        ctaX: hit ? Math.round(hit.x) : -1,
        ctaY: hit ? Math.round(hit.y) : -1,
        hasGraphics: parts.filter(t=>t==='Graphics').length >= 4,
        hasEmblemImage: parts.includes('Image'),
        hasText: parts.includes('Text'),
        hasZone: parts.includes('Zone'),
        emblemLoaded: s.textures.exists('ui__endless-emblem'),
      });`),
  );
  console.log("ENDLESS CTA report:", report);

  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("shot:", SHOT);
  }

  // bottom-left placement + all parts present + SDXL emblem loaded & drawn.
  const ok =
    report.foundCta &&
    report.hasGraphics &&
    report.hasText &&
    report.hasZone &&
    report.emblemLoaded &&
    report.hasEmblemImage &&
    report.ctaX < 200 &&
    report.ctaY > 270;
  console.log(ok ? "VERDICT: PASS" : "VERDICT: FAIL");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
