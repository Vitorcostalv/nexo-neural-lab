// Offline numerical rig + the actual SVG renderer. Not a browser recording/layout test.
import {createRequire} from 'node:module';import {writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {execFileSync} from 'node:child_process';
import {CompanionRig} from '../lab-web/companion-rig.js';import {girlIllustration} from '../lab-web/companion-art.js';import {bindCompanion} from '../lab-web/companion-renderer.js';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'runtime/nexo-validation/package.json')),{createCanvas,loadImage}=require('@napi-rs/canvas'),{JSDOM}=require('jsdom');
const output=resolve(root,'reports/companion-motion');await mkdir(output,{recursive:true});
const doc=new JSDOM(girlIllustration(),{contentType:'image/svg+xml'}),svg=doc.window.document.documentElement,draw=bindCompanion(svg),canvas=createCanvas(420,460),ctx=canvas.getContext('2d');
async function render(frame,label){draw(frame);ctx.fillStyle='#10221c';ctx.fillRect(0,0,420,460);ctx.drawImage(await loadImage(Buffer.from(svg.outerHTML)),0,0,420,460);ctx.fillStyle='#b6cab8';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('RIG OFFLINE / '+label+' / nao e captura do navegador',210,450);return canvas.toBuffer('image/png');}
const poses=[['thinking','Pensando'],['walking','Caminhando'],['typing','Digitando'],['happy','Feliz'],['confused','Confusa'],['studying','Estudando']],sheet=createCanvas(1260,960),pen=sheet.getContext('2d');pen.fillStyle='#10221c';pen.fillRect(0,0,1260,960);
for(const [i,[pose,label]]of poses.entries()){const rig=new CompanionRig();rig.setPose(pose,{preview:true});let f;for(let j=0;j<24;j++)f=rig.tick(1/24,j*1000/24);const png=await render(f,label);pen.drawImage(await loadImage(png),(i%3)*420,Math.floor(i/3)*480);pen.fillStyle='#e0e6d4';pen.font='16px sans-serif';pen.textAlign='center';pen.fillText(label,(i%3)*420+210,Math.floor(i/3)*480+477);}
await writeFile(resolve(root,'reports/companion-girl-poses.png'),sheet.toBuffer('image/png'));
await writeFile(resolve(root,'reports/companion-girl-art.png'),await render(new CompanionRig().frame,'repouso'));
const report={created:new Date().toISOString(),classification:'Offline execution of the application rig and SVG renderer',fps:24,clips:[],limitations:['Native browser access unavailable.','No real desktop/mobile layout, browser frame pacing or assistive technology verified.','MP4 files are offline SVG renders, not browser recordings.']};
if(process.argv.includes('--video')){
  const ffmpeg=execFileSync(resolve(root,'.venv/Scripts/python.exe'),['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
  for(const pose of ['walking','typing','studying','rapid']){
    const rig=new CompanionRig(),frames=resolve(root,'runtime/companion-motion-review',pose);await mkdir(frames,{recursive:true});let current='idle',maxReach=0,maxFloorDrift=0,maxKeyboardError=0,typingBursts=0,wasTyping=false;const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);const planted=new Map(),filmstrip=createCanvas(1680,920),strip=filmstrip.getContext('2d');strip.fillStyle='#10221c';strip.fillRect(0,0,1680,920);
    const count=240;
    for(let i=0;i<count;i++){
      const time=i/24,target=pose==='rapid'?(time<7?poses[Math.floor(time/.24)%poses.length][0]:'idle'):(time<.5||time>=8?'idle':pose);
      if(target!==current){rig.setPose(target,{preview:true});current=target;}
      const frame=rig.tick(1/24,time*1000),png=await render(frame,target+' '+time.toFixed(2)+'s');
      if(frame.params.type>.999){maxKeyboardError=Math.max(maxKeyboardError,distance(frame.contacts.left,frame.keyboardL),distance(frame.contacts.right,frame.keyboardR));if(frame.speaking&&!wasTyping)typingBursts++;wasTyping=frame.speaking;}
      for(const limb of [frame.left,frame.right,frame.legL,frame.legR])maxReach=Math.max(maxReach,limb.error);
      if(pose==='walking'&&frame.params.walk>.999&&rig.motionWeight>.999)for(const [side,foot]of [['L',frame.footL],['R',frame.footR]])if(foot.contact){const key=[side,foot.segment,foot.anchor].join('/');if(planted.has(key))maxFloorDrift=Math.max(maxFloorDrift,Math.abs(foot.x-planted.get(key)));else planted.set(key,foot.x);}
      await writeFile(resolve(frames,`frame-${String(i).padStart(4,'0')}.png`),png);
      if(i%30===0)strip.drawImage(await loadImage(png),(i/30%4)*420,Math.floor(i/120)*460);
    }
    const target=resolve(output,pose+'.mp4');execFileSync(ffmpeg,['-y','-loglevel','error','-framerate','24','-i',resolve(frames,'frame-%04d.png'),'-frames:v',String(count),'-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',target],{stdio:'pipe'});
    await writeFile(resolve(output,pose+'-frames.png'),filmstrip.toBuffer('image/png'));report.clips.push({pose,seconds:count/24,frames:count,file:pose+'.mp4',maximumReachError:maxReach,maximumPlantedFootDrift:pose==='walking'?maxFloorDrift:null,maximumKeyboardContactError:pose==='typing'?maxKeyboardError:null,typingBursts:pose==='typing'?typingBursts:null});console.log(`${pose}: ${count} frames; reach error ${maxReach.toFixed(4)}; planted drift ${maxFloorDrift.toFixed(4)}`);
  }
}
await writeFile(resolve(output,'validation.json'),JSON.stringify(report,null,2)+'\n');doc.window.close();console.log('Offline evidence written; browser validation remains outstanding.');
