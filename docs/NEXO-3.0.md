# Nexo 3.0 — fontes, estratégias e revisão humana

Evolução sobre o checkout limpo `e88e764` do Nexo 2.0. A implementação e as medições descritas neste documento foram feitas localmente, antes da publicação autorizada junto ao [Nexo 4.0](NEXO-4.0.md). Não houve migração de framework. Os resultados de Nexo 2.0, seu corpus Aurora-v1 e seus formatos de memória permanecem preservados.

## Executar

Edição estática (Node 22.13+; localhost ou HTTPS):

```sh
node scripts/build-web.mjs
python -m http.server 8020 --directory dist --bind 127.0.0.1
```

Abra `http://127.0.0.1:8020`. Não há backend obrigatório nem chave de IA. Documentos são processados no dispositivo. Modelos não são carregados ao abrir as abas; cada ação informa o download necessário. A demonstração ilustrativa do Nexo 2.0 continua separada dos novos resultados reais.

Edição Python: instale `requirements.txt` e siga a configuração Ollama do README para a conversa existente. A interface nova usa os mesmos módulos JavaScript de documentos e o mesmo IndexedDB da edição estática, **por origem do navegador**; não grava documentos no SQLite. Para habilitar o reranker CPU local:

```sh
npm install --prefix runtime/nexo-validation --no-audit --no-fund @huggingface/transformers@3.8.1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Abra `http://127.0.0.1:8000` e recarregue após instalar as dependências opcionais. O endpoint `/api/research/capabilities` não inicia nem baixa modelos. O reranker exige consentimento explícito e executa em subprocesso Node/CPU; a desconexão encerra esse processo. Documentos nunca são enviados para um serviço de inferência externo. A configuração de chave local existente continua sendo aplicada quando presente.

As novas consultas documentais usam MiniLM e a LLM Qwen do **navegador**, inclusive quando a interface é servida por Python. A conversa e o classificador legados da edição Python continuam com Ollama/EmbeddingGemma e NumPy. O painel de conexão legado descreve esses modelos legados; o registro de cada consulta documental identifica o runtime efetivamente utilizado.

| Funcionalidade | Web estática | Python local |
|---|---|---|
| Documentos, versões, fontes e divergências | JavaScript + IndexedDB | Os mesmos módulos/IndexedDB no navegador |
| BM25, vetorial, RRF e orçamento de tokens | Sim; MiniLM/tokenizador sob demanda | Igual à web para documentos |
| Reranker neural | Desabilitado; compatibilidade WASM não prometida | Node/ONNX CPU opcional, testado |
| Aprendizado ativo e bancada de chunking | Worker JavaScript, modelos sob demanda | Mesmo worker; não altera MLP NumPy legado |
| Conversa/MLP anteriores | Preservados | Ollama/NumPy preservados |
| Experimentação sem/com contexto documental | Sim, em Consulta e fontes | Sim, com LLM do navegador |
| Comparação de memórias da área Experimentos 2.0 | Preservada | Continua com suporte informado na interface legada |

## Dependências e downloads verificados

| Componente | Versão/revisão | Uso e licença |
|---|---|---|
| PDF.js | `pdfjs-dist 6.5.438`, build legacy | Extração/renderização; Apache-2.0 e licenças de fontes/decodificadores em `lab-web/vendor/pdfjs` |
| Transformers.js | `3.8.1` | Embeddings/tokenizador/LLM no worker; Apache-2.0 |
| MiniLM | `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, revisão `2c4055b12046f11709e9df2c122e59ffbdc2f900` | q8, 384 dimensões; pesos 118.308.126 bytes + tokenizador ~17 MB |
| Tokenizador Qwen2.5 | `onnx-community/Qwen2.5-0.5B-Instruct`, revisão `22942cb7d7ba4cc81bb4673549ca4d4614469b5e` | ~7 MB sem pesos; conta IDs de tokens de verdade |
| Cross-encoder mMARCO | `SugoLabs/mmarco-mMiniLMv2-L12-H384-v1`, revisão `6772eee1ea62dc82e1fcaaf3ed90c269fdcb1fcf` | Multilíngue, inclui português; Apache-2.0; q8 com 118.235.028 bytes + tokenizador ~17 MB |
| Qwen2.5 0.5B CPU | Mesmo repositório/revisão do tokenizador | q4 com 786.156.820 bytes; geração opcional, além do runtime |

MiniLM e reranker exigem aproximadamente **135 MB cada**, incluindo os respectivos tokenizadores, mais bibliotecas/runtime. O caminho GPU da LLM usa os artefatos MLC existentes, com tamanho diferente. RAM de pico não foi perfilada; não se promete suporte de modelos a todo celular. Reranker limitado a 24 pares, em lotes de quatro, com até 512 tokens por par; o truncamento real é registrado por ID.

PDF.js e seus arquivos estáticos somam aproximadamente 3,6 MB. A aplicação não inclui o sandbox/QuickJS de PDF.js nem executa ações, scripts, anexos ou formulários XFA de PDFs. A visualização usa somente canvas e texto; não cria URLs públicas dos arquivos.

No helper CPU, downloads de pesos são verificados por tamanho e SHA-256 antes de uso; um cache legado só é reaproveitado após o mesmo checksum. `scripts/model-artifacts.mjs` registra os manifestos oficiais. Foi necessário contornar uma transferência nativa presa; o downloader HTTPS com verificação foi executado com sucesso em um download completo do reranker. Na web, as revisões dos modelos são fixas; o hash dos pesos não é recalculado pelo cliente antes de cada chamada.

Fontes oficiais: [PDF.js](https://mozilla.github.io/pdf.js/getting_started/), [API PDF.js](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [modelo e uso do cross-encoder](https://huggingface.co/SugoLabs/mmarco-mMiniLMv2-L12-H384-v1), [modelo base mMARCO](https://huggingface.co/cross-encoder/mmarco-mMiniLMv2-L12-H384-v1), [Transformers.js 3.8.1](https://huggingface.co/docs/transformers.js/v3.8.1/index).

## Fluxo de documentos e fontes

1. Em **Documentos**, escolha PDF, `.md` ou `.txt`. O limite é exibido antes de importar: 10 MB, 100 páginas e 400.000 caracteres por arquivo.
2. Extraia e confira nome, formato, tamanho, páginas, avisos, texto e estimativa de chunks. UTF-8 é estrito; Windows-1252 exige seleção explícita. NUL e caracteres de substituição são rejeitados, não corrigidos silenciosamente.
3. Escolha divisão e datas declaradas. Indexação sem embeddings permite BM25 sem baixar pesos. A opção com MiniLM é explícita e cancelável.
4. A tarefa mostra leitura, extração, divisão, embeddings e persistência. O catálogo só aponta para o novo índice após commit atômico de arquivo, versão e chunks. Falhas/cancelamento anteriores não deixam índice parcialmente ativo.
5. Em **Consulta e fontes**, escolha estratégia, filtros e orçamento. A resposta gerada é opcional; fontes podem ser consultadas sem a LLM. O contexto recuperado é limitado por tokens reais de Qwen, excluindo prompt-base, pergunta e saída. Esses outros tokens ainda podem exceder a janela do runtime em entradas difíceis, causando erro explícito.
6. Abra a fonte pelo botão do trecho ou por uma referência válida emitida pelo modelo. PDF abre a página em canvas e destaca o intervalo no texto extraído abaixo; não há destaque geométrico garantido sobre a imagem. Markdown/TXT abrem texto e destaque de seção/linhas/intervalos. HTML importado aparece como texto.

PDFs sem texto extraível informam ausência de OCR; páginas com pouco texto recebem aviso. PDFs protegidos pedem cópia local desbloqueada. Extração não garante leitura perfeita de tabelas, fórmulas, colunas, fontes exóticas ou documentos danificados.

São coisas diferentes: candidato recuperado, trecho selecionado para contexto, trecho passado a uma chamada de geração e referência citada. O contexto pode estar apenas preparado quando nenhuma geração foi solicitada ou quando ela foi cancelada. IDs inexistentes, ou IDs que não estavam entre as fontes fornecidas, ficam não verificados e nunca viram links válidos. Um ID válido não prova que a afirmação seja sustentada.

O mapa de documentos mostra somente as fontes selecionadas. Arestas ligam chunks da mesma versão documental, uma relação de proveniência verificável. A disposição circular não é distância semântica nem pensamento da LLM. Os mapas e experimentos antigos continuam disponíveis.

## Contratos e persistência

| Módulo | Responsabilidade |
|---|---|
| `lab/contracts.js` | Schema 3, limites, hashes, revisão dos modelos e CSV seguro |
| `lab/documents.js`, `chunking.js` | Extração, versões, localizadores, referências e divisões determinísticas |
| `lab/storage.js` | IndexedDB, commits atômicos e controle otimista de revisão |
| `lab/search.js`, `cross-encoder.js` | BM25, RRF, cosseno, reranking e orçamento em tokens |
| `lab/active.js`, `chunk-benchmark.js` | Partições, seleção supervisionada e métricas de evidência |
| `lab/service.js` | Orquestração, snapshots e ativação explícita de índices |
| `lab/*-view.js`, `studio.js` | Interface, abertura segura de fontes e estados de tarefa |
| `browser/inference-worker.js` | Embeddings, tokenizador, geração e MLP fora da thread de apresentação |
| `app/neural/research.py` | API CPU opcional de reranking, consentimento e cancelamento |

O banco `nexo-research-v3` é uma migração **aditiva**, separada de `nexo-web-v1`. Não reescreve memórias, pesos ou experimentos do Nexo 2.0. Seus stores são `catalog`, `indices`, `files`, `results` e `active`. O catálogo usa `schema=3` e revisão crescente; uma gravação sobre revisão obsoleta é rejeitada. A migração pura preserva campos legados e recusa schemas futuros.

Documento possui ID estável, versões ordenadas e conteúdo extraído. Versão registra hash dos bytes, hash da representação extraída, importação, publicação declarada, validade, substituição e configuração de extração. Chunk possui ID derivado de versão/configuração/texto/localizadores, hash textual, offsets e modelo/revisão do índice. Embeddings só são reaproveitados se texto, modelo, revisão, dtype, dimensão e pré-processamento coincidirem.

Limites: 20 documentos, 60 versões, 24 índices e 5.000 chunks no catálogo; estimativa de até 100 MB para arquivos/índices. Resultados: até 20, rejeitando novos ao atingir o limite, sem apagar históricos. Pool: 2.000 textos; anotações: 10.000; rodadas: 20. Falhas reais de quota do navegador são reportadas e abortam a transação. As estimativas não substituem a quota real nem incluem exatamente todo overhead de IndexedDB, histórico e cache de modelos.

Índices experimentais usam `experiment:<id>`; reindexações usam namespace separado e só viram ativas por ação explícita. Arquivo/índice ativo anterior e resultados históricos não são sobrescritos. O benchmark persiste os índices e seu resultado na mesma transação. Snapshots preservam versões, conteúdo, parâmetros, fontes, contexto e hashes; vetores não são duplicados nos relatórios públicos.

Catálogo/relatórios exportados não são uma cópia binária dos PDFs originais nem um formato de restauração automática do IndexedDB. Guarde os arquivos originais e os JSONs. As origens GitHub Pages, localhost:8020 e localhost:8000 possuem armazenamentos separados.

## Recuperação e reranking

BM25 aplica NFKD, remove marcas combinantes, uniformiza caixa e preserva tokens como `AUR-27/B`, `SEN-42` e siglas. Não usa stemming. Parâmetros: k1=1,2 e b=0,75; IDF `log(1 + (N-df+0,5)/(df+0,5))`. Consulta vazia é erro de formulário; consulta tokenizada vazia ou com termos ausentes retorna lista lexical vazia.

Vetores são verificados e normalizados conforme o contrato de cosseno. O limiar vetorial padrão é 0,4. Candidatos por estratégia (padrão 24) são separados de trechos finais (padrão 5). Híbrida usa `Σ 1/(k+rank)`, com k=60 por padrão. Scores BM25 e cosseno nunca são somados diretamente.

Documento, versão, exclusão e validade são filtrados antes de todas as estratégias. O dia efetivamente aplicado é registrado, mesmo quando o formulário estava em “hoje”. Fontes sem datas são incluídas por padrão e identificadas como desconhecidas; podem ser excluídas. Importação nunca define validade ou publicação.

Reranking reordena o prefixo selecionado de candidatos antes da seleção final. A cauda não reordenada fica registrada e não compete silenciosamente com logits. O inspetor mostra ranking anterior/posterior, score lexical, cosseno, RRF, logit, filtros, truncamento, modelo/revisão e tempo adicional. Falhas mantêm o ranking original com `fallback=original-ranking` e mensagem de erro. O logit não é probabilidade de correção.

Esta evolução habilita o reranker somente na edição Python/Node CPU realmente testada. Não promete compatibilidade WASM/WebGPU do cross-encoder; nenhum texto é encaminhado a uma API remota para compensar incompatibilidade.

## Versões e divergências

Validade é um intervalo inclusivo de datas; publicação e importação são campos distintos. Versões substituídas ficam fora da busca padrão a partir do início de validade da substituta, ou imediatamente se ela não declarar início. Datas de validade continuam sendo aplicadas mesmo com “incluir substituídas”. Para consultas históricas, escolha a data adequada e/ou a inclusão explícita.

Nova versão não substitui outra automaticamente. O usuário registra a relação, pode desfazê-la e compara os textos lado a lado. Divergências são registradas manualmente com duas fontes, datas e cópias dos trechos, classificadas como atualização, escopo ou conflito não resolvido. Confirmar, descartar ou deixar pendente acrescenta histórico; nunca apaga ou corrige fatos automaticamente. Não há detector automático de contradição nesta versão.

## Aprendizado ativo

Use linhas de texto para pool sem rótulo, ou TSV de quatro colunas: `partição`, `rótulo`, `grupo`, `texto`. Partições aceitas: `pool`, `train`, `validation`, `test`. Declare grupos comuns para paráfrases/variantes; a aplicação detecta duplicatas normalizadas, mas não reconhece todas as paráfrases automaticamente. Um grupo não pode atravessar treino/pool, validação e teste.

Importe pelo menos duas classes com três exemplos rotulados por classe entre treino e validação, garantindo presença de todas no treino e validação separada. Teste humano rotulado é opcional; sem ele, métricas de teste ficam ausentes. Após a primeira rodada, o conjunto de teste é congelado e novos exemplos de teste são rejeitados nesse ciclo.

Treine explicitamente, selecione por menor margem, maior entropia ou aleatório e revise. O campo humano começa vazio; a previsão é somente informativa. Anotar/corrigir invalida o modelo até retreinar. Pular evita nova sugestão; histórico e origem permanecem. O teste não entra na seleção nem no ajuste de pesos/hiperparâmetros.

MLP JavaScript existente: 64/24, ReLU/softmax, Adam, lr=0,003, batch=16, L2=0,0001, betas 0,9/0,999, epsilon 1e-8; parada após 30 épocas sem melhora de 1e-5. Rodadas humanas: até 180 épocas, semente 42. Arquitetura, configuração, IDs e hash do dataset são registrados por rodada. Acurácia, macro-F1 e matriz de confusão ficam disponíveis para comparação.

O benchmark fictício tem 36 textos/3 classes e usa sementes 11/42/73, dois exemplos iniciais por classe, validação/teste agrupados separados, orçamentos adicionais 0/3/6 e até 60 épocas. Dentro de cada semente, os dois braços têm as mesmas partições e configuração. A seleção recebe pool sem rótulos; o oracle do fixture revela o rótulo só após a escolha. Anotação automatizada de validação é identificada como oracle de fixture, não como decisão humana real nem previsão transformada em verdade.

## Chunking e metodologia da avaliação

Fixa com sobreposição, parágrafos e seções/títulos usam **caracteres UTF-16**, preservando intervalos e páginas. Blocos longos são divididos; PDF não mistura páginas; Markdown mantém caminhos ATX/Setext. Sobreposição aplica-se às janelas fixas e à divisão de blocos longos. Parágrafos/seções menores são agrupados até o limite.

Cada bancada usa as mesmas versões, perguntas, modelo/revisão e recuperação, com contexto limitado pelo mesmo número de tokens Qwen. Truncamento de contexto também recorta localizadores. Há número de chunks, bytes estimados, tempo de indexação/busca e contexto selecionado. Resultados/configurações/proveniência são exportáveis em JSON e CSV.

O gabarito aponta para intervalos originais, não IDs dos chunks. Cobertura exige a união integral do intervalo esperado; duplicatas/sobreposições contam uma vez. Hit@k indica cobertura de alguma evidência pelo top-k; MRR usa o primeiro prefixo do ranking que cobre integralmente uma evidência. Recall é a fração de evidências esperadas cobertas no contexto final. Perguntas sem resposta têm recall/Hit/MRR ausentes e são medidas por recuperação indevida, não misturadas a acertos.

Precisão é calculada somente quando o gabarito declara anotação exaustiva e as evidências correspondem a unidades estáveis de origem disponíveis. Conta unidades relevantes tocadas / unidades tocadas, deduplicadas; o recall continua exigindo cobertura integral. Casos sem correspondência completa de unidades recebem precisão ausente, não inventada. As médias de precisão e cobertura podem ter denominadores diferentes, informados no JSON.

`aurora-v3` possui MD com duas versões, TXT, PDF de duas páginas, códigos/siglas, datas, distratores, perguntas sem resposta e pergunta com duas evidências. São 5 perguntas dev e 11 test (8 respondíveis, 3 sem resposta). O split foi fixado antes da medição. Configurações são pré-definidas, não escolhidas pelo teste. O corpus de oito perguntas Aurora-v1 permanece intacto e sua avaliação histórica continua acessível.

## Resultados reais — 06/11/2026

[Relatório completo](../reports/research-v3-validation.json), [CSV de chunking](../reports/research-v3-chunking.csv), [API CPU real](../reports/research-v3-api.json), [DOM emulado](../reports/research-v3-dom.json). Execução em Windows, Node v24.15.0, Ryzen 5 5600, ONNX Runtime nativo CPU e modelos/revisões acima. Isso não é medição de navegador/WASM/WebGPU.

Teste reservado, oito perguntas respondíveis:

| Estratégia | Cobertura de evidências | Hit@5 | MRR | MRR com reranker |
|---|---|---|---|---|
| Vetorial | 87,5% | 87,5% | 0,875 | 0,875 |
| BM25 | 100% | 100% | 1,0 | 1,0 |
| Híbrida RRF | 100% | 100% | 0,9375 | 1,0 |

Precisão por unidade de origem no teste: 7,64% para vetorial e 5,82% para lexical/híbrida, nos nove casos em que o gabarito permitiu esse cálculo, incluindo três sem resposta. Os chunks maiores carregam muita informação não pedida. Houve recuperação indevida em 2/3 perguntas sem resposta na vetorial e 3/3 na lexical/híbrida; o reranker não resolveu isso. Nenhuma dessas medidas é probabilidade de verdade ou qualidade de resposta.

Bancada híbrida, mesmo orçamento de 500 tokens: fixa 200/50 produziu 8 chunks; parágrafos 800/100, 5; seções 1200/120, 9. Todas cobriram 100% das evidências respondíveis do teste, com MRR 0,9375. Não há evidência nessa amostra de que uma dessas divisões melhore cobertura; bytes, tempos e quantidades de contexto estão no JSON/CSV.

MLP: margem e aleatório tiveram macro-F1 de teste de 100%, com desvio padrão zero nas três sementes, em todos os orçamentos. O corpus é fácil e os dois braços já começaram perfeitos; não houve ganho observado do aprendizado ativo.

O Qwen real respondeu “O prazo atual do protocolo AUR-27 é 15 de agosto de 2026.” com fontes no contexto, mas **não emitiu os IDs solicitados**. A interface não inventa citações para compensar: mostra zero citações e mantém os trechos fornecidos acessíveis abaixo. Uma resposta correta nesse caso não garante fidelidade em outros documentos.

O endpoint Python real retornou logits 9,2555 para o trecho de prazo e -8,8193 para um distrator, via ASGI/TestClient e Node CPU. São scores de relevância, não probabilidades de correção. A API de capacidades não carregou modelos.

## Validação e limitações

Verificação final em 06/11/2026: **54 testes JavaScript e 56 testes Python passaram**, incluindo os testes anteriores. Build estático e sintaxe passaram. O smoke HTTP conferiu **48 recursos** sob um subdiretório, incluindo módulos, fonte tipográfica, worker PDF, decoder WASM e fixtures PDF/MD/TXT, todos com status 200. O pytest mantém um aviso de depreciação do Starlette/AnyIO; não houve falha de teste. [Resultado HTTP](../reports/research-v3-http.json).

Testes de domínio incluem os três formatos/localizadores, PDF protegido/sem texto, chunking, dedup, interrupção, BM25/RRF conhecidos, filtros temporais, reranking/fallback, referências, isolamento de grupos e oracle, métricas, incompatibilidade e snapshots. A validação real verificou transações com fake-indexeddb, banco legado preservado, revisão concorrente rejeitada e índices experimentais isolados. Quota real de navegador não foi simulada como medição de hardware.

O DOM da aplicação completa foi exercitado com modelos explicitamente substitutos em larguras configuradas de 360/1440: prévia segura de HTML importado, abertura de referência válida, bloqueio de ID falso, versões, consulta histórica, três buscas, reindexação/ativação, chunking, anotação/retreinamento e mapa movido entre seções. Nenhum worker de modelo foi criado ao abrir as views. Esses testes não medem qualidade semântica nem calculam layout CSS.

**Pendentes por infraestrutura:** inspeção visual real desktop/celular, tecnologia assistiva e execução dos novos fluxos com WASM/WebGPU no navegador. O host de navegador e o pipe nativo computer-use continuam indisponíveis. Os dois PNGs de `reports/research-pdf/` foram inspecionados, mas são páginas do PDF fictício, não screenshots da aplicação.

Recuperação lexical/vetorial e montagem de relatórios são JavaScript limitado a 5.000 chunks; consultas muito grandes ainda podem custar tempo na thread principal entre etapas assíncronas. Embeddings, LLM, tokenização e MLP usam worker; extração PDF usa o worker PDF.js; reranking usa subprocesso CPU. A interface pagina candidatos e versões. Prefira uma aba para operações pesadas; revisão otimista protege gravações concorrentes, mas não constitui agendador global de GPU entre abas.

## Comandos de validação

```sh
python -m pytest -q
node --test lab-web/tests/*.test.js
node scripts/build-web.mjs

# Opcionais: execução real, extração/renderização e emulação de DOM
npm install --prefix runtime/nexo-validation --no-audit --no-fund @huggingface/transformers@3.8.1 pdfjs-dist@6.5.438 jsdom@26.1.0 fake-indexeddb@6.2.4
node scripts/validate-research.mjs --generate
node scripts/validate-research-dom.mjs
python -m scripts.validate-research-api
```

Modelos/cache/dependências ficam em `runtime/` ignorado pelo Git e não entram no build. O helper real usa um banco temporário isolado para a API; não modifica o SQLite pessoal. PDF.js é vendorizado com versão/licenças fixas; as dependências opcionais só são necessárias para os helpers e reranker CPU.

## Roteiro de demonstração

1. Importe `lab-web/fixtures/aurora-v3/aurora-v1.md`, confira prévia/localizadores e indexe.
2. Pergunte pelo prazo, gere opcionalmente a resposta e abra o trecho real.
3. Reindexe com embeddings em namespace isolado e ative explicitamente; compare vetorial, BM25 e RRF.
4. Na edição Python com dependências opcionais, autorize reranking e compare posições/logits/tempo.
5. Importe `aurora-v2.md` como nova versão do mesmo documento, declare as datas e marque a relação de substituição. Compare consulta atual e maio de 2026.
6. Registre uma divergência entre dois IDs, abra ambas as fontes e classifique como atualização/escopo/conflito, preservando o histórico.
7. Em Avaliação, execute o corpus ampliado sem misturar dev/test; exporte JSON/CSV. Em Chunking, compare divisões com o mesmo orçamento.
8. Importe TSV rotulado/separado e pool sem rótulo em Aprendizado ativo, treine, revise uma sugestão e retreine. Compare rodadas e o benchmark aleatório.

Não apresente o modo ilustrativo antigo como inferência real, nem os resultados CPU pré-calculados deste relatório como execução instantânea no celular.
