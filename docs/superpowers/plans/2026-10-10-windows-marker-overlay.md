# Windows Marker Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No parallel agents are required by this plan.

**Goal:** Портативный офлайн-оверлей существующих меток поверх игровой карты PUBG с ручной калибровкой и линейкой.

**Architecture:** Electron main управляет прозрачным окном и настройками; отдельный React renderer показывает локальные данные. Модуль Windows Node-API принимает Raw Input в собственном окне приложения; не взаимодействует с процессом PUBG. Геометрия, состояние и формат настроек вынесены в чистые тестируемые модули.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Electron Forge ZIP maker, C++ Node-API/Win32, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-windows-marker-overlay-design.md`.

Статус: реализация запрошена пользователем 2026-10-11. Подготовлен технический пробник задачи 1 в desktop/; остальные задачи ждут обязательной проверки Windows/PUBG. Команды для последующих задач остаются запланированными интерфейсами. Подробные результаты — docs/audits/windows-overlay-validation.md.

## Global Constraints

- Windows 10/11 x64, игра «без рамки», один монитор; сборочная среда Node >=22.13.0.
- Без чтения памяти, файлов и трафика игры, определения позиции, захвата экрана и искусственного ввода.
- Офлайн-использование, локальные данные, ZIP без установщика; настройки рядом с exe.
- Все существующие категории шести карт; импорт новых точек не входит в проект.
- Состояния hidden/view/interact; глобальное M не подавляется в view; ручное устранение рассинхронизации.
- Масштаб 1.0–8.0 вокруг центра; шаг колеса ×1.1; стрелки 1 DIP, Shift+стрелки 10 DIP.
- Значки 12–40 DIP, default 22 DIP; непрозрачность 0.2–1.0, default 1.0.
- Проверочная опора <=2 физических px; якорь SVG <=1 DIP; реальные границы 8160 м вместо nominal 8000 м.
- Линейка только в interact, по выходе очищается. Крестик завершает все окна/процессы приложения.

## Review Focus

1. M удерживается или нажата в чате/с модификатором: нет повторных переключений и ложного обещания синхронизации (задачи 1, 4).
2. Фокус у панели, затем Alt+Tab или скрытие: взаимодействие прекращается, пользователь не остаётся с захваченной мышью (задачи 1, 4).
3. DPI/разрешение меняется: профиль проверяется, слой скрывается, координаты DIP/px не смешиваются (задачи 2, 5).
4. Папка read-only, путь кириллицей, повреждённый settings: данные не теряются и сохранение не объявляется успешным (задачи 3, 7).
5. Видимость верхнего окна/Raw Input отличается в реальной PUBG от тестового окна: ранний Windows gate перед остальной разработкой (задача 1).

## File Structure

Все новые продуктовые файлы под `desktop/`, кроме документации. Не переносить app/page.tsx целиком и не менять данные сайта в рамках этой работы.

- `desktop/package.json`, `vite.config.ts`, `forge.config.cjs`, `tsconfig.json`: независимая сборка renderer/main/preload, ZIP, lock-файл.
- `desktop/main/index.cjs`, `window-controller.cjs`, `input-service.cjs`, `settings-store.cjs`, `ipc.cjs`: запуск, окна, клавиши, файлы, проверенные IPC сообщения.
- `desktop/native/binding.gyp`, `raw-input.cc`, `index.cjs`: Windows Raw Input, сборка и загрузка .node из распакованных ресурсов.
- `desktop/core/geometry.mjs`, `state.mjs`, `settings.mjs`, `data.mjs`: чистые вычисления и контракты.
- `desktop/ui/main.tsx`, `Overlay.tsx`, `Toolbar.tsx`, `Settings.tsx`, `Calibration.tsx`, `Ruler.tsx`, `overlay.css`: локальная React UI.
- `desktop/tools/prepare-assets.mjs`, `verify-package.mjs`: упаковка копий данных/карт и контроль ZIP.
- `desktop/tests/*.test.mjs`, `ui.spec.mjs`, `windows-input-fixture.cjs`: проверки модулей, UI и второго тестового окна.
- `desktop/README.md`, `docs/audits/windows-overlay-validation.md`: запуск, ограничения, протокол проверки реальной Windows.

## Task 1: Доказать применимость окна и ввода на Windows

**Files:** create desktop package/build configs; main/index.cjs, window-controller.cjs, input-service.cjs, native/*; tests/input.test.mjs, windows-input-fixture.cjs; README.md.

**Interfaces:** native `registerKeyboard(hwnd:Buffer):void`, `readKeyboard(lParam:Buffer):{scanCode:number,virtualKey:number,isDown:boolean}|null`, `unregisterKeyboard():void`. input-service превращает одно физическое нажатие в `HotkeyAction='toggleOverlay'|'toggleInteraction'`; поддерживает `start(hwnd,bindings,onAction)` и `stop()`. window-controller реализует `applyMode(mode:'hidden'|'view'|'interact'):void`, `dispose():void`.

- [ ] Создать минимальную отдельную desktop сборку; зафиксировать точные совместимые версии, main/preload/renderer entrypoints и компиляцию .node Windows x64. Скрипты: dev, build, test, test:ui, test:windows, package, verify:package.
- [ ] Написать падающие тесты: down(M), повтор down(M), up(M) даёт одно действие; Ctrl+M не переключает; stop() прекращает действия; запись назначения приостанавливает обработку.
- [ ] Выполнить `npm --prefix desktop test -- tests/input.test.mjs`; подтвердить ожидаемое падение от отсутствующего input-service.
- [ ] Реализовать Raw Input через собственный HWND, RIDEV_INPUTSINK без RIDEV_NOLEGACY, единственный источник горячих клавиш; корректно освобождать регистрацию. Не использовать globalShortcut для захвата M.
- [ ] Реализовать прозрачное окно с локальным тестовым крестом и три режима; view не активирует окно и пропускает мышь, interact принимает ввод, скрытие/завершение освобождает ресурсы. Renderer: nodeIntegration=false, contextIsolation=true, sandbox=true.
- [ ] Повторить тесты; Windows fixture подтверждает получение обычного M нижним окном, пропуск клика/колеса в view и отсутствие утечки регистрации после exit. Записать реальные результаты, без имитации успеха в Linux.
- [ ] На Windows пользователя проверить окно поверх PUBG без рамки, оба режима, M, удержание, Alt+Tab, пользовательские права и выход. Проверить возврат фокуса обычным HWND, без синтетического ввода. Если критерии не выполнены — обновить дизайн и согласовать техническую альтернативу, не продолжать оформление приложения поверх неработающего основания.
- [ ] Коммит `feat(desktop): validate transparent overlay and passive keyboard input` только после подтверждённых проверок; протокол Windows приложить к коммиту.

## Task 2: Геометрия и профили преобразования

**Files:** create core/geometry.mjs, tests/geometry.test.mjs; import existing lib/map-geometry.mjs without changing its defaults.

**Interfaces:** `Point={x:number,y:number}`; `Calibration={origin:Point,sideDip:number,viewport:{x:number,y:number,width:number,height:number},validationErrorPx:number}`; `View={zoom:number,pan:Point}`. `calibrate(pairs:Array<{map:Point,screen:Point}>,scaleFactor:number):Calibration`, `project(point,calibration,view):Point`, `unproject(point,calibration,view):Point`, `zoomAtCenter(view,factor):View`, `distanceWorld(a,b,boundsCm:[number,number,number,number]):number`.

- [ ] Тесты: пары (0,0)→(100,200), (1,1)→(900,1000), третья (1,0)→(900,200) при DPI=1 дают sideDip=800 и origin=(100,200); дубли/разнос<0.25/третья близко к линии/ошибка>2px отклоняются.
- [ ] Тесты: project/unproject возвращают исходную точку с погрешностью <1e-9 для zoom=1,2,4,8; центр не меняется от zoom; горизонтальная половина растра 816000cm даёт 4080м. DPI=1.25 и 1.5 правильно пересчитывает ошибку из DIP в px.
- [ ] Запустить `npm --prefix desktop test -- tests/geometry.test.mjs`, увидеть падение; реализовать контракты и формулу из spec; проверить зелёный результат.
- [ ] Добавить ограничения масштаба/обрезку по фиксированному viewport; смещение стрелками задаётся в DIP. Запись калибровки и временное View — разные сущности.
- [ ] Коммит `feat(desktop): add calibrated overlay geometry`.

## Task 3: Локальные данные и портативные настройки

**Files:** create core/data.mjs, core/settings.mjs, main/settings-store.cjs, tools/prepare-assets.mjs, tests/data.test.mjs, tests/settings.test.mjs; consume data/markers.json, data/maps.json, maps/full/* and existing label/geometry modules.

**Interfaces:** `loadMapBundle():{maps:Array<MapRecord>,types:Array<MarkerType>,markers:Array<MarkerRecord>}`; MapRecord включает boundsCm и calibrationImage; MarkerRecord включает mapId/categoryId/normalized point/svg/anchor metadata. `SettingsV1={schemaVersion:1,bindings,selectedMapId,selectedProfileId,profiles}`; Profile содержит id/name/widthPx/heightPx/scaleFactor/gameResolutionLabel/style/calibrationsByMap/enabledLayersByMap. `readSettings(directory):{value:SettingsV1|null,error:string|null}`, `saveSettings(directory,value):void`.

- [ ] Тесты на сохранение всего состава групп/точек исходного JSON без реклассификации, координаты markerPoint, отдельные extent/nominal size, отсутствие карты/границ/SVG; ошибочные данные не превращаются в пустую «успешную» карту.
- [ ] Тесты на атомарную запись и backup, повреждённый JSON, schemaVersion=2, read-only directory, кириллицу/пробелы; обновление не меняет старый settings до явного сохранения.
- [ ] Запустить `npm --prefix desktop test -- tests/data.test.mjs tests/settings.test.mjs`, подтвердить падение; реализовать валидацию схемы, путь рядом с process.execPath для упакованной сборки и явную desktop/work папку для dev.
- [ ] Подготовить только локальные данные, calibration images и SVG; зафиксировать hash/source/version manifest. Рантайм не обращается к источникам. Настройки из исходников не включать в ZIP.
- [ ] Повторить тесты; Windows дополнительно проверяет read-only папку. Коммит `feat(desktop): add offline assets and portable profiles`.

## Task 4: Состояния, назначаемые клавиши и компактная панель

**Files:** create core/state.mjs, main/ipc.cjs, preload.cjs, ui/main.tsx, Overlay.tsx, Toolbar.tsx, Settings.tsx, overlay.css; tests/state.test.mjs, ui.spec.mjs; update window-controller.cjs/input-service.cjs.

**Interfaces:** `reduceOverlay(state,event):OverlayState`; state включает mode, selectedMapId/profileId, view, activeTool='none'|'calibration'|'ruler', rulerPoints. preload предоставляет `getSnapshot()`, `dispatch(event)`, `subscribe(listener):unsubscribe`; IPC проверяет разрешённые поля и диапазоны, renderer не получает FS/native функции.

- [ ] Тесты переходов из таблицы spec, удержания M, suspended shortcut recording, дубликатов назначений, Esc, blur, смены карты/профиля, изменения DPI; нет профиля — M не показывает слой, а не создаёт произвольную калибровку.
- [ ] Запустить `npm --prefix desktop test -- tests/state.test.mjs`, увидеть падение; реализовать reducer, bridge, panel и настройки, применять modes через интерфейс задачи 1.
- [ ] При входе interact сохранять предыдущий foreground HWND средствами ОС. На выходе попытаться вернуть его разрешённым Windows способом; проверять ошибки, без поиска PUBG/чтения памяти/SendInput. Пояснить M рассинхронизацию в режиме фокуса панели.
- [ ] При скрытии панели линейка и текст подсказок исчезают. Переключения клавиш мгновенные; opacity меток не применяется к панели; настройка карты/слоёв сохраняется через задачу 3.
- [ ] Выполнить unit tests и `npm --prefix desktop run test:ui`; UI проверки видимости панели, keyboard focus, записи горячих клавиш и локальных-only запросов. На Windows воспроизвести blur/возврат фокуса и M в interact.
- [ ] Коммит `feat(desktop): add overlay modes and compact controls`.

## Task 5: Мастер калибровки и фактические якоря значков

**Files:** create ui/Calibration.tsx, ui/marker-anchors.json, tests/calibration-ui.spec.mjs, tests/marker-anchors.test.mjs; update Overlay.tsx/Settings.tsx.

**Interfaces:** мастер возвращает `{mapId,profileId,calibration:Calibration}` в reducer только после явного сохранения; использует geometry задачи 2. anchor metadata `{typeKey,anchorX,anchorY,viewBox}` в координатах SVG.

- [ ] Падающие тесты выбора двух пар и третьей проверки, отказа сохранить плохую опору, отмены без перезаписи, локальной картинки только при калибровке, новой записи отдельно для map/profile.
- [ ] Реализовать мастер: выбрать опоры на локальной карте; скрыть картинку и указать ориентиры на видимой игре прозрачным перекрестием; проверить, разрешить ручную подгонку и явное сохранение. Никакого screenshot/OCR.
- [ ] Для всех исходных SVG измерить кончик/центр и задать якорь; геометрия меняет position, размер значка не меняет anchor. Не переносить известное внутреннее поле SVG как географическую поправку.
- [ ] Запустить unit/UI тесты; браузерная проверка якоря <=1 DIP при 12/22/40 DIP. Windows: DPI 100/125/150%, пять игровых ориентиров, ошибка <=2 физических px, смена разрешения скрывает слой до подтверждения профиля.
- [ ] Коммит `feat(desktop): add manual calibration and precise marker anchors`.

## Task 6: Масштаб, стрелки, сброс и линейка

**Files:** create ui/Ruler.tsx, tests/ruler.test.mjs, tests/overlay-controls.spec.mjs; update geometry/state/Overlay/Toolbar.

**Interfaces:** линейка хранит только нормализованные Point[] в текущем OverlayState и использует unproject/distanceWorld задачи 2; `activeTool` блокирует изменение преобразования во время ввода пары точек.

- [ ] Тесты колеса ×1.1 в диапазоне 1–8, неизменного центра, стрелок 1 DIP и Shift 10 DIP, отсутствия перетаскивания мышью и неизменной calibration при временной подгонке; reset даёт zoom=1,pan=(0,0).
- [ ] Тесты A/B по прямой: половина карты=4080м при любом zoom; третий клик начинает новое измерение; view/hidden/смена карты/профиля/reset очищают точки; нет bounds — измерение отключено.
- [ ] Запустить `npm --prefix desktop test -- tests/ruler.test.mjs`, увидеть падение; реализовать controls и Ruler без карточек объектов и планировщика.
- [ ] Запустить весь unit набор и UI controls; Windows: view пропускает колесо игре, interact масштабирует только слой. Измерить расхождение после ручной синхронизации нескольких увеличений, не заявлять автоматический zoom PUBG.
- [ ] Коммит `feat(desktop): add center zoom and interaction-only ruler`.

## Task 7: Производительность, ZIP и приёмка

**Files:** create tools/verify-package.mjs, tests/package.test.mjs, docs/audits/windows-overlay-validation.md; update Forge config, README and resource paths.

**Interfaces:** `npm --prefix desktop run package` на Windows производит out/pubg-marker-overlay-win32-x64.zip; `verify:package` проверяет exe, prebuilt .node и все локальные ресурсы/hashes, отсутствие пользовательских settings. ZIP содержит полную распаковываемую папку приложения, а не обещание одного exe.

- [ ] Проверка упаковки падает при отсутствующем .node/карте/manifest; настроить asar unpack нативного модуля, корректную загрузку путей после переноса папки. Runtime Chromium и необходимые Electron файлы в комплекте.
- [ ] Заблокировать внешние запросы/navigation, не включать auto-updater/telemetry/crash upload; направить userData/cache в portable-data. Проверить network trace офлайн, включая первый запуск.
- [ ] Рендерить только видимые группы/точки, кэшировать значки, останавливать перерисовку hidden; без постоянного animation loop для неподвижного view. Измерить p95 input≤100мс как цель, RAM/CPU и frame time игры, записать фактические цифры и характеристики ПК.
- [ ] Запустить `npm test`, `npx oxlint app lib tools tests`, затем `npm --prefix desktop test`, `npm --prefix desktop run test:ui`, `npm --prefix desktop run build`, `npm --prefix desktop run package`, `npm --prefix desktop run verify:package`; каждая заявленная проверка с фактическим результатом. Корневую сборку сайта выполнить, если изменились общие файлы.
- [ ] На чистой Windows под обычным пользователем без сети: распаковать в путь с кириллицей, настроить M/управление, калибровать, проверить шесть карт и весь состав слоёв, два профиля, линейку, перенос папки, read-only ошибку и обновление без перезаписи settings. Крестик завершает всё приложение; дочерних фоновых процессов не остаётся.
- [ ] В протоколе отдельно отметить реальное испытание PUBG, ограничения синхронизации M, точность выбранных ориентиров и статус подтверждения допустимости распространения. Тесты совместимости не выдавать за разрешение античита.
- [ ] Коммит `build(desktop): package offline portable Windows overlay`; показать ZIP и результаты пользователю. Публикация бинарного релиза — отдельный шаг после проверки конкретной сборки.

## Покрытие и передача

Состояние/ввод/окна → задачи 1 и 4; extent/масштаб/DPI → 2 и 5; данные/офлайн/настройки → 3 и 7; значки и калибровка → 5; линейка/управление → 6; ZIP/полное завершение/реальная игра → 7 с ранним gate в 1.

Рекомендованный порядок: один исполнитель последовательно в этой сессии, с проверкой каждого результата. Первый этап имеет самостоятельный критерий остановки; полноценную UI не строить до подтверждения применимости на Windows. Тесты и сборки приложения сейчас не запускались: приложение ещё не создано.
