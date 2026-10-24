// gameplay.js — 指针交互：多点触控拖拽、太阳拖动、玻璃贴纸、剪刀剪纸、彩蛋、视角环绕
import * as THREE from '../lib/three.module.js';
import { ROOM } from './scene.js?v=22';
import { tween, easeInOutCubic } from './items.js?v=22';

export class Gameplay {
  constructor(game) {
    this.game = game;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.drags = new Map();        // pointerId -> 拖拽记录（支持双孩多点触控）
    this.hoverPaper = null;
    this.wallTaps = [];
    this.birdCooldown = 0;
    this.idleFired = 0;
    this.playT = 0;
    this.duskStarted = false;
    this.orbit = {
      yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0,
      active: false, pid: null, startX: 0, startY: 0,
      baseYaw: 0, basePitch: 0, moved: false, downWall: null, lastOrbitT: 0,
    };

    this.tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(ROOM.tableY + 0.1));
    this.cloudPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -ROOM.cloudX);
    this.wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ROOM.wallZ);
    this.skyPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -(ROOM.wallX - 2.5));   // 太阳平面
    this.glassPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -(ROOM.wallX + 0.05)); // 玻璃贴纸平面

    const el = window;
    el.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    el.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    el.addEventListener('pointerup', (e) => this.onUp(e), { passive: false });
    el.addEventListener('pointercancel', (e) => this.onUp(e), { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _setNDC(e) {
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.game.S.camera);
  }

  _hitPlane(plane, out) {
    return this.ray.ray.intersectPlane(plane, out);
  }

  onDown(e) {
    const g = this.game;
    if (g.drawOpen || g.settingsOpen || g._replaying) return; // 绘画/设置/回放期间不响应
    e.preventDefault();
    g.audio.ensure();
    g.lastInputT = 0;
    if (g.ui.introActive) { g.ui.skipIntro(); return; }

    this._setNDC(e);
    const pid = e.pointerId;

    // 1) 拉绳 → 影子剧场
    if (g.S.theater.ropeHit && this.ray.intersectObject(g.S.theater.ropeHit, false).length) {
      g.toggleTheater();
      return;
    }
    // 1.5) 萤火虫可点击 → 炸开成光尘
    if (g.firefly && g.firefly.active && g.firefly.burstT < 0) {
      if (this.ray.intersectObject(g.firefly.hit, false).length) {
        g.burstFirefly();
        return;
      }
    }
    // 1.6) 小画架：点一下开始创作
    if (g.S.easel && g.S.easelGlint && this.ray.intersectObject(g.S.easel.children.find(c => c.userData.isEasel) || g.S.easel, true).length) {
      g.ui.openDraw();
      return;
    }
    // 1.8) 编织篮：点一下倒出新纸片
    if (g.S.basketHit && this.ray.intersectObject(g.S.basketHit, false).length) {
      g.basketTap();
      return;
    }
    // 2) 太阳（透过窗户可拖动）
    if (this.ray.intersectObject(g.S.sunHit, false).length) {
      this.drags.set(pid, { type: 'sun' });
      return;
    }
    // 3) 道具
    const targets = g.items.raycastTargets();
    const hits = this.ray.intersectObjects(targets, false);
    if (hits.length) {
      let obj = hits[0].object, bestD = Infinity;
      for (const h of hits.slice(0, 5)) {
        const it = g.items.itemFromHit(h.object);
        if (!it) continue;
        // 贴在玻璃上的胶片中心在玻璃平面；其余在桌面上方
        const center = (it.state === 'gel')
          ? _v2.set(ROOM.wallX + 0.08, it.gelY, it.gelZ)
          : _v2.set(it.pos.x, ROOM.tableY + (it.kind === 'cloud' ? 0 : 0.2), it.pos.z);
        // 命中点到物品中心的距离：按得越准的物品优先，托盘密集也不误抓
        const d = h.point.distanceToSquared(center);
        if (d < bestD) { bestD = d; obj = h.object; }
      }
      const item = g.items.itemFromHit(obj);
      if (!item) return;
      if (item.kind === 'cloud') {
        const p = new THREE.Vector3();
        if (this._hitPlane(this.cloudPlane, p)) {
          this.drags.set(pid, { type: 'cloud', cloud: item, offY: item.pos.y - p.y, offZ: item.pos.z - p.z });
          item.state = 'drag';
          g.audio.windLevel = 0.6;
        }
      } else if (item.state === 'gel') {
        // 贴在玻璃上的胶片：点一下取下来
        g.unstickFilm(item);
      } else if (item.state !== 'cutting-hide') {
        const wasTray = item.inTray;
        if (g.items.grab(item)) {
          const p = new THREE.Vector3();
          if (this._hitPlane(this.tablePlane, p)) {
            this.drags.set(pid, { type: 'item', item, offX: item.pos.x - p.x, offZ: item.pos.z - p.z, startX: item.pos.x, startZ: item.pos.z });
          } else {
            this.drags.set(pid, { type: 'item', item, offX: 0, offZ: 0, startX: item.pos.x, startZ: item.pos.z });
          }
          if (wasTray) item.dragTarget = item.pos.clone();
          g.ui.onFirstDrag();
          g.audio.windLevel = 0;
        }
      }
      return;
    }

    // 4) 空白处：开始环绕视角；快速点按墙面累计三连点彩蛋
    const p = new THREE.Vector3();
    let wallPt = null;
    if (this._hitPlane(this.wallPlane, p)) {
      if (Math.abs(p.x) < ROOM.halfW && p.y > 0.2 && p.y < ROOM.wallH - 0.4) wallPt = p.clone();
    }
    const o = this.orbit;
    if (!o.active) {
      o.active = true; o.moved = false; o.pid = pid;
      o.startX = e.clientX; o.startY = e.clientY;
      o.baseYaw = o.targetYaw; o.basePitch = o.targetPitch;
      o.downWall = wallPt;
    }
  }

  onMove(e) {
    const g = this.game;
    const o = this.orbit;

    // 环绕视角（仅发起环绕的那根指针）
    if (o.active && e.pointerId === o.pid && !this.drags.has(e.pointerId)) {
      const dx = e.clientX - o.startX, dy = e.clientY - o.startY;
      if (Math.abs(dx) + Math.abs(dy) > 7) o.moved = true;
      o.lastOrbitT = 0;
      const rawYaw = o.baseYaw + dx * 0.0022;
      o.targetYaw = 0.55 * Math.tanh(rawYaw / 0.55 * 1.25) / Math.tanh(1.25);
      o.targetPitch = clamp(o.basePitch + dy * 0.0016, -0.16, 0.24);
      return;
    }

    const rec = this.drags.get(e.pointerId);
    if (!rec) return;
    e.preventDefault();
    g.lastInputT = 0;
    this._setNDC(e);
    const p = new THREE.Vector3();

    if (rec.type === 'sun') {
      // 拖太阳：改的是高度
      if (this._hitPlane(this.skyPlane, p)) {
        g.S.sunState.elevation = clamp((p.y - 1.15) / 3.1, 0, 1);
      }
      return;
    }
    if (rec.type === 'cloud') {
      if (this._hitPlane(this.cloudPlane, p)) {
        rec.cloud.dragTarget = new THREE.Vector3(ROOM.cloudX, p.y + rec.offY, p.z + rec.offZ);
        g.audio.windLevel = Math.min(0.9, g.audio.windLevel + 0.02);
      }
      return;
    }
    const item = rec.item;
    if (!item || item.state !== 'drag') return;
    if (this._hitPlane(this.tablePlane, p)) {
      item.dragTarget = new THREE.Vector3(p.x + rec.offX, ROOM.tableY, p.z + rec.offZ);
      // 胶片拖近窗户 → 显示玻璃贴纸预览
      if (item.kind === 'film') {
        const gp = new THREE.Vector3();
        if (this._hitPlane(this.glassPlane, gp) &&
            gp.y > ROOM.win.y0 + 0.32 && gp.y < ROOM.win.y1 - 0.32 &&
            gp.z > ROOM.win.z0 + 0.32 && gp.z < ROOM.win.z1 - 0.32) {
          rec.stick = { y: gp.y, z: gp.z };
          g.showGlassGhost(gp.y, gp.z, item.colorKey);
        } else {
          rec.stick = null;
          g.hideGlassGhost();
        }
      }
      // 剪刀悬停：纸片微微发光
      if (item.kind === 'scissors') {
        this._setHover(g.items.paperNear(p, 0.46));
      }
    }
  }

  _setHover(paper) {
    if (this.hoverPaper === paper) return;
    this.hoverPaper = paper;
  }

  onUp(e) {
    const g = this.game;
    const o = this.orbit;
    // 结束环绕 + 快速点按彩蛋
    if (o.active && e.pointerId === o.pid) {
      o.active = false;
      if (!o.moved && o.downWall) {
        const now = performance.now() / 1000;
        this.wallTaps = this.wallTaps.filter(t => now - t < 2.2);
        this.wallTaps.push(now);
        if (this.wallTaps.length >= 3) {
          this.wallTaps = [];
          g.spawnLightBug();
          g.audio.sparkle();
        }
      }
      o.downWall = null;
      return;
    }
    const rec = this.drags.get(e.pointerId);
    if (!rec) return;
    this.drags.delete(e.pointerId);
    g.lastInputT = 0;
    g.audio.windLevel = 0;

    if (rec.type === 'sun') return; // 太阳停在拖到的位置

    if (rec.type === 'cloud') {
      rec.cloud.state = 'cloud';
      rec.cloud.dragTarget = null;
      return;
    }
    const item = rec.item;
    if (!item) return;

    // 手电筒：轻点开/关，拖动移位
    if (item.kind === 'flashlight') {
      const moved = item.dragTarget && (Math.abs(item.dragTarget.x - rec.startX || 0) > 0.08 || Math.abs(item.dragTarget.z - rec.startZ || 0) > 0.08);
      if (!moved) {
        item.on = item.on === false ? true : false;
        item.state = 'table';
        g.audio.snap();
        return;
      }
    }

    // 胶片贴上玻璃
    if (item.kind === 'film' && rec.stick) {
      g.hideGlassGhost();
      g.stickFilm(item, rec.stick);
      return;
    }
    g.hideGlassGhost();

    // 松手时物品落到手指目标点（而非滞后中的平滑位置）
    if (item.dragTarget) {
      item.pos.x = item.dragTarget.x;
      item.pos.z = item.dragTarget.z;
    }

    // 剪刀剪纸
    if (item.kind === 'scissors') {
      const paper = this.hoverPaper;
      if (paper && paper.cuttable) {
        this.doCut(item, paper);
        return;
      }
      g.items.release(item, item.pos);
      if (item._autoReturnTimer) clearTimeout(item._autoReturnTimer);
      item._autoReturnTimer = setTimeout(() => {
        item._autoReturnTimer = null;
        if (item.state === 'table') g.items.sendToTray(item);
      }, 15000);
      return;
    }

    // 轻微吸附：靠近其他素材时轻缓靠拢
    if (item.kind === 'paper' || item.kind === 'film') {
      let nearest = null, nd = 0.34;
      for (const it of g.items.items) {
        if (it === item || !it.active || it.inTray || it.state === 'gel') continue;
        if (it.kind !== 'paper' && it.kind !== 'film') continue;
        const dist = Math.hypot(it.pos.x - item.pos.x, it.pos.z - item.pos.z);
        if (dist < nd) { nd = dist; nearest = it; }
      }
      if (nearest) {
        const fx = item.pos.x, fz = item.pos.z;
        const tx = fx + (nearest.pos.x - fx) * 0.3;
        const tz = fz + (nearest.pos.z - fz) * 0.3;
        tween({
          dur: 0.22, ease: easeInOutCubic,
          onUpdate: (k) => { item.pos.x = fx + (tx - fx) * k; item.pos.z = fz + (tz - fz) * k; },
        });
        g.audio.snap();
      }
    }

    g.items.release(item, item.pos);

    // 小鸟彩蛋：小鸟剪影拖到窗户边缘 → 影子扇翅
    if (item.shapeKey === 'bird' && !item.half && this.birdCooldown <= 0) {
      if (item.pos.x < ROOM.table.x0 + 0.6 &&
          item.pos.z > ROOM.win.z0 - 0.35 && item.pos.z < ROOM.win.z1 + 0.35) {
        item.flap = { t: 0 };
        this.birdCooldown = 4;
        g.audio.sparkle();
      }
    }
  }

  doCut(scissors, paper) {
    const g = this.game;
    scissors.state = 'anim';
    // 剪刀轻咬合（两半绕枢轴开合）
    const sc = scissors.sc;
    const halfA = sc.children[0], halfB = sc.children[1];
    tween({
      dur: 0.7, ease: easeInOutCubic,
      onUpdate: (k) => {
        const open = Math.sin(k * Math.PI * 2) * 0.28;
        if (halfA) halfA.rotation.z = 0.3 + open;
        if (halfB) halfB.rotation.z = -0.3 - open;
      },
      onDone: () => { if (halfA) halfA.rotation.z = 0.3; if (halfB) halfB.rotation.z = -0.3; },
    });
    if (g.stats) g.stats.cuts++;
    g.items.cutPaper(paper);
    if (scissors._autoReturnTimer) clearTimeout(scissors._autoReturnTimer);
    scissors._autoReturnTimer = setTimeout(() => {
      scissors._autoReturnTimer = null;
      if (scissors.state === 'anim') g.items.sendToTray(scissors);
    }, 2400);
  }

  /* ---------- 每帧 ---------- */
  update(dt) {
    const g = this.game;
    if (this.birdCooldown > 0) this.birdCooldown -= dt;
    // 视角缓动 + 静置 6 秒自动缓缓回正
    const o = this.orbit;
    if (!o.active && (Math.abs(o.targetYaw) > 0.005 || Math.abs(o.targetPitch) > 0.005)) {
      o.lastOrbitT += dt;
      if (o.lastOrbitT > 6 || g.lastInputT > 6) {
        const back = Math.min(1, dt * 0.9);
        o.targetYaw -= o.targetYaw * back;
        o.targetPitch -= o.targetPitch * back;
      }
    } else {
      o.lastOrbitT = 0;
    }
    const k = Math.min(1, dt * 6);
    o.yaw += (o.targetYaw - o.yaw) * k;
    o.pitch += (o.targetPitch - o.pitch) * k;

    // 发光衰减（非拖拽态）
    for (const it of g.items.items) {
      if (it.kind === 'paper' && it.glow > 0 && it.state !== 'drag') {
        const target = (it === this.hoverPaper) ? 0.4 + Math.sin(performance.now() / 240) * 0.12 : 0;
        it.glow += (target - it.glow) * Math.min(1, dt * 6);
        if (it.glow < 0.005 && target === 0) it.glow = 0;
      }
    }

    // 闲置唤醒：10 秒无操作，云朵自己慢慢飘
    g.lastInputT += dt;
    if (g.playEnabled && !g.settingsOpen && g.lastInputT > 10 && performance.now() / 1000 - this.idleFired > 18) {
      this.idleFired = performance.now() / 1000;
      const c = g.items.cloudItems[Math.floor(Math.random() * g.items.cloudItems.length)];
      const fz = c.pos.z, fy = c.pos.y;
      const tz = clamp(fz + (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.25), ROOM.win.z0 - 0.1, ROOM.win.z1 + 0.1);
      const ty = clamp(fy + (Math.random() - 0.5) * 0.3, ROOM.win.y0, ROOM.win.y1);
      tween({
        dur: 2.6, ease: easeInOutCubic,
        onUpdate: (k) => { c.pos.z = fz + (tz - fz) * k; c.pos.y = fy + (ty - fy) * k; },
      });
    }

    // 时长保护
    if (g.playEnabled && !g.settingsOpen && !g.duskStarted && g.playMinutes > 0) {
      this.playT += dt;
      if (this.playT >= g.playMinutes * 60) g.triggerDusk();
    }
  }
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

const _v2 = new THREE.Vector3();
