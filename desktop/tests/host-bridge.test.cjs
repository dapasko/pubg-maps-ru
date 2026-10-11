const test=require('node:test');const assert=require('node:assert/strict');
function subject(){let mod;assert.doesNotThrow(()=>{mod=require('../tools/host-bridge.cjs');},'cross-build host bridge generator must exist');return mod;}
test('cross-build bridge preserves header signatures and resolves only its own host executable',()=>{
 const {generateHostBridge}=subject();
 const header='NAPI_EXTERN napi_status NAPI_CDECL napi_get_boolean(napi_env env, bool value, napi_value* result);';
 const bridge=generateHostBridge('napi_get_boolean(env, true, &result);',header);
 assert.ok(bridge.includes('napi_get_boolean(napi_env env, bool value, napi_value* result)'));
 assert.ok(bridge.includes('GetModuleHandleW(nullptr)'));
 assert.ok(bridge.includes('return hostFunction(env, value, result)'));
 assert.equal(bridge.includes('LoadLibrary'),false);
});
test('unknown API declaration stops cross-build instead of guessing ABI',()=>{
 const {generateHostBridge}=subject();assert.throws(()=>generateHostBridge('napi_missing(env);',''),/Missing.*napi_missing/);
});
