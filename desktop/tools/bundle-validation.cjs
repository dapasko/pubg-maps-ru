'use strict';
const fs=require('node:fs');const path=require('node:path');
async function validateBundle(directory){
 const required=['pubg-marker-overlay-probe.exe','icudtl.dat','resources/app.asar','resources/app.asar.unpacked/native/build/Release/raw_input.node'];
 for(const relative of required){const p=path.join(directory,relative);if(!fs.existsSync(p)||!fs.statSync(p).isFile())throw Error(`Missing required bundle file: ${relative}`);}
 for(const relative of [required[0],required[3]]){const fd=fs.openSync(path.join(directory,relative),'r');const header=Buffer.alloc(2);try{fs.readSync(fd,header,0,2,0);}finally{fs.closeSync(fd);}if(header.toString('ascii')!=='MZ')throw Error(`Invalid Windows binary: ${relative}`);}
 const asar=await import('@electron/asar');const archive=path.join(directory,'resources/app.asar');
 const entries=new Set(asar.listPackage(archive).map(x=>x.replace(/^\//,'')));
 for(const file of ['main/index.cjs','main/input-service.cjs','main/window-controller.cjs','main/portable-paths.cjs','main/probe-state.cjs','native/index.cjs','native/build/Release/raw_input.node','preload.cjs','dist/index.html','package.json'])if(!entries.has(file))throw Error(`Missing app resource: ${file}`);
 for(const file of entries)if(/(^|\/)(settings\.json|portable-data)(\/|$)/.test(file))throw Error('User data must not be included in the bundle');
 const html=asar.extractFile(archive,'dist/index.html').toString('utf8');
 for(const match of html.matchAll(/(?:src|href)="\.\/(assets\/[^"?#]+)"/g))if(!entries.has(`dist/${match[1]}`))throw Error(`Missing UI asset: ${match[1]}`);
 return {directory,resources:entries.size,nativePresent:true};
}
module.exports={validateBundle};
