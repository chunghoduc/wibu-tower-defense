// Skill-VFX RARITY-SCALING repro.
//
// Proves a cast's spectacle scales with the caster's rarity: the same skill cast
// at Common → Magic → Rare → Legendary → Unique spawns a strictly denser burst
// (more particles per wave) AND more impact waves, with the grand flourish only
// at Legendary+. Screenshots a Common vs Legendary cast side by side.
//   node scripts/playtest/repro_skill_rarity.mjs [--port=4188] [--shot=/tmp/skill_rarity.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/skill_rarity.png");
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

  // Fire the SAME skill at each rarity on a throwaway FxLayer and count how many
  // tweens the whole cast schedules (delivery + every wave). Tweens are never
  // pooled, so this is a faithful proxy for total animated particles/frames —
  // it must rise monotonically with rarity.
  const out = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const fxMod = await import('/src/scenes/fx.ts');
    const d = await import('/src/scenes/battleDepths.ts');
    const powMod = await import('/src/data/skillVfxPower.ts');
    const wait = (ms) => new Promise(r=>setTimeout(r,ms));
    const from = { x: 300, y: 320 }, at = { x: 620, y: 300 };

    async function tweenCount(skillId, rarity) {
      const fx = new fxMod.FxLayer(scene, d.DEPTH.FX, undefined, d.DEPTH.SKILL_FX_UNDER);
      let c = 0;
      const orig = scene.tweens.add.bind(scene.tweens);
      scene.tweens.add = (cfg) => { c++; return orig(cfg); };
      fx.play({ type:'cast', from, at, radius: 80, skillId, source: 'tower', rarity });
      await wait(900); // cover delivery + all staggered waves + element durations
      scene.tweens.add = orig;
      return c;
    }

    const rarities = ['Common','Magic','Rare','Legendary','Unique'];
    const counts = {};
    for (const r of rarities) counts[r] = await tweenCount('fireball', r);
    const waves = {}, grand = {};
    for (const r of rarities) { waves[r] = powMod.vfxPower(r).waves; grand[r] = powMod.vfxPower(r).grand; }

    return JSON.stringify({ counts, waves, grand });
  `);
  console.log("rarity scaling:", out);

  // Screenshot: Common cast (left) vs Legendary cast (right), grabbed mid-burst.
  await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const fxMod = await import('/src/scenes/fx.ts');
    const d = await import('/src/scenes/battleDepths.ts');
    const fx = new fxMod.FxLayer(scene, d.DEPTH.FX, undefined, d.DEPTH.SKILL_FX_UNDER);
    fx.play({ type:'cast', from:{x:120,y:430}, at:{x:240,y:300}, radius:80, skillId:'fireball', source:'tower', rarity:'Common' });
    fx.play({ type:'cast', from:{x:620,y:430}, at:{x:740,y:300}, radius:80, skillId:'fireball', source:'tower', rarity:'Legendary' });
    return true;
  `);
  await wait(80);
  const cap = await rpc("Page.captureScreenshot", { format: "png" });
  if (cap?.data) {
    writeFileSync(SHOT, Buffer.from(cap.data, "base64"));
    console.log("screenshot:", SHOT);
  }

  const errs = await evalJs(`return (window.__errors||[]).slice(0,5);`);
  console.log("client errors:", JSON.stringify(errs || []));

  const p = JSON.parse(out || "{}");
  const c = p.counts || {};
  const order = ["Common", "Magic", "Rare", "Legendary", "Unique"];
  let monotonic = true;
  for (let i = 1; i < order.length; i++)
    if (!(c[order[i]] > c[order[i - 1]])) monotonic = false;
  const grandOk = p.grand?.Common === false && p.grand?.Legendary === true && p.grand?.Unique === true;
  const wavesOk = p.waves?.Common === 1 && p.waves?.Legendary >= 3;
  const ok = monotonic && grandOk && wavesOk;
  console.log(
    ok
      ? "PASS ✅ denser burst + more waves + grand flourish scale with rarity"
      : "FAIL ❌ counts=" + JSON.stringify(c),
  );
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
