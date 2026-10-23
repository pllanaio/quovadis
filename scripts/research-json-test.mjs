import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
const {parseDiscoveryRows:parse}=testLoader()('lib/research-json.ts');
const lead={name:'Muster',city:'München',sourceUrl:'https://example.org',evidenceQuote:'Ein belegter Anlass.',intelligence:{hypotheses:['Text mit [Klammern] und "Zitaten"']}};
for(const value of [JSON.stringify([lead]),JSON.stringify({opportunities:[lead]}),'```json\n'+JSON.stringify({leads:[lead]})+'\n```','Ergebnis:\n'+JSON.stringify({companies:[lead]})+'\nEnde.',JSON.stringify(lead)])assert.deepEqual(parse(value),[lead]);
assert.deepEqual(parse('{"opportunities":[]}'),[]);
for(const value of ['', 'Keine Treffer.', '{"error":"upstream"}', '{"opportunities":[{"name":"abgeschnitten","hypotheses":[]}', '{"summary":"keine Firmenliste","hypotheses":[]}', '[null]', '{"opportunities":[],"leads":[]}'])assert.throws(()=>parse(value));
console.log('Discovery JSON: arrays, wrappers, fenced/prose JSON, single records, empty results, truncation and nested-array rejection passed');
