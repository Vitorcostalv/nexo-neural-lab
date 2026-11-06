"""Real local API reranker check. Uses an isolated temporary SQLite database."""
import json
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient
from app.config import ROOT, settings
from app.neural import api, store

original_db = store.DB
original_warm = settings.warm_on_startup
with tempfile.TemporaryDirectory(prefix='nexo-research-api-') as temporary:
    store.DB = Path(temporary)/'isolated.sqlite3'
    settings.warm_on_startup = False
    try:
        with TestClient(api.app, headers={'X-API-Key': settings.api_key} if settings.api_key else {}) as client:
            capabilities = client.get('/api/research/capabilities').json()
            assert capabilities['rerank']
            response = client.post('/api/research/rerank', json={
                'query': 'Qual é o prazo do protocolo AUR-27?', 'consent': True,
                'documents': [
                    {'id': 'Cprazo', 'text': 'O prazo de entrega do protocolo AUR-27 passou para 15 de agosto de 2026.'},
                    {'id': 'Cdistrator', 'text': 'A biblioteca Brisa fica em Curitiba.'},
                ],
            })
            events = [json.loads(line) for line in response.text.splitlines() if line.strip()]
            errors = [e['error'] for e in events if 'error' in e]
            assert not errors, errors
            result = next(e['result'] for e in events if 'result' in e)
            assert len(result['scores']) == 2
            report = {'schema': 'nexo-local-reranker-api-v1', 'classification': 'documented real CPU execution',
                      'httpStatus': response.status_code, 'capabilities': capabilities, 'result': result,
                      'progressEvents': sum('progress' in e for e in events), 'privateData': False,
                      'limitation': 'TestClient ASGI, not a browser/network disconnect test.'}
            (ROOT/'reports/research-v3-api.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
            print(json.dumps({'httpStatus': response.status_code, 'scores': result['scores'], 'model': result['model']}))
    finally:
        store.DB = original_db
        settings.warm_on_startup = original_warm
