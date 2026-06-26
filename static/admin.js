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

const state = { user: null, overview: null, users: null, detail: null };

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
  const [ov, us] = await Promise.all([api("/api/admin/overview"), api("/api/admin/users")]);
  state.overview = ov; state.users = us;
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

function renderDash() {
  const o = state.overview;
  const usd = n => "$" + Math.round(n / o.fx).toLocaleString();
  const margin = o.mrr ? Math.round((1 - (o.ai_spend_30d / o.mrr)) * 100) + "%" : "—";
  const conv = o.total_users ? Math.round(o.paid_users / o.total_users * 100) : 0;
  const arpu = o.paid_users ? naira(Math.round(o.mrr / o.paid_users)) : "—";
  const stat = (label, val, sub, accent = "text-white") => `<div class="bg-panel border border-edge rounded-xl2 p-4">
    <div class="text-[10.5px] font-semibold uppercase tracking-wide text-faint">${label}</div>
    <div class="font-display font-extrabold text-2xl mt-1 ${accent}">${val}</div>
    ${sub ? `<div class="text-[11px] text-muted mt-0.5">${sub}</div>` : ""}</div>`;

  $("#app").innerHTML = `
  <header class="border-b border-edge bg-panel/60 backdrop-blur sticky top-0 z-20">
    <div class="max-w-[1200px] mx-auto px-5 h-16 flex items-center gap-3">
      ${vmark(34)}
      <div><div class="font-display font-extrabold leading-none flex items-center gap-1.5">${vword({ size: "17px" })} <span class="text-muted font-normal text-sm">Admin</span></div>
        <div class="text-[11px] text-muted leading-none mt-1">Platform console</div></div>
      <div class="ml-auto flex items-center gap-3 text-sm">
        <button id="refresh" class="text-muted hover:text-white border border-edge rounded-lg px-3 py-1.5 text-xs">↻ Refresh</button>
        <span class="text-muted hidden sm:inline">${esc(state.user.email)}</span>
        <button id="logout" class="text-rose-300 hover:text-rose-200 border border-edge rounded-lg px-3 py-1.5 text-xs">Log out</button>
      </div>
    </div>
  </header>
  <main class="max-w-[1200px] mx-auto px-5 py-6 space-y-5">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${stat("Total users", o.total_users.toLocaleString(), `+${o.new_users_30d} in 30 days`, "text-brand")}
      ${stat("Paid users", o.paid_users.toLocaleString(), `${conv}% conversion`)}
      ${stat("Est. MRR", naira(o.mrr), `ARR ${naira(o.arr)} · ARPU ${arpu}`, "text-brand")}
      ${stat("Gross margin · 30d", margin, "MRR vs AI cost", "text-brand")}
      ${stat("Active · 7d", (o.active_7d ?? 0).toLocaleString(), "generated this week")}
      ${stat("Active · 30d", (o.active_30d ?? 0).toLocaleString(), `${o.total_users ? Math.round((o.active_30d || 0) / o.total_users * 100) : 0}% of users`)}
      ${stat("AI spend · all-time", naira(o.ai_spend), `${usd(o.ai_spend)} · ${o.generations.toLocaleString()} gens`, "text-gold")}
      ${stat("AI spend · 30d", naira(o.ai_spend_30d), `${o.generations_30d.toLocaleString()} gens · ${(o.suspended_users || 0)} suspended`)}
    </div>
    <div class="grid lg:grid-cols-2 gap-4">
      ${card(`<div class="text-[13px] font-semibold mb-3 text-white">Subscriptions by plan</div><div class="space-y-2.5">${bars(o.plans.map(p => ({ label: p.name, value: p.count, sub: p.count + (p.price ? " · " + naira(p.price * p.count) : "") })), "#0b8457")}</div>`)}
      ${card(`<div class="text-[13px] font-semibold mb-3 text-white">Generations by type</div><div class="space-y-2.5">${bars(o.by_type.map(t => ({ label: t.label, value: t.n, sub: t.n })), "#34d186")}</div>`)}
    </div>
    <div class="grid lg:grid-cols-2 gap-4">
      ${card(`<div class="text-[13px] font-semibold mb-3 text-white">AI spend by model</div><div class="space-y-2.5">${bars(o.by_model.map(m => ({ label: m.model, value: Math.round(m.cost), sub: naira(m.cost) })), "#b7791f")}</div>`)}
      ${card(`<div class="grid grid-cols-2 gap-5"><div><div class="text-[13px] font-semibold mb-2 text-white">Signups · 14d</div>${spark(o.signups_daily, "n", "#0b8457")}</div><div><div class="text-[13px] font-semibold mb-2 text-white">Generations · 14d</div>${spark(o.gens_daily, "n", "#34d186")}</div></div>`)}
    </div>
    <div id="detail">${state.detail ? userDetail(state.detail) : ""}</div>
    ${card(`<div class="text-[13px] font-semibold mb-3 text-white">All users (${state.users.length})</div>
      <div class="overflow-x-auto scroll-thin"><table class="w-full text-xs">
        <thead><tr class="text-faint text-left border-b border-edge">
          <th class="py-2 pr-3 font-semibold">User</th><th class="py-2 px-2 font-semibold">Plan</th>
          <th class="py-2 px-2 font-semibold text-right">Gens</th><th class="py-2 px-2 font-semibold text-right">Tokens</th>
          <th class="py-2 px-2 font-semibold text-right">AI spend</th><th class="py-2 px-2 font-semibold">Joined</th><th></th></tr></thead>
        <tbody>${state.users.map(userRow).join("") || `<tr><td colspan="7" class="py-4 text-muted">No users yet.</td></tr>`}</tbody></table></div>`)}
  </main>`;

  $("#logout").onclick = logout;
  $("#refresh").onclick = async () => { await load(); state.detail = null; renderDash(); };
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
