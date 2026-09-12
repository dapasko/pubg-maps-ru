'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { distanceMeters, gridStepMeters } from '../lib/map-geometry.mjs';

type MapInfo = { id: string; name: string; sizeKm: number };
type MarkerType = { key: string; ru: string; color: string; svg: string };
type MarkerGroup = { typeKey: string; tag: string | null; points: [number, number][] };
type MarkerMap = { name: string; groups: MarkerGroup[] };
type MarkerData = { types: MarkerType[]; maps: MarkerMap[] };
type Point = { x: number; y: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const mapName: Record<string, string> = { erangel: 'Erangel', miramar: 'Miramar', vikendi: 'Vikendi', taego: 'Taego', deston: 'Deston', rondo: 'Rondo' };
// Marker data is referenced to the playable grid, while the rendered source
// images include a 160 m southern frame. Correct northing for all 8 km maps.
const markerNorthingCorrection = 5.12;

function tileLevel(zoom: number) {
  if (zoom < 2) return null;
  return zoom < 4 ? 3 : 4;
}
function formatDistance(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(2)} км` : `${Math.round(value)} м`; }

export default function Home() {
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [data, setData] = useState<MarkerData | null>(null);
  const [active, setActive] = useState('erangel');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [grid, setGrid] = useState(true);
  const [measure, setMeasure] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [sidebar, setSidebar] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);

  useEffect(() => { void fetch('./data/maps.json').then(r => r.json()).then((v: MapInfo[]) => setMaps(v)); }, []);
  useEffect(() => { void fetch('./data/markers.json').then(r => r.json()).then((v: MarkerData) => setData(v)); }, []);

  const selected = maps.find(map => map.id === active) ?? maps[0];
  const sourceMap = data?.maps.find(map => map.name === mapName[active]);
  const groups = sourceMap?.groups ?? [];
  const types = useMemo(() => new Map(data?.types.map(type => [type.key, type]) ?? []), [data]);
  const categories = useMemo(() => groups.filter((group, index, all) => all.findIndex(item => item.typeKey === group.typeKey) === index), [groups]);
  const level = tileLevel(zoom);
  const count = level === null ? 0 : 2 ** level;
  const isFineGrid = gridStepMeters(zoom) === 100;
  const activePoints = points.length === 2 ? points : [];
  const measureStart = points[0] ?? null;
  const measureEnd = activePoints[1] ?? (measure && points.length === 1 ? cursor : null);
  const selectedDistance = measureStart && measureEnd ? distanceMeters(measureStart, measureEnd) : 0;
  // Keep endpoints as precise, unobtrusive reference dots at every zoom level.
  const measureRadius = clamp(.34 * clamp(zoom, .8, 1.1) / zoom, .03, .38);
  const labelPoint = measureStart && measureEnd ? {
    x: measureStart.x + (measureEnd.x - measureStart.x) * .25,
    y: measureStart.y + (measureEnd.y - measureStart.y) * .25,
  } : null;

  useEffect(() => {
    setPoints([]); setZoom(1); setPan({ x: 0, y: 0 });
    const map = data?.maps.find(item => item.name === mapName[active]);
    setEnabled(new Set(map?.groups.slice(0, 1).map(group => group.typeKey) ?? []));
  }, [active, data]);

  const mapPoint = (event: { clientX: number; clientY: number }): Point | null => {
    const r = canvas.current?.getBoundingClientRect(); if (!r) return null;
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  };
  const onDown = (event: PointerEvent<HTMLDivElement>) => { if (event.button === 0) drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false }; };
  const onMove = (event: PointerEvent<HTMLDivElement>) => { const d = drag.current; if (d) { const dx = event.clientX - d.x; const dy = event.clientY - d.y; if (Math.hypot(dx, dy) > 4) d.moved = true; setPan({ x: d.panX + dx, y: d.panY + dy }); return; } if (measure) setCursor(mapPoint(event)); };
  const onUp = (event: PointerEvent<HTMLDivElement>) => { const d = drag.current; drag.current = null; if (!d?.moved && measure) { const point = mapPoint(event); if (point) { setCursor(point); setPoints(current => current.length === 1 ? [...current, point] : [point]); } } };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); setZoom(value => clamp(value * (event.deltaY < 0 ? 1.2 : .84), .7, 12)); };
  const chooseMap = (id: string) => { setActive(id); setSidebar(false); };
  const toggle = (key: string) => setEnabled(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });

  return <main className="shell">
    <header className="topbar">
      <button className="brand" onClick={() => setSidebar(value => !value)} aria-label="Открыть карты и метки"><span>КАРТЫ</span><b>PUBG</b><i>RU</i></button>
      <div className="title"><strong>{selected?.name ?? 'Загрузка…'}</strong><span>8 × 8 км</span></div>
      <div className="hint"><kbd>Колесо</kbd> масштаб <i/> <kbd>ЛКМ</kbd> перемещение</div>
    </header>
    <aside className={`panel ${sidebar ? 'open' : ''}`}>
      <section><div className="section-title">Карты <small>6 локаций</small></div><div className="maps">{maps.map(map => <button className={map.id === active ? 'chosen' : ''} key={map.id} onClick={() => chooseMap(map.id)}><img src={`./maps/thumb/${map.id}.webp`} alt=""/><span>{map.name}</span><small>8 км</small></button>)}</div></section>
      <section><div className="section-title">Инструменты</div><label className="toggle"><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)}/><span/>Сетка координат</label><label className="toggle"><input type="checkbox" checked={measure} onChange={event => { setMeasure(event.target.checked); setPoints([]); setCursor(null); }}/><span/>Измерить расстояние</label>{measure && <p className="measure-help">Первая точка — затем наведите курсор и выберите вторую</p>}{points.length > 0 && <button className="reset" onClick={() => { setPoints([]); setCursor(null); }}>Сбросить измерение</button>}</section>
      <section className="marker-section"><div className="section-title">Метки <button onClick={() => setEnabled(new Set(categories.map(group => group.typeKey)))}>Все</button><button onClick={() => setEnabled(new Set())}>Скрыть</button></div>{!data && <p className="loading">Загружаю метки…</p>}{categories.map(group => { const type = types.get(group.typeKey); return <label className="marker-toggle" key={group.typeKey}><input type="checkbox" checked={enabled.has(group.typeKey)} onChange={() => toggle(group.typeKey)}/><span className="marker-icon" dangerouslySetInnerHTML={{ __html: type?.svg ?? '' }}/><span>{type?.ru ?? group.typeKey}</span><small>{group.points.length}</small></label>; })}</section>
      <footer><b>Неофициальный инструмент сообщества</b><span>PUBG: BATTLEGROUNDS и материалы игры принадлежат KRAFTON.</span></footer>
    </aside>
    <section ref={stage} className={`stage ${measure ? 'measuring' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setCursor(null)} onPointerCancel={() => { drag.current = null; setCursor(null); }} onWheel={onWheel}>
      <div ref={canvas} className="canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <div className="map" style={{ backgroundImage: `url(./maps/full/${active}.webp)`, '--pin-factor': clamp(zoom, .72, 2.4) / zoom, '--measure-factor': clamp(zoom, .82, 1.45) / zoom, '--measure-stroke': .16 / zoom } as CSSProperties}>
          <div className="tiles">{level !== null && Array.from({ length: count * count }, (_, index) => { const x = index % count; const y = Math.floor(index / count); return <img key={`${level}-${x}-${y}`} src={`./maps/tiles/${active}/${level}/${x}/${y}.webp`} alt="" loading="lazy" style={{ left: `${x / count * 100}%`, top: `${y / count * 100}%`, width: `${100 / count}%`, height: `${100 / count}%` }}/>; })}</div>
          {grid && <>{isFineGrid ? <div className="grid fine-grid"/> : <><div className="grid km-grid"/><div className="grid-labels">{'ABCDEFGH'.split('').map((letter, i) => <span className="col" style={{ left: `${(i + .5) * 12.5}%` }} key={letter}>{letter}</span>)}{Array.from({ length: 8 }, (_, i) => <span className="row" style={{ top: `${(i + .5) * 12.5}%` }} key={i}>{i + 1}</span>)}</div></>}</>}
          <div className="markers">{groups.filter(group => enabled.has(group.typeKey)).flatMap(group => group.points.map((raw, i) => { const x = clamp(raw[1] / 256 * 100, 0, 100); const y = clamp((-raw[0] - markerNorthingCorrection) / 256 * 100, 0, 100); const type = types.get(group.typeKey); return <span key={`${group.typeKey}-${i}`} className="marker-anchor" style={{ left: `${x}%`, top: `${y}%` }} title={`${type?.ru ?? group.typeKey}${group.tag ? ` · ${group.tag}` : ''}`}><span className="pin" dangerouslySetInnerHTML={{ __html: type?.svg ?? '' }}/></span>; }))}</div>
          {measureStart && <svg className="measure-line" viewBox="0 0 100 100">{measureEnd && <line x1={measureStart.x * 100} y1={measureStart.y * 100} x2={measureEnd.x * 100} y2={measureEnd.y * 100}/>}<circle cx={measureStart.x * 100} cy={measureStart.y * 100} r={measureRadius}/>{measureEnd && <circle cx={measureEnd.x * 100} cy={measureEnd.y * 100} r={measureRadius}/>}</svg>}
          {labelPoint && <span className="distance" style={{ left: `${labelPoint.x * 100}%`, top: `${labelPoint.y * 100}%` }}><b>Расстояние</b>{formatDistance(selectedDistance)}</span>}
        </div>
      </div>
      <div className="hud"><span>{Math.round(zoom * 100)}%</span>{grid && <span>Сетка: {isFineGrid ? '100 м' : '1 км'}</span>}{measure && <span>{points.length === 1 ? (measureEnd ? formatDistance(selectedDistance) : 'Наведите курсор на вторую точку') : points.length === 2 ? formatDistance(selectedDistance) : 'Выберите первую точку'}</span>}</div>
      <div className="zoom"><button onClick={() => setZoom(value => clamp(value * 1.25, .7, 12))}>+</button><button onClick={() => setZoom(value => clamp(value / 1.25, .7, 12))}>−</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>⌖</button></div>
    </section>
  </main>;
}
