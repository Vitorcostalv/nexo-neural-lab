import test from 'node:test';
import assert from 'node:assert/strict';
import {topology,deformation,curvePoint,activityEnergy,queryLinks,elapsedSeconds} from '../neural-motion.js';

test('the resting network keeps moving without an API request',()=>{
  const base=[1,2,-1];assert.notDeepEqual(deformation(base,1,0),deformation(base,1,2));
  assert.notDeepEqual(deformation(base,1,0,0,true),deformation(base,1,2,0,true));
});
test('requests increase energy and then settle to the resting level',()=>{
  assert.ok(activityEnergy(2,true)>activityEnergy(2,false));
  assert.ok(activityEnergy(2,false,2)>activityEnergy(20,false,2));
  assert.ok(activityEnergy(100,false,2)<.2);
});
test('curved synapses preserve endpoints and remain finite',()=>{
  const a=[-1,0,2],b=[1,1,-2];assert.deepEqual(curvePoint(a,b,0),a);
  curvePoint(a,b,1).forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8));
  for(let i=0;i<100;i++)assert.ok(curvePoint(a,b,i/100,23,1).every(Number.isFinite));
});
test('visual synapses have no self-links or duplicate edges',()=>{
  const {nodes,edges}=topology();assert.equal(nodes.length,112);
  assert.ok(edges.length>112);assert.equal(new Set(edges.map(([a,b])=>[a,b].sort((x,y)=>x-y).join(':'))).size,edges.length);
  edges.forEach(([a,b])=>{assert.notEqual(a,b);assert.ok(a<nodes.length&&b<nodes.length);});
});
test('each message creates a deterministic different flow',()=>{
  assert.deepEqual(queryLinks(112,2),queryLinks(112,2));assert.notDeepEqual(queryLinks(112,2),queryLinks(112,3));
  queryLinks(112,7).forEach(([a,b])=>assert.notEqual(a,b));
});
test('lower frame rate does not slow the animation clock by twelve times',()=>{
  assert.equal(elapsedSeconds(1000,0),1);
  let total=0;for(let i=1;i<=30;i++)total+=elapsedSeconds(i*1000/30,(i-1)*1000/30);
  assert.ok(Math.abs(total-1)<1e-8);
});
