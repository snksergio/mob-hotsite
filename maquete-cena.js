/* =========================================================
   iGreen MOB · a maquete do eletroposto (cena 3D)
   O cenário vem do Blender (_pesquisa/unico/blender/diorama.py) com a luz pré-calculada em textura (sombras macias
   sem custo no navegador), em duas versões de luz: cobertura de 1 vaga (Lento, Ultra) e de 2 vagas (DUO).
   Por cima, montado aqui com o kit iGreen (assets/3d/igreen-kit.js): a cobertura verde com painéis solares e o
   letreiro à direita, as vagas pintadas de verde com o G (uma vaga por conector em uso), o carregador e o preço no
   totem. Os carros seguem os trajetos de maquete-rotas.js (retas e arcos, conferidos contra batidas).
   Duas maquetes com a mesma cena: "quarteirao" (window.MAQUETE) e "posto" (window.MAQUETE_POSTO, só o posto).
   MQCena.init(host, { data, onAnchors }) → { setModel, setStep, setTraffic, setPrice, view, redraw }
   ========================================================= */
(function () {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const backOut = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* qualidade conforme o aparelho: 2 = computador, 1 = celular e tablet, 0 = fraco (GL por software, pouca memória, poucos núcleos).
     "#q=0|1|2" no endereço força um nível (para testar) */
  function quality() {
    const coarse = window.matchMedia("(pointer: coarse)").matches, narrow = window.matchMedia("(max-width: 760px)").matches;
    const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
    let gpu = "";
    try {
      const c = document.createElement("canvas"), gl = c.getContext("webgl");
      const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
      gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      const lose = gl && gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
    } catch (e) { gpu = ""; }
    const soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
    let tier = soft || mem <= 2 || (cores <= 2 && !/apple/i.test(gpu)) ? 0 : coarse || narrow || mem <= 4 ? 1 : 2;
    const forced = (location.hash.match(/q=([012])/) || [])[1];
    if (forced) tier = +forced;
    return { tier, soft, gpu, aa: tier > 0, dprMax: [1, 1.5, 1.6][tier], dprMin: [0.55, 0.65, 0.7][tier], budget: [0.5e6, 1.2e6, 2.6e6][tier], shadows: tier === 2 && !narrow };
  }
  const RAD = Math.PI / 180;
  const EMIT = /^(neon_line|led_green|lamp_light|warm_inside|headlight|taillight)/;

  // câmera por etapa: alvo, distância, giro (graus, a partir da frente) e altura (graus)
  const VIEWS = {
    quarteirao: [
      { tgt: [2.9, 1.0, -1.2], dist: 22, az: 25, el: 20 },   // modelo: o posto de perto (baixo: a bomba aparece sob a cobertura)
      { tgt: [4.2, 0.6, 0.8], dist: 29, az: 30, el: 29 },    // operação: entra a rua e a entrada
      { tgt: [1.8, 2.0, -0.4], dist: 35, az: 26, el: 35 },   // carteira: espaço em cima para as conexões
      { tgt: [0.6, 0.4, 0.2], dist: 43, az: 30, el: 40 }     // resultado: o quarteirão inteiro
    ],
    posto: [
      { tgt: [0.1, 0.9, -2.0], dist: 18.6, az: 32, el: 19.5, fit: 0.97 },
      { tgt: [0.1, 0.7, -1.8], dist: 19.6, az: 32, el: 20.5, fit: 0.97 },
      { tgt: [0.0, 1.5, -2.0], dist: 23, az: 28, el: 30, fit: 0.86 },
      { tgt: [0.1, 0.5, -2.1], dist: 23, az: 32, el: 37, fit: 0.9 }
    ]
  };
  const NODES = {
    quarteirao: { energia: [-7.4, 6.8, 1.0], seguro: [0.6, 8.4, -4.4], telefonia: [7.6, 6.8, -3.0], lane: [7.0, 0.6, 7.6] },
    posto: { energia: [-4.7, 3.7, -2.4], seguro: [-1.0, 4.0, -6.2], telefonia: [4.8, 3.7, -2.8], lane: [2.05, 0.3, 2.6] }
  };

  function b64ToBuf(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  function rrect(T, w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    r = Math.max(0.0005, Math.min(r, w / 2 - 0.0001, h / 2 - 0.0001));
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function rboxGeo(T, w, h, d, r, b) {
    b = Math.min(b, w / 2.2, h / 2.2, d / 2.2);
    const g = new T.ExtrudeGeometry(rrect(T, w - 2 * b, h - 2 * b, Math.max(0.0008, r - b)), { depth: Math.max(0.0005, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 12 });
    g.translate(0, 0, -(d - 2 * b) / 2); g.computeVertexNormals();
    return g;
  }
  function rplane(T, w, h, r) {
    const g = new T.ShapeGeometry(rrect(T, w, h, r), 20), uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return g;
  }
  function canvasTex(T, w, h, draw, srgb) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = srgb === false ? T.NoColorSpace : T.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function boltPath(g, cx, cy, s) { // raio (ícone), centrado, altura ~2s
    g.beginPath(); g.moveTo(cx + 0.18 * s, cy - s); g.lineTo(cx - 0.55 * s, cy + 0.12 * s); g.lineTo(cx - 0.02 * s, cy + 0.12 * s);
    g.lineTo(cx - 0.2 * s, cy + s); g.lineTo(cx + 0.55 * s, cy - 0.16 * s); g.lineTo(cx + 0.04 * s, cy - 0.16 * s); g.closePath();
  }

  async function init(host, opts) {
    opts = opts || {};
    const T = window.THREE, D = opts.data || window.MAQUETE;
    if (!T || !T.GLTFLoader || !D || !window.IGKit || !window.MQRotas) throw new Error("3D indisponível");
    const Lay = D.meta.layout, quart = Lay.scene !== "posto", FL = Lay.floor, CAN = Lay.canopy, XC = Lay.xc;
    const rot = window.MQRotas.make(Lay);
    const views = VIEWS[quart ? "quarteirao" : "posto"], nodes = NODES[quart ? "quarteirao" : "posto"];
    const canvas = document.createElement("canvas");
    canvas.className = "cena__canvas";
    host.appendChild(canvas);
    const QL = quality();
    const renderer = new T.WebGLRenderer({ canvas, antialias: QL.aa, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true;
    const mobile = !QL.shadows; // sem sombras em tempo real (celular, tablet e aparelho fraco)
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    pm.dispose();
    const cam = new T.PerspectiveCamera(30, 1, 0.2, 400);

    /* luz para o que se mexe (o cenário já vem com a luz pronta): o mesmo sol do Blender */
    scene.add(new T.HemisphereLight(0xe4edf2, 0x6d746f, 1.15));
    const sun = new T.DirectionalLight(0xfff4e6, 2.4);
    sun.position.copy(new T.Vector3(-0.401, 0.637, 0.659).normalize()).multiplyScalar(40);
    sun.castShadow = !mobile;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, quart ? { left: -16, right: 16, top: 13, bottom: -13 } : { left: -11, right: 11, top: 9, bottom: -9 }, { near: 1, far: 90 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);

    /* ---------- cenário do Blender ---------- */
    const gltf = await new Promise((res, rej) => new T.GLTFLoader().parse(b64ToBuf(D.glb), "", res, rej));
    const [imA, imB] = await Promise.all([loadImg(D.luzA), loadImg(D.luzB)]);
    const lmTex = (im) => { const t = new T.Texture(im); t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t; };
    const LMA = lmTex(imA), LMB = lmTex(imB);
    const SA = D.meta.scaleA * Math.PI, SB = D.meta.scaleB * Math.PI;
    const uMix = { value: 1 }; // 0 = luz com a cobertura de 1 vaga, 1 = com a de 2 vagas
    const root = gltf.scene;
    scene.add(root);
    const baked = new Map();
    function bakedMat(src) {
      if (baked.has(src)) return baked.get(src);
      let m;
      if (EMIT.test(src.name) || (src.emissive && src.emissive.getHex() > 0)) {
        const c = (src.emissive && src.emissive.getHex() > 0 ? src.emissive.clone() : src.color.clone()).multiplyScalar(Math.min(1.6, src.emissiveIntensity || 1));
        m = new T.MeshBasicMaterial({ color: c, toneMapped: false });
      } else {
        m = new T.MeshBasicMaterial({ color: D.meta.albedo ? new T.Color(0xffffff) : src.color.clone(), lightMap: LMA, lightMapIntensity: 1 });
        m.onBeforeCompile = (sh) => {
          sh.uniforms.lightMapB = { value: LMB }; sh.uniforms.uMix = uMix; sh.uniforms.uSA = { value: SA }; sh.uniforms.uSB = { value: SB };
          sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform sampler2D lightMapB; uniform float uMix; uniform float uSA; uniform float uSB;")
            .replace("vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );", "vec4 lightMapTexel = vec4( mix( texture2D( lightMap, vLightMapUv ).rgb * uSA, texture2D( lightMapB, vLightMapUv ).rgb * uSB, uMix ), 1.0 );");
        };
      }
      m.name = src.name;
      baked.set(src, m);
      return m;
    }
    const world = root.getObjectByName("static_world");
    world.traverse((o) => { if (o.isMesh) { o.material = bakedMat(o.material); o.matrixAutoUpdate = false; o.updateMatrix(); } });
    // ilhas entre as vagas (1 vaga ou 2 vagas), cada conjunto com a sua luz; sobem do piso quando o modelo pede
    const islands = {};
    for (const k of ["1", "2"]) {
      const ob = root.getObjectByName("islands_" + k), src = D["luzI" + k];
      if (!ob || !src) continue;
      const tex = lmTex(await loadImg(src)), S = D.meta["scaleI" + k] * Math.PI, mats = new Map();
      ob.traverse((o) => {
        if (!o.isMesh) return;
        const s0 = o.material;
        if (!mats.has(s0)) mats.set(s0, EMIT.test(s0.name) ? bakedMat(s0) : new T.MeshBasicMaterial({ color: D.meta.albedo ? 0xffffff : s0.color.clone(), lightMap: tex, lightMapIntensity: S }));
        o.material = mats.get(s0);
      });
      const pivot = new T.Group(); pivot.position.y = FL; scene.add(pivot); pivot.attach(ob);
      pivot.visible = false; islands[k] = pivot;
    }

    const kit = await window.IGKit.build(T, { logoSvg: window.IG_LOGO_SVG, font: '"Instrument Sans", Arial, sans-serif' });
    const KM = kit.M;
    // reflexo de estúdio (fundo escuro com softboxes) para o carregador e os carros: a "sala clara" do resto da cena desbotava o verde
    const studioEnv = window.IGKit.studioEnv ? window.IGKit.studioEnv(T, renderer) : null;
    if (studioEnv) Object.values(KM).forEach((m) => { if (m && m.isMeshStandardMaterial) { m.envMap = studioEnv; m.needsUpdate = true; } });
    KM.paint.color.setHex(0x0da23f); KM.paint.emissive.setHex(0x0b6a2a); KM.paint.emissiveIntensity = 0.32; KM.base.color.setHex(0x0b6e2c);
    KM.ceiling.emissiveIntensity = 0.42; KM.ledCool.emissiveIntensity = 3.2; KM.ledGreen.emissiveIntensity = 3.2;
    KM.signBox.color.setHex(0x0a2a17);

    /* ---------- a cobertura verde (largura conforme o número de vagas) ---------- */
    const roofFade = []; // o que fica "de vidro" quando a cobertura tapa o carregador
    const fadeMat = (m, base, min) => { const c = m.clone(); c.userData.base = base == null ? (c.opacity == null ? 1 : c.opacity) : base; c.userData.min = min == null ? 0.14 : min; roofFade.push(c); return c; };
    const can = new T.Group(); can.position.set(XC, FL, CAN.z); scene.add(can);
    const RH = 0.3, DD = CAN.d;
    const postGeo = new T.BoxGeometry(0.24, 1, 0.24); postGeo.translate(0, 0.5, 0);
    const posts = [-1, 1].map((s) => { const m = new T.Mesh(postGeo, KM.kiosk); m.scale.y = CAN.h; m.position.z = -CAN.postZ; m.userData.s = s; m.castShadow = true; can.add(m); return m; });
    const feet = [-1, 1].map((s) => { const m = new T.Mesh(new T.BoxGeometry(0.46, 0.05, 0.46), KM.base); m.position.set(0, 0.025, -CAN.postZ); m.userData.s = s; can.add(m); return m; });
    const roof = new T.Group(); roof.position.y = CAN.h; can.add(roof);
    const beamF = new T.Mesh(new T.BoxGeometry(1, RH, 0.16), KM.kiosk); beamF.position.set(0, RH / 2, DD / 2 - 0.08);
    const beamB = beamF.clone(); beamB.position.z = -DD / 2 + 0.08;
    const beamS = [-1, 1].map((s) => { const m = new T.Mesh(new T.BoxGeometry(0.16, RH + 0.12, DD), KM.kiosk); m.position.y = RH / 2 - 0.06; m.userData.s = s; return m; });
    roof.add(beamF, beamB, ...beamS);
    // no modo "de vidro" o tampo e o forro somem (um véu claro por cima deixava os carros desbotados); ficam o quadro e os painéis
    const deck = new T.Mesh(new T.BoxGeometry(1, 0.05, DD - 0.2), fadeMat(KM.deck, 1, 0)); deck.position.y = RH - 0.025; roof.add(deck);
    const ceil = new T.Mesh(new T.PlaneGeometry(1, DD - 0.3), fadeMat(KM.ceiling, 1, 0)); ceil.rotation.x = Math.PI / 2; ceil.position.y = 0.12; roof.add(ceil);
    const crossMat = fadeMat(KM.kiosk, 1, 0.35);
    const crossX = [-1.0, 1.0].map((z) => { const m = new T.Mesh(new T.BoxGeometry(1, 0.12, 0.09), crossMat); m.position.set(0, 0.07, z); roof.add(m); return m; });
    const tubes = new T.InstancedMesh(new T.CapsuleGeometry(0.022, 1.25, 4, 10), fadeMat(KM.ledCool, 1, 0), 12); roof.add(tubes);
    const tubeGlow = new T.InstancedMesh(new T.PlaneGeometry(1.9, 0.6), fadeMat(new T.MeshBasicMaterial({ map: kit.tex.strip, color: 0xd9ffe4, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), 0.3, 0), 12);
    roof.add(tubeGlow);
    const edgeF = new T.Mesh(new T.BoxGeometry(1, 0.025, 0.025), KM.ledGreen); edgeF.position.set(0, 0.0, DD / 2 - 0.17);
    const edgeB = edgeF.clone(); edgeB.position.z = -DD / 2 + 0.17;
    const edgeS = [-1, 1].map((s) => { const m = new T.Mesh(new T.BoxGeometry(0.025, 0.025, DD - 0.34), KM.ledGreen); m.userData.s = s; return m; });
    roof.add(edgeF, edgeB, ...edgeS);
    // painéis solares no teto (o "tchan" da cobertura)
    const cellTex = canvasTex(T, 256, 410, (g, w, h) => {
      g.fillStyle = "#0e1a2b"; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "rgba(120,160,220,.18)"); gr.addColorStop(0.5, "rgba(20,40,80,0)"); gr.addColorStop(1, "rgba(120,170,230,.14)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(160,190,230,.35)"; g.lineWidth = 2;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((i * w) / 6, 0); g.lineTo((i * w) / 6, h); g.stroke(); }
      for (let j = 1; j < 10; j++) { g.beginPath(); g.moveTo(0, (j * h) / 10); g.lineTo(w, (j * h) / 10); g.stroke(); }
      g.strokeStyle = "#c9d2d8"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    });
    const panelTop = fadeMat(new T.MeshStandardMaterial({ map: cellTex, roughness: 0.22, metalness: 0.5, envMapIntensity: 1.4 }), 1, 0.3);
    const panelSide = fadeMat(new T.MeshStandardMaterial({ color: 0xb9c2c6, roughness: 0.4, metalness: 0.7 }), 1, 0.3);
    const panels = new T.InstancedMesh(new T.BoxGeometry(1.0, 0.04, 1.58), [panelSide, panelSide, panelTop, panelSide, panelSide, panelSide], 30);
    roof.add(panels);
    // letreiro iGreen: cápsula escura com a palavra acesa, no canto da frente à DIREITA
    const signG = new T.Group();
    const sBox = new T.Mesh(rboxGeo(T, 2.3, 0.64, 0.28, 0.32, 0.05), KM.signBox); signG.add(sBox);
    kit.tex.sign.colorSpace = T.SRGBColorSpace;
    const sFace = new T.Mesh(rplane(T, 2.18, 0.53, 0.265), new T.MeshBasicMaterial({ map: kit.tex.sign, toneMapped: false }));
    sFace.position.z = 0.142; signG.add(sFace);
    const sBack = sFace.clone(); sBack.rotation.y = Math.PI; sBack.position.z = -0.142; signG.add(sBack);
    signG.position.set(0, RH + 0.3, DD / 2 - 0.08);
    roof.add(signG);
    can.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    posts.forEach((p) => { p.castShadow = false; });
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), ONE = new T.Vector3(1, 1, 1), V3 = new T.Vector3();
    const qTube = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2)), qGlow = new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)), qPanel = new T.Quaternion().setFromEuler(new T.Euler(0.1, 0, 0));
    let canW = -1;
    function layoutCanopy(w) {
      if (Math.abs(w - canW) < 0.0005) return;
      canW = w;
      posts.forEach((p) => { p.position.x = p.userData.s * (w / 2 - CAN.postIn); });
      feet.forEach((p) => { p.position.x = p.userData.s * (w / 2 - CAN.postIn); });
      beamF.scale.x = beamB.scale.x = w;
      beamS.forEach((m) => { m.position.x = m.userData.s * (w / 2 - 0.08); });
      deck.scale.x = w - 0.2; ceil.scale.x = w - 0.3; crossX.forEach((m) => { m.scale.x = w - 0.3; });
      edgeF.scale.x = edgeB.scale.x = w - 0.34; edgeS.forEach((m) => { m.position.x = m.userData.s * (w / 2 - 0.17); });
      const nc = Math.max(2, Math.round((w - 0.4) / 2.4)); let k = 0;
      for (let i = 0; i < nc; i++) for (const z of [-1.8, 0, 1.8]) {
        const x = (i - (nc - 1) / 2) * ((w - 0.6) / nc);
        tubes.setMatrixAt(k, M4.compose(V3.set(x, 0.1, z), qTube, ONE));
        tubeGlow.setMatrixAt(k, M4.compose(V3.set(x, 0.07, z), qGlow, ONE)); k++;
      }
      tubes.count = tubeGlow.count = k; tubes.instanceMatrix.needsUpdate = tubeGlow.instanceMatrix.needsUpdate = true;
      const pc = Math.floor((w - 0.3) / 1.06); let q = 0;
      for (let i = 0; i < pc; i++) for (const z of [-1.86, -0.14, 1.58]) panels.setMatrixAt(q++, M4.compose(V3.set((i - (pc - 1) / 2) * 1.06, RH + 0.12, z), qPanel, ONE));
      panels.count = q; panels.instanceMatrix.needsUpdate = true;
      signG.position.x = w / 2 - 1.22;
    }
    const ROOF_Y = CAN.h;
    function setCanopy(k) {
      can.visible = k > 0.001;
      posts.forEach((p, i) => { const e = smooth(0.02 + i * 0.06, 0.34, k); p.scale.y = Math.max(0.001, e * CAN.h); p.visible = e > 0.002; });
      feet.forEach((p) => { p.visible = k > 0.02; });
      const r = smooth(0.26, 0.62, k);
      roof.visible = r > 0.001; roof.position.y = ROOF_Y + (1 - r) * 2.8;
      const s = clamp01((k - 0.7) / 0.24);
      signG.scale.setScalar(Math.max(0.001, backOut(s))); signG.visible = s > 0.001;
      uMix.value = smooth(0.3, 0.75, k); // a luz com a sombra da cobertura (e as vagas/ilhas de 2 lugares) acompanham
    }
    let roofA = 1, roofT = 1;
    function setRoofAlpha(a) {
      roofFade.forEach((m) => { const o = m.userData.base * (m.userData.min + (1 - m.userData.min) * a); m.opacity = o; m.visible = o > 0.005; const tr = a < 0.999 || m.userData.base < 1; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.depthWrite = a > 0.999 && m.userData.base >= 1; });
    }

    /* ---------- vagas pintadas: verde iGreen com o G (multiplicam o piso, que já tem a luz e as sombras) ---------- */
    const bayCenterZ = (Lay.zHead + Lay.zOpen) / 2, BD = Lay.zOpen - Lay.zHead;
    const DW = 2 * (Lay.duoOff + Lay.bayW / 2) + 0.4, DDp = BD + 0.3, PXM = 120;
    const gImg = kit.tex.gPaint.image;
    const bayTex = (xs) => canvasTex(T, Math.round(DW * PXM), Math.round(DDp * PXM), (g, w, h) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
      const X = (x) => (x + DW / 2) * PXM, Z = (z) => (z - bayCenterZ + DDp / 2) * PXM;
      xs.forEach((bx) => {
        g.fillStyle = "#17b455";
        g.fillRect(X(bx - Lay.bayW / 2 + 0.06), Z(Lay.zHead + 0.07), (Lay.bayW - 0.12) * PXM, (BD - 0.07) * PXM);
        const gw = 1.15, gh = 1.53, gz = bayCenterZ + 0.95;
        if (gImg) g.drawImage(gImg, X(bx - gw / 2), Z(gz - gh / 2), gw * PXM, gh * PXM);
      });
    }, false);
    const texOne = bayTex([0]), texDuo = bayTex([-Lay.duoOff, Lay.duoOff]);
    const bayMat = new T.ShaderMaterial({
      uniforms: { tA: { value: texOne }, tB: { value: texDuo }, uMix: uMix, uK: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uK; varying vec2 vUv; void main(){ vec3 c = mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, uMix); gl_FragColor = vec4(mix(vec3(1.0), c, uK), 1.0); }",
      transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.DstColorFactor, blendDst: T.ZeroFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const bays = new T.Mesh(new T.PlaneGeometry(DW, DDp), bayMat);
    bays.rotation.x = -Math.PI / 2; bays.position.set(XC, FL + 0.002, bayCenterZ); bays.renderOrder = 1;
    scene.add(bays);

    /* ---------- o carregador (kit) nos três tamanhos ---------- */
    const shadowTex = canvasTex(T, 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.55, "rgba(0,0,0,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const blobMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
    const blob = (w, d, mat) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat || blobMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 2; return m; };
    const postMat = new T.MeshStandardMaterial({ color: 0x2a312e, roughness: 0.4, metalness: 0.5 });
    const PLUG = { L: kit.anchors.plugL.clone(), R: kit.anchors.plugR.clone() };
    function chargerVariant(key) {
      const g = new T.Group(), c = kit.charger.clone(true);
      c.traverse((o) => { if (o.isMesh && o.material === KM.contact) o.visible = false; });
      let s = 1, y0 = 0;
      if (key === "lento") {
        const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.7, 20), postMat); post.position.y = 0.35; g.add(post);
        const foot = new T.Mesh(new T.CylinderGeometry(0.2, 0.22, 0.05, 24), postMat); foot.position.y = 0.025; g.add(foot);
        s = 0.56; y0 = 0.62;
      } else if (key === "ultra") s = 1.24;
      c.scale.setScalar(s); c.position.y = y0; g.add(c);
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      const CB = Lay.curb || 0;
      g.position.set(XC, FL + CB, Lay.zCharger);
      g.userData = { h: CB + y0 + 1.66 * s, plug: (side) => PLUG[side].clone().multiplyScalar(s).add(new T.Vector3(XC, FL + CB + y0, Lay.zCharger)) };
      g.visible = false; scene.add(g);
      return g;
    }
    const chargers = { lento: chargerVariant("lento"), duo: chargerVariant("duo"), ultra: chargerVariant("ultra") };

    /* ---------- totem de preço ---------- */
    const [TX, TZ] = Lay.totem;
    const totemCv = document.createElement("canvas"); totemCv.width = 360; totemCv.height = 1280;
    const totemTex = new T.CanvasTexture(totemCv); totemTex.colorSpace = T.SRGBColorSpace; totemTex.anisotropy = 8;
    const wordWhite = (() => { const im = kit.tex.word.image, c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height); return c; })();
    let price = 2.2;
    function drawTotem() {
      const g = totemCv.getContext("2d"), w = totemCv.width, h = totemCv.height, F = (wg, px) => wg + " " + px + 'px "Instrument Sans", Arial, sans-serif';
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#07120c"); bg.addColorStop(1, "#020604");
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(61,255,106,.85)"; g.lineWidth = 6; roundRect(g, 14, 14, w - 28, h - 28, 26); g.stroke();
      const lw = w * 0.66, lh = lw / 3.595; g.drawImage(wordWhite, (w - lw) / 2, 92, lw, lh);
      g.fillStyle = "#13a24b"; g.beginPath(); g.arc(w / 2, 400, 82, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; boltPath(g, w / 2, 400, 52); g.fill();
      g.textAlign = "center"; g.fillStyle = "#ffffff"; g.font = F(600, 46); g.fillText("RECARGA", w / 2, 560);
      g.fillStyle = "#a9c9b2"; g.font = F(400, 30); g.fillText("carro elétrico", w / 2, 602);
      g.fillStyle = "rgba(0,0,0,.6)"; roundRect(g, 34, 680, w - 68, 380, 22); g.fill();
      g.strokeStyle = "rgba(61,255,106,.35)"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#7fe395"; g.font = F(500, 44); g.textAlign = "left"; g.fillText("R$", 62, 752);
      g.fillStyle = "#ffffff"; g.font = F(600, 150); g.textAlign = "center";
      g.fillText(price.toFixed(2).replace(".", ","), w / 2, 920);
      g.fillStyle = "#7fe395"; g.font = F(500, 46); g.fillText("por kWh", w / 2, 1010);
      g.fillStyle = "#86a38f"; g.font = F(500, 30); g.fillText("iGreen MOB", w / 2, 1180);
      totemTex.needsUpdate = true;
    }
    drawTotem();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawTotem(); kick(); });
    const totemFace = new T.Mesh(rplane(T, 0.78, 2.66, 0.08), new T.MeshBasicMaterial({ map: totemTex, toneMapped: false, color: 0xf2f2f2 }));
    totemFace.position.set(TX, FL + 0.14 + 1.5, TZ + 0.173);
    scene.add(totemFace);

    /* ---------- sombras dos que se mexem ---------- */
    let catcher = null;
    if (!mobile) {
      catcher = new T.Mesh(new T.PlaneGeometry(quart ? 30 : 19, quart ? 22 : 12), new T.ShadowMaterial({ opacity: 0.22 }));
      catcher.rotation.x = -Math.PI / 2; catcher.position.set(quart ? 0 : 0.4, FL + 0.006, quart ? 1 : -1.1); catcher.receiveShadow = true; catcher.renderOrder = 2; scene.add(catcher);
    }

    /* ---------- carros ---------- */
    // no quarteirão os carros são cortados na borda da maquete (somem ao sair, sem andar no vazio)
    const clipPl = null;
    // ao surgir e sumir o carro fica "de vidro" inteiro: antes grava a profundidade dele (sem cor) e depois pinta só a superfície
    // da frente; assim não aparecem as peças de dentro nem o interior oco
    const depthMat = new T.MeshBasicMaterial({ colorWrite: false, transparent: true });
    const tpls = root.children.filter((o) => /^car_/.test(o.name));
    tpls.forEach((t) => root.remove(t));
    const clientT = tpls.filter((t) => /_g\d$/.test(t.name)), passT = tpls.filter((t) => !/_g\d$/.test(t.name));
    // reflexo dos carros: estúdio escuro com softboxes (a "sala clara" do resto da cena desbotava o verde)
    const carEnv = studioEnv;
    function makeCar(tpl) {
      const g = tpl.clone(true), mats = [];
      g.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        const m = o.material.clone();
        if (m.isMeshStandardMaterial) { if (carEnv) m.envMap = carEnv; m.envMapIntensity = /glass/.test(m.name) ? 1.4 : 1.0; }
        // pintura: verde mais fundo (o verniz refletia o céu e deixava o carro claro demais)
        const PAINT = { car_paint_g1: 0x0a6b35, car_paint_g2: 0x064a26, car_paint_g3: 0x0b7f3d };
        if (PAINT[m.name]) { m.color.setHex(PAINT[m.name]); m.metalness = 0.25; m.roughness = 0.34; if (m.clearcoat != null) { m.clearcoat = 1; m.clearcoatRoughness = 0.08; } }
        if (/headlight|taillight/.test(m.name)) { m.toneMapped = false; m.emissiveIntensity = 1.4; }
        m.transparent = true; m.depthWrite = true; if (clipPl) m.clippingPlanes = clipPl;
        o.material = m; mats.push(m);
      });
      const meshes = [], depths = [];
      g.traverse((o) => { if (o.isMesh) meshes.push(o); });
      meshes.forEach((o) => { o.renderOrder = 4; const d = new T.Mesh(o.geometry, depthMat); d.renderOrder = 3; d.visible = false; o.add(d); depths.push(d); });
      const bm = blobMat.clone(); if (clipPl) bm.clippingPlanes = clipPl; mats.push(bm); bm.userData.blob = true;
      g.add(blob(5.0, 2.5, bm));
      g.visible = false; scene.add(g);
      return { m: g, mats, meshes, depths, alpha: -1 };
    }
    let tplI = 0;
    const pool = Array.from({ length: 7 }, () => makeCar(clientT[tplI++ % clientT.length]));
    const passers = passT.map(makeCar);
    function setAlpha(c, a) {
      a = Math.round(a * 100) / 100;
      if (a === c.alpha) return;
      c.alpha = a;
      c.mats.forEach((m) => { m.opacity = a; });
      const ghost = a < 0.995;
      c.depths.forEach((d) => { d.visible = ghost; });
      c.meshes.forEach((o) => { o.castShadow = a > 0.55; });
      c.m.visible = a > 0.01;
    }

    /* ---------- carga: cabo do carregador até o carro e o raio aceso em cima ---------- */
    const cableMat = new T.MeshStandardMaterial({ color: 0x0c0d0d, roughness: 0.45 });
    if (!document.getElementById("mq-badge-css")) {
      const st = document.createElement("style"); st.id = "mq-badge-css";
      st.textContent = '@property --mqp{syntax:"<number>";inherits:true;initial-value:0}@property --mqi{syntax:"<integer>";inherits:true;initial-value:0}' +
        ".mq-badge{position:absolute;left:0;top:0;z-index:2;width:46px;height:46px;margin:-23px 0 0 -23px;pointer-events:none;transform:translate(var(--x,-999px),var(--y,-999px)) scale(.4);opacity:0;transition:opacity .35s,transform .45s cubic-bezier(.34,1.56,.64,1)}" +
        ".mq-badge.is-on{opacity:1;transform:translate(var(--x,-999px),var(--y,-999px)) scale(1)}" +
        ".mq-badge.is-run{animation:mqFill var(--t,10s) linear var(--d,0s) forwards}" +
        ".mq-badge__ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(#3dff6a calc(var(--mqp)*1%),rgba(61,255,106,.16) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3.5px));filter:drop-shadow(0 0 5px rgba(61,255,106,.55))}" +
        ".mq-badge__core{position:absolute;inset:6px;border-radius:50%;background:rgba(61,255,106,.07);box-shadow:inset 0 0 0 1px rgba(61,255,106,.16);display:grid;place-items:center}" +
        ".mq-badge__core svg{width:17px;height:17px;fill:#3dff6a;filter:drop-shadow(0 0 4px rgba(61,255,106,.85));animation:mqPulse 1.5s ease-in-out infinite}" +
        ".mq-badge__pct{position:absolute;left:50%;top:100%;margin-top:4px;transform:translateX(-50%);padding:3px 7px;border-radius:999px;background:rgba(4,16,9,.32);box-shadow:inset 0 0 0 1px rgba(61,255,106,.22);text-shadow:0 1px 3px rgba(0,0,0,.85);font:600 10.5px/1 \"Instrument Sans\",system-ui,sans-serif;letter-spacing:.02em;color:#e3ffe9;white-space:nowrap;counter-reset:mqp var(--mqi)}" +
        ".mq-badge__pct::before{content:counter(mqp) \"%\"}" +
        "@keyframes mqFill{from{--mqp:0;--mqi:0}to{--mqp:100;--mqi:100}}" +
        "@keyframes mqPulse{0%,100%{opacity:.7;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}" +
        "@media (prefers-reduced-motion:reduce){.mq-badge__core svg{animation:none}}";
      document.head.appendChild(st);
    }
    // carga: começa entre 15% e 45% e vai até 100%; quando completa o carro sai e entra outro
    function badgeOn(c) {
      const el = document.createElement("div");
      el.className = "mq-badge";
      el.innerHTML = '<span class="mq-badge__ring"></span><span class="mq-badge__core"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.5 5.5 13.4h5.3l-1.2 8.1 7.9-11h-5.4z"/></svg></span><span class="mq-badge__pct"></span>';
      host.appendChild(el);
      const p0 = c.p0, T_ = c.chargeT;
      const full = T_ / (1 - p0 / 100);
      el.style.setProperty("--t", full.toFixed(2) + "s"); el.style.setProperty("--d", (-full * p0 / 100).toFixed(2) + "s");
      if (reduced) { el.style.setProperty("--mqp", p0.toFixed(0)); el.style.setProperty("--mqi", p0.toFixed(0)); } else el.classList.add("is-run");
      c.badge = el;
      requestAnimationFrame(() => el.classList.add("is-on"));
      kick();
    }
    function badgeOff(c) { const el = c.badge; if (!el) return; c.badge = null; el.classList.remove("is-on"); setTimeout(() => el.remove(), 500); }
    const BADGE_UP = new T.Vector3(0, 2.25, 0), tmpV = new T.Vector3();
    function connectFx(c) {
      const car = c.m, side = c.portSide; // "L" = porta do lado esquerdo do carro (para o carregador à esquerda)
      const local = new T.Vector3(1.75, 0.82, side === "C" ? -0.86 : side === "L" ? -0.88 : 0.88);
      const port = car.localToWorld(local.clone());
      const plug = chargers[state.model].userData.plug(c.plugSide);
      const mid = plug.clone().lerp(port, 0.5); mid.y = FL + 0.12;
      const curve = new T.CatmullRomCurve3([plug, plug.clone().add(new T.Vector3(0, -0.35, 0.12)), mid, port.clone().add(new T.Vector3(0, -0.3, 0)), port]);
      const cable = new T.Mesh(new T.TubeGeometry(curve, 60, 0.024, 8, false), cableMat);
      cable.geometry.setDrawRange(0, 0); cable.castShadow = !mobile; scene.add(cable);
      c.fx = { cable, k: 0, to: 1, n: cable.geometry.index.count };
      kick();
    }
    function disconnectFx(c, then) {
      badgeOff(c);
      if (!c.fx) { if (then) then(); return; }
      c.fx.to = 0; c.fx.then = then; kick();
    }
    function dropFx(c) { badgeOff(c); clearTimeout(c.chargeTimer); if (!c.fx) return; scene.remove(c.fx.cable); c.fx.cable.geometry.dispose(); c.fx = null; }

    /* ---------- trânsito: chegar, carregar, sair (uma manobra por vez no corredor) ---------- */
    const state = { model: "duo", step: 0, util: 0.24, cars: 7, traffic: false };
    const spots = { b: [null, null], w: Lay.wait.map(() => null) };
    const cars = [];
    let lock = false, lockQ = [], gen = 0;
    const acquire = (fn) => { const g0 = gen; const go = () => { if (g0 !== gen) return release(); fn(); }; if (!lock) { lock = true; go(); } else lockQ.push(go); };
    function release() { const n = lockQ.shift(); if (n) n(); else lock = false; }
    const bayX = (i) => rot.bays(state.model)[i];
    const nBays = () => rot.bays(state.model).length;
    function run(c, legs, done) {
      c.legs = legs; c.li = 0; c.t = 0; c.done = done || null;
      if (reduced) { const L = legs[legs.length - 1]; const p = window.MQRotas.sample(L, L.len, {}); place(c, p); c.legs = null; if (done) done(); }
      kick();
    }
    const P = {};
    function place(c, p) {
      const y = quart ? FL - 0.035 * smooth(3.9, 4.4, p.z) : FL;
      c.m.position.set(p.x, y, p.z); c.m.rotation.y = p.a; c.placed = true;
      setAlpha(c, rot.alpha(p.x, p.z) * c.fade);
    }
    function newCar(isPass) {
      const src = isPass ? passers : pool;
      const c0 = src.find((x) => !cars.some((c) => c.car === x) && !x.m.visible);
      if (!c0) return null;
      const c = { car: c0, m: c0.m, mats: c0.mats, meshes: c0.meshes, depths: c0.depths, fade: 1, state: "arriving", legs: null };
      Object.defineProperty(c, "alpha", { get: () => c0.alpha, set: (v) => { c0.alpha = v; } });
      cars.push(c);
      return c;
    }
    function remove(c) { dropFx(c); setAlpha(c, 0); c.m.visible = false; c.state = "gone"; const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1); }
    function portFor(i) {
      if (nBays() === 1) return { portSide: "L", plugSide: "L" };
      return i === 0 ? { portSide: "R", plugSide: "L" } : { portSide: "L", plugSide: "R" };
    }
    function startCharge(c, i) {
      Object.assign(c, portFor(i)); c.state = "charging"; connectFx(c);
      c.p0 = 15 + Math.random() * 30; c.chargeT = Math.max(5, (13 - 7 * clamp01(state.util)) * (0.85 + Math.random() * 0.3));
      setTimeout(() => { if (c.state === "charging") badgeOn(c); }, 650); // o selo aparece quando o cabo conecta
      // quando a carga completa, o carro libera a vaga
      c.chargeTimer = setTimeout(() => { if (c.state === "charging" && state.traffic) leaveBay(c); }, 650 + c.chargeT * 1000 + 60);
    }
    function spawnTo(kind, i) {
      if (!state.traffic) return;
      const c = newCar(false); if (!c) return;
      spots[kind][i] = c; c.spot = [kind, i];
      acquire(() => {
        if (dead(c)) return release();
        const x = kind === "b" ? bayX(i) : Lay.wait[i];
        if (x == null) { remove(c); spots[kind][i] = null; return release(); }
        c.holds = true;
        run(c, rot.arrive(x), () => { c.holds = false; release(); if (kind === "b") startCharge(c, i); else { c.state = "waiting"; sync(); } });
      });
    }
    const dead = (c) => c.state === "gone" || c.state === "vanish";
    function leaveBay(c) {
      const i = c.spot[1];
      c.state = "leaving";
      // pega a vez no corredor antes de soltar a vaga: o próximo carro só entra depois que este sair
      acquire(() => {
        if (dead(c)) return release();
        c.holds = true;
        spots.b[i] = null;
        disconnectFx(c, () => {
          if (dead(c)) return;
          // solta o corredor assim que o carro passa de todas as vagas (quem vem atrás já pode manobrar)
          c.clearX = Math.min(XC - Lay.duoOff, XC) - 3.2;
          run(c, rot.leave(c.m.position.x), () => { if (c.holds) { c.holds = false; release(); } remove(c); });
        });
        sync();
      });
    }
    function promote(c, i) {
      const j = c.spot[1];
      c.state = "moving"; spots.w[j] = null; spots.b[i] = c; c.spot = ["b", i];
      acquire(() => {
        if (dead(c)) return release();
        const xb = bayX(i);
        if (xb == null) { remove(c); spots.b[i] = null; return release(); }
        c.holds = true;
        run(c, rot.promote(Lay.wait[j], xb), () => { c.holds = false; release(); startCharge(c, i); sync(); });
      });
    }
    function desired() {
      if (!state.traffic || state.cars <= 0) return { bays: 0, queue: 0 };
      const nb = nBays();
      const b = Math.min(nb, Math.max(1, Math.ceil(state.util * nb * 1.7)));
      return { bays: b, queue: b >= nb && state.util > 0.72 ? Math.min(Lay.wait.length, 1) : 0 };
    }
    function sync() {
      const d = desired(), nb = nBays();
      for (let i = 0; i < 2; i++) {
        const want = i < d.bays && i < nb, c = spots.b[i];
        if (want && !c) {
          const w = spots.w.find((x) => x && x.state === "waiting");
          if (w) promote(w, i); else spawnTo("b", i);
        } else if (!want && c && c.state === "charging") leaveBay(c);
      }
      spots.w.forEach((c, j) => { if (j < d.queue && !c && spots.b.slice(0, nb).every((x) => x)) spawnTo("w", j); });
    }
    function swap() {
      const busy = spots.b.filter((c) => c && c.state === "charging" && !c.legs);
      if (!busy.length) return;
      leaveBay(busy[Math.floor(Math.random() * busy.length)]);
    }
    // some com todos (troca de modelo ou tráfego desligado): os carros se desfazem no lugar
    function vanishAll() {
      gen++; lock = false; lockQ = [];
      // quem ainda nem entrou em cena (esperando a vez no corredor) sai direto; os outros se desfazem no lugar
      cars.slice().forEach((c) => { if (!c.placed) { remove(c); return; } c.state = "vanish"; c.legs = null; c.vanish = 1; });
      spots.b = [null, null]; spots.w = Lay.wait.map(() => null);
      kick();
    }
    // carro de passagem na rua (só no quarteirão)
    let passing = null;
    function passBy() {
      if (!quart || passing || !visible || !passers.length) return;
      // não cruza com quem está entrando pela rua
      if (cars.some((c) => c.legs && c.state === "arriving")) return;
      const c = newCar(true); if (!c) return;
      passing = c; c.state = "pass";
      run(c, rot.passer(), () => { remove(c); passing = null; });
    }
    setInterval(() => { if (!reduced && Math.random() < 0.5) passBy(); }, 9000);

    /* ---------- câmera: vista por etapa + arrastar gira para os lados e para cima/baixo ---------- */
    const cur = { tgt: new T.Vector3(...views[0].tgt), dist: views[0].dist, az: views[0].az, el: views[0].el, ox: 0, oy: 0 };
    const goal = { tgt: cur.tgt.clone(), dist: cur.dist, az: cur.az, el: cur.el, ox: 0, oy: 0 };
    // enquadramento automático ("só o posto"): a base inteira cabe no espaço livre do palco, centrada entre
    // o título (em cima) e os botões (embaixo), em qualquer tamanho de tela
    const FIT = quart ? null : new T.Box3(new T.Vector3(-5.8, -0.62, -6.9), new T.Vector3(5.8, 4.0, (Lay.front || 2.5) + 0.1));
    const insets = Object.assign({ top: 0, bottom: 0 }, opts.insets || {});
    const fitCam = new T.PerspectiveCamera(30, 1, 0.2, 400), fitPts = [], fitV = new T.Vector3();
    // pontos que desenham a silhueta: cantos da base (em cima e embaixo), teto da cobertura, topo do totem e das árvores
    if (FIT) {
      const F = Lay.front || 2.5;
      [[-5.6, 0.08], [5.6, 0.08], [-5.6, -0.62], [5.6, -0.62]].forEach(([x, y]) => [-6.75, F].forEach((z) => fitPts.push(new T.Vector3(x, y, z))));
      [[-CAN.w2 / 2, CAN.z - CAN.d / 2], [CAN.w2 / 2, CAN.z - CAN.d / 2], [-CAN.w2 / 2, CAN.z + CAN.d / 2], [CAN.w2 / 2, CAN.z + CAN.d / 2]].forEach(([x, z]) => fitPts.push(new T.Vector3(XC + x, FL + CAN.h + 0.75, z)));
      fitPts.push(new T.Vector3(TX, FL + 3.25, TZ), new T.Vector3(-4.45, 2.7, -5.72), new T.Vector3(4.45, 2.8, -5.72));
    }
    let lastFit = { k: 1, ox: 0, oy: 0 };
    function measure(g) {
      const a = g.az * RAD, e = g.el * RAD;
      fitCam.aspect = W / H; fitCam.updateProjectionMatrix();
      fitCam.position.set(g.tgt.x + g.dist * Math.sin(a) * Math.cos(e), g.tgt.y + g.dist * Math.sin(e), g.tgt.z + g.dist * Math.cos(a) * Math.cos(e));
      fitCam.lookAt(g.tgt); fitCam.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      fitPts.forEach((p) => { fitV.copy(p).project(fitCam); x0 = Math.min(x0, fitV.x); x1 = Math.max(x1, fitV.x); y0 = Math.min(y0, fitV.y); y1 = Math.max(y1, fitV.y); });
      return { x0, x1, y0, y1 };
    }
    function fitGoal(v) {
      if (!FIT) return;
      const fill = v.fit || 0.9, free = 1 - (insets.top + insets.bottom) / H;
      let k = 1;
      for (let it = 0; it < 3; it++) {
        const b = measure(goal), kk = Math.max((b.y1 - b.y0) / (2 * free * fill), (b.x1 - b.x0) / (2 * 0.94));
        goal.dist *= kk; k *= kk;
      }
      const b = measure(goal);
      const cy = ((1 - (b.y0 + b.y1) / 2) / 2) * H, cx = (((b.x0 + b.x1) / 2 + 1) / 2) * W;
      goal.oy = cy - (insets.top + (H - insets.top - insets.bottom) / 2); goal.ox = cx - W / 2;
      lastFit = { k, ox: goal.ox, oy: goal.oy };
    }
    const user = { az: 0, el: 0 };
    let W = 1, H = 1;
    function setView(i, keep) {
      const v = views[i];
      goal.tgt.set(...v.tgt);
      const aspect = W / H;
      goal.dist = v.dist * (aspect < 1.3 ? 1 + (1.3 - aspect) * 0.75 : 1);
      goal.az = v.az + user.az;
      goal.el = clamp(v.el + user.el, 7, 80);
      // girando com o mouse mantém o enquadramento (sem a maquete "respirar")
      if (keep) { goal.dist *= lastFit.k; goal.ox = lastFit.ox; goal.oy = lastFit.oy; } else fitGoal(v);
    }
    function aim() {
      const a = cur.az * RAD, e = cur.el * RAD;
      cam.position.set(cur.tgt.x + cur.dist * Math.sin(a) * Math.cos(e), cur.tgt.y + cur.dist * Math.sin(e), cur.tgt.z + cur.dist * Math.cos(a) * Math.cos(e));
      cam.lookAt(cur.tgt);
      if (FIT) cam.setViewOffset(W, H, cur.ox, cur.oy, W, H);
    }
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") return; drag = { x: e.clientX, y: e.clientY, az: user.az, el: user.el }; canvas.setPointerCapture(e.pointerId); canvas.classList.add("is-drag"); });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      user.az = clamp(drag.az - (e.clientX - drag.x) * 0.32, -85, 62);
      const base = views[state.step].el;
      user.el = clamp(drag.el + (e.clientY - drag.y) * 0.22, 7 - base, 80 - base);
      setView(state.step, true); kick();
    });
    const endDrag = () => { drag = null; canvas.classList.remove("is-drag"); };
    canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

    function resize() {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      const base = Math.min(window.devicePixelRatio || 1, QL.dprMax, Math.sqrt(QL.budget / (W * H)));
      renderer.setPixelRatio(Math.max(QL.dprMin, base * gov.k));
      renderer.setSize(W, H, false);
      cam.aspect = W / H; cam.updateProjectionMatrix();
      setView(state.step);
      kick(1);
    }
    new ResizeObserver(resize).observe(host);

    /* ---------- troca de modelo: carregador, largura da cobertura e vagas ---------- */
    const tw = { from: null, to: null, t: 1, can: 1, canT: 1 };
    function showModel(key, instant) {
      if (key === tw.to && tw.t >= 1) return;
      tw.from = tw.to; tw.to = key; tw.t = instant || reduced ? 1 : 0;
      tw.canT = key === "lento" ? 0 : 1; // o Lento (casa, condomínio, pequeno comércio) não tem cobertura
      if (instant || reduced) tw.can = tw.canT;
      const changed = state.model !== key;
      state.model = key;
      if (changed && cars.length) vanishAll();
      setTimeout(sync, instant ? 0 : 1300);
      kick();
    }

    /* ---------- laço: só desenha quando algo se mexe ---------- */
    let raf = 0, last = 0, until = 0, visible = true, lastAnch = "";
    const gov = { k: 1, dts: [], cont: false, from: performance.now() + 1500, steps: 0 };
    function govern(delta) {
      // só conta quadros seguidos (animação contínua), depois da largada (compilação e envio de texturas)
      if (!gov.cont || performance.now() < gov.from || delta > 250) return;
      gov.dts.push(delta);
      if (gov.dts.length < 45) return;
      const med = gov.dts.sort((a, b) => a - b)[22];
      gov.dts.length = 0;
      if (med < 36) return;
      gov.steps++;
      if (renderer.shadowMap.enabled && gov.steps === 2) {
        renderer.shadowMap.enabled = false; sun.castShadow = false; if (catcher) catcher.visible = false;
        scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
      } else if (gov.k > 0.56) { gov.k = Math.max(0.55, gov.k * 0.8); resize(); }
      gov.from = performance.now() + 800;
      if (window.__mq) window.__mq.gov = { k: gov.k, steps: gov.steps, med, shadows: renderer.shadowMap.enabled };
    }
    const roofBox = new T.Box3(), ray = new T.Ray(), hit = new T.Vector3();
    const ANCH = {
      charger: () => new T.Vector3(XC, FL + chargers[state.model].userData.h + 0.15, Lay.zCharger),
      screen: () => new T.Vector3(XC, FL + chargers[state.model].userData.h * 0.8, Lay.zCharger + 0.25),
      totemL: () => new T.Vector3(TX - 0.55, FL + 0.45, TZ + 0.2),
      totemR: () => new T.Vector3(TX + 0.55, FL + 0.45, TZ + 0.2),
      lane: () => new T.Vector3(...nodes.lane),
      energia: () => new T.Vector3(...nodes.energia),
      seguro: () => new T.Vector3(...nodes.seguro),
      telefonia: () => new T.Vector3(...nodes.telefonia)
    };
    function kick(sec) { until = Math.max(until, performance.now() + (sec || 0.4) * 1000); if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function roofBlocks() {
      // a cobertura tapa o carregador (ou um carro carregando) visto desta câmera?
      if (tw.can < 0.5) return false;
      const w = canW > 0 ? canW : CAN.w2;
      roofBox.min.set(XC - w / 2, FL + CAN.h - 0.05, CAN.z - DD / 2); roofBox.max.set(XC + w / 2, FL + CAN.h + 0.6, CAN.z + DD / 2);
      const pts = [new T.Vector3(XC, FL + 1.25, Lay.zCharger + 0.2)];
      rot.bays(state.model).forEach((x) => pts.push(new T.Vector3(x, FL + 0.9, Lay.zStop)));
      return pts.some((p) => { ray.origin.copy(cam.position); ray.direction.copy(p).sub(cam.position); const d = ray.direction.length(); ray.direction.normalize(); return ray.intersectBox(roofBox, hit) && hit.distanceTo(cam.position) < d; });
    }
    function frame(now) {
      raf = 0;
      govern(now - last);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      let busy = false;
      // câmera
      const f = reduced ? 1 : 1 - Math.pow(0.002, dt);
      cur.tgt.lerp(goal.tgt, f); cur.dist += (goal.dist - cur.dist) * f; cur.az += (goal.az - cur.az) * f; cur.el += (goal.el - cur.el) * f;
      cur.ox += (goal.ox - cur.ox) * f; cur.oy += (goal.oy - cur.oy) * f;
      if (cur.tgt.distanceTo(goal.tgt) + Math.abs(goal.dist - cur.dist) + Math.abs(goal.az - cur.az) * 0.05 + Math.abs(goal.el - cur.el) * 0.05 + (Math.abs(goal.ox - cur.ox) + Math.abs(goal.oy - cur.oy)) * 0.01 > 0.004) busy = true;
      aim();
      // modelo: carregador troca, cobertura muda de largura, vagas repintam, a luz acompanha
      if (tw.t < 1) { tw.t = Math.min(1, tw.t + dt / 1.2); busy = true; }
      const out = clamp01(tw.t / 0.38), inn = clamp01((tw.t - 0.32) / 0.68);
      Object.entries(chargers).forEach(([key, g]) => {
        if (key === tw.to) { const s = tw.t >= 1 ? 1 : backOut(inn); g.visible = inn > 0 || tw.t >= 1; g.scale.set(1, Math.max(0.001, s), 1); }
        else if (key === tw.from && tw.t < 1) { const s = 1 - easeIO(out); g.visible = s > 0.002; g.scale.set(1, Math.max(0.001, s), 1); }
        else g.visible = false;
      });
      if (Math.abs(tw.canT - tw.can) > 0.0005) { tw.can += clamp(tw.canT - tw.can, -dt / 1.3, dt / 1.8); busy = true; }
      setCanopy(tw.can);
      const isK = (key) => (key === "lento" ? "1" : "2");
      Object.entries(islands).forEach(([key, pv]) => {
        const now = isK(tw.to), was = tw.from ? isK(tw.from) : now;
        let sc = 0;
        if (key === now) sc = now === was || tw.t >= 1 ? 1 : easeIO(clamp01((tw.t - 0.45) / 0.5));
        else if (key === was && tw.t < 1) sc = 1 - easeIO(clamp01(tw.t / 0.45));
        pv.visible = sc > 0.002; pv.scale.y = Math.max(0.001, sc);
      });
      bayMat.uniforms.uK.value = tw.t >= 1 ? 1 : 1 - Math.sin(Math.PI * clamp01(tw.t)) * 0.85;
      // cobertura "de vidro" quando tapa o carregador
      roofT = roofBlocks() ? 0 : 1;
      if (Math.abs(roofT - roofA) > 0.002) { roofA += clamp(roofT - roofA, -dt * 2.5, dt * 2.5); setRoofAlpha(roofA); busy = true; }
      // carros
      cars.slice().forEach((c) => {
        if (c.state === "vanish") { c.vanish = Math.max(0, c.vanish - dt / 0.45); c.fade = c.vanish; setAlpha(c, c.fade * rot.alpha(c.m.position.x, c.m.position.z)); if (c.fx) c.fx.cable.visible = c.fade > 0.3; if (c.badge) c.badge.style.opacity = c.fade.toFixed(2); busy = true; if (c.vanish <= 0) remove(c); return; }
        if (c.legs) {
          let L = c.legs[c.li];
          c.t += dt;
          if (c.t >= L.T) {
            if (c.li < c.legs.length - 1) { c.t -= L.T; c.li++; L = c.legs[c.li]; }
          }
          place(c, window.MQRotas.sample(L, L.sAt(c.t), P));
          busy = true;
          if (c.holds && c.clearX != null && c.m.position.x < c.clearX) { c.holds = false; release(); }
          if (c.li === c.legs.length - 1 && c.t >= L.T) { c.legs = null; const d = c.done; c.done = null; if (d) d(); }
        }
        if (c.fx) {
          const fx = c.fx;
          if (Math.abs(fx.to - fx.k) > 0.001) {
            fx.k = clamp01(fx.k + (fx.to > fx.k ? dt / 0.7 : -dt / 0.45));
            fx.cable.geometry.setDrawRange(0, Math.floor((fx.n * clamp01(fx.k * 1.25)) / 3) * 3);
            busy = true;
            if (fx.to === 0 && fx.k <= 0) { const then = fx.then; dropFx(c); if (then) then(); }
          }
        }
      });
      renderer.render(scene, cam);
      cars.forEach((c) => {
        if (!c.badge) return;
        const p = tmpV.copy(c.m.position).add(BADGE_UP).project(cam);
        c.badge.style.setProperty("--x", (((p.x + 1) / 2) * W).toFixed(1) + "px"); c.badge.style.setProperty("--y", (((1 - p.y) / 2) * H).toFixed(1) + "px");
      });
      if (opts.onAnchors) {
        const r = {};
        Object.entries(ANCH).forEach(([key, fn]) => { const p = fn().project(cam); r[key] = [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H]; });
        const sig = JSON.stringify(r);
        if (sig !== lastAnch) { lastAnch = sig; opts.onAnchors(r); }
      }
      gov.cont = (busy || now < until) && visible;
      // (algo chamado neste quadro pode já ter pedido o próximo: nunca abrir duas cadeias de animação)
      if (gov.cont && !raf) raf = requestAnimationFrame(frame);
    }
    let swapTimer = 0;
    function scheduleSwap() {
      clearTimeout(swapTimer);
      if (!state.traffic || reduced) { swapTimer = 0; return; }
      swapTimer = setTimeout(() => { if (visible && state.traffic) swap(); scheduleSwap(); }, (15 - 9 * clamp01(state.util)) * 1000 * (0.8 + Math.random() * 0.4));
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) kick(); }, { threshold: 0.02 }).observe(host);
    document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) kick(); });

    resize();
    showModel("duo", true);
    layoutCanopy(CAN.w2); setRoofAlpha(1);
    cur.tgt.copy(goal.tgt); cur.dist = goal.dist; cur.az = goal.az; cur.el = goal.el; cur.ox = goal.ox; cur.oy = goal.oy; aim();
    kick(1);

    const api = {
      setModel(key) { showModel(key); },
      setStep(n) { state.step = n; setView(n); kick(1.5); },
      setTraffic(util, carsDay, on) {
        const before = desired();
        state.util = clamp01(util); state.cars = carsDay;
        const was = state.traffic; state.traffic = !!on;
        if (was && !on) { vanishAll(); clearTimeout(swapTimer); swapTimer = 0; kick(); return; }
        const after = desired();
        if (after.bays !== before.bays || after.queue !== before.queue || on !== was) sync();
        // (a troca de carros acontece quando a carga de cada um completa)
        kick();
      },
      setPrice(v) { if (Number.isFinite(v) && Math.abs(v - price) > 0.0001) { price = v; drawTotem(); kick(); } },
      setInsets(t, b) { insets.top = t || 0; insets.bottom = b || 0; setView(state.step); kick(1); },
      view(cmd) {
        if (cmd === "reset") { user.az = 0; user.el = 0; } else user.az = user.az > 20 ? -45 : 45;
        setView(state.step); kick(1.5);
      },
      redraw() { kick(0.5); }
    };
    if (/debug/.test(location.hash)) window.__mq = { T, scene, renderer, pool, cars, kick, cam, chargers, Lay, FL, Q: QL, gov: { k: gov.k } };
    if (opts.onReady) opts.onReady(api);
    return api;
  }
  window.MQCena = { init };
})();
