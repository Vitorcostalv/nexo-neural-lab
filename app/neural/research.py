"""Optional, cancellable local cross-encoder. No third-party inference API."""
import asyncio
import json
import shutil

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import ROOT

router = APIRouter(prefix='/api/research')
lock = asyncio.Lock()


class Candidate(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=2000)


class RerankInput(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    documents: list[Candidate] = Field(max_length=24)
    consent: bool = False


@router.get('/capabilities')
def capabilities():
    installed = (ROOT / 'runtime/nexo-validation/node_modules/@huggingface/transformers/src/transformers.js').exists()
    return {'rerank': bool(shutil.which('node') and installed), 'backend': 'Node.js / ONNX Runtime CPU', 'downloadBytes': 118235028,
            'model': 'SugoLabs/mmarco-mMiniLMv2-L12-H384-v1', 'revision': '6772eee1ea62dc82e1fcaaf3ed90c269fdcb1fcf',
            'instruction': 'npm install --prefix runtime/nexo-validation @huggingface/transformers@3.8.1'}


@router.post('/rerank')
async def rerank(body: RerankInput, request: Request):
    async def events():
        process = None
        try:
            if not body.consent:
                yield json.dumps({'error': 'Autorize o download explicitamente.'})+'\n'
                return
            if lock.locked():
                yield json.dumps({'error': 'Reranker ocupado.'})+'\n'
                return
            async with lock:
                process = await asyncio.create_subprocess_exec('node', str(ROOT/'scripts/rerank-local.mjs'), cwd=str(ROOT),
                    stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
                process.stdin.write(body.model_dump_json().encode())
                await process.stdin.drain()
                process.stdin.close()
                while True:
                    if await request.is_disconnected():
                        process.kill()
                        await process.wait()
                        return
                    try:
                        line = await asyncio.wait_for(process.stdout.readline(), timeout=1)
                    except asyncio.TimeoutError:
                        yield json.dumps({'progress': {'stage': 'reranker local'}})+'\n'
                        continue
                    if not line:
                        break
                    yield line
                await process.wait()
        except (OSError, ValueError) as error:
            yield json.dumps({'error': str(error)})+'\n'
        finally:
            if process and process.returncode is None:
                process.kill()
                await process.wait()
    return StreamingResponse(events(), media_type='application/x-ndjson', headers={'Cache-Control': 'no-store', 'Content-Encoding': 'identity'})
