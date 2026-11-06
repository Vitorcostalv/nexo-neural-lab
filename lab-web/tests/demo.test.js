import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoExperiment} from '../browser/demo.js';
import {experimentMap} from '../experiment-map.js';
test('download-free demo labels artificial vectors, scripts responses and keeps model timings absent',async()=>{
  const record=await demoExperiment({limit:5,threshold:.4});assert.equal(record.mode,'simulation');assert.equal(record.status,'completed');assert.equal(record.runtime.backend,'simulation');assert.equal(record.conditions.with.generationMs,null);assert.equal(record.conditions.with.firstTokenMs,null);assert.match(record.conditions.with.answer,/Recife/);assert.deepEqual(record.parameters,{});assert.ok(record.graph.nodes.some(m=>m.id===1));assert.ok(record.snapshot.every(m=>!m.vector));
  const excluded=await demoExperiment({excludedIds:[1]});assert.match(excluded.conditions.with.answer,/Não tenho/);assert.equal(excluded.snapshot.length,8);assert.equal(excluded.trace.sources.length,0);
});
test('demo cancellation prevents the second condition and preserves cancelled status',async()=>{
  const controller=new AbortController();const result=await demoExperiment({}, {signal:controller.signal,onUpdate:r=>{if(r.conditions.without.answer)controller.abort();}});assert.equal(result.status,'cancelled');assert.equal(result.conditions.with.status,'cancelled');assert.equal(result.conditions.with.sources.length,0);
});
test('experiment map keeps older selected sources inside the 180-node budget without vector exposure',()=>{
  const memories=Array.from({length:5000},(_,i)=>({id:i+1,text:`M${i+1}`,vector:[1,0]}));const map=experimentMap(memories,[1,2]);assert.equal(map.nodes.length,180);assert.ok(map.nodes.some(n=>n.id===1));assert.ok(map.nodes.some(n=>n.id===2));assert.ok(map.nodes.every(n=>!n.vector));
});
