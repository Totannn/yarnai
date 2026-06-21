"""Generate the Yarn AI pricing & business model as a polished branded PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether)

# --- fonts (Segoe UI carries the ₦ glyph) ---
pdfmetrics.registerFont(TTFont("SUI", r"C:\Windows\Fonts\segoeui.ttf"))
pdfmetrics.registerFont(TTFont("SUI-B", r"C:\Windows\Fonts\segoeuib.ttf"))
pdfmetrics.registerFont(TTFont("SUI-SB", r"C:\Windows\Fonts\seguisb.ttf"))

# --- palette ---
BRAND = colors.HexColor("#0b8457")
BRAND_DK = colors.HexColor("#076c47")
TINT = colors.HexColor("#ecf7f1")
INK = colors.HexColor("#101828")
MUTED = colors.HexColor("#667085")
LINE = colors.HexColor("#dfe3e8")
GOLD = colors.HexColor("#b7791f")

OUT = r"C:\Users\olatu\Documents\yarn-ai\Yarn_AI_Pricing_Plan.pdf"

# --- styles ---
def style(name, **kw):
    base = dict(fontName="SUI", fontSize=10, leading=14, textColor=INK)
    base.update(kw)
    return ParagraphStyle(name, **base)

H1 = style("H1", fontName="SUI-B", fontSize=20, leading=24, textColor=BRAND_DK, spaceAfter=2)
H2 = style("H2", fontName="SUI-B", fontSize=14, leading=18, textColor=BRAND_DK, spaceBefore=14, spaceAfter=6)
H3 = style("H3", fontName="SUI-SB", fontSize=11, leading=15, textColor=INK, spaceBefore=8, spaceAfter=3)
BODY = style("BODY", spaceAfter=6)
SMALL = style("SMALL", fontSize=8.5, leading=12, textColor=MUTED)
LEDE = style("LEDE", fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=4)
CELL = style("CELL", fontSize=8.8, leading=11.5)
CELLB = style("CELLB", fontName="SUI-SB", fontSize=8.8, leading=11.5)
CELLH = style("CELLH", fontName="SUI-B", fontSize=8.8, leading=11.5, textColor=colors.white)
TLDR = style("TLDR", fontSize=9.5, leading=14, spaceAfter=3)

story = []


def P(text, st=BODY):
    story.append(Paragraph(text, st))


def gap(h=4):
    story.append(Spacer(1, h))


def table(rows, widths, header=True, zebra=True):
    data = []
    for r in rows:
        data.append([Paragraph(str(c), CELLH if (header and ri == 0) else
                               (CELLB if (isinstance(c, str) and c.startswith("**")) else CELL))
                     if not isinstance(c, Paragraph) else c
                     for c, ri in [(c, rows.index(r))]][0] if False else
                    [Paragraph(str(c).replace("**", ""), CELLH if (header and rows.index(r) == 0) else CELL) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    sty = [
        ("FONTNAME", (0, 0), (-1, -1), "SUI"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("LINEAFTER", (0, 0), (-2, -1), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ]
    if header:
        sty += [("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                sty.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f7faf8")))
    t.setStyle(TableStyle(sty))
    return t


def T(rows, widths):
    story.append(table(rows, widths))
    gap(8)


# ============================ CONTENT ============================

P("Yarn AI", H1)
P("Pricing &amp; Business Model — Nigerian Brand Voice Engine", LEDE)
P("Prepared 14 June 2026 &nbsp;·&nbsp; Assumptions: FX &#8358;1,600/$1; everyday generations on "
  "Sonnet 4.6 / Haiku 4.5, premium polish on Opus 4.8 (model tiering). All figures are planning "
  "estimates, not guarantees.", SMALL)
gap(6)

# ---- Claude pricing ----
P("Claude API pricing (cost basis)", H2)
T([["Model", "Input ($/1M tok)", "Output ($/1M tok)"],
   ["Opus 4.8 (claude-opus-4-8)", "$5.00", "$25.00"],
   ["Sonnet 4.6 (claude-sonnet-4-6)", "$3.00", "$15.00"],
   ["Haiku 4.5 (claude-haiku-4-5)", "$1.00", "$5.00"]],
  [70 * mm, 50 * mm, 50 * mm])

# ---- 1. Operating costs ----
P("1 · Operating cost scenarios", H2)

P("1a. Unit cost per action", H3)
P("Based on real token usage in the app (system prompt ~1,200 input tokens; output varies by feature).", BODY)
T([["Action", "Tokens (in / out)", "Opus 4.8", "Sonnet 4.6", "Haiku 4.5"],
   ["Generation (3 variants)", "1,200 / ~1,400", "₦70", "₦23", "₦7"],
   ["Refine one option", "1,000 / ~600", "₦40", "₦12", "₦4"],
   ["Content calendar (12 posts)", "1,200 / ~4,500", "₦210", "₦90", "₦30"],
   ["Rate / Brand advisor", "1,300 / ~4,000", "₦190", "₦80", "₦27"]],
  [52 * mm, 34 * mm, 28 * mm, 28 * mm, 28 * mm])
P("<b>Takeaway:</b> the same generation costs ₦70 on Opus but ₦23 on Sonnet and ₦7 on Haiku "
  "— a 3–10x reduction. Defaulting everyday work to Sonnet/Haiku is what makes the plans below profitable.", BODY)

P("1b. Cost per active user / month", H3)
P("Most users use 30–50% of quota, not 100%. Modeling a Growth user at ~250 generations/month:", BODY)
T([["Model used", "Cost/mo @250 gens", "vs ₦19,000 Growth price"],
   ["All Opus", "₦17,500", "~8% margin (loss-making)"],
   ["All Sonnet", "₦5,750", "~70% margin"],
   ["All Haiku", "₦1,875", "~90% margin"]],
  [55 * mm, 50 * mm, 65 * mm])

P("1c. Three operating-cost scenarios (total monthly burn incl. AI)", H3)
T([["Stage", "Users", "Monthly burn", "Notes"],
   ["Lean / pre-revenue", "≤500 (mostly free)", "₦60k–₦150k", "Hosting + light AI"],
   ["Base / traction", "~5,000 (~480 paid)", "₦3.5M–₦4M", "AI-dominated; ~71% gross margin"],
   ["Scale", "~50,000 (~4k paid)", "₦28M–₦34M", "~70% margin WITH tiering; ~30% without"]],
  [42 * mm, 40 * mm, 38 * mm, 50 * mm])

# ---- 2. Freemium ----
P("2 · Recommended freemium model", H2)
P("Free tier wide enough to prove the moat (the Naija voice) on the user's own brand, then gate the "
  "stickiest features — calendar, multiple brands, premium quality — behind paid. Anchor pricing to "
  "what it replaces: a freelance writer (₦5–20k/campaign) or a junior social media manager (₦50–150k/mo).", BODY)
T([["Tier", "Price/mo", "Generations", "Brands", "Calendar", "Model", "Gross margin*"],
   ["Free", "₦0", "10", "1", "No", "Haiku", "— (acquisition)"],
   ["Starter", "₦7,500", "150", "1", "No", "Sonnet", "~85%"],
   ["Growth (hero)", "₦19,000", "600", "3", "Yes", "Sonnet", "~70%"],
   ["Pro", "₦45,000", "Unlimited", "10", "Yes", "Sonnet + Opus polish", "~75%"],
   ["Agency", "₦150,000", "Unlimited", "25–50", "Yes + white-label", "Sonnet + Opus", "~80%"]],
  [26 * mm, 20 * mm, 22 * mm, 16 * mm, 24 * mm, 30 * mm, 24 * mm])
P("<i>*at realistic 30–50% quota utilization. “Unlimited” = fair-use cap.</i>", SMALL)
gap(4)
P("<b>Plus two non-subscription layers:</b>", BODY)
P("&bull; <b>Credit packs (“airtime model”):</b> ₦5,000 = ~50 generations, no subscription. Captures "
  "occasional users + agency overflow; matches how Nigerians buy data/airtime. ~80% margin.", BODY)
P("&bull; <b>Done-for-you tier (services):</b> ₦80k–₦200k/mo per client — your team runs their "
  "socials on the platform. Funds early growth, generates testimonials, teaches you what converts.", BODY)
P("<b>Annual = 2 months free</b> (e.g. Growth ₦190,000/yr) to lock cash and cut churn.", BODY)

# ---- 3. Projections ----
P("3 · Projected earnings (optimal plan mix)", H2)
P("Paid mix Starter 45% / Growth 35% / Pro 15% / Agency 5% → blended ARPPU ≈ ₦24,000/mo. "
  "Monthly churn ~6% (base).", BODY)
T([["Scenario", "Month", "Free actives", "Conv.", "Paid", "MRR", "ARR", "Gross profit/mo"],
   ["Conservative", "M12", "3,000", "4%", "~120", "₦2.9M", "₦35M (~$22k)", "~₦2.0M"],
   ["Base (hero)", "M12", "8,000", "6%", "~480", "₦11.5M", "₦138M (~$86k)", "~₦9M"],
   ["Optimistic", "M12", "20,000", "8%", "~1,600", "₦38M", "₦461M (~$288k)", "~₦28M"],
   ["Base", "M24", "30,000", "7%", "~2,100", "₦50M", "₦600M (~$375k)", "~₦40M"]],
  [26 * mm, 14 * mm, 22 * mm, 14 * mm, 16 * mm, 18 * mm, 30 * mm, 28 * mm])
P("Where the money concentrates (the “optimal plans”):", H3)
P("&bull; <b>Growth + Pro = ~60–65% of subscription revenue</b> despite being a minority of users. Make Growth the hero.", BODY)
P("&bull; <b>Agency is highest-leverage:</b> 20 agencies on ₦150k = ₦3M/mo at ~80% margin, near-zero marginal "
  "cost, low churn. One signed agency ≈ 8 Growth users in revenue.", BODY)
P("&bull; <b>Credits add ~10–15%</b> on top of subscription MRR and convert occasional users into subscribers.", BODY)

# ---- 4. Market ----
P("4 · Addressable market (TAM / SAM / SOM)", H2)
P("Nigeria first, then pan-African expansion. Anchors: ~39–40M MSMEs (SMEDAN/NBS), a large youth-driven "
  "creator &amp; gig economy, and a growing digital-ads market.", BODY)
P("Segment sizing (Nigeria)", H3)
T([["Segment", "Population", "Reachable", "Willingness", "Annual value (reachable)"],
   ["Online-active SMEs", "~5M of 40M MSMEs", "~1.5M", "₦12k/mo", "~₦216B (~$135M)"],
   ["Creators / freelancers", "~3M", "~600k", "₦8k/mo", "~₦58B (~$36M)"],
   ["Marketing agencies / studios", "~5,000", "~1,500", "₦150k/mo", "~₦2.7B (~$1.7M)"]],
  [42 * mm, 36 * mm, 24 * mm, 24 * mm, 44 * mm])
P("TAM → SAM → SOM", H3)
T([["Layer", "Definition", "Nigeria", "USD"],
   ["TAM", "All online-capable SMEs + creators + agencies", "~₦1.2T/yr", "~$750M"],
   ["SAM", "Smartphone + Pidgin/English + willing to pay (~15% of TAM)", "~₦180B/yr", "~$110M"],
   ["SOM", "Realistically capturable in 3 years (~1–3% of SAM)", "~₦2–5B/yr ARR", "~$1.5–3M"]],
  [18 * mm, 84 * mm, 34 * mm, 34 * mm])
P("The Base M24 projection (~₦600M ARR) is ~12–30% of the 3-year SOM — aggressive but achievable, "
  "with large headroom.", BODY)
P("<b>Expansion multiplier:</b> Pidgin/voice localization ports to Ghana, Kenya, South Africa, Côte d’Ivoire. "
  "Pan-African market is ~3–4x Nigeria → blended TAM ~$2.5–3B. The moat (localized voice engine) is the "
  "asset that ports across markets while staying defensible vs. global tools.", BODY)

# ---- TL;DR ----
gap(6)
tldr = [
    "<b>Margins work only with model tiering</b> — Sonnet/Haiku default keeps gross margin ~70–85%; all-Opus loses money on heavy users.",
    "<b>Free → Starter ₦7,500 → Growth ₦19,000 (hero) → Pro ₦45,000 → Agency ₦150,000</b>, plus ₦5,000 credit packs.",
    "<b>Base case: ~₦138M ARR by M12, ~₦600M by M24</b>, driven by Growth/Pro + agency white-label.",
    "<b>TAM ~$750M (Nigeria) / ~$2.5–3B (pan-African); SAM ~$110M; 3-yr SOM ~$1.5–3M ARR.</b>",
]
box = Table([[Paragraph("TL;DR", style("x", fontName="SUI-B", fontSize=11, textColor=BRAND_DK))]] +
            [[Paragraph("&bull; " + t, TLDR)] for t in tldr], colWidths=[170 * mm])
box.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), TINT),
    ("BOX", (0, 0), (-1, -1), 0.8, BRAND),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
]))
story.append(box)


# ============================ RENDER ============================

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("SUI", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 12 * mm, "Yarn AI — Pricing & Business Model (confidential draft)")
    canvas.drawRightString(192 * mm, 12 * mm, "Page %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 15 * mm, 192 * mm, 15 * mm)
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=16 * mm, bottomMargin=18 * mm,
                      title="Yarn AI - Pricing & Business Model", author="Yarn AI")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=footer)])
doc.build(story)
print("WROTE", OUT)
