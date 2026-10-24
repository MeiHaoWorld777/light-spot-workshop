// game.js — 主控：装配场景/道具/光影/交互/UI，驱动主循环

import * as THREE from '../lib/three.module.js';
import { buildScene, ROOM } from './scene.js?v=22';
import { ShadowSystem } from './shadows.js?v=22';
import { ItemManager, tween, easeInOutCubic, easeOutBack } from './items.js?v=22'; // easeOutBack 供钉墙动画
import { AudioEngine } from './audio.js?v=22';
import { Gameplay } from './gameplay.js?v=22';
import { UI } from './ui.js?v=22';
import { makeDeskTitleCanvas, cloudGlowTexture, fireflyCoreTexture } from './textures.js';

class Game {
  constructor() {
    this.S = buildScene(document.getElementById('app'));
    this.shadows = new ShadowSystem(this.S.scene, this.S.sunState);
    this.audio = new AudioEngine();
    this.items = new ItemManager(this.S.scene, this.shadows, this.audio);
    this.items.addClouds(this.S.clouds);

    this.playEnabled = false;
    this.settingsOpen = false;
    this.drawOpen = false;
    this.playMinutes = 10;
    this.introBeam = 0;
    this.lastInputT = 0;
    this.duskV = 0;
    this.duskStarted = false;
    this.deskTitleOpacity = 0;
    this.time = 0;
    this.theaterOn = false;
    this.gels = [];
    this.pinIdx = 0;
    this.pinned = [];
    this._flyBirdTimer = 14 + Math.random() * 10;
    this._flyBirdT = -1;
    this.nightV = 0;
    this._saveT = 0;
    this.hasDream = !!localStorage.getItem('lsp_dream');
    this._theaterRec = [];     // 剧场录制:物件轨迹帧
    this._recT = 0;
    this._replaying = false;
    // 教师观察统计(跨会话累计)
    let st = {};
    try { st = JSON.parse(localStorage.getItem('lsp_stats') || '{}'); } catch (e) { st = {}; }
    this.stats = {
      playSec: st.playSec || 0, cuts: st.cuts || 0,
      drawings: st.drawings || 0, gels: st.gels || 0, photos: st.photos || 0,
    };

    this._createTrayItems();
    this._scatterIntro();
    this._createDeskTitle();
    this._createLightBug();

    // 玻璃贴纸预览
    this.glassGhost = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
    );
    this.glassGhost.rotation.y = Math.PI / 2;
    this.glassGhost.visible = false;
    this.S.scene.add(this.glassGhost);

    this.gameplay = new Gameplay(this);
    this.ui = new UI(this);
    this._loadPinsOnBoot();
    // 玻璃纸恢复时的染色回调
    this.items.onGelRestore = (it) => { this.gels.push(it); this._updateGelTint(); };
    // 右墙搁架新零件
    this.items.addSpin();
    this.items.addShelfDoll();
    this.items.addArch();
    // 手电筒第二影系统 + 剪影筒流动光带（手电筒在托盘中）
    this.shadows.addFlashlight(this.items.items.find(i => i.kind === 'flashlight'));
    this.shadows.addSpinBand(this.items.items.find(i => i.kind === 'spin'));
    this.childPose = 0;      // 0 常规视角 / 1 孩子视角
    this.childPoseTarget = 0;
    // 编织篮点按：倒出新纸片
    this.basketQueueEmpty = false;
    this.basketTap = () => {
      if (this.basketQueueEmpty) {
        // 空了：篮子轻轻晃一下示意
        const b = this.S.basket;
        tween({
          dur: 0.5, ease: easeInOutCubic,
          onUpdate: (k) => { b.rotation.z = Math.sin(k * Math.PI * 3) * 0.06 * (1 - k); },
        });
        return false;
      }
      const it = this.items.spawnFromBasket();
      if (!it) { this.basketQueueEmpty = true; return false; }
      this.audio.pickPaper();
      this.saveDream();
      return true;
    };
    // 梦境存档：有档恢复，无档撒默认散件
    if (this.hasDream) {
      try { this.loadDream(); } catch (e) { /* 存档损坏则从空桌面开始 */ }
    } else {
      this._scatterIntro();
    }

    // 调试/自动化测试钩子
    window.__lsp = {
      game: this,
      screenPos: (item) => this._screenPos(item),
      skipIntro: () => this.ui.skipIntro(),
      state: () => ({
        intro: this.ui.introActive,
        items: this.items.items.map(i => ({ k: i.kind, s: i.shapeKey, half: i.half, x: +i.pos.x.toFixed(2), z: +i.pos.z.toFixed(2), tray: i.inTray })),
        clouds: this.items.cloudItems.map(c => ({ y: +c.pos.y.toFixed(2), z: +c.pos.z.toFixed(2) })),
        sun: +this.S.sunState.intensity.toFixed(3),
        dusk: +this.duskV.toFixed(3),
        playEnabled: this.playEnabled,
      }),
      setSun: (v) => { this.S.sunState.intensity = v; },
      setElevation: (v) => { this.S.sunState.elevation = v; },
      theater: () => this.toggleTheater(),
      night: (v) => { this.S.sunState.night = v; this.audio.night = v; },
      basketTap: () => this.basketTap(),
      childView: () => this.toggleChildView(),
      replay: () => this._replayTake(),
      dream: () => this.items.serialize(),
      shots: () => JSON.parse(localStorage.getItem('lsp_shots') || '[]').length,
    };

    window.addEventListener('visibilitychange', () => {
      if (document.hidden && this.audio.ctx) this.audio.ctx.suspend();
      else if (this.audio.ctx) this.audio.ctx.resume();
      if (document.hidden) this.saveDream();
    });
    window.addEventListener('pagehide', () => this.saveDream());

    this._last = performance.now();
    // 主循环：rAF 为主；Worker 节拍器兜底（部分 WebView 会在页面遮挡时挂起 rAF）
    const tick = (now) => {
      const dt = Math.min(0.05, (now - this._last) / 1000);
      if (dt < 0.008) return; // rAF 与 worker 双驱去重
      this._last = now;
      this.time += dt;
      this.update(dt);
      this.S.render();
    };
    const loop = (now) => { tick(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try {
      const workerSrc = 'let id=null;onmessage=e=>{if(e.data==="start"&&!id){id=setInterval(()=>postMessage(1),16);}};';
      const w = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'application/javascript' })));
      w.onmessage = () => tick(performance.now());
      w.postMessage('start');
    } catch (e) { /* 无 Worker 环境则仅 rAF */ }
  }

  /* ---------- 布景 ---------- */
  _createTrayItems() {
    const slotDefs = this.items.slots;
    slotDefs.forEach((slot, i) => {
      let item = null;
      switch (slot.key) {
        case 'leaf': item = this.items.addPaper('leaf'); break;
        case 'petal': item = this.items.addPaper('petal'); break;
        case 'bird': item = this.items.addPaper('bird'); break;
        case 'rabbit': item = this.items.addPaper('rabbit'); break;
        case 'filmR': item = this.items.addFilm('R'); break;
        case 'filmY': item = this.items.addFilm('Y'); break;
        case 'filmB': item = this.items.addFilm('B'); break;
        case 'cube': item = this.items.addBlock('cube'); break;
        case 'cyl': item = this.items.addBlock('cyl'); break;
        case 'scissors': item = this.items.addScissors(); break;
        case 'magic': item = this.items.addMagicPaper(); break;
        case 'feather': item = this.items.addFeather(); break;
        case 'flashlight': item = this.items.addFlashlight(); break;
      }
      item.homeSlot = i;
      item.pos.set(slot.x, ROOM.tableY, slot.z);
      item.state = 'tray';
      item.inTray = true;
      item.standK = 1;
    });
  }

  _scatterIntro() {
    // 开场镜头里散放的几片小纸片
    const petal = this.items.addPaper('petal', { size: 0.6 });
    petal.pos.set(-1.35, ROOM.tableY, 1.62);
    petal.rotZ = 0.35;
    const film = this.items.addFilm('B');
    film.pos.set(-0.72, ROOM.tableY, 2.15);
    film.rotZ = -0.2;
  }

  _createDeskTitle() {
    const tex = new THREE.CanvasTexture(makeDeskTitleCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.deskTitleMat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    });
    this.deskTitle = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.85), this.deskTitleMat);
    this.deskTitle.rotation.set(-Math.PI / 2, 0, 0.03);
    this.deskTitle.position.set(-0.45, ROOM.tableY + 0.009, 1.05);
    this.deskTitle.renderOrder = 7;
    this.S.scene.add(this.deskTitle);
  }

  _createLightBug() {
    // 萤火虫：炽亮核心 + 呼吸光晕 + 扑翅 + 拖尾光尘，可点击炸开
    const coreTex = new THREE.CanvasTexture(fireflyCoreTexture());
    const haloTex = new THREE.CanvasTexture(cloudGlowTexture());
    const mk = (tex, scale, color, op) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, transparent: true, opacity: op,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      sp.scale.set(scale, scale, 1);
      return sp;
    };
    const group = new THREE.Group();
    const halo = mk(haloTex, 0.95, '#FFCF7E', 0.5);
    // 核心：普通混合的炽亮实点，在亮墙上也清晰可读
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex, color: '#FFFBEA', transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.NormalBlending,
    }));
    core.scale.set(0.13, 0.13, 1);
    group.add(halo, core);
    // 半透明小翅膀
    const wingMat = new THREE.MeshBasicMaterial({
      color: '#FFF3DA', transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wingGeo = new THREE.PlaneGeometry(0.14, 0.07);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.x = -0.07; wingR.position.x = 0.07;
    group.add(wingL, wingR);
    // 点击热区
    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.75),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide })
    );
    hit.userData.isFirefly = true;
    group.add(hit);
    group.visible = false;
    this.S.scene.add(group);
    // 拖尾与炸开光尘池
    const trail = [];
    for (let i = 0; i < 12; i++) {
      const t = mk(coreTex, 0.08, '#FFE9B8', 0);
      t.userData.life = 0;
      this.S.scene.add(t);
      trail.push(t);
    }
    const sparks = [];
    for (let i = 0; i < 16; i++) {
      const t = mk(coreTex, 0.09, '#FFE9B8', 0);
      t.userData = { life: 0, vx: 0, vy: 0 };
      this.S.scene.add(t);
      sparks.push(t);
    }
    this.firefly = {
      group, core, halo, wingL, wingR, hit, trail, sparks,
      active: false, t: 0, dur: 7, curve: null, trailT: 0,
      burstT: -1, baseScale: 1,
    };
    this.lightBug = group; // 兼容旧引用
  }

  spawnLightBug() {
    const f = this.firefly;
    if (f.active) return;
    // 有机游走路径：影区里随机 5 个锚点的平滑曲线
    const pts = [];
    let x = -2.4 + Math.random() * 1.2, y = 1.0 + Math.random() * 0.8;
    for (let i = 0; i < 5; i++) {
      x = clamp(x + 0.7 + Math.random() * 0.9, -2.6, 2.9);
      y = clamp(y + (Math.random() - 0.5) * 1.5, 0.8, 3.0);
      pts.push(new THREE.Vector3(x, y, ROOM.wallZ + 0.1));
    }
    f.curve = new THREE.CatmullRomCurve3(pts);
    f.t = 0; f.dur = 6.5 + Math.random() * 2; f.active = true; f.burstT = -1;
    f.trailT = 0;
    f.group.visible = true;
    f.group.position.copy(pts[0]);
    this._fireflyActive = true;
  }

  _updateFirefly(dt) {
    const f = this.firefly;
    if (!f || !f.active) return;
    f.t += dt;
    const k = f.t / f.dur;
    if (f.burstT >= 0) {
      // 被点中：炸开的光尘四散
      f.burstT += dt;
      for (const sp of f.sparks) {
        if (sp.userData.life <= 0) continue;
        sp.userData.life -= dt / 1.0;
        sp.position.x += sp.userData.vx * dt;
        sp.position.y += sp.userData.vy * dt;
        sp.userData.vx *= Math.pow(0.35, dt);
        sp.userData.vy *= Math.pow(0.35, dt);
        sp.material.opacity = Math.max(0, sp.userData.life) * 0.8;
        sp.scale.setScalar(0.05 + 0.09 * Math.max(0, sp.userData.life));
      }
      // 光晕余晖
      f.halo.material.opacity = Math.max(0, 1 - f.burstT / 0.7) * 0.8;
      f.halo.scale.setScalar(0.95 + f.burstT * 2.2);
      f.core.material.opacity = Math.max(0, 1 - f.burstT / 0.35);
      if (f.burstT > 1.0) {
        f.active = false;
        f.group.visible = false;
        for (const sp of f.sparks) sp.material.opacity = 0;
      }
      return;
    }
    if (k >= 1) { f.active = false; f.group.visible = false; return; }
    // 沿曲线游走 + 轻微上下浮动
    const p = f.curve.getPoint(k);
    p.y += Math.sin(f.t * 2.1) * 0.05;
    f.group.position.copy(p);
    // 呼吸光晕
    const env = Math.min(1, f.t / 0.6) * Math.min(1, (1 - k) / 0.14);
    f.halo.material.opacity = env * (0.4 + Math.sin(f.t * 5.5) * 0.14);
    f.halo.scale.setScalar(0.9 + Math.sin(f.t * 5.5) * 0.1);
    f.core.material.opacity = env * (0.85 + Math.sin(f.t * 5.5 + 1.2) * 0.15);
    f.core.scale.setScalar(0.15 + Math.sin(f.t * 5.5) * 0.02);
    // 扑翅
    f.wingL.rotation.z = 0.5 + Math.sin(f.t * 34) * 0.45;
    f.wingR.rotation.z = -0.5 - Math.sin(f.t * 34) * 0.45;
    // 拖尾光尘
    f.trailT += dt;
    if (f.trailT > 0.07) {
      f.trailT = 0;
      const slot = f.trail.find(t => t.userData.life <= 0) || f.trail[0];
      slot.position.copy(f.group.position);
      slot.userData.life = 1;
    }
    for (const t of f.trail) {
      if (t.userData.life > 0) {
        t.userData.life -= dt / 0.85;
        t.material.opacity = Math.max(0, t.userData.life) * 0.32;
        t.scale.setScalar(0.04 + 0.07 * Math.max(0, t.userData.life));
      }
    }
  }

  burstFirefly() {
    const f = this.firefly;
    if (!f || !f.active || f.burstT >= 0) return;
    f.burstT = 0;
    const c = f.group.position;
    for (const sp of f.sparks) {
      const a = Math.random() * Math.PI * 2;
      const sp2 = 0.55 + Math.random() * 0.95;
      sp.userData.vx = Math.cos(a) * sp2;
      sp.userData.vy = Math.sin(a) * sp2 * 0.8;
      sp.userData.life = 0.75 + Math.random() * 0.25;
      sp.position.set(c.x, c.y, c.z + 0.02);
    }
    this.audio.sparkle();
  }

  /* ---------- 开场 ---------- */
  setIntroCamera(k) {
    const S = this.S;
    const startPos = new THREE.Vector3(-2.2, 3.1, 1.9);
    const startLook = new THREE.Vector3(-1.6, 2.6, 0.4);
    const e = easeInOutCubic(k);
    S.camera.position.lerpVectors(startPos, S.camBase, e);
    _look.copy(startLook).lerp(S.camLook, e);
    S.camera.lookAt(_look);
  }

  onIntroDone() {
    this.playEnabled = true;
    // 桌面浅痕标题缓缓浮现
    tween({
      dur: 1.6, ease: easeInOutCubic,
      onUpdate: (k) => { this.deskTitleOpacity = k * 0.85; },
    });
  }

  fadeDeskTitle() {
    if (this._deskFaded) return;
    this._deskFaded = true;
    const from = this.deskTitleOpacity;
    tween({
      dur: 2.2, ease: easeInOutCubic,
      onUpdate: (k) => { this.deskTitleOpacity = from * (1 - k); },
    });
  }

  /* ---------- 彩蛋：墙面光斑小虫 ---------- */
  spawnLightBug() {
    const f = this.firefly;
    if (!f || f.active) return;
    // 有机游走路径：影区里随机 5 个锚点的平滑曲线
    const pts = [];
    let x = -2.4 + Math.random() * 1.2, y = 1.0 + Math.random() * 0.8;
    for (let i = 0; i < 5; i++) {
      x = clamp(x + 0.7 + Math.random() * 0.9, -2.6, 2.9);
      y = clamp(y + (Math.random() - 0.5) * 1.5, 0.8, 3.0);
      pts.push(new THREE.Vector3(x, y, ROOM.wallZ + 0.1));
    }
    f.curve = new THREE.CatmullRomCurve3(pts);
    f.t = 0; f.dur = 6.5 + Math.random() * 2; f.active = true; f.burstT = -1;
    f.trailT = 0;
    f.group.visible = true;
    f.group.position.copy(pts[0]);
  }

  toggleChildView() {
    this.childPoseTarget = this.childPoseTarget > 0.5 ? 0 : 1;
    const from = this.childPose, to = this.childPoseTarget;
    tween({
      dur: 1.6, ease: easeInOutCubic,
      onUpdate: (k) => { this.childPose = from + (to - from) * k; },
    });
    this.audio.pickPaper();
  }

  /* ---------- 影子剧场 ---------- */
  toggleTheater() {
    const goingOn = !this.theaterOn;
    // 收幕时:若录到了一段演出,先自动重演一遍,再落灯光收幕
    if (!goingOn && this._theaterRec.length >= 4) {
      this._replayTake();
      return;
    }
    this.theaterOn = goingOn;
    const from = this.S.sunState.theater, to = this.theaterOn ? 1 : 0;
    const sheet = this.S.theater.sheet;
    if (goingOn) this._theaterRec = []; // 重新开始录制
    tween({
      dur: 1.8, ease: easeInOutCubic,
      onUpdate: (k) => {
        const v = from + (to - from) * k;
        this.S.sunState.theater = v;
        sheet.scale.y = Math.max(0.001, v);
      },
    });
    if (this.theaterOn) this.audio.chimeWarm();
    else this.audio.pickPaper();
  }

  _sampleTheater() {
    return this.items.items
      .filter(i => i.active && !i.inTray && i.homeSlot !== null && (i.state === 'table' || i.state === 'anim'))
      .map(i => ({ id: i.id, x: +i.pos.x.toFixed(3), z: +i.pos.z.toFixed(3), rot: +i.rotZ.toFixed(3) }));
  }

  _replayTake() {
    const frames = this._theaterRec;
    this._replaying = true;
    this.audio.chimeWarm();
    const dur = Math.min(12, Math.max(3, frames.length * 0.15));
    tween({
      dur, ease: (t) => t,
      onUpdate: (k) => {
        const idx = k * (frames.length - 1);
        const i0 = Math.floor(idx), i1 = Math.min(frames.length - 1, i0 + 1), f = idx - i0;
        for (const e of frames[i0]) {
          const t1 = frames[i1].find(x => x.id === e.id) || e;
          const it = this.items.items.find(i => i.id === e.id);
          if (!it || !it.active) continue;
          it.pos.x = e.x + (t1.x - e.x) * f;
          it.pos.z = e.z + (t1.z - e.z) * f;
          it.rotZ = e.rot + (t1.rot - e.rot) * f;
        }
      },
      onDone: () => {
        this._replaying = false;
        this.audio.sparkle();
        // 谢幕:桌上的物件集体轻轻鞠躬两次
        const bowItems = this.items.items.filter(i => i.active && !i.inTray && i.homeSlot !== null && (i.state === 'table'));
        const starts = bowItems.map(i => i.liftY);
        tween({
          dur: 1.6, ease: (t) => t,
          onUpdate: (k) => {
            bowItems.forEach((it, idx) => {
              it.liftY = Math.abs(Math.sin(k * Math.PI * 2)) * 0.1 * (1 - k * 0.3) + starts[idx] * (1 - k);
            });
          },
          onDone: () => {
            bowItems.forEach((it) => { it.liftY = 0; });
            // 收幕亮灯
            const from = this.S.sunState.theater, sheet = this.S.theater.sheet;
            this.theaterOn = false;
            tween({
              dur: 1.8, ease: easeInOutCubic,
              onUpdate: (k) => {
                this.S.sunState.theater = from * (1 - k);
                sheet.scale.y = Math.max(0.001, from * (1 - k));
              },
            });
          },
        });
      },
    });
  }

  /* ---------- 窗户玻璃纸 ---------- */
  showGlassGhost(y, z, colorKey) {
    const gh = this.glassGhost;
    gh.visible = true;
    gh.position.set(ROOM.wallX + 0.07, y, z);
    gh.material.color.set({ R: '#FF8A76', Y: '#FFD24A', B: '#6FA5E8' }[colorKey] || '#FFFFFF');
    gh.material.opacity = 0.3 + Math.sin(this.time * 6) * 0.06;
  }

  hideGlassGhost() {
    if (this.glassGhost) this.glassGhost.visible = false;
  }

  stickFilm(item, pt) {
    this.stats.gels++;
    item.state = 'gel';
    item.inTray = false;
    item.gelY = clamp(pt.y, ROOM.win.y0 + 0.38, ROOM.win.y1 - 0.38);
    item.gelZ = clamp(pt.z, ROOM.win.z0 + 0.38, ROOM.win.z1 - 0.38);
    this.gels.push(item);
    this._updateGelTint();
    this.audio.snap();
  }

  unstickFilm(item) {
    const i = this.gels.indexOf(item);
    if (i >= 0) this.gels.splice(i, 1);
    this._updateGelTint();
    item.state = 'anim';
    this.audio.pickPaper();
    if (item.homeSlot !== null && item.homeSlot !== undefined) this.items.sendToTray(item);
  }

  _updateGelTint() {
    const tint = new THREE.Color('#FFFFFF');
    const raw = new THREE.Color('#FFFFFF');
    const strong = { R: '#FF8A76', Y: '#FFD24A', B: '#6FA5E8' };
    for (const gel of this.gels) {
      tint.multiply(new THREE.Color(strong[gel.colorKey] || '#FFFFFF'));
      raw.multiply(new THREE.Color(strong[gel.colorKey] || '#FFFFFF'));
    }
    // 柔化 22%：染色明显但不压抑
    tint.lerp(new THREE.Color('#FFFFFF'), 0.22);
    this.S.sunState.gelTint.copy(tint);
    this.S.sunState.gelRaw = raw; // 未柔化的纯色，供棱镜单色光带使用
  }

  /* ---------- 手绘剪影 ---------- */
  spawnDrawing(strokeCanvas) {
    this.stats.drawings++;
    const item = this.items.addDrawing(strokeCanvas);
    item.pos.set(-1.15 + Math.random() * 0.5, ROOM.tableY, 1.5 + Math.random() * 0.5);
    // 缩到 256 再存，省 localStorage 空间
    const sc = document.createElement('canvas');
    sc.width = 256; sc.height = 256;
    sc.getContext('2d').drawImage(strokeCanvas, 0, 0, 256, 256);
    item._img = sc.toDataURL('image/png');
    this.saveDream();
    this.audio.sparkle();
    return item;
  }

  /* ---------- 照片钉上展示板 ---------- */
  addPin(dataURL, instant = false) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FDF8EE';
      ctx.fillRect(0, 0, 128, 100);
      const iw = img.width, ih = img.height;
      const s = Math.max(112 / iw, 84 / ih);
      const dw = iw * s, dh = ih * s;
      ctx.drawImage(img, (128 - dw) / 2, (100 - dh) / 2, dw, dh);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const slot = this.S.board.slots[this.pinIdx % this.S.board.slots.length];
      this.pinIdx++;
      const pin = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.265),
        new THREE.MeshBasicMaterial({ map: tex, transparent: false })
      );
      pin.position.copy(slot);
      pin.rotation.z = (Math.random() - 0.5) * 0.14;
      pin.renderOrder = 12;
      this.S.scene.add(pin);
      this.pinned.push(pin);
      if (this.pinned.length > 9) {
        const old = this.pinned.shift();
        this.S.scene.remove(old);
      }
      if (!instant) {
        pin.scale.setScalar(0.01);
        tween({
          dur: 0.7, ease: easeOutBack,
          onUpdate: (k) => { pin.scale.setScalar(0.01 + 0.99 * k); },
        });
        this.audio.sparkle();
      }
    };
    img.src = dataURL;
  }

  /* ---------- 梦境存档 ---------- */
  saveDream() {
    try {
      const data = {
        v: 1,
        items: this.items.serialize(),
        elev: +this.S.sunState.elevation.toFixed(3),
        clouds: this.items.cloudItems.map(c => ({ y: +c.pos.y.toFixed(2), z: +c.pos.z.toFixed(2) })),
      };
      localStorage.setItem('lsp_dream', JSON.stringify(data));
      this.hasDream = true;
    } catch (e) { /* 配额或隐私模式忽略 */ }
  }

  loadDream() {
    const raw = localStorage.getItem('lsp_dream');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return false;
    this.items.restore(data.items);
    if (typeof data.elev === 'number') this.S.sunState.elevation = clamp(data.elev, 0, 1);
    if (Array.isArray(data.clouds)) {
      data.clouds.forEach((c, i) => {
        const cloud = this.items.cloudItems[i];
        if (cloud && typeof c.y === 'number') { cloud.pos.y = c.y; cloud.pos.z = c.z; cloud.home = cloud.home || cloud.pos.clone(); }
      });
    }
    return true;
  }

  /* ---------- 落山 / 恢复 / 重置 ---------- */
  triggerDusk() {
    if (this.duskStarted) return;
    this.duskStarted = true;
    this.audio.sunsetChime();
    if (this._duskTween) this._duskTween.dead = true;
    this._duskTween = tween({
      dur: 40, ease: (t) => t,
      onUpdate: (k) => { this.duskV = k; },
      onDone: () => {
        // 太阳完全落山后，月亮缓缓升起
        if (this._nightTween) this._nightTween.dead = true;
        this._nightTween = tween({
          dur: 26, ease: easeInOutCubic,
          onUpdate: (k) => { this.S.sunState.night = k; this.audio.night = k; },
        });
      },
    });
  }

  restoreDay() {
    this.duskStarted = false;
    this.gameplay.playT = 0;
    if (this._duskTween) { this._duskTween.dead = true; this._duskTween = null; }
    if (this._nightTween) { this._nightTween.dead = true; this._nightTween = null; }
    const fromD = this.duskV, fromN = this.S.sunState.night;
    if (this._restoreTween) this._restoreTween.dead = true;
    this._restoreTween = tween({
      dur: 3.5, ease: easeInOutCubic,
      onUpdate: (k) => {
        this.duskV = fromD * (1 - k);
        this.S.sunState.night = fromN * (1 - k);
        this.audio.night = this.S.sunState.night;
      },
    });
  }

  resetAll() {
    // 篮子纸片与孩子的画一并收回，桌面回到最初布置（搁架零件归架）
    for (const it of [...this.items.items]) {
      if ((it.homeSlot === null || it.homeSlot === undefined) && !it.homeShelf) this.items._removeItem(it);
    }
    this.items.basketQueue = ['star', 'fish', 'hand'];
    this.basketQueueEmpty = false;
    this.items.returnAllToTray();
    this.restoreDay();
    this.duskV = 0;
    this.S.sunState.night = 0;
    this.audio.night = 0;
    localStorage.removeItem('lsp_dream');
    this.hasDream = false;
    const o = this.gameplay.orbit;
    o.targetYaw = 0; o.targetPitch = 0;
    for (const gel of [...this.gels]) this.unstickFilm(gel);
    // 搁架零件归架
    for (const it of this.items.items) {
      if (it.homeShelf) {
        it.state = 'shelf';
        it.pos.copy(it.shelfPos);
        it.rotZ = 0; it.liftY = 0; it.stackY = 0; it.standK = 1;
        if (it.kind === 'flashlight') it.on = true;
        this.items._applyShelfTransform(it);
      }
    }
  }

  /* ---------- 拍照保存 ---------- */
  captureShot() {
    try {
      const src = this.S.renderer.domElement;
      const maxW = 1280;
      const scale = Math.min(1, maxW / src.width);
      const c = document.createElement('canvas');
      c.width = Math.round(src.width * scale);
      c.height = Math.round(src.height * scale);
      const ctx = c.getContext('2d');
      this.S.render();
      ctx.drawImage(src, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.82);
      let shots = [];
      try { shots = JSON.parse(localStorage.getItem('lsp_shots') || '[]'); } catch (e) { /* 忽略 */ }
      shots.unshift(data);
      while (shots.length > 20) shots.pop();
      try { localStorage.setItem('lsp_shots', JSON.stringify(shots)); } catch (e) { shots.pop(); try { localStorage.setItem('lsp_shots', JSON.stringify(shots)); } catch (e2) { /* 忽略 */ } }
      this.stats.photos++;
      this.addPin(data);
    } catch (e) { /* 忽略 */ }
  }

  _loadPinsOnBoot() {
    let shots = [];
    try { shots = JSON.parse(localStorage.getItem('lsp_shots') || '[]'); } catch (e) { /* 忽略 */ }
    shots.slice(0, 9).reverse().forEach(d => this.addPin(d, true));
  }

  _screenPos(item) {
    const v = item.pos.clone();
    v.y = ROOM.tableY;
    v.project(this.S.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  /* ---------- 主循环更新 ---------- */
  update(dt) {
    const S = this.S;
    this.ui.update(dt);
    this.items.update(dt, this.time);
    this.gameplay.update(dt);

    // 云朵遮光 → 光强目标
    let occl = 0;
    const w = ROOM.win;
    for (const c of this.items.cloudItems) {
      let cover = 0, n = 0;
      for (let iy = 0; iy <= 5; iy++) {
        for (let iz = 0; iz <= 5; iz++) {
          const y = w.y0 + (w.y1 - w.y0) * (iy / 5);
          const z = w.z0 + (w.z1 - w.z0) * (iz / 5);
          const dy = y - c.pos.y, dz = z - c.pos.z;
          n++;
          if (dy * dy + dz * dz < c.r * c.r * 1.15) cover++;
        }
      }
      occl = Math.max(occl, cover / n);
    }
    const beamRamp = this.ui.introActive ? this.introBeam : 1;
    // 感知曲线：小云朵也有可感知的变暗，全覆盖时趋近柔和漫射
    const target = beamRamp * (1 - 0.97 * Math.pow(occl, 0.5));
    const s = S.sunState;
    s.intensity += (target - s.intensity) * Math.min(1, dt * 2.6);
    s.wallCool = clamp(1.35 - s.intensity * 1.9, 0, 1) * beamRamp;
    s.dusk = this.duskV;
    this.ui.setDuskDim(this.duskV * 0.32);

    // 桌面标题透明度
    this.deskTitleMat.opacity = this.deskTitleOpacity;

    // 萤火虫（墙面三连点彩蛋，可点击）
    this._updateFirefly(dt);

    // 剧场过渡
    const th = S.sunState.theater;
    S.theater.sheet.scale.y = Math.max(0.001, Math.max(th, 0.001));
    const Ith = S.sunState.intensity * (1 - this.duskV * 0.7);
    S.theater.glowMat.opacity = th * (0.4 + Math.sin(this.time * 10) * 0.028) * (0.35 + 0.65 * Ith);
    // 绿植摇曳
    for (const lf of S.plant.leaves) {
      if (lf.userData.baseZ === undefined) lf.userData.baseZ = lf.rotation.z;
      lf.rotation.z = lf.userData.baseZ + Math.sin(this.time * 0.9 + lf.userData.phase) * 0.055;
    }
    // 彩旗轻摇(风越大越明显) + 泰迪呼吸
    const wind = this.audio.windLevel || 0;
    for (const flag of S.buntingFlags) {
      flag.rotation.x = Math.sin(this.time * 0.8 + flag.userData.phase) * (0.05 + wind * 0.22);
      flag.rotation.y = Math.sin(this.time * 0.5 + flag.userData.phase) * 0.05;
    }
    if (S.teddy) S.teddy.scale.y = 1 + Math.sin(this.time * 1.2) * 0.012;
    // 风铃：拖云时轻晃轻鸣
    S.chime.rotation.z = Math.sin(this.time * 1.4) * 0.06 * (0.3 + wind);
    S.chime.rotation.x = Math.cos(this.time * 1.1) * 0.05 * (0.3 + wind);
    if (wind > 0.4 && Math.random() < dt * 0.5) {
      const notes = [783.99, 880, 1046.5];
      this.audio.tone({ freq: notes[Math.floor(Math.random() * 3)], peak: 0.016, dur: 0.9 });
    }
    // 窗外飞鸟
    if (this._flyBirdT < 0) {
      this._flyBirdTimer -= dt;
      if (this._flyBirdTimer <= 0 && this.playEnabled && this.S.sunState.night < 0.3) {
        this._flyBirdT = 0;
        S.flyBird.visible = true;
      }
    } else {
      this._flyBirdT += dt;
      const k = this._flyBirdT / 3.2;
      if (k >= 1) {
        this._flyBirdT = -1;
        S.flyBird.visible = false;
        this._flyBirdTimer = 22 + Math.random() * 22;
      } else {
        S.flyBird.position.set(ROOM.wallX - 1.2, 2.7 + Math.sin(k * 5.2) * 0.3, 3.0 - k * 2.2);
        S.flyBird.children[0].rotation.z = Math.sin(this.time * 16) * 0.5;
        S.flyBird.children[1].rotation.z = -Math.sin(this.time * 16) * 0.5;
      }
    }
    this.items.nightLevel = S.sunState.night;

    // 教师观察统计:游玩时长累计
    if (this.playEnabled && !this.settingsOpen) this.stats.playSec += dt;
    // 剧场录制：幕布落下时每 0.15s 采样一次物件轨迹
    if (this.theaterOn && !this._replaying) {
      this._recT += dt;
      if (this._recT >= 0.15) {
        this._recT = 0;
        this._theaterRec.push(this._sampleTheater());
        if (this._theaterRec.length > 100) this._theaterRec.shift();
      }
    }

    // 梦境存档：每 4 秒静默保存一次(连同统计)
    if (this.playEnabled) {
      this._saveT += dt;
      if (this._saveT > 4) {
        this._saveT = 0;
        this.saveDream();
        try { localStorage.setItem('lsp_stats', JSON.stringify(this.stats)); } catch (e) { /* 忽略 */ }
      }
    }

    this.shadows.update(this.time);
    S.applySun();

    // 呼吸感机位 + 空白拖动环绕 + 孩子视角（开场后）
    if (!this.ui.introActive) {
      const b = _basePos.copy(S.camBase).lerp(_childPos, this.childPose);
      const look = _lookPos.copy(S.camLook).lerp(_childLook, this.childPose);
      S.camLookProxy = look;
      _off.copy(b).sub(look);
      const yaw = this.gameplay ? this.gameplay.orbit.yaw : 0;
      const pitch = this.gameplay ? this.gameplay.orbit.pitch : 0;
      if (yaw !== 0) _off.applyAxisAngle(_UP, yaw);
      if (pitch !== 0) {
        _right.crossVectors(_UP, _off).normalize();
        _off.applyAxisAngle(_right, pitch);
      }
      S.camera.position.copy(S.camLook).add(_off);
      S.camera.position.x += Math.sin(this.time * 0.32) * 0.022;
      S.camera.position.y += Math.sin(this.time * 0.24 + 1) * 0.016;
      // 房间碰撞限制：绝不出墙（右侧墙 x=5.3、左侧墙 x=-4.2）
      S.camera.position.x = clamp(S.camera.position.x, -3.3, ROOM.halfW - 0.75);
      S.camera.position.y = clamp(S.camera.position.y, 1.15, 5.6);
      S.camera.position.z = clamp(S.camera.position.z, 1.6, 8.2);
      S.camera.lookAt(look);
    }

    this.audio.update(dt);
  }
}

const _look = new THREE.Vector3();
const _off = new THREE.Vector3();
const _right = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
const _basePos = new THREE.Vector3();
const _lookPos = new THREE.Vector3();
const _childPos = new THREE.Vector3(1.5, 1.4, 4.7);   // 孩子眼睛的高度
const _childLook = new THREE.Vector3(-0.6, 1.5, 0.9); // 抬头看墙上的影子

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

new Game();
