import {startProfiles,mountProfiles,persistControls} from './profiles/ui.js?v=1.4.1';
import {mountCompanion} from './companion.js?v=1.4.1';
import {activity,phase} from './activity-state.js?v=1.4.1';
import {readEventStream} from './chat-stream.js?v=1.3.0';
import {mountExperiments} from './experiments.js?v=1.4.1';
import {prepareResearchViews,mountResearch,researchTitles} from './lab/studio.js?v=1.4.1';
const browserMode = !!globalThis.NEXO_BROWSER;
const nativeProfileRequest=async(method,path,body,profile)=>{const response=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(sessionStorage.getItem('nexo-key')?{'X-API-Key':sessionStorage.getItem('nexo-key')}:{}),...(profile?{'X-Nexo-Profile':profile.id,...(profile.nativeGeneration?{'X-Nexo-Generation':profile.nativeGeneration}:{})}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Falha na operação de perfis locais');return data;};
const profiles=await startProfiles({remote:browserMode?null:nativeProfileRequest});
mountCompanion(profiles.profile);
const browserRuntime = browserMode ? await import('./browser/runtime.js?v=1.4.1') : null;
const profileHeaders=()=>({'X-Nexo-Profile':profiles.profile.id,...(profiles.profile.nativeGeneration?{'X-Nexo-Generation':profiles.profile.nativeGeneration}:{})});
const request = browserRuntime ? browserRuntime.request : (url,options={})=>fetch(url,{...options,headers:{...profileHeaders(),...options.headers}});
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const paths = {
  network: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="8" cy="19" r="2"/><circle cx="18" cy="18" r="2"/><path d="m7 5 10 2M6 7l2 10m2 2 6-1M18 9v7M7 7l9 9"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/>',
  expand: '<path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M3 16v5h5m-5 0 6-6m12 1v5h-5m5 0-6-6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  message: '<path d="M21 11a9 9 0 0 1-9 9H7l-5 2 2-5v-6a9 9 0 0 1 17 0Z"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  spark: '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
paths.mic = '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>';
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
function icons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
icons();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = {memories: [], messages: [], categories: [], count: 0, network: null};
let graphData = {nodes: [], edges: []}, mode = 'chat', busy = false, selectedMemory = null, currentView = 'companion';
let selectedSources = [], health = null, filterTimer, toastTimer;
const queuedBirths=new Set();let graphHydrated=false,maxSeenMemoryId=0;
function queueBirths(ids=[]){for(const id of ids)queuedBirths.add(id);}
let apiKey = sessionStorage.getItem('nexo-key') || '';
async function api(path, options = {}) {
  const response = await request('/api' + path, {...options, headers: {'Content-Type':'application/json', ...(apiKey ? {'X-API-Key':apiKey} : {}), ...options.headers}});
  const data = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map(d => d.msg).join(' · ') : data.detail;
    throw new Error(detail || `Erro HTTP ${response.status}`);
  }
  return data;
}
const post = (path, body = {}) => api(path, {method:'POST', body:JSON.stringify(body)});
async function streamChat(body,onDelta){
  const response=await request('/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream',...(apiKey?{'X-API-Key':apiKey}:{})},body:JSON.stringify(body)});
  if(!response.ok){const error=await response.json();throw new Error(typeof error.detail==='string'?error.detail:'Não foi possível enviar a mensagem.');}
  return readEventStream(response,onDelta,event=>{if(event.type==='stage'){phase(event.state,event.message);if(event.sources){selectedSources=event.sources.map(s=>s.id);highlightGraph();const token=activity.current.token;api('/graph?selected_ids='+selectedSources.join(',')).then(data=>{if(activity.current.token!==token)return;graphData=data;if(currentView==='network')drawGraph();}).catch(error=>toast(error.message,true));}}});
}
function toast(text, error = false) {
  const el = $('#toast'); el.textContent = text; el.hidden = false; el.classList.toggle('error', error);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, error ? 10000 : 5000);
}
function askConfirmation(text){
  return new Promise(resolve=>{
    let dialog=$('#confirmation-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='confirmation-dialog';document.body.append(dialog);}
    dialog.innerHTML=`<p class="eyebrow">CONFIRMAR AÇÃO</p><h2 style="margin-bottom:18px">Antes de continuar.</h2><p class="body-copy">${escape(text)}</p><div class="dialog-actions"><button class="button subtle" data-confirm="cancel">Cancelar</button><button class="button dark" data-confirm="accept">Confirmar</button></div>`;
    const finish=value=>{dialog.close();resolve(value);};
    $('[data-confirm="cancel"]',dialog).onclick=()=>finish(false);
    $('[data-confirm="accept"]',dialog).onclick=()=>finish(true);
    dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();
  });
}
function setBusy(value) {
  busy = value;
  ['#send-button','#save-memory','#train-button','#demo-button','#import-button','#new-memory','#delete-memory','#clear-chat'].forEach(s => $(s).disabled = value);
  $('#chat-form').setAttribute('aria-busy', String(value));
  $('#microphone').disabled = value;
}
async function operation(fn) {
  if (busy) return toast('Aguarde a operação atual.');
  let release; const token=activity.begin();
  setBusy(true);
  try { release=await profiles.acquire(); await fn(); activity.finish(token); if(document.querySelector('#save-status'))document.querySelector('#save-status').textContent='Dados salvos localmente'; } catch (error) { activity.finish(token,error.name==='AbortError'?'cancelled':'error',error.message); toast(error.message, true); if(document.querySelector('#save-status'))document.querySelector('#save-status').textContent='Operação não concluída: '+error.message; } finally { if(release)await release().catch(e=>toast(e.message,true));setBusy(false); }
}
async function refresh() {
  const [next, graph] = await Promise.all([api('/state'), api('/graph?selected_ids='+selectedSources.filter(Number.isSafeInteger).join(','))]);
  if(graphHydrated)queueBirths(graph.nodes.filter(node=>node.id>maxSeenMemoryId).map(node=>node.id));
  maxSeenMemoryId=Math.max(maxSeenMemoryId,...graph.nodes.map(node=>node.id));graphHydrated=true;
  state = next; graphData = graph;
  $('#metric-memories').textContent = state.count.toLocaleString('pt-BR');
  $('#metric-edges').textContent = graph.edges.length.toLocaleString('pt-BR');
  $('#metric-dimensions').textContent = state.dimensions || '—';
  $('#metric-network').textContent = state.network ? 'Treinada' : 'Não treinada';
  $('#metric-categories').textContent = `${state.categories.length} categorias`;
  $('#category-options').innerHTML = state.categories.map(c => `<option value="${escape(c)}"></option>`).join('');
  $('#graph-caption').hidden = !!state.count;
  $('#graph-mode').textContent = state.count ? 'MEMÓRIAS + REDE VISUAL' : 'REDE VISUAL · SEM MEMÓRIAS';
  $('#graph-count').textContent = `${graph.nodes.length} / ${state.count} memórias · atividade ilustrativa`;
  $('#metric-edges').title = 'Conexões entre as até 180 memórias exibidas no mapa';
  drawGraph(); renderMessages(); renderTraining();
  await renderMemories();
}
function setView(view) {
  currentView = view;
  $('.main-grid').classList.toggle('chat-layout',['companion','network'].includes(view));
  $('.main-grid').classList.toggle('experiment-layout',view==='experiments'||Object.hasOwn(researchTitles,view));
  const graphPanel=$('#graph-panel'),slot=$('#experiment-map-slot');
  if(view==='experiments'&&slot)slot.append(graphPanel);
  else if(view==='sources'&&$('#studio-map-slot'))$('#studio-map-slot').append(graphPanel);
  else if(['experiment-map-slot','studio-map-slot'].includes(graphPanel.parentElement?.id))$('#view-network').prepend(graphPanel);
  $('#graph').setAttribute('aria-label',view==='sources'?'Mapa das fontes do documento. Os trechos e referências estão disponíveis nesta área.':view==='experiments'?'Mapa do snapshot do experimento. Os trechos e identificadores estão disponíveis nesta área.':'Mapa das memórias; os mesmos dados estão disponíveis na aba Memórias.');
  if(view==='sources')$('#graph-mode').textContent='FONTES DOCUMENTAIS / SNAPSHOT';
  else if(view==='network')$('#graph-mode').textContent=state.count?'MEMÓRIAS + REDE VISUAL':'REDE VISUAL · SEM MEMÓRIAS';
  $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-'+view));
  $$('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
    if (el.classList.contains('rail-btn')) el.setAttribute('aria-current', el.dataset.view === view ? 'page' : 'false');
  });
  const titles = {companion:['Uma presença feita de <em>conexões.</em>','Seu laboratório local. Uma conversa, muitas descobertas.'],network:['Toda ideia deixa um <em>nexo.</em>','Converse. Conecte. Transforme informação em memória.'], memories:['Conhecimento que <em>permanece.</em>','Guarde, organize e encontre o que importa.'], training:['Aprender é criar <em>conexões.</em>','Treinamento real, com seus exemplos e resultados mensuráveis.'], about:['Entenda cada <em>conexão.</em>','Um laboratório aberto para explorar memória e aprendizado.']};
  titles.experiments=['Uma pergunta. Dois <em>contextos.</em>','Compare, investigue e repita. A influência da memória, à vista.'];
  Object.assign(titles,researchTitles);
  $('#page-title').innerHTML = titles[view][0]; $('#page-subtitle').textContent = titles[view][1];
  if (['network','experiments','sources'].includes(view)) requestAnimationFrame(() => {drawGraph();graphResize?.();});
}
const experimentTab=document.createElement('button');experimentTab.className='tab';experimentTab.dataset.view='experiments';experimentTab.textContent='Experimentos';$('.tabs').append(experimentTab);
prepareResearchViews();icons();
$$('[data-view]').forEach(el => el.onclick = () => setView(el.dataset.view));
function setMode(next) {
  mode = next;
  $$('.mode').forEach(el => el.classList.toggle('active', el.dataset.mode === mode));
  $('#message-input').placeholder = mode === 'learn' ? 'Conte uma informação que deseja guardar…' : 'Diga oi, faça uma pergunta, explore uma ideia…';
  $('#composer-hint').textContent = mode === 'learn' ? 'Este texto será armazenado como memória' : 'Enter envia · Shift + Enter quebra linha';
}
$$('[data-mode]').forEach(el => el.onclick = () => setMode(el.dataset.mode));
function renderMessages() {
  const root = $('#messages');
  if (!state.messages.length) {
    root.innerHTML = `<div class="welcome"><div class="welcome-icon">${icon('spark')}</div><h3>Vamos conectar ideias?</h3><p>Pode começar com um oi, tirar uma dúvida ou explorar uma ideia. A conversa funciona mesmo sem memórias.</p><button class="suggestion" data-suggest="question">Oi, Nexo! Vamos conversar? ${icon('arrow')}</button><button class="suggestion" data-suggest="learn">Quero ensinar uma informação ${icon('plus')}</button><p class="micro muted" style="margin-top:25px">Use Ensinar quando quiser guardar algo.<br>Veja a rede pulsar enquanto conversamos.</p></div>`;
    $('[data-suggest="learn"]', root).onclick = () => { setMode('learn'); $('#message-input').focus(); };
    $('[data-suggest="question"]', root).onclick = () => { setMode('chat'); $('#message-input').value = 'Oi, Nexo!'; $('#message-input').focus(); };
    return;
  }
  root.innerHTML = state.messages.map(m => `<article class="chat-message ${m.role}"><div class="message-meta"><i></i>${m.role === 'user' ? 'VOCÊ' : 'NEXO'}</div><div class="message-body">${escape(m.text)}</div>${m.sources?.length ? `<div class="source-block"><div class="source-heading">MEMÓRIAS RECUPERADAS · SIMILARIDADE</div>${m.sources.map(s => `<button class="source-item" data-source="${s.id}"><b>M${s.id} · ${Math.round(s.score*100)}%</b> ${escape(s.text.slice(0,85))}${s.text.length>85?'…':''}</button>`).join('')}</div>` : ''}</article>`).join('');
  $$('[data-source]', root).forEach(el => el.onclick = () => {
    const id = Number(el.dataset.source), memory = state.memories.find(m => m.id === id) || state.messages.flatMap(m => m.sources || []).find(m => m.id === id);
    if (memory) openMemory(memory);
  });
  $('#chat-scroll').scrollTop = $('#chat-scroll').scrollHeight;
}
$('#chat-form').onsubmit = async e => {
  e.preventDefault();
  const text = $('#message-input').value.trim();
  if (!text || busy) return;
  const learn = mode === 'learn';
  await operation(async () => {
    selectedSources=[];highlightGraph();phase(learn?'saving':'receiving',learn?'Preparando memória explícita':'Mensagem recebida');
    networkActivity('begin',text,learn);
    state.messages.push({role:'user', text, sources:[]}); renderMessages();
    const pending = document.createElement('article'); pending.className = 'chat-message';
    pending.innerHTML = `<div class="message-meta"><i></i>NEXO</div><div class="message-body"></div>`;
    $('#messages').append(pending);
    let seconds = 0,receiving=false;
    const update = () => { if(!receiving)$('.message-body', pending).textContent = `${learn ? 'Conectando uma nova memória' : 'Preparando sua resposta'}… ${seconds++}s`; $('#chat-scroll').scrollTop = $('#chat-scroll').scrollHeight; };
    update(); const timer = setInterval(update, 1000);
    try {
      const result = await streamChat({text, learn},chunk=>{
        phase('responding','Recebendo fragmentos da resposta');
        if(!receiving){receiving=true;$('.message-body',pending).textContent='';pending.classList.add('is-streaming');}
        $('.message-body',pending).textContent+=chunk;
        $('#chat-scroll').scrollTop=$('#chat-scroll').scrollHeight;
      });
      $('#message-input').value = ''; selectedSources = result.sources.map(s => s.id);
      if(result.learned){queueBirths(result.new_memory_ids);setView('network');}
      await refresh();
      networkActivity('complete',text,learn);
      if (result.prediction) {
        const note = document.createElement('div'); note.className='prediction'; note.textContent = `Classificador: ${result.prediction.label} · saída softmax ${(result.prediction.confidence*100).toFixed(1)}% (não calibrada)`;
        $('#messages').lastElementChild?.append(note);
      }
      toast(learn ? (result.learned ? 'Uma nova memória conectada.' : 'Memória já existente; sem duplicação.') : `Resposta em ${result.seconds}s · ${result.sources.length} memórias recuperadas`);
    } catch (error) {
      networkActivity('error',text,learn);
      state.messages.pop(); renderMessages(); throw error;
    } finally { clearInterval(timer); pending.remove(); }
  });
};
$('#message-input').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#chat-form').requestSubmit(); } };
// Microphone recordings are transcribed by the installed Whisper model on this PC.
const mic = document.createElement('button'); mic.type='button'; mic.id='microphone'; mic.className='mic-button'; mic.title='Ditar mensagem com Whisper local (até 30 segundos)'; mic.setAttribute('aria-label',mic.title); mic.innerHTML=icon('mic');
$('.composer-bottom').insertBefore(mic,$('#send-button'));
let recorder=null, micStream=null, recordingTimer=null;
mic.onclick=async()=>{
  if(recorder?.state==='recording'){recorder.stop();return;}
  if(busy)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast('Gravação indisponível neste navegador. Use a entrada de texto.',true);
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:true});
    recorder=new MediaRecorder(micStream);const chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=async()=>{
      clearTimeout(recordingTimer);micStream.getTracks().forEach(t=>t.stop());mic.classList.remove('recording');mic.setAttribute('aria-pressed','false');
      setBusy(false);
      const blob=new Blob(chunks,{type:recorder.mimeType});
      await operation(async()=>{
        toast('Transcrevendo no computador…');
        const response=await request('/api/transcribe',{method:'POST',headers:{'Content-Type':blob.type,...(apiKey?{'X-API-Key':apiKey}:{})},body:blob});
        const result=await response.json();if(!response.ok)throw new Error(result.detail||'Erro ao transcrever.');
        $('#message-input').value=result.text.slice(0,6000);$('#message-input').focus();
        toast(result.text?'Transcrição pronta. Revise o texto antes de enviar.':'Não identifiquei fala. Tente novamente.');
      });
    };
    recorder.onerror=()=>{micStream.getTracks().forEach(t=>t.stop());clearTimeout(recordingTimer);mic.classList.remove('recording');setBusy(false);toast('Não foi possível gravar o áudio.',true);};
    recorder.start();setBusy(true);mic.disabled=false;mic.classList.add('recording');mic.setAttribute('aria-pressed','true');toast('Gravando. Toque no microfone para parar (máximo 30 s).');
    recordingTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},30000);
  }catch(error){micStream?.getTracks().forEach(t=>t.stop());toast('Microfone indisponível ou permissão recusada. Você pode continuar por texto.',true);}
};
$('#clear-chat').onclick = async () => {
  if (!state.messages.length) return toast('A conversa já está vazia.');
  if (!await askConfirmation('Limpar o histórico visível? Suas memórias serão preservadas.')) return;
  operation(async () => { await api('/history',{method:'DELETE'}); await refresh(); toast('Histórico limpo.'); });
};
function openMemory(memory = null) {
  if (busy) return toast('Aguarde a operação atual.');
  selectedMemory = memory;
  $('#dialog-title').textContent = memory ? `Memória M${memory.id}` : 'Ensine algo ao Nexo.';
  $('#memory-text').value = memory?.text || ''; $('#memory-text').readOnly = !!memory;
  $('#memory-label').value = memory?.label || '';
  $('#delete-memory').hidden = !memory;
  $('#save-memory').innerHTML = memory ? 'Salvar categoria' : `Armazenar memória ${icon('arrow')}`;
  $('#dialog-note').textContent = memory ? 'Você pode alterar a categoria. Para corrigir o texto, exclua esta memória e adicione uma nova.' : 'O texto será convertido em um vetor e salvo neste computador.';
  $('#memory-dialog').showModal();
  (memory ? $('#memory-label') : $('#memory-text')).focus();
  let inspector=$('#vector-inspector');
  if(!inspector){inspector=document.createElement('div');inspector.id='vector-inspector';$('#memory-form').append(inspector);}
  inspector.innerHTML='';inspector.hidden=!memory;
  if(memory){
    selectedSources=[memory.id];highlightGraph();sceneController?.focus?.(memory.id);
    let metadata=$('#memory-metadata');if(!metadata){metadata=document.createElement('p');metadata.id='memory-metadata';metadata.className='graph-metadata';$('#dialog-note').after(metadata);}metadata.textContent=`Origem: ${memory.origin||'não informada'} · Categoria: ${memory.label||'sem categoria'} · Criada: ${memory.created||'não informada'}`;
    api(`/memories/${memory.id}`).then(detail=>{
      if(selectedMemory?.id!==memory.id)return;
      const max=Math.max(...detail.preview.map(Math.abs),.001);
      inspector.innerHTML=`<div class="section-label">EMBEDDING REAL<span>24 PRIMEIRAS DIMENSÕES</span></div><div class="vector-bars">${detail.preview.map((v,i)=>`<i style="height:${Math.max(3,Math.abs(v)/max*48)}px;background:${v<0?'#b79b6d':'#7b9e71'}" title="dimensão ${i+1}: ${v}"></i>`).join('')}</div><p class="micro muted">${detail.dimension} dimensões · norma ${detail.norm} · ${escape(detail.model)}</p>`;
    }).catch(error=>{inspector.textContent=error.message;});
  }
}
$('#new-memory').onclick = () => openMemory(); $('#graph-teach').onclick = () => openMemory();
$('#close-dialog').onclick = () => { if (!busy) $('#memory-dialog').close(); };
$('#memory-form').onsubmit = e => {
  e.preventDefault();
  operation(async () => {
    if (selectedMemory) {
      await api(`/memories/${selectedMemory.id}`, {method:'PATCH',body:JSON.stringify({label:$('#memory-label').value})});
      toast('Categoria atualizada. Treine novamente o classificador.');
    } else {
      const result = await post('/memories',{text:$('#memory-text').value, label:$('#memory-label').value});
      if(result.added){queueBirths(result.new_memory_ids);setView('network');}
      toast(result.added ? 'Memória armazenada e conectada.' : 'Essa memória já existe. Nenhuma duplicata criada.');
    }
    $('#memory-dialog').close(); await refresh();
  });
};
$('#delete-memory').onclick = async () => {
  if (!selectedMemory || !await askConfirmation(`Excluir permanentemente a memória M${selectedMemory.id}? O histórico da conversa é separado.`)) return;
  operation(async () => { await api(`/memories/${selectedMemory.id}`, {method:'DELETE'}); $('#memory-dialog').close(); await refresh(); toast('Memória excluída.'); });
};
let memoryOffset = 0, shownMemories = [];
async function renderMemories(append = false) {
  if (!append) memoryOffset = 0;
  const query = $('#memory-filter').value.trim();
  const items = await api(`/memories?q=${encodeURIComponent(query)}&offset=${memoryOffset}`);
  shownMemories = append ? [...shownMemories, ...items] : items;
  $('#memory-limit').textContent = `${shownMemories.length} registros exibidos${query ? ' para este filtro' : ` de ${state.count}`} · selecione para inspecionar`;
  $('#load-more').hidden = items.length < 500;
  $('#memory-list').innerHTML = shownMemories.length ? shownMemories.map(m => `<article class="memory-card" tabindex="0" role="button" data-memory="${m.id}" aria-label="Abrir memória M${m.id}"><div class="memory-card-top"><span>M${m.id} · ${new Date(m.created).toLocaleDateString('pt-BR')}</span><span class="pill">${escape(m.label || 'sem categoria')}</span></div><p class="memory-card-text">${escape(m.text.slice(0,220))}${m.text.length>220?'…':''}</p></article>`).join('') : `<div class="empty-state">${icon('database')}${query ? 'Nenhuma memória corresponde à busca.' : 'Sua biblioteca começa em branco.<br>Adicione uma memória ou importe um arquivo.'}</div>`;
  $$('[data-memory]').forEach(el => {
    const open = () => openMemory(shownMemories.find(m => m.id === Number(el.dataset.memory)));
    el.onclick = open; el.onkeydown = e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); open(); } };
  });
}
$('#memory-filter').oninput = () => { clearTimeout(filterTimer); filterTimer = setTimeout(() => renderMemories().catch(e => toast(e.message, true)), 250); };
$('#load-more').onclick = () => { memoryOffset += 500; renderMemories(true).catch(e => toast(e.message,true)); };
$('#import-button').onclick = () => $('#import-file').click();
$('#import-file').onchange = e => operation(async () => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  if (file.size > (file.name.toLowerCase().endsWith('.json')?35_000_000:2_000_000)) throw new Error('Importe TXT/Markdown de até 2 MB ou JSON de até 35 MB.');
  const raw = await file.text(); let items;
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(raw); items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items) || !items.every(i => typeof i.text === 'string' && (!i.label || typeof i.label === 'string'))) throw new Error('JSON esperado: {"items":[{"text":"informação","label":"categoria"}]}');
    items = items.map(i => ({text:i.text,label:i.label || ''}));
  } else {
    // Whole paragraphs where possible, fixed bounded splits for very long paragraphs.
    items = []; let buffer = '';
    for (const paragraph of raw.split(/\n\s*\n/)) {
      if (buffer.length + paragraph.length > 1800 && buffer.trim()) { items.push({text:buffer.trim(),label:''}); buffer=''; }
      if (paragraph.length > 1800) {
        for(let i=0; i<paragraph.length; i+=1800) items.push({text:paragraph.slice(i,i+1800).trim(),label:''});
      } else buffer += paragraph + '\n\n';
    }
    if(buffer.trim()) items.push({text:buffer.trim(),label:''});
  }
  items = items.filter(i => i.text.trim());
  if (!items.length || items.length > 5000 || items.some(i => i.text.length>6000 || i.label.length>48)) throw new Error('Importe entre 1 e 5.000 memórias, cada texto com até 6.000 caracteres e categoria com até 48.');
  toast(`Gerando embeddings para ${items.length} trechos…`);
  let added=0,duplicates=0;
  try{
    for(let i=0;i<items.length;i+=100){
      toast(`Importando ${i+1}–${Math.min(i+100,items.length)} de ${items.length} memórias…`);
      const result=await post('/import',{items:items.slice(i,i+100)});added+=result.added;duplicates+=result.duplicates;queueBirths(result.new_memory_ids);
    }
  }catch(error){if(added)setView('network');await refresh();throw new Error(`${added} memórias foram salvas antes da interrupção. ${error.message} Você pode importar novamente: duplicatas serão ignoradas.`);}
  if(added)setView('network');await refresh();toast(`${added} memórias importadas · ${duplicates} duplicatas ignoradas.`);
});
$('#export-button').onclick = () => operation(async () => {
  const result = await api('/export');
  const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url; a.download='nexo-memorias.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Exportação criada. O arquivo contém seus textos e categorias.');
});
function renderTraining() {
  const n = state.network;
  const layers = [state.dimensions || 'N',64,24,n?.labels.length || state.categories.length || '?'];
  $('#architecture').innerHTML = layers.map((value,i) => `${i?'<b>→</b>':''}<div class="network-layer"><div class="layer-nodes">${Array.from({length:[5,8,5,3][i]},()=>'<i></i>').join('')}</div><b>${value} ${i===3?'classes':'neurônios'}</b><span>${['ENTRADA · VETORES','OCULTA · RELU','OCULTA · RELU','SAÍDA · SOFTMAX'][i]}</span></div>`).join('');
  if (!n) {
    $('#training-result').innerHTML = `<div class="empty-state">${icon('activity')}Rede ainda não treinada.<br>${state.labeled} memórias rotuladas · ${state.categories.length} categorias disponíveis.</div>`;
    return;
  }
  const maxLoss = Math.max(...n.curve.flatMap(p=>[p.loss,p.validation_loss]), .001);
  const path = key => n.curve.map((p,i)=>`${i?'L':'M'}${30+i/Math.max(n.curve.length-1,1)*460},${125-p[key]/maxLoss*105}`).join(' ');
  $('#training-result').innerHTML = `<div class="training-stat-grid"><div><strong>${(n.train_accuracy*100).toFixed(0)}%</strong><span>acurácia · treino (${n.train_samples})</span></div><div><strong>${(n.validation_accuracy*100).toFixed(0)}%</strong><span>validação (${n.validation_samples})</span></div><div><strong>${n.epochs}</strong><span>épocas · ${n.seconds}s</span></div></div><div class="section-label" style="margin-bottom:12px">CURVA DE PERDA<span>TREINO — VERDE / VALIDAÇÃO — OCRE</span></div><svg class="loss-chart" viewBox="0 0 520 150" role="img" aria-label="Curva de perda durante o treinamento e validação"><path d="M30 15v110h460" fill="none" stroke="#cdd7c1"/><path d="${path('loss')}" fill="none" stroke="#4f8050" stroke-width="2"/><path d="${path('validation_loss')}" fill="none" stroke="#b28b52" stroke-width="2"/><text x="30" y="143" font-size="8" fill="#849374">época 1</text><text x="450" y="143" font-size="8" fill="#849374">${n.curve.at(-1).epoch}</text></svg><p class="micro muted">${n.parameters.toLocaleString('pt-BR')} parâmetros · Adam · melhor estado por perda de validação · ${new Date(n.trained_at).toLocaleString('pt-BR')}</p><p class="micro muted">A validação usa uma amostra pequena, nunca vista no treino. Acurácia alta nesses exemplos não comprova generalização. O treino é reproduzível (semente 42).</p>`;
}
$('#train-button').onclick = () => operation(async () => {
  toast('Treinando o classificador com os exemplos rotulados…');
  await post('/train'); await refresh(); toast('Treinamento concluído. O classificador está pronto.');
});
const demo = {
  tecnologia:['Python é uma linguagem de programação usada em ciência de dados.','Redes neurais usam camadas de neurônios e pesos ajustáveis.','Embeddings representam o significado de textos em vetores.','Bancos de dados armazenam informações de forma persistente.','O treinamento de machine learning ajusta os parâmetros de um modelo.','Uma API permite a comunicação entre aplicações de software.'],
  natureza:['Árvores absorvem gás carbônico e liberam oxigênio pela fotossíntese.','As abelhas transportam pólen entre flores e ajudam na reprodução vegetal.','A chuva faz parte do ciclo da água na natureza.','Florestas são habitats para muitas espécies de animais e plantas.','Os oceanos abrigam peixes, corais e grande diversidade de vida marinha.','As raízes das plantas absorvem água e nutrientes do solo.'],
  culinária:['Para fazer pão, misture farinha, água, fermento e sal.','O arroz pode ser refogado com alho antes de cozinhar.','Legumes assados ficam saborosos com azeite e ervas.','Uma sopa de legumes pode levar cenoura, batata e abóbora.','O molho de tomate é preparado cozinhando tomates com temperos.','Bolos crescem no forno pela ação do fermento na massa.']
};
$('#demo-button').onclick = async () => {
  if (!await askConfirmation('Adicionar 18 memórias didáticas sobre tecnologia, natureza e culinária? Elas serão identificadas pela origem de importação e poderão ser excluídas individualmente.')) return;
  operation(async () => { toast('Gerando os embeddings dos 18 exemplos…'); const result = await post('/import',{items:Object.entries(demo).flatMap(([label,texts])=>texts.map(text=>({text,label})))});if(result.added){queueBirths(result.new_memory_ids);setView('network');} await refresh(); toast(`${result.added} exemplos adicionados. Agora você pode treinar a rede.`); });
};
async function checkHealth() {
  try { health = await api('/health'); $('#connection').className='status '+(health.ready?'ready':'error'); $('#status-text').textContent=browserMode?'IA no navegador':health.ready?'Modelos conectados':health.online?'Modelo ausente':'Ollama desconectado'; }
  catch(error) { $('#connection').className='status error'; $('#status-text').textContent='Conexão necessária'; health={error:error.message}; }
}
$('#connection').onclick = async () => {
  await checkHealth();
  $('#connection-details').innerHTML = health.error ? `<p class="body-copy">${escape(health.error)}</p>` : `<div class="connection-model"><small>MODELO DE LINGUAGEM</small>${escape(health.chat_model)}</div><div class="connection-model"><small>MODELO DE EMBEDDINGS</small>${escape(health.embedding_model)}</div><div class="connection-model"><small>AMBIENTE</small>${health.ready?'Pronto para conversar e gerar embeddings.':'Execute start.cmd e verifique os modelos instalados.'}</div>`;
  $('#api-key').value=apiKey; $('#connection-dialog').showModal();
};
$('#close-connection').onclick=()=>$('#connection-dialog').close();
$('#save-key').onclick=async()=>{apiKey=$('#api-key').value.trim();sessionStorage.setItem('nexo-key',apiKey);$('#connection-dialog').close();await checkHealth();refresh().catch(e=>toast(e.message,true));};

// A living visual network is distinct from persisted memory nodes.
let graphResize=null, drawGraph=()=>{}, highlightGraph=()=>{}, sceneController=null,experimentGraph=null,studioGraph=null,studioSources=[],studioOpenSource=null;
let activityTimer=null,integrating=false,graphMotionRunning=true,lastBirthState={count:0,phase:'idle'};
function showBirthState(info){
  lastBirthState=info;integrating=info.count>0;clearTimeout(activityTimer);
  $('#graph-panel').classList.toggle('is-integrating',integrating);
  const status=$('#graph-activity'),plural=info.count>1;
  if(integrating){
    const labels={forming:plural?'Novos neurônios ganhando forma…':'Novo neurônio ganhando forma…',connecting:'Sinapses crescendo e conectando…',completing:'Conexões recebidas · completando a integração…'};
    status.textContent=graphMotionRunning?(labels[info.phase]||labels.forming):'Integração pausada · retome o movimento para continuar';
  }else if(info.phase==='complete'){
    status.textContent='Integração concluída · novo conhecimento conectado';
    activityTimer=setTimeout(()=>{status.textContent=graphMotionRunning?'Rede em movimento · atividade visual ilustrativa':'Movimento pausado · pressione ▶ para retomar';},2500);
  }else status.textContent=graphMotionRunning?'Rede em movimento · atividade visual ilustrativa':'Movimento pausado · pressione ▶ para retomar';
}
function showMotion(running){graphMotionRunning=running;if(integrating)showBirthState(lastBirthState);else $('#graph-activity').textContent=running?'Rede em movimento · atividade visual ilustrativa':'Movimento pausado · pressione ▶ para retomar';}
function renderSceneGraph(){
  if(currentView==='sources'&&studioGraph)sceneController.draw(studioGraph,selectedSources,[]);
  else if(currentView==='experiments'&&experimentGraph)sceneController.draw(experimentGraph,selectedSources,[]);
  else {sceneController.draw(graphData,selectedSources,[...queuedBirths]);queuedBirths.clear();}
}
function selectGraphMemory(memory){
  if(currentView==='sources'&&studioOpenSource){studioOpenSource(studioSources.find(s=>s.id===memory.id)||memory);return;}
  if(currentView==='experiments'||currentView==='sources')toast(`Snapshot ${memory.id}: ${memory.text}`);
  else openMemory(memory);
}
function networkActivity(stage,text='',learn=false){
  const panel=$('#graph-panel'), status=$('#graph-activity');
  clearTimeout(activityTimer);
  panel.classList.toggle('is-thinking',stage==='begin');
  sceneController?.activity(stage==='begin'?'begin':'finish',text);
  if(integrating)return;
  if(stage==='begin')status.textContent=learn?'Conectando uma nova memória…':'Conectando ideias para responder…';
  else if(stage==='error')status.textContent='A conexão visual desacelera · confira a mensagem de erro';
  else status.textContent=learn?'Memória conectada':selectedSources.length?`${selectedSources.length} memórias ativadas na resposta`:'Ideia respondida · a conversa continua';
  if(stage!=='begin')activityTimer=setTimeout(()=>{status.textContent='Rede em movimento · atividade visual ilustrativa';},4500);
}
async function initGraph(){
  try{
    const {createNeuralScene}=await import('./neural-scene.js?v=1.3.0');
    sceneController=createNeuralScene({container:$('#graph'),isVisible:()=>['network','experiments','sources'].includes(currentView),
      onSelect:selectGraphMemory,buttonHTML:icon,onBirth:showBirthState,
      onMotion:showMotion,
      onHover:node=>{const tip=$('#node-tooltip');tip.hidden=!node;if(node)tip.textContent=`M${node.id} · ${node.label||'sem categoria'}\n${node.text.slice(0,150)}`;}});
    drawGraph=renderSceneGraph;
    highlightGraph=()=>sceneController.highlight(selectedSources);
    graphResize=()=>sceneController.resize();
    sceneController.setMotion?.(profiles.profile.preferences?.motion||'system');drawGraph();window.addEventListener('pagehide',()=>sceneController.dispose(),{once:true});
  }catch(error){
    console.warn('WebGL unavailable, using a living 2D projection.',error);
    const {createCanvasScene}=await import('./neural-canvas.js?v=1.3.0');
    sceneController=createCanvasScene({container:$('#graph'),isVisible:()=>['network','experiments','sources'].includes(currentView),buttonHTML:icon,onSelect:selectGraphMemory,onBirth:showBirthState,onMotion:showMotion});
    drawGraph=renderSceneGraph;highlightGraph=()=>sceneController.highlight(selectedSources);graphResize=()=>sceneController.resize();
    sceneController.setMotion?.(profiles.profile.preferences?.motion||'system');drawGraph();$('#graph-mode').textContent='REDE VISUAL 2D';
    window.addEventListener('pagehide',()=>sceneController.dispose(),{once:true});
  }
}
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#graph-panel').requestFullscreen();}catch{toast('Seu navegador não permite tela cheia.');}};
const profileUI=mountProfiles(profiles,{toast,reprocessMemories:browserRuntime?()=>operation(async()=>{await post('/reprocess');await refresh();}):null,importMemories:items=>operation(async()=>{phase('saving','Importando memórias explícitas');const result=await post('/import',{items});await refresh();toast(`${result.added} memórias importadas.`);}),motion:value=>{document.documentElement.dataset.motion=value;sceneController?.setMotion?.(value);}});
document.documentElement.dataset.motion=profiles.profile.preferences?.motion||'system';
const graphReady=initGraph().catch(error=>{console.error('Visualização indisponível',error);toast('Não foi possível carregar o mapa. A conversa continua disponível; recarregue para tentar novamente.',true);});
await mountExperiments({runtime:browserRuntime,operation,toast,onRecord:record=>{
  experimentGraph=record.graph||null;selectedSources=record.trace?.sources.map(m=>m.id)||[];if(currentView==='experiments')drawGraph();
},highlight:ids=>{selectedSources=ids;highlightGraph();return (experimentGraph||graphData).nodes.some(node=>ids.includes(node.id));}}).catch(error=>toast(error.message,true));
await mountResearch({runtime:browserRuntime,operation,toast,setView,apiFetch:(path,options={})=>request('/api'+path,{...options,headers:{...(apiKey?{'X-API-Key':apiKey}:{}),...options.headers}}),showMap:(sources,onSelect)=>{
  studioOpenSource=onSelect;studioSources=sources;const nodes=sources.slice(0,20).map((s,i)=>({...s,position:[Math.cos(i*2.399),Math.sin(i*2.399),0]})),edges=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(nodes[i].versionId===nodes[j].versionId)edges.push({source:nodes[i].id,target:nodes[j].id,score:1,relation:'same-document-version'});
  studioGraph={nodes,edges};selectedSources=nodes.map(n=>n.id);if(currentView==='sources')drawGraph();
}}).catch(error=>toast('Laboratório de fontes: '+error.message,true));
await Promise.all([checkHealth(),refresh().catch(error=>toast(error.message,true))]);
await graphReady;
setInterval(()=>{if(!document.hidden&&!busy)checkHealth();},30000);

persistControls(profiles,toast);
setView('companion');
