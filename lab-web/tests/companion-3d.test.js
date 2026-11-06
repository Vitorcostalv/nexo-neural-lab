import {test} from 'node:test';import assert from 'node:assert/strict';
import {Object3D,AnimationClip,NumberKeyframeTrack} from '../vendor/three.module.js';
import {CompanionPlayer} from '../companion-player.js';import {CLIPS,companionAsset,validateAsset,inspectGLB} from '../companion-asset.js';
const names=Object.fromEntries(CLIPS.map(key=>[key,key]));
function player(){const root=new Object3D();root.name='fixture';return new CompanionPlayer(root,CLIPS.map(name=>new AnimationClip(name,.5,[new NumberKeyframeTrack('fixture.position[x]',[0,.5],[0,0])])),names);}
const advance=(p,n=16)=>{for(let i=0;i<n;i++)p.update(.05);};
test('no unreviewed substitute character is enabled',()=>{assert.equal(companionAsset.status,'pending');assert.equal(companionAsset.asset,null);assert.throws(()=>validateAsset(null),/GLB local/);});
test('asset contract requires nine distinct clips, provenance and review',()=>{
  const asset={url:'./models/nexo.glb',sha256:'a'.repeat(64),credits:{author:'fixture',source:'https://example.org',license:'CC0',licenseUrl:'https://example.org/license'},clips:names,cameras:{desktop:'D',mobile:'M'},nodes:{floor:'F',desk:'D',chair:'C',screen:'S',keyboard:'K'},review:{videos:['desktop.mp4','mobile.mp4'],walkCycles:3,typeCycles:3,reviewer:'Fixture only'}};
  assert.equal(validateAsset(asset),asset);assert.throws(()=>validateAsset({...asset,clips:{...names,type:'idle'}}),/próprio/);assert.throws(()=>validateAsset({...asset,review:null}),/pendente/);assert.throws(()=>validateAsset({...asset,url:'./models/../bad.glb'}),/local/);
});
test('actual AnimationMixer sequences sit/type/stand and latest rapid target',()=>{const p=player();p.request('type');assert.equal(p.current,'sit');advance(p);assert.equal(p.current,'type');p.request('read');assert.equal(p.current,'stand');p.request('wave');advance(p,12);assert.equal(p.current,'wave');advance(p);assert.equal(p.current,'idle');p.dispose();});
test('walking stops at clip boundary; cancellation during sit exits coherently',()=>{const p=player();p.request('walk');p.update(.1);p.request('idle');assert.equal(p.current,'walk');advance(p);assert.equal(p.current,'idle');p.request('type');p.request('idle');advance(p,30);assert.equal(p.current,'idle');p.dispose();});
test('reduced/off stop motion; restoring full mode honors latest target',()=>{const p=player();p.request('type');p.setMode('off');const time=p.mixer.time;advance(p);assert.equal(p.mixer.time,time);assert.equal(p.current,'idle');p.request('read');p.setMode('full');assert.equal(p.current,'read');p.setMode('reduced');advance(p);assert.equal(p.current,'idle');p.dispose();});
test('missing or non-finite clips fail before animation',()=>{assert.throws(()=>new CompanionPlayer(new Object3D(),[],names),/Clip inválido/);const clip=new AnimationClip('idle',1,[new NumberKeyframeTrack('.position[x]',[0,1],[0,NaN])]);assert.throws(()=>new CompanionPlayer(new Object3D(),[clip],{idle:'idle'}),/Clip inválido/);});
test('GLB gate rejects malformed, oversized and external-resource payloads',()=>{
  assert.throws(()=>inspectGLB(new ArrayBuffer(2)));const json=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'https://example.org/a.bin'}]}));const buffer=new ArrayBuffer(20+json.length),v=new DataView(buffer);[0x46546c67,2,buffer.byteLength,json.length,0x4e4f534a].forEach((x,i)=>v.setUint32(i*4,x,true));new Uint8Array(buffer,20).set(json);assert.throws(()=>inspectGLB(buffer),/incorporar/);
});
