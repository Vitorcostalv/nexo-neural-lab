import {train} from './learning.js';
let transformers,extractor,generator,engine,gpuFailed=false;
const progress=(id,text)=>postMessage({id,progress:text});
async function library(){return transformers ||= await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');}
async function embed(text,id){const {pipeline,env}=await library();env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(!extractor){progress(id,'Baixando modelo de embeddings. Aguarde o primeiro carregamento…');extractor=await pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')progress(id,`Embeddings: ${p.file} · ${Math.round(p.progress||0)}%`);}});}
  return Array.from((await extractor(text,{pooling:'mean',normalize:true})).data);
}
async function generate(messages,id){
  let emitted=false;
  if(!gpuFailed){try{
    const adapter=await navigator.gpu?.requestAdapter();
    if(adapter?.features.has('shader-f16')){
      if(!engine){progress(id,'Preparando Qwen na GPU. Baixando pesos e compilando shaders…');const {CreateMLCEngine}=await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm');
        engine=await CreateMLCEngine('Qwen2.5-0.5B-Instruct-q4f16_1-MLC',{initProgressCallback:p=>progress(id,`GPU: ${p.text}`)},{context_window_size:2048});}
      progress(id,'Modelo pronto · gerando resposta na GPU…');let answer='';const chunks=await engine.chat.completions.create({messages,max_tokens:220,temperature:.3,stream:true});
      for await(const chunk of chunks){const text=chunk.choices[0]?.delta.content||'';answer+=text;if(text){emitted=true;postMessage({id,delta:text});}}return answer.trim();
    }
    gpuFailed=true;
  }catch(error){if(engine){await engine.unload().catch(()=>{});engine=null;}gpuFailed=true;if(emitted)throw error;progress(id,'GPU indisponível. Preparando CPU; primeira execução pode ser lenta…');}}
  const {pipeline,env,TextStreamer}=await library();env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(!generator){progress(id,'Baixando Qwen 0.5B (~500 MB). Primeira execução pode levar minutos…');
    generator=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{dtype:'q4',device:'wasm',progress_callback:p=>{if(p.status==='progress')progress(id,`LLM CPU: ${p.file} · ${Math.round(p.progress||0)}%`);}});
  }
  progress(id,'Modelo pronto · gerando resposta na CPU…');
  let answer='';const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:chunk=>{answer+=chunk;postMessage({id,delta:chunk});}});
  await generator(messages,{max_new_tokens:220,do_sample:false,repetition_penalty:1.1,streamer});return answer.trim();
}
onmessage=async({data:{id,type,payload}})=>{try{let result;if(type==='embed')result=await embed(payload,id);else if(type==='generate')result=await generate(payload,id);else if(type==='train')result=await train(payload,text=>progress(id,text));else throw Error('Operação desconhecida');postMessage({id,result});}catch(error){postMessage({id,error:`${error?.message||String(error)}. Confira sua conexão, espaço disponível e compatibilidade do navegador.`});if(type==='generate')generator=null;}};
