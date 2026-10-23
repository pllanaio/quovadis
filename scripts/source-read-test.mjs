import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
const original=fetch,oldProxy=process.env.HTTPS_PROXY,oldUse=process.env.NODE_USE_ENV_PROXY;
process.env.NODE_USE_ENV_PROXY='1';process.env.HTTPS_PROXY='http://fixture-proxy.invalid';
const {scrapePage}=testLoader()('lib/web-search.ts');
const html='<html><title>Muster GmbH</title><body>'+('Muster GmbH eröffnet einen neuen Standort in München. '.repeat(5))+'</body></html>';
try{
 let count=0;globalThis.fetch=async()=>{count++;if(count===1)throw new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});return new Response(html,{headers:{'content-type':'text/html'}})};
 assert.ok(await scrapePage('','https://fixture.example.org'));assert.equal(count,2,'Transient network failure is retried once');
 count=0;globalThis.fetch=async()=>{count++;throw new TypeError('fetch failed',{cause:{code:'CERT_HAS_EXPIRED'}})};
 await assert.rejects(()=>scrapePage('','https://fixture.example.org'),/TLS-Zertifikat/);assert.equal(count,1,'Certificate errors never disable TLS or trigger unsafe fallback');
 count=0;globalThis.fetch=async()=>{count++;return new Response('',{status:503})};
 await assert.rejects(()=>scrapePage('','https://fixture.example.org'),/HTTP 503/);assert.equal(count,2);
 count=0;globalThis.fetch=async()=>{count++;return new Response('',{status:429,headers:{'retry-after':'600'}})};
 await assert.rejects(()=>scrapePage('','https://fixture.example.org'),/HTTP 429/);assert.equal(count,1,'Long provider backoff is respected');
 globalThis.fetch=async()=>new Response('',{status:403});await assert.rejects(()=>scrapePage('','https://fixture.example.org'),/Zugriff nicht öffentlich/);
 const signal=AbortSignal.abort();count=0;globalThis.fetch=async()=>{count++;return new Response(html)};await assert.rejects(()=>scrapePage('','https://fixture.example.org',signal));assert.equal(count,0,'Cancelled deep dives issue no new page requests');
 console.log('Original pages: bounded retries, HTTP diagnostics, TLS verification, Retry-After and deep-dive cancellation passed');
}finally{globalThis.fetch=original;if(oldProxy===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=oldProxy;if(oldUse===undefined)delete process.env.NODE_USE_ENV_PROXY;else process.env.NODE_USE_ENV_PROXY=oldUse}
