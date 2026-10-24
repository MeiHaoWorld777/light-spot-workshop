// items.js — 全部可拖拽素材：镂空纸片、剪影纸片、彩色胶片、积木、剪刀、云朵
// 含托盘系统、抓取/落下动效、剪开分半、接触投影、轻量补间引擎

import * as THREE from '../lib/three.module.js';
import { ROOM } from './scene.js?v=22';
import {
  shapeCanvas, halfCanvas, makeBlurAtlas, filmTexture, softRectAtlas, blobTexture,
  scissorsShadowCanvas, magicPaperCanvas, drawingItemCanvases, featherCanvas, fireflyCoreTexture,
  PAPER_SHAPES, makeStickerCanvases, cutoutPatternCanvas,
} from './textures.js?v=22';

const TABLE_Y = ROOM.tableY;

/* ---------- 微型补间引擎 ---------- */
const tweens = [];
export function tween({ dur = 0.3, ease = easeOutCubic, onUpdate, onDone, delay = 0 }) {
  const tw = { t: -delay, dur, ease, onUpdate, onDone, dead: false };
  tweens.push(tw);
  return tw;
}
export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
export function easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
export function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.dead) { tweens.splice(i, 1); continue; }
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.onUpdate && tw.onUpdate(tw.ease(k), k);
    if (k >= 1) { tw.dead = true; tw.onDone && tw.onDone(); tweens.splice(i, 1); }
  }
}

/* ---------- 圆角立方体 ---------- */
function roundedBoxGeo(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - 0.06) / 2);
  return geo;
}

/* ---------- 道具管理器 ---------- */
export class ItemManager {
  PAPER_SHAPES_EXT = PAPER_SHAPES;

  constructor(scene, shadows, audio) {
    this.scene = scene;
    this.shadows = shadows;
    this.audio = audio;
    this.items = [];
    this.cloudItems = [];
    this._id = 0;
    this.grabOrder = 0;
    this.softRect = this._tex(softRectAtlas());
    this.blobTex = this._tex(blobTexture());
    this.slots = this._buildSlots();

    // 剪刀几何（复用）
    this.scissorsProto = this._buildScissorsProto();
  }

  _tex(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  _buildSlots() {
    const { x0, x1 } = ROOM.tray;
    const slotW = (x1 - x0) / 13;
    const z = (ROOM.tray.z0 + ROOM.tray.z1) / 2;
    const keys = ['leaf', 'petal', 'bird', 'rabbit', 'flashlight', 'feather', 'filmR', 'filmY', 'filmB', 'cube', 'cyl', 'scissors'];
    const n = keys.length;
    return keys.map((k, i) => ({ key: k, x: x0 + slotW * (i + 0.5), z, w: slotW }));
  }

  /* ---------- 创建各类道具 ---------- */
  addPaper(shapeKey, opts = {}) {
    const size = opts.size || 0.66;
    const base = opts.strokeCanvas || shapeCanvas(shapeKey);
    let itemTex, shadowAtlas;
    if (opts.half) {
      const hc = halfCanvas(base, opts.half);
      itemTex = this._tex(hc);
      shadowAtlas = this._tex(makeBlurAtlas(hc));
    } else {
      itemTex = this._tex(base);
      shadowAtlas = this._tex(makeBlurAtlas(base));
    }
    const mat = new THREE.MeshLambertMaterial({
      map: itemTex, transparent: true, alphaTest: 0.12, side: THREE.DoubleSide,
      emissive: new THREE.Color('#FFE9C0'), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'paper', shapeKey, half: opts.half || null,
      group, mesh, mat,
      size: { w: size, h: size },
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'paper', shadowAtlas, shadowStrength: opts.half ? 0.72 : 0.76,
      flap: null, flapAtlases: null, glow: 0,
      homeSlot: opts.homeSlot ?? null,
      cuttable: !opts.half && shapeKey !== undefined,
      grabOrder: 0,
    };
    if (shapeKey === 'bird' && !opts.half) {
      item.flapAtlases = [0, 1, 2].map(p => this._tex(makeBlurAtlas(shapeCanvas('bird', p))));
    }
    group.add(this._makeHit(size * 1.65));
    this._finishItem(item, opts);
    return item;
  }

  addFeather() {
    const size = { w: 0.7, h: 0.5 };
    const base = featherCanvas();
    const mat = new THREE.MeshLambertMaterial({
      map: this._tex(base), transparent: true, alphaTest: 0.06, side: THREE.DoubleSide,
      emissive: new THREE.Color('#FFE9C0'), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.w, size.h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'feather',
      group, mesh, mat,
      size,
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'paper', shadowAtlas: this._tex(makeBlurAtlas(base, 4, 11)),
      shadowStrength: 0.55,
      glow: 0, cuttable: false, grabOrder: 0, isFeather: true,
      phase: Math.random() * 9,
    };
    group.add(this._makeHit(size.w * 1.5));
    this._finishItem(item);
    return item;
  }

  // 手影游戏：手掌纸片。放到靠窗“魔法角”，影子会变身小动物
  addHandPaper() {
    const size = 0.68;
    const base = shapeCanvas('hand');
    const mat = new THREE.MeshLambertMaterial({
      map: this._tex(base), transparent: true, alphaTest: 0.12, side: THREE.DoubleSide,
      emissive: new THREE.Color('#FFE9C0'), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'paper', shapeKey: 'hand',
      group, mesh, mat,
      size: { w: size, h: size },
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'paper',
      shadowAtlas: this._tex(makeBlurAtlas(handShadowCanvas(0), 3, 8)),
      handAtlases: [0, 1, 2, 3].map(g => this._tex(makeBlurAtlas(handShadowCanvas(g), 3, 8))),
      flap: null, flapAtlases: null, glow: 0,
      homeSlot: null, cuttable: false, grabOrder: 0, isHand: true,
    };
    item.shadowColor = '#6E6152';
    group.add(this._makeHit(size * 1.55));
    this._finishItem(item);
    return item;
  }

  // ===== 搁架新零件：出生在右墙搁架，点一下跳到桌面 =====
  _finishShelfItem(item, shelfZ, sizeForHit) {
    this.scene.add(item.group);
    item.homeSlot = null;
    item.homeShelf = true;
    item.shelfPos = new THREE.Vector3(item.pos.x, ROOM.tableY, item.pos.z);
    item.state = 'table';
    item.inTray = false;
    item.blob && (item.blob.visible = false);
    // 搁架零件也需要接触投影(取到桌面后使用)
    item.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, opacity: 0.3, color: '#6E5A42', depthWrite: false })
    );
    item.blob.rotation.x = -Math.PI / 2;
    item.blob.renderOrder = 1;
    item.blob.visible = false;
    this.scene.add(item.blob);
    this.items.push(item);
    this._applyShelfTransform(item);
    return item;
  }

  _applyShelfTransform(item) {
    item.group.position.set(item.pos.x, item.shelfY, item.pos.z);
    item.group.rotation.set(0, item.rotZ || 0, 0);
    if (item.blob) item.blob.visible = false;
  }

  addFlashlight() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: '#E2B24E' });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.3, 14), bodyMat);
    body.position.y = 0.15;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.08, 14),
      new THREE.MeshLambertMaterial({ color: '#C9CDD4' }));
    head.position.y = 0.34;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16),
      new THREE.MeshBasicMaterial({ color: '#FFF6D8' }));
    lens.rotation.x = -Math.PI / 2;
    lens.position.y = 0.382;
    group.add(body, head, lens);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._tex(fireflyCoreTexture()), color: '#FFEFC0', transparent: true, opacity: 0.7,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(0.3, 0.3, 1);
    glow.position.y = 0.4;
    group.add(glow);
    const item = {
      id: ++this._id, kind: 'flashlight', group, mesh: body,
      size: 0.4, blobRatio: 0.5,
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'shelf', inTray: false, active: true,
      shadowKind: 'blob', shadowStrength: 0.5,
      cuttable: false, grabOrder: 0, on: true, glowSprite: glow, lens,
      shelfY: 0.445, shelfPos: new THREE.Vector3(1.9, ROOM.tableY, 1.4),
    };
    group.add(this._makeHitBox(0.5, 0.8, 0.5, 0.3));
    item.state = 'table';
    this._finishShelfItem(item);
    return item;
  }

  addSpin() {
    const group = new THREE.Group();
    const patTex = new THREE.CanvasTexture(cutoutPatternCanvas());
    patTex.colorSpace = THREE.SRGBColorSpace;
    patTex.wrapS = THREE.RepeatWrapping;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.44, 20, 1, true),
      new THREE.MeshLambertMaterial({ map: patTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })
    );
    mesh.position.y = 0.22;
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'spin', group, mesh,
      size: 0.42, blobRatio: 0.9,
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'shelf', inTray: false, active: true,
      shadowKind: 'blob', shadowStrength: 0.4,
      cuttable: false, grabOrder: 0, spinTex: patTex, spinSpeed: 0.5,
      shelfY: 0.445, shelfPos: new THREE.Vector3(2.35, ROOM.tableY, 2.05),
    };
    group.add(this._makeHitBox(0.5, 0.72, 0.5, 0.3));
    item.state = 'table';
    item.pos.set(2.35, ROOM.tableY, 2.05);
    this._finishShelfItem(item);
    return item;
  }

  addShelfDoll() {
    const it = this.addPaper('doll', { size: 0.62 });
    it.homeSlot = null;
    it.homeShelf = true;
    it.shelfPos = new THREE.Vector3(2.55, ROOM.tableY, 2.65);
    it.state = 'table';
    it.pos.set(2.55, ROOM.tableY, 2.65);
    it.standK = 0;
    it.inTray = false;
    return it;
  }

  addArch() {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.2, 0);
    shape.lineTo(-0.2, 0.14);
    shape.absarc(0, 0.14, 0.2, Math.PI, 0, true);
    shape.lineTo(0.2, 0);
    shape.lineTo(0.12, 0);
    shape.lineTo(0.12, 0.14);
    shape.absarc(0, 0.14, 0.12, 0, Math.PI, false);
    shape.lineTo(-0.12, 0.14);
    shape.lineTo(-0.12, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
    geo.center();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#D9B98C', flatShading: true }));
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'arch', group, mesh,
      size: 0.46, blobRatio: 0.8,
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'shelf', inTray: false, active: true,
      shadowKind: 'blob', shadowStrength: 0.55,
      cuttable: false, grabOrder: 0,
      shelfY: 0.445, shelfPos: new THREE.Vector3(1.7, ROOM.tableY, 2.25),
    };
    group.add(this._makeHitBox(0.52, 0.6, 0.42, 0.28));
    item.state = 'table';
    item.pos.set(1.7, ROOM.tableY, 2.25);
    this._finishShelfItem(item);
    return item;
  }

  addMagicPaper() {
    const size = 0.56;
    const base = magicPaperCanvas();
    const mat = new THREE.MeshLambertMaterial({
      map: this._tex(base), transparent: true, alphaTest: 0.12, side: THREE.DoubleSide,
      emissive: new THREE.Color('#FFE9C0'), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'magicPaper',
      group, mesh, mat,
      size: { w: size, h: size },
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'paper', shadowAtlas: this._tex(makeBlurAtlas(base)),
      shadowStrength: 0.5,
      glow: 0, cuttable: false, grabOrder: 0, isPortal: true,
    };
    group.add(this._makeHit(size * 1.6));
    this._finishItem(item);
    return item;
  }

  // 孩子的手绘作品：按笔画轮廓包边成贴纸，影子里也有包边
  addDrawing(strokeCanvas) {
    const size = 0.78;
    const { item: itemC, shadow } = makeStickerCanvases(strokeCanvas);
    const mat = new THREE.MeshLambertMaterial({
      map: this._tex(itemC), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide,
      emissive: new THREE.Color('#FFE9C0'), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'paper', shapeKey: 'drawing', strokeCanvas,
      group, mesh, mat,
      size: { w: size, h: size },
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'paper', shadowAtlas: this._tex(makeBlurAtlas(shadow, 2.5, 7)),
      shadowStrength: 0.85,
      flap: null, flapAtlases: null, glow: 0,
      homeSlot: null, cuttable: true, grabOrder: 0,
    };
    group.add(this._makeHit(size * 1.5));
    this._finishItem(item);
    // 从空中轻轻落下的登场动画
    item.liftY = 0.6;
    tween({
      dur: 0.9, ease: easeOutCubic,
      onUpdate: (k) => { item.liftY = 0.6 * (1 - k); },
      onDone: () => { item.liftY = 0; },
    });
    this.drawings = this.drawings || [];
    this.drawings.push(item);
    if (this.drawings.length > 6) {
      const old = this.drawings.shift();
      old.active = false; old.group.visible = false;
      this.shadows.remove(old.decal);
      this.scene.remove(old.group); this.scene.remove(old.blob);
      const i = this.items.indexOf(old);
      if (i >= 0) this.items.splice(i, 1);
    }
    return item;
  }

  addFilm(colorKey) {
    const colors = { R: '#F2A3A3', Y: '#F6E1A0', B: '#A9CDEB' };
    const hex = colors[colorKey] || '#F2A3A3';
    const size = 0.52;
    const tex = this._tex(filmTexture(hex));
    const mat = new THREE.MeshLambertMaterial({
      map: tex, transparent: true, opacity: 0.94, side: THREE.DoubleSide,
      depthWrite: false,
      emissive: new THREE.Color('#FFE9C0'), emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 3;
    const group = new THREE.Group();
    group.add(mesh);
    const item = {
      id: ++this._id, kind: 'film', colorKey,
      group, mesh, mat,
      size: { w: size, h: size },
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'film', shadowAtlas: this.softRect, filmAlpha: 0.42,
      shadowColor: hex,
      glow: 0, cuttable: false, grabOrder: 0,
    };
    group.add(this._makeHit(size * 1.7));
    this._finishItem(item);
    return item;
  }

  addBlock(kind) {
    const group = new THREE.Group();
    let size, h, mesh, blobRatio;
    if (kind === 'cube') {
      size = 0.4; h = 0.4;
      mesh = new THREE.Mesh(roundedBoxGeo(size, h, size, 0.09),
        new THREE.MeshLambertMaterial({ color: '#E5C9A3', flatShading: true }));
      blobRatio = 0.9;
    } else {
      size = 0.4; h = 0.44;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.165, h, 22),
        new THREE.MeshLambertMaterial({ color: '#C9D2BC', flatShading: true }));
      blobRatio = 1.05;
    }
    mesh.position.y = h / 2;
    group.add(mesh);
    const item = {
      id: ++this._id, kind, group, mesh,
      size, h, blobRatio,
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'blob', shadowStrength: 0.78,
      cuttable: false, grabOrder: 0,
    };
    group.add(this._makeHitBox(0.62, 0.78, 0.62, 0.36));
    this._finishItem(item);
    return item;
  }

  addScissors() {
    const group = new THREE.Group();
    const proto = this.scissorsProto;
    const sc = proto.clone();
    group.add(sc);
    group.rotation.x = 0;
    const item = {
      id: ++this._id, kind: 'scissors', group, sc,
      size: 0.6, h: 0.06, blobRatio: 0.55,
      pos: new THREE.Vector3(), rotZ: 0, liftY: 0, stackY: 0,
      state: 'table', inTray: false, active: true,
      shadowKind: 'blob', shadowStrength: 0.5,
      cuttable: false, grabOrder: 0, isTool: true,
    };
    group.add(this._makeHit(0.62));
    this._finishItem(item);
    return item;
  }

  _buildScissorsProto() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshLambertMaterial({ color: '#CDD3DA', side: THREE.DoubleSide });
    const handleMat = new THREE.MeshLambertMaterial({ color: '#EFBCA8', side: THREE.DoubleSide });
    const mkHalf = (mirror) => {
      const half = new THREE.Group();
      // 刀刃：枢轴向上的一根压扁胶囊，微收刀尖
      const blade = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.3, 4, 12), bladeMat);
      blade.scale.set(1, 1, 0.42);
      blade.position.y = 0.2;
      // 指环：枢轴向下的圆环
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.027, 10, 26), handleMat);
      ring.position.y = -0.14;
      half.add(blade, ring);
      half.rotation.z = mirror ? -0.3 : 0.3;
      if (mirror) half.scale.x = -1;
      return half;
    };
    g.add(mkHalf(false), mkHalf(true));
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 14),
      new THREE.MeshLambertMaterial({ color: '#B8BEC6' }));
    pivot.rotation.x = Math.PI / 2;
    g.add(pivot);
    return g;
  }

  // 竖直道具（棱镜/积木）用盒状命中体：从托盘站立态到桌面都能被指到
  _makeHitBox(w, h, d, y) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    );
    m.position.y = y;
    m.userData.isHit = true;
    return m;
  }

  _makeHit(s) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.userData.isHit = true;
    return m;
  }

  _finishItem(item, opts = {}) {
    this.scene.add(item.group);
    // 纸片/胶片：为影子贴花提供 4 个桌面角点（随 rotZ 旋转、随 liftY 抬升）
    if (item.shadowKind === 'paper' || item.shadowKind === 'film') {
      item.getShadowCorners = () => {
        const w = item.size.w, h = item.size.h;
        const c = Math.cos(item.rotZ), s = Math.sin(item.rotZ);
        const y = TABLE_Y + item.stackY + item.liftY;
        const out = [];
        for (const [u, v] of [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) {
          const ox = u * w, oz = -v * h;
          out.push(new THREE.Vector3(
            item.pos.x + ox * c + oz * s,
            y,
            item.pos.z - ox * s + oz * c
          ));
        }
        return out;
      };
    }
    this.scene.add(item.group);
    item.decal = this.shadows.add(item);
    item.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: this.blobTex, transparent: true, opacity: 0.3,
        color: '#6E5A42', depthWrite: false,
      })
    );
    item.blob.rotation.x = -Math.PI / 2;
    item.blob.renderOrder = 1;
    this.scene.add(item.blob);
    this.items.push(item);
    if (opts.pos) {
      item.pos.copy(opts.pos);
      item.state = 'table';
    }
    this._applyTransform(item);
  }

  /* ---------- 变换应用 ---------- */
  _baseY(item) {
    if (item.kind === 'paper' || item.kind === 'film') return TABLE_Y + item.stackY;
    if (item.kind === 'cube') return TABLE_Y + item.stackY;
    if (item.kind === 'cyl') return TABLE_Y + item.stackY;
    return TABLE_Y + item.stackY;
  }

  _applyTransform(item) {
    const g = item.group;
    if (item.state === 'shelf') { this._applyShelfTransform(item); return; }
    const standK = item.standK || 0;
    if (item.kind === 'film' && item.state === 'gel') {
      // 贴在窗玻璃上：竖直、面向房间
      g.rotation.set(0, 0, -Math.PI / 2);
      g.position.set(ROOM.wallX + 0.08, item.gelY, item.gelZ);
      const bs = item.blob;
      bs.material.opacity = 0;
      if (item.mat && item.mat.emissiveIntensity !== undefined) item.mat.emissiveIntensity = item.glow;
      return;
    }
    if (item.kind === 'paper' || item.kind === 'film') {
      const sway = (item.isFeather && !standK) ? Math.sin(this.time * 0.7 + item.phase) * 0.06 : 0;
      g.rotation.set(standK * 1.02, item.rotZ + sway, 0);
      g.position.set(
        item.pos.x,
        TABLE_Y + item.stackY + standK * (item.size.w || 0.6) * 0.4 + item.liftY,
        item.pos.z
      );
    } else if (item.kind === 'scissors') {
      g.rotation.set(-Math.PI / 2 + standK * 1.9, item.rotZ, 0);
      g.position.set(item.pos.x, TABLE_Y + 0.045 + standK * 0.15 + item.liftY, item.pos.z);
      if (item.sc) item.sc.scale.setScalar(1 - standK * 0.3);
    } else {
      g.rotation.set(0, item.rotZ, 0);
      g.position.set(item.pos.x, TABLE_Y + item.stackY + item.liftY, item.pos.z);
    }
    // 接触投影
    const bs = item.blob;
    const w = item.size.w ? item.size.w : item.size;
    bs.position.set(item.pos.x, TABLE_Y + item.stackY + 0.005, item.pos.z);
    const spread = w * (1.5 + item.liftY * 2.2);
    bs.scale.set(spread, spread * (item.kind === 'paper' || item.kind === 'film' ? 1 : 0.9), 1);
    bs.material.opacity = item.inTray || item.state === 'tray' ? 0 : clamp(0.3 - item.liftY * 1.1, 0.08, 0.3);
    // 发光（含月夜微光：夜 level 由 game 注入）
    if (item.mat && item.mat.emissiveIntensity !== undefined) {
      item.mat.emissiveIntensity = item.glow + (this.nightLevel || 0) * 0.24;
    }
  }

  /* ---------- 抓取 / 释放 ---------- */
  grab(item) {
    if (item.state === 'cutting-hide') return false;
    // 打断一切未完成的自动移动，保证随时可抓
    if (item._moveTween) { item._moveTween.dead = true; item._moveTween = null; }
    if (item._settleTween) { item._settleTween.dead = true; item._settleTween = null; }
    if (item._autoReturnTimer) { clearTimeout(item._autoReturnTimer); item._autoReturnTimer = null; }
    this.grabOrder++;
    item.grabOrder = this.grabOrder;
    // 每次抓起分配略高的层叠高度：后拿起的永远在上，且互不同高（防闪烁）
    this._stackCounter = (this._stackCounter || 0) + 1;
    if (item.kind !== 'cloud') item.stackY = 0.0028 * (this._stackCounter % 12);
    item.state = 'drag';
    item.inTray = false;
    item.dragTarget = item.pos.clone();
    // 拿起：轻微上浮放平 + 变亮
    if (this.audio) (item.kind === 'cube' || item.kind === 'cyl') ? this.audio.pickWood() : this.audio.pickPaper();
    const fromLift = item.liftY, fromGlow = item.glow, fromStand = item.standK || 0;
    tween({
      dur: 0.2, ease: easeOutCubic,
      onUpdate: (k) => {
        item.liftY = fromLift + (0.11 - fromLift) * k;
        item.glow = fromGlow + (0.16 - fromGlow) * k;
        item.standK = fromStand * (1 - k);
      },
    });
    return true;
  }

  release(item, dropPos) {
    item.state = 'anim';
    item.dragTarget = null;
    // 回托盘判定
    if (item.homeSlot !== null && item.homeSlot !== undefined &&
        dropPos && dropPos.z > ROOM.tray.z0 - 0.12 && !item.half) {
      this.sendToTray(item);
      return;
    }
    if (dropPos) {
      item.pos.x = dropPos.x; item.pos.z = dropPos.z;
    }
    this._settleDrop(item);
  }

  _settleDrop(item) {
    const isWood = item.kind === 'cube' || item.kind === 'cyl';
    if (this.audio) {
      // 光、色、声通感：不同材料/颜色落下对应不同的音
      let note = null;
      if (item.kind === 'film') note = { R: 523.25, Y: 659.25, B: 783.99 }[item.colorKey];
      else if (item.kind === 'paper') note = [523.25, 587.33, 659.25, 783.99, 880][Math.floor(Math.random() * 5)] * 0.75;
      isWood ? this.audio.dropWood() : this.audio.dropPaper(item.isFeather ? null : note);
      if (item.isFeather) this.audio.noiseHit({ freq: 700, q: 0.7, peak: 0.02, dur: 0.5 }); // 羽毛几乎无声
    }
    // 落定前解决层叠高度冲突(防同高闪烁)；实体积木做水平碰撞
    const wasSolidPush = this._collideSolids(item);
    this._resolveStack(item);
    if (wasSolidPush) {
      // 被推开的落点用一个短促缓动呈现“顶开”的手感
      const to = wasSolidPush;
      const from = { x: item.pos.x + (to.x - item.pos.x) * -0.25, z: item.pos.z + (to.z - item.pos.z) * -0.25 };
      item.pos.x = from.x; item.pos.z = from.z;
      tween({
        dur: 0.28, ease: easeOutCubic,
        onUpdate: (k) => {
          item.pos.x = from.x + (to.x - from.x) * k;
          item.pos.z = from.z + (to.z - from.z) * k;
        },
      });
    }
    // 落地下沉回弹（羽毛：慢飘摇摆）
    const from = item.liftY;
    if (item._settleTween) item._settleTween.dead = true;
    if (item.isFeather) {
      item._settleTween = tween({
        dur: 1.5, ease: easeOutCubic,
        onUpdate: (k) => { item.liftY = from * (1 - k); },
        onDone: () => { item.liftY = 0; item.state = 'table'; item._settleTween = null; },
      });
      return;
    }
    item._settleTween = tween({
      dur: 0.26, ease: easeOutCubic,
      onUpdate: (k) => { item.liftY = from * (1 - k) + (-0.018) * Math.sin(k * Math.PI); },
      onDone: () => { item.liftY = 0; item.state = 'table'; item._settleTween = null; },
    });
    // 轻微随机摆放角度
    if (item.kind === 'paper' || item.kind === 'film') {
      const fromR = item.rotZ;
      const toR = fromR + (Math.random() - 0.5) * 0.09;
      tween({ dur: 0.24, onUpdate: (k) => { item.rotZ = fromR + (toR - fromR) * k; } });
    }
  }

  // 确保落点附近没有同层高的薄片(防 z-fighting 闪烁)；实体积木走水平碰撞
  _resolveStack(item) {
    const isSolid = item.kind === 'cube' || item.kind === 'cyl';
    const others = this.items.filter(it => it !== item && it.active && !it.inTray && it.state !== 'cutting-hide');
    if (isSolid) {
      // 站在薄片上：抬高一点点避免与薄片同面
      let lift = 0;
      for (const o of others) {
        if ((o.kind === 'paper' || o.kind === 'film') &&
            Math.hypot(o.pos.x - item.pos.x, o.pos.z - item.pos.z) < 0.32) {
          lift = Math.max(lift, (o.stackY || 0) + 0.005);
        }
      }
      item.stackY = lift;
      return;
    }
    let y = 0.0028 * ((this._stackCounter || 0) % 12);
    for (let guard = 0; guard < 16; guard++) {
      const conflict = others.find(it =>
        (it.kind === 'paper' || it.kind === 'film') &&
        Math.hypot(it.pos.x - item.pos.x, it.pos.z - item.pos.z) < 0.3 &&
        Math.abs((it.stackY || 0) - y) < 0.002
      );
      if (!conflict) break;
      y += 0.0028;
    }
    item.stackY = y;
  }

  // 实体积木的水平碰撞：落点与另一块实体重叠时，把它沿连线推开（像真实物理）
  _collideSolids(item) {
    const isSolid = item.kind === 'cube' || item.kind === 'cyl';
    if (!isSolid) return null;
    const rSelf = (item.kind === 'cube' ? 0.24 : 0.2) + 0.02;
    for (let iter = 0; iter < 4; iter++) {
      let push = null, need = 0;
      for (const o of this.items) {
        if (o === item || !o.active || o.inTray || o.state === 'cutting-hide') continue;
        if (o.kind !== 'cube' && o.kind !== 'cyl') continue;
        const rOther = (o.kind === 'cube' ? 0.24 : 0.2) + 0.02;
        const dx = item.pos.x - o.pos.x, dz = item.pos.z - o.pos.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const minDist = rSelf + rOther;
        if (dist < minDist) {
          const f = (minDist - dist) / dist;
          push = push || { x: item.pos.x, z: item.pos.z };
          push.x += dx * f; push.z += dz * f;
          need = 1;
        }
      }
      if (!need) break;
      item.pos.x = clamp(push.x, ROOM.table.x0 + 0.15, ROOM.table.x1 - 0.15);
      item.pos.z = clamp(push.z, ROOM.table.z0 + 0.12, ROOM.table.z1 - 0.14);
    }
    return item.pos.clone();
  }

  sendToTray(item) {
    if (this.audio) this.audio.snap();
    item.state = 'toTray';
    const slot = this.slots[item.homeSlot];
    const fromPos = item.pos.clone();
    const fromTiltRot = item.rotZ;
    const fromStand = item.standK || 0;
    if (item._moveTween) item._moveTween.dead = true;
    item._moveTween = tween({
      dur: 0.5, ease: easeInOutCubic,
      onUpdate: (k) => {
        item.pos.x = fromPos.x + (slot.x - fromPos.x) * k;
        item.pos.z = fromPos.z + (slot.z - fromPos.z) * k;
        item.liftY = Math.sin(k * Math.PI) * 0.22;
        item.rotZ = fromTiltRot * (1 - k);
        item.standK = fromStand + (1 - fromStand) * Math.max(0, k * 1.6 - 0.6);
      },
      onDone: () => {
        item.state = 'tray'; item.inTray = true; item.liftY = 0; item.rotZ = 0; item.standK = 1;
        item.pos.set(slot.x, TABLE_Y, slot.z);
        item._moveTween = null;
      },
    });
  }

  liftFromTray(item) {
    item.inTray = false;
    item.state = 'drag';
  }

  /* ---------- 剪纸 ---------- */
  cutPaper(item, onDone) {
    if (!item.cuttable || item.state === 'cutting-hide') return;
    if (this.audio) this.audio.snip();
    item.state = 'cutting-hide';
    // 剪刀轻咬合
    if (item.kind === 'paper') { /* 动画由 gameplay 驱动剪刀 */ }
    const halves = [];
    const parentPos = item.pos.clone();
    const parentRot = item.rotZ;
    const dir = new THREE.Vector3(Math.cos(parentRot), 0, -Math.sin(parentRot)); // 局部 x 方向
    tween({
      dur: 0.55, delay: 0.12,
      onUpdate: () => {},
      onDone: () => {
        item.active = false;
        item.group.visible = false;
        this.shadows.remove(item.decal);
        const strokeImg = item.strokeCanvas ? item.strokeCanvas.toDataURL('image/png') : null;
        for (const side of ['L', 'R']) {
          const sign = side === 'L' ? -1 : 1;
          const h = this.addPaper(item.shapeKey, {
            half: side, size: item.size.w,
            strokeCanvas: item.strokeCanvas || undefined,
          });
          if (strokeImg) h._img = strokeImg;
          h.pos.copy(parentPos).addScaledVector(dir, sign * 0.012);
          h.rotZ = parentRot;
          h.stackY = item.stackY + 0.004;
          h.state = 'table';
          const from = 0;
          const half = h;
          tween({
            dur: 1.7, ease: easeInOutCubic, delay: side === 'L' ? 0 : 0.05,
            onUpdate: (k) => {
              half.pos.copy(parentPos).addScaledVector(dir, sign * (from + 0.1 * k));
            },
            onDone: () => { half.state = 'table'; onDone && onDone(); },
          });
          halves.push(h);
        }
      },
    });
    return halves;
  }

  /* ---------- 查找 ---------- */
  paperNear(worldPos, maxDist, excludeTool = true) {
    let best = null, bestD = maxDist;
    for (const it of this.items) {
      if (it.kind !== 'paper' || !it.cuttable) continue;
      if (it.state === 'cutting-hide' || !it.active) continue;
      const d = Math.hypot(it.pos.x - worldPos.x, it.pos.z - worldPos.z);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  itemsAtCount() { return this.items.length; }

  raycastTargets() {
    const list = [];
    for (const it of this.items) {
      if (!it.active || it.state === 'cutting-hide') continue;
      for (const ch of it.group.children) if (ch.userData.isHit) list.push(ch);
    }
    for (const c of this.cloudItems) {
      for (const ch of c.group.children) if (ch.userData.isHit) list.push(ch);
    }
    return list;
  }

  itemFromHit(hitMesh) {
    for (const it of this.items) {
      if (it.group.children.includes(hitMesh)) return it;
    }
    for (const c of this.cloudItems) {
      if (c.group.children.includes(hitMesh)) return c;
    }
    return null;
  }

  /* ---------- 云朵 ---------- */
  addClouds(sceneClouds) {
    const defs = [
      // 默认悬在窗外缘，开局阳光完整；拖进窗户才遮光
      { w: sceneClouds.cloud1, home: new THREE.Vector3(ROOM.cloudX, 3.95, 1.0), r: 0.78 },
      { w: sceneClouds.cloud2, home: new THREE.Vector3(ROOM.cloudX, 1.15, 2.85), r: 0.62 },
    ];
    for (const d of defs) {
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(d.r * 3.4, d.r * 3.0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
      );
      hit.userData.isHit = true;
      hit.rotation.y = Math.PI / 2;
      hit.position.y = 0.15;
      d.w.group.add(hit);
      d.w.group.position.copy(d.home);
      const c = {
        id: ++this._id, kind: 'cloud', group: d.w.group, wrapper: d.w,
        pos: d.home.clone(), home: d.home.clone(), r: d.r,
        liftY: 0, state: 'cloud', dragTarget: null,
        phase: Math.random() * 9,
      };
      this.cloudItems.push(c);
    }
  }

  /* ---------- 全部回托盘 ---------- */
  returnAllToTray() {
    for (const it of [...this.items]) {
      if (it.kind === 'paper' && it.half) {
        it.active = false; it.group.visible = false;
        this.shadows.remove(it.decal);
        this.scene.remove(it.group); this.scene.remove(it.blob);
        this.items.splice(this.items.indexOf(it), 1);
        continue;
      }
      if (it.homeSlot === null || it.homeSlot === undefined) continue;
      it.active = true; it.group.visible = true;
      it.state = 'toTray';
      it.standK = 0;
      const slot = this.slots[it.homeSlot];
      const fp = it.pos.clone(), fl = it.liftY, fs = it.standK;
      tween({
        dur: 0.55, ease: easeInOutCubic, delay: Math.random() * 0.25,
        onUpdate: (k) => {
          it.pos.x = fp.x + (slot.x - fp.x) * k;
          it.pos.z = fp.z + (slot.z - fp.z) * k;
          it.liftY = fl * (1 - k) + Math.sin(k * Math.PI) * 0.2;
          it.standK = fs + (1 - fs) * k; // 归位途中重新立起
        },
        onDone: () => { it.state = 'tray'; it.inTray = true; it.liftY = 0; it.standK = 1; },
      });
    }
    for (const c of this.cloudItems) {
      c.pos.copy(c.home);
      c.dragTarget = null;
    }
  }

  // 从编织篮里“倒”出一张新形状纸片（星星/小鱼/手掌 轮换）
  spawnFromBasket() {
    this.basketQueue = this.basketQueue || ['star', 'fish', 'hand'];
    const shape = this.basketQueue.shift();
    if (!shape) return null;
    const it = this.addPaper(shape);
    it.homeSlot = null;
    it.state = 'table';
    it.pos.set(2.05, TABLE_Y, 1.15);
    it.rotZ = (Math.random() - 0.5) * 0.5;
    it.liftY = 0.5;
    tween({
      dur: 0.9, ease: easeOutCubic,
      onUpdate: (k) => { it.liftY = 0.5 * (1 - k); },
      onDone: () => { it.liftY = 0; it.state = 'table'; },
    });
    this._resolveStack(it);
    return it;
  }

  // 把搁架零件取到桌面
  _takeFromShelf(it, x, z, rot) {
    it.inTray = false;
    it.state = 'table';
    it.standK = 0;
    it.liftY = 0;
    it.pos.set(x, TABLE_Y, z);
    it.rotZ = rot || 0;
    it.stackY = 0;
    this._resolveStack(it);
    this._applyTransform(it);
    return it;
  }

  /* ---------- 梦境存档：序列化 / 恢复 ---------- */
  serialize() {
    const out = [];
    for (const it of this.items) {
      if (!it.active || it.inTray || it.kind === 'magicPaper' || it.kind === 'scissors' || it.state === 'shelf') continue;
      const pos = { x: +it.pos.x.toFixed(3), z: +it.pos.z.toFixed(3), rot: +it.rotZ.toFixed(3) };
      if (it.kind === 'paper' && it.shapeKey === 'drawing') {
        let img = it._img;
        if (!img && it.strokeCanvas) {
          const sc = document.createElement('canvas');
          sc.width = 256; sc.height = 256;
          sc.getContext('2d').drawImage(it.strokeCanvas, 0, 0, 256, 256);
          img = sc.toDataURL('image/png');
          it._img = img;
        }
        out.push(it.half ? { t: 'dh', img, h: it.half, ...pos } : { t: 'd', img, ...pos });
      } else if (it.kind === 'paper') {
        out.push(it.half ? { t: 'h', s: it.shapeKey, h: it.half, ...pos } : { t: 'p', s: it.shapeKey, ...pos });
      } else if (it.kind === 'film') {
        out.push(it.state === 'gel'
          ? { t: 'f', c: it.colorKey, g: 1, gy: +it.gelY.toFixed(3), gz: +it.gelZ.toFixed(3) }
          : { t: 'f', c: it.colorKey, ...pos });
      } else if (it.kind === 'cube' || it.kind === 'cyl') {
        out.push({ t: 'b', k: it.kind, ...pos });
      } else if (it.kind === 'feather') {
        out.push({ t: 'fe', ...pos });
      } else if (it.kind === 'flashlight') {
        out.push({ t: 'fl', x: pos.x, z: pos.z, on: it.on !== false });
      } else if (it.kind === 'spin') {
        out.push({ t: 'sp', x: pos.x, z: pos.z });
      } else if (it.kind === 'arch') {
        out.push({ t: 'ar', ...pos });
      }
    }
    return out;
  }

  _removeItem(it) {
    it.active = false;
    it.group.visible = false;
    if (it.decal) this.shadows.remove(it.decal);
    this.scene.remove(it.group);
    this.scene.remove(it.blob);
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  // 恢复：清掉默认散件，然后按存档逐一归位
  restore(list) {
    for (const it of [...this.items]) {
      if ((it.homeSlot === null || it.homeSlot === undefined) && !it.homeShelf) this._removeItem(it);
    }
    // 依次归位并逐件解决层叠高度，杜绝恢复后的同高闪烁
    for (const e of list) {
      try {
        if (e.t === 'fl') {
          const it = this.items.find(i => i.kind === 'flashlight');
          if (!it) continue;
          this._takeFromShelf(it, e.x, e.z, 0);
          it.on = e.on !== false;
          continue;
        }
        if (e.t === 'sp') {
          const it = this.items.find(i => i.kind === 'spin');
          if (!it) continue;
          this._takeFromShelf(it, e.x, e.z, 0);
          continue;
        }
        if (e.t === 'ar') {
          const it = this.items.find(i => i.kind === 'arch');
          if (!it) continue;
          this._takeFromShelf(it, e.x, e.z, e.rot || 0);
          continue;
        }
        if (e.t === 'p' && e.s === 'doll') {
          let it = this.items.find(i => i.shapeKey === 'doll');
          if (it) this._takeFromShelf(it, e.x, e.z, e.rot || 0);
          else { it = this.addPaper('doll'); it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot || 0; it.state = 'table'; it.standK = 0; }
          continue;
        }
        if (e.t === 'p' && e.s === 'hand') {
          const it = this.addHandPaper();
          it.inTray = false; it.state = 'table'; it.standK = 0; it.liftY = 0;
          it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot;
          this._resolveStack(it);
          continue;
        }
        if (e.t === 'p') {
          let it = this.items.find(i => i.kind === 'paper' && i.shapeKey === e.s && !i.half && i.inTray);
          if (!it && this.PAPER_SHAPES_EXT && this.PAPER_SHAPES_EXT[e.s]) {
            it = this.addPaper(e.s); // 轮换新形状（星星/小鱼等）恢复
          }
          if (!it) continue;
          it.inTray = false; it.state = 'table'; it.standK = 0; it.liftY = 0;
          it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot;
          this._resolveStack(it);
        } else if (e.t === 'h' || e.t === 'dh') {
          const shape = e.t === 'h' ? e.s : 'drawing';
          const parent = this.items.find(i => i.kind === 'paper' && i.shapeKey === shape && !i.half && i.active);
          if (parent) {
            parent.active = false; parent.group.visible = false;
            if (parent.decal) { this.shadows.remove(parent.decal); parent.decal = null; }
          }
          let stroke = null;
          if (e.t === 'dh') {
            const cv = document.createElement('canvas');
            cv.width = 512; cv.height = 512;
            stroke = cv; // 图像 onload 后再绘制
            const img = new Image();
            const half = e.h, self = this;
            img.onload = () => {
              cv.getContext('2d').drawImage(img, 0, 0);
              const h = self.addPaper('drawing', { half, size: 0.72, strokeCanvas: cv });
              h.pos.set(e.x, TABLE_Y, e.z); h.rotZ = e.rot; h.state = 'table'; h.standK = 0; h.inTray = false;
              h._img = e.img;
            };
            img.src = e.img;
            continue;
          }
          const h = this.addPaper(shape, { half: e.h, size: 0.66 });
          h.pos.set(e.x, TABLE_Y, e.z); h.rotZ = e.rot; h.state = 'table'; h.standK = 0; h.inTray = false;
        } else if (e.t === 'd') {
          const img = new Image();
          const self = this;
          img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = 512; cv.height = 512;
            cv.getContext('2d').drawImage(img, 0, 0);
            const it = self.addDrawing(cv);
            it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot; it.liftY = 0; it.state = 'table';
          };
          img.src = e.img;
          continue;
        } else if (e.t === 'f') {
          const it = this.items.find(i => i.kind === 'film' && i.colorKey === e.c && i.inTray);
          if (!it) continue;
          if (e.g) {
            it.state = 'gel'; it.inTray = false; it.standK = 0;
            it.gelY = e.gy; it.gelZ = e.gz;
            if (this.onGelRestore) this.onGelRestore(it);
          } else {
            it.inTray = false; it.state = 'table'; it.standK = 0; it.liftY = 0;
            it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot || 0;
          }
        } else if (e.t === 'b') {
          const it = this.items.find(i => i.kind === e.k && i.inTray);
          if (!it) continue;
          it.inTray = false; it.state = 'table'; it.liftY = 0;
          it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot;
        } else if (e.t === 'pr') {
          const it = this.items.find(i => i.kind === 'prism' && i.inTray);
          if (!it) continue;
          it.inTray = false; it.state = 'table'; it.liftY = 0;
          it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot;
        } else if (e.t === 'fe') {
          const it = this.items.find(i => i.kind === 'feather' && i.inTray);
          if (!it) continue;
          it.inTray = false; it.state = 'table'; it.liftY = 0;
          it.pos.set(e.x, TABLE_Y, e.z); it.rotZ = e.rot;
        }
      } catch (err) { /* 单项损坏不影响其余 */ }
    }
  }

  /* ---------- 每帧 ---------- */
  update(dt, time) {
    this._time = time || 0;
    updateTweens(dt);
    for (const it of this.items) {
      // 拖拽平滑跟随（延迟极低）
      if (it.state === 'drag' && it.dragTarget) {
        const k = 1 - Math.exp(-dt * 17);
        it.pos.x += (it.dragTarget.x - it.pos.x) * k;
        it.pos.z += (it.dragTarget.z - it.pos.z) * k;
      }
      // 拖到桌面范围外轻推回（贴在玻璃上的胶片、搁架零件除外）
      if (it.state !== 'gel' && it.state !== 'shelf') {
        const t = ROOM.table;
        it.pos.x = clamp(it.pos.x, t.x0 + 0.15, t.x1 - 0.15);
        it.pos.z = clamp(it.pos.z, t.z0 + 0.12, t.z1 - 0.14);
      }
      // 鸟影扇翅计时
      if (it.flap) {
        it.flap.t += dt;
        if (it.flap.t > 1.75) it.flap = null;
      }
      // 棱镜高光闪烁
      if (it.kind === 'prism' && it.glint) {
        it.glint.material.opacity = Math.pow(Math.abs(Math.sin(this._time * 0.9 + it.glintPhase)), 14) * 0.85;
      }
      // 剪影筒在桌面上缓缓旋转
      if (it.kind === 'spin' && it.spinTex) {
        it.spinTex.offset.x = (it.spinTex.offset.x - dt * 0.05) % 1;
      }
      this._applyTransform(it);
    }
    for (const c of this.cloudItems) {
      if (c.state === 'drag' && c.dragTarget) {
        const k = 1 - Math.exp(-dt * 7.5); // 云朵漂浮滞后感
        c.pos.y += (c.dragTarget.y - c.pos.y) * k;
        c.pos.z += (c.dragTarget.z - c.pos.z) * k;
      }
      c.pos.y = clamp(c.pos.y, ROOM.win.y0 - 0.25, ROOM.win.y1 + 0.3);
      c.pos.z = clamp(c.pos.z, ROOM.win.z0 - 0.2, ROOM.win.z1 + 0.25);
      c.group.position.set(ROOM.cloudX + Math.sin(time * 0.4 + c.phase) * 0.03, c.pos.y + Math.sin(time * 0.7 + c.phase) * 0.045, c.pos.z);
    }
  }
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
