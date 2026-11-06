import {openDatabase,emptyLegacy,displayName} from './manager.js?v=1.4.1';
import {hash,EMBEDDING,exportCsv,LIMITS} from '../lab/contracts.js?v=1.4.1';
import {profileSession} from './session.js?v=1.4.1';
export const STORES=['catalog','indices','files','results','active'];
export const MAX_BACKUP=180*1024*1024;
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function entries(db,store){const tx=db.transaction(store),s=tx.objectStore(store);const [keys,values]=await Promise.all([req(s.getAllKeys()),req(s.getAll())]);return keys.map((key,i)=>({key,value:values[i]}));}
export async function readProfile(factory,profile){
  let web,research;
  try{web=await openDatabase(factory,profile.webDB,['state']);research=await openDatabase(factory,profile.researchDB,STORES);const legacy=await req(web.transaction('state').objectStore('state').get('current'))||emptyLegacy(),data={legacy,research:{}};for(const s of STORES)data.research[s]=await entries(research,s);return data;}finally{web?.close();research?.close();}
}
const b64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);};
const un64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const counts=data=>{const catalog=data.research.catalog.find(r=>r.key==='current')?.value,active=data.research.active.find(r=>r.key==='current')?.value;return {memories:data.legacy.memories.length,pendingMemories:(data.legacy.pendingMemories||[]).length,messages:data.legacy.messages.length,experiments:(data.legacy.experiments||[]).length,evaluations:(data.legacy.evaluations||[]).length,documents:catalog?.documents.length||0,versions:catalog?.versions.length||0,chunks:catalog?.indices.reduce((n,i)=>n+i.chunkCount,0)||0,annotations:active?.annotations.length||0,...Object.fromEntries(STORES.map(s=>[s,data.research[s].length])),...(data.native?{sqlite:Object.fromEntries(Object.entries(data.native.tables).map(([k,v])=>[k,v.length]))}:{})};};
export async function backupProfile(factory,profile,{originals=true,embeddings=true}={}){
  const data=structuredClone(await readProfile(factory,profile));
  if(profileSession.manager?.remote)data.native=await profileSession.manager.remote('GET','/profiles/'+profile.id+'/snapshot',null,profile);
  for(const record of data.research.files){const file=record.value;record.value={name:file.name||'original',type:file.type,size:file.size,sha256:await hash(new Uint8Array(await file.arrayBuffer())),base64:originals?b64(new Uint8Array(await file.arrayBuffer())):null};}
  // Historical experiment snapshots remain exact. Only reusable operational vectors are optional.
  if(!embeddings){data.legacy.pendingMemories=[...(data.legacy.pendingMemories||[]),...data.legacy.memories.map(({vector,...m})=>m)];data.legacy.memories=[];data.legacy.archivedModel=data.legacy.model;data.legacy.model=null;
    for(const r of data.research.indices){r.value.embedding=null;r.value.needsReindex=true;r.value.chunks=r.value.chunks.map(({vector,...c})=>c);}
    const catalog=data.research.catalog.find(r=>r.key==='current')?.value;if(catalog)catalog.indices=catalog.indices.map(i=>({...i,embedding:null,needsReindex:true}));
    for(const r of data.research.active){r.value.archivedModel=r.value.model;r.value.model=null;r.value.needsReindex=true;r.value.examples=r.value.examples.map(({vector,...e})=>e);}
  }
  const manifest={format:'nexo-profile',version:1,application:'4.0.0',created:new Date().toISOString(),profile:{id:profile.id,name:profile.name,preferences:profile.preferences,settings:profile.settings},embedding:EMBEDDING,legacyEmbedding:EMBEDDING,options:{originals,embeddings},counts:counts(data),omissions:[...(!originals?['Originais ausentes: texto e referências permanecem; reenviar arquivos para abrir PDF.']:[]),...(!embeddings?['Memórias pendentes e pool exigem reprocessamento; índices mantêm apenas busca lexical. Classificadores arquivados.']:[]),'Pesos pré-treinados e caches de modelos nunca são incluídos.']};
  if(data.legacy.memories.some(mem=>JSON.stringify(mem.embedding)!==JSON.stringify(EMBEDDING)))manifest.omissions.push('Vetores legados sem revisão compatível exigirão reprocessamento ao restaurar.');
  const bytes=new TextEncoder().encode(JSON.stringify({manifest,data})).length;if(bytes>MAX_BACKUP)throw Error(`Pacote de ${(bytes/1024/1024).toFixed(1)} MB excede 180 MB. Omita originais/embeddings e exporte resultados históricos separadamente.`);
  return {manifest,data,integrity:await hash({manifest,data})};
}
function assert(test,message){if(!test)throw Error('Backup inválido: '+message);}
function unique(rows,key='id'){const set=new Set();for(const row of rows){assert(row&&row[key]!=null,'identificador ausente');assert(!set.has(String(row[key])),'identificador repetido');set.add(String(row[key]));}return set;}
function vector(v){assert(Array.isArray(v)&&v.length===384&&v.every(Number.isFinite),'embedding inválido');const norm=Math.hypot(...v);assert(norm>.000001&&Math.abs(norm-1)<.02,'norma de embedding inválida');}
function classifier(model){if(!model)return;assert(Array.isArray(model.labels)&&model.labels.length>=2&&model.labels.length<=32&&model.labels.every(l=>typeof l==='string'&&l.length<=48),'classes do MLP');assert(Array.isArray(model.layers)&&model.layers.length===3,'camadas do MLP');const dims=[384,64,24,model.labels.length];for(let i=0;i<3;i++){const layer=model.layers[i];assert(Array.isArray(layer.w)&&layer.w.length===dims[i]*dims[i+1]&&Array.isArray(layer.b)&&layer.b.length===dims[i+1]&&layer.w.every(Number.isFinite)&&layer.b.every(Number.isFinite),'pesos do MLP');}}
export async function validateBackup(input){
  assert(typeof input==='string'&&new TextEncoder().encode(input).length<=MAX_BACKUP,'tamanho máximo de 180 MB');
  let pack;try{pack=JSON.parse(input,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error();return value;});}catch{throw Error('JSON inválido ou contém chaves proibidas.');}
  const {manifest:m,data:d,integrity}=pack||{};assert(m?.format==='nexo-profile'&&m.version===1,'formato/versão não suportados');displayName(m.profile?.name);assert(typeof m.profile.id==='string','perfil ausente');
  assert(integrity===await hash({manifest:m,data:d}),'SHA-256 não confere');assert(d?.legacy&&d.research,'dados ausentes');
  if(d.native)assert(d.native.edition==='python-sqlite-v1'&&d.native.tables&&typeof d.native.embedding==='string','dados da edição Python inválidos');
  for(const key of ['memories','messages'])assert(Array.isArray(d.legacy[key]),key+' ausente');
  for(const s of STORES){assert(Array.isArray(d.research[s]),'tabela '+s);unique(d.research[s],'key');}
  assert(d.legacy.memories.length+(d.legacy.pendingMemories||[]).length<=5000&&d.legacy.messages.length<=10000,'limite da base');unique([...d.legacy.memories,...(d.legacy.pendingMemories||[])]);unique(d.legacy.messages);
  for(const mem of [...d.legacy.memories,...(d.legacy.pendingMemories||[])])assert(Number.isSafeInteger(mem.id)&&mem.id>0&&typeof mem.text==='string'&&mem.text.length<=6000&&typeof mem.label==='string'&&mem.label.length<=48,'memória inválida');
  for(const mem of d.legacy.memories)vector(mem.vector);
  assert(Number.isSafeInteger(d.legacy.nextId)&&d.legacy.nextId>Math.max(0,...d.legacy.memories.map(m=>m.id),...(d.legacy.pendingMemories||[]).map(m=>m.id)),'próximo ID inválido');classifier(d.legacy.model);
  for(const msg of d.legacy.messages)assert(['user','assistant'].includes(msg.role)&&typeof msg.text==='string'&&msg.text.length<=100000,'mensagem inválida');
  const c=d.research.catalog.find(r=>r.key==='current')?.value;
  if(c){assert(c.schema===3&&Array.isArray(c.documents)&&Array.isArray(c.versions)&&Array.isArray(c.indices),'catálogo');assert(c.documents.length<=LIMITS.documents&&c.versions.length<=LIMITS.versions&&c.indices.length<=LIMITS.indices,'capacidade');const docs=unique(c.documents),versions=unique(c.versions),indices=unique(c.indices),chunks=new Set();
    for(const v of c.versions)assert(docs.has(String(v.documentId))&&(!v.activeIndexId||indices.has(String(v.activeIndexId))),'referência de versão');
    for(const v of c.versions)if(v.activeIndexId)assert(c.indices.find(i=>i.id===v.activeIndexId)?.versionIds?.includes(v.id),'índice ativo de outra versão');
    for(const i of c.indices){const record=d.research.indices.find(r=>r.key===i.id)?.value;assert(record&&record.id===i.id&&Array.isArray(record.chunks)&&record.chunks.length===i.chunkCount,'índice ausente');assert(record.versionIds.every(id=>versions.has(String(id))),'versão do índice');unique(record.chunks);for(const chunk of record.chunks){assert(versions.has(String(chunk.versionId))&&typeof chunk.text==='string','trecho sem versão');chunks.add(chunk.id);if(chunk.vector)vector(chunk.vector);}}
    assert(chunks.size<=LIMITS.chunks,'limite de trechos');
  }else assert(!d.research.indices.length&&!d.research.files.length,'catálogo ausente');
  assert(d.research.results.length<=LIMITS.results,'limite de resultados');
  for(const r of d.research.active){const a=r.value;assert(Array.isArray(a.examples)&&a.examples.length<=LIMITS.pool&&Array.isArray(a.annotations)&&a.annotations.length<=10000,'pool inválido');const ids=unique(a.examples);classifier(a.model);for(const e of a.examples){assert(typeof e.text==='string'&&e.text.trim()&&e.text.length<=2000&&typeof e.label==='string'&&e.label.length<=48&&['pool','train','validation','test'].includes(e.split),'exemplo inválido');if(e.vector)vector(e.vector);}for(const annotation of a.annotations)assert(ids.has(String(annotation.exampleId||annotation.id)),'anotação sem exemplo');}
  for(const r of d.research.files){const f=r.value;assert(typeof f.name==='string'&&Number.isSafeInteger(f.size)&&f.size<=LIMITS.fileBytes,'arquivo inválido');if(f.base64!=null){const bytes=un64(f.base64);assert(bytes.length===f.size&&await hash(bytes)===f.sha256,'arquivo corrompido');}}
  assert(JSON.stringify(m.counts)===JSON.stringify(counts(d)),'contagens divergentes');
  return pack;
}
function compatibleData(pack){
  const d=pack.data,m=pack.manifest,c=d.research.catalog.find(r=>r.key==='current')?.value;
  // Old installations did not record the revision. Retain their texts/IDs, require reprocessing.
  const compatible=JSON.stringify(m.embedding)===JSON.stringify(EMBEDDING),pending=d.legacy.memories.filter(mem=>JSON.stringify(mem.embedding)!==JSON.stringify(EMBEDDING));
  if(pending.length){const ids=new Set(pending.map(mem=>mem.id));d.legacy.pendingMemories=[...(d.legacy.pendingMemories||[]),...pending.map(({vector,...mem})=>mem)];d.legacy.memories=d.legacy.memories.filter(mem=>!ids.has(mem.id));d.legacy.archivedModel=d.legacy.model;d.legacy.model=null;}
  if(!compatible){for(const r of d.research.indices){r.value.embedding=null;r.value.needsReindex=true;r.value.chunks=r.value.chunks.map(({vector,...chunk})=>chunk);}if(c)c.indices=c.indices.map(i=>({...i,embedding:null,needsReindex:true}));for(const r of d.research.active){r.value.examples=r.value.examples.map(({vector,...e})=>e);r.value.archivedModel=r.value.model;r.value.model=null;r.value.needsReindex=true;}}
  return pack;
}
function mergeRows(a=[],b=[],key='id'){const result=structuredClone(a),map=new Map(a.map(r=>[String(r[key]),r]));for(const r of b){const old=map.get(String(r[key]));if(old&&JSON.stringify(old)!==JSON.stringify(r))throw Error(`Conflito no identificador ${r[key]}. Restaure em novo perfil.`);if(!old){result.push(r);map.set(String(r[key]),r);}}return result;}
export function mergeData(a,b){
  const result=structuredClone(a);for(const key of ['memories','pendingMemories','messages','experiments','evaluations'])result.legacy[key]=mergeRows(a.legacy[key],b.legacy[key]);
  if(a.legacy.model&&b.legacy.model&&JSON.stringify(a.legacy.model)!==JSON.stringify(b.legacy.model))throw Error('Classificadores distintos: restaure em novo perfil.');
  result.legacy.model=null;result.legacy.archivedModels=[a.legacy.model,b.legacy.model].filter(Boolean);result.legacy.nextId=Math.max(1,...[...result.legacy.memories,...result.legacy.pendingMemories].map(m=>m.id+1));
  for(const s of STORES){if(s==='catalog')continue;if(s==='active'&&a.research[s].length&&b.research[s].length&&JSON.stringify(a.research[s])!==JSON.stringify(b.research[s]))throw Error('Pools ou classificadores ativos distintos: restaure em novo perfil.');result.research[s]=mergeRows(a.research[s],b.research[s],'key');}
  const ca=a.research.catalog.find(r=>r.key==='current')?.value,cb=b.research.catalog.find(r=>r.key==='current')?.value;
  if(ca&&cb){const value={...ca,revision:ca.revision+1};for(const key of ['documents','versions','indices','divergences'])value[key]=mergeRows(ca[key],cb[key]);value.storedBytes=(ca.storedBytes||0)+(cb.storedBytes||0);result.research.catalog=[{key:'current',value}];}else result.research.catalog=structuredClone(a.research.catalog.length?a.research.catalog:b.research.catalog);
  if(result.legacy.memories.length+result.legacy.pendingMemories.length>5000||result.research.results.length>LIMITS.results)throw Error('Mesclagem ultrapassa a capacidade. Restaure em novo perfil.');return result;
}
export async function restoreProfile(manager,pack,{merge=false}={}){
  // Revalidate even callers that bypass the UI preview. Never trust a mutable preview object.
  pack=compatibleData(await validateBackup(JSON.stringify(pack)));
  if(pack.data.native&&!manager.remote)throw Error('Restaure este backup na edição Python para conservar os dados SQLite.');
  if(!pack.data.native&&manager.remote&&(pack.data.legacy.memories.length||pack.data.legacy.messages.length||pack.data.legacy.pendingMemories?.length))throw Error('Conversa e memórias web devem ser restauradas na edição web; os modelos e formatos Python diferem.');
  await manager.assertIdle();const release=await manager.acquire();let target;
  try{const old=manager.profile,name=merge?old.name:displayName(pack.manifest.profile.name.slice(0,35)+' (restaurado)'),remote=!merge&&manager.remote?await manager.remote('POST','/profiles',{name}):null,id=merge?old.id:remote?.id||crypto.randomUUID(),generation=crypto.randomUUID();target={...(merge?old:{}),id,name,created:new Date().toISOString(),webDB:'nexo-web-v4-'+generation,researchDB:'nexo-research-v4-'+generation,preferences:merge?old.preferences:pack.manifest.profile.preferences,settings:merge?old.settings:pack.manifest.profile.settings,revision:merge?old.revision+1:0,restoredFrom:pack.manifest.profile.id,archives:merge?[...(old.archives||[]),old.webDB,old.researchDB]:[]};
    let data=structuredClone(pack.data);if(merge){const current=await backupProfile(manager.factory,old);data=mergeData(current.data,data);}
    // Validate the merged graph as well, before writing even a staged database.
    const manifest={...pack.manifest,counts:counts(data)};await validateBackup(JSON.stringify({manifest,data,integrity:await hash({manifest,data})}));
    let web,research;
    try{web=await openDatabase(manager.factory,target.webDB,['state']);research=await openDatabase(manager.factory,target.researchDB,STORES);for(const [db,stores,records]of [[web,['state'],{state:[{key:'current',value:data.legacy}]}],[research,STORES,data.research]])await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');for(const s of stores)for(const record of records[s]){let value=record.value;if(s==='files'){if(!value.base64)continue;value=new File([un64(value.base64)],value.name,{type:value.type});}tx.objectStore(s).put(value,record.key);}tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('Restauração interrompida: dados ativos preservados. Confira a quota.'));});}finally{web?.close();research?.close();}
    if(pack.data.native){const staged=await manager.remote('POST','/profiles/'+target.id+'/stage',{snapshot:pack.data.native,merge},merge?old:target);target.nativeGeneration=staged.generation;}
    await manager.publishRestored(target,{expectedRevision:merge?old.revision:null});return target;
  }catch(e){if(target){manager.factory.deleteDatabase(target.webDB);manager.factory.deleteDatabase(target.researchDB);}throw e;}finally{await release();}
}
export function parseCsv(text){if(new TextEncoder().encode(text).length>1024*1024)throw Error('CSV: limite de 1 MB.');text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quote=false,closed=false;for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quote=false;closed=true;}else cell+=c;}else if(c==='"'&&!cell&&!closed)quote=true;else if(c===','){row.push(cell);cell='';closed=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';closed=false;}else{if(closed||c==='\"')throw Error('CSV: caractere após aspas.');cell+=c;}}if(quote)throw Error('CSV: aspas não fechadas.');row.push(cell);if(row.some(Boolean))rows.push(row);if(rows.length<2||rows.length>101)throw Error('CSV: use cabeçalho e até 100 memórias.');if(rows.some(r=>r.length!==rows[0].length))throw Error('CSV: quantidade de colunas inconsistente.');return rows;}
export function csvMemories(rows,textColumn,labelColumn){return rows.slice(1).map((row,i)=>{const text=row[textColumn],label=labelColumn<0?'':row[labelColumn];if(!text?.trim()||text.length>6000||label.length>48)throw Error('CSV: texto/categoria inválidos na linha '+(i+2));return {text,label};});}
export function csvTables(pack){const d=pack.data,c=d.research.catalog.find(r=>r.key==='current')?.value||{},active=d.research.active.find(r=>r.key==='current')?.value||{},profileId=pack.manifest.profile.id,withProfile=rows=>rows.map(row=>({profileId,...row}));const results=d.research.results.map(r=>r.value);return Object.fromEntries(Object.entries({memories:[...d.legacy.memories,...(d.legacy.pendingMemories||[]),...(d.native?.tables.memories||[])].map(({vector,...m})=>m),conversations:[...d.legacy.messages,...(d.native?.tables.messages||[])],documents:c.documents||[],versions:c.versions||[],experiments:[...(d.legacy.experiments||[]),...results.filter(r=>!String(r.kind).includes('benchmark'))],evaluations:[...(d.legacy.evaluations||[]),...results.filter(r=>String(r.kind).includes('benchmark'))],annotations:active.annotations||[]}).map(([name,rows])=>[name,'\uFEFF'+(rows.length?exportCsv(withProfile(rows)):'profileId,id'+(name==='memories'?',text,label,origin,created':name==='conversations'?',role,text,sources':name==='annotations'?',exampleId,label,at':',metadata'))]));}
