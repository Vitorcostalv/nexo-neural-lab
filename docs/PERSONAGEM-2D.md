# Revisão da personagem — apoio, contato e transições

**Publicação autorizada para teste no navegador.** Esta revisão usa o workflow existente do GitHub Pages, após o pedido explícito de deploy. [Aplicação](https://vitorcostalv.github.io/nexo-neural-lab/) · [Publicações](https://github.com/Vitorcostalv/nexo-neural-lab/actions/workflows/pages.yml). Não houve migração de dados, alteração de modelos ou de configuração de serviços externos. As limitações de validação visual descritas abaixo continuam válidas.

## O que estava errado

A implementação anterior combinava keyframes CSS independentes com `transform-origin` em coordenadas globais. Braços, mãos e rosto podiam trocar de orientação sem compartilhar um alvo; a digitação era uma pose em pé com notebook sobreposto. A caminhada alternava rotações e deslocamento frontal sem travar os pés no chão. Trocas de gesto também reiniciavam ciclos, e uma cópia de braço sobreposta tentava resolver a oclusão no queixo.

Essa estrutura foi substituída por um modelo único de pose e um renderer SVG. O rosto e as roupas foram redesenhados mantendo cabelo escuro, casaco verde e a identidade de companheira de laboratório. Sombra local, gola, punhos, sola dos calçados, oclusão dos braços e superfície da mesa dão profundidade sem emissões de luz.

## Bibliotecas pesquisadas e escolha

- [Rive Web](https://rive.app/docs/runtimes/web/web-js) oferece runtime JS/WASM, renderização e máquinas de estados. Seria uma opção para um personagem autorado em `.riv`, mas ainda exigiria produzir e manter esse asset/rig. O runtime não substitui o desenho nem define os contatos específicos desta personagem.
- [Motion animate](https://motion.dev/docs/animate) oferece interpolação de estilos SVG, atributos e sequências. É útil para sequenciar valores, mas as restrições de pés e mãos e a autoria do desenho continuariam sendo trabalho deste projeto.
- [Spine](https://en.esotericsoftware.com/spine-runtimes-license) oferece runtimes esqueléticos com condições de licença ligadas ao editor. Não foi introduzida uma dependência de editor/licença para manter esta figura.

Escolha: **SVG por camadas, cinemática inversa de dois segmentos e um controlador numérico pequeno, sem dependência nova na aplicação**. É uma decisão para este desenho e seus contatos, não uma alegação de superioridade geral sobre essas ferramentas. O Three.js existente permanece restrito ao mapa; não foi usado para transformar a personagem em 3D.

## Arquivos e responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `lab-web/companion-girl.js` | Entrada pública preservada, reexportando a nova implementação |
| `lab-web/companion-art.js` | Desenho SVG em coordenadas locais de cada osso; cadeira, mesa, notebook e livro |
| `lab-web/companion-rig.js` | Poses, prioridades derivadas da integração, mistura de canais, IK, locomoção, contatos, expressão e relógios |
| `lab-web/companion-renderer.js` | Único escritor dos atributos SVG; encadeia ombro/cotovelo/punho e quadril/joelho/tornozelo |
| `lab-web/companion-scene.js` | Eventos reais, prévias mantidas, preferências, visibilidade e único `requestAnimationFrame` |
| `lab-web/companion-girl.css` | Apenas composição, controles e navegação; nenhum keyframe concorre com os ossos |
| `lab-web/tests/companion-rig.test.js` | Contatos, apoio, alcance, interrupção e modos de movimento |
| `scripts/validate-companion-dom.mjs` | Ciclo de vida e agendamento em DOM emulado |
| `scripts/validate-companion-motion.mjs` | Evidências offline pelo mesmo rig e renderer utilizados no app |

O personagem digital original em `companion.js` continua preservado e sem uso. Perfis, bancos IndexedDB/SQLite, documentos, classificadores, backups, experimentos, Biblioteca e conversa compartilhada não foram reestruturados.

## Como os movimentos funcionam

**Um escritor por transformação.** O deslocamento pertence ao grupo do cenário; a direção vem da locomoção; cada cadeia recebe sua transformação local calculada por IK. Rosto, olhar, pálpebras e boca são camadas separadas. Não há escala no rosto para piscar ou girar. A vista frontal muda gradualmente para o perfil por geometria, sem sobrepor dois rostos semitransparentes. Partes distantes recebem uma tonalidade mais escura, não transparência que revele o corpo através da roupa.

**Transições.** Canais de pose são misturados em aproximadamente 340 ms, com início/fim suaves. Cada solicitação captura os canais visuais atuais; os relógios das poses que estão saindo continuam de onde estavam, em vez de reiniciar. Uma tarefa real remove a prévia. `Explorar gestos` mantém a prévia até **Voltar ao repouso**. Esses botões não chamam modelos nem gravam conhecimento.

**Repouso.** Os pés ficam apoiados e o quadril não flutua. Há deslocamento subpixel do tórax, piscadas por pálpebras e pequenas mudanças de olhar com intervalos de repouso. Cabelo tem atraso discreto; roupa acompanha o tronco sem escala do corpo inteiro.

**Caminhada.** A distância percorrida determina a fase dos passos. Na fase de apoio, o alvo do pé é fixo no espaço do cenário; na passagem, ele descreve um arco até o contato seguinte. Os braços ficam em oposição às pernas. Há aceleração/desaceleração, parada em apoio duplo e giro enquanto a velocidade está em zero. O deslocamento é limitado à área interna e usa uma vista lateral. Ao interromper, o controlador freia e acomoda os pés; o retorno ao repouso não arrasta a personagem de volta ao centro.

**Pensando/processando.** Um gesto leva a mão ao queixo e sustenta o contato calculado a partir da posição atual da cabeça. O braço oposto dá apoio. As pequenas variações mantêm o ponto de contato, sem um membro solto tentando acompanhar um keyframe diferente. “Pensando” continua sendo o nome visual da prévia, não descrição de consciência.

**Digitando.** A personagem se senta, com coxas projetadas em perspectiva, joelhos e pés apoiados. Cadeira e estação de trabalho entram por opacidade e pose; a tampa abre a partir da dobradiça sobre a mesa. Ombros e cotovelos alcançam punhos alinhados ao teclado. Dedos alternam pequenos toques, com pausas. O olhar aponta para o notebook. Na operação real, mãos/boca param se não houver fragmentos recentes por 650 ms, retomam no próximo fragmento e param imediatamente ao sair do estado de resposta. A boca é um indicador estilizado, sem promessa de sincronização fonética.

**Estudando.** Usa a mesma mesa/cadeira e livro apoiado. Mãos ficam sobre as páginas; uma pequena passagem de página é seguida por um intervalo longo de leitura. A mão direita acompanha o movimento da página, mantendo o braço conectado.

**Feliz/confusa.** A satisfação tem gesto breve, com redução do movimento e retorno ao repouso pelo estado real. A confusão usa sobrancelhas e palma discretas. O status textual distingue erro técnico, cancelamento e informações de recuperação; não se atribui tristeza ou sentimento à personagem/usuário.

**Preferências e pausa.** Automático executa o movimento completo. Reduzido mantém poses com transição curta de cerca de 180 ms, sem caminhada, piscadas ou digitação contínuas. Desativado só atualiza a pose, sem loop contínuo. `IntersectionObserver`, a classe da visualização e `document.hidden` interrompem o processamento fora da tela/aba; a retomada reinicia a referência de tempo para não saltar vários segundos. O descarte remove RAF, observers, inscrição de atividade e listeners. Nenhum quadro é anunciado ao leitor de tela; somente o status técnico muda por evento.

## Evidências e testes

Executados localmente em 06/11/2026:

- **69 testes JavaScript passaram**: incluindo IK, contato dos dedos no teclado em vários ciclos, contato com o queixo, apoio dos pés, alcance dos membros em todas as poses, interrupções e supressão de movimento.
- **63 testes Python passaram**. Permanece o aviso anterior de depreciação `BlockingPortal` do Starlette/AnyIO.
- Build estático e smoke HTTP passaram; **64 recursos** foram resolvidos sob subdiretório. O verificador agora também segue `export … from`, usado pela entrada pública da personagem.
- Integração de perfis/backup e o fluxo completo da aplicação em DOM emulado passaram.
- [Relatório de agendamento](../reports/companion-motion/dom.json): uma única linha de tempo, prioridade de tarefas reais, cancelamento, prévia mantida/encerrada, pausa fora da tela/aba e ausência de loop contínuo nos modos estáticos. Usa doubles explícitos de visibilidade/RAF; não representa medição de navegador.
- [Relatório dos clipes](../reports/companion-motion/validation.json): quatro clipes de 10 s, 240 quadros a 24 fps, pelo rig e renderer reais. Os clipes de caminhada/digitação contêm mais de três ciclos. O desvio numérico máximo de pés em apoio e o erro de alcance observados foram inferiores a 0,0001 unidade nos clipes. Não são avaliações semânticas nem benchmark de GPU.

| Evidência local | Conteúdo |
|---|---|
| [Digitação](../reports/companion-motion/typing.mp4) | Entrada, postura sentada, ciclos com pausas e saída |
| [Caminhada](../reports/companion-motion/walking.mp4) | Apoio/passagem, deslocamento, giro e parada |
| [Estudo](../reports/companion-motion/studying.mp4) | Apoio do livro, leitura e passagem de página |
| [Trocas rápidas](../reports/companion-motion/rapid.mp4) | Interrupções entre os gestos e acomodação final |
| [Prancha de poses](../reports/companion-girl-poses.png) | Poses calculadas pelo rig, sem ângulos manuais de demonstração |
| [Quadros da digitação](../reports/companion-motion/typing-frames.png) | Contato/composição em momentos diferentes |
| [Quadros da caminhada](../reports/companion-motion/walking-frames.png) | Orientação e apoios ao longo do deslocamento |

As imagens foram inspecionadas e problemas de oclusão, pescoço, apoio da mesa e projeção dos joelhos foram corrigidos durante a revisão. Os MP4 foram gerados **offline**, a partir do mesmo modelo numérico e atributos SVG do app, usando o renderer nativo já disponível. **Não são gravações do site, nem prova de suavidade no navegador.**

O host do navegador e o acesso nativo retornaram indisponíveis. Portanto, observar a animação real em desktop/celular, avaliar seu frame pacing e gravar o navegador **continuam pendentes**. Não se declara validação visual completa com base em compilação, testes numéricos, screenshots ou renders offline.

## Executar e revisar

```powershell
node --test lab-web/tests/*.test.js
python -m pytest -q
node scripts/build-web.mjs
node scripts/validate-web-assets.mjs
node scripts/validate-companion-dom.mjs
node scripts/validate-research-dom.mjs
node scripts/validate-companion-motion.mjs --video
python -m http.server 8020 --directory dist --bind 127.0.0.1
```

Abra `http://127.0.0.1:8020` para a edição local, ou a aplicação publicada após a conclusão do workflow. Os scripts de evidência usam `jsdom`, `@napi-rs/canvas` e `imageio_ffmpeg` do ambiente opcional local; nenhum deles entra no bundle web. Sem `--video`, o script gera somente pranchas/relatório. Os quadros intermediários ficam em `runtime/companion-motion-review`, fora do versionamento.

## Prompt de validação no navegador

```text
Teste a revisão publicada do Nexo em https://vitorcostalv.github.io/nexo-neural-lab/. Confira que a revisão dos recursos corresponde ao commit informado na entrega do deploy. Não teste uma versão antiga do cache. Como alternativa para desenvolvimento local, use http://127.0.0.1:8020, se esse endereço estiver acessível ao seu navegador.

Use um perfil QA e preserve dados preexistentes. Em desktop (1440×900) e celular (aproximadamente 390×844), selecione Movimento Automático, abra Explorar gestos e mantenha Caminhando e Digitando por pelo menos três ciclos completos. Observe apoio dos pés, oposição de braços/pernas, orientação lateral, velocidade, aceleração, parada e limites da cena. Digitação deve ser sentada, com mesa/cadeira/notebook apoiados e dedos alcançando o teclado; confira entrada e saída sem objeto flutuante.

Teste todas as poses, gesto de queixo, estudo/página, satisfação breve e confusão sutil. Troque rapidamente entre os botões, depois use Voltar ao repouso. Procure membros soltos, buracos em articulações, rosto deformado, sobreposição errada ou recortes. Teste Reduzido e Desativado, ocultação/retorno da aba e saída/retorno à visualização. Nenhum modo estático deve continuar andando ou digitando.

Durante uma operação real, tente iniciar uma prévia: ela não deve assumir a animação. Observe progresso real, intervalos sem tokens, conclusão, erro e cancelamento. Verifique que texto técnico distingue os casos e que resultados tardios não reativam poses antigas. Confirme conversa compartilhada com a Rede e preservação de perfis, documentos e backups. Não use mocks para declarar inferência real.

Grave clipes curtos da página se possível. Entregue reprodução, esperado/observado e evidências por cenário, com APROVADO/FALHOU/BLOQUEADO. Screenshots comprovam poses, não suavidade. Não publique nem altere produção automaticamente.
```
