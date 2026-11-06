import {storageNames} from '../profiles/session.js?v=1.4.1';
import {migrateCatalog,LIMITS,checkAbort} from './contracts.js?v=1.4.1';
const requestResult=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
export class ResearchStore{
  constructor(factory=globalThis.indexedDB){this.ready=new Promise((resolve,reject)=>{const r=factory.open(storageNames().researchDB,1);r.onupgradeneeded=()=>{for(const name of ['catalog','indices','files','results','active'])r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Não foi possível abrir o laboratório. Permita armazenamento local.'));});}
  async get(store,key){const db=await this.ready;return requestResult(db.transaction(store).objectStore(store).get(key));}
  async catalog(){return migrateCatalog(await this.get('catalog','current'));}
  async commit(expected,update,records=[],signal){
    checkAbort(signal);const db=await this.ready;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['catalog','indices','files','results'],'readwrite'),cancel=()=>tx.abort();signal?.addEventListener('abort',cancel,{once:true});let result,resultCount=0;
      const failure=()=>{signal?.removeEventListener('abort',cancel);reject(Error(signal?.aborted?'Importação cancelada antes do commit.':'Falha ao persistir (quota, interrupção ou conflito). O índice anterior continua ativo.'));};
      tx.onabort=tx.onerror=failure;tx.oncomplete=()=>{signal?.removeEventListener('abort',cancel);resolve(result);};
      if(records.some(r=>r.store==='results')){const count=tx.objectStore('results').count();count.onsuccess=()=>{resultCount=count.result;};}
      const r=tx.objectStore('catalog').get('current');r.onsuccess=()=>{try{
        checkAbort(signal);const current=migrateCatalog(r.result);if(current.revision!==expected)throw Error('Catálogo alterado em outra aba; atualize e tente novamente.');
        if(resultCount>=LIMITS.results)throw Error('Limite de 20 resultados; nenhum histórico foi removido.');result=update(current);result.revision=current.revision+1;
        if(result.documents.length>LIMITS.documents||result.versions.length>LIMITS.versions||result.indices.length>LIMITS.indices||result.indices.reduce((n,i)=>n+i.chunkCount,0)>LIMITS.chunks)throw Error('Capacidade do laboratório atingida. Exporte os dados antes de criar mais índices.');
        if((result.storedBytes||0)>LIMITS.storedBytes)throw Error('Limite de 100 MB do laboratório atingido.');
        tx.objectStore('catalog').put(result,'current');for(const record of records)tx.objectStore(record.store).put(record.value,record.key);
      }catch(error){signal?.removeEventListener('abort',cancel);reject(error);tx.abort();}};
    });
  }
  async appendResult(result){
    const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction('results','readwrite'),store=tx.objectStore('results'),count=store.count();count.onsuccess=()=>{if(count.result>=LIMITS.results){reject(Error('Limite de 20 resultados. Nenhum histórico foi apagado. Exporte os registros.'));tx.abort();}else store.put(result,result.id);};tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('Não foi possível salvar o resultado; o histórico anterior está preservado.'));});
  }
  async results(){const db=await this.ready;return (await requestResult(db.transaction('results').objectStore('results').getAll())).sort((a,b)=>b.created.localeCompare(a.created));}
  async active(){return await this.get('active','current')||{schema:3,revision:0,examples:[],annotations:[],rounds:[],assignments:{},model:null};}
  async saveActive(expected,update){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction('active','readwrite'),store=tx.objectStore('active'),r=store.get('current');let result;r.onsuccess=()=>{try{const state=r.result||{schema:3,revision:0,examples:[],annotations:[],rounds:[],assignments:{},model:null};if(state.revision!==expected)throw Error('Outra aba alterou as anotações. Atualize.');result=update(state);result.revision++;store.put(result,'current');}catch(e){reject(e);tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(Error('Falha ao salvar a rodada.'));});}
}
