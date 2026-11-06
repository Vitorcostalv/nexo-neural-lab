import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../browser/inference-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,'');
test('worker GPU protocol warms separately, resets context and fixes generation parameters',async()=>{
  const sent=[],requests=[];let resets=0;
  const engine={resetChat:async()=>{resets++;},chat:{completions:{async *create(request){requests.push(request);yield {choices:[{delta:{content:request.max_tokens===1?'':'Recife'}}]};}}}};
  const context=vm.createContext({performance,navigator:{gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}},postMessage:data=>sent.push(data),mockEngine:engine});
  vm.runInContext(source,context);vm.runInContext('engine=mockEngine;',context);
  await context.onmessage({data:{id:1,type:'prepareExperiment',payload:{}}});
  assert.equal(sent.at(-1).result.backend,'webgpu');assert.ok(sent.at(-1).result.warmupMs>=0);assert.equal(sent.filter(m=>m.delta).length,0);
  const messages=[{role:'system',content:'Base'},{role:'user',content:'Onde?'}];
  for(const id of [2,3])await context.onmessage({data:{id,type:'generateDetailed',payload:{messages,parameters:{maxTokens:220,temperature:0,repetitionPenalty:1.1,seed:42}}}});
  assert.equal(resets,3);assert.equal(requests[1].seed,42);assert.equal(requests[1].temperature,0);assert.equal(requests[1].repetition_penalty,1.1);assert.equal(JSON.stringify(requests[1]),JSON.stringify(requests[2]));assert.equal(sent.at(-1).result.answer,'Recife');assert.ok(sent.at(-1).result.firstTokenMs>=0);
});
test('worker CPU protocol records absent seed support and greedy decoding',async()=>{
  const sent=[],requests=[];
  class TextStreamer{constructor(tokenizer,options){this.options=options;}}
  const generator=async(messages,options)=>{requests.push(options);if(options.max_new_tokens>1)options.streamer.options.callback_function('Texto real do mock');};generator.tokenizer={};
  const context=vm.createContext({performance,navigator:{},postMessage:data=>sent.push(data),mockGenerator:generator,mockLibrary:{TextStreamer}});
  vm.runInContext(source,context);vm.runInContext('generator=mockGenerator;transformers=mockLibrary;',context);
  // Supply env to the cached library; this test never downloads any model.
  context.mockLibrary.env={backends:{onnx:{wasm:{}}}};
  await context.onmessage({data:{id:1,type:'prepareExperiment',payload:{}}});assert.equal(sent.at(-1).result.seedSupported,false);assert.equal(sent.at(-1).result.backend,'wasm');
  await context.onmessage({data:{id:2,type:'generateDetailed',payload:{messages:[{role:'user',content:'Oi'}],parameters:{maxTokens:220}}}});
  assert.equal(requests[1].do_sample,false);assert.equal(requests[1].repetition_penalty,1.1);assert.equal(sent.at(-1).result.answer,'Texto real do mock');
});
