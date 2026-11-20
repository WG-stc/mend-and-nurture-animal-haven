// 项目页「Site」章节的地图：从苏州全城飞到场地，把三维模型按真实位置和尺寸放在卫星影像上。
// 地理参照来自 scripts/georef.py（模型场地水面与 OpenStreetMap 水面对齐）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STYLES } from './styles.js';
import { TIANDITU_KEY } from './map-config.js';

const maplibregl = window.maplibregl;
const CITY = { center: [120.645, 31.305], zoom: 10.6, pitch: 0, bearing: 0 };

function esriStyle() {
  return {
    version: 8,
    sources: {
      imagery: {
        type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
      labels: {
        type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      },
    },
    layers: [
      { id: 'imagery', type: 'raster', source: 'imagery' },
      { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.85 } },
    ],
  };
}

function tiandituStyle(key) {
  const url = (layer) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
    `https://t${i}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`);
  return {
    version: 8,
    sources: {
      imagery: { type: 'raster', tileSize: 256, maxzoom: 18, tiles: url('img'), attribution: '影像 © 天地图' },
      labels: { type: 'raster', tileSize: 256, maxzoom: 18, tiles: url('cia') },
    },
    layers: [
      { id: 'imagery', type: 'raster', source: 'imagery' },
      { id: 'labels', type: 'raster', source: 'labels' },
    ],
  };
}

// ---------- 三维模型图层 ----------
function modelLayer(geo) {
  const mc = maplibregl.MercatorCoordinate.fromLngLat(geo.origin_lnglat, 0);
  const s = mc.meterInMercatorCoordinateUnits() * geo.meters_per_unit;
  // 模型坐标：x 东、y 上、z 南（glTF）；转到墨卡托：x 东、y 南、z 上
  const transform = new THREE.Matrix4()
    .makeTranslation(mc.x, mc.y, mc.z)
    .scale(new THREE.Vector3(s, -s, s))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(geo.rotation_deg)));

  let map, renderer, root = null, loading = false;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  // 卫星图上偏白的模型需要更强的明暗对比
  scene.add(new THREE.HemisphereLight('#ffffff', '#6f7a5c', 1.0));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.8);
  sun.position.set(-0.6, 0.8, 0.5);
  scene.add(sun);

  return {
    id: 'haven-3d', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      if (root) scene.add(root);
    },
    // 推近到场地附近才加载模型（约 21 MB）
    ensureLoaded() {
      if (root || loading) return;
      loading = true;
      new GLTFLoader().load('models/building.glb', (gltf) => {
        root = gltf.scene;
        const style = STYLES.model;
        root.traverse((o) => {
          if (!o.isMesh) return;
          let p = o; while (p && !p.userData.group) p = p.parent;
          const group = p?.userData.group;
          const look = style.mat(group, o.material.name) || { color: '#eeeeee' };
          o.material = new THREE.MeshStandardMaterial({
            color: look.color, roughness: look.roughness ?? 0.8,
            transparent: (look.opacity ?? 1) < 1, opacity: look.opacity ?? 1,
            depthWrite: (look.opacity ?? 1) >= 1,
          });
        });
        // 场地底板不画，让卫星影像露出来
        root.traverse((o) => { if (o.userData.group === 'site') o.visible = false; });
        scene.add(root);
        map?.triggerRepaint();
      });
    },
    render(gl, matrix) {
      if (!root) return;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(transform);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}

// ---------- 地图 ----------
export async function initSiteMap(container) {
  const geo = await fetch('models/georef.json').then((r) => r.json());
  const map = new maplibregl.Map({
    container, style: esriStyle(), ...CITY,
    maxPitch: 70, cooperativeGestures: true, attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  const layer = modelLayer(geo);

  // 每次换底图（setStyle）后重新加上场地框和模型
  function addOverlays() {
    if (map.getSource('site-box')) return;
    map.addSource('site-box', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: geo.site_box_lnglat } },
    });
    map.addLayer({ id: 'site-box', type: 'line', source: 'site-box', paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-dasharray': [3, 2] } });
    map.addLayer(layer);
  }
  map.on('style.load', addOverlays);

  // 场地标记（远看时显示）
  const el = document.createElement('div');
  el.className = 'site-pin';
  el.innerHTML = '<span>Mend &amp; Nurture Animal Haven</span>';
  new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(geo.origin_lnglat).addTo(map);
  const syncPin = () => { el.classList.toggle('far', map.getZoom() < 15); };
  map.on('zoom', syncPin); syncPin();

  // 推近到场地附近才加载模型
  map.on('zoom', () => { if (map.getZoom() > 14) layer.ensureLoaded(); });

  // Esri 加载失败时换天地图（需要在 map-config.js 填 key）
  let esriOk = false, esriErrors = 0, switched = false;
  map.on('sourcedata', (e) => { if (e.sourceId === 'imagery' && e.tile) esriOk = true; });
  map.on('error', (e) => {
    if (switched || esriOk || e.sourceId !== 'imagery') return;
    if (++esriErrors >= 4) useTianditu();
  });
  setTimeout(() => { if (!esriOk && !switched) useTianditu(); }, 8000);
  function useTianditu() {
    if (switched || !TIANDITU_KEY) return;
    switched = true;
    map.setStyle(tiandituStyle(TIANDITU_KEY));
  }

  const SITE = { center: geo.origin_lnglat, zoom: 15.6, pitch: 0, bearing: 0 };
  const VIEW3D = { center: geo.origin_lnglat, zoom: 16.4, pitch: 60, bearing: -28 };
  const go = (v, dur = 4000) => map.flyTo({ ...v, duration: dur, essential: true });
  return {
    map,
    city: () => go(CITY, 3000),
    site: () => go(SITE),
    view3d: () => go(VIEW3D, 3500),
    // 第一次滚动到地图时自动从全城飞到场地，再转成三维
    intro() {
      go(SITE, 5000);
      map.once('moveend', () => setTimeout(() => go(VIEW3D, 3500), 600));
    },
  };
}
