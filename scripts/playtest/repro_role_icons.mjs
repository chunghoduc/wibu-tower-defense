// Role-icon clarity repro: starts BattleScene and asserts every build-bar card
// carries a role-emblem Image whose texture key is `roleicon__<def.role>` (the
// "empty colored dot" bug fix), then screenshots the build bar for the eye.
//   node scripts/playtest/repro_role_icons.mjs [--port=4188] [--shot=/tmp/x.png]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/role_icons.png");
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
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 844,
    screenHeight: 390,
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

  // Wait for PreloadScene's load queue to finish — the roleicon textures load
  // there, and buildBuildBar only adds the emblem if the texture already exists.
  let texCount = 0;
  for (let i = 0; i < 24; i++) {
    texCount = await evalJs(`const tx=window.__game.textures;
      return ['damage','splash','chain','dot','support','debuff','tanker']
        .filter(r=>tx.exists('roleicon__'+r)).length;`);
    if (texCount === 7) break;
    await wait(500);
  }
  console.log("roleicon textures loaded before battle:", texCount);

  await evalJs(`const g=window.__game;
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "started";`);
  for (let i = 0; i < 30; i++) {
    const ok = await evalJs(`const b=window.__game.scene.getScene("BattleScene");
      return !!(b && b.avatarTiles && b.avatarTiles.length && b.battle);`);
    if (ok) break;
    await wait(400);
  }

  const bs = `window.__game.scene.getScene("BattleScene")`;

  // Each card must contain a child Image whose texture key is roleicon__<role>.
  const report = JSON.parse(
    await evalJs(`const b=${bs};
      const rows=b.buildOrder.map((def,i)=>{
        const c=b.avatarTiles[i];
        const keys=c.list.filter(o=>o.texture).map(o=>o.texture.key);
        return { id:def.id, role:def.role, hasEmblem:keys.includes('roleicon__'+def.role) };
      });
      return JSON.stringify({
        cards:rows.length,
        withEmblem:rows.filter(r=>r.hasEmblem).length,
        rows:rows,
        texLoaded:['damage','splash','chain','dot','support','debuff','tanker']
          .filter(r=>b.textures.exists('roleicon__'+r)),
      });`),
  );
  console.log("cards:", report.cards, "withEmblem:", report.withEmblem);
  console.log("roleicon textures loaded:", report.texLoaded.join(","));
  for (const r of report.rows)
    console.log(`  ${r.hasEmblem ? "OK " : "MISS"} ${r.role.padEnd(8)} ${r.id}`);

  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("shot:", SHOT);
  }

  // Verdict: all 7 role textures present AND every card shows its emblem.
  const ok = report.texLoaded.length === 7 && report.cards > 0 && report.withEmblem === report.cards;
  console.log(ok ? "VERDICT: PASS" : "VERDICT: FAIL");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
