# Repertório local de respostas

Revisão de 06/11/2026. O problema relatado foi a conversa “quantos anos tem a antiga rainha da Inglaterra?” → “Jane, 1534–1536”, seguida de “E a última?” → “Elizabeth I”. O modelo web Qwen2.5 0.5B continua sendo compacto e pode inventar fatos. Alterar só o prompt não comprovaria uma correção factual.

## Ampliação implementada

Há agora **40 temas e 36 referências identificadas**, em um catálogo local de aproximadamente 31 KB, versionado como `common-2026-11-v1`. Inclui monarquia britânica, capitais/idiomas de 18 países, Sistema Solar, Sol/Terra/Lua, fotossíntese, DNA, água, unidades do SI e tecnologias web. As respostas foram redigidas para o projeto; não são cópias de artigos completos. Fontes: Royal Family, governo britânico, Royal Mint, NASA, IBGE, NOAA, NHGRI/NIH, USGS, BIPM e MDN. URLs e data de revisão acompanham cada referência.

Não houve treinamento/fine-tuning nem mudança dos pesos ou do modelo. Não existe uma enciclopédia ilimitada, busca online durante a conversa ou atualização automática de fatos atuais. A ampliação é um **repertório editorial finito**, com seleção conservadora por entidades/aliases e regras de intenção, sem embeddings. Perguntas curtas cobertas recebem uma resposta redigida/revisada, sem precisar baixar a LLM. Para pedidos criativos e código, o modelo continua disponível, podendo receber fatos do catálogo como contexto. Detalhes não cobertos sobre uma entidade conhecida geram uma indicação de limite, em vez de transformar um fato conhecido em outro atributo.

No caso relatado, a resposta informa que Elizabeth II morreu aos **96 anos em 8 de setembro de 2022**. A continuação distingue a última rainha reinante britânica recente de Ana/Anne, no sentido histórico estrito de Reino da Inglaterra antes da união de 1707. Não se apresenta uma falecida como se tivesse idade atual. As respostas antigas erradas permanecem no histórico; as novas seleções não tratam palpites anteriores do assistente como provas.

## Contexto e fontes

Continuações reconhecidas como “E a última?” e “Qual a idade dela?” usam o tópico dos pedidos anteriores **do usuário**. Uma cadeia de continuações pode recuar até seis turnos de usuário, mas uma mudança explícita de assunto interrompe essa busca. Não se usa “Jane” de uma resposta anterior inventada para escolher a entidade. Sem um referente identificável, a aplicação pede esclarecimento. O reconhecimento é limitado aos padrões testados; não é uma resolução linguística universal.

Perguntas pessoais não são respondidas com o catálogo geral. Memórias, vetores, treinamento, documentos e os experimentos comparativos mantêm seus próprios caminhos. Os 40 temas não viram memórias do usuário nem aparecem como neurônios ou scores de similaridade. Os experimentos sem/com memória não recebem esse novo catálogo: sua comparação controlada permanece independente.

Cada resposta tem um bloco de origem separado das memórias recuperadas: resposta do repertório, pedido de esclarecimento ou base consultada. Referências abrem em HTTPS, com `noopener noreferrer`, e os dados são escapados antes de renderizar. A interface informa que esses links são referências do catálogo, sem alegar ter navegado na internet naquela conversa.

Textos das respostas, referências, versão, modo de resposta e pergunta anterior usada na resolução são conservados como snapshot do turno. Atualizar o catálogo não reescreve resultados antigos. Na web isso fica no IndexedDB existente e acompanha o backup do perfil. No Python, um registro `knowledge-trace` dentro do JSON de fontes já existente preserva os metadados sem alterar as colunas do SQLite nem o formato das tabelas do backup; `store.history` separa esse registro das fontes de memórias antes de expor a conversa. Não são enviados IDs `K:` ao mapa de memórias.

## Arquivos e manutenção

- `lab-web/knowledge/seed.json`: fatos redigidos e fontes por tema/intenção.
- `lab-web/knowledge/base.json`: snapshot usado pelas duas edições, incluindo os países.
- `scripts/build-knowledge-base.py`: atualização deliberada do seed com dados oficiais da API Países do IBGE. Não roda no cliente, no build nem no CI. Revisar mudanças factuais e a data antes de publicar outra versão.
- `lab-web/knowledge.js` e `app/neural/knowledge.py`: seletores com o mesmo contrato, verificados pelos mesmos casos.
- `lab-web/knowledge/cases.json`: regressões positivas, negativas, pessoais, mudanças de assunto e continuações.

As regras são extensíveis, mas ampliar aliases sem verificar intenções pode produzir respostas equivocadas: por exemplo, “idade ao ser coroada” não é “idade ao falecer”, e “maior planeta do universo” não é “maior do Sistema Solar”. Esses casos fazem parte da regressão. Novas entidades e informações temporais exigem curadoria, fonte adequada, revisão das condições e novos exemplos de confusão. Quando o pedido não é coberto, o modelo pequeno ainda pode errar; o novo prompt reduz instruções ambíguas, mas não garante exatidão.

## Validação reproduzível

```text
node --test lab-web/tests/*.test.js
python -m pytest -q
node scripts/evaluate-knowledge.mjs
node scripts/build-web.mjs
node scripts/validate-knowledge-browser.mjs
```

O último comando exige Playwright opcional em `runtime/nexo-validation`, navegador local e a variável opcional `NEXO_QA_BROWSER`. Testa a aplicação real em Brave headless nos tamanhos 1420×900 e 380×844, sob `/nested/nexo/`: pergunta relatada, continuação, capitais, fotossíntese, detalhe ausente, links, persistência após reload e zero memórias pessoais criadas. O teste bloqueia a criação de workers de modelos: uma resposta coberta que tentasse baixar a LLM falharia. **Não usa respostas falsas de um worker**; usa o repertório editorial verdadeiro. Isso comprova esse caminho de resposta, não a qualidade da LLM.

Resultado local: **80 testes JavaScript e 101 testes Python passaram**, além de 37/37 casos editoriais, build, smoke HTTP de 69 recursos sob subdiretório e verificações de perfis e integração DOM. O pytest manteve o aviso anterior de depreciação AnyIO/Starlette.

Relatórios: `reports/knowledge/lookup.json` e `browser.json`, com capturas do bloco de referências. A suíte compartilhada tem 37 casos definidos; passar nela não mede a proporção de perguntas do mundo real que o catálogo cobre. O teste de navegador não é aparelho físico nem teste assistivo. A inferência do Qwen fora do catálogo não recebeu um novo benchmark nesta revisão.

## Prompt para o Codex do navegador

```text
Abra a publicação atual e registre o SHA do build. Crie um perfil QA separado, sem apagar dados existentes. Envie “quantos anos tem a antiga rainha da inglaterra?” e depois “E a ultima?”. A primeira resposta deve falar de Elizabeth II, 96 anos ao falecer e 8/9/2022; a continuação não pode dizer Elizabeth I. Confira a distinção histórica de Anne/1707 quando presente.

Teste “Qual a capital do Brasil?” → “E de Portugal?”, “O que é fotossíntese?”, “O que é HTML?” e uma pergunta pessoal sem informação fornecida. Abra o bloco de origem e confira fonte, versão e ausência de score de memória para fatos gerais. Recarregue e confira que o histórico e as referências permanecem e que nenhuma memória pessoal foi criada por essas perguntas.

Em um perfil sem contexto, “E a última?” deve pedir esclarecimento. Após uma mudança de assunto, não pode reaproveitar a rainha. Pergunte sobre um detalhe que a base não cobre e confira se admite esse limite. Compare “idade ao falecer” com “idade quando foi coroada”; não aceite que a mesma idade seja reutilizada sem fonte.

Teste desktop e tamanho móvel. Registre os casos aprovados, falhos e bloqueados, com respostas e capturas. Respostas editoriais sem carregar modelo não são inferência instantânea nem treinamento novo da LLM. Teste também uma pergunta fora do catálogo, identificando o modelo e o carregamento real; não generalize a qualidade a partir dos exemplos cobertos. Preserve perfis, backup, conversa, documentos, animações automáticas e Rede semântica.
```
