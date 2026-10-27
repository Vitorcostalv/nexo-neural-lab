import asyncio
import math
import json

import httpx

from app.config import settings

# Um único trabalho pesado por vez para evitar disputa pela VRAM de 8 GB.
inference_lock = asyncio.Lock()


class OllamaUnavailable(RuntimeError):
    pass


async def request(path: str, payload: dict | None = None):
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_url, timeout=360, trust_env=False) as client:
            response = await (client.get(path) if payload is None else client.post(path, json=payload))
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OllamaUnavailable(f"Ollama indisponível ou modelo não carregado: {exc}") from exc


async def embed_unlocked(texts: list[str]) -> list[list[float]]:
    # Prefixos de documento/consulta recomendados pelo EmbeddingGemma.
    result = await request("/api/embed", {
        "model": settings.embed_model, "input": texts, "truncate": False, "keep_alive": "15m",
    })
    vectors = result.get("embeddings", [])
    if len(vectors) != len(texts):
        raise OllamaUnavailable("O modelo retornou quantidade incorreta de embeddings.")
    for vector in vectors:
        if not vector or any(not math.isfinite(x) for x in vector):
            raise OllamaUnavailable("Embedding inválido.")
    return vectors


def generation_request(messages: list[dict], stream=False):
    options = {
            "num_ctx": settings.context_tokens, "num_predict": settings.max_output_tokens,
            "temperature": 0.7, "top_p": 0.8, "top_k": 20, "seed": 42,
    }
    if settings.chat_model.split(':')[0].lower() == 'qwen3':
        # The bundled Ollama template unconditionally opens <think>, even with
        # think=False. Use Qwen3's documented non-thinking assistant prefill.
        prompt = ''
        for message in messages:
            role = message['role']
            if role not in {'system', 'user', 'assistant'}:
                raise ValueError('Papel de conversa inválido.')
            content = message['content'].replace('<|im_start|>', '<im_start>').replace('<|im_end|>', '<im_end>')
            prompt += f'<|im_start|>{role}\n{content}<|im_end|>\n'
        prompt += '<|im_start|>assistant\n'
        if 'instruct' not in settings.chat_model.lower():
            prompt += '<think>\n\n</think>\n\n'
        return '/api/generate', {
            'model':settings.chat_model, 'prompt':prompt, 'raw':True, 'stream':stream,
            'keep_alive':'15m', 'options':{**options, 'stop':['<|im_start|>', '<|im_end|>']},
        }
    return '/api/chat', {
            'model':settings.chat_model, 'messages':messages, 'stream':stream, 'think':False,
            'keep_alive':'15m', 'options':options,
    }


async def generate_unlocked(messages: list[dict]) -> str:
    path,payload=generation_request(messages)
    result=await request(path,payload)
    text=(result.get('response','') if path=='/api/generate' else result.get('message',{}).get('content','')).strip()
    if not text:
        raise OllamaUnavailable("O modelo retornou uma resposta vazia.")
    return text


class FinalTextFilter:
    """Suppress thinking blocks even when tags arrive across network chunks."""
    def __init__(self):
        self.buffer=''
        self.hidden=False

    def feed(self,text,final=False):
        self.buffer+=text
        output=''
        while self.buffer:
            tag='</think>' if self.hidden else '<think>'
            at=self.buffer.find(tag)
            if at>=0:
                if not self.hidden:output+=self.buffer[:at]
                self.buffer=self.buffer[at+len(tag):]
                self.hidden=not self.hidden
            else:
                keep=0 if final else len(tag)-1
                emit=max(0,len(self.buffer)-keep)
                if not self.hidden:output+=self.buffer[:emit]
                self.buffer=self.buffer[emit:]
                break
        if final and self.hidden:
            raise OllamaUnavailable('O modelo não terminou a resposta final.')
        return output


async def generate_stream_unlocked(messages):
    path,payload=generation_request(messages,stream=True)
    filter_=FinalTextFilter()
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_url,timeout=360,trust_env=False) as client:
            async with client.stream('POST',path,json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:continue
                    event=json.loads(line)
                    if event.get('error'):raise OllamaUnavailable(event['error'])
                    chunk=event.get('response','') if path=='/api/generate' else event.get('message',{}).get('content','')
                    visible=filter_.feed(chunk)
                    if visible:yield visible
                tail=filter_.feed('',final=True)
                if tail:yield tail
    except (httpx.HTTPError,ValueError) as exc:
        raise OllamaUnavailable('A conexão com o modelo local foi interrompida.') from exc


