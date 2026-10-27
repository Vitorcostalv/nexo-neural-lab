import {train} from './learning.js';
let transformers,extractor,generator,gpuFailed=false;
const progress=(id,text)=>postMessage({id,progress:text});
async function library(){return transformers ||= await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');}
async function embed(text,id){const {pipeline,env}=await library();env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(!extractor){progress(id,'Baixando modelo de embeddings. Aguarde o primeiro carregamento…');extractor=await pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')progress(id,`Embeddings: ${p.file} · ${Math.round(p.progress||0)}%`);}});}
  return Array.from((await extractor(text,{pooling:'mean',normalize:true})).data);
}
async function generate(messages,id){const {pipeline,env,TextStreamer}=await library();env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(!generator){progress(id,'Baixando Qwen 0.5B (~500 MB). Primeira execução pode levar minutos…');let device='wasm';try{if(!gpuFailed&&await navigator.gpu?.requestAdapter())device='webgpu';}catch{}
    try{generator=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{dtype:'q4',device,progress_callback:p=>{if(p.status==='progress')progress(id,`LLM: ${p.file} · ${Math.round(p.progress||0)}%`);}});}catch(error){if(device==='webgpu'){gpuFailed=true;progress(id,'GPU incompatível com o modelo. Iniciando em CPU…');return generate(messages,id);}throw error;}
  }
  let answer='';const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:chunk=>{answer+=chunk;postMessage({id,delta:chunk});}});
  await generator(messages,{max_new_tokens:220,do_sample:false,repetition_penalty:1.1,streamer});return answer.trim();
}
onmessage=async({data:{id,type,payload}})=>{try{let result;if(type==='embed')result=await embed(payload,id);else if(type==='generate')result=await generate(payload,id);else if(type==='train')result=await train(payload,text=>progress(id,text));else throw Error('Operação desconhecida');postMessage({id,result});}catch(error){postMessage({id,error:`${error?.message||String(error)}. Confira sua conexão, espaço disponível e compatibilidade do navegador.`});if(type==='generate')generator=null;}};
