import {integer,dateValue,publicChunk,TOKENIZER} from './contracts.js?v=1.4.1';
import {versionFilter} from './documents.js?v=1.4.1';
import {unitVector} from '../browser/retrieval.js?v=1.4.1';
import {codePointBoundary} from './chunking.js?v=1.4.1';
export const tokenize=text=>String(text).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+(?:[._/-][\p{L}\p{N}]+)*/gu)||[];
export function retrievalConfig(input={}){
  const c={strategy:input.strategy??'hybrid',candidateLimit:input.candidateLimit??24,limit:input.limit??5,threshold:input.threshold??.4,rrfK:input.rrfK??60,bm25:{k1:1.2,b:.75},excludedIds:input.excludedIds??[],documentIds:input.documentIds??[],versionIds:input.versionIds??[],asOf:dateValue(input.asOf)||new Date().toLocaleDateString('sv-SE'),includeSuperseded:input.includeSuperseded??false,includeUndated:input.includeUndated??true,rerank:input.rerank??false,rerankLimit:input.rerankLimit??12,contextTokens:input.contextTokens??500};
  if(!['vector','lexical','hybrid'].includes(c.strategy))throw Error('Busca inválida.');
  integer(c.candidateLimit,1,100,'Candidatos por estratégia');integer(c.limit,1,20,'Trechos finais');integer(c.rrfK,1,200,'Constante RRF');integer(c.rerankLimit,1,24,'Candidatos do reranker');integer(c.contextTokens,32,1500,'Orçamento de tokens');
  if(!Number.isFinite(c.threshold)||c.threshold< -1||c.threshold>1)throw Error('Limiar inválido.');
  for(const field of ['excludedIds','documentIds','versionIds'])if(!Array.isArray(c[field])||c[field].length>5000||c[field].some(id=>typeof id!=='string'))throw Error('Filtro inválido.');
  for(const field of ['includeSuperseded','includeUndated','rerank'])if(typeof c[field]!=='boolean')throw Error('Filtro booleano inválido.');return c;
}
export function bm25(chunks,query,{k1=1.2,b=.75}={}){
  if(!Number.isFinite(k1)||k1<=0||!Number.isFinite(b)||b<0||b>1)throw Error('Parâmetros BM25 inválidos.');
  const terms=[...new Set(tokenize(query))];if(!terms.length||!chunks.length)return [];
  const wanted=new Set(terms),df=new Map(terms.map(term=>[term,0])),docs=chunks.map(c=>{const tokens=tokenize(c.text),frequencies=new Map();for(const term of tokens)if(wanted.has(term))frequencies.set(term,(frequencies.get(term)||0)+1);for(const term of frequencies.keys())df.set(term,df.get(term)+1);return {id:c.id,length:tokens.length,frequencies};}),avg=docs.reduce((s,d)=>s+d.length,0)/docs.length||1;
  return docs.map(d=>({id:d.id,score:terms.reduce((sum,term)=>{const tf=d.frequencies.get(term)||0;if(!tf)return sum;return sum+Math.log(1+(docs.length-df.get(term)+.5)/(df.get(term)+.5))*(tf*(k1+1))/(tf+k1*(1-b+b*d.length/avg));},0)})).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map((d,i)=>({...d,rank:i+1}));
}
export function rrf(rankings,k=60){
  integer(k,1,200,'RRF');const scores=new Map();for(const ranking of rankings){const seen=new Set();ranking.forEach((r,i)=>{if(!seen.has(r.id)){scores.set(r.id,(scores.get(r.id)||0)+1/(k+i+1));seen.add(r.id);}});}return [...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function candidates(chunks,versions,query,vector,input={}){
  const start=performance.now(),config=retrievalConfig(input),excluded=new Set(config.excludedIds),versionMap=new Map(versions.map(v=>[v.id,v])),reasons=new Map(),eligible=[];
  if(typeof query!=='string'||query.length>1000||!query.trim())throw Error('Pergunta vazia ou maior que 1.000 caracteres.');
  for(const chunk of chunks){const v=versionMap.get(chunk.versionId);const reason=excluded.has(chunk.id)?'excluded':!v?'unknown-version':versionFilter(v,versions,config);if(reason)reasons.set(chunk.id,reason);else eligible.push({...chunk,publishedAt:v.publishedAt??null,validFrom:v.validFrom??null,validTo:v.validTo??null,supersededBy:v.supersededBy??null});}
  let lexical=[],semantic=[],allLexical=[],allSemantic=[];
  if(config.strategy!=='vector'){allLexical=bm25(eligible,query,config.bm25);lexical=allLexical.slice(0,config.candidateLimit);}
  if(config.strategy!=='lexical'){
    const q=unitVector(vector);if(eligible.some(c=>!c.vector))throw Error('Este índice não possui embeddings. Indexe com embeddings ou use BM25.');
    allSemantic=eligible.map(c=>{const v=unitVector(c.vector,q.length);return {id:c.id,score:Math.max(-1,Math.min(1,v.reduce((s,x,i)=>s+x*q[i],0)))};}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map((c,i)=>({...c,rank:i+1}));semantic=allSemantic.filter(c=>c.score>=config.threshold).slice(0,config.candidateLimit);
  }
  const lm=new Map(allLexical.map(c=>[c.id,c])),vm=new Map(allSemantic.map(c=>[c.id,c]));
  const ranked=config.strategy==='hybrid'?rrf([lexical,semantic],config.rrfK):config.strategy==='lexical'?lexical:semantic;
  const byId=new Map(eligible.map(c=>[c.id,c]));
  const rows=ranked.map((r,i)=>({...publicChunk(byId.get(r.id)),rankBefore:i+1,lexicalRank:lm.get(r.id)?.rank??null,lexicalScore:lm.get(r.id)?.score??null,vectorRank:vm.get(r.id)?.rank??null,cosine:vm.get(r.id)?.score??null,fusionScore:config.strategy==='hybrid'?r.score:null,score:r.score}));
  const audit=chunks.map(c=>({id:c.id,rankBefore:ranked.some(r=>r.id===c.id)?ranked.findIndex(r=>r.id===c.id)+1:null,reason:reasons.get(c.id)||(!ranked.some(r=>r.id===c.id)?config.strategy==='vector'&&vm.get(c.id)?.score<config.threshold?'below-vector-threshold':config.strategy==='lexical'&&!lm.has(c.id)?'lexical-no-match':'outside-candidates':'candidate'),lexicalRank:lm.get(c.id)?.rank??null,lexicalScore:lm.get(c.id)?.score??null,vectorRank:vm.get(c.id)?.rank??null,cosine:vm.get(c.id)?.score??null,vectorCandidate:semantic.some(r=>r.id===c.id),lexicalCandidate:lexical.some(r=>r.id===c.id),fusionScore:config.strategy==='hybrid'?ranked.find(r=>r.id===c.id)?.score??null:null}));
  return {config,total:chunks.length,eligible:eligible.length,ranked:rows,candidates:audit,timings:{retrievalMs:performance.now()-start}};
}
export async function rerankCandidates(trace,query,rerank){
  if(!trace.config.rerank)return {...trace,reranking:{enabled:false}};
  const start=performance.now(),count=Math.min(trace.config.rerankLimit,trace.ranked.length),prefix=trace.ranked.slice(0,count);
  try{
    const result=await rerank(query,prefix);if(result.scores.length!==count||result.scores.some(s=>!Number.isFinite(s)))throw Error('Scores inválidos do reranker.');
    const ranked=prefix.map((r,i)=>({...r,rerankScore:result.scores[i]})).sort((a,b)=>b.rerankScore-a.rerankScore||a.rankBefore-b.rankBefore);
    // Selection comes only from the reranked prefix; not-scored tail stays in the audit.
    return {...trace,ranked,reranking:{...result,scores:undefined,enabled:true,candidates:count,pairs:prefix.map((r,i)=>({id:r.id,truncated:result.truncated?.[i]??null,score:result.scores[i]})),tailNotSelected:trace.ranked.slice(count).map(r=>r.id),seconds:(performance.now()-start)/1000,fallback:null}};
  }catch(error){if(error.name==='AbortError')throw error;return {...trace,reranking:{enabled:true,error:error.message,fallback:'original-ranking',seconds:(performance.now()-start)/1000}};}
}
export async function selectContext(trace,countTokens){
  const rawCounter=countTokens;countTokens=async text=>{const count=await rawCounter(text);if(!Number.isSafeInteger(count)||count<0)throw Error('Tokenizador retornou uma contagem inválida.');return count;};
  const selected=[],start=performance.now();let context='',tokens=0;
  for(const row of trace.ranked){
    if(selected.length>=trace.config.limit)break;
    let excerpt=row.text;const prefix=`[${row.id}] `,join=context?'\n\n':'';
    // Count with the actual generation tokenizer. Truncation keeps an exact source prefix.
    if(await countTokens(context+join+prefix+excerpt)>trace.config.contextTokens){
      let low=0,high=excerpt.length;while(low<high){const mid=Math.ceil((low+high)/2);if(await countTokens(context+join+prefix+excerpt.slice(0,mid))<=trace.config.contextTokens)low=mid;else high=mid-1;}excerpt=excerpt.slice(0,codePointBoundary(excerpt,low));
      while(excerpt&&await countTokens(context+join+prefix+excerpt)>trace.config.contextTokens)excerpt=excerpt.slice(0,codePointBoundary(excerpt,excerpt.length-1));
    }
    if(!excerpt.trim())continue;
    context+=join+prefix+excerpt;tokens=await countTokens(context);const contextLocators=row.locators.filter(s=>s.chunkStart<excerpt.length).map(s=>({...s,end:Math.min(s.end,s.start+Math.min(s.chunkEnd,excerpt.length)-s.chunkStart)}));selected.push({...row,excerpt,contextLocators,truncated:excerpt.length<row.text.length,rankAfter:selected.length+1});
  }
  const selection=new Map(selected.map(s=>[s.id,s]));
  return {...trace,sources:selected,context,contextTokens:tokens,tokenizer:TOKENIZER,candidates:trace.candidates.map(c=>({...c,reason:selection.has(c.id)?'included':c.reason==='candidate'?'not-selected-context-or-limit':c.reason,rankAfter:trace.ranked.some(r=>r.id===c.id)?trace.ranked.findIndex(r=>r.id===c.id)+1:null,rerankScore:trace.ranked.find(r=>r.id===c.id)?.rerankScore??null})),timings:{...trace.timings,selectionMs:performance.now()-start}};
}
