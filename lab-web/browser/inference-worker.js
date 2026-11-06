import {train} from './learning.js?v=1.4.1';
import {EMBEDDING,TOKENIZER} from '../lab/contracts.js?v=1.4.1';
import {trainRound,activeBenchmark} from '../lab/active.js?v=1.4.1';
let transformers,extractor,generator,engine,gpuFailed=false;
let researchExtractor,contextTokenizer;
const progress=(id,text,fraction=null)=>postMessage({id,progress:text,fraction});
async function library(){return transformers ||= await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');}
async function embed(text,id,detailed=false){const start=performance.now(),cached=!!extractor;const {pipeline,env}=await library();env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(!extractor){progress(id,'Baixando modelo de embeddings. Aguarde o primeiro carregamento…');extractor=await pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{revision:EMBEDDING.revision,dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')progress(id,`Embeddings: ${p.file} · ${Math.round(p.progress||0)}%`,(p.progress||0)/100);}});}
  researchExtractor=extractor;postMessage({id,phase:'retrieving',stage:'Calculando embedding'});
  const loaded=performance.now(),vector=Array.from((await extractor(text,{pooling:'mean',normalize:true})).data);
  return detailed?{vector,loadMs:loaded-start,inferenceMs:performance.now()-loaded,cached}:vector;
}
async function prepare(id){
  const start=performance.now(),cached=!!(engine||generator);
  if(!gpuFailed){try{
    const adapter=await navigator.gpu?.requestAdapter();
    if(adapter?.features.has('shader-f16')){
      if(!engine){progress(id,'Preparando Qwen na GPU. Baixando pesos e compilando shaders…');const {CreateMLCEngine}=await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm');
        engine=await CreateMLCEngine('Qwen2.5-0.5B-Instruct-q4f16_1-MLC',{initProgressCallback:p=>progress(id,`GPU: ${p.text}`,p.progress)},{context_window_size:2048});}
      return {backend:'webgpu',model:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',runtime:'WebLLM 0.2.86',seedSupported:true,cached,loadMs:performance.now()-start};
    }
    gpuFailed=true;
  }catch(error){if(engine){await engine.unload().catch(()=>{});engine=null;}gpuFailed=true;progress(id,'GPU indisponível. Preparando CPU; primeira execução pode ser lenta…');}}
  const {pipeline,env}=await library();env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  if(!generator){progress(id,'Preparando Qwen 0.5B q4 (~790 MB na CPU). Primeira execução pode levar minutos…');
    generator=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{dtype:'q4',device:'wasm',progress_callback:p=>{if(p.status==='progress')progress(id,`LLM CPU: ${p.file} · ${Math.round(p.progress||0)}%`,(p.progress||0)/100);}});
  }
  return {backend:'wasm',model:'onnx-community/Qwen2.5-0.5B-Instruct (q4)',runtime:'Transformers.js 3.8.1',seedSupported:false,seedNote:'Sem semente na API usada; decodificação greedy (do_sample=false).',cached,loadMs:performance.now()-start};
}
async function infer(messages,id,parameters={},emit=true){
  if(emit)postMessage({id,phase:'generating',stage:'Inferência local · aguardando o primeiro fragmento'});
  const start=performance.now();let first=null,answer='';
  const delta=text=>{if(text){first??=performance.now();answer+=text;if(emit)postMessage({id,delta:text});}};
  const maxTokens=parameters.maxTokens??220;
  if(engine){
    // Reset the KV cache explicitly: each condition has exactly these messages.
    await engine.resetChat();
    const chunks=await engine.chat.completions.create({messages,max_tokens:maxTokens,temperature:0,repetition_penalty:1.1,seed:parameters.seed??42,stream:true});
    for await(const chunk of chunks)delta(chunk.choices[0]?.delta.content||'');
  }else if(generator){
    const {TextStreamer}=await library();
    const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:delta});
    await generator(messages,{max_new_tokens:maxTokens,do_sample:false,repetition_penalty:1.1,streamer});
  }else throw Error('Prepare o modelo antes da inferência.');
  if(emit&&!answer.trim())throw Error('O modelo não produziu texto.');
  return {answer:answer.trim(),generationMs:performance.now()-start,firstTokenMs:first===null?null:first-start,firstTokenNote:'Tempo até o primeiro fragmento de texto emitido; não inclui carregamento ou aquecimento.'};
}
onmessage=async({data:{id,type,payload}})=>{try{
  let result;
  if(type==='embed')result=await embed(payload,id);
  else if(type==='embedResearch'){
    const lib=await library();lib.env.allowLocalModels=false;lib.env.backends.onnx.wasm.numThreads=1;
    if(!researchExtractor){progress(id,'Preparando embeddings com revisão fixa (~118 MB).');researchExtractor=await lib.pipeline('feature-extraction',EMBEDDING.model,{revision:EMBEDDING.revision,dtype:EMBEDDING.dtype,device:'wasm',progress_callback:p=>{if(p.status==='progress')progress(id,`MiniLM ${Math.round(p.progress||0)}%`,(p.progress||0)/100);}});}
    extractor=researchExtractor;postMessage({id,phase:'retrieving',stage:'Calculando embedding com o modelo preparado'});
    result=Array.from((await researchExtractor(payload,{pooling:'mean',normalize:true})).data);
  }else if(type==='tokenCount'){
    if(typeof payload!=='string'||payload.length>20000)throw Error('Contexto excedido.');
    const lib=await library();lib.env.allowLocalModels=false;
    if(!contextTokenizer){progress(id,'Preparando apenas tokenizador Qwen (~7 MB), sem pesos da LLM.');contextTokenizer=await lib.AutoTokenizer.from_pretrained(TOKENIZER.model,{revision:TOKENIZER.revision});}
    result=contextTokenizer.encode(payload,{add_special_tokens:false}).length;
  }else if(type==='activeTrain')result=await trainRound(payload,text=>progress(id,text));
  else if(type==='activeBenchmark')result=await activeBenchmark(payload.corpus,payload.config,text=>progress(id,text));
  else if(type==='embedDetailed')result=await embed(payload,id,true);
  else if(type==='prepareExperiment'){
    result=await prepare(id);progress(id,'Aquecendo o modelo (fora da medição das condições)…');const start=performance.now();
    await infer([{role:'user',content:'Oi'}],id,{maxTokens:1},false);result.warmupMs=performance.now()-start;
  }else if(type==='generateDetailed')result=await infer(payload.messages,id,payload.parameters);
  else if(type==='generate'){await prepare(id);result=(await infer(payload,id)).answer;}
  else if(type==='train')result=await train(payload,text=>progress(id,text));else throw Error('Operação desconhecida');
  postMessage({id,result});
}catch(error){postMessage({id,error:`${error?.message||String(error)}. Confira sua conexão, espaço disponível e compatibilidade do navegador.`});}};
