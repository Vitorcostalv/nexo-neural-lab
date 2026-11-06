// Versioned, fictional corpus. Does not change the user's memories.
export const CORPUS=[
  {id:1,text:'O observatório Aurora fica em Recife.',label:'local'},
  {id:2,text:'A chave de acesso do projeto Aurora é jade-72.',label:'acesso'},
  {id:3,text:'As visitas ao observatório Aurora acontecem às terças-feiras.',label:'agenda'},
  {id:4,text:'A biblioteca Brisa fica em Curitiba.',label:'local'},
  {id:5,text:'O projeto Brisa usa a linguagem Rust.',label:'tecnologia'},
  {id:6,text:'A cafeteria Lume fecha às dezoito horas.',label:'agenda'},
  {id:7,text:'O projeto Aurora usa a linguagem Python.',label:'tecnologia'},
  {id:8,text:'A senha da biblioteca Brisa é vento-31.',label:'acesso'}
];
export const QUERIES=[
  {text:'Em qual cidade fica o observatório Aurora?',relevant:[1]},
  {text:'Qual é a chave de acesso do projeto Aurora?',relevant:[2]},
  {text:'Em que dia posso visitar o observatório Aurora?',relevant:[3]},
  {text:'Onde está localizada a biblioteca Brisa?',relevant:[4]},
  {text:'Que linguagem de programação o projeto Brisa utiliza?',relevant:[5]},
  {text:'A que horas a cafeteria Lume fecha?',relevant:[6]},
  {text:'Qual linguagem é usada no projeto Aurora?',relevant:[7]},
  {text:'Qual é a senha da biblioteca Brisa?',relevant:[8]}
];
export function metrics(rows){
  if(!rows.length)throw Error('Avaliação vazia.');
  let precision=0,recall=0,mrr=0,hits=0;
  for(const row of rows){
    const relevant=new Set(row.relevant),retrieved=[...new Set(row.retrieved)],found=retrieved.filter(id=>relevant.has(id)).length,index=retrieved.findIndex(id=>relevant.has(id));
    precision+=retrieved.length?found/retrieved.length:0;recall+=found/relevant.size;mrr+=index<0?0:1/(index+1);hits+=found?1:0;
  }
  return {queries:rows.length,precision:precision/rows.length,recall:recall/rows.length,mrr:mrr/rows.length,hitRate:hits/rows.length};
}
