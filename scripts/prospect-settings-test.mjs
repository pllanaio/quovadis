import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {testLoader} from './ts-test-loader.mjs';
const folder=mkdtempSync(join(tmpdir(),'qv-settings-')),previous=process.env.SETTINGS_KEY_FILE;process.env.SETTINGS_KEY_FILE=join(folder,'key');let stored={discoveryVersion:3,skills:['business','news'],scoutWeights:{external:25,business:30,projects:20,growth:15,hiring:10}};
const settings=testLoader({'./db':{init:async()=>{},db:()=>({query:async(sql,args)=>{if(sql.startsWith('SELECT'))return {rows:[{config:structuredClone(stored)}]};if(sql.startsWith('INSERT INTO app_settings'))stored=args[0];return {rows:[]}}})}})('lib/settings.ts');
try{
 const migrated=await settings.getSettings();assert.ok(migrated.skills.includes('jobs'));assert.equal(migrated.socialResearchMode,'public');assert.equal(migrated.socialBrowserEnabled,true);assert.equal(migrated.scoutWeights.hiring,25);assert.equal(migrated.targetEmployeesMin,50);assert.equal(migrated.targetEmployeesMax,500);
 const saved=await settings.saveSettings({...migrated,socialResearchMode:'browser',googlePagespeedKey:'fixture-google',socialConnections:[{platform:'instagram',username:'fixture-user',password:'fixture-password'}]});
 assert.equal(saved.socialResearchMode,'browser');assert.equal(saved.googlePagespeedKey,'');assert.equal(saved.googlePagespeedKeySet,true);assert.equal(saved.socialConnections[0].password,'');assert.equal(saved.socialConnections[0].passwordSet,true);assert.equal(saved.socialConnections[0].username,'fixture-user');assert.match(stored.socialConnections[0].username,/^enc:/);assert.match(stored.socialConnections[0].password,/^enc:/);assert.match(stored.googlePagespeedKey,/^enc:/);
 assert.equal((await settings.getSettings()).socialConnections[0].password,'fixture-password');
 const optOut=await settings.saveSettings({...saved,skills:['business'],socialConnections:[{platform:'instagram',username:'fixture-user',password:''}]});assert.equal((await settings.getSettings()).skills.includes('jobs'),false,'An explicit later opt-out remains configurable');assert.equal((await settings.getSettings()).socialConnections[0].password,'fixture-password','Blank key fields preserve credentials');
 await assert.rejects(()=>settings.saveSettings({...optOut,targetEmployeesMin:500,targetEmployeesMax:50}),/Mitarbeiterbereich/);
 await settings.saveSettings({...optOut,socialResearchMode:'public',clearGooglePagespeedKey:true,socialConnections:[{platform:'instagram',username:'',password:'',clearPassword:true}]});assert.equal((await settings.getSettings()).socialResearchMode,'public');assert.equal((await settings.getSettings()).googlePagespeedKey,'');assert.equal((await settings.getSettings()).socialConnections[0].password,'');
 console.log('Prospect settings: 50–500 target, one-time hiring migration, editable opt-out, encrypted username/password/Google key, public redaction, preservation, deletion and range validation passed');
}finally{if(previous===undefined)delete process.env.SETTINGS_KEY_FILE;else process.env.SETTINGS_KEY_FILE=previous;rmSync(folder,{recursive:true,force:true})}
