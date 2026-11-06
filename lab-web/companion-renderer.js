import {mix} from './companion-rig.js?v=1.4.1';
const n=x=>Number(x.toFixed(3)),xy=p=>`${n(p[0])} ${n(p[1])}`;
export function bindCompanion(svg){
  const cache=new Map(),node=s=>{if(!cache.has(s))cache.set(s,svg.querySelector(s));return cache.get(s);};
  const attr=(s,k,v)=>{const el=node(s),value=String(v);if(el&&el.getAttribute(k)!==value)el.setAttribute(k,value);};
  const path=(s,d)=>attr(s,'d',d),opacity=(s,a)=>attr(s,'opacity',n(a));
  function limb(side,pose,handAngle,isLeg=false){
    const origin=`translate(${xy(pose.origin)}) rotate(${n(pose.angle)})`,lower=`translate(${pose.upper} 0) rotate(${n(pose.relative)})`;
    if(isLeg){path(`[data-thigh-shadow="${side}"]`,`m8 9 ${n(Math.max(0,pose.upper-14))}-1`);path(`[data-thigh-shape="${side}"]`,`M0-13Q${n(pose.upper*.5)}-13 ${n(pose.upper)}-10L${n(pose.upper)} 11Q${n(pose.upper*.5)} 15 0 13Z`);attr(`[data-thigh="${side}"]`,'transform',origin);attr(`[data-shin="${side}"]`,'transform',lower);attr(`[data-foot="${side}"]`,'transform',`translate(${pose.lower} 0) rotate(${n(-pose.endAngle)})`);}
    else{attr(`[data-upper="${side}"]`,'transform',origin);attr(`[data-arm-chain="${side}"]`,'transform',origin);attr(`[data-lower="${side}"]`,'transform',lower);attr(`[data-hand="${side}"]`,'transform',`translate(${pose.lower} 0) rotate(${n(handAngle-pose.endAngle)})`);}
  }
  return frame=>{
    const f=frame,p=f.params,[nx,ny]=f.neck,[lx,sy]=f.shoulderL,[rx]=f.shoulderR,hip=f.pelvis[1];
    attr('[data-actor]','transform',`translate(${n(f.x)} 0) scale(${f.facing} 1)`);attr('[data-shadow]','cx',n(f.x));
    attr('[data-pelvis]','transform',`translate(${n(f.pelvis[0])} ${n(hip)})`);
    path('[data-hair-back]',`M${n(nx-33)} ${n(ny-79)}Q${n(nx-49)} ${n(ny-115)} ${nx} ${n(ny-113)}Q${n(nx+43)} ${n(ny-111)} ${n(nx+37)} ${n(ny+11)}L${n(nx-34)} ${n(ny+13)}Z`);
    path('[data-torso]',`M${n(lx)} ${n(sy-8)}Q${nx} ${n(ny-6)} ${n(rx)} ${n(sy-8)}L${n(34-12*f.profile)} ${n(hip+8)}Q0 ${n(hip+16)} ${n(-35+12*f.profile)} ${n(hip+8)}Z`);
    path('[data-shirt]',`M${n(nx-12)} ${n(ny+1)}L${n(nx+12)} ${n(ny+1)} 15 ${n(hip+9)}-15 ${n(hip+9)}Z`);
    path('[data-jacket-shade]',`M${n(rx-4)} ${n(sy)}L${n(34-12*f.profile)} ${n(hip+8)} 22 ${n(hip+11)} 19 ${n(sy+6)}Z`);
    path('[data-lapel]',`M${n(nx-13)} ${n(ny+2)} ${n(lx+12)} ${n(sy+15)} ${n(lx+21)} ${n(sy+20)} ${n(lx+13)} ${n(sy+37)}M${n(nx+13)} ${n(ny+2)} ${n(rx-10)} ${n(sy+15)} ${n(rx-18)} ${n(sy+21)}`);
    path('[data-neck]',`M${n(nx-8)} ${n(ny-21)}L${n(nx+9)} ${n(ny-21)} ${n(nx+10)} ${n(ny+1)}Q${nx} ${n(ny+11)} ${n(nx-9)} ${n(ny+1)}Z`);
    limb('left',f.legL,0,true);limb('right',f.legR,0,true);limb('left',f.left,f.handL);limb('right',f.right,f.handR);
    const shade=(a,b)=>`rgb(${a.map((c,i)=>Math.round(mix(c,b[i],f.profile))).join(',')})`;attr('[data-upper=left] > path','fill',shade([99,158,133],[66,113,95]));attr('[data-upper=left] > circle','fill',shade([99,158,133],[66,113,95]));attr('[data-lower=left] > path','fill',shade([114,172,146],[79,124,104]));
    for(const side of ['left','right']){opacity(`[data-front-shoe="${side}"]`,1-f.profile);opacity(`[data-side-shoe="${side}"]`,f.profile);}
    attr('[data-head]','transform',`translate(${xy(f.headOrigin)}) rotate(${n(f.headAngle)})`);const turn=f.profile,pt=(a,b)=>a.map((v,i)=>n(mix(v,b[i],turn))).join(' ');
    path('[data-face-skin]',`M${pt([-31,-82],[-20,-86])}C${pt([-27,-108,12,-111,30,-89],[-12,-106,20,-109,29,-89])}C${pt([34,-79,33,-63,31,-55],[31,-83,28,-68,31,-62])}L${pt([31,-51],[39,-54])}C${pt([31,-50,31,-49,31,-48],[39,-50,31,-49,30,-48])}C${pt([29,-31,16,-19,0,-15],[32,-35,20,-18,-2,-20])}C${pt([-18,-19,-29,-33,-31,-48],[-12,-23,-18,-32,-20,-48])}Z`);
    path('[data-face-hair]',`M${pt([-34,-55],[-28,-43])}Q${pt([-45,-104,-8,-113],[-42,-96,-11,-112])}Q${pt([29,-121,42,-91],[24,-122,38,-94])}L${pt([37,-53,28,-79,24,-91],[27,-73,19,-87,16,-93])}Q${pt([5,-77,-22,-81],[3,-74,-17,-72])}L${pt([-29,-53],[-17,-35])}Z`);
    opacity('[data-ear-left]',1-turn);attr('[data-ear-right]','cx',n(31-39*turn));opacity('[data-eye-left]',1-turn);opacity('[data-brow-left]',1-turn);opacity('[data-cheek-left]',.23*(1-turn));opacity('[data-nose]',1-turn);
    attr('[data-eye-left]','transform',`translate(${n(8*turn)} 0)`);attr('[data-eye-right]','transform',`translate(${n(7*turn)} 0)`);attr('[data-brow-right]','transform',`translate(${n(7*turn)} 0)`);
    for(const side of ['left','right'])attr(`[data-pupil-${side}]`,'transform',`translate(${xy(f.gaze)})`);
    opacity('[data-eyes]',1-f.blink);opacity('[data-lid-left]',f.blink*(1-turn));opacity('[data-lid-right]',f.blink);attr('[data-lid-right]','transform',`translate(${n(7*turn)} 0)`);attr('[data-mouth-open]','cx',n(1+22*turn));
    attr('[data-hair-tip]','transform',`rotate(${n(f.hairAngle)} 0 -50)`);
    path('[data-brow-left]',`M-23 ${n(-69-3*f.confused)}Q-15 ${n(-73-2*f.confused)}-7-69`);path('[data-brow-right]',`M8-69Q17 ${n(-73+3*f.confused)} 24 ${n(-68+2*f.confused)}`);
    path('[data-mouth]',`M${n(mix(-7,19,turn))}-34Q${n(24*turn)} ${n(-29+3*f.smile-4*f.confused)} ${n(mix(8,28,turn))}-34`);opacity('[data-mouth-open]',f.speaking?1:0);opacity('[data-mouth]',f.speaking?0:1);
    opacity('[data-chair]',Math.min(1,p.sit*2.5));opacity('[data-desk]',f.deskAlpha);opacity('[data-laptop]',f.laptopAlpha);opacity('[data-book]',f.bookAlpha);opacity('[data-confusion]',f.confused*.65);
    // The hinge stays on the desk. Opening the lid never scales the character/face.
    opacity('[data-screen-content]',Math.max(0,(f.laptopAlpha-.65)/.35));const top=281-57*f.laptopAlpha;path('[data-screen] > path',`M-52 ${n(top)}H52L57 281H-57Z`);
    const width=48*(1-.7*f.page);path('[data-page]',`M0 280Q${n(width*.5)} ${n(270-4*f.page)} ${n(width)} 278L${n(width*.98)} 307Q${n(width*.5)} 301 0 312Z`);
    path('[data-fingers="left"]',`m7-2 6 ${n(1+f.fingerL)}m-7 2 6 0m-7 2 4 0`);path('[data-fingers="right"]',`m7-2 6 ${n(1+f.fingerR)}m-7 2 6 0m-7 2 4 0`);
  };
}
