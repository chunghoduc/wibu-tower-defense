// Skill-VOLLEY repro.
//
// Proves the literal "fired-from-the-caster" projectiles: a tri-shot cast spawns
// THREE arrows (shaft+head each) fanning from the hero, rapid-fire streams bullets,
// piercing-arrow overshoots past the target — and every projectile renders BELOW
// the units (DEPTH.ENEMY). Also screenshots the projectiles mid-flight.
//   node scripts/playtest/repro_skill_volley.mjs [--port=4188] [--shot=/tmp/skill_volley.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/skill_volley.png");
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
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(600);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evalJs(
      `return !!(window.__game && window.__game.scene && window.__game.scene.getScene('MainMenuScene') && window.__game.scene.getScene('MainMenuScene').scene.isActive());`,
    );
    if (ready) break;
    await wait(400);
  }
  console.log("game ready:", ready);

  // Build a throwaway FxLayer and fire hero skill casts, counting the projectile
  // objects each spawns synchronously (fan shots fire at delay 0) and their depth.
  const out = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const fxMod = await import('/src/scenes/fx.ts');
    const d = await import('/src/scenes/battleDepths.ts');
    const motifMod = await import('/src/data/skillMotif.ts');
    const volMod = await import('/src/scenes/projectileVolley.ts');
    const fx = new fxMod.FxLayer(scene, d.DEPTH.FX, undefined, d.DEPTH.SKILL_FX_UNDER);

    const from = { x: 300, y: 320 }, at = { x: 620, y: 300 };
    const spawnedSince = (before) => scene.children.list.slice(before);
    const depthsOf = (objs) => objs.map(o => (typeof o.depth==='number'?o.depth:null)).filter(v=>v!==null);

    function castCount(skillId) {
      const n = scene.children.list.length;
      fx.play({ type:'cast', from, at, radius: 80, skillId, source: 'hero' });
      const objs = spawnedSince(n);
      const depths = depthsOf(objs);
      return { spawned: objs.length, maxDepth: depths.length?Math.max(...depths):null };
    }

    const tri = castCount('tri-shot');
    const rapid = castCount('rapid-fire');
    const pierce = castCount('piercing-arrow');

    return JSON.stringify({
      ENEMY: d.DEPTH.ENEMY,
      motif: {
        tri: motifMod.skillMotif('tri-shot'),
        rapid: motifMod.skillMotif('rapid-fire'),
        pierce: motifMod.skillMotif('piercing-arrow'),
      },
      planLen: {
        tri: volMod.planVolley(from, at, motifMod.skillMotif('tri-shot')).length,
        rapid: volMod.planVolley(from, at, motifMod.skillMotif('rapid-fire')).length,
      },
      tri, rapid, pierce,
      allUnderUnits: [tri,rapid,pierce].every(c => c.maxDepth===null || c.maxDepth < d.DEPTH.ENEMY),
    });
  `);
  console.log("volley:", out);

  // Screenshot the projectiles mid-flight (re-fire and grab immediately).
  await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const fxMod = await import('/src/scenes/fx.ts');
    const d = await import('/src/scenes/battleDepths.ts');
    const fx = new fxMod.FxLayer(scene, d.DEPTH.FX, undefined, d.DEPTH.SKILL_FX_UNDER);
    fx.play({ type:'cast', from:{x:220,y:420}, at:{x:760,y:380}, radius:80, skillId:'tri-shot', source:'hero' });
    fx.play({ type:'cast', from:{x:220,y:300}, at:{x:760,y:300}, radius:80, skillId:'rapid-fire', source:'hero' });
    return true;
  `);
  await wait(60);
  const cap = await rpc("Page.captureScreenshot", { format: "png" });
  if (cap?.data) {
    writeFileSync(SHOT, Buffer.from(cap.data, "base64"));
    console.log("screenshot:", SHOT);
  }

  const errs = await evalJs(`return (window.__errors||[]).slice(0,5);`);
  console.log("client errors:", JSON.stringify(errs || []));

  const p = JSON.parse(out || "{}");
  // tri-shot = 3 arrows × (shaft+head) = 6 objects, fan fires synchronously.
  const triOk = p.tri?.spawned >= 6 && p.planLen?.tri === 3;
  const rapidMotifOk = p.motif?.rapid?.count === 5;
  const ok = triOk && rapidMotifOk && p.allUnderUnits;
  console.log(ok ? "PASS ✅ literal projectiles fire from the caster, under units" : "FAIL ❌");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
