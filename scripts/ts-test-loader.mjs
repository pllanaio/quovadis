import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const nativeRequire=createRequire(import.meta.url);
/** Load the actual TypeScript modules with explicit boundary mocks, without generating build files. */
export function testLoader(mocks={}){
 const cache=new Map();
 function load(file){
  const path=resolve(file);if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const require=id=>{
   if(Object.hasOwn(mocks,id))return mocks[id];
   if(id.startsWith('.')||id.startsWith('@/')){
    const target=id.startsWith('@/')?resolve('lib/../'+id.slice(2)):resolve(dirname(path),id);
    const candidate=existsSync(target+'.ts')?target+'.ts':target;
    if(candidate.endsWith('.ts'))return load(candidate);
    return nativeRequire(candidate);
   }
   return nativeRequire(id);
  };
  new Function('require','module','exports',source)(require,module,module.exports);return module.exports;
 }
 return load;
}
