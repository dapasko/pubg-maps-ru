const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
function subject(){let mod;assert.doesNotThrow(()=>{mod=require('../main/portable-paths.cjs');},'portable paths must exist');return mod;}
test('portable storage creates all Electron directories next to the application',()=>{const {createPortablePaths}=subject();const root=fs.mkdtempSync(path.join(os.tmpdir(),'оверлей '));try{const dirs=createPortablePaths(root);for(const dir of Object.values(dirs)){assert.equal(fs.statSync(dir).isDirectory(),true);assert.equal(path.relative(root,dir).startsWith('..'),false);}assert.equal(dirs.userData,path.join(root,'portable-data'));}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('file in place of portable-data fails explicitly without fallback',()=>{const {createPortablePaths}=subject();const root=fs.mkdtempSync(path.join(os.tmpdir(),'overlay-'));try{fs.writeFileSync(path.join(root,'portable-data'),'do not overwrite');assert.throws(()=>createPortablePaths(root));assert.equal(fs.readFileSync(path.join(root,'portable-data'),'utf8'),'do not overwrite');}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('existing read-only directories fail even when access(W_OK) reports writable',{skip:process.platform==='win32'?'Real Windows ACL denial remains a manual gate':false},t=>{
 const {createPortablePaths}=subject();const root=fs.mkdtempSync(path.join(os.tmpdir(),'overlay-acl-'));const dirs=createPortablePaths(root);
 try{
  for(const dir of Object.values(dirs))fs.chmodSync(dir,0o555);
  t.mock.method(fs,'accessSync',()=>{});
  assert.throws(()=>createPortablePaths(root),/EACCES|EPERM/);
 }finally{for(const dir of Object.values(dirs))fs.chmodSync(dir,0o755);fs.rmSync(root,{recursive:true,force:true});}
});
