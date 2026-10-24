// textures.js — 全部美术资源均由 Canvas 程序化生成（纸片、胶片、光斑贴图、Logo）
// 风格：马卡龙低饱和、圆润无尖角、哑光纸质

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* ---------------- 基础形状绘制（256×256，四周留白） ---------------- */

function drawLeaf(ctx) {
  ctx.fillStyle = '#B9CFA6';
  ctx.strokeStyle = '#A2BB8D';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(128, 26);
  ctx.bezierCurveTo(198, 54, 210, 138, 131, 230);
  ctx.bezierCurveTo(50, 138, 58, 54, 128, 26);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 镂空叶脉
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(128, 46); ctx.quadraticCurveTo(123, 138, 128, 210); ctx.stroke();
  ctx.lineWidth = 5.5;
  const veins = [[84, -46], [122, -50], [160, -46]];
  for (const [y, len] of veins) {
    ctx.beginPath(); ctx.moveTo(126, y); ctx.quadraticCurveTo(126 + len * 0.5, y - 16, 126 + len, y - 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(130, y + 14); ctx.quadraticCurveTo(130 - len * 0.5, y - 2, 130 - len, y - 20); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(94, 96, 9, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(162, 152, 8, 0, 7); ctx.fill();
  ctx.restore();
}

function drawPetal(ctx) {
  ctx.fillStyle = '#F4C9C9';
  ctx.strokeStyle = '#E5AFAF';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(128, 232);
  ctx.bezierCurveTo(40, 170, 50, 58, 128, 26);
  ctx.bezierCurveTo(206, 58, 216, 170, 128, 232);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  for (const [y, r] of [[84, 10], [128, 12], [172, 10]]) {
    ctx.beginPath(); ctx.arc(128, y, r, 0, 7); ctx.fill();
  }
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(92, 108); ctx.quadraticCurveTo(84, 120, 90, 136); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(164, 142); ctx.quadraticCurveTo(172, 154, 166, 170); ctx.stroke();
  ctx.restore();
}

// pose: 0 收翅 / 1 展翅向上 / 2 展翅向下（供影子扇翅彩蛋）
function drawBird(ctx, pose = 0) {
  ctx.fillStyle = '#B7D3EA';
  ctx.strokeStyle = '#9DC0DD';
  ctx.lineWidth = 5;
  const p = new Path2D();
  // 尾巴
  p.moveTo(176, 128); p.quadraticCurveTo(226, 96, 240, 112);
  p.quadraticCurveTo(234, 140, 190, 162); p.closePath();
  // 身体
  p.ellipse(132, 148, 66, 54, 0, 0, 7);
  // 头
  p.moveTo(128, 92); p.arc(98, 92, 40, 0, 7); p.closePath();
  // 喙
  p.moveTo(64, 82); p.lineTo(24, 99); p.lineTo(64, 108); p.closePath();
  if (pose === 1) { // 翅膀向上
    p.moveTo(142, 118);
    p.quadraticCurveTo(178, 52, 224, 54);
    p.quadraticCurveTo(230, 92, 186, 122);
    p.closePath();
  } else if (pose === 2) { // 翅膀向下
    p.moveTo(146, 166);
    p.quadraticCurveTo(196, 196, 226, 178);
    p.quadraticCurveTo(216, 142, 178, 138);
    p.closePath();
  }
  ctx.fill(p); ctx.stroke(p);
  // 眼睛与翅膀镂空线
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  ctx.beginPath(); ctx.arc(102, 86, 6, 0, 7); ctx.fill();
  if (pose === 0) {
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(118, 138); ctx.quadraticCurveTo(150, 126, 170, 152); ctx.stroke();
  }
  ctx.restore();
}

function drawRabbit(ctx) {
  ctx.fillStyle = '#F7ECDC';
  ctx.strokeStyle = '#E2D1B4';
  ctx.lineWidth = 5;
  const p = new Path2D();
  p.ellipse(76, 66, 15, 41, -0.28, 0, 7);   // 左耳
  p.ellipse(122, 58, 15, 43, 0.14, 0, 7);   // 右耳
  p.arc(108, 116, 42, 0, 7);                 // 头
  p.ellipse(152, 170, 62, 50, 0, 0, 7);      // 身体
  p.arc(208, 178, 17, 0, 7);                 // 尾巴
  ctx.fill(p); ctx.stroke(p);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(100, 110, 5.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(76, 66, 5.5, 26, -0.28, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(122, 58, 5.5, 28, 0.14, 0, 7); ctx.fill();
  ctx.restore();
}

function drawStar(ctx) {
  ctx.fillStyle = '#E8C87E';
  ctx.strokeStyle = '#D5B063';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 46 : 102;
    const x = 128 + Math.cos(a) * r, y = 130 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(128, 130, 13, 0, 7); ctx.fill();
  ctx.restore();
}

function drawFish(ctx) {
  ctx.fillStyle = '#9CC8C4';
  ctx.strokeStyle = '#84B3AE';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(52, 128);
  ctx.bezierCurveTo(80, 66, 168, 74, 196, 122);
  ctx.bezierCurveTo(168, 176, 80, 190, 52, 128);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 尾巴
  ctx.beginPath();
  ctx.moveTo(196, 122); ctx.lineTo(238, 88); ctx.quadraticCurveTo(224, 122, 238, 158);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 镂空:眼睛 + 鳍缝
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(74, 112, 10, 0, 7); ctx.fill();
  ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(120, 108); ctx.quadraticCurveTo(134, 128, 120, 148); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(150, 106); ctx.quadraticCurveTo(164, 126, 150, 146); ctx.stroke();
  ctx.restore();
}

export const PAPER_SHAPES = {
  leaf:   { draw: (c) => drawLeaf(c),   color: '#B9CFA6' },
  petal:  { draw: (c) => drawPetal(c),  color: '#F4C9C9' },
  bird:   { draw: (c) => drawBird(c, 0), color: '#B7D3EA' },
  rabbit: { draw: (c) => drawRabbit(c), color: '#F7ECDC' },
  star:   { draw: (c) => drawStar(c),   color: '#E8C87E' },
  fish:   { draw: (c) => drawFish(c),   color: '#9CC8C4' },
  doll:   { draw: (c) => drawDoll(c),   color: '#F2CFA8' },
};

/* ---------------- 形状画布 / 半片切分 / 模糊图集 ---------------- */

export function shapeCanvas(shapeKey, pose = 0) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  if (shapeKey === 'bird') drawBird(ctx, pose); else PAPER_SHAPES[shapeKey].draw(ctx);
  return c;
}

// 沿中线（带轻微手撕波浪）切半，side: 'L' | 'R'
export function halfCanvas(src, side) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(side === 'L' ? 7 : 13);
  ctx.save();
  ctx.beginPath();
  if (side === 'L') {
    ctx.moveTo(0, 0); ctx.lineTo(126, 0);
    for (let y = 0; y <= 256; y += 32) ctx.lineTo(126 + Math.sin(y * 0.09) * 3 + (rnd() - 0.5) * 3, y);
    ctx.lineTo(0, 256);
  } else {
    ctx.moveTo(256, 0); ctx.lineTo(130, 0);
    for (let y = 0; y <= 256; y += 32) ctx.lineTo(130 + Math.sin(y * 0.09) * 3 + (rnd() - 0.5) * 3, y);
    ctx.lineTo(256, 256);
  }
  ctx.closePath(); ctx.clip();
  ctx.drawImage(src, 0, 0);
  ctx.restore();
  return c;
}

// 单行三格模糊图集 [清晰 / 中度 / 柔和]，供影子贴花按距离混 sampled
export function makeBlurAtlas(srcCanvas, blurMid = 3.5, blurSoft = 9) {
  // 1024×256：POT 尺寸，兼容 WebGL1；瓦片宽 1/4，前三格为 [清晰/中度/柔和]
  const out = canvas(1024, 256);
  const ctx = out.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.filter = `blur(${blurMid}px)`;
  ctx.drawImage(srcCanvas, 256, 0);
  ctx.filter = `blur(${blurSoft}px)`;
  ctx.drawImage(srcCanvas, 512, 0);
  ctx.filter = 'none';
  return out;
}

/* ---------------- 胶片 / 柔和贴图 ---------------- */

export function filmTexture(hex) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  const r = 30;
  ctx.beginPath();
  ctx.roundRect(26, 26, 204, 204, r);
  ctx.fillStyle = hex; ctx.globalAlpha = 0.85; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.16; ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.moveTo(40, 256); ctx.lineTo(150, -20); ctx.lineTo(200, -20); ctx.lineTo(90, 256); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.09;
  ctx.beginPath(); ctx.moveTo(120, 256); ctx.lineTo(210, -20); ctx.lineTo(232, -20); ctx.lineTo(142, 256); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.55; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(27.5, 27.5, 201, 201, r); ctx.stroke();
  return c;
}

// 影子/光斑通用柔和圆角矩形图集（供胶片、积木影子）
/* ---------------- 羽毛（柔边影子） ---------------- */
export function featherCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.translate(128, 128);
  ctx.rotate(-0.5);
  // 羽轴
  ctx.strokeStyle = 'rgba(180, 128, 108, 1)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -96); ctx.quadraticCurveTo(6, 0, -6, 102); ctx.stroke();
  // 羽枝：沿轴两侧的细软短线，越靠尖越短
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const y = -86 + t * 150;
    const len = 46 * Math.sin(Math.PI * (0.18 + t * 0.72));
    const sway = Math.sin(t * 9) * 5;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = `rgba(205, 152, 132, ${0.85 + 0.15 * Math.sin(t * 12 + i)})`;
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.moveTo(sway * 0.4, y);
      ctx.quadraticCurveTo(sway + side * len * 0.6, y - 10, sway + side * len, y + 8);
      ctx.stroke();
    }
  }
  // 根部羽柄
  ctx.strokeStyle = 'rgba(188, 136, 116, 1)';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-6, 60); ctx.quadraticCurveTo(-4, 84, -6, 102); ctx.stroke();
  return c;
}

/* ---------------- 手绘贴纸：按笔画轮廓自动包边 ---------------- */
// 输入孩子的笔画画布，输出 { item: 带包边的贴纸, shadow: 包边轮廓的影子层 }
// 白纸不再存在——画了什么样子，就以什么样子包边裁出来
export function makeStickerCanvases(strokeCanvas) {
  const S = 512;
  const dilate = (r) => {
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(strokeCanvas, Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.drawImage(strokeCanvas, 0, 0);
    // 染成包边色
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#FBF2DE';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  };
  const trim = dilate(13);
  const item = canvas(S, S);
  item.getContext('2d').drawImage(trim, 0, 0);
  item.getContext('2d').drawImage(strokeCanvas, 0, 0);
  const shadow = dilate(9); // 影子层：含包边的整体轮廓
  return { item, shadow };
}

/* ---------------- 手影手势（影子层）：手掌 / 兔子 / 飞鸟 / 小狗 ---------------- */
function handBase(ctx, fingers) {
  // 手掌
  ctx.beginPath();
  ctx.ellipse(118, 168, 52, 46, 0.12, 0, 7);
  ctx.fill();
  // 手腕
  ctx.beginPath();
  ctx.roundRect(96, 196, 48, 52, 16);
  ctx.fill();
  // 手指:数组 [根部x偏移, 长度, 角度]
  for (const [fx, fl, fa] of fingers) {
    ctx.save();
    ctx.translate(118 + fx, 138);
    ctx.rotate(fa);
    ctx.beginPath();
    ctx.roundRect(-11, -fl, 22, fl + 16, 11);
    ctx.fill();
    ctx.restore();
  }
}

export function handShadowCanvas(gesture) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  if (gesture === 1) {
    // 兔子:食指中指竖起为耳
    handBase(ctx, [[-24, 108, -0.1], [-2, 128, 0.02], [22, 52, 0.5], [44, 40, 0.85]]);
  } else if (gesture === 2) {
    // 飞鸟:拇指食指展开成翅与头
    handBase(ctx, [[-34, 96, -0.65], [-10, 120, -0.18], [18, 58, 0.42], [42, 44, 0.8]]);
  } else if (gesture === 3) {
    // 小狗:中指无名指并拢前伸为吻部
    handBase(ctx, [[-30, 96, -0.5], [-8, 118, -0.1], [16, 112, 0.14], [40, 60, 0.62]]);
  } else {
    // 手掌
    handBase(ctx, [[-36, 84, -0.42], [-15, 100, -0.16], [6, 102, 0.1], [28, 88, 0.38], [48, 62, 0.66]]);
  }
  return c;
}

/* ---------------- 手掌纸片（托盘道具） ---------------- */
export function drawHand(ctx, color = '#F2D8C4', edge = '#DDB8A2') {
  ctx.fillStyle = color;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 5;
  const fingers = [[-36, 84, -0.42], [-15, 100, -0.16], [6, 102, 0.1], [28, 88, 0.38], [48, 62, 0.66]];
  ctx.beginPath();
  ctx.ellipse(118, 168, 52, 46, 0.12, 0, 7);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(96, 196, 48, 52, 16);
  ctx.fill(); ctx.stroke();
  for (const [fx, fl, fa] of fingers) {
    ctx.save();
    ctx.translate(118 + fx, 138);
    ctx.rotate(fa);
    ctx.beginPath();
    ctx.roundRect(-11, -fl, 22, fl + 16, 11);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

PAPER_SHAPES.hand = { draw: (c) => drawHand(c), color: '#F2D8C4' };

/* ---------------- 编织篮纹理 ---------------- */
export function basketCanvas() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#D9B98C';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 12) {
    ctx.fillStyle = y % 24 ? 'rgba(166, 132, 88, 0.4)' : 'rgba(240, 220, 180, 0.35)';
    ctx.fillRect(0, y, 128, 6);
  }
  for (let x = 0; x < 128; x += 16) {
    ctx.strokeStyle = 'rgba(120, 92, 58, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
  }
  return c;
}

/* ---------------- 桌面木纹 ---------------- */
export function tableGrainCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#E0C298';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 256;
    ctx.strokeStyle = `rgba(150, 116, 74, ${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 1.5 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + (Math.random() - 0.5) * 10, 170, y + (Math.random() - 0.5) * 10, 256, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
  return c;
}

/* ---------------- 棱镜彩虹带（低饱和、柔边） ---------------- */
export function rainbowCanvas() {
  const c = canvas(512, 128);
  const ctx = c.getContext('2d');
  const cols = ['#F08A6E', '#F2C45E', '#A8CC70', '#6EB8AC', '#6E9BD4', '#B082CC'];
  const w = 512 / cols.length;
  for (let i = 0; i < cols.length; i++) {
    const g = ctx.createLinearGradient((i - 0.5) * w, 0, (i + 1.5) * w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, cols[i]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 128);
  }
  // 上下羽化
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createLinearGradient(0, 0, 0, 128);
  m.addColorStop(0, 'rgba(0,0,0,0)');
  m.addColorStop(0.35, 'rgba(0,0,0,1)');
  m.addColorStop(0.65, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, 512, 128);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/* ---------------- 剪影筒镂空图案（星星月亮镂空） ---------------- */
export function cutoutPatternCanvas() {
  const c = canvas(512, 256);
  const ctx = c.getContext('2d');
  // 深色筒身带镂空亮形
  ctx.fillStyle = 'rgba(40, 36, 30, 0.92)';
  ctx.fillRect(0, 0, 512, 256);
  ctx.globalCompositeOperation = 'destination-out';
  const star = (x, y, r, rot) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  };
  const moon = (x, y, r) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(40, 36, 30, 0.92)';
    ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.2, r * 0.85, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
  };
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  star(90, 70, 34, 0.2); moon(210, 128, 34); star(330, 80, 30, -0.3);
  dot(430, 60, 12); dot(455, 120, 9); dot(150, 190, 11); dot(300, 190, 13);
  star(470, 190, 26, 0.4); dot(60, 150, 8);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/* ---------------- 纸片小人 ---------------- */
export function drawDoll(ctx) {
  ctx.fillStyle = '#F2CFA8';
  ctx.strokeStyle = '#E0B48E';
  ctx.lineWidth = 5;
  // 头
  ctx.beginPath(); ctx.arc(128, 62, 34, 0, 7); ctx.fill(); ctx.stroke();
  // 身体
  ctx.beginPath();
  ctx.moveTo(96, 102); ctx.quadraticCurveTo(128, 92, 160, 102);
  ctx.lineTo(168, 178); ctx.quadraticCurveTo(128, 190, 88, 178);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 手臂
  ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(96, 112); ctx.lineTo(58, 150); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(160, 112); ctx.lineTo(198, 150); ctx.stroke();
  // 腿
  ctx.beginPath(); ctx.moveTo(110, 182); ctx.lineTo(104, 226); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(146, 182); ctx.lineTo(152, 226); ctx.stroke();
  // 镂空眼睛
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(116, 58, 6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(140, 58, 6, 0, 7); ctx.fill();
  ctx.restore();
}

/* ---------------- 盆栽叶片（正面纹理，带叶脉） ---------------- */
export function plantLeafCanvas() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  // 叶形：圆润带尖头
  ctx.beginPath();
  ctx.moveTo(64, 6);
  ctx.bezierCurveTo(112, 30, 116, 84, 64, 122);
  ctx.bezierCurveTo(12, 84, 16, 30, 64, 6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#8FB478');
  g.addColorStop(1, '#6E9660');
  ctx.fillStyle = g;
  ctx.fill();
  // 中脉与侧脉
  ctx.strokeStyle = 'rgba(255, 250, 220, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(64, 14); ctx.quadraticCurveTo(60, 66, 64, 116); ctx.stroke();
  ctx.lineWidth = 1.8;
  for (const y of [38, 62, 86]) {
    ctx.beginPath(); ctx.moveTo(63, y + 8); ctx.lineTo(36, y + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(65, y + 4); ctx.lineTo(92, y + 18); ctx.stroke();
  }
  return c;
}

/* ---------------- 窗帘（暖米色竖条纹软布） ---------------- */
export function curtainCanvas() {
  const c = canvas(128, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F2E7D0';
  ctx.fillRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = 'rgba(214, 194, 158, 0.35)';
    ctx.fillRect(x, 0, 7, 256);
  }
  // 上下轻阴影
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(120, 100, 70, 0.18)');
  g.addColorStop(0.2, 'rgba(120, 100, 70, 0)');
  g.addColorStop(1, 'rgba(120, 100, 70, 0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  return c;
}

/* ---------------- 圆形地毯（双环 + 细点纹） ---------------- */
export function rugCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#E9DAC0';
  ctx.beginPath(); ctx.arc(128, 128, 126, 0, 7); ctx.fill();
  ctx.strokeStyle = '#D6BE9C';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(128, 128, 106, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#E2CFAF';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(128, 128, 78, 0, 7); ctx.stroke();
  // 细点纹
  ctx.fillStyle = 'rgba(200, 176, 138, 0.35)';
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 60;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1.6, 0, 7);
    ctx.fill();
  }
  // 边缘羽化
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createRadialGradient(128, 128, 100, 128, 128, 126);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/* ---------------- 木地板（条板纹） ---------------- */
export function floorPlankCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#E3D3B4';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = `rgba(176, 148, 104, ${0.16 + Math.random() * 0.08})`;
    ctx.fillRect(0, y, 256, 2);
    ctx.fillStyle = `rgba(255, 244, 220, ${0.05 + Math.random() * 0.05})`;
    ctx.fillRect(0, y + 3, 256, 10);
    // 板端缝
    const sx = Math.random() * 256;
    ctx.fillStyle = 'rgba(160, 134, 96, 0.2)';
    ctx.fillRect(sx, y, 2, 32);
  }
  return c;
}

/* ---------------- 墙上小画（蜡笔涂鸦：太阳与小山） ---------------- */
export function doodleCanvas(kind) {
  const c = canvas(128, 96);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FDF8EC';
  ctx.fillRect(0, 0, 128, 96);
  ctx.lineCap = 'round';
  if (kind === 0) {
    // 太阳
    ctx.strokeStyle = 'rgba(226, 168, 96, 0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(52, 36, 16, 0, 7); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(52 + Math.cos(a) * 22, 36 + Math.sin(a) * 22);
      ctx.lineTo(52 + Math.cos(a) * 30, 36 + Math.sin(a) * 30);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150, 176, 130, 0.8)';
    ctx.beginPath(); ctx.moveTo(10, 84); ctx.lineTo(50, 70); ctx.lineTo(90, 84); ctx.stroke();
  } else {
    // 小房子与气球
    ctx.strokeStyle = 'rgba(150, 160, 200, 0.85)';
    ctx.lineWidth = 5;
    ctx.strokeRect(30, 44, 40, 34);
    ctx.beginPath(); ctx.moveTo(24, 44); ctx.lineTo(50, 22); ctx.lineTo(76, 44); ctx.stroke();
    ctx.strokeStyle = 'rgba(214, 150, 150, 0.85)';
    ctx.beginPath(); ctx.arc(98, 30, 8, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(98, 38); ctx.quadraticCurveTo(94, 58, 100, 76); ctx.stroke();
  }
  return c;
}

/* ---------------- 柔和单色光带（棱镜色光模式） ---------------- */
export function softBandCanvas() {
  const c = canvas(256, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 64);
  const m = ctx.createLinearGradient(0, 0, 0, 64);
  m.addColorStop(0, 'rgba(0,0,0,0)');
  m.addColorStop(0.4, 'rgba(0,0,0,1)');
  m.addColorStop(0.6, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, 256, 64);
  return c;
}

/* ---------------- 萤火虫：炽亮核心光点 ---------------- */
export function fireflyCoreTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 62);
  g.addColorStop(0.0, 'rgba(255, 253, 240, 1)');
  g.addColorStop(0.18, 'rgba(255, 240, 190, 0.95)');
  g.addColorStop(0.42, 'rgba(255, 216, 140, 0.38)');
  g.addColorStop(1.0, 'rgba(255, 210, 130, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

/* ---------------- 绿植剪影（盆栽的墙上影子，与 3D 叶片对应） ---------------- */
export function plantShadowCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  // 花盆
  ctx.beginPath();
  ctx.moveTo(96, 252); ctx.lineTo(160, 252); ctx.lineTo(150, 208); ctx.lineTo(106, 208);
  ctx.closePath(); ctx.fill();
  // 叶片：与 3D 一致的圆叶带尖头，放射错落
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.36;
    const len = 118 + (i % 3) * 26;
    const tipX = 128 + Math.cos(a) * len;
    const tipY = 208 + Math.sin(a) * len;
    const midX = 128 + Math.cos(a) * len * 0.5;
    const midY = 208 + Math.sin(a) * len * 0.5;
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.42);
    ctx.bezierCurveTo(24, -len * 0.2, 22, len * 0.16, 0, len * 0.42);
    ctx.bezierCurveTo(-22, len * 0.16, -24, -len * 0.2, 0, -len * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return c;
}

/* ---------------- 魔法画纸（托盘里的特殊白纸） ---------------- */
export function magicPaperCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FDF8EC';
  ctx.beginPath(); ctx.roundRect(30, 30, 196, 196, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(190, 170, 130, 0.7)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(32, 32, 192, 192, 20); ctx.stroke();
  ctx.fillStyle = '#E8C87E';
  const star = (x, y, r) => {
    ctx.save(); ctx.translate(x, y); ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  };
  star(62, 62, 15); star(194, 62, 15); star(62, 194, 15); star(194, 194, 15);
  return c;
}

/* ---------------- 手绘作品：实体纸面 + 影子层（笔画即影子） ---------------- */
export function drawingItemCanvases(strokeCanvas) {
  const item = canvas(256, 256);
  const ctx = item.getContext('2d');
  ctx.fillStyle = '#FDF8EC';
  ctx.beginPath(); ctx.roundRect(14, 14, 228, 228, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(185, 165, 125, 0.55)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(16, 16, 224, 224, 18); ctx.stroke();
  ctx.drawImage(strokeCanvas, 0, 0, 256, 256);
  const shadow = canvas(256, 256);
  const sctx = shadow.getContext('2d');
  sctx.drawImage(strokeCanvas, 0, 0, 256, 256);
  return { item, shadow };
}

// 剪刀剪影（供墙面影子使用）：两半刀刃交叉 + 指环
export function scissorsShadowCanvas() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.translate(128, 130);
  ctx.fillStyle = '#000';
  const half = (mir) => {
    ctx.save();
    if (mir) ctx.scale(-1, 1);
    ctx.rotate(0.3);
    ctx.beginPath(); ctx.roundRect(-17, -110, 34, 132, 17); ctx.fill();     // 刀刃
    ctx.beginPath(); ctx.arc(0, 46, 36, 0, 7); ctx.arc(0, 46, 17, 0, 7, true); ctx.fill('evenodd'); // 指环
    ctx.restore();
  };
  half(false); half(true);
  return c;
}

export function softRectAtlas() {
  const src = canvas(256, 256);
  const ctx = src.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(34, 34, 188, 188, 34); ctx.fill();
  return makeBlurAtlas(src, 5, 14);
}

export function patchTexture() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.filter = 'blur(38px)';
  ctx.beginPath(); ctx.roundRect(70, 70, 116, 116, 42); ctx.fill();
  ctx.filter = 'none';
  return c;
}

export function blobTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.62)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

export function cloudGlowTexture() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

/* ---------------- 主标题 Logo（撕纸底 + 圆润手写感 + 光斑点） ---------------- */

export function makeLogoCanvas() {
  const W = 1080, H = 350;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(2024);

  // --- 不规则撕纸底片（浅木色纹理 + 手撕边缘） ---
  const cx = W / 2, cy = H / 2;
  const rx = 468, ry = 140;
  ctx.save();
  ctx.shadowColor = 'rgba(150, 120, 80, 0.30)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  const N = 54;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const jr = 1 + (rnd() - 0.5) * 0.11;
    // 叠加小幅高频抖动模拟撕纸毛边
    const tear = 1 + Math.sin(a * 19) * 0.02 + (rnd() - 0.5) * 0.02;
    const x = cx + Math.cos(a) * rx * jr * tear;
    const y = cy + Math.sin(a) * ry * jr * tear;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#F0E3C8';
  ctx.fill();
  ctx.restore();
  // 木纹细痕
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const jr = 1 + (rnd() - 0.5) * 0.11;
    const tear = 1 + Math.sin(a * 19) * 0.02 + (rnd() - 0.5) * 0.02;
    const x = cx + Math.cos(a) * rx * jr * tear;
    const y = cy + Math.sin(a) * ry * jr * tear;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(176, 140, 92, 0.16)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    const y = 40 + i * 34 + rnd() * 8;
    ctx.beginPath();
    ctx.moveTo(cx - rx, y);
    ctx.bezierCurveTo(cx - rx * 0.4, y + (rnd() - 0.5) * 14, cx + rx * 0.4, y + (rnd() - 0.5) * 14, cx + rx, y);
    ctx.stroke();
  }
  ctx.restore();
  // 撕纸毛边高光
  ctx.strokeStyle = 'rgba(255, 252, 244, 0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const jr = 1 + (rnd() - 0.5) * 0.11;
    const tear = 1 + Math.sin(a * 19) * 0.02 + (rnd() - 0.5) * 0.02;
    const x = cx + Math.cos(a) * (rx * jr * tear - 1.5);
    const y = cy + Math.sin(a) * (ry * jr * tear - 1.5);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.stroke();

  // --- 标题文字：逐字微抖动，圆体，暖米白，柔光光晕 ---
  const text = '光斑小工坊';
  const fs = 158;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fs}px "PingFang SC", "Yuanti SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
  const step = 166;
  const startX = cx - step * 2;
  const centers = [];
  for (let i = 0; i < 5; i++) {
    centers.push({
      x: startX + i * step + (rnd() - 0.5) * 5,
      y: cy + 6 + (rnd() - 0.5) * 6,
      rot: (rnd() - 0.5) * 0.045,
    });
  }
  const drawText = (fill, shadow) => {
    ctx.save();
    if (shadow) { ctx.shadowColor = shadow.c; ctx.shadowBlur = shadow.b; }
    ctx.fillStyle = fill;
    for (let i = 0; i < 5; i++) {
      const p = centers[i];
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };
  drawText('rgba(255, 205, 125, 0.65)', { c: 'rgba(255, 202, 116, 1)', b: 42 }); // 光晕底层
  drawText('#FFF7E4', { c: 'rgba(255, 218, 140, 0.9)', b: 20 });
  drawText('#FFFDF4', null);

  // --- “光”字的一点 → 圆形光斑 ---
  const em = fs;
  const dotX = centers[0].x - em * 0.315;
  const dotY = centers[0].y - em * 0.345;
  // 以纸底色盖掉原点画
  ctx.fillStyle = '#F0E3C8';
  ctx.beginPath(); ctx.arc(dotX, dotY, em * 0.115, 0, 7); ctx.fill();
  // 光斑
  const glow = ctx.createRadialGradient(dotX, dotY, 1, dotX, dotY, em * 0.155);
  glow.addColorStop(0, 'rgba(255, 240, 190, 0.98)');
  glow.addColorStop(0.45, 'rgba(255, 228, 160, 0.55)');
  glow.addColorStop(1, 'rgba(255, 226, 160, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(dotX, dotY, em * 0.155, 0, 7); ctx.fill();
  ctx.fillStyle = '#FFE9B4';
  ctx.shadowColor = 'rgba(255, 220, 140, 0.95)'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(dotX, dotY, em * 0.072, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;

  // --- “工”字一横末端极淡镂空剪影感 ---
  const gX = centers[3].x + em * 0.30;
  const gY = centers[3].y - em * 0.335;
  ctx.fillStyle = 'rgba(240, 227, 200, 0.9)';
  ctx.beginPath(); ctx.arc(gX, gY, em * 0.052, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(gX + em * 0.062, gY - em * 0.012, em * 0.038, 0, 7); ctx.fill();

  return c;
}

/* ---------------- 桌面浅痕标题 ---------------- */

export function makeDeskTitleCanvas() {
  const W = 1024, H = 280;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(88);
  const text = '光斑小工坊';
  const fs = 150;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fs}px "PingFang SC", "Yuanti SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
  const step = 160;
  const startX = W / 2 - step * 2;
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(startX + i * step + (rnd() - 0.5) * 4, H / 2 + (rnd() - 0.5) * 5);
    ctx.rotate((rnd() - 0.5) * 0.03);
    ctx.fillStyle = 'rgba(152, 141, 122, 0.62)';
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  return c;
}
