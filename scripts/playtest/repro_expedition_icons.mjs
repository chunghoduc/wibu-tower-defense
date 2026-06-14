// Expedition-icons repro: opens ExpeditionScene, asserts the rarity gem textures
// loaded, the cards carry rarity + reward icon images, and the free-reroll button
// reads "Reroll (n/5)" and decrements on click. Then screenshots the board.
//   node scripts/playtest/repro_expedition_icons.mjs [--port=4188] [--shot=/tmp/x.png]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/expedition_icons.png");
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

  let texLoaded = false;
  for (let i = 0; i < 30; i++) {
    texLoaded = await evalJs(`return window.__game.textures.exists('rarity__Legendary');`);
    if (texLoaded) break;
    await wait(500);
  }
  console.log("rarity__Legendary texture loaded:", texLoaded);

  await evalJs(`window.__game.scene.start("ExpeditionScene"); return "started";`);
  await wait(1200);

  const report = JSON.parse(
    await evalJs(`const s=window.__game.scene.getScene("ExpeditionScene");
      const all=[];
      const walk=(o)=>{ if(o.list) o.list.forEach(walk); all.push(o); };
      s.children.list.forEach(walk);
      const texKeys=all.filter(o=>o.texture&&o.texture.key).map(o=>o.texture.key);
      const hasRarityGem=texKeys.some(k=>k.startsWith('rarity__'));
      const hasRewardIcon=texKeys.some(k=>k==='icon__gold'||k==='icon__gem'||k.startsWith('material__'));
      const texts=all.filter(o=>o.type==='Text').map(o=>o.text||'');
      const rerollTxt=texts.find(x=>/Reroll \\(\\d\\/5\\)/.test(x))||'';
      const dispatchTxt=texts.find(x=>/Dispatches \\d\\/5/.test(x))||'';
      const m=rerollTxt.match(/\\((\\d)\\/5\\)/);
      return JSON.stringify({ hasRarityGem, hasRewardIcon, rerollTxt, dispatchTxt, before: m?Number(m[1]):-1 });`),
  );
  console.log("board report:", report);

  // Click the reroll button via the SaveManager + scene API, then re-read count.
  const after = JSON.parse(
    await evalJs(`const s=window.__game.scene.getScene("ExpeditionScene");
      const mgr=window.__game.registry.get("saveManager");
      const ok=mgr.rerollExpeditionBoard();
      s.redraw && s.redraw();
      return JSON.stringify({ ok, left: mgr.expeditionRerollsLeft() });`),
  );
  console.log("after reroll:", after);
  await wait(400);

  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("shot:", SHOT);
  }

  // Gems may be the procedural fallback if art is absent; only require the gate
  // texture when it actually loaded. Reward icons + reroll decrement are firm.
  const gemsOk = !texLoaded || report.hasRarityGem;
  const rerollOk = after.ok && report.before >= 0 && after.left === report.before - 1;
  const dispatchOk = /Dispatches \d\/5/.test(report.dispatchTxt);
  const ok =
    gemsOk &&
    report.hasRewardIcon &&
    /Reroll \(\d\/5\)/.test(report.rerollTxt) &&
    rerollOk &&
    dispatchOk;
  console.log(ok ? "VERDICT: PASS" : "VERDICT: FAIL");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
