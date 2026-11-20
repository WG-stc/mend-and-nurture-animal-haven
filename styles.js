// 三种视觉风格。
// mat(group, material) 返回该分组该材质的外观；group 与 scripts/export_glb.py 的分组一致，
// material 为导出时的材质名：white concrete roof metal glass wire ground lawn water road house。
// 框外场地按 site 处理。env：环境反射强度（只在开启环境贴图的风格里生效，默认 0.25）。

const SITE = (p) => ({ ground: p[0], lawn: p[1], water: p[2], road: p[3], house: p[4] });

export const STYLES = {
  // 纯白模型风：像实体模型，只有狗舍用一种强调色
  model: {
    label: 'Model',
    background: '#f2f1ed',
    fog: [1500, 4500],
    hemi: ['#ffffff', '#d4d1c9', 1.45],
    sun: ['#ffffff', 3.0],
    exposure: 1.0,
    environment: false,
    explode: false,
    mat(group, m) {
      if (group === 'site') {
        const c = SITE(['#e7e5df', '#dedcd4', '#cdd5d8', '#eceae5', '#efeeea'])[m];
        return { color: c, roughness: 0.95 };
      }
      if (group === 'kennel') {
        if (m === 'wire') return { color: '#d9895c', opacity: 0.5 };
        return { color: '#df8d5f', roughness: 0.8 };
      }
      return {
        white: { color: '#f5f4f0', roughness: 0.9 },
        concrete: { color: '#eceae5', roughness: 0.9 },
        roof: { color: '#f7f6f2', roughness: 0.85 },
        metal: { color: '#b7b6b1', roughness: 0.7 },
        glass: { color: '#e4ebed', opacity: 0.32, roughness: 0.2 },
        wire: { color: '#c4c3be', opacity: 0.5 },
      }[m];
    },
    swatch: { structure: '#eceae5', walls: '#f5f4f0', facade: '#e4ebed', roof: '#f7f6f2', slab: '#eceae5', circulation: '#eceae5', railing: '#b7b6b1', kennel: '#df8d5f', site: '#dedcd4' },
  },

  // 半写实：玻璃和金属有反射，草地、水面接近真实颜色
  realistic: {
    label: 'Realistic',
    background: '#dde5e9',
    fog: [1200, 4200],
    hemi: ['#eef4ff', '#6f7d58', 0.55],
    sun: ['#fff0d8', 3.4],
    exposure: 0.95,
    environment: true,
    explode: false,
    mat(group, m) {
      if (group === 'site') {
        return {
          ground: { color: '#b5b29c', roughness: 0.95 },
          lawn: { color: '#6b8549', roughness: 0.95 },
          water: { color: '#4f6f7c', roughness: 0.06, metalness: 0.2, env: 1 },
          road: { color: '#9b9a95', roughness: 0.9 },
          house: { color: '#d6d4cd', roughness: 0.85 },
        }[m];
      }
      if (group === 'kennel' && m === 'white') return { color: '#e3ddd2', roughness: 0.8 };
      return {
        white: { color: '#ebe9e3', roughness: 0.75 },
        concrete: { color: '#c7c3ba', roughness: 0.85 },
        roof: { color: '#efefec', roughness: 0.45, metalness: 0.05, env: 0.6 },
        metal: { color: '#3c4043', roughness: 0.35, metalness: 0.8, env: 1 },
        glass: { color: '#a9c3c9', opacity: 0.38, roughness: 0.03, metalness: 0.2, env: 1.2 },
        wire: { color: '#4d5154', opacity: 0.6, metalness: 0.6, roughness: 0.4, env: 1 },
      }[m];
    },
    swatch: { structure: '#c7c3ba', walls: '#ebe9e3', facade: '#a9c3c9', roof: '#f1f1ee', slab: '#c7c3ba', circulation: '#c7c3ba', railing: '#3c4043', kennel: '#e3ddd2', site: '#7d9658' },
  },

  // 图解风：每个系统一种颜色，屋顶半透明，默认分层展开
  diagram: {
    label: 'Diagram',
    background: '#f7f7f4',
    fog: [2200, 6000],
    hemi: ['#ffffff', '#e8e8e2', 2.3],
    sun: ['#ffffff', 1.6],
    exposure: 1.0,
    environment: false,
    explode: true,
    outlines: true,      // 屋顶和墙加黑色轮廓线，像作品集第 18 页
    outerFade: [1300, 1700],
    mat(group, m) {
      if (group === 'site') {
        const c = SITE(['#efefeb', '#e1e7d6', '#d3e3ea', '#e8e8e4', '#f3f3f0'])[m];
        return { color: c, roughness: 1 };
      }
      const byGroup = {
        structure: { color: '#e05a33', roughness: 0.7 },
        walls: { color: '#ffffff', roughness: 0.9 },
        slab: { color: '#d4d4cf', roughness: 0.9 },
        circulation: { color: '#f0bd3f', roughness: 0.7 },
        kennel: m === 'wire' ? { color: '#6f9a5c', opacity: 0.55 } : { color: '#79a564', roughness: 0.8 },
      }[group];
      if (byGroup) return byGroup;
      if (group === 'roof') return { color: '#eeeeea', opacity: 0.55, roughness: 0.9 };
      if (group === 'facade') return m === 'glass' ? { color: '#57b0c9', opacity: 0.4 } : { color: '#2f6d80', roughness: 0.6 };
      if (group === 'railing') return m === 'glass' ? { color: '#a8d2dd', opacity: 0.35 } : { color: '#3a3d40', roughness: 0.6 };
      return { color: '#cccccc' };
    },
    swatch: { structure: '#e05a33', walls: '#ffffff', facade: '#57b0c9', roof: '#eeeeea', slab: '#d4d4cf', circulation: '#f0bd3f', railing: '#3a3d40', kennel: '#79a564', site: '#e1e7d6' },
  },
};

// 分层展开时各分组抬起的高度（米），层次参照作品集第 18 页：首层 / 季风窗 / 结构 / 屋顶
export const EXPLODE = { facade: 60, structure: 120, roof: 180 };
