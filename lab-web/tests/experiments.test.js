import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchTrace,candidatePage,searchConfig,unitVector} from '../browser/retrieval.js';
import {createExperiment,runExperiment,messagesFor,PARAMETERS} from '../browser/experiment-core.js';
import {metrics,CORPUS,QUERIES} from '../browser/evaluation.js';
const memories=[{id:1,text:'Aurora fica em Recife.',vector:[2,0],dimension:2},{id:2,text:'Brisa fica em Curitiba.',vector:[0,2],dimension:2},{id:3,text:'Aurora usa Python.',vector:[1,0],dimension:2}];
test('retrieval normalizes, preserves defaults and breaks ties by ID without leaking vectors',()=>{
  const trace=searchTrace(memories,[3,0]);assert.deepEqual(trace.sources.map(s=>s.id),[1,3]);assert.equal(trace.config.limit,5);assert.equal(trace.config.threshold,.4);assert.equal(trace.sources[0].score,1);assert.ok(!JSON.stringify(trace).includes('vector'));
});
test('exclusions precede top-k and do not mutate memories',()=>{
  const before=structuredClone(memories),trace=searchTrace(memories,[1,0],{limit:1,excludedIds:[1]});assert.deepEqual(trace.sources.map(m=>m.id),[3]);assert.equal(trace.candidates[0].reason,'excluded');assert.equal(trace.candidates[2].reason,'below-threshold');assert.deepEqual(memories,before);
});
test('retrieval rejects malformed vectors and parameters including empty bases',()=>{
  for(const v of [[0,0],[NaN,0],[Infinity,0],['1',0],[]])assert.throws(()=>unitVector(v));
  assert.throws(()=>searchTrace(memories,[1]));assert.throws(()=>searchTrace([{...memories[0],dimension:3}],[1,0]));
  for(const c of [{limit:0},{limit:1.5},{limit:21},{threshold:NaN},{threshold:2},{excludedIds:['1']},{excludedIds:[0]},{contextChars:0}])assert.throws(()=>searchConfig(c));
  assert.throws(()=>searchTrace([],[]));assert.equal(searchTrace([],[1,0]).total,0);
});
test('audit pages stay bounded for 5000 memories; context matches actual excerpts',()=>{
  const trace=searchTrace(Array.from({length:5000},(_,i)=>({id:i+1,text:'x'.repeat(700),vector:[1,0]})),[1,0],{limit:20,contextChars:100});
  assert.equal(trace.context.length,100);assert.equal(trace.sources[0].truncated,true);assert.equal(trace.counts['context-budget'],4999);assert.equal(candidatePage(trace,249).items.length,20);assert.equal(candidatePage(trace,250).items.length,0);assert.throws(()=>candidatePage(trace,0,100));
});
test('controlled pair uses an immutable snapshot, same parameters and no shared history',async()=>{
  const base=structuredClone(memories),record=createExperiment(base,'Onde fica Aurora?'),events=[],prompts=[];
  base[0].text='Alterado';base[0].vector[0]=0;
  await runExperiment(record,{embed:async()=>[1,0],prepare:async()=>({model:'test-double',seedSupported:true}),generate:async(messages,parameters,delta)=>{
    events.push('start');assert.equal(events.filter(x=>x==='start').length-events.filter(x=>x==='end').length,1);assert.deepEqual(parameters,PARAMETERS);prompts.push(messages);delta('Teste');await Promise.resolve();events.push('end');return {answer:'Teste',generationMs:2,firstTokenMs:1};
  }});
  assert.equal(record.status,'completed');assert.equal(record.snapshot[0].text,memories[0].text);assert.equal(prompts[0].length,2);assert.equal(prompts[1].length,2);assert.deepEqual(prompts[0],messagesFor(record.question));assert.equal(prompts[1][0].content.split('Memórias relevantes:')[0],prompts[0][0].content.split('Memórias relevantes:')[0]);assert.equal(record.conditions.without.sources.length,0);assert.equal(record.conditions.with.sources.length,2);assert.deepEqual(events,['start','end','start','end']);
});
test('cancellation discards late generation and never starts the second condition',async()=>{
  const controller=new AbortController(),record=createExperiment(memories,'Onde?');let calls=0;
  await runExperiment(record,{signal:controller.signal,embed:async()=>[1,0],prepare:async()=>({}),generate:async(m,p,delta)=>{calls++;controller.abort();delta('Resultado tardio');return {answer:'Tardio'};}});
  assert.equal(record.status,'cancelled');assert.equal(calls,1);assert.equal(record.conditions.without.answer,undefined);assert.equal(record.conditions.with.sources.length,0);assert.equal(record.conditions.with.status,'cancelled');
});
test('per-condition errors are preserved and empty retrieval still runs both conditions',async()=>{
  const record=createExperiment([],'Oi');let count=0;
  await runExperiment(record,{embed:async()=>[1,0],prepare:async()=>({}),generate:async()=>{if(!count++)throw Error('simulated');return {answer:'ok'};}});
  assert.equal(record.status,'error');assert.equal(record.conditions.without.error,'simulated');assert.equal(record.conditions.with.status,'completed');assert.deepEqual(record.conditions.with.messages,record.conditions.without.messages);
});
test('metrics use explicit relevance labels and include zero-result queries',()=>{
  const value=metrics([{relevant:[1],retrieved:[2,1]},{relevant:[3],retrieved:[]}]);assert.equal(value.precision,.25);assert.equal(value.recall,.5);assert.equal(value.mrr,.25);assert.equal(value.hitRate,.5);assert.equal(CORPUS.length,8);assert.equal(QUERIES.length,8);assert.ok(QUERIES.every(q=>q.relevant.every(id=>CORPUS.some(m=>m.id===id))));
});
