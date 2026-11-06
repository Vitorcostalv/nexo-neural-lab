// No substitute model is silently enabled. See docs/COMPANHEIRA-3D.md.
export const companionAsset = Object.freeze({status:'pending', reason:'A personagem 3D aguarda modelo e animações revisados.', asset:null});

export const CLIPS=Object.freeze(['idle','walk','sit','type','stand','wave','satisfaction','doubt','read']);
export function validateAsset(asset){
  const fail=message=>{throw Error('Asset da companheira: '+message);};
  if(!asset||!/^\.\/models\/[a-zA-Z0-9_./-]+\.glb$/.test(asset.url)||asset.url.includes('..'))fail('GLB local obrigatório');
  if(!/^[a-f0-9]{64}$/.test(asset.sha256||''))fail('SHA-256 obrigatório');
  if(!asset.credits?.author||!asset.credits?.source||!asset.credits?.license||!asset.credits?.licenseUrl)fail('origem e licença obrigatórias');
  for(const clip of CLIPS)if(typeof asset.clips?.[clip]!=='string'||!asset.clips[clip])fail('clip ausente: '+clip);
  if(new Set(Object.values(asset.clips)).size!==CLIPS.length)fail('cada ação exige clip próprio');
  if(!asset.cameras?.desktop||!asset.cameras?.mobile)fail('câmeras desktop e celular obrigatórias');
  for(const name of ['floor','desk','chair','screen','keyboard'])if(!asset.nodes?.[name])fail('objeto ausente: '+name);
  if(!Array.isArray(asset.review?.videos)||asset.review.videos.length<2||asset.review.walkCycles<3||asset.review.typeCycles<3||!asset.review.reviewer)fail('revisão visual desktop/celular pendente');
  return asset;
}

// Embedded buffers/images only: a single bounded download with a verifiable digest.
export function inspectGLB(buffer){
  const data=new DataView(buffer);
  if(buffer.byteLength<20||buffer.byteLength>8*1024*1024||data.getUint32(0,true)!==0x46546c67||data.getUint32(4,true)!==2||data.getUint32(8,true)!==buffer.byteLength||data.getUint32(16,true)!==0x4e4f534a)throw Error('GLB inválido ou maior que 8 MiB');
  const length=data.getUint32(12,true);
  if(length>buffer.byteLength-20)throw Error('JSON GLB truncado');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if([...(json.buffers||[]),...(json.images||[])].some(item=>item.uri))throw Error('O GLB deve incorporar buffers e texturas');
  return json;
}
