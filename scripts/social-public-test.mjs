import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
const profile='https://www.instagram.com/acme/',post='https://www.instagram.com/p/real/',text='Unsere neue Produktserie wird vorgestellt. '.repeat(8);
let direct=new Map(),reachCalls=0,reachResult={ok:true,backend:'jina',items:[]};
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'http://agent-reach:3012');assert.equal(options.headers['x-worker-key'],'fixture-key');const body=JSON.parse(options.body);assert.equal(body.action,'read');assert.equal('password' in body,false);reachCalls++;return Response.json(reachResult)};
 const {capturePublicSocial,socialPostUrl}=testLoader({'./web-search':{scrapePage:async(_,url,_signal,options)=>{assert.equal(options.singleAttempt,true);const page=direct.get(url);if(page instanceof Error)throw page;return page||null}},'node:fs':{readFileSync:()=> 'fixture-key'}})('lib/social-capture.ts');
 assert.equal(socialPostUrl(profile,profile),null);assert.equal(socialPostUrl('https://evil.example/p/1',profile),null);assert.equal(socialPostUrl(post+'?tracking=1',profile),post);
 direct=new Map([[profile,{url:profile,text,links:[{url:post}]}],[post,{url:post,text:'Unser Service kostet 199 EUR. '+text,publishedAt:null}]]);
 let result=await capturePublicSocial(profile);assert.equal(reachCalls,0,'Directly readable original pages need no Reach request');assert.equal(result.posts.length,1);assert.equal(result.profileObservations.length,1);assert.equal(result.posts[0].publishedAt,null);
 direct.clear();reachResult={ok:true,backend:'jina',items:[{url:profile,text,published_at:null}]};result=await capturePublicSocial(profile);assert.equal(reachCalls,1);assert.equal(result.posts.length,0,'A profile description is not a post');assert.equal(result.profileObservations[0].sourceUrl,profile);assert.match(result.provider,/Agent-Reach/);
 reachResult={ok:false,error:{code:'RATE_LIMITED',message:'Quota reached'},items:[]};await assert.rejects(capturePublicSocial(profile),error=>error.code==='SOCIAL_ACCESS'&&error.reachCode==='RATE_LIMITED');assert.equal(reachCalls,2,'No retry/backend switching on rate limit');
 direct.set(profile,{url:profile,text:'Log in to continue',links:[]});await assert.rejects(capturePublicSocial(profile),error=>error.code==='SOCIAL_ACCESS');assert.equal(reachCalls,2,'A login wall is not retried through another reader');
 direct.set(profile,Object.assign(Error('HTTP 429'),{code:'http_429'}));await assert.rejects(capturePublicSocial(profile),error=>error.code==='SOCIAL_ACCESS');assert.equal(reachCalls,2,'Original HTTP rate limits never trigger a fallback');
 direct.clear();reachResult={ok:true,backend:'jina',items:[{url:profile,text:'Just a moment...\nSecurity verification',published_at:null}]};await assert.rejects(capturePublicSocial(profile),error=>error.code==='SOCIAL_ACCESS');
 console.log('Public social research: original-first, Reach fallback without credentials, sourced profile/post separation, unknown dates, no retries on login/rate limits passed');
}finally{globalThis.fetch=originalFetch}
