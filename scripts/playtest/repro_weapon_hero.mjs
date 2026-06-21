// Per-weapon battle-hero capture. For each WeaponType, equips a catalog weapon of
// that type (+ wings), starts a battle, zooms the hero and screenshots stance +
// attack so the per-weapon art swap and the kept wings overlay can be eyeballed.
//   npx vite --port 4188   then   node scripts/playtest/repro_weapon_hero.mjs
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

  // Find one catalog weapon defId per WeaponType (+ a wing) from the live catalog.
  const picks = await evalJs(`const g=window.__game;
    const mod = await import("/src/data/items.ts");
    const cat = mod.ITEM_CATALOG || mod.ITEMS || [];
    const want=["Sword","Bow","Staff","Gun","Tome","Fist"];
    const out={};
    for(const wt of want){ const it=cat.find(d=>d.slot==="Weapon"&&d.weaponType===wt); if(it) out[wt]=it.id; }
    const wing=cat.find(d=>d.slot==="Wing"); if(wing) out.__wing=wing.id;
    return JSON.stringify(out);`);
  console.log("picks:", picks);
  const map = JSON.parse(picks || "{}");

  // Start a battle once.
  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("BattleScene"); return "battle";`);
  await wait(3000);

  const equipAndPose = async (wt, defId, wingId) => {
    await evalJs(`const g=window.__game; const mgr=g.registry.get("saveManager"); const s=mgr.getSave();
      s.inventory.items=s.inventory.items||[]; s.inventory.equipped=s.inventory.equipped||{};
      s.hero=s.hero||{}; s.hero.level=Math.max(s.hero.level||1,90);
      // weapon
      const wid="probe-weapon"; s.inventory.items=s.inventory.items.filter(i=>i.id!==wid);
      s.inventory.items.push({id:wid, defId:${JSON.stringify(defId)}, level:1, rolledPrimaryAffix:0, rolledAffixes:[]});
      mgr.equipItem(wid);
      ${wingId ? `const gid="probe-wing"; s.inventory.items=s.inventory.items.filter(i=>i.id!==gid); s.inventory.items.push({id:gid, defId:${JSON.stringify(wingId)}, level:1, rolledPrimaryAffix:0, rolledAffixes:[]}); mgr.equipItem(gid);` : ``}
      return "equipped";`);
    const pose = async (mode, name) => {
      await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
        const h=bs&&bs.heroSprite; if(!h) return "no-hero";
        const cam=bs.cameras.main;
        h.scaleToHeight(220);
        h.setPosition(cam.midPoint.x, cam.midPoint.y);
        if(bs.saveManager) h.syncEquipment(bs.saveManager.getSave().inventory);
        const now=g.loop.now;
        if("${mode}"==="walk"){ h.tick(now, true, false); }
        else if("${mode}"==="attack"){ h.tick(now, false, false); h.playAttack(); h.tick(now+150, false, false); }
        else { h.tick(now, false, false); }
        return "posed";`);
      await wait(mode === "attack" ? 120 : 60);
      await shoot(name);
    };
    await pose("idle", `wh_${wt}_idle`);
    await pose("attack", `wh_${wt}_attack`);
  };

  for (const wt of ["Sword", "Bow", "Staff", "Gun", "Tome", "Fist"]) {
    if (!map[wt]) {
      console.log("no weapon for", wt);
      continue;
    }
    await equipAndPose(wt, map[wt], map.__wing);
  }

  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
