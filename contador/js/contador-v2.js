/* =========================================================
   iGreen MOB · contador V2: a pista em movimento sem vídeo.
   O movimento vem da PRÓPRIA foto: o chão (asfalto, terra, as linhas verdes da beira) escorre em direção à câmera
   em perspectiva, e o céu e as montanhas ficam parados. Por cima, só as duas faixas que dividem as pistas (uma de cada lado do carro), pintadas no mesmo chão.
   Como funciona (WebGL, um único retângulo; só 2D, nada de cena 3D):
   - um ponto do chão a uma distância z aparece em y = fuga + (1 − fuga)/z, e a X meias-larguras do centro em x = fuga + X·0,69/z;
   - para "andar" Δ, cada ponto do chão mostra o que a foto tinha em z + Δ (as linhas da beira, em X = ±1, continuam no lugar);
   - duas camadas defasadas meio ciclo se revezam (uma some enquanto volta ao começo; fora dessas trocas só uma aparece),
     com um leve borrão ao longo da pista;
   - asfalto de rodovia por cima da foto, preso ao chão e andando com as faixas (sem rachaduras nem remendos: rodovia, não rua):
     grão fino (estrada-v2-asfalto, sem emenda), mais forte em volta do carro e mais fraco nas beiras, com trechos mais ásperos
     e outros mais lisos; um leve desgaste onde passam os pneus; e, soltas e espaçadas, marcas finas no sentido da pista
     (curtas e, mais raras, longas), cada uma com uma força, desenhadas como cortes no asfalto (fundo escuro, borda pegando luz).
   Sem WebGL, ou com "reduzir movimento", fica a foto parada (o <img> embaixo do canvas).
   ========================================================= */
(() => {
  "use strict";
  const cv = document.querySelector("[data-pista-fx]");
  if (!cv) return;
  const img = cv.parentElement.querySelector(".pista__foto");
  const box = cv.closest(".box");
  const stage = box.parentElement;
  const SPEED = 2.8;                                      // z por segundo
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = cv.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return;

  const VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
  const FS = `
precision highp float;
uniform sampler2D tex;
uniform sampler2D asf;    // textura do asfalto (vista de cima, sem emenda, brilho médio 50%)
uniform vec4 view;   // o canvas dentro da foto (frações): x0, y0, largura, altura
uniform vec2 span;   // a textura dentro da foto (frações da largura): x0, largura
uniform vec2 pxs;    // tamanho de um pixel (frações da foto)
uniform float run;   // distância percorrida (z)
varying vec2 v;
const float VX = 0.499, VY = 0.5645, EDGE = 0.69, K = 0.4355;
const float P = 1.6;                                   // ciclo das duas camadas do chão
const float DP = 2.6, DL = 1.0, HW = 0.012, LANE = 0.3333;   // faixas: período, comprimento, meia largura, posição (3 pistas: ±1/3)
const float XW = 0.9016, TA = 0.4;                     // chão sem distorção (X em unidades de z); tamanho de um ladrilho do grão do asfalto (z)
const float AMP = 0.9;                                 // força do grão no centro (nas beiras cai para ~35%)
const float MK = 0.85, MKL = 1.3;                      // marcas (cortes no asfalto, não tinta): quanto o fundo escurece; brilho da borda em relação a isso
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// ruído suave (0..1) que se repete a cada "per" células em y (para casar com a volta do "run")
float vnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, per), y1 = mod(i.y + 1.0, per);
  return mix(mix(hash2(vec2(i.x, y0)), hash2(vec2(i.x + 1.0, y0)), f.x), mix(hash2(vec2(i.x, y1)), hash2(vec2(i.x + 1.0, y1)), f.x), f.y);
}
// uma marca solta no chão: o chão é dividido em células (cw em X × cl em z) e só algumas (chance pr) têm uma marca,
// com posição, comprimento e força sorteados (a maioria fraca, poucas fortes); fina, no sentido da pista, pontas suaves.
// Não é uma reta perfeita: são 3 pedaços, cada um um pouco deslocado e inclinado, com pequenas quebras entre eles
// (às vezes um pedaço falta). cl divide 2080 (a volta do "run"), então o desenho se repete igual quando o "run" recomeça.
float marca(float X, float zz, float cw, float cl, float pr, float sd, float hw, float xpx) {
  float ci = floor(X / cw), si = floor(zz / cl), sk = mod(si, 2080.0 / cl) + sd;
  if (hash2(vec2(ci, sk)) > pr) return 0.0;
  float len = cl * (0.25 + 0.45 * hash2(vec2(ci, sk + 0.5)));
  float u = zz - si * cl - (cl - len) * hash2(vec2(ci + 0.5, sk + 0.5));
  if (u <= 0.0 || u >= len) return 0.0;
  float t = u / len * 3.0, pc = floor(t), ft = fract(t);
  float hp = hash2(vec2(ci + pc * 0.37, sk + 0.13)), hs = hash2(vec2(ci + pc * 0.71, sk + 0.41));
  float xc = (ci + 0.2 + 0.6 * hash2(vec2(ci + 0.5, sk))) * cw + (hp - 0.5) * 5.0 * hw + (hs - 0.5) * 4.0 * hw * (ft - 0.5);
  float piece = step(0.18, hp) * smoothstep(0.0, 0.07, ft) * (1.0 - smoothstep(0.93, 1.0, ft)) * (0.55 + 0.45 * hs);
  float f = hash2(vec2(ci + 0.25, sk + 0.75)); f = 0.15 + 0.85 * f * f;
  // perfil de um corte: o fundo um pouco mais escuro e uma borda fina pegando a luz (do lado do centro da pista)
  float w = max(hw, xpx), q = (X - xc) / w, ql = q + sign(xc) * 1.1;      // menor que um pixel: fica mais fraca, sem serrilhar
  return (MKL * exp(-ql * ql) - exp(-q * q)) * hw / w * smoothstep(0.0, 0.2 * len, u) * (1.0 - smoothstep(0.7 * len, len, u)) * piece * f;
}
vec3 photo(vec2 b) { return texture2D(tex, vec2((b.x - span.x) / span.y, b.y)).rgb; }
vec3 ground(float X, float z, float off, float blur) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float zz = z + off + blur * float(i) / 5.0;
    c += photo(vec2(VX + X * EDGE / zz, VY + K / zz));
  }
  return c / 6.0;
}
void main() {
  vec2 b = view.xy + v * view.zw;
  float dv = b.y - VY;
  vec3 base = photo(b);
  if (dv <= 0.0) { gl_FragColor = vec4(base, 1.0); return; }
  float z = K / dv;
  float X = (b.x - VX) * z / EDGE;
  float nr = clamp(1.6 / z, 0.0, 1.0);
  float blur = 0.01 + 0.1 * nr * nr;
  // cada camada anda um ciclo inteiro e só se mistura com a outra perto da volta (no resto do tempo o chão anda limpo, sem duplicar)
  float f0 = fract(run / P), f1 = fract(run / P + 0.5);
  float w0 = smoothstep(0.0, 0.3, f0) * smoothstep(0.0, 0.3, 1.0 - f0), w1 = smoothstep(0.0, 0.3, f1) * smoothstep(0.0, 0.3, 1.0 - f1);
  vec3 c = (ground(X, z, f0 * P, blur) * w0 + ground(X, z, f1 * P, blur) * w1) / (w0 + w1);
  c = mix(base, c, smoothstep(0.003, 0.02, dv));        // no horizonte o passo é menor que um pixel: fica a foto
  // a textura do asfalto, só dentro da pista (longe das linhas verdes), some aos poucos na distância
  float onRoad = 1.0 - smoothstep(0.9, 0.97, abs(X));
  float nearA = 1.0 - smoothstep(10.0, 50.0, z);
  if (onRoad * nearA > 0.0) {
    // grão: perto da câmera o rastro (5 amostras ao longo da pista) vira riscos retos
    float bl = 0.01 + 0.3 * nr * nr, d = 0.0;
    for (int i = 0; i < 5; i++) d += texture2D(asf, vec2(X * XW, z + run + bl * float(i) / 4.0) / TA).r;
    d = d / 2.5;                                         // média 1
    // desgaste dos pneus: duas faixas suaves em cada pista (um pouco mais escuras)
    float tr = 0.0;
    for (int k = -1; k <= 1; k++) { float lc = float(k) * 0.6667, q1 = (X - lc - 0.12) / 0.04, q2 = (X - lc + 0.12) / 0.04; tr += exp(-q1 * q1) + exp(-q2 * q2); }
    // a textura não é igual na pista toda: mais forte em volta do carro, mais fraca para as beiras (como no vídeo)
    // e nem todo pedaço tem o mesmo grão: uns trechos mais ásperos, outros mais lisos (só o relevo muda, não a cor)
    float xpxA = z / EDGE * pxs.x, zz = z + run;
    float ax = abs(X) / 0.6, nc = exp(-ax * ax), amp = mix(0.35, 1.0, nc);
    float rough = 0.5 + 0.8 * vnoise(vec2(X * 5.0, zz * 0.5), 1040.0);
    float shade = 1.0 + amp * ((d - 1.0) * AMP * rough - tr * 0.06);
    // poucas marcas, uma vez ou outra, como pequenos cortes no asfalto: algumas longas e, mais raras, curtas
    float mk = marca(X, zz, 0.11, 6.5, 0.06, 3.17, 0.001, xpxA)
             + marca(X + 0.05, zz, 0.08, 2.6, 0.025, 7.31, 0.0009, xpxA);
    c *= mix(1.0, max(0.3, shade) * (1.0 + MK * clamp(mk, -1.0, 1.5) * (0.55 + 0.45 * nc)), onRoad * nearA);
  }
  // as duas faixas que dividem as pistas: tinta no asfalto (sem brilho), um pouco gasta, acesa só pela luz da cena
  float zpx = K / (dv * dv) * pxs.y, xpx = z / EDGE * pxs.x;
  float s = mod(z + run, DP);
  float bz = max(zpx, 0.02 + 0.06 * nr);
  float along = smoothstep(0.0, bz, s) * (1.0 - smoothstep(DL - bz, DL, s));
  float across = 1.0 - smoothstep(HW - xpx, HW + xpx, abs(abs(X) - LANE));
  vec2 g = floor(vec2(X * 160.0, (z + run) * 40.0));
  float wear = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453);
  float a = along * across * clamp(1.15 - z / 30.0, 0.0, 1.0) * (0.8 - 0.22 * nr * wear);
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  vec3 paint = vec3(clamp(lum * 2.6 + 0.2, 0.0, 0.72)) * vec3(0.86, 1.0, 0.84);   // um toque do verde da cena
  gl_FragColor = vec4(mix(c, paint, a), 1.0);
}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ["view", "span", "pxs", "run", "tex", "asf"].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });
  gl.uniform1i(U.tex, 0); gl.uniform1i(U.asf, 1);
  // textura do asfalto (unidade 1): começa neutra (cinza 50%) até a imagem chegar; repete e usa mipmaps (nítida perto, sem cintilar longe)
  const asfTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, asfTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([128]));
  [[gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT], [gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]].forEach(([k, val]) => gl.texParameteri(gl.TEXTURE_2D, k, val));
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  function putAsf(source) {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, asfTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE0); draw();
  }
  function loadAsf() {
    const im = new Image(); im.onload = () => { try { putAsf(im); } catch (e) { /* file:// sem a cópia embutida: segue sem a textura */ } };
    im.src = location.protocol === "file:" && window.ESTRADA_V2_TEX ? window.ESTRADA_V2_TEX.asfalto : "contador/img/estrada-v2-asfalto.webp?v=98a4e1a5";
  }
  gl.activeTexture(gl.TEXTURE0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]].forEach(([k, val]) => gl.texParameteri(gl.TEXTURE_2D, k, val));

  /* ---------- a textura: a mesma foto que o <img> mostra (deitada ou o recorte em pé) ---------- */
  let ready = false;
  function upload(source, port) {
    try {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    } catch (e) {
      // aberto direto do disco (file://): o navegador não deixa o WebGL ler a foto; usa a cópia embutida em JS
      if (location.protocol === "file:" && !window.ESTRADA_V2_TEX) {
        const s = document.createElement("script"); s.src = "contador/img/estrada-v2-tex.js";
        s.onload = () => fromImg(); document.head.appendChild(s);
      }
      return;
    }
    gl.uniform2f(U.span, port ? 0.25 : 0, port ? 0.5 : 1);
    ready = true; cv.classList.add("is-on"); draw(); kick();
    loadAsf();
  }
  function fromImg() {
    if (!img.complete || !img.naturalWidth) return;
    const port = /-port\./.test(img.currentSrc || img.src);
    if (location.protocol === "file:" && window.ESTRADA_V2_TEX) {
      const im = new Image(); im.onload = () => upload(im, port); im.src = window.ESTRADA_V2_TEX[port ? "port" : "land"]; return;
    }
    upload(img, port);
  }
  img.addEventListener("load", fromImg);

  /* ---------- medidas: o canvas cobre só o chão (do horizonte para baixo) e só a parte visível da foto ---------- */
  let W = 0, H = 0, D = 1;
  function measure() {
    W = box.offsetWidth; H = box.offsetHeight;
    const half = Math.min(W, stage.clientWidth) / 2 + 40;
    const L = Math.max(0, W / 2 - half), CW = Math.min(W, W / 2 + half) - L;
    const T = Math.floor((0.5645 - 0.01) * H), CH = H - T;
    D = Math.min(window.devicePixelRatio || 1, 1.5);
    Object.assign(cv.style, { left: L + "px", top: T + "px", width: CW + "px", height: CH + "px" });
    cv.width = Math.round(CW * D); cv.height = Math.round(CH * D);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform4f(U.view, L / W, T / H, CW / W, CH / H);
    gl.uniform2f(U.pxs, 1 / (W * D), 1 / (H * D));
    draw();
  }
  let run = 0;
  function draw() { if (!ready) return; gl.uniform1f(U.run, run); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  /* ---------- relógio: só roda com o painel na tela, sem pausa, aba visível e sem "reduzir movimento" ---------- */
  let raf = 0, last = 0;
  const active = () => ready && !reduce && !document.hidden && document.body.dataset.scene === "painel" && !document.body.classList.contains("is-paused");
  function frame(t) {
    raf = 0;
    if (!active()) { last = 0; return; }
    if (last) run = (run + SPEED * Math.min(0.05, (t - last) / 1000)) % 2080;   // 2080 = múltiplo dos ciclos (1,6 e 2,6) e do ladrilho do asfalto (0,4)
    last = t;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && active()) { last = 0; raf = requestAnimationFrame(frame); } }
  new ResizeObserver(measure).observe(stage);
  new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ["class", "data-scene"] });
  document.addEventListener("visibilitychange", kick);
  measure();
  fromImg();
})();
