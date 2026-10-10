/* =========================================================
   iGreen MOB · contador V2 · Revelação: a estação acende como um neon dando partida.
   Duas fotos alinhadas da mesma cena (o par "Último", enviado e ampliado por ele): no escuro (a da página) e toda acesa.
   Levar o cursor até o letreiro iGreen (ou tocar nele) liga a estação: o letreiro pisca rápido algumas vezes e firma; logo em
   seguida as luzes da cobertura também piscam e acendem, iluminando de cima até o chão; fica acesa enquanto o cursor está
   perto e apaga em cerca de 1 s depois. Ao abrir a cena, um cursor "fantasma" passa uma vez e acende para mostrar o efeito.
   No celular (sem cursor) a estação acende sozinha ao abrir a cena e fica acesa (sem dica).
   Técnica (WebGL, sem 3D): a imagem final mistura escuro e aceso por uma máscara de luz; a luz some suave nas bordas da foto.
   Só desenha enquanto algo muda; parado, não gasta nada. Sem WebGL ou com "reduzir movimento": fica a foto escura.
   (Também ficam no código, sem uso na página, as variações testadas: lanterna, rastro e onda — RV2FX.on("lanterna"|"rastro"|"onda").)
   ========================================================= */
(() => {
  "use strict";
  const sec = document.querySelector("[data-rv-fx-sec]");
  const cv = document.querySelector("[data-rv-fx]");
  if (!sec || !cv) return;
  const box = cv.parentElement;
  const hint = sec.querySelector("[data-rv-hint]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(hover: none)").matches;
  // celular, tela em pé ou sem cursor (inclusive o modo responsivo do navegador): o neon acende sozinho e fica aceso; conferido ao vivo
  const AUTO = window.matchMedia("(hover: none), (max-width: 760px), (max-aspect-ratio: 4/5)");
  let auto = AUTO.matches;
  // o par de fotos (escura e acesa, alinhadas): 3840 px (texturas acima de 4096 px falham em muitos celulares), 1600 px em telas pequenas
  const BIG = window.innerWidth * (window.devicePixelRatio || 1) > 1700;
  const SETS = {
    main: BIG
      ? { dark: "contador/img/revelacao-v2-ultimo-escura-3840.webp?v=476e8b12", lit: "contador/img/revelacao-v2-ultimo-acesa-3840.webp?v=2e4c1dc4" }
      : { dark: "contador/img/revelacao-v2-ultimo-escura-1600.webp?v=b0bc144b", lit: "contador/img/revelacao-v2-ultimo-acesa-1600.webp?v=aee199b5" }
  };
  const SIGN = { x: 0.505, y: 0.12 };   // centro do letreiro na foto (frações)
  const MODES = {
    lanterna: { id: 0, hint: ["Passe o cursor para iluminar", "Toque e arraste para iluminar"], ghost: [[0.2, 0.68], [0.4, 0.6], [0.6, 0.52], [0.72, 0.36], [0.55, 0.16]] },
    rastro: { id: 1, hint: ["Passe o cursor para iluminar", "Toque e arraste para iluminar"], ghost: [[0.2, 0.68], [0.42, 0.6], [0.62, 0.5], [0.75, 0.34]] },
    onda: { id: 3, hint: ["Clique na cena ou leve o cursor ao letreiro para soltar a energia", "Toque na cena para soltar a energia"], ghost: [[0.3, 0.6], [0.42, 0.3], [0.5, 0.14]] },
    neon: { id: 2, hint: ["Leve o cursor até o letreiro para acender a estação", "Toque no letreiro para acender a estação"], ghost: [[0.3, 0.6], [0.42, 0.3], [0.5, 0.14]] }
  };
  const FLICK_S = [0, 0.85, 0.1, 0, 0.55, 0.05, 1, 0.35, 1, 0.8, 1];   // o letreiro dando partida (passos de 1/20 s)
  const FLICK_C = [0.45, 0, 0.8, 0.15, 0.6, 1, 0.75, 1];              // as luzes da cobertura logo depois (passos de 1/18 s)

  let gl = null, ready = false, on = false, mode = MODES.lanterna, raf = 0, prog = {}, quad, pbuf, tex = { main: {} }, setName = "main", fbo = [], ft = [], cur = 0, TW = 0, TH = 0;
  let mouse = { x: 0.5, y: 0.5 }, brush = null, last = 0, lastInput = 0, ghost = null, ghostPath = null, ghostWait = false, inside = false, first = 0;
  let spotI = 0, spawnAcc = 0, parts = [];
  const neon = { on: false, ton: 0, last: 0, level: 0 };
  const wave = { x: 0.5, y: 0.5, t0: -1e9, hold: 0, done: true, armed: true };   // onda: origem, início, estação acesa (0..1)
  const WAVE_T = 2.2;                                                         // segundos para a onda cobrir a cena
  const MAXP = 360, pdata = new Float32Array(MAXP * 4);

  const VS = "attribute vec2 p;varying vec2 v;varying vec2 t;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);t=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  // a luz que fica: arrasta, espalha, perde força e recebe o pincel — coordenadas do GL (y para cima)
  const FS_TRAIL = `
precision highp float;
uniform sampler2D prev; uniform vec2 px; uniform vec2 a; uniform vec2 b; uniform vec2 vel;
uniform float r; uniform float k; uniform float asp; uniform float fade; uniform float spread; uniform float push;
varying vec2 t;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 p = vec2(t.x * asp, t.y), B = vec2(b.x * asp, b.y);
  float near = exp(-dot(p - B, p - B) / (r * r * 3.0));
  vec2 st = t - vel * near * push;
  vec2 o = px * 1.5;
  float c = texture2D(prev, st).r;
  float n = (texture2D(prev, st + vec2(o.x, 0.0)).r + texture2D(prev, st - vec2(o.x, 0.0)).r + texture2D(prev, st + vec2(0.0, o.y)).r + texture2D(prev, st - vec2(0.0, o.y)).r) * 0.25;
  float val = max(0.0, mix(c, n, spread) * fade - 0.001);
  float d = seg(p, vec2(a.x * asp, a.y), B);
  val += exp(-d * d / (r * r * 0.5)) * k * (1.0 - val);
  gl_FragColor = vec4(val, 0.0, 0.0, 1.0);
}`;
  // imagem final: escuro → aceso pela luz; a luz some suave nas bordas da foto
  const FS_OUT = `
precision highp float;
uniform sampler2D dark; uniform sampler2D lit; uniform sampler2D light;
uniform float mode; uniform vec2 brush; uniform float asp; uniform float spotI; uniform vec2 sign; uniform float nSign; uniform float nFront; uniform float nLevel; uniform float nScene; uniform vec3 wv; uniform float wAmp; uniform float wHold; uniform float time;
varying vec2 v;
void main() {
  float tr = texture2D(light, vec2(v.x, 1.0 - v.y)).r, L;
  vec2 uv = v; float ring = 0.0;
  if (mode > 2.5) {                        // onda: dentro do raio fica aceso; na frente, a imagem refrata (onda de choque)
    vec2 q = vec2((v.x - wv.x) * asp, v.y - wv.y);
    float d = length(q), ang = atan(q.y, q.x);
    float R = wv.z + 0.012 * sin(ang * 7.0 + time * 2.0) * step(0.02, wv.z);   // borda levemente orgânica
    ring = exp(-pow((d - R) / 0.04, 2.0)) * wAmp;
    float echo = exp(-pow((d - R + 0.13) / 0.05, 2.0)) * wAmp * 0.45;          // um segundo anel, mais fraco, atrás
    vec2 dir = d > 1e-4 ? q / d : vec2(0.0);
    uv = v + vec2(dir.x / asp, dir.y) * (ring * 0.018 + echo * 0.008);
    L = max(1.0 - smoothstep(R - 0.09, R + 0.01, d), wHold);
  } else if (mode < 0.5) {                        // lanterna: luz larga com queda suave + o rastro
    vec2 d = vec2((v.x - brush.x) * asp, v.y - brush.y);
    L = max(spotI / pow(1.0 + dot(d, d) / 0.1, 1.5), smoothstep(0.0, 1.0, tr) * 0.75);
  } else if (mode < 1.5) {                 // rastro: luz grande, desfocada e fraca
    L = smoothstep(0.0, 1.0, tr) * 0.8;
  } else {                                 // neon: o letreiro acende e a luz desce da cobertura
    float ds = length(vec2((v.x - sign.x) / 0.16, (v.y - sign.y) / 0.1));
    float sg = 1.0 - smoothstep(0.7, 1.15, ds);
    float down = 1.0 - smoothstep(nFront - 0.25, nFront, v.y);
    float hx = smoothstep(0.06, 0.3, v.x) * (1.0 - smoothstep(0.88, 1.04, v.x));
    float str = mix(1.0, 0.78, smoothstep(0.2, 1.0, v.y));   // mais forte embaixo da cobertura, um pouco menos no chão
    L = max(sg * nSign, down * hx * str * nScene) * nLevel;
  }
  float ef = smoothstep(0.0, 0.07, v.y) * (1.0 - smoothstep(0.95, 1.0, v.y)) * smoothstep(0.0, 0.05, v.x) * (1.0 - smoothstep(0.95, 1.0, v.x));
  L = clamp(L, 0.0, 1.0) * ef;
  vec3 dk = texture2D(dark, uv).rgb, lt = texture2D(lit, uv).rgb;
  if (ring > 0.001) {                      // na frente da onda: um leve desvio de cor (só a foto acesa, nada de branco)
    float ca = 0.004 * ring;
    lt = vec3(texture2D(lit, uv + vec2(ca, 0.0)).r, lt.g, texture2D(lit, uv - vec2(ca, 0.0)).b);
    lt *= 1.0 + 0.35 * ring * ef;
  }
  gl_FragColor = vec4(mix(dk, lt, L), 1.0);   // aceso por completo = exatamente a foto acesa (sem a escura por baixo)
}`;
  // pontos de luz invisíveis do "Rastro" (desenhados só na textura de luz, grandes e macios)
  const VS_P = "attribute vec4 q;uniform float sz;varying float a;void main(){gl_Position=vec4(q.x*2.-1.,1.-q.y*2.,0.,1.);gl_PointSize=q.z*sz;a=q.w;}";
  const FS_P = "precision mediump float;varying float a;uniform float lv;void main(){vec2 d=gl_PointCoord*2.-1.;float r=dot(d,d);if(r>1.)discard;gl_FragColor=vec4(vec3(lv*exp(-r*2.2)*a),1.);}";

  function compile(vs, fs, attr) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, attr); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("shader");
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function makeTex(w, h, data) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]].forEach(([k, val]) => gl.texParameteri(gl.TEXTURE_2D, k, val));
    if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function useQuad() { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
  function clearLight() { fbo.forEach((f) => { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  function lightTargets() {
    const r = box.getBoundingClientRect();
    const w = Math.max(64, Math.round(Math.min(384, r.width / 5))), hh = Math.max(36, Math.round(w * r.height / r.width));
    if (w === TW && hh === TH) return;
    TW = w; TH = hh;
    ft.forEach((t) => gl.deleteTexture(t)); fbo.forEach((f) => gl.deleteFramebuffer(f));
    ft = [makeTex(TW, TH), makeTex(TW, TH)];
    fbo = ft.map((t) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; });
    clearLight();
  }
  function size() {
    if (!gl) return;
    const r = box.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    lightTargets();
  }

  function init() {
    if (gl || reduce) return !!gl;
    gl = cv.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
    if (!gl) return false;
    try { prog.trail = compile(VS, FS_TRAIL, "p"); prog.out = compile(VS, FS_OUT, "p"); prog.pt = compile(VS_P, FS_P, "q"); } catch (e) { gl = null; return false; }
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    pbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferData(gl.ARRAY_BUFFER, pdata.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    size();
    new ResizeObserver(() => { size(); kick(); }).observe(box);
    return true;
  }

  // carrega um par de fotos (uma vez); file://: o WebGL não lê a foto, usa a cópia embutida em JS (revelacao-v2-tex.js)
  function loadSet(name) {
    const t = tex[name];
    if (t.loading) return;
    t.loading = true;
    let n = 0;
    const key = (k) => (name === "main" ? k : name + "_" + k);
    const put = (k, im) => { t[k] = makeTex(0, 0, im); if (++n === 2) { t.ready = true; if (on) kick(); } };
    const fromCopy = (k) => { const im = new Image(); im.onload = () => put(k, im); im.src = window.REVELACAO_V2_TEX[key(k)]; };
    const withCopy = (k) => {
      if (window.REVELACAO_V2_TEX) return fromCopy(k);
      if (location.protocol !== "file:") return;
      let s = document.querySelector("script[data-rv-tex]");
      if (!s) { s = document.createElement("script"); s.src = "contador/img/revelacao-v2-tex.js"; s.dataset.rvTex = ""; document.head.appendChild(s); }
      s.addEventListener("load", () => fromCopy(k));
    };
    ["dark", "lit"].forEach((k) => {
      if (location.protocol === "file:" && window.REVELACAO_V2_TEX) return fromCopy(k);
      const im = new Image();
      im.onload = () => { try { put(k, im); } catch (e) { withCopy(k); } };
      im.src = SETS[name][k];
    });
  }

  function ghostAt(g) {
    const P = ghostPath, n = P.length - 1, e = g * g * (3 - 2 * g), s = e * n, i = Math.min(n - 1, Math.floor(s)), f = s - i;
    return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * f, y: P[i][1] + (P[i + 1][1] - P[i][1]) * f };
  }
  function trailPass(a, asp, dx, dy, dt, r, k, fade, spread, push) {
    gl.useProgram(prog.trail.p); useQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]); gl.viewport(0, 0, TW, TH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ft[cur]);
    const U = prog.trail.u;
    gl.uniform1i(U.prev, 0); gl.uniform2f(U.px, 1 / TW, 1 / TH);
    gl.uniform2f(U.a, a.x, 1 - a.y); gl.uniform2f(U.b, brush.x, 1 - brush.y); gl.uniform2f(U.vel, dx, -dy);
    gl.uniform1f(U.r, r); gl.uniform1f(U.k, k * Math.min(1, dt * 60)); gl.uniform1f(U.asp, asp);
    gl.uniform1f(U.fade, Math.pow(fade, dt * 60)); gl.uniform1f(U.spread, spread); gl.uniform1f(U.push, push);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cur = 1 - cur;
  }
  function drawParts() {
    let n = 0;
    for (const p of parts) {
      const life = p.t / p.max;
      pdata[n * 4] = p.x; pdata[n * 4 + 1] = p.y; pdata[n * 4 + 2] = p.s; pdata[n * 4 + 3] = p.b * Math.sin(Math.PI * Math.min(1, life)); n++;
    }
    if (!n) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]); gl.viewport(0, 0, TW, TH);
    gl.useProgram(prog.pt.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pdata.subarray(0, n * 4)); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1f(prog.pt.u.sz, TH); gl.uniform1f(prog.pt.u.lv, 0.07);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
  }

  function frame(now) {
    raf = 0;
    if (!on || !tex[setName].ready) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const r = box.getBoundingClientRect(), asp = r.width / r.height;
    // o cursor fantasma e o "acender sozinho" contam a partir do primeiro quadro com as fotos prontas (no file:// elas demoram mais)
    if (!first) first = now;
    if (ghostWait) { ghostWait = false; ghost = now + 500; lastInput = now + 500; }
    if (ghost !== null && now >= ghost) {
      const g = (now - ghost) / (ghostPath.length * 900);
      if (g >= 1) ghost = null; else { mouse = ghostAt(g); lastInput = now; }
    }
    if (!brush) brush = { x: mouse.x, y: mouse.y };
    const f = 1 - Math.exp(-dt * 9), a = { x: brush.x, y: brush.y };
    brush.x += (mouse.x - brush.x) * f; brush.y += (mouse.y - brush.y) * f;
    const dx = brush.x - a.x, dy = brush.y - a.y, speed = Math.hypot(dx * asp, dy) / Math.max(dt, 1e-3);
    const active = now - lastInput < 1500;
    let busy = now - lastInput < 7000;
    let nSign = 0, nFront = 0, nScene = 0;

    if (mode.id === 0) {          // lanterna: luz no cursor + rastro que apaga em poucos segundos
      spotI += ((active ? 1 : 0) - spotI) * (1 - Math.exp(-dt * 3.5));
      trailPass(a, asp, dx, dy, dt, 0.2, Math.min(0.22, speed * 0.15), 0.985, 0.6, 0.4);
      busy = busy || spotI > 0.01;
    } else if (mode.id === 1) {   // rastro: pontos de luz invisíveis que sobem e se espalham
      spawnAcc += Math.min(8, speed * dt * 90);
      while (spawnAcc >= 1 && parts.length < MAXP) {
        spawnAcc -= 1;
        const ang = Math.random() * Math.PI * 2, sp = 0.015 + Math.random() * 0.05, rr = Math.random() * 0.04;
        parts.push({ x: brush.x + Math.cos(ang) * rr / asp, y: brush.y + Math.sin(ang) * rr, vx: dx / Math.max(dt, 1e-3) * 0.3 + Math.cos(ang) * sp / asp, vy: dy / Math.max(dt, 1e-3) * 0.3 + Math.sin(ang) * sp - 0.025, t: 0, max: 1.6 + Math.random() * 1.6, s: 0.09 + Math.random() * 0.1, b: 0.5 + Math.random() * 0.5 });
      }
      spawnAcc = Math.min(spawnAcc, 1);
      const drag = Math.exp(-dt * 1.3);
      parts = parts.filter((p) => { p.vx *= drag; p.vy = p.vy * drag - 0.04 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; return p.t < p.max; });
      trailPass(a, asp, 0, 0, dt, 0.1, 0, 0.968, 0.95, 0);
      drawParts();
      busy = busy || parts.length > 0;
    } else if (mode.id === 3) {   // onda: perto do letreiro (ou um clique) solta a onda; fica acesa enquanto há interação
      const near = Math.hypot((mouse.x - SIGN.x) * asp, mouse.y - SIGN.y) < 0.2 && (ghost !== null || inside);
      if (near && wave.armed && wave.hold < 0.5) fireWave(SIGN.x, SIGN.y, now);
      const t = (now - wave.t0) / 1000;
      if (!wave.done && t >= WAVE_T * 0.8) { wave.done = true; wave.hold = 1; }          // a onda cobriu a cena: fica acesa
      if (wave.done && now - lastInput > 4000) {                                           // 4 s sem movimento: apaga devagar
        wave.hold = Math.max(0, wave.hold - dt / 1.2);
        if (wave.hold < 0.5) wave.armed = true;
      }
      busy = busy || t < WAVE_T + 0.4 || wave.hold > 0.003;
    } else {                      // neon: perto do letreiro liga a estação
      const near = Math.hypot((mouse.x - SIGN.x) * asp, mouse.y - SIGN.y) < 0.2 && (ghost !== null || inside);
      if (near) { if (!neon.on) { neon.on = true; neon.ton = now; } neon.last = now; }
      if (auto && !neon.on && now - first > 400) { neon.on = true; neon.ton = now; neon.last = now; }   // no celular acende sozinho…
      if (neon.on && !auto && now - neon.last > 3500) neon.on = false;                                  // …e fica aceso; com cursor apaga
      neon.level += ((neon.on ? 1 : 0) - neon.level) * (1 - Math.exp(-dt * (neon.on ? 30 : 2.4)));
      const t = (now - neon.ton) / 1000, ts = t - 0.42;
      nSign = t < FLICK_S.length / 20 ? FLICK_S[Math.floor(t * 20)] : 1;
      nScene = ts < 0 ? 0 : ts < FLICK_C.length / 18 ? FLICK_C[Math.floor(ts * 18)] : 1;
      const g = Math.min(1, Math.max(0, ts / 0.3));                  // a luz chega ao chão em 0,3 s
      nFront = 0.12 + 1.2 * (g * g * (3 - 2 * g));
      // aceso e já firme: para de desenhar (o último quadro fica na tela) — no celular não gasta bateria parado
      busy = busy || (neon.on ? t < 1.6 || neon.level < 0.995 : neon.level > 0.005);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(prog.out.p); useQuad();
    const O = prog.out.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[setName].dark); gl.uniform1i(O.dark, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[setName].lit); gl.uniform1i(O.lit, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ft[cur]); gl.uniform1i(O.light, 2);
    gl.uniform1f(O.mode, mode.id); gl.uniform2f(O.brush, brush.x, brush.y); gl.uniform1f(O.asp, asp); gl.uniform1f(O.spotI, spotI);
    { const t = (now - wave.t0) / 1000, e = Math.min(1, Math.max(0, t / WAVE_T)), ee = 1 - Math.pow(1 - e, 2);
      gl.uniform3f(O.wv, wave.x, wave.y, ee * 2.0); gl.uniform1f(O.wAmp, t < 0 || t > WAVE_T + 0.4 ? 0 : Math.min(1, t * 6) * (1 - Math.max(0, (t - WAVE_T * 0.7) / (WAVE_T * 0.3 + 0.4))));
      gl.uniform1f(O.wHold, wave.hold); gl.uniform1f(O.time, now / 1000); }
    gl.uniform2f(O.sign, SIGN.x, SIGN.y); gl.uniform1f(O.nSign, nSign); gl.uniform1f(O.nFront, nFront); gl.uniform1f(O.nLevel, neon.level); gl.uniform1f(O.nScene, nScene);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cv.classList.add("is-on");
    if (busy && !document.body.classList.contains("is-paused")) raf = requestAnimationFrame(frame);
  }
  function fireWave(x, y, now) { wave.x = x; wave.y = y; wave.t0 = now; wave.armed = false; wave.done = false; }
  function kick() { if (on && tex[setName].ready && !raf) { last = 0; raf = requestAnimationFrame(frame); } }

  function point(e) {
    if (!on) return;
    const r = box.getBoundingClientRect();
    mouse = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    lastInput = performance.now(); ghost = null; inside = true;
    if (hint) hint.classList.add("is-gone");
    kick();
  }
  sec.addEventListener("pointermove", point);
  sec.addEventListener("pointerdown", (e) => {
    brush = null; point(e);
    if (on && mode.id === 3 && !e.target.closest("button, a")) fireWave(mouse.x, mouse.y, performance.now());   // cada clique solta uma onda
  });
  sec.addEventListener("pointerleave", () => { inside = false; lastInput = performance.now(); kick(); });   // volta a contar o tempo para apagar

  // liga uma variação / desliga (seletor da página)
  window.RV2FX = {
    on(name) {
      if (!init()) return false;
      mode = MODES[name] || MODES.neon;
      setName = mode.set || "main"; loadSet(setName); cv.classList.remove("is-on");
      on = true; sec.classList.add("is-fx"); size();
      if (gl && fbo.length) clearLight();
      spotI = 0; parts = []; neon.on = false; neon.level = 0; wave.t0 = -1e9; wave.hold = 0; wave.done = true; wave.armed = true;
      ghostPath = mode.ghost; ghost = null; ghostWait = true; first = 0; lastInput = performance.now() + 500; brush = null; mouse = { x: ghostPath[0][0], y: ghostPath[0][1] };
      if (hint) { hint.textContent = mode.hint[touch ? 1 : 0]; hint.classList.toggle("is-gone", auto && mode === MODES.neon); }   // no celular o neon acende sozinho: sem dica
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      kick(); return true;
    },
    off() { on = false; sec.classList.remove("is-fx"); cv.classList.remove("is-on"); if (raf) cancelAnimationFrame(raf); raf = 0; }
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  // a tela mudou de jeito (girou, redimensionou, entrou no modo responsivo): passa a acender sozinho ou volta a depender do cursor
  const onAuto = () => {
    auto = AUTO.matches;
    if (hint && mode === MODES.neon && on) hint.classList.toggle("is-gone", auto);
    lastInput = performance.now(); kick();
  };
  if (AUTO.addEventListener) AUTO.addEventListener("change", onAuto); else AUTO.addListener(onAuto);
})();
