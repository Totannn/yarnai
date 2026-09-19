/* Vertil for Teams — branded signup/login + seat-invite acceptance.
   Once authenticated, this hands off to the main app (/app) — Studio,
   Brands etc. are not reimplemented here. */

const $ = (s, el = document) => el.querySelector(s);

function vword({ size = "20px", color = "#f4f7f6", accent = "#2dd4bf" } = {}) {
  return `<span class="vword" style="font-size:${size};--vi:${accent};color:${color}">Vert<span class="vi"><span class="vi-tip"></span><span class="vi-stem"></span></span>l</span>`;
}
function vmark(px = 36) {
  return `<span class="rounded-xl bg-brand grid place-items-center" style="width:${px}px;height:${px}px">
    <span class="vi" style="font-size:${Math.round(px * 0.5)}px"><span class="vi-tip" style="border-bottom-color:#fff"></span><span class="vi-stem" style="background:#fff"></span></span></span>`;
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || res.statusText); e.status = res.status; e.data = data; throw e; }
  return data;
}

const params = new URLSearchParams(location.search);
const inviteToken = params.get("invite") || "";
const state = { user: null, mode: "login", busy: false, err: "" };

function shell(inner) {
  document.getElementById("app").innerHTML = `
  <div class="min-h-screen grid lg:grid-cols-2">
    <div class="hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-forest via-brand-dark to-brand relative overflow-hidden">
      <a href="/" class="flex items-center gap-2.5">${vword({ size: "22px", color: "#f4f7f6", accent: "#2dd4bf" })}</a>
      <div class="relative z-10">
        <h1 class="font-display font-extrabold text-4xl leading-tight">One brand voice.<br>Your whole team.</h1>
        <p class="mt-4 text-white/85 max-w-sm leading-relaxed">Invite your team into a shared Vertil workspace — everyone writes in the same on-brand voice, with one pooled plan.</p>
        <ul class="mt-8 space-y-3 max-w-sm">
          <li class="flex items-center gap-3 text-sm text-white/90"><span class="w-5 h-5 rounded-full bg-brand-bright/20 text-brand-bright grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="w-3 h-3"><path d="M20 6 9 17l-5-5"/></svg></span> Shared brand voices across every seat</li>
          <li class="flex items-center gap-3 text-sm text-white/90"><span class="w-5 h-5 rounded-full bg-brand-bright/20 text-brand-bright grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="w-3 h-3"><path d="M20 6 9 17l-5-5"/></svg></span> One pooled usage limit, no per-person juggling</li>
          <li class="flex items-center gap-3 text-sm text-white/90"><span class="w-5 h-5 rounded-full bg-brand-bright/20 text-brand-bright grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="w-3 h-3"><path d="M20 6 9 17l-5-5"/></svg></span> Invite and remove teammates any time</li>
        </ul>
      </div>
      <p class="text-white/60 text-xs relative z-10">Vertil for Teams</p>
      <div class="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-white/10"></div>
      <div class="absolute right-24 top-24 w-32 h-32 rounded-full bg-white/10"></div>
    </div>
    <div class="flex items-center justify-center p-6 sm:p-12">
      <div class="w-full max-w-sm fade-up">
        <div class="lg:hidden mb-8">${vword({ size: "22px" })}</div>
        ${inner}
      </div>
    </div>
  </div>`;
}

function loadingScreen() {
  shell(`<div class="text-center py-10"><div class="w-8 h-8 mx-auto border-[3px] border-brand/25 border-t-brand rounded-full spin"></div></div>`);
}

/* ---------------------------- plain login/signup (no invite) --------------------------- */

function renderAuth() {
  const login = state.mode === "login";
  shell(`
    <h2 class="font-display font-extrabold text-2xl">${login ? "Sign in to your workspace" : "Set up your team workspace"}</h2>
    <p class="text-sm text-muted mt-1">${login ? "Welcome back." : "Create your account, then invite your team from Settings."}</p>
    <form id="authForm" class="mt-6 space-y-3">
      ${login ? "" : `<div><label class="text-xs font-semibold text-muted">Your name</label>
        <input name="name" placeholder="Your name" class="auth-input"/></div>`}
      <div><label class="text-xs font-semibold text-muted">Email</label>
        <input name="email" type="email" required placeholder="you@business.com" class="auth-input"/></div>
      <div><label class="text-xs font-semibold text-muted">Password</label>
        <input name="password" type="password" required minlength="6" placeholder="At least 6 characters" class="auth-input"/></div>
      ${login ? "" : `<div><label class="text-xs font-semibold text-muted">Phone number (WhatsApp)</label>
        <input name="phone" type="tel" required placeholder="e.g. 0803 123 4567" class="auth-input"/></div>`}
      <p id="authErr" class="text-xs text-rose-500 hidden"></p>
      <button id="authBtn" type="submit" class="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm">
        ${login ? "Sign in" : "Create workspace"}
      </button>
    </form>
    <p class="text-sm text-muted mt-5 text-center">
      ${login ? "Setting up a new team?" : "Already have a workspace account?"}
      <button id="authToggle" class="text-brand font-semibold hover:text-brand-dark">${login ? "Create one" : "Sign in"}</button>
    </p>
    <p class="text-xs text-faint mt-3 text-center">Not here for a team? <a href="/app" class="text-brand-dark hover:underline">Go to the regular Vertil login</a>.</p>
  `);
  $("#authToggle").onclick = () => { state.mode = login ? "signup" : "login"; renderAuth(); };
  $("#authForm").onsubmit = onPlainAuthSubmit;
}

async function onPlainAuthSubmit(e) {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const btn = $("#authBtn"), err = $("#authErr");
  btn.disabled = true; btn.textContent = "…"; err.classList.add("hidden");
  try {
    const path = state.mode === "login" ? "/api/login" : "/api/signup";
    await api(path, { method: "POST", body: JSON.stringify(fd) });
    location.href = "/app";
  } catch (ex) {
    err.textContent = ex.message; err.classList.remove("hidden");
    btn.disabled = false; btn.textContent = state.mode === "login" ? "Sign in" : "Create workspace";
  }
}

/* ------------------------------- invite acceptance -------------------------------- */

function renderInviteError(msg) {
  shell(`<h2 class="font-display font-extrabold text-2xl">Invite not valid</h2>
    <p class="text-sm text-muted mt-2">${esc(msg)}</p>
    <a href="/team" class="inline-block mt-5 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-5 py-2.5 rounded-xl">Go to Vertil for Teams</a>`);
}

function renderInviteMismatch(info) {
  shell(`<h2 class="font-display font-extrabold text-2xl">Wrong account</h2>
    <p class="text-sm text-muted mt-2">This invite was sent to <b>${esc(info.email)}</b>, but you're signed in as <b>${esc(state.user.email)}</b>.</p>
    <button id="switchAcct" class="mt-5 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-5 py-2.5 rounded-xl">Log out and use the right email</button>`);
  $("#switchAcct").onclick = async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); location.reload(); };
}

function renderInviteAccept(info) {
  const login = info.account_exists;
  shell(`
    <div class="mb-5 text-center">${vmark(40)}
      <p class="text-sm text-muted mt-3">${esc(info.owner_name)} invited you to their team workspace on Vertil.</p>
    </div>
    <h2 class="font-display font-extrabold text-2xl">${login ? "Sign in to accept" : "Create your account"}</h2>
    <form id="inviteForm" class="mt-5 space-y-3">
      ${login ? "" : `<div><label class="text-xs font-semibold text-muted">Your name</label>
        <input name="name" placeholder="Your name" class="auth-input"/></div>`}
      <div><label class="text-xs font-semibold text-muted">Email</label>
        <input value="${esc(info.email)}" disabled class="auth-input opacity-60 cursor-not-allowed"/></div>
      <div><label class="text-xs font-semibold text-muted">Password</label>
        <input name="password" type="password" required minlength="6" placeholder="${login?"Your password":"At least 6 characters"}" class="auth-input"/></div>
      ${login ? "" : `<div><label class="text-xs font-semibold text-muted">Phone number (WhatsApp)</label>
        <input name="phone" type="tel" required placeholder="e.g. 0803 123 4567" class="auth-input"/></div>`}
      <p id="inviteErr" class="text-xs text-rose-500 hidden"></p>
      <button id="inviteBtn" type="submit" class="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm">
        ${login ? "Sign in & join team" : "Create account & join team"}
      </button>
    </form>`);
  $("#inviteForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.email = info.email;
    const btn = $("#inviteBtn"), err = $("#inviteErr");
    btn.disabled = true; btn.textContent = "…"; err.classList.add("hidden");
    try {
      await api(login ? "/api/login" : "/api/signup", { method: "POST", body: JSON.stringify(fd) });
      await api("/api/team/accept", { method: "POST", body: JSON.stringify({ token: inviteToken }) });
      location.href = "/app";
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove("hidden");
      btn.disabled = false; btn.textContent = login ? "Sign in & join team" : "Create account & join team";
    }
  };
}

/* ---------------------------------- boot ------------------------------------- */

async function boot() {
  loadingScreen();
  let me = null;
  try { me = (await api("/api/me")).user; } catch { /* not logged in */ }
  state.user = me;

  if (inviteToken) {
    let info;
    try { info = await api(`/api/team/invite-info?token=${encodeURIComponent(inviteToken)}`); }
    catch (ex) { return renderInviteError(ex.message); }
    if (me) {
      if (me.email.toLowerCase() !== info.email.toLowerCase()) return renderInviteMismatch(info);
      try {
        await api("/api/team/accept", { method: "POST", body: JSON.stringify({ token: inviteToken }) });
        location.href = "/app";
      } catch (ex) { renderInviteError(ex.message); }
      return;
    }
    return renderInviteAccept(info);
  }

  if (me) { location.href = "/app"; return; }
  renderAuth();
}

boot();
