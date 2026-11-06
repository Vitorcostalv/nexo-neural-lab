import {CORPUS,QUERIES} from './evaluation.js?v=1.4.1';
import {createExperiment,runExperiment} from './experiment-core.js?v=1.4.1';
import {experimentMap} from '../experiment-map.js?v=1.4.1';
export const DEMO_QUESTION=QUERIES[0].text;
function pause(signal){return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Demonstração cancelada.','AbortError'));
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Demonstração cancelada.','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},90);
  signal?.addEventListener('abort',abort,{once:true});
});}
export async function demoExperiment(config,{signal,onUpdate=()=>{}}={}){
  const snapshot=CORPUS.map(m=>({...m,dimension:2,vector:m.id===1?[1,0]:[0,1],origin:'demo-fictional'}));
  const record=createExperiment(snapshot,DEMO_QUESTION,config);record.mode='simulation';record.embeddingModel='Vetores artificiais 2D; sem embeddings de modelo';
  const publish=r=>{
    if(r.trace&&!r.graph)r.graph=experimentMap(snapshot,r.trace.sources.map(m=>m.id));
    for(const c of Object.values(r.conditions)){c.searchMs=null;c.appliedParameters={};}
    if(r.trace)for(const key of Object.keys(r.trace.timings))r.trace.timings[key]=null;
    onUpdate(r);
  };
  await runExperiment(record,{signal,onUpdate:publish,embed:async()=>[1,0],prepare:async()=>({model:'Nenhum modelo — respostas roteirizadas',runtime:'Demonstração sem download',backend:'simulation',seedSupported:false,seedNote:'Não se aplica: simulação',loadMs:null,warmupMs:null,cached:false}),generate:async(messages,parameters,onDelta)=>{
    const answer=messages[0].content.includes('[M1] O observatório')?'O observatório Aurora fica em Recife. [M1]':'Não tenho essa informação no contexto fornecido.';
    for(const word of answer.split(' ')){await pause(signal);onDelta(word+' ');}
    return {answer,generationMs:null,firstTokenMs:null};
  }});
  record.parameters={};record.snapshot=record.snapshot.map(({vector,...m})=>m);publish(record);return record;
}
