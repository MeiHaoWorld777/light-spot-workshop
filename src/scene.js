// scene.js — Three.js 场景：暖白手工教室、木桌、左侧窗户、天空、云朵、丁达尔光束
import * as THREE from '../lib/three.module.js';
import { patchTexture, cloudGlowTexture, blobTexture, plantLeafCanvas, curtainCanvas, rugCanvas, floorPlankCanvas, doodleCanvas, basketCanvas } from './textures.js?v=22';

export const ROOM = {
  wallZ: 0.06,          // 后墙内表面
  wallX: -4.2,          // 左墙内表面
  wallH: 4.6,
  halfW: 5.3,
  tableY: 1.02,
  table: { x0: -2.9, x1: 2.9, z0: 0.55, z1: 3.45 },
  tray: { z0: 2.98, z1: 3.4, x0: -2.62, x1: 2.62 },
  win: { y0: 1.12, y1: 3.86, z0: 0.85, z1: 2.95 },  // 左墙上窗户范围
  cloudX: -3.42,        // 云朵悬浮平面
  lightDir: new THREE.Vector3(0.8, -0.5, -0.38).normalize(),
};

const C = {
  wallBack: '#F8F2E6', wallLeft: '#F4EBDB', wallRight: '#F1E8D6', floor: '#EBDFC6',
  tableTop: '#E4C99F', tableSide: '#D2B285', trayIn: '#C0A179',
  frame: '#EBDABC', glass: 0xd9edf5,
  beam: '#FFE8C2', patch: '#FFF1D2',
};

export function buildScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color('#F3ECDD'));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 60);

  /* ---------- 光照 ---------- */
  const hemi = new THREE.HemisphereLight('#FFF7E6', '#E0D4BC', 1.32);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFDFAE', 1.68);
  sun.position.set(-5.5, 4.6, 3.4);
  sun.target.position.set(1.2, 0.4, 0.8);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#FFF1DC', 0.52);
  fill.position.set(2.2, 3.6, 7.5);
  scene.add(fill);

  const mats = {};

  /* ---------- 房间 ---------- */
  const box = (w, h, d, color, x, y, z, flat = false) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, flatShading: flat })
    );
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  // 后墙 / 左墙 / 右墙 / 地板
  const wallBack = box(ROOM.halfW * 2, ROOM.wallH, 0.14, C.wallBack, 0, ROOM.wallH / 2, ROOM.wallZ - 0.07);
  const wallLeft = box(0.14, ROOM.wallH, 8, C.wallLeft, ROOM.wallX - 0.07, ROOM.wallH / 2, 2.6);
  box(0.14, ROOM.wallH, 8, C.wallRight, ROOM.halfW + 0.1, ROOM.wallH / 2, 2.6);
  const floor = box(ROOM.halfW * 2 + 0.6, 0.06, 8, C.floor, 0, -0.03, 2.6);
  const floorTex = new THREE.CanvasTexture(floorPlankCanvas());
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);
  floor.material.map = floorTex;
  floor.material.color.set('#F4E9D2');
  mats.wallBack = wallBack.material; mats.wallLeft = wallLeft.material; mats.floor = floor.material;

  // 踢脚线
  box(ROOM.halfW * 2, 0.16, 0.05, '#EBDFC8', 0, 0.08, ROOM.wallZ + 0.03);

  // 右墙小搁架：斜放几张彩色手工纸，环绕视角时可见
  const shelfY = 2.35, shelfX = ROOM.halfW - 0.28;
  box(0.5, 0.055, 1.5, '#E4D2AC', shelfX, shelfY, 2.0);
  box(0.4, 0.04, 0.05, '#D8C29A', shelfX, shelfY - 0.02, 1.28);
  box(0.4, 0.04, 0.05, '#D8C29A', shelfX, shelfY - 0.02, 2.72);
  const sheetMat = (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
  const sheet1 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), sheetMat('#F4C9C9'));
  sheet1.position.set(shelfX - 0.06, shelfY + 0.24, 1.7);
  sheet1.rotation.set(0, -Math.PI / 2, 0.16);
  const sheet2 = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), sheetMat('#B9CFA6'));
  sheet2.position.set(shelfX - 0.05, shelfY + 0.23, 2.15);
  sheet2.rotation.set(0, -Math.PI / 2, -0.12);
  const sheet3 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), sheetMat('#A9CDEB'));
  sheet3.position.set(shelfX - 0.06, shelfY + 0.22, 2.55);
  sheet3.rotation.set(0, -Math.PI / 2, 0.2);
  scene.add(sheet1, sheet2, sheet3);
  // 一排小书
  const bookCols = ['#D6A292', '#A8BD8E', '#8FA8C6', '#E0C48C'];
  let bz = 1.42;
  for (let i = 0; i < 4; i++) {
    const bh = 0.3 + (i % 2) * 0.06;
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.2, bh, 0.05),
      new THREE.MeshLambertMaterial({ color: bookCols[i] }));
    bk.position.set(shelfX - 0.1, shelfY + bh / 2 + 0.02, bz);
    scene.add(bk);
    bz += 0.09;
  }

  /* ---------- 窗户（左墙开洞 + 框 + 玻璃） ---------- */
  const w = ROOM.win;
  const wx = ROOM.wallX;
  const seg = (y0, y1, z0, z1) => box(0.1, y1 - y0, z1 - z0, C.frame, wx + 0.02, (y0 + y1) / 2, (z0 + z1) / 2);
  seg(w.y0, w.y1, w.z0 - 0.3, w.z0); seg(w.y0, w.y1, w.z1, w.z1 + 0.3);
  seg(w.y1, w.y1 + 0.3, w.z0 - 0.3, w.z1 + 0.3); seg(w.y0 - 0.3, w.y0, w.z0 - 0.3, w.z1 + 0.3);
  // 中梃
  box(0.08, w.y1 - w.y0, 0.05, C.frame, wx + 0.04, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2);
  box(0.08, 0.05, w.z1 - w.z0, C.frame, wx + 0.04, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2);
  // 玻璃
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w.z1 - w.z0, w.y1 - w.y0),
    new THREE.MeshLambertMaterial({ color: C.glass, transparent: true, opacity: 0.22, depthWrite: false })
  );
  glass.rotation.y = Math.PI / 2;
  glass.position.set(wx + 0.05, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2);
  scene.add(glass);

  /* ---------- 窗外：天空渐变 + 太阳 ---------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#BFE0F2') },
      bottom: { value: new THREE.Color('#EDF6FB') },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0,1.0,vUv.y)), 1.0); }
    `,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), skyMat);
  sky.rotation.y = Math.PI / 2;
  sky.position.set(wx - 2.6, 2.6, 1.9);
  scene.add(sky);

  const sunDisk = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 40),
    new THREE.MeshBasicMaterial({ color: '#FFE7B0', transparent: true, opacity: 0.95 })
  );
  sunDisk.rotation.y = Math.PI / 2;
  sunDisk.position.set(wx - 2.5, 2.9, 1.9);
  scene.add(sunDisk);
  // 太阳光晕（可拖拽的视觉提示）
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(patchTexture()), color: '#FFE2A0',
    transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sunHalo.scale.set(2.6, 2.6, 1);
  sunDisk.add(sunHalo);
  // 太阳抓取热区
  const sunHit = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide })
  );
  sunHit.rotation.y = Math.PI / 2;
  sunHit.userData.isSun = true;
  sunDisk.add(sunHit);
  sunDisk.userData.halo = sunHalo;
  // 月亮与星空（夜幕升起）
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 36),
    new THREE.MeshBasicMaterial({ color: '#E9EFF8', transparent: true, opacity: 0, depthWrite: false })
  );
  moon.rotation.y = Math.PI / 2;
  moon.position.set(wx - 2.5, 0.9, 1.5);
  scene.add(moon);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(patchTexture()), color: '#C9D6EC',
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  moonHalo.scale.set(2.2, 2.2, 1);
  moon.add(moonHalo);
  // 星空（随机小星点，随夜幕浮现）
  const starCanvas = document.createElement('canvas');
  starCanvas.width = 512; starCanvas.height = 384;
  const sctx = starCanvas.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const a = Math.random();
    sctx.fillStyle = `rgba(235, 240, 252, ${0.3 + a * 0.7})`;
    const r = 0.8 + a * 1.6;
    sctx.beginPath();
    sctx.arc(Math.random() * 512, Math.random() * 300, r, 0, 7);
    sctx.fill();
  }
  const stars = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(starCanvas), transparent: true, opacity: 0, depthWrite: false,
    })
  );
  stars.rotation.y = Math.PI / 2;
  stars.position.set(wx - 2.62, 2.6, 1.9);
  scene.add(stars);

  /* ---------- 桌子 ---------- */
  const t = ROOM.table;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(t.x1 - t.x0, 0.1, t.z1 - t.z0),
    new THREE.MeshLambertMaterial({ color: C.tableTop })
  );
  top.position.set((t.x0 + t.x1) / 2, ROOM.tableY - 0.05, (t.z0 + t.z1) / 2);
  scene.add(top);
  // 桌沿圆角条
  const edgeMat = new THREE.MeshLambertMaterial({ color: C.tableSide });
  for (const [ex, ez, ew, ed] of [
    [(t.x0 + t.x1) / 2, t.z1, t.x1 - t.x0, 0.05],
    [(t.x0 + t.x1) / 2, t.z0, t.x1 - t.x0, 0.05],
    [t.x0, (t.z0 + t.z1) / 2, 0.05, t.z1 - t.z0],
    [t.x1, (t.z0 + t.z1) / 2, 0.05, t.z1 - t.z0],
  ]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(ew, 0.115, ed), edgeMat);
    e.position.set(ex, ROOM.tableY - 0.052, ez);
    scene.add(e);
  }
  // 桌腿
  const legGeo = new THREE.CylinderGeometry(0.085, 0.075, ROOM.tableY - 0.1, 18);
  const legMat = new THREE.MeshLambertMaterial({ color: '#C2A172' });
  for (const [lx, lz] of [[t.x0 + 0.22, t.z0 + 0.24], [t.x1 - 0.22, t.z0 + 0.24], [t.x0 + 0.22, t.z1 - 0.24], [t.x1 - 0.22, t.z1 - 0.24]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, (ROOM.tableY - 0.1) / 2, lz);
    scene.add(leg);
  }

  /* ---------- 材料凹槽 ---------- */
  const tray = ROOM.tray;
  const trayIn = new THREE.Mesh(
    new THREE.BoxGeometry(tray.x1 - tray.x0, 0.02, tray.z1 - tray.z0),
    new THREE.MeshLambertMaterial({ color: C.trayIn })
  );
  trayIn.position.set((tray.x0 + tray.x1) / 2, ROOM.tableY + 0.001, (tray.z0 + tray.z1) / 2);
  scene.add(trayIn);
  // 内凹阴影渐变（贴图）
  const trayShade = new THREE.Mesh(
    new THREE.PlaneGeometry(tray.x1 - tray.x0, tray.z1 - tray.z0),
    new THREE.MeshBasicMaterial({ map: trayShadeTexture(), transparent: true, depthWrite: false })
  );
  trayShade.rotation.x = -Math.PI / 2;
  trayShade.position.set((tray.x0 + tray.x1) / 2, ROOM.tableY + 0.004, (tray.z0 + tray.z1) / 2);
  trayShade.renderOrder = 2;
  scene.add(trayShade);

  /* ---------- 光束棱柱（丁达尔） ---------- */
  const beamGroup = new THREE.Group();
  scene.add(beamGroup);
  const winPts = [
    new THREE.Vector3(wx, w.y0, w.z1), new THREE.Vector3(wx, w.y0, w.z0),
    new THREE.Vector3(wx, w.y1, w.z0), new THREE.Vector3(wx, w.y1, w.z1),
  ];
  const farOf = (p) => new THREE.Vector3(
    0.15 * (p.z - 0.85) - 0.28,
    1.74 - (3.86 - p.y) * 0.335,
    0.52 + (p.z - 0.85) * 0.86
  );
  const prismMat = (op) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(C.beam) }, uOp: { value: op } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOp; varying vec2 vUv;
      void main(){
        float edge = smoothstep(0.0,0.22,vUv.x)*smoothstep(1.0,0.78,vUv.x);
        float len = smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.55,vUv.y);
        gl_FragColor = vec4(uColor, uOp*edge*len);
      }
    `,
  });
  function makePrism(shrink) {
    const near = winPts.map(p => p.clone().lerp(new THREE.Vector3(wx, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2), shrink));
    const farC = winPts.map(p => farOf(p));
    const fc = farC.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / farC.length);
    const far = farC.map(p => p.lerp(fc, shrink * 0.55));
    const geo = new THREE.BufferGeometry();
    const A = near, B = far;
    const verts = [];
    const uv = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const quadPts = [A[i], A[j], B[j], B[i]];
      const tri = [0, 1, 2, 0, 2, 3];
      const uvs = [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
      for (let k = 0; k < 6; k++) {
        const pt = quadPts[tri[k]];
        verts.push(pt.x, pt.y, pt.z);
        uv.push(uvs[k][0], uvs[k][1]);
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return new THREE.Mesh(geo, prismMat(0.05));
  }
  const prism1 = makePrism(0.0);
  const prism2 = makePrism(0.24);
  prism2.material.uniforms.uOp.value = 0.034;
  beamGroup.add(prism1, prism2);

  /* ---------- 右侧小木架（新零件摆放处，地面高度） ---------- */
  const sideBench = new THREE.Group();
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.46),
    new THREE.MeshLambertMaterial({ color: '#D2B285' }));
  benchTop.position.y = 0.42;
  sideBench.add(benchTop);
  const benchLegMat = new THREE.MeshLambertMaterial({ color: '#C2A172' });
  for (const [lx, lz] of [[-0.5, -0.16], [0.5, -0.16], [-0.5, 0.16], [0.5, 0.16]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), benchLegMat);
    leg.position.set(lx, 0.21, lz);
    sideBench.add(leg);
  }
  sideBench.position.set(3.85, 0, 2.35);
  scene.add(sideBench);

  /* ---------- 右墙：小木门与圆窗（环绕视角的风景） ---------- */
  const doorFrameMat = new THREE.MeshLambertMaterial({ color: '#C9A87B' });
  const door = new THREE.Group();
  const dPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.86),
    new THREE.MeshLambertMaterial({ color: '#E4D3B4' }));
  dPanel.position.set(ROOM.halfW - 0.02, 0.98, 3.9);
  const dFrameTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 1.0), doorFrameMat);
  dFrameTop.position.set(ROOM.halfW - 0.02, 1.96, 3.9);
  const dFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.07), doorFrameMat);
  dFrameL.position.set(ROOM.halfW - 0.02, 0.98, 3.44);
  const dFrameR = dFrameL.clone();
  dFrameR.position.z = 4.36;
  const dKnob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshLambertMaterial({ color: '#B08C5C' }));
  dKnob.position.set(ROOM.halfW - 0.07, 0.95, 4.2);
  door.add(dPanel, dFrameTop, dFrameL, dFrameR, dKnob);
  scene.add(door);
  // 门上的小圆窗
  const roundWin = new THREE.Group();
  const rWinRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 10, 24), doorFrameMat);
  const rWinGlass = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24),
    new THREE.MeshBasicMaterial({ color: '#DDEBF2', transparent: true, opacity: 0.9 }));
  roundWin.add(rWinRing, rWinGlass);
  roundWin.position.set(ROOM.halfW - 0.05, 1.45, 3.9);
  roundWin.rotation.y = -Math.PI / 2;
  scene.add(roundWin);

  /* ---------- 三角旗彩旗串（幼儿园的气息） ---------- */
  const bunting = new THREE.Group();
  const flagCols = ['#F2B8B8', '#F7D98C', '#B8D4C8', '#B8C8E8', '#E8C4B8'];
  const stringMat = new THREE.MeshBasicMaterial({ color: '#B9A98C' });
  const buntingFlags = [];
  function addBuntingRun(x0, y0, x1, y1, z, sag, n) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x0, y0, z),
      new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - sag, z),
      new THREE.Vector3(x1, y1, z)
    );
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.008, 6), stringMat);
    bunting.add(tube);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = curve.getPoint(t);
      const col = flagCols[i % flagCols.length];
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.3),
        new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })
      );
      flag.geometry.translate(0, -0.15, 0); // 顶端为轴
      flag.position.copy(p);
      flag.position.z = z + 0.02;
      flag.rotation.z = (Math.random() - 0.5) * 0.12;
      flag.userData.phase = i * 0.9;
      bunting.add(flag);
      buntingFlags.push(flag);
    }
  }
  addBuntingRun(-2.6, 3.9, 4.5, 3.55, ROOM.wallZ + 0.1, 0.3, 9);   // 后墙上缘
  addBuntingRun(-4.05, 4.15, -4.05, 4.15, 2.6 - 0, 0, 0);          // 占位(不生成)
  scene.add(bunting);

  /* ---------- 泰迪熊（坐在地毯边） ---------- */
  const teddy = new THREE.Group();
  const furMat = new THREE.MeshLambertMaterial({ color: '#C8A282' });
  const furLight = new THREE.MeshLambertMaterial({ color: '#E8D4BE' });
  const tBody = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), furMat);
  tBody.scale.set(1, 1.12, 0.86);
  tBody.position.y = 0.24;
  const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), furMat);
  tHead.position.y = 0.5;
  const tEarL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), furMat);
  const tEarR = tEarL.clone();
  tEarL.position.set(-0.09, 0.6, 0); tEarR.position.set(0.09, 0.6, 0);
  const tMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), furLight);
  tMuzzle.position.set(0, 0.46, 0.1);
  const tArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10), furMat);
  const tArmR = tArmL.clone();
  tArmL.position.set(-0.16, 0.3, 0.06); tArmL.rotation.z = 0.5;
  tArmR.position.set(0.16, 0.3, 0.06); tArmR.rotation.z = -0.5;
  const tLegL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), furMat);
  const tLegR = tLegL.clone();
  tLegL.position.set(-0.1, 0.08, 0.12); tLegR.position.set(0.1, 0.08, 0.12);
  teddy.add(tBody, tHead, tEarL, tEarR, tMuzzle, tArmL, tArmR, tLegL, tLegR);
  teddy.position.set(-3.35, 0, 3.5);
  teddy.rotation.y = 0.55;
  scene.add(teddy);

  /* ---------- 橡皮小鸭（小木架上） ---------- */
  const duck = new THREE.Group();
  const duckMat = new THREE.MeshLambertMaterial({ color: '#F2D06B' });
  const dBody = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), duckMat);
  dBody.scale.set(1.15, 0.9, 0.95);
  dBody.position.y = 0.07;
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), duckMat);
  dHead.position.set(0.03, 0.15, 0);
  const dBeak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 10),
    new THREE.MeshLambertMaterial({ color: '#E8946A' }));
  dBeak.rotation.z = -Math.PI / 2;
  dBeak.position.set(0.09, 0.14, 0);
  duck.add(dBody, dHead, dBeak);
  duck.position.set(3.62, 0.445, 1.85);
  scene.add(duck);

  /* ---------- 画架旁的蜡笔 ---------- */
  const crayonCols = ['#D67B6E', '#7E9B6E', '#6E89A8'];
  crayonCols.forEach((col, i) => {
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 10),
      new THREE.MeshLambertMaterial({ color: col }));
    cr.rotation.set(0, i * 1.1, Math.PI / 2);
    cr.position.set(-1.72 + i * 0.09, ROOM.tableY + 0.02, 1.1 + i * 0.05);
    scene.add(cr);
  });

  /* ---------- 小木架上的笔筒 ---------- */
  const cup = new THREE.Group();
  const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 14),
    new THREE.MeshLambertMaterial({ color: '#D8C8B0' }));
  cupBody.position.y = 0.05;
  cup.add(cupBody);
  const pencilCols = ['#D67B6E', '#7E9B6E', '#6E89A8'];
  pencilCols.forEach((col, i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.17, 8),
      new THREE.MeshLambertMaterial({ color: col }));
    p.position.set(-0.025 + i * 0.025, 0.13, (i - 1) * 0.012);
    p.rotation.z = (i - 1) * 0.09;
    cup.add(p);
  });
  cup.position.set(4.22, 0.445, 2.72);
  scene.add(cup);

  /* ---------- 窗帘 ---------- */
  const curtTex = new THREE.CanvasTexture(curtainCanvas());
  curtTex.colorSpace = THREE.SRGBColorSpace;
  const curtMat = new THREE.MeshLambertMaterial({ map: curtTex, side: THREE.DoubleSide });
  const curtL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, w.y1 - w.y0 + 0.5), curtMat);
  curtL.position.set(wx + 0.1, (w.y0 + w.y1) / 2 + 0.1, w.z0 - 0.12);
  curtL.rotation.y = Math.PI / 2 - 0.25;
  const curtR = new THREE.Mesh(new THREE.PlaneGeometry(0.5, w.y1 - w.y0 + 0.5), curtMat);
  curtR.position.set(wx + 0.1, (w.y0 + w.y1) / 2 + 0.1, w.z1 + 0.12);
  curtR.rotation.y = Math.PI / 2 + 0.25;
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(w.z1 - w.z0 + 0.75, 0.42), curtMat);
  valance.rotation.y = Math.PI / 2;
  valance.position.set(wx + 0.12, w.y1 + 0.28, (w.z0 + w.z1) / 2);
  scene.add(curtL, curtR, valance);

  /* ---------- 地毯 ---------- */
  const rugTex = new THREE.CanvasTexture(rugCanvas());
  rugTex.colorSpace = THREE.SRGBColorSpace;
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 40),
    new THREE.MeshLambertMaterial({ map: rugTex, transparent: true, depthWrite: false })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.4, 0.035, 4.6);
  rug.renderOrder = 1;
  scene.add(rug);

  /* ---------- 墙上小画（孩子的蜡笔涂鸦） ---------- */
  const frameMat = new THREE.MeshLambertMaterial({ color: '#C9A87B' });
  for (const [dx, kind] of [[1.9, 0], [3.1, 1]]) {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.035), frameMat);
    fr.position.set(dx, 3.0, ROOM.wallZ + 0.02);
    scene.add(fr);
    const artTex = new THREE.CanvasTexture(doodleCanvas(kind));
    artTex.colorSpace = THREE.SRGBColorSpace;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36),
      new THREE.MeshBasicMaterial({ map: artTex }));
    art.position.set(dx, 3.0, ROOM.wallZ + 0.042);
    scene.add(art);
  }

  /* ---------- 地板上的小球 ---------- */
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16),
    new THREE.MeshLambertMaterial({ color: '#A9C4DE' }));
  ball.position.set(-3.25, 0.17, 4.35);
  scene.add(ball);

  /* ---------- 小画架（点一下开始创作） ---------- */
  const easel = new THREE.Group();
  const eLegMat = new THREE.MeshLambertMaterial({ color: '#C2A172' });
  for (const [lx, lz, lr] of [[-0.16, 0.1, 0.22], [0.16, 0.1, -0.22], [0, -0.14, 0]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.78, 10), eLegMat);
    leg.position.set(lx, 0.39, lz);
    leg.rotation.x = lr;
    easel.add(leg);
  }
  const easelTray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.07),
    new THREE.MeshLambertMaterial({ color: '#B08C5C' }));
  easelTray.position.set(0, 0.36, 0.05);
  easel.add(easelTray);
  const eCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.34),
    new THREE.MeshLambertMaterial({ color: '#FDF8EC', side: THREE.DoubleSide })
  );
  eCanvas.position.set(0, 0.56, 0.008);
  eCanvas.rotation.x = -0.12;
  easel.add(eCanvas);
  // 画布上的小星星提示（未使用前轻轻闪烁）
  const easelGlint = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(patchTexture()), color: '#FFE9B0',
    transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  easelGlint.scale.set(0.3, 0.3, 1);
  easelGlint.position.set(0.1, 0.62, 0.05);
  easel.add(easelGlint);
  const easelHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.3),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide })
  );
  easelHit.position.y = 0.42;
  easelHit.userData.isEasel = true;
  easel.add(easelHit);
  easel.position.set(-2.05, ROOM.tableY, 0.98);
  easel.rotation.y = 0.35;
  scene.add(easel);

  /* ---------- 编织材料篮（点一下倒出新纸片） ---------- */
  const basketTex = new THREE.CanvasTexture(basketCanvas());
  basketTex.colorSpace = THREE.SRGBColorSpace;
  const basket = new THREE.Group();
  const bBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.2, 0.22, 18, 1, true),
    new THREE.MeshLambertMaterial({ map: basketTex, side: THREE.DoubleSide })
  );
  bBody.position.y = 0.11;
  const bBase = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18),
    new THREE.MeshLambertMaterial({ map: basketTex }));
  bBase.rotation.x = -Math.PI / 2;
  bBase.position.y = 0.005;
  const bRim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.024, 10, 24),
    new THREE.MeshLambertMaterial({ color: '#B08C5C' }));
  bRim.rotation.x = Math.PI / 2;
  bRim.position.y = 0.22;
  basket.add(bBody, bBase, bRim);
  basket.position.set(2.35, ROOM.tableY, 0.95);
  const basketHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.4, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide })
  );
  basketHit.position.y = 0.2;
  basketHit.userData.isBasket = true;
  basket.add(basketHit);
  scene.add(basket);

  /* ---------- 风铃（云朵拖动时轻晃轻鸣） ---------- */
  const chime = new THREE.Group();
  const chimeBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8),
    new THREE.MeshLambertMaterial({ color: '#C2A172' }));
  chime.add(chimeBar);
  const tubeMat = new THREE.MeshLambertMaterial({ color: '#E2C48C' });
  for (let i = 0; i < 3; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24 - i * 0.045, 8), tubeMat);
    tube.position.set(-0.05 + i * 0.05, -0.22 - i * 0.01, 0);
    chime.add(tube);
  }
  chime.position.set(wx + 0.16, w.y1 + 0.05, 2.55);
  scene.add(chime);

  /* ---------- 影子剧场：白色幕布 + 拉绳 ---------- */
  const theater = new THREE.Group();
  scene.add(theater);
  const sheetW = 4.9, sheetH = 2.75, sheetZ = 0.52;
  const sheetGeo = new THREE.PlaneGeometry(sheetW, sheetH);
  sheetGeo.translate(0, -sheetH / 2, 0); // 顶端为轴，向下展开
  const curtainMat = new THREE.MeshLambertMaterial({ color: '#FCF6E7', side: THREE.DoubleSide, emissive: '#6A5F4C', emissiveIntensity: 0.25 });
  const sheet = new THREE.Mesh(sheetGeo, curtainMat);
  sheet.position.set(-0.25, 3.16, sheetZ);
  sheet.scale.y = 0.001;
  const rollBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, sheetW + 0.2, 14),
    new THREE.MeshLambertMaterial({ color: '#C9A87B' }));
  rollBar.rotation.z = Math.PI / 2;
  rollBar.position.set(-0.25, 3.18, sheetZ);
  const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.3, 10),
    new THREE.MeshLambertMaterial({ color: '#C2A172' }));
  poleL.position.set(-0.25 - sheetW / 2 - 0.06, 1.62, sheetZ);
  const poleR = poleL.clone();
  poleR.position.x = -0.25 + sheetW / 2 + 0.06;
  theater.add(sheet, rollBar, poleL, poleR);
  // 幕布上柔和的“剧场灯”光晕
  const glowMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(patchTexture()), color: '#FFF0CE', transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const sheetGlow = new THREE.Mesh(new THREE.PlaneGeometry(sheetW, sheetH), glowMat);
  sheetGlow.position.set(-0.25, 1.78, sheetZ + 0.012);
  sheetGlow.renderOrder = 9;
  scene.add(sheetGlow);
  // 拉绳（挂在后墙右侧）
  const rope = new THREE.Group();
  const ropeLine = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: '#D8C29A' }));
  ropeLine.position.y = -0.57;
  const ropeRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 10, 22),
    new THREE.MeshLambertMaterial({ color: '#E2B48C' }));
  ropeRing.position.y = -1.2;
  rope.add(ropeLine, ropeRing);
  rope.position.set(3.55, 3.4, 0.32);
  const ropeHit = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }));
  ropeHit.position.y = -0.8;
  ropeHit.userData.isRope = true;
  rope.add(ropeHit);
  scene.add(rope);

  /* ---------- 作品展示板（照片钉上墙） ---------- */
  const boardGroup = new THREE.Group();
  const boardFrame = box(1.3, 1.0, 0.05, '#C9A87B', -3.28, 2.62, ROOM.wallZ + 0.06);
  const boardCork = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 0.86),
    new THREE.MeshLambertMaterial({ color: '#D9BC8E' })
  );
  boardCork.position.set(-3.28, 2.62, ROOM.wallZ + 0.09);
  boardGroup.add(boardCork);
  scene.add(boardGroup);
  const boardSlots = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    boardSlots.push(new THREE.Vector3(-3.28 - 0.37 + c * 0.37, 2.62 + 0.28 - r * 0.28, ROOM.wallZ + 0.11));
  }

  /* ---------- 窗台绿植（影子会随风摆） ---------- */
  const plantGroup = new THREE.Group();
  const potMat = new THREE.MeshLambertMaterial({ color: '#C98B6F', flatShading: true });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.115, 0.24, 18), potMat);
  pot.position.y = 0.12;
  const potRim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.17, 0.055, 18),
    new THREE.MeshLambertMaterial({ color: '#B8795F', flatShading: true }));
  potRim.position.y = 0.245;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.155, 18),
    new THREE.MeshLambertMaterial({ color: '#5C4A38' }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.245;
  plantGroup.add(pot, potRim, soil);
  const leafTex = new THREE.CanvasTexture(plantLeafCanvas());
  leafTex.colorSpace = THREE.SRGBColorSpace;
  const leafMat = new THREE.MeshLambertMaterial({ map: leafTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const plantLeaves = [];
  for (let i = 0; i < 7; i++) {
    const h = 0.4 + (i % 3) * 0.11;
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, h), leafMat);
    const a = (i / 7) * Math.PI * 2 + 0.4;
    lf.position.set(Math.cos(a) * 0.085, 0.27 + h / 2, Math.sin(a) * 0.085);
    lf.rotation.set(Math.sin(a) * 0.42, -a, (i % 2 ? 0.2 : -0.16));
    lf.userData.phase = i * 1.1;
    lf.userData.baseZ = lf.rotation.z;
    plantGroup.add(lf);
    plantLeaves.push(lf);
  }
  plantGroup.position.set(-2.62, ROOM.tableY, 0.86);
  scene.add(plantGroup);


  /* ---------- 偶尔飞过窗外的小鸟（影子扫墙） ---------- */
  const flyBird = new THREE.Group();
  const wingMat = new THREE.MeshLambertMaterial({ color: '#8D8478', side: THREE.DoubleSide });
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat);
  const wingR = wingL.clone();
  wingL.position.x = -0.1; wingR.position.x = 0.1;
  flyBird.add(wingL, wingR);
  flyBird.position.set(wx - 1.2, 3.0, 1.9);
  flyBird.visible = false;
  scene.add(flyBird);

  /* ---------- 云朵 ---------- */  const clouds = [];
  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  function makeCloud(scale, tint) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: tint, emissive: '#E8EFF8', emissiveIntensity: 0.38, flatShading: true });
    const blobs = [
      [0, 0, 0, 0.42], [0.38, 0.1, 0.05, 0.3], [-0.36, 0.06, -0.04, 0.28],
      [0.12, 0.26, 0, 0.26], [-0.14, 0.2, 0.06, 0.22],
    ];
    for (const [x, y, z, r] of blobs) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
      s.scale.set(1, 0.72, 0.9);
      s.position.set(x, y, z);
      g.add(s);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cloudGlowTexture()), transparent: true, opacity: 0.55, depthWrite: false,
    }));
    glow.scale.set(2.1, 1.35, 1);
    glow.position.y = 0.16;
    g.add(glow);
    g.scale.setScalar(scale);
    const wrapper = { group: g, baseY: 0, phase: Math.random() * 9, scale };
    cloudGroup.add(g);
    return wrapper;
  }
  const cloud1 = makeCloud(1.0, '#FDFEFF');
  const cloud2 = makeCloud(0.72, '#F7FAFD');

  /* ---------- 太阳状态（云朵遮光 / 落山 统一插值） ---------- */
  const sunState = {
    intensity: 1,      // 0..1 云层遮挡后的光强（平滑值）
    dusk: 0,           // 0..1 落山
    target: 1,
    wallCool: 0,       // 全遮挡时偏冷
    elevation: 0.62,   // 0..1 太阳高度（孩子可拖动）
    theater: 0,        // 0..1 影子剧场模式过渡
    night: 0,          // 0..1 月夜（落山后自动升起）
    gelTint: new THREE.Color('#FFFFFF'), // 窗户玻璃纸叠加的全屋染色
  };

  function applySun() {
    const s = sunState;
    const e = s.elevation;
    const night = s.night;
    const I = s.intensity * (1 - s.dusk * 0.72) * (1 - s.theater * 0.62) * (1 - night * 0.42);
    // 太阳位置与灯位随高度
    sunDisk.position.y = 1.15 + e * 3.1 - s.dusk * 1.8;
    sun.position.set(-5.6 - e * 1.2, 1.9 + e * 3.6, 3.5 - e * 0.7);
    const lowCol = new THREE.Color('#FFC08A'), highCol = new THREE.Color('#FFDFAE');
    sun.intensity = (0.3 + I * 1.78) * (1 - s.theater * 0.55) * (1 - night * 0.5);
    sun.color.copy(highCol).lerp(lowCol, Math.max(s.dusk, (1 - e) * 0.75)).lerp(new THREE.Color('#A9BAD4'), night).multiply(s.gelTint);
    hemi.intensity = (0.78 + I * 0.64 + s.dusk * 0.06 - s.theater * 0.34) * (1 - night * 0.22);
    hemi.color.copy(new THREE.Color('#FFF6E4')).lerp(new THREE.Color('#E8DCE8'), Math.max(s.wallCool, s.dusk * 0.7)).lerp(new THREE.Color('#C3CBDC'), night).multiply(s.gelTint);
    // 全遮挡时整体微冷
    const cool = Math.min(1, s.wallCool * 1.5);
    mats.wallBack.color.copy(new THREE.Color(C.wallBack)).lerp(new THREE.Color('#EDEEEF'), cool * 0.5).lerp(new THREE.Color('#EFE0CE'), s.dusk * 0.6).lerp(new THREE.Color('#C7C6D4'), night * 0.55);
    mats.wallLeft.color.copy(new THREE.Color(C.wallLeft)).lerp(new THREE.Color('#E9EBEC'), cool * 0.5).lerp(new THREE.Color('#EADCCB'), s.dusk * 0.6).lerp(new THREE.Color('#C3C2D0'), night * 0.55);
    mats.floor.color.copy(new THREE.Color(C.floor)).lerp(new THREE.Color('#E4E6E8'), cool * 0.4).lerp(new THREE.Color('#B9B9C8'), night * 0.45);
    // 天空与太阳
    const skyTop = new THREE.Color('#BFE0F2').lerp(new THREE.Color('#E8EAEA'), cool).lerp(new THREE.Color('#F2BE9C'), Math.max(s.dusk, (1 - e) * 0.6)).lerp(new THREE.Color('#2E3A5C'), night);
    const skyBot = new THREE.Color('#EDF6FB').lerp(new THREE.Color('#EFF0F0'), cool).lerp(new THREE.Color('#F7D9B8'), Math.max(s.dusk, (1 - e) * 0.6)).lerp(new THREE.Color('#5D688C'), night);
    skyTop.multiply(s.gelTint); skyBot.multiply(s.gelTint.clone().lerp(new THREE.Color('#FFFFFF'), 0.35));
    skyMat.uniforms.top.value.copy(skyTop);
    skyMat.uniforms.bottom.value.copy(skyBot);
    sunDisk.material.color.copy(new THREE.Color('#FFE7B0').lerp(new THREE.Color('#FFB98A'), Math.max(s.dusk, (1 - e) * 0.8)));
    sunDisk.material.opacity = (0.95 - cool * 0.75) * (1 - s.theater) * (1 - night);
    sunDisk.userData.halo.material.opacity = 0.42 * (1 - s.theater) * (1 - night);
    sunDisk.position.y = 1.15 + e * 3.1 - s.dusk * 1.8 - night * 2.6;
    moon.position.y = 0.9 + night * 2.9;
    moon.material.opacity = night;
    moonHalo.material.opacity = night * 0.5;
    stars.material.opacity = night * 0.85;
    // 光束
    const beamOp = 0.06 * I * (1 - s.theater);
    prism1.material.uniforms.uOp.value = beamOp;
    prism2.material.uniforms.uOp.value = beamOp * 0.66;
  }

  /* ---------- 呼吸感机位 ---------- */
  const camBase = new THREE.Vector3(3.02, 4.46, 6.78);
  const camLook = new THREE.Vector3(-0.55, 1.05, 1.0);
  camera.position.copy(camBase);
  camera.lookAt(camLook);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, camera, ROOM, sunState, clouds: { cloud1, cloud2, group: cloudGroup },
    sky, sunDisk, sunHit, skyMat, prism1, prism2,
    theater: { group: theater, sheet, sheetGlow, glowMat, rope, ropeHit, sheetZ },
    board: { slots: boardSlots },
    plant: { group: plantGroup, leaves: plantLeaves },
    flyBird, moon, stars, chime, basket, basketHit, easel, easelGlint,
    bunting, buntingFlags, teddy, sideBench,
    camBase, camLook,
    applySun, resize,
    render() { renderer.render(scene, camera); },
  };
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function trayShadeTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(75,55,30,0.42)');
  g.addColorStop(0.35, 'rgba(75,55,30,0.14)');
  g.addColorStop(1, 'rgba(75,55,30,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 64);
  const g2 = ctx.createLinearGradient(0, 0, 256, 0);
  g2.addColorStop(0, 'rgba(80,60,35,0.35)');
  g2.addColorStop(0.12, 'rgba(80,60,35,0)');
  g2.addColorStop(0.88, 'rgba(80,60,35,0)');
  g2.addColorStop(1, 'rgba(80,60,35,0.35)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, 256, 64);
  return new THREE.CanvasTexture(c);
}
