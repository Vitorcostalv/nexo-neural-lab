import {makeChunks,chunkConfig,evidenceCoverage,coversEvidence} from './chunking.js?v=1.4.1';
import {candidates,retrievalConfig,selectContext,rerankCandidates} from './search.js?v=1.4.1';
import {checkAbort,hash,embeddingKey,publicChunk} from './contracts.js?v=1.4.1';
export function retrievalMetrics(trace,query,units=[]){
  const evidence=[...new Map((query.evidence||[]).map(e=>[JSON.stringify([e.versionId,e.page??null,e.start,e.end]),e])).values()],selected=trace.sources.map(c=>({...c,locators:c.contextLocators||c.locators})),covered=evidence.filter(e=>evidenceCoverage(selected,e));
  const top=trace.ranked.slice(0,trace.config.limit);let first=null;
  for(let rank=1;rank<=trace.ranked.length;rank++)if(evidence.some(e=>evidenceCoverage(trace.ranked.slice(0,rank),e))){first=rank;break;}
  let precision=null,precisionNote='Gabarito parcial: precisão não calculada.';
  const sameUnit=(e,u)=>e.versionId===u.versionId&&(e.page??null)===(u.page??null)&&e.start===u.start&&e.end===u.end;
  if(query.exhaustive&&units.length&&evidence.every(e=>units.some(u=>sameUnit(e,u)))){
    const retrievedUnits=units.filter(u=>selected.some(c=>coversEvidence(c,u))),positive=new Set(evidence.map(e=>units.find(u=>sameUnit(e,u)).id));
    precision=retrievedUnits.length?retrievedUnits.filter(u=>positive.has(u.id)).length/retrievedUnits.length:0;precisionNote='Precisão por unidade estável de origem tocada pelo contexto; sobreposições deduplicadas. Recall exige cobertura integral.';
  }
  return {expectedEvidence:evidence.length,coveredEvidence:covered.map(e=>e.id),evidenceRecall:evidence.length?covered.length/evidence.length:null,hitAtK:evidence.length?Number(evidence.some(e=>evidenceCoverage(top,e))):null,mrr:evidence.length?(first?1/first:0):null,precision,precisionNote,unanswerable:!evidence.length,falsePositiveRetrieval:!evidence.length&&selected.length>0,contextTokens:trace.contextTokens,selectedChunks:selected.length};
}
export function evidenceUnits(versions){return versions.flatMap(v=>v.blocks.map(b=>({id:`${v.id}:${b.locator.page||0}:${b.locator.start}:${b.locator.end}`,versionId:v.id,...b.locator})));}
export function validateQueries(queries,versions){
  if(!Array.isArray(queries)||!queries.length||queries.length>100)throw Error('Use 1 a 100 perguntas.');const map=new Map(versions.map(v=>[v.id,v])),identifiers=new Map();
  for(const q of queries){if(!q.question?.trim()||q.question.length>1000||!['dev','test'].includes(q.split)||!Array.isArray(q.evidence))throw Error('Pergunta, partição ou evidências inválidas.');
    for(const e of q.evidence){const version=map.get(e.versionId);if(typeof e.id!=='string'||!e.id||!version||version.format==='pdf'&&!Number.isInteger(e.page)||!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<=e.start||!version.blocks.some(b=>(e.page==null||b.locator.page===e.page)&&e.start>=b.locator.start&&e.end<=b.locator.end))throw Error('Evidência fora dos intervalos extraídos da versão.');const key=JSON.stringify([e.versionId,e.page??null,e.start,e.end]);if(identifiers.has(e.id)&&identifiers.get(e.id)!==key)throw Error('ID de evidência associado a intervalos diferentes.');identifiers.set(e.id,key);}
  }
}
export async function chunkBenchmark({versions,configs,queries,retrieval={},embedding,tokenizer},deps){
  validateQueries(queries,versions);if(!Array.isArray(configs)||configs.length<2||configs.length>6)throw Error('Compare 2 a 6 configurações.');
  const {embed,countTokens,signal,onProgress=()=>{}}=deps,cache=new Map(),id=crypto.randomUUID(),runs=[],indices=[];const config=retrievalConfig({...retrieval,rerank:false}),units=evidenceUnits(versions);
  for(const input of configs){
    checkAbort(signal);const started=performance.now(),chunking=chunkConfig(input);let chunks=[];for(const version of versions)chunks.push(...await makeChunks(version,chunking));
    if(config.strategy!=='lexical')for(let i=0;i<chunks.length;i++){checkAbort(signal);const key=embeddingKey(chunks[i].textHash,embedding);if(!cache.has(key))cache.set(key,await embed(chunks[i].text));chunks[i].vector=cache.get(key);onProgress({stage:'embeddings da bancada',done:i+1,total:chunks.length});}
    const info={id:'I'+(await hash([id,chunking,versions.map(v=>v.id)])).slice(0,24),namespace:'experiment:'+id,versionIds:versions.map(v=>v.id),chunking,embedding:config.strategy==='lexical'?null:embedding,chunkCount:chunks.length,bytes:new TextEncoder().encode(JSON.stringify(chunks)).length,created:new Date().toISOString(),indexMs:performance.now()-started};indices.push({...info,chunks});
    const rows=[];
    for(let i=0;i<queries.length;i++){
      checkAbort(signal);const q=queries[i],start=performance.now(),key='query:'+q.question;let vector=null;
      if(config.strategy!=='lexical'){if(!cache.has(key))cache.set(key,await embed(q.question));vector=cache.get(key);}
      let trace=candidates(chunks,versions,q.question,vector,{...config,asOf:q.asOf||config.asOf});trace=await selectContext(trace,countTokens);
      rows.push({question:q.question,split:q.split,evidence:q.evidence,metrics:retrievalMetrics(trace,q,units),searchMs:performance.now()-start,trace});onProgress({stage:'avaliação de chunking',done:i+1,total:queries.length});
    }
    runs.push({index:{...info},rows});
  }
  const result={id,schema:'nexo-chunk-benchmark-v3',kind:'chunk-benchmark',mode:'real',created:new Date().toISOString(),versions:structuredClone(versions),configs:configs.map(chunkConfig),retrieval:config,embedding:config.strategy==='lexical'?null:embedding,tokenizer,queries,unit:'source evidence intervals; duplicate overlaps count once',mapping:'Full expected interval coverage by union of selected source spans. MRR: first ranking prefix covering a complete evidence unit.',runs};
  return {result,indices};
}
export async function retrievalEvaluation({versions,queries,embedding,tokenizer,rerank=false},deps){
  validateQueries(queries,versions);const chunks=[];for(const version of versions)chunks.push(...await makeChunks(version,{strategy:'paragraphs',size:800,overlap:100}));
  for(let i=0;i<chunks.length;i++){checkAbort(deps.signal);chunks[i].vector=await deps.embed(chunks[i].text);deps.onProgress?.({stage:'indexação da avaliação',done:i+1,total:chunks.length});}
  const rows=[],units=evidenceUnits(versions);
  for(const query of queries){checkAbort(deps.signal);const vector=await deps.embed(query.question);
    for(const strategy of ['vector','lexical','hybrid']){const start=performance.now();let trace=candidates(chunks,versions,query.question,vector,{strategy,candidateLimit:24,limit:5,threshold:.4,rrfK:60,contextTokens:500,asOf:query.asOf,includeUndated:true,rerank,rerankLimit:12});trace=await rerankCandidates(trace,query.question,deps.rerank);trace=await selectContext(trace,deps.countTokens);rows.push({strategy,question:query.question,split:query.split,metrics:retrievalMetrics(trace,query,units),trace,searchMs:performance.now()-start});}
    deps.onProgress?.({stage:'avaliação real de recuperação',done:rows.length/3,total:queries.length});
  }
  return {id:crypto.randomUUID(),kind:'retrieval-evaluation',schema:'nexo-retrieval-evaluation-v3',mode:'real',created:new Date().toISOString(),fixture:'aurora-v3',embedding,tokenizer,versions,queries,chunks:chunks.map(publicChunk),rows,note:'Configurações fixadas antes de avaliar teste. Perguntas sem resposta são medidas separadamente. Nenhuma resposta gerada.'};
}
