import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes,timingSafeEqual} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const directory=mkdtempSync(join(tmpdir(),'qv-browser-'));writeFileSync(directory+'/settings.key',randomBytes(32));writeFileSync(directory+'/worker.key','fixture-worker-token');
let url='about:blank',routeHandler,closed=false;const fills=[];
const field={first(){return this},filter(){return this},nth(){return this},isVisible:async()=>true,fill:async value=>fills.push(value),press:async()=>{url='https://www.instagram.com/fixture-profile/'},evaluateAll:async()=>[]};
const page={setDefaultTimeout(){},goto:async value=>{url=value},url:()=>url,locator:()=>field,waitForTimeout:async()=>{},screenshot:async()=>Buffer.from('fixture screenshot'),mouse:{click:async()=>{},wheel:async()=>{}}};
const context={route:async(_pattern,handler)=>{routeHandler=handler},newPage:async()=>page,storageState:async()=>({cookies:[{name:'sessionid',value:'fixture-secret-cookie'}],origins:[]}),close:async()=>{closed=true}};
const source=readFileSync(new URL('../browser/server.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
try{
 const api=runInNewContext(source+'\n;({execute,publicUrl,profileUrl,saveState,loadState})',{process:{env:{BROWSER_DATA_DIR:directory,APP_DATA_DIR:directory}},URL,Buffer,JSON,Promise,Map,Number,Error,Date,readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,createCipheriv,createDecipheriv,randomBytes,timingSafeEqual,lookup:async host=>[{address:host==='private.example.org'?'127.0.0.1':'93.184.216.34'}],chromium:{launch:async()=>({newContext:async()=>context})},createServer:()=>({listen(){}})});
 await assert.rejects(()=>api.publicUrl('https://private.example.org/'));await assert.rejects(()=>api.publicUrl('http://www.instagram.com/'));assert.throws(()=>api.profileUrl('instagram','https://evil.example.org/'));
 const state=await api.execute('instagram',{action:'connect',username:'fixture-user',password:'fixture-password'});assert.equal(state.status,'session_saved');assert.equal(fills.length,2);assert.ok(existsSync(directory+'/instagram.enc'));const bytes=readFileSync(directory+'/instagram.enc');assert.equal(bytes.includes(Buffer.from('fixture-secret-cookie')),false,'Cookies are not persisted as plaintext');assert.equal(api.loadState('instagram').cookies[0].value,'fixture-secret-cookie');
 let aborted=false;await routeHandler({request:()=>({url:()=> 'https://private.example.org/'}),continue:async()=>{throw Error('Must not continue private request')},abort:async()=>{aborted=true}});assert.equal(aborted,true);
 await api.execute('instagram',{action:'logout'});assert.equal(existsSync(directory+'/instagram.enc'),false);assert.equal(closed,true);
 console.log('Browser sessions: platform URL restriction, private request rejection, credential fill boundary, encrypted cookie roundtrip, session reuse data and explicit logout passed');
}finally{rmSync(directory,{recursive:true,force:true})}
