import assert from 'node:assert/strict';
import {normalizeCity,haversineKm,matchRegion} from '../lib/research-region.ts';

assert.equal(normalizeCity('München'),normalizeCity('Muenchen'));
assert.equal(normalizeCity('Munich'),normalizeCity('80331 München'));
assert.equal(normalizeCity('Köln'),normalizeCity('Cologne'));
assert.ok(Math.abs(haversineKm({lat:48.137,lon:11.575},{lat:48.369,lon:10.897})-56.5)<2);

let calls=0;
globalThis.fetch=async input=>{
 calls++;
 const url=new URL(String(input));
 assert.equal(url.searchParams.get('countrycodes'),'de');
 const city=url.searchParams.get('city');
 const places={'München':{lat:'48.137',lon:'11.575'},'Augsburg':{lat:'48.369',lon:'10.897'}};
 const point=places[city];
 return Response.json(point?[{...point,name:city,category:'boundary',addresstype:'city',address:{city,country_code:'de'}}]:[]);
};

assert.deepEqual(await matchRegion('Munich',{cities:['München'],radiusKm:40}),{matches:true,distanceKm:0,targetCity:'München',status:'exact'});
assert.equal(calls,0,'Exact cities must not need an external geocoder');
assert.equal((await matchRegion('Augsburg',{cities:['München'],radiusKm:0})).status,'outside_radius');
assert.equal(calls,0,'A zero radius is an exact-city filter');
const nearby=await matchRegion('Augsburg',{cities:['München'],radiusKm:60});
assert.equal(nearby.status,'within_radius');
assert.equal(nearby.matches,true);
const outside=await matchRegion('Augsburg',{cities:['München'],radiusKm:20});
assert.equal(outside.status,'outside_radius');
assert.equal(outside.matches,false);
assert.equal(calls,2,'Resolved city coordinates should be cached');
const unknown=await matchRegion('Unbekannter Ort',{cities:['München'],radiusKm:250});
assert.deepEqual(unknown,{matches:false,distanceKm:null,targetCity:null,status:'unknown'});
console.log('research-region: aliases, distance, radius and unknown-location checks passed');
