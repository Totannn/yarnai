/* Vertil — Admin Console (separate login, dark theme) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function vword({ size = "20px", color = "#f4f7f6", accent = "#2dd4bf" } = {}) {
  return `<span class="vword" style="font-size:${size};--vi:${accent};color:${color}">Vert<span class="vi"><span class="vi-tip"></span><span class="vi-stem"></span></span>l</span>`;
}
function vmark(px = 36) {
  return `<span class="rounded-xl bg-brand grid place-items-center shrink-0" style="width:${px}px;height:${px}px;box-shadow:0 0 18px rgba(45,212,191,.35)">
    <span class="vi" style="font-size:${Math.round(px * 0.5)}px"><span class="vi-tip" style="border-bottom-color:#fff"></span><span class="vi-stem" style="background:#fff"></span></span></span>`;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem("vadm_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("vadm_" + k, JSON.stringify(v)); } catch {} },
};

const state = { user: null, overview: null, users: null, applications: null, detail: null, section: store.get("section", "overview"), q: "",
  newsletter: null, newsletterDraft: null, nlBrief: "", nlDrafting: false, nlStyle: "A", nlTestEmail: "",
  nlSchedule: [], nlSchedEditing: null, nlSchedBusy: false,
  wpPrompt: "", wpCount: 3, wpStyle: "A", wpBusy: false,
  pricing: null, pricingBusy: {}, pricingDraft: {},
  // new console controls
  range: store.get("range", 30), autoRefresh: store.get("autoRefresh", false), analytics: null,
  aTab: store.get("aTab", "growth"), chartView: store.get("chartView", {}), ovMetric: store.get("ovMetric", "generations"),
  seg: "all", planFilter: "all", sort: store.get("sort", { key: "created_at", dir: -1 }), custView: store.get("custView", "table"),
  density: store.get("density", "comfy"), selected: new Set(),
  appFilter: "all", appQ: "", appView: store.get("appView", "table"), appDetail: null, appSel: new Set(), appNiche: "all",
  appSort: store.get("appSort", "newest"), appTpl: null, appTplText: null, appReviewing: false,
  agents: null, agentOpen: null, agentDetail: null, agentBusy: {}, agentSel: new Set(), agentFilter: "pending", analystChat: [], askBusy: false,
  lastLoaded: null };

const NL_STYLES = [
  { key: "A", label: "Dark hero", blurb: "Forest hero, light body" },
  { key: "B", label: "Light editorial", blurb: "Clean, teal underline" },
  { key: "C", label: "Teal + card", blurb: "Teal band, white card" },
  { key: "D", label: "Dark dispatch", blurb: "Full dark, mono labels" },
];

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || res.statusText); e.status = res.status; e.data = data; throw e; }
  return data;
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
// Calendar dates in the admin's own timezone (toISOString would shift WAT midnight to the previous UTC day).
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const naira = n => "₦" + Math.round(n || 0).toLocaleString();
function fmtDate(epoch) {
  if (!epoch) return "—";
  try { return new Date(epoch * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }); }
  catch { return "—"; }
}
const waHref = p => "https://wa.me/" + String(p || "").replace(/[^\d]/g, "").replace(/^0/, "234");
const phoneLink = p => p ? `<a href="${waHref(p)}" target="_blank" rel="noopener" class="text-brand-bright hover:underline">${esc(p)}</a>` : '<span class="text-faint">—</span>';

// Lives outside #app so it survives renderDash()'s full innerHTML swap.
function toast(msg, kind = "ok") {
  let t = document.getElementById("adminToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "adminToast";
    t.style.cssText = "position:fixed;bottom:22px;right:22px;z-index:9999;";
    document.body.appendChild(t);
  }
  const bg = kind === "error" ? "#3f1d21" : "#0e9488";
  const fg = kind === "error" ? "#fca5a5" : "#04120f";
  const border = kind === "error" ? "1px solid #7f2d33" : "none";
  t.innerHTML = `<div style="background:${bg};color:${fg};border:${border};font-size:13px;font-weight:600;padding:11px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:360px;">${esc(msg)}</div>`;
  clearTimeout(window.__adminToastTO);
  window.__adminToastTO = setTimeout(() => { t.innerHTML = ""; }, 3800);
}

function downloadCSV(name, rows) {
  if (!rows.length) return toast("Nothing to export.", "error");
  const cols = Object.keys(rows[0]);
  const cell = v => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

/* ------------------------------ boot ------------------------------ */

function renderLoading() {
  $("#app").innerHTML = `<div class="min-h-screen grid place-items-center hero-grid"><div class="text-center fade-in">
    <div class="flex justify-center">${vmark(46)}</div>
    <div class="mt-4 text-[13px] text-muted font-mono uppercase tracking-wider">Loading console</div>
    <div class="mt-3 mx-auto w-40 h-1 rounded-full bg-edge overflow-hidden"><div class="h-full w-1/3 rounded-full bg-brand-bright loading-bar"></div></div>
  </div></div>`;
}

async function boot() {
  renderLoading();
  try {
    const me = await api("/api/me");
    if (me.user && me.user.is_admin) { state.user = me.user; await load(); renderDash(); return; }
    renderLogin(me.user ? "This account is not an administrator." : "");
  } catch {
    renderLogin("");
  }
}

function scheduleWindow() {
  const start = new Date(); const end = new Date(start.getTime() + 13 * 86400000);
  return { start: ymd(start), end: ymd(end) };
}
async function reloadSchedule() {
  const { start, end } = scheduleWindow();
  state.nlSchedule = await api(`/api/admin/newsletter/schedule?start=${start}&end=${end}`);
}
async function loadAnalytics() { state.analytics = await api(`/api/admin/analytics?days=${state.range}`); }

async function load() {
  const { start, end } = scheduleWindow();
  const [ov, us, apps, nl, sched, pricing, an, ag] = await Promise.all([
    api("/api/admin/overview"), api("/api/admin/users"), api("/api/admin/applications"),
    api("/api/admin/newsletter"), api(`/api/admin/newsletter/schedule?start=${start}&end=${end}`),
    api("/api/admin/pricing"), api(`/api/admin/analytics?days=${state.range}`), api("/api/admin/agents"),
  ]);
  state.overview = ov; state.users = us; state.applications = apps; state.newsletter = nl; state.nlSchedule = sched;
  state.pricing = pricing; state.analytics = an; state.agents = ag; state.lastLoaded = Date.now();
}

/* ------------------------------ login ----------------------------- */

function renderLogin(msg) {
  $("#app").innerHTML = `
  <div class="min-h-screen grid place-items-center p-6 hero-grid">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2.5 mb-6 justify-center">
        ${vmark(38)}
        <div>${vword({ size: "20px" })}
          <div class="text-[11px] text-muted leading-none mt-1 tracking-wide uppercase font-mono">Admin Console</div></div>
      </div>
      <div class="glass rounded-2xl p-6">
        <h1 class="font-display font-extrabold text-xl">Sign in</h1>
        <p class="text-sm text-muted mt-1">Administrator access only.</p>
        <form id="loginForm" class="mt-5 space-y-3">
          <div><label class="text-xs font-semibold text-muted">Email</label>
            <input name="email" type="email" required placeholder="admin@vertil.ng" class="input w-full mt-1"/></div>
          <div><label class="text-xs font-semibold text-muted">Password</label>
            <input name="password" type="password" required placeholder="••••••••" class="input w-full mt-1"/></div>
          <p id="err" class="text-xs text-rose-400 ${msg ? "" : "hidden"}">${esc(msg)}</p>
          <button id="btn" type="submit" class="btn-glow w-full">Enter console</button>
        </form>
      </div>
      <p class="text-center text-[11px] text-faint mt-4">Looking for the app? <a href="/app" class="text-brand">Open Vertil &rarr;</a></p>
    </div>
  </div>`;
  $("#loginForm").onsubmit = doLogin;
}

async function doLogin(e) {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const btn = $("#btn"), err = $("#err");
  btn.disabled = true; btn.textContent = "…"; err.classList.add("hidden");
  try {
    const d = await api("/api/login", { method: "POST", body: JSON.stringify(fd) });
    if (!d.user.is_admin) throw new Error("This account is not an administrator.");
    state.user = d.user; await load(); renderDash();
  } catch (ex) {
    err.textContent = ex.message; err.classList.remove("hidden");
    btn.disabled = false; btn.textContent = "Enter console";
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  state.user = null; state.overview = null; state.users = null; state.detail = null;
  disposeCharts(); renderLogin("");
}

/* ------------------------------ shell ------------------------------ */

function bars(items, color) {
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map(i => `<div class="flex items-center gap-2 text-xs">
    <div class="w-32 truncate text-muted">${esc(i.label)}</div>
    <div class="flex-1 bg-edge rounded-full h-2.5 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.round(i.value / max * 100)}%;background:${color}"></div></div>
    <div class="w-24 text-right tabular-nums text-slate-300">${esc(String(i.sub ?? i.value))}</div></div>`).join("") || `<p class="text-xs text-muted">No data yet.</p>`;
}
function card(inner) { return `<div class="glass rounded-2xl p-4">${inner}</div>`; }

const NAV = [
  { key: "overview", label: "Overview", icon: '<path d="M4 13h7V4H4v9Zm9 7h7v-9h-7v9ZM4 20h7v-5H4v5ZM13 9h7V4h-7v5Z"/>' },
  { key: "analytics", label: "Analytics", icon: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>' },
  { key: "customers", label: "Customers", icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>' },
  { key: "agents", label: "AI agents", icon: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>' },
  { key: "applications", label: "Applications", icon: '<path d="M4 5h16v14H4z"/><path d="M4 10h4l2 3h4l2-3h4"/>' },
  { key: "newsletter", label: "Newsletter", icon: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>' },
  { key: "pricing", label: "Pricing", icon: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
];
const RANGES = [[7, "7D"], [30, "30D"], [90, "90D"], [365, "12M"]];

function adminSidebar() {
  const pending = (state.agents?.agents || []).reduce((s, a) => s + (a.kind === "outreach" ? a.pending : 0), 0);
  const badge = k => k === "agents" && pending ? `<span class="ml-auto text-[10px] font-bold bg-gold text-ink rounded-full px-1.5">${pending}</span>`
    : k === "applications" && (state.applications || []).some(a => (a.status || "new") === "new") ? `<span class="ml-auto w-2 h-2 rounded-full bg-brand-bright pulse-dot"></span>` : "";
  const item = n => `<button data-section="${n.key}" class="nav-item ${state.section === n.key ? "on" : ""}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="w-[18px] h-[18px] shrink-0">${n.icon}</svg>${n.label}${badge(n.key)}</button>`;
  return `<aside class="hidden md:flex w-[232px] shrink-0 flex-col side-glass px-3 py-5 sticky top-0 h-screen">
    <div class="flex items-center gap-2.5 px-2 mb-7">${vmark(32)}<div>${vword({ size: "17px" })}
      <div class="text-[9px] font-mono uppercase tracking-wider text-faint mt-1 leading-none">Admin console</div></div></div>
    <button id="openPalette" class="mx-1 mb-4 flex items-center gap-2 text-[12px] text-faint border border-edge rounded-xl px-3 py-2 hover:border-brand/50 hover:text-slate-200">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      Jump to… <span class="ml-auto font-mono text-[10px] border border-edge rounded px-1">Ctrl K</span></button>
    <nav class="space-y-1">${NAV.map(item).join("")}</nav>
    <div class="mt-auto px-2">
      <div class="text-[11px] text-muted truncate mb-2">${esc(state.user.email)}</div>
      <button id="logout" class="w-full text-xs text-rose-300 hover:text-rose-200 border border-edge rounded-lg px-3 py-2">Log out</button></div>
  </aside>`;
}

function adminTopbar() {
  const showRange = ["overview", "analytics"].includes(state.section);
  const title = (NAV.find(n => n.key === state.section) || {}).label || state.section;
  return `<header class="border-b border-edge top-glass sticky top-0 z-20">
    <div class="px-5 sm:px-7 h-14 flex items-center gap-3">
      <span class="md:hidden">${vmark(28)}</span>
      <div class="font-display font-bold">${esc(title)}</div>
      <div class="md:hidden ml-1 flex gap-1 overflow-x-auto scroll-thin">${NAV.map(n => `<button data-section="${n.key}" class="text-xs px-2 py-1 rounded-lg whitespace-nowrap ${state.section === n.key ? "bg-brand/15 text-brand-bright" : "text-muted"}">${n.label}</button>`).join("")}</div>
      <div class="ml-auto flex items-center gap-2">
        ${showRange ? `<div class="seg-group">${RANGES.map(([d, l]) => `<button data-range="${d}" class="seg ${state.range === d ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
        <button id="autoRefresh" class="seg ${state.autoRefresh ? "on" : ""}" title="Refresh every 60 seconds"><span class="${state.autoRefresh ? "pulse-dot" : ""} inline-block w-1.5 h-1.5 rounded-full ${state.autoRefresh ? "bg-brand-bright" : "bg-faint"} mr-1.5 align-middle"></span>Live</button>
        <button id="refresh" class="seg" title="Refresh now">↻</button>
        <button id="logout2" class="md:hidden text-rose-300 border border-edge rounded-lg px-3 py-1.5 text-xs">Out</button></div>
    </div></header>`;
}

function renderDash() {
  disposeCharts();
  const S = state.section;
  const body = S === "customers" ? customersSection() : S === "applications" ? applicationsSection() : S === "newsletter" ? newsletterSection()
    : S === "pricing" ? pricingSection() : S === "analytics" ? analyticsSection() : S === "agents" ? agentsSection() : overviewSection();
  $("#app").innerHTML = `<div class="flex min-h-screen">
    ${adminSidebar()}
    <div class="flex-1 min-w-0 flex flex-col">
      ${adminTopbar()}
      <main class="flex-1 px-5 sm:px-7 py-6 w-full max-w-[1320px]">${body}</main>
    </div></div>
    ${state.detail ? customerDrawer() : ""}
    ${state.appDetail && S === "applications" ? applicantDrawer() : ""}`;
  mountCharts();
  wireDash();
}

/* ----------------------------- overview ---------------------------- */

const OV_METRICS = [["generations", "Generations", CH.bright], ["active", "Active users", CH.cyan], ["signups", "Sign-ups", CH.violet], ["cost", "AI spend", CH.gold]];

function kpiTile(label, value, sub, chip, sparkId, sparkData, color) {
  return `<div class="glass kpi rounded-2xl p-4 relative overflow-hidden">
    <div class="flex items-center justify-between"><div class="text-[10.5px] font-semibold uppercase tracking-wider text-faint">${label}</div>${chip || ""}</div>
    <div class="font-display font-extrabold text-[26px] mt-1 text-white tabular-nums glow-text">${value}</div>
    <div class="text-[11px] text-muted">${sub || ""}</div>
    ${sparkId ? `<div class="mt-2 -mx-1">${chartBox(sparkId, sparkOpt(sparkData, color), 42)}</div>` : ""}
  </div>`;
}

function overviewSection() {
  const A = state.analytics, o = state.overview;
  if (!A) return `<div class="text-muted">Loading…</div>`;
  const T = A.totals, P = A.previous, S = A.series;
  const conv = A.total_users ? Math.round(A.paid_users / A.total_users * 100) : 0;
  const metric = OV_METRICS.find(m => m[0] === state.ovMetric) || OV_METRICS[0];
  const mType = state.chartView.ov_main || "line";
  const seg = A.segments.counts;
  const greet = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
  const att = [
    ["at_risk", "Paying customers gone quiet", seg.at_risk, "winback", "Draft win-backs"],
    ["never_generated", "Signed up, never created", seg.never_generated, "activation", "Draft nudges"],
    ["near_limit", "Free users near their limit", seg.near_limit, "upgrade", "Draft upgrade notes"],
  ];
  return `
    <div class="glass rounded-2xl p-5 mb-4 hero-grid relative overflow-hidden">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div><div class="text-[11px] font-mono uppercase tracking-wider text-brand-bright">Command centre · last ${A.days} days</div>
          <div class="font-display font-extrabold text-2xl text-white mt-1">${greet}, ${esc((state.user.name || "admin").split(" ")[0])}.</div>
          <div class="text-[13px] text-muted mt-1">${T.generations.toLocaleString()} generations from ${T.active} active users · ${naira(A.mrr)} MRR · ${seg.at_risk + seg.never_generated + seg.near_limit} people need attention</div></div>
        <div class="flex gap-2 flex-wrap">
          <button data-section="agents" class="btn-glow">Open AI agents</button>
          <button data-section="analytics" class="btn-ghost">Deep analytics →</button></div>
      </div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      ${kpiTile("Sign-ups", T.signups.toLocaleString(), `vs ${P.signups} before`, deltaChip(T.signups, P.signups), "sp_su", S.signups, CH.violet)}
      ${kpiTile("Active users", T.active.toLocaleString(), `of ${A.total_users} total`, deltaChip(T.active, P.active), "sp_ac", S.active, CH.cyan)}
      ${kpiTile("Generations", T.generations.toLocaleString(), `${(T.tokens / 1000).toFixed(0)}k tokens`, deltaChip(T.generations, P.generations), "sp_ge", S.generations, CH.bright)}
      ${kpiTile("AI spend", naira(T.cost), `$${Math.round(T.cost / A.fx)}`, deltaChip(T.cost, P.cost, { invert: true }), "sp_co", S.cost, CH.gold)}
      ${kpiTile("MRR (est.)", naira(A.mrr), `ARR ${naira(A.arr)}`, "", null)}
      ${kpiTile("Paid users", A.paid_users.toLocaleString(), `${conv}% conversion`, "", null)}
    </div>
    <div class="grid lg:grid-cols-3 gap-4 mt-4">
      ${chartCard(`<span class="flex gap-1 flex-wrap">${OV_METRICS.map(([k, l]) => `<button data-ovm="${k}" class="seg ${state.ovMetric === k ? "on" : ""}">${l}</button>`).join("")}</span>`,
        "Drag the slider or scroll on the chart to zoom. The dashed line is the 7-day average.",
        chartBox("ov_main", lineOpt(A.labels, [{ name: metric[1], data: S[metric[0]], color: metric[2] }], { type: mType, money: metric[0] === "cost", zoom: true, avg: true }), 320),
        { id: "ov_main", span: "lg:col-span-2", tools: [{ k: "view", v: "line", label: "Line", on: mType === "line" }, { k: "view", v: "bar", label: "Bar", on: mType === "bar" }] })}
      ${chartCard("Customers by plan", "Click a slice to filter customers",
        chartBox("ov_plans", donutOpt(A.plans.map(p => ({ name: p.name, value: p.count })), "users", A.total_users), 320), { id: "ov_plans" })}
    </div>
    <div class="grid lg:grid-cols-3 gap-4 mt-4">
      ${chartCard("Activation funnel", `Sign-ups in the last ${A.days} days`, chartBox("ov_funnel", funnelOpt(A.funnel), 280), { id: "ov_funnel" })}
      <div class="glass rounded-2xl p-4">
        <div class="text-[13px] font-semibold text-white mb-3">Needs attention</div>
        <div class="space-y-2.5">${att.map(([k, l, n, agent, cta]) => `<div class="flex items-center gap-3 rounded-xl bg-paper/60 border border-edge px-3 py-2.5">
          <div class="font-display font-extrabold text-xl tabular-nums ${n ? "text-gold" : "text-faint"} w-9">${n}</div>
          <div class="flex-1 text-[12.5px] text-slate-200">${l}</div>
          <button data-seg-open="${k}" class="text-[11px] text-muted hover:text-white">View</button>
          ${n ? `<button data-agent-jump="${agent}" class="text-[11px] font-semibold text-brand-bright hover:underline">${cta}</button>` : ""}</div>`).join("")}</div>
      </div>
      <div class="glass rounded-2xl p-4">
        <div class="flex items-center justify-between mb-3"><div class="text-[13px] font-semibold text-white">Live activity</div>
          <span class="text-[10px] text-faint">${state.lastLoaded ? "updated " + new Date(state.lastLoaded).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span></div>
        <div class="space-y-2 max-h-[250px] overflow-y-auto scroll-thin">${(A.recent || []).map(r => `<div class="flex items-center gap-2.5 text-xs">
          <span class="w-1.5 h-1.5 rounded-full bg-brand-bright pulse-dot shrink-0"></span>
          <span class="text-slate-100 truncate flex-1"><b>${esc((r.name || "Someone").split(" ")[0])}</b> made a ${esc(r.label)}</span>
          <span class="text-faint whitespace-nowrap">${ago(r.created_at)}</span></div>`).join("") || '<p class="text-xs text-muted">No activity yet.</p>'}</div>
      </div>
    </div>`;
}

/* ----------------------------- customers --------------------------- */

const SEGMENTS = [
  ["all", "All"], ["paid", "Paid"], ["free", "Free"], ["active7", "Active 7d"], ["at_risk", "At risk"],
  ["never", "Never created"], ["suspended", "Suspended"], ["admins", "Admins"],
];
const DAY = 86400;
function segTest(u, k) {
  const now = Date.now() / 1000;
  return k === "all" ? true : k === "paid" ? u.plan !== "free" : k === "free" ? u.plan === "free"
    : k === "active7" ? u.last_active && u.last_active > now - 7 * DAY
    : k === "at_risk" ? u.plan !== "free" && !u.suspended && (!u.last_active || u.last_active < now - 14 * DAY)
    : k === "never" ? !u.gens : k === "suspended" ? !!u.suspended : k === "admins" ? !!u.is_admin : true;
}
function filteredUsers() {
  const q = (state.q || "").toLowerCase().trim();
  let list = (state.users || []).filter(u => segTest(u, state.seg) && (state.planFilter === "all" || u.plan === state.planFilter));
  if (q) list = list.filter(u => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    || (u.plan_name || "").toLowerCase().includes(q) || (u.phone || "").toLowerCase().includes(q));
  const { key, dir } = state.sort;
  const val = u => key === "tokens" ? (u.it || 0) + (u.ot || 0) : key === "name" ? (u.name || u.email || "").toLowerCase() : (u[key] ?? 0);
  return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
}

function customersSection() {
  const all = state.users || [];
  const list = filteredUsers();
  const plans = [...new Set(all.map(u => u.plan))];
  const th = (k, l, right) => `<th data-sort="${k}" class="py-2 px-2 font-semibold cursor-pointer select-none hover:text-slate-200 ${right ? "text-right" : ""}">${l}${state.sort.key === k ? (state.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`;
  const dense = state.density === "compact";
  const sel = state.selected;
  const rows = list.map(u => userRow(u, dense)).join("") || `<tr><td colspan="10" class="py-6 text-center text-muted">No customers match.</td></tr>`;
  const cards = list.map(u => `<button data-user="${u.id}" class="glass rounded-2xl p-4 text-left hover:border-brand/50 ${u.suspended ? "opacity-60" : ""}">
      <div class="flex items-center gap-3"><span class="w-9 h-9 rounded-full grid place-items-center font-bold text-ink" style="background:linear-gradient(135deg,#2dd4bf,#0e9488)">${esc((u.name || u.email || "?")[0].toUpperCase())}</span>
        <div class="min-w-0"><div class="text-[13px] font-semibold text-white truncate">${esc(u.name || "—")}</div><div class="text-[11px] text-faint truncate">${esc(u.email)}</div></div></div>
      <div class="flex items-center gap-2 mt-3 text-[11px]"><span class="chip ${u.plan === "free" ? "chip-flat" : "chip-up"}">${esc(u.plan_name)}</span>
        <span class="text-muted">${u.gens} gens · ${naira(u.cost)}</span><span class="ml-auto text-faint">${u.last_active ? ago(u.last_active) : "never active"}</span></div>
    </button>`).join("") || `<p class="text-sm text-muted">No customers match.</p>`;
  return `
    <div class="flex gap-1.5 flex-wrap mb-3">${SEGMENTS.map(([k, l]) => `<button data-seg="${k}" class="seg ${state.seg === k ? "on" : ""}">${l} <span class="opacity-60">${all.filter(u => segTest(u, k)).length}</span></button>`).join("")}</div>
    <div class="glass rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <input id="userSearch" value="${esc(state.q || "")}" placeholder="Search name, email, phone…" class="input w-64"/>
        <select id="planFilter" class="input"><option value="all">All plans</option>${plans.map(p => `<option value="${p}" ${state.planFilter === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        <span id="custCount" class="text-[12px] text-faint">${list.length} of ${all.length}</span>
        <div class="ml-auto flex items-center gap-1.5">
          ${sel.size ? `<span class="text-[12px] text-brand-bright">${sel.size} selected</span>
            <select id="bulkPlan" class="input"><option value="">Change plan…</option>${(state.overview?.all_plans || []).map(p => `<option value="${p.key}">${esc(p.name)}</option>`).join("")}</select>
            <button id="bulkExport" class="seg">Export selected</button><button id="bulkClear" class="seg">Clear</button>` : ""}
          <div class="seg-group"><button data-cview="table" class="seg ${state.custView === "table" ? "on" : ""}">Table</button><button data-cview="cards" class="seg ${state.custView === "cards" ? "on" : ""}">Cards</button></div>
          ${state.custView === "table" ? `<button id="density" class="seg" title="Row density">${dense ? "Comfy" : "Compact"}</button>` : ""}
          <button id="exportCSV" class="seg">⤓ CSV</button>
        </div>
      </div>
      ${state.custView === "cards" ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${cards}</div>` : `
      <div class="overflow-x-auto scroll-thin"><table class="w-full text-xs">
        <thead><tr class="text-faint text-left border-b border-edge">
          <th class="py-2 pr-2 w-6"><input type="checkbox" id="selAllUsers" class="accent-teal-400" ${list.length && list.every(u => sel.has(u.id)) ? "checked" : ""}/></th>
          ${th("name", "Customer")}<th class="py-2 px-2 font-semibold">Phone</th>${th("plan", "Plan")}
          ${th("gens", "Gens", 1)}${th("tokens", "Tokens", 1)}${th("cost", "AI spend", 1)}${th("last_active", "Last active")}${th("created_at", "Joined")}<th></th></tr></thead>
        <tbody id="custBody">${rows}</tbody></table></div>`}
    </div>`;
}

function userRow(u, dense) {
  const tok = (u.it || 0) + (u.ot || 0);
  const pad = dense ? "py-1" : "py-2.5";
  const now = Date.now() / 1000;
  const dot = !u.last_active ? "bg-faint" : u.last_active > now - 7 * DAY ? "bg-brand-bright" : u.last_active > now - 30 * DAY ? "bg-gold" : "bg-rose-400";
  return `<tr class="border-b border-edge/60 hover:bg-edge/30 ${u.suspended ? "opacity-60" : ""} ${state.selected.has(u.id) ? "bg-brand/10" : ""}">
    <td class="${pad} pr-2"><input type="checkbox" data-usel="${u.id}" class="accent-teal-400" ${state.selected.has(u.id) ? "checked" : ""}/></td>
    <td class="${pad} pr-3"><div class="font-semibold flex items-center gap-1.5 text-slate-100">${esc(u.name || "—")}${u.is_admin ? ' <span class="text-[8.5px] bg-brand text-ink px-1 py-0.5 rounded">ADMIN</span>' : ""}${u.suspended ? ' <span class="text-[8.5px] bg-rose-500/80 text-white px-1 py-0.5 rounded">SUSPENDED</span>' : ""}</div>${dense ? "" : `<div class="text-faint">${esc(u.email)}</div>`}</td>
    <td class="${pad} px-2 whitespace-nowrap">${phoneLink(u.phone)}</td>
    <td class="${pad} px-2"><span class="chip ${u.plan === "free" ? "chip-flat" : "chip-up"}">${esc(u.plan_name)}</span></td>
    <td class="${pad} px-2 text-right tabular-nums text-slate-300">${u.gens}</td>
    <td class="${pad} px-2 text-right tabular-nums text-slate-300">${tok.toLocaleString()}</td>
    <td class="${pad} px-2 text-right tabular-nums text-slate-300">${naira(u.cost)}</td>
    <td class="${pad} px-2 whitespace-nowrap text-muted"><span class="inline-block w-1.5 h-1.5 rounded-full ${dot} mr-1.5 align-middle"></span>${u.last_active ? ago(u.last_active) : "never"}</td>
    <td class="${pad} px-2 text-muted whitespace-nowrap">${fmtDate(u.created_at)}</td>
    <td class="${pad} pl-2 text-right"><button data-user="${u.id}" class="text-brand-bright font-semibold hover:underline">View</button></td></tr>`;
}

function customerDrawer() {
  return `<div id="drawerBg" class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] fade-in"></div>
    <aside class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[640px] overflow-y-auto scroll-thin drawer p-5 slide-in">${userDetail(state.detail)}</aside>`;
}

/* ---------------------------- applications ------------------------- */

/* ------------------------------ pricing ---------------------------- */

function pricingSection() {
  const plans = state.pricing || [];
  const subs = Object.fromEntries((state.analytics?.plans || []).map(p => [p.plan, p.count]));
  const draft = state.pricingDraft;
  const priceOf = p => draft[p.key] !== undefined ? +draft[p.key] : p.price;
  const curMRR = plans.reduce((s, p) => s + p.price * (subs[p.key] || 0), 0);
  const newMRR = plans.reduce((s, p) => s + priceOf(p) * (subs[p.key] || 0), 0);
  const diff = newMRR - curMRR;
  const rows = plans.map(p => {
    const busy = state.pricingBusy[p.key], n = subs[p.key] || 0, changed = draft[p.key] !== undefined && +draft[p.key] !== p.price;
    return `<tr class="border-b border-edge/60">
      <td class="py-3 pr-3"><div class="text-sm font-semibold text-slate-100">${esc(p.name)}</div>
        ${p.is_override ? `<div class="text-[10px] text-brand-bright">Custom · default ${naira(p.default_price)}</div>` : `<div class="text-[10px] text-faint">Default price</div>`}</td>
      <td class="py-3 px-2 text-right tabular-nums text-slate-300">${n}</td>
      <td class="py-3 px-2"><div class="flex items-center gap-1.5 justify-end"><span class="text-slate-400 text-sm">₦</span>
        <input data-price-input="${p.key}" type="number" min="0" step="500" value="${priceOf(p)}" class="input w-32 text-right ${changed ? "!border-gold" : ""}"/></div></td>
      <td class="py-3 px-2 text-right tabular-nums text-slate-300">${naira(priceOf(p) * n)}</td>
      <td class="py-3 pl-2 text-right whitespace-nowrap">
        <button data-price-save="${p.key}" ${busy ? "disabled" : ""} class="btn-glow !py-1.5">${busy ? "Saving…" : "Save"}</button>
        ${p.is_override ? `<button data-price-reset="${p.key}" class="text-xs text-muted hover:text-rose-300 ml-2">Reset</button>` : ""}</td></tr>`;
  }).join("");
  const proj = plans.filter(p => p.price || priceOf(p));
  return `<div class="grid lg:grid-cols-3 gap-4">
    <div class="glass rounded-2xl p-4 lg:col-span-2">
      <div class="text-[13px] font-semibold text-white">Plan pricing</div>
      <div class="text-[11px] text-faint mb-3">Type a new price to preview its effect on MRR before saving. Changes apply to new checkouts and upgrades; existing subscribers keep what they paid until they re-subscribe.</div>
      <div class="overflow-x-auto scroll-thin"><table class="w-full text-xs"><thead><tr class="text-faint text-left border-b border-edge">
        <th class="py-2 pr-3 font-semibold">Plan</th><th class="py-2 px-2 font-semibold text-right">Subscribers</th><th class="py-2 px-2 font-semibold text-right">Price / month</th>
        <th class="py-2 px-2 font-semibold text-right">MRR</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="space-y-4">
      <div class="glass rounded-2xl p-4 hero-grid">
        <div class="text-[11px] uppercase tracking-wider text-faint font-semibold">MRR if saved</div>
        <div class="font-display font-extrabold text-3xl text-white mt-1 glow-text">${naira(newMRR)}</div>
        <div class="text-[12px] mt-1 ${diff > 0 ? "text-emerald-300" : diff < 0 ? "text-rose-300" : "text-muted"}">${diff ? (diff > 0 ? "+" : "−") + naira(Math.abs(diff)) + " vs today" : "Same as today"} · current ${naira(curMRR)}</div>
        <div class="text-[11px] text-faint mt-2">Assumes every current subscriber stays on their plan.</div>
      </div>
      ${chartCard("Revenue by plan", "Today vs with your edits", chartBox("ch_price", {
        grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true }, legend: { top: 0 },
        xAxis: { type: "category", data: proj.map(p => p.name), axisLabel: { interval: 0, rotate: 30 } }, yAxis: { type: "value", axisLabel: { formatter: v => "₦" + compact(v) } },
        tooltip: { trigger: "axis", valueFormatter: v => naira(v) },
        series: [{ name: "Today", type: "bar", barMaxWidth: 14, data: proj.map(p => p.price * (subs[p.key] || 0)), itemStyle: { color: CH.teal, borderRadius: [4, 4, 0, 0] } },
          { name: "With edits", type: "bar", barMaxWidth: 14, data: proj.map(p => priceOf(p) * (subs[p.key] || 0)), itemStyle: { color: CH.gold, borderRadius: [4, 4, 0, 0] } }],
      }, 240), { id: "ch_price" })}
    </div></div>`;
}

/* ----------------------------- newsletter --------------------------- */

const NL_STATUS_META = {
  sent:   { color: "#5eead4", bg: "rgba(94,234,212,.14)",  ring: "border-brand-bright/40",   label: it => `Sent · ${it.sent_count ?? 0}` },
  ready:  { color: "#6ee7b7", bg: "rgba(110,231,183,.14)", ring: "border-emerald-400/50",    label: () => "Ready" },
  failed: { color: "#fda4af", bg: "rgba(253,164,175,.14)", ring: "border-rose-400/50",       label: () => "Failed" },
  draft:  { color: "#cbd5e1", bg: "rgba(203,213,225,.10)", ring: "border-edge",              label: () => "Draft" },
};

function newsletterDayCard(dateStr, it, isToday) {
  const d = new Date(dateStr + "T00:00:00");
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" });
  const meta = it ? NL_STATUS_META[it.status] || NL_STATUS_META.draft : null;
  const attr = !it ? `data-sched-new="${dateStr}"` : `data-sched-edit="${it.id}"`;
  const title = it ? esc(it.subject || it.brief) : "";
  return `<button ${attr} class="group text-left rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all duration-150
      ${isToday ? "border-brand-bright/60 shadow-[0_0_0_1px_rgba(45,212,191,.25)]" : it ? meta.ring : "border-edge/70 border-dashed"}
      ${it ? "bg-panel hover:border-brand/50" : "bg-transparent hover:bg-edge/30 hover:border-edge"}"
      style="min-height:96px;">
    <div class="flex items-center justify-between">
      <span class="text-[10px] font-mono uppercase tracking-wide ${isToday?"text-brand-bright":"text-faint"}">${wd}${isToday?" · today":""}</span>
      <span class="text-xs font-bold ${isToday?"text-brand-bright":"text-slate-200"}">${d.getDate()}</span>
    </div>
    ${it
      ? `<div class="text-[11.5px] leading-snug text-slate-100 flex-1" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${title}</div>
         <span class="self-start text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style="color:${meta.color};background:${meta.bg}">${meta.label(it)}</span>`
      : `<div class="flex-1 flex items-center justify-center text-faint text-xl leading-none opacity-0 group-hover:opacity-100 transition-opacity">+</div>`}
  </button>`;
}

// Drafted, unapproved issues from today onwards — what "Mark all ready" will approve.
function readyCandidates() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = ymd(today);
  return (state.nlSchedule || []).filter(it => it.status === "draft" && it.subject && it.body_html && it.send_date >= todayStr);
}

function newsletterCalendar() {
  const byDate = {};
  (state.nlSchedule || []).forEach(it => byDate[it.send_date] = it);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = ymd(today);
  const week = offset => {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset * 7 + i)));
    return out;
  };
  const weekGrid = days => `<div class="grid grid-cols-7 gap-2">${days.map(ds => newsletterDayCard(ds, byDate[ds], ds === todayStr)).join("")}</div>`;
  const plannedCount = (state.nlSchedule || []).filter(it => it.status === "ready" || it.status === "sent").length;
  const approvable = readyCandidates();
  return card(`<div class="flex items-center justify-between mb-3 flex-wrap gap-1.5">
      <div class="flex items-center gap-2">
        <div class="text-[13px] font-semibold text-white">Calendar</div>
        ${plannedCount ? `<span class="text-[10px] font-bold bg-brand/20 text-brand-bright rounded-full px-2 py-0.5">${plannedCount} planned</span>` : ""}
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div class="text-[11px] text-faint">Auto-sends at 11:00 WAT on days marked <span class="text-emerald-300 font-semibold">Ready</span></div>
        ${approvable.length ? `<button id="markAllReady" class="text-xs font-semibold bg-emerald-500/90 text-ink rounded-lg px-3 py-1.5 hover:bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.3)]">Mark all ready (${approvable.length})</button>` : ""}
      </div></div>
    <div class="space-y-2">${weekGrid(week(0))}</div>
    <div class="h-px bg-edge/60 my-3"></div>
    <div class="space-y-2">${weekGrid(week(1))}</div>`);
}

function newsletterWeekPlanner() {
  return `<div class="rounded-xl2 p-4 mb-4" style="background:linear-gradient(135deg,#0c2724,#0e3d38 60%,#0c2724);border:1px solid rgba(45,212,191,.25)">
    <div class="flex items-center gap-2 mb-1">
      <span class="w-6 h-6 rounded-lg bg-brand-bright/15 text-brand-bright grid place-items-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M12 2 9.5 8.5 3 9l5 4.5L6.5 20 12 16.5 17.5 20 16 13.5l5-4.5-6.5-.5z"/></svg>
      </span>
      <div class="text-[13px] font-semibold text-white">Plan my week with AI</div>
    </div>
    <div class="text-[11px] text-faint mb-2.5">One prompt, several open days fully drafted at once. Review and mark each Ready — nothing sends on its own.</div>
    <textarea id="wpPrompt" rows="2" placeholder="e.g. Feature My Plan and Brand Advisor this week, one consistency tip, keep it upbeat" class="w-full bg-panel/80 border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-bright/60">${esc(state.wpPrompt||"")}</textarea>
    <div class="flex flex-wrap items-center gap-2.5 mt-2.5">
      <label class="text-xs text-slate-300 flex items-center gap-1.5">Issues
        <select id="wpCount" class="bg-panel border border-edge rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-brand-bright/60">
          ${[3,4,5].map(n => `<option value="${n}" ${state.wpCount===n?"selected":""}>${n}</option>`).join("")}
        </select></label>
      <div class="flex gap-1">${NL_STYLES.map(s => `<button data-wp-style="${s.key}" title="${esc(s.label)}" class="text-[11px] font-semibold w-6 h-6 rounded-lg border transition ${state.wpStyle===s.key?"border-brand-bright bg-brand-bright/15 text-brand-bright":"border-edge text-slate-400 hover:border-edge/60"}">${s.key}</button>`).join("")}</div>
      <button id="wpPlanBtn" ${state.wpBusy?"disabled":""} class="text-xs font-semibold bg-brand-bright text-ink rounded-lg px-3.5 py-2 hover:brightness-110 disabled:opacity-50 ml-auto shadow-[0_2px_12px_rgba(45,212,191,.25)]">${state.wpBusy?"Planning your week…":"Plan my week"}</button>
    </div>
  </div>`;
}

function newsletterSchedEditor() {
  const e = state.nlSchedEditing;
  if (!e) return "";
  const dateLabel = new Date(e.send_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const canMarkReady = !!(e.subject && e.body_html);
  const isNew = !e.id;
  const isSent = e.status === "sent";
  return card(`<div class="flex items-center justify-between mb-3">
      <div class="text-[13px] font-semibold text-white">${isSent?"Sent":"Plan"} — ${esc(dateLabel)}</div>
      <button data-sched-cancel class="text-xs text-muted hover:text-white">Close</button></div>
    <label class="block mb-2"><span class="text-[11px] text-faint">Topic</span>
      <input id="schedBrief" ${isSent?"disabled":""} value="${esc(e.brief||"")}" placeholder="e.g. Content Calendar quarterly planning + a consistency tip" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60 disabled:opacity-60"/></label>
    <div class="mb-3"><span class="text-[11px] text-faint block mb-1.5">Template style</span>
      <div class="flex flex-wrap gap-2">${NL_STYLES.map(s => `
        <button data-sched-style="${s.key}" ${isSent?"disabled":""} class="text-left border rounded-lg px-3 py-2 text-xs transition ${e.style===s.key?"border-brand bg-brand/10 text-brand-bright":"border-edge text-slate-300 hover:border-edge/80"}">
          <div class="font-semibold">${s.key} · ${s.label}</div></button>`).join("")}</div></div>
    ${!isSent ? `<div class="flex flex-wrap gap-2 mb-4">
      <button id="schedDraftBtn" ${state.nlSchedBusy?"disabled":""} class="text-xs font-semibold bg-brand text-ink rounded-lg px-3 py-2 hover:bg-brand-bright disabled:opacity-50">${state.nlSchedBusy?"Drafting…":(e.subject?"Regenerate draft":"Generate draft")}</button>
      ${isNew ? `<button id="schedSaveOnlyBtn" class="text-xs font-semibold border border-edge rounded-lg px-3 py-2 text-slate-200 hover:bg-edge/40">Save topic only</button>` : ""}
      ${!isNew ? `<button id="schedDeleteBtn" class="text-xs font-semibold border border-rose-500/50 text-rose-300 rounded-lg px-3 py-2 hover:bg-rose-500/10 ml-auto">Delete</button>` : ""}
    </div>` : ""}
    ${e.subject ? `
    <label class="block mb-2"><span class="text-[11px] text-faint">Subject</span>
      <input id="schedSubject" ${isSent?"disabled":""} value="${esc(e.subject||"")}" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60 disabled:opacity-60"/></label>
    <label class="block mb-2"><span class="text-[11px] text-faint">Inbox preview text</span>
      <input id="schedPreview" ${isSent?"disabled":""} value="${esc(e.preview_text||"")}" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60 disabled:opacity-60"/></label>
    <label class="block mb-3"><span class="text-[11px] text-faint">Body (HTML)</span>
      <textarea id="schedBody" ${isSent?"disabled":""} rows="7" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 font-mono outline-none focus:border-brand/60 disabled:opacity-60">${esc(e.body_html||"")}</textarea></label>
    ${!isSent ? `<div class="flex flex-wrap gap-2 items-center">
      <button id="schedSaveBtn" class="text-xs font-semibold border border-edge rounded-lg px-3 py-2 text-slate-200 hover:bg-edge/40">Save changes</button>
      ${e.status !== "ready" ? `<button id="schedReadyBtn" ${canMarkReady?"":"disabled"} class="text-xs font-semibold bg-emerald-500/90 text-ink rounded-lg px-3 py-2 hover:bg-emerald-400 disabled:opacity-50">Mark ready — sends ${esc(dateLabel)}</button>`
        : `<span class="text-xs font-semibold text-emerald-300 px-1">Ready to send</span>`}
      <button id="schedSendNowBtn" class="text-xs font-semibold border border-brand/50 text-brand rounded-lg px-3 py-2 hover:bg-brand/10 ml-auto">Send now instead</button>
    </div>` : `<div class="text-xs text-muted">Sent to ${e.sent_count ?? 0} subscribers.</div>`}` : ""}
  `);
}

function newsletterSection() {
  const N = state.newsletterDraft || {};
  const nl = state.newsletter || {};
  const hasDraft = !!(N.subject || N.body_html);
  return `
    ${card(`<div class="text-[13px] font-semibold mb-1 text-white">Subscribers</div>
      <div class="flex items-center gap-8 mt-1">
        <div><div class="font-display font-extrabold text-2xl text-brand-bright">${nl.subscribers||0}</div><div class="text-[11px] text-muted">will receive the next send</div></div>
        <div><div class="font-display font-extrabold text-2xl text-slate-400">${nl.opted_out||0}</div><div class="text-[11px] text-muted">opted out</div></div>
      </div>`)}
    ${newsletterWeekPlanner()}
    ${newsletterCalendar()}
    ${newsletterSchedEditor()}
    ${card(`<div class="text-[13px] font-semibold mb-2 text-white">One-off: draft with AI</div>
      <div class="text-[11px] text-faint mb-2 -mt-1">For an immediate send outside the schedule. Use the calendar above to plan ahead.</div>
      <textarea id="nlBrief" rows="2" placeholder="What should this issue focus on? e.g. the new Brand Advisor feature, plus a tip on posting consistency" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60">${esc(state.nlBrief||"")}</textarea>
      <button id="nlDraftBtn" ${state.nlDrafting?"disabled":""} class="mt-2 text-xs font-semibold bg-brand text-ink rounded-lg px-3 py-2 hover:bg-brand-bright disabled:opacity-50">${state.nlDrafting?"Drafting…":"Generate draft"}</button>`)}
    ${hasDraft ? card(`<div class="text-[13px] font-semibold mb-2 text-white">Review &amp; send</div>
      <div class="mb-3"><span class="text-[11px] text-faint block mb-1.5">Template style</span>
        <div class="flex flex-wrap gap-2">${NL_STYLES.map(s => `
          <button data-nl-style="${s.key}" class="text-left border rounded-lg px-3 py-2 text-xs transition ${state.nlStyle===s.key?"border-brand bg-brand/10 text-brand-bright":"border-edge text-slate-300 hover:border-edge/80"}">
            <div class="font-semibold">${s.key} · ${s.label}</div><div class="text-faint">${s.blurb}</div></button>`).join("")}</div></div>
      <label class="block mb-2"><span class="text-[11px] text-faint">Subject</span>
        <input id="nlSubject" value="${esc(N.subject||"")}" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60"/></label>
      <label class="block mb-2"><span class="text-[11px] text-faint">Inbox preview text</span>
        <input id="nlPreviewText" value="${esc(N.preview_text||"")}" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60"/></label>
      <label class="block mb-2"><span class="text-[11px] text-faint">Body (HTML — &lt;p&gt;, &lt;b&gt;, &lt;ul&gt;/&lt;li&gt; only)</span>
        <textarea id="nlBody" rows="8" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 font-mono outline-none focus:border-brand/60">${esc(N.body_html||"")}</textarea></label>
      <div class="text-[11px] text-faint mb-1.5">Content preview <span class="text-slate-500">(send a test to see the actual template chrome)</span></div>
      <div id="nlPreview" class="bg-white text-ink rounded-lg p-4 text-sm mb-3">${N.body_html||""}</div>
      <label class="block mb-2"><span class="text-[11px] text-faint">Send test to</span>
        <input id="nlTestEmail" type="email" value="${esc(state.nlTestEmail || (state.user && state.user.email) || "")}" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand/60"/></label>
      <div class="flex flex-wrap gap-2 items-center">
        <button id="nlTestBtn" class="text-xs font-semibold border border-edge rounded-lg px-3 py-2 text-slate-200 hover:bg-edge/40">Send test</button>
        <button id="nlSendBtn" class="text-xs font-semibold bg-brand text-ink rounded-lg px-3 py-2 hover:bg-brand-bright ml-auto">Send to ${nl.subscribers||0} subscribers</button>
      </div>`) : ""}
  `;
}


/* ------------------------------ wiring ----------------------------- */

function setSection(k) {
  state.section = k; store.set("section", k); state.detail = null;
  if (k !== "agents") state.agentOpen = null;
  renderDash(); window.scrollTo({ top: 0 });
}

async function reloadAll() { await load(); if (state.agentOpen) state.agentDetail = await api(`/api/admin/agents/${state.agentOpen}`); renderDash(); }

function wireDash() {
  $$("[data-section]").forEach(b => b.onclick = () => setSection(b.dataset.section));
  $$("[data-appstatus]").forEach(sel => sel.onchange = async () => {
    try {
      await api(`/api/admin/applications/${sel.dataset.appstatus}/status`, { method: "POST", body: JSON.stringify({ status: sel.value }) });
      const a = (state.applications || []).find(x => String(x.id) === sel.dataset.appstatus); if (a) a.status = sel.value;
      if (state.appView === "board") renderDash();
      toast("Status updated.");
    } catch (e) { toast(e.message, "error"); }
  });
  const lo = $("#logout"); if (lo) lo.onclick = logout;
  const lo2 = $("#logout2"); if (lo2) lo2.onclick = logout;
  const rf = $("#refresh"); if (rf) rf.onclick = async () => { rf.textContent = "…"; await reloadAll(); toast("Refreshed."); };
  const ar = $("#autoRefresh"); if (ar) ar.onclick = () => { state.autoRefresh = !state.autoRefresh; store.set("autoRefresh", state.autoRefresh); renderDash(); };
  const op = $("#openPalette"); if (op) op.onclick = openPalette;
  $$("[data-range]").forEach(b => b.onclick = async () => {
    state.range = +b.dataset.range; store.set("range", state.range);
    b.textContent = "…"; await loadAnalytics(); renderDash();
  });
  $$("[data-atab]").forEach(b => b.onclick = () => { state.aTab = b.dataset.atab; store.set("aTab", state.aTab); renderDash(); });
  $$("[data-ovm]").forEach(b => b.onclick = () => { state.ovMetric = b.dataset.ovm; store.set("ovMetric", state.ovMetric); renderDash(); });
  $$("[data-seg-open]").forEach(b => b.onclick = () => {
    state.seg = { at_risk: "at_risk", never_generated: "never", near_limit: "free" }[b.dataset.segOpen] || "all"; setSection("customers");
  });
  $$("[data-agent-jump]").forEach(b => b.onclick = () => { state.section = "agents"; store.set("section", "agents"); openAgent(b.dataset.agentJump); });
  wireChartTools();
  // chart view toggles must persist
  $$('[data-ctool="view"]').forEach(b => b.addEventListener("click", () => store.set("chartView", state.chartView)));
  const plansChart = chartById("ov_plans");
  if (plansChart) plansChart.on("click", p => {
    const plan = (state.analytics.plans.find(x => x.name === p.name) || {}).plan;
    if (plan) { state.planFilter = plan; state.seg = "all"; setSection("customers"); }
  });
  wireCustomers();
  wireApplications();
  wireRows();
  wireNewsletter();
  wirePricing();
  wireAgents();
}

function wireCustomers() {
  if (state.section !== "customers") return;
  $$("[data-seg]").forEach(b => b.onclick = () => { state.seg = b.dataset.seg; state.selected = new Set(); renderDash(); });
  $$("[data-sort]").forEach(h => h.onclick = () => {
    const k = h.dataset.sort;
    state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : -1 }; store.set("sort", state.sort); renderDash();
  });
  $$("[data-cview]").forEach(b => b.onclick = () => { state.custView = b.dataset.cview; store.set("custView", state.custView); renderDash(); });
  const dn = $("#density"); if (dn) dn.onclick = () => { state.density = state.density === "compact" ? "comfy" : "compact"; store.set("density", state.density); renderDash(); };
  const pf = $("#planFilter"); if (pf) pf.onchange = () => { state.planFilter = pf.value; renderDash(); };
  const se = $("#userSearch");
  if (se) se.oninput = () => {
    state.q = se.value;
    const list = filteredUsers();
    const tb = $("#custBody");
    if (tb) { tb.innerHTML = list.map(u => userRow(u, state.density === "compact")).join("") || `<tr><td colspan="10" class="py-6 text-center text-muted">No customers match.</td></tr>`; wireRows(); wireUserSelect(); }
    else { renderDash(); const s2 = $("#userSearch"); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } }
    const cnt = $("#custCount"); if (cnt) cnt.textContent = `${list.length} of ${state.users.length}`;
  };
  wireUserSelect();
  const sa = $("#selAllUsers"); if (sa) sa.onchange = () => { state.selected = sa.checked ? new Set(filteredUsers().map(u => u.id)) : new Set(); renderDash(); };
  const csvRows = list => list.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, plan: u.plan_name, generations: u.gens,
    tokens: (u.it || 0) + (u.ot || 0), ai_spend_naira: Math.round(u.cost || 0), last_active: u.last_active ? new Date(u.last_active * 1000).toISOString() : "",
    joined: new Date(u.created_at * 1000).toISOString(), suspended: u.suspended ? "yes" : "no" }));
  const ex = $("#exportCSV"); if (ex) ex.onclick = () => downloadCSV("vertil-customers", csvRows(filteredUsers()));
  const be = $("#bulkExport"); if (be) be.onclick = () => downloadCSV("vertil-customers-selected", csvRows(state.users.filter(u => state.selected.has(u.id))));
  const bc = $("#bulkClear"); if (bc) bc.onclick = () => { state.selected = new Set(); renderDash(); };
  const bp = $("#bulkPlan"); if (bp) bp.onchange = async () => {
    const plan = bp.value; if (!plan) return;
    const ids = [...state.selected];
    if (!confirm(`Move ${ids.length} customer${ids.length > 1 ? "s" : ""} to the ${plan} plan?`)) { bp.value = ""; return; }
    let ok = 0;
    for (const id of ids) { try { await api(`/api/admin/users/${id}/update`, { method: "POST", body: JSON.stringify({ plan }) }); ok++; } catch {} }
    toast(`Updated ${ok} of ${ids.length}.`);
    state.selected = new Set(); await load(); renderDash();
  };
}
function wireUserSelect() {
  $$("[data-usel]").forEach(c => c.onchange = () => {
    const id = +c.dataset.usel; c.checked ? state.selected.add(id) : state.selected.delete(id); renderDash();
  });
}

function wirePricing() {
  if (state.section !== "pricing") return;
  $$("[data-price-input]").forEach(inp => {
    inp.onchange = () => { state.pricingDraft[inp.dataset.priceInput] = +inp.value; renderDash(); };
    inp.onkeydown = e => { if (e.key === "Enter") inp.blur(); };
  });
  $$("[data-price-save]").forEach(b => b.onclick = async () => {
    const key = b.dataset.priceSave;
    const price = +$(`[data-price-input="${key}"]`).value;
    if (!(price >= 0)) return toast("Enter a valid price.", "error");
    const plan = (state.pricing || []).find(p => p.key === key);
    if (!confirm(`Set ${plan.name} to ${naira(price)} a month? New checkouts use it straight away.`)) return;
    state.pricingBusy[key] = true; renderDash();
    try {
      await api("/api/admin/pricing", { method: "POST", body: JSON.stringify({ plan: key, price }) });
      state.pricing = await api("/api/admin/pricing"); delete state.pricingDraft[key];
      await loadAnalytics();
      toast(`${plan.name} price updated.`);
    } catch (ex) { toast(ex.message, "error"); }
    state.pricingBusy[key] = false; renderDash();
  });
  $$("[data-price-reset]").forEach(b => b.onclick = async () => {
    const key = b.dataset.priceReset;
    const plan = (state.pricing || []).find(p => p.key === key);
    if (!plan) return;
    if (!confirm(`Reset ${plan.name} back to its default price of ${naira(plan.default_price)}?`)) return;
    state.pricingBusy[key] = true; renderDash();
    try {
      await api(`/api/admin/pricing/${key}`, { method: "DELETE" });
      state.pricing = await api("/api/admin/pricing"); delete state.pricingDraft[key];
      await loadAnalytics();
      toast(`${plan.name} reset to default.`);
    } catch (ex) { toast(ex.message, "error"); }
    state.pricingBusy[key] = false; renderDash();
  });
}

/* --------------------------- command palette ----------------------- */

function openPalette() {
  if ($("#palette")) return;
  const m = document.createElement("div");
  m.id = "palette";
  m.className = "fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4 fade-in";
  m.innerHTML = `<div class="glass rounded-2xl w-full max-w-xl overflow-hidden">
    <input id="palInput" placeholder="Jump to a section, customer or agent…" class="w-full bg-transparent px-5 py-4 text-[15px] text-white outline-none border-b border-edge"/>
    <div id="palList" class="max-h-[50vh] overflow-y-auto scroll-thin p-2"></div></div>`;
  document.body.appendChild(m);
  const items = () => {
    const q = $("#palInput").value.toLowerCase().trim();
    const out = [
      ...NAV.map(n => ({ label: n.label, hint: "Section", run: () => setSection(n.key) })),
      ...ANALYTICS_TABS.map(([k, l]) => ({ label: "Analytics: " + l, hint: "Chart", run: () => { state.aTab = k; store.set("aTab", k); setSection("analytics"); } })),
      ...(state.agents?.agents || []).map(a => ({ label: "Run " + a.name, hint: "Agent", run: () => { state.section = "agents"; store.set("section", "agents"); openAgent(a.key); } })),
      ...(state.users || []).map(u => ({ label: u.name || u.email, hint: u.email + " · " + u.plan_name, run: async () => { state.detail = await api(`/api/admin/users/${u.id}`); renderDash(); } })),
    ];
    return (q ? out.filter(i => (i.label + " " + i.hint).toLowerCase().includes(q)) : out).slice(0, 30);
  };
  let sel = 0, cur = [];
  const draw = () => {
    cur = items(); sel = Math.min(sel, Math.max(0, cur.length - 1));
    $("#palList").innerHTML = cur.map((it, i) => `<button data-pi="${i}" class="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${i === sel ? "bg-brand/20 text-white" : "text-slate-300 hover:bg-edge/40"}">
      <span class="flex-1 truncate">${esc(it.label)}</span><span class="text-[11px] text-faint truncate max-w-[50%]">${esc(it.hint)}</span></button>`).join("") || '<div class="px-3 py-4 text-sm text-muted">No matches.</div>';
    $$("[data-pi]").forEach(b => b.onclick = () => go(+b.dataset.pi));
  };
  const close = () => m.remove();
  const go = i => { const it = cur[i]; close(); if (it) it.run(); };
  m.onclick = e => { if (e.target === m) close(); };
  const inp = $("#palInput");
  inp.oninput = () => { sel = 0; draw(); };
  inp.onkeydown = e => {
    if (e.key === "ArrowDown") { sel = Math.min(sel + 1, cur.length - 1); draw(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === "Enter") go(sel);
    else if (e.key === "Escape") close();
  };
  draw(); inp.focus();
}
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && state.user) { e.preventDefault(); openPalette(); }
  if (e.key === "Escape" && state.detail && !$("#palette")) { state.detail = null; renderDash(); }
});

// Live mode: refresh data every minute unless the admin is typing or a dialog is open.
setInterval(async () => {
  if (!state.autoRefresh || !state.user || document.hidden) return;
  const a = document.activeElement;
  if (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) || a?.isContentEditable || $("#palette") || state.detail) return;
  try { await load(); renderDash(); } catch {}
}, 60000);

/* --------------------------- customer drawer ----------------------- */

function userDetail(d) {
  const u = d.user;
  const stat = (l, v) => `<div class="rounded-xl bg-paper/60 border border-edge px-3 py-2.5"><div class="text-[10px] uppercase tracking-wide text-faint">${l}</div><div class="font-semibold text-sm mt-0.5 text-slate-100">${v}</div></div>`;
  return `<div class="fade-up">
    <div class="flex items-start justify-between mb-4 gap-3">
      <div class="flex items-center gap-3 min-w-0"><span class="w-11 h-11 rounded-full grid place-items-center font-bold text-ink text-lg shrink-0" style="background:linear-gradient(135deg,#2dd4bf,#0e9488);box-shadow:0 0 18px rgba(45,212,191,.4)">${esc((u.name || u.email || "?")[0].toUpperCase())}</span>
        <div class="min-w-0"><div class="font-display font-extrabold text-lg text-white truncate">${esc(u.name || "—")} ${u.is_admin ? '<span class="text-[8.5px] bg-brand text-ink px-1 py-0.5 rounded align-middle">ADMIN</span>' : ""}</div>
          <div class="text-xs text-muted">${esc(u.email)}${u.phone ? " · " + phoneLink(u.phone) : ""}</div>
          <div class="text-xs text-faint">${esc(u.plan_name)} plan · joined ${fmtDate(u.created_at)}</div></div></div>
      <button id="closeDetail" class="seg">✕</button></div>
    ${u.suspended ? '<div class="mb-3 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">This account is suspended — the user cannot log in.</div>' : ""}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      ${stat("Generations", d.gens)}${stat("AI spend", naira(d.cost))}
      ${stat("Tokens", (d.input_tokens + d.output_tokens).toLocaleString())}${stat("Brands", d.brands)}
      ${stat("Calendars", d.calendars)}${stat("Saved copy", d.favorites)}
      ${stat("Feedback", "👍 " + d.feedback_up + " · 👎 " + d.feedback_down)}${stat("Gigs", d.gigs + " (" + naira(d.gigs_value) + ")")}
    </div>
    ${(d.daily && d.daily.length) ? `<div class="glass rounded-2xl p-3 mb-4"><div class="text-[12px] font-semibold text-white mb-1">Activity · recent days</div>
      ${chartBox("ch_user", lineOpt(d.daily.map(x => x.d), [{ name: "Generations", data: d.daily.map(x => x.n) }], { type: "bar" }), 150)}</div>` : ""}
    ${d.by_type.length ? `<div class="glass rounded-2xl p-3 mb-4"><div class="text-[12px] font-semibold text-white mb-2">What they generate</div>
      <div class="space-y-2">${bars(d.by_type.map(t => ({ label: t.label, value: t.n, sub: t.n })), "linear-gradient(90deg,#0e9488,#2dd4bf)")}</div></div>` : ""}
    ${adminControls(u)}
    <div class="text-[12px] font-semibold mb-2 text-white">Recent activity</div>
    <div class="space-y-1.5">${(d.recent || []).map(g => `<div class="flex items-center gap-2 text-xs bg-paper/60 border border-edge rounded-lg px-3 py-2">
      <span class="font-medium whitespace-nowrap text-slate-200">${esc(g.label)}</span>
      <span class="text-muted truncate flex-1">${esc(g.brief || "")}</span>
      <span class="text-faint tabular-nums whitespace-nowrap">${((g.input_tokens || 0) + (g.output_tokens || 0)).toLocaleString()} tok</span>
      <span class="text-faint tabular-nums whitespace-nowrap">${naira(g.cost)}</span></div>`).join("") || '<p class="text-xs text-muted">No activity yet.</p>'}</div>
  </div>`;
}

function wireNewsletter() {
  if (state.section !== "newsletter") return;
  const brief = $("#nlBrief"); if (brief) brief.oninput = () => state.nlBrief = brief.value;
  const draftBtn = $("#nlDraftBtn");
  if (draftBtn) draftBtn.onclick = async () => {
    const b = ($("#nlBrief")?.value || "").trim();
    if (!b) return toast("Describe what this issue should cover first.", "error");
    state.nlBrief = b; state.nlDrafting = true; renderDash();
    try { state.newsletterDraft = await api("/api/admin/newsletter/draft", { method: "POST", body: JSON.stringify({ brief: b }) }); }
    catch (e) { toast(e.message, "error"); }
    state.nlDrafting = false; renderDash();
  };
  const subj = $("#nlSubject");
  if (subj) subj.oninput = () => { state.newsletterDraft = state.newsletterDraft || {}; state.newsletterDraft.subject = subj.value; };
  const pvt = $("#nlPreviewText");
  if (pvt) pvt.oninput = () => { state.newsletterDraft = state.newsletterDraft || {}; state.newsletterDraft.preview_text = pvt.value; };
  const body = $("#nlBody");
  if (body) body.oninput = () => {
    state.newsletterDraft = state.newsletterDraft || {}; state.newsletterDraft.body_html = body.value;
    const pv = $("#nlPreview"); if (pv) pv.innerHTML = body.value;
  };
  $$("[data-nl-style]").forEach(b => b.onclick = () => { state.nlStyle = b.dataset.nlStyle; renderDash(); });
  const testEmail = $("#nlTestEmail");
  if (testEmail) testEmail.oninput = () => state.nlTestEmail = testEmail.value;
  const testBtn = $("#nlTestBtn");
  if (testBtn) testBtn.onclick = async () => {
    try {
      const r = await api("/api/admin/newsletter/send-test", { method: "POST", body: JSON.stringify({
        subject: $("#nlSubject").value, body: $("#nlBody").value,
        preview_text: $("#nlPreviewText").value, style: state.nlStyle, to: $("#nlTestEmail").value }) });
      toast("Test sent to " + r.sent_to);
    } catch (e) { toast(e.message, "error"); }
  };
  const sendBtn = $("#nlSendBtn");
  if (sendBtn) sendBtn.onclick = async () => {
    const n = (state.newsletter && state.newsletter.subscribers) || 0;
    if (!confirm(`Send this newsletter to ${n} subscribers? This can't be undone.`)) return;
    try {
      const r = await api("/api/admin/newsletter/send", { method: "POST", body: JSON.stringify({
        subject: $("#nlSubject").value, body: $("#nlBody").value,
        preview_text: $("#nlPreviewText").value, style: state.nlStyle, confirm: true }) });
      toast(`Sent to ${r.sent}/${r.total} subscribers.`);
      state.newsletter = await api("/api/admin/newsletter");
      renderDash();
    } catch (e) { toast(e.message, "error"); }
  };

  const wpPromptEl = $("#wpPrompt"); if (wpPromptEl) wpPromptEl.oninput = () => state.wpPrompt = wpPromptEl.value;
  const wpCountEl = $("#wpCount"); if (wpCountEl) wpCountEl.onchange = () => state.wpCount = +wpCountEl.value;
  $$("[data-wp-style]").forEach(b => b.onclick = () => { state.wpStyle = b.dataset.wpStyle; renderDash(); });
  const wpPlanBtn = $("#wpPlanBtn");
  if (wpPlanBtn) wpPlanBtn.onclick = async () => {
    const p = ($("#wpPrompt")?.value || "").trim();
    if (!p) return toast("Describe what this week should cover.", "error");
    state.wpPrompt = p; state.wpBusy = true; renderDash();
    try {
      const r = await api("/api/admin/newsletter/plan-week", { method: "POST", body: JSON.stringify({ prompt: p, count: state.wpCount, style: state.wpStyle }) });
      await reloadSchedule();
      toast(`Drafted ${r.created.length} issue${r.created.length===1?"":"s"} — review them below and mark each Ready.`);
    } catch (ex) { toast(ex.message, "error"); }
    state.wpBusy = false; renderDash();
  };

  const markAll = $("#markAllReady");
  if (markAll) markAll.onclick = async () => {
    const items = readyCandidates();
    const list = items.map(it => `• ${new Date(it.send_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${it.subject}`).join("\n");
    if (!confirm(`Mark ${items.length} issue${items.length > 1 ? "s" : ""} ready? Each will send automatically at 11:00 WAT on its date.\n\n${list}`)) return;
    try {
      const r = await api("/api/admin/newsletter/schedule/mark-ready", { method: "POST", body: JSON.stringify({ ids: items.map(it => it.id) }) });
      await reloadSchedule(); renderDash();
      toast(`Marked ${r.marked} ready.${r.skipped.length ? ` Skipped ${r.skipped.length} (${r.skipped[0].reason}).` : ""}`);
    } catch (ex) { toast(ex.message, "error"); }
  };

  $$("[data-sched-new]").forEach(b => b.onclick = () => {
    state.nlSchedEditing = { id: null, send_date: b.dataset.schedNew, brief: "", subject: "", preview_text: "", body_html: "", style: "A", status: "draft" };
    renderDash();
  });
  $$("[data-sched-edit]").forEach(b => b.onclick = () => {
    const it = (state.nlSchedule || []).find(x => String(x.id) === b.dataset.schedEdit);
    if (it) { state.nlSchedEditing = { ...it }; renderDash(); }
  });
  const schedCancel = $("[data-sched-cancel]"); if (schedCancel) schedCancel.onclick = () => { state.nlSchedEditing = null; renderDash(); };
  const schedBriefEl = $("#schedBrief"); if (schedBriefEl) schedBriefEl.oninput = () => state.nlSchedEditing.brief = schedBriefEl.value;
  $$("[data-sched-style]").forEach(b => b.onclick = () => { state.nlSchedEditing.style = b.dataset.schedStyle; renderDash(); });
  const schedSubjEl = $("#schedSubject"); if (schedSubjEl) schedSubjEl.oninput = () => state.nlSchedEditing.subject = schedSubjEl.value;
  const schedPrevEl = $("#schedPreview"); if (schedPrevEl) schedPrevEl.oninput = () => state.nlSchedEditing.preview_text = schedPrevEl.value;
  const schedBodyEl = $("#schedBody"); if (schedBodyEl) schedBodyEl.oninput = () => state.nlSchedEditing.body_html = schedBodyEl.value;

  const schedDraftBtn = $("#schedDraftBtn");
  if (schedDraftBtn) schedDraftBtn.onclick = async () => {
    const e = state.nlSchedEditing;
    if (!e.brief.trim()) return toast("Add a topic first.", "error");
    state.nlSchedBusy = true; renderDash();
    try {
      let id = e.id;
      if (!id) {
        const created = await api("/api/admin/newsletter/schedule", { method: "POST", body: JSON.stringify({ send_date: e.send_date, brief: e.brief, style: e.style }) });
        id = created.id; state.nlSchedEditing.id = id;
      } else {
        await api(`/api/admin/newsletter/schedule/${id}`, { method: "PUT", body: JSON.stringify({ brief: e.brief, style: e.style }) });
      }
      state.nlSchedEditing = await api(`/api/admin/newsletter/schedule/${id}/draft`, { method: "POST" });
      await reloadSchedule();
      toast("Draft ready — review and mark it Ready when you're happy.");
    } catch (ex) { toast(ex.message, "error"); }
    state.nlSchedBusy = false; renderDash();
  };
  const schedSaveOnlyBtn = $("#schedSaveOnlyBtn");
  if (schedSaveOnlyBtn) schedSaveOnlyBtn.onclick = async () => {
    const e = state.nlSchedEditing;
    if (!e.brief.trim()) return toast("Add a topic first.", "error");
    try {
      state.nlSchedEditing = await api("/api/admin/newsletter/schedule", { method: "POST", body: JSON.stringify({ send_date: e.send_date, brief: e.brief, style: e.style }) });
      await reloadSchedule();
      state.nlSchedEditing = null;
      toast("Topic saved for that day.");
      renderDash();
    } catch (ex) { toast(ex.message, "error"); }
  };
  const schedDeleteBtn = $("#schedDeleteBtn");
  if (schedDeleteBtn) schedDeleteBtn.onclick = async () => {
    if (!confirm("Delete this scheduled issue?")) return;
    try {
      await api(`/api/admin/newsletter/schedule/${state.nlSchedEditing.id}`, { method: "DELETE" });
      state.nlSchedEditing = null;
      await reloadSchedule(); renderDash();
      toast("Deleted.");
    } catch (ex) { toast(ex.message, "error"); }
  };
  const schedSaveBtn = $("#schedSaveBtn");
  if (schedSaveBtn) schedSaveBtn.onclick = async () => {
    const e = state.nlSchedEditing;
    try {
      state.nlSchedEditing = await api(`/api/admin/newsletter/schedule/${e.id}`, { method: "PUT", body: JSON.stringify({
        subject: e.subject, preview_text: e.preview_text, body_html: e.body_html, style: e.style }) });
      await reloadSchedule(); renderDash();
      toast("Changes saved.");
    } catch (ex) { toast(ex.message, "error"); }
  };
  const schedReadyBtn = $("#schedReadyBtn");
  if (schedReadyBtn) schedReadyBtn.onclick = async () => {
    const e = state.nlSchedEditing;
    try {
      await api(`/api/admin/newsletter/schedule/${e.id}`, { method: "PUT", body: JSON.stringify({
        subject: e.subject, preview_text: e.preview_text, body_html: e.body_html, style: e.style, status: "ready" }) });
      state.nlSchedEditing = null;
      await reloadSchedule(); renderDash();
      toast(`Marked Ready — sends automatically on ${e.send_date}.`);
    } catch (ex) { toast(ex.message, "error"); }
  };
  const schedSendNowBtn = $("#schedSendNowBtn");
  if (schedSendNowBtn) schedSendNowBtn.onclick = async () => {
    const e = state.nlSchedEditing;
    if (!confirm("Send this issue to all subscribers right now?")) return;
    try {
      // persist any edits first so what sends matches what's on screen
      await api(`/api/admin/newsletter/schedule/${e.id}`, { method: "PUT", body: JSON.stringify({
        subject: e.subject, preview_text: e.preview_text, body_html: e.body_html, style: e.style }) });
      const r = await api(`/api/admin/newsletter/schedule/${e.id}/send-now`, { method: "POST" });
      toast(`Sent to ${r.sent}/${r.total} subscribers.`);
      state.nlSchedEditing = null;
      state.newsletter = await api("/api/admin/newsletter");
      await reloadSchedule(); renderDash();
    } catch (ex) { toast(ex.message, "error"); }
  };
}

function adminControls(u) {
  const plans = (state.overview && state.overview.all_plans) || [];
  const opts = plans.map(p => `<option value="${p.key}" ${p.key === u.plan ? "selected" : ""}>${esc(p.name)}${p.price ? " · " + naira(p.price) : ""}</option>`).join("");
  const locked = u.is_admin;  // don't allow suspend/delete on admins from UI
  return `<div class="bg-paper border border-edge rounded-xl2 p-4 mb-4" data-admin-id="${u.id}">
    <div class="text-[12px] font-semibold mb-3 text-white flex items-center gap-2">Manage customer ${locked ? '<span class="text-[10px] text-faint font-normal">(admin — limited)</span>' : ""}</div>
    <div class="flex flex-wrap items-end gap-3">
      <div><div class="text-[10px] uppercase tracking-wide text-faint mb-1">Plan</div>
        <select id="acPlan" class="bg-panel border border-edge rounded-lg px-3 py-2 text-xs text-slate-100">${opts}</select></div>
      <button id="acPlanSave" class="text-xs font-semibold bg-brand text-ink rounded-lg px-3 py-2 hover:bg-brand-bright">Apply plan</button>
      ${locked ? "" : `<button id="acSuspend" class="text-xs font-semibold rounded-lg px-3 py-2 border ${u.suspended ? "border-brand/50 text-brand hover:bg-brand/10" : "border-amber-500/50 text-amber-300 hover:bg-amber-500/10"}">${u.suspended ? "Unsuspend" : "Suspend"}</button>
      <button id="acDelete" class="text-xs font-semibold rounded-lg px-3 py-2 border border-rose-500/50 text-rose-300 hover:bg-rose-500/10 ml-auto">Delete user</button>`}
    </div>
    <div class="mt-3 flex items-center gap-2.5 flex-wrap">
      <div class="text-[10px] uppercase tracking-wide text-faint">Admin access</div>
      ${u.is_owner
        ? '<span class="text-[11px] font-semibold text-brand bg-brand/15 rounded-full px-2.5 py-1">Owner admin · permanent</span>'
        : `<button id="acAdmin" data-on="${u.is_admin ? 0 : 1}" class="text-xs font-semibold rounded-lg px-3 py-1.5 border ${u.is_admin ? "border-rose-500/50 text-rose-300 hover:bg-rose-500/10" : "border-brand/50 text-brand hover:bg-brand/10"}">${u.is_admin ? "Remove admin" : "Make admin"}</button>
          <span class="text-[10px] text-faint">${u.is_admin ? "This user can access the admin console." : "Grant this user access to the admin console."}</span>`}
    </div>
    <div class="mt-3"><div class="text-[10px] uppercase tracking-wide text-faint mb-1">Admin notes (private)</div>
      <textarea id="acNotes" rows="2" class="w-full bg-panel border border-edge rounded-lg px-3 py-2 text-xs text-slate-200" placeholder="Internal notes about this customer…">${esc(u.notes || "")}</textarea>
      <button id="acNotesSave" class="mt-2 text-xs font-semibold border border-edge rounded-lg px-3 py-1.5 text-slate-200 hover:bg-edge/40">Save notes</button></div>
  </div>`;
}

async function adminAct(uid, body, opts = {}) {
  try {
    if (opts.del) await api(`/api/admin/users/${uid}`, { method: "DELETE" });
    else await api(`/api/admin/users/${uid}/update`, { method: "POST", body: JSON.stringify(body) });
    await load();  // refresh overview + user list
    state.detail = opts.del ? null : await api(`/api/admin/users/${uid}`);
    renderDash();
    toast(opts.del ? "Customer deleted." : "Saved.");
  } catch (e) { toast(e.message, "error"); }
}

function wireRows() {
  $$("[data-user]").forEach(b => b.onclick = async () => {
    try { state.detail = await api(`/api/admin/users/${b.dataset.user}`); renderDash(); }
    catch (e) { toast(e.message, "error"); }
  });
  const c = $("#closeDetail"); if (c) c.onclick = () => { state.detail = null; renderDash(); };
  const bg = $("#drawerBg"); if (bg) bg.onclick = () => { state.detail = null; renderDash(); };

  const panel = $("[data-admin-id]");
  if (panel) {
    const uid = +panel.dataset.adminId;
    const ps = $("#acPlanSave"); if (ps) ps.onclick = () => adminAct(uid, { plan: $("#acPlan").value });
    const su = $("#acSuspend"); if (su) su.onclick = () => adminAct(uid, { suspended: !(state.detail.user.suspended) });
    const ns = $("#acNotesSave"); if (ns) ns.onclick = () => adminAct(uid, { notes: $("#acNotes").value });
    const dl = $("#acDelete"); if (dl) dl.onclick = () => {
      const u = state.detail.user;
      if (confirm(`Permanently delete ${u.email} and ALL their data?\n\nThis cannot be undone.`)) adminAct(uid, {}, { del: true });
    };
    const aa = $("#acAdmin"); if (aa) aa.onclick = async () => {
      const on = aa.dataset.on === "1";
      if (!on && !confirm("Remove admin access from this user?")) return;
      try {
        await api(`/api/admin/users/${uid}/admin`, { method: "POST", body: JSON.stringify({ on }) });
        await load(); state.detail = await api(`/api/admin/users/${uid}`); renderDash();
      } catch (e) { toast(e.message, "error"); }
    };
  }
}

boot();
