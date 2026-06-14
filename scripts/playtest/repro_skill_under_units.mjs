// Skill-VFX-UNDER-UNITS repro.
//
// Proves the depth split: objects spawned by SkillVfx / BossSkillFx (the "cast"
// and "bossCast" FxEvents) all land BELOW DEPTH.ENEMY (=2), while ordinary combat
// feedback (a melee "attack" + a "hit" damage number) lands at/above the units.
//   node scripts/playtest/repro_skill_under_units.mjs [--port=4188]
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

  // Construct a throwaway FxLayer wired exactly like BattleScene, fire skill-cast
  // + ordinary-combat FX events, and synchronously read the depths of the objects
  // each event created (before their cleanup tweens run).
  const out = await evalJs(`
    const g = window.__game;
    const scene = g.scene.scenes.find(s=>s.scene.isActive());
    const fxMod = await import('/src/scenes/fx.ts');
    const d = await import('/src/scenes/battleDepths.ts');
    const fx = new fxMod.FxLayer(scene, d.DEPTH.FX, undefined, d.DEPTH.SKILL_FX_UNDER);

    const depthsOf = (before) =>
      scene.children.list
        .slice(before)
        .map(o => (typeof o.depth === 'number' ? o.depth : null))
        .filter(v => v !== null);

    const from = { x: 300, y: 300 }, at = { x: 480, y: 280 };

    // --- skill-cast VFX (tower active) ---
    let n = scene.children.list.length;
    fx.play({ type:'cast', from, at, radius: 90, skillId: 'meteor', source: 'tower' });
    const skillTower = depthsOf(n);

    // --- boss-cast VFX ---
    n = scene.children.list.length;
    fx.play({ type:'bossCast', at, skill: 'quake', radius: 90, name: 'Boss', element: 'Physical' });
    const bossCast = depthsOf(n);

    // --- ordinary combat feedback (melee swing + damage number) ---
    n = scene.children.list.length;
    fx.play({ type:'attack', style:'slash', from, to: at, ranged:false, crit:false, damageType:'Physical', role:'damage' });
    const melee = depthsOf(n);
    n = scene.children.list.length;
    fx.play({ type:'hit', at, amount: 123, damageType:'Physical', aoe:false });
    const hit = depthsOf(n);

    const skill = skillTower.concat(bossCast);
    const feedback = melee.concat(hit);
    const max = a => a.length ? Math.max(...a) : null;
    const min = a => a.length ? Math.min(...a) : null;
    return JSON.stringify({
      ENEMY: d.DEPTH.ENEMY,
      skill: { count: skill.length, min: min(skill), max: max(skill) },
      feedback: { count: feedback.length, min: min(feedback), max: max(feedback) },
      skillAllBelowEnemy: skill.length > 0 && max(skill) < d.DEPTH.ENEMY,
      feedbackAtOrAboveEnemy: feedback.length > 0 && min(feedback) >= d.DEPTH.ENEMY,
    });
  `);
  console.log("depth split:", out);

  const errs = await evalJs(`return (window.__errors||[]).slice(0,5);`);
  console.log("client errors:", JSON.stringify(errs || []));

  const parsed = JSON.parse(out || "{}");
  const ok = parsed.skillAllBelowEnemy && parsed.feedbackAtOrAboveEnemy;
  console.log(ok ? "PASS ✅ skill VFX render under units" : "FAIL ❌");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
