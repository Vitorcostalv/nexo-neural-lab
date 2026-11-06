import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FIXTURE_DOCUMENTS} from '../lab-web/lab/fixture-corpus.js';
const root=resolve(import.meta.dirname,'../lab-web/fixtures/aurora-v3');await mkdir(root,{recursive:true});
// Small reproducible text PDF: base fonts, no actions, JavaScript, annotations or attachments.
function pdf(pages){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];const kids=[];
  for(const text of pages){const page=objects.length+1,stream=page+1;kids.push(`${page} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${stream} 0 R >>`);
    const wrapped=text.split('\n').flatMap(line=>line.match(/.{1,76}(?:\s|$)|\S{1,76}/g)||['']);
    const content='0.08 0.20 0.15 rg\nBT /F1 11 Tf 46 780 Td 20 TL\n'+wrapped.map(line=>'('+line.trim().replace(/[\\()]/g,c=>'\\'+c)+') Tj T*').join('\n')+'\nET';objects.push(`<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}\nendstream`);
  }objects[1]=`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
  let out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(out,'latin1'));out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(out,'latin1');out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out,'latin1');
}
for(const document of FIXTURE_DOCUMENTS)await writeFile(resolve(root,document.file),document.pages?pdf(document.pages):document.text,'utf8');
await writeFile(resolve(root,'sem-texto.pdf'),pdf(['']));
await writeFile(resolve(root,'README.txt'),'Corpus ficticio aurora-v3. operacao.pdf: duas paginas de texto; sem-texto.pdf: sem texto extraivel, para testar o aviso de OCR. Nenhuma informacao pessoal real. Gerado por scripts/create-research-fixtures.mjs.\n');
console.log('Fixtures:',root);
