const test=require('node:test');const assert=require('node:assert/strict');
const config=require('../forge.config.cjs');
const ignored=p=>config.packagerConfig.ignore.some(pattern=>pattern.test(p));
test('Windows native binary and every parent directory remain in packaged resources',()=>{
 for(const p of ['/native','/native/build','/native/build/Release','/native/build/Release/raw_input.node'])assert.equal(ignored(p),false,p);
});
test('native build intermediates, test sources and developer dependencies stay out of bundle',()=>{
 for(const p of ['/native/raw-input.cc','/native/binding.gyp','/native/build/Debug','/tests/input.test.cjs','/node_modules/electron','/work','/out'])assert.equal(ignored(p),true,p);
});
