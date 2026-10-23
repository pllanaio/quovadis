type Company={id:string|number;name:string;city:string;assessment?:{facts?:any[];contacts?:any[]}};
type Evidence={companyId:string;companyName:string;sourceUrl:string;quote:string;checkedAt?:string};
export function companyGraph(companies:Company[]){
 const entities=new Map<string,{id:string;kind:string;label:string;evidence:Evidence[]}>();
 const normalized=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}@+]+/gu,' ').trim();
 function add(company:Company,kind:string,label:string,sourceUrl:string,quote:string,checkedAt?:string){
  if(!sourceUrl||!quote||label.length<4)return;try{if(!['http:','https:'].includes(new URL(sourceUrl).protocol))return}catch{return}
  const value=kind==='phone'?label.replace(/[^\d+]/g,''):normalized(label),key=kind+':'+value;
  const entity=entities.get(key)||{id:key,kind,label,evidence:[]};if(!entity.evidence.some(item=>item.companyId===String(company.id)))entity.evidence.push({companyId:String(company.id),companyName:company.name,sourceUrl,quote,checkedAt});entities.set(key,entity);
 }
 for(const company of companies){
  for(const fact of company.assessment?.facts||[]){const field=String(fact.field||'');if(/adresse|anschrift|geschäftssitz|geschaeftssitz/i.test(field)&&String(fact.value).length>=12)add(company,'address',fact.value,fact.sourceUrl,fact.quote,fact.checkedAt);else if(fact.group==='management'&&/geschäftsführ|geschaeftsfuehr|inhaber|vorstand|name/i.test(field))add(company,'name',fact.value,fact.sourceUrl,fact.quote,fact.checkedAt)}
  for(const contact of company.assessment?.contacts||[])if(['email','phone'].includes(contact.kind))add(company,contact.kind,contact.value,contact.sourceUrl,contact.quote,contact.checkedAt);
 }
 const shared=[...entities.values()].filter(entity=>entity.evidence.length>1).sort((a,b)=>b.evidence.length-a.evidence.length);
 return {companies:companies.map(company=>({id:String(company.id),name:company.name,city:company.city})),entities:shared,notice:'Verbindungen zeigen gleiche veröffentlichte Angaben. Gleiche Adresse, Rufnummer oder Namensnennung belegt weder Beteiligung noch Geschäftsbeziehung. Ähnliche Namen können verschiedene Personen bezeichnen.'};
}
