import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeText,textBlocks,previewDocument,extractPdf,makeVersion,versionFilter,referenceAudit,sourceMessages} from '../lab/documents.js';
import {chunkConfig,divideBlocks,makeChunks,evidenceCoverage} from '../lab/chunking.js';
import {tokenize,bm25,rrf,candidates,rerankCandidates,selectContext,retrievalConfig} from '../lab/search.js';
import {migrateCatalog,embeddingKey,EMBEDDING,exportCsv} from '../lab/contracts.js';
import {selectExamples,classificationMetrics,validateSplits,annotate,prepareExamples,benchmarkPartition,activeBenchmark} from '../lab/active.js';
import {retrievalMetrics,validateQueries,chunkBenchmark} from '../lab/chunk-benchmark.js';
import {loadCrossEncoder} from '../lab/cross-encoder.js';
import {ResearchService} from '../lab/service.js';
import {ACTIVE_CORPUS,FIXTURE_DOCUMENTS,fixtureGroundTruth} from '../lab/fixture-corpus.js';

const preview=async(text='# Documento\n\n## Prazos\n\nO protocolo AUR-27 vence em agosto.\n\nA equipe Lume responde pelo protocolo.',name='doc.md')=>previewDocument(new File([text],name));
const version=async()=>makeVersion(await preview(),'doc',1,{validFrom:'2026-01-01'});
const vector=[1,0];
test('strict decoding, paragraphs, Markdown heading paths and source offsets are preserved',()=>{
  assert.throws(()=>decodeText(new Uint8Array([0xc3,0x28])),/codificação/);assert.equal(decodeText(new Uint8Array([0xe7]),'windows-1252'),'ç');
  const text='# Título\n\n## Filha\n\nParágrafo\ncontinua.\n\nOutro.';const blocks=textBlocks(text,'md');const body=blocks.find(b=>b.text.startsWith('Parágrafo'));
  assert.deepEqual(body.locator.section,['Título','Filha']);assert.equal(body.locator.lineStart,5);assert.equal(body.locator.lineEnd,6);assert.equal(text.slice(body.locator.start,body.locator.end),body.text);
  const fenced=textBlocks('# Título\n\n```\n# Não é título\n```','md');assert.ok(fenced.at(-1).locator.section.includes('Título'));assert.ok(!fenced.at(-1).locator.section.includes('Não é título'));
});
test('real TXT/MD fixtures extract deterministically; size and unsupported inputs fail',async()=>{
  for(const info of FIXTURE_DOCUMENTS.filter(d=>!d.pages)){const data=await readFile(new URL('../fixtures/aurora-v3/'+info.file,import.meta.url));const result=await previewDocument(new File([data],info.file));assert.ok(result.blocks.length);assert.equal(result.contentHash,(await previewDocument(new File([data],info.file))).contentHash);}
  await assert.rejects(()=>previewDocument(new File(['bad'],'x.html')),/PDF/);await assert.rejects(()=>previewDocument(new File([],'x.txt')),/10 MB/);
});
test('PDF extraction contract preserves page and never requests scripts, annotations or attachments',async()=>{
  let options,destroyed=0;const library=async()=>({getDocument(input){options=input;return {promise:Promise.resolve({numPages:2,async getPage(p){return {getTextContent:async()=>({items:[{str:'Texto real da página '+p,hasEOL:true}]}),cleanup(){}};}}),destroy:async()=>{destroyed++;}};}});
  const result=await extractPdf(new Uint8Array([1]),{library});assert.deepEqual(result.blocks.map(b=>b.locator.page),[1,2]);assert.equal(options.enableXfa,false);assert.equal(options.isEvalSupported,false);assert.equal(result.extraction.ocr,false);assert.equal(destroyed,1);
  await assert.rejects(()=>extractPdf(new Uint8Array([1]),{library:async()=>({getDocument:()=>({promise:Promise.reject(Object.assign(Error('encrypted'),{name:'PasswordException'})),destroy:async()=>{}})})}),/senha/);
  await assert.rejects(()=>extractPdf(new Uint8Array([1]),{library:async()=>({getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]}),cleanup(){}})}),destroy:async()=>{}})})}),/OCR/);
});
test('chunking is deterministic, bounded, overlaps fixed windows and respects pages/sections',async()=>{
  const v=await version();for(const strategy of ['fixed','paragraphs','sections']){const a=await makeChunks(v,{strategy,size:100,overlap:20}),b=await makeChunks(v,{strategy,size:100,overlap:20});assert.deepEqual(a,b);assert.ok(a.every(c=>c.text.length<=100&&c.locators.every(s=>s.end>s.start)));}
  const blocks=[{text:'0123456789'.repeat(30),locator:{kind:'page',page:1,start:0,end:300}},{text:'x'.repeat(200),locator:{kind:'page',page:2,start:0,end:200}}];const chunks=divideBlocks(blocks,{strategy:'fixed',size:100,overlap:20});assert.equal(chunks[1].text.slice(0,20),chunks[0].text.slice(-20));assert.ok(chunks.every(c=>new Set(c.spans.map(s=>s.page)).size===1));assert.throws(()=>chunkConfig({overlap:800,size:800}));
});
test('chunk limits stop excessive overlap early and UTF-16 windows preserve surrogate pairs',()=>{
  const text='😀'.repeat(100),rows=divideBlocks([{text,locator:{start:0,end:text.length}}],{strategy:'fixed',size:101,overlap:100});assert.ok(rows.every(r=>r.text.length<=101&&r.text.isWellFormed()));
  const large='a'.repeat(20000);assert.throws(()=>divideBlocks([{text:large,locator:{start:0,end:large.length}}],{strategy:'fixed',size:100,overlap:99}),/trechos/);
});
test('BM25 normalizes Unicode/accents and preserves codes; empty and absent terms produce no hits',()=>{
  assert.deepEqual(tokenize('AÇÃO ECA AUR-27/B sen-42'),['acao','eca','aur-27/b','sen-42']);
  const rows=[{id:'a',text:'ação AUR-27/B'},{id:'b',text:'brisa'}];assert.equal(bm25(rows,'ACAO')[0].id,'a');assert.deepEqual(bm25(rows,'inexistente'),[]);assert.deepEqual(bm25(rows,'   '),[]);assert.ok(Math.abs(bm25([{id:'a',text:'x'},{id:'b',text:'y'}],'x')[0].score-Math.log(2))<1e-10);
  assert.deepEqual(rrf([[{id:'b'},{id:'a'}],[{id:'a'},{id:'b'}]],60).map(r=>r.id),['a','b']);assert.equal(rrf([[{id:'a'}],[{id:'a'}]],60)[0].score,2/61);
});
test('all retrieval strategies apply the same temporal/document/exclusion filters',()=>{
  const versions=[{id:'old',documentId:'d',validFrom:'2026-01-01',validTo:'2026-06-30',supersededBy:'new'},{id:'new',documentId:'d',validFrom:'2026-07-01'},{id:'other',documentId:'x'}];
  const chunks=versions.map(v=>({id:'C'+v.id,versionId:v.id,documentId:v.documentId,text:'AUR-27 prazo',vector:[1,0]}));
  for(const strategy of ['vector','lexical','hybrid']){const trace=candidates(chunks,versions,'AUR-27',vector,{strategy,asOf:'2026-11-05',documentIds:['d'],includeUndated:true});assert.deepEqual(trace.ranked.map(c=>c.id),['Cnew']);assert.equal(trace.candidates.find(c=>c.id==='Cold').reason,'outside-validity');}
  assert.equal(versionFilter(versions[0],versions,{asOf:'2026-05-01'}),null);assert.equal(versionFilter(versions[2],versions,{includeUndated:false}),'unknown-date');
  assert.throws(()=>retrievalConfig({threshold:NaN}));assert.throws(()=>candidates(chunks,versions,'',null,{strategy:'lexical'}));assert.throws(()=>candidates([{...chunks[0],vector:[NaN,0]}],versions,'prazo',vector,{strategy:'vector',asOf:'2026-05-01'}));
});
test('reranker reorders only its prefix; failure records the actual fallback',async()=>{
  const trace={config:retrievalConfig({rerank:true,rerankLimit:2}),ranked:[{id:'a',rankBefore:1},{id:'b',rankBefore:2},{id:'c',rankBefore:3}]};
  const sorted=await rerankCandidates(trace,'q',async()=>({scores:[-2,4],model:'test-double'}));assert.deepEqual(sorted.ranked.map(r=>r.id),['b','a']);assert.deepEqual(sorted.reranking.tailNotSelected,['c']);assert.equal(trace.ranked[0].id,'a');
  const failed=await rerankCandidates(trace,'q',async()=>{throw Error('not supported');});assert.equal(failed.reranking.fallback,'original-ranking');assert.equal(failed.ranked[0].id,'a');
});
test('cross-encoder contract uses pairs, pinned revision, bounded batches and explicit truncation',async()=>{
  const requests=[],inputs=[];const tokenizer=(q,options)=>{inputs.push(options);return {input_ids:{data:Array(600).fill(0)},count:Array.isArray(q)?q.length:1};};
  const model=Object.assign(async input=>({logits:{tolist:()=>Array.from({length:input.count},(_,i)=>[i-2])}}),{dispose:async()=>{}});
  const engine=await loadCrossEncoder({AutoTokenizer:{from_pretrained:async(id,opts)=>{requests.push(opts);return tokenizer;}},AutoModelForSequenceClassification:{from_pretrained:async(id,opts)=>{requests.push(opts);return model;}}});
  const result=await engine.rank('pergunta',Array.from({length:5},(_,i)=>({id:String(i),text:'trecho'})));assert.equal(result.scores.length,5);assert.ok(result.truncated.every(Boolean));assert.equal(requests[0].revision,result.revision);assert.ok(inputs.some(x=>x.max_length===512));assert.equal(result.scoreType.includes('not probability'),true);await engine.dispose();
});
test('actual context prefix and clipped source intervals stay within the provided token counter',async()=>{
  const v=await version(),chunks=await makeChunks(v,{strategy:'paragraphs',size:100,overlap:20}),trace=candidates(chunks,[v],'protocolo',null,{strategy:'lexical',contextTokens:40});
  const result=await selectContext(trace,async text=>text.length);assert.ok(result.context.length<=40);assert.equal(result.contextTokens,result.context.length);assert.ok(result.sources.every(s=>s.contextLocators.every(l=>l.end<=s.locators.find(x=>x.start===l.start).end)));
  const audit=referenceAudit('[Cvalid] [Cabsent]',[{id:'Cvalid'}]);assert.deepEqual(audit.valid,['Cvalid']);assert.deepEqual(audit.invalid,['Cabsent']);assert.equal(sourceMessages('q','data').length,2);
  await assert.rejects(()=>selectContext(trace,async()=>NaN),/contagem inválida/);
});
test('evidence recall unions overlaps once, distinguishes no-answer cases and avoids invented precision',()=>{
  const evidence={id:'e1',versionId:'v',start:0,end:10},chunk=(a,b)=>({id:'C'+a,versionId:'v',locators:[{start:a,end:b}],contextLocators:[{start:a,end:b}]});
  assert.equal(evidenceCoverage([chunk(0,6),chunk(4,10)],evidence),true);assert.equal(evidenceCoverage([chunk(0,4),chunk(5,10)],evidence),false);
  const trace={sources:[chunk(0,6),chunk(4,10),chunk(4,10)],ranked:[chunk(0,6),chunk(4,10)],config:{limit:2},contextTokens:20};
  const m=retrievalMetrics(trace,{evidence:[evidence,{...evidence,id:'alias'}]});assert.equal(m.evidenceRecall,1);assert.equal(m.coveredEvidence.length,1);assert.equal(m.mrr,.5);assert.equal(m.precision,null);assert.equal(retrievalMetrics(trace,{evidence:[]}).falsePositiveRetrieval,true);
  assert.throws(()=>validateQueries([{question:'q',split:'test',evidence:[evidence]}],[]));
});
test('schema migration does not modify legacy experiments and cache keys include revision/preprocessing',()=>{
  const old={schema:2,documents:[],experiments:[{id:'old',answer:'preserve'}]},copy=structuredClone(old),next=migrateCatalog(old);assert.equal(next.schema,3);assert.deepEqual(next.experiments,copy.experiments);assert.deepEqual(old,copy);assert.throws(()=>migrateCatalog({schema:99}));assert.notEqual(embeddingKey('hash',EMBEDDING),embeddingKey('hash',{...EMBEDDING,revision:'other'}));assert.match(exportCsv([{text:'=1+1'}]),/'=1\+1/);
});
test('active selection excludes holdouts/reviewed/skipped examples and never creates human labels',async()=>{
  const model={labels:['a','b'],layers:[{w:[0,0],b:[0]},{w:[0],b:[0]},{w:[0,0],b:[0,0]}]};
  const pool=[{id:'a',text:'one',vector:[1,0],split:'pool'},{id:'b',text:'two',vector:[1,0],split:'test',label:'a'},{id:'c',text:'three',vector:[1,0],split:'pool',skipped:true}];
  for(const strategy of ['margin','entropy','random'])assert.deepEqual(selectExamples(model,pool,{strategy}).map(x=>x.id),['a']);
  const state={examples:pool,annotations:[]};const revised=await annotate(state,'a','a');assert.equal(revised.examples[0].label,'a');assert.equal(revised.annotations[0].origin,'human');await assert.rejects(()=>annotate(state,'b','b'),/teste/);
  assert.throws(()=>validateSplits([{text:'texto',group:'g',split:'train'},{text:'variante',group:'g',split:'test'}]),/duplicado/);
  const examples=await prepareExamples([{text:'AÇÃO'},{text:'acao'}]);assert.equal(examples.length,1);
});
test('classification metrics and grouped benchmark partitions have known results',()=>{
  const m=classificationMetrics(['a','b'],['a','a','b','b'],['a','b','a','b']);assert.equal(m.accuracy,.5);assert.equal(m.macroF1,.5);assert.deepEqual(m.confusionMatrix,[[1,1],[1,1]]);
  const corpus=ACTIVE_CORPUS.map((c,i)=>({...c,id:String(i),vector:[i<12?1:0,i>=12?1:0]})),p=benchmarkPartition(corpus,42);const ids=[...p.train,...p.validation,...p.test,...p.pool].map(e=>e.id);assert.equal(new Set(ids).size,36);assert.equal(p.train.length,6);assert.equal(p.test.length,6);assert.ok(p.pool.every(e=>!p.test.some(t=>t.group===e.group)));
});
test('automated active selection preserves identical initial/test sets and never selects holdouts',async()=>{
  const corpus=ACTIVE_CORPUS.map((e,i)=>({...e,id:String(i),vector:[Number(i<12),Number(i>=12&&i<24),Number(i>=24)]}));
  const result=await activeBenchmark(corpus,{seeds:[42],budgets:[0,1],maxEpochs:2});
  const margin=result.curves.filter(r=>r.strategy==='margin'),random=result.curves.filter(r=>r.strategy==='random');assert.deepEqual(margin[0].initialIds,random[0].initialIds);assert.deepEqual(margin[0].testIds,random[0].testIds);
  for(const row of result.curves)assert.ok(row.revealed.every(id=>!row.testIds.includes(id)&&!row.validationIds.includes(id)));assert.equal(result.selectionSeesLabels,false);
});

class MemoryStore{
  constructor(){this.state=migrateCatalog();this.data=new Map();this.saved=[];this.fail=false;}
  async catalog(){return structuredClone(this.state);}
  async get(store,id){return structuredClone(this.data.get(store+':'+id));}
  async commit(revision,update,records=[],signal){if(signal?.aborted)throw new DOMException('cancel','AbortError');if(this.fail)throw Error('Injected atomic failure');assert.equal(revision,this.state.revision);const next=update(structuredClone(this.state));next.revision++;this.state=next;for(const r of records)this.data.set(r.store+':'+r.key,structuredClone(r.value));return next;}
  async appendResult(r){this.saved.push(structuredClone(r));}
  async results(){return structuredClone(this.saved);}
}
const testEmbedding={model:'test-double',revision:'1',dimension:2,dtype:'test',preprocessing:'test'};
test('document dedup, interrupted indexing and transaction failure never activate partial indices',async()=>{
  const store=new MemoryStore(),controller=new AbortController(),file=new File(['O prazo AUR-27.'],'x.txt'),p=await previewDocument(file);
  const service=new ResearchService({store,embedding:testEmbedding,models:async()=>{controller.abort();return vector;}});
  await assert.rejects(()=>service.indexPreview(p,file,{vectors:true,signal:controller.signal}),/cancelada/);assert.equal(store.state.documents.length,0);
  service.models=async()=>vector;store.fail=true;await assert.rejects(()=>service.indexPreview(p,file,{vectors:true}),/atomic/);assert.equal(store.state.indices.length,0);
  store.fail=false;const first=await service.indexPreview(p,file,{vectors:true});assert.equal(store.state.versions[0].activeIndexId,first.index.id);assert.equal((await service.indexPreview(p,file)).duplicate,true);assert.equal(store.state.versions.length,1);
});
test('new versions, reindex namespaces and later metadata edits preserve previous query snapshots',async()=>{
  const store=new MemoryStore(),service=new ResearchService({store,embedding:testEmbedding,models:async(type,text)=>type==='tokenCount'?text.split(/\s+/).length:vector});
  const file=new File(['AUR-27 vence em junho.'],'x.txt'),first=await service.indexPreview(await previewDocument(file),file,{dates:{validFrom:'2026-01-01'}});
  const query=await service.query('AUR-27',{strategy:'lexical',asOf:'2026-02-01'});const original=JSON.stringify(query);
  const isolated=await service.reindex(first.version.id,{vectors:true});assert.equal(store.state.versions[0].activeIndexId,first.index.id);await service.activateIndex(first.version.id,isolated.id);assert.equal(store.state.versions[0].activeIndexId,isolated.id);
  const f2=new File(['AUR-27 vence em agosto.'],'x.txt'),second=await service.indexPreview(await previewDocument(f2),f2,{documentId:first.version.documentId,dates:{validFrom:'2026-07-01'}});await service.updateVersion(first.version.id,{supersededBy:second.version.id});assert.equal(JSON.stringify(query),original);
  const historical=await service.query('AUR-27',{strategy:'lexical',asOf:'2026-02-01'});assert.ok(historical.trace.sources.every(s=>s.versionId===first.version.id));
});
test('incompatible embedding revision and malformed vectors fail without replacing the active index',async()=>{
  const store=new MemoryStore(),service=new ResearchService({store,embedding:testEmbedding,models:async()=>[NaN,0]}),file=new File(['AUR-27 prazo'],'x.txt'),p=await previewDocument(file);
  await assert.rejects(()=>service.indexPreview(p,file,{vectors:true}),/Vetor/);assert.equal(store.state.indices.length,0);
  service.models=async()=>[1,0];await service.indexPreview(p,file,{vectors:true});const active=store.state.versions[0].activeIndexId;
  store.state.indices[0].embedding={...testEmbedding,revision:'obsolete'};store.data.get('indices:'+active).embedding=store.state.indices[0].embedding;
  await assert.rejects(()=>service.query('AUR-27',{strategy:'vector'}),/incompatível/);assert.equal(store.state.versions[0].activeIndexId,active);
});
test('manual divergences keep both sources and a reversible review history without editing content',async()=>{
  const store=new MemoryStore(),service=new ResearchService({store,embedding:testEmbedding,models:async()=>vector});
  const a=new File(['O prazo é junho.'],'a.txt'),b=new File(['O prazo é agosto.'],'b.txt');const left=await service.indexPreview(await previewDocument(a),a),right=await service.indexPreview(await previewDocument(b),b);
  const l=(await store.get('indices',left.index.id)).chunks[0],r=(await store.get('indices',right.index.id)).chunks[0];await service.divergence(l.id,r.id,'Conferir datas','update');let d=store.state.divergences[0];assert.equal(d.status,'pending');await service.reviewDivergence(d.id,'confirmed','update');await service.reviewDivergence(d.id,'discarded','scope');d=store.state.divergences[0];assert.equal(d.history.length,2);assert.equal(d.sources[0].text,'O prazo é junho.');assert.equal((await store.get('indices',left.index.id)).chunks[0].text,l.text);
});
