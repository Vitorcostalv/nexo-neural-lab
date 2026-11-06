# Nexo 2.0 — experimentos com memória

Este guia registra a implementação 2.0. Para perfis, companheiro, backup/restauração e as verificações atuais do checkout local, consulte [Nexo 4.0](NEXO-4.0.md).

## Demonstração curta

Para demonstrar sem baixar pesos, abra **Experimentos → Modo de execução → Demonstração sem download de modelos** e clique em **Simular comparação**. O cenário fixo usa oito memórias fictícias, vetores artificiais 2D e respostas roteirizadas. Exclua M1 e repita; confira o ranking, o mapa do snapshot, o histórico e o cancelamento. Os registros são marcados `mode=simulation`, não possuem tempos de inferência nem parâmetros aplicados e não modificam a biblioteca pessoal. Esse modo requer somente os arquivos normais do site, não os modelos de IA. A avaliação real fica desabilitada enquanto ele está selecionado.

Para testar modelos reais:

1. Gere a edição estática com `node scripts/build-web.mjs` e sirva `dist` por HTTP (`python -m http.server 8020 --directory dist --bind 127.0.0.1`). Acesse `http://127.0.0.1:8020`. Os modelos exigem internet no primeiro uso; HTTPS ou localhost é necessário para recursos seguros.
2. Em **Nova memória**, guarde a informação fictícia “O observatório Aurora fica em Recife”. Aguarde o embedding e o nascimento do nó no mapa.
3. Abra **Experimentos** e compare “Em qual cidade fica o observatório Aurora?”. Faça os downloads e a primeira execução antes de gravar o vídeo, se desejar uma demonstração curta. Não apresente esse preparo como inferência instantânea.
4. Mostre as respostas, os estados de cada condição, os tempos e o trecho selecionado. A LLM compacta pode errar ou produzir respostas iguais; a interface registra o que efetivamente aconteceu.
5. No ranking, marque **Excluir M…**. Compare novamente com a mesma pergunta. A memória continua na biblioteca; somente o próximo experimento muda.
6. Consulte o primeiro resultado pelo seletor de histórico. Exporte ambos os registros para comparar os prompts e configurações.
7. Execute **Avaliar recuperação**. Mostre os gabaritos e exporte o relatório, sem apresentar essa pequena amostra como generalização.

## Arquitetura preservada

Não houve migração de framework, backend obrigatório ou alteração de hospedagem. O build copia `lab-web` para `dist/assets`, converte caminhos absolutos em relativos e troca as revisões de módulos e CSS pelo SHA do build. Os workflows existentes executam todos os testes JavaScript; CI também executa Python. Nenhum workflow/configuração externa foi alterado nesta evolução.

`app.js` integra a navegação e continua responsável pela conversa, ensino, treinamento e mapa. `experiments.js` monta a nova área, usando os estilos de fontes e os destaques já existentes. O worker continua isolando inferência e MLP. `experiment-core.js` coordena as condições com dependências injetáveis; `retrieval.js` define o contrato puro de busca; `evaluation.js` contém corpus e métricas.

O mesmo canvas 3D/2D é movido para a área de Experimentos ao abrir a aba e retorna à Rede semântica ao sair. O mapa do experimento usa posições do snapshot; inclui fontes antigas que ficariam fora das 180 memórias recentes, pinta as selecionadas em amarelo e permite destacar cada fonte. O histórico restaura o mapa daquele resultado, sem editar a base atual. `data-selected-ids` no canvas permite inspecionar os IDs destacados. Os nós da simulação também são fictícios; o rótulo do resultado identifica esse modo. O teste de materiais Three.js confirma a troca da cor dos nós selecionados, mas utiliza renderer substituto e não comprova renderização WebGL real.

Na edição Python, FastAPI, SQLite, NumPy, Ollama e recursos anteriores permanecem disponíveis. `/api/search` aceita `query`, `limit` (1–20), `threshold` (-1 a 1) e `excluded_ids` (IDs inteiros positivos). Retorna `sources`, `prediction` e `trace`. O formulário de experimentos informa que a comparação controlada e o corpus da interface são exclusivos da web. Os modelos, dimensões, prompts de conversa e geração das edições diferem; seus tempos e respostas não são diretamente comparáveis.

## Contrato de recuperação

Padrões preservados: até 5 trechos, limiar de cosseno 0,4. Na web, `retrieve(memories, vector, limit)` continua aceitando o argumento numérico legado; também aceita `{limit, threshold, excludedIds, contextChars}`. `searchTrace` retorna configuração aplicada, dimensão, contagens, candidatos com IDs/score/rank/motivo, fontes, contexto exato e tempos. O caminho Python preserva `retrieve(vector, limit=5, threshold=.4)` e acrescenta `excluded_ids` e `search_trace`.

Vetores são verificados quanto a dimensão, finitude, tipo numérico e norma não nula e normalizados antes do produto escalar. A ingestão web verifica as 384 dimensões do MiniLM. Empates são resolvidos por ID crescente (Python lê IDs em ordem). Exclusões são aplicadas antes do top-k. Score não é probabilidade de acerto.

O experimento limita cada trecho a 600 caracteres e o contexto a 2.000 caracteres, incluindo prefixos e separadores; a pergunta tem até 1.000 caracteres. Textos truncados são identificados e permanecem completos no snapshot. Isso é orçamento em caracteres, não contagem exata de tokens: entradas especialmente difíceis podem exceder a janela do runtime e gerar erro, preservado por condição. A conversa existente mantém seu próprio contexto e seus limites anteriores.

Motivos de decisão: `included`, `excluded`, `below-threshold`, `top-k`, `context-budget`. A interface renderiza até 20 candidatos por página; o JSON contém o ranking compacto completo para auditoria. Nenhum vetor aparece nos candidatos ou fontes públicas. A busca exata é linear na quantidade de vetores; a ordenação custa O(n log n), com limite atual de 5.000 memórias.

## Controle e rastreabilidade

- Snapshot profundo da base e configuração no início, antes de qualquer geração. SHA-256 inclui os vetores exatos; o registro persistido conserva textos, IDs e metadados, sem duplicar milhares de vetores. Alterar a biblioteca posteriormente não reescreve resultados anteriores.
- Duas mensagens por condição: sistema e pergunta. Nenhum turno da conversa entra nos prompts. Só a seção de memórias muda. O WebLLM recebe `resetChat()` antes de cada inferência; Transformers.js recebe mensagens completas em chamadas independentes.
- Ordem fixa e registrada: sem memória, depois com memória. Uma única preparação da LLM escolhe GPU ou CPU antes do par; não há troca silenciosa de backend entre condições. Uma falha é registrada, não substituída por resposta simulada.
- Temperatura 0, até 220 tokens, penalidade de repetição 1,1. GPU usa semente 42; CPU usa greedy (`do_sample=false`) sem API de semente neste caminho. `appliedParameters.seed=null` documenta esse caso. Semente não garante identidade entre dispositivos ou versões.
- Carregamento/compilação e aquecimento de um token são separados das duas gerações. O aquecimento pode produzir apenas token especial e nunca é exibido como resposta. A busca total inclui eventual preparação do embedding; carga e inferência do embedding aparecem separadas do cosseno e da seleção.
- `firstTokenMs` mede o primeiro fragmento não vazio do streamer, incluindo prefill/reset e processamento até esse fragmento. Não é medição individual do token interno. `generationMs` cobre a chamada até a resposta final.
- Cada condição conserva estado, mensagens, fontes efetivamente passadas à chamada, erro e medições. O rastro também mostra o contexto planejado quando a preparação ou a execução é cancelada antes da condição com memória; isso não significa que ele chegou à LLM.
- Cancelar termina o worker, rejeita RPCs pendentes e impede a segunda condição. IDs monotônicos e checagens de `AbortSignal` descartam mensagens tardias. O próximo uso cria outro worker e recarrega os modelos, aproveitando caches quando disponíveis. Fechar/recarregar a aba antes do salvamento final pode perder a execução em andamento.
- As dez últimas execuções ficam no IndexedDB existente, junto à base. JSON de memórias continua no formato v1 e não inclui experimentos; use a exportação específica de registros. Ao exceder dez registros, exporte os que quiser preservar. Bases e históricos grandes consomem armazenamento local; falhas de quota são reportadas.

## Avaliação reproduzível

`aurora-v1` possui 8 documentos fictícios, 8 perguntas e IDs relevantes explícitos. A execução usa MiniLM multilíngue q8 em WASM, sem tocar na base pessoal e sem carregar a LLM. Top-k e limiar vêm dos controles; IDs excluídos da base pessoal não se aplicam ao corpus de avaliação. O relatório exportado inclui corpus, perguntas, gabaritos, ranking/decisões por pergunta, configuração, identificação do modelo e data.

Médias macro sobre todas as perguntas, inclusive sem resultados:

- Precisão: relevantes recuperados / total recuperado; zero se a lista estiver vazia.
- Recall: relevantes recuperados / total de relevantes conhecidos.
- MRR: inverso da posição do primeiro relevante; zero sem acerto.
- Hit rate: proporção de perguntas com ao menos um relevante recuperado.

O corpus tem um relevante por pergunta; recall e hit rate coincidem nesta versão. Métricas medem a seleção final que pode entrar no contexto. Não medem qualidade da resposta, fidelidade, atenção, causalidade ou generalização. Para repetir, mantenha versão do corpus, modelo/runtime, top-k e limiar; execute novamente e compare os JSONs. Artefatos remotos do modelo não estão fixados por hash de pesos, portanto não se promete reprodução bit a bit após alterações desses artefatos.

Os testes determinísticos usam vetores e workers sintéticos explicitamente identificados. Eles verificam contratos e fórmulas, não representam resultados semânticos reais. Nenhuma pontuação de MiniLM ou benchmark de GPU é pré-preenchido.

## Verificação desta implementação

Comandos: `python -m pytest -q`, `node --test lab-web/tests/*.test.js`, `node scripts/build-web.mjs` e checagem sintática dos módulos modificados. Testes novos cobrem vetores inválidos, normalização, dimensão, exclusões, empates, orçamento de contexto, paginação com 5.000 candidatos, snapshots, ordem sequencial, prompts isolados, falhas por condição, cancelamento, reinício do worker, bloqueio de mutações, persistência/importação/exportação e contratos GPU/CPU com doubles.

Resultado local em 05/11/2026: **51 testes Python e 35 testes JavaScript passaram**; build estático e sintaxe passaram. O pytest emitiu um aviso de depreciação de `BlockingPortal` no Starlette/AnyIO. O deploy solicitado usa o workflow existente de GitHub Pages ao enviar o commit para `main`, sem alteração de configurações de hospedagem.

## Resultados com pesos reais — 05/11/2026

Artefato completo: [real-model-validation.json](../reports/real-model-validation.json), com prompts exatos, fontes, ranking, configuração, tempos, ambiente e hashes SHA-256 dos dois arquivos ONNX. Execução: Transformers.js 3.8.1, Node v24.15.0, ONNX Runtime **nativo CPU**, Windows, Ryzen 5 5600 (12 threads lógicas). MiniLM q8 de 384 dimensões e Qwen2.5 0.5B Instruct q4. Isso não representa uma execução do backend WASM ou WebGPU no navegador.

Corpus `aurora-v1`, oito perguntas, uma memória relevante por pergunta:

| k | Limiar | Precisão macro | Recall | MRR | Hit rate |
|---|---|---|---|---|---|
| 5 | 0,4 | 42,08% | 100% | 100% | 100% |
| 1 | 0,4 | 100% | 100% | 100% | 100% |
| 5 | 0,7 | 62,5% | 62,5% | 62,5% | 62,5% |

`k=1` foi suficiente nessa amostra. Aumentar o limiar para 0,7 omitiu relevantes em três perguntas. Não se recomenda extrapolar esses números para bases pessoais maiores ou concluir que `k=1` é universalmente melhor. Duas execuções locais produziram os mesmos rankings, métricas e textos; o JSON conserva a execução mais recente.

Pergunta idêntica: “Em qual cidade fica o observatório Aurora?”. Saídas do Qwen, sem correção manual:

| Condição | Memórias fornecidas | Resposta real |
|---|---|---|
| Sem memória | Nenhuma | “Aurora está localizada na cidade de Nova Iorque.” |
| Com memória | M1, M3, M2, M7 | “O observatório Aurora está localizado na cidade de Recife.” |
| Com memória, excluindo M1 | M3, M2, M7 | “O observatório Aurora está localizado na cidade de La Salle.” |

As respostas sem M1 estão erradas; a exclusão não fez o modelo admitir desconhecimento. A resposta correta também deixou de citar o ID solicitado. Esse é um resultado medido e uma limitação do modelo compacto, não uma demonstração de confiabilidade. As duas condições sem memória retornaram a mesma resposta. As asserções do runner verificaram ausência de histórico/contexto na condição sem memória, correspondência exata entre contexto enviado e rastro e ausência dos IDs excluídos no contexto com memória.

Na execução registrada, preparação da LLM: 3,022 s; aquecimento: 0,179 s. Primeiro par: geração sem/com memória de 1,058/1,222 s e primeiro fragmento de 0,551/0,618 s. Os artefatos estavam disponíveis no cache; os números não representam download inicial nem benchmark do navegador. A ordem foi fixa e houve apenas um par por configuração na execução salva.

Para repetir, instale as dependências opcionais fora do cliente publicado:

```sh
npm install --prefix runtime/nexo-validation --no-audit --no-fund @huggingface/transformers@3.8.1 jsdom@26.1.0
node scripts/validate-real-models.mjs
node scripts/validate-experiment-ui.mjs
```

O runner real baixa aproximadamente 904 MB em pesos na primeira execução (além das dependências), usa cache em `runtime/nexo-validation/model-cache` e escreve o JSON em `reports/`. Pesos e dependências opcionais não são enviados ao GitHub nem integrados ao build da aplicação. O relatório guarda os hashes dos pesos utilizados, mas a aplicação ainda resolve modelos remotos por ID, sem impor esses hashes em downloads futuros.

## Desktop, celular e limites de verificação

[dom-validation.json](../reports/dom-validation.json) registra testes de DOM com larguras configuradas em 1440 e 390: comparação, exclusão, histórico, cancelamento, erro por condição, métricas reais na interface e paginação de ranking com fixture sintética de 45 candidatos. O teste de runtime também verifica que a demonstração não instancia nenhum worker de inferência nem altera memórias/mensagens pessoais. Testes de cenas confirmam a seleção dos materiais reais do Three.js com renderer substituto.

**Pendente: inspeção visual desktop/celular, WebGL real e inferência WASM/WebGPU no navegador.** Tanto o host de navegador quanto o pipe nativo da skill computer-use retornaram indisponíveis. Emulação de DOM não calcula layout CSS, não produz screenshots e não valida tecnologia assistiva; não é uma revisão visual das duas larguras. Não há captura de tela nem benchmark de navegador apresentado como concluído.

Referências das APIs usadas: [protocolo de geração e semente WebLLM 0.2.86](https://github.com/mlc-ai/web-llm/blob/v0.2.86/src/openai_api_protocols/chat_completion.ts), [resetChat no WebLLM](https://github.com/mlc-ai/web-llm/blob/v0.2.86/src/engine.ts).
