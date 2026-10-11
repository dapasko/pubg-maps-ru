'use strict';
if(process.platform!=='win32'||process.arch!=='x64') {console.error('Native build requires Windows x64 with Visual Studio C++ Build Tools and Python. No Windows module was built.');process.exit(2);}
const {spawnSync}=require('node:child_process');const path=require('node:path');
const result=spawnSync(process.execPath,[require.resolve('node-gyp/bin/node-gyp.js'),'rebuild','--directory',path.resolve(__dirname,'../native')],{stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
