/* iGreen MOB · O eletroposto iGreen (página interna)
   Mesmo esqueleto da página do produto (menu, bateria, capítulos presos na rolagem), com o 3D do kit em código
   (assets/3d/igreen-kit.js): o carregador nítido de perto, o anel das camadas de receita girando em volta dele
   e, rolando, a cobertura, o letreiro e as vagas montando o ponto inteiro, até a vista noturna.
   Desempenho: só desenha quando algo muda, sem sombras calculadas em tempo real, poucas luzes e
   resolução que se ajusta sozinha à máquina. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = root.classList.contains("rm");
  const mqMobile = window.matchMedia("(max-width: 760px)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const IG = window.IGCore;
  const BAKE = location.hash === "#bake";
  const FORCE3D = /3d/.test(location.hash); // testes: mantém o 3D mesmo em máquina lenta

  /* ---------- consultor e WhatsApp ---------- */
  if (IG) IG.paintConsultant();

  /* ---------- entradas ---------- */
  root.classList.add("ready");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("p-in")));
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  } else $$("[data-reveal]").forEach((el) => el.classList.add("is-in"));

  /* ---------- capítulos ---------- */
  const story = $(".story");
  const chapters = $$(".ch");
  const hudN = $("[data-ch-n]"), hudName = $("[data-ch-name]"), hudBar = $$(".story__bar i");
  const chNames = ["A tela", "A bandeira", "A conexão", "Energia", "Seguro", "Telefonia", "Rede", "O ecossistema", "A estrutura", "O letreiro", "As vagas", "No seu ponto"];

  /* ---------- menu em cápsula + bateria ---------- */
  const hdr = $("#hdr");
  const fill = $(".charge__fill");
  const measureHdr = () => {
    const inner = $(".hdr__in", hdr);
    const w = hdr.clientWidth;
    const brand = $(".brand", hdr), cta = $(".hdr__cta", hdr);
    const snug = Math.ceil(brand.offsetWidth + cta.offsetWidth + 36 + 64);
    const capW = mqMobile.matches ? w - 16 : Math.min(snug, w - 24);
    hdr.style.setProperty("--capW", capW + "px");
    hdr.style.setProperty("--pull", Math.max(0, (inner.getBoundingClientRect().width - capW) / 2 + 18) + "px");
  };
  let ticking = false, lastY = 0;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    // celular: o menu some ao descer e volta ao subir
    const dy = y - lastY;
    lastY = y;
    if (mqMobile.matches && y > 140) { if (dy > 6) hdr.classList.add("is-hidden"); else if (dy < -6) hdr.classList.remove("is-hidden"); }
    else hdr.classList.remove("is-hidden");
    const max = root.scrollHeight - window.innerHeight;
    fill.style.setProperty("--p", max > 0 ? clamp01(y / max).toFixed(4) : "0");
    hdr.classList.toggle("is-compact", y > 40);
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener("scroll", req, { passive: true });
  window.addEventListener("resize", () => { measureHdr(); req(); });
  measureHdr();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureHdr);

  /* ======================================================================
     TOMADAS: az/el em graus, d = distância, t = alvo, sx/sy = onde o alvo fica na tela,
     k = estrutura montada (0..1), env = ambiente noturno (0..1),
     ring = anel das camadas de receita, rr = giro do anel (graus), sch = palco escurecido para o anel,
     pl = placa do estúdio (o carro esmeralda ao fundo)
     ====================================================================== */
  const S = (az, el, d, tx, ty, tz, sx, sy, o) => Object.assign({ az, el, d, tx, ty, tz, sx, sy, k: 0, env: 0, ring: 0, rr: 140, sch: 0, pl: 0 }, o);
  /* as quatro camadas: o anel gira 90° por capítulo e traz a camada da vez para a frente */
  const layers = (az0, el, d, sx, sy) => [50, -40, -130, -220].map((rr, i) => S(az0 + i * 8, el, d, 0, 0.9, 0, sx, sy, { ring: 1, rr, sch: 1, pl: 0.2 }));
  const SHOTS = {
    desk: {
      hero: S(-22, 6, 5.0, 0, 0.85, 0, 0.72, 0.47, { pl: 0.9 }),
      ch: [
        S(-14, 4, 2.05, 0, 1.3, 0.2, 0.7, 0.5, { pl: 0.55 }),
        S(14, 2, 2.7, 0, 0.7, 0.2, 0.68, 0.5, { pl: 0.55 }),
        S(-58, 8, 2.8, -0.3, 0.95, 0, 0.7, 0.5, { rr: 110, sch: 0.2, pl: 0.6 }),
        ...layers(-10, 12, 6.2, 0.68, 0.5),
        S(-16, 8, 6.6, 0, 0.9, 0, 0.69, 0.5, { ring: 1, rr: -250, sch: 0.6, pl: 0.7 }),
        S(-30, 9, 14.5, 0.2, 1.9, 0, 0.68, 0.5, { k: 0.68, env: 0.25, rr: -250 }),
        S(-20, 3, 7.2, 2.2, 3.7, 2.6, 0.68, 0.5, { k: 1, env: 0.6, rr: -250 }),
        S(-34, 30, 11.5, 0, 0.2, 0.6, 0.68, 0.52, { k: 1, env: 0.8, rr: -250 }),
        S(-30, 5, 16, 0.3, 1.75, 0, 0.66, 0.48, { k: 1, env: 1, rr: -250 })
      ]
    },
    mob: {
      hero: S(-18, 6, 8.2, 0, 0.85, 0, 0.5, 0.27, { pl: 1 }),
      ch: [
        S(-14, 4, 3.4, 0, 1.3, 0.2, 0.5, 0.3, { pl: 0.55 }),
        S(12, 2, 4.4, 0, 0.75, 0.2, 0.5, 0.3, { pl: 0.55 }),
        S(-58, 8, 4.6, -0.3, 0.95, 0, 0.5, 0.3, { rr: 110, sch: 0.2, pl: 0.6 }),
        ...layers(-10, 14, 13, 0.5, 0.25),
        S(-16, 10, 13.5, 0, 0.9, 0, 0.5, 0.25, { ring: 1, rr: -250, sch: 0.6, pl: 0.7 }),
        S(-30, 10, 26, 0, 1.9, 0, 0.5, 0.3, { k: 0.68, env: 0.25, rr: -250 }),
        S(-20, 3, 13, 2.0, 3.6, 2.6, 0.5, 0.3, { k: 1, env: 0.6, rr: -250 }),
        S(-35, 34, 18, 0, 0.3, 0.6, 0.5, 0.3, { k: 1, env: 0.8, rr: -250 }),
        S(-30, 6, 32, 1.0, 1.7, 0, 0.5, 0.3, { k: 1, env: 1, rr: -250 })
      ]
    }
  };
  const KEYS = Object.keys(SHOTS.desk.hero);
  const ANG = { az: 1, el: 1, rr: 1 };
  /* no desktop, sx é uma fração do container (1280px), não da janela */
  const toViewX = (sx) => {
    if (mqMobile.matches) return sx;
    const vw = window.innerWidth;
    const pad = Math.min(48, Math.max(20, vw * 0.04));
    const cw = Math.min(vw - 2 * pad, 1280);
    return ((vw - cw) / 2 + sx * cw) / vw;
  };
  const mixShot = (a, b, t) => { const o = {}; KEYS.forEach((k) => { o[k] = lerp(a[k], b[k], t); }); return o; };

  /* trilha: posições de rolagem de cada tomada */
  const Track = (() => {
    let kf = [], stepH = 1, top = 0, end = 0, ok = false;
    function measure() {
      if (!root.classList.contains("is-3d")) { ok = false; return; }
      const vh = $(".story__stage").offsetHeight || window.innerHeight;
      top = story.offsetTop;
      const steps = chapters.length;
      stepH = (story.offsetHeight - vh) / (steps - 0.5);
      kf = [0];
      for (let i = 0; i < steps; i++) kf.push(top + i * stepH);
      end = top + story.offsetHeight - vh;
      ok = stepH > 10;
    }
    function at(y) {
      const set = mqMobile.matches ? SHOTS.mob : SHOTS.desk;
      const list = [set.hero].concat(set.ch);
      if (y <= kf[0]) return { shot: list[0], ch: -1, near: 1 };
      let i = kf.length - 2;
      for (let k = 0; k < kf.length - 1; k++) if (y < kf[k + 1]) { i = k; break; }
      const seg = kf[i + 1] - kf[i];
      const t = clamp01((y - kf[i]) / seg);
      const mob = mqMobile.matches;
      const tt = i === 0 ? clamp01((t - (mob ? 0.5 : 0.1)) / (mob ? 0.48 : 0.85)) : clamp01((t - 0.22) / 0.62);
      const last = y >= kf[kf.length - 1];
      const shot = last ? list[list.length - 1] : mixShot(list[i], list[i + 1], ease(tt));
      const f = i + t;
      const ch = last ? chapters.length - 1 : Math.round(f - 0.05) - 1;
      const near = 1 - clamp01(Math.abs(ease(tt) - (ch + 1 === i ? 0 : 1)) * 2.2);
      return { shot, ch: Math.max(-1, Math.min(chapters.length - 1, ch)), near: last ? 1 : near };
    }
    return { measure, at, ready: () => ok, chapterY: (i) => kf[i + 1] + 2, range: () => ({ top, end, stepH }) };
  })();

  let activeCh = -2;
  function setChapter(i) {
    if (i === activeCh) return;
    activeCh = i;
    chapters.forEach((c, k) => c.classList.toggle("is-active", k === i));
    if (i >= 0) {
      hudN.textContent = String(i + 1).padStart(2, "0");
      hudName.textContent = chNames[i];
    }
    hudBar.forEach((b, k) => b.classList.toggle("on", k <= i));
  }

  /* "Ver por dentro": no 3D vai para a tomada do capítulo */
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-go]");
    if (!a) return;
    const i = Number(a.dataset.go);
    ev.preventDefault();
    let y;
    if (root.classList.contains("is-3d") && Track.ready()) y = Track.chapterY(i);
    else { const el = chapters[i]; y = el ? el.getBoundingClientRect().top + window.scrollY - 80 : 0; }
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  });

  /* ======================================================================
     PALCO 3D
     ====================================================================== */
  const Stage = (() => {
    const wrap = $(".stage"), canvas = $("#stage");
    const overlay = $(".overlay"), svg = $(".overlay__lines"), tagLayer = $(".overlay__tags");
    const nodes = $$(".node");
    const NS = "http://www.w3.org/2000/svg";
    const BG0 = 0x030605, BG1 = 0x05090d;
    const RING_Y = 1.08, RING_R = 1.3;
    let T, renderer, scene, cam, kit, studio, hemi, moon, bgA, bgB, ringGroup, ringMat, floorRing;
    let bgU, bgCol, bgQuad, pivot, plateU, plate, panelMat, panel, coneU, cone, dustU, dust, floorU, floorFx, stageFx;
    let W = 0, H = 0, live = false, running = false, t0 = 0, last = 0;
    let probe = [];
    /* aparelho lento: para o 3D, libera a placa de vídeo e mostra a versão com as imagens */
    function degrade() {
      running = false;
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* segue mesmo assim */ }
      wrap.classList.remove("is-live");
      window.dispatchEvent(new Event("ig3d-slow"));
    }
    let cur = null, intro = 0, lastK = -1, lastEnv = -1, lastS = null, lastExpo = -1, lastRingT = 0, needs = true, overlayKey = "", prevDrawn = false;
    const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
    const tags = [];
    let activeLine = null;

    /* ---------- resolução: começa dentro de um orçamento de pixels e se ajusta ao desempenho medido ---------- */
    let dpr = 1, dprMax = 1.5, dprMin = 0.85, good = 0;
    /* em movimento (rolagem) desenha com menos pixels; parou, volta à resolução cheia num quadro nítido */
    const MOTION = 0.68;
    let applied = 0, moveFrames = 0, stillFrames = 0;
    function applyRes(v) {
      if (Math.abs(v - applied) < 0.01) return false;
      applied = v;
      renderer.setPixelRatio(v);
      renderer.setSize(W, H, false);
      return true;
    }
    const samples = [];
    function initDpr() {
      const dev = window.devicePixelRatio || 1;
      const mob = mqMobile.matches;
      dprMax = Math.min(dev, mob ? 1.25 : 1.5);
      dprMin = Math.min(dprMax, mob ? 0.8 : 0.85);
      const budget = mob ? 1.1e6 : 2.6e6;
      const area = Math.max(1, window.innerWidth * window.innerHeight);
      dpr = Math.max(dprMin, Math.min(dprMax, Math.sqrt(budget / area)));
    }
    function setDpr(v) {
      dpr = Math.round(v * 100) / 100;
      if (!moveFrames) applyRes(dpr);
      needs = true;
    }
    function adapt(dt) {
      samples.push(dt);
      if (samples.length < 24) return;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples.length = 0;
      if (avg > 0.028 && dpr > dprMin + 0.01) { setDpr(Math.max(dprMin, dpr - 0.2)); good = 0; }
      else if (avg < 0.0185) { good++; if (good >= 4 && dpr < dprMax - 0.01) { setDpr(Math.min(dprMax, dpr + 0.15)); good = 0; } }
      else good = 0;
    }

    /* as anotações dos capítulos vão para a camada fixa e seguem o ponto do modelo */
    function buildOverlay() {
      chapters.forEach((ch, ci) => {
        $$(".ptag", ch).forEach((li) => {
          const a = kit.anchors[li.dataset.anchor];
          if (!a) return;
          const el = document.createElement("div");
          el.className = "ptag";
          el.innerHTML = li.innerHTML;
          const dot = document.createElement("span");
          dot.className = "ptag__dot";
          const path = document.createElementNS(NS, "path");
          svg.appendChild(path);
          tagLayer.appendChild(dot);
          tagLayer.appendChild(el);
          tags.push({ ch: ci, a, el, dot, path, dx: +li.dataset.dx, dy: +li.dataset.dy, mdx: +li.dataset.mdx, mdy: +li.dataset.mdy, mhide: li.hasAttribute("data-mhide"), w: 0, h: 0 });
        });
      });
      activeLine = document.createElementNS(NS, "path");
      activeLine.setAttribute("class", "l-node is-active");
      svg.appendChild(activeLine);
    }
    /* largura das anotações e dos nós (normal e ativo), medida uma vez, para decidir o lado do rótulo sem medir a cada quadro */
    function measureTags() {
      tags.forEach((t) => { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; });
      nodes.forEach((n) => {
        const was = n.classList.contains("is-active");
        const ill = $(".node__ill", n);
        ill.style.transition = "none";
        n.classList.remove("is-active"); n._w = n.offsetWidth;
        n.classList.add("is-active"); n._wa = n.offsetWidth;
        n.classList.toggle("is-active", was);
        void n.offsetWidth;
        ill.style.transition = "";
      });
      needs = true;
    }

    /* pôster (antes do WebGL e no modo estático): recorte do carregador centrado no alvo da tomada de abertura */
    const POSTER_H = 2.23; // altura, em metros, do recorte de img/eletroposto-hero.webp
    function placePoster() {
      const s = (mqMobile.matches ? SHOTS.mob : SHOTS.desk).hero;
      const vis = 2 * s.d * Math.tan((15 * Math.PI) / 180);
      const vw = window.innerWidth, vh = window.innerHeight;
      const sx = toViewX(s.sx);
      wrap.style.setProperty("--ph", ((POSTER_H / vis) * vh).toFixed(1) + "px");
      wrap.style.setProperty("--pcx", (sx * vw).toFixed(1) + "px");
      wrap.style.setProperty("--pcy", (s.sy * vh).toFixed(1) + "px");
      wrap.style.setProperty("--glow-x", (sx * 100).toFixed(1) + "%");
    }
    function clearPoster() { ["--ph", "--pcx", "--pcy", "--glow-x"].forEach((p) => wrap.style.removeProperty(p)); }

    function build(k, plateImg) {
      T = window.THREE;
      kit = k;
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: BAKE, preserveDrawingBuffer: BAKE });
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0;
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.shadowMap.enabled = false; // as sombras de contato vêm desenhadas no chão (kit)
      scene = new T.Scene();
      bgA = new T.Color(BG0); bgB = new T.Color(BG1);
      scene.background = bgA.clone();
      scene.fog = new T.FogExp2(BG0, 0.05);
      scene.environment = window.IGKit.studioEnv(T, renderer);
      cam = new T.PerspectiveCamera(30, 1, 0.05, 160);
      scene.add(cam);

      /* estúdio: chave branca e dois recortes verdes; à noite elas baixam e entram a lua e a luz da cobertura */
      const L = (c, ang, pen, pos, tg) => {
        const l = new T.SpotLight(c, 0, 0, ang, pen, 2);
        l.position.set(pos[0], pos[1], pos[2]); l.target.position.set(tg[0], tg[1], tg[2]);
        scene.add(l); scene.add(l.target);
        return l;
      };
      studio = [
        { l: L(0xf3fff4, 0.55, 0.85, [-1.8, 4.4, 3.6], [0, 0.8, 0]), i: 44 },
        { l: L(0x22ff4a, 0.5, 0.9, [-2.8, 2.2, -2.4], [0, 0.9, 0]), i: 70 },
        { l: L(0x22ff4a, 0.5, 0.9, [2.8, 1.6, -2.2], [0, 0.9, 0]), i: 56 }
      ];
      hemi = new T.HemisphereLight(0x9fc4a8, 0x040805, 0.45); scene.add(hemi);
      moon = new T.DirectionalLight(0xa9bcff, 0); moon.position.set(-10, 14, 8); scene.add(moon);
      const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      Object.keys(kit.tex).forEach((n) => { if (kit.tex[n] && kit.tex[n].isTexture) kit.tex[n].anisotropy = aniso; });
      scene.add(kit.root);

      /* anel das camadas de receita (energia, seguro, telefonia, rede) girando em volta do carregador */
      ringGroup = new T.Group();
      ringGroup.position.y = RING_Y;
      ringMat = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new T.Color(0x03ff1f) } },
        vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "varying vec2 vUv;uniform float uT;uniform float uA;uniform vec3 uC;void main(){float s=fract(vUv.x-uT*.06);float flow=pow(s,14.)*1.6;float a=(.32+flow)*uA;gl_FragColor=vec4(uC*a,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"
      });
      const ring = new T.Mesh(new T.TorusGeometry(RING_R, 0.0055, 6, 220), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.renderOrder = 5; // depois dos logos transparentes: a parte da frente do anel passa por cima do G e da palavra iGreen
      ringGroup.add(ring);
      ringGroup.userData.nodes = [0, 90, 180, 270].map((deg) => {
        const o = new T.Object3D();
        const r = (deg * Math.PI) / 180;
        o.position.set(Math.sin(r) * RING_R, 0, Math.cos(r) * RING_R);
        ringGroup.add(o);
        return o;
      });
      ringGroup.visible = false;
      scene.add(ringGroup);
      // o mesmo anel, fino, desenhado no chão
      floorRing = new T.Mesh(new T.RingGeometry(RING_R - 0.012, RING_R + 0.012, 160), new T.MeshBasicMaterial({ color: 0x03ff1f, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -8 }));
      floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.006; floorRing.visible = false; floorRing.renderOrder = 5;
      scene.add(floorRing);
      buildStudio(plateImg);
    }

    /* ---------- estúdio dos passos do carregador e do anel (portado da página do produto) ----------
       fundo com névoa esmeralda em volta do produto, painel de luz e placa com o carro atrás dele (giram junto com a câmera),
       cone de luz com poeira, brilho e anel no piso e, no passo do anel, a grade no chão.
       Tudo estático (sem animação contínua): a poeira anda com a rolagem. Some quando a estrutura começa a montar. */
    function buildStudio(plateImg) {
      stageFx = new T.Group();
      scene.add(stageFx);
      // fundo em espaço de tela, desenhado antes de tudo
      bgCol = new T.Color(BG0);
      // névoa esmeralda: ruído suave calculado uma vez numa textura pequena (o fundo só lê a textura)
      const mc = document.createElement("canvas"); mc.width = mc.height = 128;
      const mg = mc.getContext("2d"), md = mg.createImageData(128, 128);
      const hh = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
      const nn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const w = 7, a = hh(ix % w, iy % w), b = hh((ix + 1) % w, iy % w), c = hh(ix % w, (iy + 1) % w), d = hh((ix + 1) % w, (iy + 1) % w); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; };
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const u = x / 128 * 7, v = y / 128 * 7; const m = nn(u, v) * 0.65 + nn(u * 2, v * 2) * 0.35; const o = (y * 128 + x) * 4; md.data[o] = md.data[o + 1] = md.data[o + 2] = Math.round(m * 255); md.data[o + 3] = 255; }
      mg.putImageData(md, 0, 0);
      const mist = new T.CanvasTexture(mc); mist.wrapS = mist.wrapT = T.RepeatWrapping;
      bgU = { uSub: { value: new T.Vector2(0.7, 0.5) }, uAsp: { value: 1.6 }, uGlow: { value: new T.Color(0x03ff1f) }, uI: { value: 1 }, uBase: { value: bgCol }, uMist: { value: mist } };
      const bg = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
        depthWrite: false, depthTest: false, uniforms: bgU,
        vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.9999,1.);}",
        fragmentShader: [
          "varying vec2 vUv;uniform vec2 uSub;uniform float uAsp;uniform vec3 uGlow;uniform float uI;uniform vec3 uBase;uniform sampler2D uMist;",
          "float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}",
          "void main(){vec2 p=vUv-uSub;p.x*=uAsp;float r=length(p*vec2(.85,1.));",
          "vec2 q=vec2(vUv.x*uAsp,vUv.y);float m=texture2D(uMist,q*.32+vec2(.43,.24)).r;",
          "vec3 g=uGlow*.0042*exp(-r*r*2.4)+vec3(.0016,.0028,.002)*exp(-r*r*1.1)+vec3(.0006,.0034,.0016)*m*exp(-r*r*.9);",
          "float hz=exp(-pow((vUv.y-(1.-uSub.y)+.13)*7.,2.));g+=vec3(.0004,.0018,.0008)*hz;",
          "vec3 c=uBase+g*uI;",
          "float vig=smoothstep(1.5,.2,length((vUv-.5)*vec2(uAsp,1.)));c*=mix(mix(1.,.5,uI),1.,vig);",
          "c+=(h(vUv*1000.)-.5)*.0008*uI;gl_FragColor=vec4(c,1.);",
          "#include <colorspace_fragment>",
          "}"
        ].join("\n")
      }));
      bg.frustumCulled = false; bg.renderOrder = -10;
      scene.add(bg);
      bgQuad = bg;
      scene.background = bgCol;

      // pivô que acompanha o azimute da câmera: placa com o carro e o painel de luz ficam sempre atrás do carregador
      pivot = new T.Group();
      stageFx.add(pivot);
      if (plateImg) {
        const tex = new T.Texture(plateImg);
        tex.colorSpace = T.SRGBColorSpace; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
        plateU = { map: { value: tex }, uI: { value: 0 } };
        const PW = 7.4, PH = PW * 1152 / 2048;
        plate = new T.Mesh(new T.PlaneGeometry(PW, PH), new T.ShaderMaterial({
          transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: plateU,
          vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader: "varying vec2 vUv;uniform sampler2D map;uniform float uI;void main(){vec4 t=texture2D(map,vUv);float e=smoothstep(.04,.26,vUv.x)*smoothstep(1.,.84,vUv.x)*smoothstep(.02,.3,vUv.y)*smoothstep(1.,.7,vUv.y);gl_FragColor=vec4(t.rgb*uI*e*1.35,1.);\n#include <colorspace_fragment>\n}"
        }));
        plate.position.set(0.12, (0.5 - 0.265) * PH, -4.9);
        plate.renderOrder = -5;
        pivot.add(plate);
      }
      const pc = document.createElement("canvas"); pc.width = 256; pc.height = 512;
      const g = pc.getContext("2d");
      g.fillStyle = "#000"; g.fillRect(0, 0, 256, 512);
      const soft = (x, y, rw, rh, blur, color) => {
        g.save(); g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetX = 2000; g.fillStyle = color;
        g.beginPath(); if (g.roundRect) g.roundRect(x - 2000, y, rw, rh, 24); else g.rect(x - 2000, y, rw, rh); g.fill(); g.restore();
      };
      soft(70, 50, 116, 420, 60, "rgba(255,255,255,.28)");
      for (let i = 0; i < 6; i++) soft(80, 72 + i * 7, 96, 396 - i * 14, 10, "rgba(255,255,255," + (0.1 + i * 0.12).toFixed(2) + ")");
      panelMat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(pc), color: new T.Color(0x14ff3a).multiplyScalar(0.15), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false });
      panel = new T.Mesh(new T.PlaneGeometry(1.6, 4.0), panelMat);
      panel.position.set(0.62, 1.31, -2.7);
      pivot.add(panel);

      // cone de luz do topo
      coneU = { uC: { value: new T.Color(0xd9ffe0) }, uI: { value: 0.05 } };
      cone = new T.Mesh(new T.CylinderGeometry(0.12, 1.5, 5.2, 48, 1, true), new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: coneU,
        vertexShader: "varying vec3 vN;varying vec3 vV;varying float vY;void main(){vY=uv.y;vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}",
        fragmentShader: "varying vec3 vN;varying vec3 vV;varying float vY;uniform vec3 uC;uniform float uI;void main(){float f=pow(abs(dot(vN,vV)),2.);float a=f*smoothstep(1.,.35,vY)*smoothstep(0.,.25,vY)*uI;gl_FragColor=vec4(uC*a,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"
      }));
      cone.position.set(0, 2.6, 0);
      stageFx.add(cone);

      // poeira de luz no cone: parada quando a página para, anda com a rolagem
      const N = mqMobile.matches ? 90 : 150;
      const pos = new Float32Array(N * 3), seed = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 1.25;
        pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.random() * 3.6; pos[i * 3 + 2] = Math.sin(a) * rr * 0.8;
        seed[i] = Math.random();
      }
      const dg = new T.BufferGeometry();
      dg.setAttribute("position", new T.BufferAttribute(pos, 3));
      dg.setAttribute("aS", new T.BufferAttribute(seed, 1));
      dustU = { uT: { value: 0 }, uI: { value: 0 }, uPx: { value: 20 } };
      dust = new T.Points(dg, new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: dustU,
        vertexShader: [
          "attribute float aS;uniform float uT;uniform float uI;uniform float uPx;varying float vA;",
          "void main(){vec3 p=position;p.y=mod(p.y+uT*.05*(.4+aS),3.6);p.x+=sin(uT*.25+aS*6.283)*.07;p.z+=cos(uT*.2+aS*9.)*.05;",
          "vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.5+aS*1.3)/max(.5,-mv.z);",
          "float cone=exp(-(p.x*p.x+p.z*p.z)*.75);float tw=.45+.55*(.5+.5*sin(uT*1.1+aS*40.));",
          "vA=uI*cone*tw*smoothstep(0.,.4,p.y)*smoothstep(3.6,2.85,p.y);}"
        ].join("\n"),
        fragmentShader: "varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d);gl_FragColor=vec4(vec3(.62,1.,.7)*a*a*vA,1.);\n#include <colorspace_fragment>\n}"
      }));
      dust.frustumCulled = false; dust.renderOrder = 5;
      stageFx.add(dust);

      // piso: poça de luz verde sob o carregador, anel neon em volta e, no passo do anel, a grade
      floorU = { uGlow: { value: new T.Color(0x03ff1f) }, uPool: { value: 0 }, uPad: { value: 0 }, uGrid: { value: 0 } };
      floorFx = new T.Mesh(new T.PlaneGeometry(10, 10), new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: floorU, polygonOffset: true, polygonOffsetFactor: -7,
        vertexShader: "varying vec3 vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
        fragmentShader: [
          "varying vec3 vP;uniform vec3 uGlow;uniform float uPool;uniform float uPad;uniform float uGrid;",
          "void main(){float d=length(vP.xz);",
          "vec2 pq=(vP.xz-vec2(0.,.25))*vec2(.85,1.9);float pool=exp(-dot(pq,pq)*1.6);",
          "float pr=exp(-pow((d-1.06)/.009,2.));float ph=exp(-pow((d-1.06)/.09,2.));",
          "vec2 g=abs(fract(vP.xz*2.)-.5);float gl=1.-smoothstep(0.,.025,min(g.x,g.y));",
          "vec3 c=uGlow*(pool*.03*uPool+(pr*.09+ph*.012)*uPad+gl*.012*uGrid*(1.-smoothstep(1.,4.5,d)));",
          "gl_FragColor=vec4(c,1.);",
          "#include <tonemapping_fragment>",
          "#include <colorspace_fragment>",
          "}"
        ].join("\n")
      }));
      floorFx.rotation.x = -Math.PI / 2; floorFx.position.y = 0.007; floorFx.renderOrder = 4;
      stageFx.add(floorFx);
    }

    function resize() {
      if (!renderer) return;
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      if (Math.abs(w - W) < 1 && Math.abs(h - H) < 80 && W) { H = h; return; }
      W = w; H = h;
      applied = 0;
      applyRes(dpr);
      needs = true;
    }

    let tmpA, tmpB, hubV;
    function project(v, out) {
      tmpA.copy(v).project(cam);
      out.x = (tmpA.x * 0.5 + 0.5) * W;
      out.y = (-tmpA.y * 0.5 + 0.5) * H;
      out.z = tmpA.z;
      return out;
    }

    /* estado da cena para uma tomada: câmera, estrutura, noite, névoa, luzes e anel */
    function applyShot(s, w, h, sxView, expo) {
      if (expo == null) expo = 1;
      const a = (s.az * Math.PI) / 180, e = (s.el * Math.PI) / 180;
      cam.aspect = w / h;
      cam.position.set(s.tx + Math.sin(a) * Math.cos(e) * s.d, s.ty + Math.sin(e) * s.d, s.tz + Math.cos(a) * Math.cos(e) * s.d);
      cam.lookAt(s.tx, s.ty, s.tz);
      cam.setViewOffset(w, h, -(sxView - 0.5) * w, -(s.sy - 0.5) * h, w, h);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const env = clamp01(s.env), k = clamp01(s.k), sch = clamp01(s.sch), ring = clamp01(s.ring);
      if (Math.abs(k - lastK) > 0.0005 || Math.abs(env - lastEnv) > 0.0005) { kit.set(k, env); lastK = k; lastEnv = env; }
      const dim = (1 - 0.75 * env) * (1 - 0.28 * sch);
      studio.forEach((o) => { o.l.intensity = o.i * dim; });
      // à noite o cenário (sem reflexo de ambiente) ganha luz do céu e da cidade
      hemi.intensity = 0.45 + 0.75 * env;
      moon.intensity = 0.35 * env;
      scene.environmentIntensity = (1 - 0.55 * env) * (1 - 0.3 * sch);
      bgCol.copy(bgA).lerp(bgB, env);
      scene.fog.color.copy(bgCol);
      scene.fog.density = lerp(0.055 * Math.max(0.4, Math.min(1, 5 / s.d)), 0.028, env);
      ringMat.uniforms.uA.value = ring;
      ringGroup.rotation.y = (s.rr * Math.PI) / 180;
      ringGroup.visible = ring > 0.01;
      floorRing.material.opacity = 0.4 * ring;
      floorRing.visible = ring > 0.01;
      // estúdio: inteiro nos passos do carregador e do anel; some com a noite e quando a estrutura começa a subir
      const st = (1 - env) * (1 - clamp01(k / 0.35));
      const pl = clamp01(s.pl);
      bgU.uI.value = st * (0.6 + 0.4 * expo);
      bgU.uAsp.value = w / h;
      bgU.uSub.value.set(sxView, 1 - s.sy + 0.05);
      stageFx.visible = st > 0.01;
      bgQuad.visible = st > 0.01;
      pivot.rotation.y = a;
      if (plate) { plateU.uI.value = pl * st * expo; plate.visible = plateU.uI.value > 0.005; }
      panelMat.color.setHex(0x14ff3a).multiplyScalar(0.15 * (1 - 0.35 * sch) * (0.4 + 0.6 * expo) * (1 - 0.5 * pl) * st);
      coneU.uI.value = 0.05 * st * (1 - sch);
      cone.visible = coneU.uI.value > 0.002;
      dustU.uI.value = 0.55 * expo * st * (1 - 0.6 * sch);
      dustU.uPx.value = 20 * renderer.getPixelRatio() * (h / 900);
      floorU.uPool.value = st * (1 - 0.6 * ring);
      floorU.uPad.value = (1 - ring) * (0.55 + 0.45 * pl) * st;
      floorU.uGrid.value = sch * st;
    }

    const P = { x: 0, y: 0, z: 0 }, Q = { x: 0, y: 0, z: 0 };
    function updateOverlay(info, s) {
      const mob = mqMobile.matches;
      const showTags = info.ch >= 0 && info.near > 0.55;
      tags.forEach((t) => {
        const on = showTags && t.ch === info.ch && !(mob && t.mhide);
        t.el.classList.toggle("is-on", on);
        t.dot.classList.toggle("is-on", on);
        if (!on) { t.path.setAttribute("d", ""); return; }
        project(t.a, P);
        const dx = mob ? t.mdx : t.dx, dy = mob ? t.mdy : t.dy;
        let lx = P.x + dx, ly = P.y + dy;
        const left = dx < 0;
        const minX = 16, maxX = W - 16;
        if (left) lx = Math.max(minX + t.w, Math.min(maxX, lx)); else lx = Math.max(minX, Math.min(maxX - t.w, lx));
        ly = Math.max(84 + t.h, Math.min(mob ? H * 0.5 : H - 90, ly));
        t.el.style.transform = "translate3d(" + (left ? lx - t.w : lx).toFixed(1) + "px," + (ly - t.h).toFixed(1) + "px,0)";
        t.dot.style.transform = "translate3d(" + P.x.toFixed(1) + "px," + P.y.toFixed(1) + "px,0)";
        t.path.setAttribute("d", "M" + P.x.toFixed(1) + " " + P.y.toFixed(1) + "L" + lx.toFixed(1) + " " + ly.toFixed(1));
      });

      /* nós das camadas de receita: o ativo cresce e uma linha o liga à tela do carregador */
      const ringOn = s.ring > 0.5;
      const layer = info.ch >= 3 && info.ch <= 6 ? info.ch - 3 : (info.ch === 7 ? 4 : -1);
      project(hubV, Q);
      const hubZ = Q.z;
      let activePt = null;
      ringGroup.updateMatrixWorld();
      ringGroup.userData.nodes.forEach((o, i) => {
        const n = nodes[i];
        o.getWorldPosition(tmpB);
        project(tmpB, P);
        const show = ringOn && info.near > 0.3;
        const isActive = i === layer;
        n.classList.toggle("is-show", show);
        n.classList.toggle("is-back", P.z > hubZ + 0.0005 && !isActive);
        n.classList.toggle("is-lit", layer >= 0 && i <= layer);
        n.classList.toggle("is-active", isActive);
        let x = P.x;
        const w = (isActive ? n._wa : n._w) || 160;
        const flip = x + w > W - 14;
        if (n._flip !== flip) { n._flip = flip; n.style.flexDirection = flip ? "row-reverse" : "row"; }
        x = flip ? x - w + 6 : x - 6;
        n.style.transform = "translate3d(" + x.toFixed(1) + "px," + P.y.toFixed(1) + "px,0) translateY(-50%)";
        if (isActive && show && info.near > 0.6) activePt = { x: P.x, y: P.y };
      });
      if (activePt) {
        project(kit.anchors.screen, Q);
        activeLine.setAttribute("d", "M" + Q.x.toFixed(1) + " " + Q.y.toFixed(1) + "L" + activePt.x.toFixed(1) + " " + activePt.y.toFixed(1));
      } else activeLine.setAttribute("d", "");
    }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const r = Track.range();
      const visible = y < r.end + vh * 1.02;
      wrap.classList.toggle("is-off", !visible);
      overlay.classList.toggle("is-on", live && y > (r.top - vh * 0.8) && y < r.end + vh * 0.15);
      story.classList.toggle("is-on", y > r.top - vh * 0.5 && y < r.end + vh * 0.3);
      if (!visible || document.hidden) { prevDrawn = false; return; }

      const info = Track.at(y);
      setChapter(info.ch);

      const target = info.shot;
      if (!cur) cur = Object.assign({}, target, { az: target.az + 20, d: target.d * 1.08 });
      const kk = 1 - Math.exp(-dt * (intro < 1 ? 2.2 : 6));
      KEYS.forEach((key) => { cur[key] += (target[key] - cur[key]) * kk; });

      /* parallax do ponteiro */
      ptr.sx += (ptr.x - ptr.sx) * Math.min(1, dt * 3);
      ptr.sy += (ptr.y - ptr.sy) * Math.min(1, dt * 3);
      const s = Object.assign({}, cur);
      s.az += ptr.sx * 3;
      s.el += -ptr.sy * 1.4;

      /* entrada e escurecimento leve enquanto o texto da abertura passa por cima */
      intro = Math.min(1, intro + dt / 1.8);
      const ie = 1 - Math.pow(1 - intro, 3);
      const sm = (a, b, x) => { const q = clamp01((x - a) / (b - a)); return q * q * (3 - 2 * q); };
      const dim = sm(vh * 0.1, vh * 0.42, y) * (1 - sm(r.top - vh * 0.55, r.top - vh * 0.08, y)) * (mqMobile.matches ? 0.72 : 0.38);
      const expo = ie * (1 - dim);

      /* só desenha quando algo mudou (câmera, luz, rótulos) ou, com o anel à mostra, a ~30 quadros/s para o brilho correr */
      let delta = 1;
      if (lastS) { delta = 0; KEYS.forEach((key) => { delta += Math.abs(s[key] - lastS[key]) * (ANG[key] ? 0.02 : 1); }); }
      const ringOn = s.ring > 0.01;
      const ringTick = ringOn && now - lastRingT > 33;
      const key = info.ch + ":" + (info.near > 0.3 ? 1 : 0) + (info.near > 0.55 ? 1 : 0) + (info.near > 0.6 ? 1 : 0);
      // movimento de verdade (não só o fim da suavização): baixa a resolução; 6 quadros parado, volta à cheia
      if (delta > 0.002) { moveFrames++; stillFrames = 0; } else { stillFrames++; if (stillFrames > 6) moveFrames = 0; }
      const res = moveFrames >= 2 ? Math.max(0.6, dpr * MOTION) : dpr;
      if (Math.abs(res - applied) > 0.01 && res > applied) needs = true; // o quadro nítido do fim
      if (!(needs || delta > 0.0004 || Math.abs(expo - lastExpo) > 0.002 || ringTick || key !== overlayKey)) { prevDrawn = false; return; }
      needs = false;
      if (applyRes(res)) prevDrawn = false; // troca de resolução não entra na medição de desempenho
      applyShot(s, W, H, toViewX(s.sx), expo);
      dustU.uT.value = y * 0.004;
      renderer.toneMappingExposure = expo;
      ringMat.uniforms.uT.value = (now - t0) / 1000;
      if (ringOn) lastRingT = now;
      renderer.render(scene, cam);
      lastS = s; lastExpo = expo; overlayKey = key;
      if (live) updateOverlay(info, s);

      /* qualidade adaptativa: mede só quadros desenhados em sequência */
      if (prevDrawn) adapt(dt);
      // sonda: nos primeiros 20 quadros seguidos, se a mediana passar de ~110 ms (menos de 9 quadros/s), o 3D sai
      if (prevDrawn && probe && !FORCE3D) {
        probe.push(dt);
        if (probe.length >= 20) {
          const med = probe.slice().sort((a, b) => a - b)[10];
          probe = null;
          if (med > 0.11) { degrade(); return; }
        }
      }
      prevDrawn = true;
      if (!live) {
        live = true;
        wrap.classList.add("is-live");
        setTimeout(() => wrap.classList.remove("is-poster"), 900);
      }
    }

    function start(k, plateImg) {
      initDpr();
      build(k, plateImg);
      tmpA = new T.Vector3(); tmpB = new T.Vector3(); hubV = new T.Vector3(0, 0.85, 0);
      buildOverlay();
      Track.measure();
      resize();
      measureTags();
      t0 = performance.now();
      if (BAKE) { window.__eletro = { shot: bakeShot, kit, gl: () => ({ renderer, scene, cam, studio, hemi, moon }) }; return; }
      running = true;
      requestAnimationFrame(frame);
      let rt;
      window.addEventListener("resize", () => {
        clearTimeout(rt);
        rt = setTimeout(() => { Track.measure(); resize(); measureTags(); }, 120);
      });
      document.addEventListener("visibilitychange", () => { needs = true; });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureTags);
      if (fine) {
        window.addEventListener("pointermove", (e) => {
          ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
          ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
        }, { passive: true });
      }
    }

    /* imagens do modo estático e do pôster (só com #bake na URL, para gerar os arquivos) */
    function bakeShot(v, w, h, opt) {
      opt = opt || {};
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      W = w; H = h;
      kit.world.visible = !opt.solo; kit.kiosk.visible = !opt.solo;
      lastK = -1;
      applyShot(Object.assign(S(0, 0, 1, 0, 0, 0, 0.5, 0.5), v), w, h, v.sx == null ? 0.5 : v.sx, 1);
      dustU.uT.value = 6;
      if (opt.solo) bgQuad.visible = false;
      if (opt.solo) stageFx.visible = false;
      ringMat.uniforms.uT.value = 3.2;
      if (opt.solo) { scene.background = null; scene.fog.density = 0; renderer.setClearColor(0x000000, 0); }
      renderer.toneMappingExposure = 1;
      renderer.render(scene, cam);
      const url = canvas.toDataURL(opt.type || "image/webp", opt.q || 0.88);
      scene.background = bgCol;
      return url;
    }

    return { start, placePoster, clearPoster, showPoster: () => wrap.classList.add("is-poster") };
  })();

  /* ---------- carregamento do 3D (three.js + logo vetorial + kit em código, só nesta página) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = res; s.onerror = () => rej(new Error("falha ao carregar " + src));
      document.head.appendChild(s);
    });
  }
  function fallbackStatic() {
    root.classList.remove("is-3d");
    root.classList.add("is-static");
    Stage.clearPoster();
    chapters.forEach((c) => c.classList.remove("is-active"));
  }

  window.addEventListener("ig3d-slow", fallbackStatic);
  const weak = !FORCE3D && !BAKE && ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.connection && navigator.connection.saveData));
  if (weak && root.classList.contains("is-3d")) fallbackStatic();

  if (root.classList.contains("is-3d")) {
    Track.measure();
    Stage.placePoster();
    Stage.showPoster();
    setChapter(-1);
    window.addEventListener("resize", () => { if (root.classList.contains("is-3d")) { Stage.placePoster(); Track.measure(); } });
    const fontReady = document.fonts && document.fonts.load ? document.fonts.load('500 40px "Instrument Sans"').catch(() => null) : Promise.resolve();
    const plateReady = loadScript("assets/img/r4-produto/hero-plate-tex.js")
      .then(() => new Promise((res) => {
        if (!window.IG_R4_PLATE) return res(null);
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = window.IG_R4_PLATE;
      }))
      .catch(() => null);
    loadScript("js/vendor/three-bundle.min.js")
      .then(() => {
        const T = window.THREE;
        if (!T || !window.IGKit) throw new Error("THREE indisponível");
        return fontReady.then(() => window.IGKit.build(T, { logoSvg: window.IG_LOGO_SVG, font: '"Instrument Sans", Arial, sans-serif' }));
      })
      .then((k) => plateReady.then((img) => Stage.start(k, img)))
      .catch((err) => { if (window.console) console.warn("[iGreen 3D]", err && err.message); fallbackStatic(); });
  }
  req();
})();
