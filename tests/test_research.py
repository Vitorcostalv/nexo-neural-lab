import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from app.neural import api, research, store
from app.config import settings


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'DB', tmp_path/'research.sqlite3')
    monkeypatch.setattr(settings, 'warm_on_startup', False)
    monkeypatch.setattr(settings, 'api_key', '')
    monkeypatch.setattr(research, 'lock', asyncio.Lock())
    with TestClient(api.app) as client:
        yield client


def test_capabilities_are_read_only_and_do_not_start_models(client, monkeypatch):
    async def unexpected(*args, **kwargs):
        raise AssertionError('No process on opening capabilities')
    monkeypatch.setattr(research.asyncio, 'create_subprocess_exec', unexpected)
    data = client.get('/api/research/capabilities').json()
    assert data['downloadBytes'] == 118235028
    assert data['revision'] == '6772eee1ea62dc82e1fcaaf3ed90c269fdcb1fcf'


def test_reranker_requires_explicit_download_consent(client, monkeypatch):
    async def unexpected(*args, **kwargs):
        raise AssertionError('No model without consent')
    monkeypatch.setattr(research.asyncio, 'create_subprocess_exec', unexpected)
    response = client.post('/api/research/rerank', json={'query': 'prazo', 'documents': []})
    assert 'Autorize' in json.loads(response.text)['error']


def test_reranker_streams_progress_and_scores_without_shell(client, monkeypatch):
    written = []
    lines = [b'{"progress":{"percent":50}}\n', b'{"result":{"scores":[2.5]}}\n', b'']
    async def readline():
        return lines.pop(0)
    async def drain():
        return None
    process = SimpleNamespace(stdin=SimpleNamespace(write=written.append, drain=drain, close=lambda: None), stdout=SimpleNamespace(readline=readline), returncode=None)
    async def wait():
        process.returncode = 0
        return 0
    process.wait = wait
    process.kill = lambda: None
    async def spawn(*args, **kwargs):
        assert args[0] == 'node'
        assert str(args[1]).endswith('rerank-local.mjs')
        assert 'shell' not in kwargs
        return process
    monkeypatch.setattr(research.asyncio, 'create_subprocess_exec', spawn)
    response = client.post('/api/research/rerank', json={'query': 'prazo', 'documents': [{'id': 'C1', 'text': 'fonte local'}], 'consent': True})
    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[-1]['result']['scores'] == [2.5]
    assert json.loads(written[0])['documents'][0]['text'] == 'fonte local'
    assert response.headers['content-encoding'] == 'identity'


def test_reranker_rejects_unbounded_pairs_and_protects_origin(client):
    assert client.post('/api/research/rerank', json={'query': 'q', 'documents': [{'id': 'C', 'text': 'x'}]*25, 'consent': True}).status_code == 422
    assert client.post('/api/research/rerank', json={'query': 'q', 'documents': [{'id': 'C', 'text': 'x'*2001}], 'consent': True}).status_code == 422
    assert client.get('/api/research/capabilities', headers={'Origin': 'https://untrusted.example'}).status_code == 403


def test_reranker_disconnect_kills_owned_process(monkeypatch):
    async def run():
        killed = []
        async def drain():
            return None
        process = SimpleNamespace(stdin=SimpleNamespace(write=lambda data: None, drain=drain, close=lambda: None), returncode=None)
        async def wait():
            process.returncode = -1
            return -1
        process.wait = wait
        process.kill = lambda: killed.append(True)
        async def spawn(*args, **kwargs):
            return process
        async def disconnected():
            return True
        monkeypatch.setattr(research.asyncio, 'create_subprocess_exec', spawn)
        monkeypatch.setattr(research, 'lock', asyncio.Lock())
        response = await research.rerank(research.RerankInput(query='q', documents=[], consent=True), SimpleNamespace(is_disconnected=disconnected))
        async for _ in response.body_iterator:
            pass
        assert killed == [True]
    asyncio.run(run())
