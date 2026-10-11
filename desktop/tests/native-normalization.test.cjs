const test=require('node:test');const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');const os=require('node:os');
test('native normalization keeps overlapping left/right modifiers independent',{skip:process.platform==='win32'?'Portable compiler test is run in Linux; Windows addon build is verified separately':false},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'overlay-native-'));try{
  const source=path.join(dir,'normalization.cc'),binary=path.join(dir,'normalization');
  fs.writeFileSync(source,'#include "key-normalization.h"\n#include <cassert>\nint main(){assert(normalizeVirtualKey(0x10,0x2a,0)==0xa0);assert(normalizeVirtualKey(0x10,0x36,0)==0xa1);assert(normalizeVirtualKey(0x11,0x1d,0)==0xa2);assert(normalizeVirtualKey(0x11,0x1d,2)==0xa3);assert(normalizeVirtualKey(0x12,0x38,0)==0xa4);assert(normalizeVirtualKey(0x12,0x38,2)==0xa5);assert(normalizeVirtualKey(0x4d,0x32,0)==0x4d);}\n');
  const compile=spawnSync('g++',['-std=c++17','-I',path.resolve(__dirname,'../native'),source,'-o',binary],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr??String(compile.error));assert.equal(spawnSync(binary).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
