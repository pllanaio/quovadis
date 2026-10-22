type SearchSettings={cities:string[];skills:string[]};

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

/** One place and one concrete signal per query; the full default skill set yields eight per city. */
export function baselineQueries(settings:SearchSettings):string[]{
 const queries:string[]=[];
 const skills=new Set(settings.skills);
 for(const value of settings.cities){
  const city=whitespace(value);
  if(!city)continue;
  const place=city.includes(' ')?`"${city}"`:city;
  if(skills.has('jobs'))queries.push(`${place} IT Administrator Aufbau`,`${place} IT Stellenangebot Erweiterung`,`${place} IT Generalist gesucht`);
  if(skills.has('tenders'))queries.push(`${place} IT Ausschreibung`);
  if(skills.has('migration'))queries.push(`${place} IT Infrastruktur Modernisierung`);
  if(skills.has('providers'))queries.push(`${place} IT Dienstleister gesucht`);
  if(skills.has('news')||skills.has('growth'))queries.push(`${place} Unternehmen Digitalisierung Investition`);
  if(skills.has('social'))queries.push(`site:linkedin.com/posts ${place} IT Unterstützung`);
 }
 return uniqueQueries(queries,settings.cities);
}
