// Integration test with explicit browser/worker doubles. No model quality claims.
import {test} from 'node:test';
import assert from 'node:assert/strict';
test('runtime persists comparisons, preserves conversation/import/export, locks mutations and terminates cancelled workers',async()=>{
  let saved={memories:[],messages:[{role:'user',text:'Histórico que não entra no experimento.'}],nextId:1,model:null};
  const dom={prepend(){},setAttribute(){}};
  globalThis.document={createElement:()=>({...dom}),querySelector:()=>({...dom})};
  globalThis.MutationObserver=class{observe(){}};globalThis.location={origin:'http://localhost'};
  globalThis.indexedDB={open(){const request={result:{transaction(){const tx={objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=structuredClone(saved);r.onsuccess();});return r;},put(value){saved=structuredClone(value);queueMicrotask(()=>tx.oncomplete());}};}};return tx;}}};queueMicrotask(()=>request.onsuccess());return request;}};
  let workers=0,terminated=0,hold=false,late;
  globalThis.Worker=class{
    constructor(){workers++;}
    terminate(){terminated++;}
    postMessage({id,type,payload}){queueMicrotask(()=>{
      const send=data=>this.onmessage({data:{id,...data}});
      if(type==='embed'||type==='embedDetailed'){const vector=Array.from({length:384},(_,i)=>i===0?1:0);send({result:type==='embedDetailed'?{vector,loadMs:0,inferenceMs:1}:vector});}
      else if(type==='prepareExperiment')send({result:{backend:'test-double',model:'mock',seedSupported:false,loadMs:0,warmupMs:0}});
      else if(type==='generateDetailed'){
        if(hold){late=()=>send({result:{answer:'LATE'}});send({delta:'parcial'});return;}
        assert.equal(payload.messages.length,2);assert.ok(!JSON.stringify(payload).includes('Histórico que'));
        send({delta:'Resposta '});send({result:{answer:'Resposta mock',generationMs:2,firstTokenMs:1}});
      }
    });}
  };
  const runtime=await import('../browser/runtime.js');
  const simulated=await runtime.demonstration({excludedIds:[1]});assert.equal(simulated.mode,'simulation');assert.equal(workers,0);assert.equal(saved.memories.length,0);assert.equal(saved.messages.length,1);
  const post=(path,body)=>runtime.request('/api'+path,{method:'POST',body:JSON.stringify(body)});
  assert.equal((await (await post('/import',{items:[{text:'Aurora fica em Recife.'}]})).json()).added,1);
  // add() intentionally invalidates chat, so seed a conversation after import.
  saved.messages=[{role:'user',text:'Histórico que não entra no experimento.'}];
  const first=await runtime.experiment('Onde fica Aurora?',{});
  assert.equal(first.status,'completed');assert.equal(first.conditions.with.sources[0].id,1);assert.equal(first.conditions.without.sources.length,0);
  assert.ok(first.snapshotHash.length===64);assert.ok(!('vector' in first.snapshot[0]));assert.equal(saved.messages.length,1);
  assert.equal((await runtime.experiments()).length,2);assert.equal(saved.memories[0].vector.length,384);
  const excluded=await runtime.experiment('Onde fica Aurora?',{excludedIds:[1]});assert.equal(excluded.conditions.with.sources.length,0);assert.equal(saved.memories.length,1);
  await runtime.request('/api/memories/1',{method:'DELETE'});assert.equal((await runtime.experiments()).find(r=>r.id===first.id).snapshot[0].text,'Aurora fica em Recife.');
  const exported=await (await runtime.request('/api/export')).json();assert.deepEqual(exported.items,[]);
  hold=true;const controller=new AbortController();
  const cancelled=await runtime.experiment('Cancele',{}, {signal:controller.signal,onUpdate:r=>{if(r.conditions.without.answer==='parcial')controller.abort();}});
  assert.equal(cancelled.status,'cancelled');assert.equal(terminated,1);late();
  assert.notEqual((await runtime.experiments())[0].conditions.without.answer,'LATE');
  hold=false;await runtime.experiment('Reinicie',{});assert.equal(workers,2);
  hold=true;const lockedController=new AbortController();let conflict;
  const last=await runtime.experiment('Bloqueio',{}, {signal:lockedController.signal,onUpdate:r=>{if(r.conditions.without.answer==='parcial'){conflict=post('/import',{items:[{text:'Outro'}]});lockedController.abort();}}});
  assert.equal(last.status,'cancelled');assert.equal((await conflict).status,409);
  await assert.rejects(()=>runtime.experiment('Inválido',{limit:0}));
  hold=false;assert.equal((await runtime.experiment('Lock liberado',{})).status,'completed');
});
