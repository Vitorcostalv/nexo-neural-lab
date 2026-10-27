"""Real Ollama integration checks against a disposable database (no personal data)."""
import asyncio
import json
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.neural import api, network, store


async def main():
    with tempfile.TemporaryDirectory(prefix='nexo-validation-') as folder:
        store.DB = Path(folder)/'validation.sqlite3'
        store.initialize()
        started = time.perf_counter()
        items = [
            ('No experimento fictício, Lia desenvolve aplicações usando Python.', 'tecnologia'),
            ('Redes neurais aprendem padrões com dados e treinamento.', 'tecnologia'),
            ('Embeddings transformam textos em vetores numéricos.', 'tecnologia'),
            ('Bancos de dados armazenam registros de forma persistente.', 'tecnologia'),
            ('Uma API conecta serviços de software por requisições.', 'tecnologia'),
            ('Programação em Python permite automatizar tarefas no computador.', 'tecnologia'),
            ('As árvores absorvem gás carbônico pela fotossíntese.', 'natureza'),
            ('Abelhas polinizam flores e ajudam na reprodução vegetal.', 'natureza'),
            ('A chuva participa do ciclo da água na natureza.', 'natureza'),
            ('As florestas abrigam diversas espécies de animais e plantas.', 'natureza'),
            ('Os oceanos contêm peixes e recifes de coral.', 'natureza'),
            ('Raízes absorvem água e nutrientes do solo.', 'natureza'),
            ('Para fazer pão, misture farinha, água, fermento e sal.', 'culinária'),
            ('Arroz pode ser refogado com alho antes de cozinhar.', 'culinária'),
            ('Legumes assados ficam saborosos com azeite e ervas.', 'culinária'),
            ('Sopa de legumes leva cenoura, batata e abóbora.', 'culinária'),
            ('Molho de tomate é preparado cozinhando tomates com temperos.', 'culinária'),
            ('Bolos crescem no forno pela ação do fermento.', 'culinária'),
        ]
        vectors = await api.embeddings([text for text, _ in items])
        assert store.add_many(items, vectors, origin='validation') == 18
        query = 'Qual linguagem a Lia utiliza para criar software?'
        vector = (await api.embeddings([query], query=True))[0]
        sources = store.retrieve(vector)
        assert any('Lia' in s['text'] for s in sources), sources
        train_started = time.perf_counter()
        metadata = network.train()
        prediction = network.predict(vector)
        assert prediction and prediction['label'] == 'tecnologia', prediction
        result = await api.chat(api.ChatInput(text=query))
        assert 'python' in result['answer'].lower(), result
        store.initialize()
        assert len(store.rows()) == 18 and network.metadata()
        graph = api.graph_data()
        assert len(graph['nodes']) == 18 and graph['edges']
        report = {'success': True, 'samples':18,'embedding_dimension':len(vectors[0]),
                  'retrieval_query':query,'retrieval_top':sources[:3],
                  'llm_answer':result['answer'],'answer_seconds':result['seconds'],
                  'training':metadata,'prediction':prediction,
                  'graph_nodes':len(graph['nodes']),'graph_edges':len(graph['edges']),
                  'total_seconds':round(time.perf_counter()-started,2),
                  'database':'temporary, removed after validation'}
        output = Path(__file__).resolve().parents[1]/'VALIDATION-NEXO.json'
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({k:report[k] for k in ('success','embedding_dimension','llm_answer','answer_seconds','total_seconds')}, ensure_ascii=True))


if __name__ == '__main__':
    asyncio.run(main())
