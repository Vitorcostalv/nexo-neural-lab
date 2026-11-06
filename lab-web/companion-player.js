import {AnimationMixer, LoopOnce, LoopRepeat} from './vendor/three.module.js';

// All motion, including prop entry/exit and root displacement, belongs to authored clips.
// Sit/stand complete before another action; walking stops at its authored loop boundary.
const loops=new Set(['idle','walk','type','seated','read']);
export class CompanionPlayer{
  constructor(root,clips,names){
    this.root=root;this.mixer=new AnimationMixer(root);this.actions={};this.target='idle';this.current=null;this.mode='full';this.retired=[];
    for(const [key,name] of Object.entries(names)){
      const clip=clips.find(item=>item.name===name);
      const maxSeconds={walk:4,sit:3,stand:3,wave:3,satisfaction:2,doubt:2}[key]||12;
      if(!clip||!Number.isFinite(clip.duration)||!(clip.duration>0)||clip.duration>maxSeconds||!clip.tracks.length||clip.tracks.some(track=>!Array.from(track.values).every(Number.isFinite)))throw Error('Clip inválido: '+name);
      const action=this.mixer.clipAction(clip);action.setLoop(loops.has(key)?LoopRepeat:LoopOnce,loops.has(key)?Infinity:1);action.clampWhenFinished=!loops.has(key);this.actions[key]=action;
    }
    this.finished=event=>{if(event.action!==this.actions[this.current])return;
      if(this.current==='sit')this.play(['type','seated'].includes(this.target)?this.target:'stand');
      else if(this.current==='stand')this.play(['type','seated'].includes(this.target)?'sit':this.target);
      else {this.target='idle';this.play('idle');}
    };
    this.looped=event=>{if(event.action===this.actions.walk&&this.target!=='walk')this.route();};
    this.mixer.addEventListener('finished',this.finished);this.mixer.addEventListener('loop',this.looped);this.play('idle');
  }
  play(key){
    const next=this.actions[key];if(!next)throw Error('Ação ausente: '+key);
    const old=this.actions[this.current];this.retired=this.retired.filter(item=>item.action!==next);this.current=key;next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if(old&&old!==next){old.crossFadeTo(next,.18,false);this.retired.push({action:old,left:.18});}
  }
  request(key){if(!this.actions[key])return;this.target=key;if(this.mode!=='full')return;
    if(['sit','stand'].includes(this.current)||this.current==='walk'&&key!=='walk')return;this.route();
  }
  route(){
    if(['type','seated'].includes(this.current)&&this.current!==this.target)this.play('stand');
    else if(['type','seated'].includes(this.target)&&![this.target,'sit'].includes(this.current))this.play('sit');
    else if(this.current!==this.target)this.play(this.target);
  }
  setMode(mode){
    this.mode=mode;if(mode==='full'){this.route();return;}
    // Static rest avoids frozen floating feet, half-seated bodies or props in transit.
    this.mixer.stopAllAction();this.retired=[];this.current=null;this.play('idle');this.mixer.update(0);
  }
  update(dt){if(this.mode!=='full')return;dt=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));this.mixer.update(dt);
    this.retired=this.retired.filter(item=>{item.left-=dt;if(item.left<=0){if(item.action!==this.actions[this.current])item.action.stop();return false;}return true;});
  }
  dispose(){this.mixer.removeEventListener('finished',this.finished);this.mixer.removeEventListener('loop',this.looped);this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);}
}
