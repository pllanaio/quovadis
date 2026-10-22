import {request as httpRequest} from 'node:http';

// The worker talks to the app over its private Docker network. node:http lets
// slow research responses use the full timeout, without fetch's separate
// five-minute timeout while waiting for response headers.
export function requestJson(url,{method='GET',headers={},body,timeout=60000}={}){
 const payload=body===undefined?undefined:JSON.stringify(body);
 return new Promise((resolve,reject)=>{
  const request=httpRequest(url,{
   method,headers:{...headers,...(payload===undefined?{}:{'content-type':'application/json'})},
   signal:AbortSignal.timeout(timeout)
  },response=>{
   let content='';
   response.setEncoding('utf8');
   response.on('data',chunk=>{
    content+=chunk;
    if(content.length>2*1024*1024)response.destroy(Error('Worker-Antwort ist zu groß'));
   });
   response.on('error',reject);
   response.on('end',()=>{
    try{
     const json=content?JSON.parse(content):{};
     if((response.statusCode||500)>=400)throw Error(json.error||`HTTP ${response.statusCode}`);
     resolve(json);
    }catch(error){reject(error)}
   });
  });
  request.on('error',reject);
  request.end(payload);
 });
}
