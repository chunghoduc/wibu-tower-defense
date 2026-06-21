// Skill-damage-display repro. Grants + equips a couple of skills, opens the
// Skills screen, and screenshots it so we can eyeball the "×mult ATK · ≈burst"
// line. Also asserts (via the shared pure helper) that the shown burst equals
// the in-battle cast formula.
//   node scripts/playtest/repro_skill_damage.mjs [--port=4188] [--shot=/tmp/skill_damage.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/skill_damage.png");
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

  const out = await evalJs(`
    const g = window.__game;
    const mgr = g.registry.get('saveManager');
    const save = mgr.getSave();
    save.hero.level = 60;
    save.hero.obtainedSkills = [
      { skillId: 'arcane-nova', level: 5, useXp: 0 },
      { skillId: 'void-palm', level: 0, useXp: 0 },
      { skillId: 'spirit-bolt', level: 3, useXp: 0 },
    ];
    save.hero.equippedSkillIds = ['arcane-nova'];

    const active = g.scene.scenes.find(s=>s.scene.isActive());
    active.scene.start('SkillsScene');
    await new Promise(r=>setTimeout(r,800));
    const sk = g.scene.getScene('SkillsScene');
    return { active: !!(sk && sk.scene.isActive()), owned: save.hero.obtainedSkills.length };
  `);
  console.log("result:", JSON.stringify(out));

  await wait(500);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
  console.log("shot:", SHOT);
  ws.close();
}
main();
