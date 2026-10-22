import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const scratch=mkdtempSync(join(process.cwd(),'.research-test-'));
try{
 const path=join(scratch,'queries.cjs');
 writeFileSync(path,ts.transpileModule(readFileSync(new URL('../lib/research-queries.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
 const {baselineQueries,normalizeQuery,uniqueQueries}=createRequire(import.meta.url)(path);
 const cities=['München','Augsburg','Landsberg am Lech'];
 const skills=['jobs','tenders','migration','providers','growth','social','news'];
 const baseline=baselineQueries({cities,skills});
 assert.equal(baseline.length,24,'The default skill mix must cover eight focused searches per city');
 assert.ok(baseline.includes('München IT Administrator Aufbau'));
 assert.ok(baseline.includes('Augsburg IT Infrastruktur Modernisierung'));
 assert.ok(baseline.includes('"Landsberg am Lech" IT Ausschreibung'));
 assert.ok(baseline.includes('site:linkedin.com/posts München IT Unterstützung'));
 for(const query of baseline){
  assert.equal(normalizeQuery(query,cities),query);
  assert.ok(query.length<=160&&query.split(' ').length<=16);
  assert.ok((query.match(/"/g)||[]).length<=2);
  assert.equal(cities.filter(city=>query.includes(city)).length,1);
 }
 assert.deepEqual(baselineQueries({cities:['München'],skills:['tenders']}),['München IT Ausschreibung']);
 assert.deepEqual(baselineQueries({cities:['München'],skills:[]}),[]);
 assert.equal(baselineQueries({cities:['München',' münchen '],skills}).length,8,'Repeated city entries must not repeat baseline searches');

 assert.equal(normalizeQuery(' \tMünchen\u00a0 IT\n Aufbau  ',cities),'München IT Aufbau');
 assert.equal(normalizeQuery('Mu\u0308nchen IT Aufbau',cities),'München IT Aufbau');
 assert.equal(normalizeQuery('„Landsberg am Lech“ IT Ausschreibung',cities),'"Landsberg am Lech" IT Ausschreibung');
 assert.equal(normalizeQuery('Dachau IT Administrator Aufbau',cities),'Dachau IT Administrator Aufbau','Nearby places need not equal a configured city');
 assert.equal(normalizeQuery('Dachau IT Administrator Aufbau interner Infrastruktur gesucht',cities),'Dachau IT Administrator Aufbau interner Infrastruktur gesucht');
 assert.equal(normalizeQuery('München IT-Security',cities),'München IT-Security','A short place-and-signal query remains valid');
 assert.equal(normalizeQuery('Fürstenfeldbruck IT Generalist gesucht',cities),'Fürstenfeldbruck IT Generalist gesucht');
 assert.equal(normalizeQuery('München "Research and Development" IT',cities),'München "Research and Development" IT','A literal phrase does not contain Boolean operators');
 assert.equal(normalizeQuery('München intitle:"IT Aufbau"',cities),'München intitle:"IT Aufbau"');
 assert.equal(normalizeQuery('Augsburger Unternehmen München IT Aufbau',cities),'Augsburger Unternehmen München IT Aufbau','Do not match city names inside longer words');
 assert.equal(normalizeQuery('München IT Aufbau München',cities),'München IT Aufbau München','Repeating one city is not a multi-city query');
 assert.equal(normalizeQuery('"Landsberg am Lech" IT Aufbau',['Landsberg','Landsberg am Lech','München']),'"Landsberg am Lech" IT Aufbau','A compound place name is one location');
 assert.equal(normalizeQuery('München IT Aufbau',['München','Muenchen','Augsburg']),'München IT Aufbau','Configured spelling aliases describe one city');

 for(const value of [
  null,undefined,42,{},'', '   ', '""',
  'München','MUENCHEN','"München"','Dachau','IT',
  'Landsberg am Lech','"Landsberg am Lech"',' landsberg AM lech ','„Landsberg am Lech“',
  'München OR Augsburg IT','München or Cloud IT','München AND Cloud IT','München and Cloud IT',
  'München (IT Aufbau)','München | Augsburg IT','München && Cloud IT',
  'München "IT Aufbau','München IT Aufbau"','München "IT" "Aufbau"','München " " IT',
  'München"IT Aufbau"','München "IT Aufbau"Cloud','München site:',
  'München Augsburg IT Aufbau','MUENCHEN Augsburg IT Aufbau','Munchen Augsburg IT Aufbau',
  'München "Landsberg am Lech" IT Aufbau','Landsberg am Lech Augsburg IT Aufbau',
  'München IT\u200b Aufbau','München IT\u0000 Aufbau',
 ])assert.equal(normalizeQuery(value,cities),null,`Invalid query must be rejected: ${JSON.stringify(value)}`);
 assert.equal(normalizeQuery('Dachau '+Array(16).fill('IT').join(' '),cities),null,'A seventeenth word is not silently truncated');
 const maxWords='Dachau '+Array(15).fill('IT').join(' ');
 assert.equal(normalizeQuery(maxWords,cities),maxWords,'Sixteen words are allowed');
 const maxChars='Dachau IT '+ 'x'.repeat(150);
 assert.equal(maxChars.length,160);
 assert.equal(normalizeQuery(maxChars,cities),maxChars,'The length boundary must preserve the complete query');
 assert.equal(normalizeQuery(maxChars+'x',cities),null,'Long queries are rejected rather than cut in the middle');

 const seen=new Set();
 assert.deepEqual(uniqueQueries([' München IT Aufbau ','MÜNCHEN\u202fIT Aufbau','Mu\u0308nchen IT Aufbau','München OR Augsburg IT'],cities,seen),['München IT Aufbau']);
 assert.equal(seen.size,1,'Invalid and duplicate inputs must not consume new keys');
 assert.deepEqual(uniqueQueries(['münchen IT Aufbau','Dachau IT Aufbau','Dachau\tIT Aufbau','Augsburg IT Aufbau'],cities,seen),['Dachau IT Aufbau','Augsburg IT Aufbau']);
 assert.equal(seen.size,3,'Queries must be deduplicated across rounds');
 assert.deepEqual(uniqueQueries(['München Straße IT','MÜNCHEN STRASSE IT'],cities),['München Straße IT'],'German case folding must include sharp s');
 assert.deepEqual(uniqueQueries(['Ｍünchen IT Aufbau','München IT Aufbau'],cities),['München IT Aufbau'],'Compatibility Unicode forms must share one key');
 console.log('Research queries: focused baselines, complete expressions, Unicode city matching and deduplication across rounds passed');
}finally{rmSync(scratch,{recursive:true,force:true})}
