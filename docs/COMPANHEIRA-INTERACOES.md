# Movimentos por interação

Os controles de Acenar, Passos, Sentar, Feliz e Parar foram removidos. A personagem recebe seus destinos do campo de conversa e dos eventos reais de `ActivityState`; não existe seleção manual de pose na interface. O seletor Movimento permanece apenas como preferência de acessibilidade.

| Interação ou estado | Reação |
| --- | --- |
| Escrever no campo de conversa com foco | Senta para acompanhar a escrita, sem iniciar processamento ou downloads de LLM |
| Apagar o rascunho ou sair do campo, sem tarefa ativa | Levanta e volta ao repouso |
| Enviar uma ação | Aceno de recebimento; etapas seguintes podem substituí-lo imediatamente |
| Carregar modelos | Ciclo de passos no lugar, enquanto o estado real de carregamento durar |
| Recuperar, gerar, receber resposta, salvar ou treinar | Postura sentada, com o texto da etapa e progresso reais |
| Conclusão | Reação breve de satisfação, seguida de repouso |
| Erro ou cancelamento | Saída da postura de trabalho e repouso; o texto mantém a causa real |

O rascunho não pode substituir uma tarefa ativa nem reativar uma tarefa terminada. Eventos de inferência tardios continuam sujeitos aos tokens existentes. Durante sentar/levantar, o player completa a transição física para o destino mais recente. Ocultar a aba ou sair da vista pausa a renderização, sem fabricar trabalho nem reproduzir uma fila de estados antigos ao retornar.

Não foram criados clips de digitação, leitura ou dúvida. A pose sentada é a reação disponível para processamento e escrita, **não uma simulação de mãos digitando**. O modelo, licença, hash e limitações físicas permanecem os descritos em [Companheira chibi](COMPANHEIRA-CHIBI.md).

## Verificação

`node scripts/validate-companion-dom.mjs` verifica ausência dos controles, foco/escrita/saída do campo, recebimento, carregamento, geração, streaming, prioridade da tarefa, cancelamento e rejeição de evento tardio. Usa um renderer double declarado; não aprova qualidade visual.

`node scripts/validate-companion-browser.mjs` testa o GLB real em Brave headless/WebGL por software a 1420×900 e 380×844. Escreve e envia **Oi!** pelo formulário real, verifica a resposta social e as solicitações automáticas de animação. A resposta social é uma regra existente da aplicação; não envolve LLM. Para observar carregamento/processamento por tempo suficiente, o teste injeta estados explicitamente identificados, sem alegar inferência real. Gravações e relatório dessa revisão ficam em `reports/companion-interactions/`. Os vídeos anteriores em `reports/companion-chibi/` são históricos e ainda mostram os botões retirados.

## Prompt para o Codex do navegador

```text
Abra a publicação atual do Nexo, registre o SHA do build e use um perfil QA separado. Não procure botões de gestos: a personagem deve reagir automaticamente às interações. Teste em desktop 1420×900 e tamanho móvel 380×844, registrando que emulação não é aparelho físico.

Escreva no campo de conversa e observe a personagem sentar; limpe o rascunho ou retire o foco e confira a volta ao repouso. Envie “Oi!” pelo formulário: confira a resposta social real, a reação breve de conclusão e o retorno ao repouso. Isso não exige nem comprova inferência LLM. Digitar no campo não deve iniciar uma LLM.

Em uma tarefa real, confira os estados de carregamento, processamento, resposta, sucesso, erro e cancelamento. Escrever/focar no campo não pode substituir uma tarefa ativa. O fim da tarefa deve encerrar a postura correspondente; mensagens tardias não podem reativá-la. Grave vídeo contínuo quando possível e registre cenários não alcançados como bloqueados, sem usar estados injetados como prova de inferência real.

Mantenha as distinções: passos são no lugar; a personagem acompanha a escrita sentada, mas não possui clip de digitação, leitura ou dúvida. Confira movimento reduzido/desativado, preferências salvas, pausa de aba/vista, fallback da mesma personagem e preservação de conversa, perfis e Rede. Não deve haver seletor de pose nem diálogo nativo alert/prompt/confirm. Entregue evidências e limitações; screenshots e contadores não aprovam contatos ou qualidade de animação por si só.
```
