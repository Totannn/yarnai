/* Vertil Admin — Creator Initiative applications: review pipeline */

const APP_STATUSES = ["new", "contacted", "accepted", "rejected"];
const APP_META = {
  new: { label: "New", cls: "chip-new", dot: "#d8a13a" },
  contacted: { label: "Contacted", cls: "chip-flat", dot: "#38bdf8" },
  accepted: { label: "Accepted", cls: "chip-up", dot: "#2dd4bf" },
  rejected: { label: "Rejected", cls: "chip-down", dot: "#fb7185" },
};
const FIT_META = { strong: ["Strong fit", "chip-up"], possible: ["Possible fit", "chip-new"], unclear: ["Needs more info", "chip-flat"] };
const appStatus = a => a.status || "new";
const firstName = n => (n || "").trim().split(/\s+/)[0] || "there";

const APP_TEMPLATES = {
  invite: { label: "Welcome in", text: a => `Hi ${firstName(a.name)}! Thanks for applying to the Vertil Creator Initiative. We loved what you shared${a.niche ? ` about your ${a.niche.toLowerCase()} content` : ""} and we'd like to welcome you in. Next step: create your free Vertil account at vertil.ng, then reply here with your handle so we can add you to the community. — Vertil team` },
  info: { label: "Ask for more info", text: a => `Hi ${firstName(a.name)}! Thanks for applying to the Vertil Creator Initiative. Before we add you, could you tell us a little more: your main platform and handle, roughly how often you post, and what you'd love to create with Vertil? — Vertil team` },
  decline: { label: "Polite decline", text: a => `Hi ${firstName(a.name)}, thank you for applying to the Vertil Creator Initiative. We can't add you to this round, but you're welcome to keep creating with Vertil at vertil.ng and apply again later. We'd love to see what you make. — Vertil team` },
};

// Turns whatever applicants typed as their handle into clickable profile links.
function socialLinks(handle) {
  const h = (handle || "").trim();
  if (!h) return [];
  if (/^https?:\/\//i.test(h)) {
    const host = (() => { try { return new URL(h).hostname.replace(/^www\./, ""); } catch { return "profile"; } })();
    return [{ label: host.split(".")[0].replace(/^./, c => c.toUpperCase()), href: h }];
  }
  if (/\s/.test(h) && !h.startsWith("@")) return [];
  const u = h.replace(/^@/, "");
  return [{ label: "Instagram", href: `https://instagram.com/${encodeURIComponent(u)}` }, { label: "TikTok", href: `https://www.tiktok.com/@${encodeURIComponent(u)}` }];
}

function filteredApps() {
  const q = state.appQ.toLowerCase().trim();
  const list = (state.applications || []).filter(a => (state.appFilter === "all" || appStatus(a) === state.appFilter)
    && (state.appNiche === "all" || (a.niche || "—") === state.appNiche)
    && (!q || [a.name, a.email, a.handle, a.niche, a.note, a.phone, a.admin_notes].some(x => (x || "").toLowerCase().includes(q))));
  const key = state.appSort;
  const score = a => (a.ai_review && a.ai_review.score) || -1;
  return [...list].sort((x, y) => key === "name" ? (x.name || "").localeCompare(y.name || "") : key === "score" ? score(y) - score(x)
    : key === "oldest" ? x.created_at - y.created_at : y.created_at - x.created_at);
}

function appsStats() {
  const all = state.applications || [];
  const now = Date.now() / 1000;
  const waiting = all.filter(a => appStatus(a) === "new");
  const oldest = waiting.length ? Math.round((now - Math.min(...waiting.map(a => a.created_at))) / 86400) : 0;
  const responded = all.filter(a => appStatus(a) !== "new").length;
  const weeks = [...Array(12)].map((_, i) => {
    const end = now - (11 - i) * 7 * 86400, start = end - 7 * 86400;
    return { label: ymd(new Date(start * 1000)), n: all.filter(a => a.created_at >= start && a.created_at < end).length };
  });
  const niches = {};
  all.forEach(a => { const k = a.niche || "—"; niches[k] = (niches[k] || 0) + 1; });
  return { all, waiting, oldest, responded, weeks, niches };
}

function applicationsSection() {
  const st = appsStats();
  const list = filteredApps();
  const sel = state.appSel;
  const count = s => st.all.filter(a => appStatus(a) === s).length;
  const tile = (label, value, sub, color = "text-white") => `<div class="glass kpi rounded-2xl p-4 relative overflow-hidden">
    <div class="text-[10.5px] font-semibold uppercase tracking-wider text-faint">${label}</div>
    <div class="font-display font-extrabold text-[26px] mt-1 ${color} tabular-nums glow-text">${value}</div><div class="text-[11px] text-muted">${sub}</div></div>`;
  const stats = `<div class="grid lg:grid-cols-4 gap-3 mb-4">
    <div class="grid grid-cols-2 gap-3 lg:col-span-2">
      ${tile("Applications", st.all.length, `${st.weeks[11].n} this week`)}
      ${tile("Waiting for reply", st.waiting.length, st.waiting.length ? `oldest ${st.oldest} day${st.oldest === 1 ? "" : "s"} old` : "inbox zero", st.waiting.length ? "text-gold" : "text-white")}
      ${tile("Response rate", st.all.length ? Math.round(st.responded / st.all.length * 100) + "%" : "—", `${st.responded} contacted or decided`)}
      ${tile("Accepted", count("accepted"), `${count("rejected")} declined`)}
    </div>
    ${chartCard("Applications per week", "Last 12 weeks", chartBox("ch_appweeks", lineOpt(st.weeks.map(w => w.label), [{ name: "Applications", data: st.weeks.map(w => w.n) }], { type: "bar" }), 170), { id: "ch_appweeks" })}
    ${chartCard("Niches", "Click a slice to filter", chartBox("ch_appniche", donutOpt(Object.entries(st.niches).map(([k, v]) => ({ name: k, value: v })), "", st.all.length), 170), { id: "ch_appniche" })}
  </div>`;
  const niches = Object.keys(st.niches).sort();
  const toolbar = `<div class="flex items-center gap-2 flex-wrap mb-3">
      ${["all", ...APP_STATUSES].map(s => `<button data-appf="${s}" class="seg ${state.appFilter === s ? "on" : ""}">${s === "all" ? "All" : APP_META[s].label} <span class="opacity-60">${s === "all" ? st.all.length : count(s)}</span></button>`).join("")}
      <select id="appNiche" class="input"><option value="all">All niches</option>${niches.map(n => `<option ${state.appNiche === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <select id="appSort" class="input">${[["newest", "Newest first"], ["oldest", "Oldest first"], ["score", "AI score"], ["name", "Name"]].map(([k, l]) => `<option value="${k}" ${state.appSort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input id="appSearch" value="${esc(state.appQ)}" placeholder="Search applicants, notes…" class="input w-56 ml-auto"/>
      <div class="seg-group"><button data-aview="table" class="seg ${state.appView === "table" ? "on" : ""}">Table</button><button data-aview="board" class="seg ${state.appView === "board" ? "on" : ""}">Board</button></div>
      <button id="appExport" class="seg">⤓ CSV</button>
      <button id="appMail" class="btn-glow !py-1.5">✉ Email applicants</button>
    </div>
    ${sel.size ? `<div class="glass rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2 flex-wrap fade-in"><span class="text-[12.5px] text-brand-bright font-semibold">${sel.size} selected</span>
      <span class="text-[12px] text-muted ml-2">Move to</span>${APP_STATUSES.map(s => `<button data-bulkapp="${s}" class="seg">${APP_META[s].label}</button>`).join("")}
      <button id="appMailSel" class="seg">✉ Email selected</button><button id="appSelClear" class="seg ml-auto">Clear</button></div>` : ""}`;
  return stats + toolbar + (state.appView === "board" ? appsBoard(list) : appsTable(list));
}

function appsTable(list) {
  const sel = state.appSel;
  const rows = list.map(a => {
    const s = appStatus(a), r = a.ai_review;
    return `<tr data-app-open="${a.id}" class="border-b border-edge/60 hover:bg-edge/30 cursor-pointer ${sel.has(a.id) ? "bg-brand/10" : ""}">
      <td class="py-3 pr-2" data-stop><input type="checkbox" data-appsel="${a.id}" class="accent-teal-400" ${sel.has(a.id) ? "checked" : ""}/></td>
      <td class="py-3 pr-3"><div class="flex items-center gap-2.5"><span class="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold text-ink shrink-0" style="background:linear-gradient(135deg,#2dd4bf,#0e9488)">${esc(firstName(a.name)[0].toUpperCase())}</span>
        <div class="min-w-0"><div class="font-semibold text-slate-100">${esc(a.name)}</div><div class="text-faint truncate max-w-[260px]">${esc(a.email || "")}${a.handle ? " · " + esc(a.handle) : ""}${a.last_emailed_at ? ` · <span class="text-brand-bright">✉ ${ago(a.last_emailed_at)}</span>` : ""}${a.email_opt_out ? ' · <span class="text-rose-300">unsubscribed</span>' : ""}</div></div></div></td>
      <td class="py-3 px-2 text-slate-300 whitespace-nowrap">${esc(a.niche || "—")}</td>
      <td class="py-3 px-2 text-muted max-w-[340px]"><div class="line-clamp-2">${esc(a.note || "—")}</div>${a.admin_notes ? `<div class="text-[10.5px] text-gold mt-1 truncate">✎ ${esc(a.admin_notes)}</div>` : ""}</td>
      <td class="py-3 px-2 whitespace-nowrap">${r ? `<span class="chip ${FIT_META[r.fit][1]}">${r.score}</span>` : '<span class="text-faint">—</span>'}</td>
      <td class="py-3 px-2 text-muted whitespace-nowrap">${ago(a.created_at)}</td>
      <td class="py-3 px-2"><span class="chip ${APP_META[s].cls}">${APP_META[s].label}</span></td>
      <td class="py-3 pl-2 text-right text-brand-bright font-semibold whitespace-nowrap">Open →</td></tr>`;
  }).join("");
  return `<div class="glass rounded-2xl p-4"><div class="overflow-x-auto scroll-thin"><table class="w-full text-xs">
    <thead><tr class="text-faint text-left border-b border-edge">
      <th class="py-2 pr-2 w-6"><input type="checkbox" id="appSelAll" class="accent-teal-400" ${list.length && list.every(a => state.appSel.has(a.id)) ? "checked" : ""}/></th>
      <th class="py-2 pr-3 font-semibold">Applicant</th><th class="py-2 px-2 font-semibold">Niche</th><th class="py-2 px-2 font-semibold">About</th>
      <th class="py-2 px-2 font-semibold">AI</th><th class="py-2 px-2 font-semibold">Applied</th><th class="py-2 px-2 font-semibold">Status</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8" class="py-8 text-center text-muted">No applications match.</td></tr>`}</tbody></table></div>
    <div class="text-[11px] text-faint mt-3">Click any applicant to read everything they wrote, reply and decide.</div></div>`;
}

function appsBoard(list) {
  return `<div class="grid md:grid-cols-4 gap-3">${APP_STATUSES.map(s => {
    const col = list.filter(a => appStatus(a) === s);
    return `<div data-drop="${s}" class="glass rounded-2xl p-3 min-h-[280px] transition">
      <div class="flex items-center justify-between mb-3"><span class="flex items-center gap-2 text-[12.5px] font-semibold text-white"><span class="w-2 h-2 rounded-full" style="background:${APP_META[s].dot};box-shadow:0 0 8px ${APP_META[s].dot}"></span>${APP_META[s].label}</span><span class="chip chip-flat">${col.length}</span></div>
      <div class="space-y-2">${col.map(a => `<div draggable="true" data-drag="${a.id}" data-app-open="${a.id}" class="app-card rounded-xl bg-paper/70 border border-edge p-3 cursor-grab hover:border-brand/50">
        <div class="flex items-center gap-2"><span class="text-[12.5px] font-semibold text-slate-100 flex-1 truncate">${esc(a.name)}</span>${a.ai_review ? `<span class="chip ${FIT_META[a.ai_review.fit][1]}">${a.ai_review.score}</span>` : ""}</div>
        <div class="text-[11px] text-faint">${esc(a.niche || "—")} · ${ago(a.created_at)}</div>
        ${a.note ? `<div class="text-[11px] text-muted mt-1.5 line-clamp-3">${esc(a.note)}</div>` : ""}
      </div>`).join("") || '<div class="text-[11px] text-faint py-8 text-center border border-dashed border-edge rounded-xl">Drop here</div>'}</div></div>`;
  }).join("")}</div>
  <div class="text-[11px] text-faint mt-3">Drag a card to another column to change its status. Click to open.</div>`;
}

/* ------------------------------ drawer ------------------------------ */

function applicantDrawer() {
  const list = filteredApps();
  const a = (state.applications || []).find(x => x.id === state.appDetail);
  if (!a) return "";
  const idx = list.findIndex(x => x.id === a.id);
  const s = appStatus(a), r = a.ai_review;
  const tplKey = state.appTpl || (r ? "ai" : s === "new" ? "invite" : "info");
  const tplText = state.appTplText ?? (tplKey === "ai" ? (r && r.reply) || "" : APP_TEMPLATES[tplKey].text(a));
  const links = socialLinks(a.handle);
  const steps = APP_STATUSES.map(k => `<button data-appstep="${k}" class="flex-1 text-[12px] font-semibold rounded-xl px-2 py-2 border transition ${s === k ? "text-ink border-transparent" : "text-muted border-edge hover:text-white hover:border-brand/40"}"
      style="${s === k ? `background:${APP_META[k].dot};box-shadow:0 0 16px ${APP_META[k].dot}66` : ""}">${APP_META[k].label}</button>`).join("");
  const reviewBlock = state.appReviewing ? `<div class="glass rounded-2xl p-4 text-sm text-muted flex items-center gap-2"><span class="spin inline-block w-3.5 h-3.5 border-2 border-brand/40 border-t-brand-bright rounded-full"></span> Reviewing ${esc(firstName(a.name))}'s application…</div>`
    : r ? `<div class="glass rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-2"><span class="text-[13px] font-semibold text-white">AI screening</span><span class="chip ${FIT_META[r.fit][1]}">${FIT_META[r.fit][0]}</span>
          <span class="ml-auto text-[11px] text-faint">${ago(r.reviewed_at)}</span><button data-appreview class="ctool">Re-run</button></div>
        <div class="h-1.5 rounded-full bg-edge overflow-hidden mb-3"><div class="h-full rounded-full" style="width:${r.score}%;background:linear-gradient(90deg,#0e9488,#2dd4bf);box-shadow:0 0 10px #2dd4bf"></div></div>
        <p class="text-[13px] text-slate-200">${esc(r.summary)}</p>
        <div class="grid sm:grid-cols-2 gap-3 mt-3 text-[12px]">
          <div><div class="text-faint uppercase tracking-wide text-[10px] mb-1">Strengths</div>${(r.strengths || []).map(x => `<div class="text-emerald-300">+ ${esc(x)}</div>`).join("") || '<div class="text-faint">—</div>'}</div>
          <div><div class="text-faint uppercase tracking-wide text-[10px] mb-1">Watch out</div>${(r.concerns || []).map(x => `<div class="text-rose-300">– ${esc(x)}</div>`).join("") || '<div class="text-faint">—</div>'}</div></div>
        ${(r.questions || []).length ? `<div class="mt-3 text-[12px]"><div class="text-faint uppercase tracking-wide text-[10px] mb-1">Ask them</div>${r.questions.map(q => `<div class="text-slate-300">? ${esc(q)}</div>`).join("")}</div>` : ""}
        <div class="text-[10.5px] text-faint mt-3">Advisory only, based just on what they wrote. You make the call.</div></div>`
    : `<button data-appreview class="w-full glass rounded-2xl p-4 text-left hover:border-brand/50 group">
        <div class="flex items-center gap-3"><span class="agent-orb !w-9 !h-9">${agentIcon("quality", "w-4 h-4")}</span>
          <div><div class="text-[13px] font-semibold text-white group-hover:text-brand-bright">Screen with AI</div>
          <div class="text-[11.5px] text-muted">Get a fit score, strengths, questions to ask and a ready reply.</div></div></div></button>`;
  return `<div id="appDrawerBg" class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] fade-in"></div>
  <aside class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[660px] overflow-y-auto scroll-thin drawer p-5 slide-in">
    <div class="flex items-center gap-2 mb-4">
      <button data-appnav="-1" class="seg" ${idx <= 0 ? "disabled" : ""} title="Previous (←)">←</button>
      <button data-appnav="1" class="seg" ${idx < 0 || idx >= list.length - 1 ? "disabled" : ""} title="Next (→)">→</button>
      <span class="text-[11px] text-faint">${idx + 1} of ${list.length}</span>
      <button id="appClose" class="seg ml-auto" title="Close (Esc)">✕</button></div>
    <div class="flex items-center gap-3">
      <span class="w-12 h-12 rounded-full grid place-items-center font-bold text-ink text-lg shrink-0" style="background:linear-gradient(135deg,#2dd4bf,#0e9488);box-shadow:0 0 20px rgba(45,212,191,.45)">${esc(firstName(a.name)[0].toUpperCase())}</span>
      <div class="min-w-0"><div class="font-display font-extrabold text-xl text-white">${esc(a.name)}</div>
        <div class="text-[12px] text-muted">${esc(a.niche || "No niche given")} · applied ${fmtDate(a.created_at)} (${ago(a.created_at)})</div></div></div>
    <div class="flex gap-2 mt-4">${steps}</div>
    <div class="text-[10.5px] text-faint mt-1.5">Keys: C contacted · A accept · R reject · ←/→ next applicant</div>

    <div class="glass rounded-2xl p-4 mt-4">
      <div class="text-[10px] uppercase tracking-wide text-faint mb-2">What they told us</div>
      <p class="text-[14px] leading-relaxed text-slate-100 whitespace-pre-wrap">${esc(a.note || "They didn't write anything.")}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        ${a.phone ? `<a href="${waHref(a.phone)}" target="_blank" rel="noopener" class="seg">WhatsApp ${esc(a.phone)}</a><button data-copy="${esc(a.phone)}" class="seg">Copy number</button>` : ""}
        ${a.email ? `<a href="mailto:${esc(a.email)}" class="seg">Email ${esc(a.email)}</a>` : ""}
        ${links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener" class="seg">${esc(l.label)} ↗</a>`).join("")}
        ${a.handle && !links.length ? `<span class="seg !cursor-default">${esc(a.handle)}</span>` : ""}
      </div></div>

    <div class="mt-4">${reviewBlock}</div>

    <div class="glass rounded-2xl p-4 mt-4">
      <div class="flex items-center gap-2 flex-wrap mb-2"><span class="text-[13px] font-semibold text-white">Reply</span>
        ${r && r.reply ? `<button data-apptpl="ai" class="seg ${tplKey === "ai" ? "on" : ""}">AI suggestion</button>` : ""}
        ${Object.entries(APP_TEMPLATES).map(([k, t]) => `<button data-apptpl="${k}" class="seg ${tplKey === k ? "on" : ""}">${t.label}</button>`).join("")}</div>
      <textarea id="appReply" rows="5" class="input w-full !text-[13px] leading-relaxed">${esc(tplText)}</textarea>
      <div class="flex gap-2 mt-2 flex-wrap">
        ${a.phone ? `<button data-appsend="wa" class="btn-glow">Send on WhatsApp</button>` : ""}
        ${a.email ? `<button data-appsend="email" class="btn-ghost">Send by email</button>` : ""}
        <button data-copy-reply class="btn-ghost">Copy</button>
        ${s === "new" ? `<span class="text-[11px] text-faint self-center">Sending marks them as Contacted.</span>` : ""}</div></div>

    <div class="glass rounded-2xl p-4 mt-4 mb-6">
      <div class="flex items-center justify-between mb-2"><span class="text-[13px] font-semibold text-white">Private notes</span><span id="appNoteState" class="text-[11px] text-faint">Saves when you click away</span></div>
      <textarea id="appNotes" rows="3" class="input w-full" placeholder="e.g. Great Pidgin skits, ask about TikTok numbers…">${esc(a.admin_notes || "")}</textarea></div>
  </aside>`;
}

/* ------------------------------ wiring ------------------------------ */

async function setAppStatus(ids, status) {
  if (ids.length === 1) await api(`/api/admin/applications/${ids[0]}/status`, { method: "POST", body: JSON.stringify({ status }) });
  else await api("/api/admin/applications/bulk-status", { method: "POST", body: JSON.stringify({ ids, status }) });
  (state.applications || []).forEach(a => { if (ids.includes(a.id)) a.status = status; });
}

function openApplicant(id) { state.appDetail = +id; state.appTpl = null; state.appTplText = null; renderDash(); }

function wireApplications() {
  if (state.section !== "applications") return;
  $$("[data-appf]").forEach(b => b.onclick = () => { state.appFilter = b.dataset.appf; renderDash(); });
  $$("[data-aview]").forEach(b => b.onclick = () => { state.appView = b.dataset.aview; store.set("appView", state.appView); renderDash(); });
  const ns = $("#appNiche"); if (ns) ns.onchange = () => { state.appNiche = ns.value; renderDash(); };
  const so = $("#appSort"); if (so) so.onchange = () => { state.appSort = so.value; store.set("appSort", so.value); renderDash(); };
  const s = $("#appSearch"); if (s) s.oninput = () => {
    state.appQ = s.value; renderDash();
    const s2 = $("#appSearch"); s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length);
  };
  const nicheChart = chartById("ch_appniche");
  if (nicheChart) nicheChart.on("click", p => { state.appNiche = p.name; renderDash(); });
  const ex = $("#appExport"); if (ex) ex.onclick = () => downloadCSV("vertil-applications", filteredApps().map(a => ({
    name: a.name, email: a.email, phone: a.phone, handle: a.handle, niche: a.niche, status: appStatus(a), about: a.note,
    ai_fit: a.ai_review ? a.ai_review.fit : "", ai_score: a.ai_review ? a.ai_review.score : "", notes: a.admin_notes || "",
    applied: new Date(a.created_at * 1000).toISOString() })));

  // selection + bulk
  $$("[data-stop]").forEach(td => td.onclick = e => e.stopPropagation());
  $$("[data-appsel]").forEach(c => c.onchange = () => { const id = +c.dataset.appsel; c.checked ? state.appSel.add(id) : state.appSel.delete(id); renderDash(); });
  const sa = $("#appSelAll"); if (sa) sa.onchange = () => { state.appSel = sa.checked ? new Set(filteredApps().map(a => a.id)) : new Set(); renderDash(); };
  const sc = $("#appSelClear"); if (sc) sc.onclick = () => { state.appSel = new Set(); renderDash(); };
  $$("[data-bulkapp]").forEach(b => b.onclick = async () => {
    const ids = [...state.appSel], st = b.dataset.bulkapp;
    if (!confirm(`Move ${ids.length} applicant${ids.length > 1 ? "s" : ""} to ${APP_META[st].label}?`)) return;
    try { await setAppStatus(ids, st); state.appSel = new Set(); toast(`Moved ${ids.length} to ${APP_META[st].label}.`); renderDash(); }
    catch (ex) { toast(ex.message, "error"); }
  });

  const am = $("#appMail"); if (am) am.onclick = openMailer;
  const ams = $("#appMailSel"); if (ams) ams.onclick = openMailer;
  wireMailer();

  // open
  $$("[data-app-open]").forEach(el => el.addEventListener("click", () => openApplicant(el.dataset.appOpen)));

  // board drag & drop
  $$("[data-drag]").forEach(card => {
    card.ondragstart = e => { e.dataTransfer.setData("text/plain", card.dataset.drag); card.classList.add("opacity-50"); };
    card.ondragend = () => card.classList.remove("opacity-50");
  });
  $$("[data-drop]").forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add("drop-hot"); };
    col.ondragleave = () => col.classList.remove("drop-hot");
    col.ondrop = async e => {
      e.preventDefault(); col.classList.remove("drop-hot");
      const id = +e.dataTransfer.getData("text/plain"), st = col.dataset.drop;
      const a = state.applications.find(x => x.id === id);
      if (!a || appStatus(a) === st) return;
      try { await setAppStatus([id], st); toast(`${firstName(a.name)} → ${APP_META[st].label}`); renderDash(); }
      catch (ex) { toast(ex.message, "error"); }
    };
  });
  wireApplicantDrawer();
}

function wireApplicantDrawer() {
  const a = state.appDetail && (state.applications || []).find(x => x.id === state.appDetail);
  if (!a) return;
  const close = () => { saveNotes(); state.appDetail = null; renderDash(); };
  $("#appClose").onclick = close;
  $("#appDrawerBg").onclick = close;
  $$("[data-appnav]").forEach(b => b.onclick = () => navApplicant(+b.dataset.appnav));
  $$("[data-appstep]").forEach(b => b.onclick = async () => {
    try { await setAppStatus([a.id], b.dataset.appstep); toast(`${firstName(a.name)} → ${APP_META[b.dataset.appstep].label}`); renderDash(); }
    catch (ex) { toast(ex.message, "error"); }
  });
  $$("[data-apptpl]").forEach(b => b.onclick = () => { state.appTpl = b.dataset.apptpl; state.appTplText = null; renderDash(); });
  const reply = $("#appReply"); reply.oninput = () => { state.appTplText = reply.value; };
  $$("[data-copy]").forEach(b => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Copied.")); });
  const cr = $("[data-copy-reply]"); if (cr) cr.onclick = () => navigator.clipboard.writeText(reply.value).then(() => toast("Reply copied."));
  $$("[data-appsend]").forEach(b => b.onclick = async () => {
    const text = reply.value.trim();
    if (!text) return toast("Write a reply first.", "error");
    const url = b.dataset.appsend === "wa"
      ? `${waHref(a.phone)}?text=${encodeURIComponent(text)}`
      : `mailto:${a.email}?subject=${encodeURIComponent("Your Vertil Creator Initiative application")}&body=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
    if (appStatus(a) === "new") {
      try { await setAppStatus([a.id], "contacted"); toast(`Opened ${b.dataset.appsend === "wa" ? "WhatsApp" : "email"} · ${firstName(a.name)} marked Contacted`); renderDash(); } catch {}
    }
  });
  $$("[data-appreview]").forEach(b => b.onclick = async () => {
    state.appReviewing = true; renderDash();
    try { a.ai_review = await api(`/api/admin/applications/${a.id}/review`, { method: "POST" }); state.appTpl = "ai"; state.appTplText = null; }
    catch (ex) { toast(ex.message, "error"); }
    state.appReviewing = false; renderDash();
  });
  const notes = $("#appNotes");
  notes.oninput = () => { $("#appNoteState").textContent = "Unsaved changes"; };
  notes.onblur = saveNotes;
}

async function saveNotes() {
  const el = $("#appNotes"), a = state.appDetail && (state.applications || []).find(x => x.id === state.appDetail);
  if (!el || !a || el.value === (a.admin_notes || "")) return;
  try {
    await api(`/api/admin/applications/${a.id}/notes`, { method: "POST", body: JSON.stringify({ notes: el.value }) });
    a.admin_notes = el.value;
    const st = $("#appNoteState"); if (st) st.textContent = "Saved ✓";
  } catch (ex) { toast(ex.message, "error"); }
}

async function navApplicant(step) {
  await saveNotes();
  const list = filteredApps(), i = list.findIndex(x => x.id === state.appDetail);
  const next = list[i + step];
  if (next) openApplicant(next.id);
}

document.addEventListener("keydown", async e => {
  if (!state.appDetail || state.section !== "applications" || $("#palette")) return;
  const t = document.activeElement;
  if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) { if (e.key === "Escape") t.blur(); return; }
  const a = state.applications.find(x => x.id === state.appDetail);
  if (e.key === "Escape") { state.appDetail = null; renderDash(); }
  else if (e.key === "ArrowRight") navApplicant(1);
  else if (e.key === "ArrowLeft") navApplicant(-1);
  else if (a && { c: "contacted", a: "accepted", r: "rejected", n: "new" }[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
    const st = { c: "contacted", a: "accepted", r: "rejected", n: "new" }[e.key.toLowerCase()];
    try { await setAppStatus([a.id], st); toast(`${firstName(a.name)} → ${APP_META[st].label}`); renderDash(); } catch (ex) { toast(ex.message, "error"); }
  }
});

/* ------------------------- email applicants (bulk) ------------------------- */

const MAIL_TEMPLATES = {
  update: { label: "News / update", subject: "A quick update from Vertil", body: "Hi {first_name},\n\nThank you for applying to the Vertil Creator Initiative. We wanted to share a quick update with you:\n\n[write your update here]\n\nWe'll be in touch soon.\n\n— The Vertil team" },
  welcome: { label: "Welcome in", subject: "Welcome to the Vertil Creator Initiative 🎉", body: "Hi {first_name},\n\nGreat news — you're in! We loved what you shared and we're excited to have you in the Vertil Creator Initiative.\n\nNext step: create your free account at vertil.ng (use this same email), then reply to this email with your main handle so we can add you to the community.\n\n— The Vertil team" },
  info: { label: "Ask for more info", subject: "Quick question about your application", body: "Hi {first_name},\n\nThanks for applying to the Vertil Creator Initiative! Before we add you, could you reply with:\n\n1. Your main platform and handle\n2. Roughly how often you post\n3. What you'd love to create with Vertil\n\n— The Vertil team" },
  event: { label: "Invite to an event", subject: "You're invited: Vertil creator session", body: "Hi {first_name},\n\nWe're hosting a session for Vertil creators and we'd love you to join.\n\nWhen: [date and time]\nWhere: [link or venue]\n\nReply to this email to save your spot.\n\n— The Vertil team" },
};

function mailAudiences() {
  const all = state.applications || [];
  const opts = [];
  if (state.appSel.size) opts.push(["selected", `Selected (${state.appSel.size})`, all.filter(a => state.appSel.has(a.id))]);
  const fl = filteredApps();
  if (fl.length !== all.length) opts.push(["filter", `Current filter (${fl.length})`, fl]);
  opts.push(["all", `Everyone (${all.length})`, all]);
  APP_STATUSES.forEach(s => { const l = all.filter(a => appStatus(a) === s); if (l.length) opts.push([s, `${APP_META[s].label} (${l.length})`, l]); });
  return opts;
}
const mailable = a => !!a.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email.trim()) && !a.email_opt_out;
const mailAud = () => { const M = state.appMailer, auds = mailAudiences(); return auds.find(o => o[0] === M.aud) || auds[0]; };

function openMailer() {
  const auds = mailAudiences();
  state.appMailer = { aud: auds[0][0], subject: MAIL_TEMPLATES.update.subject, body: MAIL_TEMPLATES.update.body, tpl: "update",
    markContacted: true, previewHtml: "", brief: "", drafting: false, sending: false, history: null, tab: "write", showList: false };
  renderDash(); loadMailHistory(); refreshMailPreview();
}
async function loadMailHistory() {
  let h = [];
  try { h = await api("/api/admin/applications/broadcasts"); } catch {}
  if (state.appMailer) { state.appMailer.history = h; renderDash(); }
}
let _mailPrevT = null;
function refreshMailPreview() {
  clearTimeout(_mailPrevT);
  _mailPrevT = setTimeout(async () => {
    const M = state.appMailer; if (!M) return;
    const sample = mailAud()[2].find(mailable);
    try {
      const r = await api("/api/admin/applications/message/preview", { method: "POST", body: JSON.stringify({ id: sample ? sample.id : 0, subject: M.subject, body: M.body }) });
      M.previewHtml = r.html; M.previewSubject = r.subject; M.previewName = sample ? sample.name : "Amaka Obi (example)";
      const f = $("#mailPreview");
      if (f) { f.srcdoc = r.html; $("#mailPrevSubj").textContent = r.subject; $("#mailPrevTo").textContent = M.previewName; }
    } catch {}
  }, 350);
}

function appMailerModal() {
  const M = state.appMailer; if (!M) return "";
  const auds = mailAudiences();
  const list = mailAud()[2], ok = list.filter(mailable), skipped = list.length - ok.length;
  const newOnes = ok.filter(a => appStatus(a) === "new").length;
  const hist = M.history === null ? `<div class="text-[12px] text-faint">Loading…</div>`
    : M.history.length ? M.history.map(h => `<div class="flex items-center gap-3 py-2.5 border-b border-edge/60 text-[12.5px]">
        <div class="min-w-0 flex-1"><div class="text-slate-100 font-semibold truncate">${esc(h.subject)}</div>
        <div class="text-faint text-[11px]">${esc(h.audience || "Applicants")} · ${fmtDate(h.created_at)} (${ago(h.created_at)})</div></div>
        <span class="chip chip-up">${h.sent} sent</span>${h.failed ? `<span class="chip chip-down">${h.failed} failed</span>` : ""}${h.skipped ? `<span class="chip chip-flat">${h.skipped} skipped</span>` : ""}
        <button data-mailreuse="${h.id}" class="ctool">Reuse</button></div>`).join("")
    : `<div class="text-[12px] text-faint">No emails sent to applicants yet.</div>`;
  const write = `
    <div class="grid lg:grid-cols-[1fr_420px] gap-4">
      <div class="space-y-3">
        <div class="glass rounded-2xl p-4">
          <div class="text-[10.5px] uppercase tracking-wide text-faint mb-2">1 · Who gets it</div>
          <div class="flex flex-wrap gap-1.5">${auds.map(([k, l]) => `<button data-mailaud="${k}" class="seg ${M.aud === k ? "on" : ""}">${esc(l)}</button>`).join("")}</div>
          <div class="text-[12px] mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span class="text-brand-bright font-semibold">${ok.length} will receive it</span>
            ${skipped ? `<span class="text-faint">${skipped} skipped (no email or unsubscribed)</span>` : ""}
            ${ok.length ? `<button id="mailShowList" class="text-muted underline decoration-dotted">${M.showList ? "Hide" : "See"} recipients</button>` : ""}</div>
          ${M.showList ? `<div class="mt-2 max-h-32 overflow-y-auto scroll-thin text-[11.5px] text-slate-300 leading-relaxed">${ok.map(a => `${esc(a.name)} &lt;${esc(a.email)}&gt;${a.last_emailed_at ? ` <span class="text-faint">· emailed ${ago(a.last_emailed_at)}</span>` : ""}`).join("<br>")}</div>` : ""}
        </div>
        <div class="glass rounded-2xl p-4">
          <div class="flex items-center gap-1.5 flex-wrap mb-3"><span class="text-[10.5px] uppercase tracking-wide text-faint mr-auto">2 · Message</span>
            ${Object.entries(MAIL_TEMPLATES).map(([k, t]) => `<button data-mailtpl="${k}" class="seg ${M.tpl === k ? "on" : ""}">${t.label}</button>`).join("")}</div>
          <div class="flex gap-2 mb-3"><input id="mailBrief" class="input flex-1" placeholder="✨ Or tell AI what to say, e.g. we're starting creator meetups in Lagos next month" value="${esc(M.brief)}"/>
            <button id="mailDraft" class="btn-ghost whitespace-nowrap" ${M.drafting ? "disabled" : ""}>${M.drafting ? '<span class="spin inline-block w-3 h-3 border-2 border-brand/40 border-t-brand-bright rounded-full mr-1.5"></span>Writing…' : "Write with AI"}</button></div>
          <label class="text-[11px] text-faint">Subject</label>
          <input id="mailSubject" class="input w-full mb-2 !text-[13.5px]" value="${esc(M.subject)}"/>
          <label class="text-[11px] text-faint">Message <span class="opacity-70">(a blank line starts a new paragraph)</span></label>
          <textarea id="mailBody" rows="11" class="input w-full !text-[13px] leading-relaxed">${esc(M.body)}</textarea>
          <div class="flex flex-wrap gap-1.5 mt-2 items-center"><span class="text-[11px] text-faint mr-1">Personalise:</span>
            ${["first_name", "name", "niche", "handle"].map(k => `<button data-mailtag="${k}" class="ctool">{${k}}</button>`).join("")}</div>
        </div>
      </div>
      <div class="space-y-3">
        <div class="glass rounded-2xl p-3">
          <div class="text-[10.5px] uppercase tracking-wide text-faint mb-2 px-1">Preview · as <span id="mailPrevTo" class="text-slate-300 normal-case">${esc(M.previewName || "…")}</span> sees it</div>
          <div class="bg-white rounded-xl overflow-hidden">
            <div class="px-3 py-2 border-b border-slate-200 text-[12px] text-slate-700"><b>Subject:</b> <span id="mailPrevSubj">${esc(M.previewSubject || M.subject)}</span></div>
            <iframe id="mailPreview" class="w-full h-[380px] bg-white" sandbox srcdoc="${esc(M.previewHtml || "")}"></iframe></div>
        </div>
        <div class="glass rounded-2xl p-4 space-y-3">
          ${newOnes ? `<label class="flex items-center gap-2 text-[12.5px] text-slate-200"><input id="mailMark" type="checkbox" class="accent-teal-400" ${M.markContacted ? "checked" : ""}/> Mark the ${newOnes} “New” applicant${newOnes > 1 ? "s" : ""} as Contacted</label>` : ""}
          <div class="flex gap-2 flex-wrap">
            <button id="mailTest" class="btn-ghost" ${M.sending ? "disabled" : ""}>Send me a test</button>
            <button id="mailSend" class="btn-glow flex-1" ${M.sending || !ok.length ? "disabled" : ""}>${M.sending ? "Sending…" : `Send to ${ok.length} applicant${ok.length === 1 ? "" : "s"}`}</button></div>
          <div class="text-[11px] text-faint">Each email is personalised and has an unsubscribe link. Replies go to your email.</div>
        </div>
      </div>
    </div>`;
  return `<div id="mailBg" class="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] fade-in"></div>
  <div id="mailWrap" class="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
  <div id="mailBox" class="w-full max-w-[1120px] drawer rounded-2xl p-5 fade-up" style="border:1px solid rgba(45,212,191,.25)">
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <span class="agent-orb !w-10 !h-10"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg></span>
      <div><div class="font-display font-extrabold text-lg text-white">Email applicants</div>
        <div class="text-[12px] text-muted">One personalised email to many Creator Initiative applicants.</div></div>
      <div class="seg-group ml-auto"><button data-mailtab="write" class="seg ${M.tab === "write" ? "on" : ""}">Write</button><button data-mailtab="history" class="seg ${M.tab === "history" ? "on" : ""}">Sent${M.history ? ` (${M.history.length})` : ""}</button></div>
      <button id="mailClose" class="seg" title="Close (Esc)">✕</button></div>
    ${M.tab === "history" ? `<div class="glass rounded-2xl p-4">${hist}</div>` : write}
  </div></div>`;
}

function wireMailer() {
  const M = state.appMailer; if (!M) return;
  const close = () => { state.appMailer = null; renderDash(); };
  $("#mailClose").onclick = close;
  $("#mailWrap").onclick = e => { if (e.target.id === "mailWrap") close(); };
  $$("[data-mailtab]").forEach(b => b.onclick = () => { M.tab = b.dataset.mailtab; renderDash(); if (M.tab === "write") refreshMailPreview(); });
  $$("[data-mailreuse]").forEach(b => b.onclick = () => { const h = M.history.find(x => x.id === +b.dataset.mailreuse); if (!h) return; M.subject = h.subject; M.body = h.body; M.tpl = null; M.tab = "write"; renderDash(); refreshMailPreview(); });
  if (M.tab !== "write") return;
  $$("[data-mailaud]").forEach(b => b.onclick = () => { M.aud = b.dataset.mailaud; renderDash(); refreshMailPreview(); });
  const sl = $("#mailShowList"); if (sl) sl.onclick = () => { M.showList = !M.showList; renderDash(); };
  $$("[data-mailtpl]").forEach(b => b.onclick = () => {
    const t = MAIL_TEMPLATES[b.dataset.mailtpl];
    if (M.tpl === null && M.body.trim() && !confirm("Replace your message with this template?")) return;
    M.tpl = b.dataset.mailtpl; M.subject = t.subject; M.body = t.body; renderDash(); refreshMailPreview();
  });
  const subj = $("#mailSubject"), body = $("#mailBody");
  subj.oninput = () => { M.subject = subj.value; refreshMailPreview(); };
  body.oninput = () => { M.body = body.value; M.tpl = null; refreshMailPreview(); };
  $$("[data-mailtag]").forEach(b => b.onclick = () => {
    const tag = `{${b.dataset.mailtag}}`, s = body.selectionStart ?? body.value.length, e2 = body.selectionEnd ?? s;
    body.value = body.value.slice(0, s) + tag + body.value.slice(e2); M.body = body.value; M.tpl = null;
    body.focus(); body.setSelectionRange(s + tag.length, s + tag.length); refreshMailPreview();
  });
  const br = $("#mailBrief"); br.oninput = () => { M.brief = br.value; };
  $("#mailDraft").onclick = async () => {
    if (!M.brief.trim()) return toast("Tell the AI what the email is about.", "error");
    M.drafting = true; renderDash();
    try {
      const r = await api("/api/admin/applications/message/draft", { method: "POST", body: JSON.stringify({ brief: M.brief, audience: mailAud()[1] }) });
      M.subject = r.subject || M.subject; M.body = r.body; M.tpl = null; toast("Draft ready. Edit anything you like.");
    } catch (ex) { toast(ex.message, "error"); }
    M.drafting = false; renderDash(); refreshMailPreview();
  };
  const mk = $("#mailMark"); if (mk) mk.onchange = () => { M.markContacted = mk.checked; };
  const ids = () => mailAud()[2].filter(mailable).map(a => a.id);
  $("#mailTest").onclick = async () => {
    try { const r = await api("/api/admin/applications/message", { method: "POST", body: JSON.stringify({ ids: ids().slice(0, 1), subject: M.subject, body: M.body, test: true }) }); toast(`Test sent to ${r.to}`); }
    catch (ex) { toast(ex.message, "error"); }
  };
  $("#mailSend").onclick = async () => {
    const list = ids();
    if (!M.subject.trim() || !M.body.trim()) return toast("Add a subject and a message.", "error");
    if (/\[(write|date|link)[^\]]*\]/i.test(M.body)) return toast("Fill in the [bracketed] parts of the template first.", "error");
    if (!confirm(`Send “${M.subject}” to ${list.length} applicant${list.length === 1 ? "" : "s"}?`)) return;
    M.sending = true; renderDash();
    try {
      const r = await api("/api/admin/applications/message", { method: "POST", body: JSON.stringify({ ids: list, subject: M.subject, body: M.body, mark_contacted: M.markContacted, audience: mailAud()[1].replace(/\s*\(\d+\)$/, "") }) });
      const now = Date.now() / 1000;
      (state.applications || []).forEach(a => { if (list.includes(a.id)) { a.last_emailed_at = now; a.emails_sent = (a.emails_sent || 0) + 1; if (M.markContacted && appStatus(a) === "new") a.status = "contacted"; } });
      toast(`Sent to ${r.sent}${r.failed ? ` · ${r.failed} failed` : ""}${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
      M.sending = false; M.tab = "history"; M.history = null; renderDash(); loadMailHistory();
    } catch (ex) { M.sending = false; toast(ex.message, "error"); renderDash(); }
  };
}

document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !state.appMailer || $("#palette")) return;
  const t = document.activeElement; if (t && ["INPUT", "TEXTAREA"].includes(t.tagName)) { t.blur(); return; }
  state.appMailer = null; renderDash();
});
