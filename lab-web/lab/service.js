import {ResearchStore} from './storage.js?v=1.4.1';
import {EMBEDDING,TOKENIZER,LIMITS,hash,checkAbort,embeddingKey,publicChunk,validity} from './contracts.js?v=1.4.1';
import {unitVector} from '../browser/retrieval.js?v=1.4.1';
import {prepareExamples,selectExamples,annotate} from './active.js?v=1.4.1';
import {chunkBenchmark} from './chunk-benchmark.js?v=1.4.1';
import {makeVersion,referenceAudit,sourceMessages,versionFilter} from './documents.js?v=1.4.1';
import {makeChunks,chunkConfig} from './chunking.js?v=1.4.1';
import {candidates,retrievalConfig,rerankCandidates,selectContext} from './search.js?v=1.4.1';
import {runExperiment,createExperiment} from '../browser/experiment-core.js?v=1.4.1';
export class ResearchService{
  constructor({store=new ResearchStore(),models,embedding=EMBEDDING,rerank=null}={}){this.store=store;this.models=models;this.embedding=embedding;this.rerank=rerank;this.locked=false;}
  async exclusive(fn){if(this.locked)throw Error('Já existe uma tarefa neste laboratório.');this.locked=true;try{return await fn();}finally{this.locked=false;}}
  async indexPreview(preview,file,{documentId=null,dates={},chunking={},vectors=false,signal,onProgress=()=>{}}={}){
    return this.exclusive(async()=>{
      const catalog=await this.store.catalog(),doc=documentId?catalog.documents.find(d=>d.id===documentId):null;
      if(documentId&&!doc)throw Error('Documento não encontrado.');
      if(catalog.versions.some(v=>v.contentHash===preview.contentHash&&(!doc||v.documentId===doc.id)))return {duplicate:true};
      const id=doc?.id||crypto.randomUUID(),ordinal=catalog.versions.filter(v=>v.documentId===id).length+1,version=await makeVersion(preview,id,ordinal,dates);
      onProgress({stage:'divisão',done:0,total:1});let chunks=await makeChunks(version,chunking);checkAbort(signal);
      let reused=0;
      if(vectors){
        const cache=new Map();for(const info of catalog.indices.filter(i=>JSON.stringify(i.embedding)===JSON.stringify(this.embedding))){const old=await this.store.get('indices',info.id);for(const c of old?.chunks||[])if(c.vector)cache.set(embeddingKey(c.textHash,info.embedding),c.vector);}
        for(let i=0;i<chunks.length;i++){
          checkAbort(signal);const key=embeddingKey(chunks[i].textHash,this.embedding);let vector=cache.get(key);
          if(vector)reused++;else{vector=unitVector(await this.models('embedResearch',chunks[i].text,{signal,onProgress}),this.embedding.dimension);cache.set(key,vector);}
          chunks[i]={...chunks[i],vector};onProgress({stage:'embeddings',done:i+1,total:chunks.length});
        }
      }
      const index={id:'I'+(await hash([version.id,chunkConfig(chunking),vectors?this.embedding:null])).slice(0,24),namespace:'active',versionIds:[version.id],chunking:chunkConfig(chunking),embedding:vectors?this.embedding:null,chunkCount:chunks.length,textChars:chunks.reduce((n,c)=>n+c.text.length,0),created:new Date().toISOString(),reused};
      index.bytes=new TextEncoder().encode(JSON.stringify(chunks)).length;checkAbort(signal);onProgress({stage:'persistência',done:0,total:1});
      await this.store.commit(catalog.revision,current=>({...current,documents:doc?current.documents:[...current.documents,{id,name:preview.name,created:version.importedAt}],versions:[...current.versions,{...version,activeIndexId:index.id}],indices:[...current.indices,index],storedBytes:(current.storedBytes||0)+file.size+index.bytes}),[{store:'indices',key:index.id,value:{...index,chunks}},{store:'files',key:version.id,value:file}],signal);
      onProgress({stage:'concluído',done:1,total:1});return {version,index};
    });
  }
  async updateVersion(id,patch){const catalog=await this.store.catalog();return this.store.commit(catalog.revision,current=>{
    const original=current.versions.find(v=>v.id===id);if(!original)throw Error('Versão não encontrada.');const dates=validity({...original,...patch});
    const replacement=patch.supersededBy===null?null:patch.supersededBy??original.supersededBy;
    if(replacement){const next=current.versions.find(v=>v.id===replacement);if(!next||next.documentId!==original.documentId||next.id===id||next.ordinal<=original.ordinal)throw Error('Substituição deve apontar para uma versão posterior do mesmo documento.');}
    return {...current,versions:current.versions.map(v=>v.id===id?{...v,...dates,supersededBy:replacement}:v)};
  });}
  async reindex(versionId,{vectors=false,chunking={},signal,onProgress=()=>{}}={}){return this.exclusive(async()=>{
    const catalog=await this.store.catalog(),version=catalog.versions.find(v=>v.id===versionId);if(!version)throw Error('Versão não encontrada.');const chunks=await makeChunks(version,chunking);
    for(let i=0;vectors&&i<chunks.length;i++){checkAbort(signal);chunks[i].vector=unitVector(await this.models('embedResearch',chunks[i].text,{signal,onProgress}),this.embedding.dimension);onProgress({stage:'reindexação isolada',done:i+1,total:chunks.length});}
    const index={id:'I'+crypto.randomUUID().replaceAll('-',''),namespace:'reindex',versionIds:[versionId],chunking:chunkConfig(chunking),embedding:vectors?this.embedding:null,chunkCount:chunks.length,bytes:new TextEncoder().encode(JSON.stringify(chunks)).length,created:new Date().toISOString()};
    await this.store.commit(catalog.revision,current=>({...current,indices:[...current.indices,index],storedBytes:(current.storedBytes||0)+index.bytes}),[{store:'indices',key:index.id,value:{...index,chunks}}],signal);return index;
  });}
  async activateIndex(versionId,indexId){const catalog=await this.store.catalog(),index=catalog.indices.find(i=>i.id===indexId);if(!index||index.versionIds.length!==1||index.versionIds[0]!==versionId)throw Error('Índice incompatível com esta versão.');return this.store.commit(catalog.revision,current=>({...current,versions:current.versions.map(v=>v.id===versionId?{...v,activeIndexId:indexId}:v),indices:current.indices.map(i=>i.id===indexId?{...i,namespace:'active'}:i)}));}
  async loaded(input={}){
    const catalog=await this.store.catalog(),config=retrievalConfig(input),infos=catalog.indices.filter(i=>i.namespace==='active'&&catalog.versions.some(v=>v.activeIndexId===i.id));
    const indices=[];for(const info of infos)indices.push(await this.store.get('indices',info.id));
    if(!indices.length)throw Error('Importe e indexe um documento primeiro.');
    if(config.strategy!=='lexical'&&indices.some(i=>i.needsReindex))throw Error('Embeddings ausentes no backup. Reindexe e ative um índice vetorial antes desta busca.');
    if(config.strategy!=='lexical'&&indices.some(i=>i.embedding&&JSON.stringify(i.embedding)!==JSON.stringify(this.embedding)&&i.versionIds.some(id=>{const v=catalog.versions.find(v=>v.id===id);return v&&!versionFilter(v,catalog.versions,config);})))throw Error('Índice incompatível com modelo, revisão ou pré-processamento atuais. Reindexe em um namespace separado.');
    return {catalog,chunks:indices.flatMap(i=>i.chunks),indices:infos,config};
  }
  async find(question,input={},options={}){
    const {signal,onProgress=()=>{},loaded=await this.loaded(input)}=options;checkAbort(signal);const start=performance.now();
    onProgress({stage:'consulta',done:0,total:1});const vector=loaded.config.strategy==='lexical'?null:await this.models('embedResearch',question,{signal,onProgress});
    let trace=candidates(loaded.chunks,loaded.catalog.versions,question,vector,loaded.config);
    trace=await rerankCandidates(trace,question,this.rerank?(q,rows)=>this.rerank(q,rows,{signal,onProgress}):async()=>{throw Error('Reranker não disponível neste runtime. Fallback para ranking original.');});
    checkAbort(signal);trace=await selectContext(trace,text=>this.models('tokenCount',text,{signal,onProgress}));trace.timings.totalMs=performance.now()-start;
    return {trace,loaded};
  }
  async query(question,input={},options={}){return this.exclusive(async()=>{
    const {trace,loaded}=await this.find(question,input,options),result={id:crypto.randomUUID(),schema:'nexo-document-query-v3',kind:'query',mode:'real',created:new Date().toISOString(),question,generationRequested:!!options.generate,config:trace.config,trace,versions:loaded.catalog.versions,indices:loaded.indices};
    if(options.generate){const prep=await this.models('prepareExperiment',{},options),parameters={temperature:0,maxTokens:220,repetitionPenalty:1.1,seed:42};const response=await this.models('generateDetailed',{messages:sourceMessages(question,trace.context),parameters},options);Object.assign(result,{runtime:prep,parameters,appliedParameters:{...parameters,seed:prep.seedSupported?42:null},...response,messages:sourceMessages(question,trace.context),references:referenceAudit(response.answer,trace.sources)});}
    checkAbort(options.signal);await this.store.appendResult(result);return result;
  });}
  async compare(question,input={},options={}){return this.exclusive(async()=>{
    const loaded=await this.loaded(input),record=createExperiment([],question,{});record.schema='nexo-document-experiment-v3';record.kind='comparison';record.mode='real';record.snapshotHash=await hash(loaded.chunks);record.snapshot=loaded.chunks;record.config=loaded.config;record.versions=structuredClone(loaded.catalog.versions);record.indices=loaded.indices;
    await runExperiment(record,{signal:options.signal,onUpdate:options.onUpdate,embed:async()=>loaded.config.strategy==='lexical'?[]:this.models('embedResearch',question,options),retrieve:async(chunks,vector,config)=>{
      let trace=candidates(chunks,record.versions,question,vector,config);trace=await rerankCandidates(trace,question,this.rerank?(q,rows)=>this.rerank(q,rows,options):async()=>{throw Error('Reranker não disponível.');});return selectContext(trace,text=>this.models('tokenCount',text,options));
    },buildMessages:sourceMessages,prepare:()=>this.models('prepareExperiment',{},options),generate:(messages,parameters,onDelta)=>this.models('generateDetailed',{messages,parameters},{...options,onDelta})});
    record.snapshot=record.snapshot.map(publicChunk);for(const condition of Object.values(record.conditions))if(condition.answer)condition.references=referenceAudit(condition.answer,condition.sources);
    await this.store.appendResult(record);return record;
  });}
  async divergence(left,right,description,type='unresolved'){
    if(left===right||!description.trim()||description.length>2000||!['update','scope','unresolved'].includes(type))throw Error('Informe duas fontes distintas, descrição e tipo válido.');
    const catalog=await this.store.catalog(),chunks=[];for(const i of catalog.indices)chunks.push(...(await this.store.get('indices',i.id)).chunks);
    const sources=[left,right].map(id=>{const c=chunks.find(c=>c.id===id);if(!c)return null;const v=catalog.versions.find(v=>v.id===c.versionId);return {...c,publishedAt:v.publishedAt,validFrom:v.validFrom,validTo:v.validTo,supersededBy:v.supersededBy};});if(sources.some(s=>!s))throw Error('Fonte não encontrada.');
    const item={id:crypto.randomUUID(),sources:sources.map(publicChunk),description,type,status:'pending',created:new Date().toISOString(),history:[]};
    return this.store.commit(catalog.revision,current=>({...current,divergences:[...current.divergences,item]}));
  }
  async reviewDivergence(id,status,type){if(!['pending','confirmed','discarded'].includes(status)||!['update','scope','unresolved'].includes(type))throw Error('Revisão inválida.');const catalog=await this.store.catalog();return this.store.commit(catalog.revision,current=>({...current,divergences:current.divergences.map(d=>d.id===id?{...d,status,type,history:[...d.history,{status,type,at:new Date().toISOString()}]}:d)}));}
  async importExamples(items,options={}){return this.exclusive(async()=>{
    const state=await this.store.active(),examples=await prepareExamples(items,state.examples);if(examples.length>LIMITS.pool)throw Error('Limite de 2.000 exemplos.');
    if(state.rounds.length&&examples.some(e=>e.split==='test'&&!state.examples.some(old=>old.id===e.id)))throw Error('O teste foi congelado na primeira rodada. Não adicione novos exemplos ao teste deste ciclo.');
    for(let i=0;i<examples.length;i++){checkAbort(options.signal);if(!examples[i].vector)examples[i].vector=unitVector(await this.models('embedResearch',examples[i].text,options),this.embedding.dimension);options.onProgress?.({stage:'embeddings do pool',done:i+1,total:examples.length});}
    const imported=examples.filter(e=>e.label&&!state.examples.some(old=>old.id===e.id)).map(e=>({id:crypto.randomUUID(),exampleId:e.id,previous:'',label:e.label,origin:e.origin,at:new Date().toISOString(),action:'human-import'}));
    return this.store.saveActive(state.revision,current=>({...current,examples,embedding:this.embedding,model:null,annotations:[...current.annotations,...imported]}));
  });}
  async reprocessActive({signal,onProgress=()=>{}}={}){return this.exclusive(async()=>{const state=await this.store.active(),examples=[];for(const e of state.examples){checkAbort(signal);examples.push({...e,vector:unitVector(await this.models('embedResearch',e.text,{signal,onProgress}),this.embedding.dimension)});onProgress({stage:'embeddings do pool',done:examples.length,total:state.examples.length});}return this.store.saveActive(state.revision,current=>({...current,examples,embedding:this.embedding,needsReindex:false,model:null}));});}
  async suggestions(config){const state=await this.store.active();if(state.needsReindex)throw Error('Reprocesse os embeddings do pool primeiro.');if(state.embedding&&JSON.stringify(state.embedding)!==JSON.stringify(this.embedding))throw Error('Pool incompatível com o modelo atual.');return {state,items:selectExamples(state.model,state.examples,config)};}
  async label(id,label,skip=false,origin='human'){const state=await this.store.active(),next=await annotate(state,id,label,{skip,origin});return this.store.saveActive(state.revision,()=>next);}
  async trainActive(options={}){return this.exclusive(async()=>{const state=await this.store.active();if(state.needsReindex)throw Error('Reprocessar embeddings do pool antes de treinar.');if(state.rounds.length>=20)throw Error('Limite de 20 rodadas; exporte os resultados.');if(state.embedding&&JSON.stringify(state.embedding)!==JSON.stringify(this.embedding))throw Error('Pool incompatível.');const result=await this.models('activeTrain',state,options);checkAbort(options.signal);result.round.datasetHash=await hash(state.examples);return this.store.saveActive(state.revision,current=>({...current,model:result.model,rounds:[...current.rounds,{...result.round,embedding:state.embedding}]}));});}
  async benchmarkActive(corpus,config={},options={}){return this.exclusive(async()=>{const examples=await prepareExamples(corpus);for(const e of examples){checkAbort(options.signal);e.vector=unitVector(await this.models('embedResearch',e.text,options),this.embedding.dimension);}const report=await this.models('activeBenchmark',{corpus:examples,config},options);report.id=crypto.randomUUID();report.kind='active-benchmark';report.mode='real';report.embedding=this.embedding;report.corpus=examples.map(publicChunk);await this.store.appendResult(report);return report;});}
  async benchmarkChunks(input,options={}){return this.exclusive(async()=>{
    const catalog=await this.store.catalog(),versions=catalog.versions.filter(v=>input.versionIds.includes(v.id));if(!versions.length)throw Error('Selecione versões de documentos.');
    const {result,indices}=await chunkBenchmark({...input,versions,embedding:this.embedding,tokenizer:TOKENIZER},{embed:text=>this.models('embedResearch',text,options),countTokens:text=>this.models('tokenCount',text,options),...options});
    checkAbort(options.signal);await this.store.commit(catalog.revision,current=>({...current,indices:[...current.indices,...indices.map(({chunks,...info})=>info)],storedBytes:(current.storedBytes||0)+indices.reduce((n,i)=>n+i.bytes,0)}),[...indices.map(index=>({store:'indices',key:index.id,value:index})),{store:'results',key:result.id,value:result}],options.signal);return result;
  });}
}
