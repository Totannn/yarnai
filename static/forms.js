/* =============================== FORMS ===============================
   Businesses build a short order / enquiry form, share the link, and every
   response lands here. Public page lives at /f/<slug> (templates/form_public.html). */

const FORMS_INIT = () => ({ list: null, meta: {}, tab: "forms", leads: null, locked: 0, edit: null, picker: null,
  view: (() => { try { return localStorage.getItem("vformsView") || "list"; } catch { return "list"; } })(),
  sort: { key: "created_at", dir: -1 }, hidden: (() => { try { return new Set(JSON.parse(localStorage.getItem("vformsHidden") || "[]")); } catch { return new Set(); } })(),
  sel: new Set(), colMenu: false, stats: null, slugError: "",
  share: null, lead: null, filter: { status: "all", form: "all", q: "" }, saving: false, drafting: false, menu: null });
state.forms = FORMS_INIT();

const FORM_TPL_ICON = {
  food: '<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
  fashion: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c0 2-1.8 3-4 3S8 5 8 3Z"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9.5 15 1.8 1.8 3.4-3.4"/>',
  property: '<path d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5"/><rect x="10" y="14" width="4" height="6"/>',
  beauty: '<path d="M12 3c2 3 5 4.5 5 8.5a5 5 0 0 1-10 0C7 7.5 10 6 12 3Z"/><path d="M10 13.5a2 2 0 0 0 2 2"/>',
  general: '<path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.9-5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 11.5h7M8.5 8.5h4"/>',
};
const FORM_TPL_DESC = {
  food: "Orders, pickup or delivery", fashion: "Sizes, styles & budgets", event: "Quotes for weddings & parties",
  property: "Viewings for rent or sale", beauty: "Appointments & services", general: "Any kind of enquiry",
};
const FIELD_TYPES = [
  ["products", "Products & prices"], ["delivery", "Delivery areas"], ["slots", "Booking slots"], ["short", "Short answer"], ["long", "Paragraph"], ["select", "Choices"], ["date", "Date"], ["number", "Number"], ["email", "Email"],
];
const FORM_MAX_FIELDS = 12;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FORM_SETTINGS_DEFAULT = () => ({ cover: "", font: "grotesk", layout: "page", discounts: [], close_at: 0, max_responses: 0, closed_msg: "", autoreply: true });
const FONT_FALLBACK = { grotesk: { label: "Modern", head: "Space Grotesk", body: "Space Grotesk" } };
function formFont(k) { return (state.forms.meta.fonts || FONT_FALLBACK)[k] || FONT_FALLBACK.grotesk; }
// Load all the form fonts once, so the font picker and preview show the real thing.
function ensureFormFonts() {
  const fonts = state.forms.meta.fonts; if (!fonts || document.getElementById("vfFonts")) return;
  const l = document.createElement("link"); l.id = "vfFonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?" + Object.values(fonts).map(f => f.q).join("&") + "&display=swap";
  document.head.appendChild(l);
}
const CLOSED_LABEL = { paused: "Paused", date: "Closed", full: "Full" };
const FORM_SWATCHES = ["#0e9488", "#0c2724", "#1d4ed8", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#b7791f", "#15803d", "#111827"];
const LEAD_STATUS = {
  new: ["New", "bg-gold-tint text-gold"], contacted: ["Contacted", "bg-sky-50 text-sky-700"],
  won: ["Won", "bg-brand-tint text-brand-dark"], lost: ["Lost", "bg-paper text-muted"],
};
const SOURCE_LABEL = { ig: "Instagram", fb: "Facebook", tt: "TikTok", wa: "WhatsApp", x: "X", li: "LinkedIn", qr: "QR code", bio: "Bio link", post: "Vertil post" };

const fsvg = (p, cls = "w-4 h-4", sw = 1.7) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${p}</svg>`;
const FI = {
  plus: '<path d="M12 5v14M5 12h14"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3h-3"/>',
  send: '<path d="M4 12 20 4l-4 16-4-7z"/><path d="m12 13 8-9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/><path d="M14 11v6M11 14h6"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>',
};
const WA_PATH = '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/>';

function formUrl(f, src) { return `${state.forms.meta.base_url || location.origin}/f/${f.slug}${src ? "?s=" + src : ""}`; }
function naija(n) { return "₦" + Math.round(n || 0).toLocaleString(); }
function waNumber(p) { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("0") && d.length === 11 ? "234" + d.slice(1) : d; }
function brandById(id) { return (state.brands || []).find(b => b.id === id); }

async function loadForms() {
  const [f, l] = await Promise.all([api("/api/forms"), api("/api/leads")]);
  state.forms.list = f.forms; state.forms.meta = f; state.forms.leads = l.leads; state.forms.locked = l.locked;
}
function formsNewCount() { return (state.forms.leads || []).filter(l => l.status === "new" && !l.locked).length; }

/* ------------------------------ main view ------------------------------ */
function formsView() {
  const F = state.forms;
  if (F.edit) return formEditorView() + (F.prevFull ? formPreviewOverlay() : "");
  F.prevFull = false;
  if (!F.list) return `<div class="text-sm text-muted py-20 text-center">Loading…</div>`;
  const leads = F.leads || [];
  const views = F.list.reduce((s, f) => s + (f.views || 0), 0);
  const total = F.list.reduce((s, f) => s + (f.responses || 0), 0);
  const won = leads.filter(l => l.status === "won");
  const wonValue = won.reduce((s, l) => s + (l.value || 0), 0);
  const stat = (label, value, sub, accent) => `<div class="bg-white border border-line rounded-xl2 shadow-card p-4 min-w-0">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-faint">${label}</div>
      <div class="font-display font-extrabold ${String(value).length > 9 ? "text-[17px] min-[400px]:text-[20px] sm:text-[26px]" : "text-[26px]"} leading-tight mt-1 whitespace-nowrap tabular-nums ${accent || ""}">${value}</div>
      <div class="text-[11.5px] text-muted mt-0.5">${sub}</div></div>`;
  const newN = formsNewCount();
  return `<div class="pb-24 md:pb-0 space-y-5 fade-up">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${stat("Responses", total.toLocaleString(), `${F.meta.this_week || 0} this week${leads.some(l => l.order_total) ? " · " + naija(leads.reduce((s, l) => s + (l.order_total || 0), 0)) + " ordered" : ""}`)}
      ${stat("Waiting for reply", newN, newN ? "Reply fast — it wins sales" : "You're all caught up", newN ? "text-gold" : "")}
      ${stat("Conversion", views ? Math.round((total / views) * 100) + "%" : "—", `${views.toLocaleString()} form views`)}
      ${stat("Won", won.length ? naija(wonValue) : "—", `${won.length} customer${won.length === 1 ? "" : "s"} won`, won.length ? "text-brand-dark" : "")}
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <div class="inline-flex bg-white border border-line rounded-xl p-1 gap-1">
        ${[["forms", "Forms", F.list.length], ["responses", "Responses", newN]].map(([k, l, n]) => `<button data-ftab="${k}" class="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition ${F.tab === k ? "bg-brand-tint text-brand-dark" : "text-muted hover:text-ink"}">${l}${n ? `<span class="text-[10.5px] font-bold font-mono px-1.5 py-0.5 rounded-full ${k === "responses" ? "bg-gold-tint text-gold" : "bg-paper text-muted"}">${n}</span>` : ""}</button>`).join("")}
      </div>
      <button data-fnew class="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-2.5 rounded-xl shadow-sm">${fsvg(FI.plus, "w-4 h-4", 2)} New form</button>
    </div>
    ${F.tab === "forms" ? formsGrid() : responsesView()}
  </div>
  ${F.picker ? formPickerModal() : ""}${F.share ? formShareModal() : ""}${F.stats ? formStatsModal() : ""}${F.tab === "responses" ? sheetFullOverlay() + leadOverlay() : ""}`;
}

function formsGrid() {
  const F = state.forms;
  if (!F.list.length) {
    return `<div class="relative overflow-hidden bg-forest text-white rounded-[22px] p-7 sm:p-10">
      <div class="absolute inset-0 opacity-[0.12]" style="background-image:radial-gradient(circle at 1px 1px,#2dd4bf 1px,transparent 0);background-size:26px 26px"></div>
      <div class="relative grid lg:grid-cols-[1fr_300px] gap-8 items-center">
        <div>
          <div class="text-[11px] font-mono uppercase tracking-[2px] text-brand-bright mb-3">Forms</div>
          <h2 class="font-display font-bold text-2xl sm:text-3xl tracking-tight">Turn your followers into customers.</h2>
          <p class="text-white/70 mt-3 max-w-lg leading-relaxed">Make an order or enquiry form in a minute, written in your brand's voice. Share the link on Instagram, TikTok or WhatsApp — every response lands right here, ready for you to reply.</p>
          <div class="flex flex-wrap gap-2 mt-6">
            ${Object.keys(FORM_TPL_ICON).map(k => `<button data-fpick="${k}" class="inline-flex items-center gap-2 text-[13px] font-semibold bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl px-3.5 py-2 transition">${fsvg(FORM_TPL_ICON[k], "w-4 h-4")} ${esc((F.meta.templates || {})[k]?.label || k)}</button>`).join("")}
          </div>
        </div>
        <div class="hidden lg:block">${formMiniPhone({ title: "Place your order", accent: "#2dd4bf", fields: [{ label: "What would you like?" }, { label: "Pickup or delivery?" }] })}</div>
      </div>
    </div>`;
  }
  const cards = F.list.map(f => {
    const b = brandById(f.brand_id);
    const live = f.status === "live";
    const closed = f.closed || (live ? "" : "paused");
    return `<div class="group bg-white border border-line rounded-xl2 shadow-card hover:shadow-lift hover:border-brand/30 transition overflow-hidden flex flex-col">
      <div class="relative h-[92px] px-5 pt-4" style="${f.settings?.cover ? `background:url('${esc(f.settings.cover)}') center/cover` : `background:linear-gradient(135deg, ${f.accent}, color-mix(in srgb, ${f.accent} 65%, #000))`}">
        <div class="absolute inset-0 ${f.settings?.cover ? "bg-gradient-to-b from-black/45 to-black/10" : "opacity-[.14]"}" ${f.settings?.cover ? "" : `style="background-image:radial-gradient(circle at 1px 1px,#fff 1px,transparent 0);background-size:16px 16px"`}></div>
        <div class="relative flex items-center gap-2">
          <span class="text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${!closed ? "bg-white text-ink" : "bg-black/25 text-white"}">${!closed ? "● Live" : CLOSED_LABEL[closed]}</span>
          ${f.new_count ? `<span class="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-gold-tint text-gold">${f.new_count} new</span>` : ""}
          <div class="ml-auto relative">
            <button data-fmenu="${f.id}" class="w-8 h-8 grid place-items-center rounded-lg text-white/85 hover:bg-white/15">${fsvg(FI.dots, "w-5 h-5")}</button>
            ${F.menu === f.id ? `<div data-fmenu-close class="fixed inset-0 z-10"></div><div class="absolute right-0 top-9 z-20 w-44 bg-white border border-line rounded-xl shadow-lift py-1 text-ink">
              <button data-ftoggle="${f.id}" class="w-full text-left px-3.5 py-2 text-[13px] hover:bg-paper">${live ? "Pause responses" : "Start taking responses"}</button>
              <button data-fstats="${f.id}" class="w-full text-left px-3.5 py-2 text-[13px] hover:bg-paper">See stats</button>
              <button data-fdup="${f.id}" class="w-full text-left px-3.5 py-2 text-[13px] hover:bg-paper">Duplicate</button>
              <a href="${formUrl(f)}" target="_blank" class="block px-3.5 py-2 text-[13px] hover:bg-paper">Open public form ↗</a>
              <button data-fdel="${f.id}" class="w-full text-left px-3.5 py-2 text-[13px] text-rose-600 hover:bg-rose-50">Delete form</button></div>` : ""}
          </div>
        </div>
      </div>
      <div class="px-5 pb-5 -mt-7 relative flex-1 flex flex-col">
        <div class="w-12 h-12 rounded-xl bg-white border border-line shadow-sm grid place-items-center overflow-hidden">${b?.logo ? `<img src="${esc(b.logo)}" class="w-full h-full object-contain"/>` : `<span class="font-bold text-lg" style="color:${f.accent}">${esc((b?.name || f.title)[0].toUpperCase())}</span>`}</div>
        <div class="font-display font-bold text-[17px] mt-3 leading-snug">${esc(f.title)}</div>
        <div class="text-xs text-muted mt-0.5 truncate">${esc(b?.name || "No brand")} · /f/${esc(f.slug)}</div>
        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
          ${[["Views", f.views || 0], ["Responses", f.responses || 0], ["Rate", f.views ? Math.round(((f.responses || 0) / f.views) * 100) + "%" : "—"]].map(([l, v]) => `<div class="bg-paper rounded-lg py-2"><div class="font-display font-bold text-[15px]">${v}</div><div class="text-[10px] uppercase tracking-wide text-faint">${l}</div></div>`).join("")}
        </div>
        <div class="text-[11px] text-faint mt-3">${f.last_response ? "Last response " + relTime(f.last_response) : "No responses yet — share it!"}</div>
        <div class="flex gap-2 mt-4 pt-4 border-t border-line">
          <button data-fshare="${f.id}" class="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg py-2">${fsvg(FI.send, "w-3.5 h-3.5")} Share</button>
          <button data-fedit="${f.id}" class="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold border border-line hover:bg-paper rounded-lg py-2">${fsvg(FI.edit, "w-3.5 h-3.5")} Edit</button>
          <button data-fresp="${f.id}" title="Responses" class="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold border border-line hover:bg-paper rounded-lg px-3 py-2">${fsvg(FI.inbox, "w-3.5 h-3.5")}</button>
          <button data-fstats="${f.id}" title="Stats" class="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold border border-line hover:bg-paper rounded-lg px-3 py-2">${fsvg(FI.chart, "w-3.5 h-3.5")}</button>
        </div>
      </div>
    </div>`;
  }).join("");
  const limit = F.meta.limit || 1;
  const atLimit = F.list.length >= limit;
  return `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${cards}
    <button data-fnew class="min-h-[280px] rounded-xl2 border-2 border-dashed border-line hover:border-brand/50 hover:bg-white transition grid place-items-center text-center p-6">
      <div><div class="w-12 h-12 mx-auto rounded-xl bg-brand-tint text-brand grid place-items-center">${fsvg(atLimit ? FI.lock : FI.plus, "w-5 h-5", 2)}</div>
      <div class="font-semibold mt-3">${atLimit ? "Need more forms?" : "New form"}</div>
      <div class="text-xs text-muted mt-1">${atLimit ? `Your plan includes ${limit}. Upgrade for more.` : (limit >= 10000 ? "Unlimited forms on your plan" : `${F.list.length} of ${limit} on your plan`)}</div></div>
    </button></div>`;
}

function formMiniPhone(f) {
  return `<div class="mx-auto w-[230px] rounded-[30px] border border-white/15 bg-black/30 p-2 shadow-2xl">
    <div class="rounded-[24px] bg-[#f4f7f6] overflow-hidden">
      <div class="h-16" style="background:${f.accent}"></div>
      <div class="bg-white rounded-2xl mx-3 -mt-10 p-4 text-ink shadow">
        <div class="font-display font-bold text-[15px]">${esc(f.title)}</div>
        ${["Your name", "Phone number", ...f.fields.map(x => x.label)].map(l => `<div class="mt-2.5"><div class="text-[9.5px] font-semibold">${esc(l)}</div><div class="h-6 rounded-md border border-line bg-paper mt-1"></div></div>`).join("")}
        <div class="h-8 rounded-lg mt-3" style="background:${f.accent}"></div>
      </div><div class="h-4"></div>
    </div></div>`;
}

/* ------------------------------ template picker ------------------------------ */
function formPickerModal() {
  const P = state.forms.picker;
  const T = state.forms.meta.templates || {};
  const brands = state.brands || [];
  return `<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
    <div data-fpick-close class="absolute inset-0 bg-ink/45 backdrop-blur-sm"></div>
    <div class="relative bg-white w-full sm:max-w-2xl rounded-t-[24px] sm:rounded-[24px] shadow-lift max-h-[92vh] overflow-y-auto scroll-thin fade-up">
      <div class="p-6 sm:p-7">
        <div class="flex items-start gap-3">
          <div><div class="font-display font-bold text-xl">Create a form</div><div class="text-sm text-muted mt-0.5">Pick a starting point — you can change everything after.</div></div>
          <button data-fpick-close class="ml-auto text-faint hover:text-ink p-1">${fsvg(FI.x, "w-5 h-5")}</button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
          ${Object.keys(FORM_TPL_ICON).map(k => `<button data-ftpl="${k}" class="text-left rounded-xl2 border-2 p-3.5 transition ${P.template === k ? "border-brand bg-brand-tint/60" : "border-line hover:border-brand/40"}">
            <div class="w-9 h-9 rounded-lg grid place-items-center ${P.template === k ? "bg-brand text-white" : "bg-paper text-brand"}">${fsvg(FORM_TPL_ICON[k], "w-[18px] h-[18px]")}</div>
            <div class="font-semibold text-[13.5px] mt-2.5">${esc(T[k]?.label || k)}</div>
            <div class="text-[11.5px] text-muted mt-0.5 leading-snug">${FORM_TPL_DESC[k]}</div></button>`).join("")}
        </div>
        <div class="grid sm:grid-cols-2 gap-3 mt-5">
          <label class="block"><span class="text-xs font-semibold text-muted">Brand</span>
            <select id="fpBrand" class="mt-1 w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-white">
              ${brands.length ? brands.map(b => `<option value="${b.id}" ${b.id === P.brand_id ? "selected" : ""}>${esc(b.name)}</option>`).join("") : `<option value="">No brand yet</option>`}
            </select></label>
          <label class="block"><span class="text-xs font-semibold text-muted">What's it for? <span class="font-normal text-faint">(optional)</span></span>
            <input id="fpBrief" value="${esc(P.brief || "")}" placeholder="e.g. Jollof tray orders for December parties" class="mt-1 w-full border border-line rounded-xl px-3 py-2.5 text-sm"/></label>
        </div>
        <label class="flex items-center gap-2.5 mt-4 text-sm cursor-pointer">
          <input id="fpAI" type="checkbox" ${P.ai ? "checked" : ""} class="w-4 h-4 accent-[#0e9488]"/>
          <span>${fsvg(FI.spark, "w-4 h-4 inline -mt-0.5 text-brand")} Write it in my brand's voice with AI</span></label>
        <button data-fpick-go ${state.forms.drafting ? "disabled" : ""} class="mt-6 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl py-3 disabled:opacity-70">
          ${state.forms.drafting ? `<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span> Writing your form…` : "Continue"}</button>
      </div>
    </div></div>`;
}

/* ------------------------------ editor ------------------------------ */
function formEditorView() {
  const E = state.forms.edit;
  // fill in defaults on the SAME object — async handlers (photo upload) hold a reference to it
  E.settings = E.settings || {};
  for (const [k, v] of Object.entries(FORM_SETTINGS_DEFAULT())) if (!(k in E.settings)) E.settings[k] = v;
  const S = E.settings;
  ensureFormFonts();
  const brands = state.brands || [];
  const b = brandById(E.brand_id);
  const swatches = [...new Set([...(b?.colors ? String(b.colors).split(",").filter(Boolean) : []), ...FORM_SWATCHES])].slice(0, 12);
  const sec = (title, sub, inner, id) => `<div ${id ? `id="${id}"` : ""} class="bg-white border border-line rounded-xl2 shadow-card p-5">
      <div class="font-display font-bold text-[15px]">${title}</div>${sub ? `<div class="text-xs text-muted mt-0.5">${sub}</div>` : ""}<div class="mt-4">${inner}</div></div>`;
  const inp = "w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none";
  const fields = E.fields.map((q, i) => `<div class="rounded-xl border border-line bg-paper/60 p-3 sm:p-3.5" data-fq="${i}">
      <div class="flex items-start gap-2">
        <span class="w-6 h-6 shrink-0 rounded-md bg-white border border-line grid place-items-center text-[11px] font-bold text-muted mt-2">${i + 1}</span>
        <div class="flex-1 min-w-0 space-y-2">
          <input data-fql="${i}" value="${esc(q.label)}" placeholder="Question" class="${inp} font-medium"/>
          <div class="flex flex-wrap items-center gap-2">
            <select data-fqt="${i}" class="border border-line rounded-lg px-2.5 py-1.5 text-[13px] bg-white">${FIELD_TYPES.map(([k, l]) => `<option value="${k}" ${q.type === k ? "selected" : ""}>${l}</option>`).join("")}</select>
            <label class="inline-flex items-center gap-1.5 text-[13px] text-muted cursor-pointer"><input data-fqr="${i}" type="checkbox" ${q.required ? "checked" : ""} class="accent-[#0e9488]"/> Required</label>
            <div class="ml-auto flex items-center gap-0.5 text-faint">
              <button data-fqup="${i}" ${i === 0 ? "disabled" : ""} class="p-1.5 rounded-md hover:bg-white hover:text-ink disabled:opacity-30" title="Move up">${fsvg(FI.up)}</button>
              <button data-fqdn="${i}" ${i === E.fields.length - 1 ? "disabled" : ""} class="p-1.5 rounded-md hover:bg-white hover:text-ink disabled:opacity-30" title="Move down">${fsvg(FI.down)}</button>
              <button data-fqdel="${i}" class="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600" title="Remove">${fsvg(FI.trash)}</button>
            </div>
          </div>
          ${q.type === "select" ? `<input data-fqo="${i}" value="${esc((q.options || []).join(", "))}" placeholder="Options, separated by commas" class="${inp} text-[13px]"/>` : ""}
        </div>
      </div>
      ${["products", "delivery", "slots"].includes(q.type) ? `<div class="mt-2 sm:pl-8">
        ${q.type === "products" ? productsEditor(q, i) : ""}
        ${q.type === "delivery" ? areasEditor(q, i) : ""}
        ${q.type === "slots" ? slotsEditor(q, i) : ""}
      </div>` : ""}</div>`).join("");
  const hasProducts = E.fields.some(q => q.type === "products");
  const hasEmail = E.fields.some(q => q.type === "email");
  const fonts = state.forms.meta.fonts || FONT_FALLBACK;
  const host = (state.forms.meta.base_url || location.origin).replace(/^https?:\/\//, "");
  const closeVal = S.close_at ? (() => { const d = new Date(S.close_at * 1000); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; })() : "";
  const tile = (on, attr, inner) => `<button ${attr} class="text-left rounded-xl border-2 p-3 transition ${on ? "border-brand bg-brand-tint/50" : "border-line hover:border-brand/40 bg-white"}">${inner}</button>`;
  const lookSec = sec("Look", "Make it feel like your shop, not a generic form.", `
    <div class="text-xs font-semibold text-muted mb-1.5">Cover photo</div>
    <label class="relative block h-[130px] rounded-xl overflow-hidden cursor-pointer border-2 ${S.cover ? "border-transparent" : "border-dashed border-line hover:border-brand/50"} bg-paper group">
      ${S.cover ? `<img src="${esc(S.cover)}" class="absolute inset-0 w-full h-full object-cover"/><span class="absolute bottom-2 right-2 text-[12px] font-semibold bg-white/90 rounded-lg px-2.5 py-1 opacity-0 group-hover:opacity-100 transition">Change photo</span>`
        : `<span class="absolute inset-0 grid place-items-center text-center text-faint group-hover:text-brand"><span>${fsvg(FI.photo, "w-7 h-7 mx-auto")}<span class="block text-[13px] font-semibold mt-1.5">Add a cover photo</span><span class="block text-[11.5px] text-faint">Your food, your shop, your best work · wide photos look best</span></span></span>`}
      ${state.forms.uploading === "cover" ? `<span class="absolute inset-0 bg-white/80 grid place-items-center"><span class="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin"></span></span>` : ""}
      <input type="file" accept="image/*" data-fcover class="sr-only"/></label>
    ${S.cover ? `<button data-fcover-rm class="text-[12px] font-semibold text-muted hover:text-rose-600 mt-1.5">Remove cover photo</button>` : ""}
    <div class="text-xs font-semibold text-muted mt-5 mb-1.5">Font</div>
    <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">${Object.entries(fonts).map(([k, f]) => tile(S.font === k, `data-ffont="${k}"`,
      `<div class="text-[24px] leading-none font-bold" style="font-family:'${f.head}',sans-serif">Aa</div><div class="text-[11.5px] font-semibold mt-1.5">${esc(f.label)}</div><div class="text-[10.5px] text-faint truncate">${esc(f.head)}</div>`)).join("")}</div>
    <div class="text-xs font-semibold text-muted mt-5 mb-1.5">Layout</div>
    <div class="grid grid-cols-2 gap-2">
      ${tile(S.layout === "page", 'data-flayout="page"', `<div class="flex gap-1 flex-col w-10 mb-2">${[1, 2, 3].map(() => `<span class="h-1.5 rounded bg-current opacity-30"></span>`).join("")}</div><div class="text-[13px] font-semibold">All on one page</div><div class="text-[11.5px] text-muted">Best for short forms</div>`)}
      ${tile(S.layout === "steps", 'data-flayout="steps"', `<div class="flex gap-1 items-center w-10 mb-2"><span class="h-4 w-4 rounded bg-current opacity-60"></span><span class="h-1.5 flex-1 rounded bg-current opacity-20"></span></div><div class="text-[13px] font-semibold">One question at a time</div><div class="text-[11.5px] text-muted">Feels quick on phones</div>`)}
    </div>
    <div class="text-xs font-semibold text-muted mt-5 mb-1.5">Colour</div>
    <div class="flex flex-wrap items-center gap-2">${swatches.map(c => `<button data-fcolor="${c}" title="${c}" class="w-8 h-8 rounded-full border-2 transition ${E.accent.toLowerCase() === c.toLowerCase() ? "border-ink scale-110" : "border-white shadow"}" style="background:${c}"></button>`).join("")}
      <label class="w-8 h-8 rounded-full border border-dashed border-line grid place-items-center cursor-pointer text-faint hover:text-ink" title="Custom colour">${fsvg(FI.plus, "w-3.5 h-3.5", 2)}<input id="feColor" type="color" value="${E.accent}" class="sr-only"/></label></div>`);
  const linkSec = sec("Link", "Short and easy to say out loud — or to put on a flyer.", `
    <div class="flex items-stretch border ${state.forms.slugError ? "border-rose-400" : "border-line"} rounded-xl overflow-hidden bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      <span class="px-3 grid place-items-center text-[13px] text-faint bg-paper border-r border-line shrink-0">${esc(host)}/f/</span>
      <input id="feSlug" value="${esc(E.slug || "")}" placeholder="${E.id ? "" : "made automatically if you leave it blank"}" maxlength="40" class="flex-1 min-w-0 px-3 py-2.5 text-sm font-medium outline-none"/></div>
    ${state.forms.slugError ? `<p class="text-[12px] text-rose-600 mt-1.5">${esc(state.forms.slugError)}</p>` : ""}
    <p class="text-[11.5px] text-faint mt-1.5">Letters, numbers and dashes.${E.id ? " Changing it stops the old link working — update your bio and QR code too." : ""}</p>`);
  const codesSec = !hasProducts ? "" : sec("Discount codes", "Customers type a code on the form and the total drops. Codes are checked by Vertil, so they can't be faked.", `
    <div class="space-y-2">${S.discounts.map((d, k) => `<div class="flex flex-wrap items-center gap-2 bg-paper/60 border border-line rounded-xl p-2.5">
      <input data-fdc="${k}" value="${esc(d.code)}" placeholder="CODE" maxlength="20" class="w-[120px] border border-line rounded-lg px-2.5 py-2 text-[13px] font-mono font-semibold uppercase bg-white outline-none focus:border-brand"/>
      <div class="flex items-center border border-line rounded-lg bg-white overflow-hidden">
        <input data-fda="${k}" type="number" min="1" value="${d.amount || ""}" placeholder="10" class="w-[84px] px-2.5 py-2 text-[13px] outline-none"/>
        <select data-fdk="${k}" class="text-[13px] px-1.5 py-2 bg-paper border-l border-line outline-none"><option value="percent" ${d.kind !== "fixed" ? "selected" : ""}>% off</option><option value="fixed" ${d.kind === "fixed" ? "selected" : ""}>₦ off</option></select></div>
      <input data-fdm="${k}" type="number" min="0" value="${d.max_uses || ""}" placeholder="No limit" title="How many times it can be used" class="w-[96px] border border-line rounded-lg px-2.5 py-2 text-[13px] bg-white outline-none focus:border-brand"/>
      <span class="text-[11.5px] text-muted">${d.used ? `Used ${d.used}×` : "Not used yet"}</span>
      <label class="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-muted cursor-pointer"><input data-fdon="${k}" type="checkbox" ${d.active !== false ? "checked" : ""} class="accent-[#0e9488]"/> On</label>
      <button data-fddel="${k}" class="p-1.5 rounded-md text-faint hover:bg-rose-50 hover:text-rose-600" title="Remove">${fsvg(FI.trash)}</button></div>`).join("")}</div>
    ${S.discounts.length < 20 ? `<button data-fdadd class="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white rounded-lg px-3 py-2 transition">${fsvg(FI.plus, "w-3.5 h-3.5", 2.2)} Add a code</button>` : ""}
    <p class="text-[11.5px] text-faint mt-2">The third box is how many times a code can be used in total — leave it empty for no limit. Discounts apply to items, not delivery.</p>`);
  const closeSec = sec("Closing", "Stop taking responses automatically — great for limited offers and ticket sales.", `<div class="grid sm:grid-cols-2 gap-3">
      <label class="block"><span class="text-xs font-semibold text-muted">Close on</span><input id="feCloseAt" type="datetime-local" value="${closeVal}" class="${inp} mt-1"/></label>
      <label class="block"><span class="text-xs font-semibold text-muted">Close after this many responses</span><input id="feMax" type="number" min="0" value="${S.max_responses || ""}" placeholder="No limit" class="${inp} mt-1"/></label>
      <label class="block sm:col-span-2"><span class="text-xs font-semibold text-muted">Message when it's closed <span class="font-normal text-faint">(optional)</span></span><input id="feClosedMsg" value="${esc(S.closed_msg || "")}" maxlength="300" placeholder="e.g. December trays are sold out — follow us for January!" class="${inp} mt-1"/></label>
    </div>
    ${E.id && E.responses ? `<p class="text-[11.5px] text-faint mt-2">This form has ${E.responses} response${E.responses === 1 ? "" : "s"} so far.</p>` : ""}`);
  const followSec = sec("Follow-up", "", `<div class="space-y-3">
    <label class="flex items-start gap-3 cursor-pointer"><input id="feAuto" type="checkbox" ${S.autoreply ? "checked" : ""} class="accent-[#0e9488] w-4 h-4 mt-0.5"/>
      <span><span class="text-sm font-semibold block">Email customers a copy of what they sent</span><span class="text-[12px] text-muted">Their order or booking, in your colours. If they reply, it comes straight to you.</span>
      ${!hasEmail ? `<span class="block mt-1.5 text-[12px] text-gold">Customers only get it if the form asks for their email. <button data-fqadd="email" class="font-semibold underline">Add an email question</button></span>` : ""}</span></label>
    <label class="flex items-start gap-3 cursor-pointer"><input id="feDigest" type="checkbox" ${state.forms.meta.digest !== false ? "checked" : ""} class="accent-[#0e9488] w-4 h-4 mt-0.5"/>
      <span><span class="text-sm font-semibold block">Send me a summary every morning</span><span class="text-[12px] text-muted">“You got 12 new responses yesterday, worth ₦380,000” — for all your forms, only on days you get responses.</span></span></label>
  </div>`);
  return `<div class="pb-24 md:pb-0 fade-up">
    <div class="sticky top-16 z-20 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3 mb-5 bg-paper/90 backdrop-blur border-b border-line flex items-center gap-3">
      <button data-fback class="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">${fsvg(FI.back)} Forms</button>
      <div class="font-display font-bold truncate hidden sm:block">${E.id ? "Edit form" : "New form"}</div>
      <div class="ml-auto flex items-center gap-2">
        <label class="hidden sm:inline-flex items-center gap-2 text-[13px] font-medium text-muted cursor-pointer mr-1">
          <input id="feLive" type="checkbox" ${E.status === "live" ? "checked" : ""} class="accent-[#0e9488] w-4 h-4"/> Taking responses</label>
        ${E.id ? `<a href="${formUrl(E)}" target="_blank" class="text-sm font-semibold border border-line bg-white hover:bg-paper rounded-xl px-3.5 py-2">Open ↗</a>` : ""}
        <button data-fsave ${state.forms.saving ? "disabled" : ""} class="text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl px-4 py-2 disabled:opacity-70">${state.forms.saving ? "Saving…" : E.id ? "Save changes" : "Publish form"}</button>
      </div>
    </div>
    <div class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div class="space-y-4 min-w-0">
        ${sec("Basics", "What customers see at the top of your form.", `<div class="space-y-3">
          <label class="block"><span class="text-xs font-semibold text-muted">Title</span><input id="feTitle" value="${esc(E.title)}" maxlength="120" class="${inp} mt-1 font-semibold"/></label>
          <label class="block"><span class="text-xs font-semibold text-muted">Intro</span><textarea id="feIntro" rows="2" maxlength="400" class="${inp} mt-1 resize-none">${esc(E.intro)}</textarea></label>
          <label class="block"><span class="text-xs font-semibold text-muted">Brand</span><select id="feBrand" class="${inp} mt-1">${brands.map(x => `<option value="${x.id}" ${x.id === E.brand_id ? "selected" : ""}>${esc(x.name)}</option>`).join("") || `<option value="">No brand</option>`}</select></label>
        </div>`)}
        ${lookSec}
        ${sec("Questions", "Name and phone number are always asked first, so you can call or WhatsApp them back.", `<div class="space-y-2.5">${fields}</div>
          <div class="flex flex-wrap gap-1.5 mt-3">${E.fields.length < FORM_MAX_FIELDS ? FIELD_TYPES.map(([k, l]) => `<button data-fqadd="${k}" class="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white rounded-lg px-2.5 py-1.5 transition">${fsvg(FI.plus, "w-3 h-3", 2.2)} ${l}</button>`).join("") : `<span class="text-xs text-muted">That's the maximum of ${FORM_MAX_FIELDS} questions — short forms get more responses.</span>`}</div>`)}
        ${codesSec}
        ${sec("After they submit", "", `<div class="grid sm:grid-cols-2 gap-3">
          <label class="block"><span class="text-xs font-semibold text-muted">Button text</span><input id="feButton" value="${esc(E.button)}" maxlength="40" class="${inp} mt-1"/></label>
          <label class="block"><span class="text-xs font-semibold text-muted">Your WhatsApp number</span><input id="feWa" value="${esc(E.whatsapp || "")}" placeholder="0803 123 4567" class="${inp} mt-1"/></label>
          <label class="block sm:col-span-2"><span class="text-xs font-semibold text-muted">Thank-you message</span><input id="feThanks" value="${esc(E.thanks)}" maxlength="300" class="${inp} mt-1"/></label>
        </div><p class="text-[11.5px] text-faint mt-2">With a WhatsApp number, customers get a "Chat with us on WhatsApp" button right after they submit.</p>`)}
        ${followSec}
        ${closeSec}
        ${linkSec}
        ${sec(`${fsvg(FI.spark, "w-4 h-4 inline -mt-0.5 text-brand")} Rewrite with AI`, "Describe the form and Vertil rewrites it in your brand's voice. Your products, areas and slots stay as they are.", `<div class="flex flex-col sm:flex-row gap-2">
          <input id="feBrief" placeholder="e.g. Bookings for bridal makeup, Lekki & VI only" class="${inp} flex-1"/>
          <button data-fai ${state.forms.drafting ? "disabled" : ""} class="shrink-0 text-sm font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white rounded-xl px-4 py-2.5 transition disabled:opacity-70">${state.forms.drafting ? "Writing…" : "Rewrite"}</button></div>`)}
      </div>
      <div class="lg:sticky lg:top-36">
        <div class="flex items-center justify-center gap-3 mb-2">
          <span class="text-[11px] font-semibold uppercase tracking-wide text-faint">Live preview</span>
          <button data-fprevfull class="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-dark bg-brand-tint hover:bg-brand hover:text-white rounded-lg px-2.5 py-1 transition">${fsvg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', "w-3.5 h-3.5", 2)} Full screen</button>
        </div>
        <div class="mx-auto w-[330px] max-w-full rounded-[44px] bg-ink p-3 shadow-lift">
          <div class="rounded-[34px] overflow-hidden bg-[#f4f7f6] h-[620px] overflow-y-auto scroll-thin" id="fPrev">${formPreviewHTML(E)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function productsEditor(q, i) {
  const items = q.items || [];
  const pinp = "border border-line rounded-lg px-2.5 py-2 text-[13px] bg-white focus:border-brand outline-none min-w-0";
  return `<div class="space-y-2 pt-1">
    ${items.map((it, j) => `<div class="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-2.5 items-start bg-white border border-line rounded-xl p-2 sm:p-2.5">
      <label class="relative w-12 h-12 sm:w-[60px] sm:h-[60px] shrink-0 rounded-lg overflow-hidden cursor-pointer border border-dashed border-line bg-paper grid place-items-center text-faint hover:border-brand hover:text-brand" title="Add a photo">
        ${it.image ? `<img src="${esc(it.image)}" class="absolute inset-0 w-full h-full object-cover"/>` : `<span class="text-center leading-tight text-[10px] font-semibold">${fsvg(FI.photo, "w-5 h-5 mx-auto")}Photo</span>`}
        ${state.forms.uploading === `${i}:${j}` ? `<span class="absolute inset-0 bg-white/80 grid place-items-center"><span class="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin"></span></span>` : ""}
        <input type="file" accept="image/*" data-fpimg="${i}:${j}" class="sr-only"/></label>
      <div class="basis-full sm:basis-0 order-last sm:order-none flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_96px_84px] gap-2">
        <input data-fpn="${i}:${j}" value="${esc(it.name || "")}" placeholder="Product name" maxlength="80" class="${pinp} font-medium w-full min-w-0 col-span-2 sm:col-span-1"/>
        <div class="relative"><span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">₦</span><input data-fpp="${i}:${j}" type="number" min="0" inputmode="numeric" value="${it.price || ""}" placeholder="Price" class="${pinp} w-full pl-6"/></div>
        <input data-fps="${i}:${j}" type="number" min="0" inputmode="numeric" value="${it.stock ?? ""}" placeholder="Stock" title="How many you have. Leave empty if there's no limit." class="${pinp} w-full ${it.stock === 0 ? "border-rose-300 text-rose-600" : ""}"/>
        <input data-fpd="${i}:${j}" value="${esc(it.desc || "")}" placeholder="Short description (optional)" maxlength="120" class="${pinp} w-full min-w-0 col-span-2 sm:col-span-3"/>
      </div>
      <div class="ml-auto sm:ml-0 flex sm:flex-col gap-1 sm:gap-0 text-faint">
        <button data-fpup="${i}:${j}" ${j === 0 ? "disabled" : ""} class="p-2 sm:p-1 rounded hover:text-ink disabled:opacity-30" title="Move up">${fsvg(FI.up, "w-3.5 h-3.5")}</button>
        <button data-fpdel="${i}:${j}" class="p-2 sm:p-1 rounded hover:text-rose-600" title="Remove">${fsvg(FI.trash, "w-3.5 h-3.5")}</button>
      </div>
    </div>`).join("")}
    ${items.length < 30 ? `<button data-fpadd="${i}" class="w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-dark border border-dashed border-brand/40 hover:bg-brand-tint rounded-xl py-2.5">${fsvg(FI.plus, "w-3.5 h-3.5", 2.2)} Add product</button>` : ""}
    <p class="text-[11.5px] text-faint">Customers pick quantities and see a running total. <b class="font-semibold text-muted">Stock</b> is optional: it goes down with each order, shows “Only 3 left” near the end, and the item shows as sold out at 0.</p>
  </div>`;
}

function areasEditor(q, i) {
  const areas = q.areas || [];
  const pinp = "border border-line rounded-lg px-2.5 py-2 text-[13px] bg-white focus:border-brand outline-none min-w-0";
  return `<div class="space-y-1.5 pt-1">
    ${areas.map((a, j) => `<div class="flex items-center gap-2">
      <input data-fan="${i}:${j}" value="${esc(a.name || "")}" placeholder="Area, e.g. Lekki" maxlength="60" class="${pinp} flex-1 font-medium"/>
      <div class="relative w-[120px] shrink-0"><span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">₦</span><input data-faf="${i}:${j}" type="number" min="0" inputmode="numeric" value="${a.fee ?? ""}" placeholder="Fee" class="${pinp} w-full pl-6"/></div>
      <button data-fadel="${i}:${j}" class="p-1.5 rounded-md text-faint hover:bg-rose-50 hover:text-rose-600" title="Remove">${fsvg(FI.trash, "w-3.5 h-3.5")}</button></div>`).join("")}
    ${areas.length < 40 ? `<button data-faadd="${i}" class="w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-dark border border-dashed border-brand/40 hover:bg-brand-tint rounded-xl py-2">${fsvg(FI.plus, "w-3.5 h-3.5", 2.2)} Add area</button>` : ""}
    <p class="text-[11.5px] text-faint">The fee is added to the customer's total. Add “Pickup” with ₦0 if they can collect.</p>
  </div>`;
}

function slotsEditor(q, i) {
  const c = q.slots || (q.slots = { days: [0, 1, 2, 3, 4, 5], times: ["10:00", "12:00", "14:00", "16:00"], capacity: 1, ahead: 14 });
  const pinp = "border border-line rounded-lg px-2.5 py-2 text-[13px] bg-white focus:border-brand outline-none min-w-0";
  return `<div class="space-y-3 pt-1 bg-white border border-line rounded-xl p-3">
    <div><div class="text-[11.5px] font-semibold text-muted mb-1.5">Days you take bookings</div>
      <div class="flex flex-wrap gap-1">${WEEKDAYS.map((d, k) => `<button data-fsday="${i}:${k}" class="w-11 text-[12.5px] font-semibold rounded-lg py-1.5 border transition ${c.days.includes(k) ? "bg-brand text-white border-brand" : "bg-white text-muted border-line hover:text-ink"}">${d}</button>`).join("")}</div></div>
    <label class="block"><span class="text-[11.5px] font-semibold text-muted">Start times</span>
      <input data-fstimes="${i}" value="${esc((c.times || []).join(", "))}" placeholder="10:00, 12:00, 14:00, 16:00" class="${pinp} w-full mt-1"/>
      <span class="text-[11px] text-faint">24-hour times, separated by commas — e.g. 9:00, 11:30, 14:00</span></label>
    <div class="grid grid-cols-2 gap-2">
      <label class="block"><span class="text-[11.5px] font-semibold text-muted">Bookings per slot</span><input data-fscap="${i}" type="number" min="1" max="100" value="${c.capacity || 1}" class="${pinp} w-full mt-1"/></label>
      <label class="block"><span class="text-[11.5px] font-semibold text-muted">How far ahead (days)</span><input data-fsahead="${i}" type="number" min="1" max="90" value="${c.ahead || 14}" class="${pinp} w-full mt-1"/></label>
    </div>
    <p class="text-[11.5px] text-faint">Customers pick a day, then a free time. Booked slots disappear automatically; mark a booking “Lost” to free its slot up again.</p>
  </div>`;
}

function formPreviewHTML(E) {
  const b = brandById(E.brand_id);
  const a = E.accent || "#0e9488";
  const S = { ...FORM_SETTINGS_DEFAULT(), ...(E.settings || {}) };
  const font = formFont(S.font);
  const fld = (label, req, control) => `<div style="margin-bottom:13px"><div style="font-size:12.5px;font-weight:600;margin-bottom:5px">${esc(label)}${req ? `<span style="color:${a}"> *</span>` : ""}</div>${control}</div>`;
  const box = h => `<div style="height:${h}px;border:1.5px solid #e2e8e6;border-radius:11px;background:#fbfcfc"></div>`;
  const chip = (t, on, sub) => `<span style="padding:7px 11px;border-radius:99px;font-size:12px;border:1.5px solid ${on ? a : "#e2e8e6"};background:${on ? a : "#fbfcfc"};color:${on ? "#fff" : "#13312e"}">${esc(t)}${sub ? `<small style="opacity:.75;margin-left:4px;font-weight:600">${sub}</small>` : ""}</span>`;
  let pvTotal = 0, pvCount = 0, pvFee = 0, pvArea = "";
  const prodCards = x => `<div style="display:grid;gap:8px">${(x.items || []).filter(it => it.name || it.price).map((it, k) => {
      const out = it.stock === 0;
      const qty = k === 0 && !out ? 1 : 0; pvTotal += qty * (+it.price || 0); pvCount += qty;
      const badge = out ? `<span style="font-size:9.5px;font-weight:700;color:#5c726e;background:#f4f7f6;border-radius:99px;padding:1px 6px">Sold out</span>`
        : (it.stock != null && it.stock !== "" && +it.stock <= 5) ? `<span style="font-size:9.5px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:99px;padding:1px 6px">Only ${+it.stock} left</span>` : "";
      return `<div style="display:flex;gap:9px;align-items:center;padding:7px;border:1.5px solid ${qty ? a : "#e2e8e6"};border-radius:12px;background:${qty ? `color-mix(in srgb,${a} 6%,#fff)` : "#fbfcfc"};${out ? "opacity:.55" : ""}">
        ${it.image ? `<img src="${esc(it.image)}" style="width:46px;height:46px;border-radius:9px;object-fit:cover;${out ? "filter:grayscale(1)" : ""}"/>` : `<div style="width:46px;height:46px;border-radius:9px;display:grid;place-items:center;font-weight:700;color:${a};background:color-mix(in srgb,${a} 10%,#fff)">${esc((it.name || "?")[0].toUpperCase())}</div>`}
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:12.5px;line-height:1.2;font-family:'${font.head}',sans-serif">${esc(it.name || "Product")}</div>${it.desc ? `<div style="font-size:10.5px;color:#5c726e;margin-top:1px">${esc(it.desc)}</div>` : ""}<div style="font-weight:700;font-size:12px;color:${a};margin-top:2px;display:flex;gap:5px;align-items:center;flex-wrap:wrap">${it.price ? "₦" + (+it.price).toLocaleString() : "Price on request"}${badge}</div></div>
        <div style="display:flex;align-items:center;gap:3px"><span style="width:24px;height:24px;border-radius:50%;border:1.5px solid #e2e8e6;display:grid;place-items:center;font-size:14px">−</span><b style="width:18px;text-align:center;font-size:12.5px">${qty}</b><span style="width:24px;height:24px;border-radius:50%;background:${a};color:#fff;display:grid;place-items:center;font-size:14px">+</span></div></div>`; }).join("") || `<span style="font-size:11px;color:#90a39f">Add products…</span>`}</div>`;
  const areaChips = x => { const ar = (x.areas || []).filter(z => z.name); if (ar[0]) { pvFee = +ar[0].fee || 0; pvArea = ar[0].name; }
    return `<div style="display:flex;flex-wrap:wrap;gap:6px">${ar.map((z, k) => chip(z.name, k === 0, +z.fee ? "₦" + (+z.fee).toLocaleString() : "Free")).join("") || `<span style="font-size:11px;color:#90a39f">Add areas…</span>`}</div>`; };
  const slotPicker = x => {
    const c = x.slots || {}; const days = []; const d0 = new Date();
    for (let k = 0; days.length < 5 && k <= (c.ahead || 14); k++) { const d = new Date(d0); d.setDate(d0.getDate() + k); const wd = (d.getDay() + 6) % 7; if ((c.days || []).includes(wd)) days.push(d); }
    if (!days.length || !(c.times || []).length) return `<span style="font-size:11px;color:#90a39f">Pick days and times…</span>`;
    const t12 = t => { const [h, m] = t.split(":").map(Number); return `${(h % 12) || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`; };
    return `<div style="display:flex;gap:5px;overflow:hidden">${days.map((d, k) => `<span style="flex-shrink:0;width:42px;text-align:center;padding:5px 0;border-radius:10px;border:1.5px solid ${k === 0 ? a : "#e2e8e6"};background:${k === 0 ? a : "#fbfcfc"};color:${k === 0 ? "#fff" : "#13312e"}"><span style="display:block;font-size:8.5px;font-weight:700;text-transform:uppercase;opacity:.8">${WEEKDAYS[(d.getDay() + 6) % 7]}</span><b style="font-size:14px">${d.getDate()}</b></span>`).join("")}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px">${c.times.slice(0, 6).map((t, k) => chip(t12(t), k === 0)).join("")}</div>`;
  };
  const q = E.fields.map(x => fld(x.label || "Untitled question", x.required,
      x.type === "products" ? prodCards(x)
    : x.type === "delivery" ? areaChips(x)
    : x.type === "slots" ? slotPicker(x)
    : x.type === "select" ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${(x.options || []).map((o, i) => chip(o, i === 0)).join("") || `<span style="font-size:11px;color:#90a39f">Add options…</span>`}</div>`
    : box(x.type === "long" ? 70 : 40))).join("");
  const steps = S.layout === "steps";
  const nSteps = E.fields.length + 1;
  const hasCodes = (S.discounts || []).some(d => d.code && d.active !== false) && E.fields.some(x => x.type === "products");
  const band = S.cover ? `<div style="height:150px;background:url('${esc(S.cover)}') center/cover;position:relative"><div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(0,0,0,.35))"></div></div>`
    : `<div style="height:120px;background:linear-gradient(135deg,${a},color-mix(in srgb,${a} 70%,#000))"></div>`;
  const totalShown = pvCount || pvArea;
  return `<div style="font-family:'${font.body}',system-ui,sans-serif;color:#13312e">
    ${band}
    <div style="margin:${S.cover ? "-60px" : "-86px"} 12px 16px;position:relative;background:#fff;border-radius:20px;padding:20px 17px;box-shadow:0 18px 40px -22px rgba(19,49,46,.35)">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:14px">
        ${b?.logo ? `<img src="${esc(b.logo)}" style="width:36px;height:36px;border-radius:10px;object-fit:contain;border:1px solid #e2e8e6"/>` : `<div style="width:36px;height:36px;border-radius:10px;background:${a};color:#fff;display:grid;place-items:center;font-weight:700">${esc((b?.name || E.title || "V")[0].toUpperCase())}</div>`}
        <div style="font-size:11.5px;font-weight:600;color:#5c726e">${esc(b?.name || "")}</div></div>
      <div style="font-size:20px;font-weight:700;line-height:1.15;letter-spacing:-.02em;font-family:'${font.head}',sans-serif">${esc(E.title || "Untitled form")}</div>
      ${E.intro ? `<div style="font-size:13px;color:#5c726e;line-height:1.5;margin:7px 0 0;white-space:pre-line">${esc(E.intro)}</div>` : ""}
      ${steps ? `<div style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:10.5px;font-weight:600;color:#5c726e"><span>1 of ${nSteps}</span><span style="flex:1;height:5px;border-radius:5px;background:#f4f7f6;overflow:hidden"><i style="display:block;height:100%;width:${100 / nSteps}%;background:${a}"></i></span></div>
        <div style="font-size:10.5px;color:#90a39f;margin-top:6px">Customers see one question at a time — all of them are shown here so you can edit.</div>` : ""}
      <div style="margin-top:16px">${fld("Your name", true, box(40))}${fld("Phone / WhatsApp number", true, box(40))}${q}</div>
      ${hasCodes ? fld("Discount code (optional)", false, `<div style="display:flex;gap:6px"><div style="flex:1;height:38px;border:1.5px solid #e2e8e6;border-radius:11px;background:#fbfcfc"></div><span style="padding:0 12px;display:grid;place-items:center;border:1.5px solid ${a};color:${a};border-radius:11px;font-size:12px;font-weight:700">Apply</span></div>`) : ""}
      ${totalShown ? `<div style="padding:10px 13px;border-radius:12px;background:#13312e;color:#fff;font-size:12px;margin:4px 0 2px">
        ${pvArea ? `<div style="display:flex;opacity:.75;font-size:11px;margin-bottom:2px"><span>Delivery · ${esc(pvArea)}</span><span style="margin-left:auto">${pvFee ? "₦" + pvFee.toLocaleString() : "Free"}</span></div>` : ""}
        <div style="display:flex;align-items:center">${pvCount ? pvCount + " item" : "Total"}<b style="margin-left:auto;font-size:14px;font-family:'${font.head}',sans-serif">₦${(pvTotal + pvFee).toLocaleString()}</b></div></div>` : ""}
      <div style="display:flex;gap:8px;font-size:11px;color:#5c726e;line-height:1.45;margin:12px 0"><span style="width:15px;height:15px;border:1.5px solid #cbd5d1;border-radius:4px;flex-shrink:0;margin-top:1px"></span>I agree that ${esc(b?.name || "this business")} can contact me about my request…</div>
      <div style="background:${a};color:#fff;text-align:center;font-weight:700;font-size:14px;padding:12px;border-radius:13px;font-family:'${font.head}',sans-serif">${esc(E.button || "Send")}</div>
    </div></div>`;
}

// Big preview of the form as it stands in the editor (including unsaved changes).
function formPreviewOverlay() {
  const E = state.forms.edit;
  return `<div class="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-6">
    <div data-fprev-close class="absolute inset-0 bg-ink/70 backdrop-blur-sm"></div>
    <div class="relative flex items-center gap-2 mb-3 text-white">
      <span class="text-[13px] font-semibold">Preview · includes unsaved changes</span>
      ${E.id ? `<a href="${formUrl(E)}" target="_blank" class="text-[12.5px] font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5">Open saved form ↗</a>` : ""}
      <button data-fprev-close class="text-[12.5px] font-semibold bg-white text-ink hover:bg-paper rounded-lg px-3 py-1.5">Close</button>
    </div>
    <div class="relative w-[420px] max-w-full rounded-[48px] bg-ink p-3 shadow-2xl ring-1 ring-white/10">
      <div class="rounded-[38px] overflow-hidden bg-[#f4f7f6] h-[min(820px,calc(100vh-110px))] overflow-y-auto scroll-thin">${formPreviewHTML(E)}</div>
    </div></div>`;
}

let _prevEscBound = false;

/* ------------------------------ stats ------------------------------ */
function formStatsModal() {
  const T = state.forms.stats;
  const f = (state.forms.list || []).find(x => x.id === T.id) || {};
  const d = T.data;
  const pct = (n, of) => of ? Math.round((n / of) * 100) : 0;
  let body;
  if (!d) body = `<div class="py-20 text-center text-sm text-muted">Loading…</div>`;
  else {
    const started = Math.max(d.started, d.finished);
    const funnel = [["Saw the form", d.views, ""], ["Started filling it", started, d.views ? pct(started, d.views) + "% of visitors" : ""], ["Sent it", d.finished, started ? pct(d.finished, started) + "% of those who started" : ""]];
    const steps = d.steps.map(s => ({ ...s, n: Math.min(Math.max(s.n, d.finished), started || s.n) }));
    let worst = -1, worstDrop = 0;
    steps.forEach((s, i) => { const prev = i === 0 ? started : steps[i - 1].n; const drop = prev - s.n; if (drop > worstDrop) { worstDrop = drop; worst = i; } });
    const lastDrop = (steps.length ? steps[steps.length - 1].n : started) - d.finished;
    if (lastDrop > worstDrop) { worstDrop = lastDrop; worst = steps.length; }
    const maxDay = Math.max(1, ...d.days.map(x => x.n));
    const maxSrc = Math.max(1, ...d.sources.map(x => x[1]));
    const card = (label, value, sub) => `<div class="bg-paper rounded-xl p-3.5"><div class="text-[10.5px] font-semibold uppercase tracking-wide text-faint">${label}</div><div class="font-display font-extrabold text-[22px] leading-tight mt-0.5">${value}</div>${sub ? `<div class="text-[11px] text-muted">${sub}</div>` : ""}</div>`;
    body = `
      <div class="grid grid-cols-3 gap-2.5">${funnel.map(([l, n, sub], i) => `<div class="relative rounded-xl border border-line p-3.5 ${i === 2 ? "bg-brand-tint/50 border-brand/30" : "bg-white"}">
        <div class="text-[11px] font-semibold text-muted">${l}</div><div class="font-display font-extrabold text-[26px] leading-tight mt-0.5 ${i === 2 ? "text-brand-dark" : ""}">${(n || 0).toLocaleString()}</div><div class="text-[11px] text-faint">${sub || "&nbsp;"}</div></div>`).join("")}</div>
      ${!d.tracked_since ? `<div class="mt-3 text-[12px] text-muted bg-gold-tint/60 border border-gold/20 rounded-xl px-3.5 py-2.5">“Started” and drop-off tracking is new, so those numbers fill in as people visit from now on.</div>` : ""}
      <div class="mt-6">
        <div class="font-display font-bold text-[15px]">Where people stop</div>
        <div class="text-xs text-muted mt-0.5">How many people who started reached each question.</div>
        <div class="mt-3 space-y-1.5">${steps.map((s, i) => `<div class="flex items-center gap-3 text-[13px]">
          <span class="w-5 text-right font-mono text-[11px] text-faint">${i + 1}</span>
          <span class="w-[38%] sm:w-[34%] truncate ${worst === i ? "font-semibold text-rose-700" : ""}">${esc(s.label)}</span>
          <span class="flex-1 h-6 bg-paper rounded-md overflow-hidden relative"><i class="block h-full rounded-md ${worst === i ? "bg-rose-400" : "bg-brand/70"}" style="width:${pct(s.n, started)}%"></i></span>
          <span class="w-14 text-right font-semibold">${started ? pct(s.n, started) + "%" : "—"}</span></div>`).join("")}
          <div class="flex items-center gap-3 text-[13px]"><span class="w-5 text-right text-faint">${fsvg(FI.check, "w-3.5 h-3.5 inline")}</span><span class="w-[38%] sm:w-[34%] truncate font-semibold ${worst === steps.length ? "text-rose-700" : ""}">Sent</span>
          <span class="flex-1 h-6 bg-paper rounded-md overflow-hidden"><i class="block h-full rounded-md ${worst === steps.length ? "bg-rose-400" : "bg-brand"}" style="width:${pct(d.finished, started)}%"></i></span><span class="w-14 text-right font-semibold">${started ? pct(d.finished, started) + "%" : "—"}</span></div>
        </div>
        ${worst > -1 && worstDrop > 0 && started >= 5 ? `<div class="mt-3 text-[12.5px] bg-rose-50 text-rose-800 rounded-xl px-3.5 py-2.5"><b>Biggest drop:</b> ${worstDrop} ${worstDrop === 1 ? "person" : "people"} stopped ${worst === steps.length ? "just before sending — check the consent box and button are clear" : `at “${esc(steps[worst].label)}” — try making it optional, shorter, or adding choices`}.</div>` : ""}
      </div>
      <div class="grid sm:grid-cols-2 gap-5 mt-6">
        <div><div class="font-display font-bold text-[15px]">Last 14 days</div>
          <div class="mt-3 h-[110px] flex items-end gap-1">${d.days.map(x => `<div class="flex-1 flex flex-col items-center justify-end h-full group" title="${esc(x.label)}: ${x.n}">
            <span class="text-[9.5px] font-semibold text-muted opacity-0 group-hover:opacity-100">${x.n}</span>
            <span class="w-full rounded-t-[4px] ${x.n ? "bg-brand" : "bg-line"}" style="height:${x.n ? Math.max(6, (x.n / maxDay) * 92) : 3}px"></span></div>`).join("")}</div>
          <div class="flex justify-between text-[10px] text-faint mt-1"><span>${esc(d.days[0].label)}</span><span>Today</span></div></div>
        <div><div class="font-display font-bold text-[15px]">Where responses came from</div>
          <div class="mt-3 space-y-1.5">${d.sources.length ? d.sources.slice(0, 6).map(([k, n]) => `<div class="flex items-center gap-2 text-[13px]"><span class="w-24 truncate">${esc(SOURCE_LABEL[k] || (k === "direct" ? "Direct link" : k))}</span>
            <span class="flex-1 h-4 bg-paper rounded overflow-hidden"><i class="block h-full bg-ink/70 rounded" style="width:${(n / maxSrc) * 100}%"></i></span><span class="w-8 text-right font-semibold">${n}</span></div>`).join("") : `<div class="text-sm text-faint">No responses yet</div>`}</div></div>
      </div>
      ${d.orders || d.won ? `<div class="grid grid-cols-3 gap-2.5 mt-6">${card("Ordered", naija(d.ordered), `${d.orders} order${d.orders === 1 ? "" : "s"}`)}${card("Average order", d.orders ? naija(d.avg_order) : "—", "")}${card("Won", d.won ? naija(d.won_value) : "—", `${d.won} customer${d.won === 1 ? "" : "s"}`)}</div>` : ""}`;
  }
  return `<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
    <div data-fstats-close class="absolute inset-0 bg-ink/45 backdrop-blur-sm"></div>
    <div class="relative bg-white w-full sm:max-w-2xl rounded-t-[24px] sm:rounded-[24px] shadow-lift max-h-[92vh] overflow-y-auto scroll-thin fade-up">
      <div class="p-6 sm:p-7">
        <div class="flex items-start gap-3 mb-5">
          <div class="w-11 h-11 rounded-xl bg-brand-tint text-brand grid place-items-center shrink-0">${fsvg(FI.chart, "w-5 h-5", 2)}</div>
          <div class="min-w-0"><div class="font-display font-bold text-xl truncate">${esc(f.title || "Form")} stats</div><div class="text-sm text-muted mt-0.5">See who opens it, who fills it, and where people give up.</div></div>
          <button data-fstats-close class="ml-auto text-faint hover:text-ink p-1">${fsvg(FI.x, "w-5 h-5")}</button>
        </div>
        ${body}
      </div>
    </div></div>`;
}

/* ------------------------------ share ------------------------------ */
function formShareModal() {
  const f = state.forms.share;
  const url = formUrl(f);
  const places = [["ig", "Instagram bio"], ["tt", "TikTok bio"], ["wa", "WhatsApp / Status"], ["fb", "Facebook"], ["x", "X"], ["qr", "Printed QR code"]];
  const waText = encodeURIComponent(`${f.title}\n${f.intro ? f.intro + "\n" : ""}\n👉 ${formUrl(f, "wa")}`);
  return `<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
    <div data-fshare-close class="absolute inset-0 bg-ink/45 backdrop-blur-sm"></div>
    <div class="relative bg-white w-full sm:max-w-3xl rounded-t-[24px] sm:rounded-[24px] shadow-lift max-h-[92vh] overflow-y-auto scroll-thin fade-up">
      <div class="p-6 sm:p-7">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl bg-brand-tint text-brand grid place-items-center shrink-0">${fsvg(FI.check, "w-5 h-5", 2.2)}</div>
          <div><div class="font-display font-bold text-xl">Your form is ${f.status === "live" ? "live" : "ready"}</div><div class="text-sm text-muted mt-0.5">Share it anywhere — responses land in Vertil.</div></div>
          <button data-fshare-close class="ml-auto text-faint hover:text-ink p-1">${fsvg(FI.x, "w-5 h-5")}</button>
        </div>
        <div class="flex items-center gap-2 mt-5 bg-paper border border-line rounded-xl p-1.5 pl-3.5">
          <span class="text-brand shrink-0">${fsvg(FI.link)}</span>
          <input readonly value="${esc(url)}" class="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none"/>
          <button data-fcopy="${esc(url)}" class="shrink-0 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg px-4 py-2">Copy link</button>
        </div>
        <div class="grid md:grid-cols-[minmax(0,1fr)_220px] gap-6 mt-6">
          <div class="min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-faint mb-2">Links for each place you share</div>
            <div class="text-xs text-muted mb-3">Use these so you can see which platform each response came from.</div>
            <div class="space-y-1.5">${places.map(([k, l]) => `<div class="flex items-center gap-2 text-sm border border-line rounded-lg px-3 py-2">
              <span class="font-medium w-36 shrink-0">${l}</span><span class="text-xs text-faint truncate flex-1">…/f/${esc(f.slug)}?s=${k}</span>
              <button data-fcopy="${esc(formUrl(f, k))}" class="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark">Copy</button></div>`).join("")}</div>
            <div class="grid sm:grid-cols-2 gap-2 mt-4">
              <a href="https://wa.me/?text=${waText}" target="_blank" class="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2.5" style="background:#25D366"><svg viewBox="0 0 24 24" class="w-4 h-4" fill="#fff">${WA_PATH}</svg> Share on WhatsApp</a>
              <button data-fpost class="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-brand text-brand-dark hover:bg-brand-tint rounded-xl py-2.5">${fsvg(FI.edit, "w-4 h-4")} ${state.config?.social_posting ? "Create a post with it" : "Copy a caption"}</button>
            </div>
            <p class="text-[11.5px] text-faint mt-3">Tip: links in Instagram & TikTok captions aren't clickable — put the form link in your bio and say “link in bio”.</p>
          </div>
          <div class="text-center">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-faint mb-2">QR code</div>
            <div class="rounded-xl2 border border-line p-3 bg-white inline-block"><div id="fQR" class="w-[176px] h-[176px] grid place-items-center text-xs text-faint">Loading…</div></div>
            <button data-fqrdl class="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold border border-line hover:bg-paper rounded-xl py-2">${fsvg(FI.download)} Download PNG</button>
            <div class="text-[11px] text-faint mt-1.5">For your shop counter, flyers & packaging</div>
          </div>
        </div>
      </div>
    </div></div>`;
}

let _qrLib = null;
function loadQRLib() {
  if (window.QRCode) return Promise.resolve();
  if (_qrLib) return _qrLib;
  _qrLib = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return _qrLib;
}
async function drawFormQR() {
  const el = $("#fQR"); if (!el || !state.forms.share) return;
  try {
    await loadQRLib();
    el.innerHTML = "";
    new QRCode(el, { text: formUrl(state.forms.share, "qr"), width: 176, height: 176, colorDark: "#13312e", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  } catch { el.textContent = "QR unavailable offline"; }
}

/* ------------------------------ responses ------------------------------ */
function filteredLeads() {
  const { status, form, q } = state.forms.filter;
  const s = q.trim().toLowerCase();
  return (state.forms.leads || []).filter(l => (status === "all" || l.status === status) && (form === "all" || String(l.form_id) === form)
    && (!s || [l.name, l.phone, l.email, ...(l.answers || []).map(a => a.value)].join(" ").toLowerCase().includes(s)));
}

function responsesView() {
  const F = state.forms;
  const leads = filteredLeads();
  const all = F.leads || [];
  const scoped = all.filter(l => F.filter.form === "all" || String(l.form_id) === F.filter.form);  // status counts follow the form filter
  const counts = s => scoped.filter(l => s === "all" || l.status === s).length;
  const sel = all.find(l => l.id === F.lead) || null;
  const wide = window.matchMedia("(min-width: 1024px)").matches;  // side panel on desktop, bottom sheet on phones
  const row = l => {
    const st = LEAD_STATUS[l.status] || LEAD_STATUS.new;
    const first = (l.answers || []).find(a => a.value)?.value || "";
    return `<button data-flead="${l.id}" class="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-line last:border-0 transition ${F.lead === l.id ? "bg-brand-tint/50" : "hover:bg-paper"}">
      <span class="w-10 h-10 shrink-0 rounded-full grid place-items-center font-bold text-sm ${l.locked ? "bg-paper text-faint" : "bg-brand-tint text-brand-dark"}">${l.locked ? fsvg(FI.lock, "w-4 h-4") : esc((l.name || "?")[0].toUpperCase())}</span>
      <span class="flex-1 min-w-0">
        <span class="flex items-center gap-2"><span class="font-semibold text-[14px] truncate">${esc(l.name)}</span>${l.status === "new" && !l.locked ? `<span class="w-2 h-2 rounded-full bg-gold shrink-0"></span>` : ""}<span class="ml-auto text-[11px] text-faint shrink-0">${relTime(l.created_at)}</span></span>
        <span class="block text-[12.5px] text-muted truncate mt-0.5">${l.locked ? "Upgrade to see this response" : esc(first || l.phone)}</span>
        <span class="flex items-center gap-1.5 mt-1.5"><span class="text-[10.5px] font-semibold rounded-full px-2 py-0.5 ${st[1]}">${st[0]}</span>${l.order_total ? `<span class="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-ink text-white">${naija(l.order_total)}</span>` : ""}<span class="text-[10.5px] text-faint truncate">${esc(l.form_title || "")}${l.source ? " · " + esc(SOURCE_LABEL[l.source] || l.source) : ""}</span></span>
      </span></button>`;
  };
  const empty = `<div class="py-16 text-center px-6"><div class="w-12 h-12 mx-auto rounded-xl bg-paper text-faint grid place-items-center">${fsvg(FI.inbox, "w-6 h-6")}</div>
    <div class="font-semibold mt-3">${all.length ? "No responses match" : "No responses yet"}</div>
    <div class="text-sm text-muted mt-1">${all.length ? "Try a different filter." : "Share your form link — responses will appear here instantly."}</div></div>`;
  return `${F.locked ? `<div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl2 border border-gold/30 bg-gold-tint px-4 py-3 text-sm">
      <span class="text-gold">${fsvg(FI.lock)}</span><span class="flex-1 min-w-[200px]"><b>${F.locked} new response${F.locked === 1 ? "" : "s"} waiting.</b> Free plans show ${F.meta.leads_limit} a month — nothing is lost.</span>
      <button data-nav="pricing" class="text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg px-3.5 py-2">Upgrade to see them</button></div>` : ""}
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <div class="relative flex-1 min-w-[200px] max-w-sm"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-faint">${fsvg(FI.search)}</span>
        <input id="flSearch" value="${esc(F.filter.q)}" placeholder="Search name, phone or answer" class="w-full border border-line rounded-xl pl-9 pr-3 py-2 text-sm bg-white"/></div>
      <select id="flForm" class="border border-line rounded-xl px-3 py-2 text-sm bg-white max-w-[200px]"><option value="all">All forms</option>${(F.list || []).map(f => `<option value="${f.id}" ${F.filter.form === String(f.id) ? "selected" : ""}>${esc(f.title)}</option>`).join("")}</select>
      <div class="ml-auto inline-flex bg-white border border-line rounded-xl p-1 gap-0.5">
        ${[["list", "List", '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'], ["sheet", "Sheet", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>']].map(([k, l, ic]) => `<button data-fview="${k}" class="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-lg transition ${F.view === k ? "bg-brand-tint text-brand-dark" : "text-muted hover:text-ink"}">${fsvg(ic, "w-4 h-4")} ${l}</button>`).join("")}
      </div>
      <a href="/api/leads.csv${F.filter.form !== "all" ? "?form_id=" + F.filter.form : ""}" class="inline-flex items-center gap-1.5 text-sm font-semibold border border-line bg-white hover:bg-paper rounded-xl px-3.5 py-2">${fsvg(FI.download)} Export CSV</a>
    </div>
    <div class="flex gap-1.5 mb-4 overflow-x-auto scroll-thin">${[["all", "All"], ["new", "New"], ["contacted", "Contacted"], ["won", "Won"], ["lost", "Lost"]].map(([k, l]) => `<button data-flst="${k}" class="shrink-0 text-[13px] font-semibold rounded-full px-3.5 py-1.5 border transition ${F.filter.status === k ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:text-ink"}">${l} <span class="opacity-60 font-mono text-[11px]">${counts(k)}</span></button>`).join("")}</div>
    ${F.view === "sheet" ? (F.full ? `<div class="bg-white border border-line rounded-xl2 shadow-card py-16 text-center text-sm text-muted">The sheet is open in full screen.</div>` : leads.length ? sheetView(leads) : `<div class="bg-white border border-line rounded-xl2 shadow-card">${empty}</div>`) : `
    <div class="grid lg:grid-cols-[minmax(0,400px)_1fr] gap-4 items-start">
      <div class="bg-white border border-line rounded-xl2 shadow-card overflow-hidden lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto scroll-thin">${leads.length ? leads.map(row).join("") : empty}</div>
      ${wide ? `<div class="lg:sticky lg:top-6">${sel ? leadDetail(sel) : `<div class="bg-white border border-line rounded-xl2 shadow-card py-24 text-center text-sm text-muted">Select a response to see the details</div>`}</div>` : ""}
    </div>
    `}`;
}

// Detail panel as an overlay: right-hand drawer for the sheet, bottom sheet on phones.
function leadOverlay() {
  const F = state.forms;
  const sel = (F.leads || []).find(l => l.id === F.lead);
  if (!sel) return "";
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  if (F.view === "sheet") return `<div class="fixed inset-0 z-50 flex justify-end"><div data-flead-close class="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"></div><div class="relative w-full max-w-[520px] h-full overflow-y-auto bg-paper p-3 sm:p-4 shadow-lift fade-up">${leadDetail(sel, true)}</div></div>`;
  if (!wide) return `<div class="fixed inset-0 z-50 flex items-end"><div data-flead-close class="absolute inset-0 bg-ink/45"></div><div class="relative w-full max-h-[90vh] overflow-y-auto rounded-t-[24px] bg-paper p-3 fade-up">${leadDetail(sel)}</div></div>`;
  return "";
}

// "5000000" → "5,000,000" for plain numeric answers; everything else unchanged.
function niceAnswer(v) {
  const t = String(v ?? "").trim();
  return /^\d{4,}$/.test(t) ? (+t).toLocaleString("en-NG") : t;
}

function leadDetail(l, drawer) {
  if (l.locked) return `<div class="bg-white border border-line rounded-xl2 shadow-card p-8 text-center">
    <div class="w-12 h-12 mx-auto rounded-xl bg-gold-tint text-gold grid place-items-center">${fsvg(FI.lock, "w-6 h-6")}</div>
    <div class="font-display font-bold text-lg mt-3">This response is waiting for you</div>
    <p class="text-sm text-muted mt-1">Free plans show ${state.forms.meta.leads_limit} responses a month. Upgrade to see this customer's details and reply.</p>
    <button data-nav="pricing" class="mt-4 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-5 py-2.5 rounded-xl">See plans</button></div>`;
  const b = brandById((state.forms.list || []).find(f => f.id === l.form_id)?.brand_id);
  const first = (l.name || "").split(" ")[0];
  const waMsg = encodeURIComponent(`Hi ${first}, thank you for reaching out to ${b?.name || "us"}${l.form_title ? ` about "${l.form_title}"` : ""}. `);
  const date = new Date(l.created_at * 1000).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `<div class="bg-white border border-line rounded-xl2 shadow-card overflow-hidden">
    <div class="p-5 border-b border-line flex items-start gap-3">
      <span class="w-12 h-12 shrink-0 rounded-full bg-brand-tint text-brand-dark grid place-items-center font-bold text-lg">${esc((l.name || "?")[0].toUpperCase())}</span>
      <div class="min-w-0 flex-1">
        <div class="font-display font-bold text-lg leading-tight">${esc(l.name)}</div>
        <div class="text-sm text-muted mt-0.5">${esc(l.phone)}${l.email ? " · " + esc(l.email) : ""}</div>
        <div class="text-[11.5px] text-faint mt-1">${date} · ${esc(l.form_title || "")}${l.source ? " · via " + esc(SOURCE_LABEL[l.source] || l.source) : ""}</div>
      </div>
      <button data-flead-close class="${window.matchMedia("(min-width: 1024px)").matches && !drawer ? "hidden" : ""} text-faint hover:text-ink p-1">${fsvg(FI.x, "w-5 h-5")}</button>
    </div>
    <div class="p-5 grid grid-cols-2 gap-2">
      <a data-flwa="${l.id}" href="https://wa.me/${waNumber(l.phone)}?text=${waMsg}" target="_blank" class="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-2.5" style="background:#25D366"><svg viewBox="0 0 24 24" class="w-4 h-4" fill="#fff">${WA_PATH}</svg> Reply on WhatsApp</a>
      <a data-flwa="${l.id}" href="tel:${esc(l.phone)}" class="inline-flex items-center justify-center gap-2 text-sm font-semibold border border-line hover:bg-paper rounded-xl py-2.5">${fsvg(FI.phone)} Call</a>
    </div>
    <div class="px-5 pb-5 space-y-3">
      ${(l.answers || []).map(a => a.items ? `<div class="rounded-xl border border-line overflow-hidden">
          <div class="px-4 py-2.5 bg-paper text-[11.5px] font-semibold text-muted flex items-center">${esc(a.label)}<span class="ml-auto text-[10.5px] font-bold uppercase tracking-wide text-brand-dark bg-brand-tint rounded-full px-2 py-0.5">Order</span></div>
          ${a.items.length ? a.items.map(x => `<div class="flex items-center gap-3 px-4 py-2 text-[14px] border-t border-line"><span class="font-mono text-[12.5px] text-muted w-8">${x.qty}×</span><span class="flex-1">${esc(x.name)}</span><span class="font-semibold">${naija(x.qty * x.price)}</span></div>`).join("") : `<div class="px-4 py-2 text-sm text-faint border-t border-line">Nothing selected</div>`}
          ${l.order_total != null && Math.round(l.order_total) !== Math.round(a.total || 0) ? `
          <div class="flex items-center px-4 py-2 border-t border-line text-[13px] text-muted"><span>Items</span><span class="ml-auto">${naija(a.total)}</span></div>
          ${(l.answers || []).filter(x => x.id === "_code" || x.fee != null).map(x => `<div class="flex items-center px-4 py-2 border-t border-line text-[13px] text-muted"><span>${x.id === "_code" ? "Discount · " + esc(x.code || "") : "Delivery · " + esc(String(x.value).replace(/\s*\(.*\)$/, ""))}</span><span class="ml-auto">${x.id === "_code" ? "−" + naija(x.off) : x.fee ? naija(x.fee) : "Free"}</span></div>`).join("")}
          <div class="flex items-center px-4 py-2.5 border-t border-line bg-brand-tint/40 font-display font-bold"><span>Total</span><span class="ml-auto text-brand-dark text-[17px]">${naija(l.order_total)}</span></div>` : `
          <div class="flex items-center px-4 py-2.5 border-t border-line bg-brand-tint/40 font-display font-bold"><span>Total</span><span class="ml-auto text-brand-dark text-[17px]">${naija(a.total)}</span></div>`}
        </div>` : `<div class="rounded-xl bg-paper px-4 py-3"><div class="text-[11.5px] font-semibold text-muted">${esc(a.label)}</div><div class="text-[14.5px] mt-1 whitespace-pre-line">${esc(niceAnswer(a.value)) || '<span class="text-faint">—</span>'}</div></div>`).join("")}
    </div>
    <div class="px-5 py-4 border-t border-line bg-paper/50 space-y-3">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-faint">Status</div>
      <div class="grid grid-cols-4 gap-1.5">${Object.entries(LEAD_STATUS).map(([k, [lab]]) => `<button data-flstatus="${k}" data-id="${l.id}" class="text-[12.5px] font-semibold rounded-lg py-2 border transition ${l.status === k ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:text-ink"}">${lab}</button>`).join("")}</div>
      ${l.status === "won" ? `<label class="block"><span class="text-xs font-semibold text-muted">Sale value (₦)</span><input id="flValue" data-id="${l.id}" type="number" min="0" inputmode="numeric" value="${l.value ?? ""}" placeholder="e.g. 45000" class="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm bg-white"/></label>` : ""}
      <label class="block"><span class="text-xs font-semibold text-muted">Private notes</span><textarea id="flNotes" data-id="${l.id}" rows="2" placeholder="e.g. Wants delivery to Ikeja on Saturday" class="mt-1 w-full border border-line rounded-xl px-3 py-2 text-sm bg-white resize-none">${esc(l.notes || "")}</textarea></label>
      <div class="flex items-center justify-between pt-1">
        <span class="text-[11px] text-faint">Consent given ${l.consent_at ? relTime(l.consent_at) : ""}</span>
        <button data-fldel="${l.id}" class="text-xs font-semibold text-rose-600 hover:underline">Delete response</button>
      </div>
    </div>
  </div>`;
}

/* ------------------------------ actions ------------------------------ */
function openFormPicker(template) {
  if ((state.forms.list || []).length >= (state.forms.meta.limit || 1)) {
    toast(`Your plan includes ${state.forms.meta.limit} form${state.forms.meta.limit === 1 ? "" : "s"} — upgrade for more.`); return goto("pricing");
  }
  state.forms.picker = { template: template || "food", brand_id: state.activeBrandId || state.brands?.[0]?.id || null, brief: "", ai: !!state.config?.live };
  render();
}

async function startFormFromPicker() {
  const P = state.forms.picker;
  P.brand_id = +($("#fpBrand")?.value || 0) || null; P.brief = $("#fpBrief")?.value || ""; P.ai = !!$("#fpAI")?.checked;
  state.forms.drafting = true; render();
  try {
    const d = P.ai ? await api("/api/forms/draft", { method: "POST", body: JSON.stringify({ template: P.template, brand_id: P.brand_id, brief: P.brief }) })
                   : await api(`/api/forms/template/${P.template}`);
    const b = brandById(P.brand_id);
    state.forms.edit = { id: null, brand_id: P.brand_id, template: P.template, title: d.title, intro: d.intro || "", fields: d.fields || [],
      button: d.button || "Send", thanks: d.thanks || "", accent: (b?.colors ? String(b.colors).split(",")[0] : "") || "#0e9488",
      whatsapp: state.user?.phone || "", status: "live", slug: "", settings: FORM_SETTINGS_DEFAULT() };
    state.forms.slugError = "";
    state.forms.picker = null;
  } catch (e) { toast("⚠ " + e.message); }
  state.forms.drafting = false; render(); window.scrollTo(0, 0);
}

async function saveForm() {
  const E = state.forms.edit;
  if (!E.title.trim()) return toast("⚠ Give your form a title");
  const bad = E.fields.find(q => q.type === "select" && !(q.options || []).length);
  if (bad) return toast(`⚠ Add options for “${bad.label || "your choice question"}”`);
  const noProd = E.fields.find(q => q.type === "products" && !(q.items || []).some(it => (it.name || "").trim()));
  if (noProd) return toast("⚠ Add at least one product with a name");
  const noArea = E.fields.find(q => q.type === "delivery" && !(q.areas || []).some(a => (a.name || "").trim()));
  if (noArea) return toast("⚠ Add at least one delivery area");
  const noTimes = E.fields.find(q => q.type === "slots" && (!(q.slots?.days || []).length || !(q.slots?.times || []).length));
  if (noTimes) return toast("⚠ Pick at least one day and one time for your booking slots");
  const S = E.settings || {};
  const badCode = (S.discounts || []).find(d => (d.code || "").replace(/[^A-Za-z0-9]/g, "").length < 3 || !(+d.amount > 0));
  if (badCode) return toast("⚠ Each discount code needs at least 3 letters/numbers and an amount");
  if (S.close_at && S.close_at * 1000 < Date.now() && E.status === "live" && !confirm("The closing date is in the past, so this form will show as closed. Save anyway?")) return;
  state.forms.saving = true; state.forms.slugError = ""; render();
  const body = { brand_id: E.brand_id, template: E.template, title: E.title, intro: E.intro, fields: E.fields, button: E.button,
    thanks: E.thanks, accent: E.accent, whatsapp: E.whatsapp, status: E.status, settings: E.settings };
  if (E.id || (E.slug || "").trim()) body.slug = E.slug || "";
  try {
    const f = E.id ? await api(`/api/forms/${E.id}`, { method: "PUT", body: JSON.stringify(body) })
                   : await api("/api/forms", { method: "POST", body: JSON.stringify(body) });
    const isNew = !E.id;
    state.forms.edit = null; await loadForms();
    toast(isNew ? "Form published" : "Saved");
    if (isNew) { state.forms.share = state.forms.list.find(x => x.id === f.id) || f; }
  } catch (e) {
    toast("⚠ " + e.message);
    if (e.data?.field === "slug") { state.forms.slugError = e.message; state.forms.saving = false; render(); return $("#feSlug")?.focus(); }
    if (e.data?.upgrade) { state.forms.saving = false; return goto("pricing"); }
  }
  state.forms.saving = false; render();
}

async function patchLead(id, body, quiet) {
  try {
    const l = await api(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(body) });
    const i = state.forms.leads.findIndex(x => x.id === id);
    if (i > -1) state.forms.leads[i] = { ...state.forms.leads[i], ...l };
    state.forms.list = (await api("/api/forms")).forms;
    if (!quiet) render();
  } catch (e) { toast("⚠ " + e.message); }
}

function syncEditorFromInputs() {
  const E = state.forms.edit; if (!E) return;
  const v = id => $(id)?.value;
  if ($("#feTitle")) E.title = v("#feTitle"); if ($("#feIntro")) E.intro = v("#feIntro");
  if ($("#feButton")) E.button = v("#feButton"); if ($("#feThanks")) E.thanks = v("#feThanks"); if ($("#feWa")) E.whatsapp = v("#feWa");
  $$("[data-fql]").forEach(el => { E.fields[+el.dataset.fql].label = el.value; });
  $$("[data-fqo]").forEach(el => { E.fields[+el.dataset.fqo].options = el.value.split(",").map(s => s.trim()).filter(Boolean); });
  const P = (el, attr) => { const [i, j] = el.dataset[attr].split(":").map(Number); return E.fields[i].items[j]; };
  $$("[data-fpn]").forEach(el => { P(el, "fpn").name = el.value; });
  $$("[data-fpp]").forEach(el => { P(el, "fpp").price = el.value === "" ? "" : Math.max(0, Math.round(+el.value || 0)); });
  $$("[data-fpd]").forEach(el => { P(el, "fpd").desc = el.value; });
  $$("[data-fps]").forEach(el => { P(el, "fps").stock = el.value === "" ? null : Math.max(0, Math.round(+el.value || 0)); });
  const A = (el, attr) => { const [i, j] = el.dataset[attr].split(":").map(Number); return E.fields[i].areas[j]; };
  $$("[data-fan]").forEach(el => { A(el, "fan").name = el.value; });
  $$("[data-faf]").forEach(el => { A(el, "faf").fee = el.value === "" ? "" : Math.max(0, Math.round(+el.value || 0)); });
  $$("[data-fstimes]").forEach(el => { E.fields[+el.dataset.fstimes].slots.times = el.value.split(/[,\s]+/).map(t => t.trim().replace(".", ":")).filter(t => /^\d{1,2}:\d{2}$/.test(t)).map(t => t.padStart(5, "0")); });
  $$("[data-fscap]").forEach(el => { E.fields[+el.dataset.fscap].slots.capacity = Math.max(1, +el.value || 1); });
  $$("[data-fsahead]").forEach(el => { E.fields[+el.dataset.fsahead].slots.ahead = Math.max(1, +el.value || 14); });
  const S = E.settings || (E.settings = FORM_SETTINGS_DEFAULT());
  $$("[data-fdc]").forEach(el => { S.discounts[+el.dataset.fdc].code = el.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
  $$("[data-fda]").forEach(el => { S.discounts[+el.dataset.fda].amount = el.value === "" ? "" : Math.max(0, Math.round(+el.value || 0)); });
  $$("[data-fdk]").forEach(el => { S.discounts[+el.dataset.fdk].kind = el.value; });
  $$("[data-fdm]").forEach(el => { S.discounts[+el.dataset.fdm].max_uses = Math.max(0, Math.round(+el.value || 0)); });
  $$("[data-fdon]").forEach(el => { S.discounts[+el.dataset.fdon].active = el.checked; });
  if ($("#feSlug")) E.slug = v("#feSlug").trim().toLowerCase();
  if ($("#feCloseAt")) { const t = v("#feCloseAt"); S.close_at = t ? Math.floor(new Date(t).getTime() / 1000) : 0; }
  if ($("#feMax")) S.max_responses = Math.max(0, Math.round(+v("#feMax") || 0));
  if ($("#feClosedMsg")) S.closed_msg = v("#feClosedMsg");
  if ($("#feAuto")) S.autoreply = $("#feAuto").checked;
}
function refreshPreview() { const p = $("#fPrev"); if (p && state.forms.edit) p.innerHTML = formPreviewHTML(state.forms.edit); }

function wireForms() {
  const F = state.forms;
  $$("[data-ftab]").forEach(b => b.onclick = () => { F.tab = b.dataset.ftab; render(); });
  $$("[data-fnew]").forEach(b => b.onclick = () => openFormPicker());
  $$("[data-fpick]").forEach(b => b.onclick = () => openFormPicker(b.dataset.fpick));
  $$("[data-fpick-close]").forEach(b => b.onclick = () => { F.picker = null; render(); });
  $$("[data-ftpl]").forEach(b => b.onclick = () => { F.picker.brand_id = +($("#fpBrand")?.value || 0) || null; F.picker.brief = $("#fpBrief")?.value || ""; F.picker.ai = !!$("#fpAI")?.checked; F.picker.template = b.dataset.ftpl; render(); });
  const go = $("[data-fpick-go]"); if (go) go.onclick = startFormFromPicker;
  $$("[data-fmenu]").forEach(b => b.onclick = e => { e.stopPropagation(); F.menu = F.menu === +b.dataset.fmenu ? null : +b.dataset.fmenu; render(); });
  $$("[data-fmenu-close]").forEach(b => b.onclick = () => { F.menu = null; render(); });
  $$("[data-ftoggle]").forEach(b => b.onclick = async () => {
    const f = F.list.find(x => x.id === +b.dataset.ftoggle); F.menu = null;
    await api(`/api/forms/${f.id}`, { method: "PUT", body: JSON.stringify({ status: f.status === "live" ? "paused" : "live" }) });
    await loadForms(); toast(f.status === "live" ? "Form paused" : "Form is live"); render();
  });
  $$("[data-fdel]").forEach(b => b.onclick = async () => {
    const f = F.list.find(x => x.id === +b.dataset.fdel); F.menu = null;
    if (!confirm(`Delete “${f.title}”? Its link will stop working and its ${f.responses || 0} response(s) will be deleted.`)) return render();
    await api(`/api/forms/${f.id}`, { method: "DELETE" }); await loadForms(); toast("Form deleted"); render();
  });
  $$("[data-fdup]").forEach(b => b.onclick = async () => {
    F.menu = null;
    try {
      const f = await api(`/api/forms/${b.dataset.fdup}/duplicate`, { method: "POST" });
      await loadForms(); toast("Copy made — it's paused until you're ready");
      F.edit = JSON.parse(JSON.stringify(F.list.find(x => x.id === f.id) || f)); F.slugError = ""; render(); window.scrollTo(0, 0);
    } catch (e) { toast("⚠ " + e.message); if (e.data?.upgrade) return goto("pricing"); render(); }
  });
  $$("[data-fstats]").forEach(b => b.onclick = async () => {
    const id = +b.dataset.fstats; F.menu = null; F.stats = { id, data: null }; render();
    try { const d = await api(`/api/forms/${id}/stats`); if (F.stats?.id === id) { F.stats.data = d; render(); } }
    catch (e) { toast("⚠ " + e.message); F.stats = null; render(); }
  });
  $$("[data-fstats-close]").forEach(b => b.onclick = () => { F.stats = null; render(); });
  $$("[data-fedit]").forEach(b => b.onclick = () => { const f = F.list.find(x => x.id === +b.dataset.fedit); F.edit = JSON.parse(JSON.stringify(f)); render(); window.scrollTo(0, 0); });
  $$("[data-fresp]").forEach(b => b.onclick = () => { F.tab = "responses"; F.filter.form = b.dataset.fresp; F.lead = null; render(); });
  $$("[data-fshare]").forEach(b => b.onclick = () => { F.share = F.list.find(x => x.id === +b.dataset.fshare); render(); });
  $$("[data-fshare-close]").forEach(b => b.onclick = () => { F.share = null; render(); });
  $$("[data-fcopy]").forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.fcopy); const t = b.textContent; b.textContent = "Copied ✓"; setTimeout(() => b.textContent = t, 1400); });
  const qd = $("[data-fqrdl]"); if (qd) qd.onclick = () => {
    const src = $("#fQR canvas")?.toDataURL("image/png") || $("#fQR img")?.src; if (!src) return;
    const a = document.createElement("a"); a.href = src; a.download = `${F.share.slug}-qr.png`; a.click();
  };
  const fp = $("[data-fpost]"); if (fp) fp.onclick = () => {
    const f = F.share;
    const caption = `${f.title} 👇\n${f.intro ? f.intro + "\n" : ""}\nFill the form: ${formUrl(f, "post")}\n(On Instagram or TikTok? Tap the link in our bio.)`;
    if (state.config?.social_posting) { F.share = null; openComposer({ base: caption, brandId: f.brand_id || state.activeBrandId }); }
    else { navigator.clipboard?.writeText(caption); toast("Caption copied — paste it into your post"); }
  };
  if (F.share) drawFormQR();

  // editor
  if (F.edit) {
    const E = F.edit;
    const back = $("[data-fback]"); if (back) back.onclick = () => { if (confirm("Leave without saving?")) { F.edit = null; render(); } };
    ["#feTitle", "#feIntro", "#feButton", "#feThanks", "#feWa"].forEach(id => { const el = $(id); if (el) el.oninput = () => { syncEditorFromInputs(); refreshPreview(); }; });
    $$("[data-fql],[data-fqo],[data-fpn],[data-fpp],[data-fpd]").forEach(el => el.oninput = () => { syncEditorFromInputs(); refreshPreview(); });
    const newItem = () => ({ id: "p" + Date.now().toString(36) + Math.floor(Math.random() * 99), name: "", price: "", image: "", desc: "", stock: null });
    const newAreas = () => [{ id: "a1", name: "Pickup", fee: 0 }, { id: "a2", name: "Mainland", fee: 2500 }, { id: "a3", name: "Island", fee: 3500 }];
    const newSlots = () => ({ days: [0, 1, 2, 3, 4, 5], times: ["10:00", "12:00", "14:00", "16:00"], capacity: 1, ahead: 14 });
    $$("[data-fpadd]").forEach(el => el.onclick = () => {
      syncEditorFromInputs(); const q = E.fields[+el.dataset.fpadd]; (q.items = q.items || []).push(newItem()); render();
      setTimeout(() => { const n = $$(`[data-fpn^="${el.dataset.fpadd}:"]`); n[n.length - 1]?.focus(); }, 30);
    });
    $$("[data-fpdel]").forEach(el => el.onclick = () => { syncEditorFromInputs(); const [i, j] = el.dataset.fpdel.split(":").map(Number); E.fields[i].items.splice(j, 1); render(); });
    $$("[data-fpup]").forEach(el => el.onclick = () => { syncEditorFromInputs(); const [i, j] = el.dataset.fpup.split(":").map(Number); const it = E.fields[i].items; [it[j - 1], it[j]] = [it[j], it[j - 1]]; render(); });
    $$("[data-fpimg]").forEach(el => el.onchange = async () => {
      const file = el.files[0]; if (!file) return;
      syncEditorFromInputs(); const [i, j] = el.dataset.fpimg.split(":").map(Number);
      F.uploading = `${i}:${j}`; render();
      try {
        const fd = new FormData(); fd.append("image", file);
        const r = await fetch("/api/forms/media", { method: "POST", body: fd }); const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Upload failed");
        E.fields[i].items[j].image = d.url;
      } catch (e) { toast("⚠ " + e.message); }
      F.uploading = null; render();
    });
    const br = $("#feBrand"); if (br) br.onchange = () => { syncEditorFromInputs(); E.brand_id = +br.value || null; render(); };
    const lv = $("#feLive"); if (lv) lv.onchange = () => { E.status = lv.checked ? "live" : "paused"; };
    $$("[data-fqt]").forEach(el => el.onchange = () => { syncEditorFromInputs(); const q = E.fields[+el.dataset.fqt]; q.type = el.value; if (q.type === "select" && !(q.options || []).length) q.options = ["Option 1", "Option 2"]; if (q.type === "products" && !(q.items || []).length) q.items = [newItem()]; if (q.type === "delivery" && !(q.areas || []).length) q.areas = newAreas(); if (q.type === "slots" && !q.slots) q.slots = newSlots(); render(); });
    $$("[data-fqr]").forEach(el => el.onchange = () => { E.fields[+el.dataset.fqr].required = el.checked; refreshPreview(); });
    $$("[data-fqup],[data-fqdn]").forEach(el => el.onclick = () => { syncEditorFromInputs(); const i = +(el.dataset.fqup ?? el.dataset.fqdn), j = el.dataset.fqup != null ? i - 1 : i + 1; [E.fields[i], E.fields[j]] = [E.fields[j], E.fields[i]]; render(); });
    $$("[data-fqdel]").forEach(el => el.onclick = () => { syncEditorFromInputs(); E.fields.splice(+el.dataset.fqdel, 1); render(); });
    $$("[data-fqadd]").forEach(el => el.onclick = () => {
      syncEditorFromInputs(); const t = el.dataset.fqadd;
      if (E.fields.length >= FORM_MAX_FIELDS) return toast(`That's the maximum of ${FORM_MAX_FIELDS} questions`);
      const entry = { id: "q" + Date.now().toString(36), type: t, label: { products: "Choose your items", delivery: "Where should we deliver?", slots: "Pick a time", short: "Your question", long: "Tell us more", select: "Choose one", date: "Preferred date", number: "Budget (₦)", email: "Email address" }[t], required: ["products", "delivery", "slots"].includes(t), ...(t === "select" ? { options: ["Option 1", "Option 2"] } : {}), ...(t === "products" ? { items: [newItem()] } : {}), ...(t === "delivery" ? { areas: newAreas() } : {}), ...(t === "slots" ? { slots: newSlots() } : {}) };
      if (t === "products") E.fields.unshift(entry); else E.fields.push(entry);
      render(); setTimeout(() => { if (t === "products") { $$('[data-fpn^="0:"]')[0]?.focus(); return; } const els = $$("[data-fql]"); const last = els[els.length - 1]; if (last) { last.focus(); last.select(); } }, 30);
    });
    $$("[data-fcolor]").forEach(el => el.onclick = () => { syncEditorFromInputs(); E.accent = el.dataset.fcolor; render(); });
    const cc = $("#feColor"); if (cc) cc.oninput = () => { syncEditorFromInputs(); E.accent = cc.value; refreshPreview(); };
    const S = E.settings;
    $$("[data-fps],[data-fan],[data-faf],[data-fstimes],[data-fscap],[data-fsahead],[data-fdc],[data-fda],[data-fdm]").forEach(el => el.oninput = () => { syncEditorFromInputs(); refreshPreview(); });
    $$("[data-fdk],[data-fdon]").forEach(el => el.onchange = () => { syncEditorFromInputs(); refreshPreview(); });
    ["#feCloseAt", "#feMax", "#feClosedMsg", "#feSlug"].forEach(id => { const el = $(id); if (el) el.oninput = () => syncEditorFromInputs(); });
    const au = $("#feAuto"); if (au) au.onchange = () => syncEditorFromInputs();
    const dg = $("#feDigest"); if (dg) dg.onchange = async () => {
      try { const r = await api("/api/forms/prefs", { method: "PUT", body: JSON.stringify({ digest: dg.checked }) }); F.meta.digest = r.digest; toast(r.digest ? "Morning summary on" : "Morning summary off"); }
      catch (e) { toast("⚠ " + e.message); dg.checked = !dg.checked; }
    };
    $$("[data-ffont]").forEach(el => el.onclick = () => { syncEditorFromInputs(); S.font = el.dataset.ffont; render(); });
    $$("[data-flayout]").forEach(el => el.onclick = () => { syncEditorFromInputs(); S.layout = el.dataset.flayout; render(); });
    const cv = $("[data-fcover]"); if (cv) cv.onchange = async () => {
      const file = cv.files[0]; if (!file) return;
      syncEditorFromInputs(); F.uploading = "cover"; render();
      try {
        const fd = new FormData(); fd.append("image", file); fd.append("kind", "cover");
        const r = await fetch("/api/forms/media", { method: "POST", body: fd }); const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Upload failed");
        E.settings.cover = d.url;
      } catch (e) { toast("⚠ " + e.message); }
      F.uploading = null; render();
    };
    $$("[data-fprevfull]").forEach(el => el.onclick = () => { syncEditorFromInputs(); F.prevFull = true; render(); });
    $$("[data-fprev-close]").forEach(el => el.onclick = () => { F.prevFull = false; render(); });
    if (!_prevEscBound) { _prevEscBound = true; document.addEventListener("keydown", e => { if (e.key === "Escape" && state.forms.prevFull) { state.forms.prevFull = false; render(); } }); }
    const cvr = $("[data-fcover-rm]"); if (cvr) cvr.onclick = () => { syncEditorFromInputs(); S.cover = ""; render(); };
    $$("[data-faadd]").forEach(el => el.onclick = () => {
      syncEditorFromInputs(); const q = E.fields[+el.dataset.faadd]; (q.areas = q.areas || []).push({ id: "a" + Date.now().toString(36), name: "", fee: "" }); render();
      setTimeout(() => { const n = $$(`[data-fan^="${el.dataset.faadd}:"]`); n[n.length - 1]?.focus(); }, 30);
    });
    $$("[data-fadel]").forEach(el => el.onclick = () => { syncEditorFromInputs(); const [i, j] = el.dataset.fadel.split(":").map(Number); E.fields[i].areas.splice(j, 1); render(); });
    $$("[data-fsday]").forEach(el => el.onclick = () => {
      syncEditorFromInputs(); const [i, k] = el.dataset.fsday.split(":").map(Number); const c = E.fields[i].slots;
      c.days = c.days.includes(k) ? c.days.filter(x => x !== k) : [...c.days, k].sort(); render();
    });
    $$("[data-fdadd]").forEach(el => el.onclick = () => {
      syncEditorFromInputs(); S.discounts.push({ code: "", kind: "percent", amount: 10, max_uses: 0, used: 0, active: true }); render();
      setTimeout(() => { const n = $$("[data-fdc]"); n[n.length - 1]?.focus(); }, 30);
    });
    $$("[data-fddel]").forEach(el => el.onclick = () => { syncEditorFromInputs(); S.discounts.splice(+el.dataset.fddel, 1); render(); });
    const sv = $("[data-fsave]"); if (sv) sv.onclick = () => { syncEditorFromInputs(); saveForm(); };
    const ai = $("[data-fai]"); if (ai) ai.onclick = async () => {
      syncEditorFromInputs(); const brief = $("#feBrief").value.trim();
      F.drafting = true; render();
      try {
        const d = await api("/api/forms/draft", { method: "POST", body: JSON.stringify({ template: E.template || "general", brand_id: E.brand_id, brief, keep_fields: E.fields }) });
        Object.assign(E, { title: d.title, intro: d.intro || E.intro, fields: d.fields || E.fields, button: d.button || E.button, thanks: d.thanks || E.thanks });
        toast("Rewritten in your brand voice");
      } catch (e) { toast("⚠ " + e.message); }
      F.drafting = false; render();
    };
  }

  // responses
  $$("[data-flst]").forEach(b => b.onclick = () => { F.filter.status = b.dataset.flst; render(); });
  const fs = $("#flSearch"); if (fs) fs.oninput = () => { F.filter.q = fs.value; const pos = fs.selectionStart; render(); const n = $("#flSearch"); n.focus(); n.setSelectionRange(pos, pos); };
  const ff = $("#flForm"); if (ff) ff.onchange = () => { F.filter.form = ff.value; render(); };
  $$("[data-flead]").forEach(b => b.onclick = () => { F.lead = +b.dataset.flead; render(); });
  $$("[data-flead-close]").forEach(b => b.onclick = () => { F.lead = null; render(); });
  $$("[data-flstatus]").forEach(b => b.onclick = () => {
    const l = F.leads.find(x => x.id === +b.dataset.id);
    const body = { status: b.dataset.flstatus };
    if (body.status === "won" && l && l.value == null && l.order_total) body.value = l.order_total;  // won at the ordered amount
    patchLead(+b.dataset.id, body);
  });
  $$("[data-flwa]").forEach(a => a.addEventListener("click", () => { const l = F.leads.find(x => x.id === +a.dataset.flwa); if (l && l.status === "new") patchLead(l.id, { status: "contacted" }); }));
  const fv = $("#flValue"); if (fv) fv.onchange = () => patchLead(+fv.dataset.id, { value: fv.value }, true).then(render);
  const fn = $("#flNotes"); if (fn) fn.onblur = () => { const l = F.leads.find(x => x.id === +fn.dataset.id); if (l && (l.notes || "") !== fn.value) patchLead(l.id, { notes: fn.value }, true).then(() => toast("Note saved")); };
  $$("[data-fldel]").forEach(b => b.onclick = async () => {
    if (!confirm("Delete this response permanently? Do this if the customer asked to be removed.")) return;
    await api(`/api/leads/${b.dataset.fldel}`, { method: "DELETE" }); F.lead = null; await loadForms(); toast("Response deleted"); render();
  });
}

/* ------------------------------ sheet view ------------------------------
   Spreadsheet-style grid of responses: sortable, reorderable (drag headers),
   resizable columns, row-size options, full-screen mode, inline editing
   (status, sale value, notes) and multi-select bulk actions. Layout is
   remembered per browser. */
const SHEET_NUM = ["created_at", "order_total", "value"];
const SHEET_DENSITY = { compact: "py-1 text-[12.5px]", normal: "py-2 text-[13px]", large: "py-3.5 text-[14px]" };
const sheetLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const sheetSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function sheetPrefs() {
  const F = state.forms;
  if (!F.sheetInit) {
    F.colOrder = sheetLS("vformsColOrder", []);
    F.colW = sheetLS("vformsColW", {});
    F.density = sheetLS("vformsDensity", "normal");
    F.sheetInit = true;
  }
  if (!F.sel) F.sel = new Set();
}

function sheetColumns(leads) {
  const F = state.forms;
  const multiForm = F.filter.form === "all" && (F.list || []).length > 1;
  const qLabels = [];
  leads.forEach(l => (l.answers || []).forEach(a => { if (!qLabels.includes(a.label)) qLabels.push(a.label); }));
  const cols = [
    { k: "name", label: "Name", w: 200 },
    { k: "phone", label: "Phone", w: 160 },
    { k: "status", label: "Status", w: 140 },
    ...(leads.some(l => l.order_total) ? [{ k: "order_total", label: "Order ₦", w: 140, num: true }] : []),
    { k: "value", label: "Sale value ₦", w: 160, num: true },
    { k: "created_at", label: "Received", w: 150 },
    { k: "source", label: "Source", w: 116 },
    ...(multiForm ? [{ k: "form", label: "Form", w: 170 }] : []),
    ...qLabels.map(lb => ({ k: "q:" + lb, label: lb, w: 210 })),
    { k: "notes", label: "Notes", w: 260 },
  ];
  // apply the person's saved order (Name always stays first, it's the frozen column)
  const order = F.colOrder || [];
  const rank = k => { const i = order.indexOf(k); return i === -1 ? 1000 + cols.findIndex(c => c.k === k) : i; };
  const rest = cols.filter(c => c.k !== "name").sort((a, b) => rank(a.k) - rank(b.k));
  return [cols[0], ...rest].map(c => ({ ...c, w: Math.max(80, Math.min(640, (F.colW || {})[c.k] || c.w)) }));
}

function sheetVal(l, k) {
  if (k.startsWith("q:")) {
    const a = (l.answers || []).find(x => x.label === k.slice(2));
    if (!a) return "";
    return a.items ? a.items.map(x => `${x.qty}× ${x.name}`).join(", ") : (a.value || "");
  }
  if (k === "form") return l.form_title || "";
  if (k === "source") return SOURCE_LABEL[l.source] || l.source || "";
  return l[k] ?? "";
}

function sheetView(leads) {
  sheetPrefs();
  const F = state.forms;
  const all = sheetColumns(leads);
  const cols = all.filter(c => c.k === "name" || !F.hidden.has(c.k));
  const { key, dir } = F.sort;
  const rows = [...leads].sort((a, b) => {
    const x = sheetVal(a, key), y = sheetVal(b, key);
    if (SHEET_NUM.includes(key)) return ((+x || 0) - (+y || 0)) * dir;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
  const dens = SHEET_DENSITY[F.density] || SHEET_DENSITY.normal;
  const selN = rows.filter(l => F.sel.has(l.id)).length;
  const selectable = rows.filter(l => !l.locked).length;
  const allSel = selectable && selN === selectable;
  const sum = k => rows.reduce((s, l) => s + (+l[k] || 0), 0);
  const wStyle = c => `width:${c.w}px;min-width:${c.w}px;max-width:${c.w}px`;
  const movKeys = all.filter(c => c.k !== "name" && !F.hidden.has(c.k)).map(c => c.k);
  const hmenu = c => {
    if (F.hmenu !== c.k) return "";
    const i = movKeys.indexOf(c.k);
    const it = (act, label, icon, dis) => `<button data-shact="${act}" data-k="${esc(c.k)}" ${dis ? "disabled" : ""} class="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent text-left">${fsvg(icon, "w-3.5 h-3.5 text-muted")}${label}</button>`;
    return `<div data-noreorder class="absolute ${c.num ? "right-1" : "left-1"} top-[calc(100%+4px)] z-50 w-48 bg-white border border-line rounded-xl shadow-lift py-1.5 normal-case tracking-normal" style="font-weight:500">
      ${it("asc", "Sort A → Z / low → high", '<path d="M7 4v16M3 16l4 4 4-4M14 8h6M14 12h4M14 16h2"/>')}
      ${it("desc", "Sort Z → A / high → low", '<path d="M7 4v16M3 8l4-4 4 4M14 8h2M14 12h4M14 16h6"/>')}
      ${c.k !== "name" ? `<div class="h-px bg-line my-1"></div>
      ${it("start", "Move to start", '<path d="M5 5v14M19 12H9m0 0 4-4m-4 4 4 4"/>', i <= 0)}
      ${it("left", "Move left", '<path d="M19 12H5m0 0 5-5m-5 5 5 5"/>', i <= 0)}
      ${it("right", "Move right", '<path d="M5 12h14m0 0-5-5m5 5-5 5"/>', i === movKeys.length - 1)}
      ${it("end", "Move to end", '<path d="M19 5v14M5 12h10m0 0-4-4m4 4-4 4"/>', i === movKeys.length - 1)}
      <div class="h-px bg-line my-1"></div>
      ${it("hide", "Hide column", '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.4A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.1 6.1C3.4 8 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.1-.9"/>')}` : ""}
    </div>`;
  };
  const th = c => `<th data-col="${esc(c.k)}" ${c.k !== "name" ? `data-rkey="${esc(c.k)}" data-rlabel="${esc(c.label)}"` : ""} style="${wStyle(c)}${c.k !== "name" ? ";touch-action:pan-y" : ""}"
      class="${c.k === "name" ? "left-[76px] z-30 shadow-[1px_0_0_#e2e8e6]" : "z-20"} ${F.hmenu === c.k ? "!z-40" : ""} sheet-th sticky top-0 bg-paper text-left font-semibold text-[11.5px] text-muted border-b border-line select-none whitespace-nowrap relative ${c.k !== "name" ? "cursor-grab" : ""}">
      <div class="flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 ${c.num ? "justify-end" : ""}">
        ${c.k !== "name" ? `<span class="sheet-grip text-faint" title="Drag to move this column">${fsvg('<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>', "w-3.5 h-3.5", 2.4)}</span>` : ""}
        <span data-ssort="${esc(c.k)}" class="truncate cursor-pointer hover:text-ink py-1" title="Click to sort · drag to move">${esc(c.label)}</span>${key === c.k ? `<span class="text-brand">${dir > 0 ? "↑" : "↓"}</span>` : ""}
        <button data-shmenu="${esc(c.k)}" data-noreorder class="sheet-hbtn shrink-0 w-6 h-6 grid place-items-center rounded-md text-faint hover:text-ink hover:bg-white ${F.hmenu === c.k ? "!opacity-100 bg-white text-ink" : ""} ${c.num ? "" : "ml-auto"}" title="Column options">${fsvg(FI.down, "w-3.5 h-3.5", 2.2)}</button>
      </div>
      ${hmenu(c)}
      <span data-sresize="${esc(c.k)}" data-noreorder class="sheet-rz" title="Drag to resize · double-click to reset"></span></th>`;
  const stSel = l => {
    const st = LEAD_STATUS[l.status] || LEAD_STATUS.new;
    return `<select data-sst="${l.id}" class="sheet-st text-[12px] font-semibold rounded-full pl-2.5 pr-6 py-1 border-0 cursor-pointer ${st[1]}">${Object.entries(LEAD_STATUS).map(([k, [lab]]) => `<option value="${k}" ${l.status === k ? "selected" : ""}>${lab}</option>`).join("")}</select>`;
  };
  const cell = (l, c) => {
    if (l.locked && !["name", "created_at", "status"].includes(c.k)) return `<span class="text-faint">•••</span>`;
    switch (c.k) {
      case "name": return `<button data-flead="${l.id}" class="flex items-center gap-2 font-semibold text-ink hover:text-brand-dark text-left max-w-full">
          <span class="w-6 h-6 shrink-0 rounded-full grid place-items-center text-[10.5px] font-bold ${l.locked ? "bg-paper text-faint" : "bg-brand-tint text-brand-dark"}">${l.locked ? fsvg(FI.lock, "w-3 h-3") : esc((l.name || "?")[0].toUpperCase())}</span>
          <span class="truncate">${esc(l.name)}</span>${l.status === "new" && !l.locked ? `<span class="w-1.5 h-1.5 rounded-full bg-gold shrink-0"></span>` : ""}</button>`;
      case "phone": return `<span class="inline-flex items-center gap-2"><span class="font-mono text-[12.5px]">${esc(l.phone)}</span>
          <a href="https://wa.me/${waNumber(l.phone)}" target="_blank" data-flwa="${l.id}" title="Open WhatsApp" class="opacity-0 group-hover:opacity-100 transition text-[#25D366]"><svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">${WA_PATH}</svg></a></span>`;
      case "status": return l.locked ? `<span class="text-faint">—</span>` : stSel(l);
      case "order_total": return l.order_total ? `<span class="block text-right font-semibold tabular-nums">${naija(l.order_total)}</span>` : `<span class="block text-right text-faint">—</span>`;
      case "value": return `<input data-sval="${l.id}" type="text" inputmode="numeric" value="${l.value != null ? Math.round(l.value).toLocaleString("en-NG") : ""}" placeholder="—" class="sheet-in w-full text-right tabular-nums"/>`;
      case "created_at": return `<span class="text-muted">${new Date(l.created_at * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>`;
      case "source": return l.source ? `<span class="text-[11.5px] font-semibold rounded-md px-2 py-0.5 bg-paper border border-line">${esc(SOURCE_LABEL[l.source] || l.source)}</span>` : `<span class="text-faint">—</span>`;
      case "notes": return `<input data-snote="${l.id}" value="${esc(l.notes || "")}" placeholder="Add a note…" class="sheet-in w-full"/>`;
      default: { const v = niceAnswer(sheetVal(l, c.k)); return v ? `<span class="${F.density === "large" ? "sheet-clamp" : "block truncate"} ${/^[\d,]+$/.test(v) ? "text-right tabular-nums" : ""}" title="${esc(v)}">${esc(v)}</span>` : `<span class="text-faint">—</span>`; }
    }
  };
  const shownCount = all.filter(c => c.k !== "name" && !F.hidden.has(c.k)).length;
  const movable = all.filter(c => c.k !== "name");
  const colMenu = F.colMenu ? `<div data-scolclose class="fixed inset-0 z-30"></div>
    <div class="absolute right-0 top-11 z-40 w-72 bg-white border border-line rounded-xl shadow-lift p-2">
      <div class="flex items-center px-2 py-1"><span class="text-[10.5px] font-bold uppercase tracking-wide text-faint">Columns · order &amp; visibility</span>
        <button data-sreset class="ml-auto text-[11.5px] font-semibold text-brand hover:text-brand-dark">Reset layout</button></div>
      <div class="text-[11px] text-faint px-2 pb-1.5">Drag the ⋮⋮ handles to reorder — or drag headers in the sheet.</div>
      <div class="max-h-80 overflow-y-auto scroll-thin" data-rlist>
      <div class="flex items-center gap-2.5 px-2 py-1.5 text-[13px] text-faint"><input type="checkbox" checked disabled class="accent-[#0e9488]"/><span class="flex-1">Name</span><span class="text-[10.5px]">frozen</span></div>
      ${movable.map((c, i) => `<div data-rkey="${esc(c.k)}" data-rlabel="${esc(c.label)}" class="sheet-litem flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg hover:bg-paper text-[13px]" style="touch-action:none">
        <span class="sheet-lgrip shrink-0 w-6 h-7 grid place-items-center rounded text-faint hover:text-ink cursor-grab" title="Drag to reorder">${fsvg('<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>', "w-3.5 h-3.5", 2.4)}</span>
        <label data-noreorder class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer py-0.5"><input type="checkbox" data-scol="${esc(c.k)}" ${F.hidden.has(c.k) ? "" : "checked"} class="accent-[#0e9488]"/><span class="truncate">${esc(c.label)}</span></label>
        <button data-noreorder data-smove="${esc(c.k)}" data-d="-1" ${i === 0 ? "disabled" : ""} class="p-1 rounded text-faint hover:text-ink hover:bg-white disabled:opacity-25" title="Move left">${fsvg(FI.up, "w-3.5 h-3.5")}</button>
        <button data-noreorder data-smove="${esc(c.k)}" data-d="1" ${i === movable.length - 1 ? "disabled" : ""} class="p-1 rounded text-faint hover:text-ink hover:bg-white disabled:opacity-25" title="Move right">${fsvg(FI.down, "w-3.5 h-3.5")}</button>
      </div>`).join("")}
      </div>
    </div>` : "";
  const bodyRows = rows.map((l, i) => {
    const on = F.sel.has(l.id);
    const stick = on ? "bg-[#e9f5f3]" : "bg-white group-hover:bg-[#f7faf9]";
    return `<tr class="group ${on ? "bg-brand-tint/40" : "hover:bg-[#f7faf9]"}">
      <td class="sticky left-0 z-10 ${stick} px-3 ${dens} w-[76px] min-w-[76px]"><span class="inline-flex items-center gap-3">
        <input type="checkbox" data-ssel="${l.id}" ${on ? "checked" : ""} ${l.locked ? "disabled" : ""} class="accent-[#0e9488] w-3.5 h-3.5"/><span class="text-[11px] font-mono text-faint w-5">${i + 1}</span></span></td>
      ${cols.map(c => `<td data-col="${esc(c.k)}" class="${c.k === "name" ? `sticky left-[76px] z-10 shadow-[1px_0_0_#e2e8e6] ${stick}` : ""} px-3 ${dens} align-middle" style="${wStyle(c)}">${cell(l, c)}</td>`).join("")}
    </tr>`;
  }).join("");
  const foot = c => c.k === "name" ? `${rows.length} response${rows.length === 1 ? "" : "s"}` : c.k === "order_total" ? naija(sum("order_total"))
    : c.k === "value" ? (sum("value") ? naija(sum("value")) : "") : c.k === "status" ? `${rows.filter(l => l.status === "won").length} won` : "";
  const seg = (attr, cur, opts) => `<div class="inline-flex bg-white border border-line rounded-xl p-1 gap-0.5">${opts.map(([v, l, t]) => `<button ${attr}="${v}" title="${t || l}" class="text-[12.5px] font-semibold px-2.5 py-1 rounded-lg transition ${cur === v ? "bg-brand-tint text-brand-dark" : "text-muted hover:text-ink"}">${l}</button>`).join("")}</div>`;
  const full = !!F.full;
  return `<style>
      .sheet-in{background:transparent;border:1.5px solid transparent;border-radius:8px;padding:5px 8px;font-size:inherit;outline:none;transition:border-color .12s,background .12s}
      .sheet-in:hover{border-color:#e2e8e6;background:#fff}.sheet-in:focus{border-color:#0e9488;background:#fff;box-shadow:0 0 0 3px rgba(14,148,136,.14)}
      .sheet-in.saved{border-color:#0e9488}
      .sheet-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:normal;line-height:1.4}
      .sheet-st{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235c726e' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 7px center;background-size:11px}
      .sheet td{border-bottom:1px solid #eef2f1;border-right:1px solid #f1f4f3;overflow:hidden}
      .sheet-th .sheet-grip{opacity:.35;transition:opacity .12s,color .12s}.sheet-th:hover .sheet-grip{opacity:1;color:#0e9488}
      .sheet-hbtn{opacity:0;transition:opacity .12s}.sheet-th:hover .sheet-hbtn{opacity:1}
      @media (hover:none){.sheet-th .sheet-grip,.sheet-hbtn{opacity:1}}
      .sheet-rz{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5}
      .sheet-rz::after{content:"";position:absolute;top:22%;bottom:22%;left:3px;width:2px;border-radius:2px;background:transparent;transition:background .12s}
      .sheet-th:hover .sheet-rz::after{background:#cbd5d1}.sheet-rz:hover::after,.sheet-rz.on::after{background:#0e9488!important}
      .sheet-th.r-dragging,.sheet-litem.r-dragging{opacity:.35}
      body.sheet-moving,body.sheet-moving *{cursor:grabbing!important;user-select:none!important}
      body.sheet-resizing,body.sheet-resizing *{cursor:col-resize!important;user-select:none!important}
    </style>
    <div class="flex flex-wrap items-center gap-2 mb-3 min-h-[40px]">
      ${selN ? `<div class="flex flex-wrap items-center gap-1 bg-ink text-white rounded-xl pl-3.5 pr-1.5 py-1.5 text-[13px] fade-up">
          <b>${selN} selected</b><span class="text-white/40 mx-1">·</span>
          ${["contacted", "won", "lost"].map(k => `<button data-sbulk="${k}" class="font-semibold px-2.5 py-1 rounded-lg hover:bg-white/15">Mark ${LEAD_STATUS[k][0]}</button>`).join("")}
          <button data-sbulkcsv class="font-semibold px-2.5 py-1 rounded-lg hover:bg-white/15">Export</button>
          <button data-sbulkdel class="font-semibold px-2.5 py-1 rounded-lg text-rose-300 hover:bg-white/15">Delete</button>
          <button data-sbulkclear class="px-2 py-1 rounded-lg hover:bg-white/15" title="Clear selection">${fsvg(FI.x, "w-3.5 h-3.5")}</button></div>`
      : `<span class="text-[12.5px] text-muted">${full ? `<b class="text-ink font-display text-[15px] mr-2">Responses</b>` : ""}${rows.length} row${rows.length === 1 ? "" : "s"} · drag headers to reorder · drag edges to resize</span>`}
      <div class="ml-auto flex items-center gap-2">
        <span class="hidden sm:inline text-[11px] font-semibold uppercase tracking-wide text-faint">Rows</span>
        ${seg("data-sdens", F.density, [["compact", "S", "Compact rows"], ["normal", "M", "Normal rows"], ["large", "L", "Large rows — shows longer answers"]])}
        <div class="relative">
          <button data-scolbtn class="inline-flex items-center gap-1.5 text-[13px] font-semibold border border-line bg-white hover:bg-paper rounded-xl px-3 py-2">${fsvg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>', "w-4 h-4")} Columns <span class="text-[10.5px] font-mono text-faint">${shownCount}/${all.length - 1}</span></button>
          ${colMenu}
        </div>
        <button data-sfull class="inline-flex items-center gap-1.5 text-[13px] font-semibold ${full ? "text-white bg-ink hover:bg-ink/90" : "border border-line bg-white hover:bg-paper"} rounded-xl px-3 py-2" title="${full ? "Exit full screen (Esc)" : "Full screen"}">
          ${fsvg(full ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>' : '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', "w-4 h-4")} ${full ? "Exit" : "Expand"}</button>
      </div>
    </div>
    <div class="bg-white border border-line rounded-xl2 shadow-card overflow-auto scroll-thin ${full ? "flex-1 min-h-0" : "h-[calc(100vh-170px)] min-h-[480px]"}">
      <table class="sheet w-max min-w-full border-separate border-spacing-0" style="table-layout:fixed">
        <thead><tr>
          <th class="sticky top-0 left-0 z-30 bg-paper border-b border-line w-[76px] min-w-[76px] px-3 py-2.5 text-left">
            <span class="inline-flex items-center gap-3"><input type="checkbox" data-sselall ${allSel ? "checked" : ""} class="accent-[#0e9488] w-3.5 h-3.5"/><span class="text-[11px] font-mono text-faint">#</span></span></th>
          ${cols.map(th).join("")}
        </tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot><tr>
          <td class="sticky bottom-0 left-0 z-30 bg-paper border-t border-line px-3 py-2.5 text-[11px] font-mono text-faint">Σ</td>
          ${cols.map(c => `<td data-col="${esc(c.k)}" style="${wStyle(c)}" class="${c.k === "name" ? "left-[76px] z-30 shadow-[1px_0_0_#e2e8e6]" : "z-20"} sticky bottom-0 bg-paper border-t border-line px-3 py-2.5 text-[12px] font-semibold ${c.num ? "text-right tabular-nums" : "text-muted"}">${foot(c)}</td>`).join("")}
        </tr></tfoot>
      </table>
    </div>`;
}

// Full-screen sheet lives outside the animated page container so it can truly cover the screen.
function sheetFullOverlay() {
  const F = state.forms;
  if (!F.full || F.tab !== "responses" || F.view !== "sheet") return "";
  const leads = filteredLeads();
  return `<div class="fixed inset-0 z-40 bg-paper p-3 sm:p-5 flex flex-col">${leads.length ? sheetView(leads) : `<div class="m-auto text-sm text-muted">No responses match. <button data-sfull class="font-semibold text-brand">Exit full screen</button></div>`}</div>`;
}

function sheetCSV(rows, cols) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = cols.map(c => q(c.label)).join(",");
  const body = rows.map(l => cols.map(c => q(c.k === "created_at" ? new Date(l.created_at * 1000).toLocaleString("en-GB")
    : c.k === "status" ? (LEAD_STATUS[l.status] || [l.status])[0] : sheetVal(l, c.k))).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + head + "\n" + body], { type: "text/csv" }));
  a.download = "vertil-responses-selected.csv"; a.click();
}

function sheetMoveCol(k, target, before = true) {
  const F = state.forms;
  const keys = sheetColumns(filteredLeads()).map(c => c.k).filter(x => x !== "name");
  const from = keys.indexOf(k); if (from === -1) return;
  keys.splice(from, 1);
  let to = keys.indexOf(target); if (to === -1) to = keys.length;
  keys.splice(before ? to : to + 1, 0, k);
  F.colOrder = keys; sheetSave("vformsColOrder", keys);
}

let _sheetEscBound = false;
function wireSheet() {
  sheetPrefs();
  const F = state.forms;
  if (!_sheetEscBound) {
    _sheetEscBound = true;
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && state.forms?.full && !state.forms.lead && !(document.activeElement?.matches?.("input,textarea,select"))) { state.forms.full = false; render(); }
    });
  }
  $$("[data-fview]").forEach(b => b.onclick = () => { F.view = b.dataset.fview; F.lead = null; F.full = false; try { localStorage.setItem("vformsView", F.view); } catch {} render(); });
  if (F.view !== "sheet" || F.tab !== "responses") return;
  $$("[data-sfull]").forEach(b => b.onclick = () => { F.full = !F.full; F.colMenu = false; render(); });
  $$("[data-sdens]").forEach(b => b.onclick = () => { F.density = b.dataset.sdens; sheetSave("vformsDensity", F.density); render(); });
  $$("[data-ssort]").forEach(h => h.onclick = () => {
    if (F._justDragged) return;
    const k = h.dataset.ssort;
    F.sort = { key: k, dir: F.sort.key === k ? -F.sort.dir : (SHEET_NUM.includes(k) ? -1 : 1) }; render();
  });
  const cb = $("[data-scolbtn]"); if (cb) cb.onclick = () => { F.colMenu = !F.colMenu; render(); };
  $$("[data-scolclose]").forEach(b => b.onclick = () => { F.colMenu = false; render(); });
  $$("[data-scol]").forEach(el => el.onchange = () => {
    el.checked ? F.hidden.delete(el.dataset.scol) : F.hidden.add(el.dataset.scol);
    sheetSave("vformsHidden", [...F.hidden]); render();
  });
  $$("[data-smove]").forEach(b => b.onclick = () => {
    const keys = sheetColumns(filteredLeads()).map(c => c.k).filter(x => x !== "name");
    const i = keys.indexOf(b.dataset.smove), j = i + (+b.dataset.d);
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    F.colOrder = keys; sheetSave("vformsColOrder", keys); render();
  });
  const rs = $("[data-sreset]"); if (rs) rs.onclick = () => {
    F.colOrder = []; F.colW = {}; F.hidden = new Set(); F.density = "normal";
    ["vformsColOrder", "vformsColW", "vformsHidden", "vformsDensity"].forEach(k => { try { localStorage.removeItem(k); } catch {} });
    render(); toast("Sheet layout reset");
  };

  // column header menu
  $$("[data-shmenu]").forEach(b => b.onclick = e => { e.stopPropagation(); F.hmenu = F.hmenu === b.dataset.shmenu ? null : b.dataset.shmenu; render(); });
  $$("[data-shact]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const k = b.dataset.k, act = b.dataset.shact;
    const keys = sheetColumns(filteredLeads()).map(c => c.k).filter(x => x !== "name");
    const vis = keys.filter(x => !F.hidden.has(x)); const i = vis.indexOf(k);
    if (act === "asc" || act === "desc") F.sort = { key: k, dir: act === "asc" ? 1 : -1 };
    else if (act === "hide") { F.hidden.add(k); sheetSave("vformsHidden", [...F.hidden]); toast("Column hidden — bring it back from Columns"); }
    else if (act === "start") sheetMoveCol(k, vis[0], true);
    else if (act === "end") sheetMoveCol(k, null, true);
    else if (act === "left" && i > 0) sheetMoveCol(k, vis[i - 1], true);
    else if (act === "right" && i < vis.length - 1) sheetMoveCol(k, vis[i + 1], false);
    F.hmenu = null; render();
  });
  if (F.hmenu && !F._hmenuDoc) {  // click anywhere else closes the column menu
    F._hmenuDoc = true;
    setTimeout(() => document.addEventListener("click", function off(ev) {
      if (ev.target.closest("[data-shmenu],[data-shact]")) return;
      document.removeEventListener("click", off); F._hmenuDoc = false;
      if (state.forms.hmenu) { state.forms.hmenu = null; render(); }
    }), 0);
  }

  // press-and-drag to reorder: headers (left/right, auto-scrolls the sheet) and the Columns list (up/down)
  const scroller = $("table.sheet")?.parentElement;
  sheetReorder($$("th[data-rkey]"), "x", scroller, (k, before) => sheetMoveCol(k, before, true));
  sheetReorder($$("[data-rlist] [data-rkey]"), "y", $("[data-rlist]"), (k, before) => sheetMoveCol(k, before, true));

  // drag a header edge to resize
  $$("[data-sresize]").forEach(hd => hd.addEventListener("mousedown", e => {
    e.preventDefault(); e.stopPropagation();
    const k = hd.dataset.sresize; const thEl = hd.closest("th"); const startX = e.clientX; const startW = thEl.offsetWidth;
    const cells = $$(`[data-col="${CSS.escape(k)}"]`); hd.classList.add("on"); document.body.classList.add("sheet-resizing");
    thEl.removeAttribute("draggable");
    const move = ev => { const w = Math.max(80, Math.min(640, startW + ev.clientX - startX)); cells.forEach(c => { c.style.width = c.style.minWidth = c.style.maxWidth = w + "px"; }); };
    const up = ev => {
      document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
      document.body.classList.remove("sheet-resizing");
      F.colW = { ...(F.colW || {}), [k]: Math.max(80, Math.min(640, startW + ev.clientX - startX)) }; sheetSave("vformsColW", F.colW);
      F._justDragged = true; setTimeout(() => F._justDragged = false, 50); render();
    };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }));
  $$("[data-sresize]").forEach(hd => hd.addEventListener("dblclick", () => {   // double-click edge = back to default width
    const k = hd.dataset.sresize; const w = { ...(F.colW || {}) }; delete w[k]; F.colW = w; sheetSave("vformsColW", w); render();
  }));

  const sa = $("[data-sselall]"); if (sa) sa.onchange = () => {
    if (sa.checked) filteredLeads().filter(l => !l.locked).forEach(l => F.sel.add(l.id)); else F.sel.clear(); render();
  };
  $$("[data-ssel]").forEach(el => el.onchange = () => { el.checked ? F.sel.add(+el.dataset.ssel) : F.sel.delete(+el.dataset.ssel); render(); });
  $$("[data-sst]").forEach(el => el.onchange = () => {
    const l = F.leads.find(x => x.id === +el.dataset.sst); const body = { status: el.value };
    if (el.value === "won" && l && l.value == null && l.order_total) body.value = l.order_total;
    patchLead(l.id, body);
  });
  // spreadsheet-style editing: Enter saves and moves down the column; Esc cancels
  const bindEdit = (attr, field) => $$(`[${attr}]`).forEach(el => {
    const id = +el.getAttribute(attr); const orig = el.value;
    if (field === "value") {
      el.addEventListener("focus", () => { el.value = el.value.replace(/[^\d]/g, ""); el.select(); });
      el.addEventListener("blur", () => { const d = el.value.replace(/[^\d]/g, ""); el.value = d ? (+d).toLocaleString("en-NG") : ""; });
    }
    el.onkeydown = e => {
      if (e.key === "Enter") { e.preventDefault(); const list = $$(`[${attr}]`); const nx = list[list.indexOf(el) + 1]; el.blur(); if (nx) { nx.focus(); nx.select?.(); } }
      if (e.key === "Escape") { e.stopPropagation(); el.value = orig; el.blur(); }
    };
    el.onchange = async () => {
      await patchLead(id, { [field]: field === "value" ? el.value.replace(/[^\d]/g, "") : el.value }, true);
      el.classList.add("saved"); setTimeout(() => el.classList.remove("saved"), 800);
      if (field === "value") {  // refresh the Σ row, keep the cursor where it is
        const focusId = document.activeElement?.getAttribute?.(attr);
        render(); if (focusId) $(`[${attr}="${focusId}"]`)?.focus();
      }
    };
  });
  bindEdit("data-sval", "value"); bindEdit("data-snote", "notes");
  $$("[data-sbulk]").forEach(b => b.onclick = async () => {
    const ids = [...F.sel]; const status = b.dataset.sbulk;
    for (const id of ids) {
      const l = F.leads.find(x => x.id === id); const body = { status };
      if (status === "won" && l && l.value == null && l.order_total) body.value = l.order_total;
      await patchLead(id, body, true);
    }
    toast(`${ids.length} marked ${LEAD_STATUS[status][0]}`); F.sel.clear(); render();
  });
  const bc = $("[data-sbulkcsv]"); if (bc) bc.onclick = () => {
    const rows = filteredLeads().filter(l => F.sel.has(l.id));
    sheetCSV(rows, sheetColumns(rows).filter(c => c.k === "name" || !F.hidden.has(c.k)));
  };
  const bd = $("[data-sbulkdel]"); if (bd) bd.onclick = async () => {
    const ids = [...F.sel];
    if (!confirm(`Delete ${ids.length} response${ids.length === 1 ? "" : "s"} permanently?`)) return;
    for (const id of ids) await api(`/api/leads/${id}`, { method: "DELETE" });
    F.sel.clear(); await loadForms(); toast(`${ids.length} deleted`); render();
  };
  const bx = $("[data-sbulkclear]"); if (bx) bx.onclick = () => { F.sel.clear(); render(); };
}

// Pointer-based drag-to-reorder (works with mouse and touch). A floating label follows
// the pointer, a green bar shows where the item will land, and the scroller auto-scrolls
// near its edges. onDrop(key, beforeKey | null) — null means "move to the end".
function sheetReorder(items, axis, scroller, onDrop) {
  const F = state.forms;
  items.forEach(el => el.addEventListener("pointerdown", e => {
    if (e.button !== 0 || e.target.closest("[data-noreorder]")) return;
    const key = el.dataset.rkey;
    const start = axis === "x" ? e.clientX : e.clientY;
    let dragging = false, ghost = null, bar = null, target = undefined, last = e, raf = 0;
    const others = () => items.filter(x => x !== el);
    const begin = () => {
      dragging = true; el.classList.add("r-dragging"); document.body.classList.add("sheet-moving");
      ghost = document.createElement("div");
      ghost.className = "fixed z-[80] pointer-events-none px-3 py-1.5 rounded-lg bg-ink text-white text-[12.5px] font-semibold shadow-lift whitespace-nowrap";
      ghost.textContent = el.dataset.rlabel || key; document.body.appendChild(ghost);
      bar = document.createElement("div");
      bar.className = "fixed z-[79] pointer-events-none rounded-full bg-brand";
      bar.style.boxShadow = "0 0 0 3px rgba(14,148,136,.2)"; document.body.appendChild(bar);
      const tick = () => {   // auto-scroll when the pointer nears the scroller's edge
        if (scroller) {
          const r = scroller.getBoundingClientRect(), p = axis === "x" ? last.clientX : last.clientY;
          const lo = axis === "x" ? r.left : r.top, hi = axis === "x" ? r.right : r.bottom, edge = 60;
          const d = p < lo + edge ? -Math.ceil((lo + edge - p) / 4) : p > hi - edge ? Math.ceil((p - (hi - edge)) / 4) : 0;
          if (d) { axis === "x" ? scroller.scrollLeft += d : scroller.scrollTop += d; place(last); }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const place = ev => {
      ghost.style.left = (ev.clientX + 12) + "px"; ghost.style.top = (ev.clientY + 12) + "px";
      const p = axis === "x" ? ev.clientX : ev.clientY;
      const list = others();
      let before = null, rect = null;
      for (const o of list) {
        const r = o.getBoundingClientRect(); const mid = axis === "x" ? r.left + r.width / 2 : r.top + r.height / 2;
        if (p < mid) { before = o; rect = r; break; }
      }
      const ref = rect || list[list.length - 1]?.getBoundingClientRect();
      if (!ref) return;
      const clip = scroller ? scroller.getBoundingClientRect() : null;
      if (axis === "x") {
        const x = rect ? rect.left : ref.right;
        const top = clip ? clip.top : ref.top, h = clip ? clip.height : ref.height;
        Object.assign(bar.style, { left: (x - 1.5) + "px", top: top + "px", width: "3px", height: h + "px" });
      } else {
        const y = rect ? rect.top : ref.bottom;
        Object.assign(bar.style, { top: (y - 1.5) + "px", left: ref.left + "px", height: "3px", width: ref.width + "px" });
      }
      target = before ? before.dataset.rkey : null;
    };
    const move = ev => {
      last = ev;
      const d = (axis === "x" ? ev.clientX : ev.clientY) - start;
      if (!dragging && Math.abs(d) > 6) begin();
      if (dragging) { ev.preventDefault(); place(ev); }
    };
    const up = () => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      if (!dragging) return;
      cancelAnimationFrame(raf); ghost?.remove(); bar?.remove();
      el.classList.remove("r-dragging"); document.body.classList.remove("sheet-moving");
      F._justDragged = true; setTimeout(() => F._justDragged = false, 80);
      if (target !== undefined && target !== key) { onDrop(key, target); render(); }
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }));
}
