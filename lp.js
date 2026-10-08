/* iGreen MOB · Landing única */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mq = (q) => window.matchMedia(q).matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = !!(G && ST) && !reduce;
  const IG = window.IGCore;
  root.classList.add(motion ? "ready" : "no-anim");
  if (G && ST) G.registerPlugin(ST);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const debounce = (fn, ms = 160) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const VIDEO = "assets/video/migracao.mp4";
  // trecho do vídeo que roda em loop na seção "Na prática" (a parte com a marca iGreen)
  const LOOP_A = 22.2, LOOP_B = 42.6;

  /* ---------- consultor (nome, cidade, WhatsApp) ---------- */
  if (IG) IG.paintConsultant();

  /* ---------- menu em cápsula + barra de progresso + item ativo ---------- */
  const hdr = $("#hdr");
  const fill = $(".charge__fill");
  const navLinks = $$(".hdr__nav a");
  const navTargets = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const measureHdr = () => {
    const inner = $(".hdr__in", hdr);
    const w = hdr.clientWidth;
    const capW = mq("(max-width: 760px)") ? w - 16 : Math.min(1100, w - 24);
    hdr.style.setProperty("--capW", capW + "px");
    hdr.style.setProperty("--pull", Math.max(0, (inner.getBoundingClientRect().width - capW) / 2 + 18) + "px");
  };
  let ticking = false, lastY = 0;
  const mqMob = window.matchMedia("(max-width: 760px)");
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    // celular: o menu some ao descer e volta ao subir (só o logo e "Falar com consultor")
    const dy = y - lastY;
    lastY = y;
    if (mqMob.matches && y > 140) { if (dy > 6) hdr.classList.add("is-hidden"); else if (dy < -6) hdr.classList.remove("is-hidden"); }
    else hdr.classList.remove("is-hidden");
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.setProperty("--p", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : "0");
    hdr.classList.toggle("is-compact", y > 40);
    let on = -1, best = -Infinity;
    navTargets.forEach((t, i) => { const top = t.getBoundingClientRect().top; if (top < window.innerHeight * 0.45 && top > best) { best = top; on = i; } });
    navLinks.forEach((a, i) => a.classList.toggle("is-on", i === on));
    ecoScroll();
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener("scroll", req, { passive: true });
  window.addEventListener("resize", () => { measureHdr(); req(); });
  measureHdr();

  /* ---------- hero: anotações presas a pontos da foto ---------- */
  const placeNotes = () => {
    $$(".hero .slide").forEach((sl) => {
      const notes = $$("[data-note]", sl);
      const img = $("img.cover", sl);
      if (!notes.length || !img || img.naturalWidth < 2) return;
      const pic = img.parentElement;
      const W = pic.clientWidth, H = pic.clientHeight;
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      const pos = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
      const ox = pic.offsetLeft + (W - dw) * (isNaN(pos[0]) ? 0.5 : pos[0]);
      const oy = pic.offsetTop + (H - dh) * (isNaN(pos[1]) ? 0.5 : pos[1]);
      notes.forEach((n) => {
        n.style.transform = `translate(${Math.round(ox + parseFloat(n.dataset.x) * dw)}px, ${Math.round(oy + parseFloat(n.dataset.y) * dh)}px)`;
        n.classList.remove("is-clash");
        n.classList.add("is-placed");
      });
      // em telas baixas ou estreitas a anotação pode cair em cima do título ou do card: some nesse caso
      const keep = $$(".hero__copy > *, .hero__foot > *").map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      notes.forEach((n) => {
        const t = $(".note__txt", n);
        if (!t) return;
        const r = t.getBoundingClientRect();
        const hit = keep.some((k) => r.left < k.right + 12 && r.right > k.left - 12 && r.top < k.bottom + 8 && r.bottom > k.top - 8);
        n.classList.toggle("is-clash", hit);
      });
    });
  };
  const heroImg = $(".hero img.cover");
  if (heroImg) { if (heroImg.complete) placeNotes(); else heroImg.addEventListener("load", placeNotes, { once: true }); }
  window.addEventListener("resize", placeNotes);

  /* ---------- hero: as fotos alternam no fundo; indicador à direita ---------- */
  const hSlides = $$(".hero .slide");
  const hDots = $$(".hd__bars button");
  if (hSlides.length > 1 && hDots.length === hSlides.length) {
    const HDUR = 6500;
    let hi = 0, hT0 = performance.now(), hPaused = false, hVisible = true, hBusy = false, hStarted = false;
    // a foto só é baixada um pouco antes de aparecer
    const prime = (i) => {
      const sl = hSlides[i], img = $("img", sl), src = $("source", sl);
      if (src && src.dataset.srcset) { src.srcset = src.dataset.srcset; src.removeAttribute("data-srcset"); }
      if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
      return img;
    };
    const ready = (img) => {
      if (img.complete && img.naturalWidth > 1) return Promise.resolve();
      return new Promise((res) => { img.addEventListener("load", res, { once: true }); img.addEventListener("error", res, { once: true }); setTimeout(res, 4000); });
    };
    const show = (i) => {
      i = (i + hSlides.length) % hSlides.length;
      if (hBusy || i === hi) return;
      hBusy = true;
      const img = prime(i);
      ready(img).then(() => {
        hi = i;
        hSlides.forEach((sl, k) => { sl.classList.toggle("is-on", k === i); sl.setAttribute("aria-hidden", String(k !== i)); });
        hDots.forEach((b, k) => { b.setAttribute("aria-selected", String(k === i)); b.style.setProperty("--hp", "0"); });
        hT0 = performance.now();
        hBusy = false;
        placeNotes();
        prime((i + 1) % hSlides.length);
      });
    };
    hDots.forEach((b, k) => b.addEventListener("click", () => { hStarted = true; show(k); }));
    const box = $(".hd__bars");
    box.addEventListener("pointerenter", () => { hPaused = true; });
    box.addEventListener("pointerleave", () => { hPaused = false; });
    new IntersectionObserver((es) => es.forEach((e) => { hVisible = e.isIntersecting; }), { threshold: 0.2 }).observe($(".hero"));
    document.addEventListener("visibilitychange", () => { if (document.hidden) hPaused = true; else hPaused = false; });
    const hLoop = (now) => {
      requestAnimationFrame(hLoop);
      const cur = Number(hDots[hi].style.getPropertyValue("--hp")) || 0;
      if (reduce || !hStarted || hPaused || !hVisible || hBusy) { hT0 = now - cur * HDUR; return; }
      const p = (now - hT0) / HDUR;
      hDots[hi].style.setProperty("--hp", Math.min(1, p).toFixed(4));
      if (p >= 1) show(hi + 1);
    };
    requestAnimationFrame(hLoop);
    // começa depois da entrada da hero e já deixa a próxima foto pronta
    setTimeout(() => { hStarted = true; hT0 = performance.now(); prime(1); }, 2400);
  }

  /* ---------- vídeo da migração (lightbox da hero) ---------- */
  const dlg = $(".lightbox");
  const lbv = $(".lightbox__video");
  const openLightbox = () => {
    if (!dlg || typeof dlg.showModal !== "function") return;
    if (!lbv.getAttribute("src")) lbv.src = VIDEO;
    dlg.showModal();
    const p = lbv.play();
    if (p && p.catch) p.catch(() => {});
  };
  if (dlg && lbv && typeof dlg.showModal === "function") {
    $$("[data-film]").forEach((b) => b.addEventListener("click", openLightbox));
    const close = () => { lbv.pause(); dlg.close(); };
    $(".lightbox__close", dlg).addEventListener("click", close);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener("close", () => lbv.pause());
  }

  /* ---------- foto ampliada (material da marca) ---------- */
  const viewer = $(".viewer");
  const openViewer = (src, alt, cap) => {
    if (!viewer || typeof viewer.showModal !== "function") { window.open(src, "_blank", "noopener"); return; }
    const fig = $(".viewer__fig", viewer);
    fig.textContent = "";
    const img = new Image();
    img.src = src; img.alt = alt || "";
    const fc = document.createElement("figcaption");
    fc.textContent = cap || "";
    fig.append(img, fc);
    viewer.showModal();
  };
  if (viewer) {
    $(".lightbox__close", viewer).addEventListener("click", () => viewer.close());
    viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
  }

  /* ---------- revelar ao entrar na tela ---------- */
  if (motion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      let k = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (k++ * 0.08).toFixed(2) + "s";
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  /* =========================================================
     01 · ECOSSISTEMA — o caminho ativo acompanha o scroll (desktop) ou o toque
     ========================================================= */
  const eco = $("[data-eco]");
  const ecoItems = $$(".eco__item");
  const ecoImgs = $$(".eco__imgs img");
  const ecoCard = $(".eco__card");
  let ecoCur = 0;
  const ecoSticky = () => !reduce && mq("(min-width: 961px)");
  const ecoOpen = (i) => {
    if (i === ecoCur && ecoItems[i].classList.contains("is-open")) return;
    ecoCur = i;
    ecoItems.forEach((it, k) => {
      const on = k === i;
      it.classList.toggle("is-open", on);
      $(".eco__head", it).setAttribute("aria-expanded", String(on));
    });
    ecoImgs.forEach((im, k) => im.classList.toggle("is-on", k === i));
    $("[data-eco-n]").textContent = String(i + 1).padStart(2, "0");
    $("[data-eco-t]").textContent = $(".eco__name", ecoItems[i]).textContent;
    ecoCard.style.setProperty("--ep", ((i + 1) / ecoItems.length).toFixed(3));
  };
  function ecoScroll() {
    if (!eco || !ecoSticky()) return;
    const r = eco.getBoundingClientRect();
    const total = eco.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const p = clamp(-r.top / total, 0, 0.9999);
    ecoOpen(Math.floor(p * ecoItems.length));
  }
  ecoItems.forEach((it, i) => $(".eco__head", it).addEventListener("click", () => {
    if (ecoSticky()) {
      const total = eco.offsetHeight - window.innerHeight;
      const top = eco.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + total * ((i + 0.5) / ecoItems.length), behavior: reduce ? "auto" : "smooth" });
    } else ecoOpen(i);
  }));
  ecoCard.style.setProperty("--ep", (1 / ecoItems.length).toFixed(3));

  /* =========================================================
     02 · SIMULADOR (mesmas regras do original, via IGCore)
     leitura e gráfico de 120 meses com as animações do r4-sessao
     ========================================================= */
  const sim = $("[data-simv-panel='simples']") || $("#simulador");
  const S = { daily: 2, conn: { energia: true, seguro: true, telefonia: true }, h: 12, pos: 12, netN: 100, netS: 300, lit: -1 };
  const fmt = IG ? IG.BRL : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const fmt0 = IG ? IG.BRL0 : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtC = IG ? IG.BRLc : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
  const INT = IG ? IG.INT : new Intl.NumberFormat("pt-BR");
  const daily = $("#daily"), netN = $("#netN"), netS = $("#netS");
  const people = $("[data-people]", sim);
  for (let i = 0; i < 20; i++) {
    const s = document.createElement("span");
    s.innerHTML = '<svg viewBox="0 0 12 20"><circle cx="6" cy="4.2" r="3.3"/><path d="M.8 19.4v-5.2c0-3.2 2.3-5.3 5.2-5.3s5.2 2.1 5.2 5.3v5.2z"/></svg>';
    people.appendChild(s);
  }
  const crowd = $$("span", people);
  const paintPeople = (animate) => {
    const prev = S.lit;
    S.lit = S.daily;
    crowd.forEach((p, i) => {
      const on = i < S.daily;
      p.classList.toggle("is-on", on);
      if (animate && on && i >= prev && prev >= 0 && motion) {
        p.classList.remove("is-pop");
        p.style.animationDelay = ((i - prev) * 0.03).toFixed(2) + "s";
        void p.offsetWidth;
        p.classList.add("is-pop");
      }
    });
  };
  // contadores: sempre mata o tween anterior e grava o valor final por segurança
  const shown = {}, tws = {}, safe = {};
  const countTo = (el, key, to, f) => {
    const from = shown[key] == null ? to : shown[key];
    shown[key] = to;
    if (tws[key]) tws[key].kill();
    clearTimeout(safe[key]);
    if (!motion || from === to) { el.textContent = f(to); return; }
    const o = { v: from };
    tws[key] = G.to(o, { v: to, duration: 0.7, ease: "expo.out", onUpdate: () => { el.textContent = f(o.v); }, onComplete: () => { el.textContent = f(to); } });
    G.fromTo(el, { filter: "blur(3px)" }, { filter: "blur(0px)", duration: 0.5, ease: "power2.out", overwrite: "auto" });
    safe[key] = setTimeout(() => { if (shown[key] === to) { if (tws[key]) tws[key].kill(); el.textContent = f(to); el.style.filter = ""; } }, 820);
  };
  const fillRange = (r) => r.style.setProperty("--fill", ((r.value - r.min) / (r.max - r.min) * 100).toFixed(1) + "%");
  const wallet = (d, cn) => IG ? IG.wallet(d, cn) : (() => {
    const clients = d * 30; const unit = (cn.energia ? 20 : 0) + (cn.seguro ? 25 : 0) + (cn.telefonia ? 7 : 0);
    return { daily: d, clients, unit, at: (m) => ({ m, carteira: clients * m, mensal: clients * unit * m, acumulado: clients * unit * m * (m + 1) / 2 }) };
  })();

  /* gráfico: 120 barras (um mês cada), linha até o horizonte, ponto com o valor e marcos 1/12/60/120 */
  const ch = { bars: $("[data-bars]", sim), line: $("[data-line]", sim), dot: $("[data-dot]", sim), tip: $("[data-tip]", sim), marks: $("[data-marks]", sim), yMax: $("[data-y-max]", sim), yMid: $("[data-y-mid]", sim) };
  const W = 640, B = 190, TOP = 20, N = 120, stepX = W / N;
  const xc = (m) => (m - 0.5) * stepX;
  let flat = false, lastCur = -1;
  const yv = (m) => (flat ? B : B - (B - TOP) * (m / N));
  const NS = "http://www.w3.org/2000/svg";
  const rects = [];
  for (let m = 1; m <= N; m++) {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", ((m - 1) * stepX + 0.9).toFixed(2));
    r.setAttribute("width", (stepX - 1.8).toFixed(2));
    r.setAttribute("rx", "1");
    ch.bars.appendChild(r);
    rects.push(r);
  }
  const marks = [1, 12, 60, 120].map((m) => { const s = document.createElement("span"); s.dataset.m = m; ch.marks.appendChild(s); return s; });
  const drawBars = () => {
    rects.forEach((r, i) => { const m = i + 1, hh = flat ? 2 : Math.max(2, (B - TOP) * (m / N)); r.setAttribute("y", (B - hh).toFixed(2)); r.setAttribute("height", hh.toFixed(2)); });
    marks.forEach((s) => { const m = Number(s.dataset.m); s.style.left = (xc(m) / W) * 100 + "%"; s.style.top = (yv(m) / 220) * 100 + "%"; });
  };
  const paintPos = (pos, popping) => {
    const p = clamp(pos, 1, N);
    ch.line.setAttribute("d", "M" + xc(1).toFixed(2) + " " + yv(1).toFixed(2) + " L" + xc(p).toFixed(2) + " " + yv(p).toFixed(2));
    ch.dot.style.left = (xc(p) / W) * 100 + "%";
    ch.dot.style.top = (yv(p) / 220) * 100 + "%";
    ch.dot.classList.toggle("is-left", p < 14);
    ch.dot.classList.toggle("is-right", p > 104);
    const cur = Math.round(p);
    if (cur !== lastCur) { lastCur = cur; rects.forEach((r, i) => { const m = i + 1; r.classList.toggle("is-in", m <= cur); r.classList.toggle("is-cur", m === cur); }); }
    marks.forEach((s) => {
      const hit = p >= Number(s.dataset.m) - 0.01;
      if (hit && !s.classList.contains("is-hit") && popping) { s.classList.remove("is-pop"); void s.offsetWidth; s.classList.add("is-pop"); }
      s.classList.toggle("is-hit", hit);
    });
  };
  const seg = $("[data-seg]", sim), segBtns = $$("button", seg), segInd = $("[data-seg-ind]", sim);
  const placeInd = () => {
    const on = segBtns.find((b) => Number(b.dataset.h) === S.h) || segBtns[1];
    segInd.style.width = on.offsetWidth + "px";
    segInd.style.transform = "translateX(" + on.offsetLeft + "px)";
  };
  // rede (estimativa separada): atualiza só o próprio card; o valor do slider só é reescrito quando muda (não briga com o arrasto)
  const netOut = { n: $("[data-net-n]", sim), s: $("[data-net-s]", sim), v: $("[data-net]", sim), f: $("[data-net-f]", sim) };
  const renderNet = () => {
    const net = IG ? IG.network(S.netN, S.netS) : Math.floor(S.netN) * S.netS * 0.02;
    if (Number(netN.value) !== S.netN) netN.value = String(S.netN);
    if (Number(netS.value) !== S.netS) netS.value = String(S.netS);
    fillRange(netN); fillRange(netS);
    netOut.n.textContent = INT.format(S.netN);
    netOut.s.textContent = fmt0.format(S.netS);
    netOut.v.textContent = fmt.format(net);
    netOut.f.textContent = INT.format(S.netN) + " × " + fmt0.format(S.netS) + " × 2%";
  };
  let posTw = null;
  const renderSim = (animate) => {
    const w = wallet(S.daily, S.conn);
    const r = w.at(S.h);
    $("[data-daily]", sim).textContent = String(S.daily);
    $("[data-monthly]", sim).textContent = INT.format(w.clients);
    daily.value = String(S.daily); fillRange(daily);
    paintPeople(animate === true);
    $("[data-unit]", sim).textContent = fmt.format(w.unit);
    segBtns.forEach((b) => { const on = Number(b.dataset.h) === S.h; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    placeInd();
    $("[data-h-label]", sim).textContent = IG ? IG.horizonLabel(S.h) : "";
    countTo($("[data-mensal]", sim), "m", r.mensal, (v) => fmt.format(v));
    countTo($("[data-acum]", sim), "a", r.acumulado, (v) => fmt.format(v));
    $("[data-carteira]", sim).textContent = INT.format(r.carteira);
    const max = w.at(N).mensal;
    const wasFlat = flat;
    flat = max === 0;
    ch.yMax.textContent = fmtC.format(max);
    ch.yMid.textContent = fmtC.format(max / 2);
    ch.tip.textContent = fmt0.format(r.mensal) + "/mês";
    if (wasFlat !== flat || !rects[0].hasAttribute("y")) drawBars();
    if (posTw) posTw.kill();
    if (animate === "h" && motion && S.pos !== S.h) {
      const o = { p: S.pos };
      posTw = G.to(o, { p: S.h, duration: 1.1, ease: "expo.inOut", onUpdate: () => { S.pos = o.p; paintPos(o.p, true); }, onComplete: () => { S.pos = S.h; paintPos(S.h, false); } });
    } else { S.pos = S.h; paintPos(S.h, false); }
    renderNet();
    // WhatsApp com a simulação
    if (IG) {
      const chosen = IG.CONNECTIONS.filter((cn) => S.conn[cn.id]).map((cn) => cn.name);
      $(".js-wa-sim", sim).href = IG.waLink(IG.simulationMessage(w, chosen));
      $(".js-wa-sim", sim).target = "_blank"; $(".js-wa-sim", sim).rel = "noopener";
    }
  };
  daily.addEventListener("input", () => { S.daily = clamp(Math.round(daily.value), 0, 20); renderSim(true); });
  $$("[data-step]", sim).forEach((b) => b.addEventListener("click", () => { S.daily = clamp(S.daily + Number(b.dataset.step), 0, 20); renderSim(true); }));
  $$("[data-conn]", sim).forEach((cb) => cb.addEventListener("change", () => { S.conn[cb.dataset.conn] = cb.checked; renderSim(true); }));
  segBtns.forEach((b) => b.addEventListener("click", () => { S.h = Number(b.dataset.h); renderSim("h"); }));
  seg.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const i = segBtns.findIndex((b) => Number(b.dataset.h) === S.h);
    const nb = segBtns[clamp(i + (e.key === "ArrowRight" ? 1 : -1), 0, segBtns.length - 1)];
    S.h = Number(nb.dataset.h); renderSim("h"); nb.focus();
  });
  netN.addEventListener("input", () => { S.netN = Number(netN.value); renderNet(); });
  netS.addEventListener("input", () => { S.netS = Number(netS.value); renderNet(); });
  $$("[data-net-step]", sim).forEach((b) => b.addEventListener("click", () => {
    const inp = b.dataset.netStep === "netN" ? netN : netS;
    const v = clamp(Number(inp.value) + Number(b.dataset.d), Number(inp.min), Number(inp.max));
    if (inp === netN) S.netN = v; else S.netS = v;
    renderNet();
  }));
  $("[data-reset]", sim).addEventListener("click", () => {
    Object.assign(S, { daily: 2, h: 12, netN: 100, netS: 300 });
    Object.keys(S.conn).forEach((k) => { S.conn[k] = true; });
    $$("[data-conn]", sim).forEach((cb) => { cb.checked = true; });
    renderSim("h");
  });
  window.addEventListener("resize", debounce(placeInd));
  renderSim();

  /* =========================================================
     03 · D0 — o cartão aproxima, o terminal aprova, o comprovante sai e leva o carimbo
     ========================================================= */
  const d0 = $("[data-d0]");
  let d0tl = null;
  if (d0 && motion) {
    const card = $(".d0__card", d0), waves = $$(".d0__wave i", d0), ok = $(".d0__ok", d0);
    const paper = $(".slip__paper", d0), rows = $$(".slip__meta, .slip__rows > div, .slip__total, .slip__when, .slip__code, .slip__via", d0);
    const stamp = $(".slip__stamp", d0);
    const total = $("[data-slip-total]", d0);
    const money = { v: 0 };
    d0tl = G.timeline({ paused: true, defaults: { ease: "power3.out" } });
    d0tl.set(card, { opacity: 0, x: "220%", y: "-140%", rotate: 22 })
      .set(waves, { opacity: 0, scale: 0.4 })
      .set(ok, { opacity: 0, y: 10 })
      .set(paper, { yPercent: -101 })
      .set(rows, { opacity: 0 })
      .set(stamp, { opacity: 0, scale: 1.8, rotate: -24 })
      .call(() => { money.v = 0; total.textContent = fmt.format(0); })
      .to(card, { opacity: 1, duration: 0.25 }, 0.2)
      .to(card, { x: "0%", y: "0%", rotate: -10, duration: 1.1, ease: "power3.out" }, 0.2)
      .to(waves, { keyframes: [{ opacity: 0.95, scale: 0.6, duration: 0.01 }, { opacity: 0, scale: 1.7, duration: 0.9, ease: "power2.out" }], stagger: 0.22, repeat: 1 }, 1.1)
      .to(ok, { opacity: 1, y: 0, duration: 0.5 }, 1.6)
      .to(card, { x: "90%", y: "-170%", rotate: 14, opacity: 0, duration: 0.7, ease: "power2.in" }, 2.3)
      .to(paper, { yPercent: 0, duration: 2.4, ease: "steps(26)" }, 2.5)
      .to(rows, { opacity: 1, duration: 0.2, stagger: 0.2, ease: "none" }, 2.7)
      .to(money, { v: 86, duration: 1.1, ease: "power2.out", onUpdate: () => { total.textContent = fmt.format(money.v); } }, 3.9)
      .call(() => { total.textContent = fmt.format(86); })
      .to(stamp, { opacity: 1, scale: 1, rotate: -11, duration: 0.32, ease: "back.out(2.2)" }, 5.05)
      .fromTo(".tl__now i", { scale: 1 }, { scale: 1.5, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" }, 5.1);
    const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { d0tl.restart(); io.disconnect(); } }); }, { threshold: 0.45 });
    io.observe(d0);
  }
  const replay = $("[data-d0-replay]");
  if (replay) { if (d0tl) replay.addEventListener("click", () => d0tl.restart()); else replay.hidden = true; }

  /* =========================================================
     04 · APP — seis passos, telas reais, celular parado
     ========================================================= */
  const app = $("[data-app]");
  const STEPS = [
    { c: { x: 0.26, y: 0.17, l: "Saldo da carteira", side: "left" } },
    { c: { x: 0.5, y: 0.45, l: "Preço por kWh", side: "right" } },
    { c: { x: 0.62, y: 0.37, l: "Conectores disponíveis", side: "right" } },
    { c: { x: 0.3, y: 0.8, l: "Saldo ou cartão", side: "left" } },
    { c: { x: 0.5, y: 0.57, l: "Aguardando o carro", side: "right" } },
    { c: { x: 0.5, y: 0.17, l: "Bateria em tempo real", side: "left" } }
  ];
  if (app) {
    const btns = $$(".steps button", app);
    const stage = $(".app__stage", app);
    const screen = $(".phone__screen", app);
    const shots = $$(".phone__screen img", app);
    const callout = $("[data-callout]", app);
    let cur = 0, t0 = 0, paused = false, visible = false;
    const DUR = 6000;
    const placeCallout = () => {
      const s = STEPS[cur].c;
      const sr = screen.getBoundingClientRect(), wr = stage.getBoundingClientRect();
      $("[data-callout-t]", callout).textContent = s.l;
      callout.classList.toggle("is-left", s.side === "left");
      const px = sr.left - wr.left + s.x * sr.width, py = sr.top - wr.top + s.y * sr.height;
      const w = callout.offsetWidth, h = callout.offsetHeight;
      const x = s.side === "left" ? px - w + 5 : px - 5;
      callout.style.transform = `translate(${Math.round(x)}px, ${Math.round(py - h / 2)}px)`;
      callout.classList.add("is-on");
    };
    const nowT = $("[data-step-now-t]", app), nowD = $("[data-step-now-d]", app);
    const go = (i) => {
      cur = (i + STEPS.length) % STEPS.length;
      btns.forEach((b, k) => { b.setAttribute("aria-selected", String(k === cur)); b.classList.toggle("is-done", k < cur); b.style.setProperty("--sp", "0"); });
      // no celular: título e descrição do passo ativo embaixo das bolinhas
      if (nowT) nowT.textContent = $(".steps__t", btns[cur]).textContent;
      if (nowD) nowD.textContent = $(".steps__dt", btns[cur]).textContent;
      shots.forEach((im, k) => im.classList.toggle("is-on", k === cur));
      screen.classList.toggle("own-bar", shots[cur].hasAttribute("data-own-bar"));
      $("[data-sn]", app).textContent = String(cur + 1).padStart(2, "0");
      callout.classList.remove("is-on");
      setTimeout(placeCallout, 260);
      t0 = performance.now();
    };
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (paused || !visible || reduce) { t0 = now - (Number(btns[cur].style.getPropertyValue("--sp")) || 0) * DUR; return; }
      const p = (now - t0) / DUR;
      btns[cur].style.setProperty("--sp", Math.min(1, p).toFixed(4));
      if (p >= 1) go(cur + 1);
    };
    btns.forEach((b, k) => b.addEventListener("click", () => go(k)));
    app.addEventListener("pointerenter", () => { paused = true; });
    app.addEventListener("pointerleave", () => { paused = false; });
    app.addEventListener("focusin", () => { paused = true; });
    app.addEventListener("focusout", () => { paused = false; });
    new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; if (visible) placeCallout(); }), { threshold: 0.3 }).observe(app);
    window.addEventListener("resize", placeCallout);
    go(0);
    requestAnimationFrame(loop);
  }

  /* =========================================================
     NA PRÁTICA — vídeo com controle (som, pausa, tela cheia) + mini carrossel do material
     ========================================================= */
  const dive = $(".dive");
  const dvid = $(".dive__video");
  const vc = $("[data-vc]");
  let wantPlay = false, userPaused = false, full = false;
  // conexão lenta ou economia de dados: o vídeo não baixa nem toca sozinho (fica a capa com o botão de play)
  const lite = !!(navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || "")));
  const armVideo = () => { if (dvid && !dvid.getAttribute("src")) { dvid.src = VIDEO; dvid.load(); } };
  const playVideo = () => { if (!dvid) return; armVideo(); wantPlay = true; const p = dvid.play(); if (p && p.catch) p.catch(() => {}); };
  const pauseVideo = () => { if (!dvid) return; wantPlay = false; dvid.pause(); };
  if (dvid) {
    dvid.addEventListener("playing", () => { if (motion) G.to(dvid, { "--vp": 1, duration: 0.4 }); else dvid.style.opacity = "1"; });
    dvid.addEventListener("loadedmetadata", () => { if (!full && dvid.currentTime < LOOP_A) dvid.currentTime = LOOP_A; });
    dvid.addEventListener("ended", () => { dvid.currentTime = LOOP_A; if (wantPlay) playVideo(); });
  }
  if (vc && dvid) {
    const bPlay = $("[data-vc-play]", vc), bSnd = $("[data-vc-sound]", vc), lbl = $("[data-vc-label]", vc), prog = $("[data-vc-prog]", vc);
    const paintPlay = () => { vc.classList.toggle("is-paused", dvid.paused); bPlay.setAttribute("aria-label", dvid.paused ? "Reproduzir vídeo" : "Pausar vídeo"); };
    const paintSnd = () => { const on = !dvid.muted; bSnd.setAttribute("aria-pressed", String(on)); lbl.textContent = on ? "Som ativado" : "Ativar som"; };
    dvid.addEventListener("play", paintPlay);
    dvid.addEventListener("pause", paintPlay);
    dvid.addEventListener("volumechange", paintSnd);
    dvid.addEventListener("timeupdate", () => {
      const t = dvid.currentTime;
      if (!full && t >= LOOP_B) dvid.currentTime = LOOP_A;
      const p = full ? t / (dvid.duration || 1) : (t - LOOP_A) / (LOOP_B - LOOP_A);
      prog.parentElement.style.setProperty("--vp", clamp(p, 0, 1).toFixed(3));
    });
    bPlay.addEventListener("click", () => { if (dvid.paused) { userPaused = false; playVideo(); } else { userPaused = true; pauseVideo(); } });
    bSnd.addEventListener("click", () => { dvid.muted = !dvid.muted; if (!dvid.muted && dvid.paused) { userPaused = false; playVideo(); } });
    // tela cheia: o filme inteiro, do começo, com som
    const leaveFull = () => { if (!full) return; full = false; dvid.controls = false; };
    $("[data-vc-full]", vc).addEventListener("click", () => {
      armVideo();
      const enter = dvid.requestFullscreen ? () => dvid.requestFullscreen() : dvid.webkitEnterFullscreen ? () => { dvid.webkitEnterFullscreen(); return Promise.resolve(); } : null;
      if (!enter) { openLightbox(); return; }
      full = true; userPaused = false;
      dvid.muted = false; dvid.controls = true;
      try { dvid.currentTime = 0; } catch (e) { /* metadados ainda não chegaram */ }
      playVideo();
      const r = enter();
      if (r && r.catch) r.catch(() => { leaveFull(); openLightbox(); });
    });
    document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) leaveFull(); });
    dvid.addEventListener("webkitendfullscreen", leaveFull);
    paintPlay(); paintSnd();
  }

  const mat = $("[data-mat]");
  if (mat) {
    const slides = $$(".mat__slide", mat), dots = $$(".mat__dots button", mat);
    let mi = 0, timer = 0, hover = false;
    const show = (i) => {
      mi = (i + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle("is-on", k === mi); s.tabIndex = k === mi ? 0 : -1; });
      dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === mi)));
    };
    const auto = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => { if (!hover && (!dive || dive.classList.contains("is-live") || !motion)) show(mi + 1); }, 4000); };
    dots.forEach((d, k) => d.addEventListener("click", () => { show(k); auto(); }));
    slides.forEach((s) => s.addEventListener("click", () => {
      const im = $("img", s);
      openViewer(im.currentSrc || im.src, im.alt, $(".mat__cap", s).textContent.replace(/^\d+/, "").trim());
    }));
    mat.addEventListener("pointerenter", () => { hover = true; });
    mat.addEventListener("pointerleave", () => { hover = false; });
    show(0); auto();
  }

  /* =========================================================
     05 · CLUB — cupons em carrossel infinito: anda sozinho, desacelera com o mouse em cima
     e dá para segurar e arrastar (mouse ou dedo)
     ========================================================= */
  const cps = $("[data-cps]");
  const ctrack = $("[data-cps-track]");
  if (cps && ctrack && !reduce) {
    const items = [...ctrack.children];
    items.forEach((n) => {
      const cl = n.cloneNode(true);
      cl.setAttribute("aria-hidden", "true");
      $$("img", cl).forEach((im) => { im.alt = ""; });
      ctrack.appendChild(cl);
    });
    const SPEED = 44;
    let dist = 0, x = 0, v = 1, target = 1, onScreen = false, last = 0, dragId = null, sx = 0, sx0 = 0, moved = false;
    const measure = () => { dist = ctrack.children[items.length].offsetLeft - ctrack.children[0].offsetLeft; };
    const wrapX = () => { if (dist > 0) { while (x <= -dist) x += dist; while (x > 0) x -= dist; } };
    measure();
    window.addEventListener("resize", debounce(measure));
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      if (!onScreen) return;
      v += (target - v) * Math.min(1, dt * 3);
      if (dragId === null) x -= SPEED * v * dt;
      wrapX();
      ctrack.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
    };
    requestAnimationFrame(tick);
    cps.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") target = 0; });
    cps.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") target = 1; });
    cps.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      dragId = e.pointerId; sx = e.clientX; sx0 = x; moved = false;
      cps.classList.add("is-drag");
      try { cps.setPointerCapture(e.pointerId); } catch (err) { /* sem captura, segue sem ela */ }
    });
    cps.addEventListener("pointermove", (e) => {
      if (dragId !== e.pointerId) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 3) moved = true;
      x = sx0 + dx; wrapX();
    });
    const release = (e) => { if (dragId !== e.pointerId) return; dragId = null; cps.classList.remove("is-drag"); };
    cps.addEventListener("pointerup", release);
    cps.addEventListener("pointercancel", release);
    cps.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    new IntersectionObserver((es) => es.forEach((e) => { onScreen = e.isIntersecting; })).observe(cps);
  }

  /* =========================================================
     06 · EM NÚMEROS — os números contam de zero quando o painel entra na tela
     ========================================================= */
  const board = $("[data-board]");
  if (board && motion && "IntersectionObserver" in window) {
    const nums = $$("[data-count]", board);
    nums.forEach((n) => { n.textContent = "0"; });
    const bio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      bio.disconnect();
      nums.forEach((n, i) => {
        const to = Number(n.dataset.count), o = { v: 0 };
        G.to(o, { v: to, duration: 1.4, delay: 0.25 + i * 0.12, ease: "power3.out", onUpdate: () => { n.textContent = String(Math.round(o.v)); }, onComplete: () => { n.textContent = String(to); } });
        setTimeout(() => { n.textContent = String(to); }, 2600 + i * 120);
      });
    }), { threshold: 0.35 });
    bio.observe(board);
  }

  /* =========================================================
     07 · DÚVIDAS — uma pergunta aberta por vez, busca e filtros por tema
     ========================================================= */
  const faq = $("[data-faq]");
  if (faq) {
    const qas = $$(".qa", faq);
    const setOpen = (it, open) => { it.classList.toggle("is-open", open); $(".qa__q", it).setAttribute("aria-expanded", String(open)); };
    qas.forEach((it) => $(".qa__q", it).addEventListener("click", () => {
      const open = !it.classList.contains("is-open");
      qas.forEach((o) => setOpen(o, false));
      if (open) setOpen(it, true);
    }));

    // busca: sem diferenciar maiúsculas e acentos ("comissao" acha "comissão"); procura na pergunta e na resposta
    const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // plural simples: "comissoes" → "comissao" nos dois lados; e "recargas" procura "recarga" (que acha as duas formas)
    const stem = (s) => s.replace(/([oa])es\b/g, "ao");
    const word = (w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
    // termos curtos ("AC", "DC", "D0", "24h") valem só como palavra inteira; os longos, em qualquer parte
    const rx = (w) => { const e = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp(w.length <= 3 ? "\\b" + e + "\\b" : e, "g"); };
    const items = qas.map((it) => {
      const span = $(".qa__q span", it);
      return { it, span, q: span.textContent, hay: stem(fold(span.textContent + " " + $(".qa__a", it).textContent)), group: it.closest("[data-group]").dataset.group };
    });
    const groups = $$("[data-group]", faq);
    const chips = $$("[data-cat]", faq);
    const input = $("[data-faq-q]", faq), clear = $("[data-faq-clear]", faq);
    const empty = $("[data-faq-empty]", faq), term = $("[data-faq-term]", faq), status = $("[data-faq-status]", faq);
    let cat = "todas";
    // destaca o termo no texto da pergunta (as posições batem porque cada letra vira uma só letra sem acento)
    const mark = (x, words) => {
      if (!words.length) { x.span.textContent = x.q; return; }
      const f = fold(x.q);
      if (f.length !== x.q.length) { x.span.textContent = x.q; return; }
      const fz = stem(f);
      const hit = new Array(f.length).fill(false);
      const src = fz.length === f.length ? fz : f;
      words.forEach((w) => { for (const m of src.matchAll(rx(w))) for (let k = m.index; k < m.index + w.length; k++) hit[k] = true; });
      x.span.textContent = "";
      let k = 0;
      while (k < f.length) {
        let e = k; while (e < f.length && hit[e] === hit[k]) e++;
        const part = x.q.slice(k, e);
        if (hit[k]) { const m = document.createElement("mark"); m.textContent = part; x.span.appendChild(m); } else x.span.appendChild(document.createTextNode(part));
        k = e;
      }
    };
    const apply = (fromTyping) => {
      const raw = input.value.trim();
      const words = stem(fold(raw)).split(/\s+/).filter(Boolean).map(word);
      // ao digitar, a busca vale para todos os temas
      if (fromTyping && words.length && cat !== "todas") cat = "todas";
      const res = words.map(rx);
      const match = (x) => res.every((r) => { r.lastIndex = 0; return r.test(x.hay); });
      const counts = { todas: 0 };
      items.forEach((x) => { if (match(x)) { counts.todas++; counts[x.group] = (counts[x.group] || 0) + 1; } });
      let shown = 0;
      items.forEach((x) => {
        const ok = match(x) && (cat === "todas" || x.group === cat);
        x.it.hidden = !ok;
        if (ok) shown++;
        if (!ok && x.it.classList.contains("is-open")) setOpen(x.it, false);
        mark(x, words);
      });
      groups.forEach((g) => {
        const n = items.filter((x) => x.group === g.dataset.group && !x.it.hidden).length;
        g.hidden = n === 0;
        const gc = $("[data-gcount]", g); if (gc) gc.textContent = n;
      });
      chips.forEach((b) => {
        const k = b.dataset.cat, n = counts[k] || 0;
        $("[data-count]", b).textContent = n;
        b.setAttribute("aria-pressed", String(k === cat));
        b.disabled = k !== "todas" && n === 0;
      });
      // um único resultado já abre sozinho
      const vis = items.filter((x) => !x.it.hidden);
      if (words.length && vis.length === 1) setOpen(vis[0].it, true);
      empty.hidden = shown > 0;
      term.textContent = raw;
      clear.hidden = !raw;
      status.textContent = words.length ? (shown ? shown + (shown > 1 ? " perguntas encontradas" : " pergunta encontrada") : "Nenhuma pergunta encontrada") : "";
    };
    input.addEventListener("input", () => apply(true));
    input.addEventListener("keydown", (e) => { if (e.key === "Escape" && input.value) { input.value = ""; apply(false); } });
    clear.addEventListener("click", () => { input.value = ""; apply(false); input.focus(); });
    chips.forEach((b) => b.addEventListener("click", () => { cat = b.dataset.cat; apply(false); }));
  }

  if (!motion) {
    // sem animação: o vídeo da seção "Na prática" fica pronto para tocar pelo controle
    if (dive && dvid) { armVideo(); dvid.style.opacity = "1"; }
    req();
    return;
  }

  /* =========================================================
     ENTRADAS + CENAS COM SCROLL (GSAP)
     ========================================================= */
  const heroIntro = () => {
    const sec = $(".hero");
    const lines = $$("[data-line]", sec);
    const splits = [];
    const parts = [];
    lines.forEach((el) => {
      G.set(el, { visibility: "visible" });
      if (window.SplitText) { const s = new SplitText(el, { type: "lines", mask: "lines", linesClass: "ln" }); splits.push(s); parts.push(...s.lines); }
      else parts.push(el);
    });
    const tl = G.timeline({ defaults: { ease: "expo.out" }, onComplete: () => splits.forEach((s) => s.revert()) });
    tl.fromTo($(".hero .frame"), { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 2.2, ease: "power2.out" }, 0)
      .from(parts, { yPercent: 115, duration: 1.25, stagger: 0.09 }, 0.15)
      .fromTo($$("[data-in]", sec), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.07, ease: "power3.out", clearProps: "transform" }, 0.45);
    $$("[data-note]", sec).forEach((n, i) => {
      const at = 1.4 + i * 0.25;
      tl.from($(".note__dot", n), { scale: 0, duration: 0.6, ease: "back.out(3)" }, at)
        .from($(".note__rule", n), { scale: 0, duration: 0.9 }, at + 0.15)
        .from($(".note__txt", n), { opacity: 0, duration: 0.8, ease: "power2.out" }, at + 0.35);
    });
    if (mq("(hover: hover) and (pointer: fine)")) {
      const fr = $(".hero .frame");
      const x = G.quickTo(fr, "x", { duration: 1.6, ease: "power3.out" });
      const y = G.quickTo(fr, "y", { duration: 1.6, ease: "power3.out" });
      sec.addEventListener("pointermove", (e) => { const r = sec.getBoundingClientRect(); x(((e.clientX - r.left) / r.width - 0.5) * -12); y(((e.clientY - r.top) / r.height - 0.5) * -7); });
      sec.addEventListener("pointerleave", () => { x(0); y(0); });
    }
  };

  const scenes = () => {
    const mm = G.matchMedia();

    /* na prática: o mosaico 3 × 3 se monta com o scroll — a linha de cima entra pela direita,
       a de baixo pela esquerda e, no meio, as laterais chegam dos lados enquanto a foto central
       cresce no lugar; montado, ele mergulha na foto do centro, que vira o vídeo */
    mm.add({ mob: "(max-width: 760px)", desk: "(min-width: 761px)" }, (ctx) => {
      const { mob } = ctx.conditions;
      const stage = $(".dive__stage");
      const grid = $(".dive__grid");
      const focus = $(".dive__cell--focus", grid);
      const cells = $$(".dive__cell", grid);
      const others = cells.filter((cl) => cl !== focus);
      const maxScale = () => { const sx = stage.clientWidth / focus.offsetWidth, sy = stage.clientHeight / focus.offsetHeight; return mob ? sx : Math.max(sx, sy) * 1.002; };
      let S1 = maxScale();
      const z = { t: 0 };
      const full = $(".dive__full"), media = $(".dive__still", full);
      const applyZoom = () => {
        const s = Math.pow(S1, z.t);
        G.set(grid, { scale: s });
        const r = (mob ? 10 : 14) * (1 - z.t);
        cells.forEach((cl) => { cl.style.borderRadius = r.toFixed(2) + "px"; });
        grid.style.setProperty("--bo", (1 - z.t).toFixed(3));
        // a foto/vídeo do centro vive no quadro: o recorte e a escala seguem o quadro na tela,
        // então ao descer o vídeo cresce com ele e, ao subir, encolhe de volta ao mosaico
        const sr = stage.getBoundingClientRect(), fr = focus.getBoundingClientRect();
        const u = clamp((z.t - 0.72) / 0.28, 0, 1); // no fim o recorte abre para o palco inteiro (no celular o quadro não cobre a altura)
        const ins = (v) => (Math.max(0, v) * (1 - u)).toFixed(1) + "px";
        full.style.clipPath = "inset(" + ins(fr.top - sr.top) + " " + ins(sr.right - fr.right) + " " + ins(sr.bottom - fr.bottom) + " " + ins(fr.left - sr.left) + " round " + (r * s * (1 - u)).toFixed(1) + "px)";
        const cover = Math.max(fr.width / (media.offsetWidth || 1), fr.height / (media.offsetHeight || 1));
        full.style.setProperty("--ms", (cover + (1 - cover) * u).toFixed(4));
        full.style.setProperty("--vz", clamp((z.t - 0.1) / 0.35, 0, 1).toFixed(3));
      };
      applyZoom();
      // fração do scroll antes de a cena prender (1 tela de 3,2)
      const E = 1 / 3.2;
      const far = () => stage.clientWidth * (mob ? 0.85 : 0.62);
      const tl = G.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: dive, start: "top bottom", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true,
          onRefresh: () => { S1 = maxScale(); applyZoom(); },
          onUpdate: (self) => {
            const p = self.progress;
            dive.classList.toggle("is-live", p > E + 0.46);
            if (p > E + 0.42 && p < 0.999) { if (!wantPlay && !userPaused && !lite) playVideo(); } else if (p <= E + 0.38 && wantPlay) pauseVideo();
          },
          onLeave: pauseVideo,
          onEnterBack: () => { if (!userPaused && !lite) playVideo(); }
        }
      });
      const settle = E + 0.06;
      cells.forEach((cl) => {
        const row = Number(cl.dataset.row), col = Number(cl.dataset.col);
        if (cl === focus) { tl.fromTo(cl, { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: settle - E * 0.5, ease: "power2.out" }, E * 0.5); return; }
        const dir = row === 0 ? 1 : row === 2 ? -1 : (col === 0 ? -1 : 1);
        tl.fromTo(cl, { x: () => dir * far() }, { x: 0, duration: settle, ease: "power2.out" }, 0);
      });
      tl.to(z, { t: 1, duration: 0.3, ease: "power2.inOut", onUpdate: applyZoom }, settle + 0.06)
        .to(others, { autoAlpha: 0, duration: 0.1 }, settle + (mob ? 0.14 : 0.26))
        .to(".dive__full", { opacity: 1, duration: 0.01, onStart: applyZoom }, settle + 0.06)
        .to(".dive__veil", { opacity: 1, duration: 0.06 }, settle + 0.38)
        .fromTo(".dive__copy", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.08 }, settle + 0.4)
        .to({}, { duration: Math.max(0.01, 1 - (settle + 0.48)) }, settle + 0.48);
      if (!lite) ST.create({ trigger: dive, start: "top 200%", once: true, onEnter: armVideo });
      return () => { pauseVideo(); dive.classList.remove("is-live"); };
    });


    /* encerramento: o portão sobe e revela a bomba, o texto e o consultor */
    const end = $(".end__stage");
    G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: end, start: "top top", end: "bottom bottom", scrub: 0.7 } })
      .to({}, { duration: 0.06 }, 0)
      .to(".gate__hint", { opacity: 0, duration: 0.05 }, 0.02)
      .to(".gate__door", { yPercent: -101, duration: 0.56, ease: "power1.in" }, 0.06)
      .to([".gate__rail", ".gate__box"], { opacity: 0, duration: 0.08 }, 0.56)
      .fromTo(".end__pic", { scale: 1.12, y: 70, opacity: 0.35 }, { scale: 1, y: 0, opacity: 1, duration: 0.62, ease: "power2.out" }, 0.08)
      .fromTo(".end__copy", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.24, ease: "power2.out" }, 0.4)
      .fromTo(".agent", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.24, ease: "power2.out" }, 0.48)
      .fromTo(".end__prod", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.24, ease: "power2.out" }, 0.54)
      .to({}, { duration: 0.2 }, 0.8);
  };

  const start = () => {
    heroIntro(); scenes(); ST.refresh(); req();
    // sem isto, o mosaico "Na prática" às vezes ficava parado ao subir e descer: as posições de início e fim eram da página
    // antes de imagens carregarem e o resto mudar de altura
    if ("ResizeObserver" in window) {
      let lastH = document.documentElement.scrollHeight;
      new ResizeObserver(debounce(() => {
        const hh = document.documentElement.scrollHeight;
        if (Math.abs(hh - lastH) > 2) { lastH = hh; ST.refresh(); }
      }, 300)).observe(document.body);
    }
  };
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(start);
})();
