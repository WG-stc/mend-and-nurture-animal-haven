import * as THREE from 'three';

// ---------------------------------------------------------------
// 标注内容，文字取自作品集 MEND & NURTURE ANIMAL HAVEN（第 15、17、18 页）。
// 坐标为网页坐标：原点在 500×500 切割框中心，x 向东，z 向南，单位米。
// 功能编号位置是对照第 15 页首层平面在俯视图上定的，可以在这里微调。
// ---------------------------------------------------------------

// 分层展开时的层（自上而下），groups 对应 export_glb.py 的分组
export const LAYERS = [
  { id: 'roof', name: 'ROOF', groups: ['roof'] },
  {
    id: 'structure', name: 'STRUCTURE', groups: ['structure'],
    text: 'A simple steel structure is used to support the roof, whose shape is based on the layout of the dog kennels.',
  },
  {
    id: 'facade', name: 'MONSOON WINDOW', groups: ['facade'],
    text: 'For monsoon’s heavy rain and strong winds, such windows ensure good sealing. The dog kennel has adjustable vents for ventilation and keeps rainwater out on rainy days.',
  },
  {
    id: 'ground', name: 'GROUND FLOOR', groups: ['walls', 'kennel', 'circulation', 'slab'],
    text: 'Nestled on an open lawn with abundant natural conditions, the building aligns with animals’ habits, helping stressed stray animals regain survival abilities and social skills.',
  },
];

// 首层功能（第 15 页 Ground floor plan）
export const PROGRAM = [
  [1, 'Staff Office', -78, -131],
  [2, 'Training Dog Kennel', -116, -115],
  [3, 'Training Space', -78, -107],
  [4, 'Disinfection', -98, -82],
  [5, 'Resting Room', -25, -62],
  [6, 'Animal Adoption Center', 77, -115],
  [7, 'Integrated Service Area', 105, -99],
  [8, 'Exhibition', 85, -78],
  [9, 'Volunteer Center', 113, -66],
  [10, 'Animal Pampering Salon', 142, -72],
  [11, 'Animal Photography Studio', 170, -58],
  [12, 'Pet-welcome Restaurant', 172, -34],
  [13, 'Pet Genetic and Wellness Center', 147, -26],
  [14, 'Pet-themed Workshop', 129, -22],
  [15, 'Pet Boutique', 109, -12],
  [16, 'Animal Hospital', 93, -42],
  [17, 'Cattery', 42, -38],
  [18, 'Resting Room', 24, -1],
  [19, 'Animal Hospital for Humane Centre', 89, 35],
  [20, 'Dog Activity Space', 0, 43],
  [21, 'Kennel', 36, 100],
  [22, 'Food Transportation', 48, 145],
  [23, 'Water-front Platform', 138, 153],
].map(([n, name, x, z]) => ({ n, name, x, z }));

// 故事标注（第 17 页黑底白字说明），dx/dy 为文字框相对锚点的屏幕偏移
export const STORIES = [
  { at: 21, dx: -330, dy: 40, text: 'The winding kennels boost visitors’ exploration interest, reduce dogs’ eye contact, minimize conflicts, and improve their shelter life.' },
  { at: 17, dx: -330, dy: -150, text: 'Elevated catteries prevent cat-dog conflicts. Cats get dedicated indoor activity and climbing spaces, fitting their nature.' },
  { at: 23, dx: 60, dy: 40, text: 'Walk the waterfront trail for views and sunshine, and visit the kennel-adjacent dog play area to interact with dogs.' },
  { at: 12, dx: 70, dy: -40, text: 'Pet-friendly facilities and a pet-themed café boost foot traffic and raise animal care awareness.' },
  { at: 6, dx: 40, dy: -170, text: 'There is an adoption office inside the shelter. Visitors can select a trained cat or dog they like to be their companion.' },
  { at: 3, dx: -300, dy: -150, text: 'Specialized training setups improve dogs’ fitness and deepen their connection to people.' },
];

// ---------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Annotations {
  constructor({ camera, controls, scene, groupNodes, explodeHeights }) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene;
    this.groupNodes = groupNodes;
    this.explodeHeights = explodeHeights;
    this.enabled = false;
    this.mode = 'program';          // program | stories | off
    this.explode = 0;
    this.layerBoxes = {};

    this.root = document.getElementById('annotations');
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'ann-lines');
    this.root.appendChild(this.svg);

    this.layerEls = LAYERS.map((l) => {
      const el = document.createElement('div');
      el.className = 'ann-layer';
      el.innerHTML = `<b>${l.name}</b>${l.text ? `<p>${l.text}</p>` : ''}`;
      this.root.appendChild(el);
      const line = document.createElementNS(SVG_NS, 'polyline');
      this.svg.appendChild(line);
      return { def: l, el, line };
    });

    this.programEls = PROGRAM.map((p) => {
      const el = document.createElement('div');
      el.className = 'ann-dot';
      el.textContent = p.n;
      el.title = p.name;
      el.dataset.n = p.n;
      this.root.appendChild(el);
      return { def: p, el, pos: new THREE.Vector3(p.x, 1.2, p.z) };
    });

    this.storyEls = STORIES.map((s) => {
      const p = PROGRAM.find((q) => q.n === s.at);
      const el = document.createElement('div');
      el.className = 'ann-story';
      el.textContent = s.text;
      this.root.appendChild(el);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'story');
      this.svg.appendChild(line);
      return { def: s, el, line, pos: new THREE.Vector3(p.x, 1.2, p.z) };
    });

    // 图例
    const legend = document.getElementById('legend');
    legend.innerHTML = '<h3>Ground floor plan</h3><ol>' +
      PROGRAM.map((p) => `<li data-n="${p.n}"><span>${p.n}</span>${p.name}</li>`).join('') + '</ol>';
    legend.querySelectorAll('li').forEach((li) => {
      const dot = this.programEls[+li.dataset.n - 1].el;
      li.addEventListener('mouseenter', () => dot.classList.add('hot'));
      li.addEventListener('mouseleave', () => dot.classList.remove('hot'));
    });
    this.programEls.forEach(({ el }) => {
      const li = legend.querySelector(`li[data-n="${el.dataset.n}"]`);
      el.addEventListener('mouseenter', () => li.classList.add('hot'));
      el.addEventListener('mouseleave', () => li.classList.remove('hot'));
    });
    this.legend = legend;

    // 层与层之间的竖向虚线（第 18 页的做法）
    this.dashMat = new THREE.LineDashedMaterial({ color: '#2a2c2e', dashSize: 2.2, gapSize: 2.2, transparent: true, opacity: 0.55 });
    this.dashGeo = new THREE.BufferGeometry();
    this.dashes = new THREE.LineSegments(this.dashGeo, this.dashMat);
    this.dashes.frustumCulled = false;
    this.dashes.visible = false;
    scene.add(this.dashes);
    this.columns = [];
    fetch('models/columns.json').then((r) => r.json()).then((d) => { this.columns = pickSpread(d.columns, 30); });
  }

  // 模型加载后、展开前调用：记录每层的包围盒
  measure() {
    for (const l of LAYERS) {
      const box = new THREE.Box3();
      for (const g of l.groups) for (const n of this.groupNodes[g] || []) box.expandByObject(n);
      this.layerBoxes[l.id] = box;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('on', on);
    this.legend.classList.toggle('on', on && this.mode === 'program');
  }

  setMode(mode) {
    this.mode = mode;
    this.legend.classList.toggle('on', this.enabled && mode === 'program');
  }

  layerOffset(id) {
    const l = LAYERS.find((q) => q.id === id);
    return Math.max(...l.groups.map((g) => this.explodeHeights[g] || 0)) * this.explode;
  }

  update(width, height) {
    const cam = this.camera;
    const dist = cam.position.distanceTo(this.controls.target);
    const show = (el, on) => { el.style.display = on ? '' : 'none'; };
    const v = new THREE.Vector3();
    const toScreen = (p) => {
      v.copy(p).project(cam);
      return { x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height, ok: v.z < 1 && v.z > -1 };
    };
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // 竖向虚线
    const ex = this.enabled && this.explode > 0.02;
    this.dashes.visible = ex && this.columns.length > 0;
    if (this.dashes.visible) {
      const top = this.layerOffset('roof') + 8;
      const pos = new Float32Array(this.columns.length * 6);
      this.columns.forEach(([x, z], i) => pos.set([x, 0, z, x, top, z], i * 6));
      this.dashGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.dashes.computeLineDistances();
      this.dashMat.opacity = 0.55 * Math.min(1, this.explode * 1.5);
    }

    // 层标注：从每层最东端向右引出水平线，文字靠右对齐成一列
    // 右侧面板约 250px 宽，层名列放在它左边
    const labelX = width - 300 - 250;
    let prevBottom = -Infinity;     // 上一个层名的下边缘，用来避免上下重叠
    for (const { def, el, line } of this.layerEls) {   // LAYERS 自上而下排列
      const box = this.layerBoxes[def.id];
      const on = ex && box && !box.isEmpty();
      show(el, on); line.style.display = on ? '' : 'none';
      if (!on) continue;
      const y = (box.min.y + box.max.y) / 2 + this.layerOffset(def.id);
      const a = toScreen(new THREE.Vector3(box.max.x, y, (box.min.z + box.max.z) / 2));
      // 层名放在层的右侧，但不超过右侧面板左边界；与上一个层名至少隔开 10px
      const x2 = Math.min(Math.max(a.x + 40, labelX), width - 290 - 230);
      const ly = Math.max(a.y, prevBottom + 36);
      prevBottom = ly - 26 + el.offsetHeight;
      // 引线：从层边缘斜向接到层名下划线，再水平延伸
      line.setAttribute('points', `${a.x},${a.y} ${x2},${ly} ${x2 + 230},${ly}`);
      el.style.transform = `translate(${x2}px, ${ly - 26}px)`;
      el.style.opacity = Math.min(1, this.explode * 1.5);
    }

    // 功能编号
    const showProgram = this.enabled && this.mode === 'program' && dist < 1100;
    for (const p of this.programEls) {
      const s = toScreen(p.pos);
      show(p.el, showProgram && s.ok);
      if (showProgram) p.el.style.transform = `translate(${s.x - 10}px, ${s.y - 10}px)`;
    }

    // 故事标注
    const showStories = this.enabled && this.mode === 'stories' && dist < 1100;
    for (const st of this.storyEls) {
      const s = toScreen(st.pos);
      const on = showStories && s.ok;
      show(st.el, on); st.line.style.display = on ? '' : 'none';
      if (!on) continue;
      // 文字框限制在空白区：避开右侧面板（约 280px）、顶部标题和底部视角栏
      const w = st.el.offsetWidth, h = st.el.offsetHeight;
      const bx = THREE.MathUtils.clamp(s.x + st.def.dx, 20, width - 290 - w);
      const by = THREE.MathUtils.clamp(s.y + st.def.dy, 80, height - 90 - h);
      st.el.style.transform = `translate(${bx}px, ${by}px)`;
      const ex2 = Math.min(Math.max(s.x, bx), bx + w), ey2 = Math.min(Math.max(s.y, by), by + h);
      st.line.setAttribute('x1', s.x); st.line.setAttribute('y1', s.y);
      st.line.setAttribute('x2', ex2); st.line.setAttribute('y2', ey2);
    }
  }
}

// 从所有柱子里挑出分布最散的 n 根（最远点采样），虚线不会挤在一起
function pickSpread(cols, n) {
  if (!cols.length) return [];
  const picked = [cols[0]];
  const d = cols.map((c) => Infinity);
  while (picked.length < Math.min(n, cols.length)) {
    const last = picked[picked.length - 1];
    let best = 0;
    cols.forEach((c, i) => {
      d[i] = Math.min(d[i], Math.hypot(c[0] - last[0], c[1] - last[1]));
      if (d[i] > d[best]) best = i;
    });
    picked.push(cols[best]);
  }
  return picked;
}
