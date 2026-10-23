import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
const original=fetch,calls=[];let mode='truncated';
const database={query:async()=>({rows:[],rowCount:1})};
const subject=testLoader({'./db':{db:()=>database,init:async()=>{}}})('lib/research.ts');
const quote='Die Muster GmbH eröffnet einen neuen Standort in München.';
const row={name:'Muster GmbH',city:'München',signal:'Neuer Standort eröffnet',signalType:'business',sourceUrl:'https://muster.example.org/news',evidenceQuote:quote};
const settings={provider:'openai',model:'gpt-6-sol',openaiKey:'fixture-secret',anthropicKey:'',reasoningLevel:'high',skills:['business'],searchPrompt:'Finde belegte Unternehmensereignisse.',cities:['München'],radiusKm:40,serviceOffer:'IT-Planung',hourlyRate:100};
const page={url:row.sourceUrl,text:quote,title:'Originalbeleg',links:[],publishedAt:null,checkedAt:new Date().toISOString()};
globalThis.fetch=async(_url,options)=>{
 const body=JSON.parse(options.body);calls.push(body);assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(body.model,settings.model);assert.match(body.messages[0].content,/kein Ausschlussgrund/);assert.match(body.messages[0].content,/Klein- und Kleinstunternehmen/);
 if(mode==='refusal')return Response.json({choices:[{message:{refusal:'Refused'},finish_reason:'stop'}]});
 if(mode==='invalid')return Response.json({choices:[{message:{content:'Kein JSON.'},finish_reason:'stop'}]});
 if(calls.length===1)return Response.json({usage:{prompt_tokens:100,completion_tokens:6000},choices:[{message:{content:''},finish_reason:'length'}]});
 return Response.json({usage:{prompt_tokens:100,completion_tokens:200},choices:[{message:{content:JSON.stringify({opportunities:[row]})},finish_reason:'stop'}]});
};
try{
 const found=await subject.extractPages(settings,[page]);assert.equal(found.length,1,'Company without phone, email, website or headcount is accepted');assert.equal(found[0].companyUrl,undefined);assert.equal(calls.length,2);assert.ok(calls[1].max_completion_tokens>calls[0].max_completion_tokens,'Truncation gets one larger output budget');
 calls.length=0;mode='invalid';await assert.rejects(()=>subject.extractPages(settings,[page]),/Wiederholungsversuch/);assert.equal(calls.length,2,'Malformed output is retried at most once');
 calls.length=0;mode='refusal';await assert.rejects(()=>subject.extractPages(settings,[page]),/abgelehnt/);assert.equal(calls.length,1,'Refusal is not retried');
 assert.equal(subject.publicContactScore(10,[]),0,'No invented contact points');
 assert.equal(subject.publicContactScore(10,[{kind:'website'}]),4);
 assert.equal(subject.publicContactScore(10,[{kind:'linkedin'}]),4);
 assert.equal(subject.publicContactScore(10,[{kind:'email'}]),7);
 assert.equal(subject.publicContactScore(10,[{kind:'email'},{kind:'phone'}]),10);
 assert.equal(subject.publicContactScore(2,[{kind:'email'}]),2,'Grounded score is capped, never inflated');
 console.log('Model output: requested JSON object, unchanged model/reasoning, truncation recovery, one retry limit and refusal handling passed');
}finally{globalThis.fetch=original}
