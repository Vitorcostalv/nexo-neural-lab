import test from 'node:test';
import assert from 'node:assert/strict';
import {readEventStream} from '../chat-stream.js';

function response(text,size=3){const bytes=new TextEncoder().encode(text);let at=0;return new Response(new ReadableStream({pull(controller){if(at>=bytes.length)return controller.close();controller.enqueue(bytes.slice(at,at+size));at+=size;}}));}
test('streaming preserves split UTF-8 and emits text before completion',async()=>{
  const events='data: {"type":"delta","text":"Olá, "}\n\ndata: {"type":"delta","text":"você!"}\n\ndata: {"type":"done","result":{"answer":"Olá, você!"}}\n\n';
  const chunks=[];const result=await readEventStream(response(events),chunk=>chunks.push(chunk));
  assert.deepEqual(chunks,['Olá, ','você!']);assert.equal(result.answer,chunks.join(''));
});
test('stream failure does not return a successful partial answer',async()=>{
  await assert.rejects(readEventStream(response('data: {"type":"delta","text":"parcial"}\n\ndata: {"type":"error","detail":"interrompido"}\n\n'),()=>{}),/interrompido/);
});
test('missing completion is reported instead of silently accepted',async()=>{
  await assert.rejects(readEventStream(response('data: {"type":"delta","text":"parcial"}\n\n'),()=>{}),/resposta completa/);
});
