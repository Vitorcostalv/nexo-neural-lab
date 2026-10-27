import {test} from 'node:test';import assert from 'node:assert/strict';
import {train,predict,retrieve,graph} from '../browser/learning.js';
test('semantic search thresholds and orders real cosine scores',()=>{assert.deepEqual(retrieve([{id:1,vector:[1,0]},{id:2,vector:[0,1]}],[1,0]).map(m=>m.id),[1]);});
test('graph edges reference nodes and expose coordinates',()=>{const g=graph([{id:1,vector:[1,0]},{id:2,vector:[1,0]}]);assert.equal(g.edges.length,1);assert.equal(g.edges[0].score,1);assert.equal(g.nodes[0].position.length,3);assert.equal(g.nodes[0].vector,undefined);});
test('MLP learns separable classes using unseen validation examples',async()=>{
  const memories=Array.from({length:12},(_,i)=>({label:i<6?'a':'b',vector:i<6?[1,i*.01]:[i*.01,1]}));const model=await train(memories);
  assert.equal(predict(model,[1,0]).label,'a');assert.equal(predict(model,[0,1]).label,'b');assert.equal(model.metadata.validation_accuracy,1);assert.ok(model.metadata.train_samples<12);
  const again=await train(memories);assert.deepEqual(model.layers,again.layers);
});
test('training rejects insufficient category examples',async()=>{await assert.rejects(()=>train([{label:'a',vector:[1,0]}]),/categorias/);});
