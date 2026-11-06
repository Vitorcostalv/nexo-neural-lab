// Pure retrieval contract. No vectors leave the runtime in an audit record.
export function searchConfig(input={}) {
  const config={limit:input.limit??5,threshold:input.threshold??.4,excludedIds:input.excludedIds??[],contextChars:input.contextChars??2000};
  if(!Number.isInteger(config.limit)||config.limit<1||config.limit>20)throw Error('Use entre 1 e 20 trechos.');
  if(!Number.isFinite(config.threshold)||config.threshold< -1||config.threshold>1)throw Error('O limiar deve estar entre -1 e 1.');
  if(!Array.isArray(config.excludedIds)||config.excludedIds.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Identificadores de exclusão inválidos.');
  if(!Number.isInteger(config.contextChars)||config.contextChars<100||config.contextChars>2000)throw Error('Orçamento de contexto inválido.');
  config.excludedIds=[...new Set(config.excludedIds)].sort((a,b)=>a-b);return config;
}
export function unitVector(vector,dimension) {
  if((!Array.isArray(vector)&&!ArrayBuffer.isView(vector))||!vector.length||vector.length>8192||vector.length!==(dimension??vector.length)||Array.from(vector).some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Vetor inválido ou dimensão incompatível.');
  const norm=Math.hypot(...vector);if(!Number.isFinite(norm)||norm<1e-8)throw Error('Vetor nulo ou inválido.');
  return Array.from(vector,v=>v/norm);
}
export function searchTrace(memories,vector,input={}) {
  const started=performance.now(),config=searchConfig(input),query=unitVector(vector),ids=new Set();
  const ranked=memories.map(m=>{
    if(!Number.isSafeInteger(m.id)||m.id<1||ids.has(m.id))throw Error('Identificador de memória inválido ou duplicado.');ids.add(m.id);
    if(m.dimension!=null&&m.dimension!==query.length)throw Error('Dimensão declarada incompatível.');
    const v=unitVector(m.vector,query.length);
    return {memory:m,score:Math.max(-1,Math.min(1,v.reduce((s,x,i)=>s+x*query[i],0)))};
  }).sort((a,b)=>b.score-a.score||a.memory.id-b.memory.id);
  const scored=performance.now(),excluded=new Set(config.excludedIds),sources=[];let used=0;
  const candidates=ranked.map(({memory:m,score},i)=>{
    let reason=excluded.has(m.id)?'excluded':score<config.threshold?'below-threshold':sources.length>=config.limit?'top-k':'included';
    if(reason==='included'){
      const prefix=`[M${m.id}] `,remaining=config.contextChars-used-prefix.length-(sources.length?1:0);
      if(remaining<=0)reason='context-budget';
      else {const text=m.text??'',excerpt=text.slice(0,Math.min(600,remaining));const {vector,...publicFields}=m;sources.push({...publicFields,score,rank:i+1,excerpt,truncated:excerpt.length<text.length});used+=prefix.length+excerpt.length+(sources.length>1?1:0);}
    }
    return {id:m.id,score,rank:i+1,reason};
  });
  const counts=Object.fromEntries(['included','excluded','below-threshold','top-k','context-budget'].map(reason=>[reason,candidates.filter(c=>c.reason===reason).length]));
  return {config,dimension:query.length,total:memories.length,counts,candidates,sources,context:sources.map(s=>`[M${s.id}] ${s.excerpt}`).join('\n'),timings:{scoringMs:scored-started,selectionMs:performance.now()-scored,totalMs:performance.now()-started}};
}
export function candidatePage(trace,page=0,size=20){
  if(!Number.isInteger(page)||page<0||!Number.isInteger(size)||size<1||size>50)throw Error('Página inválida.');
  return {total:trace.total,page,size,items:trace.candidates.slice(page*size,(page+1)*size)};
}
