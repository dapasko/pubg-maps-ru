'use strict';
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');const {generateHostBridge}=require('./host-bridge.cjs');
const [zig,headers]=process.argv.slice(2);if(!zig||!headers){console.error('Usage: node tools/build-cross.cjs /path/to/zig /path/to/node/include/node');process.exit(2);}
const native=path.resolve(__dirname,'../native');const work=path.resolve(__dirname,'../work/cross');fs.mkdirSync(work,{recursive:true});fs.mkdirSync(path.join(native,'build/Release'),{recursive:true});
const source=fs.readFileSync(path.join(native,'raw-input.cc'),'utf8');const declarations=['node_api.h','js_native_api.h'].map(name=>fs.readFileSync(path.join(headers,name),'utf8')).join('\n');
const bridge=path.join(work,'napi-host.cc');fs.writeFileSync(bridge,generateHostBridge(source,declarations));
const result=spawnSync(path.resolve(zig),['c++','-target','x86_64-windows-gnu','-shared','-std=c++17','-O2','-DNAPI_VERSION=8','-DNAPI_EXTERN=','-DWIN32_LEAN_AND_MEAN','-DNOMINMAX','-DNODE_GYP_MODULE_NAME=raw_input','-I',path.resolve(headers),'-I',native,path.join(native,'raw-input.cc'),bridge,'-luser32','-o',path.join(native,'build/Release/raw_input.node')],{stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
