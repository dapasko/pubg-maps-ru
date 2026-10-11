const test = require('node:test');
const assert = require('node:assert/strict');
async function moduleUnderTest() {
  let mod;
  assert.doesNotThrow(() => { mod = require('../main/input-service.cjs'); }, 'input service must exist');
  return mod;
}
test('M toggles once per physical press and remains usable after release', async () => {
  const { createHotkeyMatcher } = await moduleUnderTest();
  const actions = [];
  const matcher = createHotkeyMatcher({}, a => actions.push(a));
  matcher.receive({ virtualKey: 0x4d, isDown: true });
  matcher.receive({ virtualKey: 0x4d, isDown: true });
  matcher.receive({ virtualKey: 0x4d, isDown: false });
  matcher.receive({ virtualKey: 0x4d, isDown: true });
  assert.deepEqual(actions, ['toggleOverlay', 'toggleOverlay']);
});
test('modifiers exclude plain M without suppressing the input', async () => {
  const { createHotkeyMatcher } = await moduleUnderTest();
  for (const vk of [0x10, 0xa0, 0xa1, 0x11, 0xa2, 0xa3, 0x12, 0xa4, 0xa5, 0x5b, 0x5c]) {
    const actions = [];
    const matcher = createHotkeyMatcher({}, a => actions.push(a));
    matcher.receive({ virtualKey: vk, isDown: true });
    matcher.receive({ virtualKey: 0x4d, isDown: true });
    assert.deepEqual(actions, [], `modifier ${vk}`);
  }
});
test('recording bindings suspends actions and keeps held-key state', async () => {
  const { createHotkeyMatcher } = await moduleUnderTest();
  const actions = [];
  const matcher = createHotkeyMatcher({}, a => actions.push(a));
  matcher.setSuspended(true);
  matcher.receive({ virtualKey: 0x4d, isDown: true });
  matcher.setSuspended(false);
  matcher.receive({ virtualKey: 0x4d, isDown: true });
  assert.deepEqual(actions, []);
  matcher.receive({ virtualKey: 0x4d, isDown: false });
  matcher.receive({ virtualKey: 0x4d, isDown: true });
  assert.deepEqual(actions, ['toggleOverlay']);
});
test('additional bindings validate duplicates and reserved keys', async () => {
  const { createHotkeyMatcher } = await moduleUnderTest();
  assert.throws(() => createHotkeyMatcher({ toggleOverlay: 0x78, toggleInteraction: 0x78 }, () => {}), /duplicate/i);
  assert.throws(() => createHotkeyMatcher({ toggleInteraction: 0x4d }, () => {}), /reserved/i);
  const actions=[];
  const matcher=createHotkeyMatcher({ toggleOverlay:0x77,toggleInteraction:0x78 }, a=>actions.push(a));
  matcher.receive({virtualKey:0x78,isDown:true});
  assert.deepEqual(actions,['toggleInteraction']);
});
test('stopping service removes only its window registration and callback', async () => {
  const { createInputService } = await moduleUnderTest();
  const seen=[], hooks=new Map();
  const window={ getNativeWindowHandle:()=>Buffer.alloc(8),hookWindowMessage:(id,cb)=>hooks.set(id,cb),unhookWindowMessage:id=>hooks.delete(id) };
  const native={ registerKeyboard:()=>seen.push('register'),unregisterKeyboard:()=>seen.push('unregister'),readKeyboard:()=>({virtualKey:0x4d,isDown:true}) };
  const service=createInputService({window,native,bindings:{},onAction:a=>seen.push(a)});
  service.start();
  hooks.get(0xff)(Buffer.alloc(8),Buffer.alloc(8));
  service.stop(); service.stop();
  assert.equal(hooks.size,0);
  assert.deepEqual(seen,['register','toggleOverlay','unregister']);
});
test('registration failure leaves no window hook installed', async () => {
  const { createInputService } = await moduleUnderTest();
  const hooks=new Map();
  const window={getNativeWindowHandle:()=>Buffer.alloc(8),hookWindowMessage:(id,cb)=>hooks.set(id,cb),unhookWindowMessage:id=>hooks.delete(id)};
  const native={registerKeyboard:()=>{throw Error('access denied');},unregisterKeyboard:()=>{},readKeyboard:()=>null};
  const service=createInputService({window,native,onAction:()=>{},bindings:{}});
  assert.throws(()=>service.start(),/access denied/);
  assert.equal(hooks.size,0);
});
test('seeded held modifiers prevent toggles until physical release',async()=>{
 const {createHotkeyMatcher}=await moduleUnderTest();const actions=[];const matcher=createHotkeyMatcher({},a=>actions.push(a));
 assert.equal(typeof matcher.seed,'function','matcher must accept held keys when registration starts');
 matcher.seed([0xa0]);matcher.receive({virtualKey:0x4d,isDown:true});assert.deepEqual(actions,[]);
 matcher.receive({virtualKey:0x4d,isDown:false});matcher.receive({virtualKey:0xa0,isDown:false});matcher.receive({virtualKey:0x4d,isDown:true});assert.deepEqual(actions,['toggleOverlay']);
});
