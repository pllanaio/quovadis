import {allocateScoutBudget,DEFAULT_SCOUT_WEIGHTS,SCOUTS,type Scout} from './business-triggers';
type SearchSettings={cities:string[];skills:string[];scoutWeights?:Record<Scout,number>};

const booleanOperator=new RegExp('(?:^|[^\\p{L}\\p{N}_])(?:OR|AND)(?=$|[^\\p{L}\\p{N}_])','iu');
const wordCharacter=new RegExp('[\\p{L}\\p{N}]','u');
const hiddenCharacters=/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/;
const escapeRegex=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const whitespace=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim();

function cityForms(value:string):string[]{
 const lower=whitespace(value).toLocaleLowerCase('de-DE').replace(/ß/g,'ss');
 const stripAccents=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 return [...new Set([
  stripAccents(lower),
  stripAccents(lower.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')),
 ])];
}

/** Match whole city names, including compound names, without counting nested names twice. */
function mentionsMultipleCities(query:string,cities:string[]):boolean{
 const places:{forms:string[];id:number}[]=[];
 for(const city of cities){
  if(typeof city!=='string'||!city.trim())continue;
  const forms=cityForms(city);
  const existing=places.find(place=>place.forms.some(form=>forms.includes(form)));
  if(existing)existing.forms=[...new Set([...existing.forms,...forms])];
  else places.push({forms,id:places.length});
 }
 const mentioned=new Set<number>();
 for(const text of cityForms(query)){
  const matches:{id:number;start:number;end:number}[]=[];
  for(const place of places)for(const form of place.forms){
   const pattern=new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegex(form)})(?=$|[^\\p{L}\\p{N}_])`,'gu');
   for(const match of text.matchAll(pattern)){
    const start=(match.index||0)+match[1].length;
    matches.push({id:place.id,start,end:start+match[2].length});
   }
  }
  for(const match of matches){
   const nested=matches.some(other=>other.start<=match.start&&other.end>=match.end&&(other.start<match.start||other.end>match.end));
   if(!nested)mentioned.add(match.id);
  }
 }
 return mentioned.size>1;
}

/** Reject over-constrained or incomplete queries; never truncate a search expression. */
export function normalizeQuery(value:unknown,cities:string[]):string|null{
 if(typeof value!=='string')return null;
 const query=whitespace(value).replace(/[“”„‟«»]/g,'"');
 const wordCount=query.split(' ').length;
 if(!query||query.length>160||wordCount<2||wordCount>16||hiddenCharacters.test(query))return null;
 if(!wordCharacter.test(query)||/[()|`\\]/.test(query)||/&&/.test(query))return null;
 const quotes=[...query.matchAll(/"/g)];
 if(quotes.length!==0&&quotes.length!==2)return null;
 let outsideQuote=query;
 if(quotes.length===2){
  const start=quotes[0].index!,end=quotes[1].index!;
  if(!query.slice(start+1,end).trim())return null;
  // A quoted phrase may follow a search operator, e.g. intitle:"IT Aufbau".
  if(start>0&&!/[\s:]/.test(query[start-1]))return null;
  if(end<query.length-1&&!/\s/.test(query[end+1]))return null;
  outsideQuote=query.slice(0,start)+'quotedphrase'+query.slice(end+1);
 }
 if(booleanOperator.test(outsideQuote))return null;
 if(/(?:^|\s)(?:site|intitle|inurl|filetype|after|before):(?:\s|$)/i.test(outsideQuote))return null;
 const wholeQuery=cityForms(query.startsWith('"')&&query.endsWith('"')?query.slice(1,-1):query);
 if(cities.some(city=>typeof city==='string'&&cityForms(city).some(form=>wholeQuery.includes(form))))return null;
 if(mentionsMultipleCities(query,cities))return null;
 return query;
}

/** The same Set can be reused across planning rounds; rejected queries never consume a key. */
export function uniqueQueries(values:unknown[],cities:string[],seen:Set<string>=new Set()):string[]{
 const result:string[]=[];
 for(const value of values){
  const query=normalizeQuery(value,cities);
  if(!query)continue;
  const key=query.toLocaleLowerCase('de-DE').replace(/ß/g,'ss');
  if(seen.has(key))continue;
  seen.add(key);result.push(query);
 }
 return result;
}

const templates:Record<Scout,string[]>={
 external:['IT Dienstleister gesucht','externe IT Betreuung Ausschreibung','IT Support Wartungsvertrag Ausschreibung','IT Outsourcing Dienstleisterwechsel'],
 business:['Unternehmen neue Niederlassung eröffnet','Unternehmen Übernahme Fusion','Unternehmen neuer Onlineshop','Unternehmen neue Produktionsanlage','Unternehmen neue Tochtergesellschaft','Unternehmen Prozessautomatisierung'],
 projects:['ERP Einführung Implementierungspartner','IT Projekt Ausschreibung','CRM DMS Einführung Projekt','Cloud Migration geplant','IT Sicherheit Compliance Einführung'],
 growth:['Unternehmen Standort Erweiterung','Unternehmen wächst neue Mitarbeiter','Unternehmen Expansion neue Teams','Unternehmen vergrößert Betriebsstätte'],
 hiring:['erster IT Administrator Aufbau','IT Generalist Stellenangebot','IT Allrounder Karriere'],
};
const assignments=new Map<string,Scout>();
export function scoutForQuery(query:string):Scout{
 const known=assignments.get(query);if(known)return known;
 if(/stellen|karriere|administrator|generalist|allrounder/i.test(query))return 'hiring';
 if(/dienstleister|extern|outsourcing|wartungsvertrag|implementierungspartner/i.test(query))return 'external';
 if(/erp|crm|dms|cloud|ausschreib|migration|security|IT Projekt/i.test(query))return 'projects';
 if(/wachs|expand|expansion|mitarbeiter|vergröß|vergross/i.test(query))return 'growth';
 return 'business';
}
export function effectiveScoutWeights(settings:SearchSettings):Record<Scout,number>{
 const configured=settings.scoutWeights||DEFAULT_SCOUT_WEIGHTS;
 return {...configured,external:settings.skills.includes('providers')||settings.skills.includes('tenders')||settings.skills.includes('social')?configured.external:0,business:settings.skills.includes('business')||settings.skills.includes('news')||settings.skills.includes('social')?configured.business:0,projects:settings.skills.includes('migration')||settings.skills.includes('tenders')?configured.projects:0,growth:settings.skills.includes('growth')?configured.growth:0,hiring:settings.skills.includes('jobs')?configured.hiring:0};
}
/** Separate weighted scouts; allocated effort is unrelated to result counts. */
export function baselineQueries(settings:SearchSettings):string[]{
 settings={...settings,cities:[...new Map(settings.cities.map(city=>[city.trim().toLocaleLowerCase('de-DE'),city.trim()])).values()]};
 if(!settings.cities.length)return [];
 if(assignments.size>1000)assignments.clear();
 const allocation=allocateScoutBudget(Math.max(10,settings.cities.length*10),effectiveScoutWeights(settings)),lists:Record<string,string[]>={};
 for(const [scout]of SCOUTS){lists[scout]=[];for(let i=0;i<allocation[scout];i++){
  const city=settings.cities[i%settings.cities.length],place=city.includes(' ')?`"${city}"`:city,terms=templates[scout][Math.floor(i/settings.cities.length)%templates[scout].length];
  const query=normalizeQuery(place+' '+terms,settings.cities);if(query){lists[scout].push(query);assignments.set(query,scout)}
 }}
 const queries:string[]=[];for(let i=0;i<Math.max(0,...Object.values(lists).map(list=>list.length));i++)for(const [scout]of SCOUTS)if(lists[scout][i])queries.push(lists[scout][i]);
 return uniqueQueries(queries,settings.cities);
}
