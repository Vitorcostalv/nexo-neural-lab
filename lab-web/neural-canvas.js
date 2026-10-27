import {topology,deformation,curvePoint,activityEnergy,elapsedSeconds} from './neural-motion.js?v=1.3.0';
import {BirthTimeline,arrivalPosition,interpolatePosition,connectionProgress,integrationAnchors} from './neural-birth.js?v=1.3.0';

// The non-WebGL path preserves animation, interaction and activity feedback.
export function createCanvasScene({container,isVisible,buttonHTML,onSelect,onBirth,onMotion}){
  container.replaceChildren();const canvas=document.createElement('canvas');container.append(canvas);
  canvas.dataset.renderer='canvas2d';
  const ctx=canvas.getContext('2d'),base=topology(72);
  let data={nodes:[],edges:[]},selected=new Set(),time=0,last=0,frames=0,raf,motion=true,active=false,finished=-Infinity,dirty=true,disposed=false,zoom=1;
  let memoryHits=[],anchors=[],birthKey='';const births=new BirthTimeline(),origins=new Map(),targets=new Map(),displayed=new Map(),moves=new Map();
  function resize(){const w=container.clientWidth,h=container.clientHeight;canvas.width=Math.round(w);canvas.height=Math.round(h);dirty=true;}
  function birthStatus(complete=false){const state=births.summary(time),key=`${state.count}:${state.phase}`;canvas.dataset.births=String(state.count);canvas.dataset.birthStage=state.phase;if(key!==birthKey||complete){birthKey=key;onBirth?.(complete&&!state.count?{count:0,phase:'complete'}:state);}}
  function draw(next,ids=[],newIds=[]){
    const visible=new Set(next.nodes.map(n=>n.id));births.prune(visible);births.add(newIds.filter(id=>visible.has(id)),time);
    if(newIds.some(id=>visible.has(id)))zoom=Math.min(1,zoom);
    for(const map of [origins,targets,displayed,moves])for(const id of map.keys())if(!visible.has(id))map.delete(id);
    data=next;selected=new Set(ids);
    for(const node of next.nodes){
      const target=node.position.map(v=>v*2.2),previous=displayed.get(node.id);targets.set(node.id,target);
      if(births.entries.has(node.id)&&!origins.has(node.id))origins.set(node.id,arrivalPosition(target,node.id));
      if(previous&&!births.entries.has(node.id))moves.set(node.id,{from:previous,at:time});
      if(!previous)displayed.set(node.id,origins.get(node.id)||target);
    }
    anchors=integrationAnchors(next.nodes.map(n=>({id:n.id,position:targets.get(n.id)})),base.nodes);
    birthStatus();dirty=true;
  }
  function activity(stage){active=stage==='begin';if(!active)finished=time;canvas.dataset.activity=active?'processing':'settling';dirty=true;}
  function project(p){const angle=time*.2,x=p[0]*Math.cos(angle)-p[2]*Math.sin(angle);return [canvas.width*(data.nodes.length?.5:canvas.width<450?.54:.7)+x*canvas.width*.14*zoom,canvas.height*.49+p[1]*canvas.height*.18*zoom];}
  function dot(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function frame(){
    const completed=births.finish(time);for(const id of completed)origins.delete(id);
    const energy=activityEnergy(time,active,finished),positions=base.nodes.map((p,i)=>deformation(p,i,time,energy));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const [i,[a,b]] of base.edges.entries()){
      ctx.beginPath();for(let k=0;k<=12;k++){const p=project(curvePoint(positions[a],positions[b],k/12,i*.7+time*.12,.3+energy*.3));if(k)ctx.lineTo(...p);else ctx.moveTo(...p);}
      ctx.strokeStyle=`rgba(112,184,139,${.32+energy*.2})`;ctx.lineWidth=1;ctx.stroke();
      if(i%5===0){const p=project(curvePoint(positions[a],positions[b],(time*(active?.75:.32)+i*.13)%1,i*.7+time*.12,.3));dot(...p,active?3:2,'#d1f7c4');}
    }
    positions.forEach((p,i)=>{const [x,y]=project(p),pulse=.5+.5*Math.sin(time*1.8-i*.36);ctx.shadowBlur=9+energy*8;ctx.shadowColor='#9decba';dot(x,y,1.3+pulse*.9,'#9edab5');});ctx.shadowBlur=0;
    memoryHits=data.nodes.map(node=>{
      const birth=births.state(node.id,time),target=targets.get(node.id),move=moves.get(node.id);
      let position=target;
      if(birth)position=interpolatePosition(origins.get(node.id)||target,target,birth.reveal);
      else if(move){position=interpolatePosition(move.from,target,(time-move.at)/.85);if(time-move.at>=.85)moves.delete(node.id);}
      displayed.set(node.id,position);return {node,point:project(position),birth};
    });
    function path(a,b,growth,phase,bend){ctx.beginPath();for(let i=0;i<=12;i++){const p=project(curvePoint(a,b,i/12*growth,phase,bend));if(i)ctx.lineTo(...p);else ctx.moveTo(...p);}ctx.stroke();}
    for(const edge of anchors){
      const a=displayed.get(edge.memory),b=positions[edge.visual],birth=births.state(edge.memory,time),progress=birth?connectionProgress(birth.age,edge.slot):1;
      ctx.strokeStyle=birth?'#e5f9bda8':'#9cd78a38';ctx.lineWidth=birth?1.4:.7;
      path(a,b,progress,edge.visual*.71+time*.08,.28);
      if(birth&&progress>0&&progress<1){ctx.shadowColor='#e3fbbd';ctx.shadowBlur=16;dot(...project(curvePoint(a,b,progress,edge.visual*.71+time*.08,.28)),2.5,'#edffd1');ctx.shadowBlur=0;}
    }
    for(const [i,e]of data.edges.entries()){
      const a=displayed.get(e.source),b=displayed.get(e.target);if(!a||!b)continue;
      const x=births.state(e.source,time),y=births.state(e.target,time),growth=Math.min(x?connectionProgress(x.age):1,y?connectionProgress(y.age):1);
      ctx.strokeStyle=x||y?'#f2efb8aa':selected.has(e.source)||selected.has(e.target)?'#e5d79888':'#95bf9744';ctx.lineWidth=1;
      path(a,b,growth,i*.9+time*.09,.2);
    }
    memoryHits.forEach(({node,point,birth})=>{
      const scale=birth?birth.scale:1;ctx.shadowColor='#dbfbbb';ctx.shadowBlur=birth?20+birth.flash*20:6;
      if(scale>.001)dot(...point,(selected.has(node.id)?5:4)*scale,birth||selected.has(node.id)?'#ffeab2':'#cef4d0');
      if(birth&&birth.age>2.65){ctx.beginPath();ctx.arc(...point,8+(birth.age-2.65)*18,0,Math.PI*2);ctx.strokeStyle=`rgba(220,250,180,${Math.max(0,1-birth.settle)*.55})`;ctx.stroke();}
    });ctx.shadowBlur=0;
    birthStatus(completed.length>0);
    canvas.dataset.frames=String(++frames);canvas.dataset.activity=active?'processing':'idle';
  }
  function updateButton(){const label=motion?'Pausar movimento':'Retomar movimento';const button=document.querySelector('#rotate');button.innerHTML=buttonHTML(motion?'pause':'play');button.setAttribute('aria-label',label);button.title=label;canvas.dataset.motion=motion?'running':'paused';onMotion?.(motion);}
  document.querySelector('#rotate').onclick=()=>{motion=!motion;updateButton();dirty=true;};
  document.querySelector('#reset-camera').onclick=()=>{zoom=1;time=0;dirty=true;};
  canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=memoryHits.find(m=>Math.hypot(m.point[0]-x,m.point[1]-y)<12);if(hit)onSelect(hit.node);};
  function wheel(e){e.preventDefault();zoom=Math.max(.5,Math.min(2,zoom-e.deltaY*.001));dirty=true;}
  container.addEventListener('wheel',wheel,{passive:false});
  const observer=new ResizeObserver(resize);observer.observe(container);
  function animate(stamp){if(disposed)return;raf=requestAnimationFrame(animate);if(document.hidden||!isVisible()){last=stamp;return;}if(stamp-last<33)return;const delta=elapsedSeconds(stamp,last);last=stamp;if(motion)time+=delta;if(motion||dirty){frame();dirty=false;}}
  resize();updateButton();raf=requestAnimationFrame(animate);
  return {draw,activity,resize,highlight:ids=>{selected=new Set(ids);dirty=true;},dispose:()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();container.removeEventListener('wheel',wheel);}};
}
