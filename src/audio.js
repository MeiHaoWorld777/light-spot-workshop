// audio.js — 全程序化 WebAudio 合成，无外部音频文件
// 氛围：极轻微风白噪音 + 远处鸟鸣；反馈：纸声、木声、快门；开场：钢琴单音

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientOn = false;
    this.windLevel = 0;      // 0..1 目标风声
    this.windCur = 0;
    this.nextBird = 6;
    this.time = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
      return true;
    } catch (e) { return false; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.15);
    }
  }

  /* ---------- 环境层 ---------- */
  startAmbient() {
    if (this.ambientOn || !this.ctx) return;
    this.ambientOn = true;
    const ctx = this.ctx;
    // 微风：低通白噪音 + 慢速起伏
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.035 * w) / 1.035;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.013;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
    // 极慢 LFO 让风轻微呼吸
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.004;
    lfo.connect(lfoG).connect(this.windGain.gain);
    lfo.start();
    this.nextBird = 5 + Math.random() * 8;
  }

  chirp() {
    const ctx = this.ctx;
    if (!ctx) return;
    const base = 2200 + Math.random() * 900;
    const n = 2 + Math.floor(Math.random() * 3);
    const t0 = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain();
    out.gain.value = 0.028;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; out.connect(pan).connect(this.master); }
    else out.connect(this.master);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = base * (0.92 + Math.random() * 0.16);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.045);
      o.frequency.exponentialRampToValueAtTime(f * 0.95, t + 0.085);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.14);
    }
  }

  cricket() {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.16;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 4100 + Math.random() * 350;
      const g = ctx.createGain();
      this.env(g, t, 0.009, 0.012, 0.1);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.15);
    }
  }

  update(dt) {
    if (!this.ctx || !this.ambientOn) return;
    this.time += dt;
    // 风声平滑趋近目标
    this.windCur += (this.windLevel - this.windCur) * Math.min(1, dt * 2.2);
    this.windGain.gain.setTargetAtTime(0.013 + this.windCur * 0.05, this.ctx.currentTime, 0.2);
    this.windFilter.frequency.setTargetAtTime(420 + this.windCur * 950, this.ctx.currentTime, 0.3);
    // 远处鸟鸣（白天）/ 虫鸣（月夜）
    if ((this.night || 0) < 0.4) {
      this.nextBird -= dt;
      if (this.nextBird <= 0) {
        this.chirp();
        this.nextBird = 9 + Math.random() * 14;
      }
    } else {
      this._nextCricket = (this._nextCricket === undefined) ? 0.5 : this._nextCricket - dt;
      if (this._nextCricket <= 0) {
        this.cricket();
        this._nextCricket = 0.5 + Math.random() * 0.9;
      }
    }
  }

  /* ---------- 工具 ---------- */
  env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  noiseHit({ freq = 1500, q = 1.2, peak = 0.06, dur = 0.05, delay = 0 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.5 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t0, peak, 0.006, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 2); src.stop(t0 + dur + 0.1);
  }

  tone({ freq = 440, type = 'sine', peak = 0.05, dur = 0.3, delay = 0, slide = 0, filter = 0 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, peak, 0.008, dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter;
      o.connect(f); node = f;
    }
    node.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.15);
  }

  /* ---------- 反馈音 ---------- */
  pianoNote(freq, vel = 0.11) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime;
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const g = ctx.createGain();
    this.env(g, t0, vel, 0.012, 1.6);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    o1.connect(f); o2.connect(g2).connect(f);
    f.connect(g).connect(this.master);
    o1.start(t0); o2.start(t0);
    o1.stop(t0 + 2); o2.stop(t0 + 2);
  }

  pickPaper() { this.noiseHit({ freq: 1300, peak: 0.045, dur: 0.06 }); this.tone({ freq: 520, peak: 0.018, dur: 0.09 }); }
  pickWood()  { this.tone({ freq: 220, type: 'sine', peak: 0.04, dur: 0.1 }); }
  dropPaper(note) {
    this.noiseHit({ freq: 1650, peak: 0.05, dur: 0.045 });
    this.tone({ freq: 185, peak: 0.028, dur: 0.12, slide: -60 });
    if (note) this.tone({ freq: note, type: 'sine', peak: 0.022, dur: 0.5 });
  }
  dropWood()  { this.tone({ freq: 145, peak: 0.06, dur: 0.16, slide: -50 }); this.noiseHit({ freq: 900, peak: 0.03, dur: 0.04 }); }
  snap()      { this.noiseHit({ freq: 2300, peak: 0.035, dur: 0.035 }); }
  snip() {
    this.noiseHit({ freq: 2800, peak: 0.05, dur: 0.05 });
    this.noiseHit({ freq: 2100, peak: 0.035, dur: 0.06, delay: 0.14 });
    this.noiseHit({ freq: 1500, q: 0.8, peak: 0.028, dur: 0.5, delay: 0.3 });
  }
  shutter() {
    this.noiseHit({ freq: 3200, peak: 0.07, dur: 0.03 });
    this.noiseHit({ freq: 2600, peak: 0.05, dur: 0.03, delay: 0.09 });
    this.tone({ freq: 1250, peak: 0.02, dur: 0.05, delay: 0.09 });
  }
  plip() {
    this.tone({ freq: 950, type: 'sine', peak: 0.045, dur: 0.16, slide: -420 });
    this.tone({ freq: 1400, type: 'sine', peak: 0.02, dur: 0.1, delay: 0.09, slide: -500 });
  }

  sparkle() {
    [1900, 2500, 3200].forEach((f, i) => this.tone({ freq: f, peak: 0.014, dur: 0.14, delay: i * 0.07 }));
  }
  chimeWarm() {
    this.pianoNote(392, 0.06);
    setTimeout(() => this.ctx && this.pianoNote(494, 0.05), 260);
    setTimeout(() => this.ctx && this.pianoNote(587, 0.05), 520);
  }

  sunsetChime() {
    this.pianoNote(523.25, 0.07);
    this.pianoNote(659.25, 0.05);
    setTimeout(() => this.ctx && this.pianoNote(784, 0.04), 350);
  }
}
