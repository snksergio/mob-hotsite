/* iGreen · kit 3D em código: o carregador e a estrutura do eletroposto (cobertura, letreiro, vagas)
   e um ambiente noturno de estacionamento. Nada aqui é imagem 3D gerada: é geometria com cantos
   arredondados, pintura com verniz e logos vetoriais rasterizados em alta resolução, por isso fica
   nítido em qualquer distância de câmera.

   Uso: IGKit.build(THREE, { logoSvg, font }) → Promise<{ root, charger, kiosk, world, set(k, env), anchors }>
   Unidades em metros; o carregador fica na origem, de frente para +Z. */
(function () {
  "use strict";
  const KIT = {};
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const backOut = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  /* ---------- formas e geometrias ---------- */
  function rrect(T, w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    r = Math.max(0.0005, Math.min(r, w / 2 - 0.0001, h / 2 - 0.0001));
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  /* caixa com cantos e arestas arredondados (perfil frontal em XY, profundidade em Z, centrada) */
  function rbox(T, w, h, d, r, b, seg) {
    b = Math.min(b, w / 2.2, h / 2.2, d / 2.2);
    const g = new T.ExtrudeGeometry(rrect(T, w - 2 * b, h - 2 * b, Math.max(0.0008, r - b)), {
      depth: Math.max(0.0005, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: seg || 5, curveSegments: 12
    });
    g.translate(0, 0, -(d - 2 * b) / 2);
    g.computeVertexNormals();
    return g;
  }
  /* plano com o contorno de um retângulo arredondado e UV de 0 a 1 */
  function rplane(T, w, h, r) {
    const g = new T.ShapeGeometry(rrect(T, w, h, r), 24);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return g;
  }

  /* ---------- texturas desenhadas aqui ---------- */
  function canvasTex(T, w, h, draw, srgb) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  function svgImage(svg, viewBox, w, h) {
    let s = svg.replace(/viewBox="[^"]*"/, 'viewBox="' + viewBox + '"');
    s = s.replace("<svg ", '<svg width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet" ');
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    });
  }
  const glowTex = (T) => canvasTex(T, 256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const stripTex = (T) => canvasTex(T, 64, 256, (g, w, h) => {
    const r = g.createLinearGradient(0, 0, 0, h);
    r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.5, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  /* sombra de contato: mancha escura e macia, pintada no chão em vez de calculada a cada quadro */
  const shadowTex = (T) => canvasTex(T, 256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(0,0,0,1)"); r.addColorStop(0.45, "rgba(0,0,0,.75)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, false);
  /* asfalto: ruído fino + manchas largas (cor e rugosidade) */
  function asphaltTex(T) {
    return canvasTex(T, 1024, 1024, (g, w, h) => {
      g.fillStyle = "#26292a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 60 + Math.random() * 220;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.05 + Math.random() * 0.07, dark = Math.random() < 0.6;
        gr.addColorStop(0, dark ? "rgba(0,0,0," + a + ")" : "rgba(255,255,255," + a * 0.5 + ")");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      const img = g.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(img, 0, 0);
    });
  }
  /* tela do carregador: interface de recarga desenhada em alta resolução */
  function screenTex(T, font) {
    return canvasTex(T, 640, 920, (g, w, h) => {
      const F = (wgt, px) => wgt + " " + px + "px " + (font || "Arial, sans-serif");
      g.fillStyle = "#06100b"; g.fillRect(0, 0, w, h);
      const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "rgba(3,255,31,.10)"); bg.addColorStop(0.6, "rgba(3,255,31,0)");
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = "#cfe9d6"; g.font = F(500, 34);
      g.textAlign = "right"; g.fillText("10:24", w - 56, 84);
      g.textAlign = "left";
      g.strokeStyle = "#cfe9d6"; g.lineWidth = 5; g.lineCap = "round";
      [10, 20, 30].forEach((r, i) => { g.beginPath(); g.arc(80, 92, r, Math.PI * 1.25, Math.PI * 1.75); g.globalAlpha = 1 - i * 0.2; g.stroke(); });
      g.globalAlpha = 1;
      g.fillStyle = "#e9f4ec"; g.font = F(500, 42); g.textAlign = "center"; g.fillText("Carregando", w / 2, 210);
      const bx = 76, by = 250, bw = w - 152, bh = 30;
      g.fillStyle = "rgba(255,255,255,.12)"; roundRect(g, bx, by, bw, bh, 15); g.fill();
      const fill = g.createLinearGradient(bx, 0, bx + bw * 0.78, 0); fill.addColorStop(0, "#0fd23a"); fill.addColorStop(1, "#3dff5a");
      g.fillStyle = fill; roundRect(g, bx, by, bw * 0.78, bh, 15); g.fill();
      g.fillStyle = "#ffffff"; g.font = F(600, 150); g.fillText("78", w / 2 - 34, 470);
      g.font = F(600, 64); g.fillText("%", w / 2 + 104, 470);
      g.font = F(500, 30); g.fillStyle = "#a9c9b2";
      [["22,4 kW", w * 0.2], ["320 V", w * 0.5], ["63 A", w * 0.8]].forEach(([t, x]) => {
        g.strokeStyle = "rgba(169,201,178,.7)"; g.lineWidth = 3; g.beginPath(); g.arc(x, 560, 26, 0, Math.PI * 2); g.stroke();
        g.fillText(t, x, 640);
      });
      g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(70, 700, w - 140, 2);
      g.font = F(500, 30); g.fillStyle = "#7fe395"; g.fillText("Aproxime o cartão", w / 2, 780);
      g.font = F(400, 26); g.fillStyle = "#86a38f"; g.fillText("ou pague pelo app iGreen MOB", w / 2, 830);
    });
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /* ícone de pagamento por aproximação no leitor redondo */
  const nfcTex = (T) => canvasTex(T, 256, 256, (g, w, h) => {
    g.fillStyle = "#0b0f0d"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#7a8a80"; g.lineWidth = 9; g.lineCap = "round";
    [30, 56, 82].forEach((r) => { g.beginPath(); g.arc(w * 0.36, h / 2, r, -Math.PI / 4, Math.PI / 4); g.stroke(); });
  });

  /* ---------- o carregador ---------- */
  function makeCharger(T, M, tex) {
    const G = new T.Group();
    G.name = "charger";
    const W = 0.74, H = 1.56, D = 0.38, BASE = 0.1;
    const front = D / 2;
    // base metálica com parafusos
    const base = new T.Mesh(rbox(T, W + 0.08, BASE, D + 0.1, 0.03, 0.015), M.base);
    base.position.y = BASE / 2; G.add(base);
    const bolts = new T.InstancedMesh(new T.CylinderGeometry(0.011, 0.011, 0.008, 16), M.bolt, 9);
    const bq = new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)), bm = new T.Matrix4(), one = new T.Vector3(1, 1, 1);
    for (let i = 0; i < 9; i++) bolts.setMatrixAt(i, bm.compose(new T.Vector3(-0.36 + i * 0.09, BASE * 0.5, (D + 0.1) / 2 + 0.003), bq, one));
    G.add(bolts);
    // sombra de contato sob a base
    const cs = new T.Mesh(new T.PlaneGeometry(1.7, 1.1), M.contact);
    cs.rotation.x = -Math.PI / 2; cs.position.set(0.02, 0.003, -0.03); G.add(cs);
    // corpo
    const body = new T.Mesh(rbox(T, W, H, D, 0.05, 0.028, 6), M.paint);
    body.position.y = BASE + H / 2; G.add(body);
    // tampa de cima, com o vão discreto
    const seam = new T.Mesh(new T.BoxGeometry(W - 0.05, 0.006, 0.004), M.seam);
    seam.position.set(0, BASE + H - 0.075, front + 0.0005); G.add(seam);
    const seamS = new T.Mesh(new T.BoxGeometry(0.004, 0.006, D - 0.05), M.seam);
    [-1, 1].forEach((s) => { const m = seamS.clone(); m.position.set(s * (W / 2 + 0.0005), BASE + H - 0.075, 0); G.add(m); });
    // contorno da porta frontal (um vão fino, como no gabinete real)
    const dw = W - 0.09, dh = H - 0.2;
    const outer = rrect(T, dw, dh, 0.035), inner = rrect(T, dw - 0.008, dh - 0.008, 0.031);
    outer.holes.push(new T.Path(inner.getPoints(12)));
    const doorLine = new T.Mesh(new T.ShapeGeometry(outer, 12), M.seam);
    doorLine.position.set(0, BASE + 0.06 + dh / 2, front + 0.0008); G.add(doorLine);
    // moldura da tela (cápsula preta) + tela + leitor
    const bez = new T.Mesh(rbox(T, 0.215, 0.43, 0.03, 0.105, 0.01), M.gloss);
    bez.position.set(0, BASE + H - 0.37, front + 0.006); G.add(bez);
    const scr = new T.Mesh(rplane(T, 0.165, 0.245, 0.06), M.screen);
    scr.position.set(0, BASE + H - 0.33, front + 0.0215); G.add(scr);
    const ring = new T.Mesh(new T.TorusGeometry(0.036, 0.004, 12, 48), M.ringMetal);
    ring.position.set(0, BASE + H - 0.52, front + 0.022); G.add(ring);
    const nfc = new T.Mesh(new T.CircleGeometry(0.032, 40), new T.MeshStandardMaterial({ map: tex.nfc, roughness: 0.35 }));
    nfc.position.set(0, BASE + H - 0.52, front + 0.0215); G.add(nfc);
    // trava lateral
    const latch = new T.Mesh(rbox(T, 0.036, 0.11, 0.022, 0.012, 0.006), M.gloss);
    latch.position.set(0.3, BASE + H - 0.6, front + 0.008); G.add(latch);
    const key = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.01, 16), M.bolt);
    key.rotation.x = Math.PI / 2; key.position.set(0.3, BASE + H - 0.63, front + 0.02); G.add(key);
    // logos vetoriais: o G de folhas e lâmpada e a palavra iGreen
    const gLogo = new T.Mesh(new T.PlaneGeometry(0.36, 0.48), M.logoG);
    gLogo.position.set(0, BASE + 0.58, front + 0.0012); G.add(gLogo);
    const word = new T.Mesh(new T.PlaneGeometry(0.3, 0.3 / 3.595), M.logoWord);
    word.position.set(0, BASE + 0.17, front + 0.0012); G.add(word);
    // janela lateral esquerda
    const vent = new T.Mesh(rbox(T, 0.016, 0.1, 0.05, 0.008, 0.004), M.gloss);
    vent.position.set(-W / 2 - 0.004, BASE + H - 0.2, 0.06); G.add(vent);
    // suportes, conectores e cabos dos dois lados
    const anchors = {};
    [-1, 1].forEach((s) => {
      const hol = new T.Mesh(rbox(T, 0.06, 0.13, 0.12, 0.02, 0.01), M.plastic);
      hol.position.set(s * (W / 2 + 0.03), BASE + 1.12, 0.05); G.add(hol);
      // conector: empunhadura inclinada + cabeça com anel verde
      const plug = new T.Group();
      const grip = new T.Mesh(rbox(T, 0.05, 0.17, 0.055, 0.022, 0.012), M.plastic);
      grip.position.y = -0.04; plug.add(grip);
      // a cabeça aponta para a frente, com o anel verde à mostra
      const head = new T.Mesh(new T.CylinderGeometry(0.034, 0.03, 0.085, 28), M.plastic);
      head.rotation.x = Math.PI / 2; head.position.set(0, 0.055, 0.045); plug.add(head);
      const tip = new T.Mesh(new T.TorusGeometry(0.028, 0.0045, 10, 36), M.neonRing);
      tip.position.set(0, 0.055, 0.089); plug.add(tip);
      const face = new T.Mesh(new T.CircleGeometry(0.025, 28), M.gloss);
      face.position.set(0, 0.055, 0.0885); plug.add(face);
      plug.position.set(s * (W / 2 + 0.07), BASE + 1.14, 0.06);
      plug.rotation.z = s * -0.18;
      G.add(plug);
      anchors[s < 0 ? "plugL" : "plugR"] = new T.Vector3(s * (W / 2 + 0.1), BASE + 1.18, 0.07);
      // cabo enrolado no suporte: três laços pendurados, de comprimentos diferentes, como no carregador real
      const x0 = W / 2;
      const U = (yb, xo, zc) => [[0.05, 1.06, zc + 0.02], [xo * 0.62, 0.98, zc + 0.05], [xo, 0.78, zc + 0.07], [xo * 1.06, yb + 0.2, zc + 0.05], [xo * 0.78, yb, zc], [xo * 0.4, yb + 0.1, zc - 0.05], [xo * 0.22, 0.62, zc - 0.07], [0.04, 0.98, zc - 0.03]];
      [U(0.2, 0.27, 0.07), U(0.32, 0.22, 0.0), U(0.44, 0.17, -0.08)].forEach((pts, i) => {
        const curve = new T.CatmullRomCurve3(pts.map(([x, y, z]) => new T.Vector3(s * (x0 + x), BASE + y, z)));
        G.add(new T.Mesh(new T.TubeGeometry(curve, 160, 0.021, 14, false), M.rubber));
      });
      // a ponta que entra no corpo, por baixo dos laços
      const feed = new T.CatmullRomCurve3([[0.04, 0.98, -0.1], [0.08, 0.7, -0.14], [0.06, 0.4, -0.14], [0.0, 0.3, -0.12]].map(([x, y, z]) => new T.Vector3(s * (x0 + x), BASE + y, z)));
      G.add(new T.Mesh(new T.TubeGeometry(feed, 60, 0.021, 14, false), M.rubber));
    });
    anchors.screen = new T.Vector3(0, BASE + H - 0.3, front + 0.03);
    anchors.g = new T.Vector3(0.02, BASE + 0.62, front + 0.01);
    anchors.word = new T.Vector3(0.02, BASE + 0.17, front + 0.01);
    return { group: G, anchors, height: BASE + H };
  }

  /* ---------- a estrutura do eletroposto: pilares, cobertura com LED, letreiro e vagas ---------- */
  function makeKiosk(T, M, tex) {
    const K = new T.Group();
    K.name = "kiosk";
    const RX = 3.9, RZ = 2.7, RY = 3.42, RH = 0.26;
    const parts = { posts: [], leds: [], downs: [], glows: [] };
    // pilares
    const postG = rbox(T, 0.17, 1, 0.17, 0.03, 0.015);
    [[-3.55, -2.25], [3.55, -2.25], [-3.55, 2.3], [3.55, 2.3]].forEach(([x, z]) => {
      const p = new T.Mesh(postG, M.kiosk);
      p.position.set(x, 0, z); p.userData.h = RY + 0.13; p.castShadow = true; p.receiveShadow = true;
      K.add(p); parts.posts.push(p);
      const foot = new T.Mesh(new T.BoxGeometry(0.34, 0.04, 0.34), M.base);
      foot.position.set(x, 0.02, z); K.add(foot); parts.posts.push(foot);
      const cs = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), M.contact);
      cs.rotation.x = -Math.PI / 2; cs.position.set(x, 0.011, z); K.add(cs); parts.posts.push(cs);
    });
    // cobertura (cai de cima até o lugar), como a da iGreen: quadro verde aparente, forro recuado e tubos de LED
    const roof = new T.Group();
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; roof.add(m); return m; };
    // vigas do contorno (a "testeira" verde)
    const beamFB = rbox(T, RX * 2, RH, 0.12, 0.03, 0.014);
    add(new T.Mesh(beamFB, M.kiosk), 0, RH / 2, RZ - 0.06);
    add(new T.Mesh(beamFB, M.kiosk), 0, RH / 2, -RZ + 0.06);
    const beamS = rbox(T, 0.12, RH, RZ * 2 - 0.2, 0.03, 0.014);
    add(new T.Mesh(beamS, M.kiosk), RX - 0.06, RH / 2, 0);
    add(new T.Mesh(beamS, M.kiosk), -RX + 0.06, RH / 2, 0);
    // tampo por cima
    const deck = new T.Mesh(new T.BoxGeometry(RX * 2 - 0.16, 0.05, RZ * 2 - 0.16), M.deck);
    add(deck, 0, RH - 0.03, 0);
    // forro claro, recuado: o quadro verde fica à mostra por baixo
    const ceil = new T.Mesh(new T.PlaneGeometry(RX * 2 - 0.24, RZ * 2 - 0.24), M.ceiling);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 0.13; roof.add(ceil);
    // vigas transversais e longitudinais sob o forro
    const crossX = rbox(T, RX * 2 - 0.24, 0.12, 0.09, 0.02, 0.01);
    [-0.9, 0.9].forEach((z) => add(new T.Mesh(crossX, M.kiosk), 0, 0.07, z));
    const crossZ = rbox(T, 0.09, 0.12, RZ * 2 - 0.24, 0.02, 0.01);
    [-1.3, 1.3].forEach((x) => add(new T.Mesh(crossZ, M.kiosk), x, 0.07, 0));
    // tubos de LED curtos entre as vigas + brilho
    const tubeG = new T.CapsuleGeometry(0.022, 1.25, 6, 14);
    [[-2.6, -1.8], [0, -1.8], [2.6, -1.8], [-2.6, 0], [0, 0], [2.6, 0], [-2.6, 1.8], [0, 1.8], [2.6, 1.8]].forEach(([x, z]) => {
      const tb = new T.Mesh(tubeG, M.ledCool);
      tb.rotation.z = Math.PI / 2; tb.position.set(x, 0.1, z); roof.add(tb); parts.leds.push(tb);
      const gl = new T.Mesh(new T.PlaneGeometry(1.9, 0.6), new T.MeshBasicMaterial({ map: tex.strip, color: 0xd9ffe4, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
      gl.rotation.x = Math.PI / 2; gl.position.set(x, 0.07, z); roof.add(gl); parts.glows.push({ m: gl, max: 0.42 });
    });
    // filete de LED verde sob a testeira (a luz verde que banha o chão)
    const edge = [[RX * 2 - 0.3, 0.025, 0.025, 0, RZ - 0.13], [RX * 2 - 0.3, 0.025, 0.025, 0, -RZ + 0.13], [0.025, 0.025, RZ * 2 - 0.3, RX - 0.13, 0], [0.025, 0.025, RZ * 2 - 0.3, -RX + 0.13, 0]];
    edge.forEach(([w, h, d, x, z]) => {
      const e = new T.Mesh(new T.BoxGeometry(w, h, d), M.ledGreen);
      e.position.set(x, 0.015, z); roof.add(e); parts.leds.push(e);
    });
    // letreiro iGreen: cápsula escura com as letras brancas acesas, no canto da frente
    const sign = new T.Group();
    const box = new T.Mesh(rbox(T, 2.3, 0.64, 0.28, 0.32, 0.05), M.signBox);
    box.castShadow = true; sign.add(box);
    const face = new T.Mesh(rplane(T, 2.18, 0.53, 0.265), M.signFace);
    face.position.z = 0.141; sign.add(face);
    const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.141; sign.add(back);
    const sGlow = new T.Mesh(new T.PlaneGeometry(3.8, 1.7), new T.MeshBasicMaterial({ map: tex.glow, color: 0xbfffd0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sGlow.position.z = 0.18; sign.add(sGlow); parts.glows.push({ m: sGlow, max: 0.26, sign: true });
    const SX = RX - 1.45;
    sign.position.set(SX, RH + 0.3, RZ - 0.06);
    roof.add(sign);
    roof.position.y = RY;
    K.add(roof);
    // poça de luz verde no chão, sob a cobertura
    const pool = new T.Mesh(new T.PlaneGeometry(RX * 2 + 1.5, RZ * 2 + 1.5), new T.MeshBasicMaterial({ map: tex.glow, color: 0x2bff5c, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.008, 0.2); K.add(pool); parts.glows.push({ m: pool, max: 0.22 });
    // luz de teto apontando para o chão, larga o bastante para as duas vagas
    const down = new T.SpotLight(0xe6ffec, 0, 11, 1.12, 0.8, 1.3);
    down.position.set(0, RY + 0.08, 0.3); down.target.position.set(0, 0, 0.3);
    K.add(down); K.add(down.target); parts.downs.push(down);
    // vagas: pintura verde, faixas brancas e o G pintado no chão
    const bays = new T.Group();
    [[-2.05], [2.05]].forEach(([x]) => {
      const paint = new T.Mesh(new T.PlaneGeometry(2.5, 5.0), M.bayPaint);
      paint.rotation.x = -Math.PI / 2; paint.position.set(x, 0.004, 0.25); paint.receiveShadow = true; bays.add(paint);
      const gpaint = new T.Mesh(new T.PlaneGeometry(1.15, 1.53), M.bayLogo);
      gpaint.rotation.x = -Math.PI / 2; gpaint.position.set(x, 0.006, 1.15); bays.add(gpaint);
    });
    [[-3.3], [-0.8], [0.8], [3.3]].forEach(([x]) => {
      const line = new T.Mesh(new T.PlaneGeometry(0.09, 5.0), M.bayLine);
      line.rotation.x = -Math.PI / 2; line.position.set(x, 0.005, 0.25); bays.add(line);
    });
    const stop = new T.Mesh(new T.PlaneGeometry(6.6, 0.09), M.bayLine);
    stop.rotation.x = -Math.PI / 2; stop.position.set(0, 0.005, -2.25); bays.add(stop);
    K.add(bays);
    parts.roof = roof; parts.sign = sign; parts.bays = bays; parts.RY = RY;
    const anchors = {
      roof: new T.Vector3(-2.6, RY + 0.06, RZ + 0.02),
      sign: new T.Vector3(SX - 1.02, RY + RH + 0.3, RZ + 0.1),
      bay: new T.Vector3(2.05, 0.01, 1.15)
    };
    return { group: K, parts, anchors };
  }

  /* ---------- o entorno: chão, postes, árvores ---------- */
  function makeWorld(T, M, tex) {
    const Wd = new T.Group();
    Wd.name = "world";
    const ground = new T.Mesh(new T.PlaneGeometry(90, 90), M.ground);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; Wd.add(ground);
    // calçada atrás da cobertura
    const curb = new T.Mesh(new T.BoxGeometry(22, 0.14, 1.6), M.concrete);
    curb.position.set(0, 0.07, -4.6); curb.receiveShadow = true; Wd.add(curb);
    // postes com luz quente
    const lamps = [];
    [[-7.2, -5.6], [7.6, -5.4], [-11.5, 4.5], [12, 3.5]].forEach(([x, z]) => {
      const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 6.4, 12), M.pole);
      pole.position.set(x, 3.2, z); Wd.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.08), M.pole);
      arm.position.set(x + (x > 0 ? -0.4 : 0.4), 6.35, z); Wd.add(arm);
      const head = new T.Mesh(new T.BoxGeometry(0.42, 0.08, 0.2), M.pole);
      const hx = x + (x > 0 ? -0.8 : 0.8);
      head.position.set(hx, 6.32, z); Wd.add(head);
      const bulb = new T.Mesh(new T.BoxGeometry(0.34, 0.02, 0.14), M.ledWarm);
      bulb.position.set(hx, 6.27, z); Wd.add(bulb);
      const gl = new T.Sprite(new T.SpriteMaterial({ map: tex.glow, color: 0xffc27a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
      gl.scale.set(2.6, 2.6, 1); gl.position.set(hx, 6.2, z); Wd.add(gl);
      const pool = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: tex.glow, color: 0xffb066, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(hx, 0.012, z); Wd.add(pool);
      lamps.push({ gl, pool });
    });
    // árvores ao fundo (silhuetas que somem na névoa)
    const trunkG = new T.CylinderGeometry(0.09, 0.14, 1, 8);
    // copas: esferas suavizadas com um leve relevo (duas variações, instanciadas)
    const leafGs = [0, 1].map((v) => {
      const g = new T.IcosahedronGeometry(1, 3), p = g.attributes.position, q = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        q.fromBufferAttribute(p, i);
        const n = 1 + 0.07 * Math.sin(q.x * 5.1 + v * 2) * Math.sin(q.y * 4.3 + v) + 0.05 * Math.sin(q.z * 7.7 + q.x * 3 + v * 3);
        q.multiplyScalar(n); p.setXYZ(i, q.x, q.y, q.z);
      }
      g.computeVertexNormals();
      return g;
    });
    const rnd = (a, b) => a + Math.random() * (b - a);
    const trunks = [], leaves = [[], []];
    for (let i = 0; i < 26; i++) {
      // só atrás e dos lados: nada entre a câmera e a cobertura
      const ang = rnd(-Math.PI * 1.05, Math.PI * 0.05);
      const rad = rnd(11, 24);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad * 0.8 - 3;
      if (z > -1 && Math.abs(x) < 12) continue;
      const hgt = rnd(2.4, 4.2);
      trunks.push(new T.Matrix4().compose(new T.Vector3(x, hgt / 2, z), new T.Quaternion(), new T.Vector3(1, hgt, 1)));
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const sc = rnd(1.0, 1.7);
        leaves[k % 2].push(new T.Matrix4().compose(new T.Vector3(x + rnd(-0.6, 0.6), hgt + rnd(-0.2, 0.9), z + rnd(-0.5, 0.5)), new T.Quaternion().setFromEuler(new T.Euler(0, rnd(0, 6.28), 0)), new T.Vector3(sc, sc * rnd(0.8, 1.05), sc)));
      }
    }
    const inst = (geo, mat, list) => { const m = new T.InstancedMesh(geo, mat, list.length); list.forEach((mx, i) => m.setMatrixAt(i, mx)); m.computeBoundingSphere(); Wd.add(m); };
    inst(trunkG, M.trunk, trunks);
    leaves.forEach((list, v) => inst(leafGs[v], M.leaf, list));
    const props = Wd.children.filter((o) => o !== ground && !o.isLight);
    // brilho baixo no horizonte (a cidade iluminando o céu) e pontos de luz distantes
    const horizon = new T.Mesh(new T.PlaneGeometry(160, 26), new T.MeshBasicMaterial({ map: canvasTex(T, 8, 256, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(0.7, 'rgba(40,90,70,.55)'); r.addColorStop(1, 'rgba(90,120,90,.9)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }), transparent: true, opacity: 0, depthWrite: false, fog: false }));
    horizon.position.set(0, 9, -46); Wd.add(horizon);
    const city = [];
    [[46, 0.5], [24, 0.95]].forEach(([n, size]) => {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new T.Color();
      for (let i = 0; i < n; i++) {
        pos.set([-45 + Math.random() * 90, 0.4 + Math.random() * 3.2, -32 - Math.random() * 10], i * 3);
        c.setHex(Math.random() < 0.7 ? 0xffc27a : 0xd9fff0).multiplyScalar(0.25 + Math.random() * 0.55);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setAttribute("color", new T.BufferAttribute(col, 3));
      const pts = new T.Points(g, new T.PointsMaterial({ map: tex.glow, size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
      Wd.add(pts); city.push(pts);
    });
    return { group: Wd, lamps, ground, props, city, horizon };
  }

  /* ---------- montagem ----------
     Materiais: o carregador usa PBR com reflexo de estúdio (é o que aparece de perto); cenário, chão, cobertura e
     árvores usam Lambert/Phong, que não calculam o reflexo de ambiente e custam bem menos por pixel. */
  KIT.build = async function (T, opts) {
    opts = opts || {};
    const font = opts.font || "Arial, sans-serif";
    const svg = opts.logoSvg;
    const [gImg, wImg] = svg ? await Promise.all([
      svgImage(svg, "232 106 380 497", 900, 1178),
      svgImage(svg, "115 99 1801 501", 2400, 668)
    ]) : [null, null];
    const tex = { glow: glowTex(T), strip: stripTex(T), nfc: nfcTex(T), screen: screenTex(T, font), asphalt: asphaltTex(T), shadow: shadowTex(T) };
    tex.asphalt.wrapS = tex.asphalt.wrapT = T.RepeatWrapping; tex.asphalt.repeat.set(14, 14);
    const logoTex = (img, w, h, color) => canvasTex(T, w, h, (g) => { if (img) g.drawImage(img, 0, 0, w, h); if (color) { g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, w, h); } });
    tex.g = logoTex(gImg, 900, 1178);
    tex.word = logoTex(wImg, 2400, 668);
    tex.gPaint = logoTex(gImg, 900, 1178, "#e9efe9");
    // letreiro: fundo verde escuro, filete neon e a palavra iGreen acesa
    const wordWhite = logoTex(wImg, 2400, 668, "#ffffff");
    tex.sign = canvasTex(T, 2048, 500, (g, w, h) => {
      g.fillStyle = "#06200f"; g.fillRect(0, 0, w, h);
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.55); gr.addColorStop(0, "rgba(30,140,70,.4)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#2fe45a"; g.lineWidth = 10; roundRect(g, 22, 22, w - 44, h - 44, (h - 44) / 2); g.stroke();
      const lw = w * 0.66, lh = lw / 3.595, lx = (w - lw) / 2, ly = (h - lh) / 2;
      g.shadowColor = "rgba(200,255,215,.95)"; g.shadowBlur = 46; g.drawImage(wordWhite.image, lx, ly, lw, lh);
      g.shadowBlur = 12; g.drawImage(wordWhite.image, lx, ly, lw, lh);
    });
    const M = {
      paint: new T.MeshPhysicalMaterial({ color: 0x139140, roughness: 0.34, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05 }),
      kiosk: new T.MeshPhongMaterial({ color: 0x0f8a3e, specular: 0x1c3324, shininess: 30, emissive: 0x05301a }),
      deck: new T.MeshLambertMaterial({ color: 0x0a4a24 }),
      base: new T.MeshStandardMaterial({ color: 0x0d6a2c, roughness: 0.36, metalness: 0.2 }),
      bolt: new T.MeshStandardMaterial({ color: 0xc9d1cb, roughness: 0.25, metalness: 1 }),
      seam: new T.MeshStandardMaterial({ color: 0x063218, roughness: 0.6 }),
      gloss: new T.MeshPhysicalMaterial({ color: 0x07090a, roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }),
      plastic: new T.MeshStandardMaterial({ color: 0x15191a, roughness: 0.42, metalness: 0.05 }),
      rubber: new T.MeshStandardMaterial({ color: 0x0b0c0c, roughness: 0.44, metalness: 0 }),
      ringMetal: new T.MeshStandardMaterial({ color: 0x8c9690, roughness: 0.3, metalness: 1 }),
      neonRing: new T.MeshStandardMaterial({ color: 0x0b2a14, emissive: 0x24ff4c, emissiveIntensity: 1.4, roughness: 0.3 }),
      screen: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex.screen, emissiveIntensity: 1.05, roughness: 0.08, metalness: 0 }),
      logoG: new T.MeshStandardMaterial({ map: tex.g, transparent: true, roughness: 0.38, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
      logoWord: new T.MeshStandardMaterial({ map: tex.word, transparent: true, roughness: 0.38, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
      ceiling: new T.MeshLambertMaterial({ color: 0xc9dccf, emissive: 0x9dffb4, emissiveIntensity: 0, side: T.DoubleSide }),
      ledCool: new T.MeshLambertMaterial({ color: 0x223322, emissive: 0xf2fff2, emissiveIntensity: 0 }),
      ledWarm: new T.MeshLambertMaterial({ color: 0x332211, emissive: 0xffc98a, emissiveIntensity: 0 }),
      ledGreen: new T.MeshLambertMaterial({ color: 0x0b2a14, emissive: 0x2bff5c, emissiveIntensity: 0 }),
      signBox: new T.MeshPhongMaterial({ color: 0x0a3a1d, specular: 0x2a4a34, shininess: 60 }),
      contact: new T.MeshBasicMaterial({ color: 0x000000, map: tex.shadow, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }),
      signFace: new T.MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex.sign, emissiveIntensity: 0.15 }),
      bayPaint: new T.MeshLambertMaterial({ color: 0x0c7d36, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1 }),
      bayLine: new T.MeshLambertMaterial({ color: 0xe8ece8, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 }),
      bayLogo: new T.MeshLambertMaterial({ map: tex.gPaint, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false }),
      ground: new T.MeshLambertMaterial({ color: 0x5a5f5c, map: tex.asphalt }),
      concrete: new T.MeshLambertMaterial({ color: 0x3b403d }),
      pole: new T.MeshLambertMaterial({ color: 0x23282a }),
      trunk: new T.MeshLambertMaterial({ color: 0x1c1a14 }),
      leaf: new T.MeshLambertMaterial({ color: 0x12281a })
    };
    const charger = makeCharger(T, M, tex);
    const kiosk = makeKiosk(T, M, tex);
    const world = makeWorld(T, M, tex);
    const root = new T.Group();
    root.add(world.group, kiosk.group, charger.group);

    /* k: estrutura montada (0..1) · env: ambiente noturno ligado (0..1) */
    function set(k, env) {
      const P = kiosk.parts;
      // pilares sobem do chão
      P.posts.forEach((p, i) => {
        if (!p.userData.h) { p.visible = k > 0.02; return; }
        const e = smooth(0.02 + (i % 4) * 0.02, 0.3, k);
        p.visible = e > 0.001;
        p.scale.y = Math.max(0.001, e * p.userData.h);
        p.position.y = (e * p.userData.h) / 2;
      });
      // cobertura desce até os pilares
      const r = smooth(0.24, 0.58, k);
      P.roof.visible = r > 0.001;
      P.roof.position.y = P.RY + (1 - r) * 3.2;
      // a cobertura acende assim que assenta; depois o letreiro cresce e acende
      const lit = smooth(0.45, 0.7, k);
      const s = clamp01((k - 0.7) / 0.2);
      P.sign.visible = s > 0.001;
      P.sign.scale.setScalar(Math.max(0.001, backOut(s)));
      const signLit = smooth(0.76, 0.96, k);
      M.signFace.emissiveIntensity = 0.15 + 1.25 * signLit;
      // LEDs e luzes de teto
      M.ledCool.emissiveIntensity = 5 * lit;
      M.ledWarm.emissiveIntensity = 3.6 * lit * (0.55 + 0.45 * env);
      M.ceiling.emissiveIntensity = 0.32 * lit;
      M.ledGreen.emissiveIntensity = 4 * lit;
      P.downs.forEach((L) => { L.intensity = 78 * lit; });
      P.glows.forEach((g) => { const o = g.max * (g.sign ? signLit : lit); g.m.material.opacity = o; g.m.visible = o > 0.002; });
      // vagas aparecem pintadas
      const b = smooth(0.12, 0.45, k);
      M.bayPaint.opacity = b; M.bayLine.opacity = b * 0.92; M.bayLogo.opacity = b * 0.9;
      P.bays.visible = b > 0.001;
      // ambiente
      world.lamps.forEach(({ gl, pool }) => { gl.material.opacity = 0.75 * env; pool.material.opacity = 0.32 * env; pool.visible = env > 0.01; });
      world.props.forEach((o) => { o.visible = env > 0.03; });
      world.city.forEach((c) => { c.material.opacity = env; c.visible = env > 0.01; });
      world.horizon.material.opacity = 0.55 * env; world.horizon.visible = env > 0.01;
      // chão: escuro no estúdio, asfalto à noite
      M.ground.color.setRGB(0.13 + 0.32 * env, 0.14 + 0.33 * env, 0.135 + 0.33 * env);
    }
    set(0, 0);
    return {
      root, charger: charger.group, kiosk: kiosk.group, world: world.group, set, M, tex,
      anchors: Object.assign({}, charger.anchors, kiosk.anchors)
    };
  };
  /* reflexos de estúdio: fundo preto com softboxes (em vez de uma sala clara), para a pintura ganhar brilho sem lavar a cor */
  KIT.studioEnv = function (T, renderer) {
    const sc = new T.Scene();
    sc.background = new T.Color(0x000000);
    const box = (w, h, color, k, pos) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0.9, 0); sc.add(m);
    };
    box(6, 2.4, 0xffffff, 2.4, [0, 6, 1.2]);
    box(1.5, 5.5, 0xffffff, 1.8, [-4.2, 1.8, 2.8]);
    box(1.1, 5, 0x7dff98, 1.3, [4.2, 1.5, -1.6]);
    box(1.1, 5, 0x7dff98, 0.9, [-3.6, 1.5, -2.6]);
    box(9, 1.4, 0xc6dccd, 0.22, [0, -1.2, 6]);
    const pm = new T.PMREMGenerator(renderer);
    const tx = pm.fromScene(sc, 0.02).texture;
    pm.dispose();
    return tx;
  };
  window.IGKit = KIT;
})();
