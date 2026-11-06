import {phase} from '../activity-state.js?v=1.4.1';
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const milliseconds=value=>value==null?'—':`${value.toFixed(1)} ms`;
export const percent=value=>value==null?'—':`${(value*100).toFixed(1)}%`;
export const $=(selector,root=document)=>root.querySelector(selector);
export function download(data,name,type='application/json'){
  const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function locationText(source){return (source.locators||[]).map(l=>l.page?`página ${l.page}, ${l.start}–${l.end}`:l.section?.length?`${l.section.join(' › ')} · linhas ${l.lineStart}–${l.lineEnd}`:`linhas ${l.lineStart}–${l.lineEnd}, ${l.start}–${l.end}`).join('; ');}
export function researchNavigation(){return `<nav class="research-nav" aria-label="Laboratório de fontes">${[['documents','Documentos'],['sources','Consulta e fontes'],['chunkbench','Chunking'],['evaluation','Avaliação'],['active','Aprendizado ativo']].map(([view,label])=>`<button type="button" class="button subtle" data-research-view="${view}">${label}</button>`).join('')}</nav>`;}
export function answerElement(answer,sources,openSource){
  const root=document.createElement('div'),map=new Map(sources.map(s=>[s.id,s]));root.className='research-answer';let at=0;
  for(const match of answer.matchAll(/\[([CM][a-zA-Z0-9_-]+)\]/g)){
    root.append(document.createTextNode(answer.slice(at,match.index)));const source=map.get(match[1]);
    if(source){const button=document.createElement('button');button.type='button';button.className='reference-link';button.textContent=match[0];button.onclick=()=>openSource(source);root.append(button);}
    else{const span=document.createElement('span');span.className='invalid-reference';span.textContent=match[0]+' (não verificada)';root.append(span);}at=match.index+match[0].length;
  }root.append(document.createTextNode(answer.slice(at)));return root;
}
export function taskController(operation,toast){
  let controller=null,sequence=0;const bar=document.createElement('div');bar.className='research-task';bar.hidden=true;bar.innerHTML='<span role="status" id="research-progress"></span><button type="button" class="button subtle">Cancelar tarefa</button>';document.querySelector('.explorer').prepend(bar);
  bar.querySelector('button').onclick=()=>controller?.abort();
  return {run(fn){return operation(async()=>{if(controller)throw Error('Aguarde a tarefa atual.');controller=new AbortController();const id=++sequence;bar.hidden=false;bar.classList.remove('error');
    const onProgress=p=>{if(id===sequence){phase(/persist/i.test(p.stage)?'saving':/train|trein|classif/i.test(p.stage)?'training':/busca|consulta|recuper|embedding/i.test(p.stage)?'retrieving':'loading',p.message||p.stage,p.total?p.done/p.total:null);bar.querySelector('span').textContent=p.message||`${p.stage}${p.total?` · ${p.done}/${p.total}`:''}`;}};onProgress({stage:'Preparando tarefa…'});
    try {const value=await fn({signal:controller.signal,onProgress});onProgress({stage:'Concluído.'});return value;}
    catch(error){bar.classList.add('error');onProgress({stage:error.name==='AbortError'?'Tarefa cancelada; o índice anterior permanece ativo.':error.message});throw error;}
    finally{controller=null;bar.querySelector('button').disabled=true;}
  });},reset(){bar.querySelector('button').disabled=false;},get signal(){return controller?.signal;}};
}
