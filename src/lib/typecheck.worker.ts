/// <reference lib="webworker" />
import ts from 'typescript';
import es5 from 'typescript/lib/lib.es5.d.ts?raw';
import dom from 'typescript/lib/lib.dom.d.ts?raw';
import promise from 'typescript/lib/lib.es2015.promise.d.ts?raw';
import core from 'typescript/lib/lib.es2015.core.d.ts?raw';
import symbol from 'typescript/lib/lib.es2015.symbol.d.ts?raw';
import iterable from 'typescript/lib/lib.es2015.iterable.d.ts?raw';
import collection from 'typescript/lib/lib.es2015.collection.d.ts?raw';
import wellknown from 'typescript/lib/lib.es2015.symbol.wellknown.d.ts?raw';
const libs:Record<string,string>={'lib.es5.d.ts':es5,'lib.dom.d.ts':dom,'lib.es2015.promise.d.ts':promise,'lib.es2015.core.d.ts':core,'lib.es2015.symbol.d.ts':symbol,'lib.es2015.iterable.d.ts':iterable,'lib.es2015.collection.d.ts':collection,'lib.es2015.symbol.wellknown.d.ts':wellknown};
self.onmessage=({data}:{data:{id:number;code:string}})=>{try {
 const sources={...libs,'exercise.ts':data.code};
 const opts:ts.CompilerOptions={target:ts.ScriptTarget.ES2015,module:ts.ModuleKind.ESNext,strict:true,noEmit:true,noLib:true,skipLibCheck:true};
 const host:ts.CompilerHost={getSourceFile:(file,language)=>file in sources?ts.createSourceFile(file,sources[file as keyof typeof sources],language,true):undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:file=>file in sources,readFile:file=>sources[file as keyof typeof sources],getCanonicalFileName:file=>file,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
 const program=ts.createProgram(Object.keys(sources),opts,host);
 const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>!d.file||d.file.fileName==='exercise.ts').slice(0,30).map(d=>{const pos=d.file?.getLineAndCharacterOfPosition(d.start||0);return `${pos?`第 ${pos.line+1} 行：`:''}${ts.flattenDiagnosticMessageText(d.messageText,' ')}`});
 self.postMessage({id:data.id,diagnostics});
}catch(error){self.postMessage({id:data.id,diagnostics:[String(error)]})}};
