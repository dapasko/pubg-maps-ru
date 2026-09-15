'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { distanceMeters, gridStepMeters, markerPoint, tileLevelForZoom } from '../lib/map-geometry.mjs';
import { displayCategoryId, isGasCylinderType, markerLabel } from '../lib/marker-display.mjs';
import { calculateFlightPlan, extendFlightLine, flightProfiles } from '../lib/flight-plan.mjs';

type MapInfo = { id: string; name: string; sizeKm: number };
type MarkerType = { key: string; ru: string; color: string; svg: string };
type MarkerGroup = { typeKey: string; tag: string | null; points: [number, number][] };
type MarkerMap = { name: string; groups: MarkerGroup[] };
type MarkerData = { types: MarkerType[]; maps: MarkerMap[] };
type Point = { x: number; y: number };
type DisplayCategory = { id: string; label: string; typeKeys: string[]; pointCount: number; iconKey: string };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const mapName: Record<string, string> = { erangel: 'Erangel', miramar: 'Miramar', vikendi: 'Vikendi', taego: 'Taego', deston: 'Deston', rondo: 'Rondo' };

function formatDistance(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(2)} км` : `${Math.round(value)} м`; }

function FlightControlOverlay({ points, preview }: { points: Point[]; preview: Point | null }) {
  const origin = points[0];
  if (!origin) return null;
  const usablePreview = preview && Math.hypot(preview.x - origin.x, preview.y - origin.y) > .012 ? preview : null;
  const direction = points[1] ?? usablePreview;
  const angle = direction ? Math.atan2(direction.y - origin.y, direction.x - origin.x) * 180 / Math.PI : 0;
  const renderControl = (point: Point, kind: 'origin' | 'direction', ghost = false) => {
    const isOrigin = kind === 'origin';
    const captionBelow = point.y < .12;
    return <span className={`flight-control ${kind}${ghost ? ' preview-control' : ''}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} key={`${kind}-${ghost ? 'preview' : 'fixed'}`}>
      <span className="control-marker">{isOrigin ? <b>A</b> : <i style={{ transform: `rotate(${angle}deg)` }}/>}</span>
      {!ghost && <span className={`control-caption ${captionBelow ? 'below' : ''}`}>{isOrigin ? 'ТОЧКА A' : 'НАПРАВЛЕНИЕ'}</span>}
    </span>;
  };
  return <><svg className="flight-control-overlay" viewBox="0 0 100 100" aria-hidden="true">{points.length === 1 && usablePreview && <line className="flight-preview" x1={origin.x * 100} y1={origin.y * 100} x2={usablePreview.x * 100} y2={usablePreview.y * 100}/>}</svg><div className="flight-control-layer" aria-hidden="true">{renderControl(origin, 'origin')}{points[1] && renderControl(points[1], 'direction')}{points.length === 1 && usablePreview && renderControl(usablePreview, 'direction', true)}</div></>;
}

export default function Home() {
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [data, setData] = useState<MarkerData | null>(null);
  const [active, setActive] = useState('erangel');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [grid, setGrid] = useState(true);
  const [measure, setMeasure] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [flightMode, setFlightMode] = useState(false);
  const [flightPoints, setFlightPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  // Desktop keeps the panel open on first paint; the matchMedia effect below
  // stays authoritative (and keeps it in sync on resize).
  const [sidebar, setSidebar] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const panValue = useRef(pan);
  const zoomValue = useRef(zoom);

  useEffect(() => { panValue.current = pan; }, [pan]);
  useEffect(() => { zoomValue.current = zoom; }, [zoom]);

  useEffect(() => {
    // On desktop the panel stays open by default so the map tools and marker
    // toggles are immediately visible; on smaller screens it collapses.
    const desktop = window.matchMedia('(min-width: 1024px)');
    const syncSidebar = (event: MediaQueryList | MediaQueryListEvent) => setSidebar(event.matches);
    syncSidebar(desktop);
    desktop.addEventListener('change', syncSidebar);
    return () => desktop.removeEventListener('change', syncSidebar);
  }, []);

  useEffect(() => { void fetch('./data/maps.json').then(r => r.json()).then((v: MapInfo[]) => setMaps(v)); }, []);
  useEffect(() => { void fetch('./data/markers.json').then(r => r.json()).then((v: MarkerData) => setData(v)); }, []);

  const selected = maps.find(map => map.id === active) ?? maps[0];
  const sourceMap = data?.maps.find(map => map.name === mapName[active]);
  const groups = sourceMap?.groups ?? [];
  const types = useMemo(() => new Map(data?.types.map(type => [type.key, type]) ?? []), [data]);
  const categories = useMemo<DisplayCategory[]>(() => {
    const display = new Map<string, DisplayCategory>();
    for (const group of groups) {
      const isDestonAirboat = sourceMap?.name === 'Deston' && group.tag === 'AirBoat';
      const id = isGasCylinderType(group.typeKey) ? 'gas-cylinders' : isDestonAirboat ? 'deston-airboats' : displayCategoryId(sourceMap?.name, group.typeKey);
      const type = types.get(group.typeKey);
      const current = display.get(id);
      if (current) { current.typeKeys.push(group.typeKey); current.pointCount += group.points.length; continue; }
      const label = id === 'miramar-random-boats' ? 'Случайные точки спавна лодок' : isDestonAirboat ? 'Случайные точки аэроглиссера' : markerLabel(sourceMap?.name, group, type?.ru ?? group.typeKey);
      display.set(id, { id, label, typeKeys: [group.typeKey], pointCount: group.points.length, iconKey: group.typeKey });
    }
    return [...display.values()];
  }, [groups, types]);
  const activeTypeKeys = useMemo(() => new Set(categories.filter(category => enabled.has(category.id)).flatMap(category => category.typeKeys)), [categories, enabled]);
  const level = tileLevelForZoom(zoom);
  const count = level === null ? 0 : 2 ** level;
  const isFineGrid = gridStepMeters(zoom) === 100;
  const activePoints = points.length === 2 ? points : [];
  const measureStart = points[0] ?? null;
  const measureEnd = activePoints[1] ?? (measure && points.length === 1 ? cursor : null);
  const selectedDistance = measureStart && measureEnd ? distanceMeters(measureStart, measureEnd) : 0;
  const flightProfile = flightProfiles[active as keyof typeof flightProfiles] ?? flightProfiles.erangel;
  const flightLine = flightPoints.length >= 2 ? extendFlightLine(flightPoints[0], flightPoints[1]) : null;
  const flightPlan = flightPoints.length === 3 && flightLine ? calculateFlightPlan(flightLine.start, flightLine.end, flightPoints[2], selected?.sizeKm ?? 8, flightProfile) : null;
  const mapMeters = (selected?.sizeKm ?? 8) * 1000;
  const certainCorridorWidth = flightProfile.glideMeters / mapMeters * 200;
  const longCorridorWidth = flightProfile.longGlideMeters / mapMeters * 200;
  const flightBounds = flightLine ? (() => {
    const dx = flightLine.end.x - flightLine.start.x;
    const dy = flightLine.end.y - flightLine.start.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    return {
      startX: flightLine.start.x * 100, startY: flightLine.start.y * 100,
      endX: flightLine.end.x * 100, endY: flightLine.end.y * 100,
      extendedStartX: flightLine.start.x * 100 - ux * 200, extendedStartY: flightLine.start.y * 100 - uy * 200,
      extendedEndX: flightLine.end.x * 100 + ux * 200, extendedEndY: flightLine.end.y * 100 + uy * 200,
      perpendicularX: -uy, perpendicularY: ux,
    };
  })() : null;
  const reachLabel = flightPlan?.reach === 'fast' ? 'Быстрый прыжок' : flightPlan?.reach === 'glide' ? 'Нужно планировать' : flightPlan?.reach === 'long' ? 'Дальний полёт' : 'За практической дальностью';
  // Keep endpoints as precise, unobtrusive reference dots at every zoom level.
  const measureRadius = clamp(.34 * clamp(zoom, .8, 1.1) / zoom, .03, .38);
  const labelPoint = measureStart && measureEnd ? {
    x: measureStart.x + (measureEnd.x - measureStart.x) * .25,
    y: measureStart.y + (measureEnd.y - measureStart.y) * .25,
  } : null;

  useEffect(() => {
    setPoints([]); setFlightPoints([]); setZoom(1); setPan({ x: 0, y: 0 });
    setEnabled(new Set(categories.slice(0, 1).map(category => category.id)));
  }, [active, data, categories]);

  const mapPoint = (event: { clientX: number; clientY: number }): Point | null => {
    const r = mapElement.current?.getBoundingClientRect(); if (!r) return null;
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  };
  const pointerDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: panValue.current.x, panY: panValue.current.y, moved: false };
    } else if (pointers.current.size === 2) {
      if (drag.current) drag.current.moved = true;
      pinch.current = { distance: pointerDistance(), zoom: zoomValue.current };
    }
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const nextZoom = clamp(pinch.current.zoom * pointerDistance() / Math.max(pinch.current.distance, 1), 1, 12);
      zoomValue.current = nextZoom;
      setZoom(nextZoom);
      return;
    }
    const d = drag.current;
    if (d?.id === event.pointerId) {
      const dx = event.clientX - d.x;
      const dy = event.clientY - d.y;
      if (Math.hypot(dx, dy) > 4) d.moved = true;
      const nextPan = { x: d.panX + dx, y: d.panY + dy };
      panValue.current = nextPan;
      setPan(nextPan);
      return;
    }
    if (measure || flightMode) setCursor(mapPoint(event));
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [id, point] = [...pointers.current.entries()][0];
      drag.current = { id, x: point.x, y: point.y, panX: panValue.current.x, panY: panValue.current.y, moved: true };
    } else if (d?.id === event.pointerId) {
      drag.current = null;
    }
    if (!d?.moved && d?.id === event.pointerId && (measure || flightMode)) {
      const point = mapPoint(event);
      if (point && flightMode) setFlightPoints(current => current.length < 3 ? [...current, point] : [point]);
      else if (point) { setCursor(point); setPoints(current => current.length === 1 ? [...current, point] : [point]); }
    }
  };
  const cancelPointers = () => { drag.current = null; pinch.current = null; pointers.current.clear(); setCursor(null); };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); setZoom(value => clamp(value * (event.deltaY < 0 ? 1.2 : .84), 1, 12)); };
  const chooseMap = (id: string) => {
    setActive(id);
    // On mobile the panel should collapse after picking a map; on desktop it
    // stays open so the tools and marker toggles remain visible.
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 1024px)').matches) setSidebar(false);
  };
  const toggle = (key: string) => setEnabled(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return <main className={`shell ${sidebar ? 'panel-open' : ''}`}>
    <header className="topbar">
      <button className="brand" onClick={() => setSidebar(value => !value)} aria-label={sidebar ? 'Скрыть карты и метки' : 'Открыть карты и метки'} aria-expanded={sidebar} aria-controls="map-panel"><span>КАРТЫ</span><b>PUBG</b><i>RU</i></button>
      <button className="panel-toggle" onClick={() => setSidebar(value => !value)} aria-label={sidebar ? 'Скрыть панель' : 'Показать панель'} aria-expanded={sidebar} aria-controls="map-panel"><span aria-hidden="true">{sidebar ? '×' : '☰'}</span>Панель</button>
      <div className="title"><strong>{selected?.name ?? 'Загрузка…'}</strong><span>8 × 8 км</span></div>
      <div className="hint"><kbd>Колесо</kbd> масштаб <i/> <kbd>ЛКМ</kbd> перемещение</div>
    </header>
    <button className={`backdrop ${sidebar ? 'open' : ''}`} aria-label="Закрыть меню" onClick={() => setSidebar(false)}/>
    <aside id="map-panel" className={`panel ${sidebar ? 'open' : ''}`}>
      <section><div className="section-title">Карты <small>6 локаций</small></div><div className="maps">{maps.map(map => <button className={map.id === active ? 'chosen' : ''} key={map.id} onClick={() => chooseMap(map.id)}><img src={`./maps/thumb/${map.id}.webp`} alt=""/><span>{map.name}</span><small>8 км</small></button>)}</div></section>
      <section><div className="section-title">Инструменты</div><label className="toggle"><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)}/><span/>Сетка координат</label><label className="toggle"><input type="checkbox" checked={measure} onChange={event => { setMeasure(event.target.checked); setFlightMode(false); setFlightPoints([]); setPoints([]); setCursor(null); }}/><span/>Измерить расстояние</label>{measure && <p className="measure-help">Первая точка — затем наведите курсор и выберите вторую</p>}{points.length > 0 && <button className="reset" onClick={() => { setPoints([]); setCursor(null); }}>Сбросить измерение</button>}<label className="toggle flight-toggle"><input type="checkbox" checked={flightMode} onChange={event => { setFlightMode(event.target.checked); setMeasure(false); setPoints([]); setFlightPoints([]); setCursor(null); }}/><span/>Линия полёта самолёта</label>{flightMode && <div className="flight-help"><p>{flightPoints.length === 0 ? '1. Поставьте первую точку линии' : flightPoints.length === 1 ? '2. Задайте направление полёта' : flightPoints.length === 2 ? '3. Укажите место посадки' : `До линии: ${formatDistance(flightPlan?.distanceFromRouteMeters ?? 0)}`}</p>{flightLine && <div className="flight-legend"><span><i className="certain"/>Точно долетишь: до {formatDistance(flightProfile.glideMeters)}</span><span><i className="long"/>Дальний перелёт: до {formatDistance(flightProfile.longGlideMeters)}</span><span><i className="outside"/>Скорее не долетишь: дальше</span></div>}{flightPlan && <><b className={`reach ${flightPlan.reach}`}>{reachLabel}</b><small>Прыжок: {formatDistance(flightPlan.jumpDistanceMeters)} · ориентир {formatDistance(flightProfile.optimalJumpMeters)}</small></>}{flightProfile.terrainWarning && <small>{flightProfile.terrainWarning}</small>}<small>Оценка зависит от высоты рельефа и техники планирования.</small><button className="reset" onClick={() => setFlightPoints([])}>Задать заново</button></div>}</section>
      <section className="marker-section"><div className="section-title">Метки <button onClick={() => setEnabled(new Set(categories.map(category => category.id)))}>Все</button><button onClick={() => setEnabled(new Set())}>Скрыть</button></div>{!data && <p className="loading">Загружаю метки…</p>}{categories.map(category => { const type = types.get(category.iconKey); return <label className="marker-toggle" key={category.id}><input type="checkbox" checked={enabled.has(category.id)} onChange={() => toggle(category.id)}/><span className="marker-icon" dangerouslySetInnerHTML={{ __html: type?.svg ?? '' }}/><span>{category.label}</span><small>{category.pointCount}</small></label>; })}</section>
      <section className="support"><div className="support-copy"><b>Поддержать автора</b><span>B_I_G_J_I_N</span><small>Наведите камеру на QR-код</small></div><img src="./assets/support-qr.png" alt="QR-код для поддержки автора B_I_G_J_I_N" /></section>
      <footer><b>Автор: B_I_G_J_I_N</b><span>Неофициальный инструмент сообщества. PUBG: BATTLEGROUNDS и материалы игры принадлежат KRAFTON.</span></footer>
    </aside>
    <section ref={stage} className={`stage ${measure ? 'measuring' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (pointers.current.size === 0) setCursor(null); }} onPointerCancel={cancelPointers} onWheel={onWheel}>
      <div ref={canvas} className="canvas">
        <div ref={mapElement} className="map" style={{ left: `calc(50% + ${pan.x}px)`, top: `calc(50% + ${pan.y}px)`, width: `${zoom * 100}%`, height: `${zoom * 100}%`, backgroundImage: `url(./maps/full/${active}.webp)`, '--pin-factor': clamp(zoom, .72, 2.4), '--measure-factor': clamp(zoom, .82, 1.45), '--measure-stroke': .16 / zoom, '--flight-stroke': .55 / zoom, '--flight-dash': 2.1 / zoom } as CSSProperties}>
          <div className="tiles">{level !== null && Array.from({ length: count * count }, (_, index) => { const x = index % count; const y = Math.floor(index / count); return <img key={`${level}-${x}-${y}`} src={`./maps/tiles/${active}/${level}/${x}/${y}.webp`} alt="" loading="lazy" style={{ left: `${x / count * 100}%`, top: `${y / count * 100}%`, width: `${100 / count}%`, height: `${100 / count}%` }}/>; })}</div>
          {grid && <>{isFineGrid ? <div className="grid fine-grid"/> : <><div className="grid km-grid"/><div className="grid-labels">{'ABCDEFGH'.split('').map((letter, i) => <span className="col" style={{ left: `${(i + .5) * 12.5}%` }} key={letter}>{letter}</span>)}{Array.from({ length: 8 }, (_, i) => <span className="row" style={{ top: `${(i + .5) * 12.5}%` }} key={i}>{i + 1}</span>)}</div></>}</>}
          <div className="markers">{groups.filter(group => activeTypeKeys.has(group.typeKey)).flatMap(group => group.points.map((raw, i) => { const point = markerPoint(raw, active); const type = types.get(group.typeKey); return <span key={`${group.typeKey}-${i}`} className="marker-anchor" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} title={`${markerLabel(sourceMap?.name, group, type?.ru ?? group.typeKey)}${group.tag ? ` · ${group.tag}` : ''}`}><span className="pin" dangerouslySetInnerHTML={{ __html: type?.svg ?? '' }}/></span>; }))}</div>
          {measureStart && <svg className="measure-line" viewBox="0 0 100 100">{measureEnd && <line x1={measureStart.x * 100} y1={measureStart.y * 100} x2={measureEnd.x * 100} y2={measureEnd.y * 100}/>}<circle cx={measureStart.x * 100} cy={measureStart.y * 100} r={measureRadius}/>{measureEnd && <circle cx={measureEnd.x * 100} cy={measureEnd.y * 100} r={measureRadius}/>}</svg>}
          {labelPoint && <span className="distance" style={{ left: `${labelPoint.x * 100}%`, top: `${labelPoint.y * 100}%` }}><b>Расстояние</b>{formatDistance(selectedDistance)}</span>}
          {flightPoints.length > 0 && <svg className="flight-overlay" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="plane-arrow" markerUnits="userSpaceOnUse" markerWidth={2.4 / zoom} markerHeight={2.4 / zoom} refX={2.1 / zoom} refY={1.2 / zoom} orient="auto" viewBox="0 0 2.4 2.4"><path d="M0 0 L2.4 1.2 L0 2.4 Z"/></marker></defs>{flightLine && flightBounds && <><line className="corridor corridor-long" x1={flightBounds.startX} y1={flightBounds.startY} x2={flightBounds.endX} y2={flightBounds.endY} strokeWidth={longCorridorWidth}/><line className="corridor corridor-certain" x1={flightBounds.startX} y1={flightBounds.startY} x2={flightBounds.endX} y2={flightBounds.endY} strokeWidth={certainCorridorWidth}/>{[-1, 1].map(side => <line className="corridor-boundary outer" x1={flightBounds.extendedStartX} y1={flightBounds.extendedStartY} x2={flightBounds.extendedEndX} y2={flightBounds.extendedEndY} transform={`translate(${flightBounds.perpendicularX * longCorridorWidth / 2 * side} ${flightBounds.perpendicularY * longCorridorWidth / 2 * side})`} key={`outer-${side}`}/>)}{[-1, 1].map(side => <line className="corridor-boundary inner" x1={flightBounds.extendedStartX} y1={flightBounds.extendedStartY} x2={flightBounds.extendedEndX} y2={flightBounds.extendedEndY} transform={`translate(${flightBounds.perpendicularX * certainCorridorWidth / 2 * side} ${flightBounds.perpendicularY * certainCorridorWidth / 2 * side})`} key={`inner-${side}`}/>) }<line className="plane-path-base" x1={flightBounds.startX} y1={flightBounds.startY} x2={flightBounds.endX} y2={flightBounds.endY}/><line className="plane-path-red" x1={flightBounds.startX} y1={flightBounds.startY} x2={flightBounds.endX} y2={flightBounds.endY}/><circle className="route-point" cx={flightBounds.startX} cy={flightBounds.startY} r={measureRadius}/></>} {flightPlan && <><line className="jump-path" x1={flightPlan.jumpPoint.x * 100} y1={flightPlan.jumpPoint.y * 100} x2={flightPoints[2].x * 100} y2={flightPoints[2].y * 100}/><circle className="jump-point" cx={flightPlan.jumpPoint.x * 100} cy={flightPlan.jumpPoint.y * 100} r={measureRadius * 1.3}/></>} {!flightLine && <circle className="route-point" cx={flightPoints[0].x * 100} cy={flightPoints[0].y * 100} r={measureRadius}/>} {flightPoints[2] && <circle className="landing-point" cx={flightPoints[2].x * 100} cy={flightPoints[2].y * 100} r={measureRadius}/>}</svg>}
          <FlightControlOverlay points={flightPoints} preview={flightMode && flightPoints.length === 1 ? cursor : null}/>
          {flightPoints[2] && <span className="flight-badge target" style={{ left: `${flightPoints[2].x * 100}%`, top: `${flightPoints[2].y * 100}%` }}>Цель</span>}
          {flightPlan && <span className="flight-badge jump" style={{ left: `${flightPlan.jumpPoint.x * 100}%`, top: `${flightPlan.jumpPoint.y * 100}%` }}>Прыжок</span>}
        </div>
      </div>
      <div className="hud"><span>{Math.round(zoom * 100)}%</span>{grid && <span>Сетка: {isFineGrid ? '100 м' : '1 км'}</span>}{measure && <span>{points.length === 1 ? (measureEnd ? formatDistance(selectedDistance) : 'Наведите курсор на вторую точку') : points.length === 2 ? formatDistance(selectedDistance) : 'Выберите первую точку'}</span>}{flightMode && <span>{flightPlan ? `${reachLabel}: ${formatDistance(flightPlan.distanceFromRouteMeters)}` : flightPoints.length < 2 ? 'Задайте линию самолёта' : 'Выберите место посадки'}</span>}</div>
      <div className="zoom"><button onClick={() => setZoom(value => clamp(value * 1.25, 1, 12))}>+</button><button onClick={() => setZoom(value => clamp(value / 1.25, 1, 12))}>−</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>⌖</button></div>
    </section>
  </main>;
}
