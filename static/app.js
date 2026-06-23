/* Vertil — studio frontend (Clean & Premium, multi-tenant) */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = {
  config: null, user: null, usage: null,
  brands: [], activeBrandId: null,
  view: "studio",
  authMode: "login",
  // studio
  tone: "pidgin", contentType: "instagram_caption", variants: 3, brief: "",
  generating: false, cards: null,
  // calendar
  calMonth: "December", calYear: 2026, calCadence: "3_week",
  calBuilding: false, calendar: null, savedCalendars: [],
  // advisors
  rateInputs: { service: "", experience: "", location: "", client_type: "", scope: "" },
  rateResult: null, rateLoading: false,
  brandInputs: { interests: "", formats: [], brand_types: [], platform: "", goal: "" },
  brandResult: null, brandLoading: false,
  scriptInputs: { idea: "", platform: "TikTok", length: "30 seconds", goal: "Go viral / awareness", format: "ai_pick", tone: "pidgin" },
  scriptResult: null, scriptLoading: false,
  // gig diary
  gigs: [], gigSummary: null, gigEditing: null,
  // misc
  history: [], favorites: [], editing: null, brandMode: "form", extracting: false,
  tour: null, mobileNav: false, acctMenu: false,
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_ABBR = {January:"Jan",February:"Feb",March:"Mar",April:"Apr",May:"May",June:"Jun",July:"Jul",August:"Aug",September:"Sep",October:"Oct",November:"Nov",December:"Dec"};

const ICON = {
  studio: '<path d="M4 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M4 5v14a2 2 0 0 0 2 2h6M4 5H3m13 3 4 4m0 0-7 7-4 1 1-4 7-7m4 4-4-4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4M7.5 13h2m4.5 0h2m-8.5 4h2m4.5 0h2"/>',
  calendars: '<path d="M8 7h12M8 12h12M8 17h12M3.5 7h.01M3.5 12h.01M3.5 17h.01"/>',
  brands: '<path d="M3 9.5 12 4l9 5.5M5 11v8h14v-8M9.5 19v-5h5v5"/>',
  saved: '<path d="m12 4 2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 16l-4.6 2.4.9-5.1-3.7-3.6 5.2-.8z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/><path d="M12 8v4l3 2"/>',
  pricing: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  rate: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 1.8 0 2.4 5 1.3 5 3.8 0 1-1.1 1.9-2.5 1.9A2.5 2 0 0 1 9.5 13M12 6v1.5M12 16.5V18"/>',
  advisor: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M12 8a4 4 0 0 1 4 4c0 1.5-1 2.5-1.6 3.2-.4.5-.4 1.3-.4 1.8h-4c0-.5 0-1.3-.4-1.8C9 14.5 8 13.5 8 12a4 4 0 0 1 4-4ZM10 19h4"/>',
  gigs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  admin: '<path d="M12 3 4 6v5c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  script: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
};

const ADVISOR_LABELS = { rate_advisor: "Rate Advisor", personal_brand: "Brand Advisor", script: "Script Writer" };

/* monochrome line-icon set (professional, no emoji) */
const ICONP = {
  // content types
  instagram_caption: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><circle cx="12" cy="13" r="3.2"/><path d="M8.5 6 10 3.6h4L15.5 6"/>',
  tweet: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8.5 9h7M8.5 11.5h4"/>',
  whatsapp_broadcast: '<path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.9-5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M9 11h6M9 13.5h3.5"/>',
  product_description: '<path d="M3.5 11.5 11.5 3.5H20V12l-8 8z"/><circle cx="15.5" cy="8.5" r="1.4"/>',
  sms: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M10.5 18h3"/>',
  ad_copy: '<path d="M4 10v3a1 1 0 0 0 1 1h2l4.5 4V5L7 9H5a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a4.5 4.5 0 0 1 0 7"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  blog_intro: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h5"/>',
  // tones
  pidgin: '<path d="M4 5h16v10H9l-5 4z"/>',
  lagos_corporate: '<path d="M4 21V8l5-3 5 3v13M14 21V11l5-3v13M4 21h16M7 9v0M7 12v0M7 15v0"/>',
  yoruba_mix: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z"/>',
  igbo_market: '<rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  hausa_north: '<path d="M5 21V10l7-5 7 5v11M5 21h14M9 21v-4a3 3 0 0 1 6 0v4M12 3v2"/>',
  luxury: '<path d="m12 3 2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/>',
  religious: '<path d="M12 3v18M6 9h12"/>',
  friendly: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5v0M15 9.5v0"/>',
  // actions
  spark: '<path d="m12 3 1.6 5L19 9.6l-5.4 1.6L12 17l-1.6-5.8L5 9.6 10.4 8z"/><path d="M18.5 4.5v2.5M19.75 5.75h-2.5"/>',
  refresh: '<path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L21 8M21 4v4h-4M20.5 12a8.5 8.5 0 0 1-14.3 6.2L3 16m0 4v-4h4"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  pencil: '<path d="m4 20 1.2-4L16 5.2 18.8 8 8 18.8 4 20Z"/><path d="m13.5 7.5 3 3"/>',
  thumb_up: '<path d="M7.5 11v9H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7.5 11l3.6-6.4a1.8 1.8 0 0 1 3.2 1.6L13.5 10h5a1.8 1.8 0 0 1 1.8 2.1l-1 6A1.8 1.8 0 0 1 17.5 19.6H7.5"/>',
  thumb_down: '<path d="M16.5 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zM16.5 13l-3.6 6.4a1.8 1.8 0 0 1-3.2-1.6l1-3.8h-5a1.8 1.8 0 0 1-1.8-2.1l1-6A1.8 1.8 0 0 1 7.5 4.4H16.5"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  calendar_plus: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5"/>',
  scale: '<path d="M12 4v16M6 7h12M6.5 7 4 13a3 3 0 0 0 5 0L6.5 7Zm11 0L15 13a3 3 0 0 0 5 0l-2.5-6ZM8 20h8"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  arrow_left: '<path d="M11 5 4 12l7 7M4 12h16"/>',
  bolt: '<path d="M13 3 4 14h6l-1 7 9-11h-6z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 12.5h18"/>',
  quote: '<path d="M7 7H4v5h3l-1.5 4M16 7h-3v5h3l-1.5 4"/>',
  film: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9.5h18M3 14.5h18M8 4.5v15M16 4.5v15"/>',
};

function ic(name, cls = "w-4 h-4") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${ICONP[name] || ""}</svg>`;
}

/* Vertil wordmark — the "i" is an upward arrow */
function vword({ size = "22px", color = "#13312e", accent = "#0e9488", animate = false } = {}) {
  const i = animate
    ? `<span class="vi anim-launch"><span class="vi-trail anim-trail"></span><span class="vi-tip"></span><span class="vi-stem"></span></span>`
    : `<span class="vi"><span class="vi-tip"></span><span class="vi-stem"></span></span>`;
  return `<span class="vword" style="font-size:${size};--vi:${accent};color:${color}">Vert${i}l</span>`;
}
/* Vertil app mark — white arrow in a teal rounded square */
function vmark(px = 36) {
  return `<span class="rounded-xl bg-brand grid place-items-center shadow-sm" style="width:${px}px;height:${px}px">
    <span class="vi" style="font-size:${Math.round(px * 0.5)}px"><span class="vi-tip" style="border-bottom-color:#fff"></span><span class="vi-stem" style="background:#fff"></span></span></span>`;
}

const TOUR_STEPS = [
  { sel: null, title: "Welcome to Vertil", body: "Your Naija brand voice engine. Let me show you around in 30 seconds." },
  { sel: '[data-nav="studio"]', title: "Studio", body: "Generate on-brand Naija copy — captions, WhatsApp, ads, SMS — in Pidgin, Yoruba, Igbo, Hausa and more." },
  { sel: '[data-nav="brands"]', title: "Brands — your secret weapon", body: "Set up a brand voice once. It's injected into every generation, so the copy always sounds like YOU — not generic AI." },
  { sel: '[data-nav="calendar"]', title: "Content Calendar", body: "Plan a whole month of posts tuned to the Nigerian calendar — Detty December, salary cycles, holidays." },
  { sel: '[data-nav="rate"]', title: "Rate Advisor", body: "Never undercharge again — get realistic Naira rates for any gig, plus a script to quote clients with confidence." },
  { sel: '[data-nav="gigs"]', title: "Gig Diary", body: "Log every gig and what you made. Watch your earnings add up over time." },
  { sel: '[data-nav="pricing"]', title: "Your plan & usage", body: "Track your monthly usage here and upgrade anytime. That's it — you're all set." },
];

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || res.statusText); e.status = res.status; e.data = data; throw e; }
  return data;
}

async function boot() {
  state.config = await api("/api/config").catch(() => null);
  try {
    const me = await api("/api/me");
    state.user = me.user; state.usage = me.usage;
    await loadData();
    handleUpgradeReturn();
    render();
    maybeStartTour();
  } catch {
    renderAuth();
  }
  if (window.__hideSplash) window.__hideSplash();
}

async function loadData() {
  state.brands = await api("/api/brands");
  if (state.brands.length && !state.activeBrandId) state.activeBrandId = state.brands[0].id;
}

async function refreshUsage() {
  try { const me = await api("/api/me"); state.user = me.user; state.usage = me.usage; } catch {}
}

/* ============================== AUTH ================================= */

function renderAuth() {
  const login = state.authMode === "login";
  $("#app").innerHTML = `
  <div class="min-h-screen grid lg:grid-cols-2">
    <div class="hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-forest via-brand-dark to-brand relative overflow-hidden">
      <a href="/" class="flex items-center gap-2.5">${vword({ size: "22px", color: "#f4f7f6", accent: "#2dd4bf" })}</a>
      <div class="relative z-10">
        <h1 class="font-display font-extrabold text-4xl leading-tight">Content that sounds<br>like your brand.</h1>
        <p class="mt-4 text-white/85 max-w-sm leading-relaxed">Vertil helps Nigerian businesses and creators produce on-brand content in seconds — tuned to your audience, your market and your voice.</p>
        <ul class="mt-8 space-y-3 max-w-sm">
          <li class="flex items-center gap-3 text-sm text-white/90"><span class="w-5 h-5 rounded-full bg-brand-bright/20 text-brand-bright grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="w-3 h-3"><path d="M20 6 9 17l-5-5"/></svg></span> On-brand copy in every Nigerian voice</li>
          <li class="flex items-center gap-3 text-sm text-white/90"><span class="w-5 h-5 rounded-full bg-brand-bright/20 text-brand-bright grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="w-3 h-3"><path d="M20 6 9 17l-5-5"/></svg></span> Built for the local market — culture and Naira</li>
          <li class="flex items-center gap-3 text-sm text-white/90"><span class="w-5 h-5 rounded-full bg-brand-bright/20 text-brand-bright grid place-items-center shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="w-3 h-3"><path d="M20 6 9 17l-5-5"/></svg></span> From idea to finished content in seconds</li>
        </ul>
      </div>
      <p class="text-white/60 text-xs relative z-10">Built with Claude · the Nigerian brand voice engine</p>
      <div class="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-white/10"></div>
      <div class="absolute right-24 top-24 w-32 h-32 rounded-full bg-white/10"></div>
    </div>
    <div class="flex items-center justify-center p-6 sm:p-12">
      <div class="w-full max-w-sm">
        <div class="lg:hidden mb-8">${vword({ size: "22px" })}</div>
        <h2 class="font-display font-extrabold text-2xl">${login ? "Welcome back" : "Create your account"}</h2>
        <p class="text-sm text-muted mt-1">${login ? "Log in to keep creating." : "Create on-brand content in seconds."}</p>
        <form id="authForm" class="mt-6 space-y-3">
          ${login ? "" : `<div><label class="text-xs font-semibold text-muted">Name</label>
            <input name="name" placeholder="Your name" class="auth-input"/></div>`}
          <div><label class="text-xs font-semibold text-muted">Email</label>
            <input name="email" type="email" required placeholder="you@brand.com" class="auth-input"/></div>
          <div><label class="text-xs font-semibold text-muted">Password</label>
            <input name="password" type="password" required minlength="6" placeholder="At least 6 characters" class="auth-input"/></div>
          <p id="authErr" class="text-xs text-rose-500 hidden"></p>
          <button id="authBtn" type="submit" class="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm">
            ${login ? "Log in" : "Create account"}
          </button>
        </form>
        <p class="text-sm text-muted mt-5 text-center">
          ${login ? "New here?" : "Already have an account?"}
          <button id="authToggle" class="text-brand font-semibold hover:text-brand-dark">${login ? "Create an account" : "Log in"}</button>
        </p>
      </div>
    </div>
  </div>
  <style>.auth-input{width:100%;margin-top:.25rem;background:#fff;border:1px solid #eceef1;border-radius:.6rem;padding:.6rem .75rem;font-size:.9rem;outline:none}
  .auth-input:focus{border-color:#0b8457;box-shadow:0 0 0 3px rgba(11,132,87,.15)}</style>`;

  $("#authToggle").onclick = () => { state.authMode = login ? "signup" : "login"; renderAuth(); };
  $("#authForm").onsubmit = doAuth;
}

async function doAuth(e) {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const btn = $("#authBtn"), err = $("#authErr");
  btn.disabled = true; btn.textContent = "…"; err.classList.add("hidden");
  try {
    const path = state.authMode === "login" ? "/api/login" : "/api/signup";
    const d = await api(path, { method: "POST", body: JSON.stringify(fd) });
    state.user = d.user; state.usage = d.usage;
    await loadData();
    state.view = "studio";
    render();
    maybeStartTour();
  } catch (ex) {
    err.textContent = ex.message; err.classList.remove("hidden");
    btn.disabled = false; btn.textContent = state.authMode === "login" ? "Log in" : "Create account";
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  Object.assign(state, { user: null, brands: [], activeBrandId: null, cards: null, calendar: null });
  state.authMode = "login";
  renderAuth();
}

/* ============================== SHELL =============================== */

function render() {
  $("#app").innerHTML = `
    <div class="flex min-h-screen">
      ${sidebar()}
      <div class="flex-1 min-w-0 flex flex-col">
        ${topbar()}
        <main class="flex-1 px-5 sm:px-8 py-6 max-w-[1180px] w-full mx-auto">${routeView()}</main>
      </div>
    </div>
    <div id="toast" class="fixed bottom-5 right-5 z-50 hidden"></div>`;
  wire();
}

function routeView() {
  switch (state.view) {
    case "studio": return studioView();
    case "calendar": return calendarView();
    case "calendars": return savedCalendarsView();
    case "brands": return state.editing !== null ? brandForm() : brandsView();
    case "favorites": return favoritesView();
    case "history": return historyView();
    case "pricing": return pricingView();
    case "rate": return rateView();
    case "advisor": return brandAdvisorView();
    case "script": return scriptView();
    case "gigs": return gigsView();
    case "profile": return profileView();
    default: return studioView();
  }
}

function sidebar() {
  const item = (key, label) => {
    const on = state.view === key;
    return `<button data-nav="${key}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
      ${on ? "bg-brand-tint text-brand-dark" : "text-muted hover:bg-paper hover:text-ink"}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="w-[18px] h-[18px]">${ICON[key]}</svg>${label}</button>`;
  };
  return `
  <aside class="hidden md:flex w-[244px] shrink-0 flex-col bg-white border-r border-line px-3 py-5 sticky top-0 h-screen">
    <div class="flex items-center gap-2.5 px-2 mb-7">
      ${vmark(34)}
      <div>${vword({ size: "19px" })}
        <div class="text-[10px] font-mono uppercase tracking-wider text-faint leading-none mt-1">Voice engine</div></div>
    </div>
    <nav class="space-y-1">
      ${item("studio","Studio")}${item("script","Script Writer")}${item("calendar","Content Calendar")}${item("calendars","Saved Plans")}
      ${item("brands","Brands")}${item("favorites","Saved Copy")}${item("history","History")}
      <div class="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-faint">Advisors</div>
      ${item("rate","Rate Advisor")}${item("advisor","Brand Advisor")}${item("gigs","Gig Diary")}
    </nav>
    <div class="mt-auto space-y-2">
      ${usageCard()}
      <div class="flex items-center gap-2 px-2">
        <button data-nav="profile" class="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg hover:bg-paper p-1 -m-1 transition" title="Account">
          <div class="w-7 h-7 rounded-full bg-brand-tint text-brand-dark grid place-items-center text-xs font-bold shrink-0">${esc((state.user?.name||"U")[0].toUpperCase())}</div>
          <div class="min-w-0"><div class="text-xs font-semibold truncate">${esc(state.user?.name||"")}</div>
            <div class="text-[10px] text-faint truncate">${esc(state.user?.email||"")}</div></div>
        </button>
        <button data-logout title="Log out" class="text-faint hover:text-rose-500 shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button>
      </div>
    </div>
  </aside>
  <!-- mobile slide-in drawer (full nav) -->
  ${state.mobileNav ? `
  <div class="md:hidden">
    <div data-mclose class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"></div>
    <aside class="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[82%] bg-white border-r border-line px-3 py-5 flex flex-col overflow-y-auto scroll-thin fade-up">
      <div class="flex items-center justify-between px-2 mb-6">
        <div class="flex items-center gap-2.5">${vmark(32)}<div>${vword({ size: "18px" })}</div></div>
        <button data-mclose class="text-faint hover:text-ink p-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="w-5 h-5"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <nav class="space-y-1">
        ${item("studio","Studio")}${item("script","Script Writer")}${item("calendar","Content Calendar")}${item("calendars","Saved Plans")}
        ${item("brands","Brands")}${item("favorites","Saved Copy")}${item("history","History")}
        <div class="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-faint">Advisors</div>
        ${item("rate","Rate Advisor")}${item("advisor","Brand Advisor")}${item("gigs","Gig Diary")}
        ${item("pricing","Plans & Pricing")}
      </nav>
      <div class="mt-auto space-y-2 pt-5">
        ${usageCard()}
        <div class="flex items-center gap-2 px-2">
          <button data-nav="profile" class="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg hover:bg-paper p-1 -m-1 transition" title="Account">
            <div class="w-7 h-7 rounded-full bg-brand-tint text-brand-dark grid place-items-center text-xs font-bold shrink-0">${esc((state.user?.name||"U")[0].toUpperCase())}</div>
            <div class="min-w-0"><div class="text-xs font-semibold truncate">${esc(state.user?.name||"")}</div>
              <div class="text-[10px] text-faint truncate">${esc(state.user?.email||"")}</div></div>
          </button>
          <button data-logout title="Log out" class="text-faint hover:text-rose-500 shrink-0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button>
        </div>
      </div>
    </aside>
  </div>` : ""}`;
}

function usageCard() {
  const u = state.usage; if (!u) return "";
  const unlimited = u.limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((u.used / u.limit) * 100));
  const near = !unlimited && pct >= 80;
  return `
  <button data-nav="pricing" class="block w-full text-left bg-paper border border-line rounded-xl p-3 hover:border-brand/40 transition">
    <div class="flex items-center justify-between mb-1.5">
      <span class="text-[11px] font-bold uppercase tracking-wide ${u.plan==='free'?'text-muted':'text-brand-dark'}">${esc(u.plan_name)} plan</span>
      <span class="text-[10px] text-brand font-semibold">Upgrade →</span>
    </div>
    <div class="h-1.5 rounded-full bg-line overflow-hidden"><div class="h-full ${near?'bg-amber-500':'bg-brand'}" style="width:${unlimited?100:pct}%"></div></div>
    <div class="text-[10.5px] text-muted mt-1.5">${unlimited?'Unlimited generations':`${u.used} / ${u.limit} generations this month`}</div>
  </button>`;
}

function topbar() {
  const titles = {
    studio:["Studio","Generate on-brand Naija copy in seconds"],
    calendar:["Content Calendar","A month of posts, tuned to the Nigerian calendar"],
    calendars:["Saved Plans","Your generated content calendars"],
    brands:["Brands","Your brand voices — injected into every generation"],
    favorites:["Saved Copy","Your starred, ready-to-use copy"],
    history:["History","Everything you've generated"],
    pricing:["Plans & Pricing","Upgrade to unlock more"],
    rate:["Rate Advisor","Wetin to charge — realistic Naira pricing for your gigs"],
    advisor:["Brand Advisor","Build your personal brand and win the right brand deals"],
    gigs:["Gig Diary","Track every gig and what you made"],
    script:["Script Writer","Scene-by-scene short-video scripts built on trending formats"],
    profile:["Account","Manage your profile, plan and security"],
  };
  const [t,sub] = titles[state.view] || titles.studio;
  return `
  <header class="bg-white/80 backdrop-blur border-b border-line sticky top-0 z-20">
    <div class="px-5 sm:px-8 h-16 flex items-center max-w-[1180px] mx-auto w-full">
      <button data-mtoggle class="md:hidden mr-2 -ml-1 p-2 text-ink hover:text-brand" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="w-6 h-6"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <div><h1 class="font-display font-extrabold text-[19px] leading-none">${t}</h1>
        <p class="text-xs text-muted mt-1 hidden sm:block">${sub}</p></div>
      <div class="ml-auto relative">
        <button data-acct class="flex items-center gap-2.5 rounded-full hover:bg-paper pl-2.5 pr-1.5 py-1 transition">
          <span class="hidden sm:block text-right leading-tight">
            <span class="block text-xs font-semibold text-ink max-w-[140px] truncate">${esc(state.user?.name||"")}</span>
            <span class="block text-[10px] text-faint">${esc(state.usage?.plan_name||"")} plan</span></span>
          <span class="w-8 h-8 rounded-full bg-brand-tint text-brand-dark grid place-items-center text-xs font-bold">${esc((state.user?.name||"U")[0].toUpperCase())}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5 text-faint hidden sm:block"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        ${state.acctMenu ? `
        <div data-acctclose class="fixed inset-0 z-30"></div>
        <div class="absolute right-0 mt-2 w-56 bg-white border border-line rounded-xl2 shadow-lift z-40 p-1.5 fade-up">
          <div class="px-3 py-2">
            <div class="text-sm font-semibold truncate">${esc(state.user?.name||"")}</div>
            <div class="text-[11px] text-faint truncate">${esc(state.user?.email||"")}</div></div>
          <div class="h-px bg-line my-1"></div>
          <button data-nav="profile" class="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm hover:bg-paper"><span class="text-faint">${ic("settings","w-4 h-4")}</span> Account</button>
          <button data-nav="pricing" class="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm hover:bg-paper"><span class="text-faint">${ic("scale","w-4 h-4")}</span> Plan &amp; usage</button>
          <div class="h-px bg-line my-1"></div>
          <button data-logout class="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm text-rose-500 hover:bg-paper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg> Log out</button>
        </div>` : ""}
      </div>
    </div>
  </header>`;
}

/* ============================== STUDIO ============================== */

function studioView() {
  return `
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-6 pb-10 md:pb-0">
    <section class="space-y-4 min-w-0">
      ${brandPicker()}
      ${card(`<span class="text-[13px] font-semibold">Tone &amp; language</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">${state.config.tones.map(toneChip).join("")}</div>`)}
      ${card(`<span class="text-[13px] font-semibold">Content type</span>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">${state.config.content_types.map(ctChip).join("")}</div>`)}
      ${card(`<span class="text-[13px] font-semibold">The brief</span>
        <textarea id="brief" rows="3" placeholder="e.g. Black Friday: 30% off all Ankara gowns, free Lagos delivery this weekend"
          class="w-full mt-2 bg-paper border border-line rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">${esc(state.brief)}</textarea>
        <div class="flex items-center gap-3 mt-3">
          <span class="text-xs text-muted">Options</span>
          <div class="flex gap-1.5">${[1,2,3,4].map(n=>`<button data-var="${n}" class="w-9 h-9 rounded-lg text-sm font-semibold transition ${state.variants===n?'bg-brand text-white shadow-sm':'bg-paper text-muted hover:bg-line'}">${n}</button>`).join("")}</div>
          <button id="genBtn" ${state.generating?'disabled':''} class="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm disabled:opacity-50">
            ${state.generating?'<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Generating…':ic("spark","w-4 h-4")+' Generate'}</button>
        </div>`)}
    </section>
    <section class="min-w-0">${outputPanel()}</section>
  </div>`;
}

function card(inner) { return `<div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">${inner}</div>`; }

function brandPicker() {
  if (!state.brands.length) return card(`<div class="text-center py-2">
    <p class="text-sm font-semibold">No brand yet</p>
    <p class="text-xs text-muted mt-1 mb-3">A brand profile makes every piece sound like <em>you</em>.</p>
    <button data-nav="brands" class="text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-lg">+ Create brand</button></div>`);
  const active = state.brands.find(b => b.id === state.activeBrandId);
  return card(`<div class="flex items-center justify-between mb-2">
      <span class="text-[13px] font-semibold">Brand voice</span>
      <button data-nav="brands" class="text-xs font-medium text-brand hover:text-brand-dark">Manage</button></div>
    <select id="brandSelect" class="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
      ${state.brands.map(b=>`<option value="${b.id}" ${b.id===state.activeBrandId?'selected':''}>${esc(b.name)}</option>`).join("")}</select>
    ${active&&(active.industry||active.audience)?`<p class="text-xs text-muted mt-2">${esc([active.industry,active.audience].filter(Boolean).join(" · "))}</p>`:""}`);
}

function toneChip(t) {
  const on = state.tone === t.key;
  return `<button data-tone="${t.key}" title="${esc(t.blurb)}" class="selectable flex items-start gap-2.5 text-left px-3 py-2.5 rounded-lg border ${on?'border-brand bg-brand-tint ring-1 ring-brand':'border-line bg-paper hover:border-brand/40'}">
    <span class="mt-0.5 shrink-0 ${on?'text-brand':'text-faint'}">${ic(t.key, "w-[18px] h-[18px]")}</span>
    <span class="min-w-0"><span class="block text-[13px] font-bold leading-tight">${esc(t.label)}</span>
      <span class="block text-[10.5px] text-muted leading-tight mt-0.5">${esc(t.blurb)}</span></span></button>`;
}
function ctChip(c) {
  const on = state.contentType === c.key;
  return `<button data-ct="${c.key}" class="selectable flex flex-col items-center justify-start gap-1.5 px-2 py-2.5 rounded-lg border text-center ${on?'border-brand bg-brand-tint ring-1 ring-brand text-brand':'border-line bg-paper hover:border-brand/40 text-faint'}">
    ${ic(c.key, "w-5 h-5")}<span class="text-[10.5px] font-semibold leading-tight text-ink">${esc(c.label)}</span></button>`;
}

function outputPanel() {
  return `<div class="bg-white border border-line rounded-xl2 shadow-card min-h-[64vh] flex flex-col">
    <div class="px-5 py-3.5 border-b border-line flex items-center gap-2">
      <span class="text-sm font-semibold">Output</span>
      <span id="streamDot" class="hidden text-brand text-[10px] typing"><span>●</span><span>●</span><span>●</span></span>
      <span class="ml-auto text-[11px] text-faint">${state.config.live?'Live · '+state.config.model:'Demo'}</span></div>
    <div id="output" class="p-5 flex-1 overflow-y-auto scroll-thin space-y-3">${state.cards?'':emptyOutput()}</div></div>`;
}
function emptyOutput() {
  return `<div class="h-full grid place-items-center text-center py-16"><div class="max-w-xs">
    <div class="w-12 h-12 mx-auto rounded-xl2 bg-brand-tint text-brand grid place-items-center mb-3">${ic("spark","w-6 h-6")}</div>
    <p class="font-display font-bold text-lg">Ready when you are</p>
    <p class="text-sm text-muted mt-1">Pick a tone and content type, drop your brief, and hit Generate.</p></div></div>`;
}

/* ============================ CALENDAR ============================= */

function calendarView() {
  if (!state.usage?.calendar) return calendarLocked();
  return `
  <div class="space-y-5 pb-24 md:pb-0">
    ${card(`<div class="grid sm:grid-cols-[1.4fr_1fr_.8fr_1.2fr_auto] gap-3 items-end">
      <label class="block"><span class="text-xs font-semibold text-muted">Brand</span>
        ${state.brands.length?`<select id="calBrand" class="calsel">${state.brands.map(b=>`<option value="${b.id}" ${b.id===state.activeBrandId?'selected':''}>${esc(b.name)}</option>`).join("")}</select>`:`<div class="mt-1 text-xs text-muted py-2.5">No brand — <button data-nav="brands" class="text-brand font-semibold">create one</button> (optional)</div>`}</label>
      <label class="block"><span class="text-xs font-semibold text-muted">Month</span>
        <select id="calMonth" class="calsel">${MONTHS.map(m=>`<option ${m===state.calMonth?'selected':''}>${m}</option>`).join("")}</select></label>
      <label class="block"><span class="text-xs font-semibold text-muted">Year</span>
        <input id="calYear" value="${state.calYear}" inputmode="numeric" class="calsel"/></label>
      <label class="block"><span class="text-xs font-semibold text-muted">Cadence</span>
        <select id="calCadence" class="calsel">${state.config.cadences.map(c=>`<option value="${c.key}" ${c.key===state.calCadence?'selected':''}>${esc(c.label)}</option>`).join("")}</select></label>
      <button id="calBtn" ${state.calBuilding?'disabled':''} class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm disabled:opacity-50">
        ${state.calBuilding?'<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Planning…':ic("calendar_plus","w-4 h-4")+' Build plan'}</button></div>
      <style>.calsel{width:100%;margin-top:.25rem;background:#f5f6f8;border:1px solid #eceef1;border-radius:.6rem;padding:.6rem .75rem;font-size:.85rem;outline:none}.calsel:focus{border-color:#0b8457;box-shadow:0 0 0 3px rgba(11,132,87,.15)}</style>`)}
    <div id="calArea">${state.calBuilding?calLoading():(state.calendar?calendarResult(state.calendar):calEmpty())}</div>
  </div>`;
}
function calendarLocked() {
  return card(`<div class="text-center py-14"><div class="w-12 h-12 mx-auto rounded-xl2 bg-paper text-faint grid place-items-center mb-3">${ic("lock","w-6 h-6")}</div>
    <p class="font-display font-bold text-lg">Content Calendar is a Growth feature</p>
    <p class="text-sm text-muted mt-1 max-w-md mx-auto">Plan a whole month of posts tuned to the Naija calendar — Detty December, salary cycles, holidays. Upgrade to unlock it.</p>
    <button data-nav="pricing" class="mt-4 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-5 py-2.5 rounded-xl">See plans</button></div>`);
}
function calEmpty() {
  return card(`<div class="text-center py-14"><div class="w-12 h-12 mx-auto rounded-xl2 bg-brand-tint text-brand grid place-items-center mb-3">${ic("calendar_plus","w-6 h-6")}</div>
    <p class="font-display font-bold text-lg">Plan a month in one click</p>
    <p class="text-sm text-muted mt-1 max-w-md mx-auto">Vertil builds a full content calendar tuned to that month in Nigeria. Each idea is one click from finished copy.</p></div>`);
}
function calLoading() {
  return card(`<div class="text-center py-16"><div class="w-9 h-9 mx-auto border-[3px] border-brand/25 border-t-brand rounded-full spin"></div>
    <p class="text-sm font-semibold mt-4">Building your ${esc(state.calMonth)} plan…</p><p class="text-xs text-muted mt-1">Mapping posts to Naija cultural moments</p></div>`);
}
function calendarResult(cal) {
  const posts = cal.posts || [], abbr = MONTH_ABBR[cal.month] || (cal.month||"").slice(0,3);
  return `<div class="fade-up space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div><h2 class="font-display font-extrabold text-xl">${esc(cal.month)} ${esc(String(cal.year))}</h2>
        <p class="text-xs text-muted">${posts.length} posts${cal.brand_name?` · ${esc(cal.brand_name)}`:''} · click any card to write the post</p></div>
      <button data-cal-new class="text-sm font-medium text-muted hover:text-ink border border-line bg-white rounded-lg px-3 py-1.5">↺ New plan</button></div>
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${posts.map((p,i)=>calPostCard(p,i,abbr)).join("")}</div></div>`;
}
function calPostCard(p,i,abbr) {
  const tone=(state.config.tones.find(t=>t.key===p.tone))||{emoji:"",label:p.tone};
  const ct=(state.config.content_types.find(c=>c.key===p.content_type))||{emoji:"",label:p.content_type};
  return `<div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 flex flex-col gap-2.5 transition">
    <div class="flex items-center gap-2"><span class="shrink-0 w-12 h-12 rounded-lg bg-brand-tint text-brand-dark grid place-items-center leading-none">
      <span class="text-[10px] font-semibold -mb-0.5">${esc(abbr)}</span><span class="text-lg font-extrabold">${p.day}</span></span>
      ${p.occasion?`<span class="text-[11px] font-medium text-gold bg-gold-tint border border-gold/20 rounded-full px-2 py-1 leading-tight">${esc(p.occasion)}</span>`:''}</div>
    <p class="text-sm font-semibold leading-snug">${esc(p.theme)}</p>
    ${p.hook?`<p class="text-[13px] text-muted italic leading-snug">“${esc(p.hook)}”</p>`:''}
    <div class="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
      <span class="inline-flex items-center gap-1 text-[11px] bg-paper border border-line rounded-md px-1.5 py-0.5">${ic(ct.key||p.content_type,"w-3 h-3")} ${esc(ct.label)}</span>
      <span class="text-[11px] bg-paper border border-line rounded-md px-1.5 py-0.5">${esc(tone.label)}</span></div>
    <button data-write="${i}" class="mt-1 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white transition rounded-lg py-2">${ic("pencil","w-4 h-4")} Write this post</button></div>`;
}

function savedCalendarsView() {
  const items = state.savedCalendars.map(c=>`
    <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 flex items-center gap-3 transition">
      <div class="w-11 h-11 rounded-lg bg-brand-tint text-brand-dark grid place-items-center font-extrabold">${esc((MONTH_ABBR[c.month]||c.month||'').slice(0,3))}</div>
      <div class="min-w-0 flex-1"><div class="font-semibold text-sm">${esc(c.month)} ${esc(String(c.year))}</div>
        <div class="text-xs text-muted">${esc(c.brand_name||'No brand')} · ${esc((state.config.cadences.find(x=>x.key===c.cadence)||{label:c.cadence}).label)}</div></div>
      <button data-open-cal="${c.id}" class="text-xs font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white rounded-lg px-3 py-1.5">Open</button>
      <button data-del-cal="${c.id}" class="text-xs text-rose-500 border border-line rounded-lg px-2.5 py-1.5 hover:border-rose-300">Delete</button></div>`).join("");
  return `<div class="max-w-3xl space-y-3 pb-24 md:pb-0">${items||`<p class="text-sm text-muted">No saved plans yet — build one in the Content Calendar.</p>`}</div>`;
}

/* ============================== BRANDS ============================= */

function brandsView() {
  const cards = state.brands.map(b=>`
    <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
      <div class="flex items-start justify-between gap-3"><div class="min-w-0">
        <div class="font-display font-bold truncate">${esc(b.name)}</div>
        <div class="text-xs text-muted mt-0.5">${esc(b.industry||"—")}${b.location?` · ${esc(b.location)}`:''}</div></div>
        <div class="flex gap-1.5 shrink-0">
          <button data-edit="${b.id}" class="text-xs px-2.5 py-1 rounded-lg border border-line hover:border-brand/40">Edit</button>
          <button data-del="${b.id}" class="text-xs px-2.5 py-1 rounded-lg border border-line text-rose-500 hover:border-rose-300">Delete</button></div></div>
      ${b.audience?`<p class="text-xs text-muted mt-2"><span class="text-faint">Audience:</span> ${esc(b.audience)}</p>`:''}
      ${b.personality?`<p class="text-xs text-muted mt-1"><span class="text-faint">Voice:</span> ${esc(b.personality)}</p>`:''}</div>`).join("");
  const limit = state.usage?.brands_limit, atLimit = limit != null && state.brands.length >= limit;
  return `<div class="max-w-3xl pb-24 md:pb-0">
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-muted">Each profile is injected into every generation. ${limit?`<span class="text-faint">(${state.brands.length}/${limit})</span>`:''}</p>
      <button data-new ${atLimit?'data-locked':''} class="shrink-0 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-lg shadow-sm">+ New brand</button></div>
    <div class="grid sm:grid-cols-2 gap-3">${cards||`<p class="text-sm text-muted">No brands yet — create your first.</p>`}</div></div>`;
}

function brandForm() {
  const b = state.editing || {}, f = k => esc(b[k]||"");
  const isNew = !b.id, mode = state.brandMode;
  const field = (k,label,ph,area=false) => area
    ? `<label class="block"><span class="text-xs font-semibold text-muted">${label}</span><textarea name="${k}" rows="3" placeholder="${ph}" class="bfi">${f(k)}</textarea></label>`
    : `<label class="block"><span class="text-xs font-semibold text-muted">${label}</span><input name="${k}" value="${f(k)}" placeholder="${ph}" class="bfi"/></label>`;
  return `<div class="max-w-2xl pb-24 md:pb-0">
    <button data-cancel class="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3">${ic("arrow_left","w-3.5 h-3.5")} Back to brands</button>
    <h2 class="font-display font-extrabold text-xl mb-1">${isNew?"New brand":"Edit brand"}</h2>
    ${isNew?`<div class="inline-flex bg-paper border border-line rounded-lg p-0.5 mt-2 mb-4 text-sm">
      <button data-mode="form" class="px-3 py-1.5 rounded-md ${mode==='form'?'bg-white shadow-sm font-semibold':'text-muted'}">Fill a form</button>
      <button data-mode="posts" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ${mode==='posts'?'bg-white shadow-sm font-semibold':'text-muted'}">${ic("spark","w-3.5 h-3.5")} Learn from my posts</button></div>`:'<p class="text-sm text-muted mb-4">The more you fill in, the more the copy sounds like you.</p>'}
    ${isNew&&mode==='posts'?`
      <div class="bg-white border border-line rounded-xl2 shadow-card p-5">
        <p class="text-sm text-muted mb-2">Paste 2–4 of your best posts/captions. Vertil will read your voice and auto-fill the profile — you review, then save.</p>
        <textarea id="learnSamples" rows="6" placeholder="Paste your existing captions, ads, or product descriptions here…" class="bfi"></textarea>
        <button id="learnBtn" class="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark">
          ${state.extracting?'<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Reading your voice…':ic("spark","w-4 h-4")+' Build profile from posts'}</button>
      </div>`:`
      <form id="brandForm" class="space-y-3.5 bg-white border border-line rounded-xl2 shadow-card p-5">
        ${field("name","Brand name *","e.g. Surulere Threads")}
        <div class="grid sm:grid-cols-2 gap-3">${field("industry","Industry","Fashion, fintech, food…")}${field("location","Customer location","Lagos, Aba, nationwide…")}</div>
        ${field("audience","Target customer","e.g. women 22-35, mid-income, love Owambe")}
        ${field("personality","Voice / personality keywords","playful, bold, street, premium…")}
        ${field("description","What you sell / do","Affordable ready-to-wear Ankara…",true)}
        ${field("samples","Paste 1-3 samples of content you like","Drop captions/ads written in your voice…",true)}
        <div class="flex gap-2 pt-1">
          <button type="submit" class="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm">${isNew?"Create brand":"Save changes"}</button>
          <button type="button" data-cancel class="px-4 py-2.5 rounded-xl text-sm border border-line hover:bg-paper">Cancel</button></div>
      </form>`}
    <style>.bfi{width:100%;margin-top:.25rem;background:#f5f6f8;border:1px solid #eceef1;border-radius:.6rem;padding:.6rem .75rem;font-size:.875rem;outline:none}.bfi:focus{border-color:#0b8457;box-shadow:0 0 0 3px rgba(11,132,87,.15)}</style>
  </div>`;
}

/* ============================ FAVORITES ============================ */

function favoritesView() {
  const items = state.favorites.map(fav=>`
    <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
      <div class="flex items-center gap-2 text-xs text-muted mb-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-brand-tint text-brand-dark font-medium">${esc(fav.brand_name||"No brand")}</span>
        ${fav.content_type?`<span>${esc(label("content_types",fav.content_type))}</span>`:''}
        <button data-copy-fav="${fav.id}" class="ml-auto text-xs px-2.5 py-1 rounded-lg border border-line hover:border-brand/40">Copy</button>
        <button data-del-fav="${fav.id}" class="text-xs px-2.5 py-1 rounded-lg border border-line text-rose-500 hover:border-rose-300">Remove</button></div>
      <div class="text-sm whitespace-pre-wrap leading-relaxed">${esc(fav.text)}</div></div>`).join("");
  return `<div class="max-w-3xl space-y-3 pb-24 md:pb-0">${items||`<p class="text-sm text-muted">No saved copy yet — hit Save on any generated option.</p>`}</div>`;
}

/* ============================ HISTORY ============================== */

function historyView() {
  const items = state.history.map(g=>`
    <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
      <div class="flex items-center gap-2 text-xs text-muted mb-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-brand-tint text-brand-dark font-medium">${esc(g.brand_name||"No brand")}</span>
        <span>${esc(label("content_types",g.content_type))}</span><span>·</span><span>${esc(label("tones",g.tone))}</span></div>
      ${g.brief?`<p class="text-xs text-muted mb-2 italic">“${esc(g.brief)}”</p>`:''}
      <div class="space-y-2">${(g.variants||[]).map(v=>`<div class="text-sm bg-paper border border-line rounded-lg p-3 whitespace-pre-wrap">${esc(v)}</div>`).join("")}</div></div>`).join("");
  return `<div class="max-w-3xl space-y-3 pb-24 md:pb-0">${items||`<p class="text-sm text-muted">Nothing yet — generate something in the Studio.</p>`}</div>`;
}

/* ============================ PRICING ============================== */

function pricingView() {
  const cur = state.usage?.plan || "free";
  const cards = state.config.plans.map(p=>{
    const isCur = p.key===cur;
    const popular = p.popular;
    return `<div class="relative bg-white border ${popular?'border-brand ring-2 ring-brand/30':'border-line'} rounded-xl2 shadow-card p-5 flex flex-col">
      ${popular?`<span class="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide bg-brand text-white px-2.5 py-1 rounded-full">Most popular</span>`:''}
      <div class="text-sm font-bold ${popular?'text-brand-dark':''}">${esc(p.name)}</div>
      <div class="text-xs text-muted">${esc(p.blurb)}</div>
      <div class="mt-3 mb-1"><span class="font-display font-extrabold text-3xl">${p.price?'₦'+p.price.toLocaleString():'Free'}</span>${p.price?'<span class="text-xs text-muted">/mo</span>':''}</div>
      <ul class="mt-3 space-y-1.5 text-sm flex-1">${p.features.map(f=>`<li class="flex gap-2"><span class="text-brand">✓</span><span class="text-ink/80">${esc(f)}</span></li>`).join("")}</ul>
      <button data-plan="${p.key}" ${isCur?'disabled':''} class="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition ${isCur?'bg-paper text-muted cursor-default':popular?'bg-brand text-white hover:bg-brand-dark':'border border-brand text-brand-dark hover:bg-brand-tint'}">
        ${isCur?'Current plan':(p.price?'Upgrade':'Downgrade')}</button></div>`;
  }).join("");
  return `<div class="pb-24 md:pb-0">
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">${cards}</div>
    <p class="text-xs text-muted text-center mt-5">${state.config.paystack?'Secure checkout via Paystack — card, bank transfer, USSD.':'⚙️ Paystack not configured — choosing a plan will simulate the upgrade so you can test limits.'}</p>
  </div>`;
}

/* ============================= ACCOUNT ============================= */

function profileView() {
  const u = state.user || {}, us = state.usage || {};
  const joined = u.created_at ? new Date(u.created_at * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";
  const unlimited = us.limit == null;
  const pct = unlimited ? 100 : Math.min(100, Math.round(((us.used || 0) / (us.limit || 1)) * 100));
  return `<div class="max-w-2xl space-y-4 pb-24 md:pb-0">
    ${card(`<div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-full bg-brand-tint text-brand-dark grid place-items-center text-xl font-bold shrink-0">${esc((u.name||"U")[0].toUpperCase())}</div>
      <div class="min-w-0"><div class="font-display font-extrabold text-lg truncate">${esc(u.name||"")}</div>
        <div class="text-sm text-muted truncate">${esc(u.email||"")}</div></div>
      <span class="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${us.plan==='free'?'bg-paper text-muted':'bg-brand-tint text-brand-dark'}">${esc(us.plan_name||"")} plan</span>
    </div>`)}

    ${card(`<div class="text-[13px] font-semibold mb-3">Account details</div>
      <form id="profileForm" class="space-y-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Name</span>
          <input name="name" value="${esc(u.name||"")}" class="pfi"/></label>
        <label class="block"><span class="text-xs font-semibold text-muted">Email</span>
          <input value="${esc(u.email||"")}" disabled class="pfi opacity-60 cursor-not-allowed"/>
          <span class="text-[11px] text-faint">Email can't be changed.</span></label>
        <div class="text-xs text-muted">Member since ${joined}</div>
        <button type="submit" class="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm">Save changes</button>
      </form>`)}

    ${card(`<div class="flex items-center justify-between mb-3">
        <div class="text-[13px] font-semibold">Plan &amp; usage</div>
        <button data-nav="pricing" class="text-xs font-semibold text-brand hover:text-brand-dark">Manage plan →</button></div>
      <div class="h-2 rounded-full bg-line overflow-hidden"><div class="h-full bg-brand" style="width:${pct}%"></div></div>
      <div class="text-xs text-muted mt-2">${unlimited?'Unlimited generations':`${us.used||0} / ${us.limit} generations this month`} · ${esc(us.plan_name||"")} plan</div>`)}

    ${card(`<div class="text-[13px] font-semibold mb-3">Change password</div>
      <form id="pwForm" class="space-y-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Current password</span><input name="current" type="password" required class="pfi"/></label>
        <label class="block"><span class="text-xs font-semibold text-muted">New password</span><input name="new" type="password" required minlength="6" placeholder="At least 6 characters" class="pfi"/></label>
        <p id="pwErr" class="text-xs text-rose-500 hidden"></p>
        <button type="submit" class="px-5 py-2.5 rounded-xl font-semibold text-sm border border-line hover:bg-paper">Update password</button>
      </form>`)}

    ${card(`<div class="flex items-center justify-between gap-3">
        <div><div class="text-[13px] font-semibold">Sign out</div><div class="text-xs text-muted">End your session on this device.</div></div>
        <button data-logout class="shrink-0 text-sm font-semibold text-rose-500 border border-line rounded-xl px-4 py-2 hover:border-rose-300">Log out</button></div>`)}
    <style>.pfi{width:100%;margin-top:.25rem;background:#f4f7f6;border:1px solid #e2e8e6;border-radius:.6rem;padding:.6rem .75rem;font-size:.875rem;color:#13312e;outline:none}.pfi:focus{border-color:#0e9488;box-shadow:0 0 0 3px rgba(14,148,136,.15)}</style>
  </div>`;
}

async function saveProfile(e) {
  e.preventDefault();
  const name = (new FormData(e.target).get("name") || "").trim();
  if (!name) return toast("Name can't be empty");
  try {
    const d = await api("/api/me", { method: "PUT", body: JSON.stringify({ name }) });
    state.user = d.user; state.usage = d.usage;
    toast("Profile updated"); render();
  } catch (ex) { handleErr(ex); }
}

async function changePassword(e) {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const err = $("#pwErr");
  try {
    await api("/api/account/password", { method: "POST", body: JSON.stringify(fd) });
    toast("Password updated"); e.target.reset();
    if (err) err.classList.add("hidden");
  } catch (ex) { if (err) { err.textContent = ex.message; err.classList.remove("hidden"); } }
}

/* ============================== ADVISORS =========================== */

const ADVI_STYLE = `<style>.advi{width:100%;margin-top:.25rem;background:#f5f6f8;border:1px solid #eceef1;border-radius:.6rem;padding:.6rem .75rem;font-size:.875rem;outline:none}.advi:focus{border-color:#0b8457;box-shadow:0 0 0 3px rgba(11,132,87,.15)}</style>`;

function advisorLoading(msg) {
  return card(`<div class="text-center py-12"><div class="w-9 h-9 mx-auto border-[3px] border-brand/25 border-t-brand rounded-full spin"></div><p class="text-sm font-semibold mt-4">${esc(msg)}</p></div>`);
}

function rateView() {
  const o = state.config.advisor_options, ri = state.rateInputs;
  const sel = (id, key, opts) => `<select id="${id}" class="advi">${["",...opts].map(e=>`<option ${e===ri[key]?'selected':''} value="${esc(e)}">${e||'Select…'}</option>`).join("")}</select>`;
  return `<div class="max-w-3xl pb-24 md:pb-0 space-y-5">
    ${card(`<div class="space-y-3.5">
      <label class="block"><span class="text-xs font-semibold text-muted">Service / gig *</span>
        <input id="r_service" list="gigcats" value="${esc(ri.service)}" placeholder="e.g. Social media management" class="advi"/>
        <datalist id="gigcats">${o.gig_categories.map(g=>`<option value="${esc(g)}">`).join("")}</datalist></label>
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Experience</span>${sel("r_experience","experience",o.experience_levels)}</label>
        <label class="block"><span class="text-xs font-semibold text-muted">Client type</span>${sel("r_client_type","client_type",o.client_types)}</label></div>
      <label class="block"><span class="text-xs font-semibold text-muted">Location</span>
        <input id="r_location" value="${esc(ri.location)}" placeholder="Lagos, Abuja, remote…" class="advi"/></label>
      <label class="block"><span class="text-xs font-semibold text-muted">Scope / deliverables (optional)</span>
        <textarea id="r_scope" rows="3" placeholder="e.g. 12 posts/month, 3 reels, community management, monthly report" class="advi">${esc(ri.scope)}</textarea></label>
      <button id="rateBtn" ${state.rateLoading?'disabled':''} class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm disabled:opacity-50">
        ${state.rateLoading?'<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Working it out…':ic("scale","w-4 h-4")+' What should I charge?'}</button>
      </div>${ADVI_STYLE}`)}
    <div id="rateResult">${state.rateLoading?advisorLoading('Calculating a fair Naija rate…'):(state.rateResult?renderRateResult(state.rateResult):'')}</div>
  </div>`;
}

function renderRateResult(r) {
  const rc = r.recommended, fmt = n => '₦' + (n||0).toLocaleString();
  return `<div class="fade-up space-y-4">
    ${card(`<div class="text-center py-2">
      <div class="text-xs font-semibold uppercase tracking-wide text-muted">Recommended rate · ${esc(rc.unit)}</div>
      <div class="font-display font-extrabold text-3xl sm:text-4xl mt-2 text-brand-dark">${fmt(rc.low)} – ${fmt(rc.high)}</div>
      <div class="text-sm text-muted mt-1">Sweet spot: <b class="text-ink">${fmt(rc.mid)}</b></div>
      ${r.summary?`<p class="text-sm mt-3 max-w-lg mx-auto">${esc(r.summary)}</p>`:''}</div>`)}
    ${r.factors.length?card(`<div class="text-[13px] font-semibold mb-2">Why this range</div><ul class="space-y-1.5">${r.factors.map(f=>`<li class="flex gap-2 text-sm"><span class="text-brand">•</span><span class="text-ink/85">${esc(f)}</span></li>`).join("")}</ul>`):''}
    ${r.pitch?card(`<div class="flex items-center gap-1.5 text-[13px] font-semibold mb-2">${ic("quote","w-4 h-4 text-brand")} What to tell the client</div><div class="text-sm bg-brand-tint border border-brand/20 rounded-lg p-3 leading-relaxed">${esc(r.pitch)}</div>`):''}
    ${r.tips.length?card(`<div class="text-[13px] font-semibold mb-2">Pricing tips</div><ul class="space-y-1.5">${r.tips.map(t=>`<li class="flex gap-2 text-sm"><span class="text-brand">✓</span><span class="text-ink/85">${esc(t)}</span></li>`).join("")}</ul>`):''}
    ${r.upsells.length?card(`<div class="text-[13px] font-semibold mb-2">Charge more with…</div><div class="flex flex-wrap gap-2">${r.upsells.map(u=>`<span class="text-xs bg-paper border border-line rounded-full px-3 py-1.5">${esc(u)}</span>`).join("")}</div>`):''}
  </div>`;
}

function brandAdvisorView() {
  const o = state.config.advisor_options, bi = state.brandInputs;
  const chip = (group, val) => `<button data-chiptoggle="${esc(val)}" data-group="${group}" class="selectable text-xs px-3 py-1.5 rounded-full border ${bi[group].includes(val)?'border-brand bg-brand-tint text-brand-dark ring-1 ring-brand':'border-line bg-paper hover:border-brand/40'}">${esc(val)}</button>`;
  return `<div class="max-w-3xl pb-24 md:pb-0 space-y-5">
    ${card(`<div class="space-y-3.5">
      <label class="block"><span class="text-xs font-semibold text-muted">Your interests / niche *</span>
        <textarea id="b_interests" rows="2" placeholder="e.g. personal finance for young Nigerians, skincare, gadget reviews, fitness…" class="advi">${esc(bi.interests)}</textarea></label>
      <div><span class="text-xs font-semibold text-muted">Content you want to create</span>
        <div class="flex flex-wrap gap-2 mt-2">${o.content_formats.map(f=>chip('formats',f)).join("")}</div></div>
      <div><span class="text-xs font-semibold text-muted">Brands you want to work with</span>
        <div class="flex flex-wrap gap-2 mt-2">${o.brand_types.map(b=>chip('brand_types',b)).join("")}</div></div>
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Platform / audience (optional)</span>
          <input id="b_platform" value="${esc(bi.platform)}" placeholder="e.g. Instagram, 2k followers" class="advi"/></label>
        <label class="block"><span class="text-xs font-semibold text-muted">Your goal (optional)</span>
          <input id="b_goal" value="${esc(bi.goal)}" placeholder="e.g. land brand deals, grow to 10k" class="advi"/></label></div>
      <button id="brandBtn" ${state.brandLoading?'disabled':''} class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm disabled:opacity-50">
        ${state.brandLoading?'<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Building strategy…':ic("target","w-4 h-4")+' Build my brand strategy'}</button>
      </div>${ADVI_STYLE}`)}
    <div id="brandResult">${state.brandLoading?advisorLoading('Designing your personal brand…'):(state.brandResult?renderBrandResult(state.brandResult):'')}</div>
  </div>`;
}

function renderBrandResult(b) {
  return `<div class="fade-up space-y-4">
    ${card(`${b.tagline?`<div class="font-display font-extrabold text-2xl text-brand-dark">“${esc(b.tagline)}”</div>`:''}
      ${b.niche?`<span class="inline-block mt-2 text-xs font-medium bg-brand-tint text-brand-dark rounded-full px-3 py-1">${esc(b.niche)}</span>`:''}
      ${b.positioning?`<p class="text-sm leading-relaxed mt-3 text-ink/85">${esc(b.positioning)}</p>`:''}
      ${b.voice?`<p class="text-xs text-muted mt-3"><span class="font-semibold text-ink">Your voice:</span> ${esc(b.voice)}</p>`:''}`)}
    ${b.content_pillars.length?`<div><div class="text-[13px] font-semibold mb-2 px-1">Content pillars</div>
      <div class="grid sm:grid-cols-2 gap-3">${b.content_pillars.map((p,i)=>`
        <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
          <div class="flex items-center gap-2"><span class="w-6 h-6 rounded-md bg-brand-tint text-brand-dark grid place-items-center text-xs font-bold">${i+1}</span><span class="font-semibold text-sm">${esc(p.name)}</span></div>
          ${p.description?`<p class="text-xs text-muted mt-1.5">${esc(p.description)}</p>`:''}
          ${p.ideas.length?`<ul class="mt-2 space-y-1">${p.ideas.map(x=>`<li class="text-xs flex gap-1.5"><span class="text-brand">›</span>${esc(x)}</li>`).join("")}</ul>`:''}
        </div>`).join("")}</div></div>`:''}
    ${b.target_brands.length?`<div><div class="text-[13px] font-semibold mb-2 px-1">Brands to target</div>
      <div class="space-y-2">${b.target_brands.map(t=>`
        <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
          <div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-sm">${esc(t.type)}</span>${t.examples?`<span class="text-xs text-muted">${esc(t.examples)}</span>`:''}</div>
          ${t.why?`<p class="text-xs text-muted mt-1">${esc(t.why)}</p>`:''}
          ${t.pitch?`<p class="text-xs mt-2 bg-paper border border-line rounded-lg p-2.5"><span class="font-semibold">Pitch:</span> ${esc(t.pitch)}</p>`:''}
        </div>`).join("")}</div></div>`:''}
    ${b.bio_options.length?card(`<div class="text-[13px] font-semibold mb-2">Bio options</div><div class="space-y-2">${b.bio_options.map((x,i)=>`<div class="flex items-start gap-2 text-sm bg-paper border border-line rounded-lg p-2.5"><span class="flex-1">${esc(x)}</span><button data-copybio="${i}" class="text-xs text-brand shrink-0 font-semibold">Copy</button></div>`).join("")}</div>`):''}
    ${b.next_steps.length?card(`<div class="text-[13px] font-semibold mb-2">Next 30 days</div><ul class="space-y-1.5">${b.next_steps.map(s=>`<li class="flex gap-2 text-sm"><span class="text-brand">✓</span><span class="text-ink/85">${esc(s)}</span></li>`).join("")}</ul>`):''}
  </div>`;
}

async function runRate() {
  if (state.rateLoading) return;
  if (!state.rateInputs.service.trim()) return toast("Tell us the service first");
  state.rateLoading = true; render();
  try {
    const r = await api("/api/advisor/rate", { method:"POST", body:JSON.stringify(state.rateInputs) });
    state.rateResult = r; if (r.used!=null&&state.usage) state.usage.used = r.used;
  } catch (ex) { if (ex.data?.upgrade) { state.rateLoading=false; return openUpgrade(ex.message); } toast("⚠ "+ex.message); }
  finally { state.rateLoading = false; render(); }
}

async function runBrandAdvisor() {
  if (state.brandLoading) return;
  if (!state.brandInputs.interests.trim()) return toast("Tell us your interests / niche first");
  state.brandLoading = true; render();
  try {
    const r = await api("/api/advisor/brand", { method:"POST", body:JSON.stringify(state.brandInputs) });
    state.brandResult = r; if (r.used!=null&&state.usage) state.usage.used = r.used;
  } catch (ex) { if (ex.data?.upgrade) { state.brandLoading=false; return openUpgrade(ex.message); } toast("⚠ "+ex.message); }
  finally { state.brandLoading = false; render(); }
}

/* ========================== SCRIPT WRITER ========================= */

function scriptView() {
  const o = state.config.script_options, si = state.scriptInputs;
  const sel = (id, key, opts) => `<select id="${id}" class="advi">${opts.map(e=>`<option ${e===si[key]?'selected':''}>${esc(e)}</option>`).join("")}</select>`;
  const fmtDesc = (o.formats.find(f=>f.key===si.format) || {}).desc || "";
  return `<div class="max-w-3xl pb-10 md:pb-0 space-y-5">
    ${card(`<div class="space-y-3.5">
      <label class="block"><span class="text-xs font-semibold text-muted">Video idea / topic *</span>
        <textarea id="sc_idea" rows="2" placeholder="e.g. Why our jollof spice mix beats the rest — for busy Lagos mums" class="advi">${esc(si.idea)}</textarea></label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Platform</span>${sel("sc_platform","platform",o.platforms)}</label>
        <label class="block"><span class="text-xs font-semibold text-muted">Length</span>${sel("sc_length","length",o.lengths)}</label>
        <label class="block"><span class="text-xs font-semibold text-muted">Goal</span>${sel("sc_goal","goal",o.goals)}</label>
        <label class="block"><span class="text-xs font-semibold text-muted">Voice / tone</span>
          <select id="sc_tone" class="advi">${state.config.tones.map(t=>`<option value="${t.key}" ${t.key===si.tone?'selected':''}>${esc(t.label)}</option>`).join("")}</select></label>
      </div>
      <label class="block"><span class="text-xs font-semibold text-muted">Trending format</span>
        <select id="sc_format" class="advi">${o.formats.map(f=>`<option value="${f.key}" ${f.key===si.format?'selected':''}>${esc(f.label)}</option>`).join("")}</select>
        <span class="text-[11px] text-muted mt-1 block">${esc(fmtDesc)}</span></label>
      <button id="scriptBtn" ${state.scriptLoading?'disabled':''} class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm disabled:opacity-50">
        ${state.scriptLoading?'<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Writing…':ic("film","w-4 h-4")+' Write my script'}</button>
      </div>${ADVI_STYLE}`)}
    <div id="scriptResult">${state.scriptLoading?advisorLoading('Writing your script…'):(state.scriptResult?renderScriptResult(state.scriptResult):'')}</div>
  </div>`;
}

function renderScriptResult(s) {
  return `<div class="fade-up space-y-4">
    ${card(`<div class="flex items-center gap-2 flex-wrap mb-2">
        ${s.format?`<span class="text-[11px] font-semibold bg-brand-tint text-brand-dark rounded-full px-2.5 py-1">${esc(s.format)}</span>`:''}
        ${s.length?`<span class="text-[11px] bg-paper border border-line rounded-full px-2.5 py-1">${esc(s.length)}</span>`:''}</div>
      ${s.title?`<div class="font-display font-extrabold text-lg">${esc(s.title)}</div>`:''}
      ${s.hook?`<div class="mt-2 text-sm bg-brand-tint border border-brand/20 rounded-lg p-3"><span class="text-[10px] font-bold uppercase tracking-wide text-brand-dark block mb-1">Hook · first 3 seconds</span>${esc(s.hook)}</div>`:''}`)}
    ${s.scenes.length?`<div class="space-y-2.5">${s.scenes.map((sc,i)=>`
      <div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
        <div class="flex items-center gap-2 mb-2"><span class="w-6 h-6 rounded-md bg-brand text-white grid place-items-center text-xs font-bold">${i+1}</span><span class="text-xs font-mono text-muted">${esc(sc.label||'')}</span></div>
        ${sc.on_screen?`<p class="text-sm"><span class="text-[10px] font-bold uppercase tracking-wide text-faint mr-1">On screen</span>${esc(sc.on_screen)}</p>`:''}
        ${sc.voiceover?`<p class="text-sm mt-1.5"><span class="text-[10px] font-bold uppercase tracking-wide text-faint mr-1">Voiceover</span>${esc(sc.voiceover)}</p>`:''}
        ${sc.visual?`<p class="text-xs text-muted mt-1.5"><span class="text-[10px] font-bold uppercase tracking-wide text-faint mr-1">Visual</span>${esc(sc.visual)}</p>`:''}
      </div>`).join("")}</div>`:''}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${s.sound?card(`<div class="text-[12px] font-semibold mb-1">Trending sound</div><p class="text-sm text-ink/85">${esc(s.sound)}</p>`):''}
      ${s.cta?card(`<div class="text-[12px] font-semibold mb-1">Call to action</div><p class="text-sm text-ink/85">${esc(s.cta)}</p>`):''}
    </div>
    ${s.caption?card(`<div class="flex items-center justify-between mb-1"><div class="text-[12px] font-semibold">Caption</div><button data-copy-cap class="text-xs text-brand font-semibold">Copy</button></div>
      <p class="text-sm whitespace-pre-wrap">${esc(s.caption)}</p>
      ${s.hashtags.length?`<div class="flex flex-wrap gap-1.5 mt-2">${s.hashtags.map(h=>`<span class="text-[11px] bg-paper border border-line rounded-full px-2 py-0.5 text-brand-dark">${esc(h)}</span>`).join("")}</div>`:''}`):''}
    <button data-copy-script class="w-full text-sm font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white transition rounded-lg py-2.5">Copy full script</button>
  </div>`;
}

function scriptToText(s) {
  let t = (s.title ? s.title + "\n" : "") + (s.format ? `[${s.format}${s.length ? " · " + s.length : ""}]\n` : "");
  if (s.hook) t += `\nHOOK: ${s.hook}\n`;
  (s.scenes || []).forEach((sc, i) => {
    t += `\n${i + 1}. ${sc.label || ""}\n`;
    if (sc.on_screen) t += `   On screen: ${sc.on_screen}\n`;
    if (sc.voiceover) t += `   VO: ${sc.voiceover}\n`;
    if (sc.visual) t += `   Visual: ${sc.visual}\n`;
  });
  if (s.sound) t += `\nSound: ${s.sound}\n`;
  if (s.cta) t += `CTA: ${s.cta}\n`;
  if (s.caption) t += `\nCaption: ${s.caption}\n`;
  if (s.hashtags && s.hashtags.length) t += s.hashtags.join(" ");
  return t.trim();
}

async function runScript() {
  if (state.scriptLoading) return;
  if (!state.scriptInputs.idea.trim()) return toast("Tell us the video idea first");
  state.scriptLoading = true; render();
  try {
    const r = await api("/api/script/generate", { method: "POST", body: JSON.stringify({ ...state.scriptInputs, brand_id: state.activeBrandId }) });
    state.scriptResult = r; if (r.used != null && state.usage) state.usage.used = r.used;
  } catch (ex) { if (ex.data?.upgrade) { state.scriptLoading = false; return openUpgrade(ex.message); } toast("⚠ " + ex.message); }
  finally { state.scriptLoading = false; render(); }
}

/* ============================= GIG DIARY =========================== */

const naira = n => '₦' + Math.round(n||0).toLocaleString();
const GIG_STATUS = { paid:{label:"Paid",cls:"bg-brand-tint text-brand-dark"}, pending:{label:"Pending",cls:"bg-amber-100 text-amber-700"}, ongoing:{label:"Ongoing",cls:"bg-sky-100 text-sky-700"} };

function gigsView() {
  const s = state.gigSummary || { earned:0, pending:0, count:0, month_earned:0, avg:0 };
  const stat = (label, val, accent="") => `<div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
    <div class="text-[11px] font-semibold uppercase tracking-wide text-faint">${label}</div>
    <div class="font-display font-extrabold text-2xl mt-1 ${accent}">${val}</div></div>`;
  return `<div class="pb-24 md:pb-0 space-y-5">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${stat("Total earned", naira(s.earned), "text-brand-dark")}
      ${stat("Pending", naira(s.pending), "text-amber-600")}
      ${stat("This month", naira(s.month_earned))}
      ${stat("Gigs logged", s.count + (s.count?` · avg ${naira(s.avg)}`:""))}
    </div>
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted">Your gig history${s.count?` — ${s.count} logged`:''}.</p>
      <button data-gig-new class="shrink-0 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-lg shadow-sm">+ Log a gig</button>
    </div>
    ${state.gigEditing!==null ? gigForm() : ""}
    <div class="space-y-2">${state.gigs.length ? state.gigs.map(gigRow).join("") : `<div data-card class="bg-white border border-line rounded-xl2 shadow-card p-8 text-center"><div class="w-12 h-12 mx-auto rounded-xl2 bg-brand-tint text-brand grid place-items-center mb-2">${ic("briefcase","w-6 h-6")}</div><p class="font-display font-bold">No gigs logged yet</p><p class="text-sm text-muted mt-1">Hit "Log a gig" to start tracking what you earn.</p></div>`}</div>
  </div>`;
}

function gigRow(g) {
  const st = GIG_STATUS[g.status] || GIG_STATUS.paid;
  return `<div data-card class="bg-white border border-line rounded-xl2 shadow-card p-4 transition">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-sm truncate">${esc(g.title)}</span>
          <span class="text-[10.5px] font-medium px-2 py-0.5 rounded-full ${st.cls}">${st.label}</span>
        </div>
        <div class="text-xs text-muted mt-0.5">${[g.client,g.category,g.gig_date].filter(Boolean).map(esc).join(" · ")||"—"}</div>
        ${g.notes?`<p class="text-xs text-ink/70 mt-1.5 whitespace-pre-wrap">${esc(g.notes)}</p>`:''}
      </div>
      <div class="text-right shrink-0">
        <div class="font-display font-extrabold ${g.status==='pending'?'text-amber-600':'text-brand-dark'}">${naira(g.amount)}</div>
        <div class="flex gap-1.5 mt-1.5 justify-end">
          <button data-gig-edit="${g.id}" class="text-xs px-2 py-0.5 rounded-lg border border-line hover:border-brand/40">Edit</button>
          <button data-gig-del="${g.id}" class="text-xs px-2 py-0.5 rounded-lg border border-line text-rose-500 hover:border-rose-300">Delete</button>
        </div>
      </div>
    </div></div>`;
}

function gigForm() {
  const g = state.gigEditing || {}, f = k => esc(g[k]||"");
  const cats = state.config.advisor_options.gig_categories;
  return `<div data-card class="bg-white border border-brand/30 rounded-xl2 shadow-card p-5">
    <div class="font-semibold text-sm mb-3">${g.id?"Edit gig":"Log a gig"}</div>
    <form id="gigForm" class="space-y-3">
      <label class="block"><span class="text-xs font-semibold text-muted">What was the gig? *</span>
        <input name="title" value="${f('title')}" required placeholder="e.g. Logo + brand kit for Mama's Kitchen" class="advi"/></label>
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Client</span>
          <input name="client" value="${f('client')}" placeholder="Client / company" class="advi"/></label>
        <label class="block"><span class="text-xs font-semibold text-muted">Category</span>
          <input name="category" list="gigcats2" value="${f('category')}" placeholder="e.g. Graphic design" class="advi"/>
          <datalist id="gigcats2">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label>
      </div>
      <div class="grid sm:grid-cols-3 gap-3">
        <label class="block"><span class="text-xs font-semibold text-muted">Amount (₦) *</span>
          <input name="amount" value="${g.amount!=null?esc(String(g.amount)):''}" inputmode="numeric" placeholder="80000" class="advi"/></label>
        <label class="block"><span class="text-xs font-semibold text-muted">Date</span>
          <input name="gig_date" type="date" value="${f('gig_date')}" class="advi"/></label>
        <label class="block"><span class="text-xs font-semibold text-muted">Status</span>
          <select name="status" class="advi">${["paid","pending","ongoing"].map(x=>`<option value="${x}" ${g.status===x?'selected':''}>${GIG_STATUS[x].label}</option>`).join("")}</select></label>
      </div>
      <label class="block"><span class="text-xs font-semibold text-muted">What you did (notes)</span>
        <textarea name="notes" rows="2" placeholder="Deliverables, scope, anything to remember…" class="advi">${f('notes')}</textarea></label>
      <div class="flex gap-2 pt-1">
        <button type="submit" class="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand hover:bg-brand-dark shadow-sm">${g.id?"Save":"Add gig"}</button>
        <button type="button" data-gig-cancel class="px-4 py-2.5 rounded-xl text-sm border border-line hover:bg-paper">Cancel</button>
      </div>
    </form>${ADVI_STYLE}</div>`;
}

async function loadGigs() {
  const d = await api("/api/gigs");
  state.gigs = d.gigs; state.gigSummary = d.summary;
}

async function saveGig(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  if (!data.title.trim()) return toast("Give the gig a title");
  const id = state.gigEditing?.id;
  try {
    await api(id?`/api/gigs/${id}`:"/api/gigs", { method:id?"PUT":"POST", body:JSON.stringify(data) });
    await loadGigs(); state.gigEditing = null; render();
    toast(id?"Gig updated":"Gig logged");
  } catch (ex) { handleErr(ex); }
}

/* ============================== WIRING ============================= */

function wire() {
  $$("[data-nav]").forEach(b => b.onclick = () => goto(b.dataset.nav));
  const lo = $("[data-logout]"); if (lo) lo.onclick = logout;
  const mt = $("[data-mtoggle]"); if (mt) mt.onclick = () => { state.mobileNav = !state.mobileNav; render(); };
  $$("[data-mclose]").forEach(b => b.onclick = () => { state.mobileNav = false; render(); });
  const acct = $("[data-acct]"); if (acct) acct.onclick = () => { state.acctMenu = !state.acctMenu; render(); };
  $$("[data-acctclose]").forEach(b => b.onclick = () => { state.acctMenu = false; render(); });

  if (state.view === "studio") {
    const bs = $("#brandSelect"); if (bs) bs.onchange = e => state.activeBrandId = +e.target.value;
    $$("[data-tone]").forEach(b => b.onclick = () => { state.tone = b.dataset.tone; render(); });
    $$("[data-ct]").forEach(b => b.onclick = () => { state.contentType = b.dataset.ct; render(); });
    $$("[data-var]").forEach(b => b.onclick = () => { state.variants = +b.dataset.var; render(); });
    const brief = $("#brief"); if (brief) brief.oninput = e => state.brief = e.target.value;
    const gen = $("#genBtn"); if (gen) gen.onclick = generate;
    if (state.cards) renderCards();
  }
  if (state.view === "calendar") {
    const m = { calBrand:"activeBrandId", calMonth:"calMonth", calYear:"calYear", calCadence:"calCadence" };
    for (const [id,key] of Object.entries(m)) { const el=$("#"+id); if(el) el.onchange=e=>state[key]= id==="calBrand"?+e.target.value:(id==="calYear"?(parseInt(e.target.value)||state.calYear):e.target.value); }
    const cb=$("#calBtn"); if(cb) cb.onclick=buildCalendar;
    const nb=$("[data-cal-new]"); if(nb) nb.onclick=()=>{state.calendar=null;render();};
    $$("[data-write]").forEach(b=>b.onclick=()=>writeFromCalendar(state.calendar.posts[+b.dataset.write]));
  }
  if (state.view === "calendars") {
    $$("[data-open-cal]").forEach(b=>b.onclick=async()=>{ const cal=await api(`/api/calendar/${b.dataset.openCal}`); state.calendar=cal; state.view="calendar"; render(); });
    $$("[data-del-cal]").forEach(b=>b.onclick=async()=>{ if(!confirm("Delete this plan?"))return; await api(`/api/calendar/${b.dataset.delCal}`,{method:"DELETE"}); state.savedCalendars=await api("/api/calendars"); render(); });
  }
  if (state.view === "brands") {
    const nb=$("[data-new]"); if(nb) nb.onclick=()=>{ if(nb.hasAttribute('data-locked')) return goto('pricing'); state.editing={}; state.brandMode="form"; render(); };
    $$("[data-edit]").forEach(b=>b.onclick=()=>{ state.editing=state.brands.find(x=>x.id===+b.dataset.edit); render(); });
    $$("[data-del]").forEach(b=>b.onclick=async()=>{ if(!confirm("Delete this brand?"))return; await api(`/api/brands/${b.dataset.del}`,{method:"DELETE"}); state.brands=await api("/api/brands"); if(state.activeBrandId===+b.dataset.del)state.activeBrandId=state.brands[0]?.id||null; await refreshUsage(); render(); });
    $$("[data-cancel]").forEach(b=>b.onclick=()=>{ state.editing=null; render(); });
    $$("[data-mode]").forEach(b=>b.onclick=()=>{ state.brandMode=b.dataset.mode; render(); });
    const form=$("#brandForm"); if(form) form.onsubmit=saveBrand;
    const lb=$("#learnBtn"); if(lb) lb.onclick=learnFromPosts;
  }
  if (state.view === "favorites") {
    $$("[data-del-fav]").forEach(b=>b.onclick=async()=>{ await api(`/api/favorites/${b.dataset.delFav}`,{method:"DELETE"}); state.favorites=await api("/api/favorites"); render(); });
    $$("[data-copy-fav]").forEach(b=>b.onclick=()=>{ const f=state.favorites.find(x=>x.id===+b.dataset.copyFav); navigator.clipboard.writeText(f.text); b.textContent="Copied ✓"; setTimeout(()=>b.textContent="Copy",1400); });
  }
  if (state.view === "pricing") {
    $$("[data-plan]").forEach(b=>b.onclick=()=>choosePlan(b.dataset.plan));
  }
  if (state.view === "rate") {
    ["service","experience","location","client_type","scope"].forEach(k=>{ const el=$("#r_"+k); if(el){ el.oninput=e=>state.rateInputs[k]=e.target.value; el.onchange=e=>state.rateInputs[k]=e.target.value; } });
    const b=$("#rateBtn"); if(b) b.onclick=runRate;
  }
  if (state.view === "script") {
    ["idea","platform","length","goal"].forEach(k=>{ const el=$("#sc_"+k); if(el){ el.oninput=e=>state.scriptInputs[k]=e.target.value; el.onchange=e=>state.scriptInputs[k]=e.target.value; } });
    const fmt=$("#sc_format"); if(fmt) fmt.onchange=e=>{ state.scriptInputs.format=e.target.value; render(); };
    const tn=$("#sc_tone"); if(tn) tn.onchange=e=>state.scriptInputs.tone=e.target.value;
    const b=$("#scriptBtn"); if(b) b.onclick=runScript;
    const cc=$("[data-copy-cap]"); if(cc) cc.onclick=()=>{ const s=state.scriptResult; navigator.clipboard.writeText(s.caption+(s.hashtags.length?"\n\n"+s.hashtags.join(" "):"")); cc.textContent="Copied ✓"; setTimeout(()=>cc.textContent="Copy",1400); };
    const cs=$("[data-copy-script]"); if(cs) cs.onclick=()=>{ navigator.clipboard.writeText(scriptToText(state.scriptResult)); cs.textContent="Copied ✓"; setTimeout(()=>cs.textContent="Copy full script",1400); };
  }
  if (state.view === "advisor") {
    ["interests","platform","goal"].forEach(k=>{ const el=$("#b_"+k); if(el) el.oninput=e=>state.brandInputs[k]=e.target.value; });
    $$("[data-chiptoggle]").forEach(c=>c.onclick=()=>{ const g=c.dataset.group, v=c.dataset.chiptoggle, arr=state.brandInputs[g], i=arr.indexOf(v); if(i>=0)arr.splice(i,1); else arr.push(v); render(); });
    const b=$("#brandBtn"); if(b) b.onclick=runBrandAdvisor;
    $$("[data-copybio]").forEach(b=>b.onclick=()=>{ navigator.clipboard.writeText(state.brandResult.bio_options[+b.dataset.copybio]); b.textContent="Copied ✓"; setTimeout(()=>b.textContent="Copy",1400); });
  }
  if (state.view === "profile") {
    const pf=$("#profileForm"); if(pf) pf.onsubmit=saveProfile;
    const pw=$("#pwForm"); if(pw) pw.onsubmit=changePassword;
  }
  if (state.view === "gigs") {
    const nb=$("[data-gig-new]"); if(nb) nb.onclick=()=>{ state.gigEditing={}; render(); };
    $$("[data-gig-edit]").forEach(b=>b.onclick=()=>{ state.gigEditing=state.gigs.find(x=>x.id===+b.dataset.gigEdit); render(); });
    $$("[data-gig-del]").forEach(b=>b.onclick=async()=>{ if(!confirm("Delete this gig?"))return; await api(`/api/gigs/${b.dataset.gigDel}`,{method:"DELETE"}); await loadGigs(); render(); });
    const cancel=$("[data-gig-cancel]"); if(cancel) cancel.onclick=()=>{ state.gigEditing=null; render(); };
    const form=$("#gigForm"); if(form) form.onsubmit=saveGig;
  }
}

async function goto(view) {
  state.editing = null;
  state.mobileNav = false;
  state.acctMenu = false;
  state.view = view;
  try {
    if (view === "history") state.history = await api("/api/history");
    if (view === "favorites") state.favorites = await api("/api/favorites");
    if (view === "calendars") state.savedCalendars = await api("/api/calendars");
    if (view === "gigs") { state.gigEditing = null; await loadGigs(); }
  } catch {}
  render();
}

async function saveBrand(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  if (!data.name.trim()) return alert("Brand name is required");
  const id = state.editing?.id;
  try {
    const saved = await api(id?`/api/brands/${id}`:"/api/brands", { method:id?"PUT":"POST", body:JSON.stringify(data) });
    state.brands = await api("/api/brands");
    state.activeBrandId = saved.id; state.editing = null;
    await refreshUsage(); render();
  } catch (ex) { handleErr(ex); }
}

async function learnFromPosts() {
  const samples = $("#learnSamples").value.trim();
  if (samples.length < 20) return alert("Paste a bit more to learn from.");
  state.extracting = true; render();
  try {
    const profile = await api("/api/brands/from-posts", { method:"POST", body:JSON.stringify({samples}) });
    state.editing = profile; state.brandMode = "form"; // prefill the form for review
    toast("Voice read! Review the profile and save.");
  } catch (ex) { handleErr(ex); }
  finally { state.extracting = false; render(); }
}

/* ============================ GENERATION =========================== */

async function generate() {
  if (state.generating) return;
  state.generating = true; state.cards = null; render();
  const out = $("#output"), dot = $("#streamDot");
  out.innerHTML = `<div id="live" class="text-sm whitespace-pre-wrap text-ink/90 leading-relaxed"></div>`;
  dot.classList.remove("hidden");
  const live = $("#live");
  try {
    const res = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ brand_id:state.activeBrandId, content_type:state.contentType, tone:state.tone, brief:state.brief, variants:state.variants }) });
    if (res.status === 402) { const d=await res.json(); state.generating=false; openUpgrade(d.error); return; }
    if (res.status === 401) { return logout(); }
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf="";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value,{stream:true});
      const chunks = buf.split("\n\n"); buf = chunks.pop();
      for (const chunk of chunks) {
        const ev = parseSSE(chunk); if (!ev) continue;
        if (ev.event==="delta") { live.textContent += ev.data.text; out.scrollTop = out.scrollHeight; }
        else if (ev.event==="done") { state.cards = ev.data.variants.map(t=>({text:t, editing:false, busy:false})); if(ev.data.used!=null&&state.usage)state.usage.used=ev.data.used; renderCards(); updateUsageMeter(); }
        else if (ev.event==="error") live.innerHTML = `<span class="text-rose-500">⚠ ${esc(ev.data.message)}</span>`;
      }
    }
  } catch (ex) { const o=$("#output"); if(o) o.innerHTML=`<p class="text-rose-500 text-sm">⚠ ${esc(ex.message)}</p>`; }
  finally { state.generating=false; const d=$("#streamDot"); if(d)d.classList.add("hidden"); const btn=$("#genBtn"); if(btn){btn.disabled=false;btn.innerHTML=ic("spark","w-4 h-4")+" Generate";} }
}

function renderCards() {
  const out = $("#output"); if (!out || !state.cards) return;
  const presets = state.config.refine_presets;
  out.innerHTML = state.cards.map((c,i)=>`
    <div class="fade-up bg-paper border border-line rounded-xl2 p-4" style="animation-delay:${i*40}ms" data-cardwrap="${i}">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-brand-dark">Option ${i+1}</span>
        <div class="flex items-center gap-1">
          <button data-fb="up" data-i="${i}" title="On-brand — learn from this" class="w-7 h-7 grid place-items-center rounded-lg border border-line bg-white text-muted hover:border-brand/40 hover:text-brand">${ic("thumb_up","w-3.5 h-3.5")}</button>
          <button data-fb="down" data-i="${i}" title="Off-brand" class="w-7 h-7 grid place-items-center rounded-lg border border-line bg-white text-muted hover:border-rose-300 hover:text-rose-500">${ic("thumb_down","w-3.5 h-3.5")}</button>
          <button data-edit-c="${i}" class="text-xs px-2.5 py-1 rounded-lg border border-line bg-white hover:border-brand/40">${c.editing?'Done':'Edit'}</button>
          <button data-star="${i}" class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-line bg-white hover:border-brand/40">${ic("save","w-3.5 h-3.5")} Save</button>
          <button data-copy="${i}" class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-line bg-white hover:border-brand/40">${ic("copy","w-3.5 h-3.5")} Copy</button>
        </div></div>
      ${c.editing
        ? `<textarea data-ta="${i}" rows="5" class="w-full bg-white border border-line rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/30">${esc(c.text)}</textarea>`
        : `<div class="text-sm whitespace-pre-wrap leading-relaxed ${c.busy?'opacity-40':''}">${esc(c.text)}</div>`}
      <div class="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-line">
        <span class="text-[10px] uppercase tracking-wide text-faint font-semibold mr-1">Refine</span>
        ${presets.map(p=>`<button data-refine="${i}" data-instr="${p.key}" class="text-[11px] px-2 py-1 rounded-md border border-line bg-white hover:border-brand/40 hover:text-brand-dark">${esc(p.label)}</button>`).join("")}
        <button data-refine="${i}" data-instr="__regen" class="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-line bg-white hover:border-brand/40">${ic("refresh","w-3 h-3")} Fresh version</button>
        ${c.busy?'<span class="w-3.5 h-3.5 border-2 border-brand/30 border-t-brand rounded-full spin"></span>':''}
      </div></div>`).join("");

  $$("[data-copy]",out).forEach(b=>b.onclick=()=>{ navigator.clipboard.writeText(state.cards[+b.dataset.copy].text); b.innerHTML=ic("check","w-3.5 h-3.5")+" Copied"; setTimeout(()=>b.innerHTML=ic("copy","w-3.5 h-3.5")+" Copy",1400); });
  $$("[data-edit-c]",out).forEach(b=>b.onclick=()=>{ const i=+b.dataset.editC; const ta=$(`[data-ta="${i}"]`,out); if(state.cards[i].editing && ta) state.cards[i].text=ta.value; state.cards[i].editing=!state.cards[i].editing; renderCards(); });
  $$("[data-ta]",out).forEach(t=>t.oninput=()=>state.cards[+t.dataset.ta].text=t.value);
  $$("[data-star]",out).forEach(b=>b.onclick=()=>saveFavorite(+b.dataset.star));
  $$("[data-fb]",out).forEach(b=>b.onclick=()=>sendFeedback(+b.dataset.i, b.dataset.fb, b));
  $$("[data-refine]",out).forEach(b=>b.onclick=()=>refineCard(+b.dataset.refine, b.dataset.instr));
}

async function refineCard(i, instruction) {
  const c = state.cards[i]; if (!c || c.busy) return;
  c.busy = true; renderCards();
  const instr = instruction==="__regen" ? "Rewrite this completely fresh — a different angle and hook, same brief, brand and language." : instruction;
  try {
    const d = await api("/api/refine", { method:"POST", body:JSON.stringify({ text:c.text, instruction:instr, brand_id:state.activeBrandId, tone:state.tone, content_type:state.contentType }) });
    c.text = d.text; if (d.used!=null&&state.usage){state.usage.used=d.used; updateUsageMeter();}
  } catch (ex) { if (ex.data?.upgrade) openUpgrade(ex.message); else toast("⚠ "+ex.message); }
  finally { c.busy=false; renderCards(); }
}

async function saveFavorite(i) {
  try {
    await api("/api/favorites", { method:"POST", body:JSON.stringify({ text:state.cards[i].text, brand_id:state.activeBrandId, content_type:state.contentType, tone:state.tone }) });
    toast("Saved to your copy");
  } catch (ex) { handleErr(ex); }
}

async function sendFeedback(i, rating, btn) {
  try {
    await api("/api/feedback", { method:"POST", body:JSON.stringify({ rating, text:state.cards[i].text, brand_id:state.activeBrandId }) });
    btn.classList.add(rating==="up"?"!border-brand":"!border-rose-300","bg-brand-tint");
    toast(rating==="up"?"Noted — the brand voice will learn from this":"Noted — we'll steer away from this");
  } catch (ex) { handleErr(ex); }
}

/* ============================ CALENDAR ============================= */

async function buildCalendar() {
  if (state.calBuilding) return;
  state.calBuilding = true; render();
  try {
    state.calendar = await api("/api/calendar/generate", { method:"POST", body:JSON.stringify({ brand_id:state.activeBrandId, month:state.calMonth, year:state.calYear, cadence:state.calCadence }) });
  } catch (ex) { if (ex.data?.upgrade) { state.calBuilding=false; return openUpgrade(ex.message); } toast("⚠ "+ex.message); }
  finally { state.calBuilding=false; render(); }
}

function writeFromCalendar(post) {
  if (!post) return;
  state.contentType = post.content_type; state.tone = post.tone;
  state.brief = [post.theme, post.hook?`Hook idea: "${post.hook}"`:"", post.occasion?`Occasion: ${post.occasion}`:""].filter(Boolean).join(". ");
  state.view = "studio"; state.cards = null; render();
  setTimeout(generate, 60);
}

/* ============================ BILLING ============================== */

async function choosePlan(plan) {
  const cur = state.usage?.plan;
  if (plan === cur) return;
  if (plan === "free") {  // downgrade — just simulate
    const d = await api("/api/billing/simulate", { method:"POST", body:JSON.stringify({plan}) });
    state.user=d.user; state.usage=d.usage; toast("Switched to Free"); render(); return;
  }
  if (state.config.paystack) {
    try {
      const d = await api("/api/billing/init", { method:"POST", body:JSON.stringify({plan}) });
      window.location.href = d.authorization_url; return;
    } catch (ex) { toast("⚠ "+ex.message); return; }
  }
  // no paystack — simulate so limits can be tested
  if (!confirm(`Paystack isn't configured yet. Simulate upgrading to ${plan}? (for testing)`)) return;
  const d = await api("/api/billing/simulate", { method:"POST", body:JSON.stringify({plan}) });
  state.user=d.user; state.usage=d.usage; toast(`✓ Now on ${d.usage.plan_name} (simulated)`); render();
}

function handleUpgradeReturn() {
  const p = new URLSearchParams(location.search);
  if (p.get("upgraded")==="1") { toast("Upgrade successful"); history.replaceState({}, "", "/"); }
  else if (p.get("upgraded")==="0") { toast("Payment not completed."); history.replaceState({}, "", "/"); }
}

/* =============================== TOUR ============================== */

function maybeStartTour() {
  if (state.user && !state.user.onboarded && !state.tour) startTour();
}

function startTour() {
  state.tour = { step: 0 };
  window.addEventListener("resize", onTourResize);
  renderTourStep();
}

function onTourResize() { if (state.tour) renderTourStep(); }

function renderTourStep() {
  const step = TOUR_STEPS[state.tour.step];
  const n = state.tour.step, last = n === TOUR_STEPS.length - 1;
  let el = document.getElementById("tourOverlay");
  if (!el) { el = document.createElement("div"); el.id = "tourOverlay"; el.style.cssText = "position:fixed;inset:0;z-index:60;"; document.body.appendChild(el); }

  const desktop = window.innerWidth >= 768;
  const target = (desktop && step.sel) ? document.querySelector("aside " + step.sel) : null;

  let spot, bubbleStyle;
  if (target) {
    const r = target.getBoundingClientRect(), pad = 6;
    spot = `<div style="position:fixed;left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;border-radius:12px;box-shadow:0 0 0 9999px rgba(16,24,40,.62);transition:all .2s ease;"></div>`;
    const bx = Math.min(r.right + 16, window.innerWidth - 336);
    bubbleStyle = `left:${bx}px;top:${Math.max(12, r.top - 6)}px;`;
  } else {
    spot = `<div style="position:fixed;inset:0;background:rgba(16,24,40,.62);"></div>`;
    bubbleStyle = `left:50%;top:50%;transform:translate(-50%,-50%);`;
  }

  el.innerHTML = `${spot}
    <div style="position:fixed;${bubbleStyle}z-index:2;width:320px;max-width:90vw;" class="bg-white rounded-xl2 shadow-lift p-4 fade-up">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex gap-1">${TOUR_STEPS.map((_,i)=>`<span class="w-1.5 h-1.5 rounded-full ${i===n?'bg-brand':'bg-line'}"></span>`).join("")}</div>
        <button id="tourSkip" class="text-[11px] text-muted hover:text-ink">Skip</button>
      </div>
      <div class="font-display font-extrabold text-base">${esc(step.title)}</div>
      <p class="text-sm text-muted mt-1 leading-relaxed">${esc(step.body)}</p>
      <div class="flex items-center gap-2 mt-3.5">
        ${n>0?`<button id="tourBack" class="text-sm px-3 py-1.5 rounded-lg border border-line hover:bg-paper">Back</button>`:''}
        <button id="tourNext" class="ml-auto text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-1.5 rounded-lg shadow-sm">${last?'Finish':'Next'}</button>
      </div>
    </div>`;

  el.querySelector("#tourSkip").onclick = endTour;
  el.querySelector("#tourNext").onclick = () => { if (last) endTour(); else { state.tour.step++; renderTourStep(); } };
  const back = el.querySelector("#tourBack"); if (back) back.onclick = () => { state.tour.step--; renderTourStep(); };
}

async function endTour() {
  const el = document.getElementById("tourOverlay"); if (el) el.remove();
  window.removeEventListener("resize", onTourResize);
  state.tour = null;
  if (state.user && !state.user.onboarded) {
    state.user.onboarded = 1;
    try { await api("/api/onboarded", { method: "POST" }); } catch {}
  }
}

/* ============================== UTILS ============================== */

function openUpgrade(msg) { toast(msg || "Upgrade to continue"); state.view = "pricing"; render(); }
function handleErr(ex) { if (ex.status===401) return logout(); if (ex.data?.upgrade) return openUpgrade(ex.message); toast("⚠ "+ex.message); }

function updateUsageMeter() { const el=$("[data-nav='pricing']"); /* meter re-renders on next render; lightweight */ }

function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.innerHTML = `<div class="fade-up bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lift">${esc(msg)}</div>`;
  t.classList.remove("hidden");
  clearTimeout(window.__to); window.__to = setTimeout(()=>t.classList.add("hidden"), 2600);
}

function label(kind, key) { if(kind==="content_types"&&ADVISOR_LABELS[key]) return ADVISOR_LABELS[key]; const i=(state.config[kind]||[]).find(x=>x.key===key); return i?i.label:key; }
function parseSSE(chunk) { let e="message",d=""; for(const l of chunk.split("\n")){ if(l.startsWith("event:"))e=l.slice(6).trim(); else if(l.startsWith("data:"))d+=l.slice(5).trim(); } if(!d)return null; try{return{event:e,data:JSON.parse(d)};}catch{return null;} }
function esc(s) { return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

boot();
