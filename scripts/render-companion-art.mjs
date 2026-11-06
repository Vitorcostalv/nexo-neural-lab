// Static illustration review only. This is not a browser screenshot or animation test.
import {createRequire} from 'node:module';import {writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {girlIllustration} from '../lab-web/companion-girl.js';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'runtime/nexo-validation/package.json')),{createCanvas,loadImage}=require('@napi-rs/canvas'),{JSDOM}=require('jsdom');
const dom=new JSDOM(girlIllustration().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '),{contentType:'image/svg+xml'}),svg=dom.window.document.documentElement;
for(const el of svg.querySelectorAll('.girl-prop,.girl-question,.girl-thinking-arm,.girl-mouth-smile,.girl-mouth-open,.girl-mouth-confused'))el.setAttribute('display','none');
const canvas=createCanvas(760,880),ctx=canvas.getContext('2d');ctx.fillStyle='#10251e';ctx.fillRect(0,0,760,880);ctx.drawImage(await loadImage(Buffer.from(svg.outerHTML)),0,0,760,880);await writeFile(resolve(root,'reports/companion-girl-art.png'),canvas.toBuffer('image/png'));dom.window.close();console.log('Static SVG illustration rendered; no browser or motion validation claimed.');
// Representative joint positions for reviewing the drawing/occlusion, not CSS frame execution.
const poses=[
  {name:'Pensando',joints:{'upper-arm-right':[105,222,205],'forearm-right':[90,245,246],'upper-arm-left':[-38,141,205],'forearm-left':[-92,118,246],head:[8,188,190]}},
  {name:'Caminhando',joints:{'upper-arm-left':[-18,141,205],'upper-arm-right':[18,222,205],'leg-left':[-16,155,285],'leg-right':[16,208,285],'shin-right':[15,215,340]}},
  {name:'Digitando',prop:'laptop',mouth:'open',joints:{'upper-arm-left':[-26,141,205],'upper-arm-right':[26,222,205],'forearm-left':[-32,118,246],'forearm-right':[35,245,246]}},
  {name:'Feliz',mouth:'smile',joints:{'upper-arm-left':[145,141,205],'upper-arm-right':[-145,222,205],'forearm-left':[15,118,246],'forearm-right':[-15,245,246]}},
  {name:'Confusa',mouth:'confused',question:true,joints:{head:[-9,188,190],'upper-arm-right':[-42,222,205],'forearm-right':[-105,245,246],'hand-right':[35,242,280]}},
  {name:'Estudando',prop:'book',joints:{head:[3,188,190],'upper-arm-left':[-26,141,205],'upper-arm-right':[26,222,205],'forearm-left':[-30,118,246],'forearm-right':[28,245,246]}}
];
const sheet=createCanvas(1140,1020),pen=sheet.getContext('2d');pen.fillStyle='#10251e';pen.fillRect(0,0,1140,1020);
for(const [i,pose]of poses.entries()){
  const doc=new JSDOM(girlIllustration().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '),{contentType:'image/svg+xml'}),drawing=doc.window.document.documentElement;
  for(const el of drawing.querySelectorAll('.girl-prop,.girl-question,.girl-thinking-arm,.girl-mouth-smile,.girl-mouth-open,.girl-mouth-confused'))el.setAttribute('display','none');
  for(const [part,[angle,x,y]]of Object.entries(pose.joints))drawing.querySelector('.girl-'+part).setAttribute('transform',`rotate(${angle} ${x} ${y})`);
  if(i===0)drawing.querySelector('.girl-thinking-arm').setAttribute('display','inline');
  if(pose.prop)drawing.querySelector('.girl-'+pose.prop).setAttribute('display','inline');
  if(pose.mouth){drawing.querySelector('.girl-mouth-neutral').setAttribute('display','none');drawing.querySelector('.girl-mouth-'+pose.mouth).setAttribute('display','inline');}
  if(pose.question)drawing.querySelector('.girl-question').setAttribute('display','inline');
  const x=(i%3)*380,y=Math.floor(i/3)*510;pen.drawImage(await loadImage(Buffer.from(drawing.outerHTML)),x,y+10,380,440);pen.fillStyle='#cce6cf';pen.font='18px sans-serif';pen.textAlign='center';pen.fillText(pose.name,x+190,y+478);doc.window.close();
}
await writeFile(resolve(root,'reports/companion-girl-poses.png'),sheet.toBuffer('image/png'));console.log('Six representative static poses rendered for illustration review.');
