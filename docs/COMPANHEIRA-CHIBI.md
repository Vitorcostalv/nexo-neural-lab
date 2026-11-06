# Companheira chibi 3D — versão para teste

> Atualização: os botões de gestos foram retirados. A personagem agora reage somente à escrita e às tarefas reais. Use [o fluxo e o prompt atuais](COMPANHEIRA-INTERACOES.md); as evidências com botões abaixo são da primeira revisão.

Esta revisão substitui o retrato antigo por **um modelo GLB real, com skin, esqueleto e clips reproduzidos por AnimationMixer**. O usuário autorizou mudar a personagem para uma menina mais nova e publicar para testar. A apresentação escolhida é uma menina estilizada em proporções chibi, com cabelo castanho escuro e roupa verde. Não se trata do antigo SVG recebendo efeitos de profundidade.

## Asset e licença

Base: **Rogue**, KayKit Adventurers 1.0, de Kay Lousberg. [Repositório do autor](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), [página do pack](https://kaylousberg.itch.io/kaykit-adventurers). Licença CC0 1.0, copiada em `lab-web/models/LICENSE-character.txt`.

O aceno vem do clip `Waving`, KayKit Character Animations 1.1, também de Kay Lousberg e sob CC0. [Página do autor e termos](https://kaylousberg.itch.io/kaykit-character-animations). Os bytes foram obtidos de um mirror público fixado por commit; o caminho exato, a origem e o SHA-256 de cada download constam em `lab-web/models/provenance.json`. A licença incluída acompanha o projeto em `LICENSE-animations.txt`. Os demais clips já estavam no GLB do autor. O modelo de referência do mirror não é usado como personagem.

Adaptações: retirada dos acessórios de combate; escurecimento da textura da cabeça para cabelo castanho escuro; seleção dos clips; inclusão de banco, piso e duas câmeras. Banco e piso são objetos simples de cena; **o corpo da personagem não foi construído com primitivas**. Não há senoides animando membros. O aceno usa os nomes de ossos compatíveis do rig KayKit e continua sujeito à revisão visual das transições.

O GLB final tem 869.876 bytes, com texturas incorporadas. Seu SHA-256 é verificado no carregamento e em teste unitário. `scripts/prepare-companion-asset.mjs` reproduz o processamento a partir dos URLs fixados, usando GLTFLoader/GLTFExporter r180 e Playwright opcional. O script atualiza o hash do manifesto ao gerar o GLB. O exportador é ferramenta de preparação, não uma dependência carregada pelo usuário. O render estático de fallback é capturado pelo teste de navegador a partir da personagem real.

## O que funciona e o que falta

| Ação | Implementação desta versão |
| --- | --- |
| Repouso | Clip `Idle` autorado, em loop |
| Aceno | Clip `Waving`, uma execução e retorno ao repouso |
| Passos | `Walking_A`, **ciclo no lugar**, explicitamente rotulado |
| Sentar / levantar | `Sit_Chair_Down` → `Sit_Chair_Idle` → `Sit_Chair_StandUp`; banco acompanha a entrada/saída |
| Satisfação | `Cheer`, uma execução breve, sem celebração contínua |
| Digitação | **Não disponível**; durante a resposta a personagem fica sentada, sem alegar que está digitando |
| Leitura / dúvida / pensamento gestual | **Não disponíveis**; não são substituídos por movimentos com nomes falsos |

Os quatro comandos de prévia ficam dentro da cena: Acenar, Passos, Sentar e Feliz, além de Parar. Isso permite vê-la enquanto se interage no celular. O texto da tarefa real continua separado da pose. Tarefas reais interrompem prévias; conclusão, erro e cancelamento deixam de solicitar a atividade anterior. Se estiver sentando ou levantando, a saída física completa o clip antes do repouso. Não há histórico de conversa ou dados de perfis dentro do GLB.

O modo Automático respeita a preferência do sistema. Movimento reduzido/desativado mantém a apresentação estática e não cria um loop de renderização. Se o perfil já estava com movimento desativado, ele **continua desativado**; para testar os clips, escolher Automático com a preferência do sistema permitindo movimento. Falha de WebGL ou perda de contexto mostra um render estático da mesma menina, preservando a conversa.

Esta é uma **versão de teste com movimentos sociais**, não a entrega dos nove clips e da estação de digitação solicitados anteriormente. A marcha no lugar não satisfaz o requisito de caminhada com deslocamento e pés plantados. A pose sentada tem pernas à frente/pés livres, coerente com o estilo do asset, e não é uma postura ergonômica para digitação. Não há mesa/notebook falsos. Esses requisitos continuam dependendo de clips e composição específicos. O manifesto registra `for-user-review`, sem inventar aprovação visual ou autoria dos assets.

## Evidências de 06/11/2026

`scripts/validate-companion-browser.mjs` abriu **Brave headless / Chromium 156 com WebGL real via SwiftShader**, em contexto isolado, nos tamanhos 1420×900 e 380×844. Foram gravados vídeos contínuos de navegador em `reports/companion-chibi/desktop.webm` e `mobile.webm`; não são renders offline do SVG antigo. O relatório `browser.json` registra quatro loops de passos e três loops sentada em cada tamanho, contados por eventos reais do mixer. Contagem de reprodução **não é aprovação dos contatos ou da qualidade da animação**. Não houve três ciclos de digitação, pois não existe esse clip.

Também passaram: trocas rápidas, Parar e retorno ao repouso, prioridade de tarefa, cancelamento com rejeição de evento tardio, movimento desativado sem avanço do relógio e fallback após `WEBGL_lose_context`. A tarefa usada nessa verificação foi uma injeção explícita do estado da aplicação, **não inferência real**. Nenhum erro JavaScript foi registrado no teste. Capturas foram inspecionadas para enquadramento e identidade. Os vídeos ficam disponíveis para revisão contínua pelo usuário; não se declara aprovação visual geral a partir das capturas e contadores.

Passaram 77 testes JavaScript, 63 testes Python e o fluxo de integração DOM da aplicação com doubles de modelos declarados. O Python emitiu o aviso anterior de depreciação AnyIO/Starlette. Os testes históricos SVG e os relatórios de versão sem asset permanecem como histórico e não descrevem esta cena ativa.

Limites: navegador headless com GPU por software, tamanho móvel emulado, nenhum aparelho físico ou validação assistiva real. A ferramenta de controle nativo e seu host de navegador continuam indisponíveis; o teste acima usa um processo headless isolado. Não foi feita inferência LLM nova. Persistência, perfis, backups, documentos e Rede semântica continuam na arquitetura existente.

## Prompt para testar a publicação

```text
Abra a versão publicada do Nexo e registre o SHA do build. Use um perfil QA novo, sem apagar dados existentes. A companheira deve ser uma menina chibi realmente 3D, de cabelo escuro e roupa verde, com banco e piso; não o SVG antigo.

Em 1420×900 e 380×844, teste Acenar, Passos, Sentar, Feliz e Parar pelos botões dentro da cena. Observe continuamente três ciclos de passos e da pose sentada, incluindo sentar/levantar, objetos, trocas rápidas e retorno ao repouso. Grave vídeo se disponível. Passos são no lugar, não locomoção; sentado não significa digitando. Não aprove digitação, leitura ou dúvida: esses clips não estão implementados nesta versão. Registre falhas de contato e transições, sem chamar isso de nove clips completos.

Inicie uma tarefa real durante prévia e confira prioridade, conclusão, erro e cancelamento. Compare a conversa e a Rede antes/depois. Teste movimento Automático, Reduzido e Desativado e persistência no perfil. Se a personagem estiver parada, confira a preferência salva e a do sistema. Teste ocultação real da aba e falha de WebGL: deve aparecer um render estático da mesma menina, sem quebrar conversa ou dados. Não deve surgir prompt(), alert() ou confirm() nativo.

Entregue tabela com resultado funcional, resultado visual, evidência, duração/ciclos observados e limitações. Não aprove animação apenas por screenshots, build ou contadores do mixer. Emulação móvel não é aparelho físico.
```
