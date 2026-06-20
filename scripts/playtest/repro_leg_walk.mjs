// Leg-puppet walk repro.
//
// Proves ground enemies now walk on two alternating leg pieces cropped from the
// SAME single static sprite (no multi-frame strip): asserts the enemy base
// texture is still one frame, that a leg rig exists per ground enemy, and that
// the two legs sit at DIFFERENT y (one lifted) while walking. Screenshots a wave.
//   node scripts/playtest/repro_leg_walk.mjs [--port=4188] [--shot=/tmp/legwalk.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/legwalk.png");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const t = await (
    await fetch(`http://localhost:9222/json/new?${encodeURIComponent(`http://localhost:${PORT}/?debug`)}`, {
      method: "PUT",
    })
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
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(6000);

  console.log(
    "start:",
    await evalJs(`const g=window.__game; if(!g) return "no game";
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "started";`),
  );
  await wait(1800);
  console.log(
    "place:",
    await evalJs(`const bs=window.__game.scene.getScene("BattleScene");
    if(!bs||!bs.battle) return "no battle";
    const ids=(bs.buildOrder||[]).map(d=>d.id); let p=0;
    for(let i=0;i<Math.min(4,ids.length);i++) if(bs.battle.placeTower(ids[i],i)) p++;
    return "placed="+p;`),
  );
  await wait(3500); // let a wave spawn + walk

  // Sample the leg rig of the first non-flying enemy across two frames.
  const probe = `
    const bs=window.__game.scene.getScene("BattleScene");
    const e=(bs.battle.enemies||[]).find(en=>!en.flying);
    if(!e) return JSON.stringify({err:"no ground enemy", n:(bs.battle.enemies||[]).length});
    const s=bs.enemySprites.get(e.uid);
    const rig=bs.enemyLegs.get(e.uid);
    const src=s&&s.texture&&s.texture.getSourceImage?s.texture.getSourceImage():null;
    const frames=s?s.texture.frameTotal:0; // includes __BASE
    return JSON.stringify({
      enemy:e.def.id,
      texW: src?src.width:0,
      frameTotal: frames,
      hasRig: !!rig,
      legLy: rig?Math.round(rig.legL.y*10)/10:null,
      legRy: rig?Math.round(rig.legR.y*10)/10:null,
      bodyCropped: s? (s.isCropped===true) : null,
    });`;
  const a = JSON.parse(await evalJs(probe));
  await wait(450); // ~quarter gait cycle later
  const b = JSON.parse(await evalJs(probe));
  console.log("frameA:", JSON.stringify(a));
  console.log("frameB:", JSON.stringify(b));

  // Verdicts
  const v = [];
  v.push(["single-frame (texW small, not a strip)", a.texW > 0 && a.texW <= 400]);
  v.push(["leg rig exists", a.hasRig === true]);
  v.push(["body cropped (feet hidden)", a.bodyCropped === true]);
  v.push(["legs at different y at some sample (stepping)", a.legLy !== a.legRy || b.legLy !== b.legRy]);
  v.push(["legs move between frames (animated)", a.legLy !== b.legLy || a.legRy !== b.legRy]);
  for (const [name, ok] of v) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);

  const png = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(png.data, "base64"));
  console.log("screenshot:", SHOT);
  ws.close();
  if (v.some(([, ok]) => !ok)) process.exitCode = 2;
}
main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
