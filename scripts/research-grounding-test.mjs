import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const scratch=mkdtempSync(join(process.cwd(),'.research-test-'));
try{
 const path=join(scratch,'grounding.cjs');writeFileSync(path,ts.transpileModule(readFileSync(new URL('../lib/research-grounding.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
 const {numbersGrounded,explicitExternalDemand,discoveryFailure}=createRequire(import.meta.url)(path);
 assert.equal(numbersGrounded('Umsatz 2024: 5,2 Mio. Euro','Der Umsatz 2024 lag bei 5,2 Mio. Euro.'),true);
 assert.equal(numbersGrounded('Umsatz 2025: 5,2 Mio. Euro','Der Umsatz 2024 lag bei 5,2 Mio. Euro.'),false);
 assert.equal(numbersGrounded('Umsatz 2024: 52 Mio. Euro','Der Umsatz 2024 lag bei 5,2 Mio. Euro.'),false);
 assert.equal(explicitExternalDemand('Wir suchen einen IT-Administrator für die Zusammenarbeit mit externen Partnern.'),false);
 assert.equal(explicitExternalDemand('Wir suchen einen externen IT-Dienstleister für unsere laufende Betreuung.'),true);
 assert.equal(explicitExternalDemand('Externe IT-Betreuung gesucht. Wir erneuern unsere Infrastruktur.'),true);
 assert.equal(explicitExternalDemand('Wir suchen keine externen IT-Dienstleister.'),false);
 const valid={successfulSearches:4,discovered:10,verified:6,evaluatedPages:6,persistedCandidates:0,persistenceFailures:0};
 assert.equal(discoveryFailure(valid),null,'valid zero-candidate run succeeds without filling results');
 assert.equal(discoveryFailure({...valid,discovered:0,verified:0,evaluatedPages:0}),null,'valid zero search hits succeed');
 assert.match(discoveryFailure({...valid,successfulSearches:0}),/Suchanfrage/);
 assert.match(discoveryFailure({...valid,searchFailures:3}),/4 von 7/,'Partially failed searches must not appear fully completed');
 assert.match(discoveryFailure({...valid,unavailableSearches:1}),/Suchzugänge/);
 assert.match(discoveryFailure({...valid,deadlineReached:true}),/Zeitbudget/,'An exhausted budget is an incomplete run');
 assert.match(discoveryFailure({...valid,verified:0,evaluatedPages:0}),/Originalquelle/);
 assert.match(discoveryFailure({...valid,evaluatedPages:0}),/KI-Auswertung/);
 assert.match(discoveryFailure({...valid,persistenceFailures:2}),/gespeichert/);
 console.log('Research grounding: financial citations, external readiness and run failure states passed');
}finally{rmSync(scratch,{recursive:true,force:true})}
