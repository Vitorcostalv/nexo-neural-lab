# Nexo 4.0 · Neural Learning Lab

**Laboratório interativo de deep learning, memória vetorial e RAG.**

[![Quality checks](https://github.com/Vitorcostalv/nexo-neural-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/Vitorcostalv/nexo-neural-lab/actions/workflows/ci.yml)
[![Deploy](https://github.com/Vitorcostalv/nexo-neural-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/Vitorcostalv/nexo-neural-lab/actions/workflows/pages.yml)

[Abrir aplicação](https://vitorcostalv.github.io/nexo-neural-lab/) · [Relatório técnico](docs/PRODUCAO.md)

## Companheiro e continuidade local

**Companheira 3D por interação:** [movimentos automáticos e prompt atualizado](docs/COMPANHEIRA-INTERACOES.md). [menina chibi, origem/licenças, clips e vídeos de navegador](docs/COMPANHEIRA-CHIBI.md). Modelo GLB articulado, AnimationMixer, repouso, aceno, passos no lugar, sentar/levantar e satisfação. Digitação, leitura e dúvida continuam pendentes.

A companheira 3D tem cabelo escuro e roupa verde, reações automáticas à escrita e às tarefas reais, respeito a movimento reduzido/desativado e fallback estático da mesma personagem. As versões SVG e digital anteriores estão preservadas. Conversa, Rede semântica, Biblioteca, perfis locais e backups continuam disponíveis.

A edição estática é publicada pelo workflow existente do GitHub Pages. [Guia de uso, persistência, formatos, testes e limitações do Nexo 4.0](docs/NEXO-4.0.md) · [Prompt de testes para o Codex do navegador](docs/TESTE-NAVEGADOR.md).

## Fontes, recuperação e aprendizado ativo

Os recursos desta evolução estão incluídos na publicação do Nexo 4.0. As medições abaixo foram realizadas localmente e não representam medições de desempenho do navegador.

- **Documentos:** PDF, Markdown e TXT locais, prévia antes de indexar, páginas/seções/linhas, versões, validade e revisão manual de divergências.
- **Consulta e fontes:** BM25, vetorial e híbrida por RRF; orçamento em tokens reais, contexto inspecionável, referências validadas e abertura local da origem.
- **Reranking opcional:** cross-encoder multilíngue em CPU na edição Python com dependências Node opcionais. Sem fallback para API externa.
- **Aprendizado ativo:** margem, entropia ou aleatório, rótulos humanos, histórico, teste fixo e retreinamento explícito do MLP.
- **Bancada:** divisões fixa, por parágrafos e seções em namespaces isolados; avaliação com evidências na fonte, JSON/CSV e corpus ampliado de 16 perguntas, mantendo Aurora-v1 intacto.

[Guia do Nexo 3.0, instalação, metodologia, resultados reais e limitações](docs/NEXO-3.0.md).

Nos testes reais em CPU, a cobertura no teste reservado foi 87,5% para vetorial e 100% para BM25/híbrida. O reranker melhorou uma posição no ranking híbrido, mas não resolveu recuperações em perguntas sem resposta. No corpus fácil do MLP, margem e aleatório empataram. Esses resultados não comprovam generalização. [Artefato completo](reports/research-v3-validation.json).

## Experimentos com memórias legadas (Nexo 2.0)

A nova aba **Experimentos** da edição web compara a mesma pergunta sem recuperação e com contexto recuperado. As gerações são sequenciais, com o mesmo modelo, parâmetros e prompt-base, sem histórico da conversa. Inspecione os trechos, exclua uma memória da próxima comparação (sem apagá-la), altere top-k/limiar e execute novamente. Os dez últimos registros ficam no IndexedDB, com snapshots, prompts, tempos e exportação JSON.

Para apresentar o fluxo imediatamente, escolha **Demonstração sem download de modelos**. Esse modo usa vetores artificiais e respostas roteirizadas, sempre identificados como simulação; não mede uma LLM e não altera a base pessoal. O mapa dentro de Experimentos usa o snapshot, destaca os trechos selecionados e inclui memórias relevantes antigas fora das 180 mais recentes.

O ranking mostra 20 candidatos por página, scores e motivos de seleção/exclusão. Barras mostram participação em caracteres no contexto recuperado; não são atenção da LLM nem influência causal medida. Carregamento, aquecimento e geração têm tempos separados. O primeiro fragmento de texto é uma aproximação do primeiro token. Uma execução isolada não constitui benchmark.

Em **Avaliar recuperação**, execute o MiniLM real sobre oito memórias fictícias e oito perguntas versionadas, com relevância esperada explícita. Consulte precisão, recall, MRR e hit rate e exporte o relatório. Não há métricas sem execução nem avaliação automática da qualidade da LLM.

[Guia do Nexo 2.0: demonstração, contratos e limites](docs/NEXO-2.0.md).

| Suporte 2.0 | Web / GitHub Pages | Python local |
|---|---|---|
| Comparação controlada e histórico de experimentos | Sim | Não; interface informa o suporte web |
| Recuperação configurável e auditável | Sim | API `/api/search` |
| Corpus Aurora e métricas na interface | Sim | Não |
| Conversa, ensino, MLP, mapa, importação/exportação | Preservados | Preservados |

![Nexo: memórias formando novas conexões](reports/nexo-birth.png)

Projeto de estudo de **Vitor Costa**: converse com uma LLM, ensine informações, inspecione embeddings e treine uma rede neural para reconhecer categorias. Cada memória ganha um nó no mapa 3D, com animação de nascimento e conexão. Uma projeção 2D atende dispositivos sem WebGL.

| | Web gratuita | Python local |
|---|---|---|
| Execução | Navegador, sem servidor de IA | FastAPI + Ollama |
| LLM | Qwen2.5 0.5B Instruct, MLC/ONNX q4 | Qwen3 4B Instruct 2507 |
| Embeddings | MiniLM multilíngue, 384 dimensões | EmbeddingGemma 300M, 768 dimensões |
| Memória | IndexedDB por navegador | SQLite no computador |
| Rede treinável | JavaScript em Web Worker | NumPy, CPU |
| Voz | Ditado do teclado do dispositivo | Whisper local opcional |
| Hospedagem | GitHub Pages + Actions | Sua máquina |

## O que realmente aprende?

O classificador é um **MLP treinável**, com duas camadas ocultas de 64 e 24 neurônios, ReLU e saída softmax. Usa backpropagation, Adam, regularização L2, divisão por categoria entre treino e validação, parada antecipada e restauração dos melhores pesos. A inicialização usa a semente 42. Os hiperparâmetros diferem entre as implementações Python e JavaScript.

Embeddings e LLM são pré-treinados. **Adicionar uma memória não retreina a LLM.** O RAG encontra informações e as inclui no contexto da pergunta. O MLP aprende categorias dos embeddings; não gera respostas.

O mapa representa memórias e similaridades aproximadas. Neurônios e impulsos de fundo são ilustrativos; não mostram pesos ou atividade interna da LLM.

## Experimente online

1. Mande **oi**: saudações simples respondem imediatamente.
2. Clique em **Nova memória** e guarde uma informação fictícia: “O observatório Aurora fica em Recife”. O primeiro uso baixa o modelo de embeddings.
3. Pergunte “Em qual cidade fica o observatório Aurora?”. A busca compara embeddings por cosseno; até cinco memórias relevantes entram no contexto da LLM.
4. Em **Treinamento**, adicione os 18 exemplos didáticos e treine. Veja curvas de perda e resultados separados de treino e validação.
5. Use **Exportar** para guardar uma cópia dos textos e categorias.

**Primeiro carregamento:** centenas de MB em modelos, além do runtime; os artefatos ONNX CPU verificados somam aproximadamente 0,9 GB (Qwen q4: 786 MB; MiniLM q8: 118 MB). O caminho WebGPU usa outros artefatos e pode variar. Downloads podem levar minutos e exigem internet e espaço no dispositivo. A aplicação informa o progresso. WebGPU acelera a geração quando disponível; WebAssembly oferece execução em CPU. Dispositivos com pouca memória podem não carregar a LLM. O modelo compacto tem capacidade e qualidade inferiores à edição local, especialmente em português.

Memórias ficam no navegador e não são sincronizadas. Limpar dados do site, usar navegação privada ou perder o dispositivo pode apagá-las. Exporte regularmente. Use uma aba por vez para editar a base. Arquivos exportados podem ser importados em ambas as edições; embeddings são recalculados no destino.

## Edição web em desenvolvimento

Requisitos: Node.js 22+ e servidor HTTP estático.

```sh
node scripts/build-web.mjs
python -m http.server 8020 --directory dist --bind 127.0.0.1
```

Acesse `http://127.0.0.1:8020`. Modelos e bibliotecas são baixados de Hugging Face, jsDelivr e dos arquivos oficiais MLC no GitHub, com versões de bibliotecas fixadas no código. WebLLM executa a LLM na GPU; Transformers.js executa embeddings e oferece a alternativa CPU para a LLM. O navegador reutiliza o cache quando disponível. Não há chave de API nem cobrança por inferência no servidor.

## Edição Python

Requisitos: Python 3.12+ e [Ollama](https://ollama.com/download). RAM/VRAM e armazenamento devem comportar os modelos escolhidos. Pesos, ambiente virtual, bancos e executáveis não são incluídos.

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

Configure Ollama em um terminal dedicado:

```powershell
# PowerShell; Linux/macOS: export OLLAMA_HOST=127.0.0.1:11435
$env:OLLAMA_HOST='127.0.0.1:11435'
ollama serve
```

Em outro terminal, configure o mesmo endereço e inicie:

```powershell
$env:OLLAMA_HOST='127.0.0.1:11435'
ollama pull qwen3:4b-instruct-2507-q4_K_M
ollama pull embeddinggemma:300m
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Acesse `http://127.0.0.1:8000`; API interativa em `/docs`. Variáveis opcionais estão em `.env.example`. Linux/macOS: substitua o executável por `.venv/bin/python` e adapte a sintaxe de variáveis.

`start.cmd` / `stop.cmd` são atalhos Windows para uma instalação portátil existente, com Ollama completo em `runtime/ollama/` e pesos em `models/`. Não são instaladores. Para instalação nova, use o procedimento acima. Whisper é opcional: instale o modelo antes de usar o microfone com `python -c "from huggingface_hub import snapshot_download; snapshot_download('Systran/faster-whisper-small', local_dir='models/whisper-small')"`.

## Arquitetura

```text
Texto -> embedding normalizado -> armazenamento vetorial
Pergunta -> embedding -> cosseno/top-k -> contexto -> LLM -> streaming
Exemplos rotulados -> embeddings -> MLP 64/24 -> categoria + softmax
Memórias -> projeção 3D -> nós e sinapses animados
```

| Pasta | Responsabilidade |
|---|---|
| `app/neural/` | API, SQLite, RAG, conversa, MLP NumPy |
| `app/ollama_client.py` | Cliente e streaming da inferência local |
| `lab-web/browser/` | Persistência e inferência da edição web |
| `lab-web/browser/retrieval.js`, `experiment-core.js`, `evaluation.js` | Busca auditável, execução controlada e avaliação versionada |
| `lab-web/experiments.js`, `experiments.css` | Interface responsiva dos experimentos |
| `lab-web/neural-*.js` | Visualização 3D/2D e animações |
| `tests/`, `lab-web/tests/` | Testes sem baixar modelos |
| `scripts/build-web.mjs` | Build estático com caminhos relativos |
| `.github/workflows/` | Validação e publicação contínua |

## Verificação

```sh
pip install -r requirements-dev.txt
python -m pytest -q
node --test lab-web/tests/*.test.js
node scripts/build-web.mjs
```

Os testes cobrem persistência, autenticação local, deduplicação, streaming, bloqueios, treinamento, busca vetorial, animações e os contratos de experimentos/cancelamento. Testes de inferência usam doubles explícitos e não medem qualidade de modelos reais. Isso não garante correção factual de todas as respostas. Validação com poucos exemplos não comprova generalização; softmax não fornece probabilidades calibradas. Consulte a verificação desta evolução em [NEXO-2.0.md](docs/NEXO-2.0.md).

## Privacidade e limites

Na web, inferência ocorre no dispositivo. Textos não são enviados a uma API de IA; provedores de arquivos recebem requisições normais de download. Não há analytics adicionado pelo projeto. GitHub Pages hospeda arquivos estáticos. Na edição Python, inferência e banco são locais. A API Python foi projetada para uso pessoal, sem isolamento de múltiplos usuários; mantenha-a em loopback.

A base suporta até 5.000 memórias; o mapa exibe as 180 mais recentes. A busca usa limiar de cosseno 0,4 e até cinco resultados. Pode recuperar informações irrelevantes ou omitir informações úteis. Textos importados são dados não confiáveis. Modelos podem produzir respostas incorretas mesmo com RAG.

## Licenças

Código sob MIT. Three.js e Manrope incluem licenças em `lab-web/vendor/`. Bibliotecas e modelos mantêm suas próprias licenças: [Qwen2.5](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct), [MiniLM](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), [Transformers.js](https://github.com/huggingface/transformers.js).
