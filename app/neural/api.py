import asyncio
import json
import re
import secrets
import time
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from app import ollama_client as ollama
from app.config import ROOT, settings
from app.neural import network, store
from app.neural.conversation import build_messages, social_reply

operation_lock = asyncio.Lock()
WEB = ROOT / 'lab-web'


@asynccontextmanager
async def lifespan(app):
    store.initialize()
    async def warm():
        try:
            async with ollama.inference_lock:
                await ollama.request('/api/generate',{'model':settings.chat_model,'prompt':'','keep_alive':'15m','options':{'num_ctx':settings.context_tokens}})
        except ollama.OllamaUnavailable:
            pass
    task=asyncio.create_task(warm()) if settings.warm_on_startup else None
    try:
        yield
    finally:
        if task and not task.done():
            task.cancel()
            try:await task
            except asyncio.CancelledError:pass


@asynccontextmanager
async def inference_guard(needed):
    if needed:
        async with ollama.inference_lock:yield
    else:yield


async def authorize(request: Request, x_api_key: Annotated[str | None, Header()] = None):
    if request.url.path.startswith('/api/'):
        origin = request.headers.get('origin')
        if origin and origin not in ('http://127.0.0.1:8000', 'http://localhost:8000', str(request.base_url).rstrip('/')):
            raise HTTPException(403, 'Origem não autorizada.')
        if settings.api_key and not secrets.compare_digest(x_api_key or '', settings.api_key):
            raise HTTPException(401, 'Configure a chave local no botão Conexão.')


app = FastAPI(title='Nexo · Laboratório de memória neural', version='1.3.0', lifespan=lifespan, dependencies=[Depends(authorize)])
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware('http')
async def fresh_application_assets(request: Request,call_next):
    own_asset=request.url.path.startswith('/assets/') and not request.url.path.startswith('/assets/vendor/')
    if own_asset:
        # Avoid mixed ES-module versions on phones and long-lived browser tabs.
        request.scope['headers']=[(k,v) for k,v in request.scope['headers'] if k.lower() not in {b'if-none-match',b'if-modified-since'}]
    response=await call_next(request)
    if own_asset:response.headers['Cache-Control']='no-store'
    return response


def clean_answer(text, sources):
    # Some local Qwen templates put reasoning in content despite think=False.
    # Only the final response may be shown or persisted.
    if '</think>' in text:
        text = text.rsplit('</think>', 1)[1].strip()
    elif '<think>' in text:
        raise ollama.OllamaUnavailable('O modelo não terminou a resposta final.')
    if not text.strip():
        raise ollama.OllamaUnavailable('Resposta final vazia.')
    valid = {str(s['id']) for s in sources}
    unknown = set(re.findall(r'\[M(\d+)\]', text)) - valid
    for id_ in unknown:
        text = text.replace(f'[M{id_}]', '[referência não verificada]')
    return text.strip()


@app.exception_handler(ValueError)
async def invalid(request, exc):
    return JSONResponse({'detail': str(exc)}, status_code=400)


@app.exception_handler(ollama.OllamaUnavailable)
async def unavailable(request, exc):
    return JSONResponse({'detail': 'Não foi possível consultar os modelos locais. Verifique a conexão e logs/api.err.log. Nenhuma resposta foi inventada.'}, status_code=503)


class MemoryInput(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    label: str = Field(default='', max_length=48)

    @field_validator('text')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('O texto não pode estar vazio.')
        return value.strip()


class ChatInput(MemoryInput):
    learn: bool = False


class SearchInput(BaseModel):
    query: str = Field(min_length=1, max_length=6000)


class LabelInput(BaseModel):
    label: str = Field(max_length=48)


class ImportInput(BaseModel):
    items: list[MemoryInput] = Field(min_length=1, max_length=100)


async def embeddings(texts, query=False):
    prefix = 'task: search result | query: ' if query else 'title: Memória pessoal | text: '
    chunks, ranges = [], []
    for text in texts:
        start = len(chunks)
        chunks.extend(text[i:i+1400] for i in range(0, len(text), 1400))
        if len(chunks) == start:
            raise ValueError('Texto vazio.')
        ranges.append((start, len(chunks)))
    vectors = []
    for start in range(0, len(chunks), 8):
        vectors.extend(await ollama.embed_unlocked([prefix+t for t in chunks[start:start+8]]))
    # Long individual memories use the normalized mean of bounded chunk embeddings.
    return [store.normalized(np.mean(vectors[a:b], axis=0)).tolist() for a, b in ranges]


def busy():
    if operation_lock.locked():
        raise HTTPException(409, 'Já existe uma operação em andamento. Aguarde sua conclusão.')


@app.get('/api/health')
async def health():
    try:
        async with httpx.AsyncClient(timeout=3, trust_env=False) as client:
            response = await client.get(settings.ollama_url+'/api/tags')
            response.raise_for_status()
            models = [m['name'] for m in response.json().get('models', [])]
        return {'online': True, 'ready': all(m in models for m in (settings.embed_model, settings.chat_model)), 'models': models, 'chat_model': settings.chat_model, 'embedding_model': settings.embed_model}
    except (httpx.HTTPError, ValueError, KeyError):
        return {'online': False, 'ready': False, 'models': [], 'chat_model': settings.chat_model, 'embedding_model': settings.embed_model}


def state():
    with store.connection() as db:
        count = db.execute('SELECT count(*) FROM memories').fetchone()[0]
        dimension = db.execute('SELECT dimension FROM memories LIMIT 1').fetchone()
        categories = [r[0] for r in db.execute("SELECT DISTINCT label FROM memories WHERE label<>'' ORDER BY label")]
        labeled = db.execute("SELECT count(*) FROM memories WHERE label<>''").fetchone()[0]
        memories = [store.public(r) for r in db.execute('SELECT * FROM memories ORDER BY id DESC LIMIT 500')]
    return {'count': count, 'dimensions': dimension[0] if dimension else None, 'categories': categories, 'labeled': labeled, 'network': network.metadata(), 'memories': memories, 'messages': store.history(), 'capacity': store.MAX_MEMORIES}


@app.get('/api/state')
def get_state():
    return state()


@app.get('/api/memories')
def memories(q: str = '', offset: int = 0):
    if len(q) > 200 or offset < 0:
        raise ValueError('Filtro inválido.')
    with store.connection() as db:
        return [store.public(r) for r in db.execute('SELECT * FROM memories WHERE instr(lower(text),lower(?)) OR instr(lower(label),lower(?)) ORDER BY id DESC LIMIT 500 OFFSET ?', (q, q, offset))]


@app.post('/api/memories')
async def create_memory(body: MemoryInput):
    busy()
    async with operation_lock, ollama.inference_lock:
        vectors = await embeddings([body.text])
        prediction = network.predict(vectors[0])
        new_ids = store.add_many([(body.text, body.label)], vectors,return_ids=True)
        return {'added': len(new_ids), 'new_memory_ids':new_ids, 'prediction': prediction}


@app.get('/api/memories/{id}')
def memory_details(id: int):
    with store.connection() as db:
        row = db.execute('SELECT * FROM memories WHERE id=?', (id,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Memória não encontrada.')
        vector = np.frombuffer(row['vector'], np.float32)
        return {**store.public(row), 'model':row['model'], 'norm':round(float(np.linalg.norm(vector)), 5), 'preview':vector[:24].round(6).tolist()}


@app.patch('/api/memories/{id}')
async def label_memory(id: int, body: LabelInput):
    busy()
    async with operation_lock:
        with store.connection() as db:
            if not db.execute('SELECT id FROM memories WHERE id=?', (id,)).fetchone():
                raise HTTPException(404, 'Memória não encontrada.')
            db.execute('UPDATE memories SET label=? WHERE id=?', (body.label.strip(), id))
            db.execute('DELETE FROM network')
            store.reset_context(db)
    return {'updated': True}


@app.delete('/api/memories/{id}')
async def delete_memory(id: int):
    busy()
    async with operation_lock:
        with store.connection() as db:
            if db.execute('DELETE FROM memories WHERE id=?', (id,)).rowcount == 0:
                raise HTTPException(404, 'Memória não encontrada.')
            db.execute('DELETE FROM network')
            store.reset_context(db)
            for row in db.execute('SELECT id,sources FROM messages').fetchall():
                sources = [s for s in json.loads(row['sources']) if s['id'] != id]
                db.execute('UPDATE messages SET sources=? WHERE id=?', (json.dumps(sources), row['id']))
    return {'deleted': True}


@app.delete('/api/history')
async def clear_history():
    busy()
    async with operation_lock:
        with store.connection() as db:
            db.execute('DELETE FROM messages')
            db.execute('DELETE FROM conversation_state')
    return {'deleted': True}


@app.post('/api/search')
async def search(body: SearchInput):
    busy()
    async with operation_lock, ollama.inference_lock:
        vector = (await embeddings([body.query], query=True))[0]
        return {'sources': store.retrieve(vector), 'prediction': network.predict(vector)}


async def chat_events(body: ChatInput,stream=False):
    busy()
    started = time.perf_counter()
    new_ids=[]
    reply=None if body.learn else social_reply(body.text)
    async with operation_lock, inference_guard(reply is None):
        yield {'type':'status','stage':'preparing'}
        if body.learn:
            vector = (await embeddings([body.text]))[0]
            prediction = network.predict(vector)
            new_ids = store.add_many([(body.text, body.label)], [vector], origin='conversation',return_ids=True)
            added=len(new_ids)
            answer = 'Memória armazenada com seu embedding. Ela poderá ser recuperada por significado nas próximas perguntas.' if added else 'Essa informação já está na memória. Mantive o registro existente, sem duplicá-lo.'
            sources = []
        elif reply is not None:
            answer, sources, prediction, added = reply, [], None, 0
        else:
            with store.connection() as db:
                has_memories = bool(db.execute('SELECT EXISTS(SELECT 1 FROM memories)').fetchone()[0])
            if has_memories:
                vector = (await embeddings([body.text], query=True))[0]
                sources = store.retrieve(vector)
                prediction = network.predict(vector)
            else:
                # An empty RAG index must not add latency or an embedding dependency to general chat.
                sources, prediction = [], None
            sources = [{**s, 'excerpt':s['text'][:1400]} for s in sources]
            messages = build_messages(body.text, sources, store.recent_context())
            if stream:
                pieces=[]
                async for chunk in ollama.generate_stream_unlocked(messages):
                    pieces.append(chunk)
                    yield {'type':'delta','text':chunk}
                answer=clean_answer(''.join(pieces),sources)
            else:
                answer = clean_answer(await ollama.generate_unlocked(messages), sources)
            added = 0
        if stream and (body.learn or reply is not None):
            yield {'type':'delta','text':answer}
        store.save_turn(body.text, answer, sources)
        yield {'type':'done','result':{'answer': answer, 'sources': sources, 'prediction': prediction, 'learned': added, 'new_memory_ids':new_ids, 'seconds': round(time.perf_counter()-started, 2)}}


@app.post('/api/chat')
async def chat(body: ChatInput):
    result=None
    async for event in chat_events(body):
        if event['type']=='done':result=event['result']
    return result


@app.post('/api/chat/stream')
async def stream_chat(body: ChatInput):
    busy()
    async def events():
        try:
            async for event in chat_events(body,stream=True):
                yield 'data: '+json.dumps(event,ensure_ascii=False)+'\n\n'
        except (ollama.OllamaUnavailable,ValueError,HTTPException) as exc:
            detail=exc.detail if isinstance(exc,HTTPException) else str(exc)
            yield 'data: '+json.dumps({'type':'error','detail':detail},ensure_ascii=False)+'\n\n'
    return StreamingResponse(events(),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})


@app.post('/api/import')
async def import_memories(body: ImportInput):
    busy()
    async with operation_lock, ollama.inference_lock:
        vectors = await embeddings([item.text for item in body.items])
        new_ids = store.add_many([(item.text, item.label) for item in body.items], vectors, origin='import',return_ids=True)
        return {'added': len(new_ids), 'new_memory_ids':new_ids, 'duplicates': len(body.items)-len(new_ids)}


@app.get('/api/export')
def export():
    return JSONResponse({'format': 'nexo-memories-v1', 'items': [{'text': m['text'], 'label': m['label']} for m in store.all_memories()]}, headers={'Content-Disposition': 'attachment; filename="nexo-memorias.json"'})


@app.post('/api/train')
async def train():
    busy()
    async with operation_lock:
        return await run_in_threadpool(network.train)


@app.post('/api/transcribe')
async def transcribe(request: Request):
    from app.neural.audio import transcribe as transcribe_audio
    busy()
    async with operation_lock:
        payload = bytearray()
        async for chunk in request.stream():
            payload.extend(chunk)
            if len(payload) > 4_000_000:
                raise HTTPException(413, 'Áudio maior que 4 MB.')
        if len(payload) < 44:
            raise HTTPException(400, 'Nenhum áudio recebido.')
        return await run_in_threadpool(transcribe_audio, bytes(payload))


def graph_data():
    with store.connection() as db:
        total = db.execute('SELECT count(*) FROM memories').fetchone()[0]
        records = list(reversed(list(db.execute('SELECT * FROM memories ORDER BY id DESC LIMIT 180'))))
    if not records:
        return {'nodes': [], 'edges': [], 'total': 0}
    matrix = np.stack([np.frombuffer(r['vector'], np.float32) for r in records])
    if len(records) >= 3:
        rng = np.random.default_rng(42)
        projected = matrix @ rng.normal(size=(matrix.shape[1], min(24, matrix.shape[1]))).astype(np.float32)
        centered = projected - projected.mean(axis=0)
        u, s, _ = np.linalg.svd(centered, full_matrices=False)
        positions = u[:, :3] * s[:3]
        positions /= max(float(np.abs(positions).max()), 1e-6)
    else:
        positions = np.array([[i*1.2-.6, 0, 0] for i in range(len(records))])
    scores = matrix @ matrix.T
    edges, seen = [], set()
    for i in range(len(records)):
        for j in np.argsort(-scores[i])[:4]:
            pair = tuple(sorted((i, int(j))))
            if i != j and scores[i, j] >= .40 and pair not in seen:
                seen.add(pair)
                edges.append({'source': records[i]['id'], 'target': records[j]['id'], 'score': round(float(scores[i, j]), 3)})
    nodes = [{**store.public(r), 'position': positions[i].round(5).tolist()} for i, r in enumerate(records)]
    return {'nodes': nodes, 'edges': edges, 'total': total}


@app.get('/api/graph')
async def graph():
    return await run_in_threadpool(graph_data)


@app.get('/')
async def index():
    return FileResponse(WEB/'index.html', headers={'Cache-Control': 'no-cache'})


app.mount('/assets', StaticFiles(directory=WEB), name='assets')
