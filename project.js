// 项目页：三维模型点击后才加载、图片看大图、导航高亮当前章节

// 三维模型：点击封面后才加载 iframe（模型约 25 MB），也避免页面滚动被模型抢走
const cover = document.getElementById('viewer-cover');
const frame = document.getElementById('viewer');
cover.addEventListener('click', () => {
  frame.src = frame.dataset.src;
  cover.hidden = true;
  frame.focus();
});

// 看大图：点击图片全屏查看；再点图片切换原尺寸，便于看清平面图里的小字
const lb = document.getElementById('lightbox');
const lbImg = lb.querySelector('img');
document.querySelectorAll('.zoomable img').forEach((img) => {
  img.addEventListener('click', () => {
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lb.classList.remove('full');
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  });
});
lbImg.addEventListener('click', (e) => {
  e.stopPropagation();
  lb.classList.toggle('full');
});
function closeLb() {
  lb.hidden = true;
  document.body.style.overflow = '';
}
lb.querySelector('.close').addEventListener('click', closeLb);
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-scroll')) closeLb(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

// 导航高亮
const links = [...document.querySelectorAll('.topnav .links a')];
const targets = links.map((a) => document.querySelector(a.getAttribute('href')));
const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const i = targets.indexOf(en.target);
    links.forEach((a, j) => a.classList.toggle('on', j === i));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
targets.forEach((t) => t && io.observe(t));

// 作品集图片：禁用右键菜单、拖拽和移动端长按保存（只能挡住普通操作，图片本身另有水印）
document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, .viewer-cover')) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });
