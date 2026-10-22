import assert from 'node:assert/strict';
import {hasEvidenceQuote,companyNameMentioned,locationMentioned,classifyEvidencePriority,validateEvidenceCandidate} from '../lib/research-evidence.ts';

const source={kind:'website',url:'https://jobs.example.com/it-stelle'};
const quote='Planung und Modernisierung unserer IT-Infrastruktur';
const text=`Mueller & Soehne GmbH & Co. KG – Muenchen. Wir suchen Verstärkung für die ${quote}.`;
const candidate={name:'Müller und Söhne GmbH & Co KG',city:'München',signal:'IT-Infrastruktur erneuern',signalType:'jobs',priority:'A',summary:'Belegte Modernisierung.',sourceUrl:source.url,evidenceQuote:quote,score:78,companyUrl:'https://jobs.example.com'};

assert.equal(hasEvidenceQuote('IT-Modernisierung\n mit Azure und\u00a0Microsoft 365','IT-Modernisierung mit Azure und Microsoft 365'),true);
assert.equal(hasEvidenceQuote('Modernisierung unserer IT-Infrastruktur','Erneuerung unserer IT-Infrastruktur'),false,'a paraphrase is not a literal quote');
assert.equal(companyNameMentioned(text,candidate.name),true,'legal suffix punctuation and German transliterations match');
assert.equal(companyNameMentioned('ACMEIT GmbH','ACME'),false,'company substrings do not establish identity');
assert.equal(locationMentioned('Our office in Munich','München'),true);
assert.equal(locationMentioned('Standort Landsberg a. Lech','Landsberg am Lech'),true);
assert.equal(locationMentioned('Wir sind in Augsburg tätig','München'),false);
assert.equal(locationMentioned('Augsburger Unternehmen','Augsburg'),false,'adjectival or substring matches do not establish a location');

const accepted=validateEvidenceCandidate(candidate,source,text,['jobs']);
assert.equal(accepted.length,1);
assert.equal(accepted[0].priority,'B','a job with a concrete modernization project is priority B');
assert.equal(accepted[0].companyUrl,undefined,'jobs subdomains are not inferred as company websites');
assert.equal(classifyEvidencePriority('Verantwortung für den Aufbau unserer IT-Abteilung','jobs'),'A');
assert.equal(classifyEvidencePriority('Wir suchen unseren ersten IT-Administrator','jobs'),'A');
assert.equal(classifyEvidencePriority('Wir suchen einen IT-Generalisten für den Standort','jobs'),'A');
assert.equal(classifyEvidencePriority('Wir suchen einen IT-Administrator für unser bestehendes Team','jobs'),'C');
assert.equal(classifyEvidencePriority('Zusammenarbeit mit externen IT-Dienstleistern','jobs'),'C','mentioning an existing supplier is not a new procurement request');
assert.equal(classifyEvidencePriority('Wir suchen einen externen IT-Dienstleister für unsere IT-Betreuung','providers'),'A');
assert.equal(classifyEvidencePriority('Digitalisierung und Erweiterung der Netzwerkinfrastruktur','news'),'B');

assert.equal(validateEvidenceCandidate({...candidate,city:'Hamburg'},source,text,['jobs']).length,0,'invented location is rejected');
assert.equal(validateEvidenceCandidate({...candidate,evidenceQuote:'Wir bauen unsere IT erstmals auf'},source,text,['jobs']).length,0,'invented signal quote is rejected');
assert.equal(validateEvidenceCandidate({...candidate,sourceUrl:'https://other.example.com'},source,text,['jobs']).length,0,'a different URL cannot cite this page');
assert.equal(validateEvidenceCandidate(candidate,source,text,['tenders']).length,0,'disabled signal types are rejected');
const farApart='Mueller & Soehne in Muenchen. '+('Anderer redaktioneller Inhalt. '.repeat(180))+quote;
assert.equal(validateEvidenceCandidate(candidate,source,farApart,['jobs']).length,0,'a distant company name is not attributed to another listing quote');
for(const host of ['www.stepstone.de','www.linkedin.com','www.northdata.de']){
 const url=`https://${host}/company`;
 const result=validateEvidenceCandidate({...candidate,sourceUrl:url,companyUrl:`https://${host}`},{kind:'website',url},text,['jobs']);
 assert.equal(result.length,1);
 assert.equal(result[0].companyUrl,undefined);
}
const newsSource={kind:'website',url:'https://www.regionalzeitung.de/wirtschaft/it-projekt'};
const newsLead={...candidate,sourceUrl:newsSource.url,companyUrl:'https://www.regionalzeitung.de'};
assert.equal(validateEvidenceCandidate(newsLead,newsSource,text+' https://www.regionalzeitung.de/',['jobs'])[0].companyUrl,undefined,'publisher domain and its navigation links are not a company website');
const officialSource={kind:'website',url:'https://www.mueller-soehne.de/karriere/it'};
assert.equal(validateEvidenceCandidate({...candidate,sourceUrl:officialSource.url,companyUrl:'https://www.mueller-soehne.de'},officialSource,text,['jobs'])[0].companyUrl,'https://www.mueller-soehne.de','matching company domain remains usable');
assert.equal(validateEvidenceCandidate({...newsLead,companyUrl:'https://www.mueller-soehne.de'},newsSource,text+' Firmenwebsite: https://www.mueller-soehne.de/kontakt',['jobs'])[0].companyUrl,'https://www.mueller-soehne.de','explicitly linked employer website is accepted');
assert.equal(validateEvidenceCandidate({...newsLead,companyUrl:'https://www.mueller-soehne.de'},newsSource,text+' https://www.mueller-soehne.de.evil.example/',['jobs'])[0].companyUrl,undefined,'URL prefix matches cannot establish a published company website');
console.log('Evidence validation passed');
