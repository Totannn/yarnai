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

const state = { user: null, overview: null, users: null, applications: null, detail: null, section: "overview", q: "" };

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

async function load() {
  const [ov, us, apps] = await Promise.all([api("/api/admin/overview"), api("/api/admin/users"), api("/api/admin/applications")]);
  state.overview = ov; state.users = us; state.applications = apps;
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
      <main class="flex-1 px-5 sm:px-7 py-6 w-full max-w-[1180px]">${state.section === "customers" ? customersSection() : state.section === "applications" ? applicationsSection() : overviewSection()}</main>
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
    || (u.email || "").toLowerCase().includes(q) || (u.plan_name || "").toLowerCase().includes(q));
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
          <th class="py-2 pr-3 font-semibold">User</th><th class="py-2 px-2 font-semibold">Plan</th>
          <th class="py-2 px-2 font-semibold text-right">Gens</th><th class="py-2 px-2 font-semibold text-right">Tokens</th>
          <th class="py-2 px-2 font-semibold text-right">AI spend</th><th class="py-2 px-2 font-semibold">Joined</th><th></th></tr></thead>
        <tbody id="custBody">${list.map(userRow).join("") || `<tr><td colspan="7" class="py-4 text-muted">No users yet.</td></tr>`}</tbody></table></div>`)}`;
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
    const tb = $("#custBody"); if (tb) tb.innerHTML = list.map(userRow).join("") || `<tr><td colspan="7" class="py-4 text-muted">No matching users.</td></tr>`;
    const cnt = $("#custCount"); if (cnt) cnt.textContent = `(${list.length}${list.length !== state.users.length ? " of " + state.users.length : ""})`;
    wireRows();
  };
  wireRows();
}

function userRow(u) {
  const tok = (u.it || 0) + (u.ot || 0);
  const planColor = u.plan === "free" ? "bg-edge text-muted" : "bg-brand/20 text-brand";
  return `<tr class="border-b border-edge/60 hover:bg-edge/40 ${u.suspended ? "opacity-60" : ""}">
    <td class="py-2 pr-3"><div class="font-semibold flex items-center gap-1.5 text-slate-100">${esc(u.name || "—")}${u.is_admin ? ' <span class="text-[8.5px] bg-brand text-ink px-1 py-0.5 rounded">ADMIN</span>' : ""}${u.suspended ? ' <span class="text-[8.5px] bg-rose-500/80 text-white px-1 py-0.5 rounded">SUSPENDED</span>' : ""}</div><div class="text-faint">${esc(u.email)}</div></td>
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
        <div class="text-xs text-muted">${esc(u.email)} · ${esc(u.plan_name)} plan · joined ${fmtDate(u.created_at)}</div></div>
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
  }
}

boot();
