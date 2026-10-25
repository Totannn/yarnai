/* Vertil Admin — chart layer (ECharts) + Analytics section */

const CH = {
  teal: "#0e9488", bright: "#2dd4bf", cyan: "#22d3ee", gold: "#d8a13a", rose: "#fb7185", violet: "#a78bfa",
  sky: "#38bdf8", lime: "#a3e635", grid: "#16322e", axis: "#5f7a74", text: "#cfe3de",
};
const CH_PALETTE = [CH.bright, CH.gold, CH.violet, CH.sky, CH.rose, CH.lime, CH.teal, "#f472b6", "#facc15", "#94a3b8"];

// Charts are declared while building HTML, then mounted after the DOM swap.
const chartPending = {};
let chartLive = [];
function chartBox(id, option, height = 260, cls = "") {
  chartPending[id] = option;
  return `<div id="${id}" class="vchart ${cls}" style="height:${height}px"></div>`;
}
function disposeCharts() {
  chartLive.forEach(c => { try { c.dispose(); } catch {} });
  chartLive = [];
}
function mountCharts() {
  if (!window.echarts) return;
  Object.entries(chartPending).forEach(([id, opt]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const c = echarts.init(el, null, { renderer: "canvas" });
    c.setOption(withTheme(opt));
    c.__vid = id;
    chartLive.push(c);
    delete chartPending[id];
  });
  // Containers can still be settling (fonts, scrollbars) on first paint; re-measure once.
  setTimeout(() => chartLive.forEach(c => { try { c.resize(); } catch {} }), 80);
}
window.addEventListener("resize", () => chartLive.forEach(c => c.resize()));
const chartById = id => chartLive.find(c => c.__vid === id);

// Applies the console's dark, glowing look on top of a chart's own options.
function withTheme(o) {
  const axis = a => [].concat(a).map(x => ({
    axisLine: { lineStyle: { color: CH.grid } }, axisTick: { show: false },
    splitLine: { lineStyle: { color: CH.grid, type: "dashed" } }, ...x,
    axisLabel: { color: CH.axis, fontFamily: "Space Grotesk", fontSize: 11, ...(x.axisLabel || {}) },
  }));
  const out = { backgroundColor: "transparent", color: CH_PALETTE, animationDuration: 700, animationEasing: "cubicOut",
    textStyle: { fontFamily: "Space Grotesk", color: CH.text }, ...o };
  if (o.xAxis) out.xAxis = axis(o.xAxis);
  if (o.yAxis) out.yAxis = axis(o.yAxis);
  out.tooltip = { trigger: "axis", backgroundColor: "rgba(8,29,26,.92)", borderColor: "rgba(45,212,191,.35)", borderWidth: 1,
    textStyle: { color: "#e6f4f1", fontFamily: "Space Grotesk", fontSize: 12 },
    extraCssText: "backdrop-filter:blur(8px);border-radius:10px;box-shadow:0 0 24px rgba(45,212,191,.18);", ...(o.tooltip || {}) };
  if (o.legend) out.legend = { textStyle: { color: CH.text, fontFamily: "Space Grotesk" }, icon: "roundRect", itemWidth: 10, itemHeight: 10, ...o.legend };
  return out;
}

const grad = (c, a = 0.45) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hexA(c, a) }, { offset: 1, color: hexA(c, 0) }]);
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const shortDay = d => { const t = new Date(d + "T00:00:00"); return t.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const movingAvg = (arr, w = 7) => arr.map((_, i) => { const s = arr.slice(Math.max(0, i - w + 1), i + 1); return +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2); });

function lineOpt(labels, series, { type = "line", smooth = true, money = false, zoom = false, avg = false, stack = false } = {}) {
  const s = series.map((x, i) => {
    const col = x.color || CH_PALETTE[i];
    return type === "bar"
      ? { name: x.name, type: "bar", data: x.data, stack: stack ? "s" : undefined, barMaxWidth: 22,
          itemStyle: { borderRadius: stack ? 0 : [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: col }, { offset: 1, color: hexA(col, 0.35) }]) } }
      : { name: x.name, type: "line", data: x.data, smooth, symbol: "circle", symbolSize: 6, showSymbol: false, stack: stack ? "s" : undefined,
          lineStyle: { width: 2.6, color: col, shadowColor: hexA(col, 0.6), shadowBlur: 12 },
          itemStyle: { color: col }, areaStyle: x.noArea ? undefined : { color: grad(col, stack ? 0.55 : 0.4) } };
  });
  if (avg && series[0]) s.push({ name: "7-day average", type: "line", data: movingAvg(series[0].data), smooth: true, showSymbol: false,
    lineStyle: { width: 1.6, type: "dashed", color: CH.gold }, itemStyle: { color: CH.gold } });
  return {
    grid: { left: 8, right: 14, top: series.length > 1 || avg ? 34 : 14, bottom: zoom ? 46 : 8, containLabel: true },
    legend: series.length > 1 || avg ? { top: 0, right: 0 } : undefined,
    xAxis: { type: "category", data: labels.map(shortDay), boundaryGap: type === "bar" },
    yAxis: { type: "value", axisLabel: money ? { formatter: v => "₦" + compact(v) } : { formatter: v => compact(v) } },
    tooltip: { trigger: "axis", valueFormatter: money ? v => naira(v) : undefined },
    dataZoom: zoom ? [{ type: "inside" }, { type: "slider", height: 16, bottom: 6, borderColor: CH.grid, fillerColor: "rgba(45,212,191,.15)",
      handleStyle: { color: CH.bright }, textStyle: { color: CH.axis }, dataBackground: { lineStyle: { color: CH.teal }, areaStyle: { color: "rgba(14,148,136,.2)" } } }] : undefined,
    series: s,
  };
}
const compact = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "m" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + "k" : String(Math.round(v * 100) / 100);

function sparkOpt(data, color) {
  return { grid: { left: 0, right: 0, top: 2, bottom: 0 }, xAxis: { type: "category", show: false, data: data.map((_, i) => i) },
    yAxis: { type: "value", show: false }, tooltip: { show: false },
    series: [{ type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 2, color, shadowColor: hexA(color, 0.7), shadowBlur: 8 },
      areaStyle: { color: grad(color, 0.35) } }] };
}

function donutOpt(items, centerLabel, centerValue, { rose = false } = {}) {
  return {
    tooltip: { trigger: "item", formatter: p => `${esc(p.name)}<br/><b>${p.value.toLocaleString()}</b> · ${p.percent}%` },
    legend: { type: "scroll", orient: "horizontal", bottom: 0, left: "center", textStyle: { color: CH.text }, pageTextStyle: { color: CH.axis },
      pageIconColor: CH.bright, formatter: n => n.length > 18 ? n.slice(0, 17) + "…" : n },
    title: centerLabel !== undefined ? { text: String(centerValue), subtext: centerLabel, left: "50%", top: "36%", textAlign: "center",
      textStyle: { color: "#fff", fontSize: 24, fontWeight: 700, fontFamily: "Space Grotesk" }, subtextStyle: { color: CH.axis, fontSize: 11 } } : undefined,
    series: [{ type: "pie", radius: rose ? ["16%", "70%"] : ["52%", "72%"], center: ["50%", "44%"], roseType: rose ? "radius" : undefined,
      itemStyle: { borderColor: "#081d1a", borderWidth: 3, borderRadius: 6 }, label: { show: false },
      emphasis: { scale: true, scaleSize: 8, itemStyle: { shadowBlur: 20, shadowColor: "rgba(45,212,191,.5)" } },
      data: items.map((x, i) => ({ name: x.name, value: x.value, itemStyle: { color: x.color || CH_PALETTE[i % CH_PALETTE.length] } })) }],
  };
}

function hbarOpt(items, { money = false, color = CH.bright } = {}) {
  const rows = [...items].reverse();
  return {
    grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: "value", splitLine: { show: false }, axisLabel: { show: false } },
    yAxis: { type: "category", data: rows.map(r => r.name), axisLabel: { color: CH.text } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: money ? v => naira(v) : undefined },
    series: [{ type: "bar", data: rows.map(r => r.value), barMaxWidth: 16, showBackground: true, backgroundStyle: { color: "rgba(22,50,46,.6)", borderRadius: 8 },
      itemStyle: { borderRadius: 8, color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: hexA(color, 0.45) }, { offset: 1, color }]) },
      label: { show: true, position: "right", color: CH.text, formatter: p => money ? naira(p.value) : p.value } }],
  };
}

function funnelOpt(stages) {
  const top = (stages[0] && stages[0].n) || 0;
  if (!top) return { title: { text: "No sign-ups in this window", subtext: "Try a longer date range", left: "center", top: "middle",
    textStyle: { color: CH.axis, fontSize: 13, fontWeight: 500 }, subtextStyle: { color: "#3f5a55" } }, tooltip: { show: false } };
  return {
    tooltip: { trigger: "item", formatter: p => `${esc(p.name)}<br/><b>${p.value}</b>${top ? ` · ${Math.round(p.value / top * 100)}% of sign-ups` : ""}` },
    series: [{ type: "funnel", left: "6%", right: "6%", top: 8, bottom: 8, minSize: "8%", sort: "none", gap: 3,
      label: { position: "inside", color: "#fff", fontFamily: "Space Grotesk", fontSize: 11, formatter: p => `${p.name} · ${p.value}` },
      itemStyle: { borderColor: "#081d1a", borderWidth: 2 },
      data: stages.map((s, i) => ({ name: s.stage, value: s.n, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: hexA(CH_PALETTE[i % 6], 0.95) }, { offset: 1, color: hexA(CH_PALETTE[i % 6], 0.55) }]) } })) }],
  };
}

function heatOpt(matrix) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = []; let max = 1;
  matrix.forEach((row, d) => row.forEach((v, h) => { data.push([h, d, v]); max = Math.max(max, v); }));
  return {
    grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
    tooltip: { trigger: "item", formatter: p => `${days[p.value[1]]} ${String(p.value[0]).padStart(2, "0")}:00 WAT<br/><b>${p.value[2]}</b> generations` },
    xAxis: { type: "category", data: [...Array(24).keys()].map(h => String(h).padStart(2, "0")), splitArea: { show: false } },
    yAxis: { type: "category", data: days },
    visualMap: { min: 0, max, calculable: true, orient: "horizontal", left: "center", bottom: 0, itemHeight: 120, textStyle: { color: CH.axis },
      inRange: { color: ["#0b2622", "#0e5e56", CH.teal, CH.bright, "#e0fffa"] } },
    series: [{ type: "heatmap", data, itemStyle: { borderColor: "#081d1a", borderWidth: 2, borderRadius: 4 },
      emphasis: { itemStyle: { shadowBlur: 14, shadowColor: "rgba(45,212,191,.7)" } } }],
  };
}

function cohortOpt(cohorts) {
  const data = [];
  cohorts.forEach((c, r) => c.weeks.forEach((v, w) => { if (v !== null) data.push([w, r, v]); }));
  return {
    grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
    tooltip: { trigger: "item", formatter: p => { const c = cohorts[p.value[1]]; return `Week of ${shortDay(c.label)} · ${c.size} sign-ups<br/>Week ${p.value[0]}: <b>${p.value[2]}%</b> active`; } },
    xAxis: { type: "category", data: [...Array(8).keys()].map(w => "Wk " + w), position: "top" },
    yAxis: { type: "category", data: cohorts.map(c => `${shortDay(c.label)} (${c.size})`), inverse: true },
    visualMap: { min: 0, max: 100, orient: "horizontal", left: "center", bottom: 0, itemHeight: 120, textStyle: { color: CH.axis }, formatter: v => Math.round(v) + "%",
      inRange: { color: ["#0b2622", "#0e5e56", CH.teal, CH.bright] } },
    series: [{ type: "heatmap", data, label: { show: true, color: "#fff", formatter: p => p.value[2] + "%" },
      itemStyle: { borderColor: "#081d1a", borderWidth: 2, borderRadius: 4 } }],
  };
}

function gaugeOpt(value, label) {
  return {
    series: [{ type: "gauge", startAngle: 210, endAngle: -30, min: 0, max: 100, radius: "92%",
      progress: { show: true, width: 14, roundCap: true, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: CH.teal }, { offset: 1, color: CH.bright }]), shadowBlur: 16, shadowColor: "rgba(45,212,191,.6)" } },
      axisLine: { lineStyle: { width: 14, color: [[1, "#12302b"]] }, roundCap: true }, pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: false }, title: { offsetCenter: [0, "30%"], color: CH.axis, fontSize: 12 },
      detail: { valueAnimation: true, offsetCenter: [0, "-4%"], fontSize: 30, fontWeight: 700, color: "#fff", formatter: v => (value === null ? "—" : Math.round(v) + "%") },
      data: [{ value: value === null ? 0 : value, name: label }] }],
  };
}

/* ------------------------- chart card chrome ------------------------- */

function chartCard(title, sub, body, { id, tools = [], span = "" } = {}) {
  const toolBtns = tools.map(t => `<button data-ctool="${t.k}" data-cid="${id}" data-v="${t.v || ""}" class="ctool ${t.on ? "on" : ""}" title="${esc(t.title || t.label)}">${t.label}</button>`).join("");
  return `<div class="glass rounded-2xl p-4 ${span} fade-up">
    <div class="flex items-start justify-between gap-2 mb-2">
      <div><div class="text-[13px] font-semibold text-white">${title}</div>${sub ? `<div class="text-[11px] text-faint mt-0.5">${sub}</div>` : ""}</div>
      ${id ? `<div class="flex items-center gap-1 shrink-0">${toolBtns}
        <button data-ctool="png" data-cid="${id}" class="ctool" title="Download PNG">⤓</button>
        <button data-ctool="full" data-cid="${id}" class="ctool" title="Expand">⤢</button></div>` : ""}
    </div>${body}</div>`;
}

function wireChartTools() {
  $$("[data-ctool]").forEach(b => b.onclick = () => {
    const id = b.dataset.cid, k = b.dataset.ctool, c = chartById(id);
    if (k === "png" && c) {
      const a = document.createElement("a");
      a.href = c.getDataURL({ pixelRatio: 2, backgroundColor: "#081d1a" }); a.download = `vertil-${id}.png`; a.click();
    } else if (k === "full" && c) {
      openChartModal(c.getOption(), b.closest(".glass").querySelector(".text-white").textContent);
    } else if (k === "view") {
      state.chartView[id] = b.dataset.v; renderDash();
    }
  });
}

function openChartModal(option, title) {
  const m = document.createElement("div");
  m.className = "fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm grid place-items-center p-4 fade-up";
  m.innerHTML = `<div class="glass rounded-2xl p-5 w-full max-w-6xl"><div class="flex items-center justify-between mb-3">
    <div class="font-semibold text-white">${esc(title)}</div><button class="ctool" data-close>✕</button></div>
    <div id="chartModalBody" style="height:68vh"></div></div>`;
  document.body.appendChild(m);
  const c = echarts.init(m.querySelector("#chartModalBody"));
  c.setOption(option);
  const close = () => { c.dispose(); m.remove(); };
  m.onclick = e => { if (e.target === m || e.target.dataset.close !== undefined) close(); };
}

/* --------------------------- Analytics section ------------------------- */

const ANALYTICS_TABS = [
  ["growth", "Growth"], ["engagement", "Engagement"], ["content", "Content"],
  ["revenue", "Revenue & cost"], ["publishing", "Publishing"], ["retention", "Retention"],
];

function deltaPct(cur, prev) {
  if (!prev) return cur ? null : 0;
  return Math.round((cur - prev) / prev * 100);
}
function deltaChip(cur, prev, { invert = false } = {}) {
  const d = deltaPct(cur, prev);
  if (d === null) return `<span class="chip chip-new">new</span>`;
  const good = invert ? d <= 0 : d >= 0;
  return `<span class="chip ${d === 0 ? "chip-flat" : good ? "chip-up" : "chip-down"}">${d > 0 ? "▲" : d < 0 ? "▼" : "•"} ${Math.abs(d)}%</span>`;
}

function analyticsSection() {
  const A = state.analytics;
  if (!A) return `<div class="text-muted text-sm">Loading analytics…</div>`;
  const tab = state.aTab;
  const L = A.labels, S = A.series;
  const view = id => state.chartView[id] || "line";
  const viewTools = id => [{ k: "view", v: "line", label: "Line", on: view(id) === "line" }, { k: "view", v: "bar", label: "Bar", on: view(id) === "bar" }];
  const tabs = `<div class="flex gap-1 flex-wrap mb-4">${ANALYTICS_TABS.map(([k, l]) => `<button data-atab="${k}" class="seg ${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
  let body = "";

  if (tab === "growth") {
    let cum = 0; const cumulative = S.signups.map(v => (cum += v));
    body = `<div class="grid lg:grid-cols-3 gap-4">
      ${chartCard("Sign-ups", `${A.totals.signups} in ${A.days} days ${deltaChip(A.totals.signups, A.previous.signups)}`,
        chartBox("ch_signups", lineOpt(L, [{ name: "Sign-ups", data: S.signups }], { type: view("ch_signups"), zoom: true, avg: true }), 300),
        { id: "ch_signups", tools: viewTools("ch_signups"), span: "lg:col-span-2" })}
      ${chartCard("Activation funnel", `People who signed up in the last ${A.days} days`, chartBox("ch_funnel", funnelOpt(A.funnel), 300), { id: "ch_funnel" })}
      ${chartCard("Total users over the period", "Cumulative sign-ups inside the window", chartBox("ch_cum", lineOpt(L, [{ name: "Cumulative", data: cumulative, color: CH.violet }]), 240), { id: "ch_cum", span: "lg:col-span-2" })}
      ${chartCard("Brands created", "New brand voices set up", chartBox("ch_brands", lineOpt(L, [{ name: "Brands", data: S.brands, color: CH.gold }], { type: "bar" }), 240), { id: "ch_brands" })}
    </div>`;
  } else if (tab === "engagement") {
    const perUser = S.generations.map((g, i) => S.active[i] ? +(g / S.active[i]).toFixed(1) : 0);
    body = `<div class="grid lg:grid-cols-3 gap-4">
      ${chartCard("Daily active users", `${A.totals.active} unique active ${deltaChip(A.totals.active, A.previous.active)}`,
        chartBox("ch_dau", lineOpt(L, [{ name: "Active users", data: S.active, color: CH.cyan }, { name: "Generations per active user", data: perUser, color: CH.gold, noArea: true }], { type: view("ch_dau"), zoom: true }), 300),
        { id: "ch_dau", tools: viewTools("ch_dau"), span: "lg:col-span-2" })}
      ${chartCard("Engagement health", "Share of all users active in the window",
        chartBox("ch_gauge", gaugeOpt(A.total_users ? Math.round(A.totals.active / A.total_users * 100) : null, "active / total users"), 300), { id: "ch_gauge" })}
      ${chartCard("When people create", "Generations by weekday and hour (WAT)", chartBox("ch_heat", heatOpt(A.heatmap), 300), { id: "ch_heat", span: "lg:col-span-2" })}
      ${chartCard("Power users", `Most generations in the last ${A.days} days`, topUsersTable(A.top_users), {})}
    </div>`;
  } else if (tab === "content") {
    const td = Object.entries(A.type_daily).sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).slice(0, 6);
    body = `<div class="grid lg:grid-cols-3 gap-4">
      ${chartCard("Content mix over time", "Top 6 content types, stacked", chartBox("ch_mix", lineOpt(L, td.map(([n, d]) => ({ name: n, data: d })), { type: view("ch_mix"), stack: true, zoom: true }), 320),
        { id: "ch_mix", tools: viewTools("ch_mix"), span: "lg:col-span-2" })}
      ${chartCard("Voices used", "Which tones people pick", chartBox("ch_tones", donutOpt(A.tones.map(t => ({ name: t.label, value: t.n })), undefined, undefined, { rose: true }), 320), { id: "ch_tones" })}
      ${chartCard("Content types ranked", `${A.totals.generations} generations`, chartBox("ch_types", hbarOpt(A.types.slice(0, 12).map(t => ({ name: t.label, value: t.n }))), Math.max(220, A.types.slice(0, 12).length * 30)), { id: "ch_types", span: "lg:col-span-3" })}
    </div>`;
  } else if (tab === "revenue") {
    const monthlyCost = A.totals.cost * 30 / A.days;
    const margin = A.mrr ? Math.max(0, Math.round((1 - monthlyCost / A.mrr) * 100)) : null;
    body = `<div class="grid lg:grid-cols-3 gap-4">
      ${chartCard("MRR by plan", `Estimated from current subscribers · ${naira(A.mrr)} MRR`, chartBox("ch_mrr", hbarOpt(A.plans.filter(p => p.price).map(p => ({ name: p.name, value: p.mrr })), { money: true, color: CH.gold }), 260), { id: "ch_mrr", span: "lg:col-span-2" })}
      ${chartCard("Gross margin (est.)", "MRR vs AI spend, scaled to 30 days", chartBox("ch_margin", gaugeOpt(margin, "after AI cost"), 260), { id: "ch_margin" })}
      ${chartCard("AI spend per day", `${naira(A.totals.cost)} in ${A.days} days ${deltaChip(A.totals.cost, A.previous.cost, { invert: true })}`,
        chartBox("ch_cost", lineOpt(L, [{ name: "AI spend", data: S.cost, color: CH.gold }], { type: view("ch_cost"), money: true, zoom: true, avg: true }), 280),
        { id: "ch_cost", tools: viewTools("ch_cost"), span: "lg:col-span-2" })}
      ${chartCard("Spend by model", "Where the AI budget goes", chartBox("ch_models", donutOpt(A.models.map(m => ({ name: m.model, value: Math.round(m.cost) })), "₦ spent", naira(A.totals.cost)), 280), { id: "ch_models" })}
    </div>`;
  } else if (tab === "publishing") {
    const P = A.publishing;
    const plats = [...new Set([...Object.keys(P.queue_platforms), ...Object.keys(P.published), ...Object.keys(P.connected)])];
    body = `<div class="grid lg:grid-cols-3 gap-4">
      ${chartCard("Channels", "Connected accounts, scheduled and published posts by platform",
        chartBox("ch_plat", { grid: { left: 8, right: 8, top: 34, bottom: 8, containLabel: true }, legend: { top: 0, right: 0 },
          xAxis: { type: "category", data: plats.map(p => p[0].toUpperCase() + p.slice(1)) }, yAxis: { type: "value" }, tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          series: [["Connected", P.connected, CH.sky], ["Scheduled", P.queue_platforms, CH.bright], ["Published", P.published, CH.gold]].map(([n, src, col]) => ({
            name: n, type: "bar", barMaxWidth: 18, data: plats.map(p => src[p] || 0), itemStyle: { borderRadius: [6, 6, 0, 0], color: col } })) }, 300),
        { id: "ch_plat", span: "lg:col-span-2" })}
      ${chartCard("Queue status", "Every post in the queue", chartBox("ch_qstat", donutOpt(Object.entries(P.queue_status).map(([k, v]) => ({ name: k, value: v })), "posts", Object.values(P.queue_status).reduce((a, b) => a + b, 0)), 300), { id: "ch_qstat" })}
    </div>`;
  } else {
    body = `<div class="grid gap-4">
      ${chartCard("Weekly retention by sign-up week", "Share of each week's sign-ups who generated something in later weeks", chartBox("ch_cohort", cohortOpt(A.cohorts), 380), { id: "ch_cohort" })}
    </div>`;
  }
  return `${tabs}${body}`;
}

function topUsersTable(rows) {
  if (!rows || !rows.length) return `<p class="text-xs text-muted py-6 text-center">No activity in this window.</p>`;
  const max = Math.max(...rows.map(r => r.gens));
  return `<div class="space-y-2">${rows.map((r, i) => `<button data-user="${r.id}" class="w-full text-left group">
    <div class="flex items-center gap-2 text-xs"><span class="w-5 text-faint tabular-nums">${i + 1}</span>
      <span class="flex-1 truncate text-slate-100 group-hover:text-brand-bright">${esc(r.name || r.email)}</span>
      <span class="text-faint">${esc(r.plan)}</span><span class="tabular-nums text-slate-200 w-8 text-right">${r.gens}</span></div>
    <div class="ml-7 mt-1 h-1.5 rounded-full bg-edge overflow-hidden"><div class="h-full rounded-full" style="width:${Math.round(r.gens / max * 100)}%;background:linear-gradient(90deg,#0e9488,#2dd4bf)"></div></div>
  </button>`).join("")}</div>`;
}
