import {loadKnowledge,lookupKnowledge,conversationMessages} from '../knowledge.js?v=1.4.1';
import {storageNames} from '../profiles/session.js?v=1.4.1';
import {activity,phase} from '../activity-state.js?v=1.4.1';
import {EMBEDDING} from '../lab/contracts.js?v=1.4.1';
import {cosine,retrieve,publicMemory,graph,predict} from './learning.js?v=1.4.1';
import {createExperiment,runExperiment} from './experiment-core.js?v=1.4.1';
import {searchTrace,searchConfig,unitVector} from './retrieval.js?v=1.4.1';
import {experimentMap} from '../experiment-map.js?v=1.4.1';
let db,worker,sequence=0,mutating=false;
const pending=new Map();
const notice=document.createElement('div');notice.className='browser-notice';notice.setAttribute('role','status');
notice.textContent='EDIÇÃO WEB · IA no seu dispositivo. Modelos exigem centenas de MB (CPU: ~0,9 GB, além do runtime). Use a demonstração em Experimentos para testar sem baixar modelos. Exporte suas memórias para ter um backup.';
document.querySelector('main').prepend(notice);
document.querySelector('.version').textContent='WEB / V4.0';
document.querySelector('label[for="api-key"]').hidden=true;
document.querySelector('#save-key').hidden=true;
const about=document.querySelector('#view-about');if(about){const p=document.createElement('p');p.className='body-copy';p.textContent='Edição web: Qwen2.5 0.5B + MiniLM multilíngue (384 dimensões), IndexedDB e MLP em JavaScript. A edição Python usa modelos maiores, SQLite, NumPy e Whisper. A rede 3D é ilustrativa; somente os nós de memória e suas similaridades representam os dados.';about.prepend(p);}
function rpc(type,payload,onDelta,onProgress){
  phase(type.includes('Train')||type==='train'?'training':type.startsWith('embed')?'retrieving':type.startsWith('generate')?'generating':'loading',type.startsWith('embed')?'Calculando embedding e consultando memórias':type.startsWith('generate')?'Preparando geração':'Executando '+type);
  if(!worker){worker=new Worker(new URL('./inference-worker.js?v=1.4.1',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;if(data.phase){activity.set(p.token,data.phase,data.stage,data.fraction??null);return;}if(data.progress){notice.textContent=data.progress;activity.set(p.token,/trein|poca|rodada/i.test(data.progress)?'training':'loading',data.progress,data.fraction??null);p.onProgress?.({stage:'modelo',message:data.progress});}else if(data.delta){activity.set(p.token,'responding','Recebendo fragmentos da resposta');p.onDelta?.(data.delta);}else{pending.delete(data.id);notice.textContent='IA no dispositivo · memórias neste navegador · exporte para manter um backup.';data.error?p.reject(Error(data.error)):p.resolve(data.result);}};
    worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Não foi possível iniciar a IA. Recarregue a página e verifique sua conexão.'));pending.clear();worker.terminate();worker=null;};
  }
  return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject,onDelta,onProgress,token:activity.current.token});worker.postMessage({id,type,payload});});
}
export async function researchCall(type,payload,{signal,onProgress,onDelta}={}){
  if(mutating)throw Error('Aguarde a operação atual.');
  if(signal?.aborted)throw new DOMException('Cancelado.','AbortError');mutating=true;const cancel=()=>stopWorker();signal?.addEventListener('abort',cancel,{once:true});
  try{return await rpc(type,payload,onDelta,onProgress);}finally{signal?.removeEventListener('abort',cancel);mutating=false;}
}
function stopWorker(){
  worker?.terminate();worker=null;
  for(const p of pending.values())p.reject(new DOMException('Worker encerrado pelo cancelamento.','AbortError'));
  pending.clear();notice.textContent='Experimento cancelado. O worker foi encerrado; o próximo uso recarregará os modelos em cache.';
}
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function experiments(){const s=await read();return s.experiments||[];}
export async function demonstration(config,options={}){
  if(mutating)throw Error('Aguarde a operação atual.');mutating=true;
  try{
    const {demoExperiment}=await import('./demo.js?v=1.4.1'),s=await read();
    const record=await demoExperiment(config,options);
    record.snapshotHash=await digest(record.snapshot);s.experiments=[record,...(s.experiments||[])].slice(0,10);await save(s);if(options.signal?.aborted)activity.finish(activity.current.token,'cancelled','Demonstração cancelada; registro salvo.');return record;
  }finally{mutating=false;}
}
export async function experiment(question,config,{signal,onUpdate}={}){
  if(mutating)throw Error('Aguarde a operação atual.');mutating=true;
  const cancel=()=>stopWorker();signal?.addEventListener('abort',cancel,{once:true});
  try{
    const s=await read(),record=createExperiment(s.memories,question,config);
    record.mode='real';
    record.snapshotHash=await digest(record.snapshot);record.embeddingModel='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
    await runExperiment(record,{embed:text=>rpc('embedDetailed',text),prepare:()=>rpc('prepareExperiment',{}),generate:(messages,parameters,onDelta)=>rpc('generateDetailed',{messages,parameters},onDelta),signal,onUpdate:r=>{
      if(r.trace&&!r.graph)r.graph=experimentMap(s.memories,r.trace.sources.map(m=>m.id));
      onUpdate?.(r);
    }});
    // Retain texts/IDs and a digest of the exact vectors, never thousands of vectors in reports.
    record.snapshot=record.snapshot.map(publicMemory);record.environment={userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency};
    s.experiments=[record,...(s.experiments||[])].slice(0,10);await save(s);if(signal?.aborted)activity.finish(activity.current.token,'cancelled','Experimento cancelado; registro salvo.');else if(Object.values(record.conditions).some(c=>c.status==='error'))activity.finish(activity.current.token,'error','Experimento registrado com erro. Inspecione as condições.');return record;
  }finally{signal?.removeEventListener('abort',cancel);mutating=false;}
}
export async function evaluate(config,{signal,onProgress=()=>{}}={}){
  if(mutating)throw Error('Aguarde a operação atual.');mutating=true;
  const cancel=()=>stopWorker();signal?.addEventListener('abort',cancel,{once:true});
  try {
    const {CORPUS,QUERIES,metrics}=await import('./evaluation.js?v=1.4.1'),applied=searchConfig(config);
    // Evaluation IDs belong to the fixture, not the user's base.
    applied.excludedIds=[];const memories=[];
    const check=()=>{if(signal?.aborted)throw new DOMException('Avaliação cancelada.','AbortError');};
    for(const m of CORPUS){check();onProgress(`Indexando corpus fictício: ${memories.length+1}/${CORPUS.length}`);memories.push({...m,vector:await rpc('embed',m.text)});}
    const rows=[];
    for(const q of QUERIES){check();onProgress(`Avaliando pergunta: ${rows.length+1}/${QUERIES.length}`);const trace=searchTrace(memories,await rpc('embed',q.text),applied);rows.push({...q,retrieved:trace.sources.map(m=>m.id),trace});}
    check();const report={id:crypto.randomUUID(),schema:'nexo-retrieval-evaluation-v1',fixture:'aurora-v1',created:new Date().toISOString(),embeddingModel:'Xenova/paraphrase-multilingual-MiniLM-L12-v2 (q8/WASM)',config:applied,corpus:CORPUS,rows,metrics:metrics(rows),note:'Corpus didático pequeno. Mede recuperação, não qualidade da resposta nem generalização.'};
  }finally{signal?.removeEventListener('abort',cancel);mutating=false;}
}
const empty=()=>({memories:[],messages:[],model:null,nextId:1});
const ready=new Promise((resolve,reject)=>{const r=indexedDB.open(storageNames().webDB,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>{db=r.result;resolve();};r.onerror=()=>reject(Error('Armazenamento indisponível. Permita dados locais neste navegador.'));});
async function read(){await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('state'),r=tx.objectStore('state').get('current');r.onsuccess=()=>resolve(r.result||empty());r.onerror=()=>reject(r.error);});}
async function save(s){phase('saving','Salvando dados no perfil local');await ready;return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(s,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Não foi possível salvar. Exporte suas memórias e confira o espaço disponível.'));tx.onabort=tx.onerror;});}
const normalize=s=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function add(s,items){
  if(!Array.isArray(items)||!items.length||items.length>100)throw Error('Importe entre 1 e 100 itens por lote.');
  const known=new Set(s.memories.map(m=>normalize(m.text))),created=[];
  for(const item of items){if(typeof item.text!=='string'||!item.text.trim()||item.text.length>6000||typeof(item.label||'')!=='string'||(item.label||'').length>48)throw Error('Texto ou categoria inválidos.');
    const key=normalize(item.text);if(known.has(key))continue;if(s.memories.length+created.length>=5000)throw Error('Limite de 5.000 memórias atingido.');known.add(key);
    const vector=unitVector(await rpc('embed',item.text.trim()),384);
    if(s.memories.some(m=>m.dimension!==384))throw Error('Embeddings incompatíveis com a base. Exporte e recrie as memórias.');
    created.push({id:s.nextId++,text:item.text.trim(),label:(item.label||'').trim(),created:new Date().toISOString(),origin:'browser',dimension:vector.length,embedding:EMBEDDING,vector});
  }
  if(created.length){s.memories.push(...created);s.model=null;s.conversationBoundary=s.messages.length;}
  return {added:created.length,new_memory_ids:created.map(m=>m.id),duplicates:items.length-created.length,prediction:null};
}
function social(text){const t=normalize(text).replace(/[!.,?]/g,'');if(/^(oi|olá|ola|oli|oi nexo|olá nexo|bom dia|boa tarde|boa noite)$/.test(t))return 'Oi! Estou aqui. Podemos conversar ou você pode usar Ensinar para guardar uma informação.';if(/^(obrigado|obrigada|valeu)$/.test(t))return 'De nada! Vamos continuar quando quiser.';return null;}
async function chat(s,body,emit){
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>6000)throw Error('Envie uma mensagem de até 6.000 caracteres.');
  const start=performance.now();let answer,knowledge=null,sources=[],added={added:0,new_memory_ids:[]},prediction=null;
  if(body.learn){added=await add(s,[{text:body.text,label:''}]);answer=added.added?'Informação guardada. Um novo neurônio está se conectando à rede.':'Essa informação já está guardada.';}
  else{answer=social(body.text);if(!answer){
    const recent=s.messages.slice(s.conversationBoundary||0);
    try{const found=lookupKnowledge(body.text,recent,await loadKnowledge());answer=found.answer;knowledge=found.knowledge;}catch{knowledge=null;}
    if(!answer){
    if(s.memories.length){const vector=await rpc('embed',body.text);sources=retrieve(s.memories,vector).map(publicMemory);prediction=predict(s.model,vector);}
    emit({type:'stage',state:'retrieving',message:`${sources.length} memórias selecionadas para o contexto`,sources});
    const messages=conversationMessages(body.text,sources,recent,knowledge);
    answer=await rpc('generate',messages,chunk=>emit({type:'delta',text:chunk}));
    if(!answer)throw Error('O modelo não produziu texto. Tente uma pergunta mais curta.');
    }
    else emit({type:'stage',state:'responding',message:'Respondendo com o repertório local revisado',sources:[]});
  }}
  s.messages.push({id:crypto.randomUUID(),created:new Date().toISOString(),role:'user',text:body.text,sources:[]},{id:crypto.randomUUID(),created:new Date().toISOString(),role:'assistant',text:answer,sources,...(knowledge?{knowledge}:{} )});if(s.messages.length>10000)throw Error('Limite de 10.000 mensagens: exporte e limpe o histórico.');await save(s);
  return {answer,sources,knowledge,prediction,learned:added.added,new_memory_ids:added.new_memory_ids,seconds:+((performance.now()-start)/1000).toFixed(2)};
}
export async function request(url,options={}){
  const parsed=new URL(url,location.origin),path=parsed.pathname.replace(/^\/api/,''),method=options.method||'GET';
  const mutation=method!=='GET';if(mutation&&mutating)return json({detail:'Aguarde a operação atual.'},409);
  if(mutation)mutating=true;
  try{const s=await read(),body=typeof options.body==='string'?JSON.parse(options.body):{};
    if(path==='/chat/stream'){
      const encoder=new TextEncoder();let cancelled=false;
      const stream=new ReadableStream({start(controller){const emit=event=>{if(!cancelled)controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));};
        chat(s,body,emit).then(result=>emit({type:'done',result})).catch(error=>emit({type:'error',detail:error.message})).finally(()=>{mutating=false;if(!cancelled)controller.close();notice.textContent='IA local no navegador · exporte suas memórias para manter um backup.';});},cancel(){cancelled=true;}});
      // Streaming owns the mutation lock until persistence finishes.
      return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
    }
    let result;
    if(path==='/reprocess'&&method==='POST'){
      const restored=[];for(const m of s.pendingMemories||[]){if(s.memories.some(existing=>existing.id===m.id))throw Error('ID pendente já existe. Restaure em novo perfil.');restored.push({...m,vector:unitVector(await rpc('embed',m.text),384),dimension:384,embedding:EMBEDDING,reprocessedAt:new Date().toISOString()});}
      s.memories.push(...restored);s.pendingMemories=[];s.model=null;s.conversationBoundary=s.messages.length;result={added:restored.length,new_memory_ids:restored.map(m=>m.id)};
    }
    else if(path==='/health')result={online:true,ready:true,chat_model:'Qwen2.5 0.5B · navegador',embedding_model:'MiniLM multilíngue · 384D',models:[]};
    else if(path==='/state')result={count:s.memories.length,dimensions:s.memories[0]?.dimension||null,categories:[...new Set(s.memories.map(m=>m.label).filter(Boolean))],labeled:s.memories.filter(m=>m.label).length,network:s.model?.metadata||null,memories:s.memories.slice(-500).map(publicMemory),messages:s.messages,capacity:5000};
    else if(path==='/graph'){const ids=(parsed.searchParams.get('selected_ids')||'').split(',').filter(Boolean).map(Number);if(ids.length>20||ids.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Use até 20 IDs de memória positivos.');result=ids.length?experimentMap(s.memories,ids):graph(s.memories);}
    else if(path==='/memories'&&method==='GET'){const q=(parsed.searchParams.get('q')||'').toLowerCase(),offset=+(parsed.searchParams.get('offset')||0);result=s.memories.filter(m=>(m.text+' '+m.label).toLowerCase().includes(q)).reverse().slice(offset,offset+500).map(publicMemory);}
    else if(path==='/memories'&&method==='POST')result=await add(s,[body]);
    else if(/^\/memories\/\d+$/.test(path)){
      const id=+path.split('/').at(-1),m=s.memories.find(m=>m.id===id);if(!m)return json({detail:'Memória não encontrada.'},404);
      if(method==='DELETE'){s.memories=s.memories.filter(m=>m.id!==id);s.model=null;s.conversationBoundary=s.messages.length;result={deleted:true};}
      else if(method==='PATCH'){if(typeof body.label!=='string'||body.label.length>48)throw Error('Categoria inválida.');m.label=body.label.trim();s.model=null;s.conversationBoundary=s.messages.length;result={updated:true};}
      else result={...publicMemory(m),preview:m.vector.slice(0,24),norm:Math.sqrt(cosine(m.vector,m.vector)),model:'Xenova/paraphrase-multilingual-MiniLM-L12-v2'};
    }
    else if(path==='/history'&&method==='DELETE'){s.messages=[];s.conversationBoundary=0;result={deleted:true};}
    else if(path==='/import')result=await add(s,body.items);
    else if(path==='/export')result={format:'nexo-memories-v1',items:s.memories.map(({text,label})=>({text,label}))};
    else if(path==='/train'){s.model=await rpc('train',s.memories);result=s.model.metadata;}
    else if(path==='/search'){const vector=await rpc('embed',body.text||body.query),trace=searchTrace(s.memories,vector,body);result={sources:trace.sources,prediction:predict(s.model,vector),trace};}
    else if(path==='/transcribe')throw Error('Whisper está disponível na edição Python local. Na web, use o ditado do teclado do dispositivo.');
    else return json({detail:'Operação indisponível.'},404);
    if(mutation)await save(s);return json(result);
  }catch(error){if(mutation)mutating=false;return json({detail:error.message},400);}
  finally{if(mutation&&path!=='/chat/stream')mutating=false;}
}
// Recording is local-Python only; avoid recording audio that cannot be transcribed.
new MutationObserver(()=>{const mic=document.querySelector('#microphone');if(mic){mic.hidden=true;}}).observe(document.querySelector('.composer-area'),{childList:true,subtree:true});
