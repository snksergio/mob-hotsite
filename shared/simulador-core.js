/* =========================================================
   iGreen MOB · motor do simulador "Monte seu eletroposto"
   Cópia fiel das regras do simulador completo (igreen-mob-link.vercel.app/#investir/simulador, versão "investir"):
   modelos, capacidade, preços, tributos (Lucro Real 2026), sociedade, carteira iGreen e projeção de 36 meses.
   Sem preço de equipamento e sem payback na tela (a versão "investir" também não mostra).
   Funciona no navegador (window.IGSim) e no Node (module.exports) para os testes.
   ========================================================= */
(function (root) {
  "use strict";

  const MODELS = {
    lento: { key: "lento", name: "iGreen Lento", label: "Carga lenta", power: 7, powerLabel: "7", connectors: "1 conector de 7 kW", investorShare: 1, igreenShare: 0, cars: 2, clientsPerDay: 1 },
    duo: { key: "duo", name: "iGreen DUO", label: "Carga rápida", power: 47, powerLabel: "7 + 40", connectors: "2 conectores · 7 kW e 40 kW", investorShare: 0.8, igreenShare: 0.2, cars: 7, clientsPerDay: 2 },
    ultra: { key: "ultra", name: "iGreen Ultra rápido", label: "Carga ultra rápida", power: 80, powerLabel: "80", connectors: "Potência total do equipamento", investorShare: 0.8, igreenShare: 0.2, cars: 15, clientsPerDay: 3 }
  };
  const ORDER = ["lento", "duo", "ultra"];

  // comissões da carteira iGreen (por cliente, por mês)
  const WALLET = { energyBill: 500, energyCommission: 0.04, insuranceBill: 500, insuranceCommission: 0.05, telecomCommission: 7 };
  const CONNECTIONS = [
    { key: "energyEnabled", id: "energia", name: "Energia", value: WALLET.energyBill * WALLET.energyCommission, detail: "4% de R$ 500" },
    { key: "insuranceEnabled", id: "seguro", name: "Seguros", value: WALLET.insuranceBill * WALLET.insuranceCommission, detail: "5% de R$ 500" },
    { key: "telecomEnabled", id: "telefonia", name: "Telecom", value: WALLET.telecomCommission, detail: "por linha" }
  ];

  // premissas da versão "investir": administração 14%, sem perdas, DUO com 7 carros e 2 novos clientes por dia
  const DEFAULTS = {
    charger: "duo", cars: 7, kwh: 25, cost: 0.8, sale: 2.2, share: 0, days: 30, hours: 24, powerUse: 80, turnoverMinutes: 10,
    loss: 0, adminRate: 14, fixed: 0, acShare: 15, monthlyClients: 60, incomeMode: "combined",
    energyEnabled: true, insuranceEnabled: true, telecomEnabled: true,
    pisRate: 1.65, cofinsRate: 7.6, taxCredit: 0, pisExclusion: 0, localMode: "unset", localRate: 18, commissionMode: "unset", commissionRate: 0, taxAdditions: 0
  };
  const LIMITS = {
    cars: [1, 1000, true], kwh: [0.1, 500], cost: [0, 100], sale: [0, 100], share: [0, 20], days: [1, 31, true], hours: [1, 24], powerUse: [1, 100],
    turnoverMinutes: [0, 120], loss: [0, 50], adminRate: [0, 100], fixed: [0, 1e6], acShare: [0, 100], monthlyClients: [0, 620, true],
    pisRate: [0, 100], cofinsRate: [0, 100], taxCredit: [0, 1e7], pisExclusion: [0, 1e7], localRate: [0, 100], commissionRate: [0, 100], taxAdditions: [0, 1e7]
  };

  // valores padrão de cada modelo (como o simulador completo faz ao trocar de modelo)
  const forModel = (key, days) => ({ charger: key, cars: MODELS[key].cars, monthlyClients: MODELS[key].clientsPerDay * (days || 30) });

  /* ---------- capacidade: quantas horas por dia os carros ocupam o equipamento ---------- */
  function capacity(s) {
    const use = s.powerUse / 100, turn = s.turnoverMinutes / 60;
    const acSession = s.kwh / (7 * use) + turn;
    const dcSession = s.kwh / (40 * use) + turn;
    const single = s.kwh / (MODELS[s.charger].power * use) + turn;
    const at = (n) => {
      if (s.charger === "duo") {
        const ac = Math.round((n * s.acShare) / 100), dc = n - ac;
        return { acCars: ac, dcCars: dc, acHours: ac * acSession, dcHours: dc * dcSession, requiredHours: Math.max(ac * acSession, dc * dcSession) };
      }
      return { acCars: s.charger === "lento" ? n : 0, dcCars: s.charger === "ultra" ? n : 0, acHours: 0, dcHours: 0, requiredHours: n * single };
    };
    let max = 0;
    for (let n = 1; n <= LIMITS.cars[1] && !(at(n).requiredHours > s.hours + 1e-9); n++) max = n;
    const c = at(s.cars);
    return { ...c, maxCars: max, acSession, dcSession, singleSession: single, utilization: c.requiredHours / s.hours, feasible: c.requiredHours <= s.hours + 1e-9 };
  }

  // IRPJ 15% + adicional de 10% acima de R$ 20 mil/mês + CSLL 9%
  const incomeTax = (base) => { const b = Math.max(0, base); return { irpj: b * 0.15, additionalIrpj: Math.max(0, b - 20000) * 0.1, csll: b * 0.09 }; };

  // ajusta valores fora dos limites e carros acima da capacidade do modelo
  function sanitize(input) {
    const s = { ...DEFAULTS, ...input };
    for (const [k, [lo, hi, int]] of Object.entries(LIMITS)) {
      let v = Number(s[k]);
      if (!Number.isFinite(v)) v = DEFAULTS[k];
      v = Math.min(hi, Math.max(lo, v));
      s[k] = int ? Math.round(v) : v;
    }
    if (!MODELS[s.charger]) s.charger = DEFAULTS.charger;
    const max = capacity(s).maxCars;
    if (max >= 1 && s.cars > max) s.cars = max;
    return s;
  }

  /* ---------- o mês típico da recarga + 36 meses com a carteira ---------- */
  function simulate(input) {
    const s = sanitize(input);
    const m = MODELS[s.charger];
    const dailyKwh = s.cars * s.kwh;
    const delivered = dailyKwh * s.days;
    const purchased = delivered / (1 - s.loss / 100);
    const cap = capacity(s);
    const revenue = delivered * s.sale;
    const energy = purchased * s.cost;
    const administration = revenue * (s.adminRate / 100);
    const pisBase = Math.max(0, revenue - s.pisExclusion);
    const pis = (pisBase * s.pisRate) / 100, cofins = (pisBase * s.cofinsRate) / 100;
    const creditUsed = Math.min(s.taxCredit, pis + cofins);
    const federalRevenueTax = pis + cofins - creditUsed;
    const localTax = s.localMode === "provision" ? (revenue * s.localRate) / 100 : 0;
    const netRevenue = revenue - federalRevenueTax - localTax;
    const beforeRent = netRevenue - energy - administration - s.fixed;
    const tx = incomeTax(beforeRent + s.taxAdditions);
    const netProfit = beforeRent - tx.irpj - tx.additionalIrpj - tx.csll;
    const rent = (Math.max(0, netProfit) * s.share) / 100;
    const distributions = Math.max(0, netProfit) - rent;
    const investorDistribution = distributions * m.investorShare;
    const igreenDistribution = distributions * m.igreenShare;
    const investorContribution = Math.max(0, -netProfit) * m.investorShare;
    const investorRechargeCash = investorDistribution - investorContribution;

    const anyConn = s.energyEnabled || s.insuranceEnabled || s.telecomEnabled;
    const perClient = (s.energyEnabled ? WALLET.energyBill * WALLET.energyCommission : 0) + (s.insuranceEnabled ? WALLET.insuranceBill * WALLET.insuranceCommission : 0) + (s.telecomEnabled ? WALLET.telecomCommission : 0);
    const newClients = anyConn ? s.monthlyClients : 0;

    const month = {
      revenue, energy, purchased, administration, pis, cofins, creditUsed, federalRevenueTax, localTax, netRevenue, fixed: s.fixed,
      beforeRent, rent, ...tx, netProfit, distributions, investorDistribution, igreenDistribution, investorContribution, investorRechargeCash
    };
    let acc = 0, accCharging = 0;
    const months = Array.from({ length: 36 }, (_, i) => {
      const n = i + 1;
      const eC = (s.energyEnabled ? s.monthlyClients : 0) * n, iC = (s.insuranceEnabled ? s.monthlyClients : 0) * n, tC = (s.telecomEnabled ? s.monthlyClients : 0) * n;
      const energyCommission = eC * WALLET.energyBill * WALLET.energyCommission;
      const insuranceCommission = iC * WALLET.insuranceBill * WALLET.insuranceCommission;
      const telecomCommission = tC * WALLET.telecomCommission;
      const commissionGross = energyCommission + insuranceCommission + telecomCommission;
      const commissionTax = s.commissionMode === "rate" ? (commissionGross * s.commissionRate) / 100 : 0;
      const commissionNet = commissionGross - commissionTax;
      const totalInvestor = investorRechargeCash + commissionNet;
      acc += totalInvestor; accCharging += investorRechargeCash;
      return { month: n, clients: newClients * n, energyCommission, insuranceCommission, telecomCommission, commissionGross, commissionTax, commissionNet, rechargeNet: investorRechargeCash, totalInvestor, accumulated: acc, chargingAccumulated: accCharging };
    });
    // carteira no longo prazo (1º mês, 1, 5 e 10 anos), como no simulador completo
    const firstMonth = s.monthlyClients * perClient;
    const walletPeriods = [1, 12, 60, 120].map((t) => ({ months: t, clients: s.monthlyClients * t, monthly: firstMonth * t, accumulated: (firstMonth * t * (t + 1)) / 2 }));

    return {
      input: s, model: m, capacity: cap, maxCars: cap.maxCars, utilization: cap.utilization, feasible: cap.feasible,
      dailyKwh, delivered, purchased, sessions: s.cars * s.days, margin: s.sale - s.cost,
      month, months, perClient, newClients, walletPeriods,
      total36: months[35].accumulated, charging36: months[35].chargingAccumulated
    };
  }

  // um período (mês n, ou a soma de um ano) para a leitura "Mensal / Anual"
  function period(r, kind, n) {
    if (kind === "month") return r.months[n - 1];
    const ms = r.months.slice((n - 1) * 12, n * 12);
    const sum = (k) => ms.reduce((t, x) => t + x[k], 0);
    return { month: ms[ms.length - 1].month, clients: ms[ms.length - 1].clients, rechargeNet: sum("rechargeNet"), commissionNet: sum("commissionNet"), totalInvestor: sum("totalInvestor"), accumulated: ms[ms.length - 1].accumulated, chargingAccumulated: ms[ms.length - 1].chargingAccumulated };
  }

  const api = { MODELS, ORDER, WALLET, CONNECTIONS, DEFAULTS, LIMITS, forModel, capacity, sanitize, simulate, period, incomeTax };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IGSim = api;
})(typeof window !== "undefined" ? window : this);
