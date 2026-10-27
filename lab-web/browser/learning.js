// Small educational MLP: embeddings -> 64 ReLU -> 24 ReLU -> softmax.
export const cosine = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export function retrieve(memories,vector,limit=5){
  return memories.map(m=>({...m,score:cosine(m.vector,vector)})).filter(m=>m.score>=.4).sort((a,b)=>b.score-a.score).slice(0,limit);
}
export const publicMemory = ({vector,...m}) => m;
export function graph(memories){
  const nodes=memories.slice(-180).map(m=>({...publicMemory(m),x:0,y:0,z:0}));
  // Fixed random projection, distinct from the local Python PCA projection.
  for(const n of nodes){const v=memories.find(m=>m.id===n.id).vector;for(let axis=0;axis<3;axis++)n[['x','y','z'][axis]]=v.reduce((s,x,i)=>s+x*Math.sin((i+1)*(axis+7)*12.9898),0)*3;}
  const edges=[],seen=new Set();
  for(const n of nodes){const v=memories.find(m=>m.id===n.id).vector;
    for(const other of retrieve(memories.filter(m=>m.id!==n.id&&nodes.some(n=>n.id===m.id)),v,3)){
      const key=[n.id,other.id].sort((a,b)=>a-b).join(':');if(!seen.has(key)){seen.add(key);edges.push({source:n.id,target:other.id,score:other.score});}
    }
  }return {nodes:nodes.map(({x,y,z,...n})=>({...n,position:[x,y,z]})),edges,total:memories.length};
}
export function predict(model,vector){if(!model)return null;const p=forward(model,vector).at(-1);const k=p.indexOf(Math.max(...p));return {label:model.labels[k],confidence:p[k]};}
function forward(model,x){const values=[x];for(let l=0;l<3;l++){const layer=model.layers[l],prev=values.at(-1);let a=layer.b.map((b,j)=>b+prev.reduce((s,v,i)=>s+v*layer.w[i*layer.b.length+j],0));if(l<2)a=a.map(v=>Math.max(0,v));else{const max=Math.max(...a);a=a.map(v=>Math.exp(v-max));const sum=a.reduce((s,v)=>s+v,0);a=a.map(v=>v/sum);}values.push(a);}return values;}
export async function train(memories,progress=()=>{}){
  const start=performance.now(),labels=[...new Set(memories.map(m=>m.label).filter(Boolean))].sort();
  if(labels.length<2||labels.length>32||labels.some(l=>memories.filter(m=>m.label===l).length<3))throw Error('Use 2 a 32 categorias, cada uma com pelo menos 3 exemplos.');
  if(memories.filter(m=>m.label).length>2000)throw Error('Treine com até 2.000 exemplos rotulados.');
  let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const shuffle=arr=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
  const training=[],validation=[];
  for(const label of labels){const items=shuffle(memories.filter(m=>m.label===label));const count=Math.max(1,Math.floor(items.length*.2));validation.push(...items.slice(0,count));training.push(...items.slice(count));}
  const dims=[memories[0].vector.length,64,24,labels.length];
  const layers=dims.slice(1).map((out,l)=>({w:Array.from({length:dims[l]*out},()=> (random()*2-1)*Math.sqrt(6/dims[l])),b:Array(out).fill(0)}));
  const model={labels,layers};let best=null,bestLoss=Infinity,stale=0,step=0;const curve=[];
  const adam=layers.map(l=>({w:[l.w.map(()=>0),l.w.map(()=>0)],b:[l.b.map(()=>0),l.b.map(()=>0)]}));
  const measure=items=>{let loss=0,correct=0;for(const m of items){const p=forward(model,m.vector).at(-1),y=labels.indexOf(m.label);loss-=Math.log(Math.max(p[y],1e-8));correct+=Number(p.indexOf(Math.max(...p))===y);}return {loss:loss/items.length,accuracy:correct/items.length};};
  for(let epoch=1;epoch<=180;epoch++){
    shuffle(training);
    for(let offset=0;offset<training.length;offset+=16){
      const batch=training.slice(offset,offset+16),grads=layers.map(l=>({w:l.w.map(()=>0),b:l.b.map(()=>0)}));
      for(const m of batch){const values=forward(model,m.vector);let delta=values[3].slice();delta[labels.indexOf(m.label)]-=1;
        for(let l=2;l>=0;l--){const out=layers[l].b.length,prev=values[l],next=Array(prev.length).fill(0);
          for(let j=0;j<out;j++){grads[l].b[j]+=delta[j];for(let i=0;i<prev.length;i++){grads[l].w[i*out+j]+=prev[i]*delta[j];next[i]+=layers[l].w[i*out+j]*delta[j];}}
          delta=next.map((v,i)=>values[l][i]>0?v:0);
        }
      }
      step++;for(let l=0;l<3;l++)for(const key of ['w','b'])for(let i=0;i<layers[l][key].length;i++){
        const g=grads[l][key][i]/batch.length+(key==='w'?layers[l][key][i]*.0001:0),[m,v]=adam[l][key];m[i]=.9*m[i]+.1*g;v[i]=.999*v[i]+.001*g*g;
        layers[l][key][i]-=.003*(m[i]/(1-.9**step))/(Math.sqrt(v[i]/(1-.999**step))+1e-8);
      }
    }
    const t=measure(training),v=measure(validation);curve.push({epoch,loss:t.loss,validation_loss:v.loss});
    if(v.loss<bestLoss-1e-5){bestLoss=v.loss;best=structuredClone(layers);stale=0;}else stale++;
    if(epoch%5===0){progress(`Treinando: época ${epoch}/180`);await new Promise(r=>setTimeout(r,0));}
    if(stale>=30)break;
  }
  model.layers=best;const t=measure(training),v=measure(validation);
  model.metadata={labels,curve,train_accuracy:t.accuracy,validation_accuracy:v.accuracy,train_samples:training.length,validation_samples:validation.length,epochs:curve.length,parameters:layers.reduce((s,l)=>s+l.w.length+l.b.length,0),seconds:+((performance.now()-start)/1000).toFixed(2),trained_at:new Date().toISOString()};return model;
}
