/** Parse complete JSON values, without mistaking nested hypothesis arrays for leads. */
export class DiscoveryFormatError extends Error {
 code='DISCOVERY_FORMAT';
 constructor(){super('KI-Antwort enthält kein vollständiges JSON im erwarteten Format.')}
}
function jsonValue(text:string):unknown{
 const source=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return JSON.parse(source)}catch{}
 const start=source.search(/[\[{]/);if(start<0)throw new DiscoveryFormatError();
 const stack:string[]=[];let quoted=false,escaped=false;
 for(let at=start;at<source.length;at++){
  const char=source[at];
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
  if(char==='"'){quoted=true;continue}
  if(char==='['||char==='{')stack.push(char);
  else if(char===']'||char==='}'){
   if(stack.pop()!==(char===']'?'[':'{'))throw new DiscoveryFormatError();
   if(!stack.length){try{return JSON.parse(source.slice(start,at+1))}catch{throw new DiscoveryFormatError()}}
  }
 }
 throw new DiscoveryFormatError();
}
export function parseDiscoveryRows(text:string):Record<string,unknown>[]{
 const value=jsonValue(text);let rows:unknown;
 if(Array.isArray(value))rows=value;
 else if(value&&typeof value==='object'){
  const object=value as Record<string,unknown>;
  if(object.error||object.refusal)throw new DiscoveryFormatError();
  const lists=['opportunities','leads','companies','candidates','results'].filter(key=>Array.isArray(object[key]));
  if(lists.length===1)rows=object[lists[0]];
  else if(typeof object.name==='string'&&typeof object.city==='string'&&typeof object.sourceUrl==='string'&&typeof object.evidenceQuote==='string')rows=[object];
 }
 if(!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new DiscoveryFormatError();
 return rows as Record<string,unknown>[];
}

export function parseResearchObject(text:string):Record<string,unknown>{
 const value=jsonValue(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new DiscoveryFormatError();return value as Record<string,unknown>;
}
