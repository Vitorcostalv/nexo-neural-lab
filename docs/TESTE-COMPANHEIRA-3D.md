# Prompt para o Codex do navegador — revisão da companheira

> Protocolo de aceitação para a entrega completa. A versão chibi atual tem clips sociais e está publicada para teste: use primeiro [o prompt e as capacidades atuais](COMPANHEIRA-CHIBI.md#prompt-para-testar-a-publicação). Não aprove digitação ou leitura sem esses clips.

Copie o texto abaixo. Use a versão local desta revisão: a página pública ainda contém a versão anterior.

```text
Teste o Nexo na URL local que eu informar, sem publicar e sem editar meus perfis existentes. Crie um perfil QA exclusivo. Registre URL, build, navegador, GPU, data, viewport e tamanho do painel. Não trate emulação móvel como aparelho físico.

Primeiro verifique se há personagem 3D aprovada ou apenas retrato estático. A implementação desta revisão está aguardando o GLB: se mostrar “aguarda modelo e animações revisados”, registre os testes de animação como BLOQUEADOS por ausência do asset. Não chame o fallback de 3D nem aprove clips que não existem. Ainda teste conversa, dados, Rede, preferências e legibilidade do retrato. Se a URL for a página pública antiga, registre divergência de versão e não atribua resultados à implementação local.

Se houver GLB integrado, confira a origem/licença e o manifesto de revisão antes de avaliar movimento. Em desktop 1420×900 e emulação 380×844, observe continuamente pelo menos três ciclos completos de caminhada e três de digitação em cada formato. Grave vídeo contínuo com entrada, ciclos e saída quando a ferramenta permitir. Se não permitir observação suficiente, registre BLOQUEADO, mesmo com screenshots.

Na caminhada, observe pés plantados na fase de apoio, deslocamento compatível com passos, ausência de deslizamento, loop sem salto e parada estável. Na digitação, acompanhe sentar, entrada de cadeira/mesa/notebook, mãos no teclado, olhar na tela voltada à personagem, pés no chão e saída por levantar. Procure cruzamentos com rosto/corpo e objetos flutuantes. Confira os enquadramentos, luz, sombra de contato e câmera imóvel. Observe leitura, aceno, satisfação e dúvida: gestos curtos, sem comemoração contínua. Não aprove só a pose final.

Alterne rapidamente entre caminhar, digitar, ler, acenar, felicidade e dúvida e volte ao repouso. Inicie uma tarefa real durante uma prévia: a tarefa deve prevalecer e os botões devem ficar indisponíveis. Ensine uma memória fictícia e aguarde sucesso real. Gere uma resposta com modelos reais, registrando qual runtime/modelo e o resultado sem inferir qualidade geral. Cancele um experimento durante execução; a segunda condição não deve começar e mensagens tardias não podem reativar a animação. Provoque um erro reversível (por exemplo bloqueio temporário de download, sem apagar dados) e confira status acessível e retorno coerente. Términos podem aguardar a saída física do clip, mas a IA não pode continuar apresentada como ativa.

Teste movimento reduzido e desativado, persistência após recarregar, preferência do sistema, aba realmente oculta, painel fora da área visível e retorno à vista. Meça se RAF/render realmente pausam, sem afirmar ocultação se document.hidden continuar false. Simule falha de WebGL/contexto ou bloqueio do GLB e confira retrato estático, mensagem discreta e uso normal da conversa. Não deve haver prompt(), alert() ou confirm() nativos.

Confira perfis, histórico, documentos, backup e Rede semântica sem perda de dados. Reveja teclado, foco, zoom 200%, ausência de rolagem horizontal e mensagens de erro. Exporte evidências apenas do perfil QA criado.

Entregue tabela por cenário com APROVADO/FALHOU/BLOQUEADO, evidência, duração observada, ciclos completos contados e limitações. Separe resultado funcional de aprovação visual. Liste vídeos e capturas com seus caminhos. Nunca declare aprovação visual com base apenas em build, DOM, testes sintéticos, screenshots ou vídeos offline de outra versão. Não faça deploy.
```
