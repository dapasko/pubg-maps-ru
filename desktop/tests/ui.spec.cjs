'use strict';
const {chromium}=require('playwright');const fs=require('node:fs');const http=require('node:http');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../dist');assert.ok(fs.existsSync(path.join(root,'index.html')),'build renderer first');
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let listener;window.probe={snapshot:async()=>({mode:'view',started:true,fixture:false,focusWarning:null}),start:async b=>b.toggleOverlay===b.toggleInteraction?{ok:false,error:'Duplicate binding'}:{ok:true},act:async action=>listener?.({mode:action==='toggleInteraction'?'view':'hidden',started:true,fixture:false,focusWarning:null}),suspend:async()=>{},subscribe:cb=>{listener=cb;return()=>{};}};window.setProbeMode=mode=>listener?.({mode,started:true,fixture:false,focusWarning:null});});
  const base=`http://127.0.0.1:${port}`;
  await page.goto(base);await page.getByRole('heading',{name:'Проверка совместимости оверлея'}).waitFor();assert.equal(await page.locator('select').count(),2);
  await page.locator('select').nth(1).selectOption('119');await page.getByRole('button',{name:'Начать проверку'}).click();await page.getByRole('status').filter({hasText:'Duplicate binding'}).waitFor();
  await page.goto(base+'?page=overlay');assert.equal(await page.locator('.panel').isVisible(),false);assert.equal(await page.locator('.target').count(),1);
  await page.evaluate(()=>window.setProbeMode('interact'));assert.equal(await page.locator('.panel').isVisible(),true);
  await page.getByRole('button',{name:'Режим просмотра',exact:true}).click();assert.equal(await page.locator('.panel').isVisible(),false);
  await page.goto(base+'?page=fixture');await page.getByPlaceholder('Проверка ввода — M должно печататься').fill('M');assert.equal(await page.locator('input').inputValue(),'M');
  assert.deepEqual(errors,[]);console.log('UI checks passed: settings, duplicate bindings, view/interact panel, lower-window fixture. These checks do not prove Windows pass-through or PUBG compatibility.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
