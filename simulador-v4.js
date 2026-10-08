/* =========================================================
   iGreen MOB · Monte seu eletroposto (V4: a maquete "só o posto") · etapas, números e a ligação com a cena 3D
   Sobre a V3: valores digitáveis (além do − e +), a fila do dia desenhada em carrinhos na etapa 2,
   "recomeçar" no rodapé do formulário e linhas-guia no gráfico do resultado.
   Contas: shared/simulador-core.js (IGSim), cópia fiel do simulador oficial.
   ========================================================= */
(() => {
  "use strict";
  const ROOT = document.querySelector("[data-simx]") || document;
  const $ = (s, r = ROOT) => r.querySelector(s);
  const $$ = (s, r = ROOT) => [...r.querySelectorAll(s)];
  const S = window.IGSim, IG = window.IGCore;
  if (!S || !$("[data-cfg]")) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const INT = new Intl.NumberFormat("pt-BR");
  const DEC = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const brl = (v) => BRL.format(v).replace(/ /g, " ");
  const pct = (v) => DEC(1).format(v) + "%";
  const hours = (h) => { const m = Math.round(h * 60); return m >= 60 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min"; };

  const WHERE = {
    lento: { list: ["Residências", "Pequenos comércios", "Condomínios", "Pequenos escritórios"], note: "Carro que fica o dia todo ou a noite inteira, sem pressa. 100% do resultado fica com o investidor." },
    duo: { list: ["Condomínios maiores", "Shoppings e supermercados", "Hotéis e pousadas", "Empresas com frota mista"], note: "Quem fica a noite toda (7 kW) e quem precisa de carga rápida (40 kW): 2 conectores, mais gente atendida, com sociedade 80/20." },
    ultra: { list: ["Postos de combustível", "Rodovias e estradas", "Paradas de viagem", "Alto fluxo e giro rápido"], note: "Maior potência e maior ticket por recarga, mesmo com menos tempo de cada carro." }
  };
  // ícone de cada lugar (traço, como os demais ícones da página)
  const PLACE = {
    "Residências": '<path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
    "Pequenos comércios": '<path d="M4 9h16l-1.5-4h-13z"/><path d="M5 9v11h14V9"/><path d="M9.5 20v-5h5v5"/>',
    "Condomínios": '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9.5 7h1M13.5 7h1M9.5 11h1M13.5 11h1M9.5 15h1M13.5 15h1"/>',
    "Pequenos escritórios": '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>',
    "Condomínios maiores": '<rect x="3.5" y="8" width="7" height="13" rx="1"/><rect x="12.5" y="3" width="8" height="18" rx="1"/><path d="M6 11.5h2M6 15h2M15 7h3M15 10.5h3M15 14h3"/>',
    "Shoppings e supermercados": '<path d="M3.5 5h2.2l2 10h10.3l1.8-7H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
    "Hotéis e pousadas": '<path d="M3.5 18V7M3.5 14h17v4M20.5 14v-2.5A2.5 2.5 0 0 0 18 9h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
    "Empresas com frota mista": '<path d="M4 15.5v-3l2-4.5h12l2 4.5v3z"/><circle cx="8" cy="16.5" r="1.6"/><circle cx="16" cy="16.5" r="1.6"/><path d="M4 12.5h16"/>',
    "Postos de combustível": '<rect x="4" y="4" width="9" height="16" rx="1.5"/><path d="M4 10h9M13 8l3.5 2.5V17a1.5 1.5 0 0 0 3 0v-7L17 7.5"/>',
    "Rodovias e estradas": '<path d="M8 3 5 21M16 3l3 18M12 4v2.5M12 10.5v3M12 17.5V20"/>',
    "Paradas de viagem": '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2"/>',
    "Alto fluxo e giro rápido": '<path d="M13 3 6 13.5h5l-1 7.5 7-10.5h-5z"/>'
  };
  const COUNT = { lento: "1 equipamento · 1 conector de 7 kW", duo: "1 equipamento · 2 conectores", ultra: "1 equipamento · 80 kW de potência" };
  const TAG = ["Equipamento, instalação e pintura inclusos", "Seu posto em movimento", "Além da recarga", "Seu posto, montado"];
  const NEXT = ["Próximo", "Próximo", "Ver resultado"];

  /* ---------- estado ---------- */
  const cfg = $("[data-cfg]");
  const sts = $$("[data-st]");
  const tabs = $$("[data-go]");
  let st = { ...S.DEFAULTS, ...S.forModel("duo", 30) };
  let cpd = S.MODELS.duo.clientsPerDay;
  let step = 0, reached = 0, mode = "combined", per = "m1";
  let r = S.simulate(st);
  let cena = null;

  /* ---------- números que correm ---------- */
  const tw = new WeakMap();
  function count(el, to, fmt) {
    if (!el) return;
    const from = tw.get(el) ?? to;
    tw.set(el, to);
    if (reduce || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const run = (t) => { if (tw.get(el) !== to) return; const k = Math.min(1, (t - t0) / 480), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(run); };
    requestAnimationFrame(run);
  }
  const fill = (rg) => rg.style.setProperty("--fill", (((rg.value - rg.min) / (rg.max - rg.min)) * 100).toFixed(1) + "%");

  /* ---------- etapas ---------- */
  const nextBtn = $("[data-next]"), nextL = $("[data-next-l]"), prevBtn = $("[data-prev]"), sendBtn = $("[data-send]"), prog = $("[data-prog]");
  function go(i, focus) {
    i = Math.max(0, Math.min(3, i));
    if (i > reached + 1) return;
    step = i; reached = Math.max(reached, i);
    sts.forEach((s, k) => { s.hidden = k !== i; s.classList.remove("is-in"); });
    $("[data-panel]").scrollTop = 0; // cada etapa começa do topo da coluna
    void sts[i].offsetWidth; sts[i].classList.add("is-in");
    tabs.forEach((b, k) => { if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); b.classList.toggle("is-done", k !== i && k <= reached); b.disabled = k > reached + 1; });
    cfg.dataset.step = String(i);
    prevBtn.disabled = i === 0;
    nextBtn.hidden = i === 3; sendBtn.hidden = i !== 3;
    if (i < 3) nextL.textContent = NEXT[i];
    prog.textContent = "0" + (i + 1) + " / 04";
    $("[data-to-form-l]").textContent = i === 3 ? "Finalizar simulação" : "Voltar para a simulação";
    if (cena) cena.setStep(i);
    render();
    queueRun(i === 1);
    if (cena && cena.setInsets) requestAnimationFrame(() => { const [t, b] = insetsOf(); cena.setInsets(t, b); });
    if (focus) {
      const top = cfg.getBoundingClientRect().top;
      const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hdr")) || 64;
      if (top < 0 || top > window.innerHeight * 0.4) window.scrollTo({ top: window.scrollY + top - hdr - 10, behavior: reduce ? "auto" : "smooth" });
      const h = $(".st__t", sts[i]); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true });
    }
  }
  nextBtn.addEventListener("click", () => go(step + 1, true));
  // celular e tablet: do fim da ilustração, volta ao formulário (na última etapa, ao botão de enviar)
  $("[data-to-form]").addEventListener("click", () => {
    const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hdr")) || 64;
    const el = step === 3 ? $(".ctl__foot") : cfg;
    const r = el.getBoundingClientRect();
    const y = step === 3 ? window.scrollY + r.bottom - window.innerHeight + 12 : window.scrollY + r.top - hdr - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
  });
  prevBtn.addEventListener("click", () => go(step - 1, true));
  tabs.forEach((b, k) => b.addEventListener("click", () => go(k, true)));

  /* ---------- entradas ---------- */
  function setModel(key) {
    st = { ...st, ...S.forModel(key, st.days) };
    cpd = S.MODELS[key].clientsPerDay;
    st.monthlyClients = Math.min(S.LIMITS.monthlyClients[1], cpd * st.days);
    if (cena) cena.setModel(key);
    render();
  }
  $$('input[name="m"]').forEach((rd) => rd.addEventListener("change", () => { if (rd.checked) setModel(rd.value); }));
  const LIM = { kwh: [5, 85], days: [1, 31], cost: [0.3, 2], sale: [0.5, 4], share: [0, 20] };
  function setField(f, v) {
    v = Number(v);
    if (f === "cars") v = Math.max(1, Math.min(r.maxCars || 1, Math.round(v)));
    else if (f === "cpd") v = Math.max(0, Math.min(20, Math.round(v)));
    else { const [a, b] = LIM[f]; v = Math.max(a, Math.min(b, v)); v = f === "cost" || f === "sale" ? Math.round(v * 100) / 100 : Math.round(v); }
    if (f === "cpd") cpd = v; else st[f] = v;
    st.monthlyClients = Math.min(S.LIMITS.monthlyClients[1], cpd * st.days);
    if (f === "sale") { const p = $("[data-price]"); p.classList.remove("is-pop"); void p.offsetWidth; p.classList.add("is-pop"); }
    render();
  }
  $$("[data-f]").forEach((rg) => rg.addEventListener("input", () => setField(rg.dataset.f, rg.value)));
  $$("[data-inc]").forEach((b) => {
    const bump = () => setField(b.dataset.inc, st[b.dataset.inc] + Number(b.dataset.d));
    let hold = 0, next = 0;
    const stop = () => { clearTimeout(hold); hold = 0; };
    const loop = (ms) => { hold = setTimeout(() => { bump(); loop(Math.max(40, ms * 0.78)); }, ms); };
    b.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); b.setPointerCapture(e.pointerId); bump(); next = 1; loop(320); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, stop));
    // teclado (Enter/Espaço) continua funcionando pelo clique; o clique que vem depois do toque é ignorado
    b.addEventListener("click", (e) => { if (next) { next = 0; return; } bump(); });
  });
  // digitar o valor: aceita "0,85" ou "0.85"; Enter confirma, setas ↑ ↓ ajustam
  const EDIT = { kwh: [(v) => INT.format(v), 1], days: [(v) => String(v), 1], cost: [(v) => DEC(2).format(v), 0.05], sale: [(v) => DEC(2).format(v), 0.05] };
  const parseNum = (t) => { t = String(t).trim().replace(/[^\d.,-]/g, ""); t = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t; return parseFloat(t); };
  function fitInput(inp) { inp.style.width = Math.max(2, inp.value.length) + 0.4 + "ch"; }
  $$("[data-edit]").forEach((inp) => {
    inp.addEventListener("input", () => fitInput(inp));
    const f = inp.dataset.edit, show = () => { inp.value = EDIT[f][0](st[f]); fitInput(inp); };
    const commit = () => { const v = parseNum(inp.value); if (Number.isFinite(v)) setField(f, v); show(); };
    inp.addEventListener("change", commit);
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("blur", show);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); inp.select(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setField(f, st[f] + EDIT[f][1] * (e.key === "ArrowUp" ? 1 : -1)); show(); inp.select(); }
    });
  });
  $$("[data-conn]").forEach((c) => c.addEventListener("change", () => { st[c.dataset.conn] = c.checked; render(); }));
  $$("[data-mode-v]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.modeV; $$("[data-mode-v]").forEach((x) => x.setAttribute("aria-checked", String(x === b))); render(); }));
  $$("[data-p]").forEach((b) => b.addEventListener("click", () => { per = b.dataset.p; $$("[data-p]").forEach((x) => x.setAttribute("aria-checked", String(x === b))); render(); }));

  /* ---------- pinta tudo ---------- */
  const o = (k) => $$('[data-o="' + k + '"]');
  function periodVal(kind) {
    const combined = mode === "combined";
    if (kind === "m1") { const m = r.months[0]; return { label: "Mês 1", long: "no mês 1", rec: m.rechargeNet, wal: combined ? m.commissionNet : 0, tot: combined ? m.totalInvestor : m.rechargeNet, a: 0, b: 1 }; }
    const y = +kind[1], p = S.period(r, "year", y);
    return { label: y + "º ano", long: "no " + y + "º ano", rec: p.rechargeNet, wal: combined ? p.commissionNet : 0, tot: combined ? p.totalInvestor : p.rechargeNet, a: (y - 1) * 12, b: y * 12 };
  }
  function render() {
    r = S.simulate(st);
    st.cars = r.input.cars;
    const m = r.model, combined = mode === "combined";

    // 01
    $$('input[name="m"]').forEach((rd) => { rd.checked = rd.value === st.charger; });
    $("[data-where]").innerHTML = WHERE[st.charger].list.map((t) => '<li><span class="where__ic" aria-hidden="true"><svg viewBox="0 0 24 24">' + (PLACE[t] || "") + "</svg></span>" + t + "</li>").join("");
    $("[data-where-model]").textContent = m.name;
    $("[data-where-note]").textContent = WHERE[st.charger].note;

    // 02
    const rc = $("#f-cars"); rc.max = String(r.maxCars); rc.value = String(st.cars); fill(rc);
    o("cars").forEach((e) => { e.textContent = st.cars; });
    o("max").forEach((e) => { e.textContent = r.maxCars; });
    o("days").forEach((e) => { e.textContent = st.days; });
    $$("[data-edit]").forEach((inp) => { if (document.activeElement !== inp) inp.value = EDIT[inp.dataset.edit][0](st[inp.dataset.edit]); fitInput(inp); });
    o("kwh").forEach((e) => { e.textContent = INT.format(st.kwh); });
    o("cost").forEach((e) => { e.textContent = DEC(2).format(st.cost); });
    o("sale").forEach((e) => { e.textContent = DEC(2).format(st.sale); });
    const rs = $("#f-share"); rs.value = String(st.share); fill(rs); o("share").forEach((e) => { e.textContent = st.share; });
    const cap = r.utilization * 100;
    const mg = $("[data-margin]"); $("b", mg).textContent = brl(r.margin); mg.classList.toggle("is-neg", r.margin < 0);
    const c = r.capacity;
    queueBuild();
    const pill = (k, v) => '<span class="qpill"><b>' + k + "</b>" + v + "</span>";
    $("[data-queue-info]").innerHTML = st.charger === "duo"
      ? pill("2 conectores", "ao mesmo tempo") + pill("40 kW", "≈ " + hours(c.dcSession) + " por recarga") + pill("7 kW", "≈ " + hours(c.acSession))
      : st.charger === "lento" ? pill("1 conector", "de 7 kW") + pill("≈ " + hours(c.singleSession), "por recarga")
        : pill("2 vagas", "dividem 80 kW") + pill("≈ " + hours(c.singleSession), "por recarga");
    $("[data-cap-how]").textContent = st.charger === "duo"
      ? "Cada recarga leva cerca de " + hours(c.acSession) + " no conector de 7 kW e " + hours(c.dcSession) + " no de 40 kW, com 80% da potência em média e 10 minutos de troca entre carros. Dos " + st.cars + " carros, " + c.acCars + " ficam no 7 kW (15%) e " + c.dcCars + " no 40 kW; o conector mais ocupado usa " + hours(c.requiredHours) + " das 24 horas do dia."
      : "Cada recarga de " + INT.format(st.kwh) + " kWh leva cerca de " + hours(c.singleSession) + ", com 80% dos " + m.power + " kW em média e 10 minutos de troca entre carros. " + st.cars + " carros ocupam " + hours(c.requiredHours) + " das 24 horas do dia.";

    // 03
    const rp = $("#f-cpd"); rp.value = String(cpd); fill(rp); o("cpd").forEach((e) => { e.textContent = cpd; });
    $$("[data-conn]").forEach((x) => { x.checked = !!st[x.dataset.conn]; });
    $("[data-unit]").textContent = brl(r.perClient);
    const firstM = st.monthlyClients * r.perClient;
    $("[data-unit-n]").textContent = INT.format(st.monthlyClients) + " novos clientes por mês × " + brl(r.perClient) + " = " + brl(firstM) + " a mais em comissões a cada mês. Antes de tributos.";
    const bars = $("[data-bars]");
    if (bars.childElementCount !== 36) bars.innerHTML = "<i></i>".repeat(36);
    [...bars.children].forEach((b, k) => { b.style.height = (firstM > 0 ? 6 + ((k + 1) / 36) * 94 : 4) + "%"; });
    const P = r.walletPeriods, lbl = ["No 1º mês", "Fim do 1º ano", "Fim do 5º ano", "Fim do 10º ano"];
    $("[data-grow]").innerHTML = P.map((p, k) => "<div><dt>" + lbl[k] + " · " + INT.format(p.clients) + " clientes</dt><dd>" + brl(p.monthly) + "/mês<small>acumulado " + brl(p.accumulated) + "</small></dd></div>").join("");

    // 04
    $("[data-res-sub]").textContent = m.name + " · " + st.cars + " carros/dia · " + cpd + (cpd === 1 ? " cliente novo/dia" : " clientes novos/dia");
    const pv = periodVal(per);
    $("[data-res-k]").textContent = "Recebimento estimado " + pv.long;
    count($("[data-res-v]"), pv.tot, brl);
    count($("[data-s-36]"), combined ? r.total36 : r.charging36, brl);
    $("[data-s-cl]").textContent = combined ? INT.format(r.months[35].clients) : "—";
    $("[data-s-rec]").textContent = INT.format(r.sessions) + " · " + INT.format(r.delivered) + " kWh";
    $("[data-s-soc]").textContent = m.investorShare === 1 ? "100% sua" : "80% você · 20% iGreen";
    chart(pv);

    // resumo ao vivo (no resultado acompanha o período escolhido)
    const lv = step === 3 ? pv : periodVal("m1");
    $("[data-sum-per]").textContent = lv.label;
    count($("[data-sum-v]"), lv.tot, brl);
    count($("[data-sum-r]"), lv.rec, brl);
    count($("[data-sum-w]"), lv.wal, brl);
    const ta = Math.max(0, lv.rec), tb = Math.max(0, lv.wal), tt = ta + tb || 1;
    $("[data-tr-a]").style.flexGrow = (ta / tt).toFixed(3);
    $("[data-tr-b]").style.flexGrow = (tb / tt).toFixed(3);

    // cena: títulos e cartões
    $("[data-c-model]").textContent = m.name;
    $("[data-c-kw]").innerHTML = m.powerLabel + "<small>kW</small>";
    $("[data-c-tag]").innerHTML = "<i></i>" + TAG[step];
    $("[data-price]").innerHTML = "R$ " + DEC(2).format(st.sale) + "<small>/kWh</small>";
    if (cena && cena.setPrice) cena.setPrice(st.sale);
    $("[data-carsday]").innerHTML = "<b>" + st.cars + "</b> carros por dia";
    const conn = { energia: st.energyEnabled, seguro: st.insuranceEnabled, telefonia: st.telecomEnabled };
    Object.entries(conn).forEach(([k, on]) => { const show = step >= 2 && on && cpd > 0; $('[data-node="' + k + '"]').classList.toggle("is-on", show); $('[data-line="' + k + '"]').classList.toggle("is-on", show); });
    const fb = $("[data-fallback]");
    if (!fb.hidden) fb.src = "assets/img/simulador/posto-" + (st.charger === "ultra" ? "ultra" : st.charger + (step >= 1 ? "-carro" : "")) + ".webp";
    if (cena) cena.setTraffic(r.utilization, st.cars, step >= 1);

    // envio
    const msg = message();
    $$(".js-wa-v2").forEach((a) => { a.href = IG ? IG.waLink(msg) : "#"; a.target = "_blank"; a.rel = "noopener"; });
    if ($("[data-dlg]").open) report();
  }

  /* ---------- gráfico do resultado (como o da página principal) ---------- */
  const CH = { bars: $("[data-cbars]"), line: $("[data-cline]"), ghost: $("[data-cghost]"), dot: $("[data-cdot]"), tip: $("[data-ctip]"), marks: $("[data-cmarks]"), yMax: $("[data-cy-max]"), yMid: $("[data-cy-mid]") };
  const CW = 640, CB = 190, CT = 20, CN = 36, CSX = CW / CN, SVGNS = "http://www.w3.org/2000/svg";
  const cRects = [], cMarks = [1, 12, 24, 36].map((m) => { const e = document.createElement("span"); e.dataset.m = m; CH.marks.appendChild(e); return e; });
  for (let m = 1; m <= CN; m++) { const rc = document.createElementNS(SVGNS, "rect"); rc.setAttribute("x", ((m - 1) * CSX + 1.2).toFixed(2)); rc.setAttribute("width", (CSX - 2.4).toFixed(2)); rc.setAttribute("rx", "1.5"); CH.bars.appendChild(rc); cRects.push(rc); }
  const short = (v) => v >= 1e6 ? "R$ " + DEC(v >= 1e7 || Math.round(v / 1e5) % 10 === 0 ? 0 : 1).format(v / 1e6) + " mi" : v >= 1e3 ? "R$ " + INT.format(Math.round(v / 1e3)) + " mil" : "R$ " + INT.format(Math.round(v));
  function chart(pv) {
    const combined = mode === "combined";
    const A = [0, ...r.months.map((x) => (combined ? x.accumulated : x.chargingAccumulated))];
    const mx = Math.max(1, ...A), pw = Math.pow(10, Math.floor(Math.log10(mx))), top = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((k) => k * pw >= mx * 1.02) * pw;
    const xc = (m) => (m - 0.5) * CSX, yv = (v) => CB - (CB - CT) * (Math.max(0, v) / top);
    cRects.forEach((rc, i) => { const m = i + 1, hh = Math.max(2, CB - yv(A[m])); rc.setAttribute("y", (CB - hh).toFixed(2)); rc.setAttribute("height", hh.toFixed(2)); rc.classList.toggle("is-in", m <= pv.b); rc.classList.toggle("is-cur", m === pv.b); });
    const pts = (n) => { let d = "M" + xc(1).toFixed(1) + " " + yv(A[1]).toFixed(1); for (let m = 2; m <= n; m++) d += " L" + xc(m).toFixed(1) + " " + yv(A[m]).toFixed(1); return d; };
    CH.ghost.setAttribute("d", pts(CN)); CH.line.setAttribute("d", pts(pv.b));
    CH.dot.style.left = (xc(pv.b) / CW) * 100 + "%"; CH.dot.style.top = (yv(A[pv.b]) / 220) * 100 + "%";
    CH.dot.classList.toggle("is-left", pv.b < 5); CH.dot.classList.toggle("is-right", pv.b > 31);
    CH.tip.textContent = short(A[pv.b]) + (pv.b === 1 ? " no mês 1" : " em " + pv.b + " meses");
    cMarks.forEach((e) => { const m = +e.dataset.m; e.style.left = (xc(m) / CW) * 100 + "%"; e.style.top = (yv(A[m]) / 220) * 100 + "%"; e.classList.toggle("is-hit", m <= pv.b); });
    CH.yMax.textContent = short(top); CH.yMid.textContent = short(top / 2);
  }

  /* ---------- a fila do dia: um carrinho por carro; os que carregam acendem e os outros esperam ---------- */
  const qBox = $("[data-queue]"), SLOTS = { lento: 1, duo: 2, ultra: 2 };
  let qN = -1, qK = 1, qP = 0, qTimer = 0;
  function queueBuild() {
    if (st.cars !== qN) { qBox.innerHTML = '<i class="qcar"></i>'.repeat(st.cars); qN = st.cars; qP = 0; }
    qBox.dataset.n = st.cars <= 12 ? "s" : st.cars <= 24 ? "m" : "l"; // poucos carros, carrinhos maiores
    qK = SLOTS[st.charger] || 1;
    queuePaint();
  }
  function queuePaint() {
    const cs = qBox.children, n = cs.length;
    let on = 0, done = 0;
    for (let i = 0; i < n; i++) {
      const k = i < qP ? "done" : i < qP + qK ? "on" : "";
      cs[i].className = "qcar" + (k ? " is-" + k : "");
      if (k === "on") on++; else if (k === "done") done++;
    }
    $("[data-q-on]").textContent = on; $("[data-q-done]").textContent = done; $("[data-q-wait]").textContent = n - on - done;
  }
  function queueRun(on) {
    clearInterval(qTimer); qTimer = 0;
    if (!on || reduce) return;
    qTimer = setInterval(() => { if (document.hidden) return; qP = qP >= qN ? 0 : qP + qK; queuePaint(); }, 1100);
  }

  /* ---------- cartões ancorados na cena ---------- */
  const ovLines = $(".ov__lines");
  function anchors(a) {
    const set = (el, p, dx = 0, dy = 0) => { if (!el || !p) return; el.style.setProperty("--x", (p[0] + dx).toFixed(1) + "px"); el.style.setProperty("--y", (p[1] + dy).toFixed(1) + "px"); };
    // o preço fica preso ao totem (não cobre o letreiro nem o carregador); perto da borda direita, abre para a esquerda
    // ao lado do totem, do lado de fora (longe do carregador), para não cobrir o posto nem o letreiro
    const pr = $("[data-price]"), left = a.totemL && a.charger ? a.totemL[0] < a.charger[0] : false;
    set(pr, a.totemL ? (left ? a.totemL : a.totemR) : a.screen);
    pr.classList.toggle("is-l", left);
    set($("[data-carsday]"), a.lane);
    ["energia", "seguro", "telefonia"].forEach((k) => {
      set($('[data-node="' + k + '"]'), a[k]);
      const [x0, y0] = a.charger, [x1, y1] = a[k];
      const mx = (x0 + x1) / 2;
      $('[data-line="' + k + '"]').setAttribute("d", "M" + x0.toFixed(1) + " " + y0.toFixed(1) + " C " + mx.toFixed(1) + " " + y0.toFixed(1) + ", " + mx.toFixed(1) + " " + y1.toFixed(1) + ", " + x1.toFixed(1) + " " + y1.toFixed(1));
    });
    const b = ovLines.getBoundingClientRect(); ovLines.setAttribute("viewBox", "0 0 " + Math.round(b.width) + " " + Math.round(b.height));
  }

  /* ---------- demonstrativo ---------- */
  const dlg = $("[data-dlg]");
  $$("[data-open]").forEach((b) => b.addEventListener("click", () => { report(); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }));
  $("[data-close]").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  $$(".dlg__tabs [role=tab]").forEach((t) => t.addEventListener("click", () => { $$(".dlg__tabs [role=tab]").forEach((x) => { const on = x === t; x.setAttribute("aria-selected", String(on)); $("#" + x.getAttribute("aria-controls")).hidden = !on; }); }));
  function report() {
    const combined = mode === "combined", m = r.model, M = r.month;
    const rows = [
      ["Faturamento bruto de recargas", INT.format(r.sessions) + " recargas · " + INT.format(r.delivered) + " kWh × R$ " + DEC(2).format(st.sale), M.revenue, "total"],
      ["Administração iGreen", "14%", -M.administration], ["PIS", "1,65%", -M.pis], ["Cofins", "7,60%", -M.cofins],
      ["Receita após tributos e administração", "", M.revenue - M.federalRevenueTax - M.localTax - M.administration, "total"],
      ["Custo de energia", "≈ " + INT.format(Math.round(M.purchased)) + " kWh × R$ " + DEC(2).format(st.cost) + "/kWh", -M.energy],
      ["Resultado antes de IRPJ/CSLL", "", M.beforeRent, "total"],
      ["IRPJ", "15%", -M.irpj], ["Adicional de IRPJ", "10% do excedente de R$ 20 mil", -M.additionalIrpj], ["CSLL", "9%", -M.csll],
      ["Lucro líquido estimado da SCP", "", M.netProfit, "total"],
      ["Repasse ao dono do ponto", st.share + "% do lucro líquido", -M.rent],
      ["Lucro disponível aos sócios", "", M.distributions, "total"],
      ["sec", "Divisão da sociedade"],
      ...(m.investorShare === 1 ? [] : [["Participação iGreen", "20%", M.igreenDistribution]]),
      ["Investidor", m.investorShare === 1 ? "100%" : "80%", M.investorDistribution, "hl"],
      ...(M.investorContribution > 0 ? [["Aporte do investidor no déficit", "", -M.investorContribution]] : []),
      ...(combined ? [["sec", "Somado no mês 1"], ["Carteira iGreen", INT.format(r.months[0].clients) + " clientes · comissões antes de tributos", r.months[0].commissionNet], ["Recebimento estimado no mês 1", "Recargas + carteira", r.months[0].totalInvestor, "hl"]] : [])
    ];
    $("[data-dre]").innerHTML = rows.map(([l, d, v, k]) => l === "sec" ? '<li class="is-sec">' + d + "</li>" : '<li class="' + (k === "total" ? "is-total" : k === "hl" ? "is-hl" : "") + '"><span>' + l + (d ? "<small>" + d + "</small>" : "") + "</span><b>" + (v < 0 && k !== "total" ? "− " + brl(-v) : brl(v)) + "</b></li>").join("");
    $("[data-rows]").innerHTML = r.months.map((x) => "<tr" + (x.month % 12 === 0 ? ' class="is-year"' : "") + "><td>" + (x.month % 12 === 0 ? "Fim do " + x.month / 12 + "º ano" : "Mês " + x.month) + "</td><td>" + INT.format(combined ? x.clients : 0) + "</td><td>" + brl(x.rechargeNet) + "</td><td>" + brl(combined ? x.commissionNet : 0) + "</td><td>" + brl(combined ? x.totalInvestor : x.rechargeNet) + "</td><td>" + brl(combined ? x.accumulated : x.chargingAccumulated) + "</td></tr>").join("");
    const prem = [
      ["Modelo", m.name + " · " + m.powerLabel + " kW · " + (m.investorShare === 1 ? "100% do resultado para você" : "sociedade 80% você · 20% iGreen")],
      ["Movimento", st.cars + " carros por dia · " + INT.format(st.kwh) + " kWh por recarga · " + st.days + " dias por mês"],
      ["Capacidade", "80% da potência em média, 10 minutos de troca entre carros, 24 horas por dia" + (st.charger === "duo" ? "; 15% dos carros no conector de 7 kW" : "")],
      ["Energia", "Custo de R$ " + DEC(2).format(st.cost) + "/kWh com os tributos da fatura; venda a R$ " + DEC(2).format(st.sale) + "/kWh"],
      ["Administração iGreen", "14% sobre o faturamento: plataforma, atendimento e taxas de cartão"],
      ["Dono do ponto", st.share ? st.share + "% do lucro líquido positivo, depois dos impostos" : "Sem participação"],
      ["Tributos · Lucro Real 2026", "IRPJ 15% + adicional de 10% acima de R$ 20 mil/mês · CSLL 9% · PIS 1,65% · Cofins 7,6% · tributo local e comissões a definir"],
      ["Carteira iGreen", cpd + " novos clientes por dia (" + INT.format(st.monthlyClients) + " por mês) · " + brl(r.perClient) + "/mês por cliente"],
      ["Projeção", "36 meses, valores nominais, premissas constantes, sem cancelamentos, antes de IR pessoal"],
      ["Aviso", "Prévia sem ICMS adicional e com comissões antes de tributos. Os recebimentos variam com o movimento e não são garantidos."]
    ];
    $("[data-prem]").innerHTML = prem.map(([t, d]) => "<div><dt>" + t + "</dt><dd>" + d + "</dd></div>").join("");
  }

  /* ---------- mensagem para o consultor ---------- */
  function message() {
    const C = (IG && IG.C) || {};
    const conns = S.CONNECTIONS.filter((x) => st[x.key]).map((x) => x.name.toLowerCase());
    const combined = mode === "combined";
    return [
      (C.first ? "Olá, " + C.first + "!" : "Olá!") + " Montei um eletroposto no simulador da iGreen MOB:", "",
      "• Modelo: " + r.model.name + " (" + r.model.powerLabel + " kW)",
      "• Movimento: " + st.cars + " carros por dia, " + INT.format(st.kwh) + " kWh por recarga, " + st.days + " dias por mês",
      "• Preços: custo R$ " + DEC(2).format(st.cost) + "/kWh, venda R$ " + DEC(2).format(st.sale) + "/kWh" + (st.share ? ", " + st.share + "% para o dono do ponto" : ""),
      "• Carteira: " + cpd + " novos clientes por dia" + (conns.length ? " (" + conns.join(", ") + ")" : ""), "",
      "Recebimento estimado no mês 1: " + brl(combined ? r.months[0].totalInvestor : r.months[0].rechargeNet),
      "Recebido em 36 meses: " + brl(combined ? r.total36 : r.charging36), "",
      "Quero conversar sobre essa simulação."
    ].join("\n");
  }

  /* ---------- recomeçar ---------- */
  $("[data-restart]").addEventListener("click", () => {
    st = { ...S.DEFAULTS, ...S.forModel("duo", 30) }; cpd = 2; mode = "combined"; per = "m1";
    $$("[data-mode-v]").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.modeV === "combined")));
    $$("[data-p]").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.p === "m1")));
    if (cena) cena.setModel("duo");
    reached = 0; go(0, true);
  });
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => { if (cena) cena.view(b.dataset.view); }));

  /* ---------- a cena 3D (com plano B em imagem) ---------- */
  const host = $("[data-cena]");
  function fallback() {
    host.classList.add("is-ready", "is-static");
    const fb = $("[data-fallback]"); fb.hidden = false;
    render();
  }
  let gl = false;
  try { const c = document.createElement("canvas"); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { gl = false; }
  // quanto do palco o título (em cima) e as ferramentas (embaixo) ocupam: a maquete se centraliza no resto
  const stacked = window.matchMedia("(max-width: 960px)");
  const insetsOf = () => {
    const hb = host.getBoundingClientRect(), t = $(".cena__title").getBoundingClientRect(), b = $(".cena__tools").getBoundingClientRect();
    let bot = hb.bottom - b.top + 8;
    // a fila de carros (etapa 2) pode ficar um pouco por cima da frente da base
    if (step === 1) { const q = $("[data-cq]").getBoundingClientRect(); bot = Math.max(bot, (hb.bottom - q.top) * (stacked.matches ? 1 : 0.72)); }
    return [Math.max(0, t.bottom - hb.top + 10), Math.max(0, bot)];
  };
  // bibliotecas sob demanda: data-lazy3d="a.js b.js …" (em ordem), baixadas quando o bloco chega a ~1 tela de distância
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
  const libsReady = () => window.THREE && window.MQCena && (window.MAQUETE_POSTO || window.MAQUETE);
  function need3D() {
    if (libsReady()) return Promise.resolve();
    const list = (ROOT.dataset && ROOT.dataset.lazy3d || "").split(/\s+/).filter(Boolean);
    if (!list.length) return Promise.reject(new Error("3D indisponível"));
    return new Promise((res) => {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); res(); } }, { rootMargin: "900px 0px" });
      io.observe(host);
    }).then(() => list.reduce((p, src) => p.then(() => (libsReady() ? null : loadScript(src))), Promise.resolve()));
  }
  if (!gl) fallback();
  else need3D().then(() => window.MQCena.init(host, { onAnchors: anchors, data: window.MAQUETE_POSTO || window.MAQUETE, insets: (([t, b]) => ({ top: t, bottom: b }))(insetsOf()) }).then((api) => {
    cena = api;
    new ResizeObserver(() => { const [t, b] = insetsOf(); cena.setInsets(t, b); }).observe(host);
    host.classList.add("is-ready");
    cena.setModel(st.charger);
    cena.setStep(step);
    render();
  })).catch(fallback);

  go(0, false);

  /* ---------- index: troca entre o simulador interativo e a visão simplificada ---------- */
  const tabsV = [...document.querySelectorAll("[data-simv]")];
  if (tabsV.length) {
    const show = (mode, focus) => {
      tabsV.forEach((b) => { const on = b.dataset.simv === mode; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      document.querySelectorAll("[data-simv-panel]").forEach((p) => { p.hidden = p.dataset.simvPanel !== mode; });
      document.querySelectorAll("[data-simv-show]").forEach((e) => { e.hidden = e.dataset.simvShow !== mode; });
      // a visão simplificada mede o seletor de horizonte ao aparecer
      window.dispatchEvent(new Event("resize"));
    };
    tabsV.forEach((b, k) => {
      b.addEventListener("click", () => show(b.dataset.simv));
      b.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault(); show(tabsV[(k + (e.key === "ArrowRight" ? 1 : tabsV.length - 1)) % tabsV.length].dataset.simv, true);
      });
    });
  }
})();
