import {hash,integer,LIMITS} from './contracts.js?v=1.4.1';
export function codePointBoundary(text,end){return end>0&&end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end])?end-1:end;}
function nextStart(text,at){return at>0&&/[\uDC00-\uDFFF]/.test(text[at])&&/[\uD800-\uDBFF]/.test(text[at-1])?at+1:at;}
export function chunkConfig(input={}){
  const config={strategy:input.strategy??'paragraphs',size:input.size??800,overlap:input.overlap??100,unit:'UTF-16 characters',version:1};
  if(!['fixed','paragraphs','sections'].includes(config.strategy))throw Error('Estratégia de chunking inválida.');
  integer(config.size,100,2000,'Tamanho');integer(config.overlap,0,config.size-1,'Sobreposição');return config;
}
function segments(block,size,overlap){
  const parts=[];for(let at=0;at<block.text.length;){const end=codePointBoundary(block.text,Math.min(at+size,block.text.length));parts.push({text:block.text.slice(at,end),spans:[{...block.locator,start:block.locator.start+at,end:block.locator.start+end,chunkStart:0,chunkEnd:end-at}]});if(parts.length>LIMITS.chunks)throw Error('Quantidade de trechos excedida.');if(end===block.text.length)break;at=nextStart(block.text,Math.max(at+1,end-overlap));}
  return parts;
}
export function divideBlocks(blocks,input={}){
  const config=chunkConfig(input),result=[];let current=null,group='';
  if(config.strategy==='fixed'){
    const groups=new Map();for(const block of blocks){const key=block.locator.page??'text';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(block);}
    for(const items of groups.values()){
      let text='';const spans=[];for(const b of items){const start=text.length+(text?'\n'.length:0);text+=(text?'\n':'')+b.text;spans.push({...b.locator,chunkStart:start,chunkEnd:start+b.text.length});}
      for(let at=0;at<text.length;){const end=codePointBoundary(text,Math.min(at+config.size,text.length));result.push({text:text.slice(at,end),spans:spans.filter(s=>s.chunkEnd>at&&s.chunkStart<end).map(s=>({...s,start:s.start+Math.max(0,at-s.chunkStart),end:s.end-Math.max(0,s.chunkEnd-end),chunkStart:Math.max(0,s.chunkStart-at),chunkEnd:Math.min(end,s.chunkEnd)-at}))});if(result.length>LIMITS.chunks)throw Error('Quantidade de trechos excedida.');if(end===text.length)break;at=nextStart(text,Math.max(at+1,end-config.overlap));}
    }if(result.length>LIMITS.chunks)throw Error('Quantidade de trechos excedida.');return result;
  }
  const flush=()=>{if(current)result.push(current);if(result.length>LIMITS.chunks)throw Error('Quantidade de trechos excedida.');current=null;};
  for(const block of blocks){
    // Never merge different PDF pages; keep offsets in the extracted page coordinate system.
    const key=block.locator.page!=null?'page:'+block.locator.page:config.strategy==='sections'?JSON.stringify(block.locator.section):'text';
    if(block.text.length>config.size){flush();result.push(...segments(block,config.size,config.overlap));continue;}
    const separator=current?'\n':'';
    if(current&&(key!==group||current.text.length+separator.length+block.text.length>config.size))flush();
    if(!current){current={text:'',spans:[]};group=key;}
    const start=current.text.length+(current.text?'\n'.length:0);current.text+=(current.text?'\n':'')+block.text;current.spans.push({...block.locator,chunkStart:start,chunkEnd:start+block.text.length});
  }flush();
  if(result.length>LIMITS.chunks)throw Error('Quantidade de trechos excede o limite.');return result;
}
export async function makeChunks(version,input={}){
  const config=chunkConfig(input),parts=divideBlocks(version.blocks,config),configHash=await hash(config);
  return Promise.all(parts.map(async(part,ordinal)=>({id:'C'+(await hash([version.id,configHash,ordinal,part.text,part.spans])).slice(0,24),versionId:version.id,documentId:version.documentId,ordinal,text:part.text,textHash:await hash(part.text),locators:part.spans,documentName:version.name,version:version.ordinal,importedAt:version.importedAt,publishedAt:version.publishedAt,validFrom:version.validFrom,validTo:version.validTo,chunking:config})));
}
export function coversEvidence(chunk,evidence){
  if(chunk.versionId!==evidence.versionId)return false;
  // Evidence requires full original interval coverage. Multiple overlapping chunks can jointly cover it.
  return chunk.locators.some(s=>(evidence.page==null||s.page===evidence.page)&&s.start<evidence.end&&s.end>evidence.start);
}
export function evidenceCoverage(chunks,evidence){
  const ranges=chunks.filter(c=>coversEvidence(c,evidence)).flatMap(c=>c.locators.filter(s=>(evidence.page==null||s.page===evidence.page)&&s.start<evidence.end&&s.end>evidence.start).map(s=>[Math.max(s.start,evidence.start),Math.min(s.end,evidence.end)])).sort((a,b)=>a[0]-b[0]);
  let until=evidence.start;for(const [a,b] of ranges){if(a>until)break;until=Math.max(until,b);}return until>=evidence.end;
}
