// Battle-hero animation-frame capture. For each weapon archetype, equips a catalog
// weapon of that type, then drives every animation state (idle/walk/attack/hurt/cast)
// through several phase points and screenshots each so the dedicated per-state drawn
// frames can be eyeballed (do the frames actually differ and stay on-model?).
//   npx vite --port 4188   then   node scripts/playtest/repro_hero_anim.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const DIR = arg("dir", "/tmp/heroanim");
mkdirSync(DIR, { recursive: true });
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

  // One catalog weapon defId per WeaponType.
  const picks = await evalJs(`const g=window.__game;
    const mod = await import("/src/data/items.ts");
    const cat = mod.ITEM_CATALOG || mod.ITEMS || [];
    const want=["Sword","Bow","Staff","Gun","Tome","Fist"];
    const out={};
    for(const wt of want){ const it=cat.find(d=>d.slot==="Weapon"&&d.weaponType===wt); if(it) out[wt]=it.id; }
    return JSON.stringify(out);`);
  console.log("picks:", picks);
  const map = JSON.parse(picks || "{}");

  await evalJs(`const g=window.__game;
    g.scene.getScenes(true).forEach(sc=>g.scene.stop(sc.scene.key));
    g.scene.start("BattleScene"); return "battle";`);
  await wait(3000);

  // State → list of phase points (0..1) to capture. Looping states sampled across
  // the cycle; one-shots sampled wind-up → apex → follow-through.
  const STATES = {
    idle: [0.0],
    walk: [0.0, 0.25, 0.5, 0.75],
    attack: [0.1, 0.4, 0.65, 0.9],
    hurt: [0.1, 0.7],
    cast: [0.1, 0.4, 0.65, 0.9],
  };

  for (const wt of ["Sword", "Bow", "Staff", "Gun", "Tome", "Fist"]) {
    if (!map[wt]) {
      console.log("no weapon for", wt);
      continue;
    }
    await evalJs(`const g=window.__game; const mgr=g.registry.get("saveManager"); const s=mgr.getSave();
      s.inventory.items=s.inventory.items||[]; s.inventory.equipped=s.inventory.equipped||{};
      s.hero=s.hero||{}; s.hero.level=Math.max(s.hero.level||1,90);
      const wid="probe-weapon"; s.inventory.items=s.inventory.items.filter(i=>i.id!==wid);
      s.inventory.items.push({id:wid, defId:${JSON.stringify(map[wt])}, level:1, rolledPrimaryAffix:0, rolledAffixes:[]});
      mgr.equipItem(wid);
      const bs=g.scene.getScene("BattleScene");
      if(bs&&bs.heroSprite&&bs.saveManager) bs.heroSprite.syncEquipment(bs.saveManager.getSave().inventory);
      return "equipped";`);

    for (const [state, phases] of Object.entries(STATES)) {
      for (let k = 0; k < phases.length; k++) {
        const ph = phases[k];
        // Map the requested state+phase onto a tick. For looping states drive the
        // free-run idle/walk; for one-shots begin the one-shot then advance time to
        // the phase fraction of its duration.
        await evalJs(`const g=window.__game; const bs=g.scene.getScene("BattleScene");
          const h=bs&&bs.heroSprite; if(!h) return "no-hero";
          const cam=bs.cameras.main;
          h.scaleToHeight(240);
          h.setPosition(cam.midPoint.x, cam.midPoint.y);
          const DUR={attack:300, cast:460, hurt:260};
          const st=${JSON.stringify(state)}, ph=${ph};
          if(st==="walk"){ h.tick(0,true,false); h.tick(ph*1000/1.4, true, false); }
          else if(st==="idle"){ h.tick(0,false,false); }
          else { const start=1000; h.tick(start,false,false);
                 if(st==="attack") h.playAttack(); else if(st==="cast") h.playCast(); else h.playHurt();
                 h.tick(start + ph*DUR[st], false, false); }
          return "posed";`);
        await wait(40);
        await shoot(`anim_${wt}_${state}_${k}`);
      }
    }
    console.log("captured", wt);
  }

  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
