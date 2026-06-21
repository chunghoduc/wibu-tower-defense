// Battle-hero worn-wing flap capture. Equips a sword + each battle-art wing, then
// for every wing screenshots the down (glide) and up (raised) flap frames so the
// dedicated per-wing art and the crossfade wing-beat can be eyeballed.
//   npx vite --port 4188   then   node scripts/playtest/repro_wing_flap.mjs
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

  const setup = await evalJs(`const g=window.__game;
    const mod = await import("/src/data/items.ts");
    const cat = mod.ITEM_CATALOG || mod.ITEMS || [];
    const sword=cat.find(d=>d.slot==="Weapon"&&d.weaponType==="Sword");
    const wmod = await import("/src/data/heroWingArt.ts");
    return JSON.stringify({sword: sword?sword.id:null, wings: wmod.BATTLE_WING_IDS});`);
  console.log("setup:", setup);
  const { sword, wings } = JSON.parse(setup || "{}");

  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("BattleScene"); return "battle";`);
  await wait(3000);

  // Find the wing item def id for each battle-wing id (the BATTLE_WING_IDS are item ids).
  for (const wingId of wings) {
    await evalJs(`const g=window.__game; const mgr=g.registry.get("saveManager"); const s=mgr.getSave();
      s.inventory.items=s.inventory.items||[]; s.inventory.equipped=s.inventory.equipped||{};
      s.hero=s.hero||{}; s.hero.level=Math.max(s.hero.level||1,90);
      const wid="probe-weapon"; s.inventory.items=s.inventory.items.filter(i=>i.id!==wid);
      s.inventory.items.push({id:wid, defId:${JSON.stringify(sword)}, level:1, rolledPrimaryAffix:0, rolledAffixes:[]});
      mgr.equipItem(wid);
      const gid="probe-wing"; s.inventory.items=s.inventory.items.filter(i=>i.id!==gid);
      s.inventory.items.push({id:gid, defId:${JSON.stringify(wingId)}, level:1, rolledPrimaryAffix:0, rolledAffixes:[]});
      mgr.equipItem(gid);
      return "equipped";`);
    const frame = async (phaseMs, name) => {
      await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
        const h=bs&&bs.heroSprite; if(!h) return "no-hero";
        const cam=bs.cameras.main;
        h.scaleToHeight(240);
        h.setPosition(cam.midPoint.x, cam.midPoint.y);
        if(bs.saveManager) h.syncEquipment(bs.saveManager.getSave().inventory);
        // drive the flap to a fixed beat phase (period 900ms)
        h.tick(${phaseMs}, false, false);
        return "posed";`);
      await wait(40);
      await shoot(name);
    };
    await frame(0, `flap_${wingId}_down`);
    await frame(450, `flap_${wingId}_up`);
    console.log("captured", wingId);
  }

  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
