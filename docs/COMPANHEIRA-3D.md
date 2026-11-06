# Companheira 3D — integração disponível, personagem final pendente

Revisão local de 06/11/2026. **Não publicada. Não aprovada visualmente. Não há GLB final incluído.**

A revisão feita pelo usuário no Brave identificou notebook orientado incorretamente e antebraço sobre o rosto na apresentação SVG. O rig anterior foi preservado nos arquivos, mas deixou de ser montado pela entrada pública. A interface ativa usa um retrato SVG estático em repouso, derivado da identidade existente: cabelo escuro e roupa verde. Não reproduz os gestos reprovados e não apresenta o retrato como personagem 3D concluída.

## Dependência de arte

Foi feita pesquisa em fontes dos autores. [Universal Base Characters, Quaternius](https://quaternius.com/packs/universalbasecharacters.html) oferece bases humanoides e cabelos sob CC0, compatíveis com a biblioteca de animações do autor. [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) e [Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) oferecem movimentos; a disponibilidade dos clips varia por edição. [Mesh2Motion Assets](https://github.com/Mesh2Motion/mesh2motion-assets) disponibiliza arte e animações sob CC0. Essas fontes são candidatas de produção, **não assets adquiridos, retargetados ou aprovados nesta implementação**. Não se verificou um pacote completo que já preserve a identidade e tenha a composição de digitação solicitada. Isso não significa que tal asset não exista.

É necessário produzir ou adaptar um GLB articulado e revisar os nove clips, incluindo contatos com o mobiliário. Uma base CC0 reduz a modelagem, mas não resolve automaticamente roupa, cabelo, expressões, retargeting, contatos e enquadramento. Nenhuma compra, cadastro ou contratação foi feita. Nenhum asset de terceiros foi incorporado como personagem substituta.

## Código implementado

- `companion-stage.js`: montagem acessível, retrato estático, estados reais, preferências existentes, prévias subordinadas às tarefas, carregamento por visibilidade, pausa de RAF e descarte de carregamentos tardios. Nenhuma alteração de esquema ou migração de dados.
- `companion-webgl.js`: Three.js existente, `GLTFLoader`, luz hemisférica e direcional suave, sombras sobre as superfícies autoradas, câmeras estáveis do GLB, resize, DPR até 1,5, descarte de geometrias/materiais/texturas/esqueletos. Falha ou perda de contexto retorna ao retrato.
- `companion-player.js`: `AnimationMixer` real, clips importados e crossfade de 180 ms. Digitar passa por sentar; sair passa por levantar. Trocas durante essas transições guardam somente o destino mais recente. Caminhada termina na fronteira do loop; sua rota e deslocamento devem ser autorados no clip. Não há animação procedural de braços ou pernas.
- `companion-asset.js`: manifesto explicitamente `pending`. Contrato de origem/licença, hash, clips próprios, câmeras, objetos e referência à revisão. Download de um único GLB incorporado, até 8 MiB, SHA-256 verificado. Buffers/texturas externos são rejeitados. Rig, destinos dos tracks, valores finitos, 60 mil triângulos e texturas até 2048 px são conferidos no carregamento.

O loader e `BufferGeometryUtils` foram obtidos do [Three.js r180](https://github.com/mrdoob/three.js/tree/r180/examples/jsm), a mesma revisão do Three já usado no mapa. Licença MIT em `lab-web/vendor/THREE-LICENSE.txt`. Somente os imports de dependências foram ajustados para arquivos locais; não há CDN nova. As origens exatas são `examples/jsm/loaders/GLTFLoader.js` e `examples/jsm/utils/BufferGeometryUtils.js` na tag r180.

O modo automático respeita a preferência do sistema. Reduzido e desativado mantêm repouso estático sem RAF contínuo. Se iniciados assim, não baixam o GLB. Renderização pausa fora da área visível, em outra vista e com aba oculta; retorno reinicia o relógio sem contabilizar o intervalo oculto. O estado técnico da tarefa continua no texto/progresso, mesmo sem animação.

Mapeamento: carregamento → caminhada; recuperação/treinamento/salvamento → leitura; resposta em fluxo → digitação; recebimento → aceno; geração → repouso; conclusão → satisfação breve; erro → dúvida breve; cancelamento → repouso. Não há clip de pensamento improvisado. Gestos curtos não repetem indefinidamente. Cancelamento durante sentar/levantar aguarda o término físico do clip antes de estabilizar; isso não mantém a operação de IA ativa. O deslocamento, props, expressões e os contatos são responsabilidade dos clips, não correções senoidais no runtime.

## Entrega necessária do artista

1. GLB 2.0 local, com esqueleto, skin e todas as texturas incorporadas, unidade em metros, +Y para cima. Manter cabelos escuros, roupa verde, rosto expressivo discreto e identidade da companheira. Entregar também fonte editável e comprovante de licença compatível com redistribuição no GitHub Pages, incluindo derivados e animações.
2. Cena única com personagem, chão, cadeira, mesa, notebook, teclado e livro. Todos os objetos devem ter nomes únicos. Cada clip deve chavear também o estado dos objetos, inclusive as escalas/posições de entrada e saída. Não inserir/esconder mobiliário por um salto no JavaScript.
3. Clips distintos: `idle`, `walk`, `sit`, `type`, `stand`, `wave`, `satisfaction`, `doubt`, `read` (nomes finais configuráveis). Repouso, caminhada, digitação e leitura repetem; os demais são executados uma vez. Caminhada deve ser uma rota fechada com root motion autorado, extremos compatíveis com repouso e pés plantados durante contato. Não usar caminhada no lugar acompanhada de translação arbitrária no runtime.
4. `sit` parte do repouso e monta a composição; termina exatamente no primeiro quadro de `type`. `stand` parte da digitação e termina no repouso com saída dos objetos. Leitura deve ter entrada e loop compatíveis com repouso, livro apoiado/segurado e saída consistente na mistura; revisar esse caminho separadamente. Notebook deve mostrar sua tela à personagem, mãos devem alcançar teclado, pés devem tocar chão. Revisar cruzamentos durante os crossfades, não apenas clips isolados.
5. Câmeras PerspectiveCamera autoradas, uma para desktop e outra para a composição móvel. Sem animação de câmera. Enquadrar a rota inteira, cabeça, pés e objetos a 1420×900 e 380×844; registrar também o tamanho real do painel, que é menor que a viewport. `walk` até 4 s; `sit`/`stand` até 3 s; aceno/satisfação/dúvida até 2 s; demais até 12 s. Esses limites tornam as saídas previsíveis, não comprovam naturalidade.
6. Vídeos contínuos e identificação do revisor, cobrindo ao menos três ciclos de caminhada e digitação em cada formato, entrada/saída, trocas rápidas, cancelamento e retorno ao repouso. Corrigir contatos no DCC/rig antes de exportar quando necessário. O runtime atual não implementa IK de pés/mãos em tempo real; se os clips exigirem essa correção, a entrega ainda não está pronta.

Para integrar, adicionar o GLB em `lab-web/models/` (a pasta `models/` é ignorada pelo Git; adicionar deliberadamente o asset licenciado) e completar `companionAsset.asset`:

```js
{
  url: './models/nexo.glb',
  sha256: '<hash SHA-256 dos bytes finais>',
  credits: {author: '<autor>', source: '<origem>', license: '<licença>', licenseUrl: '<termos>'},
  clips: {idle:'Idle', walk:'Walk', sit:'Sit', type:'Type', stand:'Stand', wave:'Wave', satisfaction:'Satisfied', doubt:'Doubt', read:'Read'},
  cameras: {desktop:'CameraDesktop', mobile:'CameraMobile'},
  nodes: {floor:'Floor', desk:'Desk', chair:'Chair', screen:'Screen', keyboard:'Keyboard'},
  review: {reviewer:'<revisor>', walkCycles:3, typeCycles:3, videos:['<vídeo desktop>', '<vídeo celular>']}
}
```

Somente mudar `status` para `ready` após revisar asset, licença e vídeos. Os campos de revisão são uma declaração humana e não uma prova automática: a validação estrutural não detecta mãos atravessando o rosto, objetos flutuantes ou deslizamento. Adicionar a licença, origem, modificações, hash e evidências reais ao repositório nessa entrega. O Python usa os mesmos módulos front-end; sua API não sofreu alterações.

## Verificação e limites

Em 06/11/2026 passaram 76 testes JavaScript e 63 testes Python (um aviso de depreciação AnyIO/Starlette). Build, sintaxe dos novos módulos, `git diff --check` e smoke HTTP de 68 recursos sob `/nested/nexo/` passaram. A verificação de perfis também passou com IndexedDB emulado. Os testes novos usam `AnimationMixer` real com tracks sintéticos explícitos: sequenciamento, limites de interrupção, saída de digitação, gestos únicos, modos e rejeição de asset inválido. Os testes antigos do rig SVG são históricos e não aprovam a versão ativa. O resumo verificável, origens e hashes dos addons estão em `reports/companion-3d/review.json`.

`node scripts/validate-companion-dom.mjs` cobre o fallback, carregamento sob demanda, prioridade real, cancelamento, callbacks tardios, pausa, preferências e perda de contexto com doubles declarados. Evidência em `reports/companion-3d/dom.json`. `node scripts/validate-research-dom.mjs` verificou conversa, documentos, perfis, backups, pesquisa, destaque do mapa e erros com modelos simulados. Esses scripts exigem as dependências de validação opcionais em `runtime/nexo-validation` já presentes neste ambiente; os testes unitários e o build não exigem essa instalação.

O acesso de controle ao navegador retornou “browser access host is unavailable” e o pipe nativo também estava indisponível. **Não foram observados ciclos 3D em desktop/celular, não há vídeos 3D e não houve inferência real nova nesta revisão.** A revisão visual fornecida pelo usuário pertence à versão SVG publicada. Compilação, smoke HTTP e testes de mixer/DOM não substituem a validação visual solicitada. A entrega da personagem final continua bloqueada pelo asset e pela revisão contínua. Nada foi publicado nesta revisão.
