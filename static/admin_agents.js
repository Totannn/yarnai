/* Vertil Admin — AI agents. Agents draft; a human approves before anything is sent. */

const AGENT_ICONS = {
  analyst: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  activation: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  winback: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  upgrade: '<path d="m12 3 8 8h-5v10H9V11H4z"/>',
  quality: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
  newsletter: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
};
const agentIcon = (k, cls = "w-5 h-5") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${AGENT_ICONS[k] || AGENT_ICONS.analyst}</svg>`;
const ago = t => {
  if (!t) return "never";
  const s = Date.now() / 1000 - t;
  return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago";
};

async function loadAgents() { state.agents = await api("/api/admin/agents"); }
async function openAgent(key) {
  state.agentOpen = key; state.agentDetail = null; state.agentSel = new Set(); renderDash();
  state.agentDetail = await api(`/api/admin/agents/${key}`);
  renderDash();
}

function agentsSection() {
  if (state.agentOpen) return agentDetailView();
  const A = state.agents;
  if (!A) return `<div class="text-muted text-sm">Loading agents…</div>`;
  const status = (ok, label) => `<span class="chip ${ok ? "chip-up" : "chip-down"}">${ok ? "●" : "○"} ${label}</span>`;
  const cards = A.agents.map(a => `
    <div class="glass agent-card rounded-2xl p-5 flex flex-col fade-up">
      <div class="flex items-center gap-3">
        <span class="agent-orb">${agentIcon(a.key)}</span>
        <div class="min-w-0"><div class="font-display font-bold text-white">${esc(a.name)}</div>
          <div class="text-[11px] text-faint">Last run ${ago(a.last_run)} · ${a.runs} run${a.runs === 1 ? "" : "s"}</div></div>
      </div>
      <p class="text-[12.5px] text-muted mt-3 flex-1">${esc(a.blurb)}</p>
      <div class="grid grid-cols-3 gap-2 mt-4 text-center">
        ${a.kind === "outreach" ? `<div class="mini"><div class="mini-v">${a.candidates ?? "—"}</div><div class="mini-l">to contact</div></div>` : `<div class="mini"><div class="mini-v">${a.runs}</div><div class="mini-l">reports</div></div>`}
        <div class="mini"><div class="mini-v text-gold">${a.pending}</div><div class="mini-l">${a.kind === "outreach" ? "to review" : "open"}</div></div>
        <div class="mini"><div class="mini-v">${a.sent}</div><div class="mini-l">${a.kind === "outreach" ? "sent" : "done"}</div></div>
      </div>
      <div class="flex gap-2 mt-4">
        <button data-agent-run="${a.key}" ${state.agentBusy[a.key] ? "disabled" : ""} class="btn-glow flex-1">${state.agentBusy[a.key] ? '<span class="spin inline-block w-3 h-3 border-2 border-ink/40 border-t-ink rounded-full"></span> Working…' : "Run now"}</button>
        <button data-agent-open="${a.key}" class="btn-ghost">Open</button>
      </div>
    </div>`).join("");
  const nl = A.newsletter || {};
  return `
    <div class="glass rounded-2xl p-5 mb-4 hero-grid">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div><div class="font-display font-extrabold text-xl text-white">AI agents</div>
          <div class="text-[12.5px] text-muted mt-1">Each agent studies your data and drafts the work. Nothing is emailed until you approve it.</div></div>
        <div class="flex gap-2 flex-wrap">${status(A.ai_ready, "AI connected")}${status(A.email_ready, "Email sending")}</div>
      </div>
    </div>
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      ${cards}
      <div class="glass agent-card rounded-2xl p-5 flex flex-col fade-up">
        <div class="flex items-center gap-3"><span class="agent-orb">${agentIcon("newsletter")}</span>
          <div><div class="font-display font-bold text-white">Newsletter Writer</div><div class="text-[11px] text-faint">Plans and drafts The Broadcast</div></div></div>
        <p class="text-[12.5px] text-muted mt-3 flex-1">Drafts a week of newsletter issues from one prompt and sends on the days you mark Ready.</p>
        <div class="grid grid-cols-2 gap-2 mt-4 text-center">
          <div class="mini"><div class="mini-v">${nl.subscribers || 0}</div><div class="mini-l">subscribers</div></div>
          <div class="mini"><div class="mini-v">${nl.opted_out || 0}</div><div class="mini-l">opted out</div></div></div>
        <button data-section="newsletter" class="btn-ghost mt-4">Open newsletter</button>
      </div>
    </div>`;
}

function agentDetailView() {
  const key = state.agentOpen, D = state.agentDetail;
  const meta = (state.agents?.agents || []).find(a => a.key === key) || {};
  const head = `<div class="flex items-center gap-3 mb-4 flex-wrap">
      <button data-agent-back class="btn-ghost">← All agents</button>
      <span class="agent-orb">${agentIcon(key)}</span>
      <div class="min-w-0"><div class="font-display font-bold text-lg text-white">${esc(meta.name || key)}</div>
        <div class="text-[12px] text-muted">${esc(meta.blurb || "")}</div></div>
      <button data-agent-run="${key}" ${state.agentBusy[key] ? "disabled" : ""} class="btn-glow ml-auto">${state.agentBusy[key] ? "Working…" : "Run now"}</button>
    </div>`;
  if (!D) return head + `<div class="text-muted text-sm">Loading…</div>`;
  if (key === "analyst") return head + analystView(D);
  if (key === "quality") return head + findingsView(D);
  return head + outreachView(D);
}

function analystView(D) {
  const run = D.runs[0];
  const rep = run && run.report;
  const toneCls = { good: "border-emerald-400/40 text-emerald-300", bad: "border-rose-400/40 text-rose-300", neutral: "border-edge text-slate-300" };
  const impact = { high: "chip-down", medium: "chip-new", low: "chip-flat" };
  const chat = (state.analystChat || []).map(m => `<div class="${m.q ? "text-right" : ""}"><div class="inline-block max-w-[85%] text-[13px] rounded-xl px-3 py-2 mt-2 ${m.q ? "bg-brand/20 text-brand-bright" : "bg-paper border border-edge text-slate-200 whitespace-pre-wrap"}">${esc(m.q || m.a)}</div></div>`).join("");
  return `<div class="grid lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 space-y-4">
      ${rep ? `<div class="glass rounded-2xl p-5 hero-grid">
          <div class="text-[11px] font-mono uppercase tracking-wider text-brand-bright">Briefing · ${ago(run.created_at)}</div>
          <div class="font-display font-extrabold text-xl text-white mt-1">${esc(rep.headline)}</div>
          <p class="text-sm text-slate-300 mt-2">${esc(rep.summary || "")}</p></div>
        <div class="grid sm:grid-cols-2 gap-3">${(rep.highlights || []).map(h => `<div class="glass rounded-xl p-4 border ${toneCls[h.tone] || toneCls.neutral}">
          <div class="text-[13px] font-semibold">${esc(h.title)}</div><div class="text-[12px] text-muted mt-1">${esc(h.detail)}</div></div>`).join("")}</div>
        <div class="glass rounded-2xl p-5"><div class="text-[13px] font-semibold text-white mb-3">Recommended moves</div>
          ${(rep.actions || []).map((a, i) => `<div class="flex gap-3 py-2.5 ${i ? "border-t border-edge/60" : ""}">
            <span class="font-display font-bold text-brand-bright">0${i + 1}</span>
            <div class="flex-1"><div class="text-[13px] font-semibold text-white">${esc(a.title)} <span class="chip ${impact[a.impact] || "chip-flat"}">${esc(a.impact || "")} impact</span></div>
              <div class="text-[12px] text-muted mt-0.5">${esc(a.detail)}</div></div></div>`).join("")}</div>`
      : `<div class="glass rounded-2xl p-8 text-center"><div class="text-white font-semibold">No briefing yet</div><div class="text-sm text-muted mt-1">Run the analyst to get a read on your latest numbers.</div></div>`}
    </div>
    <div class="glass rounded-2xl p-5 flex flex-col" style="min-height:420px">
      <div class="text-[13px] font-semibold text-white">Ask the analyst</div>
      <div class="text-[11px] text-faint">Answers come only from your live data.</div>
      <div id="askLog" class="flex-1 overflow-y-auto scroll-thin mt-2">${chat || `<div class="text-[12px] text-faint mt-3 space-y-1.5">${["Which content types are growing fastest?", "Where do new users drop off?", "Is AI spend growing faster than usage?"].map(q => `<button data-ask-suggest="${esc(q)}" class="block text-left hover:text-brand-bright">→ ${esc(q)}</button>`).join("")}</div>`}</div>
      <form id="askForm" class="flex gap-2 mt-3"><input id="askInput" placeholder="Ask about your numbers…" class="input flex-1"/>
        <button class="btn-glow" ${state.askBusy ? "disabled" : ""}>${state.askBusy ? "…" : "Ask"}</button></form>
    </div></div>`;
}

function findingsView(D) {
  const sev = { high: "chip-down", medium: "chip-new", low: "chip-flat" };
  const open = D.items.filter(i => i.status === "pending"), closed = D.items.filter(i => i.status !== "pending");
  const row = it => `<div class="glass rounded-xl p-4 ${it.status !== "pending" ? "opacity-55" : ""}">
    <div class="flex items-start gap-2"><span class="chip ${sev[it.severity] || "chip-flat"}">${esc(it.severity || "low")}</span>
      <div class="flex-1"><div class="text-[13px] font-semibold text-white">${esc(it.title)}</div><div class="text-[12px] text-muted mt-1">${esc(it.reason)}</div>
        <div class="text-[12px] text-slate-300 mt-2 finding-body">${it.body_html || ""}</div></div>
      ${it.status === "pending" ? `<div class="flex flex-col gap-1.5"><button data-item-status="${it.id}" data-v="resolved" class="btn-ghost">Mark fixed</button>
        <button data-item-status="${it.id}" data-v="dismissed" class="btn-ghost">Dismiss</button></div>` : `<span class="text-[11px] text-faint">${esc(it.status)}</span>`}</div></div>`;
  return `${D.runs[0] ? `<div class="glass rounded-2xl p-4 mb-4 text-sm text-slate-200">${esc(D.runs[0].summary)} <span class="text-faint">· ${ago(D.runs[0].created_at)}</span></div>` : ""}
    <div class="space-y-3">${open.map(row).join("") || `<div class="glass rounded-2xl p-8 text-center text-sm text-muted">No open findings. Run the monitor to review recent output.</div>`}</div>
    ${closed.length ? `<div class="text-[12px] text-faint mt-6 mb-2">Closed (${closed.length})</div><div class="space-y-3">${closed.slice(0, 20).map(row).join("")}</div>` : ""}`;
}

function outreachView(D) {
  const filt = state.agentFilter || "pending";
  const items = D.items.filter(i => filt === "all" || i.status === filt);
  const counts = D.items.reduce((m, i) => (m[i.status] = (m[i.status] || 0) + 1, m), {});
  const sel = state.agentSel;
  const cand = D.candidates || [];
  const draftCard = it => `<div class="glass rounded-2xl p-4 ${it.status !== "pending" ? "opacity-60" : ""}" data-item="${it.id}">
      <div class="flex items-start gap-3">
        ${it.status === "pending" ? `<input type="checkbox" data-item-sel="${it.id}" ${sel.has(it.id) ? "checked" : ""} class="mt-1 accent-teal-400 w-4 h-4"/>` : ""}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap"><span class="text-[13px] font-semibold text-white">${esc(it.name || it.email)}</span>
            <span class="text-[11px] text-faint">${esc(it.email)}</span>${it.title && it.title !== it.name ? `<span class="chip chip-flat">${esc(it.title)}</span>` : ""}
            <span class="chip ${it.status === "sent" ? "chip-up" : it.status === "pending" ? "chip-new" : "chip-flat"} ml-auto">${esc(it.status)}</span></div>
          ${it.reason ? `<div class="text-[11.5px] text-faint mt-1">Why: ${esc(it.reason)}</div>` : ""}
          ${it.status === "pending" ? `
            <input data-item-subject="${it.id}" value="${esc(it.subject)}" class="input w-full mt-3 font-semibold"/>
            <div data-item-body="${it.id}" contenteditable="true" class="email-edit mt-2">${it.body_html}</div>
            <div class="flex gap-2 mt-3 flex-wrap">
              <button data-item-save="${it.id}" class="btn-ghost">Save edits</button>
              <button data-item-send="${it.id}" class="btn-glow">Send this one</button>
              <button data-item-status="${it.id}" data-v="dismissed" class="btn-ghost ml-auto">Dismiss</button></div>`
          : `<div class="text-[12.5px] text-slate-300 mt-2"><b>${esc(it.subject)}</b></div><div class="text-[12px] text-muted mt-1 line-clamp-3">${it.body_html}</div>`}
        </div></div></div>`;
  return `<div class="grid lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2">
      <div class="flex items-center gap-2 flex-wrap mb-3">
        ${["pending", "sent", "dismissed", "all"].map(f => `<button data-agent-filter="${f}" class="seg ${filt === f ? "on" : ""}">${f === "pending" ? "To review" : f[0].toUpperCase() + f.slice(1)} ${f === "all" ? D.items.length : counts[f] || 0}</button>`).join("")}
        ${filt === "pending" && items.length ? `<label class="text-[12px] text-muted flex items-center gap-1.5 ml-2"><input type="checkbox" id="selAll" class="accent-teal-400" ${items.every(i => sel.has(i.id)) ? "checked" : ""}/> Select all</label>
          <button id="sendSelected" ${sel.size ? "" : "disabled"} class="btn-glow ml-auto">Send ${sel.size || ""} selected</button>` : ""}
      </div>
      <div class="space-y-3">${items.map(draftCard).join("") || `<div class="glass rounded-2xl p-8 text-center text-sm text-muted">Nothing here. ${filt === "pending" ? "Run the agent to draft emails." : ""}</div>`}</div>
    </div>
    <div class="glass rounded-2xl p-4 self-start">
      <div class="text-[13px] font-semibold text-white">Who it will write to</div>
      <div class="text-[11px] text-faint mb-3">${cand.length ? `${cand.length} more ${cand.length === 1 ? "person matches" : "people match"} and could be drafted next run.`
        : counts.pending ? "Everyone who matches already has a draft waiting for your review." : "Nobody matches right now."}
        Opted-out, suspended, admin and recently emailed users are always left out.</div>
      <div class="space-y-1.5 max-h-[520px] overflow-y-auto scroll-thin">${cand.map(c => `<button data-user="${c.id}" class="w-full text-left text-xs rounded-lg px-2.5 py-2 bg-paper/60 border border-edge hover:border-brand/50">
        <div class="flex items-center gap-2"><span class="text-slate-100 truncate flex-1">${esc(c.name || c.email)}</span><span class="text-faint">${esc(c.plan)}</span></div>
        <div class="text-faint mt-0.5">${esc(c.brand || "no brand yet")} · ${c.gens} gens · ${c.last_active ? "active " + ago(c.last_active) : "joined " + ago(c.created_at)}</div></button>`).join("") || `<p class="text-xs text-muted">Nobody right now.</p>`}</div>
    </div></div>`;
}

function wireAgents() {
  if (state.section !== "agents") return;
  $$("[data-agent-open]").forEach(b => b.onclick = () => openAgent(b.dataset.agentOpen));
  const back = $("[data-agent-back]"); if (back) back.onclick = async () => { state.agentOpen = null; await loadAgents(); renderDash(); };
  $$("[data-agent-run]").forEach(b => b.onclick = async () => {
    const k = b.dataset.agentRun;
    state.agentBusy[k] = true; renderDash();
    try {
      const r = await api(`/api/admin/agents/${k}/run`, { method: "POST" });
      toast(r.summary);
      await loadAgents();
      if (state.agentOpen === k) state.agentDetail = await api(`/api/admin/agents/${k}`);
    } catch (ex) { toast(ex.message, "error"); }
    state.agentBusy[k] = false; renderDash();
  });
  $$("[data-agent-filter]").forEach(b => b.onclick = () => { state.agentFilter = b.dataset.agentFilter; renderDash(); });
  $$("[data-item-sel]").forEach(c => c.onchange = () => { const id = +c.dataset.itemSel; c.checked ? state.agentSel.add(id) : state.agentSel.delete(id); renderDash(); });
  const sa = $("#selAll"); if (sa) sa.onchange = () => {
    const ids = state.agentDetail.items.filter(i => i.status === "pending").map(i => i.id);
    state.agentSel = sa.checked ? new Set(ids) : new Set(); renderDash();
  };
  const saveItem = async id => {
    await api(`/api/admin/agent-items/${id}`, { method: "PUT", body: JSON.stringify({
      subject: $(`[data-item-subject="${id}"]`).value, body_html: $(`[data-item-body="${id}"]`).innerHTML }) });
  };
  $$("[data-item-save]").forEach(b => b.onclick = async () => {
    try { await saveItem(b.dataset.itemSave); state.agentDetail = await api(`/api/admin/agents/${state.agentOpen}`); toast("Saved."); renderDash(); }
    catch (ex) { toast(ex.message, "error"); }
  });
  const sendIds = async ids => {
    if (!ids.length) return;
    if (!confirm(`Send ${ids.length} email${ids.length > 1 ? "s" : ""} now?`)) return;
    try {
      for (const id of ids) if ($(`[data-item-subject="${id}"]`)) await saveItem(id);
      const r = await api("/api/admin/agent-items/send", { method: "POST", body: JSON.stringify({ ids }) });
      const failed = r.results.filter(x => !x.ok);
      toast(failed.length ? `Sent ${r.sent}. ${failed.length} not sent: ${failed[0].message}` : `Sent ${r.sent}.`, failed.length ? "error" : "ok");
      state.agentSel = new Set();
      state.agentDetail = await api(`/api/admin/agents/${state.agentOpen}`); await loadAgents(); renderDash();
    } catch (ex) { toast(ex.message, "error"); }
  };
  $$("[data-item-send]").forEach(b => b.onclick = () => sendIds([+b.dataset.itemSend]));
  const ss = $("#sendSelected"); if (ss) ss.onclick = () => sendIds([...state.agentSel]);
  $$("[data-item-status]").forEach(b => b.onclick = async () => {
    try {
      await api(`/api/admin/agent-items/${b.dataset.itemStatus}`, { method: "PUT", body: JSON.stringify({ status: b.dataset.v }) });
      state.agentDetail = await api(`/api/admin/agents/${state.agentOpen}`); await loadAgents(); renderDash();
    } catch (ex) { toast(ex.message, "error"); }
  });
  const ask = async q => {
    if (!q) return;
    state.analystChat = [...(state.analystChat || []), { q }]; state.askBusy = true; renderDash();
    try { const r = await api("/api/admin/agents/analyst/ask", { method: "POST", body: JSON.stringify({ question: q }) }); state.analystChat.push({ a: r.answer }); }
    catch (ex) { state.analystChat.push({ a: "⚠ " + ex.message }); }
    state.askBusy = false; renderDash();
    const log = $("#askLog"); if (log) log.scrollTop = log.scrollHeight;
  };
  const af = $("#askForm"); if (af) af.onsubmit = e => { e.preventDefault(); ask($("#askInput").value.trim()); };
  $$("[data-ask-suggest]").forEach(b => b.onclick = () => ask(b.dataset.askSuggest));
}
