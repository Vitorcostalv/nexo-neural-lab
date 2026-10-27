import * as THREE from './vendor/three.module.js';
import {topology,deformation,curvePoint,activityEnergy,queryLinks,elapsedSeconds} from './neural-motion.js?v=1.3.0';
import {BirthTimeline,arrivalPosition,interpolatePosition,connectionProgress,integrationAnchors} from './neural-birth.js?v=1.3.0';

export function createNeuralScene({container,isVisible,onSelect,onHover,onMotion,onBirth,buttonHTML}){
  // Motion is explicitly requested by the user. Pause remains available in the UI.
  const reduced=false,mobile=matchMedia('(max-width:700px)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));
  renderer.domElement.setAttribute('aria-label','Rede visual animada com memórias selecionáveis');
  container.append(renderer.domElement);
  const canvas=renderer.domElement,scene=new THREE.Scene();
  canvas.dataset.renderer='webgl';
  const camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.z=9;
  const root=new THREE.Group();scene.add(root);
  const base=topology();
  const basePositions=new Float32Array(base.nodes.length*3),intensities=new Float32Array(base.nodes.length);
  const neuronGeometry=new THREE.BufferGeometry();
  neuronGeometry.setAttribute('position',new THREE.BufferAttribute(basePositions,3).setUsage(THREE.DynamicDrawUsage));
  neuronGeometry.setAttribute('intensity',new THREE.BufferAttribute(intensities,1).setUsage(THREE.DynamicDrawUsage));
  function glowMaterial(color,size){
    return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{tint:{value:new THREE.Color(color)},size:{value:size}},
      vertexShader:`attribute float intensity; varying float power; uniform float size;
      void main(){power=intensity;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*(7.0/max(1.0,-p.z)),2.0,60.0);}`,
      fragmentShader:`uniform vec3 tint;varying float power;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;float glow=exp(-r*r*19.0)*.4+exp(-r*r*100.0);gl_FragColor=vec4(tint,glow*power);}`});
  }
  const neuronMaterial=glowMaterial(0xa5f0bf,21);
  const neurons=new THREE.Points(neuronGeometry,neuronMaterial);neurons.frustumCulled=false;root.add(neurons);
  const segments=12;
  function makePaths(edges,color,opacity){
    const positions=new Float32Array(edges.length*segments*6);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
    const mesh=new THREE.LineSegments(geometry,material);mesh.frustumCulled=false;root.add(mesh);
    return {edges,positions,geometry,material,mesh};
  }
  const axons=makePaths(base.edges,0x71b78b,.19);
  const tethers=makePaths(queryLinks(base.nodes.length),0xd9df9b,0);
  const packetGeometry=new THREE.BufferGeometry(),packetPositions=new Float32Array(32*3),packetIntensity=new Float32Array(32).fill(.8);
  packetGeometry.setAttribute('position',new THREE.BufferAttribute(packetPositions,3).setUsage(THREE.DynamicDrawUsage));
  packetGeometry.setAttribute('intensity',new THREE.BufferAttribute(packetIntensity,1));
  const packetMaterial=glowMaterial(0xd3ffd1,13),packets=new THREE.Points(packetGeometry,packetMaterial);packets.frustumCulled=false;root.add(packets);
  const memoryGeometry=new THREE.SphereGeometry(.075,10,8);
  const memoryMaterial=new THREE.MeshBasicMaterial({color:0xbcecc5});
  const selectedMaterial=new THREE.MeshBasicMaterial({color:0xffe49e});
  const ringGeometry=new THREE.RingGeometry(.97,1,80);
  const rings=Array.from({length:3},()=>{const material=new THREE.MeshBasicMaterial({color:0xc7efa8,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});const mesh=new THREE.Mesh(ringGeometry,material);root.add(mesh);return mesh;});
  const birthGeometry=new THREE.BufferGeometry(),birthPositions=new Float32Array(180*4*3),birthIntensities=new Float32Array(180*4);
  birthGeometry.setAttribute('position',new THREE.BufferAttribute(birthPositions,3).setUsage(THREE.DynamicDrawUsage));
  birthGeometry.setAttribute('intensity',new THREE.BufferAttribute(birthIntensities,1).setUsage(THREE.DynamicDrawUsage));
  birthGeometry.setDrawRange(0,0);
  const birthMaterial=glowMaterial(0xe1ffca,44),birthGlow=new THREE.Points(birthGeometry,birthMaterial);birthGlow.frustumCulled=false;root.add(birthGlow);
  const births=new BirthTimeline(),birthOrigins=new Map(),layoutMoves=new Map();
  let memoryPoints=[],memoryPaths=null,memoryAnchors=null,data={nodes:[],edges:[]},selected=new Set(),fingerprint='',birthKey='',rootTargetX=0;
  let motion=true,active=false,finished=-Infinity,started=0,time=0,last=0,frames=0,dirty=true,disposed=false,raf;
  let down=null,dragging=false;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const positions=base.nodes.map(p=>[...p]);
  function updateButton(){const label=motion?'Pausar movimento':'Retomar movimento';const button=document.querySelector('#rotate');button.innerHTML=buttonHTML(motion?'pause':'play');button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(motion));canvas.dataset.motion=motion?'running':'paused';onMotion?.(motion);}
  function clearMemories(){memoryPoints.forEach(p=>root.remove(p));memoryPoints=[];for(const paths of [memoryPaths,memoryAnchors])if(paths){root.remove(paths.mesh);paths.geometry.dispose();paths.material.dispose();}memoryPaths=null;memoryAnchors=null;}
  function highlight(ids=[]){
    selected=new Set(ids);memoryPoints.forEach(p=>p.material=selected.has(p.userData.id)||births.entries.has(p.userData.id)?selectedMaterial:memoryMaterial);
    if(memoryPaths){const color=memoryPaths.geometry.attributes.color;memoryPaths.edges.forEach((edge,i)=>{const bright=selected.has(edge.source)||selected.has(edge.target);for(let j=0;j<segments*2;j++)color.setXYZ(i*segments*2+j,...(bright?[1,.85,.48]:[.45,.7,.52]));});color.needsUpdate=true;}
    dirty=true;
  }
  function birthStatus(complete=false){const summary=births.summary(time),key=`${summary.count}:${summary.phase}`;canvas.dataset.births=String(summary.count);canvas.dataset.birthStage=summary.phase;if(key!==birthKey||complete){birthKey=key;onBirth?.(complete&&summary.count===0?{count:0,phase:'complete'}:summary);}}
  function draw(next,ids=[],newIds=[]){
    const oldPositions=new Map(memoryPoints.map(point=>[point.userData.id,point.position.toArray()]));
    const visible=new Set(next.nodes.map(node=>node.id));births.prune(visible);
    for(const id of layoutMoves.keys())if(!visible.has(id))layoutMoves.delete(id);
    births.add(newIds.filter(id=>visible.has(id)),time);
    if(newIds.some(id=>visible.has(id))){camera.position.z=Math.max(9,camera.position.z);root.rotation.x=0;}
    for(const id of birthOrigins.keys())if(!visible.has(id))birthOrigins.delete(id);
    data=next;const key=JSON.stringify([next.nodes.map(n=>[n.id,n.position]),next.edges]);
    rootTargetX=data.nodes.length?0:(container.clientWidth<450?.25:1.35);
    if(key!==fingerprint){
      fingerprint=key;clearMemories();const lookup=new Map();
      for(const node of data.nodes){
        const point=new THREE.Mesh(memoryGeometry,memoryMaterial),target=[node.position[0]*2.6,node.position[1]*2.3,node.position[2]*2.2];
        point.userData={...node,target};
        if(births.entries.has(node.id)&&!birthOrigins.has(node.id))birthOrigins.set(node.id,arrivalPosition(target,node.id));
        const previous=oldPositions.get(node.id);
        point.position.fromArray(previous||birthOrigins.get(node.id)||target);
        if(previous&&!births.entries.has(node.id))layoutMoves.set(node.id,{from:previous,at:time});
        if(births.entries.has(node.id))point.scale.setScalar(.001);
        root.add(point);memoryPoints.push(point);lookup.set(node.id,point.position.toArray());
      }
      const edges=data.edges.filter(e=>lookup.has(e.source)&&lookup.has(e.target));
      memoryPaths=makePaths(edges,0x87bd91,.38);
      const colors=new Float32Array(memoryPaths.positions.length);memoryPaths.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));memoryPaths.material.vertexColors=true;memoryPaths.lookup=lookup;
      memoryAnchors=makePaths(integrationAnchors(memoryPoints.map(p=>({id:p.userData.id,position:p.userData.target})),base.nodes),0xa1d890,.22);
      memoryAnchors.geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(memoryAnchors.positions.length),3));memoryAnchors.material.vertexColors=true;
    }else memoryPoints.forEach(p=>{const node=next.nodes.find(n=>n.id===p.userData.id);if(node)p.userData={...p.userData,...node};});
    highlight(ids);birthStatus();dirty=true;
  }
  function writePath(target,edgeIndex,a,b,phase,bend,growth=1){
    const nx=Math.sin(phase),ny=Math.sin(phase+2.094),nz=Math.sin(phase+4.188);
    for(let j=0;j<segments;j++){
      const t=j/segments*growth,u=(j+1)/segments*growth;
      const p=Math.sin(Math.PI*t)*Math.sin(2*Math.PI*t+phase)*bend,q=Math.sin(Math.PI*u)*Math.sin(2*Math.PI*u+phase)*bend;
      const offset=(edgeIndex*segments+j)*6;
      target[offset]=a[0]+(b[0]-a[0])*t+nx*p;target[offset+1]=a[1]+(b[1]-a[1])*t+ny*p;target[offset+2]=a[2]+(b[2]-a[2])*t+nz*p;
      target[offset+3]=a[0]+(b[0]-a[0])*u+nx*q;target[offset+4]=a[1]+(b[1]-a[1])*u+ny*q;target[offset+5]=a[2]+(b[2]-a[2])*u+nz*q;
    }
  }
  function update(delta){
    time+=delta;const energy=activityEnergy(time,active,finished);
    const completed=births.finish(time);if(completed.length){for(const id of completed)birthOrigins.delete(id);highlight([...selected]);}
    root.position.x+=(rootTargetX-root.position.x)*Math.min(1,delta*3);
    for(let i=0;i<positions.length;i++){
      positions[i]=deformation(base.nodes[i],i,time,energy,reduced).map(v=>v*1.15);basePositions.set(positions[i],i*3);
      const wave=Math.max(0,Math.sin(time*(active?3.2:1.15)-i*.38));
      intensities[i]=.55+wave*(.75+energy*.8);
    }
    neuronGeometry.attributes.position.needsUpdate=true;neuronGeometry.attributes.intensity.needsUpdate=true;
    axons.edges.forEach(([a,b],i)=>writePath(axons.positions,i,positions[a],positions[b],i*.71+time*.13,.25+energy*.2));
    axons.geometry.attributes.position.needsUpdate=true;axons.material.opacity=.3+energy*.24;
    const charge=active?Math.min(1,(time-started)*.8):Math.exp(-Math.max(0,time-finished)/1.4);
    tethers.edges.forEach(([a,b],i)=>writePath(tethers.positions,i,positions[a],positions[b],i*.63+time*.18,.6,Math.max(0,Math.min(1,charge*1.4-i*.012))));
    tethers.geometry.attributes.position.needsUpdate=true;tethers.material.opacity=charge*.48;
    for(let i=0;i<32;i++){
      const paths=i%3===0&&charge>.2?tethers.edges:axons.edges;
      const [a,b]=paths[(i*7)%paths.length],t=(time*(active?.75:.32)+i*.173)%1;
      packetPositions.set(curvePoint(positions[a],positions[b],t,((i*7)%paths.length)*.71+time*.13,.32),i*3);
    }
    packetGeometry.attributes.position.needsUpdate=true;packetMaterial.uniforms.size.value=active?26:18;
    let glowCount=0;
    function addGlow(position,intensity){if(glowCount>=birthIntensities.length)return;birthPositions.set(position,glowCount*3);birthIntensities[glowCount++]=intensity;}
    memoryPoints.forEach((p,i)=>{
      const id=p.userData.id,birth=births.state(id,time),target=p.userData.target,move=layoutMoves.get(id);
      if(birth)p.position.fromArray(interpolatePosition(birthOrigins.get(id)||target,target,birth.reveal));
      else if(move){p.position.fromArray(interpolatePosition(move.from,target,(time-move.at)/.85));if(time-move.at>=.85)layoutMoves.delete(id);}
      else p.position.fromArray(target);
      const isSelected=selected.has(id),pulse=.5+.5*Math.sin(time*2.3-i*.8);
      p.scale.setScalar(birth?Math.max(.001,birth.scale)*(1+birth.flash*.35):isSelected?1.3+pulse*.85:1+Math.sin(time*.8+i)*.09);
      memoryPaths.lookup.get(id)&&p.position.toArray(memoryPaths.lookup.get(id));
      addGlow(p.position.toArray(),birth?birth.reveal*(.65+birth.flash*.9)*(1-birth.settle*.7):isSelected?.5:.16);
    });
    if(memoryPaths){
      memoryPaths.edges.forEach((edge,i)=>{
        const a=births.state(edge.source,time),b=births.state(edge.target,time),bright=selected.has(edge.source)||selected.has(edge.target);
        const growth=Math.min(a?connectionProgress(a.age):1,b?connectionProgress(b.age):1);
        writePath(memoryPaths.positions,i,memoryPaths.lookup.get(edge.source),memoryPaths.lookup.get(edge.target),i*.9+time*.09,.12+(bright?.14:0),growth);
        if(a||b){const colors=memoryPaths.geometry.attributes.color;for(let j=0;j<segments*2;j++)colors.setXYZ(i*segments*2+j,1,.9,.6);colors.needsUpdate=true;}
      });
      memoryPaths.geometry.attributes.position.needsUpdate=true;
    }
    if(memoryAnchors){
      const colors=memoryAnchors.geometry.attributes.color;
      memoryAnchors.edges.forEach((edge,i)=>{
        const a=memoryPaths.lookup.get(edge.memory),b=positions[edge.visual],birth=births.state(edge.memory,time),growth=birth?connectionProgress(birth.age,edge.slot):1;
        writePath(memoryAnchors.positions,i,a,b,i*.71+time*.08,.28,growth);
        const shine=birth?.9:.38;for(let j=0;j<segments*2;j++)colors.setXYZ(i*segments*2+j,shine,shine*(birth?.95:.9),shine*.65);
        if(birth&&growth>0&&growth<1)addGlow(curvePoint(a,b,growth,i*.71+time*.08,.28),1.25);
      });
      memoryAnchors.geometry.attributes.position.needsUpdate=true;colors.needsUpdate=true;
    }
    birthGeometry.setDrawRange(0,glowCount);birthGeometry.attributes.position.needsUpdate=true;birthGeometry.attributes.intensity.needsUpdate=true;
    birthStatus(completed.length>0);
    rings.forEach((ring,i)=>{const phase=((time-started)*.45+i/3)%1;ring.visible=charge>.08;ring.scale.setScalar(.8+phase*2.7);ring.material.opacity=charge*(1-phase)*.24;ring.rotation.x=Math.sin(i+time*.22)*.65;ring.rotation.y=i*.7;});
    if(!down&&!reduced){root.rotation.y+=delta*(active?.36:.2);root.rotation.z=Math.sin(time*.35)*.055;}
    canvas.dataset.activity=active?'processing':charge>.1?'settling':'idle';
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;const ratio=Math.min(devicePixelRatio,w<450?1.25:1.5);if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);rootTargetX=data.nodes.length?0:(w<450?.25:1.35);root.position.x=rootTargetX;camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(container);
  function pick(e){const rect=container.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(memoryPoints)[0]?.object;}
  container.onpointerdown=e=>{down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};dragging=false;container.setPointerCapture(e.pointerId);};
  container.onpointermove=e=>{
    if(down){if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)dragging=true;root.rotation.y+=(e.clientX-down.lastX)*.006;root.rotation.x=Math.max(-1,Math.min(1,root.rotation.x+(e.clientY-down.lastY)*.006));down.lastX=e.clientX;down.lastY=e.clientY;dirty=true;}
    else{const hit=pick(e);container.style.cursor=hit?'pointer':'grab';onHover?.(hit?.userData||null);}
  };
  container.onpointerup=e=>{if(!dragging){const hit=pick(e);if(hit)onSelect(hit.userData);}down=null;};
  container.onpointercancel=()=>{down=null;};container.onpointerleave=()=>onHover?.(null);
  container.addEventListener('wheel',wheel,{passive:false});
  function wheel(e){e.preventDefault();camera.position.z=Math.max(4,Math.min(16,camera.position.z+e.deltaY*.006));dirty=true;}
  document.querySelector('#rotate').onclick=()=>{motion=!motion;updateButton();dirty=true;};
  document.querySelector('#reset-camera').onclick=()=>{camera.position.z=9;root.rotation.set(0,0,0);dirty=true;};
  function activity(stage,text=''){
    if(stage==='begin'){active=true;started=time;const seed=[...text].reduce((s,c)=>s+c.codePointAt(0),0)%base.nodes.length;tethers.edges=queryLinks(base.nodes.length,seed);}
    else{active=false;finished=time;}
    dirty=true;canvas.dataset.activity=active?'processing':'settling';
  }
  function animate(stamp){
    if(disposed)return;raf=requestAnimationFrame(animate);
    if(document.hidden||!isVisible()){last=stamp;return;}
    if(stamp-last<33)return;
    const delta=elapsedSeconds(stamp,last);last=stamp;
    if(motion)update(delta);else if(dirty)update(0);
    if(motion||dirty){renderer.render(scene,camera);canvas.dataset.frames=String(++frames);dirty=false;}
  }
  function dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();container.removeEventListener('wheel',wheel);clearMemories();[axons,tethers].forEach(p=>{p.geometry.dispose();p.material.dispose();});birthGeometry.dispose();birthMaterial.dispose();neuronGeometry.dispose();neuronMaterial.dispose();packetGeometry.dispose();packetMaterial.dispose();memoryGeometry.dispose();memoryMaterial.dispose();selectedMaterial.dispose();ringGeometry.dispose();rings.forEach(r=>r.material.dispose());renderer.dispose();}
  draw(data);update(0);updateButton();resize();raf=requestAnimationFrame(animate);
  return {draw,highlight,activity,resize,dispose};
}
