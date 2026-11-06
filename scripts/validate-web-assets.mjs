import {createServer} from 'node:http';import {readFile,writeFile,readdir} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'dist'),prefix='/nested/nexo/';
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!path.startsWith(prefix))throw Error();const target=resolve(dist,path.slice(prefix.length)||'index.html');if(!target.startsWith(dist))throw Error();res.end(await readFile(target));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}${prefix}`,queue=[base],seen=new Set(),rows=[];
for(const file of await readdir(resolve(dist,'assets/fixtures/aurora-v3')))if(/\.(pdf|md|txt)$/.test(file))queue.push(base+'assets/fixtures/aurora-v3/'+file);
try{while(queue.length){const url=queue.shift();if(seen.has(url))continue;seen.add(url);const response=await fetch(url);assert.equal(response.status,200,url);const text=await response.text();rows.push({path:new URL(url).pathname+new URL(url).search,status:response.status});const extension=extname(new URL(url).pathname);
    if(!extension||['.js','.css','.html'].includes(extension)){
      const regex=extension==='.js'?/(?:^|\n)\s*import\s+[^;\n]*?\sfrom\s*["']([^"']+)|\b(?:import\s*\(|new URL\s*\()["']([^"']+)/g:extension==='.css'?/url\(["']?([^)'"\s]+)["']?\)/g:/(?:src=|href=)["']([^"']+)/g;
      for(const match of text.matchAll(regex)){const ref=match[1]||match[2];if(!ref||ref.startsWith('#')||ref.includes('${')||(extension==='.js'&&ref.endsWith('/'))||/^(https?:|data:|blob:)/.test(ref))continue;const target=new URL(ref,url);if(target.pathname.startsWith(prefix)&&!seen.has(target.href))queue.push(target.href);}
    }
  }
  const sessions=rows.filter(r=>r.path.includes('/profiles/session.js'));assert.equal(sessions.length,1,'All profile consumers must share one versioned session module');assert.ok(rows.some(r=>r.path.includes('/companion.css')));assert.ok(rows.some(r=>r.path.includes('/profiles/backup.js')));
  const report={created:new Date().toISOString(),classification:'HTTP asset and import smoke test; no browser layout/inference',prefix,resources:rows.length,rows};await writeFile(resolve(root,'reports/profiles-v4-http.json'),JSON.stringify(report,null,2)+'\n');console.log(`${rows.length} resources HTTP 200; one shared profile session module; nested path supported.`);
}finally{await new Promise(resolve=>server.close(resolve));}
