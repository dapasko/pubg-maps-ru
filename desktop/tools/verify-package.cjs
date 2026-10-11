'use strict';
const fs=require('node:fs');const path=require('node:path');const {validateBundle}=require('./bundle-validation.cjs');
let directory=process.argv[2];
if(!directory){const out=path.resolve(__dirname,'../out');if(fs.existsSync(out))directory=fs.readdirSync(out).map(n=>path.join(out,n)).find(p=>fs.existsSync(path.join(p,'pubg-marker-overlay-probe.exe')));}
if(!directory){console.error('No built Windows bundle found. Build on Windows with npm run package first.');process.exit(1);}
validateBundle(path.resolve(directory)).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
