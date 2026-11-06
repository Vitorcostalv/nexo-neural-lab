// Real Three.js scene/materials, stubbed renderer. Does NOT exercise WebGL/GPU.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import * as motion from '../neural-motion.js';
import * as birth from '../neural-birth.js';
test('3D scene applies experiment selections to real node materials and exposes selected IDs',async()=>{
  const canvas={dataset:{},style:{},setAttribute(){},remove(){}};
  const buttons=Object.fromEntries(['#rotate','#reset-camera'].map(id=>[id,{setAttribute(){}}]));let frame,scene;
  class Renderer{constructor(){this.domElement=canvas;}setPixelRatio(){}getPixelRatio(){return 1;}setSize(){}render(next){scene=next;}dispose(){}}
  const container={clientWidth:900,clientHeight:270,append(){},addEventListener(){},removeEventListener(){}};
  const code=(await readFile(new URL('../neural-scene.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace('export function createNeuralScene','function createNeuralScene');
  const context=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},...motion,...birth,document:{hidden:false,querySelector:id=>buttons[id]},matchMedia:()=>({matches:false}),devicePixelRatio:1,requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}}});
  vm.runInContext(code+'\nglobalThis.buildScene=createNeuralScene;',context);
  const controller=context.buildScene({container,isVisible:()=>true,buttonHTML:()=>'',onMotion(){}});
  controller.draw({nodes:[{id:1,text:'Recife',position:[-1,0,0]},{id:2,text:'Python',position:[1,0,0]}],edges:[{source:1,target:2,score:.7}]},[1]);frame(1000);
  const memory=id=>{let found;scene.traverse(node=>{if(node.userData.id===id)found=node;});return found;};
  assert.equal(memory(1).material.color.getHex(),0xffe49e);assert.equal(memory(2).material.color.getHex(),0xbcecc5);assert.equal(canvas.dataset.selectedIds,'[1]');
  controller.highlight([2]);assert.equal(memory(1).material.color.getHex(),0xbcecc5);assert.equal(memory(2).material.color.getHex(),0xffe49e);assert.equal(canvas.dataset.selectedIds,'[2]');
  controller.highlight([999]);assert.equal(canvas.dataset.selectedIds,'[]');controller.dispose();
});
