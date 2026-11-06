import {$,escape,locationText} from './ui.js?v=1.4.1';
import {pdfLibrary,pdfOptions} from './documents.js?v=1.4.1';
export function sourceViewer(store){
  const dialog=document.createElement('dialog');dialog.className='source-viewer';dialog.innerHTML='<button type="button" class="button subtle source-close">Fechar fonte</button><div class="source-content"></div>';document.body.append(dialog);let sequence=0,task,doc,renderTask;
  const close=()=>{sequence++;renderTask?.cancel();task?.destroy().catch(()=>{});doc=null;};dialog.addEventListener('close',close);$('.source-close',dialog).onclick=()=>dialog.close();
  return async function open(source,versionOverride){
    close();const id=sequence,catalog=await store.catalog(),version=versionOverride||catalog.versions.find(v=>v.id===source.versionId);if(!version)throw Error('Versão da fonte indisponível.');
    if(id!==sequence)return;const root=$('.source-content',dialog);root.replaceChildren();root.insertAdjacentHTML('beforeend',`<p class="eyebrow">FONTE LOCAL / ${escape(source.id)}</p><h2>${escape(version.name)} · v${version.ordinal}</h2><p class="body-copy">${escape(locationText(source))}<br>Publicação declarada: ${escape(version.publishedAt||'desconhecida')} · validade: ${escape(version.validFrom||'?')} a ${escape(version.validTo||'?')}<br>Importado em ${escape(version.importedAt)}. Importação não prova atualidade.</p><p class="micro muted">Offset em unidades UTF-16 do texto extraído. Nenhum documento é enviado a uma API externa.</p>`);
    if(!dialog.open)dialog.showModal();
    const text=document.createElement('pre');text.className='source-text';root.append(text);
    const locators=source.contextLocators||source.locators||[];
    const display=page=>{
      text.replaceChildren();for(const block of version.blocks.filter(b=>page==null||b.locator.page===page)){
        const ranges=locators.filter(l=>(l.page??null)===(block.locator.page??null)&&l.start<block.locator.end&&l.end>block.locator.start).map(l=>[Math.max(0,l.start-block.locator.start),Math.min(block.text.length,l.end-block.locator.start)]).sort((a,b)=>a[0]-b[0]);
        let at=0;for(const [a,b] of ranges){if(b<=at)continue;const start=Math.max(at,a);text.append(document.createTextNode(block.text.slice(at,start)));const mark=document.createElement('mark');mark.textContent=block.text.slice(start,b);text.append(mark);at=b;}text.append(document.createTextNode(block.text.slice(at)+'\n\n'));
      }
    };
    if(version.format!=='pdf'){display(null);return;}
    let page=locators[0]?.page||1;display(page);
    const controls=document.createElement('div');controls.className='research-actions';controls.innerHTML='<button class="button subtle" type="button">← Página</button><span></span><button class="button subtle" type="button">Página →</button>';root.insertBefore(controls,text);
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Página do PDF; o texto extraído e o destaque estão disponíveis abaixo.');root.insertBefore(canvas,text);
    try{
      const file=await store.get('files',version.id);if(!file)throw Error('Arquivo original não está disponível neste navegador.');const pdf=await pdfLibrary(),bytes=await file.arrayBuffer();if(id!==sequence)return;task=pdf.getDocument(pdfOptions(new Uint8Array(bytes)));doc=await task.promise;if(id!==sequence)return;
      const render=async()=>{const thisPage=page;renderTask?.cancel();controls.querySelector('span').textContent=`${page}/${doc.numPages}`;controls.children[0].disabled=page===1;controls.children[2].disabled=page===doc.numPages;display(page);const p=await doc.getPage(page);if(id!==sequence||thisPage!==page)return;const full=p.getViewport({scale:1}),view=p.getViewport({scale:Math.min(1.3,Math.max(260,dialog.clientWidth-70)/full.width)});canvas.width=view.width;canvas.height=view.height;renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport:view});try{await renderTask.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;}};
      controls.children[0].onclick=()=>{page--;render().catch(error=>{text.textContent+='\nRenderização: '+error.message;});};controls.children[2].onclick=()=>{page++;render().catch(error=>{text.textContent+='\nRenderização: '+error.message;});};await render();
    }catch(error){if(id===sequence){const warning=document.createElement('p');warning.className='research-error';warning.textContent='Não foi possível renderizar a página: '+error.message+'. O texto extraído continua acima.';root.append(warning);}}
  };
}
