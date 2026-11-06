import {activity} from './activity-state.js?v=1.4.1';
import {companionAsset} from './companion-asset.js?v=1.4.1';
export const POSES=Object.freeze({idle:'Em repouso',wave:'Acenando',thinking:'Pensando',walking:'Passos no lugar',seated:'Sentada',typing:'Digitando',happy:'Feliz',confused:'Confusa',studying:'Estudando'});
export const activityPose=state=>({idle:'idle',receiving:'wave',loading:'walking',retrieving:'studying',generating:'thinking',responding:'typing',saving:'studying',training:'studying',done:'happy',error:'confused',cancelled:'idle'}[state]||'idle');
const clipFor=pose=>({idle:'idle',wave:'wave',thinking:'idle',walking:'walk',seated:'seated',typing:'type',happy:'satisfaction',confused:'doubt',studying:'read'}[pose]||'idle');
const loadScene=(...args)=>import('./companion-webgl.js?v=1.4.1').then(module=>module.createCompanion3D(...args));

export function mountCompanion(profile,{onMotionChange=null,assetStatus=companionAsset,createScene=loadScene}={}){
  const root=document.createElement('section');root.id='view-companion';root.className='view active';root.setAttribute('aria-label','Companheira Nexo');
  root.innerHTML=`<div class="companion-scene girl-scene" data-state="idle" data-pose="idle" data-speaking="false" data-presentation="static"><div class="companion-coordinates" aria-hidden="true">NEXO / ATELIÊ LOCAL</div><div class="girl-character"><img class="companion-static" src="/assets/companion-static.svg" alt="Companheira Nexo com cabelo escuro e roupa verde"><div class="companion-canvas"></div></div><div class="companion-signal"><span class="live-dot"></span><span data-visual>Apresentação estática</span></div></div><div class="companion-caption"><p class="eyebrow">SUA COMPANHEIRA DE LABORATÓRIO</p><h2 data-greeting></h2><p data-stage role="status" aria-live="polite"></p><progress hidden max="1" aria-label="Progresso real da etapa"></progress><label class="girl-motion-control">Movimento<select data-girl-motion><option value="system">Automático</option><option value="reduced">Reduzido</option><option value="off">Desativado</option></select></label><p class="girl-motion-note micro muted" data-motion-note></p><p class="micro muted" data-asset-note></p></div>`;
  // Resolve the portrait relative to this module in both Python and nested Pages builds.
  root.querySelector('.girl-character').setAttribute('role','img');root.querySelector('.girl-character').setAttribute('aria-label','Companheira Nexo: menina estilizada de cabelo escuro e roupa verde.');
  root.querySelector('img').src=new URL(assetStatus.asset?.fallback||'./companion-static.svg',import.meta.url).href;
  document.querySelector('#view-network').before(root);root.querySelector('[data-greeting]').textContent=`Olá, ${profile.name}. O que vamos descobrir?`;
  const scene=root.querySelector('.girl-scene'),host=root.querySelector('.companion-canvas'),portrait=root.querySelector('img'),stage=root.querySelector('[data-stage]'),visual=root.querySelector('[data-visual]'),note=root.querySelector('[data-asset-note]'),motionNote=root.querySelector('[data-motion-note]'),motionSelect=root.querySelector('[data-girl-motion]'),media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let event=activity.current,composing=false,engine=null,loading=false,failed=false,disposed=false,inViewport=true,raf=null,lastStamp=null,mode='full',initialized=false;const controller=new AbortController();
  const supported=pose=>!!assetStatus.asset?.clips?.[clipFor(pose)];
  const actualPose=pose=>pose==='thinking'&&supported('seated')?'seated':supported(pose)?pose:['typing','studying'].includes(pose)&&supported('seated')?'seated':'idle';
  const desiredPose=()=>actualPose(event.state==='idle'&&composing?'seated':activityPose(event.state));
  note.textContent=assetStatus.status==='ready'?(assetStatus.asset?.note||'Personagem ilustrativa; gestos não indicam consciência.'):assetStatus.reason;
  const visible=()=>initialized&&!disposed&&!document.hidden&&inViewport&&root.classList.contains('active');
  function pause(){if(raf!==null)cancelAnimationFrame(raf);raf=null;lastStamp=null;}
  function status(){const pose=desiredPose();scene.dataset.state=event.state;scene.dataset.pose=engine&&mode==='full'?pose:'idle';scene.dataset.trigger=event.state==='idle'&&composing?'composer':event.state;stage.textContent=event.stage;
    visual.textContent=engine&&mode==='full'?POSES[pose]:'Apresenta\u00e7\u00e3o est\u00e1tica';const progress=root.querySelector('progress');progress.hidden=event.progress===null;progress.value=event.progress??0;}
  function fail(error){if(disposed)return;pause();engine?.dispose();engine=null;failed=true;portrait.hidden=false;scene.dataset.presentation='static';note.textContent='3D indisponível. Apresentação estática mantida; conversa e dados continuam disponíveis.';root.companion.error=error.message;status();}
  function loop(stamp){raf=null;if(!visible()||!engine)return;const dt=lastStamp===null?0:Math.min(.1,(stamp-lastStamp)/1000);lastStamp=stamp;try{engine.render(dt);scene.dataset.clip=engine.player.current;if(mode==='full')raf=requestAnimationFrame(loop);}catch(error){fail(error);}}
  async function wake(){if(!visible())return;
    if(!engine&&!loading&&!failed&&assetStatus.status==='ready'&&mode==='full'){
      loading=true;note.textContent='Carregando personagem 3D…';try{const loaded=await createScene(host,assetStatus.asset,{signal:controller.signal,onFailure:fail});if(disposed||failed){loaded.dispose();return;}engine=loaded;engine.player.setMode(mode);engine.player.request(clipFor(desiredPose()));portrait.hidden=false;scene.dataset.presentation='3d';note.textContent=assetStatus.asset?.note||'Personagem 3D; movimentos acompanham suas interações.';status();}catch(error){if(!disposed)fail(error);}finally{loading=false;}
    }
    if(engine&&visible()&&raf===null){try{engine.render(0);portrait.hidden=true;if(mode==='full')raf=requestAnimationFrame(loop);}catch(error){fail(error);}}
  }
  function request(){engine?.player.request(clipFor(desiredPose()));status();wake();}
  const unsubscribe=activity.subscribe(value=>{event=value;if(event.state!=='idle')composing=false;request();});
  function composerInteraction(inputEvent){if(!inputEvent.target.matches?.('#message-input'))return;composing=inputEvent.type!=='focusout'&&document.activeElement===inputEvent.target&&!!inputEvent.target.value.trim();if(!event.active)request();}
  for(const name of ['input','focusin','focusout'])document.addEventListener(name,composerInteraction);
  function motionChanged(){const pref=document.documentElement.dataset.motion||profile.preferences?.motion||'system';motionSelect.value=pref;mode=pref==='off'?'off':pref==='reduced'||media?.matches?'reduced':'full';engine?.player.setMode(mode);motionNote.hidden=mode==='full';motionNote.textContent=mode==='off'?'Movimento desativado.':'Movimento reduzido: apresentação estática para preservar os contatos.';pause();request();}
  motionSelect.disabled=!onMotionChange;motionSelect.onchange=async()=>{motionSelect.disabled=true;try{await onMotionChange?.(motionSelect.value);}catch(error){stage.textContent='Preferência não salva: '+error.message;motionSelect.value=document.documentElement.dataset.motion||'system';}finally{motionSelect.disabled=!onMotionChange;}};
  const visibility=()=>{if(visible())wake();else pause();};document.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',motionChanged);
  const motionObserver=new MutationObserver(motionChanged);motionObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});const viewObserver=new MutationObserver(visibility);viewObserver.observe(root,{attributes:true,attributeFilter:['class']});const viewport=globalThis.IntersectionObserver?new IntersectionObserver(entries=>{inViewport=entries[0]?.isIntersecting??true;visibility();}):null;viewport?.observe(scene);
  const dispose=()=>{if(disposed)return;disposed=true;for(const name of ['input','focusin','focusout'])document.removeEventListener(name,composerInteraction);controller.abort();pause();engine?.dispose();engine=null;unsubscribe();motionObserver.disconnect();viewObserver.disconnect();viewport?.disconnect();document.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',motionChanged);window.removeEventListener('pagehide',dispose);};window.addEventListener('pagehide',dispose,{once:true});
  root.companion={dispose,get engine(){return engine;},get loading(){return loading;}};initialized=true;motionChanged();return root;
}
