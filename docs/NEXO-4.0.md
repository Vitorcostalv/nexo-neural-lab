# Nexo 4.0 — presença e continuidade local

**Revisão do sistema de animação:** o rig e a composição de digitação foram refeitos e sua publicação foi autorizada para teste no navegador. Consulte [Personagem 2D: implementação, clipes e limitações](PERSONAGEM-2D.md). As seções de animação abaixo também registram etapas anteriores; o documento da revisão descreve o código atual.

Evolução implementada sobre o checkout existente, preservando os recursos do Nexo 2.0 e 3.0. A publicação autorizada em 06/11/2026 usa o workflow existente do GitHub Pages, sem alterar a configuração externa. [Aplicação](https://vitorcostalv.github.io/nexo-neural-lab/) · [Workflow de publicação](https://github.com/Vitorcostalv/nexo-neural-lab/actions/workflows/pages.yml) · [Prompt para validação no navegador](TESTE-NAVEGADOR.md).

## Demonstração

1. Execute `node scripts/build-web.mjs` e `python -m http.server 8020 --directory dist --bind 127.0.0.1`. Abra `http://127.0.0.1:8020`.
2. A entrada pergunta “Como você quer ser chamado?”. Criar um nome abre um perfil vazio, com ID estável. Dados existentes ficam em **Dados anteriores**, sem serem atribuídos ao nome digitado. Fechar a entrada permite continuar nesse perfil.
3. **Companheira** é a primeira visualização; **Rede semântica**, a segunda. Envie “Oi, Nexo!”: a saudação social existente é local e não baixa a LLM. Troque de visualização e confira a mesma conversa.
4. Use **Ensinar** ou **Nova memória** para guardar uma informação fictícia. Isso é uma ação explícita e pode baixar os embeddings. Conversar normalmente não cria memória de conhecimento.
5. Faça uma pergunta sobre a memória. Confira a etapa técnica, os fragmentos da resposta e as fontes. O primeiro uso dos modelos pode ser demorado. As animações representam atividade, sem alegar pensamento ou consciência.
6. No mapa, selecione uma memória, confira texto, categoria, origem, data e embedding. Feche o painel para ver o foco e use **Restaurar câmera**. Memórias recuperadas antigas também entram no limite de 180 nós.
7. Abra o botão com o nome do perfil, na barra superior. Crie outro perfil e alterne. A página recarrega para abrir os bancos corretos; conversas, documentos, versões, anotações, modelos treinados e resultados não são copiados.
8. Em **Movimento**, escolha sistema, reduzido ou desativado. O modo desativado também bloqueia o botão de retomada do mapa, até mudar a preferência.
9. Volte ao primeiro perfil, exporte o JSON completo e restaure em **Novo perfil**. Compare os IDs, fontes, versões e históricos. O nome recebe “(restaurado)”; o perfil original continua disponível.
10. Teste a importação CSV com as colunas `text,label`, incluindo aspas, vírgulas e texto multilinha. Escolha o mapeamento, abra a prévia e confirme a importação. Embeddings são calculados de verdade nessa etapa.

## Estados visuais e mapa

`activity-state.js` contém a máquina de estados. Cada operação recebe um token monotônico. Callbacks de uma operação encerrada não alteram a próxima. Estados: repouso, recebimento, carregamento, recuperação, geração, resposta em fluxo, salvamento, treinamento, conclusão, erro e cancelamento. A reação terminal dura brevemente e volta ao repouso. Esse estado transitório não é persistido.

A personagem ativa é uma garota humana ilustrada em SVG original, em `companion-girl.js` e `companion-girl.css`, sem modelo 3D, vídeo ou pesos adicionais. Braços, antebraços, mãos, pernas, joelhos, cabeça, olhos e boca têm articulações próprias. O personagem digital anterior continua intacto em `companion.js`, sem importação ativa no app.

Há poses de pensar (mão no queixo), caminhar (pernas e braços alternados), digitar (mãos no notebook), felicidade (sorriso e braços erguidos), confusão (sobrancelhas assimétricas, palma levantada e interrogação) e estudar (livro e páginas). Carregamento usa caminhada; recuperação/treinamento usam estudo; geração usa pensamento visual; resposta em fluxo usa digitação. Digitação e boca param 650 ms após o último fragmento recebido e retomam no próximo. As expressões são animações da interface, não estados mentais nem inferência sobre emoções do usuário.

Mover o ponteiro acompanha o olhar; clicar na personagem acena. **Explorar gestos** permite testar as seis poses sem chamar modelos, com indicação explícita de prévia. Uma tarefa real interrompe a prévia e assume o estado visual. O seletor de movimento ao lado da personagem compartilha a preferência persistente do perfil; quando o perfil/dispositivo reduz ou desativa movimentos, um aviso explica que as poses serão estáticas. Abas ocultas e movimento reduzido continuam respeitados.

A saudação com nome pertence à interface, não ao prompt da LLM. Download/compilação mostram o texto real do runtime e percentuais reais quando fornecidos; não existe progresso percentual inventado. Inferência começa com evento próprio, e os fragmentos de texto ativam a expressão de resposta. Treinamento e persistência têm eventos distintos.

As abas centrais mostram somente **Companheira** e **Rede semântica**. Experimentos e Treinamento continuam na lateral. **Biblioteca** reúne Memórias e Documentos/versões, com um único ícone de livro e navegação interna, preservando as duas formas de ingestão e todos os dados. Os ícones laterais revelam nomes com transição ao passar o ponteiro ou receber foco pelo teclado; Escape oculta o nome. Não usam `title` nativo para duplicar o balão.

As visualizações iniciais compartilham o mesmo formulário e histórico; nenhum chat é duplicado. No desktop, visual e conversa ficam lado a lado. No CSS móvel, a cena da personagem tem 235 px e o mapa 240 px, com conversa e campo de entrada abaixo, e as etapas ilustrativas do mapa ficam recolhidas. Esses valores são implementação, não confirmação de layout em um celular real.

O fundo do mapa continua ilustrativo. Somente nós de memórias, similaridades e fontes selecionadas vêm dos dados. Fontes recuperadas são informadas pelo runtime/SSE e destacadas por ID; iniciar nova pergunta limpa a seleção anterior. A seleção manual também usa o realce dourado e tem seu texto no painel. Arestas documentais continuam significando a mesma versão de documento, conforme a legenda da área de fontes. Nenhum desses efeitos mede atenção ou causalidade da LLM.

Foco interpola a direção da câmera na edição 3D; no fallback 2D interpola o deslocamento. A rotação ambiente para durante o foco para manter a memória estável. Restaurar câmera libera o foco. Com movimento desativado, novas memórias aparecem diretamente na posição final, sem ficar presas na fase invisível de nascimento. Os controladores pausam atualizações em abas ocultas e áreas não visíveis. CSS respeita movimento reduzido e o controle local. Não foi incluída categorização por cores sem legenda.

## Perfis e persistência

`profiles/manager.js` mantém o registro versionado `nexo-profiles-v4`, com perfis, controle de migração e leases entre abas. O nome é exibição; UUID/ID permanece ao renomear. Preferências de movimento e configurações de recuperação são salvas por perfil. Os bancos de conversa e laboratório são separados por ID/geração.

Na web, a migração copia o pequeno estado legado para o perfil inicial, adiciona IDs estáveis às mensagens antigas e reaproveita o banco de pesquisa existente. A fonte antiga fica preservada para recuperação durante a migração. Não duplica arquivos nem índices para criar um perfil vazio. Ao excluir o perfil inicial com confirmação, a cópia web legada também é removida. Bancos de gerações anteriores de uma mesclagem ficam arquivados até excluir o perfil; isso usa espaço adicional e evita tornar uma falha destrutiva.

Toda operação principal adquire lease de escrita, renovado enquanto a tarefa está ativa. A interface bloqueia troca, criação e exclusão durante a operação, com explicação. Outra aba não pode gravar/excluir um perfil com lease ativo. Uma aba com geração antiga precisa recarregar antes de iniciar nova escrita. Leases vencem após 60 segundos sem renovação, para recuperar abas encerradas; não são mecanismo de autenticação. Runtime/bancos já abertos continuam ligados à geração capturada, portanto uma mensagem tardia não muda de perfil.

Na edição Python, `app/neural/profiles.py` usa registro SQLite e um arquivo SQLite por perfil, com `ContextVar` por requisição. O cabeçalho `X-Nexo-Profile` define o espaço, incluindo a gravação ao final do streaming. A migração copia o banco original com a API de backup SQLite, incluindo WAL; ele é preservado até excluir explicitamente o perfil inicial. Clientes antigos sem cabeçalho continuam usando o perfil inicial depois da migração. Após excluí-lo, precisam enviar um perfil; dados não são atribuídos ao próximo nome.

Documentos, bancada e aprendizado ativo da interface Python continuam em IndexedDB por perfil, preservando a arquitetura do Nexo 3.0; conversa, memórias e MLP Python ficam em SQLite. Preferências e ponteiros de gerações ficam no navegador. O backup reúne as duas partes. Não há sincronização entre instalações/navegadores; apagar os dados do navegador exige backup prévio para recuperar seus índices e ponteiros.

A interface informa: **“Perfis salvos neste navegador. Sem senha e sem sincronização entre dispositivos.”** Qualquer pessoa com acesso ao navegador pode trocar de perfil. O recurso não protege acesso a dados. Na edição Python, o servidor continua local; eventual chave global da API preexistente é independente dos perfis.

Renomear, excluir e confirmar restauração usam controles dentro do painel de perfis, sem `alert()`, `prompt()` ou `confirm()` do navegador. O campo recebe foco; cancelar ou Escape retorna ao botão de origem, sem alterar os dados. Exclusão mantém a confirmação textual exata. Erros aparecem no próprio formulário, e ações concorrentes ficam desabilitadas durante a confirmação/gravação.

O estado de salvamento fica abaixo do compositor. Erros/quota são mostrados no status/toast, mantendo o estado ativo anterior em importações/restaurações. Conversas não se transformam automaticamente em conhecimento. Na web, mudar a base reinicia somente o contexto da conversa, preservando o histórico visível. Histórico web: até 10.000 mensagens; ao atingir o limite, exportar/limpar é explícito. Python mantém seu limite anterior de 200 mensagens. Experimentos legados conservam os 10 últimos; avaliações legadas agora são persistidas, até 20. Resultados documentais mantêm o limite de 20 sem descarte silencioso.

## Backup JSON

Formato `nexo-profile`, versão 1, aplicação 4.0.0, manifesto com data, ID/nome, configurações, preferências, contagens por tipo, opções e declarações dos modelos. O SHA-256 cobre manifesto e dados; cada original tem tamanho e SHA próprios. Isso detecta corrupção acidental, não autentica a origem do arquivo.

Inclui memórias/categorias, mensagens e fontes, classificador treinado, documentos/versões, índices/trechos, divergências/revisões, experimentos, avaliações, exemplos, anotações e rodadas. Snapshots históricos permanecem exatos, inclusive dados que o registro original já continha. Não exporta pesos pré-treinados ou caches de download.

Opções web:

- **Originais:** arquivos em base64, com nome/tipo/tamanho/hash. Sem eles, texto extraído, localizadores e relações permanecem; abrir o PDF original exige reenviar o arquivo.
- **Embeddings operacionais:** vetores e estado treinado compatível. Sem eles, memórias ficam pendentes, índices têm apenas busca lexical e o classificador é arquivado/inativado. Use **Reprocessar memórias pendentes**, reindexação vetorial de documentos e **Reprocessar embeddings do pool restaurado**, depois treine explicitamente.
- A estimativa serializa o pacote efetivo e mostra MB e omissões. JSON de entrada tem limite de 180 MB; o corpus de pesquisa mantém seus limites anteriores, inclusive 100 MB estimados de armazenamento. Base64 aumenta tamanho; pode ser necessário omitir originais.

MiniLM novo usa revisão fixa `2c4055b12046f11709e9df2c122e59ffbdc2f900`, q8, 384 dimensões e `mean-normalize-text-v1`. Conversa e pesquisa reaproveitam a mesma instância de extração no worker. Memórias antigas sem revisão registrada são preservadas na migração, mas seus vetores **não são reutilizados ao restaurar**: precisam de reprocessamento. Índices/pool com modelo, revisão ou pré-processamento incompatível também são inativados para busca vetorial. Modelos treinados sobre esses vetores são arquivados. Rodadas e resultados passados continuam disponíveis como histórico.

Na edição Python, o pacote acrescenta `python-sqlite-v1`: tabelas explícitas e binários em base64, sem pickle. Vetores SQLite são obrigatórios nesta versão; a opção de embeddings fica marcada/desabilitada. Restauração exige o mesmo identificador de modelo Ollama configurado e dimensão válida; o servidor valida arrays do MLP sem executar objetos serializados. Isso não garante igualdade de pesos se um tag Ollama for substituído por outro conteúdo. Backups com conversa/memórias de uma edição devem ser restaurados na edição de origem, pois os formatos e modelos diferem.

### Restauração e conflitos

Antes de gravar: JSON/UTF-8, tamanho, versão, SHA, tipos, limites, IDs duplicados, referências de versões/índices/trechos, norma/dimensão/finitude dos vetores e pesos do MLP são verificados. O preview só habilita a confirmação após a validação. A confirmação não substitui a validação; o pacote é verificado novamente ao restaurar.

**Novo perfil:** novos IDs de perfil/bancos, preservando IDs internos, textos, fontes, snapshots e proveniência. Não altera o perfil existente.

**Mesclar:** mesmos IDs e mesmos registros deduplicam. Mesmo ID com conteúdo diferente cancela toda a operação, orientando restaurar em novo perfil. Pools/modelos ativos diferentes não são combinados silenciosamente. As configurações atuais permanecem, e classificadores de memórias ficam arquivados/inativos após a mesclagem. Na parte SQLite, conflitos de linhas também rejeitam a mesclagem inteira. Não existe resolução automática que reescreva referências dentro de snapshots.

Na parte SQLite, um MLP treinado só pode ser mesclado com a mesma base de memórias. Bases distintas com pesos treinados exigem novo perfil, preservando pesos e origem em vez de aplicar um classificador a outra base. O arquivamento/inativação automática descrito acima se aplica ao classificador web.

Os dois bancos são preparados em novas gerações; apenas depois do sucesso o ponteiro do perfil é publicado numa transação do registro. Na edição Python, o SQLite também é preparado em arquivo novo e sua geração entra no mesmo ponteiro local. Uma falha antes da publicação mantém a geração ativa anterior. Arquivos de staging/um perfil vazio criado no servidor podem restar após interrupção abrupta; não se tornam o perfil ativo e podem ser removidos pela exclusão explícita do perfil. A restauração não é sincronização distribuída nem transação entre navegadores diferentes.

## CSV

Arquivos UTF-8 com BOM, aspas duplicadas, CRLF entre linhas e campos multilinha entre aspas. Valores que podem iniciar fórmulas recebem apóstrofo literal. Ele permanece se o CSV for reimportado; não é removido de forma que reative fórmulas. Exportações vazias mantêm cabeçalho. Campos estruturados adicionais são JSON na célula.

| Arquivo | Colunas principais |
|---|---|
| `memories` | `profileId,id,text,label,created,origin,dimension` (sem vetor) |
| `conversations` | `profileId,id,role,text,sources`, data quando existente |
| `documents` | `profileId,id,name,created` |
| `versions` | `profileId,id,documentId`, hash/texto/localizadores, datas e índice ativo |
| `experiments` | `profileId,id`, pergunta, configuração, condições, traces/snapshots |
| `evaluations` | `profileId,id`, configuração, métricas, perguntas e gabaritos quando existentes |
| `annotations` | `profileId,id,exampleId,previous,label,skip,origin,at` |

Os nomes completos das colunas refletem os campos persistidos de cada tipo/edição. CSV não inclui originais, vetores ou todos os relacionamentos necessários a uma restauração integral. Para restaurar, use JSON. Importação CSV aceita cabeçalho e até 100 memórias/1 MB por lote, seleção de colunas texto/categoria, prévia de cinco registros e confirmação. Duplicatas textuais seguem a regra de ingestão existente. Falha de embedding antes do commit não publica um lote parcial.

## Verificação

Em 06/11/2026:

- `node --test lab-web/tests/*.test.js`: **62 testes passaram**, incluindo poses/articulações, proteção contra diálogos nativos, FSM, JSON/CSV, conflitos e foco/movimento/destaques com objetos Three reais e renderer substituto.
- `.venv/Scripts/python.exe -m pytest -q`: **63 testes passaram**, incluindo isolamento SQLite, streaming com perfil capturado, restauração em geração isolada, conflitos e mapa com memória antiga. Permanece o aviso de depreciação `BlockingPortal` do Starlette/AnyIO.
- `node scripts/validate-profiles.mjs`: integração IndexedDB com `fake-indexeddb`, migração, recarga, leases entre abas, arquivos/versões/labels/queries, falha de publicação e mesclagem. Artefato: [profiles-v4-storage.json](../reports/profiles-v4-storage.json).
- `node scripts/validate-research-dom.mjs`: aplicação completa em jsdom, eventos dos recursos anteriores e novos, conversa compartilhada, preferências, CSV/backup, bloqueio de troca, cancelamento e erros. Larguras emuladas de 360 e 1440 não constituem teste de layout. Artefato: [research-v3-dom.json](../reports/research-v3-dom.json).
- `node scripts/build-web.mjs` e `node scripts/validate-web-assets.mjs`: build e 60 recursos servidos sob subdiretório, incluindo revisão única compartilhada do módulo de sessão. Artefato: [profiles-v4-http.json](../reports/profiles-v4-http.json).
- `node scripts/render-companion-art.mjs`: revisão estática da ilustração e de posições representativas das seis poses, com `@napi-rs/canvas` já disponível no runtime opcional. [Ilustração](../reports/companion-girl-art.png) · [Poses](../reports/companion-girl-poses.png). Os PNGs foram inspecionados; não são screenshots da aplicação nem validação da execução CSS no navegador.

Os dois scripts de integração usam as dependências opcionais existentes em `runtime/nexo-validation`: `fake-indexeddb@6.2.4` e `jsdom@26.1.0`. Instale com `npm install --prefix runtime/nexo-validation fake-indexeddb@6.2.4 jsdom@26.1.0` se necessário. Testes unitários e build não precisam dessas dependências. Doubles de modelos nos testes validam contratos e persistência, nunca qualidade semântica.

O host do navegador e o controle nativo retornaram indisponíveis. **Revisão visual desktop/celular, interação WebGL em GPU real e tecnologia assistiva real continuam pendentes.** A implementação tem HTML semântico, controles rotulados, status/erros acessíveis e tratamento de movimento reduzido, mas isso não equivale a teste assistivo manual.

Não foram produzidas novas métricas semânticas por esta evolução visual/de persistência. Resultados reais anteriores e suas limitações continuam em [NEXO-3.0.md](NEXO-3.0.md). O personagem e o mapa não são novas evidências de qualidade da LLM.
