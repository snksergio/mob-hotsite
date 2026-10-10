/* =========================================================
   iGreen MOB · contador de lançamento
   Estreia: 01/11/2026 às 20h (horário de Brasília = 23h UTC). Três versões na mesma página (#painel, #conexao, #revelacao).
   Uma página pode trocar a data e os textos com window.CONTADOR (antes deste arquivo): { launch: "AAAA-MM-DDTHH:MM:SS-03:00",
   when: "texto da data para o leitor de tela", title, desc (agenda), tagline: ["linha 1", "linha 2"] (frase do rodapé) }.
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CFG = window.CONTADOR || {};
  const TARGET = CFG.launch ? Date.parse(CFG.launch) : Date.UTC(2026, 10, 1, 23, 0, 0);
  const WHEN = CFG.when || "1º de novembro de 2026, às 20h";
  const START = Date.UTC(2026, 9, 1, 3, 0, 0);          // começo da contagem (a luz da revelação vai de 0 a 100% até a estreia)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conn = navigator.connection;
  const saveData = !!(conn && conn.saveData);
  const pad = (n) => String(n).padStart(2, "0");
  let paused = false;

  /* ---------- versões ---------- */
  const scenes = $$("[data-sc]"), links = $$("[data-go]");
  const TAGS = {
    painel: ["Mobilidade que conecta.", "Energia que transforma."],
    conexao: ["Movimento + energia.", "Uma única conexão."],
    revelacao: ["Movimento + energia.", "Uma única conexão."]
  };
  let scene = "painel";
  function show(name) {
    if (!TAGS[name] || !$("[data-sc='" + name + "']")) name = "painel";   // versão que a página não tem (ex.: #conexao na V2) → painel
    scene = name;
    document.body.dataset.scene = name;
    scenes.forEach((s) => { s.hidden = s.dataset.sc !== name; });
    links.forEach((a) => { if (a.dataset.go === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const tag = CFG.tagline || TAGS[name];
    $("[data-tag]").textContent = tag[0];
    $("[data-tag2]").textContent = tag[1];
    video(name === "painel");
    update(true);
  }
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));

  /* ---------- vídeo da pista: vertical no celular, deitado no resto; não toca com movimento reduzido ou economia de dados ---------- */
  const vid = $("[data-video]");
  const portrait = window.matchMedia("(max-aspect-ratio: 4/5)");
  function video(on) {
    if (!vid) return;
    const k = portrait.matches ? "port" : "land";
    if (vid.dataset.cur !== k) {
      vid.dataset.cur = k;
      vid.poster = vid.dataset[k + "Poster"];
      // H.264 (mp4) primeiro: toda placa de vídeo decodifica sem gastar processador; WebM (VP9) só onde o H.264 não toca
      vid.src = vid.canPlayType('video/mp4; codecs="avc1.640028"') ? vid.dataset[k] : vid.dataset[k + "Webm"] || vid.dataset[k];
    }
    if (on && !paused && !reduce && !saveData) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); } else vid.pause();
  }
  portrait.addEventListener("change", () => video(scene === "painel"));
  document.addEventListener("visibilitychange", () => { if (!vid) return; if (document.hidden) vid.pause(); else video(scene === "painel"); });

  /* ---------- marcas do velocímetro: meio círculo (raio 375, centro 400·410), 61 marcas, uma maior a cada 5 ---------- */
  const hud = $("[data-hud]");
  if (hud) {
    for (let i = 0; i <= 60; i++) {
      const a = Math.PI + (i / 60) * Math.PI, major = i % 5 === 0, l = major ? 15 : 6;
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      Object.entries({ x1: 400 + 375 * Math.cos(a), y1: 410 + 375 * Math.sin(a), x2: 400 + (375 - l) * Math.cos(a), y2: 410 + (375 - l) * Math.sin(a),
        stroke: "#b1e79b", "stroke-opacity": major ? 0.65 : 0.25, "stroke-width": major ? 1.5 : 1 }).forEach(([k, v]) => ln.setAttribute(k, typeof v === "number" ? +v.toFixed(2) : v));
      hud.appendChild(ln);
    }
  }

  /* ---------- contagem ---------- */
  const last = {};
  const swap = (el, v) => {
    if (el.textContent === v) return;
    el.textContent = v;
    if (!reduce && !paused && el.animate) el.animate([{ opacity: 0.4, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: "ease-out" });
  };
  function update(force) {
    const now = Date.now(), left = Math.max(0, TARGET - now);
    const d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5), m = Math.floor((left % 36e5) / 6e4), s = Math.floor((left % 6e4) / 1e3);
    const sec = $("[data-sc='" + scene + "']");
    $$("[data-cd]", sec).forEach((cd) => { swap($("[data-d]", cd), pad(d)); swap($("[data-h]", cd), pad(h)); swap($("[data-m]", cd), pad(m)); swap($("[data-s]", cd), pad(s)); });
    // luz da revelação: de 0 no começo da contagem a 1 na estreia
    const lit = Math.min(1, Math.max(0, (now - START) / (TARGET - START)));
    document.documentElement.style.setProperty("--lit", lit.toFixed(3));
    // leitor de tela: a cada minuto
    if (force || last.m !== m) {
      last.m = m;
      $("[data-sr]").textContent = left > 0 ? "Faltam " + d + " dias, " + h + " horas e " + m + " minutos para o lançamento da iGreen MOB, em " + WHEN + ", horário de Brasília." : "A iGreen MOB está no ar.";
    }
    if (left === 0) live();
  }
  let liveDone = false;
  function live() {
    if (liveDone) return; liveDone = true;
    $$("[data-cd]").forEach((cd) => { cd.innerHTML = '<a class="btn btn--neon" href="index.html"><span>A iGreen MOB está no ar</span><span class="btn__chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span></a>'; });
  }
  // relógio alinhado à virada do segundo
  const loop = () => { update(false); setTimeout(loop, 1000 - (Date.now() % 1000) + 8); };

  /* ---------- pausar ---------- */
  const pb = $("[data-pause]");
  if (pb) pb.addEventListener("click", () => {
    paused = !paused;
    document.body.classList.toggle("is-paused", paused);
    pb.setAttribute("aria-pressed", String(paused));
    pb.setAttribute("aria-label", paused ? "Retomar animações" : "Pausar animações");
    video(scene === "painel");
  });

  /* ---------- salvar a data: Google Agenda ou arquivo .ics (Apple, Outlook…) ---------- */
  const TITLE = CFG.title || "Lançamento do site iGreen MOB";
  const DESC = CFG.desc || "A nova iGreen MOB entra no ar. Uma nova conexão entre mobilidade e energia.";
  const utc = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");   // 20261010T230000Z
  const T0 = utc(TARGET), T1 = utc(TARGET + 36e5);
  const URL0 = new URL("index.html", location.href).href;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//iGreen MOB//Contador//PT-BR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    "UID:lancamento-igreen-mob-" + T0.slice(0, 8) + "@igreen", "DTSTAMP:" + utc(Date.now()), "DTSTART:" + T0, "DTEND:" + T1,
    "SUMMARY:" + TITLE, "DESCRIPTION:" + DESC, "URL:" + URL0,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:" + TITLE + " em 30 minutos", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  $("[data-gcal]").href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(TITLE) + "&dates=" + T0 + "/" + T1 + "&details=" + encodeURIComponent(DESC + " " + URL0);
  $("[data-ics]").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "lancamento-igreen-mob.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    menu(false);
  });
  const sb = $("[data-save]"), sm = $("#save-menu");
  const menu = (open) => { sm.hidden = !open; sb.setAttribute("aria-expanded", String(open)); };
  sb.addEventListener("click", (e) => { e.stopPropagation(); menu(sm.hidden); });
  document.addEventListener("click", (e) => { if (!sm.hidden && !sm.contains(e.target)) menu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sm.hidden) { menu(false); sb.focus(); } });

  show(location.hash.slice(1));
  loop();
})();
