export const SCHEMA=3;
export const LIMITS=Object.freeze({fileBytes:10*1024*1024,pages:100,textChars:400000,documents:20,versions:60,chunks:5000,indices:24,results:20,pool:2000,storedBytes:100*1024*1024});
export const EMBEDDING=Object.freeze({model:'Xenova/paraphrase-multilingual-MiniLM-L12-v2',revision:'2c4055b12046f11709e9df2c122e59ffbdc2f900',dtype:'q8',dimension:384,preprocessing:'mean-normalize-text-v1'});
export const TOKENIZER=Object.freeze({model:'onnx-community/Qwen2.5-0.5B-Instruct',revision:'22942cb7d7ba4cc81bb4673549ca4d4614469b5e',bytes:7039522});
export const RERANKER=Object.freeze({model:'SugoLabs/mmarco-mMiniLMv2-L12-H384-v1',revision:'6772eee1ea62dc82e1fcaaf3ed90c269fdcb1fcf',dtype:'q8',bytes:118235028,license:'Apache-2.0',maxTokens:512,maxCandidates:24});
export function checkAbort(signal){if(signal?.aborted)throw new DOMException('Operação cancelada.','AbortError');}
export function integer(value,min,max,name){if(!Number.isInteger(value)||value<min||value>max)throw Error(`${name}: use um inteiro de ${min} a ${max}.`);return value;}
export function dateValue(value,name='Data'){if(value==null||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error(`${name} inválida.`);return value;}
export function validity(input={}){
  const result={publishedAt:dateValue(input.publishedAt),validFrom:dateValue(input.validFrom),validTo:dateValue(input.validTo)};
  if(result.validFrom&&result.validTo&&result.validTo<result.validFrom)throw Error('Fim de validade anterior ao início.');return result;
}
export async function hash(value){const data=value instanceof Uint8Array?value:new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export const publicChunk=({vector,...chunk})=>chunk;
export const embeddingKey=(textHash,model)=>JSON.stringify([textHash,model?.model,model?.revision,model?.dtype,model?.dimension,model?.preprocessing]);
export function migrateCatalog(value){
  if(value?.schema>SCHEMA)throw Error('Catálogo de uma versão mais recente. Atualize a aplicação.');
  const base={schema:SCHEMA,revision:0,documents:[],versions:[],indices:[],divergences:[]};
  // Separate store: old Nexo state and experiment objects are never rewritten.
  if(!value||value.schema==null)return base;
  return {...base,...value,schema:SCHEMA};
}
export function exportCsv(rows){
  const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))],cell=value=>'"'+String(typeof value==='object'?JSON.stringify(value):value??'').replaceAll('"','""')+'"';
  // Avoid spreadsheet formula execution in exported user-authored strings.
  const safe=value=>typeof value==='string'&&/^\s*[=+@\-\t\r]/.test(value)?"'"+value:value;
  return [keys.map(cell).join(','),...rows.map(row=>keys.map(k=>cell(safe(row[k]))).join(','))].join('\r\n');
}
