import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {validateAsset,inspectGLB} from './companion-asset.js?v=1.4.1';
import {CompanionPlayer} from './companion-player.js?v=1.4.1';

async function boundedBuffer(response){
  const reader=response.body?.getReader();if(!reader)throw Error('Download incremental indisponível');const chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8*1024*1024)throw Error('Asset maior que 8 MiB');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result.buffer;
}

export function releaseModel(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.skeleton)skeletons.add(object.skeleton);for(const material of [object.material].flat().filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const value of textures){value.source?.data?.close?.();value.dispose();}for(const value of materials)value.dispose();for(const value of geometries)value.dispose();for(const value of skeletons)value.dispose();
}
export async function createCompanion3D(host,asset,{signal,onFailure=()=>{}}={}){
  validateAsset(asset);let model,renderer,player,observer,contextLost;
  try{
    const response=await fetch(new URL(asset.url,import.meta.url),{signal});if(!response.ok)throw Error('Download da personagem: HTTP '+response.status);
    if(Number(response.headers.get('content-length'))>8*1024*1024)throw Error('Asset maior que 8 MiB');
    const buffer=await boundedBuffer(response);inspectGLB(buffer);signal?.throwIfAborted();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==asset.sha256)throw Error('SHA-256 do asset divergente');
    const gltf=await new GLTFLoader().parseAsync(buffer,'');model=gltf.scene;signal?.throwIfAborted();
    let skinned=0,triangles=0;model.traverse(object=>{if(object.isSkinnedMesh)skinned++;if(object.isMesh){triangles+=(object.geometry.index?.count??object.geometry.attributes.position?.count??0)/3;object.castShadow=true;object.receiveShadow=true;}for(const material of [object.material].flat().filter(Boolean))for(const value of Object.values(material))if(value?.isTexture&&Math.max(value.image?.width||0,value.image?.height||0)>2048)throw Error('Textura excede 2048px');});
    if(!skinned||triangles>60000)throw Error('Rig ausente ou orçamento de 60 mil triângulos excedido');
    for(const name of Object.values(asset.nodes))if(!model.getObjectByName(name))throw Error('Objeto ausente no GLB: '+name);
    for(const clip of gltf.animations)for(const track of clip.tracks){const binding=THREE.PropertyBinding.parseTrackName(track.name);if(!THREE.PropertyBinding.findNode(model,binding.nodeName))throw Error('Track sem nó: '+track.name);}
    const cameras=Object.fromEntries(Object.entries(asset.cameras).map(([key,name])=>[key,model.getObjectByName(name)]));if(Object.values(cameras).some(camera=>!camera?.isPerspectiveCamera))throw Error('Câmeras de revisão ausentes');
    const scene=new THREE.Scene();scene.add(model);scene.add(new THREE.HemisphereLight(0xe9f4ee,0x22372c,2));const light=new THREE.DirectionalLight(0xfff1dd,2.5);light.position.set(3,5,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.normalBias=.02;scene.add(light);
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);player=new CompanionPlayer(model,gltf.animations,asset.clips);let camera;
    function resize(){const width=host.clientWidth||320,height=host.clientHeight||320;camera=cameras[width<600?'mobile':'desktop'];camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);renderer.render(scene,camera);}
    observer=new ResizeObserver(resize);observer.observe(host);resize();
    contextLost=event=>{event.preventDefault();onFailure(Error('Contexto 3D indisponível'));};renderer.domElement.addEventListener('webglcontextlost',contextLost);
    return {player,render(dt){player.update(dt);renderer.render(scene,camera);},dispose(){observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);player.dispose();releaseModel(model);renderer.dispose();renderer.domElement.remove();}};
  }catch(error){observer?.disconnect();player?.dispose();releaseModel(model);renderer?.dispose();renderer?.domElement.remove();throw error;}
}
