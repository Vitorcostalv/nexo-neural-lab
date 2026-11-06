// Fictional, versioned material. Development/test split fixed before measurements.
export const FIXTURE_DOCUMENTS=[
  {file:'aurora-v1.md',family:'aurora',publishedAt:'2026-01-10',validFrom:'2026-01-10',validTo:'2026-06-30',text:'# Programa Aurora\n\n## Protocolo AUR-27\n\nO prazo de entrega do protocolo AUR-27 é 30 de junho de 2026.\n\nA responsável pelo AUR-27 é a equipe Boreal.\n\n## Operação\n\nO observatório Aurora fica em Recife e recebe visitas às terças-feiras.\n\nO código de recuperação é JADE-72. A sigla ECA significa Estação de Controle Aurora.\n'},
  {file:'aurora-v2.md',family:'aurora',publishedAt:'2026-06-20',validFrom:'2026-07-01',validTo:null,text:'# Programa Aurora\n\n## Protocolo AUR-27\n\nO prazo de entrega do protocolo AUR-27 passou para 15 de agosto de 2026.\n\nA responsável pelo AUR-27 passou a ser a equipe Lume.\n\n## Operação\n\nO observatório Aurora continua em Recife; as visitas agora ocorrem às quintas-feiras.\n\nO código de recuperação continua sendo JADE-72. A ECA mantém o registro AUR-27/B.\n'},
  {file:'brisa.txt',family:'brisa',publishedAt:null,validFrom:null,validTo:null,text:'Biblioteca Brisa\n\nA biblioteca Brisa fica em Curitiba.\n\nO projeto BRI-09 utiliza Rust e atende somente a biblioteca Brisa.\n\nO prazo de BRI-09 é 15 de agosto de 2026; a responsável é a equipe Vento.\n\nA senha de demonstração da biblioteca é VENTO-31.\n'},
  {file:'operacao.pdf',family:'operacao',publishedAt:'2026-02-01',validFrom:'2026-02-01',validTo:null,pages:[
    'Manual da Estação ECA\nSeção 1 - Segurança\nA manutenção do sensor SEN-42 acontece às segundas-feiras.\nAntes da manutenção, a equipe deve desligar o sensor SEN-42.',
    'Manual da Estação ECA\nSeção 2 - Rotas\nO pacote ECA/BRI deve ser enviado primeiro para Recife e depois para Curitiba.\nA equipe de transporte de ECA/BRI é Boreal, sem responsabilidade por AUR-27.'
  ]}
];
export const FIXTURE_QUERIES=[
  {question:'Qual é o prazo atual do protocolo AUR-27?',file:'aurora-v2.md',quotes:['O prazo de entrega do protocolo AUR-27 passou para 15 de agosto de 2026.'],split:'dev'},
  {question:'Quem responde atualmente pelo AUR-27?',file:'aurora-v2.md',quotes:['A responsável pelo AUR-27 passou a ser a equipe Lume.'],split:'dev'},
  {question:'Onde fica a biblioteca Brisa?',file:'brisa.txt',quotes:['A biblioteca Brisa fica em Curitiba.'],split:'dev'},
  {question:'Qual é a senha de demonstração da Brisa?',file:'brisa.txt',quotes:['A senha de demonstração da biblioteca é VENTO-31.'],split:'dev'},
  {question:'Quando ocorre a manutenção do SEN-42?',file:'operacao.pdf',quotes:['A manutenção do sensor SEN-42 acontece às segundas-feiras.'],split:'dev'},
  {question:'Qual era o prazo do AUR-27 em maio de 2026?',file:'aurora-v1.md',quotes:['O prazo de entrega do protocolo AUR-27 é 30 de junho de 2026.'],split:'test',asOf:'2026-05-01'},
  {question:'Qual equipe era responsável pelo AUR-27 em maio?',file:'aurora-v1.md',quotes:['A responsável pelo AUR-27 é a equipe Boreal.'],split:'test',asOf:'2026-05-01'},
  {question:'Em qual dia o observatório Aurora recebe visitas atualmente?',file:'aurora-v2.md',quotes:['O observatório Aurora continua em Recife; as visitas agora ocorrem às quintas-feiras.'],split:'test'},
  {question:'Qual linguagem é usada por BRI-09?',file:'brisa.txt',quotes:['O projeto BRI-09 utiliza Rust e atende somente a biblioteca Brisa.'],split:'test'},
  {question:'O que deve ser feito antes de manter o SEN-42?',file:'operacao.pdf',quotes:['Antes da manutenção, a equipe deve desligar o sensor SEN-42.'],split:'test'},
  {question:'Quais cidades recebem ECA/BRI e qual equipe transporta o pacote?',file:'operacao.pdf',quotes:['O pacote ECA/BRI deve ser enviado primeiro para Recife e depois para Curitiba.','A equipe de transporte de ECA/BRI é Boreal, sem responsabilidade por AUR-27.'],split:'test'},
  {question:'Qual é o código de recuperação e o registro da ECA?',file:'aurora-v2.md',quotes:['O código de recuperação continua sendo JADE-72. A ECA mantém o registro AUR-27/B.'],split:'test'},
  {question:'Qual é o orçamento financeiro aprovado do programa Aurora?',file:null,quotes:[],split:'test'},
  {question:'Quem fundou a biblioteca Brisa?',file:null,quotes:[],split:'test'},
  {question:'Qual é o telefone da equipe Lume?',file:null,quotes:[],split:'test'},
  {question:'O que significa a sigla ECA na primeira versão?',file:'aurora-v1.md',quotes:['O código de recuperação é JADE-72. A sigla ECA significa Estação de Controle Aurora.'],split:'test',asOf:'2026-05-01'}
];
function normalizedQuote(text){let normalized='',positions=[];for(let i=0;i<text.length;i++){const char=/\s/.test(text[i])?' ':text[i];if(char===' '&&normalized.endsWith(' '))continue;normalized+=char;positions.push(i);}return {normalized,positions};}
export function fixtureGroundTruth(versions){return FIXTURE_QUERIES.map(q=>({...q,exhaustive:true,evidence:q.quotes.map((quote,i)=>{
  const version=versions.find(v=>v.name===q.file),block=version?.blocks.find(b=>normalizedQuote(b.text).normalized.includes(quote));if(!block)throw Error(`Evidência não extraída: ${q.file}.`);const {normalized,positions}=normalizedQuote(block.text),at=normalized.indexOf(quote),start=block.locator.start+positions[at],end=block.locator.start+positions[at+quote.length-1]+1;return {id:`${version.id}:${block.locator.page||0}:${start}:${end}`,versionId:version.id,page:block.locator.page,start,end};
})}));}
export const ACTIVE_CORPUS=Array.from({length:36},(_,i)=>{
  const k=i%12,category=Math.floor(i/12),classes=['agenda','tecnologia','local'],texts=[
    `A atividade didática AG-${k} acontece em ${['janeiro','fevereiro','março','abril'][k%4]}, no dia ${k+2}. O calendário confirma esse prazo.`,
    `O módulo didático TEC-${k} usa ${['Python','Rust','JavaScript','NumPy'][k%4]} para processar os dados e executar algoritmos.`,
    `A unidade didática LOC-${k} está situada em ${['Recife','Curitiba','Natal','Fortaleza'][k%4]}, no endereço de teste ${k+1}.`
  ];return {text:texts[category],label:classes[category],group:`${classes[category]}-${k}`,origin:'aurora-active-v1'};
});
