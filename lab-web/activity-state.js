const states=new Set(['idle','receiving','loading','retrieving','generating','responding','saving','training','done','error','cancelled']);
export class ActivityState{
  constructor(){this.sequence=0;this.current={state:'idle',stage:'Pronto para conversar',token:0,active:false,progress:null};this.listeners=new Set();}
  subscribe(fn){this.listeners.add(fn);fn(this.current);return()=>this.listeners.delete(fn);}
  begin(stage='Recebendo sua ação'){clearTimeout(this.timer);const token=++this.sequence;this.current={state:'receiving',stage,token,active:true,progress:null};this.emit();return token;}
  set(token,state,stage,progress=null){if(token!==this.current.token||!this.current.active||!states.has(state)||state==='idle')return false;this.current={...this.current,state,stage,progress:Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):null};this.emit();return true;}
  finish(token,state='done',stage='Operação concluída'){if(!this.set(token,state,stage))return;this.current.active=false;this.emit();this.timer=setTimeout(()=>{if(this.current.token!==token)return;this.current={state:'idle',stage:'Pronto para conversar',token,active:false,progress:null};this.emit();},2200);}
  emit(){for(const fn of this.listeners)fn(this.current);}
}
export const activity=new ActivityState();
export const phase=(state,stage,progress=null)=>activity.set(activity.current.token,state,stage,progress);
