export function modelClient(){
  let worker,seq=0;const pending=new Map();
  const stop=()=>{worker?.terminate();worker=null;for(const p of pending.values())p.reject(new DOMException('Processamento cancelado.','AbortError'));pending.clear();};
  return {stop,async call(type,payload,{signal,onProgress=()=>{},onDelta}={}){
    if(signal?.aborted)throw new DOMException('Cancelado.','AbortError');
    if(pending.size)throw Error('Aguarde a tarefa de modelo atual.');
    if(!worker){worker=new Worker(new URL('../browser/inference-worker.js?v=1.4.1',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;if(data.progress)p.onProgress({stage:'modelo',message:data.progress});else if(data.delta)p.onDelta?.(data.delta);else {pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}};worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Worker de modelos indisponível.'));stop();};}
    const cancel=()=>stop();signal?.addEventListener('abort',cancel,{once:true});
    try{return await new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject,onProgress,onDelta});worker.postMessage({id,type,payload});});}
    finally{signal?.removeEventListener('abort',cancel);}
  }};
}
