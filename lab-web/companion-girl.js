import {activity} from './activity-state.js?v=1.4.1';

export const POSES=Object.freeze({idle:'Em repouso',wave:'Acenando',thinking:'Pensando',walking:'Caminhando',typing:'Digitando',happy:'Feliz',confused:'Confusa',studying:'Estudando'});
export const activityPose=state=>({idle:'idle',receiving:'wave',loading:'walking',retrieving:'studying',generating:'thinking',responding:'typing',saving:'studying',training:'studying',done:'happy',error:'confused',cancelled:'confused'}[state]||'idle');

// Original articulated illustration. The previous digital creature remains in companion.js.
export const girlIllustration=()=>{const svg=`<svg class="nexo-girl" viewBox="0 0 380 440" aria-hidden="true" focusable="false">
<defs><linearGradient id="girl-jacket" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8bd8b4"/><stop offset="1" stop-color="#327c68"/></linearGradient><linearGradient id="girl-hair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#50392f"/><stop offset=".6" stop-color="#2c2425"/><stop offset="1" stop-color="#171d21"/></linearGradient><linearGradient id="girl-skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4cfb1"/><stop offset="1" stop-color="#dca282"/></linearGradient></defs>
<ellipse class="girl-shadow" cx="190" cy="405" rx="78" ry="10" fill="#96dab0" opacity=".16"/>
<g class="girl-travel"><g class="girl-body">
<g class="girl-leg girl-leg-left"><path d="M155 285 153 345" stroke="#253a43" stroke-width="31" stroke-linecap="round"/><g class="girl-shin girl-shin-left"><path d="m153 340-3 47" stroke="#293d46" stroke-width="26" stroke-linecap="round"/><path d="M137 382q13 5 26 0l6 14q-2 10-39 6-7-7 7-20" fill="#e9e9d9"/><path d="m134 398 33 0" stroke="#a0bbab" stroke-width="4"/><path d="m148 387 10 2m-12 3 12 1" stroke="#728c80" stroke-width="2"/></g></g>
<g class="girl-leg girl-leg-right"><path d="m208 285 7 59" stroke="#20343e" stroke-width="31" stroke-linecap="round"/><g class="girl-shin girl-shin-right"><path d="m215 340 6 47" stroke="#263b44" stroke-width="26" stroke-linecap="round"/><path d="M209 382q13 5 25-1l11 14q3 11-36 8-10-6 0-21" fill="#e9e9d9"/><path d="m210 399 33-1" stroke="#a0bbab" stroke-width="4"/><path d="m219 387 10 2m-9 3 12 1" stroke="#728c80" stroke-width="2"/></g></g>
<path d="M140 195q-13-41-7-75 3-52 51-53 63-5 62 66l-5 77-28 14Z" fill="url(#girl-hair)"/>
<path d="m146 199 29-13 28 0 26 14 9 85q-46 21-105 0Z" fill="url(#girl-jacket)" stroke="#9bdfbc" stroke-width="1"/>
<path d="m175 190 12 15 15-15 13 100h-44Z" fill="#e6e3cb"/>
<path d="m173 192-16 31 12 7-17 22m52-60 18 31-11 7 18 21" fill="none" stroke="#28604f" stroke-width="2"/>
<path d="m142 263 18 1m56-1 15-1" stroke="#c0ebc8" stroke-width="3" stroke-linecap="round"/>
<path d="m177 174-1 18q10 16 24 0l-3-20" fill="url(#girl-skin)"/>
<g class="girl-upper-arm girl-upper-arm-left"><path d="m141 205-23 42" stroke="#65ab8e" stroke-width="24" stroke-linecap="round"/><g class="girl-forearm girl-forearm-left"><path d="m118 246 1 34" stroke="#73b99c" stroke-width="19" stroke-linecap="round"/><g class="girl-hand girl-hand-left"><path d="m112 276-1 15q2 9 12 7 9-2 6-12l-3-12" fill="url(#girl-skin)"/><path d="m113 281-6-1q-6 4 0 10l7 1m5-5 1 8m4-9 1 7" fill="none" stroke="#bc876d" stroke-width="1.6" stroke-linecap="round"/></g></g></g>
<g id="nexo-girl-right-arm" class="girl-upper-arm girl-upper-arm-right"><path d="m222 205 23 42" stroke="#519c81" stroke-width="24" stroke-linecap="round"/><g class="girl-forearm girl-forearm-right"><path d="m245 246-3 34" stroke="#69ae91" stroke-width="19" stroke-linecap="round"/><g class="girl-hand girl-hand-right"><path d="m234 276-2 15q1 10 12 8 8-2 7-12l-3-12" fill="url(#girl-skin)"/><path d="m246 281 7-1q6 4 0 10l-6 1m-8-5-1 8m5-9-1 7" fill="none" stroke="#bc876d" stroke-width="1.6" stroke-linecap="round"/></g></g></g>
<g class="girl-head"><path d="M136 127q-5-57 49-60 60-5 61 56l-7 56-20 13-72-3Z" fill="url(#girl-hair)"/>
<ellipse cx="143" cy="140" rx="9" ry="13" fill="#dfaa8b"/><ellipse cx="232" cy="140" rx="8" ry="13" fill="#dfaa8b"/>
<path d="M146 118q5-33 39-34 40-1 44 35l-1 26q-1 32-39 45-38-8-43-42Z" fill="url(#girl-skin)"/>
<path d="M141 126q-13-49 38-55 54-8 63 43l-17 18-8-30q-22 21-57 12l-11 33Z" fill="url(#girl-hair)"/>
<path d="M152 97q25-27 63-9m-55 12q23-17 47-12" stroke="#795342" stroke-width="2" opacity=".5" fill="none" stroke-linecap="round"/>
<path class="girl-brow girl-brow-left" d="m156 128q10-6 20-1" fill="none" stroke="#5b3c30" stroke-width="3" stroke-linecap="round"/>
<path class="girl-brow girl-brow-right" d="m200 127q10-5 19 2" fill="none" stroke="#5b3c30" stroke-width="3" stroke-linecap="round"/>
<g class="girl-eyes"><path d="M153 140q10-12 23 0-11 10-23 0m46 0q11-12 23 0-12 10-23 0" fill="#fff5e9"/>
<g class="girl-pupils"><ellipse cx="166" cy="139" rx="5.5" ry="7" fill="#65816b"/><ellipse cx="210" cy="139" rx="5.5" ry="7" fill="#65816b"/><ellipse cx="166" cy="139" rx="2.9" ry="5" fill="#172c2a"/><ellipse cx="210" cy="139" rx="2.9" ry="5" fill="#172c2a"/><circle cx="168" cy="137" r="1.8" fill="#fff"/><circle cx="212" cy="137" r="1.8" fill="#fff"/></g>
<path d="M153 139q10-11 23 0m23 0q11-11 23 0" fill="none" stroke="#4d322a" stroke-width="2" stroke-linecap="round"/></g>
<path d="m187 139-3 14 6 2" fill="none" stroke="#bf896d" stroke-width="1.5" stroke-linecap="round"/>
<ellipse class="girl-cheek" cx="157" cy="155" rx="9" ry="4" fill="#d98579" opacity=".28"/><ellipse class="girl-cheek" cx="218" cy="155" rx="9" ry="4" fill="#d98579" opacity=".28"/>
<path class="girl-mouth girl-mouth-neutral" d="M178 166q10 6 20-1" fill="none" stroke="#a5655d" stroke-width="2.5" stroke-linecap="round"/>
<g class="girl-mouth girl-mouth-smile"><path d="M175 163q13 6 27 0-4 16-14 15-10 0-13-15" fill="#914f4a"/><path d="M178 165q10 4 21 0l-2 5q-10 3-17-1Z" fill="#fff0df"/></g>
<ellipse class="girl-mouth girl-mouth-open" cx="188" cy="166" rx="6" ry="4" fill="#94504a"/>
<path class="girl-mouth girl-mouth-confused" d="m179 168q9-5 19-1" fill="none" stroke="#a5655d" stroke-width="2.5" stroke-linecap="round"/>
<path d="m148 169-2 24m79-28 5 27" stroke="#181e22" stroke-width="7" stroke-linecap="round"/>
<path d="m220 118 7-3 3 5-7 4Z" fill="#b8ecbf"/><circle cx="224" cy="119" r="1.5" fill="#4b8b6d"/>
</g>
<g class="girl-prop girl-laptop"><path d="M132 226h108l-7 49h-94Z" fill="#1d3636" stroke="#92caae" stroke-width="2"/><path d="M143 235h85l-5 30h-75Z" fill="#41645c"/><path d="m154 245 16 1m-16 7h41m-39 7h29" stroke="#a7dfb5" stroke-width="2" stroke-linecap="round"/><path d="m138 275-20 13q64 13 132 0l-17-13Z" fill="#80b49e"/><path class="girl-keys" d="m142 279 81 0m-87 5 94 0" stroke="#325d50" stroke-width="2" stroke-dasharray="5 3"/><path d="m172 290 29 0" stroke="#467b66" stroke-width="2"/></g>
<g class="girl-prop girl-book"><path d="M140 246q24-10 47 0 27-9 48-1l-1 46q-28-6-47 2-24-10-47-3Z" fill="#d8d5b5" stroke="#719c7e" stroke-width="2"/><path d="m187 247 0 44" stroke="#6f9275" stroke-width="2"/><g stroke="#8ba289" stroke-width="2"><path d="m150 258 26 0m-26 9 24 0m-24 9 22 0m25-18 25-1m-25 10 24-1m-24 10 24-1"/></g><path class="girl-page" d="M187 247q16-15 43-6l-1 42q-24-4-42 9Z" fill="#efebce" stroke="#a5b494"/></g>
<use class="girl-thinking-arm" href="#nexo-girl-right-arm"/>
<g class="girl-question" fill="none" stroke="#b0dfbe" stroke-width="3" stroke-linecap="round"><path d="M270 103q-2-13 10-13 13 1 10 12-1 5-10 10v5"/><path d="M280 124v1"/></g>
</g></g></svg>`;
  const start=svg.indexOf('<g class="girl-prop girl-laptop">'),end=svg.indexOf('<use class="girl-thinking-arm"');
  return (svg.slice(0,start)+svg.slice(end)).replace('<g class="girl-upper-arm girl-upper-arm-left">',svg.slice(start,end)+'<g class="girl-upper-arm girl-upper-arm-left">');
};

export function mountCompanion(profile,{onMotionChange=null}={}){
  const root=document.createElement('section');root.id='view-companion';root.className='view active';root.setAttribute('aria-label','Companheira Nexo');
  root.innerHTML=`<div class="companion-scene girl-scene" data-state="idle" data-pose="idle" data-speaking="false"><div class="companion-coordinates" aria-hidden="true">NEXO / ATELIÊ LOCAL<br>UMA INTERFACE EM MOVIMENTO</div><div class="girl-scene-halo" aria-hidden="true"></div><button class="girl-character" type="button" aria-label="Acenar com a personagem; prévia de animação">${girlIllustration()}</button><div class="companion-signal"><span class="live-dot"></span><span data-visual>Em repouso</span></div></div><div class="companion-caption"><p class="eyebrow">SUA COMPANHEIRA DE LABORATÓRIO</p><h2 data-greeting></h2><p data-stage role="status" aria-live="polite">Pronta para conversar</p><progress hidden max="1" aria-label="Progresso real da etapa"></progress><label class="girl-motion-control">Movimento<select data-girl-motion><option value="system">Automático</option><option value="reduced">Reduzido</option><option value="off">Desativado</option></select></label><p class="girl-motion-note micro muted" data-motion-note hidden></p><details class="girl-gestures"><summary>Explorar gestos</summary><p class="micro muted">Prévia visual: estes botões não executam tarefas nem chamam a IA.</p><div class="girl-pose-buttons">${Object.entries(POSES).filter(([id])=>!['idle','wave'].includes(id)).map(([id,label])=>`<button type="button" data-preview-pose="${id}" aria-pressed="false">${label}</button>`).join('')}</div></details><p class="micro muted">Personagem ilustrada. Gestos e expressões representam a interface, não sentimentos ou consciência.</p></div>`;
  document.querySelector('#view-network').before(root);root.querySelector('[data-greeting]').textContent=`Olá, ${profile.name}. O que vamos descobrir?`;
  const motionSelect=root.querySelector('[data-girl-motion]'),motionNote=root.querySelector('[data-motion-note]'),scene=root.querySelector('.girl-scene'),visual=root.querySelector('[data-visual]'),stage=root.querySelector('[data-stage]'),character=root.querySelector('.girl-character'),previews=[...root.querySelectorAll('[data-preview-pose]')];
  let previewTimer,streamTimer,preview=null,lastEvent=activity.current,disposed=false;
  const media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced=()=>['off','reduced'].includes(document.documentElement.dataset.motion)||!!media?.matches;
  function render(event){motionSelect.value=document.documentElement.dataset.motion||profile.preferences?.motion||'system';motionNote.hidden=!reduced();motionNote.textContent='Movimento reduzido ou desativado no perfil/dispositivo. As poses permanecem visíveis, sem animação.';lastEvent=event;scene.dataset.state=event.state;scene.dataset.pose=preview||activityPose(event.state);scene.dataset.previewing=String(!!preview);visual.textContent=POSES[scene.dataset.pose]+(preview?' · prévia':'');stage.textContent=preview?`Prévia de animação: ${POSES[preview]}.${reduced()?' Movimento reduzido ou desativado: pose estática.':''}`:event.stage;for(const b of previews){b.disabled=event.active;b.setAttribute('aria-pressed',String(preview===b.dataset.previewPose));}character.disabled=event.active;const progress=root.querySelector('progress');progress.hidden=event.progress===null||!!preview;progress.value=event.progress??0;}
  function play(pose){if(lastEvent.active||!POSES[pose])return;clearTimeout(previewTimer);preview=pose;scene.dataset.speaking=String(pose==='typing');render(lastEvent);previewTimer=setTimeout(()=>{if(disposed)return;preview=null;scene.dataset.speaking='false';render(lastEvent);},4200);}
  motionSelect.disabled=!onMotionChange;motionSelect.onchange=async()=>{motionSelect.disabled=true;try{await onMotionChange?.(motionSelect.value);}catch(error){stage.textContent='Preferência não salva: '+error.message;motionSelect.value=document.documentElement.dataset.motion||'system';}finally{motionSelect.disabled=!onMotionChange;}};
  for(const button of previews)button.onclick=()=>play(button.dataset.previewPose);character.onclick=()=>play('wave');
  character.onpointermove=event=>{if(reduced())return;const r=character.getBoundingClientRect();if(!r.width||!r.height)return;const x=Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1)),y=Math.max(-1,Math.min(1,(event.clientY-r.top)/r.height*2-1));scene.style.setProperty('--gaze-x',`${x*3}px`);scene.style.setProperty('--gaze-y',`${y*2}px`);scene.style.setProperty('--look-turn',`${x*2}deg`);};
  character.onpointerleave=()=>{scene.style.setProperty('--gaze-x','0px');scene.style.setProperty('--gaze-y','0px');scene.style.setProperty('--look-turn','0deg');};
  const unsubscribe=activity.subscribe(event=>{if(event.active){clearTimeout(previewTimer);preview=null;}clearTimeout(streamTimer);scene.dataset.speaking=String(event.state==='responding'&&event.active);if(event.state==='responding'&&event.active)streamTimer=setTimeout(()=>{scene.dataset.speaking='false';},650);render(event);});
  const visibility=()=>{document.documentElement.dataset.hidden=String(document.hidden);};document.addEventListener('visibilitychange',visibility);visibility();
  const motionChanged=()=>{if(reduced())character.onpointerleave();render(lastEvent);};media?.addEventListener?.('change',motionChanged);
  const observer=new MutationObserver(motionChanged);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  const dispose=()=>{disposed=true;clearTimeout(previewTimer);clearTimeout(streamTimer);unsubscribe();observer.disconnect();media?.removeEventListener?.('change',motionChanged);document.removeEventListener('visibilitychange',visibility);};window.addEventListener('pagehide',dispose,{once:true});
  return root;
}
