"""Generate the Vertil Financial Model as a polished, branded PDF."""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle)

# Segoe UI carries the ₦ and ↑ glyphs.
pdfmetrics.registerFont(TTFont("SUI", r"C:\Windows\Fonts\segoeui.ttf"))
pdfmetrics.registerFont(TTFont("SUI-B", r"C:\Windows\Fonts\segoeuib.ttf"))
pdfmetrics.registerFont(TTFont("SUI-SB", r"C:\Windows\Fonts\seguisb.ttf"))

# Vertil palette
BRAND = colors.HexColor("#0e9488")
BRIGHT = colors.HexColor("#2dd4bf")
FOREST = colors.HexColor("#0c2724")
INK = colors.HexColor("#13312e")
MUTED = colors.HexColor("#5c726e")
LINE = colors.HexColor("#dbe5e2")
TINT = colors.HexColor("#e4f3f1")
AMBER = colors.HexColor("#b7791f")
ROSE = colors.HexColor("#b4322f")

OUT = r"C:\Users\olatu\Documents\yarn-ai\Vertil_Financial_Model.pdf"
FX = 1600.0  # ₦ per $1

# --------------------------------------------------------------------------- #
# MODEL INPUTS — token costs
# --------------------------------------------------------------------------- #
PRICES = {  # USD per 1M tokens (input, output)
    "Opus 4.8": (5.0, 25.0),
    "Sonnet 4.6": (3.0, 15.0),
    "Haiku 4.5": (1.0, 5.0),
}


def cost(model, in_tok, out_tok):
    pin, pout = PRICES[model]
    return (in_tok * pin + out_tok * pout) / 1_000_000 * FX


# per-action token profiles (Opus carries adaptive-thinking output; others plain)
def gen_cost(model):
    out = 1400 if model == "Opus 4.8" else 700
    return cost(model, 1200, out)


def cal_cost(model):
    out = 5000 if model == "Opus 4.8" else 3500
    return cost(model, 1200, out)


GEN = {m: gen_cost(m) for m in PRICES}
CAL = {m: cal_cost(m) for m in PRICES}


def paystack_fee(price):
    return min(price * 0.015 + 100, 2000) if price else 0


def naira(x):
    return "₦" + format(int(round(x)), ",")


# --------------------------------------------------------------------------- #
# PLANS — everyday generations run on Sonnet (model tiering); Pro/Agency may use
# Opus "premium polish" partially. Caps: Pro/Agency "unlimited" modeled at a
# fair-use ceiling so worst-case margin is computable.
# --------------------------------------------------------------------------- #
PLANS = [
    {"name": "Starter", "price": 7500, "gens": 150, "cals": 0, "model": "Sonnet 4.6", "note": "1 brand"},
    {"name": "Growth", "price": 19000, "gens": 600, "cals": 6, "model": "Sonnet 4.6", "note": "3 brands · calendar"},
    {"name": "Pro", "price": 45000, "gens": 2000, "cals": 20, "model": "Sonnet 4.6", "note": "‘unlimited’ — modeled at 2,000 fair-use"},
    {"name": "Agency", "price": 150000, "gens": 5000, "cals": 60, "model": "Sonnet 4.6", "note": "white-label · proposed"},
]


def plan_pnl(p, util=1.0):
    fee = paystack_fee(p["price"])
    net = p["price"] - fee
    g = GEN[p["model"]]
    c = CAL[p["model"]]
    ai = util * (p["gens"] * g + p["cals"] * c)
    profit = net - ai
    margin = profit / p["price"] if p["price"] else 0
    return {"fee": fee, "net": net, "ai": ai, "profit": profit, "margin": margin,
            "breakeven": net / g}


# --------------------------------------------------------------------------- #
# Styles + helpers
# --------------------------------------------------------------------------- #
def st(name, **kw):
    base = dict(fontName="SUI", fontSize=10, leading=14, textColor=INK)
    base.update(kw)
    return ParagraphStyle(name, **base)


H1 = st("H1", fontName="SUI-B", fontSize=24, leading=26, textColor=INK)
SUB = st("SUB", fontSize=11, leading=15, textColor=MUTED)
H2 = st("H2", fontName="SUI-B", fontSize=14, leading=18, textColor=BRAND, spaceBefore=16, spaceAfter=6)
H3 = st("H3", fontName="SUI-SB", fontSize=11, leading=15, spaceBefore=8, spaceAfter=3)
BODY = st("BODY", spaceAfter=6)
SMALL = st("SMALL", fontSize=8.5, leading=12, textColor=MUTED)
CELL = st("CELL", fontSize=8.6, leading=11)
CELLR = st("CELLR", fontSize=8.6, leading=11, alignment=2)
CELLH = st("CELLH", fontName="SUI-B", fontSize=8.4, leading=11, textColor=colors.white)
CELLHR = st("CELLHR", fontName="SUI-B", fontSize=8.4, leading=11, textColor=colors.white, alignment=2)

story = []


def P(t, s=BODY): story.append(Paragraph(t, s))
def gap(h=4): story.append(Spacer(1, h))


def table(rows, widths, aligns=None, hi=None):
    """rows: list of lists (row 0 = header). aligns: per-col 'l'/'r'. hi: set of row idxs to tint."""
    data = []
    for ri, r in enumerate(rows):
        cells = []
        for ci, val in enumerate(r):
            if ri == 0:
                stl = CELLHR if (aligns and aligns[ci] == "r") else CELLH
            else:
                stl = CELLR if (aligns and aligns[ci] == "r") else CELL
            cells.append(Paragraph(str(val), stl))
        data.append(cells)
    t = Table(data, colWidths=widths, repeatRows=1)
    sty = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            sty.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f3f8f7")))
    for i in (hi or []):
        sty.append(("BACKGROUND", (0, i), (-1, i), TINT))
    t.setStyle(TableStyle(sty))
    story.append(t)
    gap(8)


# =========================== CONTENT =========================== #

P("Vert<font color='#0e9488'>↑</font>l", st("brandbig", fontName="SUI-B", fontSize=30, leading=30, textColor=INK))
P("FINANCIAL MODEL &amp; UNIT ECONOMICS", st("kick", fontName="SUI-SB", fontSize=11, leading=14, textColor=BRAND, spaceBefore=6))
gap(2)
P("How much Vertil earns per subscriber, the cost to serve each plan, and the profit "
  "margin at typical and maximum usage — with a 12-month revenue model.", SUB)
P("Prepared 21 June 2026 &nbsp;·&nbsp; Confidential draft &nbsp;·&nbsp; FX ₦1,600 / $1", SMALL)
gap(8)

# Assumptions
P("1 · Assumptions &amp; cost basis", H2)
P("Vertil runs on Anthropic's Claude API. Everyday generations use the cost-efficient "
  "<b>Sonnet 4.6</b>; an optional “Premium polish” uses <b>Opus 4.8</b>. The Nigerian voice "
  "lives in Vertil's prompts, so Sonnet still produces strong, on-brand output.", BODY)
table(
    [["Model", "Input $/1M", "Output $/1M", "Cost / generation", "Cost / calendar"],
     ["Opus 4.8 (premium)", "$5.00", "$25.00", naira(GEN["Opus 4.8"]), naira(CAL["Opus 4.8"])],
     ["Sonnet 4.6 (standard)", "$3.00", "$15.00", naira(GEN["Sonnet 4.6"]), naira(CAL["Sonnet 4.6"])],
     ["Haiku 4.5 (free tier)", "$1.00", "$5.00", naira(GEN["Haiku 4.5"]), naira(CAL["Haiku 4.5"])]],
    [46 * mm, 26 * mm, 28 * mm, 36 * mm, 34 * mm],
    aligns=["l", "r", "r", "r", "r"])
P("A “generation” = one request returning 3 on-brand options (~1,200 input + ~700–1,400 output "
  "tokens). A calendar is a larger call (~3,500–5,000 output). Paystack fee = 1.5% + ₦100, capped at ₦2,000.", SMALL)

# Plans
P("2 · Plan structure", H2)
table(
    [["Plan", "Price / mo", "Generations", "Calendar", "Default model", "Notes"],
     ["Free", "₦0", "10", "—", "Haiku 4.5", "acquisition"],
     ["Starter", "₦7,500", "150", "—", "Sonnet 4.6", "1 brand voice"],
     ["Growth ★", "₦19,000", "600", "Yes", "Sonnet 4.6", "3 brands · hero plan"],
     ["Pro", "₦45,000", "Unlimited*", "Yes", "Sonnet + Opus", "10 brands · *fair-use"],
     ["Agency", "₦150,000", "Unlimited*", "Yes", "Sonnet + Opus", "white-label · proposed"]],
    [26 * mm, 24 * mm, 26 * mm, 20 * mm, 32 * mm, 42 * mm],
    aligns=["l", "r", "r", "l", "l", "l"])

# Per-subscriber economics
P("3 · Revenue &amp; margin per subscriber", H2)
P("For each paid plan: what Vertil collects, the Paystack fee, the net, and the AI cost to serve "
  "— at <b>maximum usage</b> (every generation in the plan used) and at <b>typical usage</b> (~35% "
  "of the cap, the realistic average).", BODY)

rows = [["Plan", "Price", "Paystack fee", "Net revenue", "AI cost (max)", "Profit (max)", "Margin (max)"]]
hi = []
for i, p in enumerate(PLANS, start=1):
    m = plan_pnl(p, 1.0)
    mg = m["margin"]
    mtxt = f"{mg*100:.0f}%"
    rows.append([p["name"], naira(p["price"]), naira(m["fee"]), naira(m["net"]),
                 naira(m["ai"]), naira(m["profit"]), mtxt])
table(rows, [22*mm, 22*mm, 26*mm, 26*mm, 26*mm, 26*mm, 24*mm],
      aligns=["l", "r", "r", "r", "r", "r", "r"])

rows2 = [["Plan", "AI cost (typical)", "Profit (typical)", "Margin (typical)", "Break-even", "Verdict"]]
for p in PLANS:
    mt = plan_pnl(p, 0.35)
    be = plan_pnl(p, 1.0)["breakeven"]
    safe = be > p["gens"]
    verdict = "Cap below break-even — always profitable" if safe else "Cap ABOVE break-even — needs fair-use guard"
    rows2.append([p["name"], naira(mt["ai"]), naira(mt["profit"]), f"{mt['margin']*100:.0f}%",
                  f"{int(round(be)):,} gens", verdict])
table(rows2, [20*mm, 28*mm, 28*mm, 26*mm, 24*mm, 46*mm],
      aligns=["l", "r", "r", "r", "r", "l"])

P("Reading this", H3)
P("&bull; <b>Starter &amp; Growth are bullet-proof.</b> Their generation caps (150 and 600) sit "
  "<i>below</i> the break-even point, so even a user who maxes out every month is profitable — "
  "Growth still nets ~24% at full tilt and ~72% at typical use.", BODY)
P("&bull; <b>Pro is the one to watch.</b> “Unlimited” breaks even around ~1,960 generations/month; "
  "a true power-user past that erodes the margin. Two guards keep it safe: a <b>fair-use ceiling</b> "
  "(~1,500–2,000/mo) and keeping Sonnet — not Opus — as the default. If Pro ran every generation on "
  f"Opus, cost per generation triples ({naira(GEN['Opus 4.8'])} vs {naira(GEN['Sonnet 4.6'])}) and heavy use goes negative.", BODY)
P("&bull; <b>Agency is the highest-margin line</b> at typical use (~71%), with near-zero marginal cost "
  "beyond AI — and the lowest churn, because agencies build their own business on top of it.", BODY)

# Free tier
P("4 · The cost of Free (customer acquisition)", H2)
free_cost = 10 * GEN["Haiku 4.5"]
P(f"A Free user costs about <b>{naira(free_cost)}/month</b> to serve (10 generations on Haiku). "
  f"At 8,000 free users that's ~{naira(8000*free_cost)}/month — the true cost of acquisition, "
  "recovered the moment ~6% convert to paid. Running Free on Haiku (not Sonnet) keeps this ~3× cheaper.", BODY)

# Contribution summary
P("5 · Contribution per paid subscriber (typical use)", H2)
P("What each subscriber contributes to gross profit in an average month — the number that compounds.", BODY)
crows = [["Plan", "Net revenue", "AI cost", "Gross profit / mo", "Gross profit / yr"]]
for p in PLANS:
    mt = plan_pnl(p, 0.35)
    crows.append([p["name"], naira(mt["net"]), naira(mt["ai"]), naira(mt["profit"]), naira(mt["profit"]*12)])
table(crows, [24*mm, 30*mm, 28*mm, 34*mm, 34*mm], aligns=["l", "r", "r", "r", "r"])

# Projections
P("6 · 12-month revenue model", H2)
P("Paid mix Starter 45% / Growth 35% / Pro 15% / Agency 5% → blended ARPPU ≈ ₦24,300/mo. "
  "Gross margin held at ~70% (Sonnet default, typical utilization). Monthly churn ~6% (base).", BODY)
ARPPU = 0.45*7500 + 0.35*19000 + 0.15*45000 + 0.05*150000
scen = [
    ("Conservative", 3000, 0.04),
    ("Base", 8000, 0.06),
    ("Optimistic", 20000, 0.08),
]
prows = [["Scenario (month 12)", "Free users", "Conv.", "Paid users", "MRR", "ARR", "Gross profit / mo"]]
for name, free, conv in scen:
    paid = round(free * conv)
    mrr = paid * ARPPU
    prows.append([name, f"{free:,}", f"{conv*100:.0f}%", f"{paid:,}",
                  naira(mrr), naira(mrr*12), naira(mrr*0.70)])
table(prows, [34*mm, 22*mm, 16*mm, 22*mm, 24*mm, 28*mm, 30*mm],
      aligns=["l", "r", "r", "r", "r", "r", "r"], hi=[2])
P(f"Blended ARPPU = {naira(ARPPU)} / paying user / month. Base case ≈ {naira(8000*0.06*ARPPU*12)} ARR "
  f"(~${int(round(8000*0.06*ARPPU*12/FX)):,}) by month 12.", SMALL)

# Risks & levers
P("7 · Key risks &amp; the levers that protect margin", H2)
P("&bull; <b>Model tiering is non-negotiable.</b> Sonnet default keeps gross margin ~70–85%; "
  "all-Opus would turn heavy users loss-making. Reserve Opus for a paid “Premium polish”.", BODY)
P("&bull; <b>Fair-use ceiling on “unlimited” Pro/Agency</b> (~1,800–2,000 generations) caps the tail risk "
  "while staying invisible to 99% of users.", BODY)
P("&bull; <b>Annual plans (2 months free)</b> convert monthly cancel-decisions into yearly ones and "
  "front-load cash — the single biggest churn lever.", BODY)
P("&bull; <b>FX exposure.</b> Costs are USD (Claude API); revenue is Naira. A weaker Naira raises cost "
  "per generation — model tiering is the hedge.", BODY)
P("&bull; <b>Prompt caching</b> can cut input-token cost up to ~90% on the repeated brand/system prefix, "
  "improving every margin above.", BODY)

# TL;DR
gap(4)
tldr = [
    f"<b>Per subscriber (typical use):</b> Starter ~{plan_pnl(PLANS[0],0.35)['margin']*100:.0f}% margin, "
    f"Growth ~{plan_pnl(PLANS[1],0.35)['margin']*100:.0f}%, Pro ~{plan_pnl(PLANS[2],0.35)['margin']*100:.0f}%, "
    f"Agency ~{plan_pnl(PLANS[3],0.35)['margin']*100:.0f}%.",
    f"<b>At max usage:</b> Starter ~{plan_pnl(PLANS[0],1.0)['margin']*100:.0f}% and Growth "
    f"~{plan_pnl(PLANS[1],1.0)['margin']*100:.0f}% stay profitable; Pro needs a fair-use ceiling.",
    "<b>Margins only work with model tiering</b> (Sonnet default, Opus as a premium add-on).",
    f"<b>Base case:</b> ~{naira(8000*0.06*ARPPU)} MRR by month 12 at ~70% gross margin.",
]
box = Table([[Paragraph("TL;DR", st("x", fontName="SUI-B", fontSize=11, textColor=BRAND))]] +
            [[Paragraph("&bull; " + t, st("t", fontSize=9.5, leading=13.5))] for t in tldr],
            colWidths=[174 * mm])
box.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), TINT), ("BOX", (0, 0), (-1, -1), 0.8, BRAND),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
]))
story.append(box)


# =========================== RENDER =========================== #
def draw_mark(c, x, y, s):
    """Vertil app mark: teal rounded square + white up-arrow."""
    c.setFillColor(BRAND)
    c.roundRect(x, y, s, s, s * 0.24, stroke=0, fill=1)
    c.setFillColor(colors.white)
    cx = x + s / 2
    p = c.beginPath()
    p.moveTo(cx, y + s * 0.80)          # apex
    p.lineTo(x + s * 0.74, y + s * 0.46)
    p.lineTo(x + s * 0.60, y + s * 0.46)
    p.lineTo(x + s * 0.60, y + s * 0.22)
    p.lineTo(x + s * 0.40, y + s * 0.22)
    p.lineTo(x + s * 0.40, y + s * 0.46)
    p.lineTo(x + s * 0.26, y + s * 0.46)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def footer(c, doc):
    c.saveState()
    draw_mark(c, 18 * mm, 11 * mm, 5 * mm)
    c.setFont("SUI", 7.5)
    c.setFillColor(MUTED)
    c.drawString(25 * mm, 12.2 * mm, "Vertil — Financial Model (confidential)")
    c.drawRightString(192 * mm, 12.2 * mm, "Page %d" % doc.page)
    c.setStrokeColor(LINE)
    c.line(18 * mm, 16 * mm, 192 * mm, 16 * mm)
    c.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=16 * mm, bottomMargin=18 * mm,
                      title="Vertil - Financial Model", author="Vertil")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="m")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=footer)])
doc.build(story)
print("WROTE", OUT)
