// Terres Arides — paysage : eau animée, ponts de pierre, mesas rouges, montagnes à l'horizon, gros nuages.
'use strict';

// ---------- Eau ----------
const WATER_U = {
  time: gfxTime, deep: { value: lin('#155f96') }, shallow: { value: lin('#2a9fb4') }, skyCol: { value: lin('#bcd8f0') },
  sunDir: { value: new T.Vector3(0.3, 0.8, 0.2) }, sunCol: { value: lin('#fff2d0') },
};
function waterMaterial() {
  return new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {}]),
    vertexShader: `attribute float depth; attribute float flow;
      varying float vDepth; varying float vFlow; varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vDepth = depth; vFlow = flow;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyCol; uniform vec3 sunDir; uniform vec3 sunCol;
      varying float vDepth; varying float vFlow; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz;
        float t = time;
        // petites vagues qui avancent dans le sens du courant
        float w1 = sin(p.x * 0.42 + t * 1.2 + sin(p.y * 0.23 + t * 0.4) * 2.0);
        float w2 = sin(p.y * 0.51 - t * 1.0 + sin(p.x * 0.31) * 2.0);
        float w3 = sin(vFlow * 0.9 - t * 2.6 + sin(p.x * 0.7 + p.y * 0.5) * 1.5);
        float rip = (w1 + w2) * 0.25 + 0.5;
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vec3(w1 * 0.08 + w3 * 0.05, 1.0, w2 * 0.08));
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        float d = clamp(vDepth / 1.4, 0.0, 1.0);
        vec3 col = mix(shallow, deep, d);
        col = mix(col, skyCol, 0.04 + fres * 0.3);
        // reflets du soleil
        vec3 H = normalize(V + normalize(sunDir));
        float spec = pow(max(dot(N, H), 0.0), 260.0);
        col += sunCol * spec * 0.9;
        // traînées claires du courant et écume sur les rives
        col += vec3(0.9) * smoothstep(0.86, 0.98, w3 * 0.5 + 0.5) * 0.06 * (vFlow > 0.0 ? 1.0 : 0.0);
        float foam = 1.0 - smoothstep(0.02, 0.14 + rip * 0.08, vDepth);
        col = mix(col, vec3(0.93, 0.95, 0.92), foam * 0.6);
        gl_FragColor = vec4(col, mix(0.62, 0.9, d) + foam * 0.1);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true, side: T.DoubleSide,
  });
}
let waterMat = null;
function buildWater() {
  if (!waterMat) { waterMat = waterMaterial(); Object.assign(waterMat.uniforms, WATER_U); }
  const pos = [], dep = [], flw = [], idx = [];
  const vert = (x, y, z, f) => { pos.push(x, y, z); dep.push(y - heightAt(x, z)); flw.push(f); return pos.length / 3 - 1; };
  // rivières : ruban qui suit la ligne de l'eau
  const ACROSS = 8;
  for (const r of RIVERS) {
    const pts = [];
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      for (let k = 0; k < 3; k++) pts.push({ x: a.x + (b.x - a.x) * k / 3, z: a.z + (b.z - a.z) * k / 3, h: a.h + (b.h - a.h) * k / 3 });
    }
    pts.push(r[r.length - 1]);
    let dist = 0;
    const base = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q.x - o.x, dz = q.z - o.z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;
      if (i) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      for (let k = 0; k <= ACROSS; k++) {
        const s = (k / ACROSS * 2 - 1) * (RIVER_W + 3);
        vert(p.x + nx * s, p.h + WATER_DROP, p.z + nz * s, dist * 0.35);
      }
      if (i) for (let k = 0; k < ACROSS; k++) {
        const a = base + (i - 1) * (ACROSS + 1) + k, b = a + ACROSS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  // lacs : disque à rive irrégulière
  for (const l of LAKES) {
    const SEG = 48, RINGS = 7;
    const c = vert(l.x, l.h + WATER_DROP, l.z, 0);
    const base = pos.length / 3;
    for (let ring = 1; ring <= RINGS; ring++) for (let k = 0; k < SEG; k++) {
      const a = k / SEG * Math.PI * 2;
      const ex = l.x + Math.cos(a) * l.R, ez = l.z + Math.sin(a) * l.R;
      const R = (lakeRadius(l, ex, ez) + 4) * ring / RINGS;
      vert(l.x + Math.cos(a) * R, l.h + WATER_DROP, l.z + Math.sin(a) * R, 0);
    }
    for (let k = 0; k < SEG; k++) idx.push(c, base + (k + 1) % SEG, base + k);
    for (let ring = 1; ring < RINGS; ring++) for (let k = 0; k < SEG; k++) {
      const a = base + (ring - 1) * SEG + k, b = base + (ring - 1) * SEG + (k + 1) % SEG;
      idx.push(a, b, a + SEG, b, b + SEG, a + SEG);
    }
  }
  if (!pos.length) return;
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('depth', new T.Float32BufferAttribute(dep, 1));
  geo.setAttribute('flow', new T.Float32BufferAttribute(flw, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const m = new T.Mesh(geo, waterMat);
  m.renderOrder = 2;
  worldGroup.add(m);
}

// ---------- Ponts de pierre à arches ----------
function buildBridges() {
  for (const b of BRIDGES) {
    const g = new T.Group();
    const L = b.half * 2 + 4, W = 5.2, bed = b.water - 2.2, H = b.deck - bed;
    const stone = '#a39a8c', dark = '#6f675c';
    // tablier, parapets
    g.add(mesh(boxGeoUV(L, 0.6, W), stone, true, 'stone').translateY(b.deck - 0.3));
    for (const s of [-1, 1]) {
      const par = mesh(boxGeoUV(L, 0.8, 0.45), stone, true, 'stone');
      par.position.set(0, b.deck + 0.4, s * (W / 2 - 0.22));
      g.add(par);
      for (let k = -2; k <= 2; k++) {
        const cap = mesh(new T.BoxGeometry(0.7, 0.25, 0.6), '#b8ae9e', false, 'stone');
        cap.position.set(k * L / 5, b.deck + 0.92, s * (W / 2 - 0.22));
        g.add(cap);
      }
    }
    // piles et arches : trois arches sur la rivière
    const n = 3, span = (L - 2) / n;
    for (let k = 0; k <= n; k++) {
      const pier = mesh(boxGeoUV(1.6, H, W + 0.6), stone, true, 'stone');
      pier.position.set(-L / 2 + 1 + k * span, bed + H / 2 - 0.3, 0);
      g.add(pier);
    }
    // poutre sous le tablier
    const beam = mesh(boxGeoUV(L, 1.1, W - 0.6), dark, false, 'stone');
    beam.position.y = b.deck - 1.1;
    g.add(beam);
    // rampes d'accès jusqu'au sol de chaque rive
    for (const sgn of [-1, 1]) {
      let len = 0;
      while (len < 22 && b.deck - len * 0.35 > heightAt(b.x + b.ax * sgn * (L / 2 + len), b.z + b.az * sgn * (L / 2 + len)) - 0.2) len += 0.5;
      if (len < 0.6) continue;
      const ramp = mesh(boxGeoUV(len + 0.6, 0.6, W), stone, true, 'stone');
      ramp.position.set(sgn * (L / 2 + len / 2), b.deck - 0.3 - len * 0.35 / 2, 0);
      ramp.rotation.z = -sgn * Math.atan(0.35);
      g.add(ramp);
      // muret sous la rampe
      const foot = mesh(boxGeoUV(len, len * 0.35 + 1.5, W - 0.4), dark, false, 'stone');
      foot.position.set(sgn * (L / 2 + len / 2), b.deck - 0.6 - (len * 0.35 + 1.5) / 2 + len * 0.35 * 0.25, 0);
      g.add(foot);
    }
    g.position.set(b.x, 0, b.z);
    g.rotation.y = Math.atan2(-b.az, b.ax);
    worldGroup.add(g);
  }
}

// ---------- Mesas et buttes de roche rouge ----------
let MESAS = [];
const STRATA = ['#b85a30', '#c4683a', '#ae522c', '#c97040', '#bb5e33', '#c26a3c', '#b0542e'].map(c => lin(c));
function mesaGeo(rng, R, H, butte) {
  // profil : éboulis à la base, falaise, corniche, plateau ; le tout bosselé par un bruit qui suit l'angle
  let prof = butte
    ? [[1.0, 0], [0.82, 0.2], [0.55, 0.32], [0.5, 0.86], [0.53, 0.9], [0.47, 0.94], [0.45, 1.0], [0, 1.0]]
    : [[1.0, 0], [0.86, 0.18], [0.76, 0.3], [0.72, 0.62], [0.75, 0.66], [0.7, 0.9], [0.72, 0.93], [0.66, 1.0], [0, 1.0]];
  // on découpe les falaises en rangées pour dessiner les strates
  const fine = [prof[0]];
  for (let j = 1; j < prof.length; j++) {
    const [r0, y0] = prof[j - 1], [r1, y1] = prof[j];
    const n = Math.max(1, Math.round((y1 - y0) * H / 2.2));
    for (let q = 1; q <= n; q++) fine.push([r0 + (r1 - r0) * q / n, y0 + (y1 - y0) * q / n]);
  }
  prof = fine;
  const SEG = 30;
  const nz = makeNoise(Math.floor(rng() * 1e6));
  const ang = [];
  for (let k = 0; k <= SEG; k++) ang.push(1 + (nz(Math.cos(k / SEG * Math.PI * 2) * 1.4 + 3, Math.sin(k / SEG * Math.PI * 2) * 1.4 + 3) - 0.5) * 0.55 + (nz(k * 0.9, 7.7) - 0.5) * 0.16);
  const pos = [], col = [];
  const c = new T.Color();
  const band = y => STRATA[((Math.floor(y / 1.9) % STRATA.length) + STRATA.length) % STRATA.length];
  const P = (k, j) => {
    const [r, y] = prof[j];
    const a = (k % SEG) / SEG * Math.PI * 2;
    const jit = j > 0 && j < prof.length - 1 ? 1 + (nz(k * 0.7, j * 1.3) - 0.5) * 0.2 : 1;
    const rr = r * R * ang[k % SEG] * jit;
    return [Math.cos(a) * rr, y * H, Math.sin(a) * rr];
  };
  for (let j = 0; j < prof.length - 1; j++) for (let k = 0; k < SEG; k++) {
    const a = P(k, j), b = P(k + 1, j), d = P(k, j + 1), e = P(k + 1, j + 1);
    const top = prof[j + 1][0] === 0;
    const ym = (a[1] + d[1]) / 2;
    if (top) c.copy(lin('#c99a62'));
    else if (ym < H * 0.12) c.copy(lin('#c27a4a'));
    else c.copy(band(ym + (nz(k * 0.3, 1.7) - 0.5) * 2.5));
    c.multiplyScalar(0.9 + (nz(k * 0.5 + 9, ym * 0.35) - 0.5) * 0.25);
    for (const v of [a, d, b, b, d, e]) { pos.push(...v); col.push(c.r, c.g, c.b); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function buildMesas(rng, sites, nodeSpots) {
  MESAS = [];
  const geos = [];
  for (let t = 0; t < 2500 && MESAS.length < 16; t++) {
    const x = (rng() - 0.5) * (WORLD + 200), z = (rng() - 0.5) * (WORLD + 200);
    const b = biomeAt(x, z);
    if (b !== 'desert' && !(b === 'steppe' && rng() < 0.35)) continue;
    const butte = rng() < 0.4;
    const R = butte ? 12 + rng() * 10 : 22 + rng() * 26;
    if (sites.some(s => Math.hypot(s.x - x, s.z - z) < R + 95) || nodeSpots.some(n => Math.hypot(n.x - x, n.z - z) < R + 30)) continue;
    if (waterDist(x, z) < R + 25 || MESAS.some(m => Math.hypot(m.x - x, m.z - z) < m.r + R + 60)) continue;
    let near = false;
    for (let a = 0; a < 8 && !near; a++) near = onRoad(x + Math.cos(a) * R, z + Math.sin(a) * R) < 14 || onRoad(x, z) < R + 14;
    if (near) continue;
    let y0 = 1e9;
    for (let a = 0; a < 8; a++) y0 = Math.min(y0, heightAt(x + Math.cos(a * 0.785) * R, z + Math.sin(a * 0.785) * R));
    const H = butte ? 24 + rng() * 20 : 16 + rng() * 18;
    const g = mesaGeo(rng, R, H, butte);
    g.rotateY(rng() * 6).translate(x, Math.min(y0, heightAt(x, z)) - 1.2, z);
    geos.push(g);
    MESAS.push({ x, z, r: R });
    // on ne traverse pas la roche
    for (let ox = -R; ox <= R; ox += 7) for (let oz = -R; oz <= R; oz += 7) {
      if (Math.hypot(ox, oz) < R * 0.86) addObstacle(x + ox, z + oz, 5.5);
    }
  }
  if (!geos.length) return;
  // une seule géométrie : un seul appel de dessin pour toutes les mesas
  const pos = [], nor = [], col = [];
  for (const g of geos) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); col.push(...g.attributes.color.array);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const m = new T.Mesh(geo, toonMat({ vertexColors: true, flatShading: true, roughness: 1, map: TEX.stone }));
  m.castShadow = true; m.receiveShadow = true;
  worldGroup.add(m);
}

// ---------- Montagnes en aiguilles à l'horizon ----------
// deux couronnes très lointaines qui suivent la caméra, teintées par la brume du moment
const skyline = { uniforms: { hazeCol: { value: new T.Color() }, topCol: { value: new T.Color() } } };
{
  const layer = (seed, R, hMin, hMax, spires, shade) => {
    const r = mulberry32(seed), nz = makeNoise(seed);
    const N = 720, pos = [], k = [], idx = [];
    const peaks = [];
    for (let i = 0; i < spires; i++) peaks.push({ a: r() * Math.PI * 2, w: 0.008 + r() * 0.02, h: hMax * (0.5 + r() * 0.6) });
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      let h = hMin + (nz(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5) * 0.7 + nz(Math.cos(a) * 9 + 1, Math.sin(a) * 9 + 1) * 0.3) * (hMax - hMin) * 0.6;
      for (const p of peaks) {
        let d = Math.abs(a - p.a); d = Math.min(d, Math.PI * 2 - d);
        if (d < p.w * 3) h = Math.max(h, p.h * Math.pow(Math.max(0, 1 - d / (p.w * 3)), 1.6));
      }
      pos.push(Math.cos(a) * R, -60, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
      k.push(0, shade * clamp(h / hMax, 0.2, 1));
      if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('k', new T.Float32BufferAttribute(k, 1));
    g.setIndex(idx);
    return g;
  };
  const material = new T.ShaderMaterial({
    uniforms: skyline.uniforms, side: T.DoubleSide, fog: false, depthWrite: false,
    vertexShader: `attribute float k; varying float vK; varying float vY;
      void main() { vK = k; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 hazeCol; uniform vec3 topCol; varying float vK; varying float vY;
      void main() {
        vec3 col = mix(hazeCol, topCol, clamp(vK, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  skyline.group = new T.Group();
  const far = new T.Mesh(layer(911, 1350, 60, 260, 26, 0.55), material);
  const near = new T.Mesh(layer(313, 1200, 30, 170, 18, 1.0), material);
  for (const m of [far, near]) { m.frustumCulled = false; m.renderOrder = -8; skyline.group.add(m); }
  scene.add(skyline.group);
}

// ---------- Gros nuages en volume ----------
const clouds = { list: [] };
{
  const r = mulberry32(4242);
  const variants = [];
  for (let v = 0; v < 4; v++) {
    const parts = [];
    const n = 7 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const rad = (0.55 + r() * 0.5) * (1 - Math.abs(t) * 0.9);
      const g = new T.IcosahedronGeometry(rad, 2);
      g.translate(t * 2.6 + (r() - 0.5) * 0.3, rad * 0.35 + r() * 0.25, (r() - 0.5) * 0.9);
      parts.push({ geo: g, color: '#ffffff', shade: [0.86, 1.0] });
    }
    // bas aplati
    const geo = mergeParts(parts);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) if (P.getY(i) < 0.1) P.setY(i, 0.1 - (0.1 - P.getY(i)) * 0.25);
    geo.computeVertexNormals();
    variants.push(geo);
  }
  clouds.mat = toonMat({ vertexColors: true, color: new T.Color(1, 1, 1), emissive: lin('#7c8aa6'), fog: false });
  for (const geo of variants) {
    const m = new T.InstancedMesh(geo, clouds.mat, 9);
    m.frustumCulled = false;
    m.renderOrder = -7;
    scene.add(m);
    for (let i = 0; i < 9; i++) {
      const s = 34 + r() * 46;
      clouds.list.push({ m, i, x: (r() - 0.5) * 1700, z: (r() - 0.5) * 1700, y: 150 + r() * 110, s, sy: s * (0.55 + r() * 0.35), ry: r() * 6 });
    }
  }
}
const _cd = new T.Object3D();
function updateScenery(k, night, storm, dir) {
  // horizon : la brume du jour, sommets un peu plus bleus et sombres
  skyline.group.position.set(camera.position.x, 0, camera.position.z);
  skyline.uniforms.hazeCol.value.copy(scene.fog.color);
  skyline.uniforms.topCol.value.copy(scene.fog.color).lerp(k.zenith, 0.35).lerp(lin('#8c86b8'), 0.35 * (1 - night)).multiplyScalar(0.9);
  skyline.group.visible = !storm;
  // nuages
  const t = gfxTime.value, mats = new Set();
  for (const c of clouds.list) {
    let x = c.x + t * 2.4, z = c.z + t * 0.9;
    x = ((x - camera.position.x + 850) % 1700 + 1700) % 1700 - 850 + camera.position.x;
    z = ((z - camera.position.z + 850) % 1700 + 1700) % 1700 - 850 + camera.position.z;
    _cd.position.set(x, c.y + camera.position.y * 0.3, z);
    _cd.rotation.set(0, c.ry, 0);
    _cd.scale.set(c.s, c.sy, c.s * 0.8);
    _cd.updateMatrix();
    c.m.setMatrixAt(c.i, _cd.matrix);
    mats.add(c.m);
  }
  for (const m of mats) { m.instanceMatrix.needsUpdate = true; m.visible = !storm; }
  clouds.mat.emissive.copy(k.horizon).lerp(lin('#ffffff'), 0.2).multiplyScalar(0.55 * (1 - night * 0.85));
  // eau
  WATER_U.skyCol.value.copy(k.horizon).lerp(k.zenith, 0.4);
  WATER_U.sunDir.value.copy(dir);
  WATER_U.sunCol.value.copy(k.sun).multiplyScalar(1 - night);
}
