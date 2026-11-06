import {RERANKER} from './contracts.js?v=1.4.1';
export async function loadCrossEncoder(library,{device='cpu',onProgress=()=>{}}={}){
  const start=performance.now(),options={revision:RERANKER.revision,progress_callback:onProgress};
  const tokenizer=await library.AutoTokenizer.from_pretrained(RERANKER.model,options);
  const model=await library.AutoModelForSequenceClassification.from_pretrained(RERANKER.model,{...options,dtype:RERANKER.dtype,device});
  const loadMs=performance.now()-start;
  return {async rank(query,rows){
    if(rows.length>RERANKER.maxCandidates||query.length>1000||rows.some(r=>r.text.length>2000))throw Error('Limites do reranker excedidos.');
    const start=performance.now(),scores=[],truncated=[];
    for(let i=0;i<rows.length;i+=4){const batch=rows.slice(i,i+4);
      for(const row of batch){const full=tokenizer(query,{text_pair:row.text,truncation:false});truncated.push(full.input_ids.data.length>RERANKER.maxTokens);}
      const inputs=tokenizer(batch.map(()=>query),{text_pair:batch.map(r=>r.text),padding:true,truncation:true,max_length:RERANKER.maxTokens});
      const output=await model(inputs);scores.push(...output.logits.tolist().map(row=>row[0]));
    }
    return {...RERANKER,device,loadMs,inferenceMs:performance.now()-start,scores,truncated,scoreType:'raw cross-encoder logit, not probability of correctness',batchSize:4};
  },async dispose(){await model.dispose();}};
}
