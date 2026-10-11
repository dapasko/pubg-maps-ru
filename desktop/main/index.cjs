'use strict';
const {app,BrowserWindow,dialog,ipcMain,screen,session}=require('electron');
const path=require('node:path');
const {createPortablePaths}=require('./portable-paths.cjs');
const {createInputService,validateBindings}=require('./input-service.cjs');
const {createWindowController}=require('./window-controller.cjs');
const {nextMode}=require('./probe-state.cjs');
if(process.platform!=='win32'||process.arch!=='x64'){app.whenReady().then(()=>{dialog.showErrorBox('Windows x64 required','This compatibility probe runs only on Windows x64.');app.quit();});}
else {
  let control,overlay,fixture,controller,input,native,quitting=false,focusWarning=null;
  const fixtureMode=process.argv.includes('--input-fixture');
  const portableRoot=app.isPackaged?path.dirname(process.execPath):path.resolve(__dirname,'../work');
  try {const dirs=createPortablePaths(portableRoot);app.setPath('userData',dirs.userData);app.setPath('sessionData',dirs.sessionData);app.setPath('crashDumps',dirs.crashDumps);app.setAppLogsPath(dirs.logs);}
  catch {app.whenReady().then(()=>{dialog.showErrorBox('Нет доступа для записи','Переместите папку приложения в доступную для записи папку. Настройки не будут перенесены в AppData.');app.quit();});quitting=true;}
  app.on('before-quit',()=>{if(quitting)return;quitting=true;try{input?.stop();}finally{controller?.dispose();if(fixture&&!fixture.isDestroyed())fixture.destroy();}});
  function snapshot(){return {mode:controller?.mode??'hidden',started:Boolean(input),fixture:fixtureMode,focusWarning};}
  function publish(){const s=snapshot();for(const w of [control,overlay])if(w&&!w.isDestroyed())w.webContents.send('probe:state',s);}
  function action(event){if(event==='exit'){app.quit();return;}if(!controller)return;if(event==='hide')controller.applyMode('hidden');else controller.applyMode(nextMode(controller.mode,event),{restoreFocus:event!=='blur'});publish();}
  function fail(error){try{input?.stop();input=null;}catch{}try{controller?.applyMode('hidden');}catch{}dialog.showErrorBox('Ошибка проверки оверлея',String(error.message));app.quit();}
  function makeWindow(options,page){
    const w=new BrowserWindow({...options,webPreferences:{preload:path.resolve(__dirname,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());
    w.on('closed',()=>{if(!quitting)app.quit();});
    void w.loadFile(path.resolve(__dirname,'../dist/index.html'),{query:{page}}).catch(fail);
    return w;
  }
  function authorize(event){if(![control?.webContents,overlay?.webContents].includes(event.sender))throw Error('Unknown sender');}
  app.whenReady().then(()=>{
    if(quitting)return;
    native=require('../native/index.cjs');
    session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,cb)=>cb({cancel:true}));
    const bounds=screen.getPrimaryDisplay().bounds;
    control=makeWindow({width:760,height:640,show:true,backgroundColor:'#171e2a',title:'Проверка оверлея PUBG'},'control');
    overlay=makeWindow({...bounds,show:false,transparent:true,frame:false,hasShadow:false,resizable:false,focusable:false,skipTaskbar:true,alwaysOnTop:true,backgroundColor:'#00000000'},'overlay');
    overlay.setIgnoreMouseEvents(true);
    controller=createWindowController({window:overlay,native,onFocusError:error=>{focusWarning=error.message;publish();}});
    overlay.on('blur',()=>{if(controller?.mode==='interact')action('blur');});
    for(const event of ['display-metrics-changed','display-added','display-removed'])screen.on(event,()=>{action('hide');const next=screen.getPrimaryDisplay().bounds;overlay.setBounds(next);focusWarning='Параметры экрана изменились. Слой скрыт.';publish();});
    if(fixtureMode)fixture=makeWindow({width:820,height:560,backgroundColor:'#1e3045',title:'Lower window input fixture'},'fixture');
    ipcMain.handle('probe:snapshot',event=>{authorize(event);return snapshot();});
    ipcMain.handle('probe:start',(event,bindings)=>{
      authorize(event);if(event.sender!==control.webContents)throw Error('Bindings can only be changed in settings');
      try{validateBindings(bindings);if(!bindings.toggleOverlay||!bindings.toggleInteraction)throw Error('Выберите обе клавиши');input?.stop();input=null;
        const service=createInputService({window:control,native,bindings,onAction:a=>{try{action(a);}catch(e){fail(e);}},onError:fail});service.start();input=service;publish();return {ok:true};}
      catch(error){publish();return {ok:false,error:error.message};}
    });
    ipcMain.handle('probe:action',(event,value)=>{authorize(event);if(!['toggleOverlay','toggleInteraction','escape','exit','hide'].includes(value))throw Error('Unknown action');action(value);});
    ipcMain.handle('probe:suspend',(event,flag)=>{authorize(event);if(event.sender!==control.webContents||typeof flag!=='boolean')throw Error('Invalid suspension');input?.setSuspended(flag);});
  }).catch(fail);
  app.on('window-all-closed',()=>app.quit());
}
