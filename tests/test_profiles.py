import asyncio
import copy
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.neural import api, store
from app.config import settings

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DB',tmp_path/'legacy.sqlite3')
    monkeypatch.setattr(settings,'api_key','')
    monkeypatch.setattr(settings,'warm_on_startup',False)
    monkeypatch.setattr(api,'operation_lock',asyncio.Lock())
    monkeypatch.setattr(api.ollama,'inference_lock',asyncio.Lock())
    async def embed(texts):return [[1.,0.,0.,0.] for _ in texts]
    monkeypatch.setattr(api.ollama,'embed_unlocked',embed)
    with TestClient(api.app) as client:yield client

def test_profiles_isolate_sqlite_and_preserve_legacy(client):
    store.add_many([('Informação anterior','origem')],[[1,0,0,0]])
    profiles=client.get('/api/profiles').json();assert profiles==[{'id':'legacy-local','name':'Dados anteriores'}]
    created=client.post('/api/profiles',json={'name':'João'}).json();headers={'X-Nexo-Profile':created['id']}
    assert client.get('/api/state',headers=headers).json()['count']==0
    assert client.post('/api/memories',headers=headers,json={'text':'Só do João','label':'pessoal'}).status_code==200
    assert client.get('/api/state',headers=headers).json()['count']==1
    initial=client.get('/api/state',headers={'X-Nexo-Profile':'legacy-local'}).json();assert initial['memories'][0]['text']=='Informação anterior'
    assert store.all_memories()[0]['text']=='Informação anterior'
    assert client.patch('/api/profiles/'+created['id'],json={'name':'João Silva'}).status_code==200
    assert client.get('/api/state',headers=headers).json()['memories'][0]['text']=='Só do João'

def test_native_restore_is_staged_and_generation_is_profile_bound(client):
    initial=client.get('/api/profiles').json()[0]['id'];headers={'X-Nexo-Profile':initial}
    client.post('/api/memories',headers=headers,json={'text':'São Paulo, café\ncom ação.','label':'notas'})
    snapshot=client.get('/api/profiles/'+initial+'/snapshot',headers=headers).json()
    target=client.post('/api/profiles',json={'name':'Restaurado'}).json()['id']
    stage=client.post('/api/profiles/'+target+'/stage',json={'snapshot':snapshot,'merge':False});assert stage.status_code==200
    assert client.get('/api/state',headers={'X-Nexo-Profile':target}).json()['count']==0
    restored={'X-Nexo-Profile':target,'X-Nexo-Generation':stage.json()['generation']}
    assert client.get('/api/state',headers=restored).json()['memories'][0]['text']=='São Paulo, café\ncom ação.'
    assert client.get('/api/state',headers={**restored,'X-Nexo-Profile':initial}).status_code==404
    invalid=copy.deepcopy(snapshot);invalid['tables']['memories'][0]['vector']={'base64':'invalid'}
    assert client.post('/api/profiles/'+target+'/stage',json={'snapshot':invalid,'merge':False}).status_code==422
    assert client.get('/api/state',headers=restored).json()['count']==1

def test_conflicting_merge_does_not_change_active_sqlite(client):
    identifier=client.get('/api/profiles').json()[0]['id'];headers={'X-Nexo-Profile':identifier}
    client.post('/api/memories',headers=headers,json={'text':'Memória um','label':'a'})
    snapshot=client.get('/api/profiles/'+identifier+'/snapshot',headers=headers).json()
    client.patch('/api/memories/1',headers=headers,json={'label':'b'})
    assert client.post('/api/profiles/'+identifier+'/stage',headers=headers,json={'snapshot':snapshot,'merge':True}).status_code==409
    assert client.get('/api/state',headers=headers).json()['memories'][0]['label']=='b'

def test_invalid_names_and_explicit_delete(client):
    identifier=client.get('/api/profiles').json()[0]['id']
    assert client.post('/api/profiles',json={'name':'\n'}).status_code==422
    assert client.request('DELETE','/api/profiles/'+identifier,json={'confirmation':'wrong'}).status_code==422
    assert client.request('DELETE','/api/profiles/'+identifier,json={'confirmation':'EXCLUIR Dados anteriores'}).status_code==200
    assert client.get('/api/state',headers={'X-Nexo-Profile':identifier}).status_code==404
    assert client.get('/api/profiles').json()==[]

def test_streaming_captures_profile_until_final_save(client,monkeypatch):
    import json
    client.get('/api/profiles')
    identifier=client.post('/api/profiles',json={'name':'Conversa'}).json()['id'];headers={'X-Nexo-Profile':identifier}
    async def stream(messages):
        yield 'Resposta '
        yield 'do teste.'
    monkeypatch.setattr(api.ollama,'generate_stream_unlocked',stream)
    response=client.post('/api/chat/stream',headers=headers,json={'text':'Uma pergunta geral'})
    events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
    assert events[-1]['type']=='done'
    assert any(e.get('state')=='generating' for e in events)
    messages=client.get('/api/state',headers=headers).json()['messages'];assert len(messages)==2
    assert client.get('/api/state',headers={'X-Nexo-Profile':'legacy-local'}).json()['messages']==[]

def test_selected_older_memories_stay_visible_in_bounded_graph(client):
    identifier=client.get('/api/profiles').json()[0]['id'];headers={'X-Nexo-Profile':identifier}
    from app.neural.profiles import selected_database,resolve_profile
    token=selected_database.set(resolve_profile(identifier))
    try:store.add_many([(f'Memória {i}','') for i in range(185)],[[1,0,0,0]]*185)
    finally:selected_database.reset(token)
    graph=client.get('/api/graph?selected_ids=1',headers=headers).json()
    assert len(graph['nodes'])==180 and any(n['id']==1 for n in graph['nodes'])
    assert client.get('/api/graph?selected_ids=bad',headers=headers).status_code==422

def test_trained_classifier_survives_native_backup(client):
    from app.neural import network
    from app.neural.profiles import selected_database,resolve_profile
    identifier=client.get('/api/profiles').json()[0]['id'];headers={'X-Nexo-Profile':identifier}
    token=selected_database.set(resolve_profile(identifier))
    try:
        # Synthetic vectors test binary serialization, not semantic model quality.
        store.add_many([(f'Classe {label} item {i}',label) for label in ('a','b') for i in range(3)],[[1,0,0,0]]*3+[[0,1,0,0]]*3)
        metadata=network.train(epochs=10)
    finally:selected_database.reset(token)
    snapshot=client.get('/api/profiles/'+identifier+'/snapshot',headers=headers).json()
    target=client.post('/api/profiles',json={'name':'Modelo restaurado'}).json()['id']
    response=client.post('/api/profiles/'+target+'/stage',json={'snapshot':snapshot,'merge':False});assert response.status_code==200
    state=client.get('/api/state',headers={'X-Nexo-Profile':target,'X-Nexo-Generation':response.json()['generation']}).json()
    assert state['network']==metadata and state['count']==6
    changed=copy.deepcopy(snapshot);extra=copy.deepcopy(changed['tables']['memories'][0]);extra.update(id=7,text='Outra memória',digest=store.digest('Outra memória'));changed['tables']['memories'].append(extra)
    assert client.post('/api/profiles/'+identifier+'/stage',headers=headers,json={'snapshot':changed,'merge':True}).status_code==409
    assert client.get('/api/state',headers=headers).json()['count']==6
