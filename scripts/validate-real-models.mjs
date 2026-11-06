// Optional local validation; never part of the deployed client or CI.
// npm install --prefix runtime/nexo-validation @huggingface/transformers@3.8.1
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {CORPUS,QUERIES,metrics} from '../lab-web/browser/evaluation.js';
import {searchTrace} from '../lab-web/browser/retrieval.js';
import {createExperiment,runExperiment,messagesFor} from '../lab-web/browser/experiment-core.js';
const root=resolve(import.meta.dirname,'..');
const {pipeline,env,TextStreamer}=await import(pathToFileURL(resolve(root,'runtime/nexo-validation/node_modules/@huggingface/transformers/src/transformers.js')));
env.allowLocalModels=false;env.cacheDir=resolve(root,'runtime/nexo-validation/model-cache');
const report={schema:'nexo-real-model-validation-v1',created:new Date().toISOString(),environment:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,threads:os.cpus().length,backend:'ONNX Runtime native CPU / Node.js',runtime:env.version},limitation:'Real model weights in Node.js native CPU. Does not validate browser WASM, WebGPU, rendering or browser storage.'};
const progress=p=>{if(p.status==='done')console.log('Artifact ready (download or cache):',p.file);};
const output=resolve(root,'reports/real-model-validation.json');
async function save(){await mkdir(resolve(root,'reports'),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
async function weightManifest(directory=env.cacheDir){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())files.push(...await weightManifest(path));
    else if(entry.name.endsWith('.onnx')){const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}files.push({artifact:path.slice(env.cacheDir.length+1).replaceAll('\\','/'),bytes,sha256:hash.digest('hex')});}
  }
  return files;
}
try{
  console.log('Loading real MiniLM q8…');const started=performance.now();
  const extractor=await pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{dtype:'q8',device:'cpu',progress_callback:progress});
  report.embedding={model:'Xenova/paraphrase-multilingual-MiniLM-L12-v2',dtype:'q8',loadMs:performance.now()-started};
  const embed=async text=>Array.from((await extractor(text,{pooling:'mean',normalize:true})).data);
  const corpus=[];for(const m of CORPUS)corpus.push({...m,dimension:384,vector:await embed(m.text)});
  const queries=[];for(const q of QUERIES)queries.push({...q,vector:await embed(q.text)});
  report.embedding.vectorHash=createHash('sha256').update(JSON.stringify(corpus.map(m=>m.vector))).digest('hex');
  report.evaluations=[];
  for(const config of [{limit:5,threshold:.4},{limit:1,threshold:.4},{limit:5,threshold:.7}]){
    const rows=queries.map(({vector,...q})=>{const trace=searchTrace(corpus,vector,config);return {...q,retrieved:trace.sources.map(m=>m.id),trace};});
    report.evaluations.push({fixture:'aurora-v1',config,metrics:metrics(rows),rows});
  }
  await save();console.log('Real retrieval metrics:',JSON.stringify(report.evaluations.map(e=>({config:e.config,metrics:e.metrics}))));
  if(!process.argv.includes('--retrieval-only')){
    console.log('Loading real Qwen2.5 0.5B q4…');const loadStarted=performance.now();
    const generator=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{dtype:'q4',device:'cpu',progress_callback:progress});
    const loadMs=performance.now()-loadStarted,warmStarted=performance.now();
    await generator([{role:'user',content:'Oi'}],{max_new_tokens:1,do_sample:false});
    const warmupMs=performance.now()-warmStarted;
    report.experiments=[];
    for(const excludedIds of [[],[1]]){
      const record=createExperiment(corpus,QUERIES[0].text,{limit:5,threshold:.4,excludedIds});
      record.mode='real';record.embeddingModel=report.embedding.model;
      await runExperiment(record,{embed,prepare:async()=>({model:'onnx-community/Qwen2.5-0.5B-Instruct (q4)',backend:'node-native-cpu',runtime:'Transformers.js '+env.version,seedSupported:false,seedNote:'Greedy decoding; no seed API used.',loadMs,warmupMs}),generate:async(messages,parameters,onDelta)=>{
        const start=performance.now();let answer='',first=null;
        const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>{if(text){first??=performance.now();answer+=text;onDelta(text);}}});
        await generator(messages,{max_new_tokens:parameters.maxTokens,do_sample:false,repetition_penalty:parameters.repetitionPenalty,streamer});
        return {answer:answer.trim(),generationMs:performance.now()-start,firstTokenMs:first===null?null:first-start};
      }});
      record.snapshotHash=createHash('sha256').update(JSON.stringify(record.snapshot)).digest('hex');record.snapshot=record.snapshot.map(({vector,...m})=>m);
      assert.deepEqual(record.conditions.without.messages,messagesFor(record.question));
      assert.deepEqual(record.conditions.with.messages,messagesFor(record.question,record.trace.context));
      assert.ok(record.conditions.with.sources.every(m=>!excludedIds.includes(m.id)));
      record.validation={withoutContextEmpty:true,contextMatchesTrace:true,excludedIdsNotSupplied:true,noConversationHistory:true};
      report.experiments.push(record);await save();console.log('Real pair:',JSON.stringify({excludedIds,status:record.status,without:record.conditions.without.answer,with:record.conditions.with.answer,sources:record.conditions.with.sources.map(m=>m.id)}));
    }
    await generator.dispose();
  }
  await extractor.dispose();report.weights=await weightManifest();report.corpus=CORPUS;report.finished=new Date().toISOString();await save();console.log('Saved:',output);
}catch(error){report.error=error.stack||String(error);await save();throw error;}
