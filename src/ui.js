// ui.js — 开场动画、标题、家长设置、相机保存、作品相册

import { makeLogoCanvas } from './textures.js?v=22';
import { easeInOutCubic, easeOutCubic } from './items.js?v=22';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.introActive = true;
    this.introT = 0;
    this.titlePhase = 0; // 0 未出现 1 显示中 2 淡出
    this.done = false;

    this.cream = $('#cream');
    this.sweep = $('#sweep');
    this.flash = $('#flash');
    this.duskDim = $('#duskDim');
    this.titleWrap = $('#titleWrap');
    this.camBtn = $('#camBtn');
    this.parentBtn = $('#parentBtn');
    this.mask = $('#settingsMask');

    // 标题
    try {
      $('#titleLogo').src = makeLogoCanvas().toDataURL('image/png');
    } catch (e) { /* 忽略 */ }

    this._bindButtons();
    this._bindDraw();
    this._loadSettings();

    // 开场起始状态（透明度全部由 JS 每帧驱动，不依赖 CSS transition）
    this.cream.style.transition = 'none';
    this.sweep.style.transition = 'none';
    this.titleWrap.style.transition = 'none';
    this.flash.style.transition = 'none';
    this.duskDim.style.transition = 'none';
    this.cream.style.opacity = '1';
    this._creamTarget = 1;
    this._flashVal = 0;
  }

  _bindButtons() {
    const g = this.game;
    // 游戏内重置：一键把所有东西放回原位
    document.getElementById('resetBtn').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.introActive) return;
      g.audio.ensure();
      g.audio.snap();
      g.resetAll();
    });
    // 相机
    this.camBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.introActive) return;
      g.audio.ensure();
      this.takePhoto();
    });
    // 家长入口：按住 1.1s
    let holdTimer = null;
    this.parentBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      holdTimer = setTimeout(() => { holdTimer = null; this.openSettings(); }, 1100);
    });
    const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    this.parentBtn.addEventListener('pointerup', cancelHold);
    this.parentBtn.addEventListener('pointerleave', cancelHold);

    $('#closeSettings').addEventListener('click', () => this.closeSettings());
    $('#restoreDay').addEventListener('click', () => { g.restoreDay(); });
    const ex = document.getElementById('exportReport');
    if (ex) ex.addEventListener('click', (e) => { e.stopPropagation(); this._exportReport(); });
    const childBtn = document.getElementById('childBtn');
    if (childBtn) childBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.introActive) return;
      g.audio.ensure();
      g.toggleChildView();
    });
    $('#previewNight').addEventListener('click', () => {
      const on = g.S.sunState.night > 0.5;
      g.S.sunState.night = on ? 0 : 1;
      g.audio.night = on ? 0 : 1;
      document.getElementById('previewNight').textContent = on ? '预览月夜' : '回到白天';
    });
    $('#resetAll').addEventListener('click', () => { g.resetAll(); this.closeSettings(); });
    $('#clearShots').addEventListener('click', () => {
      localStorage.removeItem('lsp_shots');
      this.renderGallery();
    });
    for (const btn of document.querySelectorAll('#segSound button')) {
      btn.addEventListener('click', () => {
        this.setSeg('#segSound', btn.dataset.v);
        this.saveSetting('sound', btn.dataset.v);
        g.audio.ensure();
        g.audio.setMuted(btn.dataset.v === 'off');
      });
    }
    for (const btn of document.querySelectorAll('#segTime button')) {
      btn.addEventListener('click', () => {
        this.setSeg('#segTime', btn.dataset.v);
        this.saveSetting('minutes', parseInt(btn.dataset.v, 10));
        g.playMinutes = parseInt(btn.dataset.v, 10);
        g.gameplay.playT = 0;
      });
    }
  }

  /* ---------- 魔法画纸：涂鸦画板 ---------- */
  _bindDraw() {
    const g = this.game;
    this.drawOverlay = document.getElementById('drawOverlay');
    this.drawCanvas = document.getElementById('drawCanvas');
    this.drawCtx = this.drawCanvas.getContext('2d');
    this._ink = '#4A443C';
    this._tool = 'brush';
    this._drawing = false;
    this._last = null;
    this._ops = [];      // 操作历史:撤销/重绘的基础
    this._cur = null;
    this._xTimer = null; // ✕ 两段式计时
    for (const b of document.querySelectorAll('#drawTools .tool')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('#drawTools .tool').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        this._tool = b.dataset.t;
      });
    }

    for (const b of document.querySelectorAll('#drawPalette .ink')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('#drawPalette .ink').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        this._ink = b.dataset.c;
      });
    }
    const drawX = document.getElementById('drawX');
    drawX.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      drawX.classList.add('arming');
      this._xTimer = setTimeout(() => {
        this._xTimer = 'long';
        drawX.classList.remove('arming');
        this._clearAll();
      }, 900);
    });
    const xCancel = () => {
      drawX.classList.remove('arming');
      if (this._xTimer && this._xTimer !== 'long') {
        clearTimeout(this._xTimer);
        this._undo();
      }
      this._xTimer = null;
    };
    drawX.addEventListener('pointerup', xCancel);
    drawX.addEventListener('pointerleave', xCancel);
    document.getElementById('drawOk').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._hasStroke()) g.spawnDrawing(this.drawCanvas);
      this.closeDraw();
    });
    const cv = this.drawCanvas;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
    };
    cv.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const p = pos(e);
      if (this._tool !== 'brush') {
        const op = { t: this._tool, c: this._ink, x: p.x, y: p.y };
        this._ops.push(op);
        this._drawOp(op);
        return;
      }
      this._drawing = true;
      const op = { t: 'brush', c: this._ink, pts: [p] };
      this._ops.push(op);
      this._cur = op;
      this._last = p;
      this._drawOp(op);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this._drawing || !this._cur) return;
      e.stopPropagation(); e.preventDefault();
      const p = pos(e);
      this._cur.pts.push(p);
      this._last = p;
      this._drawOp(this._cur);
    });
    const end = (e) => { this._drawing = false; this._cur = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', end);
  }

  _dot(p) {
    const ctx = this.drawCtx;
    ctx.fillStyle = this._ink;
    ctx.beginPath(); ctx.arc(p.x, p.y, 21, 0, 7); ctx.fill();
    this._lastDrawn = true;
  }

  // 形状盖印：孩子选一个形状，点一下就印在画布上
  _stamp(p, tool) {
    const ctx = this.drawCtx;
    const r = 52;
    ctx.fillStyle = this._ink;
    ctx.beginPath();
    if (tool === 'circle') {
      ctx.arc(p.x, p.y, r, 0, 7);
    } else if (tool === 'triangle') {
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x + r * 0.95, p.y + r * 0.75);
      ctx.lineTo(p.x - r * 0.95, p.y + r * 0.75);
      ctx.closePath();
    } else if (tool === 'square') {
      ctx.roundRect(p.x - r * 0.85, p.y - r * 0.85, r * 1.7, r * 1.7, 18);
    } else if (tool === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const rr = i % 2 ? r * 0.45 : r;
        const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (tool === 'heart') {
      const s = r / 14;
      ctx.moveTo(p.x, p.y + s * 13);
      ctx.bezierCurveTo(p.x - s * 14, p.y + s * 3, p.x - s * 11, p.y - s * 10, p.x, p.y - s * 3);
      ctx.bezierCurveTo(p.x + s * 11, p.y - s * 10, p.x + s * 14, p.y + s * 3, p.x, p.y + s * 13);
      ctx.closePath();
    }
    ctx.fill();
    this._lastDrawn = true;
  }

  _stroke(a, b) {
    const ctx = this.drawCtx;
    ctx.strokeStyle = this._ink;
    ctx.lineWidth = 42;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    this._lastDrawn = true;
  }

  _hasStroke() { return !!this._lastDrawn; }

  openDraw() {
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    this._ops = [];
    this._lastDrawn = false;
    this.drawOverlay.classList.add('open');
    this.game.drawOpen = true;
  }

  closeDraw() {
    this.drawOverlay.classList.remove('open');
    this.game.drawOpen = false;
  }

  _loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('lsp_settings') || '{}'); } catch (e) { /* 忽略 */ }
    this.settings = { sound: s.sound || 'on', minutes: s.minutes !== undefined ? s.minutes : 10 };
    this.setSeg('#segSound', this.settings.sound);
    this.setSeg('#segTime', String(this.settings.minutes));
    this.game.audio.muted = this.settings.sound === 'off';
    this.game.playMinutes = this.settings.minutes;
  }

  saveSetting(k, v) {
    this.settings[k] = v;
    try { localStorage.setItem('lsp_settings', JSON.stringify(this.settings)); } catch (e) { /* 忽略 */ }
  }

  setSeg(sel, v) {
    for (const b of document.querySelectorAll(sel + ' button')) {
      b.classList.toggle('on', b.dataset.v === v);
    }
  }

  /* ---------- 开场 ---------- */
  update(dt) {
    // —— 每帧驱动的不透明度（规避被节流环境冻结的 CSS transition）——
    if (this._creamTarget !== undefined) {
      const cur = parseFloat(this.cream.style.opacity || '1');
      const nv = cur + (this._creamTarget - cur) * Math.min(1, dt * 1.8);
      this.cream.style.opacity = String(nv);
    }
    if (this._flashVal > 0) {
      this._flashVal = Math.max(0, this._flashVal - dt * 1.8);
      this.flash.style.opacity = String(this._flashVal);
    }
    if (!this.introActive || this.done) return;
    const g = this.game;
    this.introT += dt;
    const t = this.introT;

    // 相机推移（0.4s 起共 6.8s）
    if (t > 0.4) {
      const k = Math.min(1, (t - 0.4) / 6.8);
      g.setIntroCamera(easeInOutCubic(k));
    }
    // 光从左到右亮起
    g.introBeam = clamp((t - 1.5) / 3.8, 0, 1);

    // 暖米白淡出
    if (t > 1.6 && t < 3.1) {
      this._creamTarget = 1 - easeOutCubic((t - 1.6) / 1.5);
    } else if (t >= 3.1) {
      this._creamTarget = 0;
    }
    // 光带扫过
    if (t > 1.7 && t < 5.2) {
      const k = (t - 1.7) / 3.5;
      this.sweep.style.opacity = String(Math.sin(k * Math.PI) * 0.95);
      this.sweep.style.backgroundPosition = `${-120 + k * 190}% 0`;
    } else if (t >= 5.2) {
      this.sweep.style.opacity = '0';
    }
    // 标题浮现
    if (t > 6.4 && this.titlePhase === 0) {
      this.titlePhase = 1;
      this.titleWrap.classList.add('float');
    }
    if (this.titlePhase === 1) {
      const a = clamp((t - 6.4) / 1.2, 0, 1) * clamp((11.2 - t) / 1.3, 0, 1);
      this.titleWrap.style.opacity = String(a);
    }
    if (t > 12.4) this.finishIntro();
  }

  skipIntro() {
    if (!this.introActive) return;
    this.introT = Math.max(this.introT, 13);
    this.finishIntro();
  }

  finishIntro() {
    if (this.done) return;
    this.done = true;
    this.introActive = false;
    this._creamTarget = 0;
    this.sweep.style.opacity = '0';
    this.titleWrap.style.opacity = '0';
    this.titleWrap.classList.remove('float');
    const g = this.game;
    g.setIntroCamera(1);
    g.introBeam = 1;
    g.onIntroDone();
  }

  /* ---------- 桌面标题由 game 控制 ---------- */
  onFirstDrag() { this.game.fadeDeskTitle(); }

  /* ---------- 拍照 ---------- */
  takePhoto() {
    const g = this.game;
    this._flashVal = 0.8;
    this.flash.style.opacity = '0.8';
    g.audio.shutter();
    g.captureShot();
    this.camBtn.classList.add('bright');
    setTimeout(() => this.camBtn.classList.remove('bright'), 1000);
  }

  /* ---------- 家长设置 ---------- */
  openSettings() {
    this.mask.classList.add('open');
    this.game.settingsOpen = true;
    this.renderGallery();
    // 本次游玩小记录 + 累计观察统计（给家长/教师看的轻文档）
    const el = document.getElementById('sessionRecap');
    if (el) {
      const mins = Math.round(this.game.playT / 60);
      const shots = (() => { try { return JSON.parse(localStorage.getItem('lsp_shots') || '[]').length; } catch (e) { return 0; } })();
      el.textContent = `本次已玩 ${mins} 分钟 · 已保存作品 ${shots} 张`;
    }
    const st = this.game.stats || {};
    const fmt = (sec) => { const m = Math.floor(sec / 60); return m >= 1 ? `${m} 分钟` : `${Math.round(sec)} 秒`; };
    const t1 = document.getElementById('teacherStats');
    const t2 = document.getElementById('teacherStats2');
    if (t1) t1.textContent = `累计光影探索 ${fmt(st.playSec || 0)} · 剪纸 ${st.cuts || 0} 次 · 手绘创作 ${st.drawings || 0} 幅`;
    if (t2) t2.textContent = `玻璃纸混色 ${st.gels || 0} 次 · 光影照片 ${st.photos || 0} 张`;
  }

  _exportReport() {
    const g = this.game;
    const st = g.stats || {};
    const mins = Math.round((st.playSec || 0) / 60);
    let shots = 0, cuts = st.cuts || 0, dr = st.drawings || 0, ge = st.gels || 0;
    try { shots = JSON.parse(localStorage.getItem('lsp_shots') || '[]').length; } catch (e) {}
    const lines = [
      '《光斑小工坊》观察报告',
      '========================',
      `累计光影探索：${mins} 分钟`,
      `光影照片：${shots} 张`,
      `剪纸探索：${cuts} 次`,
      `手绘创作：${dr} 幅`,
      `玻璃纸混色：${ge} 次`,
      '',
      '瑞吉欧提示：光影是孩子认识世界的百种语言之一。',
      '建议与孩子聊聊：影子为什么会变大变小？光还能变出什么颜色？',
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '光斑小工坊-观察报告.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  closeSettings() {
    this.mask.classList.remove('open');
    this.game.settingsOpen = false;
  }

  renderGallery() {
    const el = $('#gallery');
    el.innerHTML = '';
    let shots = [];
    try { shots = JSON.parse(localStorage.getItem('lsp_shots') || '[]'); } catch (e) { /* 忽略 */ }
    shots.forEach((data, i) => {
      const img = document.createElement('img');
      img.src = data;
      img.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = data;
        a.download = `光斑小工坊-作品${shots.length - i}.jpg`;
        a.click();
      });
      el.appendChild(img);
    });
  }

  setDuskDim(v) { this.duskDim.style.opacity = String(v); }
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
