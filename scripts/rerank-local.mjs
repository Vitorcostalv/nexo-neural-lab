// Optional CPU worker used by the local Python edition. Documents stay in this process.
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {loadCrossEncoder} from '../lab-web/lab/cross-encoder.js';
import {ensureArtifact} from './model-download.mjs';import {ARTIFACTS} from './model-artifacts.mjs';
const root=resolve(import.meta.dirname,'..');process.stdin.setEncoding('utf8');let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>100000)throw Error('Entrada excedida.');}
try{
  const input=JSON.parse(raw);if(input.consent!==true)throw Error('Autorize explicitamente o download do reranker.');
  const library=await import(pathToFileURL(resolve(root,'runtime/nexo-validation/node_modules/@huggingface/transformers/src/transformers.js')));
  library.env.allowLocalModels=false;library.env.cacheDir=resolve(root,'runtime/nexo-validation/model-cache');
  await ensureArtifact(library.env.cacheDir,ARTIFACTS.reranker,p=>console.log(JSON.stringify({progress:p})));
  const engine=await loadCrossEncoder(library,{onProgress:p=>{if(['progress','done'].includes(p.status))console.log(JSON.stringify({progress:{stage:'reranker',file:p.file,percent:p.progress??null}}));}});
  const result=await engine.rank(input.query,input.documents);await engine.dispose();console.log(JSON.stringify({result}));
}catch(error){console.log(JSON.stringify({error:error.message}));process.exitCode=1;}
