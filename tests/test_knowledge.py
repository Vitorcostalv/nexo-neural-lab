import json
import pytest
from app.neural.knowledge import catalog, lookup
from app.neural import api, store
from app.config import ROOT
from tests.test_neural_lab import client

CASES=json.loads((ROOT/'lab-web/knowledge/cases.json').read_text(encoding='utf-8'))

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_shared_editorial_cases(case):
    result=lookup(case['q'],case.get('recent',[]))
    if 'contains' in case:assert case['contains'] in result['answer']
    if case.get('answerNull'):assert result['answer'] is None
    if 'method' in case:assert result['knowledge']['method']==case['method']

def test_knowledge_works_without_models_and_preserves_provenance_on_reload(client,monkeypatch):
    async def forbidden(*args,**kwargs):raise AssertionError('Curated answers must not call an LLM or embedding')
    monkeypatch.setattr(api.ollama,'generate_unlocked',forbidden)
    monkeypatch.setattr(api.ollama,'embed_unlocked',forbidden)
    first=client.post('/api/chat',json={'text':'quantos anos tem a antiga rainha da inglaterra?'}).json()
    assert '96' in first['answer'] and not first['sources']
    second=client.post('/api/chat',json={'text':'E a ultima?'}).json()
    assert 'Elizabeth II' in second['answer']
    messages=store.history()
    assert messages[-1]['knowledge']['version']==catalog()['version']
    assert messages[-1]['knowledge']['refs']
    assert not messages[-1]['sources']
    assert client.get('/api/state').json()['count']==0
