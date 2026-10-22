export type RegionMatch={
 matches:boolean;
 distanceKm:number|null;
 targetCity:string|null;
 status:'exact'|'within_radius'|'outside_radius'|'unknown';
};
type Coordinates={lat:number;lon:number};
type GeocodeResult={
 lat?:string;lon?:string;name?:string;display_name?:string;
 category?:string;class?:string;type?:string;addresstype?:string;
 address?:Record<string,string>;
 namedetails?:Record<string,string>;
};

const aliases:Record<string,string>={munich:'muenchen',nuremberg:'nuernberg',cologne:'koeln'};
export function normalizeCity(value:string){
 const normalized=value.trim().toLocaleLowerCase('de-DE')
  .replace(/^\d{5}\s+/,'').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[.,]/g,' ').replace(/\s+/g,' ').trim();
 return aliases[normalized]||normalized;
}

/** Great-circle distance between city centres, not a driving distance. */
export function haversineKm(a:Coordinates,b:Coordinates){
 const radians=(value:number)=>value*Math.PI/180;
 const lat=radians(b.lat-a.lat),lon=radians(b.lon-a.lon);
 const sum=Math.sin(lat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lon/2)**2;
 return 6371.0088*2*Math.atan2(Math.sqrt(Math.max(0,sum)),Math.sqrt(Math.max(0,1-sum)));
}

const cache=new Map<string,{expiresAt:number;result:Promise<Coordinates|null>}>();
let requests:Promise<unknown>=Promise.resolve();
let lastStarted=0;
const wait=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds));

function coordinates(item:GeocodeResult,city:string):Coordinates|null{
 const lat=Number(item.lat),lon=Number(item.lon),address=item.address||{};
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||address.country_code!=='de')return null;
 const category=item.category||item.class;
 if(category!=='place'&&category!=='boundary')return null;
 const level=item.addresstype||item.type||'';
 if(!['city','town','village','municipality','hamlet','suburb','borough','quarter','city_district','administrative'].includes(level))return null;
 const wanted=normalizeCity(city);
 const names=[item.name,address.city,address.town,address.village,address.municipality,address.hamlet,address.suburb,address.borough,address.quarter,address.city_district,...['name','name:de','short_name','official_name','_place_short_name'].flatMap(key=>(item.namedetails?.[key]||'').split(';'))];
 if(!names.some(name=>name&&normalizeCity(name)===wanted))return null;
 return {lat,lon};
}

async function geocode(city:string):Promise<Coordinates|null>{
 const key=normalizeCity(city);if(key.length<2||key.length>100||/[0-9:@?#\\]/.test(key))return null;
 const previous=cache.get(key);if(previous&&previous.expiresAt>Date.now())return previous.result;
 if(cache.size>=256){const oldest=cache.keys().next().value;if(oldest)cache.delete(oldest)}
 const result=requests.then(async()=>{
  await wait(Math.max(0,lastStarted+1100-Date.now()));lastStarted=Date.now();
  try{
   const url=new URL('https://nominatim.openstreetmap.org/search');
   url.searchParams.set('city',city.replace(/^\d{5}\s+/,''));
   url.searchParams.set('country','Deutschland');url.searchParams.set('countrycodes','de');
   url.searchParams.set('format','jsonv2');url.searchParams.set('addressdetails','1');url.searchParams.set('namedetails','1');url.searchParams.set('limit','10');
   const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'QuoVadis/1.0 (https://github.com/pllanaio/quovadis; city-radius-verification)','Accept':'application/json','Accept-Language':'de'}});
   if(!response.ok)return null;
   const data:unknown=await response.json();if(!Array.isArray(data))return null;
   const points:Coordinates[]=[];
   for(const item of data){if(item&&typeof item==='object'){const point=coordinates(item as GeocodeResult,city);if(point&&!points.some(other=>haversineKm(point,other)<1))points.push(point)}}
   // Never choose the first of several different municipalities with the same name.
   return points.length===1?points[0]:null;
  }catch{return null}
 });
 requests=result.then(()=>undefined,()=>undefined);
 cache.set(key,{expiresAt:Date.now()+24*60*60*1000,result});
 void result.then(point=>{const current=cache.get(key);if(current?.result===result&&!point)current.expiresAt=Date.now()+5*60*1000});
 return result;
}

/** Unknown coordinates never count as a confirmed location inside the radius. */
export async function matchRegion(city:string,settings:{cities:string[];radiusKm:number}):Promise<RegionMatch>{
 const unknown:RegionMatch={matches:false,distanceKm:null,targetCity:null,status:'unknown'};
 const normalized=normalizeCity(city);if(normalized.length<2)return unknown;
 const targets=[...new Set(settings.cities.map(value=>value.trim()).filter(Boolean))].slice(0,3);
 if(!targets.length)return unknown;
 const exact=targets.find(target=>normalizeCity(target)===normalized);
 if(exact)return {matches:true,distanceKm:0,targetCity:exact,status:'exact'};
 const radius=Math.min(250,Math.max(0,Number(settings.radiusKm)||0));
 if(!radius)return {matches:false,distanceKm:null,targetCity:null,status:'outside_radius'};
 const [place,...points]=await Promise.all([geocode(city),...targets.map(geocode)]);
 if(!place)return unknown;
 let nearest:{distance:number;city:string}|null=null;
 for(let i=0;i<points.length;i++){
  const point=points[i];if(!point)continue;
  const distance=haversineKm(place,point);
  if(!nearest||distance<nearest.distance)nearest={distance,city:targets[i]};
 }
 if(nearest&&nearest.distance<=radius)return {matches:true,distanceKm:Math.round(nearest.distance*10)/10,targetCity:nearest.city,status:'within_radius'};
 if(!nearest||points.some(point=>!point))return unknown;
 return {matches:false,distanceKm:Math.round(nearest.distance*10)/10,targetCity:nearest.city,status:'outside_radius'};
}
