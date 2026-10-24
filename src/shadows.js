// shadows.js — 光影系统核心（风格化投影模型）
// 主光自左窗斜入：影子始终投在后墙"光影投影区"内——
// 物件越深（靠近窗户一侧）影子越大越模糊、越靠墙越小越清晰；
// 胶片以普通 alpha 混合实现红+黄=橙、黄+蓝=绿、红+蓝=紫 的低饱和混色；
// 云朵遮光统一驱动 globalA 与整体模糊度。

import * as THREE from '../lib/three.module.js';
import { ROOM } from './scene.js?v=22';
import { softRectAtlas, patchTexture, plantShadowCanvas, cutoutPatternCanvas } from './textures.js?v=22';

const VERT = `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform sampler2D map;
uniform float blurMix;
uniform float alpha;
uniform vec3 tintColor;
uniform vec4 maskRect;   // cx, cy, hx, hy（墙面世界坐标）
uniform float maskFeather;
uniform float globalA;
varying vec2 vUv;
varying vec3 vWorld;

float rectMask(vec2 p, vec4 r, float f){
  vec2 d = max(abs(p - r.xy) - r.zw, 0.0);
  return 1.0 - smoothstep(0.0, f, length(d));
}

void main(){
  float tx = clamp(blurMix, 0.0, 0.9999);
  float colF = tx * 2.0;
  float c0 = floor(colF);
  float f = colF - c0;
  float w3 = 0.25;
  vec2 uvA = vec2(vUv.x * w3 + c0 * w3, vUv.y);
  vec2 uvB = vec2(vUv.x * w3 + min(c0 + 1.0, 2.0) * w3, vUv.y);
  float a = mix(texture2D(map, uvA).a, texture2D(map, uvB).a, f);
  a *= rectMask(vWorld.xy, maskRect, maskFeather);
  a *= alpha * globalA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(tintColor, a);
  #include <colorspace_fragment>
}`;

// 风格化光参数（基准值，实际按太阳高度每帧插值）
const L = {
  shear: 0.92,      // 影子随深度向右偏移
  grow: 0.52,       // 影子随深度放大
  blur: 0.30,       // 模糊随深度
  zRef: 0.55,       // 桌面后沿
};
const lerp = (a, b, k) => a + (b - a) * k;
// e: 太阳高度 0(贴地平线)→1(正午高) —— 低太阳影子更长更斜，高太阳影子短而收
function dynParams(e) {
  return {
    shear: lerp(1.42, 0.78, e),
    grow: lerp(0.72, 0.42, e),
    blur: lerp(0.42, 0.24, e),
    vSpread: lerp(0.72, 1.05, e),   // 影子纵向展开
    cyBase: lerp(1.18, 1.42, e),
  };
}
// 光影游戏区（桌面软椭圆掩码）
const ZONE = { cx: -0.7, cz: 1.62, rx: 2.3, rz: 1.08 };

export class ShadowSystem {
  constructor(scene, sunState) {
    this.scene = scene;
    this.sunState = sunState;
    this.sources = [];
    this.wallZ = ROOM.wallZ + 0.03;

    this.shared = {
      maskRect: { value: new THREE.Vector4(-0.2, 1.3, 3.4, 1.9) },
      maskFeather: { value: 0.85 },
      globalA: { value: 1 },
    };

    this.softRectTex = this._tex(softRectAtlas());
    const pTex = this._tex(patchTexture());

    // 墙面亮斑（固定艺术位置的四边形）
    this.wallPatch = this._makeQuadPatch(pTex, '#FFF1D2', 0.34, 8);
    this._setQuadGeom(this.wallPatch, [
      new THREE.Vector3(-2.75, 0.14, this.wallZ),
      new THREE.Vector3(-1.35, 3.5, this.wallZ),
      new THREE.Vector3(3.4, 3.5, this.wallZ),
      new THREE.Vector3(1.8, 0.14, this.wallZ),
    ], 0.12, this.wallZ);
    // 桌面光池
    this.tablePool = this._makeQuadPatch(pTex, '#FFEDCB', 0.34, 5);
    const TY = ROOM.tableY + 0.008;
    this._setQuadGeom(this.tablePool, [
      new THREE.Vector3(-2.78, TY, 0.72),
      new THREE.Vector3(-2.15, TY, 2.62),
      new THREE.Vector3(1.25, TY, 2.62),
      new THREE.Vector3(0.62, TY, 0.72),
    ], 0.06, TY);
    scene.add(this.wallPatch, this.tablePool);
  }

  _tex(c) {
    if (c && c.isTexture) return c; // 已是纹理直接复用
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  _makeQuadPatch(tex, color, opacity, renderOrder) {
    const geo = _quadGeometry();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, color,
      side: THREE.DoubleSide,
    }));
    m.renderOrder = renderOrder;
    m.frustumCulled = false;
    return m;
  }

  _setQuadGeom(mesh, quad, expand, zOverride) {
    _writeQuad(mesh.geometry, (i) => {
      const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
      const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
      const q = quad[i];
      return [cx + (q.x - cx) * (1 + expand), cy + (q.y - cy) * (1 + expand), zOverride !== undefined ? zOverride : q.z];
    });
  }

  /* ---------- 贴花注册 ---------- */
  add(item) {
    const isQuad = item.shadowKind === 'paper' || item.shadowKind === 'film';
    const tex = isQuad ? this._tex(item.shadowAtlas) : this.softRectTex;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        map: { value: tex },
        blurMix: { value: 0 },
        alpha: { value: 0 },
        tintColor: { value: new THREE.Color(item.shadowColor || '#8D7B66') },
        maskRect: this.shared.maskRect,
        maskFeather: this.shared.maskFeather,
        globalA: this.shared.globalA,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const mesh = new THREE.Mesh(_quadGeometry(), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = item.shadowKind === 'film' ? 20 : 30;
    mesh.visible = false;
    this.scene.add(mesh);
    const src = { item, mesh, mat, isQuad, baseTint: new THREE.Color(item.shadowColor || '#8D7B66') };
    this.sources.push(src);
    return src;
  }

  remove(src) {
    this.scene.remove(src.mesh);
    src.mesh.geometry.dispose();
    src.mat.dispose();
    const i = this.sources.indexOf(src);
    if (i >= 0) this.sources.splice(i, 1);
  }

  /* ---------- 风格化投影 ---------- */
  shadowParams(item) {
    const D = this.dyn;
    const z = item.pos.z;
    const depth = Math.max(0, z - L.zRef);
    const winBoost = 1 + 0.3 * clamp((-1.1 - item.pos.x) / 1.8, 0, 1);
    const lift = item.liftY || 0;
    const s = (1 + depth * D.grow) * winBoost * (1 + lift * 0.45);
    const blur = clamp(depth * D.blur + lift * 0.5, 0, 1);
    const cx = item.pos.x + z * D.shear;
    // 影子带抬升到桌沿上方的可见墙面
    const cy = clamp(D.cyBase - depth * 0.05 + lift * 1.15, 0.92, 3.3);
    return { s, blur, cx, cy };
  }

  // 桌面角点 → 墙面影子角点
  // 纸片平躺在桌面时，其“深度方向”映射为影子的高度方向（立起式投影），
  // 并带轻微斜切，模拟从左窗斜入的光；抓起抬升时影子随之上移。
  projectCorner(c, item, sp) {
    const dx = c.x - item.pos.x;
    const dz = c.z - item.pos.z;
    // 注意符号：画布“上方”(dz<0,靠墙侧)必须投影到墙面的上方，保持正向不颠倒
    const x = sp.cx + (dx + dz * 0.55) * sp.s;
    const y = sp.cy - dz * this.dyn.vSpread * sp.s + (c.y - ROOM.tableY) * 1.2;
    return { x, y: clamp(y, 0.12, 4.1) };
  }

  zoneAlpha(tablePos) {
    const nx = (tablePos.x - ZONE.cx) / ZONE.rx;
    const nz = (tablePos.z - ZONE.cz) / ZONE.rz;
    return clamp(1.25 - (nx * nx + nz * nz) * 0.85, 0, 1);
  }

  // 窗台绿植的摇曳影子（特殊静态源）
  addPlantShadow(pos) {
    const tex = this._tex(plantShadowCanvas());
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        map: { value: tex },
        blurMix: { value: 0.4 },
        alpha: { value: 0 },
        tintColor: { value: new THREE.Color('#7E9068') },
        maskRect: this.shared.maskRect,
        maskFeather: this.shared.maskFeather,
        globalA: this.shared.globalA,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const mesh = new THREE.Mesh(_quadGeometry(), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 25;
    mesh.visible = false;
    this.scene.add(mesh);
    this.plantSource = { mesh, mat, pos: pos.clone() };
  }

  _updatePlantShadow(time) {
    const ps = this.plantSource;
    if (!ps) return;
    const sun = this.sunState;
    const I = sun.intensity * (1 - sun.dusk * 0.75);
    const sway = Math.sin(time * 0.9) * 0.08 + Math.sin(time * 2.3) * 0.02;
    const z = ps.pos.z;
    const cx = ps.pos.x + z * this.dyn.shear;
    const baseY = 1.18;
    const h = 1.5, w = 0.85;
    const topX = cx + sway;
    const quad = [
      [topX - w / 2, baseY + h], [topX + w / 2, baseY + h],
      [cx + w / 2 * 0.55, baseY], [cx - w / 2 * 0.55, baseY],
    ];
    const pos = ps.mesh.geometry.attributes.position.array;
    const order = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const [x, y] = quad[order[k]];
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = this.screenZ + 0.006;
    }
    ps.mesh.geometry.attributes.position.needsUpdate = true;
    ps.mesh.visible = true;
    ps.mat.uniforms.alpha.value = clamp(0.5 * I * (1 - (sun.theater || 0) * 0.3), 0, 1);
    ps.mat.uniforms.blurMix.value = 0.45;
  }

  // 手电筒：桌上的第二光源——附近薄片在墙上投出第二道影子
  addFlashlight(flashItem) {
    this.flashSys = { item: flashItem, pool: new Map() };
  }

  _makeFlashDecal(it) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        map: { value: this._tex(it.shadowAtlas) },
        blurMix: { value: 0.3 },
        alpha: { value: 0 },
        tintColor: { value: new THREE.Color('#6E5E4A') },
        maskRect: { value: new THREE.Vector4(0, 2, 6, 3.4) }, // 手电影子不受窗区限制
        maskFeather: { value: 2.0 },
        globalA: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const mesh = new THREE.Mesh(_quadGeometry(), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 31;
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, mat, item: it, baseTint: new THREE.Color(it.shadowColor || '#8D7B66') };
  }

  _updateFlashShadows() {
    const fs = this.flashSys;
    if (!fs) return;
    const f = fs.item;
    const on = f.active && !f.inTray && (f.state === 'table' || f.state === 'anim') && f.on !== false;
    const F = new THREE.Vector3(f.pos.x, ROOM.tableY + 0.42, f.pos.z);
    for (const src of this.sources) {
      const it = src.item;
      const eligible = on && src.isQuad && it.active && !it.inTray &&
        (it.state === 'table') && it.kind !== 'flashlight' && it.state !== 'gel';
      let fd = fs.pool.get(it.id);
      if (!fd) { fd = this._makeFlashDecal(it); fs.pool.set(it.id, fd); }
      if (!eligible) { fd.mesh.visible = false; continue; }
      const dist = Math.hypot(it.pos.x - F.x, it.pos.z - F.z);
      if (dist > 1.75 || dist < 0.22) { fd.mesh.visible = false; continue; }
      const corners = it.getShadowCorners();
      // 自 F 过各角点投到墙面
      const pts = [];
      let behind = false;
      for (const c of corners) {
        // 角点在手电前方时，按贴着光源的最小深度投影(影子收拢到墙脚)
        const dz = Math.min(c.z - F.z, -0.12);
        const tt = (this.wallZ - F.z) / dz;
        const x = F.x + (c.x - F.x) * tt;
        // 低于地面的投影折到墙脚(近似)，不整体丢弃
        const y = clamp(F.y + (c.y - F.y) * tt, 0.1, 4.1);
        pts.push({ x, y });
      }
      if (behind || pts.length < 4) { fd.mesh.visible = false; continue; }
      fd.mesh.visible = true;
      const pos = fd.mesh.geometry.attributes.position.array;
      const order = [0, 1, 2, 0, 2, 3];
      for (let k = 0; k < 6; k++) {
        const q = pts[order[k]];
        pos[k * 3] = q.x; pos[k * 3 + 1] = q.y; pos[k * 3 + 2] = this.wallZ + 0.05;
      }
      fd.mesh.geometry.attributes.position.needsUpdate = true;
      const fade = (1 - dist / 1.75);
      fd.mat.uniforms.alpha.value = 0.5 * fade * fade;
      fd.mat.uniforms.blurMix.value = clamp(0.2 + (1 - fade) * 0.5, 0, 1);
      if ((this.sunState.night || 0) > 0.01) {
        fd.mat.uniforms.tintColor.value.copy(fd.baseTint).lerp(_NIGHT_TINT, (this.sunState.night || 0) * 0.5);
      } else {
        fd.mat.uniforms.tintColor.value.copy(fd.baseTint);
      }
    }
  }

  // 剪影筒：放入光束后墙上流动的镂空图案光带
  addSpinBand(spinItem) {
    const tex = this._tex(cutoutPatternCanvas());
    tex.wrapS = THREE.RepeatWrapping;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      color: '#FFF6E0',
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.72), mat);
    mesh.renderOrder = 21;
    mesh.visible = false;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.spinBand = { mesh, mat, item: spinItem };
  }

  _updateSpinBand(time, I) {
    const sb = this.spinBand;
    if (!sb) return;
    const it = sb.item;
    const ok = it && it.active && !it.inTray && (it.state === 'table' || it.state === 'anim');
    if (!ok) { sb.mesh.visible = false; return; }
    const zone = this.zoneAlpha(it.pos);
    if (zone <= 0.05) { sb.mesh.visible = false; return; }
    const sp = this.shadowParams(it);
    sb.mesh.visible = true;
    sb.mesh.position.set(sp.cx + 0.3, clamp(sp.cy + 0.42, 0.9, 3.2), this.screenZ + 0.018);
    sb.mat.opacity = clamp(0.72 * zone * (0.3 + 0.7 * I) * (1 - (this.sunState.theater || 0) * 0.3), 0, 0.75);
    sb.mat.map.offset.x = -(time * 0.06) % 1;
  }

  /* ---------- 每帧更新 ---------- */
  update(time = 0) {
    const sun = this.sunState;
    this.dyn = dynParams(sun.elevation !== undefined ? sun.elevation : 0.62);
    const theater = sun.theater || 0;
    // 剧场模式：投影面从墙面移动到幕布
    this.screenZ = lerp(ROOM.wallZ + 0.03, ROOM.wallZ + 0.52, theater);
    if (theater > 0.02) {
      this.shared.maskRect.value.set(-0.25, 1.78, 2.42, 1.36);
      this.shared.maskFeather.value = 0.3;
    } else {
      this.shared.maskRect.value.set(-0.2, 1.3, 3.4, 1.9);
      this.shared.maskFeather.value = 0.85;
    }
    const night = sun.night || 0;
    const I = sun.intensity * (1 - sun.dusk * 0.75) * (1 - theater * 0.55);
    this.shared.globalA.value = (0.1 + 0.9 * I) * (1 + theater * 0.7) * (1 - night * 0.3);
    this.wallPatch.material.opacity = 0.4 * I * (1 - theater);
    this.tablePool.material.opacity = 0.32 * I * (1 - theater);

    for (const src of this.sources) {
      const item = src.item;
      if (!item.active || item.inTray || item.state === 'cutting-hide' || item.state === 'tray' || item.state === 'toTray' || item.state === 'gel' || item.state === 'shelf') {
        src.mesh.visible = false;
        continue;
      }
      const zone = this.zoneAlpha(item.pos);
      const gAlpha = item.shadowAlpha !== undefined ? item.shadowAlpha : 1;
      const a = zone * gAlpha * (item.shadowKind === 'film' ? (item.filmAlpha || 0.4) : (item.shadowStrength || 0.85));
      if (zone <= 0.02 || a <= 0.02) { src.mesh.visible = false; continue; }
      const sp = this.shadowParams(item);
      src.mesh.visible = true;

      // 手影魔法角：手掌纸片放在靠窗角落，影子轮流变身小动物
      if (item.isHand && item.handAtlases) {
        const inCorner = item.pos.x < ROOM.table.x0 + 0.78 && item.pos.z < ROOM.win.z1 + 0.2;
        const pose = inCorner ? (Math.floor(time / 2.2) % 4) : 0;
        if (pose !== item._handPose) {
          item._handPose = pose;
          if (item.handAtlases[pose]) src.mat.uniforms.map.value = item.handAtlases[pose];
        }
      }
      // 鸟影扇翅：切换姿势图集
      if (item.flap && item.flapAtlases) {
        const pose = birdFlapPose(item.flap.t);
        if (pose !== item._flapPose) {
          item._flapPose = pose;
          if (item.flapAtlases[pose]) src.mat.uniforms.map.value = item.flapAtlases[pose];
        }
      } else if (item._flapPose !== 0 && item.flapAtlases) {
        item._flapPose = 0;
        src.mat.uniforms.map.value = item.flapAtlases[0];
      }

      if (src.isQuad) {
        const corners = item.getShadowCorners();
        const z = this.screenZ + (item.shadowKind === 'film' ? -0.012 : 0.004);
        _writeQuad(src.mesh.geometry, (i) => {
          const p = this.projectCorner(corners[i], item, sp);
          return [p.x, p.y, z];
        });
      } else {
        const w = item.size * sp.s * 1.15;
        const h = item.size * sp.s * (item.blobRatio || 1);
        const cx = sp.cx, cy = Math.max(0.95, sp.cy - h * 0.1);
        const z = this.screenZ + 0.004;
        _writeQuad(src.mesh.geometry, (i) => {
          const sx = (i === 0 || i === 3) ? -0.5 : 0.5;
          const sy = (i === 0 || i === 1) ? 0.5 : -0.5;
          return [cx + sx * w, cy + sy * h, z];
        });
      }
      src.mesh.geometry.attributes.position.needsUpdate = true;
      src.mat.uniforms.blurMix.value = clamp(sp.blur + (1 - I) * 0.25, 0, 1);
      src.mat.uniforms.alpha.value = a;
      // 月夜：影子染成清冷的淡蓝灰（胶片的彩色光斑除外）
      if (night > 0.01 && src.baseTint && src.item.shadowKind !== 'film') {
        src.mat.uniforms.tintColor.value.copy(src.baseTint).lerp(_NIGHT_TINT, night * 0.7);
      }
    }
    this._updatePlantShadow(time);
    this._updateFlashShadows();
    this._updateSpinBand(time, I);
  }
}

// 四边形贴花公共几何：6 顶点两三角形，uv 全幅
function _quadGeometry() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0,
  ]), 2));
  return geo;
}
function _writeQuad(geo, cornerFn) {
  const pos = geo.attributes.position.array;
  const order = [0, 1, 2, 0, 2, 3];
  for (let k = 0; k < 6; k++) {
    const [x, y, z] = cornerFn(order[k]);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
  }
  geo.attributes.position.needsUpdate = true;
}

function birdFlapPose(t) {
  if (t < 0.34) return (t < 0.17) ? 1 : 0;
  if (t < 0.68) return (t < 0.51) ? 2 : 0;
  if (t < 1.02) return (t < 0.85) ? 1 : 0;
  if (t < 1.36) return (t < 1.19) ? 2 : 0;
  return 0;
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

const _NIGHT_TINT = new THREE.Color('#5E6B82');
