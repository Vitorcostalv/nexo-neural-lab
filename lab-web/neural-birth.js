const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
export const BIRTH_DURATION=3.6;

export function birthProgress(age){
  const reveal=1-(1-clamp(age/.85))**3;
  const settle=smooth((age-2.65)/.95);
  return {age,reveal,connect:smooth((age-.55)/2),settle,
    scale:reveal*(1+.4*Math.sin(clamp(age/BIRTH_DURATION)*Math.PI)),
    flash:Math.exp(-(((age-2.7)/.25)**2)),
    phase:age<.55?'forming':age<2.65?'connecting':age<BIRTH_DURATION?'completing':'complete',
    done:age>=BIRTH_DURATION};
}

export function connectionProgress(age,index=0){return smooth((age-.55-index*.18)/1.8);}

export function arrivalPosition(target,id){
  const angle=id*2.399963;
  return [target[0]+Math.cos(angle)*1.45,target[1]+1.1+Math.sin(angle)*.4,target[2]+Math.sin(angle)*1.2];
}

export function interpolatePosition(from,to,progress){const p=smooth(progress);return from.map((v,i)=>v+(to[i]-v)*p);}

export function integrationAnchors(nodes,visualNodes,count=3){
  return nodes.flatMap(node=>visualNodes.map((position,index)=>({index,distance:position.reduce((sum,v,k)=>sum+(v-node.position[k])**2,0)}))
    .sort((a,b)=>a.distance-b.distance).slice(0,count)
    .map((neighbor,slot)=>({memory:node.id,visual:neighbor.index,slot})));
}

export class BirthTimeline{
  constructor(){this.entries=new Map();}
  add(ids,time){let order=0;for(const id of new Set(ids)){if(this.entries.has(id))continue;this.entries.set(id,time+Math.min(order++,12)*.1);}}
  state(id,time){const start=this.entries.get(id);return start===undefined?null:birthProgress(time-start);}
  prune(ids){const keep=new Set(ids);for(const id of this.entries.keys())if(!keep.has(id))this.entries.delete(id);}
  finish(time){const done=[];for(const [id,start]of this.entries)if(time-start>=BIRTH_DURATION){done.push(id);this.entries.delete(id);}return done;}
  summary(time){if(!this.entries.size)return {count:0,phase:'idle'};const oldest=Math.min(...[...this.entries.values()].map(start=>time-start));return {count:this.entries.size,phase:birthProgress(oldest).phase};}
}
