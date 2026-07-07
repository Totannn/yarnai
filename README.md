# Vertil Design System

**Vertil** is the Nigerian brand-voice AI content engine behind the product codebase
"Yarn AI" (internal repo name). It generates on-brand marketing copy — Instagram
captions, WhatsApp broadcasts, product descriptions, ad copy, email, blog intros —
in real Nigerian voices (Pidgin, Yoruba/Igbo/Hausa code-switching, Lagos-corporate,
luxury, faith, friendly), plus a Nigerian-calendar-aware content planner, a Naira
rate advisor, a personal-brand advisor, a short-video script writer, and a gig
income diary. Built with Flask + Claude, server-rendered shell + a single-page
vanilla-JS "studio" frontend (no framework), Tailwind CDN for utility classes.

**Sources this system was built from** (local codebase mount, read-only):
- `yarn-ai/templates/landing.html` — public marketing site
- `yarn-ai/templates/index.html` + `yarn-ai/static/app.js` — the Studio app (the
  actual product: sidebar + topbar shell, Studio generator, Brands, Content
  Calendar, Rate/Brand Advisor, Script Writer, Gig Diary, Account, Pricing)
- `yarn-ai/templates/admin.html` + `yarn-ai/static/admin.js` — internal admin console (dark theme)
- `yarn-ai/static/favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` — the real app icon/logo mark
- `yarn-ai/Vertil Logo Options/Vertil Brand System.dc.html` — the adopted brand system (color themes, logo lockups, motion) — "Signal" theme is what shipped to production
- `yarn-ai/Vertil Logo Options/Vertil Logo Options.dc.html` — earlier logo exploration (not shipped; kept for context only)
- `yarn-ai/Vertil Launch Animations (1)/` — marketing launch-film HTML/JSX mockups (hero, moat, voices, calendar, WhatsApp sample) and a home-dashboard mockup
- `yarn-ai/README.md`, `yarn-ai/voice.py`, `yarn-ai/server.py` — product/module description and the "brand voice" content-generation model

No Figma file or slide deck was attached to this project — everything above came
from the mounted codebase.

## Index

- `styles.css` — root stylesheet, `@import`s everything below. Link this one file.
- `tokens/colors.css` — base palette + semantic aliases (incl. admin dark theme)
- `tokens/typography.css` — Space Grotesk / Space Mono, type scale
- `tokens/spacing.css` — spacing scale, radii, shadows
- `assets/` — real logo mark (favicon, app icons at all sizes)
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/core/` — **Button, Badge, Avatar**
- `components/forms/` — **Input, Textarea, Select, Chip**
- `components/navigation/` — **Logo, NavItem, NavSectionLabel, Topbar**
- `components/data/` — **Card, StatCard, PlanCard**
- `components/feedback/` — **Toast, ProgressMeter**
- `ui_kits/studio/` — click-through recreation of the Studio app (sidebar, Studio generator, Brands, Pricing, Account)
- `ui_kits/marketing/` — click-through recreation of the public landing page
- `marketing/launch/` — 5-part vertical (9:16) launch-film animation set (hero film + 4 supporting cuts), sourced from `yarn-ai/Vertil Launch Animations (1)/launch/` and registered in the Design System tab under "Motion"
- `SKILL.md` — portable skill file for use in Claude Code

### Intentional additions
No component library (`.jsx`/Storybook/etc.) exists in the source — the product
is hand-built HTML strings in `app.js`. So this system authors a standard
component set **sized to what the product actually uses**, not a generic kit:
every component above corresponds to a repeated visual pattern found in
`app.js`/`landing.html` (card, chip, button, nav item, plan card, progress
meter, etc). Nothing was invented beyond that — e.g. there is no Tabs, Tooltip,
Dialog, Switch, or Toast-stack in the product, so none were added here.

## Caveats / open questions
- **No brand illustrations, photography, or icon library exist in the source.**
  Every icon in the product is a hand-drawn inline SVG path (24×24 viewBox,
  1.7px stroke) — see Iconography below. This system copies the real app-icon
  PNGs/SVG but does not invent any illustration.
- Fonts (Space Grotesk, Space Mono) are loaded from Google Fonts CDN in
  production — no local font binaries exist in the codebase, so `styles.css`
  ships the same CDN `@import` rather than a substituted family.
- The admin console (`admin.js`) was read only at a high level (dark theme
  tokens captured in `tokens/colors.css`'s `[data-theme="admin"]` scope); no
  admin UI kit was built — flag if you want one.
- The "Logo Options" exploration file shows 5 discarded directions; only the
  shipped "Signal" teal mark/wordmark is used in components and UI kits.

---

## Content fundamentals

**Voice:** Vertil's own marketing copy is confident, short-sentence, a little
playful, and unmistakably Nigerian — it code-switches Pidgin into English
mid-sentence for texture and credibility ("Aunty, **Black Friday don land!**
That Ankara gown wey you dey eye? **30% OFF** — as e dey hot."). Product UI
copy (buttons, empty states, subtitles) stays plain, warm, second-person
English: *"Ready when you are"*, *"Pick a tone and content type, drop your
brief, and hit Generate."*

**Person & tone:** Direct "you" address throughout — onboarding, empty states,
and subtitles all speak to the user, never "the user" in third person. Product
subtitles are one short declarative sentence each, e.g. *"Never undercharge
again — get realistic Naira rates for any gig, plus a script to quote clients
with confidence."*

**Casing:** Sentence case everywhere in the UI (buttons, nav labels, headings)
— never Title Case, never ALL CAPS except for the intentional mono "eyebrow"
labels (`WHY VERTIL`, `THE LANGUAGE LAYER`, `FEATURES`) which are always
tracked-out uppercase in `font-mono` at 10–11px.

**Numbers as headline devices:** marketing sections often lead a stat block
with a huge glyph instead of a number label — `8` (voices), `₦` (Naira-native),
`∞` (it learns your brand) — each paired with a bold one-line claim beneath.

**Nigerian specificity is the whole pitch.** Copy names real cities (Surulere,
Aba, Kano, Enugu, Lagos), real cultural moments (Detty December, ember months,
salary cycles, aso-ebi season), real payment rails (Paystack, Naira, USSD) and
real code-switched language — never generic "localization" language.

**Emoji:** essentially unused in product chrome. The one exception is a single
✓ (checkmark) glyph in pricing feature lists and a ⚠ before inline error
toasts — both are typographic symbols, not emoji faces/objects. Do not add
emoji to buttons, empty states, or nav.

**Voice-of-voices:** each of the 8 selectable Nigerian tones gets a one-line
"blurb" that itself is written *in* that voice as a demonstration — e.g. Naija
Pidgin's blurb is a Pidgin sentence, Lagos Corporate's is polished English.
When writing new tone copy, the blurb must be a genuine sample of the voice,
not a description of it.

---

## Visual foundations

**Palette:** a single deep-teal/forest-green system carries the whole brand —
no secondary hue. `#0e9488` (brand teal) is the one action color; `#2dd4bf`
(bright) is reserved for on-dark accents and the animated logo's "exhaust";
`#0c2724` (forest) is the one dark surface used for the marketing hero, the
auth-screen split panel, and the admin console. A warm off-white paper
(`#f4f7f6`) is the app background — never pure white for large surfaces (only
cards are pure white, for contrast). Status colors borrow standard Tailwind
hues (amber for pending, sky for "ongoing", rose for destructive) rather than
inventing brand-specific status colors.

**Type:** Space Grotesk (display + body, weights 400–700) paired with Space
Mono (uppercase tracked-out eyebrows, timestamps, technical/data labels —
prices are NOT mono, they're Space Grotesk Extrabold). The pairing signals
"technical but warm" — geometric grotesk for humans, mono for data/meta.

**Spacing & density:** compact, information-dense product UI (13–14px body
text is the norm, not 16px) contrasted with a generously spaced, large-type
marketing site. Card padding is consistently 16–20px; sections on the
marketing site breathe with 80–112px vertical rhythm (`py-20 sm:py-28`).

**Backgrounds:** flat color only — no photography anywhere in the product.
The only "texture" is a very subtle repeating dot-grid
(`radial-gradient(circle at 1px 1px, teal 1px, transparent 0)` at 34–40px
tiles, ~15–18% opacity) used exclusively on dark teal/forest hero and CTA
sections, sometimes slowly pan-animated. Soft oversized blurred color blobs
(`blur-3xl`, brand/bright at 10–20% opacity) sit in hero corners for depth.
No gradients are used on interactive elements (buttons, cards, chips) — solid
fills only; the dot-grid and corner-blobs are the sole gradient/texture usage,
confined to marketing hero/CTA sections.

**Animation:** minimal and purposeful, never decorative-only. The signature
motion is the wordmark's own "i" — literally an upward arrowhead that gently
bobs (`vLaunch`, ease-in-out, 1.9s loop) with a fading trail beneath it
(`vTrail`) — the brand's one recurring animated signature, used in the sidebar
logo, marketing nav, hero, and footer. Scroll-reveal on the marketing site is
a simple 18px translateY + opacity fade (`cubic-bezier(.2,.7,.2,1)`, 600ms,
staggered ~45ms per element) via IntersectionObserver — never bounce, never
skew, never 3D. Loading states are a simple 2px conic spinner
(`@keyframes spin`) or three pulsing dots for streaming text.

**Hover states:** buttons darken one step (`bg-brand` → `bg-brand-dark`);
outline buttons fill with the brand tint; cards lift their shadow from
`--shadow-card` to the slightly larger `--shadow-lift` and nudge up 2px
(`[data-tile]:hover` on the dashboard mockup) or just deepen shadow (studio
cards, no vertical movement); chips gain a `rgba(brand,.4)` border. No hue
inversion, no scale-up.

**Press/active states:** not explicitly defined in the source (no `:active`
rules found) — buttons rely on the browser default slight-darken; treat as
"same as hover, no separate press animation" unless asked to design one.

**Borders:** hairline 1px `--line` (`#e2e8e6`) on nearly everything — cards,
inputs, dividers. Selected/active states swap the border to solid brand teal
(never a colored left-border-only accent — the whole border changes, plus a
1px ring `ring-1 ring-brand` for extra emphasis on chips/plan cards).

**Shadows:** two-tier system only — `--shadow-card` (barely-there: two stacked
1–3px near-black-at-4–7%-opacity blurs, texture more than depth) for resting
cards, and `--shadow-lift` (6–16px spread at 5–8% opacity) on hover or for
popovers/menus. No inner shadows anywhere.

**Corner radii:** generous and consistent — `--radius-xl` (16px, "xl2" in
Tailwind config) is the signature card/button/panel radius; inputs and nav
items use 10px; small chips/badges use 6–10px; avatars and pills are fully
round; the app icon itself uses ~30% corner radius (superellipse-like, not a
perfect circle).

**Transparency & blur:** used sparingly and only for two purposes — (1)
`backdrop-blur` on sticky headers/topbars over content (`bg-white/80` /
`bg-paper/80`) so scrolled content softly shows through, and (2) a `bg-ink/40
backdrop-blur-sm` scrim behind the mobile nav drawer and account-menu
close-catcher. Never used decoratively on cards.

**Imagery color vibe:** N/A — there is no photography in the product. If/when
product photography is introduced, keep it warm and naturalistic (matching the
paper/forest palette) rather than cool or desaturated — nothing in the current
system suggests grain, duotone, or B&W treatment.

**Layout rules:** fixed 244px sidebar (desktop) collapsing to a full slide-in
drawer under `md`; sticky topbar and sticky sidebar; main content column caps
at `max-w-[1180px]`, centered, with `px-5 sm:px-8` gutters; marketing site caps
at `max-w-6xl`. Grids collapse to single-column on mobile via
`grid-auto-columns: minmax(0,1fr)` safety rule rather than manual breakpoint
juggling.

---

## Iconography

**No icon font, no SVG sprite sheet, no icon package.** Every icon in the
product — nav items, tone/content-type pickers, gig categories, all UI
chrome — is a hand-authored inline `<svg viewBox="0 0 24 24">` path string
kept in a single `ICON`/`ICONP` lookup object in `app.js`. Consistent
construction rules across all ~40 icons:
- `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`
- 24×24 viewBox, rendered at 16–20px (`w-4 h-4` / `w-5 h-5`)
- Geometric, minimal, 1–3 shapes per icon (never detailed/skeuomorphic)
- Color inherits from text color (`currentColor`) — icons recolor automatically with their button/chip state (muted at rest, brand-teal when active)

Because there's no shared external set to copy, this system does **not**
introduce a CDN icon library (Lucide/Heroicons) either — doing so would
introduce a visual style (icon library defaults) not present in the source.
When a component needs an icon, hand-author a same-weight (1.7px stroke,
round caps, 24×24) SVG matching the geometric/minimal style shown in the
component cards — do not substitute filled icons, duotone icons, or an
external library's default stroke weight.

**Emoji:** not used as iconography anywhere (see Content fundamentals).
**Unicode glyphs:** used exactly twice, as data not decoration — `✓` in
pricing feature lists and `→` as a directional cue in a couple of CTA
buttons/links ("Upgrade →", "See what it does").
**Logo mark:** the one real visual asset — a white upward arrow (built from a
triangle + rectangle "stem", not a literal arrow-glyph) in a teal
rounded-square, doubling as the app icon at all PWA sizes (16–512px) and as
the animated "i" in the "Vertil" wordmark. Copied into `assets/`.
