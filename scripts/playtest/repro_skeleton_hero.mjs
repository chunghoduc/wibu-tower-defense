// Worn-gear battle rig capture. Equips a full worn loadout (all slots have
// purpose-built worn art), starts a battle, then zooms the hero sprite and
// screenshots idle / walk / attack poses to judge gear placement + motion.
// Requires a vite DEV server (serves /src for the equip injection):
//   npx vite --port 4188   then   node scripts/playtest/repro_worn_rig.mjs
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
  await wait(800);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.registry.get("saveManager"));`);
    if (ready) break;
    await wait(500);
  }
  console.log("game ready:", ready);

  // Equip a full worn loadout by defId — every piece has purpose-built worn art.
  // No /src import needed: the visual resolvers look up the catalog internally.
  const equipped = await evalJs(`const g=window.__game;
    const want={ Weapon:"heroic-warblade", Helmet:"iron-helm", BodyArmor:"scale-mail",
      Gloves:"assassin-gloves", Pants:"heroic-plate-legguards", Boots:"swift-boots", Wing:"tempest-wings" };
    const mgr=g.registry.get("saveManager"); const s=mgr.getSave();
    s.inventory.items=s.inventory.items||[]; s.inventory.equipped=s.inventory.equipped||{};
    s.hero=s.hero||{}; s.hero.level=Math.max(s.hero.level||1,80); // before equip (req-level gate)
    const out={};
    for(const [slot,defId] of Object.entries(want)){
      const iid="rig-"+slot;
      s.inventory.items.push({id:iid, defId, level:1, rolledPrimaryAffix:0, rolledAffixes:[]});
      out[slot]=mgr.equipItem(iid) ? defId : (defId+"!FAIL");
    }
    if(mgr.flush) mgr.flush();
    return JSON.stringify(s.inventory.equipped);`);
  console.log("equipped:", equipped);

  // Start a battle and let the hero spawn + sync equipment.
  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("BattleScene"); return "battle";`);
  await wait(3000);

  // Zoom the hero: park it centre-stage, scale up, sync gear, pose, screenshot.
  const pose = async (mode, name) => {
    await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
      const h=bs&&bs.heroSprite; if(!h) return "no-hero";
      const cam=bs.cameras.main;
      h.scaleToHeight(220);
      const wx=cam.midPoint.x, wy=cam.midPoint.y;
      h.setPosition(wx, wy);
      if(bs.saveManager) h.syncEquipment(bs.saveManager.getSave().inventory);
      const now=g.loop.now;
      if("${mode}"==="walk"){ h.tick(now, true, false); }
      else if("${mode}"==="attack"){ h.tick(now, false, false); h.playAttack(); }
      else { h.tick(now, false, false); }
      return "posed";`);
    await wait(mode === "attack" ? 120 : 60);
    await shoot(name);
  };
  await pose("idle", "skel_1_idle");
  await pose("walk", "skel_2_walk");
  await pose("attack", "skel_3_attack");

  const info = await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
    const h=bs&&bs.heroSprite;
    return JSON.stringify({hasHero:!!h, weaponVisible:h?h.getBodySprite&&true:null,
      wornGearVisible:h?h.wornGearVisible:null});`);
  console.log("hero:", info);

  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
