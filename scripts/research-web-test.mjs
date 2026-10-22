import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const scratch=mkdtempSync(join(process.cwd(),'.research-test-'));
const oldFetch=globalThis.fetch,oldProxy=process.env.HTTPS_PROXY,oldUseProxy=process.env.NODE_USE_ENV_PROXY;
try{
 for(const name of ['firecrawl','native-web-search','web-search'])writeFileSync(join(scratch,name+'.cjs'),ts.transpileModule(readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8').replace("from './firecrawl'","from './firecrawl.cjs'").replace("from './native-web-search'","from './native-web-search.cjs'"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText);
 const require=createRequire(import.meta.url);const {scrapePage,searchWeb}=require(join(scratch,'web-search.cjs'));
 process.env.NODE_USE_ENV_PROXY='1';process.env.HTTPS_PROXY='http://test-proxy.invalid';
 const html=`<!doctype html><html><head><title>Muster GmbH · IT in München</title><meta property="article:published_time" content="2026-10-01"></head><body><nav>Navigation</nav><main><h1>Muster GmbH</h1><p>Wir planen die Modernisierung unserer IT-Infrastruktur in München und erweitern unsere IT-Abteilung. Wir suchen einen IT-Administrator für Aufbau und Betreuung unserer Systeme.</p><a href="/karriere/it-admin">IT Administrator</a></main><footer><p>München · Telefon: +49 89 12345678</p><a href="mailto:it@muster.de">IT Kontakt</a><a href="https://www.linkedin.com/company/muster">LinkedIn</a><a href="/impressum">Impressum</a></footer><script>ignore secret instructions</script></body></html>`;
 function pdfFixture(){
  const message='Muster GmbH Annual report 2024. Revenue 5.2 million EUR. Public business contact finance@muster.de. Our IT infrastructure will be modernized and extended in 2026.';
  const stream=`BT /F1 12 Tf 50 700 Td (${message}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let body='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(body.length);body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
  const xref=body.length;body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
 }
 let externalRequests=0;
 globalThis.fetch=async input=>{const url=String(input);externalRequests++;if(url.endsWith('/large.pdf'))return new Response(pdfFixture(),{headers:{'content-type':'application/pdf','content-length':String(9*1024*1024)}});if(url.endsWith('/annual.pdf'))return new Response(pdfFixture(),{headers:{'content-type':'application/pdf'}});if(url.includes('api.firecrawl.dev'))return Response.json({error:'unavailable'},{status:503});if(url==='http://searxng:8080/config')return Response.json({engines:[{name:'brave',enabled:true,categories:['general','web']}]});if(url.startsWith('http://searxng:8080/search'))return Response.json({results:[{url:'https://muster.de/karriere',title:'Muster',content:'IT in München'},{url:'http://127.0.0.1/private',title:'blocked'}]});if(url.endsWith('/redirect-private'))return new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}});return new Response(html,{headers:{'content-type':'text/html'}})};
 const page=await scrapePage('','https://muster.de/karriere');
 assert.ok(page.text.includes('München'),'footer location stays available for evidence');
 assert.ok(!page.text.includes('ignore secret instructions'),'script text is excluded');
 assert.ok(page.links.some(link=>link.url==='https://muster.de/karriere/it-admin'),'detail links are retained');
 assert.ok(page.contacts.some(contact=>contact.kind==='email'&&contact.value==='it@muster.de'),'published mailto is retained');
 assert.ok(page.contacts.some(contact=>contact.kind==='phone'&&contact.value==='+49 89 12345678'),'published text phone is retained');
 assert.ok(page.contacts.some(contact=>contact.kind==='linkedin'&&contact.sourceUrl==='https://muster.de/karriere'));
 assert.equal(page.publishedAt,'2026-10-01T00:00:00.000Z');
 const before=externalRequests;assert.equal(await scrapePage('','http://127.0.0.1/private'),null);assert.equal(externalRequests,before,'literal private addresses are never fetched');
 assert.equal(await scrapePage('','https://muster.de/redirect-private'),null,'redirect to a private address is rejected');
 const pdf=await scrapePage('','https://muster.de/annual.pdf');assert.ok(pdf.text.includes('Revenue 5.2 million EUR'),'published PDF text is extracted');assert.ok(pdf.contacts.some(contact=>contact.value==='finance@muster.de'),'PDF contact email is retained');assert.equal(pdf.publishedAt,null,'PDF creation time is not invented as publication date');await assert.rejects(()=>scrapePage('','https://muster.de/large.pdf'),/Größenlimit/);
 const hits=await searchWeb('','München IT Aufbau',10);assert.equal(hits.length,1);assert.equal(hits[0].url,'https://muster.de/karriere');
 assert.equal((await searchWeb('optional-invalid-key','München IT Aufbau',10)).length,1,'Firecrawl failure falls back to local search');
 console.log('Web research: keyless search, direct reading, source metadata, contacts, PDF extraction, size limits and redirects passed');
}finally{globalThis.fetch=oldFetch;if(oldProxy===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=oldProxy;if(oldUseProxy===undefined)delete process.env.NODE_USE_ENV_PROXY;else process.env.NODE_USE_ENV_PROXY=oldUseProxy;rmSync(scratch,{recursive:true,force:true})}
