'use strict';
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
function createPortablePaths(root){
 const userData=path.join(root,'portable-data');
 const paths={userData,sessionData:path.join(userData,'cache'),crashDumps:path.join(userData,'crashes'),logs:path.join(userData,'logs')};
 for(const dir of Object.values(paths)){
  fs.mkdirSync(dir,{recursive:true});
  const probe=path.join(dir,`.write-check-${randomUUID()}`);
  let fd;
  try{fd=fs.openSync(probe,'wx',0o600);fs.writeSync(fd,Buffer.from('write-check'));}
  finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(probe);}}
 }
 return paths;
}
module.exports={createPortablePaths};
