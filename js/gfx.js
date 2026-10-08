// Terres Arides — rendu : gestion des couleurs, textures procédurales, ciel, nuages, étoiles, herbe et vent.
'use strict';

// ---------- Couleurs : rendu « film » (ACES) en sRGB ----------
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const gfxTime = { value: 0 };
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

// ---------- Textures procédurales (gris clair : elles modulent la couleur de chaque matériau) ----------
function canvasTex(size, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  draw(g, size);
  const t = new T.CanvasTexture(cv);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = ANISO;
  if (srgb) t.encoding = T.sRGBEncoding;
  return t;
}
const texRng = mulberry32(1234);
function speckle(g, n, size, light, dark, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    const x = texRng() * size, y = texRng() * size, r = rmin + texRng() * (rmax - rmin);
    g.fillStyle = texRng() < 0.5 ? light : dark;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
// bruit fractal qui se répète sans couture (pour des textures douces, sans taches rondes)
function noiseFill(g, s, base, amp, oct = 4, fineAmp = 6) {
  const img = g.createImageData(s, s), d = img.data;
  const grid = [];
  for (let o = 0; o < oct; o++) {
    const n = 4 << o, a = [];
    for (let i = 0; i < n * n; i++) a.push(texRng());
    grid.push({ n, a });
  }
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let v = 0, w = 0.5;
    for (const { n, a } of grid) {
      const fx = x / s * n, fy = y / s * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const at = (i, j) => a[((j % n) * n + (i % n))];
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx, bot = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
      v += (top + (bot - top) * ty - 0.5) * w; w *= 0.55;
    }
    const c = clamp(base + v * amp + (texRng() - 0.5) * fineAmp, 0, 255);
    const k = (y * s + x) * 4;
    d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const TEX = {
  // sol : variations douces, grain fin, petits cailloux
  ground: canvasTex(512, (g, s) => {
    noiseFill(g, s, 228, 70, 5, 14);
    speckle(g, 900, s, 'rgba(255,250,240,0.18)', 'rgba(40,30,20,0.16)', 0.6, 1.6);
  }),
  // grain discret pour tous les objets
  grain: canvasTex(256, (g, s) => {
    noiseFill(g, s, 236, 40, 4, 10);
  }),
  // enduit de terre (murs) : taches, fissures, soubassement plus sombre
  plaster: canvasTex(512, (g, s) => {
    noiseFill(g, s, 234, 46, 5, 8);
    g.strokeStyle = 'rgba(60,40,30,0.25)'; g.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      let x = texRng() * s, y = texRng() * s;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (texRng() - 0.5) * 30; y += texRng() * 22; g.lineTo(x, y); }
      g.stroke();
    }
    // briques apparentes par endroits
    for (let i = 0; i < 10; i++) {
      const bx = texRng() * s, by = texRng() * s;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        g.fillStyle = 'rgba(90,55,35,0.18)';
        g.fillRect(bx + c * 22 + (r % 2) * 11, by + r * 11, 20, 9);
      }
    }
  }),
  // tuiles / chaume pour les toits
  tiles: canvasTex(256, (g, s) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + 13, s, 3);
      for (let x = (y / 16) % 2 ? 0 : 12; x < s; x += 24) {
        g.fillStyle = `rgba(${texRng() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + texRng() * 0.1})`;
        g.fillRect(x, y, 22, 13);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 22, y, 2, 13);
      }
    }
  }),
  // planches de bois
  wood: canvasTex(256, (g, s) => {
    g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) {
      g.fillStyle = `rgba(0,0,0,${0.03 + texRng() * 0.08})`; g.fillRect(x, 0, 32, s);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 30, 0, 2, s);
      for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x + texRng() * 28, texRng() * s, 1, 20 + texRng() * 60); }
    }
  }),
  // pierre taillée (remparts)
  stone: canvasTex(512, (g, s) => {
    noiseFill(g, s, 150, 40, 3, 6);
    for (let y = 0; y < s; y += 42) for (let x = (y / 42) % 2 ? -30 : 0; x < s; x += 64) {
      const v = 200 + Math.floor(texRng() * 50);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 2, y + 2, 60, 38);
    }
    speckle(g, 3000, s, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.10)', 0.5, 1.5);
  }),
};

// UV proportionnelles à la taille (une texture ne s'étire pas sur un long mur)
function boxGeoUV(w, h, d, k = 0.35) {
  const geo = new T.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] * k, uv.getY(i) * dims[f][1] * k);
  }
  return geo;
}

// ---------- Vent : la végétation ondule ----------
function addWind(material, amp = 0.12, minY = 0) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uTime = gfxTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        #ifdef USE_INSTANCING
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #else
          vec4 wp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #endif
        float hh = max(position.y - ${minY.toFixed(2)}, 0.0);
        float w = sin(uTime * 1.6 + wp.x * 0.31 + wp.z * 0.23) + 0.45 * sin(uTime * 3.1 + wp.x * 0.9 + wp.z * 0.7);
        transformed.x += w * ${amp.toFixed(3)} * hh * hh;
        transformed.z += w * ${(amp * 0.5).toFixed(3)} * hh * hh;
      }`);
  };
  material.customProgramCacheKey = () => 'wind' + amp + minY;
  return material;
}

// ---------- Géométries fusionnées avec couleurs par sommet ----------
// parts : [{ geo, color, shade: [bas, haut] }] — chaque partie est déjà placée (translate/rotate/scale)
function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  const c = new T.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    const base = lin(p.color);
    const [lo, hi] = p.shade || [1, 1];
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      const t = (P.getY(i) - y0) / ((y1 - y0) || 1);
      const k = (lo + (hi - lo) * t) * (p.jitter ? 1 + (texRng() - 0.5) * p.jitter : 1);
      c.copy(base).multiplyScalar(k);
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return geo;
}
// rocher irrégulier
function rockGeo(seed, detail = 1) {
  const g = new T.IcosahedronGeometry(1, detail);
  const n = makeNoise(seed);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = 0.72 + n(x * 1.3 + 5, z * 1.3 + y * 0.7 + 5) * 0.55;
    P.setXYZ(i, x * k, Math.max(-0.35, y * k * 0.8), z * k);
  }
  return g;
}

// ---------- Ciel : dôme en dégradé, soleil, étoiles, nuages ----------
const sky = {};
{
  const geo = new T.SphereGeometry(900, 32, 16);
  sky.uniforms = {
    zenith: { value: lin('#3d6fb3') }, horizon: { value: lin('#e8d8b8') }, ground: { value: lin('#b59a74') },
    sunDir: { value: new T.Vector3(0, 1, 0) }, sunColor: { value: lin('#fff2d0') }, sunSize: { value: 1 },
  };
  sky.mesh = new T.Mesh(geo, new T.ShaderMaterial({
    uniforms: sky.uniforms, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0 / sunSize) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  sky.mesh.renderOrder = -10;
  sky.mesh.frustumCulled = false;
  scene.add(sky.mesh);
  // étoiles
  const sp = [];
  const r = mulberry32(77);
  for (let i = 0; i < 1400; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, y = Math.abs(u);
    const rr = Math.sqrt(1 - y * y);
    sp.push(Math.cos(a) * rr * 850, y * 850, Math.sin(a) * rr * 850);
  }
  const sg = new T.BufferGeometry();
  sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
  sky.stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.stars.frustumCulled = false;
  scene.add(sky.stars);
  // nuages : grandes taches douces qui dérivent
  const cloudTex = canvasTex(256, (g, s) => {
    for (let i = 0; i < 14; i++) {
      const x = s * (0.2 + texRng() * 0.6), y = s * (0.35 + texRng() * 0.3), rad = s * (0.12 + texRng() * 0.16);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  });
  cloudTex.wrapS = cloudTex.wrapT = T.ClampToEdgeWrapping;
  sky.cloudMat = new T.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, color: '#ffffff', opacity: 0.85 });
  sky.clouds = [];
  for (let i = 0; i < 16; i++) {
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), sky.cloudMat);
    m.rotation.x = Math.PI / 2;
    const sc = 160 + r() * 220;
    m.scale.set(sc, sc * (0.45 + r() * 0.3), 1);
    m.userData = { x: (r() - 0.5) * 1600, z: (r() - 0.5) * 1600, y: 210 + r() * 70 };
    m.renderOrder = -9;
    m.frustumCulled = false;
    scene.add(m);
    sky.clouds.push(m);
  }
}

// palettes du jour selon la hauteur du soleil
const SKY_KEYS = [
  { e: -0.6, zenith: '#0a1430', horizon: '#26345a', ground: '#141826', sun: '#9fb4e8', sunI: 0.75, hemiS: '#5a6ea8', hemiG: '#2a2a36', hemiI: 0.85, fog: '#1e2a48' },
  { e: -0.12, zenith: '#232c62', horizon: '#c86a4c', ground: '#3a2a26', sun: '#ff9a5a', sunI: 0.8, hemiS: '#7a6a9a', hemiG: '#3a2a22', hemiI: 0.75, fog: '#8a5a52' },
  { e: 0.12, zenith: '#3a63a8', horizon: '#f0b07c', ground: '#7a5a40', sun: '#ffbe78', sunI: 1.7, hemiS: '#9ab4d8', hemiG: '#6a5038', hemiI: 0.7, fog: '#dcb08a' },
  { e: 0.45, zenith: '#2f6ac0', horizon: '#d8dcd6', ground: '#a8916c', sun: '#fff0d4', sunI: 2.1, hemiS: '#b0c8e8', hemiG: '#8a6c48', hemiI: 0.72, fog: '#c8d0d0' },
  { e: 1.0, zenith: '#2860b8', horizon: '#d2dae0', ground: '#b09a76', sun: '#fff6e4', sunI: 2.3, hemiS: '#b8d0ee', hemiG: '#8f7250', hemiI: 0.75, fog: '#c4ced4' },
];
SKY_KEYS.forEach(k => { for (const f of ['zenith', 'horizon', 'ground', 'sun', 'hemiS', 'hemiG', 'fog']) k[f] = lin(k[f]); });
const STORM = { zenith: lin('#b88a58'), horizon: lin('#d2a46c'), fog: lin('#c9965e') };
const _sk = { zenith: new T.Color(), horizon: new T.Color(), ground: new T.Color(), sun: new T.Color(), hemiS: new T.Color(), hemiG: new T.Color(), fog: new T.Color() };
const SKY_FIELDS = ['zenith', 'horizon', 'ground', 'sun', 'hemiS', 'hemiG', 'fog'];
function skyAt(e) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && e > SKY_KEYS[i + 1].e) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const t = clamp((e - a.e) / (b.e - a.e), 0, 1);
  for (const f of SKY_FIELDS) _sk[f].copy(a[f]).lerp(b[f], t);
  _sk.sunI = a.sunI + (b.sunI - a.sunI) * t;
  _sk.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  return _sk;
}
// lumière, ciel et brouillard selon l'heure ; focus = point suivi par la caméra
function updateAtmosphere(phase, storm, focus, farView) {
  const ang = phase * Math.PI * 2 + 0.3;
  const e = Math.sin(ang);
  const k = skyAt(e);
  const night = clamp(-e * 2.2 - 0.1, 0, 1);
  // le soleil se lève à l'est et se couche à l'ouest ; la nuit, la lune éclaire faiblement
  const el = e > -0.05 ? Math.max(0.1, e) : Math.max(0.35, -e * 0.8);
  const az = e > -0.05 ? ang : ang + Math.PI;
  const dir = new T.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el) * 0.6 + 0.35).normalize();
  sun.position.set(focus.x + dir.x * 120, focus.y + dir.y * 120, focus.z + dir.z * 120);
  sun.target.position.set(focus.x, focus.y, focus.z);
  sun.color.copy(k.sun);
  sun.intensity = k.sunI * (storm ? 0.45 : 1);
  hemi.color.copy(k.hemiS); hemi.groundColor.copy(k.hemiG);
  hemi.intensity = k.hemiI;
  const u = sky.uniforms;
  u.zenith.value.copy(k.zenith); u.horizon.value.copy(k.horizon); u.ground.value.copy(k.hemiG).multiplyScalar(0.8).lerp(k.horizon, 0.3);
  u.sunDir.value.copy(e > -0.05 ? dir : dir.clone().multiplyScalar(-1));
  u.sunColor.value.copy(k.sun).multiplyScalar(e > -0.05 ? 1 : 0.15);
  scene.fog.color.copy(k.fog);
  if (storm) { u.zenith.value.lerp(STORM.zenith, 0.85); u.horizon.value.lerp(STORM.horizon, 0.9); scene.fog.color.lerp(STORM.fog, 0.9); }
  sky.mesh.position.copy(camera.position);
  sky.stars.position.copy(camera.position);
  sky.stars.material.opacity = storm ? 0 : night;
  sky.stars.rotation.y = phase * Math.PI * 2;
  const far = farView ? 620 : 470;
  scene.fog.near += ((storm ? 6 : farView ? 180 : 110) - scene.fog.near) * 0.05;
  scene.fog.far += ((storm ? 48 : far) - scene.fog.far) * 0.05;
  // nuages teintés par la lumière du moment
  sky.cloudMat.color.copy(k.horizon).lerp(new T.Color(1, 1, 1), 0.45 * (1 - night)).multiplyScalar(1 - night * 0.6);
  sky.cloudMat.opacity = storm ? 0 : 0.8;
  const t = gfxTime.value;
  for (const c of sky.clouds) {
    const d = c.userData;
    let x = d.x + t * 2.2, z = d.z + t * 0.8;
    x = ((x - camera.position.x + 800) % 1600 + 1600) % 1600 - 800 + camera.position.x;
    z = ((z - camera.position.z + 800) % 1600 + 1600) % 1600 - 800 + camera.position.z;
    c.position.set(x, camera.position.y * 0.3 + d.y, z);
  }
  return { night, e };
}

// ---------- Herbe et fleurs autour du joueur ----------
const grass = {};
{
  const blade = (ang, h, lean) => {
    const g = new T.BufferGeometry();
    const w = 0.1;
    const c = Math.cos(ang), s = Math.sin(ang);
    const v = [-w * c, 0, -w * s, w * c, 0, w * s, lean * s, h, -lean * c];
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
    return g;
  };
  const parts = [];
  for (let i = 0; i < 7; i++) parts.push({ geo: blade(i * 0.9 + 0.3, 0.38 + (i % 3) * 0.12, (i % 2 ? 0.1 : -0.08)).translate(Math.cos(i * 2.1) * 0.15, 0, Math.sin(i * 2.1) * 0.15), color: '#ffffff', shade: [0.72, 1.12] });
  const geo = mergeParts(parts);
  const m = addWind(new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 1 }), 0.32, 0);
  grass.mesh = new T.InstancedMesh(geo, m, 9000);
  grass.mesh.receiveShadow = true;
  grass.mesh.frustumCulled = false;
  for (let i = 0; i < 9000; i++) grass.mesh.setColorAt(i, new T.Color(1, 1, 1));
  grass.mesh.count = 0;
  scene.add(grass.mesh);
  // fleurs
  const fparts = [{ geo: new T.CylinderGeometry(0.012, 0.012, 0.35, 3).translate(0, 0.17, 0), color: '#5a7a3a' },
    { geo: new T.IcosahedronGeometry(0.06, 0).translate(0, 0.37, 0), color: '#ffffff' }];
  grass.flowers = new T.InstancedMesh(mergeParts(fparts), addWind(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 0.4, 0), 900);
  grass.flowers.frustumCulled = false;
  for (let i = 0; i < 900; i++) grass.flowers.setColorAt(i, new T.Color(1, 1, 1));
  grass.flowers.count = 0;
  scene.add(grass.flowers);
  grass.cx = 1e9; grass.cz = 1e9;
}
const GRASS_DENS = { steppe: 2.4, foret: 2.0, desert: 0.12, montagne: 0.6, sel: 0.03 };
const GFX_QUALITY = { haute: { pr: 2, shadow: 2048, grass: 1 }, moyenne: { pr: 1.25, shadow: 2048, grass: 0.6 }, basse: { pr: 1, shadow: 1024, grass: 0.25 } };
const GRASS_TINT = { steppe: '#aca45e', foret: '#5a8238', desert: '#c0a468', montagne: '#7f8c58', sel: '#c8c8b0' };
const FLOWER_COLS = ['#e8d34a', '#f2f0e8', '#c94a4a', '#9a6ad0', '#f29a3a'].map(c => lin(c));
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function updateGrass(focus) {
  if (!focus) return;
  if (Math.hypot(focus.x - grass.cx, focus.z - grass.cz) < 6) return;
  grass.cx = focus.x; grass.cz = focus.z;
  const dummy = new T.Object3D(), col = new T.Color();
  const R = 42, step = 1.05;
  let n = 0, nf = 0;
  const x0 = Math.floor((focus.x - R) / step), x1 = Math.floor((focus.x + R) / step);
  const z0 = Math.floor((focus.z - R) / step), z1 = Math.floor((focus.z + R) / step);
  const towns = state.settlements.filter(s => d2(s, focus) < R + s.r + 5);
  const nodes = state.nodes.filter(nd => d2(nd, focus) < R + 16);
  for (let i = x0; i <= x1 && n < 9000; i++) for (let j = z0; j <= z1 && n < 9000; j++) {
    const h = hash2(i, j);
    const x = (i + hash2(j, i)) * step, z = (j + hash2(i + 7, j - 3)) * step;
    const dd = Math.hypot(x - focus.x, z - focus.z);
    if (dd > R) continue;
    const b = biomeAt(x, z);
    let dens = GRASS_DENS[b];
    if (towns.some(s => Math.hypot(s.x - x, s.z - z) < s.r - 4)) dens *= 0.08;
    if (nodes.some(nd => Math.hypot(nd.x - x, nd.z - z) < 11)) dens *= 0.15;
    if (onRoad(x, z) < 1.8) dens *= 0.05;
    dens *= 1 - smooth(R * 0.75, R, dd) * 0.8;
    if (h > dens / 2.5 * grassDensity()) continue;
    const sc = (0.6 + hash2(i * 3, j * 5) * 0.9) * (b === 'desert' ? 0.7 : 1);
    dummy.position.set(x, heightAt(x, z) - 0.03, z);
    dummy.rotation.set(0, h * 40, 0);
    dummy.scale.set(sc, sc * (0.8 + hash2(i, j * 3) * 0.6), sc);
    dummy.updateMatrix();
    grass.mesh.setMatrixAt(n, dummy.matrix);
    // la couleur de l'herbe suit celle du sol, en un peu plus vif
    col.copy(terrainColor(x, z, dummy.position.y, 1)).lerp(lin(GRASS_TINT[b]), 0.35).multiplyScalar(1.05 + hash2(i * 9, j) * 0.25);
    grass.mesh.setColorAt(n, col);
    n++;
    if ((b === 'steppe' || b === 'foret') && hash2(i * 13, j * 7) < 0.05 && nf < 900) {
      dummy.scale.setScalar(0.8 + h);
      dummy.updateMatrix();
      grass.flowers.setMatrixAt(nf, dummy.matrix);
      grass.flowers.setColorAt(nf, FLOWER_COLS[Math.floor(hash2(i * 3, j * 11) * FLOWER_COLS.length)]);
      nf++;
    }
  }
  grass.mesh.count = n; grass.flowers.count = nf;
  grass.mesh.instanceMatrix.needsUpdate = true; grass.flowers.instanceMatrix.needsUpdate = true;
  if (grass.mesh.instanceColor) grass.mesh.instanceColor.needsUpdate = true;
  if (grass.flowers.instanceColor) grass.flowers.instanceColor.needsUpdate = true;
}

const grassDensity = () => (GFX_QUALITY[settings.quality] || GFX_QUALITY.haute).grass;
// qualité graphique : finesse de l'image, ombres, herbe
function applyQuality() {
  const q = GFX_QUALITY[settings.quality] || GFX_QUALITY.haute;
  renderer.setPixelRatio(Math.min(q.pr, window.devicePixelRatio || 1) * (fpsGuard.scale || 1));
  if (sun.shadow.mapSize.x !== q.shadow) {
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  grass.cx = 1e9;
  resize();
}
// si l'image saccade, on baisse un peu la résolution toute seule
const fpsGuard = { t: 0, frames: 0, scale: 1, warned: false };
function watchFps(dt) {
  fpsGuard.t += dt; fpsGuard.frames++;
  if (fpsGuard.t < 4) return;
  const fps = fpsGuard.frames / fpsGuard.t;
  fpsGuard.t = 0; fpsGuard.frames = 0;
  if (fps < 38 && fpsGuard.scale > 0.6) {
    fpsGuard.scale = Math.max(0.6, fpsGuard.scale - 0.15);
    applyQuality();
    if (!fpsGuard.warned) { fpsGuard.warned = true; logMsg('⚙ Image allégée automatiquement pour rester fluide (réglages : O → Qualité).'); }
  }
}

// lumière chaude autour du personnage la nuit (torche)
const torch = new T.PointLight(0xffb066, 0, 14, 1.6);
scene.add(torch);
function updateTorch(night, focus) {
  torch.intensity += ((night > 0.3 ? 1.6 * night : 0) - torch.intensity) * 0.05;
  if (focus) torch.position.set(focus.x, focus.y + 2.4, focus.z);
}

// ---------- Routes entre les villes ----------
let ROADS = [];
let roadGrid = new Map();
const ROAD_CELL = 30;
function planRoads(list) {
  ROADS = []; roadGrid = new Map();
  const towns = (list || state.settlements).filter(s => s.type !== 'repaire');
  const seen = new Set();
  for (const a of towns) {
    const near = towns.filter(b => b !== a).sort((p, q) => d2(a, p) - d2(a, q)).slice(0, 2);
    for (const b of near) {
      const key = [a.name, b.name].sort().join('|');
      if (seen.has(key) || d2(a, b) > 520) continue;
      seen.add(key);
      // départ et arrivée devant les portes, tracé qui serpente un peu
      const ga = gatePos(a, -4), gb = gatePos(b, -4);
      const pts = [];
      const n = Math.ceil(d2(ga, gb) / 12);
      const nz = makeNoise(a.x * 3 + b.z);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const off = (nz(t * 3, 0.5) - 0.5) * 40 * Math.sin(t * Math.PI);
        const dx = gb.x - ga.x, dz = gb.z - ga.z, L = Math.hypot(dx, dz) || 1;
        pts.push({ x: ga.x + dx * t - dz / L * off, z: ga.z + dz * t + dx / L * off });
      }
      ROADS.push(pts);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], seg = [a, b];
        const cx0 = Math.floor((Math.min(a.x, b.x) - 6) / ROAD_CELL), cx1 = Math.floor((Math.max(a.x, b.x) + 6) / ROAD_CELL);
        const cz0 = Math.floor((Math.min(a.z, b.z) - 6) / ROAD_CELL), cz1 = Math.floor((Math.max(a.z, b.z) + 6) / ROAD_CELL);
        for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
          const k = cx + ',' + cz;
          if (!roadGrid.has(k)) roadGrid.set(k, []);
          roadGrid.get(k).push(seg);
        }
      }
    }
  }
}
function onRoad(x, z) {
  let best = 99;
  const l = roadGrid.get(Math.floor(x / ROAD_CELL) + ',' + Math.floor(z / ROAD_CELL));
  if (!l) return best;
  {
    for (const [a, b] of l) {
      const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
      const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / L2, 0, 1);
      const d = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
      if (d < best) best = d;
    }
  }
  return best;
}
// ruban de terre battue qui suit le relief
function buildRoads() {
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const r of ROADS) {
    // points tous les 2 m
    const pts = [];
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1], L = d2(a, b), n = Math.max(1, Math.ceil(L / 2));
      for (let k = 0; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
    }
    pts.push(r[r.length - 1]);
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L, w = 1.7;
      if (i) dist += d2(p, pts[i - 1]);
      for (const sgn of [-1, 1]) {
        const x = p.x + nx * w * sgn, z = p.z + nz * w * sgn;
        pos.push(x, heightAt(x, z) + 0.06, z);
        uv.push(sgn < 0 ? 0 : 1, dist / 3.4);
      }
      if (i) idx.push(base + (i - 1) * 2, base + i * 2, base + (i - 1) * 2 + 1, base + (i - 1) * 2 + 1, base + i * 2, base + i * 2 + 1);
    }
    base += pts.length * 2;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = canvasTex(128, (g, s) => {
    const gr = g.createLinearGradient(0, 0, s, 0);
    gr.addColorStop(0, 'rgba(138,110,78,0)'); gr.addColorStop(0.22, 'rgba(138,110,78,0.85)'); gr.addColorStop(0.5, 'rgba(160,132,96,1)');
    gr.addColorStop(0.78, 'rgba(138,110,78,0.85)'); gr.addColorStop(1, 'rgba(138,110,78,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    speckle(g, 500, s, 'rgba(255,240,210,0.25)', 'rgba(60,40,20,0.25)', 0.5, 2);
    g.fillStyle = 'rgba(80,60,40,0.18)'; g.fillRect(s * 0.3, 0, s * 0.08, s); g.fillRect(s * 0.62, 0, s * 0.08, s);
  });
  const m = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  m.receiveShadow = true;
  m.renderOrder = 1;
  worldGroup.add(m);
}
