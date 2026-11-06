// Pure pose/locomotion model. Units are SVG coordinates, time is seconds.
export const GESTURES=Object.freeze(['idle','wave','thinking','walking','typing','happy','confused','studying']);
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export const mix=(a,b,t)=>a+(b-a)*t;
const point=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const deg=x=>x*180/Math.PI,rad=x=>x*Math.PI/180;
export function rotate([x,y],angle){const c=Math.cos(rad(angle)),s=Math.sin(rad(angle));return [x*c-y*s,x*s+y*c];}
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
// Two rigid segments; callers retain the reached point rather than hiding unreachable targets.
export function solveLimb(origin,target,upper,lower,bend=1){
  const dx=target[0]-origin[0],dy=target[1]-origin[1],raw=Math.hypot(dx,dy),d=clamp(raw,Math.abs(upper-lower)+.001,upper+lower-.001),heading=Math.atan2(dy,dx);
  const angle=heading+bend*Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
  const joint=[origin[0]+upper*Math.cos(angle),origin[1]+upper*Math.sin(angle)],end=[origin[0]+d*Math.cos(heading),origin[1]+d*Math.sin(heading)];
  const forearm=Math.atan2(end[1]-joint[1],end[0]-joint[0]);
  return {origin,joint,end,upper,lower,angle:deg(angle),relative:deg(forearm-angle),endAngle:deg(forearm),error:distance(target,end)};
}

const channels={idle:{},wave:{wave:1},thinking:{think:1},walking:{walk:1},typing:{sit:1,type:1},studying:{sit:1,study:1},happy:{happy:1},confused:{confused:1}};
const zero=()=>({sit:0,type:0,study:0,think:0,wave:0,happy:0,confused:0,walk:0});
export const TRANSITION_SECONDS=.34;
const VELOCITY=48,ACCEL=.3,PAUSE=.7,STRIDE=48,STANCE=.62;
function travel(t,length){const duration=length/VELOCITY+ACCEL;t=clamp(t,0,duration);if(t<ACCEL)return {distance:VELOCITY*t*t/(2*ACCEL),speed:VELOCITY*t/ACCEL,duration};if(t>duration-ACCEL){const r=duration-t;return {distance:length-VELOCITY*r*r/(2*ACCEL),speed:VELOCITY*r/ACCEL,duration};}return {distance:VELOCITY*(t-ACCEL/2),speed:VELOCITY,duration};}
// Each journey ends at double support, decelerates to zero, then turns while stationary.
export function walkingJourney(time,start=210){
  const direction=start>250?-1:1,boundary=direction===1?282:138;
  // Odd half-strides put both feet on the same world contacts after a stationary turn.
  const strideLength=available=>{let steps=Math.floor((available+1e-8)/24);if(steps%2===0)steps--;return Math.max(24,steps*24);};
  const firstLength=strideLength(Math.abs(boundary-start)),end=start+direction*firstLength,firstDuration=firstLength/VELOCITY+ACCEL+PAUSE;
  const result=(t,origin,dir,length,segment)=>{const moving=travel(t,length),duration=moving.duration,rest=clamp((t-duration)/PAUSE),profile=t<=duration?ease(t/.22):1-ease(rest*2);return {x:origin+dir*moving.distance,start:origin,direction:dir,distance:moving.distance,speed:moving.speed,profile,rest,segment,moving:t<duration};};
  const elapsed=Math.max(0,time);if(elapsed<=firstDuration)return result(elapsed,start,direction,firstLength,0);
  const length=strideLength(Math.abs((direction===1?138:282)-end)),period=length/VELOCITY+ACCEL+PAUSE,k=Math.floor((elapsed-firstDuration)/period),local=(elapsed-firstDuration)%period;
  return k%2===0?result(local,end,-direction,length,k+1):result(local,end-direction*length,direction,length,k+1);
}
export function walkingFoot(journey,offset){
  const phaseTotal=journey.distance/STRIDE+offset,n=Math.floor(phaseTotal),phase=phaseTotal-n,at=(n-offset)*STRIDE,anchor=at+STRIDE/4;
  let along=anchor,height=0,contact=true;
  if(phase>1-1e-8){along=anchor+STRIDE;}else if(phase>STANCE){const u=(phase-STANCE)/(1-STANCE);along=anchor+STRIDE*ease(u);height=13*Math.sin(Math.PI*u);contact=false;}
  return {x:journey.start+journey.direction*along,sole:424-height,contact,phase,anchor:journey.start+journey.direction*(contact?along:anchor),segment:journey.segment};
}

export class CompanionRig{
  constructor(){this.pose='idle';this.poseClocks=Object.fromEntries(GESTURES.map(k=>[k,0]));this.motionWeight=1;this.time=0;this.age=0;this.params=zero();this.from=zero();this.target=zero();this.elapsed=1;this.duration=TRANSITION_SECONDS;this.mode='full';this.x=210;this.facing=1;this.walkStart=210;this.walkTime=0;this.walking=false;this.brake=0;this.lastPulse=-Infinity;this.preview=false;this.gaze=[0,0];this.frame=this.sample(0);}
  setPose(name,{preview=false}={}){
    if(!GESTURES.includes(name))throw Error('Pose desconhecida.');this.preview=preview;
    if(this.pose===name)return false;
    this.from={...this.params};this.target={...zero(),...channels[name]};this.pose=name;this.poseClocks[name]=0;this.age=0;this.elapsed=0;this.duration=this.mode==='off'?0:this.mode==='reduced'?.18:TRANSITION_SECONDS;
    if(name==='walking'){if(this.params.walk<.001){this.walkStart=this.x;this.walkTime=0;}this.walking=true;this.brake=0;}
    // Preserve the current world position. Returning to idle never drags planted feet to center.
    if(name!=='walking'){if(this.walking)this.brake=.34;this.walking=false;}
    if(!this.duration){this.params={...this.target};this.elapsed=1;}
    return true;
  }
  setMode(mode){if(!['full','reduced','off'].includes(mode))throw Error('Modo de movimento inválido.');this.mode=mode;if(mode!=='full'){this.motionWeight=0;this.params={...this.target};this.elapsed=1;}}
  pulse(wallTime){this.lastPulse=wallTime;}
  tick(dt,wallTime=0){dt=clamp(dt,0,.05);this.time+=dt;this.age+=dt;for(const key of GESTURES)this.poseClocks[key]+=dt;if(this.mode==='full')this.motionWeight=Math.min(1,this.motionWeight+dt/.24);this.elapsed+=dt;const u=this.duration?ease(this.elapsed/this.duration):1;for(const key of Object.keys(this.params))this.params[key]=mix(this.from[key],this.target[key],u);if(this.mode==='full'){if(this.walking)this.walkTime+=dt*this.motionWeight;else if(this.brake>0){this.walkTime+=dt*ease(this.brake/.34);this.brake=Math.max(0,this.brake-dt);}}this.frame=this.sample(wallTime);return this.frame;}
  get transitioning(){return this.elapsed<this.duration;}
  sample(wallTime=0){
    const p=this.params,full=this.mode==='full',t=this.time,age=this.age;
    let journey=null,profile=0;
    if(p.walk>.001&&full){journey=walkingJourney(this.walkTime,this.walkStart);this.x=journey.x;this.facing=journey.direction;profile=journey.profile*p.walk*this.motionWeight;}
    const weightShift=journey?Math.sin(journey.distance/STRIDE*2*Math.PI)*.65*(journey.speed/VELOCITY):0;
    const seated=p.sit,breath=full?Math.sin(t*1.3)*.25:0;
    const pelvis=[weightShift,291+25*seated+1.5*p.walk*this.motionWeight],neck=[-4*seated+weightShift*.4,190+25*seated+breath];
    const lean=-2*p.think-2*seated,shoulderY=205+25*seated+breath;
    const shoulderL=[mix(-34,-9,profile)-3*seated,shoulderY],shoulderR=[mix(34,9,profile)-3*seated,shoulderY];
    const headAngle=lean-4*p.think-5*p.confused+(full&&p.think>.9?Math.sin(this.poseClocks.thinking*.65)*.5:0);
    const headOrigin=[neck[0],neck[1]+7],chin=add(headOrigin,rotate([5,-16],headAngle));
    const activeTyping=this.pose==='typing'&&full&&p.type>.3&&(this.preview||(wallTime>=this.lastPulse&&wallTime-this.lastPulse<650)),tap=activeTyping&&((t%1.6)<1.05);
    const fingerL=tap?Math.max(0,Math.sin(t*13)):0,fingerR=tap?Math.max(0,Math.sin(t*13+2.5)):0;
    let leftTarget=[-51,294+breath],rightTarget=[51,294+breath],handL=85,handR=95;
    const deskAlpha=ease((seated-.2)/.65),laptopAlpha=ease((p.type-.35)/.6),bookAlpha=ease((p.study-.35)/.6);
    const keyboardL=[-23,294],keyboardR=[20,294];
    const pageTime=full?(this.poseClocks.studying%6.8):0,pageProgress=p.study>.8&&pageTime>4.9&&pageTime<5.6?(pageTime-4.9)/.7:0,page=pageProgress?Math.sin(Math.PI*pageProgress):0;
    const studyMix=seated>0?clamp(p.study/seated):0;
    const leftWork=[mix(-37,-45,studyMix),mix(292.5,296,studyMix)+.45*fingerL],rightWork=[mix(34,45,studyMix)-21.6*page,mix(292.5,296,studyMix)-9*page+.45*fingerR];
    const happyAge=this.poseClocks.happy,waveAge=this.poseClocks.wave,brief=Math.exp(-happyAge*1.2),wave=full?Math.sin(waveAge*8)*8*Math.exp(-waveAge*.8):0;
    const satisfaction=full?ease((happyAge-.8)/.9):0,walkWeight=journey?p.walk*this.motionWeight:0;
    const swing=journey?Math.sin(journey.distance/STRIDE*2*Math.PI)*16*(journey.speed/VELOCITY):0;
    const weighted=(base,entries)=>{const total=entries.reduce((sum,[w])=>sum+w,0),result=base.map(v=>v*Math.max(0,1-total));for(const [w,target]of entries){result[0]+=w*target[0];result[1]+=w*target[1];}return result;};
    const angles=(base,entries)=>{const total=entries.reduce((sum,[w])=>sum+w,0);let x=Math.cos(rad(base))*Math.max(0,1-total),y=Math.sin(rad(base))*Math.max(0,1-total);for(const [w,value]of entries){x+=w*Math.cos(rad(value));y+=w*Math.sin(rad(value));}return deg(Math.atan2(y,x));};
    const chinWrist=[chin[0],chin[1]+14];
    rightTarget=weighted(rightTarget,[[seated,rightWork],[p.wave,[62+wave*.3,147+wave*.3]],[p.happy,[mix(58,51,satisfaction),mix(178-brief*5,294,satisfaction)]],[p.confused,[65,236]],[p.think,chinWrist],[walkWeight,[shoulderR[0]+swing,shoulderY+98]]]);
    handR=angles(95,[[seated,mix(174,180,studyMix)],[p.wave,-90+wave],[p.happy,-80],[p.confused,-20],[p.think,-90],[walkWeight,95]]);
    const right=solveLimb(shoulderR,rightTarget,54,48,-1);
    leftTarget=weighted(leftTarget,[[seated,leftWork],[p.happy,[-49,mix(210-brief*10,294,satisfaction)]],[p.think,[right.joint[0]-14,right.joint[1]+9]],[walkWeight,[shoulderL[0]-swing,shoulderY+98]]]);
    handL=angles(85,[[seated,mix(6,0,studyMix)],[p.happy,0],[p.think,0],[walkWeight,85]]);
    const left=solveLimb(shoulderL,leftTarget,54,48,1);
    let footL={x:this.x-23*this.facing,sole:424,contact:true},footR={x:this.x+25*this.facing,sole:424,contact:true};
    if(journey){const blendFoot=(walk,rest)=>{const weight=p.walk*this.motionWeight,shift=Math.abs(walk.x-rest.x),lift=Math.sin(Math.PI*weight)*Math.min(8,shift*.4);return {...walk,x:mix(rest.x,walk.x,weight),sole:mix(rest.sole,walk.sole,weight)-lift,contact:walk.contact&&lift<.01};};footL=blendFoot(walkingFoot(journey,0),footL);footR=blendFoot(walkingFoot(journey,.5),footR);}
    const legProfile=journey?p.walk*this.motionWeight:profile,hipL=[mix(-20,-5,legProfile)+weightShift,pelvis[1]],hipR=[mix(20,5,legProfile)+weightShift,pelvis[1]];
    const ankleL=[(footL.x-this.x)/this.facing,footL.sole-10],ankleR=[(footR.x-this.x)/this.facing,footR.sole-10];
    const legL=solveLimb(hipL,ankleL,mix(62,40,seated),62,profile>.5?-1:1),legR=solveLimb(hipR,ankleR,mix(62,40,seated),62,-1);
    // Blink is an eyelid opacity, never a scale on the face. Look shifts have long holds.
    const blinkPhase=t%5.9,blink=full&&blinkPhase>5.65?Math.sin((blinkPhase-5.65)/.25*Math.PI):0;
    const look=full&&t%9>6.8?(Math.sin(Math.floor(t/9)*2.3)*1.8):0;
    const gaze=[mix(this.gaze[0]+look,0,seated),mix(this.gaze[1],2.5,seated)];
    return {pose:this.pose,x:this.x,facing:this.facing,params:{...p},pelvis,neck,headOrigin,shoulderL,shoulderR,headAngle,hairAngle:full?Math.sin(t*.8)*.4*(p.walk+.12):0,profile,left,right,legL,legR,handL,handR,footL,footR,deskAlpha,laptopAlpha,bookAlpha,page,blink,gaze,fingerL,fingerR,speaking:activeTyping&&tap,smile:clamp(p.happy+p.wave*.5),confused:p.confused,chin,keyboardL,keyboardR,contacts:{left:[left.end[0]+rotate([14,0],handL)[0],left.end[1]+rotate([14,0],handL)[1]],right:[right.end[0]+rotate([14,0],handR)[0],right.end[1]+rotate([14,0],handR)[1]]}};
  }
}
