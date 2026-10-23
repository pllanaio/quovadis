import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {name:'QuoVadis · IT Opportunity Radar',short_name:'QuoVadis',description:'Dein Radar für belegte IT-Geschäftsmöglichkeiten.',lang:'de',start_url:'/',display:'standalone',background_color:'#000000',theme_color:'#0052ff',icons:[{src:'/icons/radar-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/radar-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/radar-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
