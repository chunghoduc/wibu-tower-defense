// In-battle hero-skill hover tooltip repro. Enters a battle, equips two actives,
// invokes showHeroSkillTip() (the hover/tap handler), asserts the tooltip became
// visible with the full detail text, and screenshots it.
//   node scripts/playtest/repro_hero_skill_tip.mjs [--port=4188] [--shot=/tmp/hero_skill_tip.png]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/hero_skill_tip.png");
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
  await wait(6000);

  console.log(
    "setup:",
    await evalJs(`const g=window.__game; if(!g) return "no game";
    const mgr=g.registry.get('saveManager'); const save=mgr.getSave();
    save.hero.level=60;
    save.hero.obtainedSkills=[
      {skillId:'arcane-nova',level:5,useXp:0},
      {skillId:'iron-cleave',level:3,useXp:0},
    ];
    save.hero.equippedSkillIds=['arcane-nova','iron-cleave'];
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "ok";`),
  );
  await wait(2000);

  const out = JSON.parse(
    await evalJs(`
    const bs=window.__game.scene.getScene("BattleScene");
    if(!bs||!bs.showHeroSkillTip) return JSON.stringify({err:"no scene/method"});
    bs.showHeroSkillTip();
    const tip=bs.hudSkillTip, txt=bs.hudSkillTipText;
    return JSON.stringify({
      hasMethod:true,
      badgeVisible: bs.hudSkillText.visible,
      tipVisible: tip.visible,
      depth: tip.depth,
      textLen: (txt.text||"").length,
      hasNova: (txt.text||"").includes("Arcane"),
      hasBurst: /Burst/.test(txt.text||""),
      hasPx: /px/.test(txt.text||""),
      hasLv: /Lv/.test(txt.text||""),
      twoSkills: (txt.text||"").split("\\n\\n").length,
    });`),
  );
  console.log("probe:", JSON.stringify(out));
  const v = [
    ["method present", out.hasMethod === true],
    ["tooltip visible after hover", out.tipVisible === true],
    ["has skill name", out.hasNova === true],
    ["has burst calc", out.hasBurst === true],
    ["has AoE px", out.hasPx === true],
    ["has level line", out.hasLv === true],
    ["lists both equipped skills", out.twoSkills >= 2],
  ];
  for (const [name, ok] of v) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);

  await wait(300);
  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
  console.log("shot:", SHOT);
  ws.close();
}
main();
