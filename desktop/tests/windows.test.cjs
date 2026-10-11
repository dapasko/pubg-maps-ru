const test = require('node:test');
const assert = require('node:assert/strict');
function subject() { let mod; assert.doesNotThrow(()=>{mod=require('../main/window-controller.cjs');},'window controller must exist'); return mod; }
function fixture() {
  const calls=[];
  const w={isDestroyed:()=>false};
  for(const name of ['setIgnoreMouseEvents','setFocusable','showInactive','show','focus','hide','destroy']) w[name]=(...args)=>calls.push([name,...args]);
  const native={getForegroundWindow:()=>Buffer.from('foreground'),restoreForegroundWindow:()=>{calls.push(['restore']);return true;}};
  return {calls,w,native};
}
test('view is visible without focus and all mouse events pass through',()=>{
  const {createWindowController}=subject(); const {w,native,calls}=fixture();
  createWindowController({window:w,native}).applyMode('view');
  assert.deepEqual(calls,[['setIgnoreMouseEvents',true],['setFocusable',false],['showInactive']]);
});
test('interaction gets focus; returning to view restores previous foreground',()=>{
  const {createWindowController}=subject(); const {w,native,calls}=fixture();
  const c=createWindowController({window:w,native});c.applyMode('interact');c.applyMode('view');
  assert.equal(c.mode,'view');
  assert.ok(calls.some(x=>x[0]==='focus'));
  assert.equal(calls.at(-1)[0],'restore');
});
test('unknown mode has no window side effects',()=>{
  const {createWindowController}=subject(); const {w,native,calls}=fixture();
  const c=createWindowController({window:w,native});assert.throws(()=>c.applyMode('bogus'),/mode/i);assert.deepEqual(calls,[]);
});
test('hide and disposal release interaction and disposal is idempotent',()=>{
  const {createWindowController}=subject(); const {w,native,calls}=fixture();
  const c=createWindowController({window:w,native}); c.applyMode('interact');c.applyMode('hidden');c.dispose();c.dispose();
  assert.ok(calls.some(x=>x[0]==='hide'));assert.equal(calls.filter(x=>x[0]==='destroy').length,1);
  assert.throws(()=>c.applyMode('view'),/disposed/i);
});
test('failed pass-through hides the layer instead of keeping a blocking window',()=>{
  const {createWindowController}=subject(); const {w,native,calls}=fixture();
  const c=createWindowController({window:w,native});w.setIgnoreMouseEvents=()=>{throw Error('window failure');};
  assert.throws(()=>c.applyMode('view'),/window failure/);assert.ok(calls.some(x=>x[0]==='hide'));assert.equal(c.mode,'hidden');
});
test('external blur respects the newly selected application instead of restoring old focus',()=>{
 const {createWindowController}=subject();const {w,native,calls}=fixture();const c=createWindowController({window:w,native});
 c.applyMode('interact');c.applyMode('view',{restoreFocus:false});c.dispose();
 assert.equal(calls.some(x=>x[0]==='restore'),false);
});
