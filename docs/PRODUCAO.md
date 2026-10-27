# Relatório de publicação · Nexo

O Nexo passou de uma aplicação pessoal para um projeto de estudo publicável sobre deep learning e RAG, com duas formas de execução.

## Decisão de hospedagem

A edição pública usa GitHub Pages, disponível gratuitamente para repositórios públicos. A inferência executa no navegador do visitante. Isso evita depender do computador do autor, credenciais de serviços de IA, custos por requisição e um banco compartilhado entre visitantes.

Cloudflare Workers/Sites não é adequado para hospedar os pesos dos modelos Ollama e o processo Python original. O projeto usa o GitHub já conectado e mantém publicação contínua no mesmo serviço do código.

Esta escolha transfere o custo computacional para o dispositivo do visitante. O primeiro uso baixa centenas de megabytes, CPU pode ser lenta e hardware com pouca memória pode falhar. O modelo Qwen2.5 0.5B é menor e menos capaz que o Qwen3 4B da edição local. Não é um serviço de inferência na nuvem com desempenho uniforme.

## Implementação

- Build estático com caminhos relativos, compatível com subdiretórios do Pages.
- Transformers.js 3.8.1 em Web Worker: MiniLM multilíngue q8 e alternativa Qwen2.5 0.5B ONNX q4 para CPU.
- WebLLM 0.2.86 para Qwen2.5 0.5B MLC em WebGPU; recuperação para WebAssembly se a GPU não estiver disponível ou a inicialização falhar. Progresso de download e streaming de texto.
- IndexedDB separado por navegador; importação/exportação de textos entre edições.
- MLP JavaScript 384 → 64 → 24 → classes, Adam e backpropagation, validação e parada antecipada. A edição NumPy foi preservada.
- Grafo com similaridades reais e projeção aproximada; animações de integração preservadas.
- Nenhum modelo, banco local, histórico pessoal, log ou segredo incluído no Git.
- README, licença MIT, testes e workflows de publicação e integração contínua.

## Validação

Antes da publicação, passaram 44 testes Python e 20 JavaScript. A suíte JavaScript inclui treinamento reproduzível, classificação de exemplos separáveis não vistos, busca por cosseno e contrato dos dados do grafo. Os testes unitários não baixam modelos.

A edição web foi testada no navegador com saudação sem memória, download real do modelo de embeddings e gravação de informação fictícia. A pergunta sobre o observatório Aurora recuperou a memória com similaridade de 72% e recebeu a resposta correta sobre Recife. O primeiro ciclo com inicialização da LLM levou 26,57 s; uma pergunta geral subsequente sobre a capital do Brasil levou 0,19 s, no PC de validação com GPU. Estes números são observações pontuais, não garantias para outros dispositivos. A integração contínua também passou em Linux/Python 3.12 no GitHub Actions.

## Operação e atualização

No domínio público, a recuperação e o streaming funcionaram com uma memória fictícia separada da base local. Em um dos testes, a LLM recuperou Recife corretamente, mas acrescentou um estado incorreto à resposta. O prompt foi reforçado para limitar detalhes aos fatos das fontes e a geração GPU passou a usar temperatura zero. Isso reduz variação, mas não elimina alucinações; a edição web deve ser tratada como experimento educacional, com conferência das fontes.

O fluxo real de treino no navegador também foi validado: 18 exemplos didáticos, 3 categorias, 15 amostras de treino e 3 de validação. O MLP completou 132 épocas em 3,02 s e teve 100% de acurácia em ambos os conjuntos pequenos. Estes resultados demonstram execução funcional, não generalização para dados novos.

Push em `main` aciona `Deploy browser edition`. O workflow executa os testes JavaScript, gera `dist/` e publica no Pages. `Quality checks` executa testes Python e JavaScript. Não existem segredos de aplicação necessários para a edição web. O token temporário de implantação é gerado pelo GitHub Actions com permissões restritas ao job.

Memórias não têm backup remoto. Exportar é responsabilidade do usuário. Use uma aba por vez para editar. A edição Python continua pessoal; uma versão SaaS precisaria autenticação, isolamento por usuário, controles de abuso, backup, observabilidade e infraestrutura de inferência próprios.

Fontes: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages), [workflows de implantação](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Transformers.js](https://huggingface.co/docs/transformers.js/en/index), [Qwen ONNX](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct), [MiniLM ONNX](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2).
