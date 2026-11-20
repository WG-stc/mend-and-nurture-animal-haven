import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STYLES, EXPLODE } from './styles.js';
import { Annotations } from './annotations.js';

// 在项目页里用 iframe 嵌入时带 ?embed=1
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');

// ---------- 基本设置 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog(new THREE.Color(), 1400, 4200);

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
controls.minDistance = 15;
controls.maxDistance = 4000;

// ---------- 光照 ----------
const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 10; sc.far = 1600;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);

function setSun(deg) {
  const a = THREE.MathUtils.degToRad(deg);
  const elev = THREE.MathUtils.degToRad(38);
  const r = 700;
  sun.position.set(Math.cos(a) * Math.cos(elev) * r, Math.sin(elev) * r, Math.sin(a) * Math.cos(elev) * r);
}
setSun(+document.getElementById('sun').value);
document.getElementById('sun').addEventListener('input', (e) => setSun(+e.target.value));

// ---------- 分组 ----------
// 分组 id 与 scripts/export_glb.py 里的分组一致
const GROUPS = [
  { id: 'structure', label: 'Structure' },
  { id: 'walls', label: 'Walls' },
  { id: 'facade', label: 'Facade & glazing' },
  { id: 'roof', label: 'Roof' },
  { id: 'slab', label: 'Ground slab' },
  { id: 'circulation', label: 'Stairs' },
  { id: 'railing', label: 'Waterfront railing' },
  { id: 'kennel', label: 'Kennels' },
  { id: 'site', label: 'Site (500 × 500 m)' },
];
const groupNodes = {};      // 分组 id -> [Object3D]
const swatches = {};        // 分组 id -> 色块元素
const entries = [];         // { mesh, material, group, mat, outer }
let outerRoot = null;

let explodeTarget = 0, explodeValue = 0;
const annotations = new Annotations({ camera, controls, scene, groupNodes, explodeHeights: EXPLODE });

const list = document.getElementById('layers');
for (const g of GROUPS) {
  const li = document.createElement('li');
  li.innerHTML = `<span class="sw"></span>${g.label}`;
  swatches[g.id] = li.querySelector('.sw');
  li.addEventListener('click', () => {
    li.classList.toggle('off');
    for (const n of groupNodes[g.id] || []) n.visible = !li.classList.contains('off');
  });
  list.appendChild(li);
}

// 每个「分组 + 材质」用独立的材质对象，这样不同风格可以给同一材质的不同分组上不同颜色
function register(root, outer) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let p = o; while (p && !p.userData.group) p = p.parent;
    const group = outer ? 'site' : (p?.userData.group || 'site');
    const mat = o.material.name;
    const key = `${group}|${mat}`;
    if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ name: key }));
    o.material = cache.get(key);
    o.receiveShadow = true;
    entries.push({ mesh: o, material: o.material, group, mat, outer });
  });
}

// 轮廓线：只给屋顶、墙、狗舍加（面数少，边线清楚），图解风格时显示
const outlines = [];
const outlineMat = new THREE.LineBasicMaterial({ color: '#2a2c2e', transparent: true, opacity: 0.7 });
function addOutlines(ids) {
  for (const id of ids) for (const node of groupNodes[id] || []) {
    node.traverse((o) => {
      if (!o.isMesh) return;
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), outlineMat);
      l.visible = false;
      o.add(l);
      outlines.push(l);
    });
  }
}

// ---------- 风格 ----------
let style = STYLES[new URLSearchParams(location.search).get('style')] ? new URLSearchParams(location.search).get('style') : 'model';
let outerOpacity = 1;

function applyStyle(name) {
  style = name;
  const s = STYLES[name];
  scene.background.set(s.background);
  scene.fog.color.set(s.background);
  scene.fog.near = s.fog[0]; scene.fog.far = s.fog[1];
  hemi.color.set(s.hemi[0]); hemi.groundColor.set(s.hemi[1]); hemi.intensity = s.hemi[2];
  sun.color.set(s.sun[0]); sun.intensity = s.sun[1];
  renderer.toneMappingExposure = s.exposure;
  scene.environment = s.environment ? envMap : null;

  const done = new Set();
  for (const e of entries) {
    const m = e.material;
    if (!done.has(m)) {
      done.add(m);
      const p = s.mat(e.group, e.mat) || { color: '#cccccc' };
      m.color.set(p.color);
      m.roughness = p.roughness ?? 0.8;
      m.metalness = p.metalness ?? 0;
      m.envMapIntensity = s.environment ? (p.env ?? 0.25) : 0;
      m.userData.baseOpacity = p.opacity ?? 1;
      const wasTransparent = m.transparent;
      m.transparent = e.outer || m.userData.baseOpacity < 1;
      m.opacity = m.userData.baseOpacity * (e.outer ? outerOpacity : 1);
      m.depthWrite = m.userData.baseOpacity >= 1 && (!e.outer || outerOpacity > 0.98);
      m.side = m.userData.baseOpacity < 1 || e.group === 'site' ? THREE.DoubleSide : THREE.FrontSide;
      if (wasTransparent !== m.transparent) m.needsUpdate = true;
    }
    const transparent = e.material.userData.baseOpacity < 1;
    e.mesh.castShadow = !e.outer && e.group !== 'site' && !transparent;
    e.mesh.renderOrder = transparent ? 2 : 0;
  }
  for (const g of GROUPS) swatches[g.id].style.background = s.swatch[g.id];
  document.querySelectorAll('#style button').forEach((b) => b.classList.toggle('active', b.dataset.style === name));
  for (const l of outlines) l.visible = !!s.outlines;
  annotations.setEnabled(name === 'diagram');
  document.body.classList.toggle('diagram', name === 'diagram');
  setExplode(s.explode);
  const u = new URL(location.href); u.searchParams.set('style', name); history.replaceState(null, '', u);
}

document.querySelectorAll('#style button').forEach((b) => b.addEventListener('click', () => applyStyle(b.dataset.style)));
document.querySelectorAll('#notes button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('#notes button').forEach((x) => x.classList.toggle('active', x === b));
    annotations.setMode(b.dataset.mode);
  })
);

// ---------- 分层展开 ----------
const explodeBtn = document.getElementById('explode');
function setExplode(on) {
  const changed = explodeTarget !== (on ? 1 : 0);
  explodeTarget = on ? 1 : 0;
  if (changed && currentView && currentView !== 'overview' && currentView !== 'eye') goTo(currentView);
  explodeBtn.classList.toggle('active', on);
  explodeBtn.textContent = on ? 'Collapse layers' : 'Explode layers';
}
explodeBtn.addEventListener('click', () => setExplode(explodeTarget === 0));

function updateExplode(dt) {
  if (Math.abs(explodeValue - explodeTarget) < 1e-3) return;
  explodeValue += Math.sign(explodeTarget - explodeValue) * Math.min(Math.abs(explodeTarget - explodeValue), dt / 0.9);
  const k = explodeValue < 0.5 ? 2 * explodeValue ** 2 : 1 - (-2 * explodeValue + 2) ** 2 / 2;
  for (const [id, h] of Object.entries(EXPLODE)) for (const n of groupNodes[id] || []) n.position.y = h * k;
  annotations.explode = k;
}

// ---------- 加载模型 ----------
const loader = new GLTFLoader();
const loadingEl = document.getElementById('loading');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');

loader.load(
  'models/building.glb',
  (gltf) => {
    const root = gltf.scene;
    for (const child of root.children) (groupNodes[child.userData.group || child.name] ||= []).push(child);
    register(root, false);
    scene.add(root);
    addOutlines(['roof', 'walls', 'kennel']);
    annotations.measure();
    applyStyle(style);
    loadingEl.classList.add('done');
    loadOuter();
  },
  (e) => {
    // GitHub Pages 用 gzip 传输时 total 是压缩后的大小，loaded 却按解压后计，所以不用 total
    const MODEL_MB = 20.7; // building.glb 解压后大小，用于估算进度
    const mb = e.loaded / 1048576;
    loadingBar.style.width = `${Math.min(98, (mb / MODEL_MB) * 100).toFixed(0)}%`;
    loadingText.textContent = `Loading model… ${mb.toFixed(1)} / ${MODEL_MB} MB`;
  },
  (err) => { loadingText.textContent = 'Failed to load model'; console.error(err); }
);

function loadOuter() {
  loader.load('models/site_outer.glb', (gltf) => {
    outerRoot = gltf.scene;
    register(outerRoot, true);
    scene.add(outerRoot);
    applyStyle(style);
    updateOuter(true);
  });
}

// ---------- 外围场地：远看显示，近看淡出 ----------
let outerMode = 'auto';
const FADE_DEFAULT = [650, 1000];

function updateOuter(force = false) {
  if (!outerRoot) return;
  let target;
  if (outerMode === 'show') target = 1;
  else if (outerMode === 'hide') target = 0;
  else {
    const [near, far] = STYLES[style].outerFade || FADE_DEFAULT;
    target = THREE.MathUtils.smoothstep(camera.position.distanceTo(controls.target), near, far);
  }
  if (!force && Math.abs(target - outerOpacity) < 0.005) return;
  outerOpacity = target;
  outerRoot.visible = target > 0.01;
  for (const e of entries) {
    if (!e.outer) continue;
    e.material.opacity = e.material.userData.baseOpacity * target;
    e.material.depthWrite = target > 0.98;
  }
}

document.querySelectorAll('#outer-mode button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('#outer-mode button').forEach((x) => x.classList.toggle('active', x === b));
    outerMode = b.dataset.mode;
    updateOuter(true);
  })
);

// ---------- 预设视角 ----------
// 坐标：原点在 500×500 切割框中心，Y 向上，单位米
const VIEWS = {
  overview: { pos: [980, 820, 1180], target: [0, 0, 0] },
  building: { pos: [300, 250, 380], target: [15, 0, 10] },
  kennel: { pos: [215, 85, 250], target: [90, 0, 85] },
  eye: { pos: [70, 3, 250], target: [40, 6, 120] },
};

// 分层展开时整栋叠起来约 190 m 高，镜头要退远、抬高
const VIEWS_EXPLODED = {
  building: { pos: [470, 285, 470], target: [125, 92, 75] },
  kennel: { pos: [330, 170, 420], target: [70, 60, 70] },
};

let tween = null;
let currentView = null;
function goTo(name, instant = false) {
  currentView = name;
  const v = (explodeTarget === 1 && VIEWS_EXPLODED[name]) || VIEWS[name];
  const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
  document.querySelectorAll('.views button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (instant) {
    camera.position.copy(to.pos); controls.target.copy(to.target); controls.update(); return;
  }
  tween = { t: 0, from: { pos: camera.position.clone(), target: controls.target.clone() }, to };
}
document.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.view)));
controls.addEventListener('start', () => { tween = null; });
applyStyle(style);
// 初始视角可用网址参数指定，例如 ?view=building
const startView = new URLSearchParams(location.search).get('view');
goTo(VIEWS[startView] ? startView : 'overview', true);

// 调试用：在浏览器控制台里可以拿到相机和场景
window.__haven = { THREE, camera, controls, scene, renderer };

const northEl = document.getElementById('north');

// ---------- 渲染循环 ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 1.6);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
    camera.position.lerpVectors(tween.from.pos, tween.to.pos, k);
    controls.target.lerpVectors(tween.from.target, tween.to.target, k);
    if (tween.t >= 1) tween = null;
  }
  controls.update();
  updateOuter();
  updateExplode(dt);
  annotations.update(innerWidth, innerHeight);
  // 指北针：模型的 -Z 是正北（地理参照见 models/georef.json，模型与正北夹角 0°）
  northEl.style.transform = `rotate(${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle())}deg)`;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
