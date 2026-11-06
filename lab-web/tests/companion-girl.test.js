import {test} from 'node:test';import assert from 'node:assert/strict';
import {POSES,activityPose,girlIllustration} from '../companion-girl.js';
test('human companion maps actual activity to all six requested gestures',()=>{
  assert.equal(activityPose('loading'),'walking');assert.equal(activityPose('generating'),'thinking');assert.equal(activityPose('responding'),'typing');assert.equal(activityPose('retrieving'),'studying');assert.equal(activityPose('training'),'studying');assert.equal(activityPose('done'),'happy');assert.equal(activityPose('error'),'confused');assert.equal(activityPose('cancelled'),'confused');
  for(const state of ['idle','receiving','loading','retrieving','generating','responding','saving','training','done','error','cancelled'])assert.ok(POSES[activityPose(state)]);
});
test('articulated illustration places work props behind hands and preserves independent joints',()=>{
  const svg=girlIllustration();assert.ok(svg.indexOf('class="girl-prop girl-laptop"')<svg.indexOf('class="girl-upper-arm girl-upper-arm-left"'));
  for(const joint of ['girl-forearm-left','girl-forearm-right','girl-hand-left','girl-hand-right','girl-leg-left','girl-leg-right','girl-shin-left','girl-shin-right'])assert.equal(svg.split(joint).length-1,1);
  assert.equal(svg.includes('<script'),false);assert.equal(svg.includes('<image'),false);
});
