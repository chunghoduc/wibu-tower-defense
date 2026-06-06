// Articulated vector chibi character. Draw the SAME character in any pose by
// setting joint angles -> guarantees frame-to-frame consistency. One module
// renders one frame as an SVG <g>; the orchestrator lays frames into a strip.
const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
// angle 0 = straight down(+y); 90 = right(+x); 180 = up; -90 = left
const tip = (p, deg, len) => ({ x: p.x + Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len });

const OUT = "#16131f";
function sh(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const a=(v)=>Math.max(0,Math.min(255,Math.round(v*f)));
  return "#"+((1<<24)|(a(r)<<16)|(a(g)<<8)|a(b)).toString(16).slice(1);
}
// outlined capsule (limb): dark stroke under, colour over
function limb(a, b, w, col) {
  return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${OUT}" stroke-width="${w+3}" stroke-linecap="round"/>`
       + `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
}
const circle = (c, r, col, ow=2) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="${col}" stroke="${OUT}" stroke-width="${ow}"/>`;
const dot = (c, r, col) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" fill="${col}"/>`;

// ---- hair styles (drawn around head centre h, radius hr) ----
function hair(h, hr, style, col) {
  const hi = sh(col, 1.25), lo = sh(col, 0.8);
  const cap = `<path d="M${h.x-hr-1} ${h.y} a ${hr+1} ${hr+2} 0 0 1 ${(hr+1)*2} 0 q ${-(hr+1)} ${-hr*0.9} ${-(hr+1)*2} 0 z" fill="${col}" stroke="${OUT}" stroke-width="2"/>`;
  const spikes = (n, up, jag) => {
    let s=""; for(let i=0;i<=n;i++){const t=i/n; const x=h.x-hr+t*hr*2; const sy=h.y-hr*0.7; const ty=sy-up-(jag?Math.abs(Math.sin(i))*4:0); s+=`<path d="M${x-3} ${sy} L${x} ${ty} L${x+3} ${sy} Z" fill="${i%2?col:lo}" stroke="${OUT}" stroke-width="1.5"/>`;} return s;
  };
  switch(style){
    case "spiky": return cap+spikes(5,10,true);
    case "spikyTall": return cap+spikes(6,18,true);
    case "widowsPeak": return cap+spikes(6,16,true)+`<path d="M${h.x} ${h.y-hr*0.5} l-3 8 l3 4 l3 -4 z" fill="${col}"/>`;
    case "short": return cap+spikes(6,4,false);
    case "bald": return `<path d="M${h.x-hr+2} ${h.y-2} a ${hr-2} ${hr} 0 0 1 ${(hr-2)*2} 0" fill="none" stroke="${sh(col,1)}" stroke-width="0"/>`;
    case "pompadour": return `<path d="M${h.x-hr} ${h.y-hr*0.4} q ${hr} ${-hr*2.2} ${hr*2} 0 z" fill="${col}" stroke="${OUT}" stroke-width="2"/>`+cap;
    case "long": return cap+`<rect x="${h.x-hr-2}" y="${h.y-2}" width="4" height="${hr*2.4}" rx="2" fill="${col}" stroke="${OUT}" stroke-width="1.5"/><rect x="${h.x+hr-2}" y="${h.y-2}" width="4" height="${hr*2.4}" rx="2" fill="${col}" stroke="${OUT}" stroke-width="1.5"/>`;
    case "ponytail": return cap+`<path d="M${h.x+hr-2} ${h.y-hr} q 12 6 6 ${hr*2}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
    case "twin": return cap+`<rect x="${h.x-hr-3}" y="${h.y}" width="5" height="${hr*2}" rx="2.5" fill="${col}" stroke="${OUT}" stroke-width="1.5"/><rect x="${h.x+hr-2}" y="${h.y}" width="5" height="${hr*2}" rx="2.5" fill="${col}" stroke="${OUT}" stroke-width="1.5"/>`;
    case "bowl": return `<path d="M${h.x-hr-1} ${h.y+2} a ${hr+1} ${hr} 0 0 1 ${(hr+1)*2} 0 z" fill="${col}" stroke="${OUT}" stroke-width="2"/>`;
    case "flame": return cap+spikes(6,14,true).replace(new RegExp(col,'g'),col);
    case "mohawk": return `<path d="M${h.x-3} ${h.y-hr*0.6} h6 l-1 -16 h-4 z" fill="${col}" stroke="${OUT}" stroke-width="1.5"/>`+spikes(2,12,true);
    default: return cap+spikes(5,6,true);
  }
}
function headgear(h, hr, spec){
  const g=spec.headgear; if(!g) return "";
  if(g==="bandana"){const c=spec.bandanaColor||"#2f7a3a";return `<rect x="${h.x-hr-1}" y="${h.y-hr*0.5}" width="${(hr+1)*2}" height="6" rx="2" fill="${c}" stroke="${OUT}" stroke-width="1.5"/><path d="M${h.x-hr} ${h.y-hr*0.3} l-6 14" stroke="${c}" stroke-width="3"/>`;}
  if(g==="headband"){const c=spec.bandColor||"#3a4a8a";return `<rect x="${h.x-hr-1}" y="${h.y-hr*0.6}" width="${(hr+1)*2}" height="5" rx="1" fill="${c}" stroke="${OUT}" stroke-width="1.5"/><rect x="${h.x-4}" y="${h.y-hr*0.6}" width="8" height="5" fill="#c0cbd8" stroke="${OUT}" stroke-width="1"/>`;}
  if(g==="witchHat"){const c=spec.hatColor||"#2a2030";return `<path d="M${h.x} ${h.y-hr-22} L${h.x+12} ${h.y-hr+2} L${h.x-12} ${h.y-hr+2} Z" fill="${c}" stroke="${OUT}" stroke-width="2"/><ellipse cx="${h.x}" cy="${h.y-hr+2}" rx="18" ry="5" fill="${c}" stroke="${OUT}" stroke-width="2"/>`;}
  if(g==="hood"){const c=spec.hoodColor||"#3c2f52";return `<path d="M${h.x-hr-2} ${h.y+4} q 0 ${-hr*2} ${hr+2} ${-hr*2} q ${hr+2} 0 ${hr+2} ${hr*2} z" fill="${c}" stroke="${OUT}" stroke-width="2"/>`;}
  if(g==="helm"){const c=spec.helmColor||"#b6c0cf";let s=`<path d="M${h.x-hr-1} ${h.y} a ${hr+1} ${hr+1} 0 0 1 ${(hr+1)*2} 0 z" fill="${c}" stroke="${OUT}" stroke-width="2"/><rect x="${h.x-1}" y="${h.y-hr}" width="3" height="${hr+6}" fill="${sh(c,0.7)}"/>`; if(spec.plume) s+=`<path d="M${h.x-1} ${h.y-hr-12} q 6 6 1 14 z" fill="${spec.plume}" stroke="${OUT}" stroke-width="1"/>`; return s;}
  if(g==="horns"){const c=spec.hornColor||"#e8e2d0";return `<path d="M${h.x-5} ${h.y-hr+2} q -6 -8 -2 -14" stroke="${c}" stroke-width="3" fill="none"/><path d="M${h.x+5} ${h.y-hr+2} q 6 -8 2 -14" stroke="${c}" stroke-width="3" fill="none"/>`;}
  if(g==="halo"){return `<ellipse cx="${h.x}" cy="${h.y-hr-6}" rx="9" ry="3" fill="none" stroke="#ffe98a" stroke-width="2.5"/>`;}
  return "";
}
function weapon(hand, ang, spec){
  const w=spec.weapon; if(!w) return "";
  const t=(d,l)=>tip(hand,ang+d,l);
  if(w==="katana"||w==="broadsword"){const e=t(0,26);return limb(hand,e,3,"#cfd6e2")+limb(hand,t(0,-4),5,spec.hiltColor||"#7a3a2a");}
  if(w==="katana3"){const e=t(0,26),e2=tip(hand,ang+18,24);return limb(hand,e,3,"#cfd6e2")+limb(hand,e2,3,"#cfd6e2");}
  if(w==="staff"){const e=t(0,-30);return limb(hand,e,3,"#8a6a3a")+circle(e,4,spec.orbColor||"#7ad1ff");}
  if(w==="bow"){const e=t(0,-22),e2=t(0,22);return limb(e,e2,3,"#8a5a2a");}
  if(w==="cannon"||w==="gun"){const e=t(90,14);return limb(hand,e,7,"#5a6275")+circle(e,3,spec.orbColor||"#2f6fdb");}
  if(w==="spear"){const e=t(0,-30),tipP=t(0,-34);return limb(hand,e,3,"#8a6a3a")+`<path d="M${tipP.x} ${tipP.y} l-3 6 l6 0 z" fill="#cfd6e2"/>`;}
  if(w==="fan"){let s="";for(let i=-2;i<=2;i++){const e=tip(hand,ang+i*18,12);s+=limb(hand,e,1.5,spec.fanColor||"#d23b3b");}return s;}
  if(w==="fists"&&spec.fistGlow){return circle(hand,5,spec.fistGlow)+dot(hand,2,"#fff3c0");}
  return "";
}

// ---- compose one frame -> svg <g> within a `cell`x`cell` box ----
export function frameSVG(spec, pose, cell=128) {
  const cx = cell/2;
  const bob = pose.bob||0;
  const hip = {x:cx, y:cell*0.66 + bob};
  const neck = {x:cx + (pose.lean||0), y:cell*0.40 + bob};
  const hr = cell*0.13;
  const head = {x:neck.x + (pose.headX||0), y:cell*0.27 + bob};
  const skin = spec.skin||"#f0c49a", out=spec.outfit||"#5a6fb0", sleeve=spec.sleeve||out, pants=spec.pants||"#33405a";
  const shoulderL={x:neck.x-6,y:neck.y+3}, shoulderR={x:neck.x+6,y:neck.y+3};
  const hipL={x:hip.x-5,y:hip.y}, hipR={x:hip.x+5,y:hip.y};
  // arms
  const P=pose;
  const elbL=tip(shoulderL,P.armL[0],cell*0.13), handL=tip(elbL,P.armL[1],cell*0.12);
  const elbR=tip(shoulderR,P.armR[0],cell*0.13), handR=tip(elbR,P.armR[1],cell*0.12);
  const kneeL=tip(hipL,P.legL[0],cell*0.14), footL=tip(kneeL,P.legL[1],cell*0.14);
  const kneeR=tip(hipR,P.legR[0],cell*0.14), footR=tip(kneeR,P.legR[1],cell*0.14);
  const armW=cell*0.072, legW=cell*0.092;

  let s = "";
  // back items
  if(spec.back==="cape") s+=`<path d="M${neck.x-9} ${neck.y} l-4 ${cell*0.35} h26 l-4 ${-cell*0.35} z" fill="${spec.capeColor||'#c0392b'}" stroke="${OUT}" stroke-width="2"/>`;
  if(spec.back==="gourd") s+=circle({x:neck.x+10,y:hip.y-6},7,"#c8a06a");
  if(spec.back==="tails"){for(const dx of [-10,10,-5,5]) s+=`<path d="M${hip.x+dx} ${hip.y-4} q ${dx} 14 0 22" stroke="${spec.tailColor||'#e8902a'}" stroke-width="4" fill="none" stroke-linecap="round"/>`;}
  if(spec.back==="wings"){for(const sgn of [-1,1])for(let i=0;i<3;i++) s+=`<ellipse cx="${neck.x+sgn*(8+i*4)}" cy="${neck.y+4+i*4}" rx="4" ry="8" fill="${sh(spec.wingColor||'#e8eef7',1-i*0.08)}" stroke="${OUT}" stroke-width="1"/>`;}
  if(spec.back==="banner") s+=limb({x:neck.x+10,y:hip.y+6},{x:neck.x+10,y:neck.y-22},2.5,"#7a5a32")+`<path d="M${neck.x+11} ${neck.y-20} h14 l-4 7 l4 7 h-14 z" fill="${spec.bannerColor||'#e8b04a'}" stroke="${OUT}" stroke-width="1.5"/>`;
  // back arm + back leg (left = far)
  s += limb(shoulderL,elbL,armW,sleeve)+limb(elbL,handL,armW,skin)+dot(handL,armW*0.7,skin);
  s += limb(hipL,kneeL,legW,pants)+limb(kneeL,footL,legW,pants)+`<ellipse cx="${footL.x}" cy="${footL.y+2}" rx="5" ry="3" fill="${spec.boots||'#2a2030'}" stroke="${OUT}" stroke-width="1.5"/>`;
  // torso (clean rounded trapezoid shoulders->hips)
  s += `<path d="M${neck.x-9} ${neck.y+1} q 9 -5 18 0 L${hip.x+8} ${hip.y-1} q -8 5 -16 0 Z" fill="${out}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`;
  s += `<path d="M${neck.x-9} ${neck.y+1} q 9 -5 18 0 l-1 3 q -8 -4 -16 0 z" fill="${sh(out,1.18)}"/>`;
  if(spec.sash) s+=`<rect x="${hip.x-9}" y="${hip.y-8}" width="18" height="4" fill="${spec.sash}"/>`;
  if(spec.outfitStyle==="gi") s+=`<path d="M${neck.x-5} ${neck.y+1} L${hip.x} ${hip.y-10} L${neck.x+5} ${neck.y+1}" fill="none" stroke="#fff" stroke-width="2"/>`;
  if(spec.emblem) s+=dot({x:hip.x,y:(neck.y+hip.y)/2},2.5,spec.emblem);
  // front leg + front arm
  s += limb(hipR,kneeR,legW,pants)+limb(kneeR,footR,legW,pants)+`<ellipse cx="${footR.x}" cy="${footR.y+2}" rx="5" ry="3" fill="${spec.boots||'#2a2030'}" stroke="${OUT}" stroke-width="1.5"/>`;
  // head
  s += circle(head,hr,skin,2);
  s += hair(head,hr,spec.hair,spec.hairColor||"#2a1d14");
  s += headgear(head,hr,spec);
  // face
  if(spec.blindfold) s+=`<rect x="${head.x-hr*0.8}" y="${head.y-2}" width="${hr*1.6}" height="4" rx="2" fill="#e8eef0" stroke="${OUT}" stroke-width="1"/>`;
  else { const ey=head.y; s+=dot({x:head.x-4,y:ey},1.6,spec.eye||"#1b1b26")+dot({x:head.x+4,y:ey},1.6,spec.eye||"#1b1b26");
    if(spec.faceMark){s+=dot({x:head.x-hr*0.7,y:ey+1},1.2,spec.faceMark)+dot({x:head.x+hr*0.7,y:ey+1},1.2,spec.faceMark);}
    if(spec.scar) s+=`<path d="M${head.x-5} ${ey-4} l0 7" stroke="#9a5a4a" stroke-width="1.2"/>`;
  }
  // front arm + weapon
  s += limb(shoulderR,elbR,armW,sleeve)+limb(elbR,handR,armW,skin)+dot(handR,armW*0.7,skin);
  s += weapon(handR, P.armR[1], spec);
  // aura
  if(spec.rarity==="Unique"||spec.rarity==="Legendary"){const c=spec.rarity==="Unique"?"#ff6b5a":"#ffc24d"; for(const [dx,dy] of [[-cell*0.4,-cell*0.3],[cell*0.4,-cell*0.28],[cell*0.42,cell*0.3]]) s+=`<path d="M${cx+dx} ${cell*0.5+dy} l3 3 l-3 3 l-3 -3 z" fill="${c}"/>`;}
  return `<g>${s}</g>`;
}
