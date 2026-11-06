// Optional real CPU validation, PDF extraction/rendering and IndexedDB-contract tests.
// Dependencies are isolated under runtime/nexo-validation (not shipped).
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createReadStream} from 'node:fs';import os from 'node:os';import assert from 'node:assert/strict';
import {previewDocument,extractPdf} from '../lab-web/lab/documents.js';
import {ResearchStore} from '../lab-web/lab/storage.js';import {ResearchService} from '../lab-web/lab/service.js';
import {EMBEDDING,TOKENIZER,hash,exportCsv} from '../lab-web/lab/contracts.js';
import {FIXTURE_DOCUMENTS,ACTIVE_CORPUS,fixtureGroundTruth} from '../lab-web/lab/fixture-corpus.js';
import {retrievalEvaluation} from '../lab-web/lab/chunk-benchmark.js';
import {loadCrossEncoder} from '../lab-web/lab/cross-encoder.js';
import {activeBenchmark,benchmarkPartition,trainRound} from '../lab-web/lab/active.js';
import {ensureArtifact} from './model-download.mjs';import {ARTIFACTS} from './model-artifacts.mjs';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'runtime/nexo-validation/package.json'));
const {IDBFactory}=require('fake-indexeddb'),canvas=require('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
const pdf=await import(pathToFileURL(resolve(root,'lab-web/vendor/pdfjs/pdf.mjs')));
const library=async()=>({...pdf,getDocument:options=>pdf.getDocument({...options,standardFontDataUrl:resolve(root,'lab-web/vendor/pdfjs/standard_fonts')+'/',wasmUrl:resolve(root,'lab-web/vendor/pdfjs/wasm')+'/'})});
const report={schema:'nexo-research-validation-v3',created:new Date().toISOString(),environment:{runtime:'Node.js native CPU',node:process.version,cpu:os.cpus()[0]?.model,threads:os.cpus().length},classification:'documented real execution',limitations:['No browser rendering, native WebGL, accessibility or browser WASM measurements.','IndexedDB tested with fake-indexeddb; real transaction API, not browser quota behavior.','Small fictional corpus; no claims of generalization or causal truth.']};
await mkdir(resolve(root,'reports/research-pdf'),{recursive:true});const output=resolve(root,'reports/research-v3-validation.json');const save=()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
try{
  const extracted=[];report.extraction=[];
  for(const info of FIXTURE_DOCUMENTS){const bytes=await readFile(resolve(root,'lab-web/fixtures/aurora-v3',info.file)),file=new File([bytes],info.file),preview=await previewDocument(file,{pdfExtractor:(bytes,options)=>extractPdf(bytes,{...options,library})});extracted.push({info,file,preview});report.extraction.push({file:info.file,pages:preview.pages,blocks:preview.blocks.length,rawHash:preview.rawHash,warnings:preview.warnings});}
  const empty=await readFile(resolve(root,'lab-web/fixtures/aurora-v3/sem-texto.pdf'));await assert.rejects(()=>extractPdf(new Uint8Array(empty),{library}),/OCR/);await assert.rejects(()=>extractPdf(new Uint8Array([0,1,2]),{library}));
  const pdfBytes=await readFile(resolve(root,'lab-web/fixtures/aurora-v3/operacao.pdf')),pdfTask=(await library()).getDocument({data:new Uint8Array(pdfBytes),isEvalSupported:false,enableXfa:false}),document=await pdfTask.promise;
  for(let p=1;p<=document.numPages;p++){const page=await document.getPage(p),viewport=page.getViewport({scale:1.2}),image=canvas.createCanvas(viewport.width,viewport.height);await page.render({canvasContext:image.getContext('2d'),viewport}).promise;await writeFile(resolve(root,`reports/research-pdf/page-${p}.png`),image.toBuffer('image/png'));}await pdfTask.destroy();
  console.log('Real PDF/MD/TXT extraction and PDF rendering passed.');await save();
  const lib=await import(pathToFileURL(resolve(root,'runtime/nexo-validation/node_modules/@huggingface/transformers/src/transformers.js')));lib.env.allowLocalModels=false;lib.env.cacheDir=resolve(root,'runtime/nexo-validation/model-cache');
  report.modelArtifacts=[await ensureArtifact(lib.env.cacheDir,ARTIFACTS.embedding),await ensureArtifact(lib.env.cacheDir,ARTIFACTS.reranker)];if(process.argv.includes('--generate'))report.modelArtifacts.push(await ensureArtifact(lib.env.cacheDir,ARTIFACTS.generation));
  const progress=p=>{if(p.status==='done')console.log('Model artifact ready:',p.file);};
  const start=performance.now(),extractor=await lib.pipeline('feature-extraction',EMBEDDING.model,{revision:EMBEDDING.revision,dtype:'q8',device:'cpu',progress_callback:progress});
  const tokenizer=await lib.AutoTokenizer.from_pretrained(TOKENIZER.model,{revision:TOKENIZER.revision});report.embedding={...EMBEDDING,loadMs:performance.now()-start};
  const cache=new Map(),embed=async text=>{if(!cache.has(text))cache.set(text,Array.from((await extractor(text,{pooling:'mean',normalize:true})).data));return cache.get(text);},countTokens=async text=>tokenizer.encode(text,{add_special_tokens:false}).length;
  console.log('Loading real multilingual cross-encoder q8 (~118 MB)…');const cross=await loadCrossEncoder(lib,{onProgress:progress}),rerank=(q,rows)=>cross.rank(q,rows);
  let generator,generationMetadata;
  const models=async(type,payload)=>{
    if(type==='embedResearch')return embed(payload);
    if(type==='tokenCount')return countTokens(payload);
    if(type==='activeTrain')return trainRound(payload);
    if(type==='activeBenchmark')return activeBenchmark(payload.corpus,payload.config,()=>{});
    if(type==='prepareExperiment'){
      if(!generator){const start=performance.now();generator=await lib.pipeline('text-generation',TOKENIZER.model,{revision:TOKENIZER.revision,dtype:'q4',device:'cpu',progress_callback:progress});const loaded=performance.now();await generator([{role:'user',content:'Oi'}],{max_new_tokens:1,do_sample:false});generationMetadata={model:TOKENIZER.model,revision:TOKENIZER.revision,backend:'Node native CPU',runtime:'Transformers.js 3.8.1',seedSupported:false,loadMs:loaded-start,warmupMs:performance.now()-loaded};}return generationMetadata;
    }
    if(type==='generateDetailed'){let answer='',first=null;const start=performance.now(),streamer=new lib.TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>{if(text){first??=performance.now();answer+=text;}}});await generator(payload.messages,{max_new_tokens:payload.parameters.maxTokens,do_sample:false,repetition_penalty:1.1,streamer});return {answer:answer.trim(),generationMs:performance.now()-start,firstTokenMs:first==null?null:first-start};}
    throw Error('Unsupported validation action '+type);
  };
  const factory=new IDBFactory(),store=new ResearchStore(factory),service=new ResearchService({store,models,rerank});
  const open=factory.open('nexo-web-v1',1);open.onupgradeneeded=()=>open.result.createObjectStore('state');const legacy=await new Promise((r,j)=>{open.onsuccess=()=>r(open.result);open.onerror=()=>j(open.error);});const old={memories:[{id:1,text:'Legacy memory',vector:[1,0]}],experiments:[{id:'legacy',answer:'Immutable'}],messages:[{text:'Legacy history'}]};
  await new Promise((r,j)=>{const tx=legacy.transaction('state','readwrite');tx.objectStore('state').put(old,'current');tx.oncomplete=r;tx.onerror=j;});
  const families=new Map(),versions=[];
  for(const item of extracted){const created=await service.indexPreview(item.preview,item.file,{documentId:families.get(item.info.family),dates:item.info,vectors:true});families.set(item.info.family,created.version.documentId);versions.push(created.version);}
  await service.updateVersion(versions[0].id,{supersededBy:versions[1].id});const catalog=await store.catalog(),stableVersions=catalog.versions,queries=fixtureGroundTruth(stableVersions);
  assert.equal((await service.indexPreview(extracted[0].preview,extracted[0].file)).duplicate,true);
  const before=await hash(await store.catalog()),controller=new AbortController();controller.abort();await assert.rejects(async()=>service.indexPreview(await previewDocument(new File(['Interrupted doc.'],'interrupted.txt')),new File(['Interrupted doc.'],'interrupted.txt'),{signal:controller.signal}));assert.equal(await hash(await store.catalog()),before);
  const outdated=(await store.catalog()).revision;await service.updateVersion(versions[0].id,{validTo:'2026-06-30'});await assert.rejects(()=>store.commit(outdated,current=>current),/outra aba/);
  const legacyRead=legacy.transaction('state').objectStore('state').get('current');assert.deepEqual(await new Promise(r=>{legacyRead.onsuccess=()=>r(legacyRead.result);}),old);report.storage={legacyPreserved:true,deduplicated:true,cancelledImportInactive:true,concurrentRevisionRejected:true};
  console.log('IndexedDB transactions, legacy preservation, dedup and cancellation passed.');
  report.evaluation=await retrievalEvaluation({versions:stableVersions,queries,embedding:EMBEDDING,tokenizer:TOKENIZER,rerank:false},{embed,countTokens});await save();
  report.rerankedEvaluation=await retrievalEvaluation({versions:stableVersions,queries,embedding:EMBEDDING,tokenizer:TOKENIZER,rerank:true},{embed,countTokens,rerank});await save();console.log('Real retrieval evaluation, before/after reranking, complete.');
  report.chunking=await service.benchmarkChunks({versionIds:versions.map(v=>v.id),configs:[{strategy:'fixed',size:200,overlap:50},{strategy:'paragraphs',size:800,overlap:100},{strategy:'sections',size:1200,overlap:120}],queries,retrieval:{strategy:'hybrid',contextTokens:500,limit:5}});
  assert.ok((await store.catalog()).versions.every(v=>catalog.versions.find(old=>old.id===v.id).activeIndexId===v.activeIndexId));report.storage.experimentalIndicesIsolated=true;
  await writeFile(resolve(root,'reports/research-v3-chunking.csv'),exportCsv(report.chunking.runs.flatMap(run=>run.rows.map(row=>({namespace:run.index.namespace,index:run.index.id,versionIds:run.index.versionIds,chunking:run.index.chunking,embedding:EMBEDDING,tokenizer:TOKENIZER,retrieval:report.chunking.retrieval,question:row.question,split:row.split,evidence:row.evidence,...row.metrics,searchMs:row.searchMs,context:row.trace.context,sources:row.trace.sources})))));await save();console.log('Real chunking benchmark complete.');
  const active=[];for(let i=0;i<ACTIVE_CORPUS.length;i++)active.push({...ACTIVE_CORPUS[i],id:'fixture-'+i,vector:await embed(ACTIVE_CORPUS[i].text)});
  const split=benchmarkPartition(active,42);await service.importExamples([...split.train.map(e=>({...e,split:'train'})),...split.validation.map(e=>({...e,split:'validation'})),...split.test.map(e=>({...e,split:'test'})),...split.pool.map(({label,...e})=>({...e,split:'pool'}))]);
  await service.trainActive();const suggestion=(await service.suggestions({strategy:'margin',limit:1})).items[0],state=await store.active(),entry=state.examples.find(e=>e.id===suggestion.id),oracle=ACTIVE_CORPUS.find(e=>e.group===entry.group);await service.label(entry.id,oracle.label,false,'fixture-oracle');await service.trainActive();report.activeRounds=(await store.active()).rounds;report.annotationCheck={origin:'fixture-oracle',predictedLabelNotUsed:true};assert.deepEqual(report.activeRounds[0].testIds,report.activeRounds[1].testIds);
  report.active=await activeBenchmark(active,{seeds:[11,42,73],budgets:[0,3,6],maxEpochs:60},()=>{});await save();console.log('Real MLP annotation/retraining and multi-seed active-vs-random benchmark complete.');
  if(process.argv.includes('--generate')){report.sourceAnswer=await service.query('Qual é o prazo atual do protocolo AUR-27?',{strategy:'hybrid',asOf:'2026-11-06',rerank:true},{generate:true});await save();console.log('Real source answer:',report.sourceAnswer.answer);}
  report.weights=report.modelArtifacts.map(a=>({file:a.model+'/'+a.revision+'/'+a.file,sha256:a.sha256,bytes:a.bytes}));
  report.finished=new Date().toISOString();await save();console.log('Saved',output);
  if(generator)await generator.dispose();await cross.dispose();await extractor.dispose();
}catch(error){report.error=error.stack||String(error);await save();throw error;}
