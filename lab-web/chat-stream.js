export async function readEventStream(response,onDelta){
  if(!response.body)throw new Error('Seu navegador não disponibilizou a resposta em tempo real.');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',result=null;
  function line(value){
    if(!value.startsWith('data:'))return;
    const event=JSON.parse(value.slice(5).trim());
    if(event.type==='delta')onDelta(event.text);
    else if(event.type==='done')result=event.result;
    else if(event.type==='error')throw new Error(event.detail||'A resposta foi interrompida.');
  }
  try{
    while(true){
      const {done,value}=await reader.read();
      buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
      let end;
      while((end=buffer.indexOf('\n'))>=0){line(buffer.slice(0,end).replace(/\r$/,''));buffer=buffer.slice(end+1);}
      if(done){if(buffer.trim())line(buffer);break;}
    }
    if(!result)throw new Error('A conexão terminou antes da resposta completa. Sua mensagem foi preservada para tentar novamente.');
    return result;
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
}
