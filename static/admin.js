/* Vertil — standalone Admin Console (separate login, dark theme) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function vword({ size = "20px", color = "#f4f7f6", accent = "#2dd4bf" } = {}) {
  return `<span class="vword" style="font-size:${size};--vi:${accent};color:${color}">Vert<span class="vi"><span class="vi-tip"></span><span class="vi-stem"></span></span>l</span>`;
}
function vmark(px = 36) {
  return `<span class="rounded-xl bg-brand grid place-items-center" style="width:${px}px;height:${px}px">
    <span class="vi" style="font-size:${Math.round(px * 0.5)}px"><span class="vi-tip" style="border-bottom-color:#fff"></span><span class="vi-stem" style="background:#fff"></span></span></span>`;
}

const state = { user: null, overview: null, users: null, applications: null, detail: null, section: "overview", q: "",
  newsletter: null, newsletterDraft: null, nlBrief: "", nlDrafting: false, nlStyle: "A", nlTestEmail: "",
  nlSchedule: [], nlSchedEditing: null, nlSchedBusy: false,
  wpPrompt: "", wpCount: 3, wpStyle: "A", wpBusy: false };

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
  t.innerHTML = `<div style="background:${bg};color:${fg};border:${border};font-size:13px;font-weight:600;padding:11px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:340px;">${esc(msg)}</div>`;
  clearTimeout(window.__adminToastTO);
  window.__adminToastTO = setTimeout(() => { t.innerHTML = ""; }, 3400);
}

/* ------------------------------ boot ------------------------------ */

async function boot() {
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
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
async function reloadSchedule() {
  const { start, end } = scheduleWindow();
  state.nlSchedule = await api(`/api/admin/newsletter/schedule?start=${start}&end=${end}`);
}

async function load() {
  const { start, end } = scheduleWindow();
  const [ov, us, apps, nl, sched] = await Promise.all([
    api("/api/admin/overview"), api("/api/admin/users"), api("/api/admin/applications"),
    api("/api/admin/newsletter"), api(`/api/admin/newsletter/schedule?start=${start}&end=${end}`),
  ]);
  state.overview = ov; state.users = us; state.applications = apps; state.newsletter = nl; state.nlSchedule = sched;
}

/* ------------------------------ login ----------------------------- */

function renderLogin(msg) {
  $("#app").innerHTML = `
  <div class="min-h-screen grid place-items-center p-6">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2.5 mb-6 justify-center">
        ${vmark(38)}
        <div>${vword({ size: "20px" })}
          <div class="text-[11px] text-muted leading-none mt-1 tracking-wide uppercase font-mono">Admin Console</div></div>
      </div>
      <div class="bg-panel border border-edge rounded-xl2 p-6">
        <h1 class="font-display font-extrabold text-xl">Sign in</h1>
        <p class="text-sm text-muted mt-1">Administrator access only.</p>
        <form id="loginForm" class="mt-5 space-y-3">
          <div><label class="text-xs font-semibold text-muted">Email</label>
            <input name="email" type="email" required placeholder="admin@yarn.ai" class="ai"/></div>
          <div><label class="text-xs font-semibold text-muted">Password</label>
            <input name="password" type="password" required placeholder="••••••••" class="ai"/></div>
          <p id="err" class="text-xs text-rose-400 ${msg ? "" : "hidden"}">${esc(msg)}</p>
          <button id="btn" type="submit" class="w-full py-2.5 rounded-xl font-semibold text-sm text-ink bg-brand hover:bg-brand-dark">Enter console</button>
        </form>
      </div>
      <p class="text-center text-[11px] text-faint mt-4">Looking for the app? <a href="/app" class="text-brand">Open Vertil &rarr;</a></p>
    </div>
  </div>
  <style>.ai{width:100%;margin-top:.25rem;background:#0e131b;border:1px solid #1e2733;border-radius:.6rem;padding:.6rem .75rem;font-size:.9rem;color:#fff;outline:none}
  .ai:focus{border-color:#0b8457;box-shadow:0 0 0 3px rgba(11,132,87,.25)}</style>`;
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
  renderLogin("");
}

/* ---------------------------- dashboard --------------------------- */

function bars(items, color) {
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map(i => `<div class="flex items-center gap-2 text-xs">
    <div class="w-32 truncate text-muted">${esc(i.label)}</div>
    <div class="flex-1 bg-edge rounded-full h-2.5 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.round(i.value / max * 100)}%;background:${color}"></div></div>
    <div class="w-24 text-right tabular-nums text-slate-300">${esc(String(i.sub ?? i.value))}</div></div>`).join("") || `<p class="text-xs text-muted">No data yet.</p>`;
}

function spark(items, key, color) {
  if (!items || !items.length) return `<p class="text-xs text-muted">No data yet.</p>`;
  const max = Math.max(1, ...items.map(i => i[key] || 0));
  return `<div class="flex items-end gap-1 h-16">${items.map(i =>
    `<div class="flex-1 rounded-t" title="${esc(i.d)}: ${i[key] || 0}" style="height:${Math.max(4, Math.round((i[key] || 0) / max * 100))}%;background:${color}"></div>`).join("")}</div>`;
}

function card(inner) { return `<div class="bg-panel border border-edge rounded-xl2 p-4">${inner}</div>`; }

function statCard(label, val, sub, accent = "text-white") {
  return `<div class="bg-panel border border-edge rounded-xl2 p-4">
    <div class="text-[10.5px] font-semibold uppercase tracking-wide text-faint">${label}</div>
    <div class="font-display font-extrabold text-2xl mt-1 ${accent}">${val}</div>
    ${sub ? `<div class="text-[11px] text-muted mt-0.5">${sub}</div>` : ""}</div>`;
}

const PLAN_COLORS = { free: "#5f7a74", starter: "#2dd4bf", growth: "#0e9488", pro: "#d8a13a" };
const planColor = k => PLAN_COLORS[k] || "#0e9488";

// SVG area+line chart for a daily series of {d, <key>}
function svgLine(series, key, color) {
  if (!series || !series.length) return `<div class="text-xs text-muted py-10 text-center">No data yet.</div>`;
  const W = 560, H = 150, padX = 6, top = 10, bot = 20;
  const vals = series.map(s => +s[key] || 0);
  const max = Math.max(1, ...vals), n = series.length;
  const x = i => padX + (W - 2 * padX) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => top + (H - top - bot) * (1 - v / max);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `M${x(0).toFixed(1)} ${(H - bot).toFixed(1)} ` + pts.map(p => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + ` L${x(n - 1).toFixed(1)} ${(H - bot).toFixed(1)} Z`;
  const id = "ln" + Math.random().toString(36).slice(2, 8);
  const grid = [0.5, 1].map(g => `<line x1="${padX}" x2="${W - padX}" y1="${y(max * g).toFixed(1)}" y2="${y(max * g).toFixed(1)}" stroke="#1d3b37" stroke-width="1"/>`).join("");
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:150px" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="${color}"/></svg>`;
}

// SVG donut from [{label, value, color}]
function svgDonut(segs) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const R = 56, C = 2 * Math.PI * R; let off = 0;
  const rings = segs.filter(s => s.value > 0).map(s => {
    const len = (s.value / total) * C;
    const el = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${s.color}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 80 80)"/>`;
    off += len; return el;
  }).join("");
  return `<svg viewBox="0 0 160 160" class="shrink-0" style="width:148px;height:148px">
    <circle cx="80" cy="80" r="56" fill="none" stroke="#16322e" stroke-width="18"/>${rings}
    <text x="80" y="76" text-anchor="middle" fill="#fff" font-size="24" font-weight="700">${total}</text>
    <text x="80" y="98" text-anchor="middle" fill="#8aa39d" font-size="11">users</text></svg>`;
}

const NAV = [
  { key: "overview", label: "Overview", icon: '<path d="M4 13h7V4H4v9Zm9 7h7v-9h-7v9ZM4 20h7v-5H4v5ZM13 9h7V4h-7v5Z"/>' },
  { key: "customers", label: "Customers", icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>' },
  { key: "applications", label: "Applications", icon: '<path d="M4 5h16v14H4z"/><path d="M4 10h4l2 3h4l2-3h4"/>' },
  { key: "newsletter", label: "Newsletter", icon: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>' },
];

function adminSidebar() {
  const item = n => `<button data-section="${n.key}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${state.section === n.key ? "bg-brand/15 text-brand-bright" : "text-muted hover:bg-edge/40 hover:text-slate-100"}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="w-[18px] h-[18px]">${n.icon}</svg>${n.label}</button>`;
  return `<aside class="hidden md:flex w-[228px] shrink-0 flex-col bg-panel/40 border-r border-edge px-3 py-5 sticky top-0 h-screen">
    <div class="flex items-center gap-2.5 px-2 mb-7">${vmark(32)}<div>${vword({ size: "17px" })}
      <div class="text-[9px] font-mono uppercase tracking-wider text-faint mt-1 leading-none">Admin console</div></div></div>
    <nav class="space-y-1">${NAV.map(item).join("")}</nav>
    <div class="mt-auto px-2">
      <div class="text-[11px] text-muted truncate mb-2">${esc(state.user.email)}</div>
      <button id="logout" class="w-full text-xs text-rose-300 hover:text-rose-200 border border-edge rounded-lg px-3 py-2">Log out</button></div>
  </aside>`;
}

function adminTopbar() {
  return `<header class="border-b border-edge bg-panel/60 backdrop-blur sticky top-0 z-20">
    <div class="px-5 sm:px-7 h-14 flex items-center gap-3">
      <span class="md:hidden">${vmark(28)}</span>
      <div class="font-display font-bold capitalize">${state.section}</div>
      <div class="md:hidden ml-1 flex gap-1">${NAV.map(n => `<button data-section="${n.key}" class="text-xs px-2 py-1 rounded-lg ${state.section === n.key ? "bg-brand/15 text-brand-bright" : "text-muted"}">${n.label}</button>`).join("")}</div>
      <div class="ml-auto flex items-center gap-2">
        <button id="refresh" class="text-muted hover:text-white border border-edge rounded-lg px-3 py-1.5 text-xs">↻ Refresh</button>
        <button id="logout2" class="md:hidden text-rose-300 border border-edge rounded-lg px-3 py-1.5 text-xs">Out</button></div>
    </div></header>`;
}

function renderDash() {
  $("#app").innerHTML = `<div class="flex min-h-screen">
    ${adminSidebar()}
    <div class="flex-1 min-w-0 flex flex-col">
      ${adminTopbar()}
      <main class="flex-1 px-5 sm:px-7 py-6 w-full max-w-[1180px]">${state.section === "customers" ? customersSection() : state.section === "applications" ? applicationsSection() : state.section === "newsletter" ? newsletterSection() : overviewSection()}</main>
    </div></div>`;
  wireDash();
}

function overviewSection() {
  const o = state.overview;
  const usd = n => "$" + Math.round(n / o.fx).toLocaleString();
  const margin = o.mrr ? Math.round((1 - (o.ai_spend_30d / o.mrr)) * 100) + "%" : "—";
  const conv = o.total_users ? Math.round(o.paid_users / o.total_users * 100) : 0;
  const arpu = o.paid_users ? naira(Math.round(o.mrr / o.paid_users)) : "—";
  const planSegs = (o.plans || []).map(p => ({ label: p.name, value: p.count, color: planColor(p.plan) }));
  const latest = (arr, key) => (arr && arr.length ? arr[arr.length - 1][key] : 0);
  return `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${statCard("Total users", o.total_users.toLocaleString(), `+${o.new_users_30d} in 30 days`, "text-brand-bright")}
      ${statCard("Paid users", o.paid_users.toLocaleString(), `${conv}% conversion`)}
      ${statCard("Est. MRR", naira(o.mrr), `ARR ${naira(o.arr)} · ARPU ${arpu}`, "text-brand-bright")}
      ${statCard("Gross margin · 30d", margin, "MRR vs AI cost", "text-brand-bright")}
      ${statCard("Active · 7d", (o.active_7d || 0).toLocaleString(), "generated this week")}
      ${statCard("Active · 30d", (o.active_30d || 0).toLocaleString(), `${o.total_users ? Math.round((o.active_30d || 0) / o.total_users * 100) : 0}% of base`)}
      ${statCard("AI spend · all-time", naira(o.ai_spend), `${usd(o.ai_spend)} · ${o.generations.toLocaleString()} gens`, "text-gold")}
      ${statCard("AI spend · 30d", naira(o.ai_spend_30d), `${o.generations_30d.toLocaleString()} gens · ${o.suspended_users || 0} suspended`)}
    </div>
    <div class="grid lg:grid-cols-3 gap-4 mt-4">
      ${card(`<div class="flex items-center justify-between mb-1"><div class="text-[13px] font-semibold text-white">New signups</div><div class="text-[11px] text-muted">14 days</div></div>
        <div class="font-display font-extrabold text-2xl mb-1 text-brand-bright">${latest(o.signups_daily, "n")}</div>${svgLine(o.signups_daily, "n", "#2dd4bf")}`)}
      ${card(`<div class="flex items-center justify-between mb-1"><div class="text-[13px] font-semibold text-white">Generations</div><div class="text-[11px] text-muted">14 days</div></div>
        <div class="font-display font-extrabold text-2xl mb-1 text-brand-bright">${latest(o.gens_daily, "n")}</div>${svgLine(o.gens_daily, "n", "#0e9488")}`)}
      ${card(`<div class="flex items-center justify-between mb-1"><div class="text-[13px] font-semibold text-white">AI spend</div><div class="text-[11px] text-muted">14 days</div></div>
        <div class="font-display font-extrabold text-2xl mb-1 text-gold">${naira(latest(o.gens_daily, "cost"))}</div>${svgLine(o.gens_daily, "cost", "#d8a13a")}`)}
    </div>
    <div class="grid lg:grid-cols-2 gap-4 mt-4">
      ${card(`<div class="text-[13px] font-semibold mb-3 text-white">Subscriptions by plan</div>
        <div class="flex items-center gap-5">${svgDonut(planSegs)}
          <div class="space-y-2 flex-1 min-w-0">${(o.plans || []).map(p => `<div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded-sm shrink-0" style="background:${planColor(p.plan)}"></span><span class="text-slate-200 flex-1 truncate">${esc(p.name)}</span><span class="text-faint tabular-nums whitespace-nowrap">${p.count}${p.price ? " · " + naira(p.price * p.count) : ""}</span></div>`).join("") || '<p class="text-xs text-muted">No data.</p>'}</div></div>`)}
      ${card(`<div class="text-[13px] font-semibold mb-3 text-white">Generations by type</div><div class="space-y-2.5">${bars(o.by_type.map(t => ({ label: t.label, value: t.n, sub: t.n })), "#34d186")}</div>`)}
    </div>
    <div class="mt-4">${card(`<div class="text-[13px] font-semibold mb-3 text-white">AI spend by model</div><div class="space-y-2.5">${bars(o.by_model.map(m => ({ label: m.model, value: Math.round(m.cost), sub: naira(m.cost) })), "#b7791f")}</div>`)}</div>`;
}

function filteredUsers() {
  const q = (state.q || "").toLowerCase().trim();
  if (!q) return state.users;
  return state.users.filter(u => (u.name || "").toLowerCase().includes(q)
    || (u.email || "").toLowerCase().includes(q) || (u.plan_name || "").toLowerCase().includes(q)
    || (u.phone || "").toLowerCase().includes(q));
}

function customersSection() {
  const list = filteredUsers();
  return `
    <div id="detail">${state.detail ? userDetail(state.detail) : ""}</div>
    ${card(`<div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div class="text-[13px] font-semibold text-white">Customers <span id="custCount" class="text-faint">(${list.length}${list.length !== state.users.length ? " of " + state.users.length : ""})</span></div>
        <input id="userSearch" value="${esc(state.q || "")}" placeholder="Search name, email, plan…" class="bg-paper border border-edge rounded-lg px-3 py-1.5 text-xs text-slate-100 w-60 outline-none focus:border-brand/60"/></div>
      <div class="overflow-x-auto scroll-thin"><table class="w-full text-xs">
        <thead><tr class="text-faint text-left border-b border-edge">
          <th class="py-2 pr-3 font-semibold">User</th><th class="py-2 px-2 font-semibold">Phone</th><th class="py-2 px-2 font-semibold">Plan</th>
          <th class="py-2 px-2 font-semibold text-right">Gens</th><th class="py-2 px-2 font-semibold text-right">Tokens</th>
          <th class="py-2 px-2 font-semibold text-right">AI spend</th><th class="py-2 px-2 font-semibold">Joined</th><th></th></tr></thead>
        <tbody id="custBody">${list.map(userRow).join("") || `<tr><td colspan="8" class="py-4 text-muted">No users yet.</td></tr>`}</tbody></table></div>`)}`;
}

function applicationsSection() {
  const list = state.applications || [];
  const newCount = list.filter(a => (a.status || "new") === "new").length;
  return card(`<div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
      <div class="text-[13px] font-semibold text-white">Creator Initiative applications
        <span class="text-faint">(${list.length})</span>${newCount ? ` <span class="text-[10px] bg-brand text-ink px-1.5 py-0.5 rounded-full font-bold ml-1">${newCount} new</span>` : ""}</div></div>
    <div class="overflow-x-auto scroll-thin"><table class="w-full text-xs">
      <thead><tr class="text-faint text-left border-b border-edge">
        <th class="py-2 pr-3 font-semibold">Applicant</th><th class="py-2 px-2 font-semibold">Phone / WhatsApp</th>
        <th class="py-2 px-2 font-semibold">Niche</th><th class="py-2 px-2 font-semibold">About</th>
        <th class="py-2 px-2 font-semibold">Applied</th><th class="py-2 px-2 font-semibold">Status</th></tr></thead>
      <tbody>${list.map(appRow).join("") || `<tr><td colspan="6" class="py-4 text-muted">No applications yet.</td></tr>`}</tbody></table></div>`);
}

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

function newsletterCalendar() {
  const byDate = {};
  (state.nlSchedule || []).forEach(it => byDate[it.send_date] = it);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const week = offset => {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(new Date(today.getTime() + (offset * 7 + i) * 86400000).toISOString().slice(0, 10));
    return out;
  };
  const weekGrid = days => `<div class="grid grid-cols-7 gap-2">${days.map(ds => newsletterDayCard(ds, byDate[ds], ds === todayStr)).join("")}</div>`;
  const plannedCount = (state.nlSchedule || []).filter(it => it.status === "ready" || it.status === "sent").length;
  return card(`<div class="flex items-center justify-between mb-3 flex-wrap gap-1.5">
      <div class="flex items-center gap-2">
        <div class="text-[13px] font-semibold text-white">Calendar</div>
        ${plannedCount ? `<span class="text-[10px] font-bold bg-brand/20 text-brand-bright rounded-full px-2 py-0.5">${plannedCount} planned</span>` : ""}
      </div>
      <div class="text-[11px] text-faint">Auto-sends at 11:00 WAT on days marked <span class="text-emerald-300 font-semibold">Ready</span></div></div>
    <div class="space-y-2">${weekGrid(0)}</div>
    <div class="h-px bg-edge/60 my-3"></div>
    <div class="space-y-2">${weekGrid(1)}</div>`);
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

function appRow(a) {
  const wa = (a.phone || "").replace(/[^\d]/g, "").replace(/^0/, "234");
  const statuses = ["new", "contacted", "accepted", "rejected"];
  return `<tr class="border-b border-edge/60 hover:bg-edge/40 align-top">
    <td class="py-2 pr-3"><div class="font-semibold text-slate-100">${esc(a.name)}</div>
      <div class="text-faint">${esc(a.email || "")}${a.handle ? " · " + esc(a.handle) : ""}</div></td>
    <td class="py-2 px-2 whitespace-nowrap"><a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="text-brand-bright hover:underline">${esc(a.phone)}</a></td>
    <td class="py-2 px-2 text-slate-300 whitespace-nowrap">${esc(a.niche || "—")}</td>
    <td class="py-2 px-2 text-muted"><div class="max-w-[260px] truncate" title="${esc(a.note || "")}">${esc(a.note || "—")}</div></td>
    <td class="py-2 px-2 text-muted whitespace-nowrap">${fmtDate(a.created_at)}</td>
    <td class="py-2 px-2"><select data-appstatus="${a.id}" class="bg-paper border border-edge rounded-lg px-2 py-1 text-xs text-slate-100 outline-none focus:border-brand/60 capitalize">
      ${statuses.map(s => `<option value="${s}" ${(a.status || "new") === s ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`;
}

function wireDash() {
  $$("[data-section]").forEach(b => b.onclick = () => { state.section = b.dataset.section; state.detail = null; renderDash(); });
  $$("[data-appstatus]").forEach(sel => sel.onchange = async () => {
    try {
      await api(`/api/admin/applications/${sel.dataset.appstatus}/status`, { method: "POST", body: JSON.stringify({ status: sel.value }) });
      const a = (state.applications || []).find(x => String(x.id) === sel.dataset.appstatus); if (a) a.status = sel.value;
    } catch (e) { /* ignore */ }
  });
  const lo = $("#logout"); if (lo) lo.onclick = logout;
  const lo2 = $("#logout2"); if (lo2) lo2.onclick = logout;
  const rf = $("#refresh"); if (rf) rf.onclick = async () => { await load(); renderDash(); };
  const se = $("#userSearch");
  if (se) se.oninput = () => {
    state.q = se.value;
    const list = filteredUsers();
    const tb = $("#custBody"); if (tb) tb.innerHTML = list.map(userRow).join("") || `<tr><td colspan="8" class="py-4 text-muted">No matching users.</td></tr>`;
    const cnt = $("#custCount"); if (cnt) cnt.textContent = `(${list.length}${list.length !== state.users.length ? " of " + state.users.length : ""})`;
    wireRows();
  };
  wireRows();
  wireNewsletter();
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

function userRow(u) {
  const tok = (u.it || 0) + (u.ot || 0);
  const planColor = u.plan === "free" ? "bg-edge text-muted" : "bg-brand/20 text-brand";
  return `<tr class="border-b border-edge/60 hover:bg-edge/40 ${u.suspended ? "opacity-60" : ""}">
    <td class="py-2 pr-3"><div class="font-semibold flex items-center gap-1.5 text-slate-100">${esc(u.name || "—")}${u.is_admin ? ' <span class="text-[8.5px] bg-brand text-ink px-1 py-0.5 rounded">ADMIN</span>' : ""}${u.suspended ? ' <span class="text-[8.5px] bg-rose-500/80 text-white px-1 py-0.5 rounded">SUSPENDED</span>' : ""}</div><div class="text-faint">${esc(u.email)}</div></td>
    <td class="py-2 px-2 whitespace-nowrap">${phoneLink(u.phone)}</td>
    <td class="py-2 px-2"><span class="px-2 py-0.5 rounded-full ${planColor}">${esc(u.plan_name)}</span></td>
    <td class="py-2 px-2 text-right tabular-nums text-slate-300">${u.gens}</td>
    <td class="py-2 px-2 text-right tabular-nums text-slate-300">${tok.toLocaleString()}</td>
    <td class="py-2 px-2 text-right tabular-nums text-slate-300">${naira(u.cost)}</td>
    <td class="py-2 px-2 text-muted whitespace-nowrap">${fmtDate(u.created_at)}</td>
    <td class="py-2 pl-2 text-right"><button data-user="${u.id}" class="text-brand font-semibold hover:underline">View</button></td></tr>`;
}

function userDetail(d) {
  const u = d.user;
  const stat = (l, v) => `<div><div class="text-[10px] uppercase tracking-wide text-faint">${l}</div><div class="font-semibold text-sm mt-0.5 text-slate-100">${v}</div></div>`;
  return `<div class="bg-panel border border-brand/40 rounded-xl2 p-5 fade-up">
    <div class="flex items-start justify-between mb-3">
      <div><div class="font-display font-extrabold text-lg">${esc(u.name || "—")} ${u.is_admin ? '<span class="text-[8.5px] bg-brand text-ink px-1 py-0.5 rounded align-middle">ADMIN</span>' : ""}</div>
        <div class="text-xs text-muted">${esc(u.email)}${u.phone ? " · " + phoneLink(u.phone) : ""} · ${esc(u.plan_name)} plan · joined ${fmtDate(u.created_at)}</div></div>
      <button id="closeDetail" class="text-sm text-muted hover:text-white">✕ close</button></div>
    ${u.suspended ? '<div class="mb-3 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">This account is suspended — the user cannot log in.</div>' : ""}
    ${adminControls(u)}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      ${stat("Generations", d.gens)}${stat("AI spend", naira(d.cost))}
      ${stat("Tokens", (d.input_tokens + d.output_tokens).toLocaleString())}${stat("Brands", d.brands)}
      ${stat("Calendars", d.calendars)}${stat("Saved copy", d.favorites)}
      ${stat("Feedback", "👍 " + d.feedback_up + " · 👎 " + d.feedback_down)}${stat("Gigs", d.gigs + " (" + naira(d.gigs_value) + ")")}
    </div>
    ${(d.daily && d.daily.length) ? `<div class="mb-4"><div class="text-[12px] font-semibold mb-2 text-white">Activity · 14d</div>${spark(d.daily, "n", "#0b8457")}</div>` : ""}
    ${d.by_type.length ? `<div class="text-[12px] font-semibold mb-2 text-white">What they generate</div><div class="space-y-2 mb-4">${bars(d.by_type.map(t => ({ label: t.label, value: t.n, sub: t.n })), "#0b8457")}</div>` : ""}
    <div class="text-[12px] font-semibold mb-2 text-white">Recent activity</div>
    <div class="space-y-1.5">${(d.recent || []).map(g => `<div class="flex items-center gap-2 text-xs bg-paper border border-edge rounded-lg px-3 py-2">
      <span class="font-medium whitespace-nowrap text-slate-200">${esc(g.label)}</span>
      <span class="text-muted truncate flex-1">${esc(g.brief || "")}</span>
      <span class="text-faint tabular-nums whitespace-nowrap">${((g.input_tokens || 0) + (g.output_tokens || 0)).toLocaleString()} tok</span>
      <span class="text-faint tabular-nums whitespace-nowrap">${naira(g.cost)}</span></div>`).join("") || '<p class="text-xs text-muted">No activity yet.</p>'}</div>
  </div>`;
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
    if (opts.toast) { /* lightweight confirmation */ }
  } catch (e) { alert(e.message); }
}

function wireRows() {
  $$("[data-user]").forEach(b => b.onclick = async () => {
    try { state.detail = await api(`/api/admin/users/${b.dataset.user}`); renderDash(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { alert(e.message); }
  });
  const c = $("#closeDetail"); if (c) c.onclick = () => { state.detail = null; renderDash(); };

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
      } catch (e) { alert(e.message); }
    };
  }
}

boot();
