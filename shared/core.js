/* iGreen MOB · núcleo compartilhado pelas variações
   - regras do simulador (idênticas ao hotsite original)
   - formatação em reais
   - consultor (config.js + parâmetros de URL) e links de WhatsApp
   - medidor de carga (progresso do scroll) */
(function () {
  "use strict";

  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const BRLc = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
  const INT = new Intl.NumberFormat("pt-BR");

  const CONNECTIONS = [
    { id: "energia", name: "energia", label: "Energia", value: 20, detail: "4% de R$ 500" },
    { id: "seguro", name: "seguros", label: "Seguros", value: 25, detail: "5% de R$ 500" },
    { id: "telefonia", name: "telefonia", label: "Telefonia", value: 7, detail: "por linha ativa" }
  ];
  const MILESTONES = [
    { m: 1, short: "1º mês", label: "No 1º mês" },
    { m: 12, short: "1 ano", label: "Fim do 1º ano" },
    { m: 60, short: "5 anos", label: "Fim do 5º ano" },
    { m: 120, short: "10 anos", label: "Fim do 10º ano" }
  ];

  /* clientes/mês = clientes/dia × 30 · mês m: carteira, receita mensal e acumulado */
  function wallet(daily, selected) {
    const clients = daily * 30;
    const unit = CONNECTIONS.reduce((s, c) => s + (selected[c.id] ? c.value : 0), 0);
    return {
      daily, clients, unit,
      at: (m) => ({ m, carteira: clients * m, mensal: clients * unit * m, acumulado: (clients * unit * m * (m + 1)) / 2 })
    };
  }
  /* rede: clientes vinculados × recarga média × 2% */
  const network = (linked, spend) => Math.floor(linked) * spend * 0.02;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
  const horizonLabel = (m) => {
    const ms = MILESTONES.find((x) => x.m === m);
    if (ms) return ms.label;
    return m % 12 === 0 ? "Fim do " + m / 12 + "º ano" : "Mês " + m;
  };

  /* ---------- consultor ---------- */
  function consultant() {
    const cfg = (window.IGREEN_CONFIG && window.IGREEN_CONFIG.consultor) || {};
    const q = new URLSearchParams(window.location.search);
    const pick = (p, k) => String(q.get(p) ?? cfg[k || p] ?? "").trim();
    const c = { nome: pick("nome").slice(0, 60), cidade: pick("cidade").slice(0, 60), whatsapp: pick("whats", "whatsapp").replace(/\D/g, ""), foto: pick("foto") };
    if (c.whatsapp.length < 10 || c.whatsapp.length > 15) c.whatsapp = "";
    if (c.foto && !/^(https:\/\/|assets\/|\.\.?\/)/i.test(c.foto)) c.foto = "";
    c.first = c.nome.split(/\s+/)[0] || "";
    c.initials = c.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
    return c;
  }
  const C = consultant();
  const baseMessage = (C.first ? "Olá, " + C.first + "!" : "Olá!") + " Tenho um eletroposto e quero conhecer as condições para migrar a bandeira para iGreen.";
  const waLink = (text) => (C.whatsapp ? "https://wa.me/" + C.whatsapp : "https://wa.me/") + "?text=" + encodeURIComponent(text || baseMessage);

  function simulationMessage(r, chosen) {
    const lines = [baseMessage, "", "Fiz a simulação no hotsite:", "• " + r.daily + " novos clientes por dia (" + INT.format(r.clients) + " por mês)"];
    if (chosen.length) {
      lines.push("• Conexões: " + chosen.join(", ") + " (" + BRL.format(r.unit) + "/mês por cliente)");
      lines.push("• " + BRL.format(r.at(1).mensal) + "/mês no 1º mês");
      lines.push("• " + BRL.format(r.at(12).mensal) + "/mês ao fim do 1º ano");
      lines.push("• " + BRL.format(r.at(120).mensal) + "/mês ao fim do 10º ano");
    }
    return lines.join("\n");
  }

  /* preenche [data-c-name], [data-c-city], [data-c-avatar], [data-c-show] e links .js-wa */
  function paintConsultant(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-c-avatar]").forEach((el) => {
      el.textContent = "";
      if (C.foto) {
        const img = new Image();
        img.alt = "";
        img.src = C.foto;
        img.onerror = () => { img.remove(); el.textContent = C.initials; };
        el.appendChild(img);
      } else if (C.initials) el.textContent = C.initials;
    });
    if (C.nome) scope.querySelectorAll("[data-c-name]").forEach((el) => { el.textContent = C.nome; });
    scope.querySelectorAll("[data-c-city]").forEach((el) => {
      el.textContent = C.cidade || (C.whatsapp ? "Atendimento pelo WhatsApp" : el.textContent);
    });
    scope.querySelectorAll("[data-c-show]").forEach((el) => { el.hidden = !C.nome; });
    scope.querySelectorAll("[data-c-note]").forEach((el) => {
      if (C.whatsapp) el.textContent = "Você fala direto com " + (C.first || "o seu consultor") + " pelo WhatsApp, com a mensagem pronta.";
    });
    scope.querySelectorAll(".js-wa").forEach((a) => { a.href = waLink(); a.target = "_blank"; a.rel = "noopener"; });
  }

  /* ---------- medidor de carga ---------- */
  function chargeMeter(onUpdate) {
    let ticking = false;
    const run = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      onUpdate(p, window.scrollY);
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  window.IGCore = { BRL, BRL0, BRLc, INT, CONNECTIONS, MILESTONES, wallet, network, clamp, horizonLabel, C, baseMessage, waLink, simulationMessage, paintConsultant, chargeMeter };
})();
