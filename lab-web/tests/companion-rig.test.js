import {test} from 'node:test';import assert from 'node:assert/strict';
import {CompanionRig,solveLimb,walkingJourney,walkingFoot,GESTURES,TRANSITION_SECONDS} from '../companion-rig.js';
const norm=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function advance(rig,seconds){let f;for(let i=0;i<Math.ceil(seconds*60);i++)f=rig.tick(1/60,i*1000/60);return f;}
test('inverse kinematics closes both rigid segments at the requested contact',()=>{
  for(const side of [-1,1]){const limb=solveLimb([0,0],[65,20],54,48,side);assert.ok(Math.abs(norm(limb.origin,limb.joint)-54)<1e-8);assert.ok(Math.abs(norm(limb.joint,limb.end)-48)<1e-8);assert.ok(limb.error<1e-8);}
  assert.ok(solveLimb([0,0],[1000,0],54,48).error>800);
});
test('typing is seated, supported and maintains fingertip contact across multiple cycles',()=>{
  const r=new CompanionRig();r.setPose('typing',{preview:true});advance(r,1);
  for(let i=0;i<450;i++){const f=r.tick(1/60,i*1000/60);assert.equal(f.params.sit,1);assert.equal(f.deskAlpha,1);assert.equal(f.laptopAlpha,1);assert.ok(norm(f.contacts.left,f.keyboardL)<1);assert.ok(norm(f.contacts.right,f.keyboardR)<1);assert.ok(f.left.error<.001&&f.right.error<.001);assert.equal(f.footL.sole,424);assert.equal(f.footR.sole,424);}
});
test('chin contact follows head pose instead of independently rotating a loose hand',()=>{
  const r=new CompanionRig();r.setPose('thinking');advance(r,1);
  for(let i=0;i<400;i++){const f=r.tick(1/60,i*1000/60);assert.ok(norm(f.contacts.right,f.chin)<.001);assert.ok(f.right.error<.001);}
});
test('walking stance feet are planted, bounded and turn only at zero speed',()=>{
  const planted=new Map();let prior=null,contacts=0;
  for(let i=0;i<3600;i++){
    const j=walkingJourney(i/60);assert.ok(j.x>=137.99&&j.x<=282.01);assert.ok(j.speed>=0&&j.speed<=48.001);
    if(prior&&prior.direction!==j.direction){assert.ok(prior.speed<.01);assert.ok(j.speed<=48/.3/60+.01);assert.ok(prior.profile<.01);for(const offset of [0,.5])assert.ok(Math.abs(walkingFoot(prior,offset).x-walkingFoot(j,offset).x)<.01);}
    for(const offset of [0,.5]){const f=walkingFoot(j,offset);if(f.contact){const key=[offset,j.segment,f.anchor].join(':');if(planted.has(key))assert.ok(Math.abs(f.x-planted.get(key))<1e-8);else planted.set(key,f.x);assert.equal(f.sole,424);contacts++;}else assert.ok(f.sole<424);}
    prior=j;
  }assert.ok(contacts>1000);
});
test('walk and all gestures remain reachable without stretching joints',()=>{
  const r=new CompanionRig();for(const pose of GESTURES){r.setPose(pose,{preview:true});for(let i=0;i<600;i++){const f=r.tick(1/60,i*1000/60);for(const limb of [f.left,f.right,f.legL,f.legR])assert.ok(limb.error<.01,`${pose} reach error ${limb.error}`);}}
});
test('rapid interruptions start from current channels and old gesture clocks keep their phase',()=>{
  const r=new CompanionRig();r.setPose('happy');advance(r,3);const old={...r.params},clock=r.poseClocks.happy;r.setPose('thinking');assert.deepEqual(r.from,old);assert.equal(r.poseClocks.happy,clock);const before=r.sample(0);r.tick(.001,1);assert.ok(norm(before.right.end,r.frame.right.end)<1);
  for(let i=0;i<80;i++){r.setPose(GESTURES[i%GESTURES.length],{preview:true});advance(r,.08);assert.ok(Object.values(r.params).every(Number.isFinite));}r.setPose('idle');advance(r,TRANSITION_SECONDS+.2);assert.equal(r.pose,'idle');assert.ok(Object.values(r.params).every(n=>n===0));
});
test('reduced and off modes suppress gait and blinking; completion stops typing immediately',()=>{
  const r=new CompanionRig();r.setMode('off');r.setPose('typing');const a=r.sample(0),b=r.sample(9000);assert.deepEqual(a,b);assert.equal(a.speaking,false);r.setMode('reduced');r.setPose('walking');const reduced=advance(r,1);assert.equal(reduced.profile,0);assert.equal(reduced.blink,0);
  r.setMode('full');r.setPose('typing');r.pulse(1000);advance(r,.7);assert.equal(r.sample(1100).speaking,true);assert.equal(r.sample(1900).speaking,false);r.setPose('confused');assert.equal(r.sample(1100).speaking,false);
});
