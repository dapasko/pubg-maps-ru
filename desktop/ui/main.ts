import './style.css';
type Snapshot={mode:'hidden'|'view'|'interact';started:boolean;fixture:boolean;focusWarning:string|null};
type Probe={snapshot:()=>Promise<Snapshot>;start:(b:{toggleOverlay:number;toggleInteraction:number})=>Promise<{ok:boolean;error?:string}>;act:(a:string)=>Promise<void>;suspend:(b:boolean)=>Promise<void>;subscribe:(cb:(s:Snapshot)=>void)=>()=>void};
const api=(window as unknown as {probe:Probe}).probe;
const root=document.querySelector<HTMLElement>('#root')!;
const page=new URLSearchParams(location.search).get('page')??'control';
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='') {const e=document.createElement(tag);e.textContent=text;e.className=className;return e;}
function button(text:string,action:string){const b=element('button',text);b.type='button';b.onclick=()=>void api.act(action);return b;}
if(page==='overlay') {
  root.className='overlay';root.append(element('div','','target'));
  const panel=element('section','','panel');panel.append(element('strong','Проверка режима управления'),element('p','Сейчас мышь взаимодействует с этим окном. Вернитесь в просмотр назначенной клавишей; Esc скрывает слой. Это технический пробник, карты и меток пока нет.'),button('Режим просмотра','toggleInteraction'),button('Скрыть','toggleOverlay'),button('Выйти','exit'));root.append(panel);
  const render=(s:Snapshot)=>{panel.hidden=s.mode!=='interact';};api.subscribe(render);void api.snapshot().then(render);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')void api.act('escape');});
} else if(page==='fixture') {
  root.className='fixture';root.append(element('h1','Окно для проверки обычного ввода'),element('p','Выберите клавиши в окне запуска, нажмите «Начать», вернитесь сюда. M должен одновременно попасть сюда и переключить прозрачный крест. В просмотре клики и колесо должны доходить сюда.'));
  const input=element('input');input.placeholder='Проверка ввода — M должно печататься';root.append(input);
  const log=element('pre');root.append(log);let lines:string[]=[];function add(s:string){lines=[...lines.slice(-11),s];log.textContent=lines.join('\n');}
  window.addEventListener('keydown',e=>add(`key: ${e.code}, repeat=${e.repeat}`));window.addEventListener('click',()=>add('click reached lower window'));window.addEventListener('wheel',e=>add(`wheel: ${Math.sign(e.deltaY)}`));
} else {
  root.className='control';root.append(element('h1','Проверка совместимости оверлея'),element('p','Первый технический этап. Прозрачный крест проверяет отображение поверх PUBG в режиме «без рамки». Это ещё не приложение с метками.'),element('p','M переключает слой и не блокируется приложением. В режиме управления фокус у панели: PUBG может не получить M. Дополнительная клавиша исправляет рассинхронизацию.','notice'));
  const fields=element('div','','bindings');
  function keyField(text:string,initial:number){const label=element('label',text), select=element('select');for(let n=1;n<=24;n++){const option=element('option',`F${n}`);option.value=String(0x6f+n);select.append(option);}select.value=String(initial);select.onfocus=()=>void api.suspend(true);select.onblur=()=>void api.suspend(false);label.append(select);fields.append(label);return select;}
  const overlay=keyField('Дополнительная клавиша слоя',0x77),interaction=keyField('Режим управления',0x78);root.append(fields);
  const status=element('div','Выберите две разные клавиши и начните проверку.','status');status.setAttribute('role','status');root.append(status);
  const start=element('button','Начать проверку');start.onclick=async()=>{try{const r=await api.start({toggleOverlay:Number(overlay.value),toggleInteraction:Number(interaction.value)});if(!r.ok)status.textContent=r.error??'Не удалось включить ввод';}catch{status.textContent='Не удалось связаться с приложением';}};
  const actions=element('div','','actions');actions.append(start,button('Скрыть слой','hide'),button('Выйти','exit'));root.append(actions);
  const render=(s:Snapshot)=>{status.textContent=s.started?`Обработка клавиш включена. Состояние: ${s.mode}.${s.focusWarning?'\n'+s.focusWarning:''}`:'Выберите две разные клавиши и начните проверку.';};api.subscribe(render);void api.snapshot().then(render);
}
