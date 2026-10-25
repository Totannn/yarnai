/* =========================== FLYER MAKER ============================ *
 * Designed templates + Vertil's words + the brand's logo/colours → a PNG.
 * Loaded after app.js and uses its globals (state, api, esc, render, toast, …).
 * The flyer is drawn as HTML at its real pixel size (e.g. 1080×1920) and
 * exported in the browser with html-to-image, so images cost nothing to make.
 * -------------------------------------------------------------------- */

const FLY_SIZES = {
  status:   { w: 1080, h: 1920, label: "WhatsApp Status", sub: "Status · Stories · Reels", ratio: "9:16" },
  portrait: { w: 1080, h: 1350, label: "Instagram portrait", sub: "Feed post · tallest", ratio: "4:5" },
  square:   { w: 1080, h: 1080, label: "Square", sub: "Instagram · Facebook · WhatsApp", ratio: "1:1" },
};
const FLY_KINDS = {
  promo: { label: "Product promo", icon: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>' },
  pricelist: { label: "Price list", icon: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>' },
  event: { label: "Event", icon: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>' },
};
const FLY_TEMPLATES = {
  "promo-bold":      { kind: "promo", name: "Bold split", photo: true },
  "promo-spotlight": { kind: "promo", name: "Spotlight", photo: true },
  "promo-minimal":   { kind: "promo", name: "Editorial", photo: true },
  "price-menu":      { kind: "pricelist", name: "Menu board", photo: true },
  "price-cards":     { kind: "pricelist", name: "Price cards", photo: false },
  "event-poster":    { kind: "event", name: "Poster", photo: true },
  "event-ticket":    { kind: "event", name: "Ticket", photo: false },
};
const FLY_PALETTES = {
  teal:     { name: "Vertil teal", c: ["#0e9488", "#f5c542"] },
  sunset:   { name: "Sunset", c: ["#e4572e", "#ffc914"] },
  royal:    { name: "Royal", c: ["#4b2a8a", "#f2c14e"] },
  fresh:    { name: "Fresh", c: ["#1b7f3a", "#ffd23f"] },
  midnight: { name: "Midnight gold", c: ["#141414", "#d4af37"] },
  naija:    { name: "Naija", c: ["#008751", "#ffffff"] },
  rose:     { name: "Rose", c: ["#c2185b", "#ffd6e0"] },
  ocean:    { name: "Ocean", c: ["#0b3d91", "#4fc3f7"] },
};
const FLY_FONTS = {
  bold:     { name: "Bold", head: "'Space Grotesk', sans-serif", body: "'Space Grotesk', sans-serif", hw: 700 },
  elegant:  { name: "Elegant", head: "'Playfair Display', serif", body: "'Space Grotesk', sans-serif", hw: 800 },
  friendly: { name: "Friendly", head: "'Fredoka', sans-serif", body: "'Space Grotesk', sans-serif", hw: 600 },
};
const FLY_PANELS = [
  ["layout", "Layout", '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'],
  ["text", "Text", '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'],
  ["photo", "Photo", '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/>'],
  ["logo", "Logo", '<path d="M12 3 4 7v6c0 4.5 3.4 7.6 8 8 4.6-.4 8-3.5 8-8V7Z"/>'],
  ["style", "Colours", '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9.5" r="1.3"/><circle cx="15.5" cy="9.5" r="1.3"/><circle cx="12" cy="15.5" r="1.3"/>'],
  ["size", "Size", '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>'],
];

/* ---------------------------- colour utils ---------------------------- */
function flyRgb(hex) { const h = (hex || "#000000").replace("#", ""); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) || 0); }
function flyHex([r, g, b]) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function flyLum(hex) { const [r, g, b] = flyRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
function flyMix(a, b, t) { const A = flyRgb(a), B = flyRgb(b); return flyHex(A.map((v, i) => v + (B[i] - v) * t)); }
function flyOn(hex) { return flyLum(hex) > .42 ? "#141414" : "#ffffff"; }
function flyReadable(fg, bg, min = 3) { return flyContrast(fg, bg) >= min ? fg : (flyLum(bg) > .45 ? flyMix(fg, '#000000', .55) : flyMix(fg, '#ffffff', .72)); }
function flyContrast(a, b) { const [x, y] = [flyLum(a), flyLum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); }

function flyBrandColors(brand) { return String(brand?.colors || "").split(",").map(s => s.trim()).filter(c => /^#[0-9a-f]{6}$/i.test(c)); }
function flyPalette() {
  const F = state.flyer, brand = flyBrand();
  let pair = FLY_PALETTES[F.paletteKey]?.c;
  if (F.paletteKey === "brand") { const bc = flyBrandColors(brand); pair = bc.length ? [bc[0], bc[1] || null] : FLY_PALETTES.teal.c; }
  if (F.paletteKey === "custom") pair = [F.custom[0], F.custom[1]];
  const primary = pair[0];
  let accent = pair[1] || (flyLum(primary) > .5 ? "#141414" : "#f5c542");
  if (flyContrast(primary, accent) < 1.6) accent = flyLum(primary) > .5 ? flyMix(primary, "#000000", .55) : flyMix(accent, "#ffffff", .7);
  return {
    primary, accent, onPrimary: flyOn(primary), onAccent: flyOn(accent),
    light: flyMix(primary, "#ffffff", .9), deep: flyMix(primary, "#000000", .45), ink: "#141414",
  };
}

/* ------------------------------- state -------------------------------- */
function flyBlankText() {
  return { tag: "", headline: "", subhead: "", price: "", old_price: "", cta: "", contact: "", date: "", time: "", venue: "", items: [] };
}
function flyNew(opts = {}) {
  const brandId = opts.brandId ?? state.activeBrandId ?? state.brands[0]?.id ?? null;
  const brand = state.brands.find(b => b.id === brandId);
  state.flyer = {
    tab: "create", panel: "text", id: null, brandId,
    kind: "promo", template: "promo-bold", size: "status",
    paletteKey: brand && flyBrandColors(brand).length ? "brand" : "teal", custom: ["#0e9488", "#f5c542"], font: "bold",
    text: flyBlankText(), photo: { url: null, zoom: 1, x: 50, y: 50 },
    logo: { show: true, pos: "tl", size: "m", style: "auto", override: null },
    source: opts.source || "", tone: opts.tone || state.tone || "friendly",
    busy: false, saving: false, dirty: false, uploading: false,
  };
}
function flyBrand() { const F = state.flyer; return state.brands.find(b => b.id === F?.brandId) || null; }

/* Open the editor from anywhere (Studio card, calendar, menu). */
async function openFlyer(opts = {}) {
  flyNew(opts);
  await goto("flyer");
  if (opts.source) flyFill();
}

/* ---------------------------- logo helpers ---------------------------- */
const flyLogoInfo = {};  // url → { hasBg, avgLum, colors }
function flyAnalyseLogo(url) {
  if (!url || flyLogoInfo[url]) return Promise.resolve(flyLogoInfo[url]);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = 64, cv = document.createElement("canvas"); cv.width = cv.height = s;
        const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, s, s);
        const d = cx.getImageData(0, 0, s, s).data;
        const px = (x, y) => { const i = (y * s + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
        const corners = [px(1, 1), px(s - 2, 1), px(1, s - 2), px(s - 2, s - 2)];
        const hasBg = corners.filter(c => c[3] > 200).length >= 3;
        let lumSum = 0, n = 0; const buckets = {};
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          const hex = flyHex([d[i], d[i + 1], d[i + 2]]); const L = flyLum(hex);
          lumSum += L; n++;
          if (L > .92 || L < .03) continue;                       // skip near-white / near-black
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx - mn < 22) continue;                            // skip greys
          const key = [r, g, b].map(v => Math.round(v / 32) * 32).join(",");
          (buckets[key] = buckets[key] || { n: 0, r: 0, g: 0, b: 0 }); const B = buckets[key]; B.n++; B.r += r; B.g += g; B.b += b;
        }
        const colors = Object.values(buckets).sort((a, b) => b.n - a.n).map(B => flyHex([B.r / B.n, B.g / B.n, B.b / B.n]))
          .filter((c, i, arr) => arr.findIndex(o => flyContrast(o, c) < 1.25) === i).slice(0, 3);
        flyLogoInfo[url] = { hasBg, avgLum: n ? lumSum / n : .5, colors };
      } catch { flyLogoInfo[url] = { hasBg: true, avgLum: .5, colors: [] }; }
      res(flyLogoInfo[url]);
    };
    img.onerror = () => { flyLogoInfo[url] = { hasBg: true, avgLum: .5, colors: [] }; res(flyLogoInfo[url]); };
    img.src = url;
  });
}

/* Shared by the Brands page and the Flyer editor. */
async function uploadBrandLogo(brandId, file) {
  if (!file) return null;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { toast("⚠ Use a PNG, JPG or WebP image"); return null; }
  if (file.size > 5 * 1024 * 1024) { toast("⚠ That logo is over 5MB"); return null; }
  const fd = new FormData(); fd.append("logo", file);
  const res = await fetch(`/api/brands/${brandId}/logo`, { method: "POST", body: fd });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { toast("⚠ " + (d.error || "Upload failed")); return null; }
  state.brands = state.brands.map(b => b.id === brandId ? d.brand : b);
  const info = await flyAnalyseLogo(d.brand.logo);
  if (d.low_res) toast("Logo saved — it's quite small, so it may look soft on big flyers");
  else toast("Logo saved ✓");
  return { brand: d.brand, colors: info?.colors || [] };
}
async function removeBrandLogo(brandId) {
  const d = await api(`/api/brands/${brandId}/logo`, { method: "DELETE" });
  state.brands = state.brands.map(b => b.id === brandId ? d.brand : b);
  toast("Logo removed");
}
async function saveBrandColors(brandId, colors) {
  const d = await api(`/api/brands/${brandId}/colors`, { method: "PUT", body: JSON.stringify({ colors }) });
  state.brands = state.brands.map(b => b.id === brandId ? d.brand : b);
  return d.brand;
}

/* ------------------------------ templates ----------------------------- */
const FLY_ICO = {
  cal: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 7 7L16 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
};
const flyIco = (k, size, color) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${FLY_ICO[k]}</svg>`;
const fe = s => esc(s || "");
function flyTop(F, k, base = 220) {
  const logoH = F.logo.show ? { s: 92, m: 130, l: 180 }[F.logo.size] : 0;
  return Math.max(Math.round(base * k), logoH ? 64 + logoH + 34 : 90);
}

function flyPhoto(F, style = "", placeholderBg = "#ddd") {
  const p = F.photo;
  if (!p.url) return `<div class="fly-ph" style="${style};background:${placeholderBg};display:flex;align-items:center;justify-content:center">
    <svg viewBox="0 0 24 24" width="140" height="140" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/></svg></div>`;
  return `<div class="fly-ph" data-fly-drag style="${style};overflow:hidden;position:relative;cursor:grab">
    <img src="${fe(p.url)}" crossorigin="anonymous" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${p.x}% ${p.y}%;transform:scale(${p.zoom});transform-origin:${p.x}% ${p.y}%" draggable="false"/></div>`;
}

function flyLogoLayer(F, P, overPhoto, bgUnder) {
  const L = F.logo, brand = flyBrand();
  if (!L.show) return "";
  const url = L.override || brand?.logo || "";
  const H = { s: 92, m: 130, l: 180 }[L.size];
  const pos = { tl: "left:70px", tc: "left:50%;transform:translateX(-50%)", tr: "right:70px" }[L.pos];
  const info = url ? flyLogoInfo[url] : null;
  const under = overPhoto ? "#888888" : bgUnder;
  let badge = L.style === "badge";
  if (L.style === "auto" && url) badge = overPhoto || (info ? (info.hasBg || Math.abs(info.avgLum - flyLum(under)) < .28) : true);
  const shell = (inner, pad) => badge
    ? `<div style="position:absolute;top:64px;${pos};z-index:5;background:#fff;border-radius:${Math.round(H * .28)}px;padding:${pad};box-shadow:0 10px 30px rgba(0,0,0,.18);display:flex;align-items:center">${inner}</div>`
    : `<div style="position:absolute;top:64px;${pos};z-index:5;display:flex;align-items:center;filter:drop-shadow(0 4px 14px rgba(0,0,0,.18))">${inner}</div>`;
  if (url) return shell(`<img src="${fe(url)}" crossorigin="anonymous" style="height:${badge ? H - 36 : H}px;max-width:${H * 2.8}px;object-fit:contain;display:block"/>`, "18px 26px");
  // No logo yet → the brand name as a clean wordmark
  const name = brand?.name || "Your brand";
  const col = badge ? P.primary : (overPhoto ? "#fff" : flyOn(bgUnder));
  return shell(`<span style="font-family:${FLY_FONTS[F.font].head};font-weight:800;font-size:${Math.round(H * .34)}px;letter-spacing:-.01em;color:${col};white-space:nowrap">${fe(name)}</span>`, "16px 28px");
}

function flyCta(t, bg, fg, size = 40) {
  return t.cta ? `<div style="display:inline-flex;align-items:center;gap:14px;background:${bg};color:${fg};font-weight:700;font-size:${size}px;padding:${Math.round(size * .55)}px ${Math.round(size * 1.05)}px;border-radius:999px;letter-spacing:.01em;white-space:nowrap">${fe(t.cta)} <span style="font-size:${size * 1.05}px">→</span></div>` : "";
}
function flyContact(t, color, size = 30) {
  return t.contact ? `<div style="display:flex;align-items:center;gap:12px;color:${color};font-size:${size}px;font-weight:600">${flyIco("phone", size, color)}${fe(t.contact)}</div>` : "";
}
function flyPriceTag(t, P, d) {
  if (!t.price) return "";
  return `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${P.accent};color:${P.onAccent};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(0,0,0,.25);transform:rotate(-8deg);text-align:center;line-height:1">
    ${t.old_price ? `<div style="font-size:${d * .13}px;text-decoration:line-through;opacity:.7;margin-bottom:6px">${fe(t.old_price)}</div>` : `<div style="font-size:${d * .1}px;font-weight:700;letter-spacing:.12em;opacity:.8;margin-bottom:8px">ONLY</div>`}
    <div style="font-size:${Math.min(d * .27, d * 1.5 / Math.max(4, t.price.length))}px;font-weight:800;letter-spacing:-.02em">${fe(t.price)}</div></div>`;
}

/* Each template returns inner HTML for a W×H stage. `k` = size scale (1 for status). */
const FLY_RENDER = {
  "promo-bold"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const photoH = Math.round(S.h * (S.key === "square" ? .5 : .56));
    return `
    ${flyPhoto(F, `position:absolute;left:0;top:0;width:100%;height:${photoH}px`, P.light)}
    <div style="position:absolute;left:0;right:0;top:${photoH - 2}px;bottom:0;background:${P.primary};color:${P.onPrimary};padding:${Math.round(110 * k)}px 80px ${Math.round(90 * k)}px;display:flex;flex-direction:column">
      ${t.tag ? `<div style="display:inline-block;align-self:flex-start;background:${P.accent};color:${P.onAccent};font-weight:700;font-size:${30 * Math.max(k, .8)}px;letter-spacing:.14em;padding:12px 24px;border-radius:10px;margin-bottom:${28 * k}px;white-space:nowrap">${fe(t.tag)}</div>` : ""}
      <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 92 : 118) * Math.min(1, 14 / Math.max(8, (t.headline || "").length * .9)) * (S.key === "status" ? 1.08 : 1))}px;line-height:1.02;letter-spacing:-.025em">${fe(t.headline || "Your headline here")}</div>
      ${t.subhead ? `<div style="font-size:${Math.round(40 * Math.max(k, .85))}px;line-height:1.3;opacity:.9;margin-top:${24 * k}px;max-width:900px">${fe(t.subhead)}</div>` : ""}
      <div style="margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:30px">
        <div style="display:flex;flex-direction:column;gap:22px">${flyCta(t, P.accent, P.onAccent, Math.round(40 * Math.max(k, .85)))}${flyContact(t, P.onPrimary, Math.round(30 * Math.max(k, .85)))}</div>
      </div>
    </div>
    ${t.price ? `<div style="position:absolute;right:70px;top:${photoH - Math.round(150 * Math.max(k, .8))}px;z-index:4">${flyPriceTag(t, P, Math.round(280 * Math.max(k, .78)))}</div>` : ""}`;
  },
  "promo-spotlight"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const ph = Math.round(Math.min(S.w * .7, S.h * (S.key === "square" ? (F.logo.show ? .34 : .42) : .42)));
    const ring = `radial-gradient(circle at 50% 50%, ${flyMix(P.primary, "#ffffff", .18)} 0 ${ph * .62}px, transparent ${ph * .62 + 1}px)`;
    return `
    <div style="position:absolute;inset:0;background:${P.primary};background-image:${ring}, radial-gradient(${flyMix(P.primary, "#ffffff", .12)} 2px, transparent 2.5px);background-size:auto, 44px 44px"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;text-align:center;color:${P.onPrimary};padding:${flyTop(F, k)}px 80px ${Math.round(100 * k)}px">
      ${t.tag ? `<div style="font-weight:700;font-size:${32 * Math.max(k, .8)}px;letter-spacing:.2em;color:${flyReadable(P.accent, P.primary)};white-space:nowrap">${fe(t.tag)}</div>` : ""}
      <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 84 : 110) * Math.min(1, 15 / Math.max(8, (t.headline || "").length * .9)))}px;line-height:1.02;letter-spacing:-.025em;margin-top:${20 * k}px">${fe(t.headline || "Your headline here")}</div>
      <div style="position:relative;margin:${Math.round(60 * k)}px 0 ${Math.round(50 * k)}px">
        ${flyPhoto(F, `width:${ph}px;height:${ph}px;border-radius:50%;border:${Math.round(16 * Math.max(k, .7))}px solid ${P.accent};box-shadow:0 30px 70px rgba(0,0,0,.3)`, P.light)}
        ${t.price ? `<div style="position:absolute;right:${-ph * .12}px;bottom:${-ph * .02}px">${flyPriceTag(t, P, Math.round(ph * .42))}</div>` : ""}
      </div>
      ${t.subhead ? `<div style="font-size:${Math.round(38 * Math.max(k, .85))}px;line-height:1.3;opacity:.92;max-width:880px">${fe(t.subhead)}</div>` : ""}
      <div style="margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:22px">${flyCta(t, P.accent, P.onAccent, Math.round(40 * Math.max(k, .85)))}${flyContact(t, P.onPrimary, Math.round(30 * Math.max(k, .85)))}</div>
    </div>`;
  },
  "promo-minimal"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const bg = "#faf7f2", ph = Math.round(S.h * (S.key === "square" ? .44 : .5));
    return `
    <div style="position:absolute;inset:0;background:${bg}"></div>
    <div style="position:absolute;inset:0;padding:${flyTop(F, k)}px 80px ${Math.round(90 * k)}px;display:flex;flex-direction:column;color:#151515">
      ${flyPhoto(F, `width:100%;height:${ph}px;border-radius:28px`, P.light)}
      <div style="display:flex;align-items:center;gap:20px;margin-top:${Math.round(56 * k)}px">
        <div style="height:4px;width:70px;background:${P.primary}"></div>
        ${t.tag ? `<div style="font-weight:700;font-size:${28 * Math.max(k, .85)}px;letter-spacing:.22em;color:${flyReadable(P.primary, "#faf7f2")};white-space:nowrap">${fe(t.tag)}</div>` : ""}</div>
      <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 80 : 104) * Math.min(1, 16 / Math.max(8, (t.headline || "").length * .9)))}px;line-height:1.04;letter-spacing:-.02em;margin-top:${22 * k}px">${fe(t.headline || "Your headline here")}</div>
      ${t.subhead ? `<div style="font-size:${Math.round(36 * Math.max(k, .85))}px;line-height:1.35;color:#555;margin-top:${18 * k}px">${fe(t.subhead)}</div>` : ""}
      <div style="margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;border-top:2px solid #e3ddd2;padding-top:${Math.round(34 * k)}px">
        <div>${t.price ? `<div style="font-size:${26 * Math.max(k, .85)}px;letter-spacing:.18em;color:#888;font-weight:700">PRICE</div>
          <div style="display:flex;align-items:baseline;gap:16px"><div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round(76 * Math.max(k, .8))}px;color:${P.primary}">${fe(t.price)}</div>${t.old_price ? `<div style="font-size:${34 * Math.max(k, .85)}px;color:#999;text-decoration:line-through">${fe(t.old_price)}</div>` : ""}</div>` : ""}
          ${flyContact(t, "#555", Math.round(28 * Math.max(k, .85)))}</div>
        ${flyCta(t, P.primary, P.onPrimary, Math.round(36 * Math.max(k, .85)))}
      </div>
    </div>`;
  },
  "price-menu"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const max = { status: 8, portrait: 6, square: 4 }[S.key];
    const items = (t.items.length ? t.items : [{ name: "Item one", price: "₦0" }, { name: "Item two", price: "₦0" }, { name: "Item three", price: "₦0" }]).slice(0, max);
    const stripH = Math.round(S.h * (S.key === "status" ? .24 : S.key === "portrait" ? .22 : 0));
    const fs = { status: items.length <= 6 ? 60 : 52, portrait: 46, square: 40 }[S.key];
    const gap = { status: items.length <= 6 ? 46 : 34, portrait: 26, square: 16 }[S.key];
    return `
    <div style="position:absolute;inset:0;background:${P.deep}"></div>
    ${stripH ? flyPhoto(F, `position:absolute;left:0;right:0;top:0;height:${stripH}px;opacity:.95`, flyMix(P.primary, "#ffffff", .2)) +
      `<div style="position:absolute;left:0;right:0;top:${stripH - 160}px;height:160px;background:linear-gradient(transparent, ${P.deep})"></div>` : ""}
    <div style="position:absolute;left:0;right:0;top:${stripH ? stripH - 40 : flyTop(F, k)}px;bottom:0;padding:0 80px ${Math.round(90 * k)}px;display:flex;flex-direction:column;color:#fff">
      ${t.tag ? `<div style="font-weight:700;font-size:${30 * Math.max(k, .8)}px;letter-spacing:.2em;color:${flyReadable(P.accent, P.deep, 4)};white-space:nowrap">${fe(t.tag)}</div>` : ""}
      <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 76 : 96) * Math.min(1, 16 / Math.max(8, (t.headline || "").length * .9)))}px;line-height:1.02;letter-spacing:-.02em;margin-top:10px">${fe(t.headline || "Our price list")}</div>
      ${t.subhead ? `<div style="font-size:${Math.round(32 * Math.max(k, .85))}px;opacity:.8;margin-top:12px">${fe(t.subhead)}</div>` : ""}
      <div style="margin-top:${Math.round(44 * k)}px;display:flex;flex-direction:column;gap:${gap}px">
        ${items.map(i => `<div style="display:flex;align-items:baseline;gap:18px;font-size:${fs}px">
          <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72%">${fe(i.name)}</span>
          <span style="flex:1;border-bottom:4px dotted rgba(255,255,255,.35);transform:translateY(-10px)"></span>
          <span style="font-weight:800;color:${flyReadable(P.accent, P.deep, 4)};white-space:nowrap">${fe(i.price)}</span></div>`).join("")}
      </div>
      <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:24px">
        ${flyContact(t, "rgba(255,255,255,.9)", Math.round(30 * Math.max(k, .85)))}${flyCta(t, P.accent, P.onAccent, Math.round(36 * Math.max(k, .85)))}</div>
    </div>`;
  },
  "price-cards"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const max = { status: 8, portrait: 6, square: 4 }[S.key];
    const items = (t.items.length ? t.items : [{ name: "Item one", price: "₦0" }, { name: "Item two", price: "₦0" }, { name: "Item three", price: "₦0" }, { name: "Item four", price: "₦0" }]).slice(0, max);
    return `
    <div style="position:absolute;inset:0;background:${P.light}"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:${Math.max(Math.round(S.h * (S.key === "square" ? .36 : .3)), flyTop(F, k, 230) + (S.key === "square" ? 190 : 220) + (t.subhead ? 30 : 0))}px;background:${P.primary};border-radius:0 0 80px 80px"></div>
    <div style="position:absolute;inset:0;padding:${flyTop(F, k, 230)}px 70px ${Math.round(90 * k)}px;display:flex;flex-direction:column">
      <div style="color:${P.onPrimary};text-align:center">
        ${t.tag ? `<div style="font-weight:700;font-size:${30 * Math.max(k, .8)}px;letter-spacing:.2em;color:${flyReadable(P.accent, P.primary)};white-space:nowrap">${fe(t.tag)}</div>` : ""}
        <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 72 : 92) * Math.min(1, 16 / Math.max(8, (t.headline || "").length * .9)))}px;line-height:1.02;letter-spacing:-.02em;margin-top:8px">${fe(t.headline || "Price list")}</div>
        ${t.subhead ? `<div style="font-size:${Math.round(30 * Math.max(k, .85))}px;opacity:.9;margin-top:10px">${fe(t.subhead)}</div>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:${S.key === "square" ? 22 : 28}px;margin-top:${S.key === "square" ? 54 : Math.round(60 * k)}px">
        ${items.map(i => `<div style="background:#fff;border-radius:30px;padding:${S.key === "square" ? 30 : 40}px 34px;box-shadow:0 14px 34px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:18px;min-height:${S.key === "square" ? 150 : 190}px">
          <div style="font-size:${S.key === "square" ? 36 : 40}px;font-weight:600;color:#1a1a1a;line-height:1.15">${fe(i.name)}</div>
          <div style="margin-top:auto;align-self:flex-start;background:${P.primary};color:${P.onPrimary};font-weight:800;font-size:${S.key === "square" ? 38 : 44}px;padding:10px 24px;border-radius:999px">${fe(i.price)}</div></div>`).join("")}
      </div>
      <div style="margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:20px">
        ${flyCta(t, P.primary, P.onPrimary, Math.round(38 * Math.max(k, .85)))}${flyContact(t, "#333", Math.round(30 * Math.max(k, .85)))}</div>
    </div>`;
  },
  "event-poster"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const row = (ic, val) => val ? `<div style="display:flex;align-items:center;gap:22px;font-size:${Math.round(40 * Math.max(k, .82))}px;font-weight:600">${flyIco(ic, Math.round(46 * Math.max(k, .82)), flyReadable(P.accent, P.deep, 4))}<span>${fe(val)}</span></div>` : "";
    return `
    ${flyPhoto(F, "position:absolute;inset:0", P.deep)}
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, ${P.deep}cc 0%, ${P.deep}55 30%, ${P.deep}ee 62%, ${P.deep} 100%)"></div>
    <div style="position:absolute;inset:0;padding:${flyTop(F, k, 240)}px 80px ${Math.round(100 * k)}px;display:flex;flex-direction:column;color:#fff">
      ${t.tag ? `<div style="align-self:flex-start;white-space:nowrap;border:3px solid ${flyReadable(P.accent, P.deep, 4)};color:${flyReadable(P.accent, P.deep, 4)};font-weight:700;font-size:${30 * Math.max(k, .8)}px;letter-spacing:.2em;padding:12px 24px;border-radius:12px">${fe(t.tag)}</div>` : ""}
      <div style="margin-top:auto"></div>
      <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 96 : 132) * Math.min(1, 13 / Math.max(8, (t.headline || "").length * .9)))}px;line-height:.98;letter-spacing:-.03em">${fe(t.headline || "Your event")}</div>
      ${t.subhead ? `<div style="font-size:${Math.round(40 * Math.max(k, .85))}px;line-height:1.3;opacity:.92;margin-top:${22 * k}px">${fe(t.subhead)}</div>` : ""}
      <div style="height:5px;width:120px;background:${flyReadable(P.accent, P.deep, 4)};margin:${Math.round(46 * k)}px 0"></div>
      <div style="display:flex;flex-direction:column;gap:${Math.round(22 * k)}px">${row("cal", t.date)}${row("clock", t.time)}${row("pin", t.venue)}</div>
      <div style="margin-top:${Math.round(56 * k)}px;display:flex;align-items:center;justify-content:space-between;gap:24px">${flyCta(t, P.accent, P.onAccent, Math.round(38 * Math.max(k, .85)))}${flyContact(t, "rgba(255,255,255,.9)", Math.round(28 * Math.max(k, .85)))}</div>
    </div>`;
  },
  "event-ticket"(F, P, T, S) {
    const k = S.h / 1920, t = F.text, fh = FLY_FONTS[F.font];
    const parts = (t.date || "").split(/[\s,]+/).filter(Boolean);
    const big = parts.find(p => /^\d{1,2}(st|nd|rd|th)?$/i.test(p)) || parts[0] || "—";
    const rest = parts.filter(p => p !== big).join(" ");
    const tH = Math.round(S.h * { status: .47, portrait: .56, square: .62 }[S.key]);
    return `
    <div style="position:absolute;inset:0;background:${P.primary};background-image:repeating-linear-gradient(45deg, ${flyMix(P.primary, "#ffffff", .06)} 0 22px, transparent 22px 44px)"></div>
    <div style="position:absolute;left:70px;right:70px;top:${Math.max(flyTop(F, k, 0), Math.round((S.h - tH) / 2 + 40 * k))}px;height:${tH}px;background:#fff;border-radius:40px;box-shadow:0 40px 90px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden">
      <div style="flex:1;padding:${Math.round(70 * k)}px 64px 40px;display:flex;flex-direction:column;color:#151515">
        ${t.tag ? `<div style="font-weight:700;font-size:${28 * Math.max(k, .8)}px;letter-spacing:.2em;color:${flyReadable(P.primary, "#ffffff")};white-space:nowrap">${fe(t.tag)}</div>` : ""}
        <div style="font-family:${fh.head};font-weight:${fh.hw};font-size:${Math.round((S.key === "square" ? 76 : 100) * Math.min(1, 14 / Math.max(8, (t.headline || "").length * .9)))}px;line-height:1.02;letter-spacing:-.025em;margin-top:14px">${fe(t.headline || "Your event")}</div>
        ${t.subhead ? `<div style="font-size:${Math.round(34 * Math.max(k, .85))}px;line-height:1.35;color:#555;margin-top:16px">${fe(t.subhead)}</div>` : ""}
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:16px;font-size:${Math.round(34 * Math.max(k, .85))}px;font-weight:600;color:#333">
          ${t.time ? `<div style="display:flex;align-items:center;gap:16px">${flyIco("clock", 38, P.primary)}${fe(t.time)}</div>` : ""}
          ${t.venue ? `<div style="display:flex;align-items:center;gap:16px">${flyIco("pin", 38, P.primary)}${fe(t.venue)}</div>` : ""}</div>
      </div>
      <div style="position:relative;border-top:5px dashed #ddd;background:${P.light};padding:${Math.round(40 * k)}px 64px;display:flex;align-items:center;justify-content:space-between;gap:24px">
        <div style="position:absolute;left:-30px;top:-32px;width:60px;height:60px;border-radius:50%;background:${P.primary}"></div>
        <div style="position:absolute;right:-30px;top:-32px;width:60px;height:60px;border-radius:50%;background:${P.primary}"></div>
        ${t.date ? `<div style="display:flex;align-items:center;gap:20px"><div style="font-family:${fh.head};font-weight:800;font-size:${Math.round(96 * Math.max(k, .8))}px;line-height:1;color:${P.primary}">${fe(big)}</div>
          <div style="font-weight:700;font-size:${Math.round(32 * Math.max(k, .85))}px;letter-spacing:.08em;color:#333;text-transform:uppercase;max-width:280px;line-height:1.15">${fe(rest)}</div></div>` : `<div style="font-weight:700;font-size:${Math.round(30 * Math.max(k, .85))}px;letter-spacing:.14em;color:#888">ADMIT ONE</div>`}
        ${flyCta(t, P.primary, P.onPrimary, Math.round(32 * Math.max(k, .85)))}
      </div>
    </div>
    ${t.contact ? `<div style="position:absolute;left:0;right:0;bottom:${Math.round(80 * k)}px;display:flex;justify-content:center">${flyContact(t, P.onPrimary, Math.round(30 * Math.max(k, .85)))}</div>` : ""}`;
  },
};
// background under the logo strip, used for automatic contrast decisions
const FLY_LOGO_BG = {
  "promo-bold": (P) => [true, null], "promo-spotlight": (P) => [false, P.primary], "promo-minimal": () => [false, "#faf7f2"],
  "price-menu": (P, F) => [!!F.photo.url, P.deep], "price-cards": (P) => [false, P.primary],
  "event-poster": (P, F) => [!!F.photo.url, P.deep], "event-ticket": (P) => [false, P.primary],
};

function flyStageHTML(F, templateKey = F.template, sizeKey = F.size, id = "") {
  const S = { ...FLY_SIZES[sizeKey], key: sizeKey }, P = flyPalette(), fh = FLY_FONTS[F.font];
  const [overPhoto, under] = FLY_LOGO_BG[templateKey](P, F);
  return `<div ${id ? `id="${id}"` : ""} class="fly" style="position:relative;width:${S.w}px;height:${S.h}px;overflow:hidden;font-family:${fh.body};-webkit-font-smoothing:antialiased">
    ${FLY_RENDER[templateKey](F, P, null, S)}${flyLogoLayer(F, P, overPhoto, under || P.primary)}</div>`;
}

/* ------------------------------ editor UI ----------------------------- */
function flyerView() {
  if (!state.flyer) flyNew();
  const F = state.flyer;
  const tabs = `<div class="inline-flex bg-paper border border-line rounded-xl p-1 mb-4">
    ${[["create", "Create"], ["designs", `My Designs${state.designs?.length ? ` · ${state.designs.length}` : ""}`]].map(([k, l]) =>
      `<button data-fly-tab="${k}" class="px-4 py-1.5 text-sm font-semibold rounded-lg ${F.tab === k ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}">${l}</button>`).join("")}</div>`;
  if (F.tab === "designs") return tabs + flyDesignsView();
  if (!state.brands.length) return tabs + card(`<div class="text-center py-12"><p class="font-display font-bold text-lg">Create a brand first</p>
    <p class="text-sm text-muted mt-1 mb-4">Flyers use your brand's name, logo and colours.</p>
    <button data-nav="brands" class="text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-lg">+ Create brand</button></div>`);
  const S = FLY_SIZES[F.size];
  return `${FLY_STYLE}${tabs}
  <div class="fly-wrap">
    <section class="fly-left">
      <div class="fly-preview-box">
        <div id="flyViewport" class="fly-viewport" data-ratio="${S.w}/${S.h}"><div id="flyScale" class="fly-scale">${flyStageHTML(F, F.template, F.size, "flyStage")}</div></div>
        ${F.photo.url ? `<div class="text-[11px] text-faint text-center mt-2">Tip: drag the photo to reposition it</div>` : ""}
      </div>
    </section>
    <section class="fly-right">
      <div class="fly-source bg-white border border-line rounded-xl2 shadow-card p-3 mb-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-semibold text-muted">What's this flyer about?</span>
          <select id="flyBrand" class="ml-auto text-xs bg-paper border border-line rounded-lg px-2 py-1">${state.brands.map(b => `<option value="${b.id}" ${b.id === F.brandId ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></div>
        <div class="flex gap-2 items-start">
          <textarea id="flySource" rows="2" placeholder="Paste a caption, or describe the offer — e.g. Saturday special: amala + gbegiri + 2 meats ₦2,500, delivery in Bodija" class="flex-1 bg-paper border border-line rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30">${esc(F.source)}</textarea>
          <button id="flyFill" ${F.busy ? "disabled" : ""} class="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-3.5 py-2.5 rounded-lg disabled:opacity-60">
            ${F.busy ? '<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full spin"></span> Writing…' : ic("spark", "w-4 h-4") + " Fill with AI"}</button></div>
      </div>
      <div class="fly-panels grid grid-cols-6 gap-0.5 bg-white border border-line rounded-xl2 p-1 shadow-card">
        ${FLY_PANELS.map(([k, l, ico]) => `<button data-fly-panel="${k}" class="min-w-0 flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[10.5px] font-semibold ${F.panel === k ? "bg-brand-tint text-brand-dark" : "text-muted hover:bg-paper"}">${svgIcon(ico, "w-[18px] h-[18px]")}${l}</button>`).join("")}
      </div>
      <div id="flyPanel" class="bg-white border border-line rounded-xl2 shadow-card p-4 mt-3">${flyPanelHTML()}</div>
      <div class="fly-actions bg-white border border-line rounded-xl2 shadow-card p-3 mt-3 grid grid-cols-2 gap-2">
        <button data-fly-act="download" class="col-span-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl py-3">${svgIcon('<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>', "w-4 h-4")} Download PNG</button>
        <button data-fly-act="share" class="inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand-dark border border-line rounded-xl py-2.5 hover:border-brand/40">${svgIcon('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>', "w-4 h-4")} Share</button>
        <button data-fly-act="save" ${F.saving ? "disabled" : ""} class="inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand-dark border border-line rounded-xl py-2.5 hover:border-brand/40 disabled:opacity-60">${svgIcon('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>', "w-4 h-4")} ${F.saving ? "Saving…" : F.id ? "Save changes" : "Save design"}</button>
        ${state.config?.social_posting ? `<button data-fly-act="post" class="col-span-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand-dark bg-brand-tint rounded-xl py-2.5 hover:bg-brand hover:text-white">${ic("send", "w-4 h-4")} Add to a post</button>` : ""}
        <button data-fly-act="new" class="col-span-2 text-xs text-muted hover:text-ink py-1">Start a new flyer</button>
      </div>
    </section>
  </div>`;
}

function flyPanelHTML() {
  const F = state.flyer, t = F.text;
  const label = (s, extra = "") => `<div class="flex items-center justify-between mb-1.5"><span class="text-xs font-semibold text-muted">${s}</span>${extra}</div>`;
  const input = (k, ph, max = 80) => `<input data-fly-text="${k}" value="${esc(t[k])}" maxlength="${max}" placeholder="${ph}" class="fly-in"/>`;
  const seg = (attr, opts, cur) => `<div class="inline-flex bg-paper border border-line rounded-lg p-0.5">${opts.map(([v, l]) => `<button ${attr}="${v}" class="px-3 py-1.5 text-xs font-semibold rounded-md ${cur === v ? "bg-white shadow-sm text-ink" : "text-muted"}">${l}</button>`).join("")}</div>`;

  if (F.panel === "layout") {
    const kinds = Object.entries(FLY_KINDS).map(([k, v]) => `<button data-fly-kind="${k}" class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold border ${F.kind === k ? "border-brand bg-brand-tint text-brand-dark" : "border-line text-muted hover:border-brand/40"}">${svgIcon(v.icon, "w-4 h-4")}${v.label}</button>`).join("");
    const thumbs = Object.entries(FLY_TEMPLATES).filter(([, v]) => v.kind === F.kind).map(([k, v]) => {
      const S = FLY_SIZES[F.size], sc = 132 / S.w;
      return `<button data-fly-template="${k}" class="fly-thumb ${F.template === k ? "on" : ""}">
        <div style="width:${S.w * sc}px;height:${S.h * sc}px;overflow:hidden;border-radius:10px"><div style="transform:scale(${sc});transform-origin:0 0;pointer-events:none">${flyStageHTML(F, k, F.size)}</div></div>
        <div class="text-[11px] font-semibold mt-1.5 ${F.template === k ? "text-brand-dark" : "text-muted"}">${v.name}</div></button>`;
    }).join("");
    return `${label("What are you making?")}<div class="flex gap-1.5 mb-4">${kinds}</div>
      ${label("Pick a design")}<div class="flex gap-3 overflow-x-auto scroll-thin pb-1">${thumbs}</div>`;
  }
  if (F.panel === "text") {
    let rows = `${label("Small label", '<span class="text-[10.5px] text-faint">e.g. NEW ARRIVAL</span>')}${input("tag", "NEW ARRIVAL", 24)}
      <div class="mt-3">${label("Headline", `<button data-fly-rewrite class="text-[11px] font-semibold text-brand hover:text-brand-dark">${ic("spark", "w-3 h-3 inline -mt-0.5")} Rewrite</button>`)}${input("headline", "Your big line — keep it short", 60)}</div>
      <div class="mt-3">${label("Supporting line")}${input("subhead", "One line that sells it", 110)}</div>`;
    if (F.kind === "promo") rows += `<div class="grid grid-cols-2 gap-2 mt-3"><div>${label("Price")}${input("price", "₦6,500", 16)}</div><div>${label("Old price")}${input("old_price", "₦8,000", 16)}</div></div>`;
    if (F.kind === "event") rows += `<div class="grid grid-cols-2 gap-2 mt-3"><div>${label("Date")}${input("date", "Sat, 14 Dec", 30)}</div><div>${label("Time")}${input("time", "5pm", 24)}</div></div>
      <div class="mt-3">${label("Venue")}${input("venue", "Lighthouse Church, Yaba", 60)}</div>`;
    if (F.kind === "pricelist") {
      const max = { status: 8, portrait: 6, square: 4 }[F.size];
      rows += `<div class="mt-3">${label("Items & prices", `<span class="text-[10.5px] ${t.items.length > max ? "text-gold font-semibold" : "text-faint"}">${t.items.length > max ? `Only ${max} fit this size` : `Up to ${max} on this size`}</span>`)}
        <div class="space-y-1.5">${t.items.map((it, i) => `<div class="flex gap-1.5">
          <input data-fly-item="${i}" data-f="name" value="${esc(it.name)}" maxlength="40" placeholder="Item" class="fly-in" style="flex:1;min-width:0"/>
          <input data-fly-item="${i}" data-f="price" value="${esc(it.price)}" maxlength="14" placeholder="₦0" class="fly-in" style="width:6.5rem;flex:none"/>
          <button data-fly-item-del="${i}" class="shrink-0 w-9 rounded-lg border border-line text-faint hover:text-rose-500" title="Remove">✕</button></div>`).join("")}</div>
        <button data-fly-item-add class="mt-2 text-xs font-semibold text-brand hover:text-brand-dark">+ Add item</button></div>`;
    }
    rows += `<div class="grid grid-cols-2 gap-2 mt-3"><div>${label("Button text")}${input("cta", "Order on WhatsApp", 28)}</div><div>${label("Phone / handle")}${input("contact", "0803 000 0000", 32)}</div></div>`;
    return rows;
  }
  if (F.panel === "photo") {
    const p = F.photo, tpl = FLY_TEMPLATES[F.template];
    return `${!tpl.photo ? `<div class="text-xs bg-gold-tint text-gold border border-gold/25 rounded-lg px-3 py-2 mb-3">The “${tpl.name}” design doesn't use a photo — switch layout to show one.</div>` : ""}
      ${p.url ? `<div class="flex items-center gap-3 mb-3"><img src="${esc(p.url)}" class="w-16 h-16 rounded-lg object-cover border border-line"/>
        <div class="flex-1 text-xs text-muted">Drag the photo on the preview to reposition it.</div>
        <button data-fly-photo-del class="text-xs font-semibold text-rose-500">Remove</button></div>` : ""}
      <div class="grid grid-cols-2 gap-2">
        <label class="fly-up">${svgIcon('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/>', "w-5 h-5")}<span>${F.uploading ? "Uploading…" : p.url ? "Change photo" : "Upload photo"}</span><input type="file" id="flyPhotoFile" accept="image/png,image/jpeg,image/webp" class="hidden"/></label>
        <label class="fly-up">${svgIcon('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', "w-5 h-5")}<span>Take photo</span><input type="file" id="flyPhotoCam" accept="image/*" capture="environment" class="hidden"/></label></div>
      ${p.url ? `<div class="mt-4 space-y-3">
        <label class="block"><div class="flex justify-between text-xs font-semibold text-muted mb-1"><span>Zoom</span><span>${Math.round(p.zoom * 100)}%</span></div><input type="range" data-fly-photo="zoom" min="1" max="2.5" step=".05" value="${p.zoom}" class="w-full accent-brand"/></label>
        <label class="block"><div class="text-xs font-semibold text-muted mb-1">Left ↔ right</div><input type="range" data-fly-photo="x" min="0" max="100" value="${p.x}" class="w-full accent-brand"/></label>
        <label class="block"><div class="text-xs font-semibold text-muted mb-1">Up ↕ down</div><input type="range" data-fly-photo="y" min="0" max="100" value="${p.y}" class="w-full accent-brand"/></label>
      </div>` : `<p class="text-[11px] text-faint mt-3">Tip: a bright, uncluttered product photo works best. JPG, PNG or WebP up to 8MB.</p>`}`;
  }
  if (F.panel === "logo") {
    const brand = flyBrand(), L = F.logo, url = L.override || brand?.logo;
    const info = url ? flyLogoInfo[url] : null;
    const owner = !state.usage?.is_team_member;
    return `<div class="flex items-center gap-3 mb-4">
        <div class="w-20 h-20 rounded-xl border border-line grid place-items-center overflow-hidden fly-checker">${url ? `<img src="${esc(url)}" class="max-w-full max-h-full object-contain"/>` : `<span class="text-[11px] text-faint text-center px-1">No logo</span>`}</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold truncate">${L.override ? "Logo for this flyer only" : esc(brand?.name || "")}</div>
          <div class="text-xs text-muted mt-0.5">${url ? (info?.hasBg ? "Has a solid background — shown on a white badge" : "Transparent logo — sits cleanly on the design") : "We'll use your brand name as a wordmark until you add a logo."}</div></div></div>
      <div class="grid grid-cols-2 gap-2">
        ${owner ? `<label class="fly-up">${svgIcon('<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>', "w-5 h-5")}<span>${brand?.logo ? "Replace brand logo" : "Upload brand logo"}</span><input type="file" id="flyLogoFile" accept="image/png,image/jpeg,image/webp" class="hidden"/></label>` : ""}
        <label class="fly-up">${svgIcon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/>', "w-5 h-5")}<span>Use another logo<br><span class="font-normal text-[10.5px] text-faint">this flyer only</span></span><input type="file" id="flyLogoOnce" accept="image/png,image/jpeg,image/webp" class="hidden"/></label></div>
      ${L.override ? `<button data-fly-logo-clear class="mt-2 text-xs font-semibold text-muted hover:text-ink">← Back to the brand logo</button>` : ""}
      <div class="mt-4 space-y-3">
        <div class="flex items-center justify-between"><span class="text-xs font-semibold text-muted">Show logo</span>
          <button data-fly-logo-toggle class="relative w-10 h-6 rounded-full ${L.show ? "bg-brand" : "bg-line"}"><span class="absolute top-0.5 ${L.show ? "left-[18px]" : "left-0.5"} w-5 h-5 rounded-full bg-white shadow transition-all"></span></button></div>
        <div><div class="text-xs font-semibold text-muted mb-1.5">Position</div>${seg("data-fly-logo-pos", [["tl", "Top left"], ["tc", "Centre"], ["tr", "Top right"]], L.pos)}</div>
        <div><div class="text-xs font-semibold text-muted mb-1.5">Size</div>${seg("data-fly-logo-size", [["s", "Small"], ["m", "Medium"], ["l", "Large"]], L.size)}</div>
        <div><div class="text-xs font-semibold text-muted mb-1.5">Style</div>${seg("data-fly-logo-style", [["auto", "Auto"], ["badge", "White badge"], ["plain", "Plain"]], L.style)}
          <p class="text-[10.5px] text-faint mt-1">Auto adds a white badge when the logo has a box around it or would be hard to see.</p></div>
      </div>
      ${owner && brand?.logo && flyLogoInfo[brand.logo]?.colors?.length ? `<div class="mt-4 bg-paper border border-line rounded-lg p-3">
        <div class="text-xs font-semibold mb-2">Colours found in your logo</div>
        <div class="flex items-center gap-2">${flyLogoInfo[brand.logo].colors.map(c => `<span class="w-7 h-7 rounded-full border border-black/10" style="background:${c}"></span>`).join("")}
          <button data-fly-logo-colors class="ml-auto text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg px-3 py-1.5">Use as brand colours</button></div></div>` : ""}`;
  }
  if (F.panel === "style") {
    const brand = flyBrand(), bc = flyBrandColors(brand);
    const sw = (key, pair, name) => `<button data-fly-palette="${key}" class="flex flex-col items-center gap-1.5 p-1.5 rounded-xl border ${F.paletteKey === key ? "border-brand ring-1 ring-brand" : "border-transparent hover:border-line"}">
      <span class="w-11 h-11 rounded-full overflow-hidden border border-black/10 flex" style="transform:rotate(-30deg)"><span class="flex-1" style="background:${pair[0]}"></span><span class="flex-1" style="background:${pair[1] || flyMix(pair[0], "#fff", .6)}"></span></span>
      <span class="text-[10.5px] font-semibold text-muted leading-tight text-center">${name}</span></button>`;
    return `<div class="text-xs font-semibold text-muted mb-2">Colours</div>
      <div class="grid grid-cols-4 sm:grid-cols-5 gap-1">
        ${bc.length ? sw("brand", [bc[0], bc[1]], "Your brand") : ""}
        ${Object.entries(FLY_PALETTES).map(([k, v]) => sw(k, v.c, v.name)).join("")}
        ${sw("custom", F.custom, "Custom")}</div>
      ${!bc.length ? `<p class="text-[11px] text-faint mt-2">Add a logo in the Logo tab and Vertil can pick your brand colours from it.</p>` : ""}
      ${F.paletteKey === "custom" ? `<div class="flex items-center gap-4 mt-3 bg-paper border border-line rounded-lg p-3">
        <label class="flex items-center gap-2 text-xs font-semibold text-muted">Main <input type="color" data-fly-custom="0" value="${F.custom[0]}" class="w-9 h-9 rounded cursor-pointer"/></label>
        <label class="flex items-center gap-2 text-xs font-semibold text-muted">Accent <input type="color" data-fly-custom="1" value="${F.custom[1]}" class="w-9 h-9 rounded cursor-pointer"/></label>
        ${brand && !state.usage?.is_team_member ? `<button data-fly-save-colors class="ml-auto text-xs font-semibold text-brand hover:text-brand-dark">Save to brand</button>` : ""}</div>` : ""}
      <div class="text-xs font-semibold text-muted mt-5 mb-2">Font style</div>
      <div class="grid grid-cols-3 gap-2">${Object.entries(FLY_FONTS).map(([k, v]) => `<button data-fly-font="${k}" class="py-3 rounded-xl border text-center ${F.font === k ? "border-brand bg-brand-tint" : "border-line hover:border-brand/40"}">
        <div style="font-family:${v.head};font-weight:${v.hw};font-size:22px;line-height:1">Aa</div><div class="text-[11px] font-semibold text-muted mt-1">${v.name}</div></button>`).join("")}</div>`;
  }
  if (F.panel === "size") {
    return `<div class="space-y-2">${Object.entries(FLY_SIZES).map(([k, v]) => {
      const h = 46, w = Math.round(h * v.w / v.h);
      return `<button data-fly-size="${k}" class="w-full flex items-center gap-3 p-3 rounded-xl border text-left ${F.size === k ? "border-brand bg-brand-tint" : "border-line hover:border-brand/40"}">
        <span class="w-14 grid place-items-center"><span class="rounded-[5px] border-2 ${F.size === k ? "border-brand bg-white" : "border-faint"}" style="width:${w}px;height:${h}px"></span></span>
        <span class="flex-1"><span class="block text-sm font-semibold">${v.label}</span><span class="block text-xs text-muted">${v.sub}</span></span>
        <span class="text-[11px] font-mono text-faint">${v.w}×${v.h}</span></button>`;
    }).join("")}</div>
      <p class="text-[11px] text-faint mt-3">Switching size keeps your words, photo and logo — the design reflows to fit.</p>`;
  }
  return "";
}

function flyDesignsView() {
  const D = state.designs;
  if (!D) return `<div class="grid place-items-center py-24"><div class="w-9 h-9 border-[3px] border-brand/25 border-t-brand rounded-full spin"></div></div>`;
  if (!D.length) return card(`<div class="text-center py-14"><div class="w-12 h-12 mx-auto rounded-xl2 bg-brand-tint text-brand grid place-items-center mb-3">${svgIcon(FLY_PANELS[0][2], "w-6 h-6")}</div>
    <p class="font-display font-bold text-lg">No saved designs yet</p><p class="text-sm text-muted mt-1">Make a flyer and tap Save design — it'll live here for reuse.</p>
    <button data-fly-tab="create" class="mt-4 text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-5 py-2.5 rounded-xl">Make a flyer</button></div>`);
  return `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-24 md:pb-0">${D.map(d => `
    <div class="bg-white border border-line rounded-xl2 shadow-card overflow-hidden flex flex-col">
      <button data-fly-open="${d.id}" class="block bg-paper aspect-[4/5] overflow-hidden">${d.image ? `<img src="${esc(d.image)}?v=${Math.round(d.updated_at || 0)}" class="w-full h-full object-contain"/>` : ""}</button>
      <div class="p-3 flex-1 flex flex-col">
        <div class="text-sm font-semibold truncate">${esc(d.title || "Untitled")}</div>
        <div class="text-[11px] text-faint truncate">${esc([d.brand_name, FLY_KINDS[d.kind]?.label].filter(Boolean).join(" · "))} · ${relTime(d.updated_at)}</div>
        <div class="flex gap-1.5 mt-3">
          <button data-fly-open="${d.id}" class="flex-1 text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg py-1.5">Edit</button>
          ${d.image ? `<a href="${esc(d.image)}" download="${esc((d.title || "flyer").replace(/[^\w-]+/g, "-"))}.png" class="text-xs font-semibold border border-line rounded-lg px-2.5 py-1.5 hover:border-brand/40" title="Download">⤓</a>` : ""}
          <button data-fly-del="${d.id}" class="text-xs font-semibold text-rose-500 border border-line rounded-lg px-2.5 py-1.5 hover:border-rose-300" title="Delete">✕</button></div>
      </div></div>`).join("")}</div>`;
}

const FLY_STYLE = `<style>
.fly-wrap{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:20px;align-items:start}
.fly-left{position:sticky;top:12px}
.fly-preview-box{background:repeating-conic-gradient(#eef2f1 0 25%, #f7f9f8 0 50%) 0 0/22px 22px;border:1px solid #e2e8e6;border-radius:16px;padding:18px;display:flex;flex-direction:column;align-items:center}
.fly-viewport{position:relative;overflow:hidden;border-radius:12px;box-shadow:0 18px 50px rgba(12,39,36,.22);background:#fff;touch-action:none}
.fly-scale{transform-origin:0 0}
.fly-in{width:100%;background:#f5f6f8;border:1px solid #eceef1;border-radius:.6rem;padding:.55rem .7rem;font-size:.85rem;outline:none}
.fly-in:focus{border-color:#0e9488;box-shadow:0 0 0 3px rgba(14,148,136,.15)}
.fly-up{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;border:1.5px dashed #d5dedb;border-radius:12px;padding:14px 8px;font-size:12px;font-weight:600;color:#0c7a70;cursor:pointer}
.fly-up:hover{border-color:#0e9488;background:#f4faf9}
.fly-thumb{flex:none;display:flex;flex-direction:column;align-items:center;padding:6px;border-radius:14px;border:2px solid transparent}
.fly-thumb.on{border-color:#0e9488;background:#e4f3f1}
.fly-checker{background:repeating-conic-gradient(#eef2f1 0 25%, #fff 0 50%) 0 0/14px 14px}
[data-fly-drag]{cursor:grab}
@media (max-width:900px){
  .fly-wrap{grid-template-columns:1fr;gap:12px}
  .fly-left{position:static}
  .fly-preview-box{padding:12px}
}
</style>`;

/* ------------------------------ rendering ----------------------------- */
function flyFit() {
  const vp = document.getElementById("flyViewport"), sc = document.getElementById("flyScale");
  if (!vp || !sc || !state.flyer) return;
  const S = FLY_SIZES[state.flyer.size], box = vp.parentElement;
  const mobile = window.innerWidth < 900;
  const maxW = box.clientWidth - (mobile ? 24 : 36);
  const top = Math.max(12, box.getBoundingClientRect().top);
  const maxH = mobile ? Math.min(window.innerHeight * .6, 600) : Math.max(380, window.innerHeight - top - 70);
  const s = Math.min(maxW / S.w, maxH / S.h);
  vp.style.width = Math.round(S.w * s) + "px"; vp.style.height = Math.round(S.h * s) + "px";
  sc.style.transform = `scale(${s})`;
}
function flyRedraw() {
  const sc = document.getElementById("flyScale"); if (!sc) return;
  sc.innerHTML = flyStageHTML(state.flyer, state.flyer.template, state.flyer.size, "flyStage");
  state.flyer.dirty = true;
  flyFit(); flyWireDrag();
}
function flyRepanel() {
  const el = document.getElementById("flyPanel"); if (!el) return;
  el.innerHTML = flyPanelHTML(); wireFlyerPanel();
}

/* --------------------------------- AI --------------------------------- */
async function flyFill(headlineOnly = false) {
  const F = state.flyer;
  const src = (F.source || "").trim();
  if (!src) { toast("Tell Vertil what the flyer is about first"); document.getElementById("flySource")?.focus(); return; }
  F.busy = true; if (state.view === "flyer") render();
  try {
    const d = await api("/api/flyer/fill", { method: "POST", body: JSON.stringify({ source: src, brand_id: F.brandId, tone: F.tone, kind: headlineOnly ? F.kind : null }) });
    const f = d.flyer || {};
    if (headlineOnly) { F.text.headline = f.headline || F.text.headline; if (f.tag) F.text.tag = f.tag; }
    else {
      const items = f.items || [];
      F.text = { ...flyBlankText(), ...f, items };
      if (f.kind !== F.kind) { F.kind = f.kind; F.template = Object.keys(FLY_TEMPLATES).find(k => FLY_TEMPLATES[k].kind === f.kind); }
      if (F.kind === "pricelist" && items.length > { status: 8, portrait: 6, square: 4 }[F.size]) F.size = "status";
    }
    if (d.used != null && state.usage) { state.usage.used = d.used; }
  } catch (ex) { if (ex.data?.upgrade) openUpgrade(ex.message); else toast("⚠ " + ex.message); }
  F.busy = false; if (state.view === "flyer") render();
}

/* ------------------------------- export ------------------------------- */
async function flyPng() {
  const node = document.getElementById("flyStage");
  if (!node || !window.htmlToImage) throw new Error("Image tools didn't load — check your connection");
  const S = FLY_SIZES[state.flyer.size];
  await Promise.all([...node.querySelectorAll("img")].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })));
  try { await document.fonts.ready; } catch {}
  const opts = { width: S.w, height: S.h, pixelRatio: 1, cacheBust: false, backgroundColor: "#ffffff" };
  try { return await htmlToImage.toPng(node, opts); }
  catch { return await htmlToImage.toPng(node, { ...opts, skipFonts: true }); }
}
function flyFileName() {
  const F = state.flyer, b = flyBrand();
  return `${(b?.name || "vertil").replace(/[^\w]+/g, "-").toLowerCase()}-${F.kind}-${F.size}.png`;
}
async function flyAction(act) {
  const F = state.flyer;
  if (act === "new") { flyNew({ brandId: F.brandId }); render(); return; }
  try {
    const png = await flyPng();
    if (act === "download") {
      const a = document.createElement("a"); a.href = png; a.download = flyFileName(); document.body.appendChild(a); a.click(); a.remove();
      toast("Flyer downloaded ✓");
    } else if (act === "share") {
      const blob = await (await fetch(png)).blob();
      const file = new File([blob], flyFileName(), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: F.source || "" }).catch(() => {});
      } else {
        const a = document.createElement("a"); a.href = png; a.download = flyFileName(); a.click();
        toast("Saved to your downloads — share it from your gallery or WhatsApp");
      }
    } else if (act === "save") {
      F.saving = true; render();
      const data = { kind: F.kind, template: F.template, size: F.size, paletteKey: F.paletteKey, custom: F.custom, font: F.font,
        text: F.text, photo: F.photo, logo: F.logo, source: F.source, tone: F.tone };
      const saved = await api("/api/designs", { method: "POST", body: JSON.stringify({
        id: F.id, brand_id: F.brandId, title: F.text.headline || "Untitled flyer", kind: F.kind, data, image: png }) });
      F.id = saved.id; F.dirty = false; F.saving = false;
      state.designs = await api("/api/designs").catch(() => state.designs);
      toast("Saved to My Designs ✓"); render();
    } else if (act === "post") {
      const blob = await (await fetch(png)).blob();
      const file = new File([blob], flyFileName(), { type: "image/png" });
      const t = F.text;
      const caption = (F.source || "").trim() || [t.headline, t.subhead,
        t.price && `${t.price}${t.old_price ? ` (was ${t.old_price})` : ""}`,
        ...(t.items || []).filter(i => i.name).map(i => `• ${i.name}${i.price ? ` — ${i.price}` : ""}`),
        [t.date, t.time, t.venue].filter(Boolean).join(" · "),
        [t.cta, t.contact].filter(Boolean).join(": ")].filter(Boolean).join("\n");
      const conn = state.social[F.brandId] || {};
      if (!PLATFORM_ORDER.some(k => conn[k]?.status === "connected")) toast("Connect Instagram, Facebook or another platform at the top to post this flyer");
      openComposer({ base: caption, mediaFile: file, mediaUrl: URL.createObjectURL(file), mediaType: "photo", source: "From Flyer Maker", brandId: F.brandId });
    }
  } catch (ex) { F.saving = false; toast("⚠ " + (ex.message || "Couldn't make the image")); render(); }
}

/* ------------------------------- uploads ------------------------------ */
async function flyUploadPhoto(file) {
  const F = state.flyer;
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast("⚠ That isn't an image");
  if (file.size > 8 * 1024 * 1024) return toast("⚠ That photo is over 8MB");
  F.uploading = true; flyRepanel();
  const fd = new FormData(); fd.append("photo", file);
  try {
    const res = await fetch("/api/flyer/photo", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Upload failed");
    F.photo = { url: d.url, zoom: 1, x: 50, y: 50 };
  } catch (ex) { toast("⚠ " + ex.message); }
  F.uploading = false; flyRedraw(); flyRepanel();
}

/* -------------------------------- wiring ------------------------------ */
function flyWireDrag() {
  const el = document.querySelector("#flyStage [data-fly-drag]"); if (!el) return;
  el.onpointerdown = (e) => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing";
    const F = state.flyer, r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = F.photo.x, oy = F.photo.y;
    el.onpointermove = (m) => {
      F.photo.x = Math.max(0, Math.min(100, ox - (m.clientX - sx) / r.width * 100 / F.photo.zoom * 1.6));
      F.photo.y = Math.max(0, Math.min(100, oy - (m.clientY - sy) / r.height * 100 / F.photo.zoom * 1.6));
      const img = el.querySelector("img"); if (img) { img.style.objectPosition = `${F.photo.x}% ${F.photo.y}%`; img.style.transformOrigin = `${F.photo.x}% ${F.photo.y}%`; }
    };
    el.onpointerup = () => { el.onpointermove = null; el.style.cursor = "grab"; F.dirty = true; if (F.panel === "photo") flyRepanel(); };
  };
}

function wireFlyerPanel() {
  const F = state.flyer, P = document.getElementById("flyPanel"); if (!P) return;
  const q = (s) => [...P.querySelectorAll(s)];
  q("[data-fly-kind]").forEach(b => b.onclick = () => { F.kind = b.dataset.flyKind; F.template = Object.keys(FLY_TEMPLATES).find(k => FLY_TEMPLATES[k].kind === F.kind); flyRedraw(); flyRepanel(); });
  q("[data-fly-template]").forEach(b => b.onclick = () => { F.template = b.dataset.flyTemplate; flyRedraw(); flyRepanel(); });
  q("[data-fly-text]").forEach(i => i.oninput = () => { F.text[i.dataset.flyText] = i.value; flyRedraw(); });
  q("[data-fly-item]").forEach(i => i.oninput = () => { F.text.items[+i.dataset.flyItem][i.dataset.f] = i.value; flyRedraw(); });
  q("[data-fly-item-del]").forEach(b => b.onclick = () => { F.text.items.splice(+b.dataset.flyItemDel, 1); flyRedraw(); flyRepanel(); });
  q("[data-fly-item-add]").forEach(b => b.onclick = () => { F.text.items.push({ name: "", price: "" }); flyRedraw(); flyRepanel(); P.querySelector(`[data-fly-item="${F.text.items.length - 1}"]`)?.focus(); });
  q("[data-fly-rewrite]").forEach(b => b.onclick = () => flyFill(true));
  q("[data-fly-photo]").forEach(r => r.oninput = () => { F.photo[r.dataset.flyPhoto] = +r.value; flyRedraw(); const lbl = r.closest("label")?.querySelector("span:last-child"); if (r.dataset.flyPhoto === "zoom" && lbl) lbl.textContent = Math.round(r.value * 100) + "%"; });
  q("[data-fly-photo-del]").forEach(b => b.onclick = () => { F.photo = { url: null, zoom: 1, x: 50, y: 50 }; flyRedraw(); flyRepanel(); });
  ["flyPhotoFile", "flyPhotoCam"].forEach(id => { const i = document.getElementById(id); if (i) i.onchange = () => flyUploadPhoto(i.files[0]); });
  const lf = document.getElementById("flyLogoFile");
  if (lf) lf.onchange = async () => {
    const r = await uploadBrandLogo(F.brandId, lf.files[0]); if (!r) return;
    F.logo.override = null; F.logo.show = true; flyRedraw(); flyRepanel();
  };
  const lo = document.getElementById("flyLogoOnce");
  if (lo) lo.onchange = async () => {
    const file = lo.files[0]; if (!file) return;
    const fd = new FormData(); fd.append("photo", file); fd.append("keep_alpha", "1");
    const res = await fetch("/api/flyer/photo", { method: "POST", body: fd }); const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast("⚠ " + (d.error || "Upload failed"));
    await flyAnalyseLogo(d.url); F.logo.override = d.url; F.logo.show = true; flyRedraw(); flyRepanel();
  };
  q("[data-fly-logo-clear]").forEach(b => b.onclick = () => { F.logo.override = null; flyRedraw(); flyRepanel(); });
  q("[data-fly-logo-toggle]").forEach(b => b.onclick = () => { F.logo.show = !F.logo.show; flyRedraw(); flyRepanel(); });
  q("[data-fly-logo-pos]").forEach(b => b.onclick = () => { F.logo.pos = b.dataset.flyLogoPos; flyRedraw(); flyRepanel(); });
  q("[data-fly-logo-size]").forEach(b => b.onclick = () => { F.logo.size = b.dataset.flyLogoSize; flyRedraw(); flyRepanel(); });
  q("[data-fly-logo-style]").forEach(b => b.onclick = () => { F.logo.style = b.dataset.flyLogoStyle; flyRedraw(); flyRepanel(); });
  q("[data-fly-logo-colors]").forEach(b => b.onclick = async () => {
    const brand = flyBrand(); await saveBrandColors(brand.id, flyLogoInfo[brand.logo].colors.slice(0, 2));
    F.paletteKey = "brand"; toast("Brand colours saved ✓"); flyRedraw(); flyRepanel();
  });
  q("[data-fly-palette]").forEach(b => b.onclick = () => { F.paletteKey = b.dataset.flyPalette; flyRedraw(); flyRepanel(); });
  q("[data-fly-custom]").forEach(i => i.oninput = () => { F.custom[+i.dataset.flyCustom] = i.value; flyRedraw(); });
  q("[data-fly-save-colors]").forEach(b => b.onclick = async () => { await saveBrandColors(F.brandId, F.custom); F.paletteKey = "brand"; toast("Saved as brand colours ✓"); flyRedraw(); flyRepanel(); });
  q("[data-fly-font]").forEach(b => b.onclick = () => { F.font = b.dataset.flyFont; flyRedraw(); flyRepanel(); });
  q("[data-fly-size]").forEach(b => b.onclick = () => { F.size = b.dataset.flySize; flyRedraw(); flyRepanel(); flyFit(); });
}

function wireFlyer() {
  const F = state.flyer; if (!F) return;
  $$("[data-fly-tab]").forEach(b => b.onclick = async () => { F.tab = b.dataset.flyTab; if (F.tab === "designs" && !state.designs) state.designs = await api("/api/designs").catch(() => []); render(); });
  if (F.tab === "designs") {
    $$("[data-fly-open]").forEach(b => b.onclick = () => {
      const d = (state.designs || []).find(x => x.id === +b.dataset.flyOpen); if (!d) return;
      let data = {}; try { data = JSON.parse(d.data || "{}"); } catch {}
      flyNew({ brandId: d.brand_id });
      Object.assign(state.flyer, data, { id: d.id, tab: "create", panel: "text", busy: false, saving: false, uploading: false });
      state.flyer.text = { ...flyBlankText(), ...(data.text || {}) };
      render();
    });
    $$("[data-fly-del]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this design?")) return;
      await api(`/api/designs/${b.dataset.flyDel}`, { method: "DELETE" }).catch(e => toast("⚠ " + e.message));
      state.designs = (state.designs || []).filter(x => x.id !== +b.dataset.flyDel); render();
    });
    return;
  }
  const src = $("#flySource"); if (src) src.oninput = () => { F.source = src.value; };
  const bs = $("#flyBrand"); if (bs) bs.onchange = async () => {
    F.brandId = +bs.value; const brand = flyBrand();
    if (brand?.logo) await flyAnalyseLogo(brand.logo);
    if (F.paletteKey === "brand" && !flyBrandColors(brand).length) F.paletteKey = "teal";
    else if (flyBrandColors(brand).length && F.paletteKey === "teal") F.paletteKey = "brand";
    flyRedraw(); flyRepanel();
  };
  const fill = $("#flyFill"); if (fill) fill.onclick = () => flyFill(false);
  $$("[data-fly-panel]").forEach(b => b.onclick = () => { F.panel = b.dataset.flyPanel; $$("[data-fly-panel]").forEach(x => { const on = x === b; x.classList.toggle("bg-brand-tint", on); x.classList.toggle("text-brand-dark", on); x.classList.toggle("text-muted", !on); }); flyRepanel(); });
  $$("[data-fly-act]").forEach(b => b.onclick = () => flyAction(b.dataset.flyAct));
  wireFlyerPanel(); flyFit(); flyWireDrag();
  const brand = flyBrand(), url = F.logo.override || brand?.logo;
  if (url && !flyLogoInfo[url]) flyAnalyseLogo(url).then(() => { flyRedraw(); if (F.panel === "logo") flyRepanel(); });
  if (!window.__flyResize) { window.__flyResize = true; window.addEventListener("resize", () => { if (state.view === "flyer") flyFit(); }); }
}

/* ------------------------- Brands page: logo UI ------------------------ */
function brandLogoBlock(b) {
  const owner = !state.usage?.is_team_member;
  const cols = flyBrandColors(b);
  const found = b.logo && flyLogoInfo[b.logo]?.colors?.length && !cols.length ? flyLogoInfo[b.logo].colors : null;
  return `<div class="flex items-center gap-3 mt-3 pt-3 border-t border-line">
    <div class="w-12 h-12 rounded-lg border border-line grid place-items-center overflow-hidden shrink-0" style="background:repeating-conic-gradient(#eef2f1 0 25%,#fff 0 50%) 0 0/12px 12px">${b.logo ? `<img src="${esc(b.logo)}" class="max-w-full max-h-full object-contain"/>` : `<span class="text-base font-display font-bold text-faint">${esc((b.name || "?")[0].toUpperCase())}</span>`}</div>
    <div class="flex-1 min-w-0">
      <div class="text-[11px] font-semibold text-muted">${b.logo ? "Logo" : "No logo yet"}</div>
      ${cols.length ? `<div class="flex gap-1 mt-1">${cols.map(c => `<span class="w-4 h-4 rounded-full border border-black/10" style="background:${c}"></span>`).join("")}</div>` : `<div class="text-[10.5px] text-faint">Used on flyers & designs</div>`}
    </div>
    ${owner ? `<label class="shrink-0 text-xs font-semibold text-brand-dark border border-line rounded-lg px-2.5 py-1.5 hover:border-brand/40 cursor-pointer">${b.logo ? "Change" : "Upload logo"}<input type="file" data-brand-logo="${b.id}" accept="image/png,image/jpeg,image/webp" class="hidden"/></label>
      ${b.logo ? `<button data-brand-logo-del="${b.id}" class="shrink-0 text-xs text-faint hover:text-rose-500" title="Remove logo">✕</button>` : ""}` : ""}
  </div>
  ${found && owner ? `<div class="flex items-center gap-2 mt-2 bg-paper rounded-lg px-2.5 py-2"><span class="text-[11px] text-muted">From your logo:</span>${found.map(c => `<span class="w-4 h-4 rounded-full border border-black/10" style="background:${c}"></span>`).join("")}
    <button data-brand-use-colors="${b.id}" class="ml-auto text-[11px] font-semibold text-brand hover:text-brand-dark">Use as brand colours</button></div>` : ""}`;
}
function wireBrandLogos() {
  $$("[data-brand-logo]").forEach(i => i.onchange = async () => { const r = await uploadBrandLogo(+i.dataset.brandLogo, i.files[0]); if (r) render(); });
  $$("[data-brand-logo-del]").forEach(b => b.onclick = async () => { await removeBrandLogo(+b.dataset.brandLogoDel); render(); });
  $$("[data-brand-use-colors]").forEach(b => b.onclick = async () => {
    const br = state.brands.find(x => x.id === +b.dataset.brandUseColors);
    await saveBrandColors(br.id, flyLogoInfo[br.logo].colors.slice(0, 2)); toast("Brand colours saved ✓"); render();
  });
  state.brands.forEach(b => { if (b.logo && !flyLogoInfo[b.logo]) flyAnalyseLogo(b.logo).then(() => { if (state.view === "brands") render(); }); });
}
