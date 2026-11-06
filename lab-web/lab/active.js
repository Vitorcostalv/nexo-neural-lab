import {distribution,predict,train} from '../browser/learning.js?v=1.4.1';
import {hash,integer,checkAbort} from './contracts.js?v=1.4.1';
import {tokenize} from './search.js?v=1.4.1';
export const groupKey=text=>tokenize(text).join(' ');
export function random(seed=42){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function shuffle(values,seed=42){const r=random(seed),result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function selectExamples(model,pool,{strategy='margin',limit=5,seed=42}={}){
  integer(limit,1,100,'Exemplos');if(!['margin','entropy','random'].includes(strategy))throw Error('Seleção inválida.');
  // Deliberately project away ALL labels before selection; neither oracle nor holdouts are arguments.
  const eligible=pool.filter(e=>!e.reviewed&&!e.skipped&&!e.label&&(!e.split||e.split==='pool')).map(({id,text,vector,group})=>({id,text,vector,group}));
  const seen=new Set(),unique=eligible.filter(e=>{const key=e.group||groupKey(e.text);if(seen.has(key))return false;seen.add(key);return true;});
  if(strategy==='random')return shuffle(unique,seed).slice(0,limit).map(e=>({id:e.id,criterion:'random'}));
  if(!model)throw Error('Treine uma rodada antes de selecionar por incerteza.');
  return unique.map(e=>{const p=distribution(model,e.vector),sorted=[...p].sort((a,b)=>b-a),margin=sorted[0]-(sorted[1]??0),entropy=-p.reduce((s,v)=>s+(v>0?v*Math.log(v):0),0);return {id:e.id,margin,entropy,criterion:strategy,output:predict(model,e.vector)};}).sort((a,b)=>strategy==='margin'?a.margin-b.margin||a.id.localeCompare(b.id):b.entropy-a.entropy||a.id.localeCompare(b.id)).slice(0,limit);
}
export function classificationMetrics(labels,truth,predicted){
  if(truth.length!==predicted.length)throw Error('Tamanhos de avaliação incompatíveis.');const matrix=labels.map(()=>labels.map(()=>0));let correct=0;
  truth.forEach((value,i)=>{const a=labels.indexOf(value),b=labels.indexOf(predicted[i]);if(a<0||b<0)throw Error('Classe desconhecida na avaliação.');matrix[a][b]++;correct+=Number(a===b);});
  const f1=labels.map((_,i)=>{const tp=matrix[i][i],fp=matrix.reduce((s,row)=>s+row[i],0)-tp,fn=matrix[i].reduce((s,v)=>s+v,0)-tp;return 2*tp+fp+fn?2*tp/(2*tp+fp+fn):0;});
  return {samples:truth.length,accuracy:truth.length?correct/truth.length:null,macroF1:truth.length?f1.reduce((s,x)=>s+x,0)/labels.length:null,labels,confusionMatrix:matrix};
}
export function evaluateClassifier(model,examples){return classificationMetrics(model.labels,examples.map(e=>e.label),examples.map(e=>predict(model,e.vector).label));}
export function validateSplits(examples){
  const groups=new Map();for(const e of examples){const group=e.group||groupKey(e.text),split=e.split==='train'||e.split==='pool'?'learning':e.split;if(groups.has(group)&&groups.get(group)!==split)throw Error('Grupo duplicado em treino/validação/teste. Corrija a origem ou o grupo.');groups.set(group,split);}
}
export async function trainRound(state,progress=()=>{}){
  validateSplits(state.examples);const training=state.examples.filter(e=>e.label&&(e.split==='train'||e.split==='pool')),validation=state.examples.filter(e=>e.label&&e.split==='validation'),test=state.examples.filter(e=>e.label&&e.split==='test');
  const samples=[...training,...validation],model=await train(samples,progress,{seed:42,maxEpochs:180,partition:{train:training.map(e=>e.id),validation:validation.map(e=>e.id)}});
  return {model,round:{id:crypto.randomUUID(),created:new Date().toISOString(),labeled:training.length,trainIds:training.map(e=>e.id),validationIds:validation.map(e=>e.id),testIds:test.map(e=>e.id),test:evaluateClassifier(model,test),validation:evaluateClassifier(model,validation),configuration:{...model.metadata.configuration,earlyStopping:true},note:'Teste fixo fora da seleção ativa e da escolha de hiperparâmetros.'}};
}
export async function annotate(state,id,label,{skip=false,origin='human'}={}){
  if(state.annotations.length>=10000)throw Error('Limite de 10.000 anotações; exporte o histórico.');
  if(typeof label!=='string'||label.length>48||!skip&&!label.trim())throw Error('Rótulo inválido.');const item=state.examples.find(e=>e.id===id);if(!item)throw Error('Exemplo não encontrado.');
  if(item.split==='test')throw Error('Conjunto de teste fixo: não é anotado pela seleção ativa. Importe um gabarito explícito.');
  return {...state,model:null,examples:state.examples.map(e=>e.id===id?{...e,label:skip?e.label:label.trim(),reviewed:!skip,skipped:skip}:e),annotations:[...state.annotations,{id:crypto.randomUUID(),exampleId:id,previous:item.label||'',label:skip?item.label:label.trim(),skip,origin,at:new Date().toISOString()}]};
}
export async function prepareExamples(items,existing=[]){
  const result=[...existing],seen=new Set(existing.map(e=>groupKey(e.text)));
  for(const item of items){if(typeof item.text!=='string'||!item.text.trim()||item.text.length>2000)throw Error('Texto deve conter 1 a 2.000 caracteres.');const key=groupKey(item.text);if(seen.has(key))continue;seen.add(key);
    const split=item.split||'pool';if(!['pool','train','validation','test'].includes(split)||typeof(item.label||'')!=='string'||(item.label||'').length>48)throw Error('Partição ou rótulo inválidos.');
    const label=(item.label||'').trim();if(split!=='pool'&&!label)throw Error('Treino, validação e teste exigem rótulo humano explícito. Use pool para textos sem rótulo.');if(typeof(item.group??'')!=='string'||(item.group||'').length>200||typeof(item.origin??'')!=='string'||(item.origin||'').length>200)throw Error('Grupo e origem devem conter até 200 caracteres.');
    result.push({id:'A'+(await hash(key)).slice(0,24),text:item.text.trim(),label,group:item.group?.trim()||key,split,origin:item.origin||'manual',created:new Date().toISOString(),reviewed:!!label,skipped:false});
  }validateSplits(result);return result;
}
export function benchmarkPartition(corpus,seed){
  const labels=[...new Set(corpus.map(e=>e.label))].sort(),train=[],validation=[],test=[],pool=[];
  for(const label of labels){const groups=new Map();for(const e of corpus.filter(e=>e.label===label)){const key=e.group||groupKey(e.text);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}const ordered=shuffle([...groups.values()],seed);
    if(ordered.length<8)throw Error('Benchmark requer pelo menos 8 grupos por classe.');test.push(...ordered[0],...ordered[1]);validation.push(...ordered[2],...ordered[3]);train.push(...ordered[4],...ordered[5]);pool.push(...ordered.slice(6).flat());
  }
  validateSplits([...train.map(e=>({...e,split:'train'})),...pool.map(e=>({...e,split:'pool'})),...validation.map(e=>({...e,split:'validation'})),...test.map(e=>({...e,split:'test'}))]);return {train,validation,test,pool};
}
export async function activeBenchmark(corpus,{seeds=[11,42,73],budgets=[0,3,6],maxEpochs=60}={},progress=()=>{}){
  if(!Array.isArray(seeds)||!seeds.length||seeds.length>5||seeds.some(s=>!Number.isInteger(s))||!Array.isArray(budgets)||!budgets.length||budgets.length>6||budgets.some((b,i)=>!Number.isInteger(b)||b<0||b>100||i>0&&b<budgets[i-1]))throw Error('Sementes ou orçamentos inválidos.');integer(maxEpochs,1,180,'Épocas');
  const curves=[];for(const seed of seeds){const split=benchmarkPartition(corpus,seed),oracle=new Map(split.pool.map(e=>[e.id,e.label]));
    for(const strategy of ['margin','random']){let labeled=[...split.train],unlabeled=split.pool.map(({label,...e})=>({...e,split:'pool'})),revealed=[];
      for(const budget of budgets){
        while(revealed.length<budget){const samples=[...labeled,...split.validation],model=await train(samples,progress,{seed,maxEpochs,partition:{train:labeled.map(e=>e.id),validation:split.validation.map(e=>e.id)}});const chosen=selectExamples(model,unlabeled,{strategy,limit:Math.min(3,budget-revealed.length),seed:seed+revealed.length});if(!chosen.length)break;
          for(const {id} of chosen){const selected=unlabeled.find(e=>e.id===id);labeled.push({...selected,label:oracle.get(id)});revealed.push(id);}unlabeled=unlabeled.filter(e=>!chosen.some(c=>c.id===e.id));
        }
        const model=await train([...labeled,...split.validation],progress,{seed,maxEpochs,partition:{train:labeled.map(e=>e.id),validation:split.validation.map(e=>e.id)}});
        curves.push({seed,strategy,budget,revealed:[...revealed],labeled:labeled.length,testIds:split.test.map(e=>e.id),validationIds:split.validation.map(e=>e.id),initialIds:split.train.map(e=>e.id),metrics:evaluateClassifier(model,split.test),configuration:model.metadata.configuration});
        progress(`Aprendizado ativo: semente ${seed}, ${strategy}, orçamento ${budget}`);
      }
    }
  }return {schema:'nexo-active-benchmark-v1',created:new Date().toISOString(),seeds,budgets,maxEpochs,architecture:[corpus[0].vector.length,64,24],curves,selectionSeesLabels:false,note:'Rótulos do pool revelados somente após seleção. Corpus didático; nenhuma garantia de superar baseline aleatória.'};
}
