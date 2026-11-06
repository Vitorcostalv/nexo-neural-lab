import https from 'node:https';import {createReadStream,createWriteStream} from 'node:fs';import {stat,mkdir,copyFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {createHash} from 'node:crypto';import {pipeline} from 'node:stream/promises';
async function verified(file,artifact){try{if((await stat(file)).size!==artifact.bytes)return false;const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex')===artifact.sha256;}catch{return false;}}
function response(url,redirects=0){return new Promise((resolve,reject)=>{
  const request=https.get(url,res=>{if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();if(redirects>=8)return reject(Error('Muitos redirecionamentos.'));response(new URL(res.headers.location,url),redirects+1).then(resolve,reject);}else if(res.statusCode===200)resolve(res);else{res.resume();reject(Error('Download HTTP '+res.statusCode));}});request.setTimeout(180000,()=>request.destroy(Error('Download sem progresso por 180 segundos.')));request.on('error',reject);
});}
export async function ensureArtifact(cacheDir,artifact,onProgress=()=>{}){
  const target=resolve(cacheDir,artifact.model,artifact.revision,artifact.file);if(await verified(target,artifact))return {...artifact,source:'verified pinned cache'};
  await mkdir(dirname(target),{recursive:true});const legacy=resolve(cacheDir,artifact.model,artifact.file);
  if(await verified(legacy,artifact)){await copyFile(legacy,target);return {...artifact,source:'verified matching legacy cache'};}
  const part=target+'.part',res=await response(`https://huggingface.co/${artifact.model}/resolve/${artifact.revision}/${artifact.file}`);let bytes=0,last=-1;
  res.on('data',chunk=>{bytes+=chunk.length;const percent=Math.floor(bytes/artifact.bytes*100);if(percent!==last){last=percent;onProgress({stage:'download',file:artifact.file,percent,bytes,total:artifact.bytes});}});
  await pipeline(res,createWriteStream(part));if(!await verified(part,artifact))throw Error('Tamanho ou SHA-256 do modelo incompatível. O artefato não será usado.');await copyFile(part,target);return {...artifact,source:'verified download'};
}
