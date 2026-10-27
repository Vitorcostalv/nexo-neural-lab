import test from 'node:test';
import assert from 'node:assert/strict';
import {BirthTimeline,birthProgress,connectionProgress,arrivalPosition,interpolatePosition,integrationAnchors,BIRTH_DURATION} from '../neural-birth.js';

test('a new neuron forms, connects and settles at full size',()=>{
  assert.equal(birthProgress(0).scale,0);assert.equal(birthProgress(.2).phase,'forming');
  assert.equal(birthProgress(1.3).phase,'connecting');assert.equal(birthProgress(3).phase,'completing');
  const complete=birthProgress(BIRTH_DURATION);assert.equal(complete.done,true);assert.equal(complete.connect,1);assert.equal(complete.scale,1);
});
test('synapses grow in sequence and reach the neighboring neuron',()=>{
  assert.equal(connectionProgress(.5),0);assert.ok(connectionProgress(1.4,0)>connectionProgress(1.4,2));
  assert.equal(connectionProgress(3.6,2),1);
});
test('queued batch neurons remain invisible before their start',()=>{
  assert.equal(birthProgress(-.5).scale,0);assert.equal(birthProgress(-.5).connect,0);
});
test('a batch is staggered, deduplicated and completes only once',()=>{
  const timeline=new BirthTimeline();timeline.add([1,1,2,3],10);
  assert.equal(timeline.entries.size,3);assert.ok(timeline.entries.get(3)>timeline.entries.get(1));
  timeline.add([1],11);assert.equal(timeline.entries.get(1),10);
  assert.deepEqual(timeline.finish(14),[1,2,3]);assert.deepEqual(timeline.finish(15),[]);
});
test('removing a forming neuron cancels its pending integration',()=>{
  const timeline=new BirthTimeline();timeline.add([1,2],0);timeline.prune([2]);assert.equal(timeline.state(1,1),null);
  assert.deepEqual(timeline.finish(10),[2]);
});
test('the arrival ends exactly at the saved memory position',()=>{
  const target=[1,2,3],start=arrivalPosition(target,7);assert.notDeepEqual(start,target);
  interpolatePosition(start,target,1).forEach((v,i)=>assert.ok(Math.abs(v-target[i])<1e-9));
});
test('even the first memory can integrate into the visual scaffold',()=>{
  const anchors=integrationAnchors([{id:1,position:[0,0,0]}],[[0,1,0],[10,0,0],[1,0,0],[0,0,2]]);
  assert.equal(anchors.length,3);assert.ok(anchors.every(edge=>edge.memory===1));assert.ok(!anchors.some(edge=>edge.visual===1));
});
