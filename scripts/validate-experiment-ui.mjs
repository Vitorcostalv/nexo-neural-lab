// DOM emulation only. This is not a visual/browser/WebGL acceptance test.
// npm install --prefix runtime/nexo-validation jsdom@26.1.0
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mountExperiments} from '../lab-web/experiments.js';
import {demoExperiment} from '../lab-web/browser/demo.js';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'runtime/nexo-validation/package.json'));
const {JSDOM}=require('jsdom');
const baseline=JSON.parse(await readFile(resolve(root,'reports/real-model-validation.json'),'utf8'));
const checks=[];
for(const width of [1440,390]){
  const dom=new JSDOM('<section id="view-experiments"></section>',{url:'http://localhost/'});
  globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;
  Object.defineProperty(dom.window,'innerWidth',{value:width});
  const $=s=>document.querySelector(s),records=[],toasts=[],highlights=[];let operation,observed;
  const runtime={experiments:async()=>structuredClone(records),demonstration:async(config,options)=>{const r=await demoExperiment(config,options);records.unshift(r);return r;},experiment:async(q,c,{onUpdate})=>{
    const r=structuredClone(baseline.experiments[0]);r.status='error';r.conditions.with.status='error';r.conditions.with.error='Erro de inferência injetado no teste DOM';
    r.trace.total=45;r.trace.candidates=Array.from({length:45},(_,i)=>({id:i+1,rank:i+1,score:1-i/50,reason:i<5?'included':'top-k'}));onUpdate(r);return r;
  },evaluate:async()=>baseline.evaluations[0]};
  await mountExperiments({runtime,operation:fn=>{operation=Promise.resolve().then(fn).catch(e=>toasts.push(e.message));return operation;},toast:text=>toasts.push(text),highlight:ids=>{highlights.push(ids);return true;},onRecord:r=>{observed=r;}});
  const change=(selector,value)=>{$(selector).value=value;$(selector).dispatchEvent(new dom.window.Event('change'));};
  const submit=()=>{$('#experiment-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));return operation;};
  change('#experiment-mode','simulation');assert.equal($('#experiment-question').readOnly,true);assert.equal($('#evaluate-retrieval').disabled,true);
  await submit();assert.match($('.experiment-record-mode').textContent,/SIMULAÇÃO/);assert.equal($('.condition-card.with .condition-answer').textContent,'O observatório Aurora fica em Recife. [M1]');assert.ok(observed.graph.nodes.some(n=>n.id===1));
  $('[data-highlight="1"]').click();assert.deepEqual(highlights.at(-1),[1]);
  $('[data-exclude="1"]').checked=true;$('[data-exclude="1"]').dispatchEvent(new dom.window.Event('change'));
  await submit();assert.match($('.condition-card.with .condition-answer').textContent,/Não tenho/);assert.equal(records[0].snapshot.length,8);assert.equal(records.length,2);
  change('#experiment-history',records[1].id);assert.match($('.condition-card.with .condition-answer').textContent,/Recife/);
  const pending=submit();await new Promise(resolve=>setTimeout(resolve,150));assert.equal($('#experiment-cancel').disabled,false);$('#experiment-cancel').click();await pending;assert.equal(records[0].status,'cancelled');assert.equal($('#experiment-cancel').disabled,true);
  change('#experiment-mode','real');await submit();assert.match($('.experiment-error').textContent,/Erro de inferência/);assert.match($('.condition-heading').textContent,/Concluído/);
  assert.equal(document.querySelectorAll('#candidate-table tbody tr').length,20);$('#candidates-next').click();assert.match($('#candidate-page').textContent,/2 \/ 3/);$('#candidates-next').click();assert.equal(document.querySelectorAll('#candidate-table tbody tr').length,5);assert.equal($('#candidates-next').disabled,true);$('#candidates-prev').click();assert.match($('#candidate-page').textContent,/2 \/ 3/);
  $('#evaluate-retrieval').click();await operation;assert.equal($('.evaluation-metrics strong').textContent,'42.1%');
  checks.push({viewportWidth:width,result:'passed',checks:['simulation without inference worker','comparison/exclusion','ranking pagination (synthetic 45-candidate fixture)','snapshot map callbacks','history','cancellation','condition error','real baseline metric rendering'],limitation:'DOM emulation: no CSS layout, WebGL rendering, screenshots or assistive technology.'});
  dom.window.close();
}
const report={schema:'nexo-dom-validation-v1',created:new Date().toISOString(),checks};
await writeFile(resolve(root,'reports/dom-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
