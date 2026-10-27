// Deterministic animation math; all visual scaffolding is separate from saved memories.
export function elapsedSeconds(stamp,last){return Math.min(1.5,Math.max(0,(stamp-last)/1000))||1/30;}
export function topology(count=112){
  const nodes=Array.from({length:count},(_,i)=>{
    const y=1-2*(i+.5)/count, r=Math.sqrt(1-y*y), angle=i*2.3999632297;
    const fold=1+.15*Math.sin(angle*3)*Math.sin(i*.27);
    return [r*Math.cos(angle)*2.2*fold,y*1.9,r*Math.sin(angle)*1.8*fold];
  });
  const edges=[],seen=new Set();
  nodes.forEach((p,i)=>{
    const nearest=nodes.map((q,j)=>({j,d:q.reduce((s,v,k)=>s+(v-p[k])**2,0)})).filter(v=>v.j!==i).sort((a,b)=>a.d-b.d).slice(0,3);
    nearest.forEach(({j})=>{const key=[Math.min(i,j),Math.max(i,j)].join(':');if(!seen.has(key)){seen.add(key);edges.push([i,j]);}});
  });
  return {nodes,edges};
}

export function deformation(base,index,time,energy=0,reduced=false){
  const drift=reduced?.06:.19;
  const breathe=1+Math.sin(time*.95)*.07;
  return base.map((v,k)=>v*breathe+Math.sin(time*(.7+k*.11)+index*1.71+k)*drift*(1+energy*.7));
}

export function curvePoint(a,b,t,phase=0,bend=.24){
  // Endpoints are preserved, with an S bend for intertwining axons.
  const shape=Math.sin(Math.PI*t)*Math.sin(2*Math.PI*t+phase)*bend;
  return a.map((v,k)=>v+(b[k]-v)*t+Math.sin(phase+k*2.094)*shape);
}

export function activityEnergy(time,active,finished=-Infinity){
  return active ? .82+.12*Math.sin(time*2.6) : .13+.025*Math.sin(time*.8)+.7*Math.exp(-Math.max(0,time-finished)/1.3);
}

export function queryLinks(count,seed=0){
  return Array.from({length:28},(_,i)=>{
    const a=(i*17+seed)%count;
    let b=(i*31+seed*3+Math.floor(count/2))%count;
    if(b===a)b=(b+1)%count;
    return [a,b];
  });
}
