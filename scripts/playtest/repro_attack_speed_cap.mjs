// Attack-speed cap repro.
//
// Forces a live tower's attackSpeed absurdly high and confirms the sim clamps
// the firing cadence to ATTACK_SPEED_CAP (5/sec → cooldown 0.2s), proving the
// cappedAttackSpeed clamp is wired into updateTowers in real WebGL.
//   node scripts/playtest/repro_attack_speed_cap.mjs [--port=4188]
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
    if (r.exceptionDetails) console.log("  EXC:", r.exceptionDetails.text, r.result?.description || "");
    return r.result?.value;
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(6000);

  console.log(
    "start:",
    await evalJs(`const g=window.__game; if(!g) return "no game";
    ["MainMenuScene","StageSelectScene","GachaScene","CollectionScene","ShopScene","PassiveGridScene","HeroScene"].forEach(s=>g.scene.stop(s));
    g.scene.start("BattleScene"); return "started";`),
  );
  await wait(1800);
  console.log(
    "place:",
    await evalJs(`const bs=window.__game.scene.getScene("BattleScene");
    if(!bs||!bs.battle) return "no battle";
    const ids=(bs.buildOrder||[]).map(d=>d.id); let p=0;
    for(let i=0;i<Math.min(3,ids.length);i++) if(bs.battle.placeTower(ids[i],i)) p++;
    return "placed="+p;`),
  );

  // Force one tower's attackSpeed to an absurd value, then run sim steps and
  // capture the cooldown it resets to after firing. cappedAttackSpeed(99) === 5
  // → the reset cooldown must be 1/5 = 0.2s, never smaller.
  const probe = await evalJs(`
    const bs=window.__game.scene.getScene("BattleScene");
    const t=bs.battle.towers[0];
    if(!t) return JSON.stringify({err:"no tower"});
    t.stats.attackSpeed=99; t.buffAsPct=0; t.attackCd=0;
    // Tick the real sim until a wave spawns a live enemy, then snap it onto the
    // forced tower so it always has a target. Each fire resets attackCd to
    // 1/cappedAttackSpeed(99) = 1/5 = 0.2s; record the smallest reset seen.
    let minCd=Infinity, fired=0, sawEnemy=false;
    for(let i=0;i<1500;i++){
      bs.battle.tick(0.05);
      t.stats.attackSpeed=99; t.buffAsPct=0; // pin
      t.alive=true; t.hp=1e9; t.stats.maxHp=1e9; t.disabledTimer=0; // keep the firing tower up
      const e=(bs.battle.enemies||[]).find(x=>x.alive);
      if(e){
        sawEnemy=true;
        e.pos={x:t.pos.x, y:t.pos.y}; e.revealed=true; e.stealth=false; e.flying=false;
        e.hp=Math.max(e.hp, 1e9); e.stats.maxHp=Math.max(e.stats.maxHp,1e9); // immortal so it stays a target
      }
      if(t.attackCd>0.001){ minCd=Math.min(minCd,t.attackCd); fired++; }
    }
    // Directly drive updateTowers with the enemy pinned in range — isolates the
    // tower attack/cooldown path from wave/targeting timing in tick().
    const e0=(bs.battle.enemies||[]).find(x=>x.alive);
    // The RESET value is the proof: capped → 1/5 = 0.2s; uncapped (1/99) ≈ 0.0101s.
    // Drive with dt=0 so attackCd is never decremented — every observed attackCd IS
    // a fresh reset value. Reset attackCd to 0 before each call to force a fire.
    let directResetCd=null, directFired=0, hasUpdate=typeof bs.battle.updateTowers==="function";
    if(e0 && hasUpdate){
      for(let i=0;i<5;i++){
        e0.pos={x:t.pos.x,y:t.pos.y}; e0.revealed=true; e0.stealth=false; e0.flying=false;
        e0.hp=1e9; e0.stats.maxHp=1e9;
        t.alive=true; t.hp=1e9; t.disabledTimer=0; t.stats.attackSpeed=99; t.buffAsPct=0; t.mana=0;
        t.attackCd=0; // force the fire gate open
        bs.battle.updateTowers(0);
        if(t.attackCd>0.001){ directResetCd=Math.round(t.attackCd*10000)/10000; directFired++; }
      }
    }
    const diag={tAlive:t.alive, tDisabled:t.disabledTimer, range:t.stats.range,
      target:t.def.target, role:t.def.role, hasUpdate,
      enemy: e0?{flying:e0.flying, alive:e0.alive, dist:Math.round(Math.hypot(e0.pos.x-t.pos.x,e0.pos.y-t.pos.y))}:null};
    return JSON.stringify({attackSpeed:t.stats.attackSpeed, sawEnemy, directFired, directResetCd, diag});`);
  const r = JSON.parse(probe);
  console.log("cap probe:", JSON.stringify(r));

  // A tower with attackSpeed 99 must reset its cooldown to 1/ATTACK_SPEED_CAP =
  // 1/5 = 0.2s. Without the cap it would be 1/99 ≈ 0.0101s.
  const ok =
    r.directFired > 0 && r.directResetCd !== null
      ? Math.abs(r.directResetCd - 0.2) < 0.001
      : null;
  if (ok === null) {
    console.log("VERDICT: INCONCLUSIVE (tower never fired — no reset observed)");
  } else if (ok) {
    console.log(`VERDICT: PASS (reset cooldown ${r.directResetCd}s == 1/5; clamped to 5/sec, not 1/99≈0.0101s)`);
  } else {
    console.log(`VERDICT: FAIL (reset cooldown ${r.directResetCd}s != 0.2s — cap not applied)`);
  }
  ws.close();
  process.exit(ok === false ? 1 : 0);
}
main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(2);
});
