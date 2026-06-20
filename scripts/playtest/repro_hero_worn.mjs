// Hero "worn look" current-state capture: equips a representative full loadout
// (posed weapon + helmet + body + gloves + boots + wing + pet) and screenshots
// the three places the hero is shown — the throne (MainMenuScene), the equipment
// paper-doll (HeroScene), and the battle hero (BattleScene). Read-only research.
//   node scripts/playtest/repro_hero_worn.mjs [--port=4188] [--dir=/tmp]
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const DIR = arg("dir", "/tmp");
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
  const shoot = async (name) => {
    const shot = await rpc("Page.captureScreenshot", { format: "png" });
    if (shot?.data) {
      writeFileSync(`${DIR}/${name}.png`, Buffer.from(shot.data, "base64"));
      console.log("shot:", `${DIR}/${name}.png`);
    }
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
    ready = await evalJs(`return !!(window.__game && window.__game.registry.get("saveManager"));`);
    if (ready) break;
    await wait(500);
  }
  console.log("game ready:", ready);

  // Equip a representative full loadout straight into the save (throwaway).
  const equipped = await evalJs(`const g=window.__game;
    const items=await import("/src/data/items.ts");
    const CAT=items.ITEM_CATALOG;
    const pick=(fn)=>CAT.find(fn);
    const want={
      Weapon: pick(d=>d.slot==="Weapon" && d.weaponType==="Staff"),
      Helmet: pick(d=>d.slot==="Helmet"),
      BodyArmor: pick(d=>d.slot==="BodyArmor"),
      Gloves: pick(d=>d.slot==="Gloves"),
      Boots: pick(d=>d.slot==="Boots"),
      Wing: pick(d=>d.slot==="Wing"),
      Pet: pick(d=>d.slot==="Pet"),
      Amulet: pick(d=>d.slot==="Amulet"),
      Ring1: pick(d=>d.slot==="Ring"),
    };
    const mgr=g.registry.get("saveManager"); const s=mgr.getSave();
    s.inventory.items=s.inventory.items||[]; s.inventory.equipped=s.inventory.equipped||{};
    const out={};
    for(const [slot,def] of Object.entries(want)){
      if(!def){ out[slot]="(none in catalog)"; continue; }
      const iid="demo-"+slot;
      s.inventory.items.push({id:iid, defId:def.id, level:1, rolledPrimaryAffix:def.primaryAffix?{...def.primaryAffix}:undefined, affixes:[]});
      s.inventory.equipped[slot]=iid;
      out[slot]=def.id+(def.weaponType?(" ["+def.weaponType+"]"):"");
    }
    s.hero=s.hero||{}; s.hero.level=Math.max(s.hero.level||1,40);
    if(mgr.save) mgr.save();
    return JSON.stringify(out);`);
  console.log("equipped:", equipped);

  // 1) Throne / home.
  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("MainMenuScene"); return "home";`);
  await wait(1600);
  await shoot("hero_worn_1_throne");

  // 2) Equipment paper-doll.
  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("HeroScene"); return "hero";`);
  await wait(1600);
  await shoot("hero_worn_2_doll");

  // 3) Battle hero — start a battle, let the hero spawn, zoom not needed.
  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("BattleScene"); return "battle";`);
  await wait(2600);
  await shoot("hero_worn_3_battle");

  const heroInfo = await evalJs(`const g=window.__game;
    const bs=g.scene.getScene("BattleScene");
    const h=bs&&bs.heroSprite;
    return JSON.stringify({hasHeroSprite:!!h,
      weaponVisible:h?h.weaponSprite?.visible:null});`);
  console.log("battle hero:", heroInfo);

  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
