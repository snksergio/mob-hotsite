/* =========================================================
   iGreen MOB · trajetos dos carros na maquete
   Cada trajeto é feito de retas e arcos de verdade (raio fixo), como um carro anda: entra reto na vaga,
   sai de ré girando a traseira para o corredor e segue para a rua na mão certa.
   Medidas no sistema do site (x para a direita, z para a frente, rumo a = rotation.y: 0 = +x, π/2 = -z).
   MQRotas.make(layout) → { bays(model), arrive(x), leave(x), promote(xw, xb), passer(), alpha(x, z), lanes }
   ========================================================= */
(function (root) {
  "use strict";
  const DS = 0.05, PI = Math.PI;
  const dirOf = (a) => [Math.cos(a), -Math.sin(a)];

  function Path(x, z, a) { this.x = x; this.z = z; this.a = a; this.legs = []; this.cur = null; }
  // um trecho com o mesmo perfil de velocidade (v em m/s; ramp = [acelera no começo, freia no fim]; rev = de ré)
  Path.prototype.leg = function (o) {
    this.cur = Object.assign({ v: 5, ramp: [true, true], rev: false }, o, { pts: [this.x, this.z, this.a], len: 0 });
    this.legs.push(this.cur);
    return this;
  };
  Path.prototype._go = function (len, rate) {
    const L = this.cur, n = Math.max(1, Math.ceil(len / DS)), ds = len / n, sg = L.rev ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const am = this.a + rate * ds * 0.5, [dx, dz] = dirOf(am);
      this.x += sg * dx * ds; this.z += sg * dz * ds; this.a += rate * ds;
      L.pts.push(this.x, this.z, this.a);
    }
    L.len += len;
    // amostras a cada DS exato (o último passo pode ser menor): guarda o passo real deste pedaço
    (L.seg || (L.seg = [])).push({ from: L.pts.length / 3 - 1 - n, n, ds });
    return this;
  };
  Path.prototype.line = function (d) { return d > 0.0005 ? this._go(d, 0) : this; };
  // gira o rumo em phi (+ esquerda, - direita) num arco de raio R
  Path.prototype.arc = function (R, phi) { const len = R * Math.abs(phi); return len > 0.0005 ? this._go(len, phi / len) : this; };

  /* posição no trecho a uma distância s do começo */
  function sample(leg, s, out) {
    s = Math.max(0, Math.min(leg.len, s));
    let acc = 0, i = 0;
    for (const sg of leg.seg) {
      const l = sg.n * sg.ds;
      if (s <= acc + l || sg === leg.seg[leg.seg.length - 1]) { const f = Math.min(sg.n, (s - acc) / sg.ds); i = sg.from + f; break; }
      acc += l;
    }
    const i0 = Math.floor(i), i1 = Math.min(leg.pts.length / 3 - 1, i0 + 1), t = i - i0, p = leg.pts;
    out.x = p[i0 * 3] + (p[i1 * 3] - p[i0 * 3]) * t;
    out.z = p[i0 * 3 + 1] + (p[i1 * 3 + 1] - p[i0 * 3 + 1]) * t;
    out.a = p[i0 * 3 + 2] + (p[i1 * 3 + 2] - p[i0 * 3 + 2]) * t;
    return out;
  }
  /* perfil de velocidade em trapézio: quanto andou depois de t segundos (e a duração total) */
  const ACC = 2.4;
  function profile(leg) {
    const L = leg.len, r0 = leg.ramp[0], r1 = leg.ramp[1];
    let v = leg.v;
    const k = (r0 ? 0.5 : 0) + (r1 ? 0.5 : 0);
    if (k && (v * v / ACC) * k > L) v = Math.sqrt((L * ACC) / k);
    const da = r0 ? v * v / (2 * ACC) : 0, dd = r1 ? v * v / (2 * ACC) : 0;
    const t1 = r0 ? v / ACC : 0, t3 = r1 ? v / ACC : 0, t2 = Math.max(0, (L - da - dd) / v);
    leg.T = t1 + t2 + t3;
    leg.sAt = (t) => {
      if (t <= 0) return 0;
      if (t >= leg.T) return L;
      if (t < t1) return 0.5 * ACC * t * t;
      if (t < t1 + t2) return da + v * (t - t1);
      const u = t - t1 - t2; return da + v * t2 + v * u - 0.5 * ACC * u * u;
    };
    return leg;
  }

  /* ---------- as rotas de cada maquete ---------- */
  function make(Lay) {
    const quart = Lay.scene !== "posto";
    const xc = Lay.xc, zStop = Lay.zStop, zA = Lay.zAisle, R = Lay.turnR || 2.0;
    const NEAR = 6.85, FAR = 9.5; // rua: faixa de quem vai para a esquerda (perto do posto) e para a direita
    // Lento: 1 conector, 1 vaga alinhada com o carregador; DUO e Ultra: 2 vagas, uma de cada lado
    const bays = (model) => (model === "lento" ? [xc] : [xc - Lay.duoOff, xc + Lay.duoOff]);
    const done = (p) => { p.legs.forEach(profile); return p.legs; };
    // sai da vaga de ré: anda reto até o corredor e gira a traseira para a direita (fica de frente para a esquerda)
    const backOut = (x) => new Path(x, zStop, PI / 2).leg({ v: 1.7, rev: true }).line(zA - R - zStop).arc(R, PI / 2);
    const api = {
      bays, lanes: { near: NEAR, far: FAR },
      // chega até a vaga x (de carregar ou de espera)
      arrive(x) {
        if (quart) {
          const R1 = 2.6; // curva aberta o bastante para a traseira não invadir a outra faixa
          return done(new Path(17.5, NEAR, PI).leg({ v: 6, ramp: [false, true] }).line(17.5 - (x + R1)).arc(R1, -PI / 2).line(NEAR - R1 - zStop));
        }
        const z0 = (Lay.front || 2.5) - 1.8;
        return done(new Path(x, z0, PI / 2).leg({ v: 1.7, ramp: [false, true] }).line(z0 - zStop));
      },
      // sai da vaga x e vai embora pela esquerda
      leave(x) {
        if (!quart) { const z1 = (Lay.front || 2.5) - 1.8; return done(new Path(x, zStop, PI / 2).leg({ v: 1.6, rev: true, ramp: [true, false] }).line(z1 - zStop)); }
        const p = backOut(x).leg({ v: quart ? 5.5 : 4.2, ramp: [true, false] });
        if (quart) {
          // corredor até passar o posto, troca suave para a faixa da rua (dois arcos) e segue até sumir na borda
          const Rs = 4, th = Math.acos(1 - (NEAR - zA) / (2 * Rs)), xs = xc - 4.5;
          p.line(x + R - xs).arc(Rs, th).arc(Rs, -th).line(p.x + 17.5);
        } else p.line(x + R + 11.5);
        return done(p);
      },
      // carro da espera vai para a vaga xb que vagou
      promote(xw, xb) {
        return done(backOut(xw).leg({ v: 3.2 }).line(xw - xb).arc(R, -PI / 2).line(zA - R - zStop));
      },
      // carro de passagem (só no quarteirão, na faixa de lá: não cruza com quem entra ou sai do posto)
      passer() { return done(new Path(-17.5, FAR, 0).leg({ v: 7, ramp: [false, false] }).line(35)); },
      // opacidade: o carro surge e some inteiro (sem corte), na boca da vaga ("só o posto") ou perto das bordas da rua (quarteirão)
      alpha(x, z) {
        const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
        if (quart) return sm(14.6, 12.4, Math.abs(x));
        const f = Lay.front || 2.5;
        return sm(f - 1.8, f - 3.0, z);
      }
    };
    return api;
  }

  const MQRotas = { make, sample, Path, profile };
  if (typeof module !== "undefined" && module.exports) module.exports = MQRotas;
  else root.MQRotas = MQRotas;
})(typeof window !== "undefined" ? window : globalThis);
