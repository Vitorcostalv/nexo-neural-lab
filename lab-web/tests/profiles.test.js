import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActivityState} from '../activity-state.js';
import {displayName} from '../profiles/manager.js';
import {parseCsv,csvMemories,validateBackup,mergeData} from '../profiles/backup.js';
import {exportCsv,hash,EMBEDDING} from '../lab/contracts.js';

const data=()=>({legacy:{memories:[],messages:[],experiments:[],nextId:1},research:{catalog:[],indices:[],files:[],results:[],active:[]}});
const pack=async d=>{const manifest={format:'nexo-profile',version:1,profile:{id:'profile',name:'João'},embedding:EMBEDDING,counts:{memories:0,pendingMemories:0,messages:0,experiments:0,evaluations:0,documents:0,versions:0,chunks:0,annotations:0,catalog:0,indices:0,files:0,results:0,active:0}};return {manifest,data:d,integrity:await hash({manifest,data:d})};};
test('display names do not become identifiers and reject empty/control input',()=>{assert.equal(displayName('  João da Conceição  '),'João da Conceição');for(const name of ['', '  ','a'.repeat(49),'Nome\n'])assert.throws(()=>displayName(name));});
test('CSV round-trips Portuguese, commas, quotes and multiline text with formula protection',()=>{
  const text='São Paulo, João disse "olá".\nAmanhã: ação e conexão.',csv=exportCsv([{text,label:'português'},{text:'=HYPERLINK("x")',label:'@risco'}]),rows=parseCsv(csv);
  assert.deepEqual(csvMemories(rows,0,1),[{text,label:'português'},{text:'\'=HYPERLINK("x")',label:"'@risco"}]);
  for(const invalid of ['text\n"sem fim','a,b\n1','a\n"x"f','a\n'+Array(102).fill('x').join('\n')])assert.throws(()=>parseCsv(invalid));
});
test('backup validation rejects corruption, future versions and relational errors before writes',async()=>{
  const original=await pack(data());assert.equal((await validateBackup(JSON.stringify(original))).manifest.profile.name,'João');
  const damaged=structuredClone(original);damaged.manifest.profile.name='Outra pessoa';await assert.rejects(()=>validateBackup(JSON.stringify(damaged)),/SHA/);
  const future=structuredClone(original);future.manifest.version=100;future.integrity=await hash({manifest:future.manifest,data:future.data});await assert.rejects(()=>validateBackup(JSON.stringify(future)),/versão/);
  const bad=data();bad.research.catalog=[{key:'current',value:{schema:3,documents:[],versions:[{id:'V1',documentId:'missing'}],indices:[]}}];const relational=await pack(bad);await assert.rejects(()=>validateBackup(JSON.stringify(relational)),/referência/);
  await assert.rejects(()=>validateBackup('{"__proto__":{"unsafe":true}}'),/proibidas/);
});
test('merge deduplicates stable IDs and rejects divergent records without mutating inputs',()=>{
  const a=data();a.legacy.messages=[{id:'m1',role:'user',text:'Olá'}];const b=structuredClone(a),before=JSON.stringify(a);assert.equal(mergeData(a,b).legacy.messages.length,1);b.legacy.messages[0].text='Diferente';assert.throws(()=>mergeData(a,b),/Conflito/);assert.equal(JSON.stringify(a),before);
});
test('activity states require a live operation token; late callbacks cannot revive cancelled work',()=>{
  const state=new ActivityState(),events=[];state.subscribe(e=>events.push({...e}));assert.equal(state.current.state,'idle');assert.equal(state.set(0,'training','fake'),false);
  const first=state.begin();state.set(first,'loading','download',.45);assert.equal(state.current.progress,.45);state.set(first,'retrieving','busca');state.set(first,'responding','delta');state.finish(first,'cancelled','Cancelado');assert.equal(state.current.active,false);assert.equal(state.set(first,'responding','late'),false);
  const second=state.begin();assert.equal(state.set(first,'saving','wrong profile'),false);state.set(second,'saving','commit');state.finish(second);clearTimeout(state.timer);assert.equal(state.current.state,'done');assert.ok(events.some(e=>e.state==='loading'));
});
