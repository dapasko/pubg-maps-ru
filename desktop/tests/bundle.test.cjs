const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
test('missing native binary cannot be declared a valid Windows bundle',async()=>{
 let validate;assert.doesNotThrow(()=>{validate=require('../tools/bundle-validation.cjs').validateBundle;},'bundle validator must exist');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'overlay-bundle-'));
 try{await assert.rejects(validate(dir),/missing|отсутствует/i);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
