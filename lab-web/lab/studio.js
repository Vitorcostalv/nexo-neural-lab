import {ResearchService} from './service.js?v=1.4.1';
import {modelClient} from './model-client.js?v=1.4.1';
import {taskController,$} from './ui.js?v=1.4.1';
import {sourceViewer} from './source-viewer.js?v=1.4.1';
import {documentsView} from './documents-view.js?v=1.4.1';
import {queryView} from './query-view.js?v=1.4.1';
import {benchmarkView} from './benchmark-view.js?v=1.4.1';
import {activeView} from './active-view.js?v=1.4.1';
export const researchTitles={documents:['Toda resposta tem uma <em>origem.</em>','Documentos locais, versões e referências verificáveis.'],sources:['Pergunte. Abra a <em>fonte.</em>','Compare rankings e veja exatamente o que entrou no contexto.'],chunkbench:['Dividir também é <em>escolher.</em>','Os mesmos documentos, com evidências e orçamento equivalentes.'],evaluation:['Resultados que você pode <em>repetir.</em>','Desenvolvimento e teste separados; sem promessas de melhoria.'],active:['Aprender começa por <em>revisar.</em>','A máquina sugere; você decide o rótulo.']};
export function prepareResearchViews(){
  const explorer=document.querySelector('.explorer');for(const id of Object.keys(researchTitles)){const section=document.createElement('section');section.id='view-'+id;section.className='view content-panel research-view';section.setAttribute('aria-label',researchTitles[id][1]);explorer.append(section);}
}
export async function mountResearch({runtime,operation,toast,setView,showMap,apiFetch}){
  const client=modelClient(),models=runtime?.researchCall||client.call,task=taskController(operation,toast);let capabilities={rerank:false};
  if(!runtime)try{const response=await apiFetch('/research/capabilities');if(response.ok)capabilities=await response.json();}catch{/* Existing Python features remain usable without optional packages. */}
  const rerank=capabilities.rerank?async(query,rows,{signal,onProgress})=>{
    const response=await apiFetch('/research/rerank',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({query,documents:rows.map(r=>({id:r.id,text:r.text})),consent:true})});
    if(!response.ok)throw Error('Reranker local: HTTP '+response.status);const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result;
    try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;const event=JSON.parse(line);if(event.error)throw Error(event.error);if(event.progress)onProgress?.({stage:'reranker CPU',message:`Reranker CPU ${event.progress.percent?.toFixed(0)||''}% ${event.progress.file||''}`});if(event.result)result=event.result;}}}finally{await reader.cancel().catch(()=>{});}
    if(!result)throw Error('Reranker não retornou scores.');return result;
  }:null;
  const service=new ResearchService({models,rerank}),openRaw=sourceViewer(service.store),openSource=(source,version)=>openRaw(source,version).catch(e=>toast(e.message,true));let parts=[];
  const refreshAll=async()=>{for(const part of parts)await part.refresh();};
  parts=[documentsView({service,task,openSource,refreshAll}),queryView({service,task,openSource,showMap,rerankAvailable:!!rerank}),benchmarkView({service,task,refreshAll,rerankAvailable:!!rerank}),activeView({service,task})];
  for(const view of ['memories','documents']){const nav=document.createElement('nav');nav.className='library-navigation';nav.setAttribute('aria-label','Biblioteca');nav.innerHTML=`<button type="button" class="button subtle" data-library-view="memories" aria-pressed="${view==='memories'}">Memórias</button><button type="button" class="button subtle" data-library-view="documents" aria-pressed="${view==='documents'}">Documentos e versões</button><p>Memórias guardam o que você ensina. Documentos preservam arquivos, trechos e versões.</p>`;document.querySelector('#view-'+view).prepend(nav);nav.querySelectorAll('[data-library-view]').forEach(button=>button.onclick=()=>setView(button.dataset.libraryView));}
  const links=document.createElement('nav');links.className='research-nav';links.setAttribute('aria-label','Experimentos avançados');links.innerHTML='<button type="button" class="button subtle" data-research-view="sources">Experimentos com documentos e buscas</button><button type="button" class="button subtle" data-research-view="chunkbench">Bancada de chunking</button><button type="button" class="button subtle" data-research-view="evaluation">Avaliação ampliada</button>';document.querySelector('#view-experiments').prepend(links);
  const activeLink=document.createElement('button');activeLink.type='button';activeLink.className='button subtle';activeLink.dataset.researchView='active';activeLink.textContent='Abrir ciclo de aprendizado ativo';document.querySelector('#view-training').prepend(activeLink);
  document.querySelectorAll('[data-research-view]').forEach(button=>button.onclick=()=>setView(button.dataset.researchView));
  window.addEventListener('pagehide',()=>client.stop(),{once:true});await refreshAll();return {service,refreshAll};
}
